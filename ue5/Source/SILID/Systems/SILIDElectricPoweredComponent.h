// SILID class contract
// OWNS:         one prop's powered-membership data — which Power.Node it
//               hangs on, its watt load, whether it wants power right now
// MAY WRITE:    only its own registration + desired state. The POWER STATE
//               itself is owned by UElectricalSystemSubsystem (doc 11 §1:
//               power distribution = subsystem API only); this component
//               observes and re-broadcasts, it never computes power.
// DEPENDS ON:   UElectricalSystemSubsystem (register/unregister + query —
//               downward L4 call), GameplayTags. Never touches other props,
//               the generator, or lights directly — reactions are wired by
//               the owner's Blueprint/state code observing OnPowerChanged.
// EMITS:        OnPowerChanged (bPowered, node tag) — the one delegate the
//               doc 05 §2 fanout law is built on. Zero cross-references
//               between props and the power subsystem (doc 01 §6).
//
// P8 Electricity consumer side (doc 09 §3 USILIDElectricPoweredComponent;
// design doc 05 §2, registration contract doc 12 §4). Composition law:
// BP_Light = LightSwitch + ElectricPowered(Node=Power.Node.House.Sala);
// BP_CCTV  = SceneCapture + ElectricPowered(Node=Power.Node.House.Security).
// A NEW powered prop needs zero subsystem changes (doc 12 §11 acceptance
// bar). The GENERATOR is also composed, not subclassed: its thin BP shell
// carries ElectricPowered with bIsGenerator = true and calls
// StartGenerator() from Interact — there is no C++ generator actor class
// (doc 09 §3 composition law).
// Server-authoritative; the load joins the node's watt sum on the server,
// clients mirror state via the subsystem's replicated events (P18+).

#pragma once

#include "Components/ActorComponent.h"
#include "GameplayTagContainer.h"
#include "SILIDElectricPoweredComponent.generated.h"

class UElectricalSystemSubsystem;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnPowerChanged, bool, bPowered, FGameplayTag, NodeTag);

UCLASS(ClassGroup = (SILID), meta = (BlueprintSpawnableComponent))
class SILID_API USILIDElectricPoweredComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	USILIDElectricPoweredComponent();

	// ---- configuration (data — this is the whole contract for a new prop) ----

	/** Which circuit node this device hangs on (Power.Node.*). The node must
	 * exist in the subsystem's graph (DA_PowerGraph rows / tagged node actors),
	 * or the device stays unpowered with a warn. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Power")
	FGameplayTag PowerNode;

	/** Load contributed to the node's watt sum while powered and enabled. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Power", meta = (ClampMin = "0", ClampMax = "10000"))
	int32 LoadWatts = 60;

	/** The device's own on/off wish (a switch, an enabled flag). Power AND
	 * this = the device actually runs. The component owns this wish; the
	 * subsystem never writes it. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Power")
	bool bDeviceEnabled = true;

	/** True only on the GENERATOR's own component: BeginPlay registers the
	 * source machine (RegisterGenerator) instead of a consumer load. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Power|Generator")
	bool bIsGenerator = false;

	/** Fired whenever the node's powered state flips (and once on registration
	 * so late listeners initialize correctly). */
	UPROPERTY(BlueprintAssignable, Category = "Power")
	FOnPowerChanged OnPowerChanged;

	// ---- queries ----

	/** Is the node alive AND this device enabled? The single "do I run" check. */
	UFUNCTION(BlueprintPure, Category = "Power")
	bool IsPowered() const;

	/** The last powered state the subsystem reported for our node. */
	UFUNCTION(BlueprintPure, Category = "Power")
	bool IsNodePowered() const;

	// ---- commands ----

	/** Set the device's own wish (switch flip, enabled flag). Re-evaluates
	 * the load contribution; does NOT touch the node's state. */
	UFUNCTION(BlueprintCallable, Category = "Power")
	void SetDeviceEnabled(bool bEnabled);

	/** PUSH path (called by UElectricalSystemSubsystem when the node's state
	 * flips — consumers never poll, doc 01 §6). Re-broadcasts OnPowerChanged
	 * with bPowered = bDeviceEnabled && bNodePowered. */
	void NotifyNodePowerChanged(bool bNodePowered);

	// ---- registration (doc 12 §4 law: BeginPlay/EndPlay, never searches) ----
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	/** Cached subsystem pointer (valid for our lifetime; cleared in EndPlay). */
	UPROPERTY(Transient)
	TObjectPtr<UElectricalSystemSubsystem> Electrical;

	/** Last node state pushed by the subsystem (cheap queries, no polling). */
	bool bLastNodePowered = false;

	/** Last state broadcast (avoid spamming OnPowerChanged with no-ops). */
	bool bLastBroadcastPowered = false;

	bool bRegistered = false;

	void BroadcastIfChanged(bool bForced = false);
};
