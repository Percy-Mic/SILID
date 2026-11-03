// Objective subsystem implementation (P13). The fabric: world events go IN
// (escape routes, P7 repairs, P8 power state), story tags get recorded, data
// rows get evaluated, HUD-facing delegates go OUT. Nothing polls, nothing is
// completed by hand, and no story noun is named in code (doc 00 §6).
// Save law (doc 14 P19 discipline): only raw facts persist (the ledger +
// completed/failed ids). Activation state is NOT saved — on load, completed
// rows re-complete from the ledger and required rows auto-activate; optional
// non-completed rows re-arm, so a loaded run can still finish side tasks.

#include "Systems/SILIDObjectiveSubsystem.h"
#include "Systems/SILIDTags.h"
#include "Systems/SILIDGameMode.h"
#include "Systems/SILIDRepairComponent.h"
#include "Systems/SILIDSaveGame.h"
#include "Kismet/GameplayStatics.h"
#include "Logging/SILIDLog.h"

USILIDObjectiveSubsystem::USILIDObjectiveSubsystem()
{
	// No Tick — this subsystem is a pure event evaluator (doc 12 §9 law).
}

bool USILIDObjectiveSubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
	// Gameplay/PIE only — the editor's preview worlds get no objective fabric.
	if (!Super::ShouldCreateSubsystem(Outer))
	{
		return false;
	}
	const UWorld* World = Cast<UWorld>(Outer);
	return World && (World->WorldType == EWorldType::Game || World->WorldType == EWorldType::PIE);
}

void USILIDObjectiveSubsystem::OnWorldBeginPlay(UWorld& InWorld)
{
	Super::OnWorldBeginPlay(InWorld);
	BindWorldEvents();

	// The default story spine is the GameMode's "find a way out"; authored
	// rows (DA_Story content) replace it by declaring their own Requirements.
	// Nothing is auto-completed here — the fabric only records what happens.
	SILID_LOG_CAT(LogSILIDObjectives, TEXT("ObjectiveSubsystem online: %d configured rows"), ObjectiveDefs.Num());
}

void USILIDObjectiveSubsystem::Deinitialize()
{
	UnbindWorldEvents();
	Super::Deinitialize();
}

// ------------------------------- bindings -----------------------------------
void USILIDObjectiveSubsystem::BindWorldEvents()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	// Escape is reported by the GameMode's OnEscapeReached multicast (the
	// GameMode owns "what winning means" — the route's TryEscape reports
	// through it; one delegate, no per-route world scans, doc 09 §9).
	if (ASILIDGameMode* GM = Cast<ASILIDGameMode>(UGameplayStatics::GetGameMode(World)))
	{
		GM->OnEscapeReached.AddDynamic(this, &USILIDObjectiveSubsystem::HandleGameModeEscape);
	}

	// P7/P8: the generator's repair + power state (the subsystem's own
	// delegates — the same wiring pattern the P8 seam uses).
	if (UElectricalSystemSubsystem* Electrical = World->GetSubsystem<UElectricalSystemSubsystem>())
	{
		Electrical->OnGeneratorStateChanged.AddDynamic(this, &USILIDObjectiveSubsystem::HandleGeneratorStateChanged);
		Electrical->OnBreakerTripped.AddDynamic(this, &USILIDObjectiveSubsystem::HandleBreakerTripped);
		Electrical->OnNodePowerChanged.AddDynamic(this, &USILIDObjectiveSubsystem::HandleNodePowerChanged);
	}

	// P7: a repair finishing anywhere in the world (the component-static
	// multicast; catches the generator AND every other machine).
	USILIDRepairComponent::OnAnyRepaired.AddDynamic(this, &USILIDObjectiveSubsystem::HandleAnyRepaired);
}

void USILIDObjectiveSubsystem::UnbindWorldEvents()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}
	if (ASILIDGameMode* GM = Cast<ASILIDGameMode>(UGameplayStatics::GetGameMode(World)))
	{
		GM->OnEscapeReached.RemoveDynamic(this, &USILIDObjectiveSubsystem::HandleGameModeEscape);
	}
	if (UElectricalSystemSubsystem* Electrical = World->GetSubsystem<UElectricalSystemSubsystem>())
	{
		Electrical->OnGeneratorStateChanged.RemoveDynamic(this, &USILIDObjectiveSubsystem::HandleGeneratorStateChanged);
		Electrical->OnBreakerTripped.RemoveDynamic(this, &USILIDObjectiveSubsystem::HandleBreakerTripped);
		Electrical->OnNodePowerChanged.RemoveDynamic(this, &USILIDObjectiveSubsystem::HandleNodePowerChanged);
	}
	USILIDRepairComponent::OnAnyRepaired.RemoveDynamic(this, &USILIDObjectiveSubsystem::HandleAnyRepaired);
}

// ------------------------------- commands -----------------------------------
bool USILIDObjectiveSubsystem::ActivateObjective(FName ObjectiveId)
{
	if (Objectives.Contains(ObjectiveId))
	{
		return false; // already tracked
	}
	const TObjectPtr<const USILIDObjectiveData>* FoundDef = ObjectiveDefs.FindByPredicate(
		[ObjectiveId](const TObjectPtr<const USILIDObjectiveData>& D) { return D && D->ObjectiveId == ObjectiveId; });
	const USILIDObjectiveData* Def = FoundDef ? FoundDef->Get() : nullptr;
	if (!Def)
	{
		SILID_WARN_CAT(LogSILIDObjectives, TEXT("ActivateObjective: unknown id %s"), *ObjectiveId.ToString());
		return false;
	}

	FSILIDObjectiveState& State = Objectives.Add(ObjectiveId);
	State.Def = Def;
	State.Progress = 0;
	State.bCompleted = false;
	State.bFailed = false;

	OnObjectiveActivated.Broadcast(ObjectiveId);
	SILID_LOG_CAT(LogSILIDObjectives, TEXT("Objective activated: %s (optional: %d)"), *ObjectiveId.ToString(), Def->bOptional ? 1 : 0);
	return true;
}

void USILIDObjectiveSubsystem::RecordProgress(FName ObjectiveId, int32 Units)
{
	FSILIDObjectiveState* State = Objectives.Find(ObjectiveId);
	if (!State || !State->Def)
	{
		return;
	}
	if (State->bCompleted || State->bFailed)
	{
		return;
	}
	State->Progress += FMath::Max(1, Units);
	EvaluateActiveObjectives();
}

void USILIDObjectiveSubsystem::RecordStoryTag(FGameplayTag StoryTag)
{
	if (!StoryTag.IsValid())
	{
		return;
	}
	if (StoryLedger.HasTagExact(StoryTag))
	{
		return; // facts record once
	}
	StoryLedger.AddTag(StoryTag);
	OnStoryTagRecorded.Broadcast(StoryTag, NAME_None);
	EvaluateActiveObjectives();
}

void USILIDObjectiveSubsystem::FailObjective(FName ObjectiveId)
{
	FailObjectiveInternal(ObjectiveId, true);
}

void USILIDObjectiveSubsystem::ActivateAll()
{
	for (const USILIDObjectiveData* Def : ObjectiveDefs)
	{
		if (Def)
		{
			ActivateObjective(Def->ObjectiveId);
		}
	}
}

// ------------------------------- queries ------------------------------------
bool USILIDObjectiveSubsystem::IsActive(FName ObjectiveId) const
{
	const FSILIDObjectiveState* State = Objectives.Find(ObjectiveId);
	return State && !State->bCompleted && !State->bFailed;
}

bool USILIDObjectiveSubsystem::IsCompleted(FName ObjectiveId) const
{
	const FSILIDObjectiveState* State = Objectives.Find(ObjectiveId);
	return State && State->bCompleted;
}

bool USILIDObjectiveSubsystem::AreRequiredObjectivesComplete() const
{
	for (const TPair<FName, FSILIDObjectiveState>& Pair : Objectives)
	{
		const FSILIDObjectiveState& State = Pair.Value;
		if (State.Def && !State.Def->bOptional && !State.bCompleted && !State.bFailed)
		{
			return false;
		}
	}
	return true;
}

FText USILIDObjectiveSubsystem::GetCurrentObjectiveText() const
{
	const FSILIDObjectiveState* Best = nullptr;
	for (const TPair<FName, FSILIDObjectiveState>& Pair : Objectives)
	{
		const FSILIDObjectiveState& State = Pair.Value;
		if (!State.Def || State.bCompleted || State.bFailed || State.Def->bOptional)
		{
			continue;
		}
		if (!Best || State.Def->Priority < Best->Def->Priority)
		{
			Best = &State;
		}
	}
	return Best && Best->Def ? Best->Def->Title : FText::GetEmpty();
}

FGameplayTagContainer USILIDObjectiveSubsystem::GetMissingRequirements() const
{
	FGameplayTagContainer Missing;
	for (const TPair<FName, FSILIDObjectiveState>& Pair : Objectives)
	{
		const FSILIDObjectiveState& State = Pair.Value;
		if (!State.Def || State.bCompleted || State.bFailed)
		{
			continue;
		}
		FGameplayTagContainer MissingRow = State.Def->Requirements;
		MissingRow.RemoveTags(StoryLedger); // drop the satisfied; keep the unmet
		Missing.AppendTags(MissingRow);
	}
	return Missing;
}

bool USILIDObjectiveSubsystem::HasStoryTag(FGameplayTag StoryTag) const
{
	return StoryLedger.HasTagExact(StoryTag);
}

// ------------------------------- debug --------------------------------------
void USILIDObjectiveSubsystem::SILID_Debug_Objectives()
{
	SILID_LOG_CAT(LogSILIDObjectives, TEXT("---- SILID.Debug.Objectives ----"));
	SILID_LOG_CAT(LogSILIDObjectives, TEXT("Configured rows: %d"), ObjectiveDefs.Num());
	for (const TPair<FName, FSILIDObjectiveState>& Pair : Objectives)
	{
		const FSILIDObjectiveState& State = Pair.Value;
		const bool bOptional = State.Def ? State.Def->bOptional : false;
		const int32 Required = State.Def ? State.Def->RequiredProgressCount : 0;
		SILID_LOG_CAT(LogSILIDObjectives, TEXT("  %s : %s | progress %d/%d | optional %d"),
			*Pair.Key.ToString(),
			State.bCompleted ? TEXT("DONE") : (State.bFailed ? TEXT("FAILED") : TEXT("ACTIVE")),
			State.Progress, Required, bOptional ? 1 : 0);
	}
	SILID_LOG_CAT(LogSILIDObjectives, TEXT("Story ledger (%d):"), StoryLedger.Num());
	for (const FGameplayTag& Tag : StoryLedger)
	{
		SILID_LOG_CAT(LogSILIDObjectives, TEXT("  %s"), *Tag.ToString());
	}
}

// ------------------------------- evaluation ---------------------------------
bool USILIDObjectiveSubsystem::EvaluateActiveObjectives()
{
	bool bAnyCompleted = false;
	for (auto It = Objectives.CreateIterator(); It; ++It)
	{
		FSILIDObjectiveState& State = It.Value();
		if (!State.Def || State.bCompleted || State.bFailed)
		{
			continue;
		}
		const bool bTagsMet = State.Def->Requirements.IsEmpty() || StoryLedger.HasAllExact(State.Def->Requirements);
		const bool bCountMet = State.Def->RequiredProgressCount <= 0 || State.Progress >= State.Def->RequiredProgressCount;
		if (bTagsMet && bCountMet)
		{
			const FName Id = It.Key();
			CompleteObjective(Id);
			bAnyCompleted = true;
		}
	}
	return bAnyCompleted;
}

void USILIDObjectiveSubsystem::CompleteObjective(FName ObjectiveId)
{
	FSILIDObjectiveState* State = Objectives.Find(ObjectiveId);
	if (!State || State->bCompleted || State->bFailed)
	{
		return;
	}
	State->bCompleted = true;
	OnObjectiveCompleted.Broadcast(ObjectiveId);
	SILID_LOG_CAT(LogSILIDObjectives, TEXT("Objective COMPLETED: %s"), *ObjectiveId.ToString());
}

void USILIDObjectiveSubsystem::FailObjectiveInternal(FName ObjectiveId, bool bExplicit)
{
	FSILIDObjectiveState* State = Objectives.Find(ObjectiveId);
	if (!State || State->bCompleted || State->bFailed)
	{
		return;
	}
	if (State->Def && State->Def->bOptional)
	{
		// optional objectives cannot fail the run — they just stay open
		return;
	}
	State->bFailed = bExplicit;
	OnObjectiveFailed.Broadcast(ObjectiveId);
	SILID_LOG_CAT(LogSILIDObjectives, TEXT("Objective FAILED: %s"), *ObjectiveId.ToString());
}

// ------------------------------- event handlers -----------------------------
// Story-tag fabric (doc 09 §9): every handler funnels into RecordStoryTag —
// these are the ONLY places system events become story facts. Tag names are
// SILID grammar (system facts, like Power.Node.*), never story nouns
// (doc 00 §6: no C++ string mentions of story content).

void USILIDObjectiveSubsystem::HandleGameModeEscape()
{
	RecordStoryTag(SILIDTags::StoryEscapeReady);
	RecordStoryTag(SILIDTags::StoryEscapeUsed);
}

void USILIDObjectiveSubsystem::HandleAnyRepaired()
{
	// The repair broadcast carries no id — the generic "a machine was fixed"
	// fact is what objectives key on; a specific machine's owner Blueprint
	// can add its own finer tags via RecordStoryTag (story nouns stay in data).
	RecordStoryTag(SILIDTags::StoryMachineRepaired);
}

void USILIDObjectiveSubsystem::HandleGeneratorStateChanged(ESILIDPowerSourceState NewState)
{
	if (NewState == ESILIDPowerSourceState::Running)
	{
		RecordStoryTag(SILIDTags::StoryPowerRunning);
	}
	else if (NewState == ESILIDPowerSourceState::Off)
	{
		RecordStoryTag(SILIDTags::StoryPowerOff);
	}
	// NoFuel / NeedsRepair / Fueled are machine bookkeeping, not story facts.
}

void USILIDObjectiveSubsystem::HandleBreakerTripped(FGameplayTag NodeTag)
{
	(void)NodeTag;
	RecordStoryTag(SILIDTags::StoryPowerBreakerTripped);
}

void USILIDObjectiveSubsystem::HandleNodePowerChanged(FGameplayTag NodeTag, bool bPowered)
{
	if (!bPowered)
	{
		return; // objectives complete on facts; the journal never un-completes
	}
	// Mirror each node as Story.Power.<NodeLeaf> when that tag is registered
	// ("Power.Node.House" → "Story.Power.House"); objectives query the leaf.
	const FString NodeLeaf = NodeTag.ToString().RightChop(FString(TEXT("power.node.")).Len());
	const FGameplayTag NodeStoryTag = FGameplayTag::RequestGameplayTag(
		FName(*(FString(TEXT("Story.Power.")) + NodeLeaf)), /*ErrorIfNotFound*/ false);
	if (NodeStoryTag.IsValid())
	{
		RecordStoryTag(NodeStoryTag);
	}
	RecordStoryTag(SILIDTags::StoryPowerAnyNode);
}

// ------------------------------- save ---------------------------------------
void USILIDObjectiveSubsystem::SaveTo(USILIDSaveGame* SaveGame) const
{
	if (!SaveGame)
	{
		return;
	}
	// raw facts only (doc 14 P19 discipline): the ledger + per-row terminal/
	// active ids — activation is replayed on load, never trusted wholesale
	for (const FGameplayTag& Tag : StoryLedger)
	{
		SaveGame->Flags.Add(FString::Printf(TEXT("story.tag.%s"), *Tag.GetTagName().ToString()), true);
	}
	for (const TPair<FName, FSILIDObjectiveState>& Pair : Objectives)
	{
		const FSILIDObjectiveState& State = Pair.Value;
		if (State.bCompleted)
		{
			SaveGame->Flags.Add(FString::Printf(TEXT("objective.%s.done"), *Pair.Key.ToString()), true);
		}
		else if (State.bFailed)
		{
			SaveGame->Flags.Add(FString::Printf(TEXT("objective.%s.failed"), *Pair.Key.ToString()), true);
		}
		else if (State.Def)
		{
			SaveGame->Flags.Add(FString::Printf(TEXT("objective.%s.active"), *Pair.Key.ToString()), true);
			SaveGame->Counters.Add(FString::Printf(TEXT("objective.%s.progress"), *Pair.Key.ToString()), State.Progress);
		}
	}
}

void USILIDObjectiveSubsystem::LoadFrom(const USILIDSaveGame* SaveGame)
{
	if (!SaveGame)
	{
		return;
	}
	// 1. rebuild the ledger from the saved facts
	for (const TPair<FString, bool>& Flag : SaveGame->Flags)
	{
		if (Flag.Key.StartsWith(TEXT("story.tag.")) && Flag.Value)
		{
			const FGameplayTag Tag = FGameplayTag::RequestGameplayTag(
				FName(*Flag.Key.RightChop(FString(TEXT("story.tag.")).Len())), /*ErrorIfNotFound*/ false);
			if (Tag.IsValid())
			{
				StoryLedger.AddTag(Tag);
			}
		}
	}
	// 2. completed/failed restore directly
	for (const TPair<FString, bool>& Flag : SaveGame->Flags)
	{
		if (!Flag.Value)
		{
			continue;
		}
		FName Id;
		bool bDone = false;
		// suffix-test via LeftChop (the map's key is const through this walk)
		if (Flag.Key.EndsWith(TEXT(".done")))
		{
			Id = FName(*Flag.Key.LeftChop(FString(TEXT(".done")).Len()).Mid(FString(TEXT("objective.")).Len()));
			bDone = true;
		}
		else if (Flag.Key.EndsWith(TEXT(".failed")))
		{
			Id = FName(*Flag.Key.LeftChop(FString(TEXT(".failed")).Len()).Mid(FString(TEXT("objective.")).Len()));
		}
		else
		{
			continue;
		}
		if (FSILIDObjectiveState* ExistingState = Objectives.Find(Id))
		{
			ExistingState->bCompleted = bDone;
			ExistingState->bFailed = !bDone;
		}
		else if (bDone)
		{
			// completed REQUIRED rows auto-activate so a loaded run still
			// finishes its story; optional rows stay untracked (re-arm fresh)
			const TObjectPtr<const USILIDObjectiveData>* FoundDef = ObjectiveDefs.FindByPredicate(
				[Id](const TObjectPtr<const USILIDObjectiveData>& D) { return D && D->ObjectiveId == Id; });
			const USILIDObjectiveData* Def = FoundDef ? FoundDef->Get() : nullptr;
			if (Def && !Def->bOptional)
			{
				ActivateObjective(Id);
				if (FSILIDObjectiveState* State = Objectives.Find(Id))
				{
					State->bCompleted = true;
				}
			}
		}
	}
	// 2.5 re-arm rows that were ACTIVE when saved (replayed from the id
	// facts; progress restores in step 3 below)
	for (const TPair<FString, bool>& Flag : SaveGame->Flags)
	{
		if (!Flag.Value || !Flag.Key.StartsWith(TEXT("objective.")) || !Flag.Key.EndsWith(TEXT(".active")))
		{
			continue;
		}
		FString IdStr = Flag.Key;
		IdStr.RemoveFromStart(TEXT("objective."));
		IdStr.RemoveFromEnd(TEXT(".active"));
		ActivateObjective(FName(*IdStr));
	}
	// 3. progress restore for still-active rows
	for (const TPair<FString, int32>& Counter : SaveGame->Counters)
	{
		if (!Counter.Key.StartsWith(TEXT("objective.")) || !Counter.Key.EndsWith(TEXT(".progress")))
		{
			continue;
		}
		FString IdStr = Counter.Key;
		IdStr.RemoveFromStart(TEXT("objective."));
		IdStr.RemoveFromEnd(TEXT(".progress"));
		if (FSILIDObjectiveState* State = Objectives.Find(FName(*IdStr)))
		{
			State->Progress = Counter.Value;
		}
	}
}
