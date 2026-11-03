// Door actor (spec sections 5, 17). Interface-based: IInteractable + ISaveable.
// Unlocks by key tag OR USILIDCodeLockComponent. Opening emits Noise.Door.

#pragma once

#include "GameFramework/Actor.h"
#include "GameplayTagContainer.h"
#include "Systems/SILIDInterfaces.h"
#include "SILIDDoor.generated.h"

class UStaticMeshComponent;
class USILIDCodeLockComponent;
class USILIDNoiseEmitterComponent;
class UTimelineComponent;
class UCurveFloat;
class ASILIDCharacter;

UCLASS()
class SILID_API ASILIDDoor : public AActor, public ISILIDInteractable, public ISILIDSaveable
{
	GENERATED_BODY()

public:
	ASILIDDoor();

	// ---- composition (replace meshes with professional assets later) ----
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Door")
	TObjectPtr<UStaticMeshComponent> FrameMesh;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Door")
	TObjectPtr<UStaticMeshComponent> LeafPivot; // rotated for the swing

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Door")
	TObjectPtr<USILIDCodeLockComponent> CodeLock;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Door")
	TObjectPtr<USILIDNoiseEmitterComponent> NoiseEmitter;

	/** Required key tag; empty = unlocked door. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Door")
	FGameplayTag RequiredKeyTag;

	/** Locked doors need the key even without a code lock. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Door")
	bool bStartsLocked = false;

	/** Stable save id (e.g. "door.front"). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Save")
	FName SaveId;

	/** Which room this door gates (validator metadata — doc 09 room metadata
	 * extension, e.g. "Kwarto"). Locked doors gate that room in the graph. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Save|Validation")
	FName ValidationRoomId = NAME_None;

	/** P8 electronic lock (spec §17): when set, the door dead-locks CLOSED
	 * while this Power.Node is dead (fail-safe — even the right key can't
	 * help; the physical fallback route is the designer's soft-lock duty,
	 * doc 05 §7). Empty = ordinary door, power-irrelevant. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Door|Power")
	FGameplayTag PowerNode;

	/** Room name for graph extraction; empty when untagged. */
	FString GetRoomNameForValidation() const
	{
		return ValidationRoomId.IsValid() ? ValidationRoomId.ToString() : GetName();
	}

	/** True for ordinary doors. Electronic-lock doors answer the subsystem
	 * (queried on demand — doors never cache another system's state, doc 11). */
	UFUNCTION(BlueprintPure, Category = "Door|Power")
	bool IsPowerAvailable() const;

	/** Swing animation curve (designer can swap for a creakier profile). */
	UPROPERTY(EditDefaultsOnly, Category = "Door")
	TObjectPtr<UCurveFloat> SwingCurve;

	UPROPERTY(BlueprintReadOnly, Category = "Door")
	bool bOpen = false;

	UFUNCTION(BlueprintPure, Category = "Door")
	bool IsLocked() const { return bLocked; }

	void SetLocked(bool bNewLocked) { bLocked = bNewLocked; }

	// ---- ISILIDInteractable ----
	virtual bool Interact(ASILIDCharacter* Player) override;
	virtual bool CanInteract(const ASILIDCharacter* Player) const override;
	virtual FText GetInteractionText(const ASILIDCharacter* Player) const override;
	virtual FText GetExamineText(const ASILIDCharacter* Player) const override;
	virtual void OnFocus() override;
	virtual void OnUnfocus() override;

	// ---- ISILIDSaveable ----
	virtual FString GetSaveId() const override { return SaveId.IsValid() ? SaveId.ToString() : GetName(); }
	virtual void OnSave(USILIDSaveGame* SaveGame) override;
	virtual void OnLoad(const USILIDSaveGame* SaveGame) override;

	/** Programmatic open/close (AI can open doors, room director can seal them). */
	UFUNCTION(BlueprintCallable, Category = "Door")
	void SetOpen(bool bNewOpen, bool bInstant = false);

	DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnDoorStateChanged, bool, bIsOpen, ASILIDDoor*, Door);
	UPROPERTY(BlueprintAssignable, Category = "Door")
	FOnDoorStateChanged OnDoorStateChanged;

protected:
	virtual void BeginPlay() override;

private:
	bool bLocked = false;
	float CurrentSwing = 0.f;   // -1..1 normalized
	float TargetSwing = 0.f;
	FTimerHandle SwingTimer;

	/** Node-state push target (bound in BeginPlay when PowerNode is set). */
	UFUNCTION()
	void HandleNodePowerChanged(FGameplayTag NodeTag, bool bPowered);

	void TickSwing();
	void ApplySwing(float Normalized);
};
