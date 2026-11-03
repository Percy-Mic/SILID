#include "Puzzles/SILIDRadio.h"
#include "Systems/SILIDNoiseEmitterComponent.h"
#include "Systems/SILIDTags.h"
#include "Systems/SILIDSaveGame.h"
#include "Player/SILIDPlayerController.h"
#include "Player/SILIDCharacter.h"
#include "Components/StaticMeshComponent.h"
#include "Components/AudioComponent.h"
#include "Logging/SILIDLog.h"

ASILIDRadio::ASILIDRadio()
{
	PrimaryActorTick.bCanEverTick = false;

	BodyMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("BodyMesh"));
	RootComponent = BodyMesh;
	BodyMesh->SetCollisionProfileName(TEXT("BlockAll"));

	NoiseEmitter = CreateDefaultSubobject<USILIDNoiseEmitterComponent>(TEXT("NoiseEmitter"));

	StaticLoop = CreateDefaultSubobject<UAudioComponent>(TEXT("StaticLoop"));
	StaticLoop->SetupAttachment(RootComponent);
	StaticLoop->bAutoActivate = false; // sound asset is a manual import

	// RADIO RIDDLE (spec: numbers correspond to a lock) - the broadcast is a
	// date; the safe wants the year as its code. Designer sets both sides.
	BroadcastText = NSLOCTEXT("SILID", "RadioBroadcast",
		"...tatlong susi... tatlong taon... 1962... 1972... 1987...");
}

void ASILIDRadio::BeginPlay()
{
	Super::BeginPlay();

	if (USILIDSaveSubsystem* Save = GetWorld()->GetSubsystem<USILIDSaveSubsystem>())
	{
		Save->RegisterSaveable(this);
	}
}

bool ASILIDRadio::IsOnTruthFrequency() const
{
	return FMath::Abs(CurrentFrequency - TruthFrequency) < 0.15f;
}

bool ASILIDRadio::Tune(float DeltaFrequency)
{
	CurrentFrequency = FMath::Clamp(CurrentFrequency + DeltaFrequency, 88.f, 108.f);
	const bool bTruth = IsOnTruthFrequency();

	// tuning is audible (spec section 8: devices)
	if (NoiseEmitter)
	{
		NoiseEmitter->EmitNoise(FVector(0.4f, 0, 0), SILIDTags::NoiseDevice);
	}

	OnTuned.Broadcast(bTruth, CurrentFrequency);

	if (bTruth && !bBroadcasting)
	{
		bBroadcasting = true;
		if (StaticLoop)
		{
			StaticLoop->Activate();
		}
		SILID_LOG_CAT(LogSILID, TEXT("Radio tuned to truth frequency %.1f"), CurrentFrequency);
	}
	return bTruth;
}

bool ASILIDRadio::Interact(ASILIDCharacter* Player)
{
	// E nudges the dial; repeated presses scan for the frequency
	if (Tune(0.4f))
	{
		if (Player)
		{
			if (ASILIDPlayerController* PC = Cast<ASILIDPlayerController>(Player->GetController()))
			{
				PC->ShowExamineText(BroadcastText);
			}
		}
		return true;
	}
	return false;
}

FText ASILIDRadio::GetInteractionText(const ASILIDCharacter* Player) const
{
	return NSLOCTEXT("SILID", "RadioTune", "Turn the dial");
}

FText ASILIDRadio::GetExamineText(const ASILIDCharacter* Player) const
{
	return FText::Format(NSLOCTEXT("SILID", "RadioFreqFmt", "An old transistor radio. The needle rests at {0}. Between the static, something almost sounds like counting."),
		FText::AsNumber(CurrentFrequency));
}

void ASILIDRadio::OnSave(USILIDSaveGame* SaveGame)
{
	if (SaveGame)
	{
		SaveGame->Counters.Add(GetSaveId() + TEXT("_Freq"), FMath::RoundToInt(CurrentFrequency * 10));
	}
}

void ASILIDRadio::OnLoad(const USILIDSaveGame* SaveGame)
{
	if (const int32* Found = SaveGame ? SaveGame->Counters.Find(GetSaveId() + TEXT("_Freq")) : nullptr)
	{
		CurrentFrequency = *Found / 10.f;
		bBroadcasting = IsOnTruthFrequency();
	}
}
