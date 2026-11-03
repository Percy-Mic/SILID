# 22 — Smallest Playable Scope (SPS)

**Role / precedence:** this doc defines the **smallest real game** — the first thing that must be genuinely fun. It sits *below* doc 13's P17 vertical slice in scope (**SPS ⊂ slice**). Docs 13/14 stay canonical for *order* and *proof*; this doc is the scope fence for the first playable target and the acceptance checklist its §34 defines. Build nothing larger until §9 passes.

**Environment law (doc 14 §6):** in-repo work authors deliverables and marks proof `PENDING-COMPILE` until the user's editor session runs the compile/play proof.

---

## The one-sentence test

> **"Explore a dark house with a flashlight, avoid one enemy, search for the randomized tools and fuel needed to repair the generator, restore power, and escape."**

If the build cannot be described in that one sentence, it is too large.

---

## 1. Map (5 areas only)

```text
                 BEDROOM
                    |
                 HALLWAY
                /       \
        STORAGE         STAIRS
                          |
                       BASEMENT
                          |
                    GENERATOR ROOM
                          |
                      ESCAPE EXIT
```

Plus an optional tiny exterior for the final escape. **Not in SPS:** second floor, attic, garage, garden, tunnels, railway, train, multiple buildings.

Small enough to fully test in minutes, but it must contain: multiple routes, hiding opportunities, searchable containers, darkness, one enemy, one progression gate.

## 2. Player

Implement only: first-person camera, walk, sprint, crouch, interaction, flashlight, inventory, pickup/drop, health, stamina.
**Not in SPS:** customization, vehicles, climbing, swimming, parkour, multiplayer.

## 3. Flashlight

Start with a flashlight; power is OFF. Implement ON/OFF, beam, falloff, shadows, battery, battery replacement, limited batteries. The whole SPS must be navigable with the flashlight, and darkness must **not** be a black screen (doc 10 darkness-floor law).

## 4. Inventory

6–8 slots, functional not elaborate. Items: Flashlight, Battery, Screwdriver, Fuse, Fuel, Key (+ optional Wrench, Medical).

## 5. Searchable objects

8–12 containers (drawers, cabinet, toolbox, wardrobe, storage box, desk). Each can open, close, hold items, make sound, be searched. Important items must **not** sit on the floor — the player must search.

## 6. Randomized item locations

Every new run may move screwdriver / fuse / fuel / key / batteries. Architecture stays fixed; the gameplay layer changes.

## 7. One enemy — perception + darkness stealth

States: `Patrol → Hear → Investigate → See → Chase → Lose → Search → Return`.

- **Sight** considers darkness, flashlight, distance, movement, crouching, line of sight.
- **Hearing** considers footsteps, sprinting, doors, drawers, dropped objects.
- The enemy must never know the exact location without evidence. The three proofs: flashlight-off + crouching + still + dark → not detected; flashlight-off + sprinting → heard, investigates the area; flashlight-on + visible → visually detected.

## 8. One hiding system

Two spots (e.g. wardrobe, under bed). Seen entering → the enemy may investigate the spot; not seen entering → evidence only. No elaborate hiding animation required.

## 9. One generator + one repair system + one electricity system

Generator requires **Fuel + Fuse + Screwdriver**, discovered by inspection (missing fuse → wiring → empty tank), not a checklist. One reusable repair interaction: equip screwdriver → interact → repair; then insert fuse, add fuel, start.

Electricity: `GENERATOR → MAIN POWER ├── Hallway Light ├── Basement Light └── Escape Door`. Power OFF → lights off, escape door locked/disabled. Power ON → lights on, escape door usable.

**Generator noise:** starting it emits a loud noise → the enemy investigates the generator area (the first risk/reward decision).

## 10. One escape, death, run reset

One escape route only: power restored → exit unlocked → reach exit → escape. No train/car/tunnel/window escapes, no multiple endings.

Death = caught → die → **restart run**. Run reset resets player, enemy, generator, power, doors, containers, escape state, and re-randomizes item locations.

## 11. Explicitly deferred (§33)

30–50 rooms, second floor, attic, garage, vehicles, train, railway, tunnels, water, CCTV, multiple enemies/types, weapons, crafting, advanced puzzles, **multiplayer**, customization, advanced story, multiple endings, weather, procedural house, complex destruction, advanced animation, **full save system**, monetization, achievements, mods.

## 12. Minimums

- **Audio:** player (footsteps/crouch/sprint/flashlight/interaction), environment (wind/ambience/doors/drawers), generator (repair/startup/running), enemy (footsteps/investigate/chase/attack), UI (pickup/interaction).
- **Lighting:** darkness, moon/window light, flashlight, one or two powered lights. No weather/seasons/volumetrics.
- **UI:** interaction prompt, inventory, health, stamina, battery. No journal/minimap/tracker/skill tree/crafting/multiplayer UI.
- **Art:** legitimately free assets + placeholder geometry; ~1 house, 8–12 containers, 1 enemy, 1 player, 1 flashlight, 5–8 items, 1 generator, 1 exit door, 1 bottle.
- **Budget: $0.** No paid assets/plugins/animation/characters/sound packs.
- **Performance:** stable gameplay > responsive controls > reliable AI > correct systems > visual quality.

## 13. Playtime + replay proof

First attempt ~10–20 min; experienced ~5–10 min. **Replay test: at least 20 consecutive runs**, recording item locations, enemy behavior, deaths, escapes, impossible situations, confusing interactions, bugs, boring sections.

---

## 9. Definition of done (§34) — checklist

```
[ ] Player moves                    [ ] Hiding works
[ ] Player crouches/sprints         [ ] Bottle distraction works
[ ] Player interacts                [ ] Generator can be inspected
[ ] Flashlight works                [ ] Generator has requirements
[ ] Batteries work                  [ ] Tools work
[ ] Inventory works                 [ ] Fuel works
[ ] Containers work                 [ ] Fuse works
[ ] Items move between runs         [ ] Electricity works
[ ] Enemy patrols                   [ ] Lights respond
[ ] Enemy sees                      [ ] Generator creates noise
[ ] Enemy hears                     [ ] Exit responds to power
[ ] Enemy investigates              [ ] Player can die
[ ] Enemy chases                    [ ] Player can restart
[ ] Enemy loses player              [ ] Player can escape
[ ] Enemy searches                  [ ] New runs randomize item locations
                                    [ ] Generated runs remain solvable
```

---

## 10. AUDIT — SPS §34 vs. this repo (inspection-level, 2026-10-07)

`✅ code` = a class/implementation exists · `~` = partial / needs editor content · `✗` = no implementation.
All `✅ code` items are `PENDING-COMPILE` (no UE toolchain in-repo — doc 14 §6).

| SPS item | Status | Evidence / gap |
|---|---|---|
| Player moves | ✅ code | `Player/SILIDCharacter.*` (walk/run/sprint/crouch/jump, speed curves) |
| Crouch / sprint | ✅ code | crouch toggle + sprint + `Stamina`/`MaxStaminaSeconds`/`UpdateStamina` on the character |
| Player interacts | ✅ code | focus trace → `ISILIDInteractable` (`Systems/SILIDInterfaces.h`); dedicated `InteractionComponent` extraction still pending (doc 13 P3) |
| Flashlight | ✅ code | `Systems/SILIDFlashlightComponent.*` |
| Batteries | ✅ code | battery drain + pickup refill in the flashlight component |
| Inventory | ✅ code | `Systems/SILIDInventoryComponent.*` + `SILIDItemData` |
| **Containers** | **✗** | **no Container/Drawer/Cabinet/Wardrobe actor class exists** — the single largest SPS gap (also flagged by doc 13 P5) |
| Items move between runs | ✅ code | `Systems/SILIDRandomizerSubsystem.*` + `SILIDSpawnPoint.*` |
| Enemy patrols | ✅ code | `AI/SILIDResidentController.*` (13-state machine) |
| Enemy sees / hears / investigates / chases / loses / searches | ✅ code | AI perception (sight + hearing) + noise bus (`SILIDNoiseEmitterComponent.*`) |
| Hiding works | ✅ code | `Props/SILIDHideSpot.*` (with `BaseSearchChance` + difficulty/suspicion search test) |
| Bottle distraction | ✅ code | `SILIDCharacter::HoldItem/Drop/ThrowHeld` + throw input on the controller → noise event; a concrete `BP_Bottle` actor is editor content |
| Generator inspectable | ✅ code | generator is a **BP shell** by design (doc 09 §3) composing `SILIDRepairComponent` + `SILIDElectricPoweredComponent` (`bIsGenerator`) + noise |
| Generator requirements | ✅ code | `Systems/SILIDRepairComponent.*` — data-driven requirement rows (tool tag / consumed component / key tag) |
| Tools work | ✅ code | capability flags in `Systems/SILIDItemFlags.h` (BreaksPlanks/CutsChains/TurnsScrews/PriesOpen) |
| Fuel / Fuse | ✅ code | inventory components consumed by the repair rows |
| Electricity works | ✅ code | `Systems/SILIDElectricalSystemSubsystem.*` (single authoritative power owner, generator state machine) |
| Lights respond | ✅ code | `SILIDElectricPoweredComponent` + `Props/SILIDLightSwitch.*` |
| Generator creates noise | ✅ code | noise emitted on start/sputter/breaker (doc 14 §8) |
| Exit responds to power | ✅ code | `Systems/SILIDEscapeRoute.*` with power prerequisites |
| Player can die | ✅ code | `SILIDHealthComponent` → `ASILIDGameMode::HandlePlayerDeath` |
| Player can restart | ~ | death currently **respawns from save**; a discrete fresh **"New Run"** (new seed + full reset, SPS §16/§18) is not a single method |
| Player can escape | ✅ code | `ASILIDGameMode::ReachEscape` (any route wins) |
| New runs randomize locations | ✅ code | seed rolled per run in `ASILIDGameMode::BeginPlay`; randomizer activates one spawn per family |
| Generated runs remain solvable | ✅ code | `Systems/SILIDSolvabilityValidator.*` + evaluator + 200-seed harness |

**Superset notes (SPS is a minimum, not a cap):** the repo already has **four** escape routes (SPS asks one), a **save system** (SPS §19 defers it), and **no weapons/multiplayer** (matches SPS). Decide whether the SPS run should *disable* save/extra routes or simply keep the superset.

### Gap list → next actions

1. **Searchable containers (SPS §5/§6)** — the real missing system: a reusable `Container` actor (open/close, sound, randomized contents, search) reusing inventory + randomizer. Closes the only `✗`.
2. **Discrete run restart (SPS §16/§18)** — a `NewRun`/`RestartRun` entry that reseeds and resets world state without requiring a save round-trip.
3. **Editor content (doc 21)** — the 5-area SPS map + NavMesh, BP shells (generator, bottle, containers), the PDA items (screwdriver/fuse/fuel/key/battery), and `WBP_SILIDHUD`.
4. **Interaction component + event-driven prompt push** (doc 13 P3 / D10) — quality work, not blocking.
5. **SPS replay test (SPS §13)** — 20 consecutive runs once the map exists; record the §13 observations.

**Status: SPS is ~90% code-complete.** It cannot be called DONE until #1–#3 land and the §9 checklist is proven in an editor session.
