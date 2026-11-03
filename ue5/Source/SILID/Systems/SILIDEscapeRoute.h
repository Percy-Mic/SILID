// Escape route actor (spec: escape system, multiple routes).
// Each route is one actor in the level declaring what it needs. Nothing in
// code names "the hammer" or "the fuse" — routes request capabilities/tags:
//   - KeyTag:   a carried key matching this tag (main/back door padlocks)
//   - Tools:    capability flags the player must have (window route)
//   - Components: tags consumed on activation (fuse, valve wheel...)
//   - PrerequisiteRoute: a route that must already be Escaped? No — a route
//     that must first be *Unlocked* by another mechanism (hidden route).
// Designers add escape paths by placing one of these and filling the fields.

#pragma once

#include "GameFramework/Actor.h"
#include "GameplayTagContainer.h"
#include "SILIDTypes.h"
#include "SILIDInterfaces.h"
#include "SILIDEscapeRoute.generated.h"

class ASILIDCharacter;
class USILIDInventoryComponent;
class UStaticMesh;

UCLASS()
class SILID_API ASILIDEscapeRoute : public AActor, public ISILIDInteractable, public ISILIDSaveable
{
	GENERATED_BODY()

public:
	ASILIDEscapeRoute();

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Escape")
	EEscapeRoute Route = EEscapeRoute::MainDoor;

	/** Human name for the HUD prompt ("Main Door", "Boarded Window"...). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Escape")
	FText RouteName;

	/** Key the route demands, if any (padlock family). Empty = none. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Escape|Requirements")
	FGameplayTag KeyTag;

	/** Tool capabilities required: BreaksPlanks / CutsChains / TurnsScrews / PriesOpen. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Escape|Requirements")
	bool NeedsToolBreaksPlanks = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Escape|Requirements")
	bool NeedsToolCutsChains = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Escape|Requirements")
	bool NeedsToolTurnsScrews = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Escape|Requirements")
	bool NeedsToolPries = false;

	/** Component tags consumed on activation (fuse for the door motor...). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Escape|Requirements")
	TArray<FGameplayTag> RequiredComponents;

	/** Another route that must be fully prepared before this one activates
	 * (e.g. the hidden hatch needs the fusebox route restored first). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Escape|Requirements")
	TObjectPtr<ASILIDEscapeRoute> PrerequisiteRoute;

	/** P8: when set, the route's mechanism runs on this Power.Node (a garage
	 * motor, a powered hatch). Dead node = the route cannot fire — the
	 * power chain is a route requirement like any key (doc 15 §5). Empty =
	 * mechanical route, power-irrelevant. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Escape|Requirements")
	FGameplayTag PowerNode;

	/** Should the consumed components actually leave the inventory? */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Escape|Requirements")
	bool bConsumeComponents = true;

	/** Mesh swap / door swing when the route opens (optional). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Escape|Visuals")
	TObjectPtr<UStaticMeshComponent> RouteMesh;

	/** Fired when this route becomes passable and the player escapes. */
	DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnRouteEscaped, EEscapeRoute, Route);
	UPROPERTY(BlueprintAssignable, Category = "Escape")
	FOnRouteEscaped OnRouteEscaped;

	/** Is every requirement currently met (for the HUD hint)? */
	UFUNCTION(BlueprintPure, Category = "Escape")
	bool IsReady(const USILIDInventoryComponent* Inventory) const;

	/** What is missing right now — for a clean "needs X" prompt. */
	UFUNCTION(BlueprintPure, Category = "Escape")
	FText GetMissingText(const USILIDInventoryComponent* Inventory) const;

	/** Attempt the escape. Returns false and explains if unmet. */
	UFUNCTION(BlueprintCallable, Category = "Escape")
	bool TryEscape(ASILIDCharacter* Player);

	/** Has this route already been used? */
	UFUNCTION(BlueprintPure, Category = "Escape")
	bool IsEscaped() const { return bEscaped; }

	// ~ ISILIDInteractable (escape points are interactables)
	virtual bool CanInteract(const ASILIDCharacter* Player) const override;
	virtual bool Interact(ASILIDCharacter* Player) override;
	virtual FText GetInteractionText(const ASILIDCharacter* Player) const override;
	virtual FText GetExamineText(const ASILIDCharacter* Player) const override;

	// ~ ISILIDSaveable
	virtual FString GetSaveId() const override;
	virtual void OnSave(class USILIDSaveGame* SaveGame) override;
	virtual void OnLoad(const class USILIDSaveGame* SaveGame) override;

private:
	UPROPERTY()
	bool bEscaped = false;
};
