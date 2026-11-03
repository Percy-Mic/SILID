#include "Systems/SILIDHealthComponent.h"
#include "Logging/SILIDLog.h"

USILIDHealthComponent::USILIDHealthComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void USILIDHealthComponent::BeginPlay()
{
	Super::BeginPlay();
	Health = MaxHealth;
}

void USILIDHealthComponent::ApplyDamage(float Amount, AActor* DamageInstigator)
{
	if (bInvulnerable || IsDead() || Amount <= 0.f)
	{
		return;
	}

	const float OldHealth = Health;
	Health = FMath::Clamp(Health - Amount, 0.f, MaxHealth);
	OnHealthChanged.Broadcast(Health, Health - OldHealth, DamageInstigator);

	if (Health <= 0.f)
	{
		SILID_LOG_CAT(LogSILID, TEXT("%s died (instigator: %s)"), *GetOwner()->GetName(), DamageInstigator ? *DamageInstigator->GetName() : TEXT("world"));
		OnDied.Broadcast();
	}
}

void USILIDHealthComponent::Heal(float Amount)
{
	if (IsDead() || Amount <= 0.f)
	{
		return;
	}
	const float OldHealth = Health;
	Health = FMath::Clamp(Health + Amount, 0.f, MaxHealth);
	OnHealthChanged.Broadcast(Health, Health - OldHealth, nullptr);
}
