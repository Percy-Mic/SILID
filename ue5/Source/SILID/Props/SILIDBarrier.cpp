// Barrier implementation. Every interaction is loud — the hammer screams
// across the whole floor and the Resident comes (spec: react to breaking).

#include "Props/SILIDBarrier.h"
#include "Props/SILIDDoor.h"
#include "Systems/SILIDEscapeRoute.h"
#include "Systems/SILIDElectricalSystemSubsystem.h"
#include "Systems/SILIDInventoryComponent.h"
#include "Systems/SILIDItemData.h"
#include "Systems/SILIDNoiseEmitterComponent.h"
#include "Systems/SILIDSaveGame.h"
#include "Systems/SILIDTags.h"
#include "Player/SILIDCharacter.h"
#include "Components/StaticMeshComponent.h"
#include "Components/AudioComponent.h"
#include "Components/LightComponent.h"
#include "Engine/World.h"

ASILIDBarrier::ASILIDBarrier()
{
	PrimaryActorTick.bCanEverTick = false;

	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));

	NoiseEmitter = CreateDefaultSubobject<USILIDNoiseEmitterComponent>(TEXT("NoiseEmitter"));
}

bool ASILIDBarrier::CanInteract(const ASILIDCharacter* Player) const
{
	return !bCleared;
}

FText ASILIDBarrier::GetInteractionText(const ASILIDCharacter* Player) const
{
	if (bCleared)
	{
		return FText::GetEmpty();
	}
	switch (Kind)
	{
		case EBarrierKind::Planks:
			return FText::FromString(TEXT("E — Pry the planks"));
		case EBarrierKind::Chain:
			return FText::FromString(TEXT("E — Cut the chain"));
		case EBarrierKind::Fusebox:
			return FText::FromString(TEXT("E — Open the fusebox"));
		case EBarrierKind::Padlock:
			return FText::FromString(TEXT("E — Try the padlock"));
	}
	return FText::GetEmpty();
}

FText ASILIDBarrier::GetExamineText(const ASILIDCharacter* Player) const
{
	if (bCleared)
	{
		return FText::GetEmpty();
	}
	switch (Kind)
	{
		case EBarrierKind::Planks:
			return FText::FromString(TEXT("Boards nailed across the way. A hammer would make short work of them."));
		case EBarrierKind::Chain:
			return FText::FromString(TEXT("A heavy chain and a padlock. You would need bolt cutters."));
		case EBarrierKind::Fusebox:
			return FText::FromString(TEXT("The main fusebox. The fuse slot is empty."));
		case EBarrierKind::Padlock:
			return FText::FromString(TEXT("A padlock. Somewhere there is a key."));
	}
	return FText::GetEmpty();
}

void ASILIDBarrier::OnFocus() {}
void ASILIDBarrier::OnUnfocus() {}

bool ASILIDBarrier::UseItem(ASILIDCharacter* Player, USILIDInventoryComponent* Inventory)
{
	// inventory "use" targets the focused barrier: same logic as Interact
	return Interact(Player);
}

bool ASILIDBarrier::Interact(ASILIDCharacter* Player)
{
	if (bCleared || !Player)
	{
		return false;
	}

	USILIDInventoryComponent* Inventory = Player->FindComponentByClass<USILIDInventoryComponent>();
	if (!Inventory)
	{
		return false;
	}

	switch (Kind)
	{
		case EBarrierKind::Planks:
		{
			if (!Inventory->HasToolThatBreaksPlanks())
			{
				return false; // prompt stays; examine text explains the hammer
			}
			ApplyPlankHit(Player);
			return true;
		}
		case EBarrierKind::Chain:
		{
			if (!Inventory->HasToolThatCutsChains())
			{
				return false;
			}
			ClearBarrier(Player);
			return true;
		}
		case EBarrierKind::Fusebox:
		{
			if (!Inventory->HasComponentForTag(ComponentTag))
			{
				return false;
			}
			Inventory->ConsumeComponent(ComponentTag);
			ClearBarrier(Player);
			return true;
		}
		case EBarrierKind::Padlock:
		{
			if (!Inventory->HasKeyForTag(KeyTag))
			{
				return false;
			}
			ClearBarrier(Player);
			return true;
		}
	}
	return false;
}

void ASILIDBarrier::ApplyPlankHit(ASILIDCharacter* Player)
{
	++HitsApplied;
	if (NoiseEmitter)
	{
		// a hammer blow carries: louder than a door, heard across the floor
		NoiseEmitter->EmitNoise(FVector(0.8f, 0, 0), SILIDTags::NoiseBreak, GetActorLocation());
	}
	if (WorkSound)
	{
		WorkSound->Play();
	}

	if (HitsApplied >= HitsNeeded)
	{
		ClearBarrier(Player);
	}
	// note: repeated swings come from the player pressing E again — the
	// cooldown in the interaction scanner naturally spaces the hits
}

void ASILIDBarrier::ClearBarrier(ASILIDCharacter* Player)
{
	bCleared = true;

	if (BarrierMesh)
	{
		BarrierMesh->SetVisibility(false);
		BarrierMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	}

	if (DoorToUnlock)
	{
		DoorToUnlock->SetLocked(false);
		DoorToUnlock->SetOpen(true);
	}

	// routes are "enabled" simply by the barrier being gone; if the route
	// tracks a prerequisite barrier it reads IsEscaped on itself — so we
	// broadcast for listeners and let route requirements reference inventory
	OnBarrierCleared.Broadcast();

	if (bRestoresPower)
	{
		// P8 path: the fuse replacement goes through the subsystem (the fuse
		// item was already consumed above — the state change is the only fact)
		if (RestoresPowerNode.IsValid())
		{
			if (UElectricalSystemSubsystem* Electrical = GetWorld()->GetSubsystem<UElectricalSystemSubsystem>())
			{
				Electrical->SetFuseBlown(RestoresPowerNode, false);
			}
		}
		// legacy path: direct relight for unconverted setups (P25 cleanup)
		for (ULightComponent* Light : LightsToRestore)
		{
			if (Light)
			{
				Light->SetIntensity(3000.f); // designers tune per-light in BP
			}
		}
	}
}

// ------------------------------- saveable -----------------------------------
FString ASILIDBarrier::GetSaveId() const
{
	return SaveIdName.IsValid() ? SaveIdName.ToString() : FString::Printf(TEXT("Barrier_%s"), *GetName());
}

void ASILIDBarrier::OnSave(USILIDSaveGame* SaveGame)
{
	if (!SaveGame)
	{
		return;
	}
	SaveGame->Flags.Add(GetSaveId(), bCleared);
	if (HitsApplied > 0)
	{
		SaveGame->Counters.Add(GetSaveId(), HitsApplied);
	}
}

void ASILIDBarrier::OnLoad(const USILIDSaveGame* SaveGame)
{
	if (!SaveGame)
	{
		return;
	}
	const bool* bFound = SaveGame->Flags.Find(GetSaveId());
	bCleared = bFound ? *bFound : false;
	const int32* Hits = SaveGame->Counters.Find(GetSaveId());
	HitsApplied = Hits ? *Hits : 0;

	if (bCleared && BarrierMesh)
	{
		BarrierMesh->SetVisibility(false);
		BarrierMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	}
	if (bCleared && bRestoresPower)
	{
		if (RestoresPowerNode.IsValid())
		{
			if (UElectricalSystemSubsystem* Electrical = GetWorld()->GetSubsystem<UElectricalSystemSubsystem>())
			{
				Electrical->SetFuseBlown(RestoresPowerNode, false);
			}
		}
		for (ULightComponent* Light : LightsToRestore)
		{
			if (Light)
			{
				Light->SetIntensity(3000.f);
			}
		}
	}
}
