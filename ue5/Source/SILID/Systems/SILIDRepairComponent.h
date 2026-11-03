// SILID class contract
// OWNS:         repair state of one machine — condition (0-100), broken
//               flag, applied work, per-slot requirement evaluation
// MAY WRITE:    only its own state; requirement fulfillment consumes the
//               player's inventory through its API (never direct edits)
// DEPENDS ON:   Inventory API (capability/tag/component/key queries — read +
//               consume), NoiseEmitterComponent (repair is loud), save game
//               payload. Never touches doors/routes/lights directly —
//               consequences are wired by the owner's Blueprint via delegates.
// EMITS:        OnRepairProgress (each work increment), OnRepaired (machine
//               functional), OnRepairBlocked (failed attempt + WHY — HUD hook)
//
// P7 Tools & Repair (doc 13 phase; design doc 09 §3 USILIDRepairableComponent).
// One component covers every "broken thing the player fixes": generator,
// fusebox extras, valve, door mechanism. Requirements are DATA (this struct's
// rows): tool capability tag, consumed component tag, or key tag — evaluated
// against capability queries, never item ids (doc 11 compliance law).
// Work model matches the barrier's hit loop: repeated E presses with
// engine-side cooldown; noise each press (the Resident hears repairs —
// spec section 8). Server-authoritative; saves via the owner's ISILIDSaveable.

#pragma once

#include "Components/ActorComponent.h"
#include "GameplayTagContainer.h"
#include "Systems/SILIDTypes.h"
#include "SILIDRepairComponent.generated.h"

class ASILIDCharacter;
class USILIDNoiseEmitterComponent;
class USILIDInventoryComponent;
class USILIDSaveGame;
class UAudioComponent;
class UStaticMeshComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnRepairProgress, float, NewCondition, int32, WorkApplied);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnRepaired);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnRepairBlocked, const FSILIDOperationResult&, Result);

/** One data-driven requirement row (doc 09: requirements are data). */
USTRUCT(BlueprintType)
struct FSILIDRepairRequirement
{
	GENERATED_BODY()

	/** Tool capability tag the player must carry (e.g. Tool.Hammer, Tool.Wrench).
	 * Matches FSILIDItemFlags::ToolTag. Invalid = no tool needed. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Repair")
	FGameplayTag RequiredToolTag;

	/** Component consumed on completion (e.g. Comp.Fuse). Invalid = none. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Repair")
	FGameplayTag ConsumedComponentTag;

	/** Key tag checked but NOT consumed (keys stay keys — barrier precedent). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Repair")
	FGameplayTag RequiredKeyTag;

	/** E-presses of work this row adds to the total. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Repair", meta = (ClampMin = "0", ClampMax = "20"))
	int32 WorkPresses = 2;
};

UCLASS(ClassGroup = (SILID), meta = (BlueprintSpawnableComponent))
class SILID_API USILIDRepairComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	USILIDRepairComponent();

	// ---- configuration (data) ----

	/** Requirement rows applied in order; each row's work must complete
	 * before the next is evaluated. Empty = pure condition repair. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Repair")
	TArray<FSILIDRepairRequirement> Requirements;

	/** Repair presses needed beyond requirement rows (bare condition repair). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Repair", meta = (ClampMin = "0", ClampMax = "20"))
	int32 BaseWorkPresses = 2;

	/** Cooldown between accepted work presses (seconds) — spaces the hits
	 * like the barrier's interaction-scanner cooldown. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Repair", meta = (ClampMin = "0.0", ClampMax = "2.0"))
	float WorkCooldownSeconds = 0.45f;

	/** Noise loudness per work press (0..1) — repairs attract the Resident. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Repair|Noise", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float WorkNoiseLoudness = 0.7f;

	/** P8: this machine runs on electricity (the generator, a powered valve).
	 * The solvability validator grounds such machines to the virtual
	 * "Machine.Power" node; the electrical subsystem drives their powered
	 * state via the actor's ElectricPowered component. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Repair|Power")
	bool bNeedsPower = false;

	/** Optional one-shot sound at repair completion. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Repair|Audio")
	TObjectPtr<UAudioComponent> RepairDoneSound;

	// ---- state queries ----

	/** Is the machine broken (needs repair work)? */
	UFUNCTION(BlueprintPure, Category = "Repair")
	bool IsBroken() const;

	/** Player-facing status: what is missing / how much work remains. Empty when fine. */
	UFUNCTION(BlueprintPure, Category = "Repair")
	FText GetRepairStatusText() const;

	/** Current condition 0–100 (P8 brown-out window reads this). */
	UFUNCTION(BlueprintPure, Category = "Repair")
	float GetCondition() const { return Condition; }

	/** Can this player attempt repair right now (requirements met OR work pending)? */
	UFUNCTION(BlueprintPure, Category = "Repair")
	bool CanAttemptRepair(const ASILIDCharacter* Player) const;

	/** Total presses remaining (rows not yet done + remaining work). */
	UFUNCTION(BlueprintPure, Category = "Repair")
	int32 GetWorkRemaining() const;

	// ---- commands ----

	/** One increment of repair work (E press). Evaluates the current
	 * requirement row first; a failed evaluation blocks with a reason.
	 * Returns the structured result (doc 12 section 6). */
	UFUNCTION(BlueprintCallable, Category = "Repair")
	FSILIDOperationResult ApplyRepairWork(ASILIDCharacter* Player);

	/** Mark the machine broken again (enemy sabotage, events). Re-arms all rows. */
	UFUNCTION(BlueprintCallable, Category = "Repair")
	void BreakMachine();

	// ---- notifications (see EMITS in the header contract) ----
	UPROPERTY(BlueprintAssignable, Category = "Repair")
	FOnRepairProgress OnRepairProgress;

	UPROPERTY(BlueprintAssignable, Category = "Repair")
	FOnRepaired OnRepaired;

	UPROPERTY(BlueprintAssignable, Category = "Repair")
	FOnRepairBlocked OnRepairBlocked;

	/** P13 objective fabric: component-static "a machine was repaired"
	 * multicast — the ObjectiveSubsystem binds ONCE instead of knowing
	 * every machine's owner (doc 09 §9: one event fabric, many consumers;
	 * this file never learns objectives exist). Fires after OnRepaired.
	 * Carries no id on purpose: objectives key on the generic fact.
	 * Blueprint cannot bind static delegates — C++/the subsystem owns it. */
	static FOnRepaired OnAnyRepaired;

	// ---- save plumbing (owner actor implements ISILIDSaveable and forwards) ----
	void SaveTo(USILIDSaveGame* SaveGame, const FString& SaveId) const;
	void LoadFrom(const USILIDSaveGame* SaveGame, const FString& SaveId);

	/** Used by the solvability audit to include powered-machine dependencies. */
	bool HasAnyPowerRequirements() const { return bNeedsPower; }

private:
	/** 0 = broken, 100 = fully repaired. Derived from work applied. */
	UPROPERTY(SaveGame)
	float Condition = 0.f;

	/** Index of the requirement row currently being satisfied. */
	UPROPERTY(SaveGame)
	int32 CurrentRequirementIndex = 0;

	/** Work presses applied to the current step (row or base). */
	UPROPERTY(SaveGame)
	int32 WorkAppliedToStep = 0;

	float LastWorkTime = -FLT_MAX;

	/** Does any config field tie this machine to the power system? (P16
	 * extraction: such machines require the virtual Machine.Power node.) */

	/** Total presses for the current step (row or base). */
	int32 CurrentStepPresses() const;
	/** Sum of all requirement-row presses + base presses. */
	int32 TotalPressesAll() const;
	/** Presses already applied across completed rows + the current step. */
	int32 AppliedPressesTotal() const;
	void CompleteRepair(ASILIDCharacter* Player);
	USILIDNoiseEmitterComponent* GetNoiseEmitter() const;
	USILIDInventoryComponent* GetInventory(const ASILIDCharacter* Player) const;
};
