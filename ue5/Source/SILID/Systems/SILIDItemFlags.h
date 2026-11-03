// Extended item schema: capability flags for the gameplay-first escape rules.
// An item is not "a fuse" — it is a key, a tool, or a component with named
// capabilities that barriers and escape routes consume by tag, never by
// hardcoded class (spec: reusable puzzle + escape frameworks).

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "SILIDItemFlags.generated.h"

/**
 * Capability flags consumed by barriers, escape routes and mechanics.
 * A hammer sets bIsTool + BreaksPlanks; bolt cutters set bIsTool + CutsChains;
 * a fuse is bIsComponent with ComponentTag "Comp.Fuse". Nothing hardcodes
 * item ids — systems query capabilities (spec: do not hardcode objects).
 */
USTRUCT(BlueprintType)
struct FSILIDItemFlags
{
	GENERATED_BODY()

	/** Can be used from the inventory on the focused interactable. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Flags")
	bool bIsTool = false;

	/** Breaks plank barricades (the hammer). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Flags")
	bool BreaksPlanks = false;

	/** Cuts chains and padlocks (bolt cutters). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Flags")
	bool CutsChains = false;

	/** Turns screws (screwdriver — window route, vent grilles). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Flags")
	bool TurnsScrews = false;

	/** Pries nailed covers, paint cans, stuck hatches (crowbar). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Flags")
	bool PriesOpen = false;

	/** A repair component (fuse, valve wheel, crank...). Matched by ComponentTag. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Flags")
	bool bIsComponent = false;

	/** Which component slot this fills when bIsComponent (e.g. "Comp.Fuse"). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Flags")
	FGameplayTag ComponentTag;

	/** Capability tag for generalized tool queries (doc 12 §11 acceptance bar:
	 * "new tool = item def + capability tag, no interaction edits"). Repair
	 * requirements match this tag; the named bools above remain untouched for
	 * the existing barriers and escape routes. Example: Tool.Hammer. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Flags")
	FGameplayTag ToolTag;

	/** Fresh batteries: refills the flashlight instead of being spent. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Flags")
	bool bIsBattery = false;

	/** Edible/drinkable: restores health (medicine, canned food). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Flags")
	bool bIsConsumable = false;
};
