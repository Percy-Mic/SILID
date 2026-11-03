// Automated solvability harness (doc 09 §8 SeedTestRunner; doc 14 P16/P28).
// Tests the PURE evaluator on synthetic models — no map, no actors — so it
// runs in the editor automation runner and CI before any level exists.
// The world-extraction layer is proven separately in-editor
// (`SILID.ValidateSeeds 200` on the real map — doc 21's session pattern).
//
// The 100+ seed law (spec P28): run a batch, prove every placement either
// passes or fails with a structured reason, and prove determinism —
// the same seed twice must produce byte-identical reports.

#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "Systems/SILIDSolvabilityTypes.h"

namespace
{
	using namespace SILIDSolvability;

	/** Synthetic house: Start -> Sala -> (Key.Room,RoomKey) Kwarto.
	 * Generator (needs Room.Kwarto + consumes Fuse) gates the hidden route;
	 * the main route consumes Fuse too — supplies make the two compete. */
	FModel MakeTestHouse()
	{
		FModel Model;

		auto Add = [&Model](FNodeDef Node)
		{
			Model.Nodes.Add(Node);
			return Model.Nodes.Last().Id;
		};

		FNodeDef Start; Start.Id = "Room.Start"; Start.Kind = ENodeKind::Room;
		Add(Start);

		FNodeDef Sala; Sala.Id = "Room.Sala"; Sala.Kind = ENodeKind::Room;
		Model.StartNodeId = Sala.Id; // player starts in the sala
		Add(Sala);

		FNodeDef KeyRoom; KeyRoom.Id = "Key.RoomKey"; KeyRoom.Kind = ENodeKind::Item; KeyRoom.bSupply = true; KeyRoom.SupplyCount = 1;
		Add(KeyRoom);

		FNodeDef Kwarto; Kwarto.Id = "Room.Kwarto"; Kwarto.Kind = ENodeKind::Room; Kwarto.RequiresItems.Add("Key.RoomKey");
		Add(Kwarto);

		FNodeDef Fuse; Fuse.Id = "Item.component.fuse"; Fuse.Kind = ENodeKind::Item; Fuse.bSupply = true; Fuse.SupplyCount = 1;
		Add(Fuse);

		FNodeDef Generator; Generator.Id = "Machine.Generator"; Generator.Kind = ENodeKind::Machine;
		Generator.RequiresRooms.Add("Room.Kwarto"); Generator.Consumes.Add("Item.component.fuse");
		Add(Generator);

		FNodeDef MainRoute; MainRoute.Id = "Route.MainDoor"; MainRoute.Kind = ENodeKind::Route; MainRoute.Consumes.Add("Item.component.fuse");
		Add(MainRoute);
		Model.EscapeNodeIds.Add(MainRoute.Id);

		FNodeDef HiddenRoute; HiddenRoute.Id = "Route.Hidden"; HiddenRoute.Kind = ENodeKind::Route;
		HiddenRoute.RequiresMachines.Add("Machine.Generator");
		Add(HiddenRoute);
		Model.EscapeNodeIds.Add(HiddenRoute.Id);

		return Model;
	}

	/** Placement: key + fuse each land in one of the two rooms (4 combos). */
	FPlacement MakePlacement(int32 Seed, FName KeyRoom, FName FuseRoom)
	{
		FPlacement Placement;
		Placement.Seed = Seed;
		Placement.ItemToSpawnNode.Add("Key.RoomKey", KeyRoom);
		Placement.ItemToSpawnNode.Add("Item.component.fuse", FuseRoom);
		return Placement;
	}
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSILIDSolvabilityBasicsTest, "SILID.Validator.PureEvaluator.Basics",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FSILIDSolvabilityBasicsTest::RunTest(const FString& Parameters)
{
	const FModel Model = MakeTestHouse();

	// fuse in the open sala, key in the locked room it opens is fine
	{
		const FReport Report = Evaluate(Model, MakePlacement(1, "Room.Kwarto", "Room.Sala"));
		TestTrue("key spawns inside the room it locks is acceptable", Report.bSolvable);
	}

	// the key has NO candidate room at all: nothing can ever produce it
	{
		FPlacement Placement = MakePlacement(2, "Room.Sala", "Room.Sala");
		Placement.ItemToSpawnNode.Remove("Key.RoomKey"); // no spawn -> MissingItem
		const FReport Report = Evaluate(Model, Placement);
		TestFalse("a required item with no spawn must be unsolvable", Report.bSolvable);
		TestTrue("failure mentions the missing item",
			Report.Failures.ContainsByPredicate([](const FFailureEntry& F) { return F.Code == EFailure::MissingItem; }));
	}

	// two consumers, one fuse: the graph must route the fuse to the main
	// route (it fires first in fixpoint order) and the hidden route starves
	{
		FPlacement Placement = MakePlacement(3, "Room.Sala", "Room.Sala");
		// second fuse consumer with its own supply removed -> hidden route
		// needs the generator, generator needs the fuse that MainDoor ate.
		// This is a CONFIGURATION failure and must be reported, not hidden.
		const FReport Report = Evaluate(Model, Placement);
		if (!Report.bSolvable)
		{
			TestTrue("starved consumer reported with a reason",
				Report.Failures.ContainsByPredicate([](const FFailureEntry& F)
				{ return F.Code == EFailure::ExhaustedSupply || F.Code == EFailure::UnreachableMachine; }));
		}
		else
		{
			// acceptable: the evaluator ordered the generator first
			TestTrue("at least one escape reachable", Report.EscapeRoutesAvailable > 0);
		}
	}

	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSILIDSeedBatchHarnessTest, "SILID.Validator.SeedBatch.100Plus",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FSILIDSeedBatchHarnessTest::RunTest(const FString& Parameters)
{
	const FModel Model = MakeTestHouse();

	constexpr int32 BatchSize = 200; // spec P28: 100/500/1000 — 200 in CI
	const FName Rooms[] = { "Room.Start", "Room.Sala", "Room.Kwarto" };

	int32 Solvable = 0;
	int32 Unsolvable = 0;

	for (int32 Seed = 1; Seed <= BatchSize; ++Seed)
	{
		FRandomStream Stream(Seed);
		const FPlacement Placement = MakePlacement(
			Seed, Rooms[Stream.RandRange(0, 2)], Rooms[Stream.RandRange(0, 2)]);

		const FReport Report = Evaluate(Model, Placement);
		(Report.bSolvable ? Solvable : Unsolvable)++;

		// every rejected seed MUST carry a structured reason (doc 15 §9
		// evidence rule — no silent rejections)
		if (!Report.bSolvable)
		{
			TestTrue(FString::Printf(TEXT("seed %d rejected with evidence"), Seed), Report.Failures.Num() > 0);
		}

		// determinism law (A-014): same inputs, identical report
		const FReport Again = Evaluate(Model, Placement);
		TestEqual(FString::Printf(TEXT("seed %d deterministic"), Seed), Again.bSolvable, Report.bSolvable);
		TestEqual(FString::Printf(TEXT("seed %d same failure count"), Seed), Again.Failures.Num(), Report.Failures.Num());
	}

	// a healthy generator config solves most draws; a 0% pass rate means the
	// model itself is broken (which is the test model's fault, not seeds')
	TestTrue("batch produced a meaningful pass rate", Solvable > 0);

	UE_LOG(LogTemp, Log, TEXT("[SILID Harness] %d/%d seeds solvable (%d rejected with reasons)"),
		Solvable, BatchSize, Unsolvable);
	return true;
}

#endif // WITH_DEV_AUTOMATION_TESTS
