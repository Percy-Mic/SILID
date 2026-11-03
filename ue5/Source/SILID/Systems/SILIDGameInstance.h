// Game instance: owns the item registry (id -> USILIDItemData) so saves and
// code can resolve items without hard references. Items are registered from
// a designer-managed asset list (DA_ItemRegistry).

#pragma once

#include "Engine/GameInstance.h"
#include "SILIDGameInstance.generated.h"

class USILIDItemData;

UCLASS(BlueprintType)
class SILID_API USILIDItemRegistry : public UObject
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Items")
	TMap<FName, TObjectPtr<USILIDItemData>> Items;

	USILIDItemData* Find(FName ItemId) const
	{
		const TObjectPtr<USILIDItemData>* Found = Items.Find(ItemId);
		return Found ? Found->Get() : nullptr;
	}
};

UCLASS()
class SILID_API USILIDGameInstance : public UGameInstance
{
	GENERATED_BODY()

public:
	/** The designer-curated registry asset. Assign in project settings. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Items")
	TObjectPtr<USILIDItemRegistry> ItemRegistry;

	/** Resolve an item by id (saves, code, drops). */
	UFUNCTION(BlueprintCallable, Category = "Items")
	USILIDItemData* FindItemData(FName ItemId) const;

	/** Difficulty persists across level loads on the instance. */
	UPROPERTY(BlueprintReadWrite, Category = "Difficulty")
	EDifficulty SelectedDifficulty = EDifficulty::Normal;

	/** Highest chapter the player has reached this run. */
	UPROPERTY(BlueprintReadWrite, Category = "Story")
	int32 CurrentChapter = 1;

	virtual void Init() override;
};
