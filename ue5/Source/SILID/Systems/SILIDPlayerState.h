// Player state (doc 12 §1): the per-player replicated slice - downed state,
// role tag, and ready flag.
//
// OWNERSHIP (doc 11 §1): PlayerState owns identity/session flags ONLY. It is
// NEVER the inventory (that is the character's InventoryComponent, doc 12 §1)
// and never the health value (HealthComponent owns health); bDowned is the
// replicated downed MIRROR that co-op revive + UI read - not a second health
// authority. Writes are server-side and replicate outward.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerState.h"
#include "GameplayTagContainer.h"
#include "SILIDPlayerState.generated.h"

/** Broadcast when the replicated downed mirror flips. */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSILIDDownedChanged, bool, bDowned);

/** Broadcast when the lobby ready flag flips. */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSILIDReadyChanged, bool, bReady);

UCLASS()
class SILID_API ASILIDPlayerState : public APlayerState
{
	GENERATED_BODY()

public:
	ASILIDPlayerState();

	/** Replicated downed mirror (co-op revive/UI). HealthComponent owns health. */
	UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Downed, Category = "SILID|Player")
	bool bDowned = false;

	/** Role tag (Player.Role.*) - survivor, spectator, etc. */
	UPROPERTY(BlueprintReadOnly, Replicated, Category = "SILID|Player")
	FGameplayTag RoleTag;

	/** Lobby/ready flag. */
	UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Ready, Category = "SILID|Player")
	bool bReady = false;

	UFUNCTION(BlueprintCallable, Category = "SILID|Player")
	void SetDowned(bool bNewDowned);

	UFUNCTION(BlueprintCallable, Category = "SILID|Player")
	void SetRoleTag(FGameplayTag NewRole);

	UFUNCTION(BlueprintCallable, Category = "SILID|Player")
	void SetReady(bool bNewReady);

	UFUNCTION(BlueprintPure, Category = "SILID|Player")
	bool IsDowned() const { return bDowned; }

	UPROPERTY(BlueprintAssignable, Category = "SILID|Player")
	FOnSILIDDownedChanged OnDownedChanged;

	UPROPERTY(BlueprintAssignable, Category = "SILID|Player")
	FOnSILIDReadyChanged OnReadyChanged;

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

protected:
	UFUNCTION()
	void OnRep_Downed();

	UFUNCTION()
	void OnRep_Ready();
};
