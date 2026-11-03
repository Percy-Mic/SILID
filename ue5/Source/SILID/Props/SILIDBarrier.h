// Generic barrier actor (spec: Granny-style blockades + puzzle framework).
// One class covers every "thing that blocks a path until solved":
//   Planks   -> needs a tool that BreaksPlanks (hammer), N hits
//   Chain    -> needs a tool that CutsChains (bolt cutters), instant
//   Fusebox  -> needs a component (fuse) inserted; optional power relay
//   Padlock  -> needs a key matching KeyTag
// Barriers never test item ids — only capabilities and tags. When cleared
// they optionally unlock an ASILIDDoor or an ASILIDEscapeRoute.

#pragma once

#include "GameFramework/Actor.h"
#include "GameplayTagContainer.h"
#include "SILIDInterfaces.h"
#include "SILIDBarrier.generated.h"

class ASILIDCharacter;
class ASILIDDoor;
class ASILIDEscapeRoute;
class UStaticMeshComponent;
class USILIDNoiseEmitterComponent;
class UAudioComponent;
class USILIDInventoryComponent;

UENUM(BlueprintType)
enum class EBarrierKind : uint8
{
	Planks  UMETA(DisplayName = "Planks"),
	Chain   UMETA(DisplayName = "Chain"),
	Fusebox UMETA(DisplayName = "Fusebox"),
	Padlock UMETA(DisplayName = "Padlock")
};

UCLASS()
class SILID_API ASILIDBarrier : public AActor, public ISILIDInteractable, public ISILIDSaveable
{
	GENERATED_BODY()

public:
	ASILIDBarrier();

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Barrier")
	EBarrierKind Kind = EBarrierKind::Planks;

	/** Stable save key. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Barrier")
	FName SaveIdName;

	// ---- requirements per kind ----
	/** Hits with the right tool to clear planks. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Barrier|Planks", meta = (ClampMin = "1", ClampMax = "10", EditCondition = "Kind == EBarrierKind::Planks"))
	int32 HitsNeeded = 3;

	/** Key tag for padlocks. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Barrier|Padlock", meta = (EditCondition = "Kind == EBarrierKind::Padlock"))
	FGameplayTag KeyTag;

	/** Component tag the fusebox consumes. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Barrier|Fusebox", meta = (EditCondition = "Kind == EBarrierKind::Fusebox"))
	FGameplayTag ComponentTag;

	// ---- consequences ----
	/** Door unlocked/opened when the barrier clears. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Barrier|Result")
	TObjectPtr<ASILIDDoor> DoorToUnlock;

	/** Escape route made ready when the barrier clears. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Barrier|Result")
	TObjectPtr<ASILIDEscapeRoute> RouteToEnable;

	/** Fusebox powered relight targets (restored electricity). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Barrier|Result")
	TArray<TObjectPtr<class ULightComponent>> LightsToRestore;

	/** P8: when set and bRestoresPower, clearing the fusebox replaces the
	 * fuse on this Power.Node through the electrical subsystem (the modern
	 * path — the lights above remain for legacy/authoring convenience). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Barrier|Result")
	FGameplayTag RestoresPowerNode;

	// ---- visuals / audio ----
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Barrier|Visuals")
	TObjectPtr<UStaticMeshComponent> BarrierMesh;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Barrier|Visuals")
	TObjectPtr<UAudioComponent> WorkSound;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Barrier|Audio")
	TObjectPtr<USILIDNoiseEmitterComponent> NoiseEmitter;

	/** Does clearing this barrier restore house power (fusebox semantics)? */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Barrier|Result")
	bool bRestoresPower = false;

	/** Fired when cleared — UI hints, audio stingers, BP hooks. */
	DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnBarrierCleared);
	UPROPERTY(BlueprintAssignable, Category = "Barrier")
	FOnBarrierCleared OnBarrierCleared;

	UFUNCTION(BlueprintPure, Category = "Barrier")
	bool IsCleared() const { return bCleared; }

	/** Current progress for planks (hits applied). */
	UFUNCTION(BlueprintPure, Category = "Barrier")
	int32 GetHitsApplied() const { return HitsApplied; }

	// ~ ISILIDInteractable
	virtual bool CanInteract(const ASILIDCharacter* Player) const override;
	virtual bool Interact(ASILIDCharacter* Player) override;
	virtual bool UseItem(ASILIDCharacter* Player, USILIDInventoryComponent* Inventory) override;
	virtual FText GetInteractionText(const ASILIDCharacter* Player) const override;
	virtual FText GetExamineText(const ASILIDCharacter* Player) const override;
	virtual void OnFocus() override;
	virtual void OnUnfocus() override;

	// ~ ISILIDSaveable
	virtual FString GetSaveId() const override;
	virtual void OnSave(class USILIDSaveGame* SaveGame) override;
	virtual void OnLoad(const class USILIDSaveGame* SaveGame) override;

private:
	UPROPERTY()
	bool bCleared = false;

	int32 HitsApplied = 0;

	/** The hit loop: repeated E swings with cooldown, loud every strike. */
	void ApplyPlankHit(ASILIDCharacter* Player);
	void ClearBarrier(ASILIDCharacter* Player);
};
