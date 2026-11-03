// Pickup actor: anything the player can take (spec sections 4, 6).
// Built from USILIDItemData so items exist once as data; the world just
// references them. Documents (notes/photos) surface text on examine.

#pragma once

#include "GameFramework/Actor.h"
#include "Systems/SILIDInterfaces.h"
#include "SILIDPickup.generated.h"

class UStaticMeshComponent;
class USILIDItemData;
class USILIDNoiseEmitterComponent;
class USILIDInventoryComponent;
class ASILIDCharacter;

UCLASS()
class SILID_API ASILIDPickup : public AActor, public ISILIDInteractable, public ISILIDSaveable
{
	GENERATED_BODY()

public:
	ASILIDPickup();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Pickup")
	TObjectPtr<UStaticMeshComponent> Mesh;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Pickup")
	TObjectPtr<USILIDNoiseEmitterComponent> NoiseEmitter;

	/** The item this world pickup grants. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Pickup")
	TObjectPtr<USILIDItemData> ItemData;

	/** Documents read on pickup instead of silently pocketed. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Pickup", meta = (MultiLine = true))
	FText DocumentText;

	/** One-time pickups vanish forever once taken (keys, story items). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Pickup")
	bool bOneTime = true;

	/** Stable save id. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Save")
	FName SaveId;

	/** Configure from item data (used when items are dropped into the world). */
	void InitFromItemData(USILIDItemData* InItemData);

	// ---- ISILIDInteractable ----
	virtual bool Interact(ASILIDCharacter* Player) override;
	virtual bool CanInteract(const ASILIDCharacter* Player) const override;
	virtual FText GetInteractionText(const ASILIDCharacter* Player) const override;
	virtual FText GetExamineText(const ASILIDCharacter* Player) const override;
	virtual void OnFocus() override;
	virtual void OnUnfocus() override;
	virtual bool UseItem(ASILIDCharacter* Player, USILIDInventoryComponent* Inventory) override { return false; }

	// ---- ISILIDSaveable ----
	virtual FString GetSaveId() const override { return SaveId.IsValid() ? SaveId.ToString() : GetName(); }
	virtual void OnSave(USILIDSaveGame* SaveGame) override;
	virtual void OnLoad(const USILIDSaveGame* SaveGame) override;

protected:
	virtual void BeginPlay() override;

private:
	bool bTaken = false;

	void ApplyItemVisuals();
};
