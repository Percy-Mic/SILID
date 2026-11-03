// Shared gameplay types: item defs, difficulty, noise events, resident states.
// Data lives in DataTables/Data Assets; these structs are the schema.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "SILIDTypes.generated.h"

/** How an item can be used from the inventory. */
UENUM(BlueprintType)
enum class EItemType : uint8
{
	Key        UMETA(DisplayName = "Key"),        // unlocks door/lock ids
	Tool       UMETA(DisplayName = "Tool"),       // used on the world (fuse, cutter)
	Consumable UMETA(DisplayName = "Consumable"), // battery, medicine
	Document   UMETA(DisplayName = "Document"),   // readable: notes, photos
	PuzzleItem UMETA(DisplayName = "Puzzle Item"),// feeds a puzzle (crank, fuse)
	Quest      UMETA(DisplayName = "Quest Item")  // pure story carries
};

/** Escape routes (spec: multiple escape paths). Each SILIDEscapeRoute actor
 * declares which one it is; the HUD and save system key off this enum. */
UENUM(BlueprintType)
enum class EEscapeRoute : uint8
{
	MainDoor  UMETA(DisplayName = "Main Door"),   // components + padlock
	BackDoor  UMETA(DisplayName = "Back Door"),   // different components
	Window    UMETA(DisplayName = "Window"),      // tool route
	Hidden    UMETA(DisplayName = "Hidden Route") // discovered mechanism
};

/** Global difficulty - modifies AI, resources, hint visibility. Spec section 21. */
UENUM(BlueprintType)
enum class EDifficulty : uint8
{
	Easy    UMETA(DisplayName = "Madali"),
	Normal  UMETA(DisplayName = "Karaniwan"),
	Hard    UMETA(DisplayName = "Mahirap")
};

/** Run lifecycle phase (doc 12 §1: the replicated run phase).
 * The server (ASILIDGameMode) owns the run rules; ASILIDGameState mirrors this
 * phase to clients so HUD/audio can react without polling. */
UENUM(BlueprintType)
enum class ESILIDRunPhase : uint8
{
	Menu      UMETA(DisplayName = "Menu"),      // not in a run (front end)
	Exploring UMETA(DisplayName = "Exploring"), // the run is live
	Escaped   UMETA(DisplayName = "Escaped"),   // a route fired - the run is won
	Dead      UMETA(DisplayName = "Dead")       // the run ended in death
};

/** One audible event in the world. The Resident's hearing consumes these. */
USTRUCT(BlueprintType)
struct FSILIDNoiseEvent
{
	GENERATED_BODY()

	/** Where the sound happened. */
	UPROPERTY(BlueprintReadWrite)
	FVector Location = FVector::ZeroVector;

	/** 0..1 loudness; scales investigation radius. A pin drop ~0.1, a scream 1.0. */
	UPROPERTY(BlueprintReadWrite, meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Loudness = 0.5f;

	/** Tag identifying the sound: Noise.Footstep, Noise.Door, Noise.Impact, Noise.Device... */
	UPROPERTY(BlueprintReadWrite)
	FGameplayTag NoiseTag;

	/** World time the noise was produced. */
	UPROPERTY(BlueprintReadWrite)
	float TimeProduced = 0.f;

	float GetInvestigationRadius(float BaseRadius) const { return BaseRadius * (0.35f + Loudness); }
};

/** Resident AI states (spec section 7). Kept in one place so UI can show state names. */
UENUM(BlueprintType)
enum class EResidentState : uint8
{
	Idle            UMETA(DisplayName = "Idle"),
	Patrol          UMETA(DisplayName = "Patrol"),
	Wander          UMETA(DisplayName = "Wander"),
	Hear            UMETA(DisplayName = "Hear"),
	Investigate     UMETA(DisplayName = "Investigate"),
	Suspicious      UMETA(DisplayName = "Suspicious"),
	Search          UMETA(DisplayName = "Search"),
	DetectPlayer    UMETA(DisplayName = "Detect Player"),
	Chase           UMETA(DisplayName = "Chase"),
	Attack          UMETA(DisplayName = "Attack"),
	LosePlayer      UMETA(DisplayName = "Lose Player"),
	SearchLastKnown UMETA(DisplayName = "Search Last Known"),
	ReturnToPatrol  UMETA(DisplayName = "Return To Patrol")
};

/** Severity of a room mutation for the dynamic room system. */
UENUM(BlueprintType)
enum class ERoomMutationSeverity : uint8
{
	Ambient   UMETA(DisplayName = "Ambient"),   // objects drift, sounds
	Unsettling UMETA(DisplayName = "Unsettling"),// furniture moves, photos change
	Violating UMETA(DisplayName = "Violating")  // doors move, rooms change/lock
};

/**
 * Structured failure codes (doc 12 §6): interactions never fail silently —
 * every failed operation reports WHY, driving both logs and the HUD's
 * "needs X" prompts. New APIs return FSILIDOperationResult; existing bool
 * APIs migrate when touched, not before.
 */
UENUM(BlueprintType)
enum class ESILIDFailureCode : uint8
{
	None             UMETA(DisplayName = "None"),              // success
	MissingTool      UMETA(DisplayName = "Missing Tool"),      // no tool with the capability/tag
	MissingComponent UMETA(DisplayName = "Missing Component"), // fuse, valve wheel...
	MissingKey       UMETA(DisplayName = "Missing Key"),
	NoPower          UMETA(DisplayName = "No Power"),          // device needs its Power.Node alive (P8)
	InvalidState     UMETA(DisplayName = "Invalid State")      // e.g. repairing something that works
};

/** Result of an operation that can fail for a named reason (doc 12 §6). */
USTRUCT(BlueprintType)
struct FSILIDOperationResult
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly)
	bool bSuccess = false;

	UPROPERTY(BlueprintReadOnly)
	ESILIDFailureCode Code = ESILIDFailureCode::None;

	/** Player-facing line (HUD prompt / examine). Empty on success. */
	UPROPERTY(BlueprintReadOnly)
	FText Message;

	/** The id/tag the failure is about (item id, component tag...). */
	UPROPERTY(BlueprintReadOnly)
	FName RelevantId;

	static FSILIDOperationResult Success() { FSILIDOperationResult R; R.bSuccess = true; return R; }
	static FSILIDOperationResult Fail(ESILIDFailureCode InCode, const FText& InMessage, FName InRelevantId = NAME_None)
	{
		FSILIDOperationResult R;
		R.bSuccess = false;
		R.Code = InCode;
		R.Message = InMessage;
		R.RelevantId = InRelevantId;
		return R;
	}
};
