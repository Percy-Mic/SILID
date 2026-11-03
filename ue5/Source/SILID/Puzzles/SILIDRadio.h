// Radio puzzle (spec section 17): broken radio, tunable frequency; the right
// frequency broadcasts numbers (a date/code) that feed the safe/drawer lock.
// Tuning it emits Noise.Device - the house listens.

#pragma once

#include "GameFramework/Actor.h"
#include "Systems/SILIDInterfaces.h"
#include "SILIDRadio.generated.h"

class UStaticMeshComponent;
class USILIDNoiseEmitterComponent;
class UAudioComponent;

UCLASS()
class SILID_API ASILIDRadio : public AActor, public ISILIDInteractable, public ISILIDSaveable
{
	GENERATED_BODY()

public:
	ASILIDRadio();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Radio")
	TObjectPtr<UStaticMeshComponent> BodyMesh;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Radio")
	TObjectPtr<USILIDNoiseEmitterComponent> NoiseEmitter;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Radio")
	TObjectPtr<UAudioComponent> StaticLoop; // placeholder static asset (manual)

	/** The frequency that matters (e.g. 106.7). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Radio", meta = (ClampMin = "88.0", ClampMax = "108.0"))
	float TruthFrequency = 106.7f;

	/** Current dial position. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Radio")
	float CurrentFrequency = 99.5f;

	/** Clue broadcast when tuned right: the safe code, spoken as a date. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Radio", meta = (MultiLine = true))
	FText BroadcastText;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Save")
	FName SaveId;

	DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnTuned, bool, bOnTruthFrequency, float, Frequency);
	UPROPERTY(BlueprintAssignable, Category = "Radio")
	FOnTuned OnTuned;

	/** Nudge the dial. Returns true when the truth frequency is hit. */
	UFUNCTION(BlueprintCallable, Category = "Radio")
	bool Tune(float DeltaFrequency);

	UFUNCTION(BlueprintPure, Category = "Radio")
	bool IsOnTruthFrequency() const;

	// ---- ISILIDInteractable ----
	virtual bool Interact(ASILIDCharacter* Player) override;
	virtual FText GetInteractionText(const ASILIDCharacter* Player) const override;
	virtual FText GetExamineText(const ASILIDCharacter* Player) const override;

	// ---- ISILIDSaveable ----
	virtual FString GetSaveId() const override { return SaveId.IsValid() ? SaveId.ToString() : GetName(); }
	virtual void OnSave(USILIDSaveGame* SaveGame) override;
	virtual void OnLoad(const USILIDSaveGame* SaveGame) override;

protected:
	virtual void BeginPlay() override;

private:
	bool bBroadcasting = false;
};
