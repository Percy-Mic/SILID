#include "Systems/SILIDFlashlightComponent.h"
#include "Systems/SILIDTypes.h"
#include "Systems/SILIDNoiseEmitterComponent.h"
#include "Systems/SILIDTags.h"
#include "Systems/SILIDDifficultySubsystem.h"
#include "Camera/CameraComponent.h"
#include "Components/SpotLightComponent.h"
#include "GameFramework/Character.h"
#include "Logging/SILIDLog.h"

USILIDFlashlightComponent::USILIDFlashlightComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.f;
}

void USILIDFlashlightComponent::BeginPlay()
{
	Super::BeginPlay();

	BatterySeconds = MaxBatterySeconds;

	// build the light rig on the owning character's camera if present
	if (ACharacter* Char = Cast<ACharacter>(GetOwner()))
	{
		if (UCameraComponent* Cam = Char->FindComponentByClass<UCameraComponent>())
		{
			Light = NewObject<USpotLightComponent>(Char);
			Light->SetupAttachment(Cam);
			Light->RegisterComponent();
			Light->SetRelativeLocation(FVector(10.f, 0.f, 0.f));
			Light->SetRelativeRotation(FRotator(0.f, 90.f, 0.f));
			Light->SetLightColor(FColor(0xfff2d8));
			Light->SetIntensity(2600.f); // candela; tuned for Lumen interior night
			Light->SetAttenuationRadius(1800.f);
			Light->SetInnerConeAngle(14.f);
			Light->SetOuterConeAngle(32.f);
			Light->CastShadows = true;
			Light->SetVisibility(false);
		}
	}
	if (!Light)
	{
		SILID_WARN_CAT(LogSILID, TEXT("FlashlightComponent on %s found no camera - no light rig"), *GetOwner()->GetName());
	}
}

void USILIDFlashlightComponent::Toggle()
{
	SetOn(!bFlashlightOn);
}

void USILIDFlashlightComponent::SetOn(bool bOn)
{
	if (bOn && BatterySeconds <= 0.f)
	{
		// dead battery: a click, no light
		bFlashlightOn = false;
		ApplyLightState();
		OnBatteryChanged.Broadcast(0.f, false);
		return;
	}

	bFlashlightOn = bOn;
	ApplyLightState();
	OnBatteryChanged.Broadcast(GetBatteryNormalized(), bFlashlightOn);

	// turning a light on or off is a small noise (spec section 8: devices)
	if (AActor* Owner = GetOwner())
	{
		if (USILIDNoiseEmitterComponent* Emitter = Owner->FindComponentByClass<USILIDNoiseEmitterComponent>())
		{
			Emitter->EmitNoise(FVector(0.18f), SILIDTags::NoiseDevice);
		}
	}
}

void USILIDFlashlightComponent::AddBatteryCharge(float Seconds)
{
	BatterySeconds = FMath::Min(BatterySeconds + Seconds, MaxBatterySeconds);
	OnBatteryChanged.Broadcast(GetBatteryNormalized(), bFlashlightOn);
}

void USILIDFlashlightComponent::TriggerFlicker(float Duration)
{
	bFlickerActive = true;
	FlickerTime = Duration;
}

void USILIDFlashlightComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	// battery drain (difficulty scales drain on Hard)
	if (bFlashlightOn && BatterySeconds > 0.f)
	{
		float Drain = DrainPerSecond;
		if (const USILIDDifficultySubsystem* Diff = USILIDDifficultySubsystem::Get(this))
		{
			Drain *= Diff->GetFlashlightDrainMultiplier();
		}
		BatterySeconds = FMath::Max(0.f, BatterySeconds - Drain * DeltaTime);
		if (BatterySeconds <= 0.f)
		{
			bFlashlightOn = false;
		}
		static float Accum = 0.f;
		Accum += DeltaTime;
		if (Accum > 1.f)
		{
			Accum = 0.f;
			OnBatteryChanged.Broadcast(GetBatteryNormalized(), bFlashlightOn);
		}
	}

	// flicker
	if (bFlickerActive)
	{
		FlickerTime -= DeltaTime;
		FlickerSwap -= DeltaTime;
		if (FlickerSwap <= 0.f)
		{
			FlickerSwap = FMath::RandRange(0.03f, 0.12f);
			bFlickerOn = !bFlickerOn;
		}
		if (Light)
		{
			Light->SetIntensity(bFlickerOn ? 2600.f : 40.f);
		}
		if (FlickerTime <= 0.f)
		{
			bFlickerActive = false;
			ApplyLightState();
		}
	}
}

void USILIDFlashlightComponent::ApplyLightState()
{
	if (Light)
	{
		Light->SetVisibility(bFlashlightOn);
		Light->SetIntensity(bFlashlightOn ? 2600.f : 0.f);
	}
}
