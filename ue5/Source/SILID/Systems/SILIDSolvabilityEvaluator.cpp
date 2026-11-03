// Pure C++ closure evaluator (doc 12 mandate: no UObject dependencies —
// testable from an automation harness without a world). The algorithm is a
// simple monotone fixpoint: start available, repeatedly try to satisfy every
// unavailable node's requirements, stop when nothing changes. Graphs are
// tiny (hundreds of nodes), so O(n²) passes are the honest, debuggable
// choice — no priority queues, no hidden state.

#include "Systems/SILIDSolvabilityTypes.h"

namespace SILIDSolvability
{
	namespace
	{
		/** One item's total supply for this placement draw: nodes marked as
		 * supplies for this item id (spawn candidates that won the scatter)
		 * contribute their SupplyCount. */
		int32 SupplyForItem(const FModel& Model, const FPlacement& Placement, FName ItemId)
		{
			int32 Total = 0;
			if (const FNodeDef* SpawnNode = Model.FindNode(Placement.ItemToSpawnNode.FindRef(ItemId)))
			{
				if (SpawnNode->bSupply)
				{
					Total += SpawnNode->SupplyCount;
				}
			}
			// item nodes themselves may also be supplies (fixed, unrandomized items)
			if (const FNodeDef* ItemNode = Model.FindNode(ItemId))
			{
				if (ItemNode->bSupply)
				{
					Total += ItemNode->SupplyCount;
				}
			}
			return Total;
		}

		/** Does carrying `Carried` satisfy needing `Needed`? Exact match for
		 * now; tag-hierarchy matching joins when item tags do (kept pure). */
		bool Satisfies(FName Needed, const TSet<FName>& Carried)
		{
			return Carried.Contains(Needed);
		}
		/** Missing nodes are configuration errors: unavailable, never crash. */
		const FNodeState* FindState(const TMap<FName, FNodeState>& States, FName Id)
		{
			return States.Find(Id);
		}
	}

	FReport Evaluate(const FModel& Model, const FPlacement& Placement)
	{
		const double StartTime = FPlatformTime::Cycles64();

		FReport Report;
		Report.Seed = Placement.Seed;

		// ---- supply ledger (consumed items are finite) ----
		TMap<FName, int32> Supplies;
		TMap<FName, int32> Demands;

		// ---- state ----
		TMap<FName, FNodeState> States;
		States.Reserve(Model.Nodes.Num());
		for (const FNodeDef& Node : Model.Nodes)
		{
			FNodeState& State = States.Add(Node.Id);
			State.bAvailable = (Node.Id == Model.StartNodeId);
			State.RemainingSupply = SupplyForItem(Model, Placement, Node.Id);
		}

		TSet<FName> CarriedItems;

		// ---- fixpoint ----
		bool bProgress = true;
		while (bProgress)
		{
			bProgress = false;

			for (const FNodeDef& Node : Model.Nodes)
			{
				FNodeState& State = States.FindChecked(Node.Id);
				if (State.bAvailable)
				{
					continue;
				}				bool bOk = true;

				// item nodes gate on their placement room for THIS seed: the
				// item becomes reachable when the room it spawned in opens
				if (Node.Kind == ENodeKind::Item)
				{
					const FName PlacementRoom = Placement.ItemToSpawnNode.FindRef(Node.Id);
					if (!PlacementRoom.IsNone())
					{
						const FNodeState* RoomState = FindState(States, PlacementRoom);
						if (!(RoomState && RoomState->bAvailable))
						{
							bOk = false;
						}
					}
				}

				for (FName Required : Node.RequiresItems)
		{
			// carrying OR standing where it spawns counts as reachable
			const FNodeState* ReqState = FindState(States, Required);
			if (!Satisfies(Required, CarriedItems) && !(ReqState && ReqState->bAvailable))
			{
				bOk = false;
				break;
			}
		}
		if (bOk)
		{
			for (FName Required : Node.RequiresRooms)
			{
				const FNodeState* ReqState = FindState(States, Required);
				if (!(ReqState && ReqState->bAvailable))
				{
					bOk = false;
					break;
				}
			}
		}
		if (bOk)
		{
			for (FName Required : Node.RequiresMachines)
			{
				const FNodeState* ReqState = FindState(States, Required);
				if (!(ReqState && ReqState->bAvailable))
				{
					bOk = false;
					break;
				}
			}
		}

				if (!bOk)
				{
					continue;
				}

				// consumed items: decrement the supply, then carry the item id
				bool bConsumedOk = true;
				for (FName Consumed : Node.Consumes)
				{
					int32* Remaining = Supplies.Find(Consumed);
					if (!Remaining)
					{
						Remaining = &Supplies.Add(Consumed, SupplyForItem(Model, Placement, Consumed));
					}
					if (*Remaining <= 0)
					{
						bConsumedOk = false;
						break;
					}
				}
				if (!bConsumedOk)
				{
					continue;
				}
				for (FName Consumed : Node.Consumes)
				{
					Supplies.FindChecked(Consumed)--;
					Demands.FindOrAdd(Consumed) += 1;
				}

				// node becomes available
				State.bAvailable = true;
				++Report.NodesAvailable;

				// its item joins the inventory (start items handled identically)
				if (Node.Kind == ENodeKind::Item || Node.bSupply)
				{
					CarriedItems.Add(Node.Id);
				}

				bProgress = true;
			}
		}

		// ---- report assembly ----
		Report.NodesEvaluated = Model.Nodes.Num();

		auto Fail = [&Report](EFailure Code, const FString& Detail)
		{
			Report.Failures.Add({ Code, Detail });
		};

		// escape check — the win condition
		int32 EscapeCount = 0;
		for (FName RouteId : Model.EscapeNodeIds)
		{
			if (States.FindChecked(RouteId).bAvailable)
			{
				++EscapeCount;
			}
		}
		Report.EscapeRoutesAvailable = EscapeCount;
		if (EscapeCount == 0)
		{
			Fail(EFailure::MissingEscape,
				FString::Printf(TEXT("no escape route reachable from start %s"), *Model.StartNodeId.ToString()));
		}

		// required machines: any machine some other node depends on must
		// become available, or the dependency chain dead-ends
		for (const FNodeDef& Node : Model.Nodes)
		{
			for (FName Required : Node.RequiresMachines)
			{
				if (!States.FindChecked(Required).bAvailable)
				{
					Fail(EFailure::UnreachableMachine,
						FString::Printf(TEXT("%s required by %s never became functional"),
							*Required.ToString(), *Node.Id.ToString()));
				}
			}
		}

		// supply exhaustion: a consumer that never fired while demanding a
		// supply is either starved or behind an unavailable prerequisite —
		// report which, so the designer sees the chain
		for (const FNodeDef& Node : Model.Nodes)
		{
			if (States.FindChecked(Node.Id).bAvailable)
			{
				continue;
			}
			for (FName Consumed : Node.Consumes)
			{
				const int32 Remaining = Supplies.FindRef(Consumed, 0);
				const int32 Demanded = Demands.FindRef(Consumed);
				if (Remaining <= 0)
				{
					Fail(EFailure::ExhaustedSupply,
						FString::Printf(TEXT("%s starved: supply %s exhausted (%d consumed elsewhere)"),
							*Node.Id.ToString(), *Consumed.ToString(), Demanded));
				}
			}
		}

		// circular dependency detection: an unavailable node whose every
		// requirement is also unavailable-and-demanding forms a cycle; the
		// cheap structural test is self/mutual requires among unavailable nodes
		for (const FNodeDef& Node : Model.Nodes)
		{
			if (States.FindChecked(Node.Id).bAvailable)
			{
				continue;
			}
			for (FName Required : Node.RequiresItems)
			{
				if (Required == Node.Id)
				{
					Fail(EFailure::CircularDependency,
						FString::Printf(TEXT("%s requires itself"), *Node.Id.ToString()));
				}
				else
				{
					const FNodeDef* Other = Model.FindNode(Required);
					if (Other)
					{
						for (FName OtherRequired : Other->RequiresItems)
						{
							if (OtherRequired == Node.Id &&
								!States.FindChecked(Node.Id).bAvailable &&
								!States.FindChecked(Required).bAvailable)
							{
								Fail(EFailure::CircularDependency,
									FString::Printf(TEXT("%s <-> %s mutual requirement"),
										*Node.Id.ToString(), *Required.ToString()));
								break;
							}
						}
					}
				}
			}
		}

		// unreachable rooms: rooms that nothing could ever open this seed
		for (const FNodeDef& Node : Model.Nodes)
		{
			if (Node.Kind == ENodeKind::Room && !States.FindChecked(Node.Id).bAvailable)
			{
				bool bIsRequiredByAnything = false;
				for (const FNodeDef& Other : Model.Nodes)
				{
					if (Other.RequiresRooms.Contains(Node.Id))
					{
						bIsRequiredByAnything = true;
						break;
					}
				}
				if (bIsRequiredByAnything)
				{
					Fail(EFailure::UnreachableRoom,
						FString::Printf(TEXT("room %s never opened but gates other nodes"), *Node.Id.ToString()));
				}
			}
		}

		// missing item: required by someone, has no supply at all this seed
		for (const FNodeDef& Node : Model.Nodes)
		{
			for (FName Required : Node.RequiresItems)
			{
				if (SupplyForItem(Model, Placement, Required) <= 0 && !States.FindChecked(Required).bAvailable)
				{
					Fail(EFailure::MissingItem,
						FString::Printf(TEXT("%s required by %s has no spawn in this seed"),
							*Required.ToString(), *Node.Id.ToString()));
				}
			}
		}

		// dedupe: the same root cause surfaces through several checks
		for (int32 i = Report.Failures.Num() - 1; i >= 0; --i)
		{
			for (int32 j = 0; j < i; ++j)
			{
				if (Report.Failures[j].Code == Report.Failures[i].Code &&
					Report.Failures[j].Detail == Report.Failures[i].Detail)
				{
					Report.Failures.RemoveAt(i);
					break;
				}
			}
		}

		Report.bSolvable = (Report.Failures.Num() == 0) && EscapeCount > 0;
		Report.ElapsedMicros = static_cast<double>(FPlatformTime::Cycles64() - StartTime) *
			FPlatformTime::GetSecondsPerCycle64() * 1e6;
		return Report;
	}
}
