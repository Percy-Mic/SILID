#include "AI/SILIDResidentController.h"
#include "AI/SILIDResident.h"
#include "Player/SILIDCharacter.h"
#include "Player/SILIDPlayerController.h"
#include "Props/SILIDDoor.h"
#include "Props/SILIDHideSpot.h"
#include "Systems/SILIDNoiseEmitterComponent.h"
#include "Systems/SILIDFlashlightComponent.h"
#include "Systems/SILIDDifficultySubsystem.h"
#include "Systems/SILIDTags.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Navigation/PathFollowingComponent.h"
#include "Perception/AIPerceptionComponent.h"
#include "Perception/AISenseConfig_Sight.h"
#include "Perception/AISenseConfig_Hearing.h"
#include "Perception/AISense_Sight.h"
#include "Systems/SILIDHealthComponent.h"
#include "Engine/OverlapResult.h"
#include "Logging/SILIDLog.h"

ASILIDResidentController::ASILIDResidentController()
{
	PrimaryActorTick.bCanEverTick = true;
}

void ASILIDResidentController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);
	Resident = Cast<ASILIDResident>(InPawn);

	if (Resident && Resident->Perception)
	{
		Resident->Perception->OnTargetPerceptionUpdated.AddDynamic(this, &ASILIDResidentController::OnPerceptionUpdated);
	}

	// subscribe to every noise in the world (spec section 8)
	USILIDNoiseEmitterComponent::OnNoiseEmitted.AddUObject(this, &ASILIDResidentController::HandleNoise);

	ApplyDifficultyTuning();
	SetState(EResidentState::Idle);
}

void ASILIDResidentController::EndPlay(const EEndPlayReason::Type Reason)
{
	USILIDNoiseEmitterComponent::OnNoiseEmitted.RemoveAll(this);
	Super::EndPlay(Reason);
}

void ASILIDResidentController::BeginPlay()
{
	Super::BeginPlay();
}

void ASILIDResidentController::ApplyDifficultyTuning()
{
	if (!Resident || !Resident->SightConfig)
	{
		return;
	}
	const USILIDDifficultySubsystem* Diff = USILIDDifficultySubsystem::Get(this);
	const float Sens = Diff ? Diff->GetAISensitivityMultiplier() : 1.f;

	// sensitivity scales perception radii (spec section 21: modifies systems)
	// forgiveness narrows the cone on Easy / widens it on Hard
	const float Forgiveness = Diff ? Diff->GetDetectionForgiveness() : 1.f;
	Resident->SightConfig->SightRadius = 900.f * Sens;
	Resident->SightConfig->LoseSightRadius = 1150.f * Sens;
	Resident->SightConfig->PeripheralVisionAngleDegrees = 62.f * Forgiveness;
	if (Resident->HearingConfig)
	{
		Resident->HearingConfig->HearingRange = 2200.f * Sens;
	}

	// speed scales too
	const float SpeedMul = Diff ? Diff->GetEnemySpeedMultiplier() : 1.f;
	if (UCharacterMovementComponent* CMC = Resident->GetCharacterMovement())
	{
		CMC->MaxWalkSpeed = 240.f * SpeedMul;     // patrol pace
		CMC->MaxWalkSpeedCrouched = 160.f * SpeedMul;
	}
}

// ---------------------------------------------------------------- hearing
void ASILIDResidentController::HandleNoise(const FSILIDNoiseEvent& Event)
{
	if (!Resident)
	{
		return;
	}

	const USILIDDifficultySubsystem* Diff = USILIDDifficultySubsystem::Get(this);
	const float Sens = Diff ? Diff->GetAISensitivityMultiplier() : 1.f;
	const float EffectiveRange = Resident->HearingConfig
		? Resident->HearingConfig->HearingRange * Event.GetInvestigationRadius(0.6f) * Sens
		: 1200.f;

	const float DistSq = FVector::DistSquared(Resident->GetActorLocation(), Event.Location);
	if (DistSq > FMath::Square(EffectiveRange))
	{
		return; // too far; the house is quiet to him
	}

	// hearing memory: recent noises stack suspicion even without sight
	HearingMemory = FMath::Min(1.5f, HearingMemory + 0.35f + Event.Loudness * 0.4f);

	switch (State)
	{
		case EResidentState::Idle:
		case EResidentState::Patrol:
		case EResidentState::Wander:
		case EResidentState::ReturnToPatrol:
			// loud noises (doors, impacts) pull him off patrol; whispers only
			// raise suspicion
			if (Event.Loudness >= 0.45f || Event.NoiseTag.MatchesTag(SILIDTags::NoiseRun))
			{
				InvestigationTarget = Event.Location;
				SetState(EResidentState::Investigate);
			}
			else
			{
				Suspicion = FMath::Min(1.f, Suspicion + Event.Loudness * 0.3f);
				SetState(EResidentState::Suspicious);
			}
			break;

		case EResidentState::Investigate:
		case EResidentState::Search:
		case EResidentState::SearchLastKnown:
			// update the search center to the newest evidence
			if (Event.Loudness >= 0.3f)
			{
				InvestigationTarget = Event.Location;
				StateTime = 0.f;
			}
			break;

		case EResidentState::Chase:
		case EResidentState::Attack:
		case EResidentState::DetectPlayer:
			// already committed; refresh last known if plausible
			if (Event.NoiseTag.MatchesTag(SILIDTags::NoiseRun))
			{
				LastKnownPlayerLocation = Event.Location;
				LastSeenAge = 0.f;
			}
			break;

		default:
			break;
	}
}

// --------------------------------------------------------------- vision
void ASILIDResidentController::OnPerceptionUpdated(AActor* Actor, FAIStimulus Stimulus)
{
	if (Actor == UGameplayStatics::GetPlayerCharacter(this, 0) && Stimulus.WasSuccessfullySensed())
	{
		LastKnownPlayerLocation = Actor->GetActorLocation();
		LastSeenAge = 0.f;

		if (State != EResidentState::Chase && State != EResidentState::Attack)
		{
			SetState(EResidentState::DetectPlayer);
		}
	}
}

void ASILIDResidentController::UpdateVisionModel(float Dt)
{
	// the perception component gives booleans; we add the psychological layer:
	// lighting, movement, crouch (spec section 9) feed SUSPICION growth, so a
	// half-glimpse in the dark builds dread instead of instant chase.
	LastSeenAge += Dt;

	if (CanSeePlayer() && PlayerChar)
	{
		const bool bPlayerLit = PlayerChar->Flashlight && PlayerChar->Flashlight->bFlashlightOn;
		const float Speed = PlayerChar->GetCharacterMovement() ? PlayerChar->GetCharacterMovement()->Velocity.Size2D() : 0.f;
		const bool bCrouched = PlayerChar->bIsCrouched;

		float Gain = 1.f;
		if (bPlayerLit)        Gain *= 2.2f;  // a light in a dark house is a beacon
		if (Speed > 300.f)     Gain *= 1.8f;  // sprinting
		else if (Speed > 150.f) Gain *= 1.2f; // running
		if (bCrouched)         Gain *= 0.55f; // small, low, dark

		Suspicion = FMath::Min(1.f, Suspicion + Gain * Dt * 0.9f);
	}
	else
	{
		Suspicion = FMath::Max(0.f, Suspicion - Dt * 0.12f);
		if (HearingMemory > 0.f)
		{
			HearingMemory = FMath::Max(0.f, HearingMemory - Dt * 0.2f);
		}
	}
}

bool ASILIDResidentController::CanSeePlayer() const
{
	if (!PlayerChar || !Resident || !Resident->Perception)
	{
		return false;
	}
	TArray<AActor*> SeenActors;
	Resident->Perception->GetCurrentlyPerceivedActors(UAISense_Sight::StaticClass(), SeenActors);
	return SeenActors.Contains(PlayerChar);
}

// --------------------------------------------------------------- machine
void ASILIDResidentController::SetState(EResidentState NewState)
{
	if (State == NewState)
	{
		return;
	}

	EResidentState Old = State;
	State = NewState;
	StateTime = 0.f;

	// speed profile per state (movement sells the threat)
	if (Resident && Resident->GetCharacterMovement())
	{
		UCharacterMovementComponent* CMC = Resident->GetCharacterMovement();
		const USILIDDifficultySubsystem* Diff = USILIDDifficultySubsystem::Get(this);
		const float SpeedMul = Diff ? Diff->GetEnemySpeedMultiplier() : 1.f;
		switch (NewState)
		{
			case EResidentState::Chase:
			case EResidentState::Attack:
				CMC->MaxWalkSpeed = 340.f * SpeedMul; // faster than the player's walk
				break;
			case EResidentState::Investigate:
			case EResidentState::Search:
			case EResidentState::SearchLastKnown:
				CMC->MaxWalkSpeed = 280.f * SpeedMul;
				break;
			default:
				CMC->MaxWalkSpeed = 240.f * SpeedMul; // unhurried: he owns the house
		}
	}

	SILID_LOG_CAT(LogSILID, TEXT("Resident: %s -> %s (suspicion %.2f)"),
		*UEnum::GetValueAsString(Old), *UEnum::GetValueAsString(NewState), Suspicion);
	OnStateChanged.Broadcast(NewState);
}

void ASILIDResidentController::Tick(float Dt)
{
	Super::Tick(Dt);

	if (!Resident)
	{
		return;
	}
	if (!PlayerChar)
	{
		PlayerChar = Cast<ASILIDCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));
	}

	StateTime += Dt;
	DoorCheckCooldown -= Dt;
	AttackCooldown -= Dt;
	UpdateVisionModel(Dt);

	switch (State)
	{
		case EResidentState::Idle:            State_Idle(Dt); break;
		case EResidentState::Patrol:          State_Patrol(Dt); break;
		case EResidentState::Wander:          State_Wander(Dt); break;
		case EResidentState::Investigate:     State_Investigate(Dt); break;
		case EResidentState::Suspicious:      State_Suspicious(Dt); break;
		case EResidentState::Search:          State_Search(Dt); break;
		case EResidentState::Chase:           State_Chase(Dt); break;
		case EResidentState::Attack:          State_Attack(Dt); break;
		case EResidentState::LosePlayer:      State_LosePlayer(Dt); break;
		case EResidentState::SearchLastKnown: State_SearchLastKnown(Dt); break;
		case EResidentState::ReturnToPatrol:  State_ReturnToPatrol(Dt); break;
		default: break;
	}
}

// ------------------------------- states -------------------------------
void ASILIDResidentController::State_Idle(float Dt)
{
	IdleWait -= Dt;
	if (IdleWait <= 0.f)
	{
		SetState(EResidentState::Patrol);
	}
}

void ASILIDResidentController::State_Patrol(float Dt)
{
	PickPatrolPoint();
	if (MoveToLocationEx(InvestigationTarget, 80.f) == EPathFollowingRequestResult::AlreadyAtGoal)
	{
		IdleWait = FMath::RandRange(3.f, 8.f); // he lingers. this is his house.
		SetState(EResidentState::Idle);
	}
	// small chance to wander instead of marching the route
	if (FMath::FRand() < Dt * 0.02f)
	{
		SetState(EResidentState::Wander);
	}
}

void ASILIDResidentController::State_Wander(float Dt)
{
	// drift toward a random nearby room point
	if (StateTime < 0.1f)
	{
		const FVector Base = Resident->GetActorLocation();
		InvestigationTarget = Base + FVector(FMath::FRandRange(-500.f, 500.f), FMath::FRandRange(-500.f, 500.f), 0.f);
		MoveToLocationEx(InvestigationTarget, 60.f);
	}
	if (FMath::FRand() < Dt * 0.08f || StateTime > 20.f)
	{
		SetState(EResidentState::Patrol);
	}
}

void ASILIDResidentController::State_Investigate(float Dt)
{
	if (StateTime < 0.1f)
	{
		MoveToLocationEx(InvestigationTarget, 70.f);
	}

	// arrives: open nearby doors like a searcher, then look around
	if (DoorCheckCooldown <= 0.f)
	{
		DoorCheckCooldown = 2.5f;
		OpenNearbyDoor();
	}

	if (Suspicion > 0.75f)
	{
		SetState(EResidentState::Search);
	}
	else if (FMath::FRand() < Dt * 0.3f)
	{
		Suspicion = FMath::Max(0.f, Suspicion - Dt * 0.2f);
	}

	if (StateTime > 12.f)
	{
		SetState(EResidentState::Search);
	}
}

void ASILIDResidentController::State_Suspicious(float Dt)
{
	// stands still, listening. faces the last stimulus.
	if (InvestigationTarget != FVector::ZeroVector)
	{
		const FVector Dir = InvestigationTarget - Resident->GetActorLocation();
		if (!Dir.IsNearlyZero())
		{
			SetFocus(Resident);
			Resident->SetActorRotation(FRotator(0.f, Dir.Rotation().Yaw, 0.f));
		}
	}
	if (StateTime > 3.f)
	{
		if (Suspicion > 0.4f || HearingMemory > 0.8f)
		{
			InvestigationTarget = InvestigationTarget.IsNearlyZero() ? Resident->GetActorLocation() : InvestigationTarget;
			SetState(EResidentState::Investigate);
		}
		else
		{
			SetState(EResidentState::Patrol);
		}
	}
}

void ASILIDResidentController::State_Search(float Dt)
{
	if (StateTime < 0.1f)
	{
		// the search: hiding spots near the evidence, then a spiral of points
		SearchNearbyHidingSpots(InvestigationTarget);
		MoveToLocationEx(InvestigationTarget, 50.f);
	}

	if (StateTime > 4.f && FMath::FRand() < Dt * 0.5f)
	{
		// new search point around the evidence
		const FVector Offset(FMath::FRandRange(-350.f, 350.f), FMath::FRandRange(-350.f, 350.f), 0.f);
		InvestigationTarget += Offset;
		MoveToLocationEx(InvestigationTarget, 50.f);
		StateTime = 1.f; // keep the search breathing
	}

	if (StateTime > 24.f)
	{
		SetState(EResidentState::ReturnToPatrol);
	}
}

void ASILIDResidentController::State_Chase(float Dt)
{
	if (!PlayerChar)
	{
		SetState(EResidentState::ReturnToPatrol);
		return;
	}

	if (CanSeePlayer())
	{
		LastKnownPlayerLocation = PlayerChar->GetActorLocation();
		LastSeenAge = 0.f;
		MoveToLocationEx(LastKnownPlayerLocation, 100.f);
	}
	else if (LastSeenAge > 1.2f)
	{
		SetState(EResidentState::LosePlayer);
		return;
	}

	if (FVector::Dist(Resident->GetActorLocation(), PlayerChar->GetActorLocation()) < Resident->AttackReach)
	{
		SetState(EResidentState::Attack);
	}

	// doors between him and the player get opened
	if (DoorCheckCooldown <= 0.f)
	{
		DoorCheckCooldown = 1.2f;
		OpenNearbyDoor();
	}
}

void ASILIDResidentController::State_Attack(float Dt)
{
	if (!PlayerChar)
	{
		return;
	}
	TryAttackPlayer();

	// if the player escaped reach, go back to chasing
	if (FVector::Dist(Resident->GetActorLocation(), PlayerChar->GetActorLocation()) > Resident->AttackReach * 1.4f)
	{
		SetState(EResidentState::Chase);
	}
}

void ASILIDResidentController::State_LosePlayer(float Dt)
{
	// one beat of stillness: he listens (dread beat for the player)
	if (StateTime > 1.5f)
	{
		SetState(EResidentState::SearchLastKnown);
	}
}

void ASILIDResidentController::State_SearchLastKnown(float Dt)
{
	InvestigationTarget = LastKnownPlayerLocation;
	State_Search(Dt); // same behavior, different exit
	if (StateTime > 16.f)
	{
		SetState(EResidentState::ReturnToPatrol);
	}
}

void ASILIDResidentController::State_ReturnToPatrol(float Dt)
{
	SetState(EResidentState::Patrol);
}

// --------------------------------------------------------------- helpers
EPathFollowingRequestResult::Type ASILIDResidentController::MoveToLocationEx(const FVector& Location, float Acceptance)
{
	return MoveToLocation(Location, Acceptance, /*bStopOnOverlap*/ false,
		/*bUsePathfinding*/ true, /*bProjectDestinationToNavigation*/ true);
}

void ASILIDResidentController::OpenNearbyDoor()
{
	if (!Resident)
	{
		return;
	}
	// AI opens doors in his path (spec section 7: "uses doors")
	TArray<FOverlapResult> Overlaps;
	FCollisionShape Shape = FCollisionShape::MakeSphere(220.f);
	if (GetWorld()->OverlapMultiByObjectType(Overlaps, Resident->GetActorLocation(), FQuat::Identity,
		FCollisionObjectQueryParams(ECC_WorldDynamic), Shape))
	{
		for (const FOverlapResult& O : Overlaps)
		{
			if (ASILIDDoor* Door = Cast<ASILIDDoor>(O.GetActor()))
			{
				if (!Door->bOpen && !Door->IsLocked())
				{
					Door->SetOpen(true);
				}
			}
		}
	}
}

void ASILIDResidentController::TryAttackPlayer()
{
	if (AttackCooldown > 0.f || !PlayerChar || !Resident)
	{
		return;
	}
	AttackCooldown = 1.2f;

	if (USILIDHealthComponent* Health = PlayerChar->FindComponentByClass<USILIDHealthComponent>())
	{
		Health->ApplyDamage(Resident->AttackDamage, Resident);
	}
	// the kill is instant at full damage (one clean catch: horror contract)
	// death handling belongs to the game mode (respawn/ending)
}

void ASILIDResidentController::SearchNearbyHidingSpots(const FVector& Around)
{
	// spec section 10: "the Resident should search nearby locations depending
	// on difficulty and circumstances"
	TArray<FOverlapResult> Overlaps;
	FCollisionShape Shape = FCollisionShape::MakeSphere(600.f);
	if (GetWorld()->OverlapMultiByObjectType(Overlaps, Around, FQuat::Identity,
		FCollisionObjectQueryParams(ECC_WorldDynamic), Shape))
	{
		for (const FOverlapResult& O : Overlaps)
		{
			if (ASILIDHideSpot* Spot = Cast<ASILIDHideSpot>(O.GetActor()))
			{
				if (Spot->IsOccupied() && Spot->WouldBeFound(Suspicion))
				{
					// he pulls the player out: capture, not teleport-kill
					if (ASILIDCharacter* Occupant = Spot->GetOccupant())
					if (USILIDHealthComponent* Health = Occupant->FindComponentByClass<USILIDHealthComponent>())
					{
						Health->ApplyDamage(Resident ? Resident->AttackDamage : 100.f, Resident);
					}
				}
			}
		}
	}
}

void ASILIDResidentController::PickPatrolPoint()
{
	// patrol points come from the level: actors tagged "PatrolPoint" or the
	// controller's own array set by the room director. Simple, data-driven.
	if (PatrolPoints.Num() == 0)
	{
		// fallback: patrol the house's grand-axis rooms (plan.js GF plan coords:
		// plan x -> UE X, plan z -> UE Y, z=0 is the ground-floor slab). These
		// are authored, not scanned: the Resident walks the same public rooms
		// a servant would — service hall, grand hall, dining room, foyer.
		static const TArray<FVector> HousePatrol = {
			FVector(-1550.0,     0.0, 100.0),   // service hall mid
			FVector(  -30.0,     0.0, 100.0),   // grand hall centre
			FVector(  -30.0,  -650.0, 100.0),   // dining room centre
			FVector(  -30.0,   650.0, 100.0),   // foyer, by the stair
			FVector(  600.0,   650.0, 100.0),   // sitting room
		};
		if (InvestigationTarget.IsNearlyZero())
		{
			InvestigationTarget = HousePatrol[PatrolIndex % HousePatrol.Num()];
		}
		PatrolPoints = HousePatrol;
		return;
	}
	if (FMath::IsNearlyZero(FVector::Dist2D(InvestigationTarget, PatrolPoints[PatrolIndex])) || StateTime > 30.f)
	{
		PatrolIndex = (PatrolIndex + 1) % PatrolPoints.Num();
		InvestigationTarget = PatrolPoints[PatrolIndex];
	}
}

void ASILIDResidentController::UpdateControlRotation(float Dt, bool bUpdatePawn)
{
	Super::UpdateControlRotation(Dt, bUpdatePawn);
}
