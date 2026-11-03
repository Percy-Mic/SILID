# 08 — Roadmap: Solo Milestones & the Web-Game Port Map

Two tools here: a **milestone ladder** sized for one person, and a **port map** that reuses what the already-verified web build (`src/`, 169/169 regression checks green) proved out — its systems are the design prototype for the UE5 slice.

---

## 1. Milestone ladder (each = shippable demo, not a "phase of polish")

### M0 — Engine bring-up (1 week)
Open `ue5/SILID.uproject` (UE 5.4), compile the slice, build the blockout level per `ue5/README.md` §3A. **Gate:** PIE run, AI chases, save/load round-trip.

> Build-order reconciliation: this ladder maps onto the canonical 22-phase sequence in [13-build-order.md](13-build-order.md) (M0 = P0/P1, M1 = P2–P8, **M1.5 = P13+P16 small-complete-loop gate**, M2 = P17, M4 = P18). Doc 13 defines the order; this doc defines the calendar.

### M1 — One real floor (4–6 weeks)
- Ground-floor zone (sala/kusina/hallway/entrance) from ONE modular kit, master materials, blockout-validated chase loop
- 10 rooms total incl. vertical connection to a locked second floor
- Generator→fuel→fuse→breaker→**2 rooms of lights** power chain (§05 doc §2)
- MetaHuman protagonist in `PDA_CharacterDef`, FP arms, foot IK, hand IK on doors
- Audio: MetaSound footsteps/doors + one ambience layer + stinger set
- **Gate (acceptance):** a stranger can play 15 min and report "abandoned Filipino house", not "asset demo". Filipino checklist ≥ 80% on these rooms.

### M2 — The full house (6–8 weeks)
- All ~30 areas blocked → dressed zone-by-zone (03 doc §5 workflow), both floors + basement + attic
- CCTV + motion sensors + electronic locks on the security circuit (§05 doc §4)
- Water system minimum: pump→valve→2 bathrooms + one gameplay unlock (§05 doc §3)
- Full escape-route set (4+ routes via `ASILIDEscapeRoute` data), objective/ending data assets
- Saves: autosave + checkpoint restore (port of the web game's checkpoint/respawn behavior)
- **Gate:** full run playable seed-to-escape in any order; soft-lock audit (05 doc §7) passes.

### M3 — Characters, weather, audio pass (4–5 weeks)
- Co-op presets (Lite MetaHumans), third-person anim validation
- WeatherSubsystem + Niagara rain/fog + thunder-masked generator start
- MetaSounds per family + reverb/occlusion pass; music/stinger director polish
- Resident identity data (`PDA_CharacterDef` + enemy anim layer + vocal set)
- **Gate:** 04-doc acceptance list; weather changes AI outcomes in a test map.

### M4 — Co-op bring-up (5–6 weeks)
- Session (listen server, NULL→Steam), 2-player first: movement, inventory, doors, power states, AI server-only
- Revive/carry/trade primitives (06 doc §5), player-count difficulty rows
- Seed replication → identical spawns on all clients (web-game proven pattern)
- **Gate:** 06-doc acceptance list at 2 players, then 4.

### M5 — Polish & vertical-slice-to-store readiness (ongoing)
- Perf budget pass (03 doc §7), VSM/Lumen audit, load times
- Accessibility (subtitles/FOV/colorblind — HUD hooks exist), settings menu
- Ledger audit + credits generation (07 doc §3)
- **Gate:** the five pillars (00 doc §2) each verified by one demo scene.

### Cut list (pre-declared, per 00-doc §7 ladder)
Climbing anims beyond ladder volumes; vehicles (garage car is static dressing); public matchmaking; host migration; VO beyond one stinger line; more than one enemy archetype at ship.

## 2. Port map — proven web-game systems → UE5

The web build (`src/`) is the design prototype: its systems are verified by 169 regression checks and live two-seed tests. Port logic, not code:

| Web system (verified) | File | UE5 home |
|---|---|---|
| Rooms/floors/doors, occlusion | `src/world/House.js` | Modular kit + `DA_RoomDef` + RoomDirector mutation zones (01/03 docs); occlusion = engine culling/VSM, no port needed |
| Stealth director (tension pacing) | director module in `src/` | `ASILIDRoomDirector` (exists) — data-driven mutations become `DA_Story`-triggered events + AI aggression scaler |
| Generator fuel→fuse→plug→start chain | `src/` survival chain | `UElectricalSystemSubsystem` state machine (05 doc §2) — the web chain *is* the spec's chain, already validated as fun |
| Power grid + per-room lights | power grid module | `DA_PowerGraph` + tag-registered consumers (01 doc §4, 05 doc §2) |
| CCTV monitor (live room view) | CCTV monitor module | `BP_CCTV`/`BP_CCTVMonitor` (05 doc §4); co-op spectator added (06 doc §5) |
| Melee pipe weapon (hold/drop/throw, durability-flavored) | `src/player/Interaction.js` | `PDA_WeaponData` + BP_Weapon (01 doc §3.2); throw → physics noise (05 doc §1) |
| Flashlight battery + D-cells economy | flashlight module | `USILIDFlashlightComponent` (exists) + battery item family in the randomizer |
| Checkpoints/respawn saves | save module | `USILIDSaveSubsystem` (exists) — autosave on zone change, death restore keeps puzzle progress (GameMode behavior already written) |
| **Seeded dynamic item spawns** — container/floor registry, mulberry32, guaranteed-first fairness, difficulty-scaled medical loot, same-seed reproducibility, floor-only hints | `src/core/ItemSpawns.js` (15-point registry) | **`USILIDRandomizerSubsystem` + `ASILIDSpawnPoint` (exists)** — direct descendant: same contract (seed → deterministic placement, fairness, family-based spawn tables, difficulty multipliers). Hint rule (floor, never room) carries into `DA_PowerGraph`-adjacent hint data (05 doc §7) |
| Regression harness (`?regression=1`, 169 checks) | `src/core/Regression.js` | UE Automation: seed reproducibility, power-chain transitions, save round-trips, AI honesty assertions (06 doc §8) — the port discipline that keeps the slice honest |
| Seeded run start / restore-or-generate | `src/main.js` | `ASILIDGameMode.GetRunSeed/SetRunSeed` (exists) + SaveSubsystem restore path |

**Port rule:** the web game remains the fastest place to *design* new systems (minutes to test a rule, 169 checks as guardrail); UE5 implements proven rules only. Never prototype in UE5 what can be prototyped in the web build first — that loop is the solo dev's superpower.

## 3. Cadence & tracking

- Weekly: one milestone sub-goal + a 2-client PIE smoke (M4 onward), regression suite green in the web build when touching shared design.
- Per room/zone: checklist row in the Filipino/acceptance spreadsheets (03 doc §3).
- Per asset: ledger row before import (07 doc §3) — no exceptions.
- Milestones close with a played demo, not a task-board completion.

## 4. Risk register

Superseded by the full canonical register: **[15-risks-assumptions.md](15-risks-assumptions.md)** (R-001–R-030 with owners, statuses, and assumption-validation evidence). Summary of the solo-dev-specific rows: animation rabbit hole → shared-skeleton MetaHuman pipeline (02 doc); networking bugs → server-authority map + weekly 2-client ritual (06 doc); license drift → ledger-as-gate (07 doc); asset-flip look → master-material checklist + Filipino pass + AFRAID parity test (00/03/10 docs); burnout → every milestone is a playable demo.
