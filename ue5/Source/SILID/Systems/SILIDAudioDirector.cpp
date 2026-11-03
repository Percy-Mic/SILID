#include "Systems/SILIDAudioDirector.h"
#include "Components/AudioComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Logging/SILIDLog.h"

ASILIDAudioDirector::ASILIDAudioDirector()
{
	PrimaryActorTick.bCanEverTick = true;
}

void ASILIDAudioDirector::BeginPlay()
{
	Super::BeginPlay();

	if (bAutoStart)
	{
		if (AmbientLoop)
		{
			AmbientComponent = UGameplayStatics::SpawnSound2D(this, AmbientLoop, 0.8f, 1.f, 0.f, nullptr, true);
		}
		if (TensionLoop)
		{
			TensionComponent = UGameplayStatics::SpawnSound2D(this, TensionLoop, 0.f, 1.f, 0.f, nullptr, true);
		}
	}
}

void ASILIDAudioDirector::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	// smooth the tension layer (no abrupt jumps: dread, not startle)
	CurrentTension = FMath::FInterpTo(CurrentTension, TargetTension, DeltaTime, 0.8f);
	if (TensionComponent)
	{
		TensionComponent->SetVolumeMultiplier(CurrentTension);
	}
}

void ASILIDAudioDirector::PlayStinger(int32 Index)
{
	if (Stingers.Num() == 0)
	{
		return;
	}
	const int32 Idx = Index >= 0 && Index < Stingers.Num() ? Index : FMath::RandRange(0, Stingers.Num() - 1);
	if (USoundBase* Cue = Stingers[Idx].Get())
	{
		UGameplayStatics::PlaySound2D(this, Cue);
	}
}

void ASILIDAudioDirector::SetTension(float Normalized)
{
	TargetTension = FMath::Clamp(Normalized, 0.f, 1.f);
}
