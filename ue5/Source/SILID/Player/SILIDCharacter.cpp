#include "Player/SILIDCharacter.h"
#include "Player/SILIDPlayerController.h"
#include "Systems/SILIDFlashlightComponent.h"
#include "Systems/SILIDInventoryComponent.h"
#include "Systems/SILIDHealthComponent.h"
#include "Systems/SILIDNoiseEmitterComponent.h"
#include "Systems/SILIDItemData.h"
#include "Systems/SILIDInterfaces.h"
#include "Systems/SILIDTags.h"
#include "Systems/SILIDDifficultySubsystem.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "Engine/World.h"
#include "Logging/SILIDLog.h"

ASILIDCharacter::ASILIDCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

	// capsule sized for a Filipino average; slightly slim for corridor feel
	GetCapsuleComponent()->InitCapsuleSize(32.f, 88.f);

	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = true;   // classic horror FPS: body follows view
	bUseControllerRotationRoll = false;

	GetCharacterMovement()->bOrientRotationToMovement = false;
	GetCharacterMovement()->MaxWalkSpeed = WalkSpeed;
	GetCharacterMovement()->MaxWalkSpeedCrouched = WalkSpeed * CrouchSpeedFactor;
	GetCharacterMovement()->BrakingDecelerationWalking = 900.f; // weighty stops
	GetCharacterMovement()->SetWalkableFloorAngle(46.f);
	GetCharacterMovement()->NavAgentProps.bCanCrouch = true;
	GetCharacterMovement()->bCanWalkOffLedgesWhenCrouching = true;

	// camera
	FirstPersonCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FirstPersonCamera"));
	FirstPersonCamera->SetupAttachment(GetMesh()); // animBP drives head (or root bone)
	FirstPersonCamera->SetRelativeLocation(FVector(0.f, 0.f, 62.f));
	FirstPersonCamera->bUsePawnControlRotation = true;
	FirstPersonCamera->FieldOfView = 75.f;

	// gameplay components
	Flashlight = CreateDefaultSubobject<USILIDFlashlightComponent>(TEXT("Flashlight"));
	Inventory = CreateDefaultSubobject<USILIDInventoryComponent>(TEXT("Inventory"));
	Health = CreateDefaultSubobject<USILIDHealthComponent>(TEXT("Health"));
	NoiseEmitter = CreateDefaultSubobject<USILIDNoiseEmitterComponent>(TEXT("NoiseEmitter"));
}

void ASILIDCharacter::BeginPlay()
{
	Super::BeginPlay();

	if (USILIDDifficultySubsystem* Diff = USILIDDifficultySubsystem::Get(this))
	{
		// difficulty tweaks player-side resources: stamina pool scales slightly
		MaxStaminaSeconds /= FMath::Max(0.6f, Diff->GetResourceMultiplier());
		Stamina = 1.f;
	}
}

void ASILIDCharacter::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	UpdateStamina(DeltaTime);
	UpdateMovementSpeed();
	UpdateFocusTrace();

	// footstep noise cadence tied to actual movement (spec section 8)
	if (UCharacterMovementComponent* CMC = GetCharacterMovement())
	{
		const float Speed2D = CMC->Velocity.Size2D();
		if (Speed2D > 20.f && !IsHiding())
		{
			StepAccum += Speed2D * DeltaTime;
			const float StepDistance = bWantsSprint && Stamina > 0.05f ? 165.f
				: (bWantsRun ? 150.f : 135.f);
			if (StepAccum >= StepDistance)
			{
				StepAccum = 0.f;
				EmitFootstepNoise();
			}
		}
		else
		{
			StepAccum = 0.f;
		}
	}

	// examine camera blend (hold Q)
	if (bExamining && FirstPersonCamera)
	{
		ExamineBlend = FMath::Min(1.f, ExamineBlend + DeltaTime * 4.f);
		FirstPersonCamera->FieldOfView = FMath::Lerp(75.f, 48.f, ExamineBlend); // zoom inspect
	}
	else if (ExamineBlend > 0.f && FirstPersonCamera)
	{
		ExamineBlend = FMath::Max(0.f, ExamineBlend - DeltaTime * 4.f);
		FirstPersonCamera->FieldOfView = FMath::Lerp(75.f, 48.f, ExamineBlend);
	}
}

// ---------------------------------------------------------------- movement
void ASILIDCharacter::Input_Move(const FVector2D& Axis)
{
	if (IsHiding() || !Controller)
	{
		return; // hiding restricts movement (spec section 10)
	}
	const FRotator YawOnly(0.f, Controller->GetControlRotation().Yaw, 0.f);
	AddMovementInput(YawOnly.RotateVector(FVector::ForwardVector), Axis.Y);
	AddMovementInput(YawOnly.RotateVector(FVector::RightVector), Axis.X);
}

void ASILIDCharacter::Input_Look(const FVector2D& Axis)
{
	if (IsHiding())
	{
		return; // hide spots lock the view to their camera (spec section 10)
	}
	AddControllerYawInput(Axis.X);
	AddControllerPitchInput(Axis.Y);
}

void ASILIDCharacter::Input_Run(bool bPressed)
{
	bWantsRun = bPressed;
	UpdateMovementSpeed();
}

void ASILIDCharacter::Input_Sprint(bool bPressed)
{
	bWantsSprint = bPressed;
	UpdateMovementSpeed();
}

void ASILIDCharacter::Input_ToggleCrouch()
{
	bWantsCrouch = !bWantsCrouch;
	UnCrouch();
	if (bWantsCrouch)
	{
		Crouch();
	}
	UpdateMovementSpeed();
}

void ASILIDCharacter::Input_JumpPressed()
{
	// "jumping where appropriate" - old nipa floors: no jumping. Kept as API.
	// Spec section 4 leaves this conditional; we choose grounded horror.
}

void ASILIDCharacter::UpdateStamina(float DeltaTime)
{
	const bool bSprintingNow = bWantsSprint
		&& GetCharacterMovement()
		&& GetCharacterMovement()->Velocity.Size2D() > 40.f
		&& !bExhausted;

	if (bSprintingNow)
	{
		Stamina = FMath::Max(0.f, Stamina - DeltaTime / FMath::Max(1.f, MaxStaminaSeconds));
		if (Stamina <= 0.f)
		{
			bExhausted = true;
		}
	}
	else
	{
		Stamina = FMath::Min(1.f, Stamina + StaminaRecoverPerSecond * DeltaTime);
		if (bExhausted && Stamina > 0.35f)
		{
			bExhausted = false;
		}
	}

	static float LastSent = -1.f;
	if (FMath::Abs(Stamina - LastSent) > 0.02f || Stamina == 0.f || Stamina == 1.f)
	{
		LastSent = Stamina;
		OnStaminaChanged.Broadcast(Stamina, bExhausted);
	}
}

void ASILIDCharacter::UpdateMovementSpeed()
{
	float Target = WalkSpeed;
	if (bWantsSprint && !bExhausted && Stamina > 0.05f)
	{
		Target = SprintSpeed;
	}
	else if (bWantsRun)
	{
		Target = RunSpeed;
	}
	if (bIsCrouched)
	{
		Target *= CrouchSpeedFactor;
	}
	if (IsHiding())
	{
		Target = 0.f;
	}
	GetCharacterMovement()->MaxWalkSpeed = Target;
}

void ASILIDCharacter::EmitFootstepNoise()
{
	if (!NoiseEmitter)
	{
		return;
	}
	// louder when running/sprinting; crouching is near-silent
	float Loudness = 0.35f;
	FGameplayTag Tag = SILIDTags::NoiseFootstep;
	if (bWantsSprint && Stamina > 0.05f)
	{
		Loudness = 0.85f;
		Tag = SILIDTags::NoiseRun;
	}
	else if (bWantsRun)
	{
		Loudness = 0.6f;
	}
	if (bIsCrouched)
	{
		Loudness *= 0.4f;
	}
	NoiseEmitter->EmitNoise(FVector(Loudness, 0, 0), Tag);
}

// ------------------------------------------------------------- interaction
void ASILIDCharacter::UpdateFocusTrace()
{
	if (!GetWorld() || IsHiding())
	{
		SetFocusActor(nullptr);
		return;
	}

	const FVector Start = FirstPersonCamera ? FirstPersonCamera->GetComponentLocation() : GetActorLocation();
	const FVector Dir = FirstPersonCamera ? FirstPersonCamera->GetForwardVector() : GetActorForwardVector();

	FCollisionQueryParams Params(SCENE_QUERY_STAT(SILIDFocus), /*bTraceComplex*/ false);
	Params.AddIgnoredActor(this);

	FHitResult Hit;
	AActor* NewFocus = nullptr;
	if (GetWorld()->LineTraceSingleByChannel(Hit, Start, Start + Dir * InteractionReach, ECC_Visibility, Params))
	{
		AActor* HitActor = Hit.GetActor();
		// walk up to the owner in case we hit a sub-component mesh
		while (HitActor && !HitActor->Implements<USILIDInteractable>() && HitActor->GetOwner())
		{
			HitActor = HitActor->GetOwner();
		}
		if (HitActor && HitActor->Implements<USILIDInteractable>())
		{
			NewFocus = HitActor;
		}
	}

	if (NewFocus != FocusedActor)
	{
		SetFocusActor(NewFocus);
	}
}

void ASILIDCharacter::SetFocusActor(AActor* NewFocus)
{
	AActor* Previous = FocusedActor;
	if (Previous == NewFocus)
	{
		return;
	}

	if (Previous && Previous->Implements<USILIDInteractable>())
	{
		ISILIDInteractable::Execute_OnUnfocus(Previous);
	}

	FocusedActor = NewFocus;

	if (FocusedActor && FocusedActor->Implements<USILIDInteractable>())
	{
		ISILIDInteractable::Execute_OnFocus(FocusedActor);
	}

	OnFocusChanged.Broadcast(FocusedActor, Previous);
}

bool ASILIDCharacter::InteractWithFocused()
{
	if (!FocusedActor || !FocusedActor->Implements<USILIDInteractable>())
	{
		return false;
	}
	if (!ISILIDInteractable::Execute_CanInteract(FocusedActor, this))
	{
		return false;
	}
	return ISILIDInteractable::Execute_Interact(FocusedActor, this);
}

FText ASILIDCharacter::GetFocusedPromptText() const
{
	if (IsHiding())
	{
		return NSLOCTEXT("SILID", "LeaveHide", "Leave hiding");
	}
	if (FocusedActor && FocusedActor->Implements<USILIDInteractable>())
	{
		return ISILIDInteractable::Execute_GetInteractionText(FocusedActor, this);
	}
	return FText::GetEmpty();
}

// ------------------------------------------------------------------ inputs
void ASILIDCharacter::Input_Interact()
{
	if (IsHiding())
	{
		// E while hiding leaves the spot
		if (HideSpot && HideSpot->Implements<USILIDInteractable>())
		{
			ISILIDInteractable::Execute_Interact(HideSpot, this);
		}
		return;
	}
	InteractWithFocused();
}

void ASILIDCharacter::Input_Examine(bool bPressed)
{
	bExamining = bPressed;
	if (bPressed && FocusedActor && FocusedActor->Implements<USILIDInteractable>())
	{
		// examination text surfaces through the UI delegate system
		const FText Text = ISILIDInteractable::Execute_GetExamineText(FocusedActor, this);
		if (!Text.IsEmpty() && Controller)
		{
			if (ASILIDPlayerController* PC = Cast<ASILIDPlayerController>(Controller))
			{
				PC->ShowExamineText(Text);
			}
		}
	}
}

void ASILIDCharacter::Input_ToggleFlashlight()
{
	if (Flashlight)
	{
		Flashlight->Toggle();
	}
}

void ASILIDCharacter::HoldItem(USILIDItemData* Item)
{
	HeldItem = Item;
	OnItemHeldChanged.Broadcast(HeldItem);
}

void ASILIDCharacter::Input_UseHeldItem()
{
	if (!HeldItem)
	{
		return;
	}
	// prefer using on the focused object (keys on doors, fuses on boxes)
	if (FocusedActor && FocusedActor->Implements<USILIDInteractable>())
	{
		if (ISILIDInteractable::Execute_UseItem(FocusedActor, this, Inventory))
		{
			return;
		}
	}
	// otherwise consume/use on self (battery, medicine)
	if (HeldItem->ItemType == EItemType::Consumable && Inventory)
	{
		if (HeldItem->ItemId == FName("item.battery") && Flashlight)
		{
			Flashlight->AddBatteryCharge(Flashlight->MaxBatterySeconds * 0.5f);
			Inventory->RemoveItem(HeldItem);
			if (!Inventory->HasItem(HeldItem->ItemId))
			{
				HoldItem(nullptr);
			}
		}
	}
}

void ASILIDCharacter::Input_DropHeldItem()
{
	if (!HeldItem || !Inventory)
	{
		return;
	}
	const FVector Drop = GetActorLocation() + GetActorForwardVector() * 80.f;
	Inventory->DropItem(HeldItem->ItemId, Drop, GetActorRotation());
	HoldItem(nullptr);
}

void ASILIDCharacter::Input_ThrowHeldItem()
{
	ThrowHeld();
}

void ASILIDCharacter::ThrowHeld()
{
	// throwing is a distraction tool (spec section 7: "if the player throws
	// an object, the Resident should hear the impact and investigate")
	if (!HeldItem || !Inventory)
	{
		return;
	}
	USILIDItemData* Item = HeldItem;
	Inventory->RemoveItem(Item);
	HoldItem(nullptr);

	if (USILIDNoiseEmitterComponent* TempEmitter = NewObject<USILIDNoiseEmitterComponent>(this))
	{
		TempEmitter->RegisterComponent();
		FTimerHandle Handle;
		FVector Target = GetActorLocation() + GetActorForwardVector() * 900.f;
		GetWorldTimerManager().SetTimer(Handle, FTimerDelegate::CreateWeakLambda(TempEmitter, [TempEmitter, Target]()
		{
			TempEmitter->EmitNoise(FVector(0.75f, 0, 0), SILIDTags::NoiseImpact, Target);
			TempEmitter->DestroyComponent();
		}), 1.2f, false);
	}
}

// ------------------------------------------------------------------ hiding
void ASILIDCharacter::SetHiding(AActor* HideSpotActor)
{
	HideSpot = HideSpotActor;

	if (HideSpot)
	{
		// muffled self (spec section 10): crouch state + zeroed speed
		GetCharacterMovement()->MaxWalkSpeed = 0.f;
		if (NoiseEmitter)
		{
			NoiseEmitter->SetComponentTickEnabled(false);
		}
	}
	else
	{
		if (NoiseEmitter)
		{
			NoiseEmitter->SetComponentTickEnabled(true);
		}
		UpdateMovementSpeed();
	}
}
