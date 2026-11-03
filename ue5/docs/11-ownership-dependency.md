# 11 — Ownership & Dependency Rules (canonical)

The law, one line: **one owner writes state; every other system requests, observes, or reacts.** If a feature cannot answer *"who owns this state?"* and *"who is allowed to change it?"*, it is not ready to be implemented.

Doc 09 wins on architecture conflicts; this doc wins on **state ownership and dependency direction**; doc 12 wins on **which Unreal type implements what**. All are enforced at feature review (§8 checklist).

---

## 1. The ownership table (authoritative state → owner)

Every row names the **concrete owner in this codebase** — not an idealization. Systems not listed yet (water, security) inherit ownership from their 05-doc subsystem designs and appear here when built. **P8 landed:** the electricity row above is now verified code — devices own only their `bDeviceEnabled` wish; the subsystem owns everything else (graph, node state, machine state, fuel, timers). The validator consumes power facts read-only via `GetGeneratorActor` (P16 extension, `Machine.Power` node).

| State | Single owner | Written via | Observed via |
|---|---|---|---|
| Player health, death, downed | `USILIDHealthComponent` | `ApplyDamage/Heal` (request path) | `OnHealthChanged`, `OnDied` |
| Player stamina, exhaustion | `USILIDStaminaComponent` 🆕 (extracted from character — §4) | `TryConsume()` requests | `OnStaminaChanged` |
| Carried items, quantities, stacking | `USILIDInventoryComponent` | `AddItem/RemoveItem/ConsumeComponent/DropItem` | `OnInventoryChanged`, pure queries |
| Equipped item/slot state | `USILIDEquipmentComponent` 🆕 | Equip/Unequip API | delegates |
| Interaction validity & outcome | The target actor (`ISILIDInteractable` implementor) | — | `Interact()` return, focus delegates |
| Door open/locked/broken state | `ASILIDDoor` (the actor) | its own Interact path | `ISILIDSaveable`, delegates |
| What a lock *requires* | `FSILIDLockRequirement` data on the lock (§5) | authored data only | `CanUnlock()` evaluation |
| Generator fuel/repair/run state | Generator actor | its own state machine | `OnPowerStateChanged` |
| Power distribution / circuits | `UElectricalSystemSubsystem` ✅ (P8) — **the single authoritative power owner** | subsystem API only (`StartGenerator/AddFuel/SetFuseBlown/ResetBreaker/RegisterNode`) | `OnNodePowerChanged`, `OnGeneratorStateChanged`, `OnBreakerTripped` + per-component `OnPowerChanged` push |
| Water network | `UWaterSystemSubsystem` 🆕 | subsystem API only | per-node state events |
| Security network / alarm state | `USecuritySubsystem` 🆕 | subsystem API only | camera/alarm events |
| AI decisions, patrol, investigation | `ASILIDResidentController` (+BB after BT migration) | internal only | `OnStateChanged`, `GetSuspicion()` |
| Perception stimuli | AI Perception + the noise bus | `EmitNoise` (semantic events) | subscription |
| Puzzle current/solved state | The puzzle actor | its own input path | `OnPuzzleSolved` event |
| Objectives & progression | `USILIDObjectiveSubsystem` ✅ (P13, PENDING-COMPILE) | `ActivateObjective/RecordProgress/RecordStoryTag/FailObjective` (subsystem API only) | `OnObjectiveActivated/Completed/Failed` + `OnStoryTagRecorded` + `GetCurrentObjectiveText` (HUD push) |
| Run seed | Server → `ASILIDGameMode.GetRunSeed` (exists) | `SetRunSeed` (save restore only) | read-only elsewhere |
| Generated item placement | `USILIDRandomizerSubsystem` (exists) — **initial state only** (§6) | `RandomizeAll(seed)` | spawn-point activation |
| Run validation | `USILIDSolvabilityValidator` 🆕 — **read-only** (§6) | VALID/INVALID verdict | `SILID.Debug.ValidateRun` |
| Story flags & events | `DA_Story` layer 🆕 — observes, never writes gameplay (§7); the P13 story-tag **ledger** (its runtime fact store) landed inside the ObjectiveSubsystem | story flag writes; `RecordStoryTag` records facts once | story events + the ledger (`HasStoryTag`) |
| Audio presentation | `USILIDAudioDirector` (exists) | maps semantic events → assets | — |
| Serialization | `USILIDSaveSubsystem` (exists) | `ISILIDSaveable` callbacks | — |
| Multiplayer authority | The server (06 doc §2 authority map) | server RPC handlers | replicated state |

**Anti-rule:** no secondary owners. A system holding a *copy* of another's state (HUD caching health, UI storing item arrays) is a display, and must re-read on events, never write.

## 2. Dependency layers (spec §2–3) → module reality

```
L0  Engine + plugins (EnhancedInput, AIModule, Niagara, MetaHuman, Online Subsystem)
L1  SILID foundation:   Types.h · Tags.h · ItemFlags.h · Interfaces.h · Logging/
L2  Data schemas:       ItemData · (future) RoomDef/PowerGraph/Story data headers
L3  Components:         Inventory · Health · Stamina 🆕 · Equipment 🆕 · NoiseEmitter ·
                        Repairable/Lockable/Container/ElectricPowered/… 🆕 (09 §3)
L4  Gameplay systems:   Randomizer · Validator 🆕 · Electrical/Water/Security 🆕 ·
                        Objective 🆕 · Save · Difficulty · AudioDirector · RoomDirector
L5  Actors:             Character · Resident · Door/Pickup/HideSpot/Barrier/… · GameMode
L6  Presentation:       HUDWidget · WBP · Niagara · MetaSounds assets
```

**Rules:** dependencies point downward only (L4 may use L1–L3; never L5–L6). Upward communication is **events/interfaces only** (a door at L5 emits `OnNoiseEmitted`; the AI at L4 subscribes — the door never knows AI exists). Today the game is one UBT module, so the layers are **folder law** enforced by review; the trigger to split into real modules (`SILIDCore`, `SILIDGameplay`, …) is the first time a Build.cs circular need appears — until then folders + `#include` discipline suffice for a solo dev. Third-party plugins are wrapped at L4 boundaries where practical (e.g. Online Subsystem touched only by the session subsystem).

## 3. Verified compliance (what the slice already obeys — evidence)

- **Damage is a request (spec §8):** `USILIDHealthComponent::ApplyDamage(Amount, Instigator)` — weapons/traps/environment all request; the component decides the result. No external writes to `Health`.
- **Inventory is API-only (spec §6):** mutation exclusively through `AddItem/RemoveItem/ConsumeComponent/DropItem`; everything else is pure queries. Barriers/locks ask **capabilities, not item ids** (`HasToolThatBreaksPlanks()`, `HasKeyForTag()`) — spec §37's tag rule, already real.
- **Doors don't know inventory internals (spec §11):** door Interact → evaluates its lock → queries possession through the inventory API → consumes through it. The inventory never unlocks a door by itself.
- **No player type-switches (spec §10):** one focus trace + `ISILIDInteractable`; the player has zero `if Door/Generator/…` branches.
- **Sound events, not enemy searches (spec §17):** emitters call `EmitNoise` on a world bus; `ASILIDResidentController::HandleNoise` subscribes. No actor ever searches for enemies.
- **Explicit serialization (spec §27):** `ISILIDSaveable{GetSaveId,OnSave,OnLoad}`; inventory has `SaveTo/LoadFrom`; the save payload is generic maps — the subsystem never reaches into private fields *for registered actors*.
- **No mutable state in data assets (spec §4–5):** `USILIDItemData` is configuration only; runtime quantity lives in `FInventoryEntry` (instance separation completes in 09 §5).

## 4. Deviations found by this audit (fix list)

| # | Deviation | Rule broken | Fix |
|---|---|---|---|
| D1 | `NoiseEmitter::EmitNoise(FVector LoudnessOrLocation, …)` — loudness smuggled through an FVector + `PendingLoudness` hack | API clarity (§1) | Split into `EmitNoise(float Loudness, FGameplayTag Tag)` + `EmitNoiseAt(float, FGameplayTag, FVector)`; deprecate the BP shim next content pass |
| D2 | Stamina lives inside `ASILIDCharacter` (tick + fields), not a component | Owner granularity (§9 of spec) | Extract `USILIDStaminaComponent{TryConsume, OnStaminaChanged}`; character's movement requests consumption |
| D3 | `USILIDHealthComponent` save path runs through `friend ASILIDCharacter` instead of explicit serialization | §27 | Give health `SaveTo/LoadFrom` like inventory; remove the friend |
| D4 | `bInvulnerable` is public `BlueprintReadWrite` — any system could write it | Read/Write law (§35 of spec) | Make it private with `SetInvulnerable()` + debug-only caller |
| D5 | `ASILIDEscapeRoute::PrerequisiteRoute` is a hard actor pointer | §38 no-assumed-references (see below) | Acceptable **only** within one authored cluster (both routes placed by hand in the same level); the validator must treat unresolved pointers as a config error, and route discovery elsewhere stays tag-based |

## 5. The requirement abstraction (locks) — generalize what the slice proved

The slice's locks are hardcoded *kinds* (key tag OR tool flags OR component). Production generalizes to one struct, per spec §12:

```cpp
USTRUCT() FSILIDLockRequirement {
    FGameplayTag         ItemTag;        // Requirement.Keycard.Security / key family
    FGameplayTagContainer ToolCapabilities; // Item.Capability.* (OR)
    FName                PowerNode;      // Requirement.Power (subsystem query)
    int32                CodeLength;     // CodeRequirement (code-lock component)
    FGameplayTag         PuzzleTag;      // PuzzleRequirement (puzzle-solved query)
};
```

`CanUnlock(const FLockContext&)` evaluates all fields with OR/AND semantics authored per lock; doors, drawers, escape routes, and barriers consume the same struct. This replaces per-class requirement bools **additively** (existing fields map onto it; 09 §8's `DA_DependencyGraph` rows *are* these requirements viewed per zone).

## 6. Randomization / validator / multiplayer ownership (spec §18–20, §28–29, §39)

- **Randomizer writes once.** `RandomizeAll(seed)` sets *initial* world state, then hands ownership to gameplay systems. It never re-writes runtime state mid-run; difficulty re-rolls happen only through a full re-randomize (new run).
- **Validator is read-only.** It reads generated configuration + room data and returns VALID/INVALID (09 §8). It never repairs, never mutates — unless a future `bRepairPass` is *explicitly* designed, logged, and tested. Invalid → the randomizer regenerates.
- **Seed authority is the server's.** Clients never regenerate placement, keys, codes, or routes; they receive replicated state (06 doc §2). The seed replicated to clients exists for *display/debug determinism checks*, not local generation.
- **Ownership travels with the item:** Randomization decides where the screwdriver *starts*; on pickup, inventory owns it; on drop, a pickup actor owns it again — always through the proper operations (AddItem/DropItem), never by direct state edits.

## 7. Presentation & story layers (spec §23–26, §40–41)

- **Audio:** actors emit *semantic* events (`Noise.Door`, `GeneratorStarted`); `USILIDAudioDirector` chooses assets/attenuation/variation. Gameplay never references a sound asset to make a decision; AI consumes the same semantic events (one fabric, three consumers — 09 §9).
- **VFX:** responds to state (`GeneratorState == Failed` → sparks). Sparks playing is never evidence of failure.
- **UI:** read/command layer — displays state, sends requests through APIs (interact, use, drop). It never owns arrays/health/objectives; the HUD's existing event-driven hooks already follow this.
- **Story:** observes gameplay events (power restored → story event available) and writes *only story flags*. Core systems run with an empty `DA_Story` — the "works without story" rule (spec §40) is a build target: the slice already boots with zero story assets.
- **Assets define nothing:** meshes carry no gameplay meaning; behavior lives in data assets + systems (spec §41). The ledger (07 doc) governs the *presentation* assets only.

## 8. Feature review checklist (binding at every PR)

One owner? One data source? Writes only through the owner? No circular dependency? Interface before concrete class? Event before direct reference? Runtime state out of data assets? Server authority intact? Randomizer deterministic and write-once? Works with randomized placements? Saveable via `ISILIDSaveable`? Independently testable? Runs without story? No new Tick? No new manager? — **any unclear answer = redesign before implementation** (spec §43).

No god objects (spec §34): if a class needs two sentences to describe, split it — subsystem, component, actor, interface, or data asset. Pure logic (validator closure, power graph resolution, seed streams, requirement evaluation) lives in subsystems/structs testable without actors (spec §42) — mirrored by the web build's regression harness for rule prototyping (08 doc §2).

## 9. The dependency matrix (contract view)

The spec's §32 matrix is adopted as-is, with these concrete bindings: "Inventory" = `USILIDInventoryComponent`, "Electricity" = `UElectricalSystemSubsystem` (when built), "AI Controller" = `ASILIDResidentController`, "Randomization" = `USILIDRandomizerSubsystem` (write-once), "Validator" = `USILIDSolvabilityValidator` (read-only), "Save" = `USILIDSaveSubsystem` + `ISILIDSaveable`, "Server" = the authority map in 06 doc §2. Print this doc's §1 table + the spec's matrix together at review time; when they disagree, §1 (concrete owners) wins.
