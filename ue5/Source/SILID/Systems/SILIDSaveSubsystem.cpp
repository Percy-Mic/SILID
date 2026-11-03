#include "Systems/SILIDSaveSubsystem.h"
#include "Systems/SILIDGameMode.h"
#include "Systems/SILIDGameInstance.h"
#include "Systems/SILIDElectricalSystemSubsystem.h"
#include "Systems/SILIDObjectiveSubsystem.h"
#include "Systems/SILIDSaveGame.h"
#include "Systems/SILIDTypes.h"
#include "Systems/SILIDRandomizerSubsystem.h"
#include "Systems/SILIDHealthComponent.h"
#include "Systems/SILIDFlashlightComponent.h"
#include "Systems/SILIDInventoryComponent.h"
#include "Misc/DateTime.h"
#include "GameFramework/Character.h"
#include "EngineUtils.h"
#include "Kismet/GameplayStatics.h"
#include "Logging/SILIDLog.h"

void USILIDSaveSubsystem::OnWorldBeginPlay(UWorld& InWorld)
{
	Super::OnWorldBeginPlay(InWorld);
	// Register the actors that began before the world subsystem's sweep.
	for (TActorIterator<AActor> It(&InWorld); It; ++It)
	{
		if (It->GetClass()->ImplementsInterface(USILIDSaveable::StaticClass()))
		{
			TScriptInterface<ISILIDSaveable> Saveable;
			Saveable.SetObject(*It);
			Saveable.SetInterface(Cast<ISILIDSaveable>(*It));
			RegisterSaveable(Saveable);
		}
	}
}

void USILIDSaveSubsystem::RegisterSaveable(TScriptInterface<ISILIDSaveable> Saveable)
{
	if (Saveable)
	{
		Saveables.AddUnique(Saveable);
	}
}

void USILIDSaveSubsystem::UnregisterSaveable(TScriptInterface<ISILIDSaveable> Saveable)
{
	Saveables.RemoveAll([Saveable](const TScriptInterface<ISILIDSaveable>& S) { return S == Saveable; });
}

bool USILIDSaveSubsystem::SaveToSlot(FString& OutError)
{
	UWorld* World = GetWorld();
	if (!World)
	{
		OutError = TEXT("no world");
		return false;
	}

	USILIDSaveGame* Payload = Cast<USILIDSaveGame>(UGameplayStatics::CreateSaveGameObject(USILIDSaveGame::StaticClass()));
	Payload->SaveVersion = USILIDSaveGame::CurrentVersion;
	Payload->SavedTimestamp = FDateTime::UtcNow().ToUnixTimestamp();

	// run seed: the save reproduces the same house on load (spec: seed saved)
	if (const ASILIDGameMode* GM = Cast<ASILIDGameMode>(UGameplayStatics::GetGameMode(World)))
	{
		Payload->RunSeed = GM->GetRunSeed();
		Payload->Difficulty = static_cast<uint8>(UGameplayStatics::GetGameInstance(World)
			? Cast<USILIDGameInstance>(UGameplayStatics::GetGameInstance(World))->SelectedDifficulty : EDifficulty::Normal);
	}

	// player snapshot
	if (ACharacter* Player = UGameplayStatics::GetPlayerCharacter(World, 0))
	{
		Payload->PlayerTransform = Player->GetActorTransform();
		if (class USILIDHealthComponent* Health = Player->FindComponentByClass<USILIDHealthComponent>())
		{
			Payload->PlayerHealth = Health->GetHealth();
		}
		if (class USILIDFlashlightComponent* Torch = Player->FindComponentByClass<USILIDFlashlightComponent>())
		{
			Payload->FlashlightBattery = Torch->GetBatteryNormalized() * Torch->MaxBatterySeconds;
			if (class USILIDInventoryComponent* Inv = Player->FindComponentByClass<USILIDInventoryComponent>())
			{
				Inv->SaveTo(Payload, TEXT("inventory"));
			}
		}
	}

	// world-system state: the power graph writes its own replay-safe facts
	if (UElectricalSystemSubsystem* Electrical = World->GetSubsystem<UElectricalSystemSubsystem>())
	{
		Electrical->SaveTo(Payload);
	}
	// P13: the objective fabric persists raw facts only (story-tag ledger +
	// objective ids) — before the saveable walk, same seam as the power graph
	if (USILIDObjectiveSubsystem* Objectives = World->GetSubsystem<USILIDObjectiveSubsystem>())
	{
		Objectives->SaveTo(Payload);
	}

	// every registered saveable writes its own state
	for (TScriptInterface<ISILIDSaveable>& S : Saveables)
	{
		if (S)
		{
			const FString Id = S->GetSaveId();
			if (Id.IsEmpty())
			{
				SILID_WARN_CAT(LogSILID, TEXT("Saveable %s has an empty save id - skipped"), *S.GetObject()->GetName());
				continue;
			}
			S->OnSave(Payload);
		}
	}

	CurrentPayload = Payload;

	const bool bOk = UGameplayStatics::SaveGameToSlot(Payload, SlotName(), 0);
	if (!bOk)
	{
		OutError = TEXT("SaveGameToSlot failed (disk?)");
	}
	return bOk;
}

bool USILIDSaveSubsystem::LoadFromSlot(FString& OutError)
{
	UWorld* World = GetWorld();
	if (!World)
	{
		OutError = TEXT("no world");
		return false;
	}

	USILIDSaveGame* Payload = Cast<USILIDSaveGame>(UGameplayStatics::LoadGameFromSlot(SlotName(), 0));
	if (!Payload)
	{
		OutError = TEXT("no save in slot");
		return false;
	}
	if (!Payload->IsCompatible())
	{
		OutError = FString::Printf(TEXT("save version %d newer than build %d"), Payload->SaveVersion, USILIDSaveGame::CurrentVersion);
		return false;
	}

	CurrentPayload = Payload;

	// restore the run seed: same house, same scatter, same patrol order
	if (USILIDRandomizerSubsystem* Rand = World->GetSubsystem<USILIDRandomizerSubsystem>())
	{
		Rand->RandomizeAll(Payload->RunSeed);
	}
	if (ASILIDGameMode* GM = Cast<ASILIDGameMode>(UGameplayStatics::GetGameMode(World)))
	{
		GM->SetRunSeed(Payload->RunSeed);
	}

	// player restore
	if (ACharacter* Player = UGameplayStatics::GetPlayerCharacter(World, 0))
	{
		Player->SetActorTransform(Payload->PlayerTransform, false, nullptr, ETeleportType::TeleportPhysics);
		if (APlayerController* PC = Player->GetController<APlayerController>())
		{
			PC->SetControlRotation(Payload->PlayerTransform.Rotator());
		}
		if (USILIDHealthComponent* Health = Player->FindComponentByClass<USILIDHealthComponent>())
		{
			Health->Heal(Health->MaxHealth); // load heals; death state never persists
			// precise value restore for non-fatal saves
			if (Payload->PlayerHealth > 0.f && Payload->PlayerHealth < Health->MaxHealth)
			{
				Health->Heal(Payload->PlayerHealth - Health->GetHealth());
			}
		}
		if (USILIDFlashlightComponent* Torch = Player->FindComponentByClass<USILIDFlashlightComponent>())
		{
			Torch->AddBatteryCharge(Payload->FlashlightBattery - Torch->GetBatteryNormalized() * Torch->MaxBatterySeconds);
			Torch->SetOn(false); // start dark: the player chooses when to see
		}
		if (USILIDInventoryComponent* Inv = Player->FindComponentByClass<USILIDInventoryComponent>())
		{
			Inv->LoadFrom(Payload, TEXT("inventory"));
		}
	}

	// saveables restore
	for (TScriptInterface<ISILIDSaveable>& S : Saveables)
	{
		if (S)
		{
			S->OnLoad(Payload);
		}
	}

	// power graph restores LAST: the generator's repair component and the
	// node registry are back by now, so the derived machine state is honest
	// (the board tick self-heal covers any remaining ordering gaps)
	if (UElectricalSystemSubsystem* Electrical = World->GetSubsystem<UElectricalSystemSubsystem>())
	{
		Electrical->LoadFrom(Payload);
	}
	// P13 objectives restore after the power graph: the ledger replay then
	// re-completes rows from facts, and the events above already fired into
	// the (empty→replaying) ledger — order keeps completions idempotent
	if (USILIDObjectiveSubsystem* Objectives = World->GetSubsystem<USILIDObjectiveSubsystem>())
	{
		Objectives->LoadFrom(Payload);
	}

	SILID_LOG_CAT(LogSILID, TEXT("Save loaded: version %d, %d saveables"), Payload->SaveVersion, Saveables.Num());
	return true;
}

bool USILIDSaveSubsystem::HasSave() const
{
	return UGameplayStatics::DoesSaveGameExist(SlotName(), 0);
}

void USILIDSaveSubsystem::WipeSave()
{
	UGameplayStatics::DeleteGameInSlot(SlotName(), 0);
	CurrentPayload = nullptr;
}
