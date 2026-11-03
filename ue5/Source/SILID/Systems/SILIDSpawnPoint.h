// Spawn point actor: the only level-side work randomization needs.
// Scatter these, set Family + optional ItemClass, done. Invisible in play.

#pragma once

#include "GameFramework/Actor.h"
#include "GameplayTagContainer.h"
#include "SILIDSpawnPoint.generated.h"

class USILIDItemData;
class ASILIDPickup;

UCLASS()
class SILID_API ASILIDSpawnPoint : public AActor
{
	GENERATED_BODY()

public:
	ASILIDSpawnPoint();

	/** Spawn family key: "Items.Key", "Items.Battery", "Items.Tool",
	 * "Items.Component", "Enemy.Patrol" — designers invent more freely. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Spawn")
	FName Family = NAME_None;

	/** Item to place here when this point wins the scatter (optional —
	 * some families activate a BP event instead, e.g. patrol markers). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Spawn")
	TObjectPtr<USILIDItemData> ItemToSpawn;

	/** Guaranteed families always activate somewhere (spec fairness rule). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Spawn")
	bool bGuaranteed = false;

	/** Which room this point belongs to (validator metadata — doc 09 room
	 * metadata extension). Name it after the room zone, e.g. "Kusina".
	 * The solvability validator reads this to build the dependency graph. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Spawn|Validation")
	FName ValidationRoomId = NAME_None;

	/** Room name for graph extraction; empty when untagged (unrandomized-safe). */
	FString GetRoomNameForValidation() const
	{
		return ValidationRoomId.IsValid() ? ValidationRoomId.ToString() : FString();
	}

	/** Hidden by default until activated. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Spawn")
	bool bStartHidden = true;

	/** Fired when this point is chosen — BP can place anything (enemy
	 * waypoint registration, custom props, puzzle pieces...). */
	DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnChosen);
	UPROPERTY(BlueprintAssignable, Category = "Spawn")
	FOnChosen OnChosen;

	/** Activate: spawn the item pickup (or just broadcast for BP families). */
	UFUNCTION(BlueprintCallable, Category = "Spawn")
	void Activate();

	/** Undo a previous activation (randomizer re-scatter on restart/load). */
	UFUNCTION(BlueprintCallable, Category = "Spawn")
	void Deactivate();

	/** Was this point activated by the randomizer this run? */
	UFUNCTION(BlueprintPure, Category = "Spawn")
	bool IsChosen() const { return bChosen; }

	/** Registered with the randomizer automatically. */
	virtual void BeginPlay() override;

private:
	UPROPERTY()
	bool bChosen = false;

	UPROPERTY()
	TObjectPtr<ASILIDPickup> SpawnedPickup;
};
