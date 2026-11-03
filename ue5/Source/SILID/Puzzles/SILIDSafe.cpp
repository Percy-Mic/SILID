#include "Puzzles/SILIDSafe.h"
#include "Puzzles/SILIDRadio.h"
#include "Props/SILIDPickup.h"
#include "Systems/SILIDCodeLockComponent.h"
#include "Systems/SILIDNoiseEmitterComponent.h"
#include "Systems/SILIDSaveGame.h"
#include "Systems/SILIDTags.h"
#include "Player/SILIDPlayerController.h"
#include "Player/SILIDCharacter.h"
#include "Components/StaticMeshComponent.h"
#include "Logging/SILIDLog.h"

ASILIDSafe::ASILIDSafe()
{
	PrimaryActorTick.bCanEverTick = false;

	BodyMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("BodyMesh"));
	RootComponent = BodyMesh;
	BodyMesh->SetCollisionProfileName(TEXT("BlockAll"));

	DoorMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("DoorMesh"));
	DoorMesh->SetupAttachment(BodyMesh);
	DoorMesh->SetCollisionProfileName(TEXT("BlockAll"));

	CodeLock = CreateDefaultSubobject<USILIDCodeLockComponent>(TEXT("CodeLock"));
	NoiseEmitter = CreateDefaultSubobject<USILIDNoiseEmitterComponent>(TEXT("NoiseEmitter"));
}

void ASILIDSafe::BeginPlay()
{
	Super::BeginPlay();

	if (CodeLock)
	{
		CodeLock->OnUnlocked.AddDynamic(this, &ASILIDSafe::HandleLockUnlocked);
	}
	if (USILIDSaveSubsystem* Save = GetWorld()->GetSubsystem<USILIDSaveSubsystem>())
	{
		Save->RegisterSaveable(this);
	}
}

bool ASILIDSafe::CanInteract(const ASILIDCharacter* Player) const
{
	return !bOpened;
}

FText ASILIDSafe::GetInteractionText(const ASILIDCharacter* Player) const
{
	return bOpened ? FText::GetEmpty() : NSLOCTEXT("SILID", "SafeTry", "The safe");
}

FText ASILIDSafe::GetExamineText(const ASILIDCharacter* Player) const
{
	return NSLOCTEXT("SILID", "SafeHint", "A rusted safe behind the baro. Three brass wheels, a hairline of light under the door.");
}

bool ASILIDSafe::Interact(ASILIDCharacter* Player)
{
	if (bOpened || !Player)
	{
		return false;
	}

	// the keypad UI opens via the controller's examine channel (Phase 2 wires
	// the widget; the lock logic is complete here)
	if (ASILIDPlayerController* PC = Cast<ASILIDPlayerController>(Player->GetController()))
	{
		PC->ShowExamineText(NSLOCTEXT("SILID", "SafeKeypad", "Three brass wheels. Enter a code."));
	}

	// code entry via Blueprint/UI: BP calls CodeLock->TryCode(); on success
	// Open() fires through the delegate bound above.
	return true;
}

void ASILIDSafe::Open()
{
	if (bOpened)
	{
		return;
	}
	bOpened = true;

	// swing the door (placeholder transform anim; the phase-2 polish adds a
	// timeline with a groan)
	DoorMesh->SetRelativeRotation(FRotator(0.f, -100.f, 0.f));

	if (NoiseEmitter)
	{
		NoiseEmitter->EmitNoise(FVector(0.6f, 0, 0), SILIDTags::NoiseDoor);
	}

	// reveal the reward
	if (RewardPickupClass && !SpawnedReward)
	{
		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		SpawnedReward = GetWorld()->SpawnActor<ASILIDPickup>(RewardPickupClass, GetActorLocation() + GetActorForwardVector() * 40.f, GetActorRotation(), Params);
	}

	OnSafeOpened.Broadcast(this);
	SILID_LOG_CAT(LogSILID, TEXT("Safe %s opened"), *GetName());
}

void ASILIDSafe::OnSave(USILIDSaveGame* SaveGame)
{
	if (SaveGame)
	{
		SaveGame->Flags.Add(GetSaveId() + TEXT("_Opened"), bOpened);
	}
}

void ASILIDSafe::OnLoad(const USILIDSaveGame* SaveGame)
{
	if (const bool* Found = SaveGame ? SaveGame->Flags.Find(GetSaveId() + TEXT("_Opened")) : nullptr)
	{
		if (*Found && !bOpened)
		{
			bOpened = false; // Open() sets it; ensure spawn path runs
			Open();
		}
	}
}
