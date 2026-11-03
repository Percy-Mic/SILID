#include "Props/SILIDDoor.h"
#include "Props/SILIDPickup.h"
#include "Systems/SILIDCodeLockComponent.h"
#include "Systems/SILIDElectricalSystemSubsystem.h"
#include "Systems/SILIDNoiseEmitterComponent.h"
#include "Systems/SILIDInventoryComponent.h"
#include "Systems/SILIDSaveGame.h"
#include "Systems/SILIDSaveSubsystem.h"
#include "Systems/SILIDTags.h"
#include "Player/SILIDCharacter.h"
#include "Components/StaticMeshComponent.h"
#include "Curves/CurveFloat.h"
#include "Kismet/GameplayStatics.h"
#include "Logging/SILIDLog.h"

ASILIDDoor::ASILIDDoor()
{
	PrimaryActorTick.bCanEverTick = false;

	FrameMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("FrameMesh"));
	RootComponent = FrameMesh;
	FrameMesh->SetCollisionProfileName(TEXT("BlockAll"));

	LeafPivot = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("LeafPivot"));
	LeafPivot->SetupAttachment(FrameMesh);
	LeafPivot->SetCollisionProfileName(TEXT("BlockAll"));
	LeafPivot->SetIsReplicated(false);

	CodeLock = CreateDefaultSubobject<USILIDCodeLockComponent>(TEXT("CodeLock"));
	NoiseEmitter = CreateDefaultSubobject<USILIDNoiseEmitterComponent>(TEXT("NoiseEmitter"));
}

void ASILIDDoor::BeginPlay()
{
	Super::BeginPlay();

	bLocked = bStartsLocked;

	// register for saves
	if (USILIDSaveSubsystem* Save = GetWorld()->GetSubsystem<USILIDSaveSubsystem>())
	{
		Save->RegisterSaveable(this);
	}

	// electronic lock: subscribe to the power node (the door holds no power
	// state — it queries the subsystem on demand, doc 11 anti-rule)
	if (PowerNode.IsValid())
	{
		if (UElectricalSystemSubsystem* Electrical = GetWorld()->GetSubsystem<UElectricalSystemSubsystem>())
		{
			Electrical->OnNodePowerChanged.AddUniqueDynamic(this, &ASILIDDoor::HandleNodePowerChanged);
		}
	}
}

bool ASILIDDoor::IsPowerAvailable() const
{
	if (!PowerNode.IsValid())
	{
		return true; // ordinary door — power-irrelevant
	}
	const UWorld* World = GetWorld();
	const UElectricalSystemSubsystem* Electrical = World ? World->GetSubsystem<UElectricalSystemSubsystem>() : nullptr;
	return Electrical && Electrical->IsNodePowered(PowerNode);
}

void ASILIDDoor::HandleNodePowerChanged(FGameplayTag NodeTag, bool bPowered)
{
	if (NodeTag != PowerNode)
	{
		return; // the bus is per-change for every node; this door minds its own
	}
	// dead-locked closed on power loss — but never trap a player: a door
	// someone left OPEN never closes itself on them (fail-safe, not a kill)
	if (!bPowered && bLocked && bOpen)
	{
		SetOpen(false);
	}
}

bool ASILIDDoor::Interact(ASILIDCharacter* Player)
{
	if (bLocked)
	{
		// electronic lock with a dead node: fail-safe closed (spec §17);
		// even the right key can't help — the rattle explains everything
		if (!IsPowerAvailable())
		{
			if (NoiseEmitter)
			{
				NoiseEmitter->EmitNoise(FVector(0.25f, 0, 0), SILIDTags::NoiseDoor);
			}
			return false;
		}
		if (Player && Player->Inventory && Player->Inventory->HasKeyForTag(RequiredKeyTag))
		{
			// the right key turns: unlock with a metallic noise
			bLocked = false;
			if (NoiseEmitter)
			{
				NoiseEmitter->EmitNoise(FVector(0.3f, 0, 0), SILIDTags::NoiseDevice);
			}
			SILID_LOG_CAT(LogSILID, TEXT("Door %s unlocked by key"), *GetName());
			return true; // key consumed the press; next E opens
		}
		if (CodeLock && !CodeLock->Code.IsEmpty())
		{
			// signal the HUD to open the keypad UI (listened via delegate)
			CodeLock->OnCodeRejected.Broadcast(TEXT("")); // UI opens keypad on focus interact
			return true;
		}
		if (Player)
		{
			// rattle feedback: small noise, no unlock (spec section 8)
			if (NoiseEmitter)
			{
				NoiseEmitter->EmitNoise(FVector(0.25f, 0, 0), SILIDTags::NoiseDoor);
			}
		}
		return false;
	}

	SetOpen(!bOpen);
	return true;
}

bool ASILIDDoor::CanInteract(const ASILIDCharacter* Player) const
{
	return true;
}

FText ASILIDDoor::GetInteractionText(const ASILIDCharacter* Player) const
{
	if (bLocked)
	{
		if (!IsPowerAvailable())
		{
			return NSLOCTEXT("SILID", "DoorNoPower", "Dead. No power.");
		}
		return NSLOCTEXT("SILID", "DoorLocked", "Try the door");
	}
	return bOpen ? NSLOCTEXT("SILID", "DoorClose", "Close the door")
	             : NSLOCTEXT("SILID", "DoorOpen", "Open the door");
}

FText ASILIDDoor::GetExamineText(const ASILIDCharacter* Player) const
{
	if (bLocked)
	{
		if (!RequiredKeyTag.IsValid() && CodeLock && !CodeLock->Code.IsEmpty())
		{
			return NSLOCTEXT("SILID", "DoorCodeHint", "A brass dial with three windows is set into the wood.");
		}
		return NSLOCTEXT("SILID", "DoorLockedHint", "Locked. The wood is swollen with damp.");
	}
	return NSLOCTEXT("SILID", "DoorHint", "An old wooden door. It swells in the rain.");
}

void ASILIDDoor::OnFocus()  { /* hook: highlight material swap */ }
void ASILIDDoor::OnUnfocus() { /* hook: unhighlight */ }

void ASILIDDoor::SetOpen(bool bNewOpen, bool bInstant)
{
	if (bOpen == bNewOpen && !bInstant)
	{
		return;
	}
	bOpen = bNewOpen;
	TargetSwing = bOpen ? 1.f : 0.f;

	if (bInstant)
	{
		CurrentSwing = TargetSwing;
		ApplySwing(CurrentSwing);
	}
	else
	{
		GetWorldTimerManager().SetTimer(SwingTimer, this, &ASILIDDoor::TickSwing, 0.016f, true);
		// every real door swing is heard — and loud enough to pull him off
		// patrol from the next room (spec section 8: react to doors opening)
		if (NoiseEmitter)
		{
			NoiseEmitter->EmitNoise(FVector(0.55f, 0, 0), SILIDTags::NoiseDoor);
		}
	}

	OnDoorStateChanged.Broadcast(bOpen, this);
}

void ASILIDDoor::TickSwing()
{
	const float Speed = 1.8f; // normalized per second
	if (CurrentSwing < TargetSwing)
	{
		CurrentSwing = FMath::Min(CurrentSwing + Speed * 0.016f, TargetSwing);
	}
	else
	{
		CurrentSwing = FMath::Max(CurrentSwing - Speed * 0.016f, TargetSwing);
	}
	ApplySwing(CurrentSwing);
	if (FMath::IsNearlyEqual(CurrentSwing, TargetSwing))
	{
		GetWorldTimerManager().ClearTimer(SwingTimer);
	}
}

void ASILIDDoor::ApplySwing(float Normalized)
{
	float Yaw = Normalized * 100.f; // swing angle
	if (SwingCurve)
	{
		Yaw = SwingCurve->GetFloatValue(Normalized) * 100.f;
	}
	LeafPivot->SetRelativeRotation(FRotator(0.f, Yaw, 0.f));
}

void ASILIDDoor::OnSave(USILIDSaveGame* SaveGame)
{
	if (!SaveGame) return;
	const FString Id = GetSaveId();
	SaveGame->Flags.Add(Id + TEXT("_Open"), bOpen);
	SaveGame->Flags.Add(Id + TEXT("_Locked"), bLocked);
}

void ASILIDDoor::OnLoad(const USILIDSaveGame* SaveGame)
{
	if (!SaveGame) return;
	const FString Id = GetSaveId();
	if (const bool* FoundOpen = SaveGame->Flags.Find(Id + TEXT("_Open")))
	{
		SetOpen(*FoundOpen, /*bInstant*/ true);
	}
	if (const bool* FoundLocked = SaveGame->Flags.Find(Id + TEXT("_Locked")))
	{
		bLocked = *FoundLocked;
	}
}
