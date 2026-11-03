#include "Props/SILIDInspectableProp.h"
#include "Components/BoxComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/World.h"
#include "Player/SILIDCharacter.h"
#include "Player/SILIDPlayerController.h"
#include "Systems/SILIDSaveGame.h"
#include "Systems/SILIDSaveSubsystem.h"

ASILIDInspectableProp::ASILIDInspectableProp()
{
	PrimaryActorTick.bCanEverTick = false;

	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	RootComponent = Mesh;
	Mesh->SetCollisionProfileName(TEXT("BlockAllDynamic"));

	FocusCollider = CreateDefaultSubobject<UBoxComponent>(TEXT("FocusCollider"));
	FocusCollider->SetupAttachment(Mesh);
	FocusCollider->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	FocusCollider->SetCollisionResponseToAllChannels(ECR_Ignore);
	FocusCollider->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
	FocusCollider->SetGenerateOverlapEvents(false);

	PracticalLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("PracticalLight"));
	PracticalLight->SetupAttachment(Mesh);
	PracticalLight->SetIntensity(700.f);
	PracticalLight->SetAttenuationRadius(500.f);
	PracticalLight->SetVisibility(false);
}

void ASILIDInspectableProp::BeginPlay()
{
	Super::BeginPlay();
	bIsOn = bStartsOn;
	ApplyState();
	if (USILIDSaveSubsystem* Save = GetWorld()->GetSubsystem<USILIDSaveSubsystem>())
	{
		Save->RegisterSaveable(this);
	}
}

void ASILIDInspectableProp::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (USILIDSaveSubsystem* Save = GetWorld()->GetSubsystem<USILIDSaveSubsystem>())
	{
		Save->UnregisterSaveable(this);
	}
	Super::EndPlay(EndPlayReason);
}

void ASILIDInspectableProp::ApplyState()
{
	if (PracticalLight)
	{
		PracticalLight->SetVisibility(bToggleable && bIsOn);
	}
}

bool ASILIDInspectableProp::Interact(ASILIDCharacter* Player)
{
	if (bToggleable)
	{
		bIsOn = !bIsOn;
		ApplyState();
	}
	if (Player)
	{
		if (ASILIDPlayerController* PC = Cast<ASILIDPlayerController>(Player->GetController()))
		{
			FText Message = ExamineDescription;
			if (bToggleable)
			{
				const FText State = bIsOn
					? NSLOCTEXT("SILID", "PropNowOn", "It is on.")
					: NSLOCTEXT("SILID", "PropNowOff", "It is off.");
				Message = FText::Format(NSLOCTEXT("SILID", "PropStateFormat", "{0} {1}"), Message, State);
			}
			if (!Message.IsEmpty()) PC->ShowExamineText(Message);
		}
	}
	return true;
}

FText ASILIDInspectableProp::GetInteractionText(const ASILIDCharacter* Player) const
{
	if (DisplayName.IsEmpty())
	{
		return bToggleable
			? (bIsOn ? NSLOCTEXT("SILID", "PropTurnOff", "Turn it off") : NSLOCTEXT("SILID", "PropTurnOn", "Turn it on"))
			: NSLOCTEXT("SILID", "PropInspect", "Inspect");
	}
	return bToggleable
		? FText::Format(bIsOn ? NSLOCTEXT("SILID", "NamedTurnOff", "Turn off {0}") : NSLOCTEXT("SILID", "NamedTurnOn", "Turn on {0}"), DisplayName)
		: FText::Format(NSLOCTEXT("SILID", "NamedInspect", "Inspect {0}"), DisplayName);
}

void ASILIDInspectableProp::OnFocus()
{
	if (Mesh) Mesh->SetRenderCustomDepth(true);
}

void ASILIDInspectableProp::OnUnfocus()
{
	if (Mesh) Mesh->SetRenderCustomDepth(false);
}

void ASILIDInspectableProp::OnSave(USILIDSaveGame* SaveGame)
{
	if (SaveGame && bToggleable) SaveGame->Flags.Add(GetSaveId() + TEXT("_On"), bIsOn);
}

void ASILIDInspectableProp::OnLoad(const USILIDSaveGame* SaveGame)
{
	if (const bool* Found = SaveGame && bToggleable ? SaveGame->Flags.Find(GetSaveId() + TEXT("_On")) : nullptr)
	{
		bIsOn = *Found;
		ApplyState();
	}
}
