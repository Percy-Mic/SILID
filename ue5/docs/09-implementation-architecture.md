# 09 — Implementation Architecture (canonical)

This doc reconciles the **implementation-architecture spec** with the existing C++ slice and the earlier docs (00–08). Where documents conflict: **doc 09 wins on architecture, doc 11 on state ownership, doc 12 on which Unreal type implements what**; updates to 00–10 follow them.

Status legend: ✅ exists in the slice · 🔧 extend (additive, designed below) · 🆕 to build · 📄 covered in docs 00–08.

---

## 1. Architecture tree → reality map

| Spec § | Layer | Status | Where |
|---|---|---|---|
| Core (GI/GM/PC/Save) | `USILIDGameInstance`, `ASILIDGameMode`, `ASILIDPlayerController`, `USILIDSaveSubsystem` | ✅ (+🔧 session/PlayerState/GameState: §7 below) | `Systems/` |
| Player | `ASILIDCharacter` + Inventory/Health/Flashlight/NoiseEmitter components, hiding, examine cam | ✅ (🔧 Equipment, Stamina already in character — extract to component) | `Player/` |
| Items | `USILIDItemData` (UPrimaryDataAsset), `ASILIDPickup`, capability flags | ✅ (🔧 schema extension §3, instance struct §4) | `Systems/`, `Props/` |
| World | Doors, pickups, hide spots, barriers, light switches, RoomDirector | ✅ (🔧 Drawer/Container/Cabinet §5) | `Props/` |
| Systems | Escape routes, barriers-as-repairs, audio director | ✅ (🆕 Electricity/Water/Security subsystems — designed in 05 doc §2–4) | `Systems/` |
| AI | 13-state controller, sight+hearing perception, noise bus | ✅ (🔧 BT/BB migration §6) | `AI/` |
| Randomization | `USILIDRandomizerSubsystem` + `ASILIDSpawnPoint` (family pools, guaranteed-first, loot multiplier, seed persistence) | ✅ (🆕 dependency graph + `USILIDSolvabilityValidator` §8) | `Systems/` |
| Multiplayer | Server-authoritative design complete | 📄 06 doc | — |
| Story | Tag/key/capability-driven systems; story text not in code | ✅ principle (✅ P13 objective fabric §9, PENDING-COMPILE; `DA_Story`/`DA_Objectives` rows = editor content) | — |
| UI | `USILIDHUDWidget` C++ base + WBP events | ✅ | `UI/` |
| Audio | `USILIDAudioDirector` | ✅ | `Systems/` |
| Development | `Logging/SILIDLog.h` categories | ✅ base (🆕 debug commands §10) | `Logging/` |

## 2. Naming & prefix law (spec §2/§21 vs. the slice)

- C++ types: `USILID…` / `ASILID…` (existing law — unchanged).
- Blueprint wrappers of C++ components: `BP_…`; data assets: `PDA_…` (item/character defs), `DA_…` (tables/graphs). The spec's `BPC_` prefix maps to these C++ components directly — **components are C++, composition happens in Blueprints**.
- Third-party content lives **only** under `Content/ThirdParty/<Source>/…` (01 doc §8 updated accordingly); `Content/SILID/` holds only project-native + integrated assets. Ledger (07 doc) audits by path prefix.

## 3. Component composition (spec §3) — the build list

Existing reusable components: `Inventory, Health, Flashlight, NoiseEmitter`. Add (each is small; the interface spine exists):

| Component | Responsibility | Composes into |
|---|---|---|
| `USILIDEquipmentComponent` 🔧 | Slots (hand/back), equip/unequip, delegates | Player, workbenches |
| `USILIDDurabilityComponent` 🔧 | Condition 0–100, loss events, break event | Tools, weapons, generator |
| `USILIDRepairableComponent` ✅ (P7, as `USILIDRepairComponent`) | Condition, tool-tag requirements, hold-repair, `OnRepaired` | Generator, fusebox, valve, CCTV, doors |
| `USILIDLockableComponent` 🆕 | Key tag / code lock / electronic lock states | Doors, drawers, gates, safe |
| `USILIDContainerComponent` 🆕 | Slot list + loot-table tag + open/close | Cabinets, drawers, boxes |
| `USILIDElectricPoweredComponent` ✅ (P8) | Registers by tag to `UElectricalSystemSubsystem`, exposes `OnPowerChanged` | Every powered prop |
| `USILIDRequiresItemComponent` 🆕 | Tag/flag requirements + consume rules (escape route uses this too) | Fuel ports, fuse slots |
| `USILIDInteractableAudioComponent` 🆕 | MetaSound param mapping from prop state | Doors, drawers, machines |
| `USILIDDamageableComponent` 🆕 | Health + hit events (CCTV breakable, barricades) | Cameras, furniture |
| `USILIDHidingComponent` 🆕 | Extracts hiding from the character/hidespot pair | Hiding spots |

**Composition law (spec example, realized):** `BP_Generator = Interactable + Repairable + Durability + ElectricPowered + RequiresItem(Fuel) + InteractableAudio`. No generator-specific class beyond a thin actor shell. A water pump reuses the same parts with different data. **P8 note:** the source side is composition too — the shell's ElectricPowered carries `bIsGenerator = true` and `Interact` calls `StartGenerator()`; the subsystem owns the machine state from registration on.

## 4. Interaction contract extension (spec §4)

Extend `ISILIDInteractable` **additively** (default implementations → zero breakage of the 20+ implementors):

```cpp
virtual float GetInteractionPriority(...) const { return 0.f; }        // nearest+priority wins focus
virtual bool CanInteractFromDistance(...) const { return false; }      // CCTV, alarms, radios
virtual void OnInteractionStarted(ASILIDCharacter*) {}                 // hold-interactions begin
virtual void OnInteractionCompleted(ASILIDCharacter*) {}               // hold-repair, revive
```

The player keeps one focus trace + one Interact path (existing law). Hold interactions are declared via a `HoldDuration` on the interactable; the player controller streams progress to the HUD.

## 5. Item & world schema extensions (spec §2, §5, §6)

### `USILIDItemData` additions
`Rarity (ERarity), WeightKg, DurabilityMax, bCanPickup/bCanThrow/bCanUse/bCanCombine/bCanRepair, GameplayTags (container), ValidSpawnTags (container)` — the capability bools in `SILIDItemFlags.h` merge into the tag container (`Item.Capability.*`), keeping queries uniform.

### Definition/Instance separation (spec §5) — the one true change to inventory
```cpp
USTRUCT() FSILIDItemInstance { FGuid InstanceGuid; FName ItemId; int32 Count;
                              float Durability; TMap<FString,FString> RollData; }
```
- Inventory stores **instances** (ids resolve through the GameInstance registry — already true).
- Pickup flow: actor holds `{ItemId, Count, Seed}` → on pickup, instance enters inventory, actor deactivates (already the behavior); drop = spawn pickup from instance (new small helper `ASILIDPickup::InitFromInstance`).
- `RollData` carries per-instance randomization (durability rolls, keyed codes) — the hook for run variance.
- **Physical-carry classes (2026-09-28 requests §89–90):** instances carry a carry class — Small (one hand) / Two-Handed (fuel container, large battery, board: blocks weapon use, changes movement/interaction, stamina drain) / Fragile (breaks on hard impact → noise + loss) / Noisy (moves loudly — a deliberate tell). Couplings ride existing modifiers: stamina curves (slice), noise bus on move/impact (05 §1), §9 status interactions; no new systems, one enum + modifiers on the instance row.

### Room metadata (spec §6)
`DA_RoomDef` (01 doc §4) gains: `SpawnTags, ConnectedRooms, PowerZone, SecurityZone, WaterZone, PossibleObjectives, PossibleItems, PossibleEvents` — exactly the spec's contract; the randomizer and validator read this and **only this** to understand the world.

## 6. AI migration to BT/BB (spec §13) — keep the honesty, change the executor

The 13-state controller (Idle→Patrol→Wander→Hear→Investigate→Suspicious→Search→Detect→Chase→Attack→LosePlayer→SearchLastKnown→ReturnToPatrol — enum already matches the spec list) migrates to **Behavior Tree + Blackboard** with states as BT branches and `EResidentState` written to the blackboard for UI/music. Services: stimulus memory decay, patrol point selection. Tasks: MoveTo, door open, hide-spot search (existing logic, wrapped as BT tasks). **Perception stays AI Perception + noise bus; the honesty rules in 05 doc §5.1 are unchanged.** Migrate after M2 (roadmap) — behavior equivalence first, refactor second; the state enum is the compatibility contract.

## 7. Core framework completions (spec §1, §19, §20)

- `ASILIDGameState` 🆕: run phase (Exploring/Escaped/GameOver), replicated objective progress, run seed mirror (server-owned).
- `ASILIDPlayerState` 🆕: per-player inventory reference, role tag, downed state (06 doc §5).
- Session management 🆕: `USILIDSessionSubsystem` over Online Subsystem (NULL→Steam), per 06 doc §1.
- **Save split (spec §20):** `USILIDProfileSaveGame` 🆕 (settings, accessibility, cosmetics, stats — written on change) vs. the existing `USILIDSaveGame` (run data; gains power/water/security graph states + story flags — already generic `Flags/Counters` maps, so additive). Both versioned with per-file migration.
- **Corruption recovery (2026-09-28 request §22):** the P22 gate adds a **dual-slot write** (save → verify → flip) on top of the versioned payload: the active slot is written to `SILID_Autosave.bak` first, verified by re-reading, then promoted — a corrupt active slot falls back to the `.bak` at load with a logged offer to continue from it (never silently continue — 09 §10's corruption policy). Enemy state, water, and vehicles join the generic maps at their phases — no schema fork.

## 8. Dependency graph & solvability validation (spec §11, §12, §27) — the new keystone

### Dependency data (`DA_DependencyGraph`, rows of `FDependencyNode`)
```
NodeTag, RequirementKind {ItemTag|Capability|PowerNode|PuzzleSolved|RouteOpen},
Alternatives[] (OR-semantics: Screwdriver XOR Wrench), UnlocksTags[],
ZoneTag (where the requirement can be satisfied)
```
The spec's two example runs are just two row sets — no code difference. `ASILIDEscapeRoute` + `ASILIDBarrier` requirements become rows here (their actor fields stay as the level-facing view).

### `USILIDSolvabilityValidator` 🆕 (WorldSubsystem, runs post-RandomizeAll, pre-player-spawn)
```
1. Build world graph: rooms as nodes, connections + locked edges (lock→required tag)
2. Start set = reachable rooms with no requirements
3. Closure loop: for each newly reachable zone, if requirements are in inventory-set
   OR satisfiable in-zone (power chain resolvable from reachable sources) → add zone,
   add its items/tools/keys to inventory-set
4. Fixpoint reached → every DA_Objective requirement + ≥1 escape route must be
   in the closed set; else INVALID
5. Cycle check: no requirement node reachable only through itself (mandatory item
   behind its own lock) → else INVALID
6. Multiplayer: validate against the ACTIVE player count's difficulty rows (06 doc §4)
```
- **Fail → regenerate:** seed = f(baseSeed, attempt++), re-run RandomizeAll + validation, max N attempts (log each failure with the blocking node — the validator is also the designer's debugging tool). **Never start an invalid run** (spec §12).
- **Tests (spec §27):** UE Automation functional test iterates 100+ seeds asserting the validator + item reachability + power-chain resolvability; CI runs it on every randomizer/dependency change. The web build's Regression.js (`?regression=1`, 169 checks) prototypes every validator rule change **before** it's ported here — same discipline as 08 doc §2.
- **Landed (PENDING-COMPILE, doc 14 §9–10):** the pure evaluator + subsystem + 200-seed automation harness implement steps 1–5 above; rooms bind via `ValidationRoomId` metadata on spawn points/doors; execs are `SILID_ValidateSeeds <n>` / `SILID_ValidateSeed <n>` / `SILID_DumpGraph`. Step 6 (player-count rows) lands with P18 per 06 doc §4.

## 9. Objective & event plumbing (spec §8, §17)

- `USILIDObjectiveSubsystem` ✅ (P13, PENDING-COMPILE — doc 14 §13–14): listens to world delegates; `USILIDObjectiveData` rows implement the `DA_Objective` schema (`ObjectiveID, Title, Requirements (tag query), RequiredProgressCount, Optional, Priority`). **P8 events now exist and are consumed:** `OnGeneratorStateChanged / OnBreakerTripped / OnNodePowerChanged` mirror into `Story.*` tags; escape arrives via the GameMode delegate, repairs via the new `USILIDRepairComponent::OnAnyRepaired` component-static; a story-tag ledger records facts once and rows complete on tag queries + progress — nothing is polled, no manual completion path exists. FailureConditions defer to the co-op phase (06 §5).
- **No `if GeneratorFixed`** — the generator broadcasts `OnPowerStateChanged` (ElectricPowered component) → subsystem evaluates tag queries → objective updates → HUD. Same pattern for escape/story flags.
- Systemic events (door opened, glass broke, generator started) already flow through the noise bus; the objective system subscribes to the same delegates — one event fabric, three consumers (audio, AI, objectives).

## 10. Debug & error handling (spec §23, §24)

- Console commands (exec on PlayerController + `FAutoConsoleCommand`), all compiled out of shipping: `SILID.Debug.Randomization`, `SILID.Debug.SpawnItems`, `SILID.Debug.AI` (perception/suspicion viz), `SILID.Debug.Power` (graph draw), `SILID.Debug.Objectives`, `SILID.Debug.ValidateRun` (runs the validator on demand, prints the blocking node), `SILID.Debug.GiveItem <id>`.
- Debug draws live behind `#if !UE_BUILD_SHIPPING` in a `Debug/` folder; CVars gate cost (e.g. `silid.Debug.Power.Draw 1`).
- Error policy (spec §24): missing item id / spawn family → `UE_LOG(Error)` + visible editor-time warn; invalid dependency cycle → validator blocks run start (never `ensure` in shipping paths); corrupted save → reject + fresh-run offer, never silently continue; net desync → server state wins + log. `check()` only for programmer errors that corrupt state invariants.
- **Ghost/replay debug (2026-09-28 request §104):** a dev-only **event tape** records the facts that decide a run's outcome — seed/config, interactions, item pickups, door/barrier states, power/water graph changes, objective transitions, enemy perception summaries, damage, deaths — keyed to the run seed so a reported-failing seed can be replayed and stepped through. Compiled out of shipping (`#if !UE_BUILD_SHIPPING`); the validator's per-seed reports are the headless first line of this (the tape explains what the validator can only reject).
- **AI perception debug (2026-09-28 perception request §48 — lands with the M2 AI work):** `SILID.Debug.AI` prints/draws per enemy: state + awareness score, FOV + sight rays, hearing radius, active noise events (tag/loudness), last-known location, generated search points, current stimulus, and the player's current visibility score — e.g. `Resident_01 · Investigating · awareness 0.64 · LKL (1234, 542, 100) · noise Generator 0.82 · player visibility 0.18 · sight FAILED · hearing SUCCESS`. Tuning the §05-doc 5.5 law without this is guesswork.

## 11. Development order (spec §26) → mapped to the roadmap ladder

Spec phases 1–11 map onto 08 doc's M0–M5 (one ladder, not two): Foundation+Interaction = M0; Inventory+Survival+World systems = M1/M2; AI = slice-complete, BT migration after M2 (§6); Gameplay/Randomization/Validation = M2 gates; Multiplayer = M4; Presentation = M1–M3 zone-by-zone (03 doc §5); Polish = M5. **Rule 15 (single-player playable with multiplayer disabled) is structural here:** co-op is the listen-server general case (06 doc §1), never a fork.

## 12. The governing principle (spec §28)

> **"I know this house, but I don't know what this run is going to give me."**

Operationally: the house (`DA_RoomDef`s, kits, power topology) is fixed authorship; the run (seed → item placement → dependency graph → puzzle/enemy/escape configuration → validation) is generated; the story layer sits above and consumes tags only (spec §18). Every layer boundary in the spec's diagram has a named owner in this doc set — that is the architecture.

### The anti-procedural law (2026-09-28 request §121 — binding)

> **"A designer built this house, but every run rearranges the possibilities"** — never *"a computer randomly generated a bunch of objects."*

Randomization acts ONLY on authored possibility spaces: items place by **semantic probability rows** (a screwdriver rolls workshop/toolbox/utility with high weight, bathroom/bedroom with low — never uniform; medicine skews bathroom/bedroom/medical-cabinet, fuel skews garage/shed/generator-room, loot tables are room-context rows — request §82/§101 adopted verbatim); puzzles randomize within designed constraint rows (P7 requirement grammar); enemy behavior varies within the honest-AI bounds (05 §5); escape routes are authored variants (18 §6) rolled per run; dressing varies within room-typed PCG rulesets (19 §4a). Meaningless randomness is a defect, not a style: any placement that "makes no contextual sense merely because the randomizer selected it" fails import/QC like any other defect. Enforcement is structural: the spawn-point family pools carry room tags (`ValidationRoomId`), semantic rows are authored data, and the P16 validator guarantees every randomized graph stays solvable — replayability WITHOUT procedural-feeling output.
