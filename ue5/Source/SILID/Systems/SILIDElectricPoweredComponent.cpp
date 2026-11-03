// ElectricPowered component implementation. The thin end of the P8 fanout:
// register the owner's load with the electrical subsystem by tag, re-broadcast
// the node's state to the owner's Blueprint. All power MATH lives in the
// subsystem (doc 11 §1 — this component never computes power).

#include "Systems/SILIDElectricPoweredComponent.h"
#include "Systems/SILIDElectricalSystemSubsystem.h"
#include "Engine/World.h"

USILIDElectricPoweredComponent::USILIDElectricPoweredComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

bool USILIDElectricPoweredComponent::IsPowered() const
{
	return bDeviceEnabled && IsNodePowered();
}

bool USILIDElectricPoweredComponent::IsNodePowered() const
{
	// the subsystem pushes every flip; the cached value is always current
	return Electrical && bLastNodePowered;
}

void USILIDElectricPoweredComponent::SetDeviceEnabled(bool bEnabled)
{
	if (bDeviceEnabled == bEnabled)
	{
		return;
	}
	bDeviceEnabled = bEnabled;

	// our contribution to the node's load changed — the subsystem re-solves
	if (Electrical && bRegistered)
	{
		Electrical->NotifyLoadChanged(PowerNode);
	}
}

void USILIDElectricPoweredComponent::NotifyNodePowerChanged(bool bNodePowered)
{
	// remember the node's state for cheap IsNodePowered() queries, then let
	// the debounce decide whether listeners hear anything
	bLastNodePowered = bNodePowered;
	BroadcastIfChanged();
}

void USILIDElectricPoweredComponent::BeginPlay()
{
	Super::BeginPlay();

	if (!PowerNode.IsValid())
	{
		// a powered component with no node is a config error, not a crash —
		// the device just never runs (spec §24: visible editor-time warn)
		SILID_WARN_CAT(LogSILIDElectricity, TEXT("[Power] %s has ElectricPowered with no PowerNode — device will never run."),
			GetOwner() ? *GetOwner()->GetName() : TEXT("null"));
		return;
	}

	UWorld* World = GetWorld();
	Electrical = World ? World->GetSubsystem<UElectricalSystemSubsystem>() : nullptr;
	if (!Electrical)
	{
		return;
	}

	if (bIsGenerator)
	{
		// the source side: the thin generator BP shell registers the machine;
		// the subsystem owns generator state from here on (doc 05 §2)
		Electrical->RegisterGenerator(GetOwner(), PowerNode);
	}
	else
	{
		Electrical->RegisterConsumer(PowerNode, this);
	}
	bRegistered = true;

	// initialize listeners with the current state (late join / map load)
	BroadcastIfChanged(true);
}

void USILIDElectricPoweredComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (Electrical && bRegistered)
	{
		Electrical->UnregisterConsumer(this);
	}
	Electrical = nullptr;
	bRegistered = false;

	Super::EndPlay(EndPlayReason);
}

void USILIDElectricPoweredComponent::BroadcastIfChanged(bool bForced)
{
	const bool bNow = IsPowered();
	if (bForced || bNow != bLastBroadcastPowered)
	{
		bLastBroadcastPowered = bNow;
		OnPowerChanged.Broadcast(bNow, PowerNode);
	}
}
