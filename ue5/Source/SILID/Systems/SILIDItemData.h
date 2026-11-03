// Item definition data asset (spec sections 6, 29): items are data, not
// Blueprint subclasses. Adding a key or a battery never touches code.

#pragma once

#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "SILIDTypes.h"
#include "SILIDItemFlags.h"
#include "SILIDItemData.generated.h"

class UStaticMesh;
class UTexture2D;
class USoundBase;

UCLASS(BlueprintType)
class SILID_API USILIDItemData : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	/** Stable id, e.g. "key.brass.1962". References from doors/saves use this. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item")
	FName ItemId;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item")
	FText DisplayName;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item", meta = (MultiLine = true))
	FText Description;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item")
	EItemType ItemType = EItemType::Quest;

	/** Tool and component capabilities consumed by generic barriers and puzzles. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item|Behavior")
	FSILIDItemFlags Flags;

	/** Icon for the inventory UI (placeholder: any 256x256 texture). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item|Visuals")
	TObjectPtr<UTexture2D> Icon;

	/** World model shown when inspected (placeholder: any prop mesh). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item|Visuals")
	TObjectPtr<UStaticMesh> WorldMesh;

	/** Can multiple copies share one slot? */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item")
	bool bStackable = false;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item", meta = (EditCondition = "bStackable", ClampMin = "1"))
	int32 MaxStackSize = 1;

	/** Tag this key unlocks; doors compare their own UnlockTag. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item|Behavior", meta = (EditCondition = "ItemType == EItemType::Key"))
	FGameplayTag UnlockTag;

	/** Sound when picked up (placeholder audio). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item|Audio")
	TObjectPtr<USoundBase> PickupSound;
};
