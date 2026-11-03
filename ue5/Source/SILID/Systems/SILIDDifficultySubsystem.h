// Difficulty subsystem (spec section 21). Owns the current EDifficulty and
// exposes multipliers so each system modifies itself - no scattered switches.

#pragma once

#include "Subsystems/WorldSubsystem.h"
#include "Systems/SILIDTypes.h"
#include "SILIDDifficultySubsystem.generated.h"

UCLASS()
class SILID_API USILIDDifficultySubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	static USILIDDifficultySubsystem* Get(const UObject* WorldContext);

	UFUNCTION(BlueprintCallable, Category = "Difficulty")
	void SetDifficulty(EDifficulty NewDifficulty) { Current = NewDifficulty; }

	UFUNCTION(BlueprintPure, Category = "Difficulty")
	EDifficulty GetDifficulty() const { return Current; }

	// --- per-system modifiers (all BlueprintPure so BP can read them too) ---

	/** Resident movement speed multiplier. */
	UFUNCTION(BlueprintPure, Category = "Difficulty") float GetEnemySpeedMultiplier() const;

	/** Sight/hearing sensitivity multiplier. */
	UFUNCTION(BlueprintPure, Category = "Difficulty") float GetAISensitivityMultiplier() const;

	/** How thoroughly the Resident searches hiding spots. */
	UFUNCTION(BlueprintPure, Category = "Difficulty") float GetHideSearchChance() const;

	/** Flashlight drain multiplier. */
	UFUNCTION(BlueprintPure, Category = "Difficulty") float GetFlashlightDrainMultiplier() const;

	/** Battery pickup frequency (spawn gating uses this). */
	UFUNCTION(BlueprintPure, Category = "Difficulty") float GetResourceMultiplier() const;

	/** Whether objective hints show in the UI. */
	UFUNCTION(BlueprintPure, Category = "Difficulty") bool ShouldShowHints() const;

	/** Extra room mutations per chapter on higher difficulty. */
	UFUNCTION(BlueprintPure, Category = "Difficulty") int32 ExtraMutationsPerChapter() const;

	/** Scales the Resident's sight cone + detection buildup (Easy 0.8, Hard 1.2). */
	UFUNCTION(BlueprintPure, Category = "Difficulty") float GetDetectionForgiveness() const;

	/** Extra hiding spots Easy adds (or Hard removes) at the HideSpotManager level. */
	UFUNCTION(BlueprintPure, Category = "Difficulty") int32 ExtraHidingSpots() const;

private:
	EDifficulty Current = EDifficulty::Normal;
};
