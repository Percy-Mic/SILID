// Reusable code lock (spec section 17: environmental puzzles; section 5:
// interface-based). Doors, drawers and the safe all mount this. Unlocks via
// a matching key tag OR the correct code entered by the UI.

#pragma once

#include "Components/ActorComponent.h"
#include "GameplayTagContainer.h"
#include "SILIDCodeLockComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnUnlocked);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnCodeRejected, const FString&, EnteredCode);

UCLASS(ClassGroup = (SILID), meta = (BlueprintSpawnableComponent))
class SILID_API USILIDCodeLockComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	USILIDCodeLockComponent();

	/** Required key tag. Empty = code-only lock. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Lock")
	FGameplayTag RequiredKeyTag;

	/** Numeric code; empty string disables code entry. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Lock")
	FString Code = TEXT("384");

	UPROPERTY(BlueprintReadOnly, Category = "Lock")
	bool bUnlocked = false;

	/** Clue line the UI may show after failures (environmental storytelling). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Lock", meta = (MultiLine = true))
	FText HintAfterFailures;

	UPROPERTY(BlueprintAssignable, Category = "Lock")
	FOnUnlocked OnUnlocked;

	UPROPERTY(BlueprintAssignable, Category = "Lock")
	FOnCodeRejected OnCodeRejected;

	UFUNCTION(BlueprintCallable, Category = "Lock")
	bool TryCode(const FString& EnteredCode);

	UFUNCTION(BlueprintCallable, Category = "Lock")
	void ForceUnlock();

	UFUNCTION(BlueprintPure, Category = "Lock")
	bool IsLocked() const { return !bUnlocked; }

	// save/load
	void SaveTo(class USILIDSaveGame* SaveGame, const FString& Prefix) const;
	void LoadFrom(const class USILIDSaveGame* SaveGame, const FString& Prefix);

private:
	int32 FailureCount = 0;
};
