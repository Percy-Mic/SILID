#include "Systems/SILIDPlayerState.h"
#include "Net/UnrealNetwork.h"
#include "Logging/SILIDLog.h"

ASILIDPlayerState::ASILIDPlayerState()
{
	bReplicates = true;
	bDowned = false;
	bReady = false;
}

void ASILIDPlayerState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	DOREPLIFETIME(ASILIDPlayerState, bDowned);
	DOREPLIFETIME(ASILIDPlayerState, RoleTag);
	DOREPLIFETIME(ASILIDPlayerState, bReady);
}

void ASILIDPlayerState::SetDowned(bool bNewDowned)
{
	if (!HasAuthority() && GetNetMode() != NM_Standalone)
	{
		return; // server-owned; clients never author it
	}
	if (bDowned == bNewDowned)
	{
		return;
	}
	bDowned = bNewDowned;
	OnDownedChanged.Broadcast(bDowned);
}

void ASILIDPlayerState::SetRoleTag(FGameplayTag NewRole)
{
	if (!HasAuthority() && GetNetMode() != NM_Standalone)
	{
		return;
	}
	RoleTag = NewRole;
}

void ASILIDPlayerState::SetReady(bool bNewReady)
{
	if (!HasAuthority() && GetNetMode() != NM_Standalone)
	{
		return;
	}
	if (bReady == bNewReady)
	{
		return;
	}
	bReady = bNewReady;
	OnReadyChanged.Broadcast(bReady);
}

void ASILIDPlayerState::OnRep_Downed()
{
	// clients: value already landed, notify listeners
	OnDownedChanged.Broadcast(bDowned);
}

void ASILIDPlayerState::OnRep_Ready()
{
	OnReadyChanged.Broadcast(bReady);
}
