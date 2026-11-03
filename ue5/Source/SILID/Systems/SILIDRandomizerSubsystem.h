// Randomization subsystem (spec: randomization / replayability).
// Designers scatter ASILIDSpawnPoint actors and tag each with spawn families
// ("Items.Key", "Items.Battery", "Enemy.Patrol"...). At BeginPlay the
// subsystem draws a seeded shuffle and activates the winners. Same seed ->
// same house; the seed is saved so a run is reproducible.
//
// Fairness rules (spec: do NOT randomize everything):
//  - Guaranteed families ("Guaranteed" bGuaranteed) always fire somewhere.
//  - Difficulty scales the COUNT of loot spawns, never the logic.
//  - Enemy patrol order is always shuffled (he should not be memorized).

#pragma once

#include "Subsystems/WorldSubsystem.h"
#include "GameplayTagContainer.h"
#include "SILIDRandomizerSubsystem.generated.h"

class ASILIDSpawnPoint;

USTRUCT()
struct FSILIDFamilyPool
{
	GENERATED_BODY()

	UPROPERTY()
	TArray<TObjectPtr<ASILIDSpawnPoint>> Points;

	/** How many of these activate this run (before difficulty scaling). */
	UPROPERTY()
	int32 DesiredCount = 1;

	/** Points already activated. */
	UPROPERTY()
	TArray<TObjectPtr<ASILIDSpawnPoint>> Chosen;
};

/**
 * World subsystem that runs the seeded scatter once on BeginPlay.
 * GameMode/BP can re-run RandomizeAll with a new seed on restart.
 */
UCLASS()
class SILID_API USILIDRandomizerSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	/** Run the scatter for this seed. Registers points automatically. */
	UFUNCTION(BlueprintCallable, Category = "Randomizer")
	void RandomizeAll(int32 Seed);

	/** The seed used this run (save this). */
	UFUNCTION(BlueprintPure, Category = "Randomizer")
	int32 GetCurrentSeed() const { return CurrentSeed; }

	/** Change difficulty's loot multiplier before RandomizeAll. */
	UFUNCTION(BlueprintCallable, Category = "Randomizer")
	void SetLootMultiplier(float Multiplier) { LootMultiplier = Multiplier; }

	/** Register a point (called by ASILIDSpawnPoint::BeginPlay). */
	void RegisterPoint(ASILIDSpawnPoint* Point);

	/** Deterministic helper: seedable stream for anything else that wants it. */
	static FRandomStream MakeStream(int32 Seed) { return FRandomStream(Seed); }

private:
	virtual void OnWorldBeginPlay(UWorld& InWorld) override;

	TMap<FName, FSILIDFamilyPool> Families;

	int32 CurrentSeed = 0;

	float LootMultiplier = 1.f;

	/** Order points visit families so guaranteed fire first. */
	void ScatterFamily(FSILIDFamilyPool& Pool, FRandomStream& Stream, int32 Count, bool bGuaranteed);
};
