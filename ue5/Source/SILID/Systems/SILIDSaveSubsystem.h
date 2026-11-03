// Save subsystem (spec section 20). Registers every ISaveable actor, writes
// USILIDSaveGame slots, restores after load. World subsystem = always alive.

#pragma once

#include "Subsystems/WorldSubsystem.h"
#include "Systems/SILIDInterfaces.h"
#include "SILIDSaveSubsystem.generated.h"

class USILIDSaveGame;

UCLASS()
class SILID_API USILIDSaveSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	/** Filename of the single autosave slot (multi-slot comes in Phase 3). */
	static FString SlotName() { return TEXT("SILID_Autosave"); }

	/** Register/unregister ISaveable actors (called by their BeginPlay/EndPlay). */
	void RegisterSaveable(TScriptInterface<ISILIDSaveable> Saveable);
	void UnregisterSaveable(TScriptInterface<ISILIDSaveable> Saveable);

	UFUNCTION(BlueprintCallable, Category = "Save")
	bool SaveToSlot(FString& OutError);

	UFUNCTION(BlueprintCallable, Category = "Save")
	bool LoadFromSlot(FString& OutError);

	UFUNCTION(BlueprintCallable, Category = "Save")
	bool HasSave() const;

	UFUNCTION(BlueprintCallable, Category = "Save")
	void WipeSave();

	/** Exposed for gameplay code that wants to read/patch state pre-save. */
	USILIDSaveGame* GetCurrentPayload() const { return CurrentPayload; }

private:
	virtual void OnWorldBeginPlay(UWorld& InWorld) override;

	UPROPERTY()
	TObjectPtr<USILIDSaveGame> CurrentPayload;

	UPROPERTY()
	TArray<TScriptInterface<ISILIDSaveable>> Saveables;
};
