// Native gameplay tag constants. Registered on startup so C++ can compare
// tags without string lookups and designers can use the same tags in BP.

#pragma once

#include "GameplayTagContainer.h"

namespace SILIDTags
{
	// noise classes (spec section 8)
	SILID_API extern const FGameplayTag NoiseFootstep;
	SILID_API extern const FGameplayTag NoiseRun;
	SILID_API extern const FGameplayTag NoiseDoor;
	SILID_API extern const FGameplayTag NoiseImpact;
	SILID_API extern const FGameplayTag NoiseBreak;
	SILID_API extern const FGameplayTag NoiseDrawer;
	SILID_API extern const FGameplayTag NoiseDevice;
	SILID_API extern const FGameplayTag NoiseVoice;

	// item unlock families (spec section 6: keys)
	SILID_API extern const FGameplayTag LockFrontDoor;
	SILID_API extern const FGameplayTag LockBackDoor;
	SILID_API extern const FGameplayTag LockDrawer;
	SILID_API extern const FGameplayTag LockSafe;

	// room ids (spec section 16)
	SILID_API extern const FGameplayTag RoomSala;
	SILID_API extern const FGameplayTag RoomKusina;
	SILID_API extern const FGameplayTag RoomAklat;
	SILID_API extern const FGameplayTag RoomHallway;
	SILID_API extern const FGameplayTag RoomKwarto;
	SILID_API extern const FGameplayTag RoomBodega;

	// power nodes (doc 01 §5 Power.Node.* — P8 electricity). Devices name
	// their circuit node with a tag; the electrical subsystem walks the
	// graph by tag, never by hard reference (doc 05 §2).
	SILID_API extern const FGameplayTag PowerNodeGenerator;
	SILID_API extern const FGameplayTag PowerNodeFuseBox;
	SILID_API extern const FGameplayTag PowerNodeBreaker;
	SILID_API extern const FGameplayTag PowerNodeHouse;

	// story facts (P13 objective fabric — doc 09 §9). System-grammar tags,
	// NOT story nouns: rows complete against these; the DA_Story data owns
	// the narrative wording. Registered so saves/load and BP can use them.
	SILID_API extern const FGameplayTag StoryEscapeReady;
	SILID_API extern const FGameplayTag StoryEscapeUsed;
	SILID_API extern const FGameplayTag StoryMachineRepaired;
	SILID_API extern const FGameplayTag StoryPowerRunning;
	SILID_API extern const FGameplayTag StoryPowerOff;
	SILID_API extern const FGameplayTag StoryPowerBreakerTripped;
	SILID_API extern const FGameplayTag StoryPowerAnyNode;
}

/** Registers the native tags once at module start. */
struct FSILIDTagRegistrar
{
	FSILIDTagRegistrar();
};
