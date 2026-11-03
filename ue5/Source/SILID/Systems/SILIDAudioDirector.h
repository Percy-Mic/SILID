// Audio director (spec section 22): owns the dynamic audio state. Systems
// request stingers/tension changes; the director smooths them into layers.
// Actual SoundCues are manual assets; every hook here is asset-optional so
// the game is silent-but-functional until the audio pass lands.

#pragma once

#include "GameFramework/Actor.h"
#include "SILIDAudioDirector.generated.h"

class USoundBase;
class UAudioComponent;

UCLASS()
class SILID_API ASILIDAudioDirector : public AActor
{
	GENERATED_BODY()

public:
	ASILIDAudioDirector();

	/** Ambient house loop (manual asset; rain, wind, wood settling). */
	UPROPERTY(EditDefaultsOnly, Category = "Audio")
	TObjectPtr<USoundBase> AmbientLoop;

	/** Tension layer whose intensity tracks the Resident's suspicion. */
	UPROPERTY(EditDefaultsOnly, Category = "Audio")
	TObjectPtr<USoundBase> TensionLoop;

	/** Stinger pool for horror beats (manual assets). */
	UPROPERTY(EditDefaultsOnly, Category = "Audio")
	TArray<TObjectPtr<USoundBase>> Stingers;

	/** Auto-create + play loops on begin play. */
	UPROPERTY(EditDefaultsOnly, Category = "Audio")
	bool bAutoStart = true;

	/** Play a one-shot 2D stinger (horror events, mutations). */
	UFUNCTION(BlueprintCallable, Category = "Audio")
	void PlayStinger(int32 Index = -1);

	/** Set tension 0..1 - drives the dynamic layer's volume. */
	UFUNCTION(BlueprintCallable, Category = "Audio")
	void SetTension(float Normalized);

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaTime) override;

private:
	UPROPERTY()
	TObjectPtr<UAudioComponent> AmbientComponent;

	UPROPERTY()
	TObjectPtr<UAudioComponent> TensionComponent;

	float TargetTension = 0.f;
	float CurrentTension = 0.f;
};
