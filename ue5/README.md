# SILID — Unreal Engine 5 Vertical Slice

**Genre:** First-person psychological horror / survival / puzzle adventure
**Platform:** PC (console/mobile later)
**Status:** Phase 1–2 code-complete vertical slice — all C++ systems are written; editor-side content (level, widget, assets) is a documented manual step.

> SILID is an original IP. No Granny characters, story, map, sounds, UI, models, animations, or other copyrighted assets are used or referenced.

---

## Production documentation (`ue5/docs/`)

The full 29-section production spec is expanded into these working documents:

| Doc | Contents |
|---|---|
| [00-overview.md](docs/00-overview.md) | Vision, pillars, solo-dev decision rules, anti-asset-flip checklist, doc index |
| [01-architecture.md](docs/01-architecture.md) | Module/class map (slice + production additions), Data Asset schemas, Gameplay Tag schema, event-driven rules |
| [02-characters-animations.md](docs/02-characters-animations.md) | MetaHuman-first pipeline (UE-EULA licensed since 5.6), `PDA_CharacterDef` replaceable-mesh contract, AnimBP/Control Rig, animation sourcing, **Blender's role in the animation pipeline (§4a)** |
| [03-environment-materials.md](docs/03-environment-materials.md) | House program (30 areas), modular kit strategy, Filipino identity prop pass, master materials, World Partition, perf budgets, **Blender + licensed-library hybrid pass (§2a)** |
| [04-audio-vfx-lighting.md](docs/04-audio-vfx-lighting.md) | MetaSounds graphs, licensed audio sources (Sonniss/Poly Haven/Fab), Niagara weather, Lumen/VSM gameplay lighting, day/night + seasons + wildlife rules |
| [05-systems.md](docs/05-systems.md) | Electricity chain subsystem (tag registry), water (+ **failure states: leaks/blockage/pressure/flooding**), security/CCTV, AI honesty law + extensions (memory/learning §5.2), physics-noise, solo adaptation, **the visibility & awareness tuning law (§5.5: graded visibility, suspicion bands, masking, hiding rules)**, injury/status design (§9), extended-system notes (§10) |
| [06-multiplayer.md](docs/06-multiplayer.md) | Server-authoritative 1–4 topology, authority map, replication checklist, co-op primitives, bandwidth/testing discipline |
| [07-asset-licenses.md](docs/07-asset-licenses.md) | Verified 2025 licensing facts (Megascans paid since 2025, MetaHuman under UE EULA, Poly Haven CC0), ledger CSV + audit process, **Blender-authored asset provenance rows (§1a)** |
| [08-roadmap.md](docs/08-roadmap.md) | Solo-dev milestone ladder M0–M5 with gates, cut list, risk register, and the web-game → UE5 port map |
| [09-implementation-architecture.md](docs/09-implementation-architecture.md) | **Canonical** architecture: status map (exists/extend/build), component composition, interface extension, item instances, dependency graph + solvability validator, save split, debug commands, **the anti-procedural law (§12: authored house, rearranged possibilities)** |
| [10-mood-reference.md](docs/10-mood-reference.md) | "AFRAID" target atmosphere: warm-source lighting recipe, fear-state pipeline, parity test, **the darkness-floor law (§5 — playable darkness, power off ≠ black)** |
| [11-ownership-dependency.md](docs/11-ownership-dependency.md) | **Canonical ownership law**: one owner per state (verified table), layer map, compliance audit + fix list, lock-requirement abstraction, review checklist |
| [12-ue-implementation-boundaries.md](docs/12-ue-implementation-boundaries.md) | **Canonical Unreal type map**: which UE class implements what, subsystem boundary corrections (D6–D10), registration contract, logging/results, feature-spec format, folder migration plan |
| [13-build-order.md](docs/13-build-order.md) | **Canonical build order**: 22-phase ladder with slice status, vertical-slice-first law, definition of done, AI development rule, feature priority |
| [14-exit-gates.md](docs/14-exit-gates.md) | **Canonical proof contract**: deliverables + exit gates per phase, five major gates A–E, gate-report format, current PENDING-COMPILE status reports |
| [15-risks-assumptions.md](docs/15-risks-assumptions.md) | **Canonical risk register — single source of truth**: R-001–R-030 with owners, priorities, targets, blocking flags, **executable prevention/mitigation actions, triggers, minimum evidence rules** + assumptions register with validation evidence |
| [16-risk-governance.md](docs/16-risk-governance.md) | (retired — consolidated into 15 per the single-source-of-truth rule) |
| [16-risk-changelog.md](docs/16-risk-changelog.md) | The register's append-only change log + milestone dashboards (baseline: 2026-09-27) |
| [17-expanded-world.md](docs/17-expanded-world.md) | **DESIGN-ONLY (gated on M1.5 + M1.7 prototype)**: property zones, house→50-area program (attic, basement complex, tunnel-access gate table), garage complex, vehicles as composed objects (car/motorcycle/train), underground/railway, transportation escape + noise integration |
| [18-vehicle-data-schemas.md](docs/18-vehicle-data-schemas.md) | **DESIGN-ONLY**: `PDA_VehicleProfile` schema, the four run configurations as data rows, vehicle noise table, availability pools, `DA_ZoneDef`, escape-route mapping (incl. per-run escape flavors), M1.7 prototype data pack |
| [19-art-direction.md](docs/19-art-direction.md) | **Canonical art bible**: no-primitives law, 10-pass location pipeline, real-world measurement standard, density tiers, **PCG procedural dressing law (§4a)**, structural-systems realism (§6), storytelling recipes, variation/imperfection, import QC, location quality gate, **Blender pipeline standard (§13)** |
| [20-tech-stack.md](docs/20-tech-stack.md) | **Canonical UE5 stack ratification**: the eleven confirmed engine systems bound to SILID classes, Build.cs module plan, selection rules, fallbacks, and per-feature proof gates |
| [21-first-editor-session.md](docs/21-first-editor-session.md) | The ordered first-editor-session checklist: compile → P0 scratch gate → blockout map → actor/data/HUD setup → the 10-row P9 honesty matrix → fill-in gate reports in doc 14's format |
| [22-smallest-playable-scope.md](docs/22-smallest-playable-scope.md) | **The smallest real game**: 5-area map, one enemy, flashlight, one generator/repair/electricity chain, one escape; definition-of-done checklist (§9), replay test, and the grounded repo audit against that checklist |
| [23-failure-solvability-rules.md](docs/23-failure-solvability-rules.md) | **The failure law + validation contract**: the 12 solvability rules (reachable items, valid dependency chains, no permanently-lost resources, enemy never locks progression, validate-before-play) and the grounded audit of the in-repo validator against them |

## 1. What is implemented (source-complete)

Every gameplay system from the design spec exists as compiled C++:

| System | Files | Spec |
|---|---|---|
| First-person player: walk/run/sprint/crouch/stamina, focus trace, hold/drop/throw, examine, hiding | `Player/SILIDCharacter.*` | §4 |
| Input: Enhanced Input mapping built **in code** (no editor assets required) | `Player/SILIDPlayerController.*` | §4 |
| Reusable interaction framework (`IInteractable`: Interact/CanInteract/GetText/Examine/UseItem/Focus) | `Systems/SILIDInterfaces.h` | §5 |
| Data-driven inventory + item definitions (type, stack, tag, mesh/icon/sound refs) | `Systems/SILIDInventoryComponent.*`, `SILIDItemData.*` | §6 |
| The Resident: 13-state AI controller, sight + hearing perception, noise investigation, door opening, hide-spot searching | `AI/SILIDResident.*`, `AI/SILIDResidentController.*` | §7, §9 |
| Sound event system (location/loudness/type/priority/radius) broadcast world-wide | `Systems/SILIDNoiseEmitterComponent.*` | §8 |
| Hiding spots with search vulnerability (the AI can find you based on difficulty) | `Props/SILIDHideSpot.*` | §10 |
| Flashlight: toggle, battery drain/pickups, flicker at low charge | `Systems/SILIDFlashlightComponent.*` | §11 |
| Code-lock component (keypad puzzles, e.g. the safe) | `Systems/SILIDCodeLockComponent.*` | §17 |
| Radio puzzle actor (broadcasts clue numbers) | `Puzzles/SILIDRadio.*` | §17 |
| Safe/locker with code lock + contained pickups | `Puzzles/SILIDSafe.*` | §17 |
| Dynamic room director (data-driven mutations: move/swap/vanish/spawn/lock) | `Systems/SILIDRoomDirector.*` | §16 |
| Save/load: versioned payload, ISaveable interface, world subsystem autosave | `Systems/SILIDSaveGame.*`, `SILIDSaveSubsystem.*` | §20 |
| Difficulty subsystem: Easy/Normal/Hard multipliers applied to AI, resources, hints | `Systems/SILIDDifficultySubsystem.*` | §21 |
| Audio director (ambient layering, 3D stingers, music ducking) | `Systems/SILIDAudioDirector.*` | §22 |
| **Escape routes (multiple):** MainDoor / BackDoor / Window / Hidden — each declares key tag, tool capabilities, consumed components, prerequisites | `Systems/SILIDEscapeRoute.*` | Escape system |
| **Barriers:** planks (hammer, N hits), chain (bolt cutters), fusebox (component), padlock (key) — unlock doors/routes/lights | `Props/SILIDBarrier.*` | Puzzles §17 |
| **Repair system:** data-driven requirement rows (tool tag / consumed component / key tag + work presses), condition state, loud cooldown work loop, `FSILIDOperationResult` failure codes, replay-based save restore | `Systems/SILIDRepairComponent.*` (+ `ISILIDRepairable` in `SILIDInterfaces.h`) | P7 (doc 13/14) — PENDING-COMPILE |
| **Electricity:** central power-graph subsystem (generator state machine Off→NoFuel→NeedsRepair→Fueled→Running, tag-registered consumers, load/breaker/overload-grace model, blown-fuse pressure, brown-out window, 1 Hz board, replay-safe save) + `ElectricPowered` consumer component with pushed `OnPowerChanged` + power requirements on doors/barriers/escape-routes | `Systems/SILIDElectricalSystemSubsystem.*`, `Systems/SILIDElectricPoweredComponent.*` (+ Door/Barrier/EscapeRoute/LightSwitch power seams) | P8 (doc 13/14) — PENDING-COMPILE |
| **Randomization:** seeded spawn-point scatter, guaranteed-first fairness, difficulty loot scaling, seed saved/restored | `Systems/SILIDRandomizerSubsystem.*`, `SILIDSpawnPoint.*` | Replayability |
| **Objectives (P13):** event-driven story-tag fabric — `USILIDObjectiveData` rows (tag-query + progress completion, optional/priority), subsystem ledger recording world facts once (escape / repairs / power state → `Story.*` tags), HUD objective line, replayed raw-fact save; no polling, no manual completion, zero story nouns in code | `Systems/SILIDObjectiveData.*`, `Systems/SILIDObjectiveSubsystem.*` (+ `OnAnyRepaired` fabric on `SILIDRepairComponent`) | P13 (doc 13/14) — PENDING-COMPILE |
| **Solvability validator:** pure C++ closure evaluator (supply ledger, cycle + exhaustion checks), read-only world extraction, reject-before-play (`FindNextValidSeed`), 200-seed automation harness, console batch execs; power chain grounded via the virtual `Machine.Power` node (P8); objective requirements join at the P16 re-run (P13) | `Systems/SILIDSolvabilityTypes.h`, `SILIDSolvabilityEvaluator.cpp`, `SILIDSolvabilityValidator.*`, `SILIDSolvabilityTests.cpp` | P16 (doc 13/14) — PENDING-COMPILE |
| Light switches (toggle + device noise the Resident hears) | `Props/SILIDLightSwitch.*` | §5, §8 |
| Item capability flags (BreaksPlanks / CutsChains / TurnsScrews / PriesOpen / ComponentTag) | `Systems/SILIDItemFlags.h` | §6 |
| Game mode: death/respawn, **escape = win (any route)**, run seed, HUD spawn | `Systems/SILIDGameMode.*` | §19, §30 |
| Replicated run state + per-player state (run phase, escape mirror, objective summary · downed, role tag, ready) | `Systems/SILIDGameState.*`, `Systems/SILIDPlayerState.*` | §30, doc 12 §1 |
| HUD base widget (prompt, battery, stamina, subtitles, examine, death, ending, objective, inventory view) | `UI/SILIDHUDWidget.*` | §24 |
| Doors (locked/unlocked, key/tag consumption) and pickups | `Props/SILIDDoor.*`, `Props/SILIDPickup.*` | §5, §6 |

## 2. Build & run (10 minutes)

Requirements: **Unreal Engine 5.3+** (5.4 recommended), Visual Studio 2022 with "Game development with C++" workload.

1. **Generate project files:** right-click `SILID.uproject` → *Generate Visual Studio project files* (or run `UnrealVersionSelector.exe`).
2. **Open the solution** (`SILID.sln`) and build the `SILIDEditor` target (Development Editor, Win64), or simply double-click the `.uproject` and accept the compile prompt.
3. **Create the level** — see the manual checklist below (step A is the only blocker).
4. Press **Play**.

There are **no imported assets required to compile or run**: the input mapping is built in code, meshes are engine placeholders, sounds are silent references until you assign them.

## 3. Manual editor checklist (things that cannot be generated as text)

### A. Level — required
Create `Content/SILID/Maps/LM_House` (or any map) containing:
- A floor and walls forming **6–8 rooms** (blockout geometry is fine; Nanite meshes can come later).
- One `PlayerStart`.
- **`BP_SILIDCharacter`-placed-by-Gamemode** — nothing needed; the game mode spawns the player.
- At least one `ASILIDResident` placed (or add a spawner later).
- Doors, pickups, hide spots, the safe, the radio (see B).
- A `NavMeshBoundsVolume` covering the whole house — the AI cannot move without it.

Set the map as *Editor Default* / *Game Default* in **Project Settings → Maps & Modes**, and set *GameMode Override* to `SILIDGameMode` (or set it as the project default GameMode).

### B. Actor placement — required for the slice's gameplay
- **`BP_SILIDDoor`** per doorway. For locked doors: assign `UnlockItemId` (e.g. `item_key_rusty`) or a `LockTag`, and give the matching key pickup a `UnlockItemId` with the same id.
- **`BP_SILIDPickup`** for keys, batteries, notes, the crank, etc. Each references a **`PDA_Item`** asset (see C).
- **`BP_SILIDHideSpot`** (wardrobe, under-bed, cabinet). Set the camera socket transform for the hidden view.
- **`BP_SILIDSafe`** with a 4-digit code and the reward pickups inside.
- **`BP_SILIDRadio`** in the sala; wire its broadcast tag to whatever the puzzle needs.
- **`BP_SILIDRoomMutationZone`** volumes (from `SILIDRoomDirector`) around rooms that should change.
- **`BP_SILIDBarrier`** — planks on a window, chain on the back door, fusebox in the utility room, padlock on the gate. Wire each `DoorToUnlock` / `RouteToEnable` / `LightsToRestore`.
- **`BP_SILIDEscapeRoute`** — one per exit: MainDoor (key + padlock barrier), BackDoor (chain + fuse for the garage door motor), Window (screwdriver route: remove hinges), Hidden (under-stairs hatch that opens only after the fusebox restores power — set `PrerequisiteRoute`).
- **`BP_SILIDSpawnPoint`** — scatter 6–12 per item family (keys, batteries, tools, components) in believable drawers/shelves/corners; set `Family` = `Items.Keys`, `Items.Battery`, `Items.Tool`, `Items.Components`. The randomizer activates one (Easy: more) per family per seed.
- **`BP_SILIDLightSwitch`** per room that has working lights after the fusebox is restored.

### C. Data assets — required for real items
Create `Content/SILID/Data/Items/PDA_<Name>.uasset` instances of `SILIDItemData`:
`item_key_house`, `item_key_rusty`, `item_key_basement`, `item_key_padlock`, `item_battery`, `item_fuse`, `item_hammer` (Flags.BreaksPlanks), `item_bolt_cutters` (Flags.CutsChains), `item_screwdriver` (Flags.TurnsScrews), `item_crowbar` (Flags.PriesOpen), `item_note_01…`, `item_crank`, `item_apple`…
Each item sets `ItemType` (Key/Tool/Component/Battery/Consumable) and the matching `FSILIDItemFlags` — barriers and escape routes query capabilities, never ids.
Fill in: Display name, description, type, icon (temporarily blank), world mesh (use engine basic shapes), stack size, gameplay tag (`Item.Key`, `Item.Tool`…).

### D. HUD widget — required for UI
Create `Content/SILID/UI/WBP_SILIDHUD` reparented to **`SILIDHUDWidget`**. Layout is up to you; the C++ calls these implementable events: `ShowPrompt`, `ShowBattery`, `ShowStamina`, `ShowSubtitle`, `ShowExamine`, `ShowDeath`, `ShowEnding`.
Assign it to **`SILIDGameMode → HUDWidgetClass`**. Without it the game still runs (all UI degrades gracefully).

### E. Resident visuals — placeholder-safe
The Resident pawn uses the engine mannequin by default. Replace later with MetaHuman / Fab / Reallusion content (license-checked). The AI behavior does not depend on the skeletal mesh; only the capsule matters.

### F. Audio — placeholder-safe
Assign real cues to the Audio Director's slots (ambience, stingers, chase layer) when available. Until then the director no-ops safely.

## 4. Architecture rules (from the spec)

- **Nothing hardcoded per-object.** All interaction flows through `ISILIDInteractable`; all persistence through `ISILIDSaveable`; all item definitions through `SILIDItemData` assets; all balance through the Difficulty subsystem.
- **Components over monoliths:** Inventory, Health, Flashlight, NoiseEmitter are actor components usable on any character (player *or* AI).
- **Events over polling:** the noise bus is a multicast delegate; the save subsystem registers actors via BeginPlay/EndPlay.
- **Data assets and tags, not Blueprint spaghetti.** Adding a new key or battery never touches C++.
- **Every system is replaceable:** the AI's perception, the room director's mutation table, and the difficulty curve are all editable data.

## 5. Spec traceability (vertical slice, §30)

| Slice requirement | Where it lives |
|---|---|
| First-person realistic player | `SILIDCharacter` (walk/run/sprint/crouch/stamina curves) |
| Realistic old Filipino house | **Manual:** the blockout level (§3A) — the code systems are house-agnostic |
| 6–8 rooms | Manual layout; the RoomDirector tracks them via mutation zones |
| Inventory | `SILIDInventoryComponent` (+ data assets) |
| Flashlight | `SILIDFlashlightComponent` (battery drain, flicker) |
| Interactions | `ISILIDInteractable` framework |
| Doors / drawers / pickups / keys | `SILIDDoor`, `SILIDPickup` |
| One multi-step puzzle | Safe (code lock) + radio (clue broadcast) + key-for-door chain |
| Hiding system | `SILIDHideSpot` + `SILIDCharacter::SetHiding` + AI search |
| The Resident + patrol/hearing/vision/investigation/chase/search | `SILIDResidentController` (13 states, perception-driven) |
| Dynamic horror events | `SILIDRoomDirector` (data-driven mutations) |
| Environmental storytelling | Notes/photos as Document items + examine text + RoomDirector |
| Save/load | `SILIDSaveSubsystem` (versioned, autosave + death restore) |
| Pause menu | `SILIDPlayerController` pause input; UI widget is manual |
| Settings | Difficulty subsystem + controller sensitivity (exposed in code) |
| Death system | `SILIDHealthComponent` → GameMode respawn-from-save |
| Escape objective + **multiple routes** | `SILIDEscapeRoute` actors + `SILIDGameMode::ReachEscape` (any route wins) |
| Randomized item locations + patrol shuffles + seed persistence | `SILIDRandomizerSubsystem` + `SILIDSpawnPoint` (seed in save) |
| Tools: hammer / bolt cutters / screwdriver / crowbar + components (fuse...) | capability flags in `SILIDItemFlags` + `SILIDBarrier` |
| Restore electricity | Fusebox barrier (`bRestoresPower` + P8 `RestoresPowerNode`) → `UElectricalSystemSubsystem`; generator BP shell (`ElectricPowered` `bIsGenerator`) → `StartGenerator` |

## 6. Phase plan

- **Phase 1 (done):** core prototype — player, movement, interaction, inventory, flashlight, house blockout, doors, pickups, basic puzzle, basic enemy, basic chase, basic hiding.
- **Phase 2 (this slice):** one polished house section, one complete puzzle chain, one AI, hiding, inventory, dynamic events, one escape sequence, complete save system, one ending.
- **Phase 3 (production):** expand the house, story stages (§19), character pipeline (MetaHuman), full audio pass, more puzzles/endings, cinematics.
- **Phase 4 (polish):** optimization (Nanite/Lumen/VSM audit, LODs), accessibility (subtitles/FOV/colorblind — HUD hooks already exist), animation polish, save reliability, performance testing.

## 7. Folder map

```
Source/SILID/
    AI/         Resident pawn + 13-state controller
    Logging/    Category-scoped log macros
    Player/     First-person character + code-built Enhanced Input controller
    Props/      Door, Pickup, HideSpot, Barrier (planks/chain/fusebox/padlock),
                LightSwitch
    Puzzles/    Radio, Safe (both use CodeLockComponent)
    Systems/    Types, interfaces, item data + capability flags, inventory,
                health, flashlight, noise, code lock, save game + subsystem,
                difficulty subsystem, game instance (item registry), room
                director, escape routes, objectives (data + subsystem),
                randomizer + spawn points, game
                mode, audio director, gameplay tags
    UI/         HUD widget base (events implemented by WBP subclass)
Content/SILID/          (created in editor — see §3)
    Maps/ Data/Items/ UI/ Blueprints/ Audio/ ...
```
