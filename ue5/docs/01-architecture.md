# 01 — Architecture: Modules, Components, Data, Tags

Design principle: **engine features > assets > reusable components > custom code.** Nothing in this doc recreates an Unreal-provided system.

---

## 1. Module layout

```
Source/SILID/
    SILID.Build.cs        modules: Core, Engine, EnhancedInput, AIModule,
                          NavigationSystem, GameplayTags, UMG, Niagara, PhysicsCore
    Player/               ASILIDCharacter, ASILIDPlayerController
    AI/                   ASILIDResident, ASILIDResidentController
    Props/                Doors, Pickups, HideSpot, Barriers, LightSwitch
    Puzzles/              Radio, Safe (CodeLock consumers)
    Systems/              interfaces, types, inventory, health, flashlight,
                          noise emitter, code lock, save, difficulty,
                          randomizer, room director, escape routes,
                          game mode, audio director, tags
    UI/                   USILIDHUDWidget base (WBP subclass implements events)
```

The vertical slice already exists and compiles against this layout; the production phase adds the classes listed in §3 below **without reorganizing** existing ones.

## 2. The interaction spine (already implemented)

All interaction flows through one Blueprint Interface (`Systems/SILIDInterfaces.h`):

```cpp
ISILIDInteractable  : CanInteract / Interact / GetInteractionText /
                      GetExamineText / UseItemOn / OnFocusGained-Lost
ISILIDSaveable      : GetSaveId / OnSave / OnLoad
```

Every new interactive class (spec §24's BP_Door, BP_Drawer, BP_Generator, BP_CCTV…) **implements these two interfaces** — that is the whole contract. The player character's focus trace only knows the interface; it never casts to concrete types. This is what makes the framework reusable: a new prop is a class + implemented interface + data asset, never a change to player code.

## 3. Class inventory — existing vs. to-add

### 3.1 Exists in the slice (verified on disk)

| Class | Role | Spec § |
|---|---|---|
| `ASILIDCharacter` + Controller | FPS movement, stamina, focus trace, hold/drop/throw, examine, hiding | 2, 3 |
| `USILIDInventoryComponent` + `USILIDItemData` | Data-driven inventory, stacking, capability flags | 6, 9, 10, 11 |
| `USILIDHealthComponent` | Damage, death events | 10 |
| `USILIDFlashlightComponent` | Toggle, battery drain, flicker | 14 |
| `USILIDNoiseEmitterComponent` | World-wide noise bus (location/loudness/tag/priority) | 8, 19 |
| `ASILIDResident` + Controller | 13-state honest AI, perception-driven | 18 |
| `ASILIDDoor`, `ASILIDPickup`, `ASILIDHideSpot`, `ASILIDBarrier`, `ASILIDLightSwitch` | Core prop set | 5, 9, 17 |
| `ASILIDSafe`, `ASILIDRadio` | Multi-step puzzle chain | 17 |
| `ASILIDRoomDirector` | Data-driven room mutations | 25 |
| `ASILIDEscapeRoute` | Escape grammar (key tag / tool flags / components / prerequisite) | 29 |
| `USILIDRandomizerSubsystem` + `ASILIDSpawnPoint` | Seeded scatter, fairness, difficulty loot scaling | 26 |
| `USILIDSaveGame` + `USILIDSaveSubsystem` | Versioned saves, ISaveable registration, autosave | 20 |
| `USILIDDifficultySubsystem` | Easy/Normal/Hard multipliers | 21 |
| `ASILIDGameMode`, `USILIDGameInstance`, `USILIDAudioDirector`, `USILIDHUDWidget` | Lifecycle, registry, audio, UI | 20, 12, 24 |

### 3.2 To add for production (each is small because the spine exists)

| New class | Kind | Why small | Spec § |
|---|---|---|---|
| `BP_Drawer` / `ASILIDDrawer` | Actor | Door with a translation instead of rotation; reuse code lock/key tag fields | 9, 24 |
| `BP_Generator` | Actor + Repairable | NoiseEmitter (loud, tagged `Noise.Device`), fuel-consumption ticking (event-driven timer), state machine: Off→Fuel→Repair→Run | 15 |
| `BP_ElectricalSystem` | **Subsystem** (WorldSubsystem) | Central power graph; see §05 doc §2 | 15 |
| `BP_FuseBox`, `BP_Breaker` | Actors | Repairable + ElectricalSystem consumer nodes | 15 |
| `BP_CCTV` + `BP_CCTVMonitor` | Actor pair | SceneCapture2D → render target → monitor widget; PowerConsumer | 17 |
| `BP_MotionSensor`, `BP_Alarm`, `BP_ElectronicLock` | Actors | Perception listeners wired to ElectricalSystem + Alarm bus | 17 |
| `BP_HidingSpot` variants | Data variants | One class, `PDA_HideSpotType` data (wardrobe/underbed/cabinet) | 9 |
| `BP_WaterSystem` | Subsystem | Mirrors ElectricalSystem; §05 doc §6 | 16 |
| `BP_Weapon` / `BP_Tool` | Actor + `PDA_WeaponData` | Extends ItemData with damage/recoil/durability/anim set | 10, 11 |
| `BP_InventoryComponent` UI layer | Widget + component | Shared by players; already server-replicated design (§06 doc) | 20, 22 |
| `BP_ReviveComponent` | Component | Downed state + revive hold-interact | 22 |
| `BP_CarryObject` | Actor | Two-player carry: two grab sockets, both must hold | 22 |
| `PDA_StoryEntry` / `DA_Story` | Data assets | Story text keyed by tag; widgets read, never contain | 25 |
| `DA_Objectives`, `DA_Endings` | Data assets | Objective/endings tables; GameMode reads rows | 25 |
| `BP_SILIDCharacter` variants | Data-configured | Mesh/anim/persona via `PDA_CharacterDef` (§02 doc) | 2, 22 |

## 4. Data Asset schemas (the data contracts)

### `PDA_Item` (`USILIDItemData`, exists)
`Id, DisplayName, Description, Type (Key/Tool/Component/Battery/Consumable/Document), MaxStack, Icon, WorldMesh, PickupSound, GameplayTag, FSILIDItemFlags { BreaksPlanks, CutsChains, TurnsScrews, PriesOpen, ComponentTag }`

**Rule:** locks and routes ask for *capabilities and tags*, never item ids. The slice's `SILIDItemFlags.h` and `SILIDEscapeRoute` already enforce this.

### `PDA_WeaponData` (new, extends ItemData)
`Damage, AttackRate, Range, StaminaCost, RecoilParams, Durability, DurabilityLossPerHit, AnimSet (FirstPerson/ThirdPerson), EquipMontage, AttackMontages[], ReloadMontage, Sounds (Swing/Hit/Holster)`

### `PDA_CharacterDef` (new — the replaceable-character contract)
`SkeletalMesh, AnimInstanceClass, PersonaSoundSet, HeightAdjust, CameraOffset, FootstepSurfaceMap, FirstPersonArms (mesh + anim class), MetaHumanQualityTier`

Gameplay never references the mesh — components (inventory/health/flashlight) attach to the character regardless of what mesh is in `PDA_CharacterDef`.

### `DA_PowerGraph` (new)
Rows: `NodeTag, DeviceActorTag, ParentNodeTag, LoadWatts, StartupSurge, FlickerProfile`. `BP_ElectricalSystem` walks this table; devices register by tag, not by hard reference. Breaker trip = remove node subtree.

### `DA_RoomDef` (new — superset of the web game's rooms)
`RoomTag, DisplayName, FloorLevel, BoundsVolumeTag, DefaultPowerNode, AmbienceLayer, ReverbZone, CCTVCoverage, LootTableRef, MemoryProps[]`

### `DA_DifficultyProfile` (new — supersedes slice's hardcoded multipliers)
`AI_SensesScale, AI_SearchTime, AI_Speeds, ItemSpawnCountMultipliers, ResourceDrainMultipliers, HintLeakiness (0–1), SoloAdaptationOverride`

### `DA_Story` / `PDA_StoryEntry` (new)
`StoryTag, TriggerCondition (tag query), Text, Audio (optional VO), ActorTagsAffected` — notes, subtitles, objectives all read from here.

## 5. Gameplay Tag schema (registered in `SILIDTags.h`, extended by ini)

Existing: `Noise.*` (Footstep, Run, Door, Impact, Break, Drawer, Device, Voice), `Lock.*` (FrontDoor, BackDoor, Drawer, Safe), `Room.*` (Sala, Kusina, Aklat, Hallway, Kwarto, Bodega).

Production additions:

```
Power.Node.{Generator,Breaker,FuseBox,Room.Sala,…,Device.{Light,CCTV,Fan,TV,Lock}}
Water.Node.{Pump,Valve,Faucet.Bathroom,…}
Security.{CCTV,Sensor,Alarm,Lock}
Item.Family.{Key,Battery,Tool,Component,Document,Consumable}
Item.Capability.{BreaksPlanks,CutsChains,TurnsScrews,PriesOpen}
Story.Chapter.{…}        Story.Event.{…}      Objective.{Main,Side}.{…}
AI.State.{Patrol,Investigate,Search,Chase,Stunned}
Route.{MainDoor,BackDoor,Window,Hidden,…}
Coop.Role.{None,Runner,Fixer,Watcher,Decoy}
```

**Naming law:** systems match tags with queries (`HasAny`, `HasAll`, parents), never string equality. Adding "Room.Banyo" is an ini line + a data asset — never code.

## 6. Event-driven rules (spec §26)

- **No per-tick logic in props.** Doors, drawers, machines act on Interact/timers/delegates. The only per-tick code allowed: player stamina/focus trace (already throttled), AI BT service (engine-managed), and the ElectricalSystem's 1 Hz board tick.
- Noise bus is **multicast delegates**, not polling (exists).
- Save subsystem registers actors **on BeginPlay/EndPlay** (exists).
- Power state changes broadcast one delegate; lights/CCTV/locks subscribe. Zero cross-references between props and the power subsystem.

## 7. Save & persistence (extends the working slice)

`USILIDSaveGame` slots: player state, inventory, world-actor save ids (doors/barricades/pickups/route states), power graph state, difficulty, seed. New production fields: water graph, security states, story flags, co-op player records. Schema versioning stays with the existing `SaveVersion` field; migrations are additive.

## 8. Folder conventions (Content)

```
Content/SILID/
    Maps/           LM_House (World Partition), LM_Menu, LM_Test_Blockout
    Blueprints/     Characters/ Props/ Systems/ UI/
    Data/           Items/ Weapons/ Characters/ Rooms/ Power/ Story/ Difficulty/
    Meshes/         Modular/ Props/ Characters/ (per-source subfolders)
    Materials/      Master/ Instances/ (see 03 doc)
    Audio/          MetaSounds/ Ambiences/ Stingers/ Footsteps/ ...
    VFX/            Niagara/
    UI/             WBP_*
```

Third-party content lives **only** under `Content/ThirdParty/<Source>/…` (isolated so it can be replaced — 09 doc §2); `Content/SILID/` holds only project-native and integrated assets. The license ledger audits by path prefix.
