// Room dressing actor: one authored item with a proper SILID interaction.
// Fixed furniture is examined in place; lamps can be toggled without pretending
// that a sofa or bookshelf belongs in the player's inventory.

#pragma once

#include "GameFramework/Actor.h"
#include "Systems/SILIDInterfaces.h"
#include "SILIDInspectableProp.generated.h"

class UPointLightComponent;
class UBoxComponent;
class UStaticMeshComponent;

UCLASS()
class SILID_API ASILIDInspectableProp : public AActor, public ISILIDInteractable, public ISILIDSaveable
{
	GENERATED_BODY()

public:
	ASILIDInspectableProp();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Prop")
	TObjectPtr<UStaticMeshComponent> Mesh;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Prop|Interaction")
	TObjectPtr<UBoxComponent> FocusCollider;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Prop|Lighting")
	TObjectPtr<UPointLightComponent> PracticalLight;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Prop|Interaction")
	FText DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Prop|Interaction", meta = (MultiLine = true))
	FText ExamineDescription;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Prop|Interaction")
	bool bToggleable = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Prop|Interaction")
	bool bStartsOn = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Prop|Save")
	FName SaveId;

	virtual bool Interact(class ASILIDCharacter* Player) override;
	virtual bool CanInteract(const class ASILIDCharacter* Player) const override { return true; }
	virtual FText GetInteractionText(const class ASILIDCharacter* Player) const override;
	virtual FText GetExamineText(const class ASILIDCharacter* Player) const override { return ExamineDescription; }
	virtual void OnFocus() override;
	virtual void OnUnfocus() override;

	virtual FString GetSaveId() const override { return SaveId.IsValid() ? SaveId.ToString() : GetName(); }
	virtual void OnSave(class USILIDSaveGame* SaveGame) override;
	virtual void OnLoad(const class USILIDSaveGame* SaveGame) override;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	bool bIsOn = false;
	void ApplyState();
};
