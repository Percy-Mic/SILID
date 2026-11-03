// The Resident's AI controller (spec sections 7, 8, 9).
// Implements the full 13-state machine over UAIPerception:
//   Idle -> Patrol -> (Hear -> Investigate -> Search)* -> Detect -> Chase
//   -> (Attack | LosePlayer -> SearchLastKnown -> ReturnToPatrol)
// He never magically knows the player: every suspicion traces to a
// perception stimulus or a noise event with a location.

#pragma once

#include "AIController.h"
#include "Systems/SILIDTypes.h"
#include "Navigation/PathFollowingComponent.h"
#include "SILIDResidentController.generated.h"

class ASILIDResident;
class ASILIDHideSpot;
class UAISenseConfig_Sight;
class UAIPerceptionComponent;
class UBlackboardComponent;
class UBehaviorTreeComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnResidentStateChanged, EResidentState, NewState);

UCLASS()
class SILID_API ASILIDResidentController : public AAIController
{
	GENERATED_BODY()

public:
	ASILIDResidentController();

	UPROPERTY(BlueprintAssignable, Category = "Resident|AI")
	FOnResidentStateChanged OnStateChanged;

	UFUNCTION(BlueprintPure, Category = "Resident|AI")
	EResidentState GetState() const { return State; }

	/** Current suspicion 0..1 (drives hide searches, music, UI). */
	UFUNCTION(BlueprintPure, Category = "Resident|AI")
	float GetSuspicion() const { return Suspicion; }

	virtual void OnPossess(APawn* InPawn) override;
	virtual void Tick(float DeltaTime) override;
	virtual void UpdateControlRotation(float DeltaTime, bool bUpdatePawn) override;

	/** Called for every noise in the world (subscribes to the noise bus). */
	void HandleNoise(const struct FSILIDNoiseEvent& Event);

	/** Difficulty-sensitive perception tuning is applied here. */
	void ApplyDifficultyTuning();

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

private:
	// ---------------- state machine ----------------
	void SetState(EResidentState NewState);

	void State_Idle(float Dt);
	void State_Patrol(float Dt);
	void State_Wander(float Dt);
	void State_Investigate(float Dt);
	void State_Suspicious(float Dt);
	void State_Search(float Dt);
	void State_Chase(float Dt);
	void State_Attack(float Dt);
	void State_LosePlayer(float Dt);
	void State_SearchLastKnown(float Dt);
	void State_ReturnToPatrol(float Dt);

	// ---------------- perception ----------------
	void OnPerceptionUpdated(AActor* Actor, struct FAIStimulus Stimulus);
	void UpdateVisionModel(float Dt);
	bool CanSeePlayer() const;

	// ---------------- helpers ----------------
	EPathFollowingRequestResult::Type MoveToLocationEx(const FVector& Location, float Acceptance);
	void OpenNearbyDoor();
	void TryAttackPlayer();
	void SearchNearbyHidingSpots(const FVector& Around);
	void PickPatrolPoint();

	UPROPERTY()
	TObjectPtr<ASILIDResident> Resident;

	EResidentState State = EResidentState::Idle;
	float StateTime = 0.f;

	// memory
	FVector LastKnownPlayerLocation = FVector::ZeroVector;
	FVector InvestigationTarget = FVector::ZeroVector;
	float Suspicion = 0.f;        // 0..1, decays when unstimulated
	float LastSeenAge = 999.f;

	// patrol
	TArray<FVector> PatrolPoints; // from tagged actor points (BP-set or level tags)
	int32 PatrolIndex = 0;
	float IdleWait = 0.f;

	// timers
	float HearingMemory = 0.f;
	float DoorCheckCooldown = 0.f;
	float AttackCooldown = 0.f;

	// cached player
	UPROPERTY()
	TObjectPtr<class ASILIDCharacter> PlayerChar;
};
