// The two contracts every interactive object obeys.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "SILIDInterfaces.generated.h"

class ASILIDCharacter;
class USILIDInventoryComponent;

UINTERFACE(MinimalAPI, BlueprintType)
class USILIDInteractable : public UInterface
{
	GENERATED_BODY()
};

/**
 * IInteractable (spec section 5): implemented by doors, drawers, pickups,
 * hidespots, lights, radios, safes, puzzles... The player controller focuses
 * whatever it aims at and calls through this interface - nothing is hardcoded.
 */
class SILID_API ISILIDInteractable
{
	GENERATED_BODY()

public:
	// Native dispatch helpers mirror Unreal's generated Execute_ wrappers for
	// this C++-only interface. Convert to BlueprintNativeEvent UFunctions when
	// Blueprint-only interactables are introduced.
	static bool Execute_Interact(UObject* Object, ASILIDCharacter* Player)
	{
		if (ISILIDInteractable* Interface = Cast<ISILIDInteractable>(Object)) return Interface->Interact(Player);
		return false;
	}
	static bool Execute_CanInteract(UObject* Object, const ASILIDCharacter* Player)
	{
		if (ISILIDInteractable* Interface = Cast<ISILIDInteractable>(Object)) return Interface->CanInteract(Player);
		return false;
	}
	static FText Execute_GetInteractionText(UObject* Object, const ASILIDCharacter* Player)
	{
		if (ISILIDInteractable* Interface = Cast<ISILIDInteractable>(Object)) return Interface->GetInteractionText(Player);
		return FText::GetEmpty();
	}
	static FText Execute_GetExamineText(UObject* Object, const ASILIDCharacter* Player)
	{
		if (ISILIDInteractable* Interface = Cast<ISILIDInteractable>(Object)) return Interface->GetExamineText(Player);
		return FText::GetEmpty();
	}
	static bool Execute_UseItem(UObject* Object, ASILIDCharacter* Player, USILIDInventoryComponent* Inventory)
	{
		if (ISILIDInteractable* Interface = Cast<ISILIDInteractable>(Object)) return Interface->UseItem(Player, Inventory);
		return false;
	}
	static void Execute_OnFocus(UObject* Object)
	{
		if (ISILIDInteractable* Interface = Cast<ISILIDInteractable>(Object)) Interface->OnFocus();
	}
	static void Execute_OnUnfocus(UObject* Object)
	{
		if (ISILIDInteractable* Interface = Cast<ISILIDInteractable>(Object)) Interface->OnUnfocus();
	}

	/** Primary use (E). Returns true if something happened. */
	virtual bool Interact(ASILIDCharacter* Player) { return false; }

	/** Can the player currently interact? */
	virtual bool CanInteract(const ASILIDCharacter* Player) const { return true; }

	/** Prompt text shown on focus, e.g. "Open the door". */
	virtual FText GetInteractionText(const ASILIDCharacter* Player) const { return FText::GetEmpty(); }

	/** Examine (hold Q): longer description / story text. */
	virtual FText GetExamineText(const ASILIDCharacter* Player) const { return FText::GetEmpty(); }

	/** Try to use the currently held inventory item on this object. */
	virtual bool UseItem(ASILIDCharacter* Player, USILIDInventoryComponent* Inventory) { return false; }

	/** Focus gained/lost: highlight or animation hooks. */
	virtual void OnFocus() {}
	virtual void OnUnfocus() {}
};

UINTERFACE(MinimalAPI, BlueprintType)
class USILIDRepairable : public UInterface
{
	GENERATED_BODY()
};

/**
 * IRepairable (doc 09 §4 additive extension — default implementations so the
 * existing implementors never break). Machines and mechanisms that can be
 * broken and repaired by work + requirements. The repair STATE lives in the
 * owner's USILIDRepairableComponent (doc 11 ownership); this interface is the
 * query path for consumers that should not know the component (objectives,
 * validator, HUD).
 */
class SILID_API ISILIDRepairable
{
	GENERATED_BODY()

public:
	/** Is the machine currently broken (needs repair)? */
	virtual bool IsBroken() const { return false; }

	/** HUD/examine line for the repair state, e.g. "The fuse slot is empty." Empty when fine. */
	virtual FText GetRepairStatusText(const ASILIDCharacter* Player) const { return FText::GetEmpty(); }

	/** One increment of repair work (E press — same rhythm as plank hits). */
	virtual bool ApplyRepairWork(ASILIDCharacter* Player) { return false; }
};

UINTERFACE(MinimalAPI, BlueprintType)
class USILIDSaveable : public UInterface
{
	GENERATED_BODY()
};

/**
 * ISaveable (spec section 20): anything with persistent state implements this.
 * The save subsystem walks all registered saveables each save.
 */
class SILID_API ISILIDSaveable
{
	GENERATED_BODY()

public:
	/** Unique, stable id used as the save key (set in editor per instance). */
	virtual FString GetSaveId() const { return FString(); }

	/** Write state into the archive. */
	virtual void OnSave(class USILIDSaveGame* SaveGame) {}

	/** Restore state from the archive. Called after level load. */
	virtual void OnLoad(const class USILIDSaveGame* SaveGame) {}
};
