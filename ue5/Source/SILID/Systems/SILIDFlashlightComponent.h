// Flashlight component (spec section 11). Owns the SpotLight and the battery
// economy; the character just toggles it. Flicker reacts to horror events.

#pragma once

#include "Components/ActorComponent.h"
#include "SILIDFlashlightComponent.generated.h"

class USpotLightComponent;
class UPointLightComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnBatteryChanged, float, Normalized, bool, bFlashlightOn);

UCLASS(ClassGroup = (SILID), meta = (BlueprintSpawnableComponent))
class SILID_API USILIDFlashlightComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	USILIDFlashlightComponent();

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Flashlight")
	float MaxBatterySeconds = 420.f; // 7 minutes of continuous use

	/** Drain rate multiplier on Hard; difficulty scales the economy. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Flashlight", meta = (ClampMin = "0.1"))
	float DrainPerSecond = 1.f;

	UPROPERTY(BlueprintReadOnly, Category = "Flashlight")
	bool bFlashlightOn = false;

	UPROPERTY(BlueprintAssignable, Category = "Flashlight")
	FOnBatteryChanged OnBatteryChanged;

	UFUNCTION(BlueprintCallable, Category = "Flashlight")
	void Toggle();

	UFUNCTION(BlueprintCallable, Category = "Flashlight")
	void SetOn(bool bOn);

	/** Batteries add minutes of charge (stacks to max). */
	UFUNCTION(BlueprintCallable, Category = "Flashlight")
	void AddBatteryCharge(float Seconds);

	UFUNCTION(BlueprintPure, Category = "Flashlight")
	float GetBatteryNormalized() const { return MaxBatterySeconds > 0.f ? BatterySeconds / MaxBatterySeconds : 0.f; }

	UFUNCTION(BlueprintPure, Category = "Flashlight")
	bool IsFlickering() const { return bFlickerActive; }

	/** Horror events can force a flicker burst. */
	UFUNCTION(BlueprintCallable, Category = "Flashlight")
	void TriggerFlicker(float Duration = 1.2f);

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY()
	TObjectPtr<USpotLightComponent> Light;

	float BatterySeconds = 0.f;
	bool bFlickerActive = false;
	float FlickerTime = 0.f;
	float FlickerSwap = 0.f;
	bool bFlickerOn = true;

	void ApplyLightState();
};
