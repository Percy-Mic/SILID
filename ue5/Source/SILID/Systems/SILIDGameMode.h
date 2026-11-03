// Game mode (spec sections 19, 20, 21, 30): owns the run lifecycle - death,
// respawn, the escape objective, the vertical slice's one ending, difficulty
// application, and save/load triggers.

#pragma once

#include "GameFramework/GameModeBase.h"
#include "Systems/SILIDTypes.h"
#include "SILIDGameMode.generated.h"

class APlayerStart;
class USILIDHUDWidget;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnPlayerDied);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnEscapeReached);

UCLASS()
class SILID_API ASILIDGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ASILIDGameMode();

	/** HUD widget class (WBP_SILIDHUD; manual asset). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "UI")
	TSubclassOf<USILIDHUDWidget> HUDWidgetClass;

	UPROPERTY(BlueprintAssignable, Category = "SILID")
	FOnPlayerDied OnPlayerDied;

	UPROPERTY(BlueprintAssignable, Category = "SILID")
	FOnEscapeReached OnEscapeReached;

	/** Death: fade, reload state at spawn, keep puzzle progress (spec section 20). */
	UFUNCTION(BlueprintCallable, Category = "SILID")
	void HandlePlayerDeath();

	/** The escape trigger (front door with all keys) calls this. */
	UFUNCTION(BlueprintCallable, Category = "SILID")
	void ReachEscape();

	/** Apply the game instance's chosen difficulty to all systems. */
	UFUNCTION(BlueprintCallable, Category = "SILID")
	void ApplyDifficulty();

	/** True once any escape route has fired (spec: escape = win). */
	UFUNCTION(BlueprintPure, Category = "SILID")
	bool IsEscapeReady() const { return bEscaped; }

	/** Called by key pickups / puzzle steps to advance the objective. */
	UFUNCTION(BlueprintCallable, Category = "SILID")
	void NotifyKeyCollected();

	/** The run seed (randomizer). Saved with the run; new on restart. */
	UFUNCTION(BlueprintPure, Category = "SILID")
	int32 GetRunSeed() const { return RunSeed; }

	/** Auto-spawn the Resident on a random patrol midpoint (level may also
	 * place one by hand; the spawn is skipped if any already exists). */
	void SpawnResidentIfMissing();

	/** Restore the seed from a save (save subsystem calls this on load). */
	UFUNCTION(BlueprintCallable, Category = "SILID")
	void SetRunSeed(int32 NewSeed) { RunSeed = NewSeed; }

protected:
	virtual void BeginPlay() override;

private:
	/** P13: refreshes the HUD objective line from the ObjectiveSubsystem
	 * (fired on activate/complete; the "Find a way out" default stands until
	 * authored rows exist). */
	UFUNCTION()
	void HandleObjectiveChanged(FName ObjectiveId);
	/** Any route escaped = won (spec: escape system). Keys are one route's
	 * business, not the win condition itself. */
	bool bEscaped = false;

	int32 RunSeed = 0;

	UPROPERTY()
	TObjectPtr<APlayerStart> RespawnPoint;
};
