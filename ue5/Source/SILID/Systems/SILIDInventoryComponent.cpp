#include "Systems/SILIDInventoryComponent.h"
#include "Systems/SILIDItemData.h"
#include "Systems/SILIDInterfaces.h"
#include "Systems/SILIDSaveGame.h"
#include "Systems/SILIDGameInstance.h"
#include "Props/SILIDPickup.h"
#include "Logging/SILIDLog.h"

USILIDInventoryComponent::USILIDInventoryComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

bool USILIDInventoryComponent::AddItem(USILIDItemData* ItemData, int32 Count)
{
	if (!ItemData || Count <= 0)
	{
		return false;
	}

	// stack into an existing entry first
	if (ItemData->bStackable)
	{
		if (FInventoryEntry* Existing = Entries.FindByPredicate(
			[ItemData](const FInventoryEntry& E) { return E.Item && E.Item->ItemId == ItemData->ItemId; }))
		{
			Existing->Count = FMath::Clamp(Existing->Count + Count, 1, ItemData->MaxStackSize);
			RebuildView();
			OnInventoryChanged.Broadcast(ItemEntriesView);
			return true;
		}
	}

	if (Entries.Num() >= MaxSlots)
	{
		SILID_WARN_CAT(LogSILID, TEXT("Inventory full - cannot add %s"), *ItemData->ItemId.ToString());
		return false;
	}

	FInventoryEntry NewEntry;
	NewEntry.Item = ItemData;
	NewEntry.Count = Count;
	Entries.Add(NewEntry);
	RebuildView();
	OnInventoryChanged.Broadcast(ItemEntriesView);
	return true;
}

bool USILIDInventoryComponent::RemoveItem(USILIDItemData* ItemData)
{
	if (!ItemData)
	{
		return false;
	}

	const int32 Index = Entries.IndexOfByPredicate(
		[ItemData](const FInventoryEntry& E) { return E.Item && E.Item->ItemId == ItemData->ItemId; });
	if (Index == INDEX_NONE)
	{
		return false;
	}

	Entries[Index].Count--;
	if (Entries[Index].Count <= 0)
	{
		Entries.RemoveAt(Index);
	}
	RebuildView();
	OnInventoryChanged.Broadcast(ItemEntriesView);
	return true;
}

bool USILIDInventoryComponent::HasItem(FName ItemId) const
{
	return Entries.ContainsByPredicate(
		[ItemId](const FInventoryEntry& E) { return E.Item && E.Item->ItemId == ItemId; });
}

bool USILIDInventoryComponent::HasKeyForTag(FGameplayTag UnlockTag) const
{
	if (!UnlockTag.IsValid())
	{
		return true; // no lock requirement
	}

	return Entries.ContainsByPredicate([&UnlockTag](const FInventoryEntry& E)
	{
		return E.Item && E.Item->ItemType == EItemType::Key && E.Item->UnlockTag.MatchesTag(UnlockTag);
	});
}

// ------------------------------- capabilities -------------------------------
bool USILIDInventoryComponent::HasToolCapability(bool FSILIDItemFlags::*Capability) const
{
	return Entries.ContainsByPredicate([Capability](const FInventoryEntry& E)
	{
		return E.Item && E.Item->ItemType == EItemType::Tool && (E.Item->Flags.*Capability);
	});
}

bool USILIDInventoryComponent::HasToolForTag(FGameplayTag ToolTag) const
{
	if (!ToolTag.IsValid())
	{
		return true; // no tool requirement
	}
	return Entries.ContainsByPredicate([&ToolTag](const FInventoryEntry& E)
	{
		return E.Item && E.Item->ItemType == EItemType::Tool && E.Item->Flags.ToolTag.MatchesTag(ToolTag);
	});
}

bool USILIDInventoryComponent::HasToolThatBreaksPlanks() const
{
	return HasToolCapability(&FSILIDItemFlags::BreaksPlanks);
}

bool USILIDInventoryComponent::HasToolThatCutsChains() const
{
	return HasToolCapability(&FSILIDItemFlags::CutsChains);
}

bool USILIDInventoryComponent::HasToolThatTurnsScrews() const
{
	return HasToolCapability(&FSILIDItemFlags::TurnsScrews);
}

bool USILIDInventoryComponent::HasToolThatPries() const
{
	return HasToolCapability(&FSILIDItemFlags::PriesOpen);
}

bool USILIDInventoryComponent::HasComponentForTag(FGameplayTag ComponentTag) const
{
	if (!ComponentTag.IsValid())
	{
		return false;
	}
	return Entries.ContainsByPredicate([&ComponentTag](const FInventoryEntry& E)
	{
		return E.Item && E.Item->ItemType == EItemType::PuzzleItem
			&& E.Item->Flags.bIsComponent && E.Item->Flags.ComponentTag.MatchesTag(ComponentTag);
	});
}

TArray<FGameplayTag> USILIDInventoryComponent::GetCarriedComponentTags() const
{
	TArray<FGameplayTag> Out;
	for (const FInventoryEntry& E : Entries)
	{
		if (E.Item && E.Item->Flags.bIsComponent && E.Item->Flags.ComponentTag.IsValid())
		{
			Out.AddUnique(E.Item->Flags.ComponentTag);
		}
	}
	return Out;
}

bool USILIDInventoryComponent::ConsumeComponent(FGameplayTag ComponentTag)
{
	for (int32 i = Entries.Num() - 1; i >= 0; --i)
	{
		const FInventoryEntry& E = Entries[i];
		if (E.Item && E.Item->Flags.bIsComponent && E.Item->Flags.ComponentTag.MatchesTag(ComponentTag))
		{
			RemoveItem(E.Item);
			return true;
		}
	}
	return false;
}

bool USILIDInventoryComponent::UseOnTarget(ASILIDCharacter* Player, AActor* Target)
{
	if (!Player || !Target)
	{
		return false;
	}
	// first accepting item wins: tools before components before the rest,
	// so a hammer beats a fuse on a plank-and-fusebox barrier
	for (int32 Pass = 0; Pass < 2; ++Pass)
	{
		for (FInventoryEntry& E : Entries)
		{
			USILIDItemData* Item = E.Item;
			if (!Item)
			{
				continue;
			}
			const bool bToolPass = Pass == 0 && Item->ItemType == EItemType::Tool;
			const bool bOtherPass = Pass == 1 && Item->ItemType != EItemType::Tool;
			if (!bToolPass && !bOtherPass)
			{
				continue;
			}
			if (Target->Implements<USILIDInteractable>())
			{
				if (ISILIDInteractable::Execute_UseItem(Target, Player, this))
				{
					return true;
				}
			}
		}
	}
	return false;
}

bool USILIDInventoryComponent::DropItem(FName ItemId, const FVector& DropLocation, const FRotator& DropRotation)
{
	const int32 Index = Entries.IndexOfByPredicate(
		[ItemId](const FInventoryEntry& E) { return E.Item && E.Item->ItemId == ItemId; });
	if (Index == INDEX_NONE)
	{
		return false;
	}

	USILIDItemData* ItemData = Entries[Index].Item;
	if (!RemoveItem(ItemData))
	{
		return false;
	}

	// spawn a world pickup for the dropped item (spec section 4: dropping objects)
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
	if (ASILIDPickup* Pickup = GetWorld()->SpawnActor<ASILIDPickup>(ASILIDPickup::StaticClass(), DropLocation, DropRotation, Params))
	{
		Pickup->InitFromItemData(ItemData);
	}
	return true;
}

void USILIDInventoryComponent::RebuildView()
{
	ItemEntriesView.Reset();
	for (const FInventoryEntry& E : Entries)
	{
		if (E.Item)
		{
			ItemEntriesView.Add(E.Item);
		}
	}
}

void USILIDInventoryComponent::SaveTo(USILIDSaveGame* SaveGame, const FString& Prefix) const
{
	if (!SaveGame)
	{
		return;
	}
	TArray<FName> ItemIds;
	for (const FInventoryEntry& E : Entries)
	{
		for (int32 i = 0; i < E.Count; ++i)
		{
			ItemIds.Add(E.Item ? E.Item->ItemId : NAME_None);
		}
	}
	int32 SavedListIndex = SaveGame->NameList.IndexOfByPredicate(
		[&Prefix](const FSILIDNameListEntry& Entry) { return Entry.Key == Prefix; });
	if (SavedListIndex == INDEX_NONE)
	{
		SavedListIndex = SaveGame->NameList.AddDefaulted();
	}
	FSILIDNameListEntry& SavedList = SaveGame->NameList[SavedListIndex];
	SavedList.Key = Prefix;
	SavedList.Values = MoveTemp(ItemIds);
}

void USILIDInventoryComponent::LoadFrom(const USILIDSaveGame* SaveGame, const FString& Prefix)
{
	if (!SaveGame)
	{
		return;
	}

	Entries.Reset();
	if (const FSILIDNameListEntry* Found = SaveGame->NameList.FindByPredicate(
		[&Prefix](const FSILIDNameListEntry& Entry) { return Entry.Key == Prefix; }))
	{
		// ids map back to data assets via the item registry on the game instance
		if (const USILIDGameInstance* GI = GetWorld() ? Cast<USILIDGameInstance>(GetWorld()->GetGameInstance()) : nullptr)
		{
			for (const FName& Id : Found->Values)
			{
				if (USILIDItemData* Data = GI->FindItemData(Id))
				{
					AddItem(Data, 1);
				}
			}
		}
	}
	RebuildView();
	OnInventoryChanged.Broadcast(ItemEntriesView);
}
