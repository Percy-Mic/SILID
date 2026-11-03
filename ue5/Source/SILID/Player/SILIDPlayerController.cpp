#include "Player/SILIDPlayerController.h"
#include "Player/SILIDCharacter.h"
#include "Systems/SILIDInventoryComponent.h"
#include "Systems/SILIDItemData.h"
#include "UI/SILIDHUDWidget.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputMappingContext.h"
#include "InputAction.h"
#include "InputActionValue.h"
#include "InputModifiers.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Logging/SILIDLog.h"

ASILIDPlayerController::ASILIDPlayerController()
{
	bShowMouseCursor = false;
}

ASILIDCharacter* ASILIDPlayerController::GetSILIDCharacter() const
{
	return Cast<ASILIDCharacter>(GetPawn());
}

void ASILIDPlayerController::ShowExamineText(const FText& Text)
{
	OnExamineRequested.Broadcast(Text);
}

void ASILIDPlayerController::SetPromptText(const FText& Text)
{
	OnPromptChanged.Broadcast(Text);
}

void ASILIDPlayerController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);

	// local player subsystem gets the mapping context
	if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
		ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer()))
	{
		Subsystem->ClearAllMappings();
		if (DefaultContext)
		{
			Subsystem->AddMappingContext(DefaultContext, 0);
		}
	}

	// prompt polling: focus text flows to the UI ~10x/sec (cheap)
	GetWorldTimerManager().SetTimer(PromptPollTimer, FTimerDelegate::CreateWeakLambda(this, [this]()
	{
		if (const ASILIDCharacter* Char = GetSILIDCharacter())
		{
			SetPromptText(Char->GetFocusedPromptText());
		}
	}), 0.1f, true);

	// inventory pushes rebuild the HUD slots whenever the contents change
	if (ASILIDCharacter* Char = Cast<ASILIDCharacter>(InPawn))
	{
		if (USILIDInventoryComponent* Inv = Char->FindComponentByClass<USILIDInventoryComponent>())
		{
			if (HUDWidget)
			{
				Inv->OnInventoryChanged.AddDynamic(HUDWidget, &USILIDHUDWidget::HandleInventoryChanged);
				HUDWidget->PushInventoryView();
			}
		}
	}
}

void ASILIDPlayerController::OnUnPossess()
{
	GetWorldTimerManager().ClearTimer(PromptPollTimer);
	Super::OnUnPossess();
}

void ASILIDPlayerController::BuildInputAssets()
{
	// ---- actions ----
	auto MakeAction = [this](EInputActionValueType Type, bool bConsume = true) -> UInputAction*
	{
		UInputAction* Action = NewObject<UInputAction>(this);
		Action->ValueType = Type;
		Action->bConsumeInput = bConsume;
		return Action;
	};

	IA_Move      = MakeAction(EInputActionValueType::Axis2D);
	IA_Look      = MakeAction(EInputActionValueType::Axis2D);
	IA_Run       = MakeAction(EInputActionValueType::Boolean);
	IA_Sprint    = MakeAction(EInputActionValueType::Boolean);
	IA_Crouch    = MakeAction(EInputActionValueType::Boolean);
	IA_Interact  = MakeAction(EInputActionValueType::Boolean);
	IA_Examine   = MakeAction(EInputActionValueType::Boolean);
	IA_Flashlight= MakeAction(EInputActionValueType::Boolean);
	IA_UseItem   = MakeAction(EInputActionValueType::Boolean);
	IA_Drop      = MakeAction(EInputActionValueType::Boolean);
	IA_Throw     = MakeAction(EInputActionValueType::Boolean);
	IA_Journal   = MakeAction(EInputActionValueType::Boolean);

	// look gets an inverse-patch-free modifier set built via keys
	// (modifiers created natively: Negate for Y handled below in HandleLook)

	// ---- mapping context ----
	DefaultContext = NewObject<UInputMappingContext>(this);

	// MapKey returns the live mapping; attach modifiers to it directly.
	auto Map = [this](UInputAction* Action, FKey Key)
	{
		DefaultContext->MapKey(Action, Key);
	};
	auto MapSwizzled = [this](UInputAction* Action, FKey Key, EInputAxisSwizzle Order)
	{
		FEnhancedActionKeyMapping& Mapping = DefaultContext->MapKey(Action, Key);
		UInputModifierSwizzleAxis* Swizzle = NewObject<UInputModifierSwizzleAxis>(this);
		Swizzle->Order = Order;
		Mapping.Modifiers.Add(Swizzle);
	};

	// movement (WASD) — W/S drive the Y axis, A/D the X axis
	Map(IA_Move, EKeys::W);
	MapSwizzled(IA_Move, EKeys::S, EInputAxisSwizzle::YXZ); // S = -Y
	MapSwizzled(IA_Move, EKeys::A, EInputAxisSwizzle::YXZ); // A = -X
	Map(IA_Move, EKeys::D);

	// look (mouse) — Mouse2D feeds the Axis2D action; Y inversion in HandleLook
	Map(IA_Look, EKeys::Mouse2D);

	// buttons
	Map(IA_Run,        EKeys::LeftShift);
	Map(IA_Sprint,     EKeys::LeftControl);
	Map(IA_Crouch,     EKeys::C);
	Map(IA_Interact,   EKeys::E);
	Map(IA_Examine,    EKeys::Q);
	Map(IA_Flashlight, EKeys::F);
	Map(IA_UseItem,    EKeys::LeftMouseButton);
	Map(IA_Throw,      EKeys::RightMouseButton);
	Map(IA_Drop,       EKeys::G);
	Map(IA_Journal,    EKeys::Tab);
}

void ASILIDPlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();

	BuildInputAssets();

	UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(InputComponent);
	if (!EIC)
	{
		SILID_ERROR_CAT(LogSILID, TEXT("InputComponent is not EnhancedInput - check DefaultInputComponentClass"));
		return;
	}

	EIC->BindAction(IA_Move,       ETriggerEvent::Triggered, this, &ASILIDPlayerController::HandleMove);
	EIC->BindAction(IA_Look,       ETriggerEvent::Triggered, this, &ASILIDPlayerController::HandleLook);
	EIC->BindAction(IA_Run,        ETriggerEvent::Started,   this, &ASILIDPlayerController::HandleRun);
	EIC->BindAction(IA_Run,        ETriggerEvent::Completed, this, &ASILIDPlayerController::HandleRun);
	EIC->BindAction(IA_Sprint,     ETriggerEvent::Started,   this, &ASILIDPlayerController::HandleSprint);
	EIC->BindAction(IA_Sprint,     ETriggerEvent::Completed, this, &ASILIDPlayerController::HandleSprint);
	EIC->BindAction(IA_Crouch,     ETriggerEvent::Triggered, this, &ASILIDPlayerController::HandleCrouch);
	EIC->BindAction(IA_Interact,   ETriggerEvent::Triggered, this, &ASILIDPlayerController::HandleInteract);
	EIC->BindAction(IA_Examine,    ETriggerEvent::Started,   this, &ASILIDPlayerController::HandleExamine);
	EIC->BindAction(IA_Examine,    ETriggerEvent::Completed, this, &ASILIDPlayerController::HandleExamine);
	EIC->BindAction(IA_Flashlight, ETriggerEvent::Triggered, this, &ASILIDPlayerController::HandleFlashlight);
	EIC->BindAction(IA_UseItem,    ETriggerEvent::Triggered, this, &ASILIDPlayerController::HandleUseItem);
	EIC->BindAction(IA_Drop,       ETriggerEvent::Triggered, this, &ASILIDPlayerController::HandleDrop);
	EIC->BindAction(IA_Throw,      ETriggerEvent::Triggered, this, &ASILIDPlayerController::HandleThrow);
	EIC->BindAction(IA_Journal,    ETriggerEvent::Triggered, this, &ASILIDPlayerController::HandleJournal);
}

// ------------------------------------------------------------- handlers
void ASILIDPlayerController::HandleMove(const FInputActionValue& Value)
{
	if (ASILIDCharacter* Char = GetSILIDCharacter())
	{
		Char->Input_Move(Value.Get<FVector2D>());
	}
}

void ASILIDPlayerController::HandleLook(const FInputActionValue& Value)
{
	if (ASILIDCharacter* Char = GetSILIDCharacter())
	{
		FVector2D Axis = Value.Get<FVector2D>();
		Axis.X *= MouseSensitivity;
		Axis.Y *= MouseSensitivity;
		Char->Input_Look(Axis);
	}
}

void ASILIDPlayerController::HandleRun(const FInputActionValue& Value)
{
	if (ASILIDCharacter* Char = GetSILIDCharacter())
	{
		Char->Input_Run(Value.Get<bool>());
	}
}

void ASILIDPlayerController::HandleSprint(const FInputActionValue& Value)
{
	if (ASILIDCharacter* Char = GetSILIDCharacter())
	{
		Char->Input_Sprint(Value.Get<bool>());
	}
}

void ASILIDPlayerController::HandleCrouch()
{
	if (ASILIDCharacter* Char = GetSILIDCharacter())
	{
		Char->Input_ToggleCrouch();
	}
}

void ASILIDPlayerController::HandleInteract()
{
	if (ASILIDCharacter* Char = GetSILIDCharacter())
	{
		Char->Input_Interact();
	}
}

void ASILIDPlayerController::HandleExamine(const FInputActionValue& Value)
{
	if (ASILIDCharacter* Char = GetSILIDCharacter())
	{
		Char->Input_Examine(Value.Get<bool>());
	}
}

void ASILIDPlayerController::HandleFlashlight()
{
	if (ASILIDCharacter* Char = GetSILIDCharacter())
	{
		Char->Input_ToggleFlashlight();
	}
}

void ASILIDPlayerController::HandleUseItem()
{
	if (ASILIDCharacter* Char = GetSILIDCharacter())
	{
		Char->Input_UseHeldItem();
	}
}

void ASILIDPlayerController::HandleDrop()
{
	if (ASILIDCharacter* Char = GetSILIDCharacter())
	{
		Char->Input_DropHeldItem();
	}
}

void ASILIDPlayerController::HandleThrow()
{
	if (ASILIDCharacter* Char = GetSILIDCharacter())
	{
		Char->Input_ThrowHeldItem();
	}
}

void ASILIDPlayerController::HandleJournal()
{
	// UI opens the journal (HUD listens for this through the widget system)
	// Phase 2 hook: broadcast via HUD widget when journal exists.
}
