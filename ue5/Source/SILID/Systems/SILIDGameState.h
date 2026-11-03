// Game state (doc 12 §1): the replicated run read-model - run phase, escape
// state, and a compact objective progress summary that joining clients can
// consume without replaying the whole ledger.
//
// OWNERSHIP (doc 11 §1 - one owner per state): ASILIDGameMode stays the
// server-side owner of the run RULES (death/respawn/escape/seed). This class
// owns only the replicated MIRROR of that state; it never becomes a second
// authority. Writes are server-side (HasAuthority) and replicate outward;
// clients read + react via the OnRunStateChanged bus. It never polls and it
// never touches inventory (that is the character's InventoryComponent).

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameStateBase.h"
#include "Systems/SILIDTypes.h"
#include "SILIDGameState.generated.h"

/** Broadcast when replicated run state changes (phase or escape flip).
 * HUD/audio may bind; the values are already updated when it fires. */
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnSILIDRunStateChanged);

UCLASS()
class SILID_API ASILIDGameState : public AGameStateBase
{
	GENERATED_BODY()

public:
	ASILIDGameState();

	/** The run's lifecycle phase (menu / exploring / escaped / dead). */
	UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_RunPhase, Category = "SILID|Run")
	ESILIDRunPhase RunPhase = ESILIDRunPhase::Menu;

	/** Replicated mirror of the GameMode's escape flag (GameMode owns the rule). */
	UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Escaped, Category = "SILID|Run")
	bool bEscaped = false;

	/** The currently surfaced objective line's id (empty = the default "get out"). */
	UPROPERTY(BlueprintReadOnly, Replicated, Category = "SILID|Run")
	FName CurrentObjectiveId;

	/** Count of completed objective rows - the compact summary a joiner needs. */
	UPROPERTY(BlueprintReadOnly, Replicated, Category = "SILID|Run")
	int32 CompletedObjectiveCount = 0;

	/** Server-side setter; replicates to clients and pushes OnRunStateChanged. */
	UFUNCTION(BlueprintCallable, Category = "SILID|Run")
	void SetRunPhase(ESILIDRunPhase NewPhase);

	/** Server-side setter for the escape mirror. */
	UFUNCTION(BlueprintCallable, Category = "SILID|Run")
	void SetEscaped(bool bNewEscaped);

	/** Server-side setter for the objective summary (id + completed count). */
	UFUNCTION(BlueprintCallable, Category = "SILID|Run")
	void SetObjectiveSummary(FName ObjectiveId, int32 InCompletedCount);

	UFUNCTION(BlueprintPure, Category = "SILID|Run")
	ESILIDRunPhase GetRunPhase() const { return RunPhase; }

	UFUNCTION(BlueprintPure, Category = "SILID|Run")
	bool HasEscaped() const { return bEscaped; }

	/** Fired after replicated changes land (on clients via the OnReps too). */
	UPROPERTY(BlueprintAssignable, Category = "SILID|Run")
	FOnSILIDRunStateChanged OnRunStateChanged;

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

protected:
	UFUNCTION()
	void OnRep_RunPhase();

	UFUNCTION()
	void OnRep_Escaped();
};
