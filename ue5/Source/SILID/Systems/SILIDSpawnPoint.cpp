// Spawn point implementation.

#include "Systems/SILIDSpawnPoint.h"
#include "Systems/SILIDRandomizerSubsystem.h"
#include "Systems/SILIDItemData.h"
#include "Props/SILIDPickup.h"
#include "Engine/World.h"

ASILIDSpawnPoint::ASILIDSpawnPoint()
{
	PrimaryActorTick.bCanEverTick = false;

	USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

#if WITH_EDITORONLY_DATA
	bIsEditorOnlyActor = false;
#endif
}

void ASILIDSpawnPoint::BeginPlay()
{
	Super::BeginPlay();

	if (bStartHidden)
	{
		SetActorHiddenInGame(true);
	}

	if (USILIDRandomizerSubsystem* Rand = GetWorld()->GetSubsystem<USILIDRandomizerSubsystem>())
	{
		Rand->RegisterPoint(this);
	}
}

void ASILIDSpawnPoint::Activate()
{
	if (bChosen)
	{
		return;
	}
	bChosen = true;

	if (ItemToSpawn)
	{
		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		SpawnedPickup = GetWorld()->SpawnActor<ASILIDPickup>(
			ASILIDPickup::StaticClass(), GetActorTransform(), Params);
		if (SpawnedPickup)
		{
			SpawnedPickup->InitFromItemData(ItemToSpawn);
		}
	}

	OnChosen.Broadcast();
}

void ASILIDSpawnPoint::Deactivate()
{
	bChosen = false;
	if (SpawnedPickup)
	{
		SpawnedPickup->Destroy();
		SpawnedPickup = nullptr;
	}
	if (bStartHidden)
	{
		SetActorHiddenInGame(true);
	}
}
