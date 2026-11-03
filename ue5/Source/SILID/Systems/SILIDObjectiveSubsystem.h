// SILID class contract
// OWNS:         run objective state — the active/completed/failed sets of
//               USILIDObjectiveData rows, per-objective progress counts,
//               and the story-tag ledger (world-state tags recorded as they
//               happen). The single authoritative owner of "the run's
//               objectives" (doc 11 §1 layer law).
// MAY WRITE:    only the state above. Never writes inventory/AI/doors/power —
//               completes objectives BY READING world events, never by
//               driving them (upward communication is events only, doc 11 §2).
// DEPENDS ON:   USILIDObjectiveData rows, USILIDSaveGame generic maps,
//               P7/P8 escape/repair delegates (see EMITS-IN below). Zero hard
//               references to rooms, doors, power or any specific prop.
// EMITS:        OnObjectiveActivated / OnObjectiveCompleted / OnObjectiveFailed
//               / OnStoryTagRecorded — HUD/journal/audio subscribe without
//               this file knowing them (doc 09 §9: one event fabric, many
//               consumers).
//
// P13 Puzzles + Objectives (doc 13 phase; design doc 09 §9 verbatim: the
// subsystem LISTENS to world delegates; nothing is polled; no manual
// completion). Wiring law (doc 12 §4): events bound in BeginPlay, unbound in
// EndPlay. Event → story-tag fabric:
//   any escape route fires        → Story.Escape.Ready (+Story.Escape.Used)
//   repair completes on any actor → Story.MachineRepaired (generic fact)
//   generator state change        → Story.Power.Running | Story.Power.Off
//   breaker trips                 → Story.Power.BreakerTripped
// DA_Objective rows complete when their Requirements tags are all recorded
// and RequiredProgressCount is met (progress via RecordProgress). Authors
// rename story nouns in DATA; this file never names them.

#pragma once

#include "Subsystems/WorldSubsystem.h"
#include "GameplayTagContainer.h"
#include "Systems/SILIDTypes.h"
#include "Systems/SILIDElectricalSystemSubsystem.h"
#include "Systems/SILIDObjectiveData.h"
#include "SILIDObjectiveSubsystem.generated.h"

class USILIDSaveGame;

/** One tracked objective's live state (the runtime mirror of its data row). */
USTRUCT()
struct FSILIDObjectiveState
{
	GENERATED_BODY()

	UPROPERTY()
	TObjectPtr<const USILIDObjectiveData> Def = nullptr;

	UPROPERTY()
	int32 Progress = 0;

	UPROPERTY()
	bool bCompleted = false;

	/** Optional objectives "fail" only by never completing (e.g. the run
	 * ended); they never block anything. Kept for the journal. */
	UPROPERTY()
	bool bFailed = false;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnObjectiveActivated, FName, ObjectiveId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnObjectiveCompleted, FName, ObjectiveId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnObjectiveFailed, FName, ObjectiveId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnStoryTagRecorded, FGameplayTag, StoryTag, FName, ObjectiveId);

UCLASS()
class SILID_API USILIDObjectiveSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	USILIDObjectiveSubsystem();

	// ---- configuration (the run's story rows; author as DA_Story content) ----

	/** All objective rows this run tracks (PDA/DA assets authored in the
	 * editor; activate what the story needs). Rows start INACTIVE —
	 * ActivateObjective turns one on (authored chains call it; on SAVE LOAD,
	 * completed required rows auto-activate so the loaded run still finishes
	 * its story). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Objectives")
	TArray<TObjectPtr<const USILIDObjectiveData>> ObjectiveDefs;

	// ---- commands (subsystem API only — doc 11 §1) ----

	/** Turn an objective on (story beats / authored chains call this).
	 * Already-active or completed rows are ignored (idempotent). */
	UFUNCTION(BlueprintCallable, Category = "Objectives")
	bool ActivateObjective(FName ObjectiveId);

	/** Add one progress unit to an objective (search counts, fuses
	 * installed, planks cleared — anything countable). Completes the row
	 * when Requirements + RequiredProgressCount are both satisfied. */
	UFUNCTION(BlueprintCallable, Category = "Objectives")
	void RecordProgress(FName ObjectiveId, int32 Units = 1);

	/** Story/system event: record a world-state tag (Story.*). Completes
	 * every active objective whose Requirements are now satisfied. */
	UFUNCTION(BlueprintCallable, Category = "Objectives")
	void RecordStoryTag(FGameplayTag StoryTag);

	/** Explicit failure (used by authored chains; the slice's death is the
	 * GameMode's, not an objective's). Optional rows ignore this. */
	UFUNCTION(BlueprintCallable, Category = "Objectives")
	void FailObjective(FName ObjectiveId);

	/** Force-activate all configured rows (bootstrap/editor convenience). */
	UFUNCTION(BlueprintCallable, Category = "Objectives")
	void ActivateAll();

	// ---- queries ----

	UFUNCTION(BlueprintPure, Category = "Objectives")
	bool IsActive(FName ObjectiveId) const;

	UFUNCTION(BlueprintPure, Category = "Objectives")
	bool IsCompleted(FName ObjectiveId) const;

	/** Has EVERY non-optional configured row completed? (story-chains use
	 * the escape grammar for "can leave"; this is journal progress). */
	UFUNCTION(BlueprintPure, Category = "Objectives")
	bool AreRequiredObjectivesComplete() const;

	/** The active non-optional objective with the lowest Priority — the HUD
	 * "current goal" line (empty text = none). */
	UFUNCTION(BlueprintPure, Category = "Objectives")
	FText GetCurrentObjectiveText() const;

	/** All requirements of all active objectives not yet in the ledger —
	 * the validator's/readers' honest view of "what the story wants". */
	UFUNCTION(BlueprintPure, Category = "Objectives")
	FGameplayTagContainer GetMissingRequirements() const;

	/** Has this world-state tag been recorded this run? (journal + BP). */
	UFUNCTION(BlueprintPure, Category = "Objectives")
	bool HasStoryTag(FGameplayTag StoryTag) const;

	// ---- notifications (see EMITS in the header contract) ----

	UPROPERTY(BlueprintAssignable, Category = "Objectives")
	FOnObjectiveActivated OnObjectiveActivated;

	UPROPERTY(BlueprintAssignable, Category = "Objectives")
	FOnObjectiveCompleted OnObjectiveCompleted;

	UPROPERTY(BlueprintAssignable, Category = "Objectives")
	FOnObjectiveFailed OnObjectiveFailed;

	UPROPERTY(BlueprintAssignable, Category = "Objectives")
	FOnStoryTagRecorded OnStoryTagRecorded;

	// ---- debug (`SILID.Debug.Objectives`, doc 09 §10) ----
	UFUNCTION(Exec)
	void SILID_Debug_Objectives();

	virtual bool ShouldCreateSubsystem(UObject* Outer) const override;

protected:
	virtual void OnWorldBeginPlay(UWorld& InWorld) override;
	virtual void Deinitialize() override;

private:
	/** Event bindings (doc 12 §4: BeginPlay bind, EndPlay unbind). */
	void BindWorldEvents();
	void UnbindWorldEvents();

	/** UFUNCTION delegate targets (dynamic binding requirement). */
	UFUNCTION()
	void HandleGameModeEscape();

	UFUNCTION()
	void HandleAnyRepaired();

	UFUNCTION()
	void HandleGeneratorStateChanged(ESILIDPowerSourceState NewState);

	UFUNCTION()
	void HandleBreakerTripped(FGameplayTag NodeTag);

	UFUNCTION()
	void HandleNodePowerChanged(FGameplayTag NodeTag, bool bPowered);

	/** Evaluate every active objective against the ledger; complete the
	 * satisfied ones. Returns true if anything completed. */
	bool EvaluateActiveObjectives();

	/** Complete/fail transitions + broadcasts (single funnel, no reentry). */
	void CompleteObjective(FName ObjectiveId);
	void FailObjectiveInternal(FName ObjectiveId, bool bExplicit);

	// ---- owned state ----

	/** Tracked live state by id (only configured + activated rows appear). */
	UPROPERTY()
	TMap<FName, FSILIDObjectiveState> Objectives;

	/** The story-tag ledger — every world-state tag recorded this run
	 * (save-safe: the raw facts survive; derived progress recomputes). */
	UPROPERTY()
	FGameplayTagContainer StoryLedger;

public:
	// ---- save plumbing (SaveSubsystem calls these around the saveable walk;
	// raw facts only — the ledger + terminal ids — never activation state) ----
	void SaveTo(USILIDSaveGame* SaveGame) const;
	void LoadFrom(const USILIDSaveGame* SaveGame);
};
