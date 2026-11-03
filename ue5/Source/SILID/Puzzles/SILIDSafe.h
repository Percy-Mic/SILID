// Safe / locked container (spec section 17): a mountable code lock; opening
// reveals the reward pickup placed inside it. Drawers/cabinets share this
// pattern with different meshes and lock ids.

#pragma once

#include "GameFramework/Actor.h"
#include "Systems/SILIDInterfaces.h"
#include "SILIDSafe.generated.h"

class UStaticMeshComponent;
class USILIDCodeLockComponent;
class USILIDNoiseEmitterComponent;
class ASILIDPickup;

UCLASS()
class SILID_API ASILIDSafe : public AActor, public ISILIDInteractable, public ISILIDSaveable
{
	GENERATED_BODY()

public:
	ASILIDSafe();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Safe")
	TObjectPtr<UStaticMeshComponent> BodyMesh;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Safe")
	TObjectPtr<UStaticMeshComponent> DoorMesh;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Safe")
	TObjectPtr<USILIDCodeLockComponent> CodeLock;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Safe")
	TObjectPtr<USILIDNoiseEmitterComponent> NoiseEmitter;

	/** Reward pickup spawned when opened (set in editor; the reward is data). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Safe")
	TSubclassOf<ASILIDPickup> RewardPickupClass;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Save")
	FName SaveId;

	UPROPERTY(BlueprintReadOnly, Category = "Safe")
	bool bOpened = false;

	DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSafeOpened, ASILIDSafe*, Safe);
	UPROPERTY(BlueprintAssignable, Category = "Safe")
	FOnSafeOpened OnSafeOpened;

	// ---- ISILIDInteractable ----
	virtual bool Interact(ASILIDCharacter* Player) override;
	virtual bool CanInteract(const ASILIDCharacter* Player) const override;
	virtual FText GetInteractionText(const ASILIDCharacter* Player) const override;
	virtual FText GetExamineText(const ASILIDCharacter* Player) const override;

	// ---- ISILIDSaveable ----
	virtual FString GetSaveId() const override { return SaveId.IsValid() ? SaveId.ToString() : GetName(); }
	virtual void OnSave(USILIDSaveGame* SaveGame) override;
	virtual void OnLoad(const USILIDSaveGame* SaveGame) override;

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY()
	TObjectPtr<ASILIDPickup> SpawnedReward;

public:
	/** Called by the code lock's OnUnlocked delegate (UFUNCTION for binding). */
	UFUNCTION()
	void HandleLockUnlocked() { Open(); }

private:
	void Open();
};
