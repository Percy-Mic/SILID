// Electrical subsystem implementation. THE owner of power state (doc 11 §1).
// Everything flows through SolvePower(): a top-down availability walk that
// recomputes loads, checks capacities/breakers/fuses, and fans out only the
// CHANGED node states to consumers (doc 01 §6 — one delegate, zero polling).
// The 1 Hz board tick is the game's one new tick, allowed by doc 01 §6 and
// answered in the feature-spec block (doc 14 §11).

#include "Systems/SILIDElectricalSystemSubsystem.h"
#include "Systems/SILIDElectricPoweredComponent.h"
#include "Systems/SILIDRepairComponent.h"
#include "Systems/SILIDNoiseEmitterComponent.h"
#include "Systems/SILIDTags.h"
#include "Systems/SILIDSaveGame.h"
#include "Logging/SILIDLog.h"
#include "Engine/World.h"
#include "TimerManager.h"

UElectricalSystemSubsystem::UElectricalSystemSubsystem()
{
	// the board tick drives everything; no other loop exists in the system
}

bool UElectricalSystemSubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
	// game/PIE worlds only (same gate as the validator)
	if (const UWorld* World = Cast<UWorld>(Outer))
	{
		return World->WorldType == EWorldType::Game || World->WorldType == EWorldType::PIE;
	}
	return false;
}

void UElectricalSystemSubsystem::OnWorldBeginPlay(UWorld& InWorld)
{
	Super::OnWorldBeginPlay(InWorld);

	// the 1 Hz board (doc 01 §6). Timer-based, not a component tick — the
	// subsystem itself never Ticks, so idle rooms cost nothing.
	InWorld.GetTimerManager().SetTimer(BoardTimer, this, &UElectricalSystemSubsystem::BoardTick, 1.0f, true);
}

void UElectricalSystemSubsystem::Deinitialize()
{
	if (UWorld* World = GetWorld())
	{
		World->GetTimerManager().ClearTimer(BoardTimer);
	}
	Super::Deinitialize();
}

// ------------------------------- node helpers -------------------------------
FSILIDPowerNode* UElectricalSystemSubsystem::FindNode(FGameplayTag NodeTag)
{
	return PowerNodes.Find(NodeTag);
}

const FSILIDPowerNode* UElectricalSystemSubsystem::FindNode(FGameplayTag NodeTag) const
{
	return PowerNodes.Find(NodeTag);
}

FSILIDPowerNode& UElectricalSystemSubsystem::FindOrAddNode(FGameplayTag NodeTag)
{
	FSILIDPowerNode* Found = PowerNodes.Find(NodeTag);
	if (!Found)
	{
		FSILIDPowerNode Node;
		Node.NodeTag = NodeTag;
		Found = &PowerNodes.Add(NodeTag, Node);
	}
	return *Found;
}

// ------------------------------- registration -------------------------------
void UElectricalSystemSubsystem::RegisterNode(FGameplayTag NodeTag, FGameplayTag ParentTag, int32 CapacityWatts, bool bFuseRequired)
{
	if (!NodeTag.IsValid())
	{
		SILID_WARN_CAT(LogSILIDElectricity, TEXT("[Power] RegisterNode called with an invalid node tag."));
		return;
	}

	FSILIDPowerNode& Node = FindOrAddNode(NodeTag);
	Node.ParentTag = ParentTag;
	Node.CapacityWatts = FMath::Max(0, CapacityWatts);
	Node.bFuseRequired = bFuseRequired;

	SILID_LOG_CAT(LogSILIDElectricity, TEXT("[Power] Node %s registered (parent %s, cap %d W, fuse %d)."),
		*NodeTag.ToString(), *ParentTag.ToString(), Node.CapacityWatts, bFuseRequired ? 1 : 0);
}

void UElectricalSystemSubsystem::RegisterGenerator(AActor* GeneratorActorIn, FGameplayTag InSourceNodeTag)
{
	if (!GeneratorActorIn)
	{
		SILID_ERROR_CAT(LogSILIDElectricity, TEXT("[Power] RegisterGenerator called with a null actor."));
		return;
	}

	if (GeneratorActor)
	{
		// one source per world: the slice's single-generator law (spec P8 test
		// network). A second registration is a config error, not a takeover.
		SILID_ERROR_CAT(LogSILIDElectricity, TEXT("[Power] RegisterGenerator called twice (%s after %s) — keeping the first."),
			*GeneratorActorIn->GetName(), *GeneratorActor->GetName());
		return;
	}

	GeneratorActor = GeneratorActorIn;
	SourceNodeTag = InSourceNodeTag.IsValid() ? InSourceNodeTag : SILIDTags::PowerNodeGenerator;

	// the source node always exists; idempotent for re-registrations
	FindOrAddNode(SourceNodeTag);

	// the P7 fix input: when the generator's repair completes, the machine
	// becomes startable (needs-repair → fueled/off). The repair component
	// belongs to the actor; we only observe its delegate (doc 11 §2).
	if (USILIDRepairComponent* Repair = GetGeneratorRepair())
	{
		Repair->OnRepaired.AddDynamic(this, &UElectricalSystemSubsystem::OnGeneratorRepaired);
	}

	RefreshGeneratorState();
	SolvePower();

	SILID_LOG_CAT(LogSILIDElectricity, TEXT("[Power] Generator %s registered on node %s (state %d)."),
		*GeneratorActor->GetName(), *SourceNodeTag.ToString(), static_cast<int32>(SourceState));
}

void UElectricalSystemSubsystem::RegisterConsumer(FGameplayTag NodeTag, USILIDElectricPoweredComponent* Consumer)
{
	if (!NodeTag.IsValid() || !Consumer)
	{
		return;
	}

	// auto-create unauthored leaves so a device can never silently attach to
	// nothing (the graph rows still come from RegisterNode for real trees)
	FSILIDPowerNode& Node = FindOrAddNode(NodeTag);
	Node.Consumers.AddUnique(Consumer);

	SILID_LOG_CAT(LogSILIDElectricity, TEXT("[Power] Consumer %s on node %s (%d W)."),
		Consumer->GetOwner() ? *Consumer->GetOwner()->GetName() : TEXT("null"), *NodeTag.ToString(), Consumer->LoadWatts);

	// one device can change the load math — re-solve and initialize it
	SolvePower();
}

void UElectricalSystemSubsystem::UnregisterConsumer(USILIDElectricPoweredComponent* Consumer)
{
	if (!Consumer)
	{
		return;
	}
	for (TPair<FGameplayTag, FSILIDPowerNode>& Pair : PowerNodes)
	{
		Pair.Value.Consumers.Remove(Consumer);
	}
	// no re-solve here: EndPlay ordering makes SolvePower unsafe during teardown;
	// the next board tick or command re-solves with the updated registry.
}

void UElectricalSystemSubsystem::NotifyLoadChanged(FGameplayTag NodeTag)
{
	if (FindNode(NodeTag))
	{
		SolvePower();
	}
}

// ------------------------------- commands -----------------------------------
FSILIDOperationResult UElectricalSystemSubsystem::StartGenerator()
{
	// every failure explains WHY (doc 12 §6 — interactions never fail silently)
	// Running → the player toggles it off: a running engine doesn't "break" —
	// it stops, keeps its repair state, and can be restarted while fueled.
	if (SourceState == ESILIDPowerSourceState::Running)
	{
		SetGeneratorState(ESILIDPowerSourceState::Fueled);
		SILID_WARN_CAT(LogSILIDElectricity, TEXT("[Power] Generator shut down by command."));
		SolvePower();
		return FSILIDOperationResult::Success();
	}

	if (FuelUnits <= 0)
	{
		// the enum code is the shared vocabulary (NoPower); the message is the
		// specific WHY (doc 12 §6 — structured result drives the HUD prompt)
		const FSILIDOperationResult Result = FSILIDOperationResult::Fail(
			ESILIDFailureCode::NoPower, FText::FromString(TEXT("The tank is empty.")), TEXT("generator.fuel"));
		EmitSourceNoise(SputterNoiseLoudness); // failed start = sputter, smaller radius (doc 05 §2)
		return Result;
	}

	if (SourceState == ESILIDPowerSourceState::NeedsRepair)
	{
		const FSILIDOperationResult Result = FSILIDOperationResult::Fail(
			ESILIDFailureCode::InvalidState, FText::FromString(TEXT("It needs repair first.")), TEXT("generator.repair"));
		EmitSourceNoise(SputterNoiseLoudness);
		return Result;
	}

	// Fueled → Running: the loud, risky moment (doc 05 §2)
	SetGeneratorState(ESILIDPowerSourceState::Running);
	FuelRuntimeAccumulator = 0.f;
	EmitSourceNoise(StartNoiseLoudness); // big radius — the Resident hears it
	SolvePower();

	return FSILIDOperationResult::Success();
}

void UElectricalSystemSubsystem::AddFuel(int32 Units)
{
	if (Units <= 0)
	{
		return;
	}
	FuelUnits = FMath::Min(MaxFuelUnits, FuelUnits + Units);
	RefreshGeneratorState(); // NoFuel → Fueled (if intact)
	SILID_LOG_CAT(LogSILIDElectricity, TEXT("[Power] Fuel added (%d/%d units)."), FuelUnits, MaxFuelUnits);
}

void UElectricalSystemSubsystem::SetFuseBlown(FGameplayTag NodeTag, bool bBlown)
{
	FSILIDPowerNode* Node = FindNode(NodeTag);
	if (!Node)
	{
		SILID_WARN_CAT(LogSILIDElectricity, TEXT("[Power] SetFuseBlown on unknown node %s."), *NodeTag.ToString());
		return;
	}
	Node->bFuseBlown = bBlown;
	SILID_WARN_CAT(LogSILIDElectricity, TEXT("[Power] Fuse on %s %s."), *NodeTag.ToString(), bBlown ? TEXT("BLEW") : TEXT("replaced"));
	SolvePower();
}

void UElectricalSystemSubsystem::ResetBreaker(FGameplayTag NodeTag)
{
	FSILIDPowerNode* Node = FindNode(NodeTag);
	if (!Node)
	{
		return;
	}
	Node->bBreakerTripped = false;
	Node->OverloadSince = -1.f;
	SILID_LOG_CAT(LogSILIDElectricity, TEXT("[Power] Breaker on %s reset."), *NodeTag.ToString());
	SolvePower();
}

void UElectricalSystemSubsystem::OnGeneratorRepaired()
{
	// P7 → P8 seam: the machine can run again once fueled. If fuel was already
	// in the tank the state climbs NeedsRepair → Fueled and the player just
	// presses start; the repair's OnRepaired made it possible.
	RefreshGeneratorState();
	SILID_LOG_CAT(LogSILIDElectricity, TEXT("[Power] Generator repaired — state now %d."), static_cast<int32>(SourceState));
}

// ------------------------------- queries ------------------------------------
bool UElectricalSystemSubsystem::IsNodePowered(FGameplayTag NodeTag) const
{
	const FSILIDPowerNode* Node = FindNode(NodeTag);
	return Node && Node->bPowered;
}

int32 UElectricalSystemSubsystem::GetNodeLoadWatts(FGameplayTag NodeTag) const
{
	const FSILIDPowerNode* Node = FindNode(NodeTag);
	return Node ? Node->CurrentLoadWatts : 0;
}

int32 UElectricalSystemSubsystem::GetNodeCapacityWatts(FGameplayTag NodeTag) const
{
	const FSILIDPowerNode* Node = FindNode(NodeTag);
	return Node ? Node->CapacityWatts : 0;
}

USILIDRepairComponent* UElectricalSystemSubsystem::GetGeneratorRepair() const
{
	return GeneratorActor ? GeneratorActor->FindComponentByClass<USILIDRepairComponent>() : nullptr;
}

void UElectricalSystemSubsystem::EmitSourceNoise(float Loudness) const
{
	// upward communication is events/owned refs only: the generator actor
	// announced itself with RegisterGenerator, so we hold its emitter
	if (GeneratorActor)
	{
		if (USILIDNoiseEmitterComponent* Noise = GeneratorActor->FindComponentByClass<USILIDNoiseEmitterComponent>())
		{
			Noise->EmitNoise(FVector(Loudness, 0, 0), SILIDTags::NoiseDevice, GeneratorActor->GetActorLocation());
		}
	}
}

void UElectricalSystemSubsystem::RefreshGeneratorState()
{
	const USILIDRepairComponent* Repair = GetGeneratorRepair();
	const bool bBroken = Repair && Repair->IsBroken();

	// a break (sabotage, event) interrupts even a running engine — honest world
	if (bBroken)
	{
		SetGeneratorState(ESILIDPowerSourceState::NeedsRepair);
		SolvePower();
		return;
	}

	// a RUNNING machine is never "re-derived" down: only the board tick's
	// fuel economy ends a run (Running is a player/board decision, not a
	// derivation output — clobbering it here would kill engines every second)
	if (SourceState == ESILIDPowerSourceState::Running)
	{
		if (FuelUnits <= 0)
		{
			// defensive: a fuelless engine is the board's NoFuel path; catch
			// any ordering that lands here without going through the drain
			SetGeneratorState(ESILIDPowerSourceState::NoFuel);
			SolvePower();
		}
		return;
	}

	// priority: empty > fueled (broken already handled; Off never recurs
	// once fuel exists — the derivation floors at Fueled, start is the player's)
	SetGeneratorState(FuelUnits > 0
		? ESILIDPowerSourceState::Fueled
		: ESILIDPowerSourceState::NoFuel);
}

void UElectricalSystemSubsystem::SetGeneratorState(ESILIDPowerSourceState NewState)
{
	if (SourceState == NewState)
	{
		return;
	}
	SourceState = NewState;
	OnGeneratorStateChanged.Broadcast(NewState);
	SILID_LOG_CAT(LogSILIDElectricity, TEXT("[Power] Generator state -> %d."), static_cast<int32>(NewState));
}

bool UElectricalSystemSubsystem::IsBrownout() const
{
	if (SourceState != ESILIDPowerSourceState::Running)
	{
		return false;
	}
	const USILIDRepairComponent* Repair = GetGeneratorRepair();
	const float Condition = Repair ? Repair->GetCondition() : 100.f;
	return Condition < BrownoutConditionThreshold;
}

// ------------------------------- the solve ----------------------------------
int32 UElectricalSystemSubsystem::AccumulateLoad(FGameplayTag NodeTag)
{
	FSILIDPowerNode* Node = FindNode(NodeTag);
	if (!Node)
	{
		return 0;
	}

	int32 Load = 0;
	for (const TObjectPtr<USILIDElectricPoweredComponent>& Consumer : Node->Consumers)
	{
		if (Consumer && Consumer->bDeviceEnabled)
		{
			Load += Consumer->LoadWatts;
		}
	}
	for (const TPair<FGameplayTag, FSILIDPowerNode>& Pair : PowerNodes)
	{
		if (Pair.Value.ParentTag == NodeTag && Pair.Key != NodeTag)
		{
			Load += AccumulateLoad(Pair.Key);
		}
	}
	Node->CurrentLoadWatts = Load;
	return Load;
}

void UElectricalSystemSubsystem::SolvePower()
{
	const bool bSourceAlive = (SourceState == ESILIDPowerSourceState::Running);

	// loads first (bottom-up accumulation into each node's subtree draw)
	for (const TPair<FGameplayTag, FSILIDPowerNode>& Pair : PowerNodes)
	{
		AccumulateLoad(Pair.Key);
	}

	// availability top-down from the source
	if (FSILIDPowerNode* Source = FindNode(SourceNodeTag))
	{
		ApplyAvailability(*Source, bSourceAlive);
	}
}

void UElectricalSystemSubsystem::ApplyAvailability(FSILIDPowerNode& Node, bool bParentAlive)
{
	const bool bChainIntact = bParentAlive && !Node.bFuseBlown && !Node.bBreakerTripped;
	const bool bOverloaded = Node.CapacityWatts > 0 && Node.CurrentLoadWatts > Node.CapacityWatts;

	// an overload on an already-dead chain cannot trip anything
	if (bChainIntact && bOverloaded && Node.OverloadSince < 0.f)
	{
		Node.OverloadSince = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.f;
	}
	else if (!bOverloaded)
	{
		Node.OverloadSince = -1.f;
	}

	// the node stays LIVE during the grace period (the warning window — the
	// player can shed load and save the fuse); the board tick converts a
	// sustained overload into a trip. Dead chains die with their subtree.
	const bool bAlive = bChainIntact;

	if (Node.bPowered != bAlive)
	{
		Node.bPowered = bAlive;
		OnNodePowerChanged.Broadcast(Node.NodeTag, bAlive);
		for (const TObjectPtr<USILIDElectricPoweredComponent>& Consumer : Node.Consumers)
		{
			if (Consumer)
			{
				Consumer->NotifyNodePowerChanged(bAlive);
			}
		}
	}

	for (const TPair<FGameplayTag, FSILIDPowerNode>& Pair : PowerNodes)
	{
		if (Pair.Value.ParentTag == Node.NodeTag && Pair.Key != Node.NodeTag)
		{
			ApplyAvailability(*PowerNodes.Find(Pair.Key), bAlive);
		}
	}
}

void UElectricalSystemSubsystem::TripBreaker(FGameplayTag NodeTag)
{
	FSILIDPowerNode* Node = FindNode(NodeTag);
	if (!Node || Node->bBreakerTripped)
	{
		return;
	}
	Node->bBreakerTripped = true;
	Node->OverloadSince = -1.f;

	// the breaker clack is a loud, honest world event (doc 05 §2)
	EmitSourceNoise(BreakerNoiseLoudness);
	OnBreakerTripped.Broadcast(NodeTag);
	SILID_WARN_CAT(LogSILIDElectricity, TEXT("[Power] BREAKER TRIPPED on %s (overload past grace)."), *NodeTag.ToString());

	SolvePower();
}

// ------------------------------- board tick ---------------------------------
void UElectricalSystemSubsystem::BoardTick()
{
	// self-heal the machine state every second: covers save/restore ordering
	// (repair components register after LoadFrom) and any mid-run sabotage
	// that bypassed the delegates — one owner recomputing from its own facts
	RefreshGeneratorState();

	// fuel economy: 1 unit per FuelDrainSeconds of runtime (doc 05 §2 —
	// fuel is the ongoing pressure; the run ends in sputter, not magic)
	if (SourceState == ESILIDPowerSourceState::Running)
	{
		FuelRuntimeAccumulator += 1.0f;
		if (FuelRuntimeAccumulator >= FuelDrainSeconds)
		{
			FuelRuntimeAccumulator -= FuelDrainSeconds;
			--FuelUnits;
			if (FuelUnits <= 0)
			{
				FuelUnits = 0;
				SetGeneratorState(ESILIDPowerSourceState::NoFuel);
				EmitSourceNoise(SputterNoiseLoudness); // the sputter-out
			}
			SolvePower();
		}
	}

	// brown-out presentation (doc 05 §2): presentation reads IsBrownout()
	// and drives its own flicker; the subsystem owns only the measurement.

	// overload grace → trip (the solve registered the timers)
	for (const TPair<FGameplayTag, FSILIDPowerNode>& Pair : PowerNodes)
	{
		const FSILIDPowerNode& Node = Pair.Value;
		if (Node.bPowered && Node.OverloadSince >= 0.f)
		{
			const float Now = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.f;
			if (Now - Node.OverloadSince >= OverloadGraceSeconds)
			{
				TripBreaker(Pair.Key);
				break; // one trip per tick; the next solve re-registers others
			}
		}
	}

	// close the tick with a change-only solve: idempotent and cheap, and it
	// guarantees consumer state always converges with machine state even if
	// some path mutated state without solving (EndPlay ordering, edge saves)
	SolvePower();
}

// ------------------------------- save ---------------------------------------
void UElectricalSystemSubsystem::SaveTo(USILIDSaveGame* SaveGame) const
{
	if (!SaveGame)
	{
		return;
	}
	// replay-safe: machine state is DERIVED at load (repair/fuel data decide);
	// only the explicit world actions persist (doc 14 P7 replay law)
	SaveGame->Flags.Add(TEXT("power.generator.running"), SourceState == ESILIDPowerSourceState::Running);
	SaveGame->Counters.Add(TEXT("power.generator.fuel"), FuelUnits);
	for (const TPair<FGameplayTag, FSILIDPowerNode>& Pair : PowerNodes)
	{
		if (Pair.Value.bFuseBlown)
		{
			SaveGame->Flags.Add(FString::Printf(TEXT("power.fuse.%s"), *Pair.Key.GetTagName().ToString()), true);
		}
	}
}

void UElectricalSystemSubsystem::LoadFrom(const USILIDSaveGame* SaveGame)
{
	if (!SaveGame)
	{
		return;
	}
	FuelUnits = 0;
	if (const int32* Fuel = SaveGame->Counters.Find(TEXT("power.generator.fuel")))
	{
		FuelUnits = FMath::Clamp(*Fuel, 0, MaxFuelUnits);
	}

	for (TPair<FGameplayTag, FSILIDPowerNode>& Pair : PowerNodes)
	{
		const bool* Blown = SaveGame->Flags.Find(FString::Printf(TEXT("power.fuse.%s"), *Pair.Key.GetTagName().ToString()));
		Pair.Value.bFuseBlown = Blown ? *Blown : false;
		Pair.Value.bBreakerTripped = false; // a load never restores mid-trip
	}

	// running is re-derived after the world's actors have re-registered
	RefreshGeneratorState();
	const bool* WasRunning = SaveGame->Flags.Find(TEXT("power.generator.running"));
	if (WasRunning && *WasRunning && SourceState == ESILIDPowerSourceState::Fueled)
	{
		SetGeneratorState(ESILIDPowerSourceState::Running);
		FuelRuntimeAccumulator = 0.f;
		EmitSourceNoise(StartNoiseLoudness * 0.5f);
	}
	SolvePower();
}

// ------------------------------- debug --------------------------------------
void UElectricalSystemSubsystem::SILID_Debug_Power()
{
	static const TCHAR* StateNames[] = { TEXT("Off"), TEXT("NoFuel"), TEXT("NeedsRepair"), TEXT("Fueled"), TEXT("Running") };
	const TCHAR* StateName = (static_cast<uint8>(SourceState) < 5) ? StateNames[static_cast<uint8>(SourceState)] : TEXT("?");
	SILID_LOG_CAT(LogSILIDElectricity, TEXT("[Power] Generator: %s | fuel %d/%d | brownout %d"),
		StateName, FuelUnits, MaxFuelUnits, IsBrownout() ? 1 : 0);

	for (const TPair<FGameplayTag, FSILIDPowerNode>& Pair : PowerNodes)
	{
		const FSILIDPowerNode& Node = Pair.Value;
		SILID_LOG_CAT(LogSILIDElectricity, TEXT("[Power] %s: %s | load %d/%d W | fuse %s | breaker %s | %d consumer(s)"),
			*Pair.Key.ToString(),
			Node.bPowered ? TEXT("ON ") : TEXT("OFF"),
			Node.CurrentLoadWatts, Node.CapacityWatts,
			Node.bFuseRequired ? (Node.bFuseBlown ? TEXT("BLOWN") : TEXT("ok")) : TEXT("n/a"),
			Node.bBreakerTripped ? TEXT("TRIPPED") : TEXT("ok"),
			Node.Consumers.Num());
	}
}
