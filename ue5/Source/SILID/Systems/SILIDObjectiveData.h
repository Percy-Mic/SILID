// SILID class contract
// OWNS:         the definition of ONE story objective — display text, the
//               GameplayTag requirements describing the needed world state,
//               and an optional progress budget. Pure data: no behavior, no
//               actor references, no system references.
// MAY WRITE:    nothing — this is configuration; the ObjectiveSubsystem reads it.
// DEPENDS ON:   Gameplay Tags only (doc 00 §6: systems speak tags and
//               capability flags; no C++ string mentions of story nouns).
// EMITS:        nothing — data assets hold no delegates.
//
// P13 Objectives (doc 13 phase; doc 09 §9 row schema: ObjectiveID / Title /
// Requirements / Optional / Priority). One asset = one objective; a run's
// story is a set of these authored as DA_Story content. Swapping them
// re-skins protagonist, antagonist, objectives, endings — with zero code
// changes to inventory/AI/electricity/randomization (replaceable-story law).
// FailureConditions defer to the co-op/downed phase (doc 06 §5); the slice's
// one failure (death) is the GameMode's, not an objective's.

#pragma once

#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "SILIDObjectiveData.generated.h"

UCLASS(BlueprintType)
class SILID_API USILIDObjectiveData : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	/** Stable id (save key + journal key). Never rename once saves exist. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Objective")
	FName ObjectiveId;

	/** HUD line when active ("Find a way out", "Restore the electricity"...). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Objective")
	FText Title;

	/** Journal/examine body (environmental-storytelling text may live here). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Objective", meta = (MultiLine = true))
	FText Description;

	/** World-state tags that complete this objective (e.g. Story.Power.On).
	 * The ObjectiveSubsystem records these tags as they happen — the story
	 * layer consumes events, it never polls systems (doc 09 §9). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Objective|Completion")
	FGameplayTagContainer Requirements;

	/** When > 0, the objective also needs this many progress units (fuses
	 * installed, planks cleared, rooms searched — RecordProgress callers). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Objective|Completion", meta = (ClampMin = "0"))
	int32 RequiredProgressCount = 0;

	/** Optional objectives never block completion and journal as side tasks. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Objective")
	bool bOptional = false;

	/** HUD ordering: lower = more prominent (the primary objective line). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Objective", meta = (ClampMin = "0"))
	int32 Priority = 0;
};
