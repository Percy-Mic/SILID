#include "Systems/SILIDGameMode.h"
#include "Systems/SILIDObjectiveSubsystem.h"
#include "Systems/SILIDGameState.h"
#include "Systems/SILIDPlayerState.h"
#include "Systems/SILIDSaveSubsystem.h"
#include "Systems/SILIDDifficultySubsystem.h"
#include "Systems/SILIDRandomizerSubsystem.h"
#include "Systems/SILIDHealthComponent.h"
#include "Systems/SILIDGameInstance.h"
#include "UI/SILIDHUDWidget.h"
#include "Player/SILIDCharacter.h"
#include "Player/SILIDPlayerController.h"
#include "AI/SILIDResident.h"
#include "AI/SILIDResidentController.h"
#include "GameFramework/PlayerStart.h"
#include "Kismet/GameplayStatics.h"
#include "Blueprint/WidgetBlueprintLibrary.h"
#include "Misc/DateTime.h"
#include "EngineUtils.h"
#include "Logging/SILIDLog.h"

ASILIDGameMode::ASILIDGameMode()
{
	DefaultPawnClass = ASILIDCharacter::StaticClass();
	PlayerControllerClass = ASILIDPlayerController::StaticClass();
	// doc 12 §1: the replicated run read-model + per-player state
	GameStateClass = ASILIDGameState::StaticClass();
	PlayerStateClass = ASILIDPlayerState::StaticClass();
	bStartPlayersAsSpectators = false;
}

void ASILIDGameMode::BeginPlay()
{
	Super::BeginPlay();

	ApplyDifficulty();

	// doc 12 §1: publish the run phase to the replicated read-model (GameMode
	// stays the server-side authority; GameState mirrors it to clients)
	if (ASILIDGameState* GS = Cast<ASILIDGameState>(GameState))
	{
		GS->SetRunPhase(ESILIDRunPhase::Exploring);
	}

	// P13: the HUD objective line follows the objective fabric (activate/
	// complete push the current goal; the initial push sets the default line)
	if (USILIDObjectiveSubsystem* Objectives = GetWorld() ? GetWorld()->GetSubsystem<USILIDObjectiveSubsystem>() : nullptr)
	{
		Objectives->OnObjectiveActivated.AddDynamic(this, &ASILIDGameMode::HandleObjectiveChanged);
		Objectives->OnObjectiveCompleted.AddDynamic(this, &ASILIDGameMode::HandleObjectiveChanged);
		HandleObjectiveChanged(NAME_None);
	}

	// fresh run seed: new every restart, restored from the save on load.
	// NOTE: the scatter itself happens in the randomizer's OnWorldBeginPlay
	// (after every actor has registered its spawn points) — calling it here
	// would find zero registered points and silently do nothing.

	// hook player death
	if (ASILIDCharacter* Player = Cast<ASILIDCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0)))
	{
		if (USILIDHealthComponent* Health = Player->FindComponentByClass<USILIDHealthComponent>())
		{
			Health->OnDied.AddDynamic(this, &ASILIDGameMode::HandlePlayerDeath);
		}
	}

	// find respawn point (first PlayerStart; designers can tag a hidden one)
	for (TActorIterator<APlayerStart> It(GetWorld()); It; ++It)
	{
		RespawnPoint = *It;
		break;
	}

	// generate the run seed here; the randomizer's OnWorldBeginPlay consumes
	// it after all spawn points have registered (ordering note above)
	RunSeed = static_cast<int32>(FDateTime::UtcNow().ToUnixTimestamp() % 2147483647);

	// the Resident exists from the first frame the player can meet him; a
	// designer-placed one wins (spec section 7: the hunt begins on entry)
	SpawnResidentIfMissing();

	// create + bind the HUD if a widget class is assigned
	if (HUDWidgetClass)
	{
		if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
		{
			if (USILIDHUDWidget* HUD = CreateWidget<USILIDHUDWidget>(PC, HUDWidgetClass))
			{
			HUD->AddToPlayerScreen();
				if (ASILIDPlayerController* SILIDPC = Cast<ASILIDPlayerController>(PC))
				{
					SILIDPC->HUDWidget = HUD;
					HUD->BindController(SILIDPC);
				}
			}
		}
	}
}

void ASILIDGameMode::HandleObjectiveChanged(FName ObjectiveId)
{
	const UWorld* WorldPtr = GetWorld();
	const USILIDObjectiveSubsystem* Objectives = WorldPtr ? WorldPtr->GetSubsystem<USILIDObjectiveSubsystem>() : nullptr;
	if (!Objectives)
	{
		return;
	}
	APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0);
	ASILIDPlayerController* SILIDPC = Cast<ASILIDPlayerController>(PC);
	if (!SILIDPC || !SILIDPC->HUDWidget)
	{
		return;
	}
	const FText Goal = Objectives->GetCurrentObjectiveText();
	SILIDPC->HUDWidget->PushObjective(Goal.IsEmpty() ? FText::FromString(TEXT("Find a way out")) : Goal);
}

void ASILIDGameMode::ApplyDifficulty()
{
	if (USILIDGameInstance* GI = GetGameInstance<USILIDGameInstance>())
	{
		if (USILIDDifficultySubsystem* Diff = USILIDDifficultySubsystem::Get(this))
		{
			Diff->SetDifficulty(GI->SelectedDifficulty);
		}
	}
}

void ASILIDGameMode::SpawnResidentIfMissing()
{
	for (TActorIterator<ASILIDResident> It(GetWorld()); It; ++It)
	{
		return;   // a designer-placed Resident wins
	}

	// Spawn on the public ground floor, far from the foyer entry: the player
	// gets a few rooms of grace before the first sight/hearing contact.
	// plan.js GF plan coords (plan z -> UE Y), z=100 is capsule-centre height.
	static const TArray<FVector> Spawns = {
		FVector(-1550.0, 0.0, 100.0),    // service hall
		FVector( -30.0, -650.0, 100.0),  // dining room
		FVector( 600.0,  650.0, 100.0),  // sitting room
		FVector( -900.0, 650.0, 100.0),  // formal living room
	};
	const int32 Index = FMath::RandRange(0, Spawns.Num() - 1);
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride =
		ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
	ASILIDResident* Resident = GetWorld()->SpawnActor<ASILIDResident>(
		ASILIDResident::StaticClass(), Spawns[Index], FRotator::ZeroRotator, Params);
	if (Resident)
	{
		Resident->SpawnDefaultController();
		if (ASILIDResidentController* RC = Cast<ASILIDResidentController>(Resident->GetController()))
		{
			RC->ApplyDifficultyTuning();
		}
		SILID_LOG_CAT(LogSILID, TEXT("Resident auto-spawned at patrol midpoint %d"), Index);
	}
}

void ASILIDGameMode::HandlePlayerDeath()
{
	SILID_LOG_CAT(LogSILID, TEXT("Player died"));
	if (ASILIDGameState* GS = Cast<ASILIDGameState>(GameState))
	{
		GS->SetRunPhase(ESILIDRunPhase::Dead);
	}
	OnPlayerDied.Broadcast();

	// respawn: restore the last save (puzzle/room state persists; inventory
	// and position revert to the save moment - spec section 20)
	if (USILIDSaveSubsystem* Save = GetWorld()->GetSubsystem<USILIDSaveSubsystem>())
	{
		if (Save->HasSave())
		{
			FString Error;
			if (!Save->LoadFromSlot(Error))
			{
				SILID_WARN_CAT(LogSILID, TEXT("Respawn load failed: %s"), *Error);
			}
		}
	}

	// if the save lacks the player (died before first autosave), teleport to spawn
	if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
	{
		if (APawn* Pawn = PC->GetPawn())
		{
			Pawn->SetActorLocationAndRotation(RespawnPoint ? RespawnPoint->GetActorLocation() : FVector(0, 0, 100),
				RespawnPoint ? RespawnPoint->GetActorRotation() : FRotator::ZeroRotator, false, nullptr, ETeleportType::TeleportPhysics);
			if (USILIDHealthComponent* Health = Pawn->FindComponentByClass<USILIDHealthComponent>())
			{
				Health->Heal(Health->MaxHealth);
			}
		}
		PC->SetViewTargetWithBlend(PC->GetPawn(), 1.5f); // waking back at the door
	}
}

void ASILIDGameMode::NotifyKeyCollected()
{
	SILID_LOG_CAT(LogSILID, TEXT("Key collected - check your escape routes"));
	// routes decide their own readiness (spec: escape system, multiple paths);
	// the game mode no longer gates the win on a key count
}

void ASILIDGameMode::ReachEscape()
{
	if (bEscaped)
	{
		return;
	}
	bEscaped = true;
	if (ASILIDGameState* GS = Cast<ASILIDGameState>(GameState))
	{
		GS->SetEscaped(true); // mirror to clients (also sets phase = Escaped)
	}
	SILID_LOG_CAT(LogSILID, TEXT("ESCAPE: player made it out"));
	OnEscapeReached.Broadcast();

	// final autosave then end the run (UI shows the ending screen)
	if (USILIDSaveSubsystem* Save = GetWorld()->GetSubsystem<USILIDSaveSubsystem>())
	{
		FString Error;
		Save->SaveToSlot(Error);
	}
	UGameplayStatics::SetGamePaused(this, true);
}
