#include "Systems/SILIDRoomDirector.h"
#include "Systems/SILIDSaveGame.h"
#include "Systems/SILIDTags.h"
#include "Props/SILIDDoor.h"
#include "Player/SILIDCharacter.h"
#include "Player/SILIDPlayerController.h"
#include "Components/BoxComponent.h"
#include "Components/SphereComponent.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Logging/SILIDLog.h"

// ------------------------------------------------------------------ zone
ASILIDRoomZone::ASILIDRoomZone()
{
	PrimaryActorTick.bCanEverTick = false;

	Volume = CreateDefaultSubobject<UBoxComponent>(TEXT("Volume"));
	RootComponent = Volume;
	Volume->InitBoxExtent(FVector(300.f, 300.f, 150.f));
	Volume->SetCollisionProfileName(TEXT("OverlapOnly"));
	Volume->SetGenerateOverlapEvents(true);
}

bool ASILIDRoomZone::IsPlayerInside() const
{
	if (const ASILIDCharacter* Player = Cast<ASILIDCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0)))
	{
		return Volume && Volume->IsOverlappingActor(Player);
	}
	return false;
}

// -------------------------------------------------------------- director
ASILIDRoomDirector::ASILIDRoomDirector()
{
	PrimaryActorTick.bCanEverTick = true;
}

void ASILIDRoomDirector::BeginPlay()
{
	Super::BeginPlay();

	// auto-collect all zones in the level
	TArray<AActor*> Found;
	UGameplayStatics::GetAllActorsOfClass(this, ASILIDRoomZone::StaticClass(), Found);
	for (AActor* A : Found)
	{
		if (ASILIDRoomZone* Zone = Cast<ASILIDRoomZone>(A))
		{
			Zones.Add(Zone);
		}
	}
	SILID_LOG_CAT(LogSILID, TEXT("RoomDirector: %d zones"), Zones.Num());
}

void ASILIDRoomDirector::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);
	CheckAccum += DeltaTime;
	if (CheckAccum >= CheckInterval)
	{
		CheckAccum = 0.f;
		CheckVisits();
	}
}

void ASILIDRoomDirector::CheckVisits()
{
	for (ASILIDRoomZone* Zone : Zones)
	{
		if (!Zone || !Zone->IsPlayerInside())
		{
			continue;
		}

		const int32 Before = Zone->VisitCount;
		Zone->VisitCount++;

		// each visit ticks the next staged mutation
		for (const FRoomMutation& M : Zone->Mutations)
		{
			if (M.VisitNumber == Zone->VisitCount)
			{
				ApplyMutation(Zone, M);
			}
		}

		if (Zone->VisitCount != Before)
		{
			SILID_LOG_CAT(LogSILID, TEXT("Room %s visit %d"), *Zone->RoomTag.ToString(), Zone->VisitCount);
		}
	}
}

void ASILIDRoomDirector::ApplyMutation(ASILIDRoomZone* Zone, const FRoomMutation& Mutation)
{
	if (!Zone)
	{
		return;
	}

	// move props per the table (furniture drifts, objects vanish/appear)
	for (const TPair<FName, FTransform>& Pair : Mutation.PropTransforms)
	{
		if (const TSoftObjectPtr<AActor>* Found = Zone->NamedProps.Find(Pair.Key))
		{
			if (AActor* Prop = Found->LoadSynchronous())
			{
				Prop->SetActorTransform(Pair.Value, /*bSweep*/ false, nullptr, ETeleportType::None);
				// furniture moving is a loud dread beat: something heard it
				if (USILIDNoiseEmitterComponent* Emitter = Prop->FindComponentByClass<USILIDNoiseEmitterComponent>())
				{
					Emitter->EmitNoise(FVector(0.5f, 0, 0), SILIDTags::NoiseImpact);
				}
			}
		}
	}

	// doors: the house uses them
	for (const FName& DoorName : Mutation.DoorsToOpen)
	{
		if (const TSoftObjectPtr<AActor>* Found = Zone->NamedProps.Find(DoorName))
		{
			if (ASILIDDoor* Door = Cast<ASILIDDoor>(Found->LoadSynchronous()))
			{
				Door->SetOpen(true);
			}
		}
	}
	for (const FName& DoorName : Mutation.DoorsToClose)
	{
		if (const TSoftObjectPtr<AActor>* Found = Zone->NamedProps.Find(DoorName))
		{
			if (ASILIDDoor* Door = Cast<ASILIDDoor>(Found->LoadSynchronous()))
			{
				Door->SetOpen(false);
			}
		}
	}

	// announce through the examine channel (UI subtitle in phase 2)
	if (!Mutation.AnnounceLine.IsEmpty())
	{
		if (ASILIDPlayerController* PC = Cast<ASILIDPlayerController>(UGameplayStatics::GetPlayerController(this, 0)))
		{
			PC->ShowExamineText(Mutation.AnnounceLine);
		}
	}

	OnRoomMutated.Broadcast(Zone, Mutation);
}
