// Dynamic Room System (spec section 16): SILID's signature mechanic.
// RoomZone actors define room volumes with visit counters and mutation
// tables; the RoomDirector applies staged mutations as visits accumulate.
// Mutations are DATA (structs in arrays), not hardcoded per-room code.

#pragma once

#include "GameFramework/Actor.h"
#include "Systems/SILIDTypes.h"
#include "SILIDRoomDirector.generated.h"

class UBoxComponent;
class USILIDNoiseEmitterComponent;

/** One staged change to a room (designer-authored, data-driven). */
USTRUCT(BlueprintType)
struct FRoomMutation
{
	GENERATED_BODY()

	/** Applied when this room's visit count reaches this number. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Mutation", meta = (ClampMin = "1"))
	int32 VisitNumber = 2;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Mutation")
	ERoomMutationSeverity Severity = ERoomMutationSeverity::Unsettling;

	/** The line the game whispers when this hits (environmental storytelling). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Mutation", meta = (MultiLine = true))
	FText AnnounceLine;

	/** Furniture/prop actors to relocate. Keys pair with TargetTransforms. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Mutation")
	TMap<FName, FTransform> PropTransforms;

	/** Doors to force open (they creak; the Resident hears doors). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Mutation")
	TArray<FName> DoorsToOpen;

	/** Doors to slam shut / lock (spec: "doors that were open become locked"). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Mutation")
	TArray<FName> DoorsToClose;

	/** Ambient sound to play once (manual asset reference by soft path). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Mutation")
	TSoftObjectPtr<USoundBase> Stinger;
};

/** A room volume with its staged mutation table. */
UCLASS(Blueprintable)
class SILID_API ASILIDRoomZone : public AActor
{
	GENERATED_BODY()

public:
	ASILIDRoomZone();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Room")
	TObjectPtr<UBoxComponent> Volume;

	/** Room tag (Room.Sala etc.) so systems can address the room by tag. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Room")
	FGameplayTag RoomTag;

	/** Stable save id. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Save")
	FName SaveId;

	/** The staged mutations, ordered by VisitNumber. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Room")
	TArray<FRoomMutation> Mutations;

	UPROPERTY(BlueprintReadOnly, Category = "Room")
	int32 VisitCount = 0;

	/** Resolved actor names (in this level) that mutations can address. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Room")
	TMap<FName, TSoftObjectPtr<AActor>> NamedProps;

	bool IsPlayerInside() const;
};

/**
 * The director ticks rooms, counts visits, applies mutations, and escalates
 * the house's hostility as chapters progress (spec sections 15, 16, 19).
 */
UCLASS(Blueprintable)
class SILID_API ASILIDRoomDirector : public AActor
{
	GENERATED_BODY()

public:
	ASILIDRoomDirector();

	/** All RoomZones in the level (auto-found). */
	UPROPERTY(BlueprintReadOnly, Category = "Rooms")
	TArray<ASILIDRoomZone*> Zones;

	/** Seconds between visit checks. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Rooms")
	float CheckInterval = 0.5f;

	/** Fired when a room mutates (UI shows AnnounceLine). */
	DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnRoomMutated, ASILIDRoomZone*, Zone, const FRoomMutation&, Mutation);
	UPROPERTY(BlueprintAssignable, Category = "Rooms")
	FOnRoomMutated OnRoomMutated;

	UFUNCTION(BlueprintCallable, Category = "Rooms")
	void ApplyMutation(ASILIDRoomZone* Zone, const FRoomMutation& Mutation);

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaTime) override;

private:
	FTimerHandle CheckTimer;
	float CheckAccum = 0.f;

	/** Mutations already applied (save-persistent keys). */
	TSet<FString> AppliedKeys;

	void CheckVisits();
};
