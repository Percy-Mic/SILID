#include "Systems/SILIDTags.h"

namespace SILIDTags
{
	#define DEFINE_TAG(Name, TagName) const FGameplayTag Name = FGameplayTag::RequestGameplayTag(FName(TagName));
	DEFINE_TAG(NoiseFootstep, TEXT("Noise.Footstep"))
	DEFINE_TAG(NoiseRun,      TEXT("Noise.Run"))
	DEFINE_TAG(NoiseDoor,     TEXT("Noise.Door"))
	DEFINE_TAG(NoiseImpact,   TEXT("Noise.Impact"))
	DEFINE_TAG(NoiseBreak,    TEXT("Noise.Break"))
	DEFINE_TAG(NoiseDrawer,   TEXT("Noise.Drawer"))
	DEFINE_TAG(NoiseDevice,   TEXT("Noise.Device"))
	DEFINE_TAG(NoiseVoice,    TEXT("Noise.Voice"))
	DEFINE_TAG(LockFrontDoor, TEXT("Lock.FrontDoor"))
	DEFINE_TAG(LockBackDoor,  TEXT("Lock.BackDoor"))
	DEFINE_TAG(LockDrawer,    TEXT("Lock.Drawer"))
	DEFINE_TAG(LockSafe,      TEXT("Lock.Safe"))
	DEFINE_TAG(RoomSala,      TEXT("Room.Sala"))
	DEFINE_TAG(RoomKusina,    TEXT("Room.Kusina"))
	DEFINE_TAG(RoomAklat,     TEXT("Room.Aklat"))
	DEFINE_TAG(RoomHallway,   TEXT("Room.Hallway"))
	DEFINE_TAG(RoomKwarto,    TEXT("Room.Kwarto"))
	DEFINE_TAG(RoomBodega,    TEXT("Room.Bodega"))
	DEFINE_TAG(PowerNodeGenerator, TEXT("Power.Node.Generator"))
	DEFINE_TAG(PowerNodeFuseBox,   TEXT("Power.Node.FuseBox"))
	DEFINE_TAG(PowerNodeBreaker,   TEXT("Power.Node.Breaker"))
	DEFINE_TAG(PowerNodeHouse,     TEXT("Power.Node.House"))
	DEFINE_TAG(StoryEscapeReady,        TEXT("Story.Escape.Ready"))
	DEFINE_TAG(StoryEscapeUsed,         TEXT("Story.Escape.Used"))
	DEFINE_TAG(StoryMachineRepaired,    TEXT("Story.MachineRepaired"))
	DEFINE_TAG(StoryPowerRunning,       TEXT("Story.Power.Running"))
	DEFINE_TAG(StoryPowerOff,           TEXT("Story.Power.Off"))
	DEFINE_TAG(StoryPowerBreakerTripped, TEXT("Story.Power.BreakerTripped"))
	DEFINE_TAG(StoryPowerAnyNode,       TEXT("Story.Power.AnyNode"))
	#undef DEFINE_TAG
}

FSILIDTagRegistrar::FSILIDTagRegistrar()
{
	// ensure the native tags exist in the tag table even if no asset uses them
	FGameplayTag::RequestGameplayTag(FName("Noise.Footstep"), true);
	FGameplayTag::RequestGameplayTag(FName("Noise.Run"), true);
	FGameplayTag::RequestGameplayTag(FName("Noise.Door"), true);
	FGameplayTag::RequestGameplayTag(FName("Noise.Impact"), true);
	FGameplayTag::RequestGameplayTag(FName("Noise.Break"), true);
	FGameplayTag::RequestGameplayTag(FName("Noise.Drawer"), true);
	FGameplayTag::RequestGameplayTag(FName("Noise.Device"), true);
	FGameplayTag::RequestGameplayTag(FName("Noise.Voice"), true);
	FGameplayTag::RequestGameplayTag(FName("Lock.FrontDoor"), true);
	FGameplayTag::RequestGameplayTag(FName("Lock.BackDoor"), true);
	FGameplayTag::RequestGameplayTag(FName("Lock.Drawer"), true);
	FGameplayTag::RequestGameplayTag(FName("Lock.Safe"), true);
	FGameplayTag::RequestGameplayTag(FName("Room.Sala"), true);
	FGameplayTag::RequestGameplayTag(FName("Room.Kusina"), true);
	FGameplayTag::RequestGameplayTag(FName("Room.Aklat"), true);
	FGameplayTag::RequestGameplayTag(FName("Room.Hallway"), true);
	FGameplayTag::RequestGameplayTag(FName("Room.Kwarto"), true);
	FGameplayTag::RequestGameplayTag(FName("Room.Bodega"), true);
	FGameplayTag::RequestGameplayTag(FName("Power.Node.Generator"), true);
	FGameplayTag::RequestGameplayTag(FName("Power.Node.FuseBox"), true);
	FGameplayTag::RequestGameplayTag(FName("Power.Node.Breaker"), true);
	FGameplayTag::RequestGameplayTag(FName("Power.Node.House"), true);
	FGameplayTag::RequestGameplayTag(FName("Story.Escape.Ready"), true);
	FGameplayTag::RequestGameplayTag(FName("Story.Escape.Used"), true);
	FGameplayTag::RequestGameplayTag(FName("Story.MachineRepaired"), true);
	FGameplayTag::RequestGameplayTag(FName("Story.Power.Running"), true);
	FGameplayTag::RequestGameplayTag(FName("Story.Power.Off"), true);
	FGameplayTag::RequestGameplayTag(FName("Story.Power.BreakerTripped"), true);
	FGameplayTag::RequestGameplayTag(FName("Story.Power.AnyNode"), true);
}

static FSILIDTagRegistrar GSILIDTagRegistrar;
