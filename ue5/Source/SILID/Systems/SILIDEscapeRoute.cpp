// Escape route implementation: requirement checks, consumption, win handoff.
// The GameMode owns "what winning means"; routes only report TryEscape.

#include "Systems/SILIDEscapeRoute.h"
#include "Systems/SILIDElectricalSystemSubsystem.h"
#include "Systems/SILIDInventoryComponent.h"
#include "Systems/SILIDItemData.h"
#include "Systems/SILIDInterfaces.h"
#include "Systems/SILIDSaveGame.h"
#include "Systems/SILIDGameMode.h"
#include "Systems/SILIDTags.h"
#include "Player/SILIDCharacter.h"
#include "Components/StaticMeshComponent.h"
#include "Kismet/GameplayStatics.h"

ASILIDEscapeRoute::ASILIDEscapeRoute()
{
	PrimaryActorTick.bCanEverTick = false;

	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

bool ASILIDEscapeRoute::IsReady(const USILIDInventoryComponent* Inventory) const
{
	if (bEscaped || !Inventory)
	{
		return false;
	}
	if (PrerequisiteRoute && !PrerequisiteRoute->IsEscaped())
	{
		return false;
	}
	// the power chain is a requirement like any key (doc 15 §5 electricity
	// protocol: dependencies validated before gameplay, honored during it)
	if (PowerNode.IsValid())
	{
		const UWorld* World = GetWorld();
		const UElectricalSystemSubsystem* Electrical = World ? World->GetSubsystem<UElectricalSystemSubsystem>() : nullptr;
		if (!Electrical || !Electrical->IsNodePowered(PowerNode))
		{
			return false;
		}
	}
	if (KeyTag.IsValid() && !Inventory->HasKeyForTag(KeyTag))
	{
		return false;
	}
	if (NeedsToolBreaksPlanks && !Inventory->HasToolThatBreaksPlanks()) return false;
	if (NeedsToolCutsChains && !Inventory->HasToolThatCutsChains()) return false;
	if (NeedsToolTurnsScrews && !Inventory->HasToolThatTurnsScrews()) return false;
	if (NeedsToolPries && !Inventory->HasToolThatPries()) return false;
	for (const FGameplayTag& Comp : RequiredComponents)
	{
		if (!Inventory->HasComponentForTag(Comp))
		{
			return false;
		}
	}
	return true;
}

FText ASILIDEscapeRoute::GetMissingText(const USILIDInventoryComponent* Inventory) const
{
	if (bEscaped)
	{
		return FText::FromString(TEXT("You already went this way."));
	}
	if (PrerequisiteRoute && !PrerequisiteRoute->IsEscaped())
	{
		return FText::FromString(TEXT("Something else must be prepared first."));
	}
	if (PowerNode.IsValid())
	{
		const UWorld* World = GetWorld();
		const UElectricalSystemSubsystem* Electrical = World ? World->GetSubsystem<UElectricalSystemSubsystem>() : nullptr;
		if (!Electrical || !Electrical->IsNodePowered(PowerNode))
		{
			return FText::FromString(TEXT("The mechanism is dead. It needs electricity."));
		}
	}
	if (KeyTag.IsValid() && Inventory && !Inventory->HasKeyForTag(KeyTag))
	{
		return FText::FromString(TEXT("Locked. It needs its key."));
	}
	if (Inventory)
	{
		if (NeedsToolBreaksPlanks && !Inventory->HasToolThatBreaksPlanks())
		{
			return FText::FromString(TEXT("The boards are nailed fast. A hammer would do it."));
		}
		if (NeedsToolCutsChains && !Inventory->HasToolThatCutsChains())
		{
			return FText::FromString(TEXT("A heavy chain seals this. Bolt cutters would do it."));
		}
		if (NeedsToolTurnsScrews && !Inventory->HasToolThatTurnsScrews())
		{
			return FText::FromString(TEXT("Screwed shut. You need a screwdriver."));
		}
		if (NeedsToolPries && !Inventory->HasToolThatPries())
		{
			return FText::FromString(TEXT("Pried shut. Something flat and strong would help."));
		}
		for (const FGameplayTag& Comp : RequiredComponents)
		{
			if (!Inventory->HasComponentForTag(Comp))
			{
				return FText::FromString(TEXT("A part is missing from the mechanism."));
			}
		}
	}
	return FText::GetEmpty();
}

bool ASILIDEscapeRoute::TryEscape(ASILIDCharacter* Player)
{
	USILIDInventoryComponent* Inventory = Player ? Player->FindComponentByClass<USILIDInventoryComponent>() : nullptr;
	if (!IsReady(Inventory))
	{
		return false;
	}

	if (bConsumeComponents && Inventory)
	{
		for (const FGameplayTag& Comp : RequiredComponents)
		{
			Inventory->ConsumeComponent(Comp);
		}
	}

	bEscaped = true;
	OnRouteEscaped.Broadcast(Route);

	if (RouteMesh)
	{
		RouteMesh->SetVisibility(false); // the way is open; leave it open
	}

	if (ASILIDGameMode* GM = Cast<ASILIDGameMode>(UGameplayStatics::GetGameMode(this)))
	{
		GM->ReachEscape();
	}
	return true;
}

// ------------------------------- interactable -------------------------------
bool ASILIDEscapeRoute::CanInteract(const ASILIDCharacter* Player) const
{
	return !bEscaped;
}

bool ASILIDEscapeRoute::Interact(ASILIDCharacter* Player)
{
	return TryEscape(Player);
}

FText ASILIDEscapeRoute::GetInteractionText(const ASILIDCharacter* Player) const
{
	return FText::FromString(TEXT("E — Escape"));
}

FText ASILIDEscapeRoute::GetExamineText(const ASILIDCharacter* Player) const
{
	USILIDInventoryComponent* Inventory = Player ? Player->FindComponentByClass<USILIDInventoryComponent>() : nullptr;
	return GetMissingText(Inventory);
}

// ------------------------------- saveable -----------------------------------
FString ASILIDEscapeRoute::GetSaveId() const
{
	return FString::Printf(TEXT("Escape_%s"), *GetName());
}

void ASILIDEscapeRoute::OnSave(USILIDSaveGame* SaveGame)
{
	if (SaveGame)
	{
		SaveGame->Flags.Add(GetSaveId(), bEscaped);
	}
}

void ASILIDEscapeRoute::OnLoad(const USILIDSaveGame* SaveGame)
{
	if (SaveGame)
	{
		const bool* Found = SaveGame->Flags.Find(GetSaveId());
		bEscaped = Found ? *Found : false;
		if (bEscaped && RouteMesh)
		{
			RouteMesh->SetVisibility(false);
		}
	}
}
