#include "Systems/SILIDNoiseEmitterComponent.h"
#include "GameFramework/Actor.h"
#include "Engine/World.h"

FOnNoiseEmitted USILIDNoiseEmitterComponent::OnNoiseEmitted;

USILIDNoiseEmitterComponent::USILIDNoiseEmitterComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void USILIDNoiseEmitterComponent::EmitNoise(FVector LoudnessOrLocation, FGameplayTag NoiseTag, FVector AtLocation)
{
	// Blueprint-friendly overload: first param is loudness (X channel) unless
	// AtLocation is provided, in which case it is the location.
	const float Loudness = FMath::Clamp(LoudnessOrLocation.X, 0.f, 1.f);
	FSILIDNoiseEvent Event;
	Event.Loudness = Loudness;
	Event.NoiseTag = NoiseTag;
	Event.TimeProduced = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.f;
	Event.Location = AtLocation.IsNearlyZero()
		? (GetOwner() ? GetOwner()->GetActorLocation() : FVector::ZeroVector)
		: AtLocation;

	OnNoiseEmitted.Broadcast(Event);
	OnNoiseEmittedBP.Broadcast(Event);
}
