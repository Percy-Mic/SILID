// SILID class contract
// OWNS:         the ENTIRE power distribution state — the node graph
//               (DA_PowerGraph rows / tagged node actors), per-node powered
//               flags, the source state machines (generator/fusebox/breaker),
//               total vs. capacity watt math, the overload grace timer, and
//               the 1 Hz board tick (doc 01 §6: the one allowed new tick).
//               Doc 11 §1: "Power distribution / circuits —
//               UElectricalSystemSubsystem, subsystem API only."
// MAY WRITE:    only its own owned state above + registration bookkeeping.
//               Never writes device state (bDeviceEnabled belongs to the
//               ElectricPowered component) — devices REACT to state changes,
//               they are never driven (doc 05 §2 automatic-response gate).
// DEPENDS ON:   SILIDTags (Power.Node.*), the generator actor's
//               NoiseEmitterComponent (start/sputter/breaker events — upward
//               communication is events only, doc 11 §2), RepairComponent
//               (condition read + OnRepaired subscription — the P7 fix
//               input), USILIDSaveGame generic maps. Zero hard references
//               to rooms, doors, lights, or any specific prop (doc 05 §2:
//               "a new powered prop needs zero subsystem changes").
// EMITS:        OnNodePowerChanged (per-node), OnGeneratorStateChanged
//               (the machine), OnBreakerTripped (overload evidence). One
//               bus, many listeners — objectives/HUD/audio subscribe at
//               their phases without this file knowing them (doc 09 §9).
//
// P8 Electricity (doc 13 phase; design doc 05 §2 verbatim; type doc 12 §1
// WorldSubsystem; registration contract doc 12 §4; results doc 12 §6).
// Topology is exactly the spec's chain:
//   Generator → FuseBox → Breaker → Distribution nodes → Devices
// Source state machine: Off → NoFuel → NeedsRepair (condition 0–100, fixed
// via the P7 repair component) → Fueled → Running (brown-out flicker at low
// condition). Overload beyond a node's capacity trips the breaker after a
// grace period; a tripped breaker / blown fuse blackouts its subtree. Fuses
// are consumable items — replace-and-blown becomes resource pressure.
// Server-authoritative (doc 05 §2 replication note): clients mirror node
// state at P18+; cosmetic flicker is client-local.

#pragma once

#include "Subsystems/WorldSubsystem.h"
#include "GameplayTagContainer.h"
#include "Systems/SILIDTypes.h"
#include "SILIDElectricalSystemSubsystem.generated.h"

class USILIDElectricPoweredComponent;
class USILIDRepairComponent;
class USILIDNoiseEmitterComponent;
class USILIDSaveGame;
class AActor;

/** Machine state of the power SOURCE (the generator — doc 05 §2). */
UENUM(BlueprintType)
enum class ESILIDPowerSourceState : uint8
{
	Off         UMETA(DisplayName = "Off"),          // silent, produces nothing
	NoFuel      UMETA(DisplayName = "No Fuel"),      // intact but the tank is empty
	NeedsRepair UMETA(DisplayName = "Needs Repair"), // broken (repair component condition < 100)
	Fueled      UMETA(DisplayName = "Fueled"),       // ready — one start attempt from running
	Running     UMETA(DisplayName = "Running")       // producing power (brown-out at low condition)
};

/** One circuit node in the distribution tree (DA_PowerGraph row equivalent;
 * authored via RegisterNode or auto-created when a consumer registers). */
USTRUCT()
struct FSILIDPowerNode
{
	GENERATED_BODY()

	UPROPERTY()
	FGameplayTag NodeTag;

	/** Invalid = this is the source node (the generator side). */
	UPROPERTY()
	FGameplayTag ParentTag;

	/** Load budget; 0 = pass-through (fusebox/breaker links). */
	UPROPERTY()
	int32 CapacityWatts = 0;

	/** Fuse-protected node: blown fuse blackouts the subtree until replaced. */
	UPROPERTY()
	bool bFuseRequired = false;

	UPROPERTY()
	bool bFuseBlown = false;

	UPROPERTY()
	bool bBreakerTripped = false;

	/** Solved state — pushed to consumers and broadcast on change. */
	UPROPERTY()
	bool bPowered = false;

	/** Overload grace timer (world seconds when the overload began). */
	float OverloadSince = -1.f;

	/** Living watt draw: enabled consumers in this subtree. */
	int32 CurrentLoadWatts = 0;

	/** Registered consumers (doc 12 §4: BeginPlay registration, never searches). */
	UPROPERTY()
	TArray<TObjectPtr<USILIDElectricPoweredComponent>> Consumers;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnNodePowerChanged, FGameplayTag, NodeTag, bool, bPowered);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnGeneratorStateChanged, ESILIDPowerSourceState, NewState);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnBreakerTripped, FGameplayTag, NodeTag);

UCLASS()
class SILID_API UElectricalSystemSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	UElectricalSystemSubsystem();

	/** Node/graph authoring (DA_PowerGraph rows call this from a bootstrap
	 * actor's BeginPlay; consumers auto-create leaves if unauthored). */
	UFUNCTION(BlueprintCallable, Category = "Power")
	void RegisterNode(FGameplayTag NodeTag, FGameplayTag ParentTag, int32 CapacityWatts, bool bFuseRequired);

	/** The generator announces itself (its thin BP shell calls this in
	 * BeginPlay). The subsystem owns the machine state from here on. */
	UFUNCTION(BlueprintCallable, Category = "Power")
	void RegisterGenerator(AActor* GeneratorActor, FGameplayTag SourceNodeTag);

	/** Consumer registration (called by ElectricPowered BeginPlay/EndPlay). */
	void RegisterConsumer(FGameplayTag NodeTag, USILIDElectricPoweredComponent* Consumer);
	void UnregisterConsumer(USILIDElectricPoweredComponent* Consumer);

	/** A consumer's enabled-state/load changed (ElectricPowered calls this). */
	void NotifyLoadChanged(FGameplayTag NodeTag);

	// ---- commands (subsystem API only — doc 11 §1) ----

	/** Attempt a generator start (the generator's interact path).
	 * Fails with WHY: NeedsRepair / NoFuel. Running → stops it. */
	UFUNCTION(BlueprintCallable, Category = "Power")
	FSILIDOperationResult StartGenerator();

	/** Refill (the generator BP consumes the fuel item through the inventory
	 * API first, then reports it here — the subsystem never names items). */
	UFUNCTION(BlueprintCallable, Category = "Power")
	void AddFuel(int32 Units);

	/** Fuse replace / blow (the fusebox BP consumes the fuse item, then
	 * calls this; BreakMachine-style events can blow it). */
	UFUNCTION(BlueprintCallable, Category = "Power")
	void SetFuseBlown(FGameplayTag NodeTag, bool bBlown);

	/** Breaker reset (after an overload trip). */
	UFUNCTION(BlueprintCallable, Category = "Power")
	void ResetBreaker(FGameplayTag NodeTag);

	// ---- queries ----

	/** Is the node alive right now (source running, chain intact)? */
	UFUNCTION(BlueprintPure, Category = "Power")
	bool IsNodePowered(FGameplayTag NodeTag) const;

	UFUNCTION(BlueprintPure, Category = "Power")
	ESILIDPowerSourceState GetGeneratorState() const { return SourceState; }

	/** The generator actor (validator/HUD read-only use — the validator
	 * grounds the power chain in the graph on this actor). */
	UFUNCTION(BlueprintPure, Category = "Power")
	AActor* GetGeneratorActor() const { return GeneratorActor; }

	UFUNCTION(BlueprintPure, Category = "Power")
	int32 GetFuelUnits() const { return FuelUnits; }

	/** Living load on the node's subtree vs its capacity (HUD/debug). */
	UFUNCTION(BlueprintPure, Category = "Power")
	int32 GetNodeLoadWatts(FGameplayTag NodeTag) const;

	UFUNCTION(BlueprintPure, Category = "Power")
	int32 GetNodeCapacityWatts(FGameplayTag NodeTag) const;

	// ---- notifications (see EMITS in the header contract) ----
	UPROPERTY(BlueprintAssignable, Category = "Power")
	FOnNodePowerChanged OnNodePowerChanged;

	UPROPERTY(BlueprintAssignable, Category = "Power")
	FOnGeneratorStateChanged OnGeneratorStateChanged;

	UPROPERTY(BlueprintAssignable, Category = "Power")
	FOnBreakerTripped OnBreakerTripped;

	// ---- save plumbing (wired into the save walk at P22 — doc 14 P22;
	// the payload is the generic maps, replay-safe by node id) ----
	void SaveTo(USILIDSaveGame* SaveGame) const;
	void LoadFrom(const USILIDSaveGame* SaveGame);

	/** Debug: dump the graph + machine state (`SILID.Debug.Power`, doc 09 §10). */
	UFUNCTION(Exec)
	void SILID_Debug_Power();

	/** Generator is running but its condition is below the brown-out
	 * threshold (doc 05 §2) — presentation layers read this for flicker. */
	UFUNCTION(BlueprintPure, Category = "Power")
	bool IsBrownout() const;

	virtual bool ShouldCreateSubsystem(UObject* Outer) const override;

protected:
	virtual void OnWorldBeginPlay(UWorld& InWorld) override;
	virtual void Deinitialize() override;

private:
	/** The 1 Hz board (doc 01 §6: the one per-tick allowance in the game). */
	FTimerHandle BoardTimer;
	void BoardTick();

	/** Top-down availability solve + overload accounting + change fanout. */
	void SolvePower();

	/** Recompute CurrentLoadWatts per subtree (consumers + descendants). */
	int32 AccumulateLoad(FGameplayTag NodeTag);

	/** Top-down availability walk: chain/fuse/breaker checks + overload
	 * grace registration, then fanout of CHANGED states to consumers and
	 * child nodes (recursion — the doc 01 §6 one-delegate fanout). */
	void ApplyAvailability(FSILIDPowerNode& Node, bool bParentAlive);

	/** Overload grace elapsed → trip the breaker (loud, honest). */
	void TripBreaker(FGameplayTag NodeTag);

	FSILIDPowerNode* FindNode(FGameplayTag NodeTag);
	const FSILIDPowerNode* FindNode(FGameplayTag NodeTag) const;
	FSILIDPowerNode& FindOrAddNode(FGameplayTag NodeTag);

	/** Machine-state recompute after repair/fuel changes. */
	void RefreshGeneratorState();
	void SetGeneratorState(ESILIDPowerSourceState NewState);

	/** Start/sputter/breaker noises go out through the generator actor's own
	 * noise emitter — the subsystem never searches the world for one. */
	void EmitSourceNoise(float Loudness) const;

	/** The generator's repair component (weak — the actor owns it). */
	USILIDRepairComponent* GetGeneratorRepair() const;

	/** P7 OnRepaired delegate target (needs UFUNCTION for AddDynamic). */
	UFUNCTION()
	void OnGeneratorRepaired();

	// ---- owned state ----

	UPROPERTY()
	TMap<FGameplayTag, FSILIDPowerNode> PowerNodes;

	UPROPERTY()
	TObjectPtr<AActor> GeneratorActor;

	UPROPERTY()
	FGameplayTag SourceNodeTag;

	UPROPERTY()
	ESILIDPowerSourceState SourceState = ESILIDPowerSourceState::Off;

	/** Fuel economy (data-driven; the BP/config tunes the pressure). */
	UPROPERTY(EditDefaultsOnly, Category = "Power|Config", meta = (ClampMin = "0"))
	int32 MaxFuelUnits = 4;

	/** Units in the tank (saved). The subsystem owns fuel state — the
	 * generator BP spends items through the inventory API, then reports here. */
	UPROPERTY(BlueprintReadOnly, Category = "Power|Config", meta = (AllowPrivateAccess = "true"))
	int32 FuelUnits = 0;

	UPROPERTY(EditDefaultsOnly, Category = "Power|Config", meta = (ClampMin = "10.0"))
	float FuelDrainSeconds = 300.f;

	/** Overload grace before the breaker trips (doc 05 §2). */
	UPROPERTY(EditDefaultsOnly, Category = "Power|Config", meta = (ClampMin = "0.5", ClampMax = "30.0"))
	float OverloadGraceSeconds = 3.f;

	/** Generator condition below this = brown-out flicker (doc 05 §2). */
	UPROPERTY(EditDefaultsOnly, Category = "Power|Config", meta = (ClampMin = "10.0", ClampMax = "95.0"))
	float BrownoutConditionThreshold = 60.f;

	/** Loud start, sputter fail, breaker clack (doc 05 §2 risk/reward). */
	static constexpr float StartNoiseLoudness = 0.9f;
	static constexpr float SputterNoiseLoudness = 0.4f;
	static constexpr float BreakerNoiseLoudness = 0.6f;

	float FuelRuntimeAccumulator = 0.f;
};
