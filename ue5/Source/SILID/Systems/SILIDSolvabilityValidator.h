// SILID class contract
// OWNS:         validation of generated runs — the world→graph extraction,
//               per-seed placement simulation, batch seed testing, and the
//               reject-before-play decision for a run
// MAY WRITE:    nothing in the world — READ-ONLY by law (doc 11: the
//               validator never secretly repairs; an invalid seed is
//               reported and rejected, the generator regenerates)
// DEPENDS ON:   RandomizerSubsystem (candidate pools + seed draw — read),
//               spawn points, escape routes, doors, barriers, repair
//               components (read-only extraction), the pure evaluator
// EMITS:        OnValidationComplete (per run), OnBatchComplete (harness)
//
// P16 Solvability Validation (doc 13; design doc 09 §8; A-015 NON-NEGOTIABLE
// in doc 15). The game must never start an unwinnable generated run: the
// GameMode asks ValidateSeed before accepting a seed; failures are logged
// with full detail and the run is rejected (regenerate, per doc 15 §4).
// The pure evaluator (SILIDSolvabilityEvaluator.cpp) does the graph work;
// this subsystem owns extraction and the batch harness.

#pragma once

#include "Subsystems/WorldSubsystem.h"
#include "Systems/SILIDSolvabilityTypes.h"
#include "SILIDSolvabilityValidator.generated.h"

class ASILIDSpawnPoint;
class ASILIDEscapeRoute;
class ASILIDDoor;

UCLASS()
class SILID_API USILIDSolvabilityValidator : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	/** Called by the GameMode before accepting a run seed (A-015 gate).
	 * Builds the model, simulates the placement, evaluates, logs, decides. */
	bool ValidateSeed(int32 Seed, SILIDSolvability::FReport* OutReport = nullptr);

	/** Reject-and-regenerate: next candidate seed that passes (bounded
	 * attempts; over the limit = map config error, log CRITICAL and fail). */
	int32 FindNextValidSeed(int32 FirstCandidate, int32 MaxAttempts = 64);

	/** Batch harness: validate [FirstSeed, FirstSeed+Count) and log a
	 * summary table. Returns how many passed. (The automation spec's
	 * 100/500/1000-seed runs call this from the automation executor.) */
	int32 ValidateSeedBatch(int32 FirstSeed, int32 Count);

	/** The extracted model — exposed for tests and debug tooling. */
	const SILIDSolvability::FModel& GetModel() const { return Model; }

	/** Fired after ValidateSeed (bSolvable, seed). */
	DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnValidationComplete, bool, bSolvable, int32, Seed);
	UPROPERTY(BlueprintAssignable, Category = "Validation")
	FOnValidationComplete OnValidationComplete;

	/** Console: `SILID.ValidateSeeds 200` — batch from seed 1. */
	UFUNCTION(Exec)
	void SILID_ValidateSeeds(int32 Count = 100);

	/** Console: `SILID.DumpGraph` — log the extracted dependency graph. */
	UFUNCTION(Exec)
	void SILID_DumpGraph();

	/** Console: `SILID.ValidateSeed 12345` — one seed, full report. */
	UFUNCTION(Exec)
	void SILID_ValidateSeed(int32 Seed);

	virtual bool ShouldCreateSubsystem(UObject* Outer) const override;

private:
	/** Build the static graph from the world's actors (doors, routes,
	 * barriers, machines, spawn-point candidates). Idempotent per map. */
	void BuildModel();

	/** Simulate the randomizer's per-seed draw over the candidate pools. */
	SILIDSolvability::FPlacement DrawPlacement(int32 Seed) const;

	/** Extraction helpers. */
	FName RoomNodeForDoor(const ASILIDDoor* Door) const;

	SILIDSolvability::FModel Model;

	/** Spawn candidates per item id (from spawn points' ItemToSpawn). */
	TMap<FName, TArray<FName>> SpawnCandidates;
};
