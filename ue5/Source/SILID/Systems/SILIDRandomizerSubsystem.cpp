// Randomizer implementation: seeded family scatter, guaranteed-first.

#include "Systems/SILIDRandomizerSubsystem.h"
#include "Systems/SILIDSpawnPoint.h"
#include "Systems/SILIDDifficultySubsystem.h"
#include "Systems/SILIDGameMode.h"
#include "Misc/DateTime.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"

void USILIDRandomizerSubsystem::OnWorldBeginPlay(UWorld& InWorld)
{
	Super::OnWorldBeginPlay(InWorld);

	// difficulty scales loot counts (spec section 21: fewer resources on Hard)
	if (const USILIDDifficultySubsystem* Diff = InWorld.GetSubsystem<USILIDDifficultySubsystem>())
	{
		LootMultiplier = Diff->GetResourceMultiplier();
	}

	// seed: the GameMode generated one for this run (or a load restored it
	// before BeginPlay finished). Fall back to time for PIE-less runs.
	int32 Seed = static_cast<int32>(FDateTime::UtcNow().ToUnixTimestamp() % 2147483647);
	if (const ASILIDGameMode* GM = Cast<ASILIDGameMode>(UGameplayStatics::GetGameMode(&InWorld)))
	{
		Seed = GM->GetRunSeed() != 0 ? GM->GetRunSeed() : Seed;
	}
	RandomizeAll(Seed);
}

void USILIDRandomizerSubsystem::RegisterPoint(ASILIDSpawnPoint* Point)
{
	if (!Point || Point->Family.IsNone())
	{
		return;
	}
	FSILIDFamilyPool& Pool = Families.FindOrAdd(Point->Family);
	Pool.Points.AddUnique(Point);
	if (Pool.DesiredCount == 0)
	{
		Pool.DesiredCount = 1;
	}
}

void USILIDRandomizerSubsystem::RandomizeAll(int32 Seed)
{
	CurrentSeed = Seed;
	FRandomStream Stream(Seed);

	// reset previous choices so restart re-randomizes cleanly
	for (TPair<FName, FSILIDFamilyPool>& Pair : Families)
	{
		for (const TObjectPtr<ASILIDSpawnPoint>& P : Pair.Value.Points)
		{
			if (P)
			{
				P->Deactivate();
			}
		}
		Pair.Value.Chosen.Reset();
	}

	// designers tune desired counts per family before BeginPlay via BP;
	// defaults: 1 per family, scaled by difficulty for loot families
	for (TPair<FName, FSILIDFamilyPool>& Pair : Families)
	{
		FSILIDFamilyPool& Pool = Pair.Value;

		const bool bLoot = Pair.Key.ToString().StartsWith(TEXT("Items."));
		int32 Count = FMath::Max(1, FMath::RoundToInt(Pool.DesiredCount * (bLoot ? LootMultiplier : 1.f)));
		Count = FMath::Min(Count, Pool.Points.Num());

		ScatterFamily(Pool, Stream, Count, Pair.Key.ToString().StartsWith(TEXT("Guaranteed")));
	}
}

void USILIDRandomizerSubsystem::ScatterFamily(FSILIDFamilyPool& Pool, FRandomStream& Stream, int32 Count, bool bGuaranteed)
{
	if (Pool.Points.Num() == 0)
	{
		return;
	}

	// Fisher-Yates with the seeded stream — deterministic per seed
	TArray<ASILIDSpawnPoint*> Shuffled;
	for (const TObjectPtr<ASILIDSpawnPoint>& P : Pool.Points)
	{
		if (P)
		{
			Shuffled.Add(P);
		}
	}
	for (int32 i = Shuffled.Num() - 1; i > 0; --i)
	{
		const int32 j = Stream.RandRange(0, i);
		Shuffled.Swap(i, j);
	}

	const int32 Take = bGuaranteed ? FMath::Max(1, Count) : Count;
	for (int32 i = 0; i < Take && i < Shuffled.Num(); ++i)
	{
		ASILIDSpawnPoint* Point = Shuffled[i];
		if (!Point)
		{
			continue;
		}
		Point->Activate();
		Pool.Chosen.Add(Point);
	}
}
