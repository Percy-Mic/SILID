// Noise emitter component (spec section 8). Any actor can carry one; systems
// call EmitNoise and every Resident hears it (via a multicast delegate).
// Loudness 0..1; tags classify the sound so AI can react differently.

#pragma once

#include "Components/ActorComponent.h"
#include "GameplayTagContainer.h"
#include "Systems/SILIDTypes.h"
#include "SILIDNoiseEmitterComponent.generated.h"

DECLARE_MULTICAST_DELEGATE_OneParam(FOnNoiseEmitted, const FSILIDNoiseEvent&);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnNoiseEmittedBP, const FSILIDNoiseEvent&, Event);

UCLASS(ClassGroup = (SILID), meta = (BlueprintSpawnableComponent))
class SILID_API USILIDNoiseEmitterComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	USILIDNoiseEmitterComponent();

	/** Static sink every Resident subscribes to (process-wide hearing bus). */
	static FOnNoiseEmitted OnNoiseEmitted;

	/** Blueprint-visible mirror of the bus for UI/debug listeners. */
	UPROPERTY(BlueprintAssignable, Category = "Noise")
	FOnNoiseEmittedBP OnNoiseEmittedBP;

	/**
	 * Emit a noise at a world location (defaults to owner position).
	 * Loudness 0..1; use SILIDTags::Noise* constants.
	 */
	UFUNCTION(BlueprintCallable, Category = "Noise", meta = (AutoCreateRefTerm = "Loudness,NoiseTag,AtLocation"))
	void EmitNoise(FVector LoudnessOrLocation, FGameplayTag NoiseTag, FVector AtLocation = FVector::ZeroVector);

private:
	float PendingLoudness = 0.f; // transient transport for the BP signature
};
