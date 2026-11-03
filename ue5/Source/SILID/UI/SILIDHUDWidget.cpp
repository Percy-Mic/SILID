#include "UI/SILIDHUDWidget.h"
#include "Player/SILIDPlayerController.h"
#include "Player/SILIDCharacter.h"
#include "Systems/SILIDInventoryComponent.h"

bool USILIDHUDWidget::Initialize()
{
	return Super::Initialize();
}

void USILIDHUDWidget::BindController(ASILIDPlayerController* PC)
{
	BoundController = PC;
	if (PC)
	{
		PC->OnPromptChanged.AddDynamic(this, &USILIDHUDWidget::HandlePrompt);
		PC->OnExamineRequested.AddDynamic(this, &USILIDHUDWidget::HandleExamine);
	}
}

void USILIDHUDWidget::PushInventoryView()
{
	ASILIDCharacter* Player = BoundController
		? Cast<ASILIDCharacter>(BoundController->GetPawn()) : nullptr;
	USILIDInventoryComponent* Inv = Player
		? Player->FindComponentByClass<USILIDInventoryComponent>() : nullptr;
	if (!Inv)
	{
		return;
	}

	TArray<FSILIDInventoryViewEntry> View;
	for (USILIDItemData* Item : Inv->GetItems())
	{
		if (!Item)
		{
			continue;
		}
		FSILIDInventoryViewEntry& E = View.AddDefaulted_GetRef();
		E.ItemId = Item->ItemId;
		E.Item = Item;
		E.Count = 1;
	}
	RefreshInventory(View);
}

void USILIDHUDWidget::HandlePrompt(const FText& Text)
{
	ShowPrompt(Text);
}

void USILIDHUDWidget::HandleInventoryChanged(const TArray<USILIDItemData*>& Items)
{
	PushInventoryView();
}

void USILIDHUDWidget::HandleExamine(const FText& Text)
{
	ShowExamine(Text);
}
