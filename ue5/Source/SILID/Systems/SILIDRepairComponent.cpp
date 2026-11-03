// Repair component implementation. The work rhythm mirrors the barrier's
// plank hits: repeated E presses, loud, spaced by a cooldown. Requirement
// rows gate the work — the player can be physically blocked by a missing
// component even with the right tool (generator: wrench AND fuse).

#include "Systems/SILIDRepairComponent.h"
#include "Systems/SILIDInventoryComponent.h"
#include "Systems/SILIDItemData.h"
#include "Systems/SILIDNoiseEmitterComponent.h"
#include "Systems/SILIDSaveGame.h"
#include "Systems/SILIDTags.h"
#include "Player/SILIDCharacter.h"
#include "Components/AudioComponent.h"
#include "Engine/World.h"

// P13 objective fabric definition (see header contract)
FOnRepaired USILIDRepairComponent::OnAnyRepaired;

USILIDRepairComponent::USILIDRepairComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

// ------------------------------- queries ------------------------------------
bool USILIDRepairComponent::IsBroken() const
{
	return Condition < 100.f;
}

int32 USILIDRepairComponent::CurrentStepPresses() const
{
	if (CurrentRequirementIndex < Requirements.Num())
	{
		return Requirements[CurrentRequirementIndex].WorkPresses;
	}
	return BaseWorkPresses;
}

int32 USILIDRepairComponent::TotalPressesAll() const
{
	int32 Total = BaseWorkPresses;
	for (const FSILIDRepairRequirement& Req : Requirements)
	{
		Total += Req.WorkPresses;
	}
	return FMath::Max(1, Total);
}

int32 USILIDRepairComponent::AppliedPressesTotal() const
{
	int32 Applied = 0;
	for (int32 i = 0; i < CurrentRequirementIndex; ++i)
	{
		Applied += Requirements[i].WorkPresses;
	}
	return Applied + FMath::Min(WorkAppliedToStep, CurrentStepPresses());
}

int32 USILIDRepairComponent::GetWorkRemaining() const
{
	int32 Remaining = FMath::Max(0, CurrentStepPresses() - WorkAppliedToStep);
	// rows after the current one still have their full work ahead
	for (int32 i = CurrentRequirementIndex + 1; i < Requirements.Num(); ++i)
	{
		Remaining += Requirements[i].WorkPresses;
	}
	return Remaining;
}

FText USILIDRepairComponent::GetRepairStatusText() const
{
	if (!IsBroken())
	{
		return FText::GetEmpty();
	}

	if (CurrentRequirementIndex < Requirements.Num())
	{
		const FSILIDRepairRequirement& Req = Requirements[CurrentRequirementIndex];
		if (Req.RequiredToolTag.IsValid() && Req.ConsumedComponentTag.IsValid())
		{
			return FText::FromString(FString::Printf(TEXT("Needs %s and a %s"),
				*Req.RequiredToolTag.ToString(), *Req.ConsumedComponentTag.ToString()));
		}
		if (Req.RequiredToolTag.IsValid())
		{
			return FText::FromString(FString::Printf(TEXT("Needs %s"), *Req.RequiredToolTag.ToString()));
		}
		if (Req.ConsumedComponentTag.IsValid())
		{
			return FText::FromString(FString::Printf(TEXT("Missing %s"), *Req.ConsumedComponentTag.ToString()));
		}
		if (Req.RequiredKeyTag.IsValid())
		{
			return FText::FromString(FString::Printf(TEXT("Locked — needs %s"), *Req.RequiredKeyTag.ToString()));
		}
	}
	return FText::GetEmpty();
}

USILIDInventoryComponent* USILIDRepairComponent::GetInventory(const ASILIDCharacter* Player) const
{
	return Player ? Player->FindComponentByClass<USILIDInventoryComponent>() : nullptr;
}

USILIDNoiseEmitterComponent* USILIDRepairComponent::GetNoiseEmitter() const
{
	return GetOwner() ? GetOwner()->FindComponentByClass<USILIDNoiseEmitterComponent>() : nullptr;
}

bool USILIDRepairComponent::CanAttemptRepair(const ASILIDCharacter* Player) const
{
	return IsBroken() && Player && GetInventory(Player) != nullptr;
}

// ------------------------------- commands -----------------------------------
FSILIDOperationResult USILIDRepairComponent::ApplyRepairWork(ASILIDCharacter* Player)
{
	// invalid-state guard: repairing something that works is a no-op with a reason
	if (!IsBroken())
	{
		const FSILIDOperationResult Result = FSILIDOperationResult::Fail(
			ESILIDFailureCode::InvalidState, FText::FromString(TEXT("It already works.")), GetOwner() ? GetOwner()->GetFName() : NAME_None);
		OnRepairBlocked.Broadcast(Result);
		return Result;
	}

	USILIDInventoryComponent* Inventory = GetInventory(Player);
	if (!Player || !Inventory)
	{
		const FSILIDOperationResult Result = FSILIDOperationResult::Fail(
			ESILIDFailureCode::MissingTool, FText::FromString(TEXT("You need your hands on this.")));
		OnRepairBlocked.Broadcast(Result);
		return Result;
	}

	// cooldown spacing — same rhythm law as the barrier hit loop
	const UWorld* World = GetWorld();
	const float Now = World ? World->GetTimeSeconds() : 0.f;
	if (Now - LastWorkTime < WorkCooldownSeconds)
	{
		// silent rejection: not a failure of requirements, just pacing
		return FSILIDOperationResult::Fail(ESILIDFailureCode::InvalidState, FText::GetEmpty());
	}

	// evaluate the current requirement row (data-driven, capability queries only)
	if (CurrentRequirementIndex < Requirements.Num())
	{
		const FSILIDRepairRequirement& Req = Requirements[CurrentRequirementIndex];

		if (Req.RequiredToolTag.IsValid() && !Inventory->HasToolForTag(Req.RequiredToolTag))
		{
			const FSILIDOperationResult Result = FSILIDOperationResult::Fail(
				ESILIDFailureCode::MissingTool, GetRepairStatusText(), Req.RequiredToolTag.GetTagName());
			OnRepairBlocked.Broadcast(Result);
			return Result;
		}
		if (Req.RequiredKeyTag.IsValid() && !Inventory->HasKeyForTag(Req.RequiredKeyTag))
		{
			const FSILIDOperationResult Result = FSILIDOperationResult::Fail(
				ESILIDFailureCode::MissingKey, GetRepairStatusText(), Req.RequiredKeyTag.GetTagName());
			OnRepairBlocked.Broadcast(Result);
			return Result;
		}
		if (Req.ConsumedComponentTag.IsValid() && !Inventory->HasComponentForTag(Req.ConsumedComponentTag))
		{
			// component is only consumed when the row's work completes (below)
			const FSILIDOperationResult Result = FSILIDOperationResult::Fail(
				ESILIDFailureCode::MissingComponent, GetRepairStatusText(), Req.ConsumedComponentTag.GetTagName());
			OnRepairBlocked.Broadcast(Result);
			return Result;
		}
	}

	// one work increment
	LastWorkTime = Now;
	++WorkAppliedToStep;

	if (USILIDNoiseEmitterComponent* Noise = GetNoiseEmitter())
	{
		// repairs are loud — the Resident hears every press (spec section 8)
		Noise->EmitNoise(FVector(WorkNoiseLoudness, 0, 0), SILIDTags::NoiseDevice, GetOwner() ? GetOwner()->GetActorLocation() : FVector::ZeroVector);
	}

	// step complete?
	if (WorkAppliedToStep >= CurrentStepPresses())
	{
		WorkAppliedToStep = 0;

		if (CurrentRequirementIndex < Requirements.Num())
		{
			const FSILIDRepairRequirement& Req = Requirements[CurrentRequirementIndex];
			if (Req.ConsumedComponentTag.IsValid())
			{
				Inventory->ConsumeComponent(Req.ConsumedComponentTag);
			}
			++CurrentRequirementIndex;
		}
	}

	// condition is the applied fraction of all presses (int math, no drift)
	Condition = FMath::Clamp(100.f * AppliedPressesTotal() / TotalPressesAll(), 0.f, 100.f);

	OnRepairProgress.Broadcast(Condition, WorkAppliedToStep);

	if (!IsBroken())
	{
		CompleteRepair(Player);
	}

	FSILIDOperationResult Result = FSILIDOperationResult::Success();
	Result.RelevantId = GetOwner() ? GetOwner()->GetFName() : NAME_None;
	return Result;
}

void USILIDRepairComponent::CompleteRepair(ASILIDCharacter* Player)
{
	Condition = 100.f;
	CurrentRequirementIndex = Requirements.Num(); // everything satisfied
	WorkAppliedToStep = 0;

	if (RepairDoneSound)
	{
		RepairDoneSound->Play();
	}

	// consequences are the owner's business: the generator's BP lights rooms,
	// the valve's BP fills tanks — this component never touches them
	OnRepaired.Broadcast();

	// P13 fabric: world-level "something got fixed" (objectives listen;
	// story nouns stay in DA_Story data, never here — doc 00 §6)
	OnAnyRepaired.Broadcast();
}

void USILIDRepairComponent::BreakMachine()
{
	Condition = 0.f;
	CurrentRequirementIndex = 0;
	WorkAppliedToStep = 0;
	LastWorkTime = -FLT_MAX;
}

// ------------------------------- saveable -----------------------------------
void USILIDRepairComponent::SaveTo(USILIDSaveGame* SaveGame, const FString& SaveId) const
{
	if (!SaveGame)
	{
		return;
	}
	SaveGame->Flags.Add(SaveId, !IsBroken());
	SaveGame->Counters.Add(SaveId, AppliedPressesTotal());
}

void USILIDRepairComponent::LoadFrom(const USILIDSaveGame* SaveGame, const FString& SaveId)
{
	if (!SaveGame)
	{
		return;
	}

	// restore by replaying total presses: requirements re-evaluate from data
	// on the way back up, so a save never bakes in requirement configuration
	int32 PressesToReplay = 0;
	if (const int32* Found = SaveGame->Counters.Find(SaveId))
	{
		PressesToReplay = *Found;
	}

	BreakMachine();

	const int32 Total = TotalPressesAll();

	// replay presses without inventory checks — the save is authoritative
	// about what was already consumed and carried
	int32 Replayed = 0;
	while (Replayed < PressesToReplay && Replayed < Total && IsBroken())
	{
		++WorkAppliedToStep;
		++Replayed;
		if (WorkAppliedToStep >= CurrentStepPresses())
		{
			WorkAppliedToStep = 0;
			if (CurrentRequirementIndex < Requirements.Num())
			{
				++CurrentRequirementIndex;
			}
		}
	}

	if (Replayed >= Total && PressesToReplay >= Total)
	{
		CompleteRepair(nullptr);
	}
	else
	{
		Condition = FMath::Clamp(100.f * Replayed / Total, 0.f, 99.f);
	}
}
