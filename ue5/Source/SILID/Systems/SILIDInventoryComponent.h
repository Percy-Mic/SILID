// Inventory component (spec section 6). Attached to the player character.
// Holds item data assets; supports stacking, key queries by tag, and
// save/restore. Kept deliberately simple - no grid, no weight.

#pragma once

#include "Components/ActorComponent.h"
#include "GameplayTagContainer.h"
#include "SILIDTypes.h"
#include "SILIDItemFlags.h"
#include "SILIDInventoryComponent.generated.h"

class USILIDItemData;
class ASILIDCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnInventoryChanged, const TArray<USILIDItemData*>&, Items);

USTRUCT()
struct FInventoryEntry
{
	GENERATED_BODY()

	UPROPERTY()
	TObjectPtr<USILIDItemData> Item = nullptr;

	UPROPERTY()
	int32 Count = 1;
};

UCLASS(ClassGroup = (SILID), meta = (BlueprintSpawnableComponent))
class SILID_API USILIDInventoryComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	USILIDInventoryComponent();

	/** Maximum distinct slots (spec: "not unnecessarily complicated"). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Inventory", meta = (ClampMin = "4", ClampMax = "32"))
	int32 MaxSlots = 16;

	UPROPERTY(BlueprintAssignable, Category = "Inventory")
	FOnInventoryChanged OnInventoryChanged;

	/** Adds an item. Returns false if the inventory is full. */
	UFUNCTION(BlueprintCallable, Category = "Inventory")
	bool AddItem(USILIDItemData* ItemData, int32 Count = 1);

	/** Removes one copy of the item. */
	UFUNCTION(BlueprintCallable, Category = "Inventory")
	bool RemoveItem(USILIDItemData* ItemData);

	/** Does the player carry an item with this id? */
	UFUNCTION(BlueprintPure, Category = "Inventory")
	bool HasItem(FName ItemId) const;

	/** Does the player carry a key matching this unlock tag? */
	UFUNCTION(BlueprintPure, Category = "Inventory")
	bool HasKeyForTag(FGameplayTag UnlockTag) const;

	/** Does the player carry a Tool whose capability tag matches (e.g.
	 * Tool.Hammer)? The generalized query behind repair requirements —
	 * "new tool = item def + capability tag, no interaction edits"
	 * (doc 12 §11). Invalid tag = requirement satisfied, like HasKeyForTag. */
	UFUNCTION(BlueprintPure, Category = "Inventory")
	bool HasToolForTag(FGameplayTag ToolTag) const;

	/** Does the player carry a Tool item with the given capability flag set
	 * (hammer -> BreaksPlanks, bolt cutters -> CutsChains...)? Capability
	 * queries keep barriers generic — they never test item ids. */
	UFUNCTION(BlueprintPure, Category = "Inventory")
	bool HasToolThatBreaksPlanks() const;

	UFUNCTION(BlueprintPure, Category = "Inventory")
	bool HasToolThatCutsChains() const;

	UFUNCTION(BlueprintPure, Category = "Inventory")
	bool HasToolThatTurnsScrews() const;

	UFUNCTION(BlueprintPure, Category = "Inventory")
	bool HasToolThatPries() const;

	/** Does the player carry a Component matching this component tag (fuse...)? */
	UFUNCTION(BlueprintPure, Category = "Inventory")
	bool HasComponentForTag(FGameplayTag ComponentTag) const;

	/** Which component tags does the player currently carry? For HUD hints. */
	UFUNCTION(BlueprintPure, Category = "Inventory")
	TArray<FGameplayTag> GetCarriedComponentTags() const;

	/** Generic capability query: any Tool with the named bool capability true. */
	bool HasToolCapability(bool FSILIDItemFlags::*Capability) const;

	/** Uses the first item whose UseItem implementation accepts the target.
	 * Returns true if any item consumed the use (spec: item combining where
	 * appropriate — direct-use on interactables rather than a crafting grid). */
	UFUNCTION(BlueprintCallable, Category = "Inventory")
	bool UseOnTarget(ASILIDCharacter* Player, AActor* Target);

	/** Removes one component matching the tag (barriers consume it). */
	UFUNCTION(BlueprintCallable, Category = "Inventory")
	bool ConsumeComponent(FGameplayTag ComponentTag);

	/** Drops the item into the world in front of the player (spawns a pickup). */
	UFUNCTION(BlueprintCallable, Category = "Inventory")
	bool DropItem(FName ItemId, const FVector& DropLocation, const FRotator& DropRotation);

	UFUNCTION(BlueprintPure, Category = "Inventory")
	const TArray<USILIDItemData*>& GetItems() const { return ItemEntriesView; }

	// ~ ISILIDSaveable via the owner: inventory serializes itself into saves
	void SaveTo(class USILIDSaveGame* SaveGame, const FString& Prefix) const;
	void LoadFrom(const class USILIDSaveGame* SaveGame, const FString& Prefix);

private:
	UPROPERTY()
	TArray<FInventoryEntry> Entries;

	/** Cached read-only view rebuilt on change for Blueprint iteration. */
	UPROPERTY()
	TArray<USILIDItemData*> ItemEntriesView;

	void RebuildView();

	friend class ASILIDCharacter; // save/load plumbing
};
