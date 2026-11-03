// Hide spot actor (spec section 10): wardrobes, under-bed volumes, cabinets.
// Entering takes camera control; the AI treats the player as concealed but
// can still search the spot (chance scales with difficulty + suspicion).

#pragma once

#include "GameFramework/Actor.h"
#include "Systems/SILIDInterfaces.h"
#include "SILIDHideSpot.generated.h"

class UBoxComponent;
class UArrowComponent;
class ASILIDCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnHideOccupiedChanged, bool, bOccupied, ASILIDHideSpot*, Spot);

UCLASS()
class SILID_API ASILIDHideSpot : public AActor, public ISILIDInteractable, public ISILIDSaveable
{
	GENERATED_BODY()

public:
	ASILIDHideSpot();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Hide")
	TObjectPtr<UBoxComponent> Volume;

	/** Camera transform while hidden (arrow points at the view direction). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Hide")
	TObjectPtr<UArrowComponent> CameraAnchor;

	/** Exit point the player is teleported to when leaving. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Hide")
	TObjectPtr<UArrowComponent> ExitAnchor;

	/** How likely the Resident searches THIS spot when hunting (0..1 base). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Hide", meta = (ClampMin = "0", ClampMax = "1"))
	float BaseSearchChance = 0.3f;

	/** Text shown when the player enters. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Hide", meta = (MultiLine = true))
	FText EnterLine;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Save")
	FName SaveId;

	UPROPERTY(BlueprintReadOnly, Category = "Hide")
	bool bOccupied = false;

	UPROPERTY(BlueprintAssignable, Category = "Hide")
	FOnHideOccupiedChanged OnHideOccupiedChanged;

	/** Search test used by the Resident AI (considers difficulty + suspicion). */
	bool WouldBeFound(float SuspicionLevel) const;
	bool IsOccupied() const { return bOccupied && Occupant != nullptr; }
	ASILIDCharacter* GetOccupant() const { return Occupant; }

	// ---- ISILIDInteractable ----
	virtual bool Interact(ASILIDCharacter* Player) override;
	virtual bool CanInteract(const ASILIDCharacter* Player) const override;
	virtual FText GetInteractionText(const ASILIDCharacter* Player) const override;
	virtual FText GetExamineText(const ASILIDCharacter* Player) const override;

	// ---- ISILIDSaveable ----
	virtual FString GetSaveId() const override { return SaveId.IsValid() ? SaveId.ToString() : GetName(); }
	virtual void OnSave(USILIDSaveGame* SaveGame) override {}
	virtual void OnLoad(const USILIDSaveGame* SaveGame) override {}

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY()
	TObjectPtr<ASILIDCharacter> Occupant;

	void EnterHide(ASILIDCharacter* Player);
	void ExitHide();
};
