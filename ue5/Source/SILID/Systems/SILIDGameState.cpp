#include "Systems/SILIDGameState.h"
#include "Net/UnrealNetwork.h"
#include "Logging/SILIDLog.h"

ASILIDGameState::ASILIDGameState()
{
	// AGameStateBase already replicates; nothing extra to enable here.
	RunPhase = ESILIDRunPhase::Menu;
	bEscaped = false;
}

void ASILIDGameState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	DOREPLIFETIME(ASILIDGameState, RunPhase);
	DOREPLIFETIME(ASILIDGameState, bEscaped);
	DOREPLIFETIME(ASILIDGameState, CurrentObjectiveId);
	DOREPLIFETIME(ASILIDGameState, CompletedObjectiveCount);
}

void ASILIDGameState::SetRunPhase(ESILIDRunPhase NewPhase)
{
	if (!HasAuthority() && GetNetMode() != NM_Standalone)
	{
		return; // server-owned state; clients never author it
	}
	if (RunPhase == NewPhase)
	{
		return;
	}
	RunPhase = NewPhase;
	SILID_LOG_CAT(LogSILID, TEXT("RunState phase=%d"), static_cast<int32>(NewPhase));
	OnRunStateChanged.Broadcast();
}

void ASILIDGameState::SetEscaped(bool bNewEscaped)
{
	if (!HasAuthority() && GetNetMode() != NM_Standalone)
	{
		return;
	}
	if (bEscaped == bNewEscaped)
	{
		return;
	}
	bEscaped = bNewEscaped;
	if (bEscaped)
	{
		SetRunPhase(ESILIDRunPhase::Escaped);
	}
	SILID_LOG_CAT(LogSILID, TEXT("RunState escaped=%s"), bEscaped ? TEXT("true") : TEXT("false"));
	OnRunStateChanged.Broadcast();
}

void ASILIDGameState::SetObjectiveSummary(FName ObjectiveId, int32 InCompletedCount)
{
	if (!HasAuthority() && GetNetMode() != NM_Standalone)
	{
		return;
	}
	CurrentObjectiveId = ObjectiveId;
	CompletedObjectiveCount = FMath::Max(0, InCompletedCount);
	OnRunStateChanged.Broadcast();
}

void ASILIDGameState::OnRep_RunPhase()
{
	// clients: the value has already landed, just notify listeners
	OnRunStateChanged.Broadcast();
}

void ASILIDGameState::OnRep_Escaped()
{
	OnRunStateChanged.Broadcast();
}
