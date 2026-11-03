// Light switch implementation.

#include "Props/SILIDLightSwitch.h"
#include "Systems/SILIDNoiseEmitterComponent.h"
#include "Systems/SILIDElectricPoweredComponent.h"
#include "Systems/SILIDSaveGame.h"
#include "Systems/SILIDTags.h"
#include "Player/SILIDCharacter.h"
#include "Components/LightComponent.h"

ASILIDLightSwitch::ASILIDLightSwitch()
{
	PrimaryActorTick.bCanEverTick = false;

	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	NoiseEmitter = CreateDefaultSubobject<USILIDNoiseEmitterComponent>(TEXT("NoiseEmitter"));
	bOn = bStartOn;
}

void ASILIDLightSwitch::BeginPlay()
{
	Super::BeginPlay();

	// the BP attaches ElectricPowered; the C++ finds it (composition law:
	// the actor never creates another actor's component, it discovers its own)
	Powered = FindComponentByClass<USILIDElectricPoweredComponent>();
	if (Powered)
	{
		Powered->OnPowerChanged.AddUniqueDynamic(this, &ASILIDLightSwitch::HandlePowerChanged);
	}
	ApplyState();
}

bool ASILIDLightSwitch::Interact(ASILIDCharacter* Player)
{
	bOn = !bOn;

	// the wish lives on the powered component (it owns bDeviceEnabled); the
	// switch mirrors it for its own state. With no Powered component the
	// legacy behavior stands (unconverted BPs keep working).
	if (Powered)
	{
		Powered->SetDeviceEnabled(bOn);
	}
	ApplyState();

	if (NoiseEmitter)
	{
		NoiseEmitter->EmitNoise(FVector(0.25f, 0, 0), SILIDTags::NoiseDevice, GetActorLocation());
	}
	return true;
}

FText ASILIDLightSwitch::GetInteractionText(const ASILIDCharacter* Player) const
{
	if (IsDeadCircuit())
	{
		return bOn ? FText::FromString(TEXT("It clicks. Nothing."))
		           : FText::FromString(TEXT("E — Lights on"));
	}
	return bOn ? FText::FromString(TEXT("E — Lights off")) : FText::FromString(TEXT("E — Lights on"));
}

FText ASILIDLightSwitch::GetExamineText(const ASILIDCharacter* Player) const
{
	if (IsDeadCircuit())
	{
		return FText::FromString(TEXT("The switch has power in it, or should. The circuit is dead."));
	}
	return FText::GetEmpty();
}

bool ASILIDLightSwitch::IsDeadCircuit() const
{
	return Powered && bOn && !Powered->IsPowered();
}

void ASILIDLightSwitch::HandlePowerChanged(bool bPowered, FGameplayTag NodeTag)
{
	// the node flipped: re-evaluate the lights (the "lights died" beat)
	ApplyState();
}

void ASILIDLightSwitch::ApplyState()
{
	// POWER AND wish: the switch's on-state alone can never light a dead room
	const bool bShouldLight = bOn && (!Powered || Powered->IsPowered());
	for (ULightComponent* Light : ControlledLights)
	{
		if (Light)
		{
			Light->SetVisibility(bShouldLight);
		}
	}
}

FString ASILIDLightSwitch::GetSaveId() const
{
	return SaveIdName.IsValid() ? SaveIdName.ToString() : FString::Printf(TEXT("Switch_%s"), *GetName());
}

void ASILIDLightSwitch::OnSave(USILIDSaveGame* SaveGame)
{
	if (SaveGame)
	{
		SaveGame->Flags.Add(GetSaveId(), bOn);
	}
}

void ASILIDLightSwitch::OnLoad(const USILIDSaveGame* SaveGame)
{
	if (SaveGame)
	{
		const bool* Found = SaveGame->Flags.Find(GetSaveId());
		bOn = Found ? *Found : bStartOn;
		ApplyState();
	}
}
