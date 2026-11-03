// The Resident (spec sections 7, 14): an ACharacter so he walks the navmesh,
// opens doors, and reads as human. His wrongness comes from behavior, not
// monster design. The visual is a placeholder capsule until the MetaHuman/
// Character Creator pass - swap the mesh, keep the AI.

#pragma once

#include "GameFramework/Character.h"
#include "SILIDResident.generated.h"

class UAIPerceptionComponent;
class UAISenseConfig_Sight;
class UAISenseConfig_Hearing;
class UAISense_Sight;
class USILIDNoiseEmitterComponent;

UCLASS()
class SILID_API ASILIDResident : public ACharacter
{
	GENERATED_BODY()

public:
	ASILIDResident();

	/** Footstep noise while he moves (the player hears HIM too). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Resident")
	TObjectPtr<USILIDNoiseEmitterComponent> NoiseEmitter;

	/** Perception (sight + hearing configs are built here in code). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Resident")
	TObjectPtr<UAIPerceptionComponent> Perception;

	/** Sight/hearing sense configs (owned by the perception component). */
	UPROPERTY(Transient)
	TObjectPtr<UAISenseConfig_Sight> SightConfig;

	UPROPERTY(Transient)
	TObjectPtr<UAISenseConfig_Hearing> HearingConfig;

	/** Damage per attack (spec section 4: damage/death). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Resident", meta = (ClampMin = "1"))
	float AttackDamage = 100.f;

	/** Attack reach. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Resident", meta = (ClampMin = "60"))
	float AttackReach = 140.f;

	/** Ambient voice/breath loop interval (0 = off; audio asset is manual). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Resident")
	float AmbientSoundInterval = 14.f;

protected:
	virtual void BeginPlay() override;

private:
	FTimerHandle AmbientSoundTimer;

	void EmitAmbientPresence();
};
