// HUD widget base (spec sections 24, 25): minimal horror UI. The C++ side
// owns state and data flow; the visual design happens in the WBP subclass
// (manual step). Everything degrades gracefully when no widget is assigned.

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "SILIDTypes.h"
#include "SILIDHUDWidget.generated.h"

class ASILIDPlayerController;

class USILIDItemData;

/** One HUD-facing inventory slot (icon + count + id). Decouples the widget
 * from the inventory component's internal entry struct. */
USTRUCT(BlueprintType)
struct FSILIDInventoryViewEntry
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Inventory")
	FName ItemId;

	UPROPERTY(BlueprintReadOnly, Category = "Inventory")
	TObjectPtr<USILIDItemData> Item = nullptr;

	UPROPERTY(BlueprintReadOnly, Category = "Inventory")
	int32 Count = 1;
};

UCLASS(Abstract)
class SILID_API USILIDHUDWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	/** Push the interaction prompt ("Open the door"). Empty hides it. */
	UFUNCTION(BlueprintImplementableEvent, Category = "SILID|HUD")
	void ShowPrompt(const FText& Text);

	/** Battery 0..1 (UI decides how to visualize - no bar unless wanted). */
	UFUNCTION(BlueprintImplementableEvent, Category = "SILID|HUD")
	void ShowBattery(float Normalized, bool bOn);

	/** Stamina 0..1; exhausted pulses. */
	UFUNCTION(BlueprintImplementableEvent, Category = "SILID|HUD")
	void ShowStamina(float Normalized, bool bExhausted);

	/** Subtitle/whisper line (environmental storytelling). */
	UFUNCTION(BlueprintImplementableEvent, Category = "SILID|HUD")
	void ShowSubtitle(const FText& Text, float Duration);

	/** Document/examine overlay. */
	UFUNCTION(BlueprintImplementableEvent, Category = "SILID|HUD")
	void ShowExamine(const FText& Text);

	/** Death overlay + respawn notice. */
	UFUNCTION(BlueprintImplementableEvent, Category = "SILID|HUD")
	void ShowDeath();

	/** Ending overlay (vertical slice: one ending). */
	UFUNCTION(BlueprintImplementableEvent, Category = "SILID|HUD")
	void ShowEnding();

	/** Objective line: the game's one clear goal ("Find a way out"). */
	UFUNCTION(BlueprintImplementableEvent, Category = "SILID|HUD")
	void ShowObjective(const FText& Text);

	/** C++ push helper for the objective line (the GameMode calls this on
	 * objective activate/complete; the WBP implements the visuals). */
	void PushObjective(const FText& Text) { ShowObjective(Text); }

	/** Inventory changed: rebuild slots (ids + counts + icons). */
	UFUNCTION(BlueprintImplementableEvent, Category = "SILID|HUD")
	void RefreshInventory(const TArray<FSILIDInventoryViewEntry>& Entries);

	/** The controller wires these automatically. */
	void BindController(ASILIDPlayerController* PC);

	/** C++ helper: reads the pawn's inventory and calls RefreshInventory. */
	void PushInventoryView();

	/** Bound to the inventory's OnInventoryChanged by the controller. */
	UFUNCTION()
	void HandleInventoryChanged(const TArray<USILIDItemData*>& Items);

protected:
	virtual bool Initialize() override;

	UFUNCTION()
	void HandlePrompt(const FText& Text);

	UFUNCTION()
	void HandleExamine(const FText& Text);

	UPROPERTY()
	TObjectPtr<ASILIDPlayerController> BoundController;
};
