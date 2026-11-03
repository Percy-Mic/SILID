# 12 — Unreal Implementation Boundaries (canonical)

Every system gets an explicit Unreal type — chosen by rule, not convenience. **Precedence:** this doc wins on *which Unreal type implements what*; doc 11 wins on state ownership; doc 09 on overall architecture; doc 20 on *which UE5 feature is adopted* (re-implementing a ratified stack entry is a violation); 00–10 yield on conflict.

Deviation numbers continue doc 11's ledger (D1–D5 there; D6+ here).

---

## 1. The type map, bound to this codebase

| Unreal boundary | SILID implementation | Status |
|---|---|---|
| `UGameInstanceSubsystem` | `USILIDRunSubsystem` 🆕 (seed/session/run config authority — §3) · `USILIDSaveSubsystem` ✅ (move from World→GI: see §3) · `USILIDProfileSubsystem` 🆕 | extend |
| `UWorldSubsystem` | `USILIDRandomizerSubsystem` ✅ · `UElectricalSystemSubsystem` ✅ (P8) · `UWaterSystemSubsystem` 🆕 · `USILIDSecuritySubsystem` 🆕 · `USILIDObjectiveSubsystem` ✅ (P13) · `USILIDSolvabilityValidator` ✅ · `USILIDNoiseSubsystem` 🆕 (§3) | exists + planned |
| `ULocalPlayerSubsystem` | `USILIDLocalSettingsSubsystem` 🆕 (sensitivity/accessibility/UI prefs — out of `ASILIDPlayerController` defaults) | new |
| `AGameModeBase` | `ASILIDGameMode` ✅ (server-only rules: death/respawn/escape/seed wiring) | compliant |
| `AGameStateBase` | `ASILIDGameState` 🆕 (replicated run phase, escape state, objective progress summary) | new |
| `APlayerState` | `ASILIDPlayerState` 🆕 (downed state, role tag, ready) — **never** the inventory | new |
| `ACharacter` | `ASILIDCharacter` ✅ · `ASILIDResident` ✅ (physical bodies only) | compliant |
| `AAIController` | `ASILIDResidentController` ✅ (→ BT/BB per 09 §6) | compliant |
| `AActor` (physical world) | Door/Pickup/HideSpot/Barrier/LightSwitch/Safe/Radio ✅ · Generator/FuseBox/CCTV/Container/Drawer/Trap/Pump 🔧 per 09 §3.2 | compliant pattern |
| `UActorComponent` | Inventory/Health/Flashlight/NoiseEmitter ✅ · Repair ✅ (P7) · ElectricPowered ✅ (P8) · Stamina/Equipment/Durability/Lockable/Container/… per 09 §3 | exists + planned |
| `UInterface` | `ISILIDInteractable`, `ISILIDSaveable` ✅ (+ additively: Damageable, Usable, Repairable, PowerConsumer — 09 §4) | compliant |
| `UPrimaryDataAsset` | `USILIDItemData` ✅ · `USILIDObjectiveData` ✅ (P13 — the DA_Objective/DA_Story rows) · `PDA_CharacterDef`, `PDA_WeaponData`, `DA_RoomDef`, `DA_PowerGraph`, `DA_Story` 🆕 — **immutable at runtime** (11 §3) | compliant |
| `UUserWidget` | `USILIDHUDWidget` C++ base ✅ + WBP subclasses; CommonUI (`UCommonActivatableWidget`) for menus/inventory when UI work starts | compliant pattern |
| Pure C++ logic | Randomizer stream math, validator closure, power-graph resolution, requirement evaluation — subsystems/structs testable without actors | mandated |

**Actor/component split rule (spec §5), confirmed:** Actor = exists in world, has transform, spawns/replicates. Component = reusable capability without its own transform. `Door = Actor + LockComponent` ✅ already true.

## 2. Framework class boundaries (spec §9–14) — verdicts on the slice

- **GameMode** ✅ server rules only (death/respawn/escape/seed/difficulty). HUD *class* reference lives here — acceptable as spawn config; the widget instance coordination is the PlayerController's (✅ per spec §13).
- **PlayerController** ✅ input→command→owner flow (`HandleInteract` → `Character::Input_Interact` → focus trace → interface). **D6:** `PromptPollTimer` polls prompt text; replace with `OnFocusChanged`-driven push (the delegate exists) + hold-progress events. No inventory logic in the controller ✅.
- **Input** ✅ Enhanced Input built in code, actions are commands (`IA_UseItem` → `UseOnTarget` API) — never touches arrays directly ✅. Sensitivity moves to the LocalPlayerSubsystem when settings UI lands.
- **Character** — owns body + components; **D2 from doc 11** (stamina extraction) and HidingComponent extraction (09 §3) are the remaining moves.

## 3. Subsystem boundary corrections (spec §6–7, §26, §32) — D6 ledger continues

| # | Correction | Rule | Fix |
|---|---|---|---|
| D6 | `USILIDSaveSubsystem` is a **World** subsystem; saves/session data must survive level transitions | §7 | Move to `UGameInstanceSubsystem`; `ISILIDSaveable` registration keys become level-qualified (`Map:SaveId`) so multi-map is safe. Run restores rebuild world state after load |
| D7 | Run seed owned by `ASILIDGameMode` (world-scoped) | §26 seed authority | `USILIDRunSubsystem` (GameInstance) becomes seed/run-config authority; `ASILIDGameMode::Get/SetRunSeed` remain as forwarding shims so existing saves/calls don't break |
| D8 | Noise bus is a **static** delegate on the emitter component | §6 world-level coordination | `USILIDNoiseSubsystem` (World) owns the bus, history, and query API (`GetRecentNoise(Radius, From)` for AI/auditing); emitter components keep `EmitNoise` as the command entry (ownership unchanged — 11 §1) |
| D9 | Single `LogSILID` category | §59 | Category split (§5 below) |
| D10 | Prompt polling timer | §53 tick rule | Event-driven prompt push (same fix as §2 D6 note — counted once here) |

Everything else in the subsystem spec (electricity/water/security/objective/validation as World subsystems; profile/session as GameInstance) matches docs 05/06/09 exactly — no conflict.

## 4. Registration contract (spec §25/§55) — the house pattern

The slice already registers spawn points (Randomizer) and saveables (SaveSubsystem) via BeginPlay/EndPlay. **This is the law for every world subsystem:** register on BeginPlay, unregister on EndPlay, never `GetAllActorsOfClass` at runtime. Consumers get a `Register/Unregister` pair + a dirty-flagged query API. Applies to: power consumers, water fixtures, security devices, noise sources (via emitter), objectives listeners, hiding spots.

## 5. Logging migration (spec §59) — additive

Keep `SILID_LOG` macros; make the category the first argument:

```cpp
SILID_LOG(LogSILIDRandomization, "Seed=%d Placed=%s Room=%s Point=%s", …);
```

Categories to add (one header, `Logging/SILIDLog.h`): `LogSILIDCore, LogSILIDInventory, LogSILIDInteraction, LogSILIDAI, LogSILIDElectricity, LogSILIDRandomization, LogSILIDSave, LogSILIDNetwork, LogSILIDValidation`. `LogSILID` remains the fallback. Message standard: **System · Actor · Id · Operation · Result** (spec's example format adopted verbatim). Old call sites migrate opportunistically, never in bulk.

## 6. Structured results (spec §58)

```cpp
UENUM() ESILIDFailureCode { None, InventoryFull, MissingRequiredItem, NoPower,
    DoorLocked, PuzzleIncomplete, InvalidSpawn, InvalidDependency, SaveVersionMismatch, … };
USTRUCT() FSILIDOperationResult { bool bSuccess; ESILIDFailureCode Code; FText Message; FName RelevantId; };
```

New APIs return `FSILIDOperationResult` (or a bool + out-code where cheaper); interactions never fail silently — the code drives both the HUD's "needs X" prompts (escape routes already do this via `GetMissingText`) and logs. Existing bool-returning APIs migrate when touched, not before.

## 7. Item / weapon / damage / container boundaries (spec §16–20, §45–46) — confirmed with bindings

- Definition/instance/pickup/inventory separation: exactly 09 §5 (`FSILIDItemInstance`). ✅ design locked.
- `ASILIDWeaponBase` + `USILIDWeaponDefinition` + `FSILIDWeaponInstance`: 09 §3.2 + 01 §4. Inventory owns possession, Equipment owns equipped state (11 §1 rows).
- Damage: `FSILIDDamageInfo` + `ISILIDDamageable`/receiver component feeding `USILIDHealthComponent::ApplyDamage` — the existing request path generalizes unchanged.
- Spawn points: `ASILIDSpawnPoint` ✅ (family tags, guaranteed flag) + gains `AllowedCategories/Rarity/Priority/ContainerRef/RoomId` fields; **the point never decides the item** (randomizer does — 11 §6).
- Containers: `USILIDContainerComponent` (09 §3) owns runtime contents; randomization writes *initial* contents once; search = interact + container API.

## 8. Level & content boundaries (spec §43–44, §48–50) — folder migration plan

Target C++ tree (spec §48 adapted; migration is a mechanical move done **in the same pass as the component kit build**, one PR, no logic changes):

```
Source/SILID/
    Core/        GameInstance, GameMode, GameState*, PlayerState*      (* new)
    Characters/  Player/  Enemies/
    Components/  Interaction/ Inventory/ Health/ Stamina/ Equipment/
                 Repair/ Power/ Locks/ Containers/ Hiding/ Noise/
    Items/  Weapons/
    World/  Doors/ Containers/ Machines/ Security/ Environment/
    AI/
    Systems/ Electricity/ Water/ Security/ Randomization/ Objectives/ Save/ Story/
    Multiplayer/   UI/   Development/ (debug)   Logging/
```

Existing folders map: `Props/` → `World/*`, `Puzzles/` → `World/Machines` + `Systems` puzzle components, `Systems/` flattened per above, `Logging/` stays. Content folders: spec §49's `Content/SILID/…` structure + the `Content/ThirdParty/<Source>/` isolation (09 §2). Inheritance rule (§50): shallow — base actor + components, no `ASILIDEverythingActor`.

## 9. Feature specification format (spec §60–61) — mandatory

No feature implementation starts until its classification block is filled (Actor / Component / Interface / Data Asset / Struct / WorldSubsystem / GISubsystem / LocalPlayerSubsystem / GameMode / GameState / PlayerState / PlayerController / Character / AIController / BT / Blackboard / Widget / AnimBP / Niagara / pure C++) **plus**: Owner · Reads · Writes · Calls · CalledBy · Replicated · Saved · Server/Client. Format = spec §61 verbatim (the Generator Repair example is house-style-confirmed). Every class file carries the four-question header (spec §62):

```cpp
/**
 * SILID class contract
 * OWNS:        <state this class is the single author of>
 * MAY WRITE:   <only its own owned state>
 * DEPENDS ON:  <allowed systems/layers — see docs 11 §2, 12 §1>
 * EMITS:       <delegates/events others may observe>
 */
```

Worked example (second, house-style): **Container Search** — Owner: `ASILIDContainer` (+ContainerComponent). Data: `PDA_LootTable`. Runtime: container contents. Command: interaction via `ISILIDInteractable`. Events: `OnContainerOpened`, `OnContentsChanged`, noise `Noise.Drawer`. Depends on: Inventory API (read), Randomizer (initial contents only). Forbidden: UI/objectives direct refs, post-generation randomizer writes. Server-authoritative; saves via ISILIDSaveable; UI = WBP_Inventory prompt; audio = `MS_Drawer`; validation = "contents reachable per validator".

## 10. Event dispatcher discipline (spec §52) + tick rule (§53)

Component/actor-local dispatchers (OnHealthChanged, OnInventoryChanged, OnPowerStateChanged…) for owned-state notifications; subsystem buses for world-wide facts (noise, power fanout, alarms). No global dispatcher soup: every delegate has exactly one owning class and is documented in that class's EMITS header. Tick rule: the four existing allowed ticks (09 §6 note) stand; new ticks need the §53 alternatives checklist answered in the feature spec.

## 11. Expandability targets (spec §62) — the acceptance bar

Each of these must be a *data or isolated-class change*, verified at review: new weapon → `PDA_WeaponData` + anim set, no inventory edits. New tool → item def + capability tag, no interaction edits. New enemy → `PDA_CharacterDef` + BT assets, no player edits. New powered machine → ElectricPowered component + registration, no generator edits. New puzzle → definition + component, no objective edits. New story → data assets only. New co-op feature → same authority path, no SP fork (06 doc §1). New layout → room data, no randomizer edits. New randomization rule → generator data row, no per-item edits. New asset → presentation only (11 §7).

The four questions (§62) are answerable by opening **any** SILID class and reading its header. If they're not, the boundary is wrong — fix the boundary before the feature.
