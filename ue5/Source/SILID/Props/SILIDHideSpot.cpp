#include "Props/SILIDHideSpot.h"
#include "Systems/SILIDDifficultySubsystem.h"
#include "Systems/SILIDSaveSubsystem.h"
#include "Player/SILIDCharacter.h"
#include "Player/SILIDPlayerController.h"
#include "Components/BoxComponent.h"
#include "Components/ArrowComponent.h"
#include "Components/CapsuleComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Logging/SILIDLog.h"

ASILIDHideSpot::ASILIDHideSpot()
{
	PrimaryActorTick.bCanEverTick = false;

	Volume = CreateDefaultSubobject<UBoxComponent>(TEXT("Volume"));
	RootComponent = Volume;
	Volume->InitBoxExtent(FVector(45.f, 45.f, 90.f));
	Volume->SetCollisionProfileName(TEXT("TriggerPawn")); // walkthroughable trigger
	Volume->SetGenerateOverlapEvents(true);

	CameraAnchor = CreateDefaultSubobject<UArrowComponent>(TEXT("CameraAnchor"));
	CameraAnchor->SetupAttachment(RootComponent);
	CameraAnchor->SetRelativeLocation(FVector(0.f, 0.f, 40.f));

	ExitAnchor = CreateDefaultSubobject<UArrowComponent>(TEXT("ExitAnchor"));
	ExitAnchor->SetupAttachment(RootComponent);
	ExitAnchor->SetRelativeLocation(FVector(0.f, -70.f, 0.f));
}

void ASILIDHideSpot::BeginPlay()
{
	Super::BeginPlay();

	if (USILIDSaveSubsystem* Save = GetWorld()->GetSubsystem<USILIDSaveSubsystem>())
	{
		Save->RegisterSaveable(this);
	}
}

bool ASILIDHideSpot::WouldBeFound(float SuspicionLevel) const
{
	// difficulty decides the base chance; suspicion (0..1) from noise/detection
	// raises it. Spec section 10: "discover the player under certain
	// circumstances" - he saw you enter, or the house is at full alert.
	const USILIDDifficultySubsystem* Diff = USILIDDifficultySubsystem::Get(this);
	const float Base = Diff ? Diff->GetHideSearchChance() : 0.3f;
	return FMath::FRand() < FMath::Clamp(Base * BaseSearchChance * 3.f + SuspicionLevel * 0.5f, 0.f, 0.95f);
}

bool ASILIDHideSpot::CanInteract(const ASILIDCharacter* Player) const
{
	return Player && (!bOccupied || Occupant == Player);
}

FText ASILIDHideSpot::GetInteractionText(const ASILIDCharacter* Player) const
{
	return bOccupied && Occupant == Player
		? NSLOCTEXT("SILID", "LeaveHide", "Come out")
		: NSLOCTEXT("SILID", "Hide", "Hide");
}

FText ASILIDHideSpot::GetExamineText(const ASILIDCharacter* Player) const
{
	return EnterLine;
}

bool ASILIDHideSpot::Interact(ASILIDCharacter* Player)
{
	if (!Player)
	{
		return false;
	}
	if (bOccupied && Occupant == Player)
	{
		ExitHide();
		return true;
	}
	if (bOccupied)
	{
		return false;
	}
	EnterHide(Player);
	return true;
}

void ASILIDHideSpot::EnterHide(ASILIDCharacter* Player)
{
	Occupant = Player;
	bOccupied = true;

	// store the player's pre-hide transform implicitly via the exit anchor
	ExitAnchor->SetWorldRotation(Player->GetActorRotation());
	ExitAnchor->SetWorldLocation(Player->GetActorLocation());

	// conceal: disable collision so the pawn can't be hit, hand the camera
	// to the hide spot's view (spec section 10: adjust camera, restrict move)
	Player->SetActorEnableCollision(false);
	Player->SetActorLocation(CameraAnchor->GetComponentLocation());
	Player->SetHiding(this);

	if (ASILIDPlayerController* PC = Cast<ASILIDPlayerController>(Player->GetController()))
	{
		PC->SetViewTargetWithBlend(this, 0.5f); // the spot itself owns a camera
	}

	OnHideOccupiedChanged.Broadcast(true, this);
}

void ASILIDHideSpot::ExitHide()
{
	if (!Occupant)
	{
		return;
	}
	if (ASILIDPlayerController* PC = Cast<ASILIDPlayerController>(Occupant->GetController()))
	{
		PC->SetViewTargetWithBlend(Occupant, 0.6f);
	}
	Occupant->SetActorLocation(ExitAnchor->GetComponentLocation());
	Occupant->SetActorRotation(ExitAnchor->GetForwardVector().Rotation());
	Occupant->SetHiding(nullptr);
	Occupant->SetActorEnableCollision(true);
	Occupant = nullptr;
	bOccupied = false;
	OnHideOccupiedChanged.Broadcast(false, this);
}
