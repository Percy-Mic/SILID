#include "Systems/SILIDDifficultySubsystem.h"
#include "Engine/World.h"

USILIDDifficultySubsystem* USILIDDifficultySubsystem::Get(const UObject* WorldContext)
{
	if (!WorldContext)
	{
		return nullptr;
	}
	const UWorld* World = WorldContext->GetWorld();
	return World ? World->GetSubsystem<USILIDDifficultySubsystem>() : nullptr;
}

float USILIDDifficultySubsystem::GetEnemySpeedMultiplier() const
{
	switch (Current)
	{
		case EDifficulty::Easy:   return 0.8f;
		case EDifficulty::Hard:   return 1.15f;
		default:                  return 1.f;
	}
}

float USILIDDifficultySubsystem::GetAISensitivityMultiplier() const
{
	switch (Current)
	{
		case EDifficulty::Easy:   return 0.75f;
		case EDifficulty::Hard:   return 1.35f;
		default:                  return 1.f;
	}
}

float USILIDDifficultySubsystem::GetHideSearchChance() const
{
	switch (Current)
	{
		case EDifficulty::Easy:   return 0.15f;
		case EDifficulty::Hard:   return 0.45f;
		default:                  return 0.3f;
	}
}

float USILIDDifficultySubsystem::GetFlashlightDrainMultiplier() const
{
	switch (Current)
	{
		case EDifficulty::Easy:   return 0.8f;
		case EDifficulty::Hard:   return 1.3f;
		default:                  return 1.f;
	}
}

float USILIDDifficultySubsystem::GetResourceMultiplier() const
{
	switch (Current)
	{
		case EDifficulty::Easy:   return 1.5f;
		case EDifficulty::Hard:   return 0.6f;
		default:                  return 1.f;
	}
}

bool USILIDDifficultySubsystem::ShouldShowHints() const
{
	return Current != EDifficulty::Hard;
}

float USILIDDifficultySubsystem::GetDetectionForgiveness() const
{
	// scales the sight cone and detection time: Easy literally sees you less
	switch (Current)
	{
		case EDifficulty::Easy:   return 0.8f;  // 80% cone width, slower detect
		case EDifficulty::Hard:   return 1.2f;
		default:                  return 1.f;
	}
}

int32 USILIDDifficultySubsystem::ExtraHidingSpots() const
{
	// Easy: more hiding opportunities (spec section 21); Hard: fewer
	switch (Current)
	{
		case EDifficulty::Easy:   return 2;
		case EDifficulty::Hard:   return -1;
		default:                  return 0;
	}
}

int32 USILIDDifficultySubsystem::ExtraMutationsPerChapter() const
{
	switch (Current)
	{
		case EDifficulty::Easy:   return 0;
		case EDifficulty::Hard:   return 2;
		default:                  return 1;
	}
}
