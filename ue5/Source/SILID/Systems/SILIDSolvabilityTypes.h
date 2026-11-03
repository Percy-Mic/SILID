// SILID class contract
// OWNS:         the pure data model of a run's dependency graph + the
//               validation report vocabulary
// MAY WRITE:    nothing — passive structs, filled by the validator
// DEPENDS ON:   Core only. Deliberately NO UObject/UHT (doc 12 "pure C++
//               logic" mandate: closure must be testable without actors,
//               worlds, or a running game — the web build's harness pattern).
// EMITS:        nothing — pure data.
//
// P16 Solvability Validation (doc 13 phase; design doc 09 §8). The world is
// a dependency graph: a node becomes AVAILABLE when the start node is
// available and every requirement resolves to an available node. Consumed
// items (fuses, fuel) are SUPPLIES — two consumers sharing one fuse cannot
// both complete. The run is solvable when any escape-route node is
// reachable. A-015 (doc 15): every generated run must have at least one
// valid completion path; unwinnable seeds are rejected before play.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"

namespace SILIDSolvability
{
	/** What a graph node represents (extracted from world actors by the validator). */
	enum class ENodeKind : uint8
	{
		Start,     // the player's entry point
		Item,      // an obtainable item (spawn point drawn this seed)
		Room,      // an area, gated by a lockable door
		Machine,   // repairable/powerable object (generator, fusebox)
		Barrier,   // planks/chain/padlock blocking a transition
		Route      // an escape route (win condition)
	};

	/** Why a run can be unwinnable (doc 09 §8 validator responsibilities). */
	enum class EFailure : uint8
	{
		None,             // solvable
		MissingItem,      // a required item has no spawn point in the seed
		UnreachableItem,  // the item exists but never becomes available
		UnreachableRoom,  // a room/door chain dead-ends
		UnreachableMachine, // a required repair can never be attempted
		CircularDependency, // A needs B needs A
		ExhaustedSupply,  // consumers demand more copies than the seed provides
		MissingEscape     // no escape route is reachable
	};

	/** One row of the graph. Requirements are names of other nodes. */
	struct FNodeDef
	{
		FName Id;
		ENodeKind Kind = ENodeKind::Item;

		/** Items that must be carried to use/pass this node. */
		TArray<FName> RequiresItems;

		/** Rooms that must already be available (progression gates). */
		TArray<FName> RequiresRooms;

		/** Machines that must be functional first (power/restoration chains). */
		TArray<FName> RequiresMachines;

		/** Items consumed on use — resolved against supplies (fuses, fuel). */
		TArray<FName> Consumes;

		/** Is this node a supply source? Items are supplies by default. */
		bool bSupply = false;

		/** Copies the supply provides (stackable spawns, ammo boxes). */
		int32 SupplyCount = 1;
	};

	/** The extracted world model — same shape for every seed; only the
	 * placement layer changes per seed (doc 11: randomizer writes initial
	 * state only, so the model is static per map). */
	struct FModel
	{
		TArray<FNodeDef> Nodes;
		FName StartNodeId;
		TArray<FName> EscapeNodeIds;

		const FNodeDef* FindNode(FName Id) const
		{
			return Nodes.FindByPredicate([Id](const FNodeDef& Node) { return Node.Id == Id; });
		}
		FNodeDef* FindNode(FName Id)
		{
			return Nodes.FindByPredicate([Id](const FNodeDef& Node) { return Node.Id == Id; });
		}
	};

	/** One seed's placement draw: which candidate node each item spawns at. */
	struct FPlacement
	{
		int32 Seed = 0;

		/** Item node id -> the spawn candidate node id it was drawn to. */
		TMap<FName, FName> ItemToSpawnNode;

		/** Enemy start room (recorded for reports; not a solvability input —
		 * the AI is honest and cannot make a run unwinnable, only harder). */
		FName EnemyStartRoom;
	};

	/** Runtime state of one node during closure evaluation. */
	struct FNodeState
	{
		bool bAvailable = false;
		int32 RemainingSupply = 0;
	};

	/** One structured failure with a human-readable detail line. */
	struct FFailureEntry
	{
		EFailure Code = EFailure::None;
		FString Detail; // node ids involved, e.g. "Item.Fuse required by Machine.Generator"
	};

	/** The full result of validating one seed. */
	struct FReport
	{
		int32 Seed = 0;
		bool bSolvable = false;
		TArray<FFailureEntry> Failures;

		/** Telemetry for the batch harness / tuning. */
		int32 NodesEvaluated = 0;
		int32 NodesAvailable = 0;
		int32 EscapeRoutesAvailable = 0;
		double ElapsedMicros = 0.0;
	};

	/** Pure closure evaluation (SILIDSolvabilityEvaluator.cpp). Monotone
	 * fixpoint: start available, satisfy nodes until nothing changes.
	 * Deterministic — same model + placement always yields the same report. */
	FReport Evaluate(const FModel& Model, const FPlacement& Placement);
}
