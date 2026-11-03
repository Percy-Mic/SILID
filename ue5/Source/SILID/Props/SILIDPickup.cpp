#include "Props/SILIDPickup.h"
#include "Props/SILIDDoor.h"
#include "Systems/SILIDItemData.h"
#include "Systems/SILIDInventoryComponent.h"
#include "Systems/SILIDNoiseEmitterComponent.h"
#include "Systems/SILIDSaveGame.h"
#include "Systems/SILIDTags.h"
#include "Player/SILIDPlayerController.h"
#include "Player/SILIDCharacter.h"
#include "Components/StaticMeshComponent.h"
#include "Logging/SILIDLog.h"

ASILIDPickup::ASILIDPickup()
{
	PrimaryActorTick.bCanEverTick = false;

	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	RootComponent = Mesh;
	Mesh->SetCollisionProfileName(TEXT("BlockAllDynamic")); // small items can be walked into
	Mesh->SetRelativeScale3D(FVector(0.35f));               // placeholder scale; real assets set their own

	NoiseEmitter = CreateDefaultSubobject<USILIDNoiseEmitterComponent>(TEXT("NoiseEmitter"));
}

void ASILIDPickup::BeginPlay()
{
	Super::BeginPlay();

	ApplyItemVisuals();

	if (USILIDSaveSubsystem* Save = GetWorld()->GetSubsystem<USILIDSaveSubsystem>())
	{
		Save->RegisterSaveable(this);
	}
}

void ASILIDPickup::InitFromItemData(USILIDItemData* InItemData)
{
	ItemData = InItemData;
	ApplyItemVisuals();
}

void ASILIDPickup::ApplyItemVisuals()
{
	if (ItemData && ItemData->WorldMesh && Mesh)
	{
		Mesh->SetStaticMesh(ItemData->WorldMesh);
	}
}

bool ASILIDPickup::Interact(ASILIDCharacter* Player)
{
	if (bTaken || !Player || !Player->Inventory || !ItemData)
	{
		return false;
	}

	if (!Player->Inventory->AddItem(ItemData))
	{
		// inventory full: prompt handled by UI; nothing happens
		return false;
	}

	bTaken = true;

	// pickup noise (tiny, spec section 8: player interaction)
	if (NoiseEmitter)
	{
		NoiseEmitter->EmitNoise(FVector(0.15f, 0, 0), SILIDTags::NoiseDevice);
	}

	// documents open their reader in the HUD
	if (ItemData->ItemType == EItemType::Document && !DocumentText.IsEmpty())
	{
		if (ASILIDPlayerController* PC = Cast<ASILIDPlayerController>(Player->GetController()))
		{
			PC->ShowExamineText(DocumentText);
		}
	}

	// auto-hold small quest/key items so the player sees them in hand
	if (ItemData->ItemType == EItemType::Key || ItemData->ItemType == EItemType::PuzzleItem)
	{
		Player->HoldItem(ItemData);
	}

	if (bOneTime)
	{
		SetActorHiddenInGame(true);
		SetActorEnableCollision(false);
	}

	return true;
}

bool ASILIDPickup::CanInteract(const ASILIDCharacter* Player) const
{
	return !bTaken;
}

FText ASILIDPickup::GetInteractionText(const ASILIDCharacter* Player) const
{
	if (bTaken || !ItemData)
	{
		return FText::GetEmpty();
	}
	return FText::Format(NSLOCTEXT("SILID", "TakeFmt", "Take the {0}"), ItemData->DisplayName);
}

FText ASILIDPickup::GetExamineText(const ASILIDCharacter* Player) const
{
	return ItemData ? ItemData->Description : FText::GetEmpty();
}

void ASILIDPickup::OnFocus()  { /* highlight hook */ }
void ASILIDPickup::OnUnfocus() { /* unhighlight hook */ }

void ASILIDPickup::OnSave(USILIDSaveGame* SaveGame)
{
	if (SaveGame)
	{
		SaveGame->Flags.Add(GetSaveId() + TEXT("_Taken"), bTaken);
	}
}

void ASILIDPickup::OnLoad(const USILIDSaveGame* SaveGame)
{
	if (const bool* Found = SaveGame ? SaveGame->Flags.Find(GetSaveId() + TEXT("_Taken")) : nullptr)
	{
		bTaken = *Found;
		SetActorHiddenInGame(bTaken);
		SetActorEnableCollision(!bTaken);
	}
}
