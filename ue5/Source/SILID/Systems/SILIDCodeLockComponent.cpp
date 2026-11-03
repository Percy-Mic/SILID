#include "Systems/SILIDCodeLockComponent.h"
#include "Systems/SILIDSaveGame.h"

USILIDCodeLockComponent::USILIDCodeLockComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

bool USILIDCodeLockComponent::TryCode(const FString& EnteredCode)
{
	if (bUnlocked || Code.IsEmpty())
	{
		return bUnlocked;
	}

	if (EnteredCode.TrimStartAndEnd().Equals(Code, ESearchCase::IgnoreCase))
	{
		bUnlocked = true;
		OnUnlocked.Broadcast();
		return true;
	}

	FailureCount++;
	OnCodeRejected.Broadcast(EnteredCode);
	return false;
}

void USILIDCodeLockComponent::ForceUnlock()
{
	if (!bUnlocked)
	{
		bUnlocked = true;
		OnUnlocked.Broadcast();
	}
}

void USILIDCodeLockComponent::SaveTo(USILIDSaveGame* SaveGame, const FString& Prefix) const
{
	if (SaveGame)
	{
		SaveGame->Flags.Add(Prefix + TEXT("_Unlocked"), bUnlocked);
	}
}

void USILIDCodeLockComponent::LoadFrom(const USILIDSaveGame* SaveGame, const FString& Prefix)
{
	if (SaveGame)
	{
		if (const bool* Found = SaveGame->Flags.Find(Prefix + TEXT("_Unlocked")))
		{
			const bool WasLocked = !bUnlocked;
			bUnlocked = *Found;
			if (WasLocked && bUnlocked)
			{
				OnUnlocked.Broadcast();
			}
		}
	}
}
