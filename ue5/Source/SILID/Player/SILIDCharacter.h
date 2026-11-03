// First-person player character (spec section 4).
// Gameplay lives here; input binding lives in SILIDPlayerController.
// Components: Flashlight, Inventory, Health, NoiseEmitter (all reusable).

#pragma once

#include "GameFramework/Character.h"
#include "Systems/SILIDTypes.h"
#include "SILIDCharacter.generated.h"

class USpringArmComponent;
class UCameraComponent;
class USILIDFlashlightComponent;
class USILIDInventoryComponent;
class USILIDHealthComponent;
class USILIDNoiseEmitterComponent;
class USILIDItemData;
class AActor;
struct FInputActionValue;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnFocusChanged, AActor*, Focused, AActor*, Previous);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnStaminaChanged, float, Normalized, bool, bExhausted);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnItemHeldChanged, USILIDItemData*, Item);

UCLASS()
class SILID_API ASILIDCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	ASILIDCharacter();

	// ------------------------------------------------------------- movement
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Movement|Speeds")
	float WalkSpeed = 220.f;   // cm/s - deliberate, weighty

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Movement|Speeds")
	float RunSpeed = 360.f;    // hold-to-run; loud (Noise.Run)

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Movement|Speeds")
	float SprintSpeed = 480.f; // stamina-gated; very loud

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Movement|Speeds")
	float CrouchSpeedFactor = 0.5f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Movement|Stamina", meta = (ClampMin = "1"))
	float MaxStaminaSeconds = 8.f; // sprint drain time

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Movement|Stamina")
	float StaminaRecoverPerSecond = 0.35f; // fraction of max per second

	UPROPERTY(BlueprintReadOnly, Category = "Movement|Stamina")
	float Stamina = 1.f;

	UPROPERTY(BlueprintReadOnly, Category = "Movement|Stamina")
	bool bExhausted = false;

	// ------------------------------------------------------------- components
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "SILID")
	TObjectPtr<UCameraComponent> FirstPersonCamera;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "SILID")
	TObjectPtr<USILIDFlashlightComponent> Flashlight;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "SILID")
	TObjectPtr<USILIDInventoryComponent> Inventory;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "SILID")
	TObjectPtr<USILIDHealthComponent> Health;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "SILID")
	TObjectPtr<USILIDNoiseEmitterComponent> NoiseEmitter;

	// ------------------------------------------------------------- interaction
	/** Focus trace distance (spec: interaction reach). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Interaction", meta = (ClampMin = "80"))
	float InteractionReach = 240.f;

	/** The currently focused interactable actor (null when none). */
	UPROPERTY(BlueprintReadOnly, Category = "Interaction")
	TObjectPtr<AActor> FocusedActor;

	UPROPERTY(BlueprintAssignable, Category = "Interaction")
	FOnFocusChanged OnFocusChanged;

	// ------------------------------------------------------------- held item
	/** Item shown/inspected/thrown (selected in inventory UI). */
	UPROPERTY(BlueprintReadOnly, Category = "Inventory")
	TObjectPtr<USILIDItemData> HeldItem;

	UPROPERTY(BlueprintAssignable, Category = "Inventory")
	FOnItemHeldChanged OnItemHeldChanged;

	// ------------------------------------------------------------- delegates
	UPROPERTY(BlueprintAssignable, Category = "Movement")
	FOnStaminaChanged OnStaminaChanged;

	// ------------------------------------------------------------- input API
	// The controller calls these; a designer BP could too.
	UFUNCTION(BlueprintCallable, Category = "SILID|Input") void Input_Move(const FVector2D& Axis);
	UFUNCTION(BlueprintCallable, Category = "SILID|Input") void Input_Look(const FVector2D& Axis);
	UFUNCTION(BlueprintCallable, Category = "SILID|Input") void Input_Run(bool bPressed);
	UFUNCTION(BlueprintCallable, Category = "SILID|Input") void Input_Sprint(bool bPressed);
	UFUNCTION(BlueprintCallable, Category = "SILID|Input") void Input_ToggleCrouch();
	UFUNCTION(BlueprintCallable, Category = "SILID|Input") void Input_Interact();
	UFUNCTION(BlueprintCallable, Category = "SILID|Input") void Input_Examine(bool bPressed);
	UFUNCTION(BlueprintCallable, Category = "SILID|Input") void Input_ToggleFlashlight();
	UFUNCTION(BlueprintCallable, Category = "SILID|Input") void Input_UseHeldItem();
	UFUNCTION(BlueprintCallable, Category = "SILID|Input") void Input_DropHeldItem();
	UFUNCTION(BlueprintCallable, Category = "SILID|Input") void Input_ThrowHeldItem();
	UFUNCTION(BlueprintCallable, Category = "SILID|Input") void Input_JumpPressed();

	// ------------------------------------------------------------- gameplay API
	UFUNCTION(BlueprintCallable, Category = "SILID|Interaction")
	void SetFocusActor(AActor* NewFocus);

	UFUNCTION(BlueprintCallable, Category = "SILID|Interaction")
	bool InteractWithFocused();

	UFUNCTION(BlueprintCallable, Category = "SILID|Inventory")
	void HoldItem(USILIDItemData* Item);

	/** Called by HideSpot actors when the player enters/exits hiding. */
	void SetHiding(AActor* HideSpotActor);

	UFUNCTION(BlueprintPure, Category = "SILID|Hiding")
	bool IsHiding() const { return HideSpot != nullptr; }

	/** True while the examine (Q) camera is up. */
	UFUNCTION(BlueprintPure, Category = "SILID|Interaction")
	bool IsExamining() const { return bExamining; }

	virtual void Tick(float DeltaTime) override;

	/** Show the interaction prompt target text (queried by UI). */
	UFUNCTION(BlueprintPure, Category = "SILID|Interaction")
	FText GetFocusedPromptText() const;

protected:
	virtual void BeginPlay() override;

private:
	/** Crouch toggle rather than hold (more comfortable on keyboard). */
	bool bWantsCrouch = false;
	bool bWantsRun = false;
	bool bWantsSprint = false;

	/** Hide spot currently occupied (null when not hiding). */
	UPROPERTY()
	TObjectPtr<AActor> HideSpot;

	bool bExamining = false;
	float ExamineBlend = 0.f;

	/** Footstep noise cadence. */
	float StepAccum = 0.f;

	void UpdateStamina(float DeltaTime);
	void UpdateMovementSpeed();
	void UpdateFocusTrace();
	void EmitFootstepNoise();
	void ThrowHeld();

	// save integration
	friend class USILIDSaveSubsystem;
};
