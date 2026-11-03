// Validator implementation. Extraction reads the world once (doors, routes,
// barriers, spawn points, repair components) into the pure model; per-seed
// validation is then a pure function. READ-ONLY over the world by law —
// the validator reports and rejects; it never repairs (doc 11).
//
// Item-name vocabulary (the bridge between tags and the pure graph):
//   "Key.<UnlockTag>"   a key item whose UnlockTag matches a lock
//   "Item.<ItemId>"     any other item (components consumed by machines/routes)
// A lock that accepts any key of that family is satisfied by the key node.
// Spawn candidates are spawn points whose ItemToSpawn draws the same item
// identity; the per-seed placement picks one (mirroring the randomizer's
// family scatter: shuffle candidates, take the first, guaranteed-first law).

#include "Systems/SILIDSolvabilityValidator.h"
#include "Systems/SILIDSolvabilityTypes.h"
#include "Systems/SILIDRandomizerSubsystem.h"
#include "Systems/SILIDElectricalSystemSubsystem.h"
#include "Systems/SILIDSpawnPoint.h"
#include "Systems/SILIDEscapeRoute.h"
#include "Systems/SILIDItemData.h"
#include "Systems/SILIDRepairComponent.h"
#include "Props/SILIDDoor.h"
#include "Props/SILIDBarrier.h"
#include "Logging/SILIDLog.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"

namespace
{
	/** Canonical node-name helpers (the tag->graph bridge). */
	FName KeyNodeForTag(const FGameplayTag& UnlockTag)
	{
		return FName(*FString::Printf(TEXT("Key.%s"), *UnlockTag.GetTagName().ToString()));
	}
	FName ItemNodeForId(FName ItemId)
	{
		return FName(*FString::Printf(TEXT("Item.%s"), *ItemId.ToString()));
	}
	FName RoomNodeForName(const FString& RoomName)
	{
		return FName(*FString::Printf(TEXT("Room.%s"), *RoomName));
	}
	FName MachineNodeFor(const AActor* Actor)
	{
		return FName(*FString::Printf(TEXT("Machine.%s"), *Actor->GetName()));
	}
	FName RouteNodeFor(const ASILIDEscapeRoute* Route)
	{
		return FName(*FString::Printf(TEXT("Route.%s"), *Route->GetName()));
	}
	/** The virtual power node (P8): every electricity-dependent thing
	 * requires this machine; it resolves when the generator is startable. */
	FName PowerMachineNode()
	{
		return FName(TEXT("Machine.Power"));
	}
}

bool USILIDSolvabilityValidator::ShouldCreateSubsystem(UObject* Outer) const
{
	// game worlds only — never the editor preview worlds
	if (const UWorld* World = Cast<UWorld>(Outer))
	{
		return World->WorldType == EWorldType::Game || World->WorldType == EWorldType::PIE;
	}
	return false;
}

void USILIDSolvabilityValidator::BuildModel()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	Model = SILIDSolvability::FModel();
	SpawnCandidates.Reset();

	// ---- start node ----
	const FName StartId("Room.Start");
	SILIDSolvability::FNodeDef Start;
	Start.Id = StartId;
	Start.Kind = SILIDSolvability::ENodeKind::Room;
	Model.Nodes.Add(Start);
	Model.StartNodeId = StartId;

	// ---- spawn points: item candidates (the per-seed variable layer) ----
	TArray<AActor*> PointActors;
	UGameplayStatics::GetAllActorsOfClass(World, ASILIDSpawnPoint::StaticClass(), PointActors);
	for (AActor* Actor : PointActors)
	{
		const ASILIDSpawnPoint* Point = Cast<ASILIDSpawnPoint>(Actor);
		if (!Point || !Point->ItemToSpawn)
		{
			continue;
		}
		const USILIDItemData* Item = Point->ItemToSpawn;
		const FName ItemNode = Item->ItemType == EItemType::Key && Item->UnlockTag.IsValid()
			? KeyNodeForTag(Item->UnlockTag)
			: ItemNodeForId(Item->ItemId);

		// candidate: the room this point sits in (item is available once that
		// room is open). Room resolution: nearest tagged room zone by name.
		const FName RoomNode = RoomNodeForName(Point->GetRoomNameForValidation());
		SpawnCandidates.FindOrAdd(ItemNode).AddUnique(RoomNode);

		// guarantee the room node exists
		if (!Model.FindNode(RoomNode))
		{
			SILIDSolvability::FNodeDef Room;
			Room.Id = RoomNode;
			Room.Kind = SILIDSolvability::ENodeKind::Room;
			Model.Nodes.Add(Room);
		}
	}

	// ---- item nodes themselves: fixed supplies (unrandomized base items) ----
	// Spawn points carrying the same item define randomized copies; the item
	// node's supply count is how many candidates exist (the placement picks
	// which room each copy lands in — two copies can land in two rooms).
	for (const TPair<FName, TArray<FName>>& Pair : SpawnCandidates)
	{
		SILIDSolvability::FNodeDef ItemNode;
		ItemNode.Id = Pair.Key;
		ItemNode.Kind = SILIDSolvability::ENodeKind::Item;
		ItemNode.bSupply = true;
		ItemNode.SupplyCount = Pair.Value.Num();
		Model.Nodes.Add(ItemNode);
	}

	// ---- doors: room gates ----
	TArray<AActor*> DoorActors;
	UGameplayStatics::GetAllActorsOfClass(World, ASILIDDoor::StaticClass(), DoorActors);
	for (AActor* Actor : DoorActors)
	{
		const ASILIDDoor* Door = Cast<ASILIDDoor>(Actor);
		if (!Door)
		{
			continue;
		}
		const bool bLocked = Door->bStartsLocked && Door->RequiredKeyTag.IsValid();
		const bool bNeedsPower = Door->PowerNode.IsValid(); // electronic lock (P8)
		if (!bLocked && !bNeedsPower)
		{
			continue; // unlocked ordinary doors never gate progression
		}
		// the door's far side is the room named after the door (designers
		// name doors Room.X or the extraction reads the room zone it faces).
		// The requirement lands whether or not the room node already exists
		// (spawn points can create it first) — a requirement is never dropped.
		const FName RoomNode = RoomNodeForName(Door->GetRoomNameForValidation());
		SILIDSolvability::FNodeDef* Room = Model.FindNode(RoomNode);
		if (!Room)
		{
			SILIDSolvability::FNodeDef NewRoom;
			NewRoom.Id = RoomNode;
			NewRoom.Kind = SILIDSolvability::ENodeKind::Room;
		const int32 RoomIndex = Model.Nodes.Add(NewRoom);
		Room = &Model.Nodes[RoomIndex];
		}
		if (bLocked)
		{
			Room->RequiresItems.AddUnique(KeyNodeForTag(Door->RequiredKeyTag));
		}
		if (bNeedsPower)
		{
			Room->RequiresMachines.AddUnique(PowerMachineNode());
		}
	}

	// ---- barriers: same gating semantics (padlock= key, others = tools) ----
	TArray<AActor*> BarrierActors;
	UGameplayStatics::GetAllActorsOfClass(World, ASILIDBarrier::StaticClass(), BarrierActors);
	for (AActor* Actor : BarrierActors)
	{
		const ASILIDBarrier* Barrier = Cast<ASILIDBarrier>(Actor);
		if (!Barrier || Barrier->IsCleared())
		{
			continue;
		}
		// barriers block the route/door they wire to; model the requirement
		// onto that route node so clearing is a graph dependency
		if (Barrier->RouteToEnable)
		{
			const FName RouteNode = RouteNodeFor(Barrier->RouteToEnable);
			SILIDSolvability::FNodeDef* Route = Model.FindNode(RouteNode);
			if (Route)
			{
				// fusebox -> Consumes fuse component; planks/chain -> tool item;
				// padlock -> key. Tools are modeled as item nodes supplied once.
				switch (Barrier->Kind)
				{
					case EBarrierKind::Padlock:
						Route->RequiresItems.Add(KeyNodeForTag(Barrier->KeyTag));
						break;
					case EBarrierKind::Fusebox:
						Route->Consumes.Add(ItemNodeForId(FName("component.fuse")));
						break;
					default:
						Route->RequiresItems.Add(ItemNodeForId(FName("tool.hammer")));
						break;
				}
			}
		}
	}

	// ---- escape routes ----
	TArray<AActor*> RouteActors;
	UGameplayStatics::GetAllActorsOfClass(World, ASILIDEscapeRoute::StaticClass(), RouteActors);
	for (AActor* Actor : RouteActors)
	{
		ASILIDEscapeRoute* Route = Cast<ASILIDEscapeRoute>(Actor);
		if (!Route)
		{
			continue;
		}
		SILIDSolvability::FNodeDef Node;
		Node.Id = RouteNodeFor(Route);
		Node.Kind = SILIDSolvability::ENodeKind::Route;
		if (Route->KeyTag.IsValid())
		{
			Node.RequiresItems.Add(KeyNodeForTag(Route->KeyTag));
		}
		for (const FGameplayTag& Component : Route->RequiredComponents)
		{
			Node.Consumes.Add(ItemNodeForId(Component.GetTagName()));
		}
		if (Route->PowerNode.IsValid())
		{
			// powered mechanism (garage motor, powered hatch) — the power
			// chain is a route dependency exactly like a key (doc 15 §5)
			Node.RequiresMachines.AddUnique(PowerMachineNode());
		}
		if (Route->PrerequisiteRoute)
		{
			Node.RequiresRooms.Add(RouteNodeFor(Route->PrerequisiteRoute));
		}
		Model.Nodes.Add(Node);
		Model.EscapeNodeIds.Add(Node.Id);
	}

	// ---- machines (repair components) ----
	TArray<AActor*> MachineActors;
	UGameplayStatics::GetAllActorsOfClass(World, AActor::StaticClass(), MachineActors);
	for (AActor* Actor : MachineActors)
	{
		const USILIDRepairComponent* Repair = Actor->FindComponentByClass<USILIDRepairComponent>();
		if (!Repair || !Repair->IsBroken())
		{
			continue;
		}
		SILIDSolvability::FNodeDef Node;
		Node.Id = MachineNodeFor(Actor);
		Node.Kind = SILIDSolvability::ENodeKind::Machine;
		for (const FSILIDRepairRequirement& Req : Repair->Requirements)
		{
			if (Req.RequiredKeyTag.IsValid())
			{
				Node.RequiresItems.Add(KeyNodeForTag(Req.RequiredKeyTag));
			}
			if (Req.ConsumedComponentTag.IsValid())
			{
				Node.Consumes.Add(ItemNodeForId(Req.ConsumedComponentTag.GetTagName()));
			}
			if (Req.RequiredToolTag.IsValid())
			{
				// tool requirements are possession, not consumption
				Node.RequiresItems.Add(ItemNodeForId(Req.RequiredToolTag.GetTagName()));
			}
		}
		if (Repair->HasAnyPowerRequirements())
		{
			// a machine that runs on electricity (the generator itself)
			Node.RequiresMachines.AddUnique(PowerMachineNode());
		}
		Model.Nodes.Add(Node);
	}

	// ---- power chain (P8 electricity): the generator machine grounds the
	// virtual "Machine.Power" node; it resolves when the generator is
	// repaired-and-startable (a broken generator adds its requirements via
	// the generic pass above — same facts, one extraction law). Doc 15 §5
	// electricity protocol: dependencies validated BEFORE gameplay.
	{
		SILIDSolvability::FNodeDef Power;
		Power.Id = PowerMachineNode();
		Power.Kind = SILIDSolvability::ENodeKind::Machine;
		if (const UElectricalSystemSubsystem* Electrical = World->GetSubsystem<UElectricalSystemSubsystem>())
		{
			if (const AActor* Generator = Electrical->GetGeneratorActor())
			{
				if (const USILIDRepairComponent* Repair = Generator->FindComponentByClass<USILIDRepairComponent>())
				{
					if (Repair->IsBroken())
					{
						Power.RequiresMachines.Add(MachineNodeFor(Generator));
					}
				}
			}
		}
		Model.Nodes.Add(Power);
	}

	// escape-route power requirements land in the routes pass above via
	// RequiresMachines(PowerMachineNode()) when Route->PowerNode is set
}

FName USILIDSolvabilityValidator::RoomNodeForDoor(const ASILIDDoor* Door) const
{
	return RoomNodeForName(Door ? Door->GetRoomNameForValidation() : FString());
}

// ------------------------------- per-seed draw ------------------------------
SILIDSolvability::FPlacement USILIDSolvabilityValidator::DrawPlacement(int32 Seed) const
{
	SILIDSolvability::FPlacement Placement;
	Placement.Seed = Seed;

	// Mirror the randomizer's scatter law without touching it (doc 11: the
	// validator is read-only and the randomizer write-once): each item's
	// candidate rooms are shuffled with the same seed; the first wins.
	FRandomStream Stream(Seed);
	for (const TPair<FName, TArray<FName>>& Pair : SpawnCandidates)
	{
		TArray<FName> Candidates = Pair.Value;
		if (Candidates.Num() == 0)
		{
			continue;
		}
		for (int32 i = Candidates.Num() - 1; i > 0; --i)
		{
			Candidates.Swap(i, Stream.RandRange(0, i));
		}
		Placement.ItemToSpawnNode.Add(Pair.Key, Candidates[0]);
	}
	return Placement;
}

// ------------------------------- validation ---------------------------------
bool USILIDSolvabilityValidator::ValidateSeed(int32 Seed, SILIDSolvability::FReport* OutReport)
{
	if (Model.Nodes.Num() == 0)
	{
		BuildModel();
	}
	if (Model.Nodes.Num() == 0 || Model.EscapeNodeIds.Num() == 0)
	{
		SILID_ERROR_CAT(LogSILID, TEXT("[Validator] No graph extracted — place escape routes and spawn points with ValidationRoomId set."));
		return false;
	}

	const SILIDSolvability::FPlacement Placement = DrawPlacement(Seed);
	SILIDSolvability::FReport Report = SILIDSolvability::Evaluate(Model, Placement);

	if (!Report.bSolvable)
	{
		for (const SILIDSolvability::FFailureEntry& Failure : Report.Failures)
		{
			// pure enum (no UHT reflection): log by value with a local name table
			static const TCHAR* FailureNames[] =
			{
				TEXT("None"), TEXT("MissingItem"), TEXT("UnreachableItem"), TEXT("UnreachableRoom"),
				TEXT("UnreachableMachine"), TEXT("CircularDependency"), TEXT("ExhaustedSupply"), TEXT("MissingEscape")
			};
			const TCHAR* CodeName = (static_cast<uint8>(Failure.Code) < 8) ? FailureNames[static_cast<uint8>(Failure.Code)] : TEXT("Unknown");
			SILID_WARN_CAT(LogSILID, TEXT("[Validator] seed %d REJECTED: %s — %s"), Seed, CodeName, *Failure.Detail);
		}
	}

	OnValidationComplete.Broadcast(Report.bSolvable, Seed);
	if (OutReport)
	{
		*OutReport = MoveTemp(Report);
	}
	return Report.bSolvable;
}

int32 USILIDSolvabilityValidator::FindNextValidSeed(int32 FirstCandidate, int32 MaxAttempts)
{
	for (int32 Attempt = 0; Attempt < MaxAttempts; ++Attempt)
	{
		const int32 Candidate = FirstCandidate + Attempt;
		if (ValidateSeed(Candidate))
		{
			if (Attempt > 0)
			{
				SILID_LOG_CAT(LogSILID, TEXT("[Validator] %d seed(s) rejected before accepting %d"), Attempt, Candidate);
			}
			return Candidate;
		}
	}
	// never start an unvalidated run: over the limit is a map config error
	SILID_ERROR_CAT(LogSILID, TEXT("[Validator] CRITICAL: %d consecutive invalid seeds — the map's dependency configuration is broken. Fix the graph, do not raise the limit."), MaxAttempts);
	return 0;
}

int32 USILIDSolvabilityValidator::ValidateSeedBatch(int32 FirstSeed, int32 Count)
{
	if (Model.Nodes.Num() == 0)
	{
		BuildModel();
	}

	int32 Passed = 0;
	TMap<FString, int32> FailureReasons;
	double TotalMicros = 0.0;

	for (int32 i = 0; i < Count; ++i)
	{
		const int32 Seed = FirstSeed + i;
		SILIDSolvability::FReport Report;
		if (ValidateSeed(Seed, &Report))
		{
			++Passed;
		}
		else
		{
			for (const SILIDSolvability::FFailureEntry& Failure : Report.Failures)
			{
				FailureReasons.FindOrAdd(Failure.Detail) += 1;
			}
		}
		TotalMicros += Report.ElapsedMicros;
	}

	SILID_LOG_CAT(LogSILID, TEXT("[Validator] BATCH %d seeds: %d passed, %d rejected (%.0f us avg)"),
		Count, Passed, Count - Passed, TotalMicros / FMath::Max(1, Count));
	for (const TPair<FString, int32>& Reason : FailureReasons)
	{
		SILID_WARN_CAT(LogSILID, TEXT("[Validator]   x%d: %s"), Reason.Value, *Reason.Key);
	}
	return Passed;
}

// ------------------------------- console ------------------------------------
void USILIDSolvabilityValidator::SILID_ValidateSeeds(int32 Count)
{
	ValidateSeedBatch(1, FMath::Clamp(Count, 1, 10000));
}

void USILIDSolvabilityValidator::SILID_DumpGraph()
{
	if (Model.Nodes.Num() == 0)
	{
		BuildModel();
	}
	for (const SILIDSolvability::FNodeDef& Node : Model.Nodes)
	{
		FString Reqs;
		for (FName R : Node.RequiresItems) { Reqs += FString::Printf(TEXT(" item:%s"), *R.ToString()); }
		for (FName R : Node.RequiresRooms) { Reqs += FString::Printf(TEXT(" room:%s"), *R.ToString()); }
		for (FName R : Node.RequiresMachines) { Reqs += FString::Printf(TEXT(" mach:%s"), *R.ToString()); }
		for (FName R : Node.Consumes) { Reqs += FString::Printf(TEXT(" eats:%s"), *R.ToString()); }
		SILID_LOG_CAT(LogSILID, TEXT("[Graph] %s (%d)%s"), *Node.Id.ToString(), static_cast<int32>(Node.Kind), *Reqs);
	}
}

void USILIDSolvabilityValidator::SILID_ValidateSeed(int32 Seed)
{
	ValidateSeed(Seed);
}
