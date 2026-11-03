#include "AI/SILIDResident.h"
#include "AI/SILIDResidentController.h"
#include "Systems/SILIDNoiseEmitterComponent.h"
#include "Systems/SILIDTags.h"
#include "Components/CapsuleComponent.h"
#include "Perception/AIPerceptionComponent.h"
#include "Perception/AISenseConfig_Sight.h"
#include "Perception/AISenseConfig_Hearing.h"
#include "Logging/SILIDLog.h"

ASILIDResident::ASILIDResident()
{
	PrimaryActorTick.bCanEverTick = true;

	// placeholder body: slim adult silhouette; replace with MetaHuman/CC4 rig
	GetCapsuleComponent()->InitCapsuleSize(34.f, 92.f);

	NoiseEmitter = CreateDefaultSubobject<USILIDNoiseEmitterComponent>(TEXT("NoiseEmitter"));

	Perception = CreateDefaultSubobject<UAIPerceptionComponent>(TEXT("Perception"));

	// ---- sight (spec section 9: not a distance check) ----
	SightConfig = CreateDefaultSubobject<UAISenseConfig_Sight>(TEXT("SightConfig"));
	SightConfig->SightRadius = 900.f;          // clear-view range
	SightConfig->LoseSightRadius = 1150.f;     // hysteresis past the sight radius
	SightConfig->PeripheralVisionAngleDegrees = 62.f; // ~124deg FOV cone
	SightConfig->DetectionByAffiliation.bDetectEnemies = true;
	SightConfig->DetectionByAffiliation.bDetectNeutrals = true;
	SightConfig->DetectionByAffiliation.bDetectFriendlies = true;
	SightConfig->AutoSuccessRangeFromLastSeenLocation = 120.f;

	// ---- hearing (spec section 8) ----
	HearingConfig = CreateDefaultSubobject<UAISenseConfig_Hearing>(TEXT("HearingConfig"));
	HearingConfig->HearingRange = 2200.f;      // loudness scales the effective range
	HearingConfig->DetectionByAffiliation.bDetectEnemies = true;
	HearingConfig->DetectionByAffiliation.bDetectNeutrals = true;
	HearingConfig->DetectionByAffiliation.bDetectFriendlies = true;

	Perception->ConfigureSense(*SightConfig);
	Perception->ConfigureSense(*HearingConfig);
	Perception->SetDominantSense(UAISense_Sight::StaticClass());
}

void ASILIDResident::BeginPlay()
{
	Super::BeginPlay();

	// ambient presence: distant floorboards under his weight
	if (AmbientSoundInterval > 0.f)
	{
		GetWorldTimerManager().SetTimer(AmbientSoundTimer, this,
			&ASILIDResident::EmitAmbientPresence, AmbientSoundInterval, true);
	}
}

void ASILIDResident::EmitAmbientPresence()
{
	// broadcast to the player's UI/audio through the noise bus (listeners
	// decide what it becomes - dread sting, subtitle, UI pulse)
	if (NoiseEmitter)
	{
		NoiseEmitter->EmitNoise(FVector(0.1f, 0, 0), SILIDTags::NoiseVoice);
	}
}
