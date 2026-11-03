// Light switch implementation. P8: the switch is now a power CONSUMER —
// the room's node must be alive AND the switch on for light. The switch owns
// its wish (bDeviceEnabled); the electrical subsystem owns the node's state;
// the light component is never told anything directly (doc 01 §6 — power
// state changes broadcast one delegate, lights subscribe).
//
// Authoring law: designers attach a USILIDElectricPoweredComponent in the BP
// and set PowerNode = Power.Node.House.<Room> (doc 05 §2 tag registry). A
// switch with no ElectricPowered component keeps the legacy free-power
// behavior (safe for unconverted BPs; flagged for the P25 pass).

#pragma once

#include "GameFramework/Actor.h"
#include "GameplayTagContainer.h"
#include "SILIDInterfaces.h"
#include "SILIDLightSwitch.generated.h"

class ULightComponent;
class USILIDNoiseEmitterComponent;
class USILIDElectricPoweredComponent;

UCLASS()
class SILID_API ASILIDLightSwitch : public AActor, public ISILIDInteractable, public ISILIDSaveable
{
	GENERATED_BODY()

public:
	ASILIDLightSwitch();

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Switch")
	TArray<TObjectPtr<ULightComponent>> ControlledLights;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Switch")
	bool bStartOn = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Switch")
	FName SaveIdName;

	// ~ ISILIDInteractable
	virtual bool CanInteract(const ASILIDCharacter* Player) const override { return true; }
	virtual bool Interact(ASILIDCharacter* Player) override;
	virtual FText GetInteractionText(const ASILIDCharacter* Player) const override;
	virtual FText GetExamineText(const ASILIDCharacter* Player) const override;

	// ~ ISILIDSaveable
	virtual FString GetSaveId() const override;
	virtual void OnSave(class USILIDSaveGame* SaveGame) override;
	virtual void OnLoad(const class USILIDSaveGame* SaveGame) override;

	UFUNCTION(BlueprintPure, Category = "Switch")
	bool IsOn() const { return bOn; }

	/** True when the switch is on but the circuit is dead — the "flip does
	 * nothing" horror beat (doc 05 §2 power OFF effects). */
	UFUNCTION(BlueprintPure, Category = "Switch")
	bool IsDeadCircuit() const;

protected:
	virtual void BeginPlay() override;

private:
	bool bOn = false;

	UPROPERTY()
	TObjectPtr<USILIDNoiseEmitterComponent> NoiseEmitter;

	/** Optional: the powered member when the BP opts into the power system. */
	UPROPERTY()
	TObjectPtr<USILIDElectricPoweredComponent> Powered;

	/** OnPowerChanged target (exact dynamic-delegate signature). */
	UFUNCTION()
	void HandlePowerChanged(bool bPowered, FGameplayTag NodeTag);

	void ApplyState();
};
