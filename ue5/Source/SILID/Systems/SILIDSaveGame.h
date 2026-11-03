// Versioned save payload (spec section 20). Everything persists through
// generic maps keyed by stable string ids - expanding the schema never
// breaks old saves because SaveVersion gates migrations.

#pragma once

#include "GameFramework/SaveGame.h"
#include "SILIDSaveGame.generated.h"

/** SaveGame reflection does not support nested containers such as TMap<K, TArray<V>>. */
USTRUCT()
struct FSILIDNameListEntry
{
	GENERATED_BODY()

	UPROPERTY()
	FString Key;

	UPROPERTY()
	TArray<FName> Values;
};

UCLASS()
class SILID_API USILIDSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	/** Bump on schema changes; the save subsystem migrates older versions. */
	static constexpr int32 CurrentVersion = 1;

	UPROPERTY(VisibleAnywhere, Category = "Save")
	int32 SaveVersion = CurrentVersion;

	/** When this save was written (unix seconds). */
	UPROPERTY(VisibleAnywhere, Category = "Save")
	int64 SavedTimestamp = 0;

	// ---- player ----
	UPROPERTY(SaveGame)
	FTransform PlayerTransform = FTransform::Identity;

	UPROPERTY(SaveGame)
	float PlayerHealth = 100.f;

	UPROPERTY(SaveGame)
	float FlashlightBattery = 420.f;

	/** Serialized inventory: flat list of item ids (see InventoryComponent). */
	UPROPERTY(SaveGame)
	TArray<FSILIDNameListEntry> NameList;

	// ---- world / story ----
	/** Generic story/world flags keyed by stable ids. */
	UPROPERTY(SaveGame)
	TMap<FString, bool> Flags;

	/** Generic numeric states (puzzle progress, mutation counters...). */
	UPROPERTY(SaveGame)
	TMap<FString, int32> Counters;

	/** Generic transforms (moved furniture, opened leaves...). */
	UPROPERTY(SaveGame)
	TMap<FString, FTransform> Transforms;

	/** Collected/clued document ids for the journal. */
	UPROPERTY(SaveGame)
	TArray<FName> ReadDocuments;

	/** Difficulty the run started with (spec section 21). */
	UPROPERTY(SaveGame)
	uint8 Difficulty = 1; // EDifficulty

	/** The randomizer seed this run was generated from (spec: replayability
	 * + "same seed -> same house"). Restored on load. */
	UPROPERTY(SaveGame)
	int32 RunSeed = 0;

	/** Which escape route (EEscapeRoute) the player escaped through, -1 if none. */
	UPROPERTY(SaveGame)
	int32 EscapeRouteUsed = -1;

	// ---- helpers ----
	bool IsCompatible() const { return SaveVersion <= CurrentVersion; }
};
