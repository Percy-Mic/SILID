#include "Systems/SILIDGameInstance.h"
#include "Systems/SILIDItemData.h"
#include "Systems/SILIDDifficultySubsystem.h"
#include "Logging/SILIDLog.h"

USILIDItemData* USILIDGameInstance::FindItemData(FName ItemId) const
{
	return ItemRegistry ? ItemRegistry->Find(ItemId) : nullptr;
}

void USILIDGameInstance::Init()
{
	Super::Init();

	if (!ItemRegistry)
	{
		SILID_WARN_CAT(LogSILID, TEXT("No ItemRegistry assigned on SILIDGameInstance (project settings) - items will not resolve from saves"));
	}
}
