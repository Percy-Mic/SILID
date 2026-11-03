# 05 — Core Systems (electricity, water, security, AI, physics-noise)

Goal (spec §15–19, §21): the gameplay spine. The C++ slice already delivers AI honesty, noise, difficulty, room mutation, escape routes, and saving. This doc defines the production systems built on that spine.

---

## 1. Noise & physics (exists — production rules)

`USILIDNoiseEmitterComponent` broadcasts `FSILIDNoiseEvent{Location, Loudness dB-ish, Tag, Radius, Priority}` on a world bus; `ASILIDResidentController` consumes via AI Hearing. Production wiring:

- **Chaos physics → noise:** on impact (throw/drop/push), query `PhysicsSurface` → loudness table (`PDA_SurfaceNoise`); furniture pushes emit looping low-priority noise; glass breaks are high-priority investigations.
- Anim notifies emit footstep/drawer/door noises (§02 doc) — **one source of truth**: animation event → noise event → {audio rendering, AI hearing, UI stinger}. No parallel fiction.
- Weather scales noise radii (§04 doc §3): heavy rain shrinks outdoor hearing; thunder masks everything momentarily (AI "startle" state).

## 2. Electrical system (spec §15) — the central production system

### Topology (exactly the spec's chain)

```
PDA_PowerSource (Generator)  →  requires Fuel + Repair + Start
        ↓  (single feed)
   FuseBox  → per-circuit Fuses (kitchen, bedrooms, security, exterior…)
        ↓
   Breaker (trip on overload events)
        ↓
   PowerDistribution (DA_PowerGraph nodes)
        ↓
   Rooms → Devices (lights, CCTV, fans, locks, pump, monitor)
```

### Implementation: `UElectricalSystemSubsystem` (WorldSubsystem) — **LANDED (P8, PENDING-COMPILE — doc 14 §11–12)**

- **Devices register by tag** at BeginPlay: `RegisterConsumer(RoomTag, DeviceTag, LoadWatts, ComponentPtr)`. No hard references — a new powered prop needs zero subsystem changes.
- **State machine per source:** `Off → NoFuel → NeedsRepair (condition 0–100, repair via Repairable interface) → Fueled → Running` (RPM→ frequency; brown-out flicker profile when condition is low).
- **Consumption model (simple, data-driven):** total load vs. generator wattage; overload trips the breaker after a grace period; a tripped/open-fuse circuit blackouts its subtree. Fuses are **consumable items** (Item.Component) — replace-and-blown patterns become resource pressure.
- **Brown-out/restart rules:** generator start = loud noise event (big radius) + EM flicker; failed start (no fuel) = sputter noise (smaller radius) — risk/reward baked into restore attempts.
- **Power OFF effects (spec list):** lights/CCTV/electronic locks/elevator(dead)/equipment off; **ON:** all enabled. Lights ON also *help the AI see* (§5.4) — the double edge is the game's tension.
- **Data:** `DA_PowerGraph` rows (§01 doc §4) define tree; devices only need tags. Gameplay Tags: `Power.Node.*` (§01 doc §5). **Landed as:** `RegisterNode(tag, parent, capacity, bFuseRequired)` rows + auto-created leaves when a device registers with an unauthored node tag; native `SILIDTags::PowerNode*` constants for the source chain.
- **Landed seam notes (2026-09-28):** the generator is COMPOSED, not subclassed — its thin BP carries `ElectricPowered(bIsGenerator)` and calls `StartGenerator()` from Interact; there is no C++ generator actor (09 §3 law). The overload grace is a WARNING window: the node stays live while overloaded, the 1 Hz board trips it past grace (shed load in time and you save the fuse). Brown-out is measured by the subsystem (`IsBrownout()`, condition < threshold) and rendered client-locally by presentation — never authoritative. The P7→P8 seam: `RepairComponent::OnRepaired` is the generator's fix input; fuel is spent through the inventory API BEFORE `AddFuel` reports it (the subsystem never names items). Power chain joins the P16 validator graph via the virtual `Machine.Power` node — unwinnable-power seeds are rejected before play (§5 electricity protocol enforced).

### Replication (co-op, §06 doc): the subsystem is server-authoritative; clients get compressed state (per-node enum + load) and cosmetic jitter is client-local. One replicated event bus for state changes.

## 3. Water system (spec §16, optional-but-designed)

`UWaterSystemSubsystem` mirrors electricity:

```
Pump (needs Power.Node.Pump) → MainValve (manual, repairable) → Pipes (DA_WaterGraph) → Fixtures
```

- Restoring water unlocks: working bathrooms (tabo/balon refill, save-point flavour), cleaning systems (blood/debris decal cleanup objectives), machinery (garage door motor *option*, basement sump pump = **hidden basement access stays dry**), certain puzzles (fill-sink float puzzle), hidden-area reveal (water stains mark a secret panel).
- Fixtures register by tag like power consumers; `DA_WaterGraph` rows. Water events: valve squeal noise, pump hum (AI hears), pipe knock when flowing near the player.
- **Failure states (2026-09-28 request §12 — data rows on the graph):** leaks (visible + audible drips, wetness decals via master-material Wetness, waste that matters where drainage exists), blockages (pipes/debris — clear with tools: PriesOpen/drain snake, a repair-row machine), pressure loss (pump off/damaged → upstairs fixtures die first — gravity is the level design), flooding (basement/tunnel sections become hazard routes; the sump pump becomes a POWER-dependent drain — the electricity and water chains visibly meet), and drainage (grates/floors control where flooding goes). Each failure is a `RepairComponent`-style requirement row on a node — the P7 grammar extends, no new machinery class.
- Scoped late (roadmap phase 4) but the tag-registry pattern is identical — designed now, built once.

## 4. Security systems (spec §17)

| Device | Behavior | Power? | AI interplay |
|---|---|---|---|
| `BP_CCTV` (n) | SceneCapture → monitor widget in security room; player can watch rooms from one place | Yes (security circuit) | Camera has **vision** too: feed shows AI; optionally AI can trigger camera "disturbance" stingers; AI can destroy/dislodge cameras if seen wandering into view repeatedly |
| `BP_MotionSensor` | AI Perception (sight-config) on a cone; triggers alarm bus | Yes | Detects **AI** (that's the point: track the stalker) — and players, configurable per data row |
| `BP_Alarm` | Loud noise broadcast (attracts AI to the *alarm's* location, not the trigger's) | Yes | Honest: alarm sounds where it sounds; AI investigates it |
| `BP_ElectronicLock` | Power-gated; dead-locks **closed** without power (fail-safe) | Yes | Player must pick physical fallback route — locks never create soft-locks (§7) |
| `BP_ControlPanel` | Arm/disarm zones, view cycle, UPS battery minutes | Yes | UPS = short CCTV life post-outage (tension timer) |

All are ordinary interactables implementing `ISILIDInteractable` + repairable states — no new framework, just registrations.

## 5. AI (spec §18) — honest, extendable

The slice's `ASILIDResidentController` (13 states, sight+hearing, investigation, door opening, hide-spot search) already satisfies "never magically knows". Production extensions, in priority order:

### 5.1 Senses honesty rules (unchanged, restated as law)
- Sight = perception config (range/FOV/lose-sight memory) + light-level scaling; Hearing = noise bus events only.
- No position reads, no player-index shortcuts, no teleport-nav (nav-mesh limited), no off-screen cheats. Blackboard holds **stimulus memory**, not truth.

### 5.2 New behaviors (BT branches, all perception-fed)
- **Patrol:** route data (`DA_PatrolRoute` waypoint arrays, room-tag-based) + idle wander via NavMesh random points weighted to "rooms with recent player signs" (memory of noise/door events, decayed).
- **Investigate → Search:** stimulus → go → look-around (search points generated from cover/visibility data) → timeout → return to patrol. Searching hide-spots: opens wardrobes/cabinets it saw the player near (memory), never all of them.
- **Chase:** stamina + speed from `DA_DifficultyProfile`; loss-of-sight → last-known-position search with expanding radius; **ranged weapons/throwables create distraction noise** the AI prefers over persistence.
- **Door interplay:** opens unlocked doors (already in slice); locked doors block/redirect; electronics-lock doors with power on (spec §15/§17 crossover).
- **Equipment:** power state affects sensor-driven "AI awareness map" for the player (CCTV shows where it is — but only where cameras look).
- **Memory & learning (2026-09-28 request §30–31) — lands with the BT/BB migration (09 §6, M2):** memory = blackboard stimulus records with decay (last-known position, suspicious zones, repeated noise sources, opened doors, broken objects, recently-seen hide spots, disabled systems) — the blackboard holds *history*, never truth (§5.1 law: no wall-penetrating knowledge, ever). **Learning** = per-run repetition profiles → *bias weights*, not new senses: a hide spot used repeatedly gets checked earlier and more often; a distraction trick repeated loses effectiveness (noise-investigation priority decays for similar events). Both are data-bounded, decay toward baseline between runs, and can never manufacture knowledge the perception layer didn't produce — adaptation without omniscience.
- **Evidence investigation (2026-09-28 request §91–92):** the same memory records *evidence the player leaves* — open doors, moved furniture, broken windows, dropped items, running machines — as legitimate perception facts the AI investigates (it saw the door open, it may check it later; never wall-penetrating). Optional budget-gated traces: wet/muddy footprints and disturbed dust via master-material Wetness + decal components, readable by both sides.

### 5.3 Difficulty & solo adaptation (spec §21)
`DA_DifficultyProfile` fields (data, no code): sense ranges, search thoroughness (hide-spot check fraction), patrol aggression, damage, **item spawn multipliers** (slice randomizer already supports), **solo adaptation**: repair hold-times, carry-object weight (one-player-compatible), fuse count requirements, revive-not-needed (downed state skipped solo). Applied by the existing DifficultySubsystem at run start + on profile change.

**Dynamic-director note (2026-09-28 request §3):** a pacing director (encounter cadence, patrol redistribution, event frequency, scarcity drift) is a **post-M1.5, data-layer extension**: it may WRITE difficulty-profile fields and RoomDirector mutation rows on a cadence, and may READ noise/perception history — it may never write AI perception, positions, or state directly. The honesty law (§5.1) is absolute: no director input can make the AI know something it didn't perceive, and no director action can kill the player directly — deaths remain earned through perceived stimulus (the request's own "never cheat / never randomly kill" rule, adopted verbatim).

### 5.4 Light & AI (the double-edge)
AI sight range scales with local light level of its perception point (dark rooms = short sight, lit rooms = long). The player's flashlight also boosts AI sight of the player — flashlight discipline becomes gameplay. All data-driven via `PDA_LightAIProfile` on fixtures. **Both edges are absolute (2026-09-28 playable-darkness request §14–15):** darkness never grants the AI a magical position signal (honesty law §5.1), and darkness never makes the player invisible — detection in the dark still depends on distance, angle, line of sight, movement, and the ambient floor (04 §4a).

### 5.5 The visibility & awareness tuning law (2026-09-28 perception request — binds P9/P11 gate re-proofs + the BT/BB migration)

The core rule, verbatim: **darkness reduces visual detection · noise reveals information · movement increases visibility · the enemy investigates evidence rather than receiving the player's exact location.** Detection is never `if player exists: chase` — it is graded evidence. The state ladder (`Unaware → Suspicious → HeardSomething → Investigating → VisualContact → Alert → Chasing → LostPlayer → Searching → Returning → CalmingDown`, plus checking-states) is the evidence-graded view of the existing 13-state enum — the enum remains the compatibility contract (09 §6); the ladder names its *evidence semantics*.

| # | Law |
|---|---|
| 1 | **Graded visibility formula** — `PlayerVisibility = Base × Movement × Lighting × Distance × Posture × Obstruction` (0–1 factors, curves not hard thresholds; starting lighting bands: very dark 0.05–0.20, low 0.20–0.45, moderate 0.45–0.70, bright 0.70–1.00 — tune by playtest). Lighting is ONE factor, never the whole system; no single factor guarantees detection or invisibility |
| 2 | **Movement & posture hierarchy** — Stationary < Crouch < Walk < Fast-walk < Run < Sprint as visibility multipliers; crouch also reduces noise/detection speed but never grants invisibility. Dark + crouched + far ≈ undetectable; dark + sprinting across view ≈ high detection — both must hold |
| 3 | **Flashlight detection (two layers)** — the beam is itself perceivable: enemy notices light → turns toward it → attempts confirmation → VisualContact if the player is visible, else Investigate (the classic "light around the corner" beat — the player can reveal themselves without instant detection). Flashlight ON raises the player's Lighting factor but never auto-reveals: LOS, distance, angle, exposure time still apply. Supports the four player modes (search/stealth/investigation/emergency) as pure player-controlled risk |
| 4 | **Noise masking** — perceived noise = origin + loudness + distance + attenuation + **ambient mask**: rain (AISoundScale, 04 §3), running generator hum, TV/fans/pumps raise the mask floor; a silent house makes a dropped spoon highly noticeable. The soundscape is stealth gameplay, not decoration |
| 5 | **Suspicion bands + decay** — evidence accumulates on a 0–1 awareness score (visual + audio + environmental + memory evidence, curve-weighted); 0.2 "something's off" → 0.4 suspicious → 0.6 investigating → 0.8 probable → 1.0 confirmed chase. No evidence → decay through Searching → CalmingDown → Returning; minor events never leave the enemy permanently alerted |
| 6 | **Last-known + search REGION** — on lost contact the enemy stores location/time/velocity + recent noise origins (never current position) and searches a generated region: last-known + nearby rooms/corridors + likely exits + hide opportunities + listen pauses — several relevant points, believable order, gives up as evidence expires |
| 7 | **Hiding distinction (critical)** — if the enemy SAW the player enter a spot, it knows and investigates that spot; if it did NOT see entry, it does not automatically know. Spot checks are probabilistic/data-driven (never every spot every time); extreme proximity may expose breathing. Hiding is never auto-safety |
| 8 | **Fair detection + diegetic feedback** — the player must always be able to explain WHY ("I ran / slammed it / the beam hit him / I dropped it / the generator was loud"); feedback is diegetic only (pauses, turns, posture, approach, heartbeat/breath) — no detection bars, no excessive HUD |
| 9 | **Imperfection is required** — enemies misjudge sounds, investigate the wrong room, lose track, get distracted, fail to notice small changes (profiles vary via PDA_EnemyProfile, 05 §10a); perfect perception is a horror defect |
| 10 | **Performance tiers (R-013)** — event-driven noise; distance-scaled perception update frequency (near = high, far = low, inactive = minimal); cached visibility; no per-frame per-actor raycasts. Difficulty scales ranges/sensitivity/memory — NEVER wallhacks (§5.1 is non-negotiable at every difficulty). MP: server-authoritative perception only (06 §2) |

The five canonical scenarios (dark+crouched; sprint-in-dark heard; flashlight exposure; beam-around-corner; generator-start consequences) are the scripted P9/P11 gate rows — if any fails, the tuning is wrong, not the test. Closing philosophy: **darkness gives the player an advantage; noise, movement, light, mistakes, and consequences reveal them** — "Can it see me? Can it hear me? Did it see where I went?" is the intended player monologue.

## 6. Interaction & repairables

`BP_Repairable` component (new, small): `Condition, RequiredToolTags, RepairTime (difficulty-scaled), Parts[], OnRepaired` — used by generator, fusebox, valve, CCTV, barriers, cameras. One component, six consumers. UI prompt text via `ISILIDInteractable` (exists).

## 7. Soft-lock prevention (the honesty mirror)

- Any locked path's key/tool/component has ≥2 spawn candidates in the randomizer (exists: guaranteed-first fairness); escape routes list `GetMissingText` (exists) so the player always knows *what* they need, not where it is.
- Baseline "safe" item (a floor-hinted guaranteed fuse) mirrors the web game's floor-hint rule: hints say the **floor**, never the room.

## 8. Acceptance criteria

- [ ] Generator start → fuse → breaker → 3 rooms of devices + CCTV, all through tag registry, zero hard refs
- [ ] Overload trips breaker; fuse replace restores; brown-out flicker at low condition
- [ ] AI never leaves NavMesh; light-level scaling visible in test room; hide-search only checks "seen-near" spots
- [ ] Solo: every multi-step repair/carry/revive has a data-scaled single-player profile
- [ ] Water restore unlocks ≥ 2 of the §3 outcomes
- [ ] All systems load/save through existing ISaveable registration

## 9. Injury & status effects (2026-09-28 request §15 — design block, post-M1.5)

**Deliberately small:** the request's own rule — gameplay-focused, not a simulation. Health stays the single death axis; status effects are **data rows** on `USILIDHealthComponent` (or a sibling StatusComponent), not a second health system.

| Status | Mechanic (one line each) | Source | Resolution |
|---|---|---|---|
| Bleeding | timed HP drain + periodic noise (drips) | deep-damage hits, glass | bandage (consumable) |
| Limp / broken limb | move-speed + sprint-denial + louder footfall (favoring the injured leg) | falls, long chases, traps | splint (component) + time |
| Exhaustion | stamina ceiling drops below 100% for a window | redlined stamina, sprint chains | rest (hide or safe room) |
| Pain flash | brief aim/hand-cam disturbance (P26 comfort caps apply) | damage events | time |

Rules: every status is a row (`StatusTag, DurationCurve, Movement/AI/Audio modifiers, CureItemTag`) — difficulty profiles scale duration/severity, never new code paths; AI interplay stays honest (a bleeding player is louder and leaves traceable noise facts the AI already hears — no new AI senses); statuses SAVE as generic-map rows keyed by tag. Nothing here ships before M1.5 (R-018): the base survival loop is proven with the current one-axis health first.

## 10. Extended-system design notes (2026-09-28 request §26–70 — landed as design, each at its named gate)

### 10a. Multiple enemies, ecosystem, territories (§32–34 — post-M2, after BT/BB)

One controller, many profiles: enemy archetypes are `PDA_EnemyProfile` rows (perception config, movement/gait, hearing multipliers, weaknesses, attack style, patrol/search behaviors) on the SAME honest controller — the replaceable-mesh contract applied to AI. Archetypes ship only after the BT/BB migration (building variants on the to-be-replaced enum would violate the no-second-implementation rule, 20 §3). **Ecosystem:** inter-enemy coordination is NOT direct messaging — enemies consume each other's noise events on the existing bus (one hears a gunshot, another converges elsewhere; they block each other physically like any nav agent) — unpredictable encounters, zero scripting. **Territories:** `DA_ZoneDef`'s enemy fields (18 §5 — `bEnemyTraversable`, `EnemyCostModifier`) become home-zone weights + excursion rolls; power outages, alarms and player actions shift patrol weights through the difficulty/director data path (§5.3) — never through direct AI writes.

### 10b. Fire & smoke (§44 — post-M1.5, performance-conscious)

Fire is a **power-node event + volume, not a physics simulation**: sources are electrical shorts (breaker-state events), stove/generator/candle actors with failure rolls; "spread" is a budget-gated chain of damage volumes + Niagara smoke/light (2–3 steps max, R-014 budgets), never free-running propagation. Consequences ride existing fabric: fire blocks routes (nav cutters), damages/damages-adjacent objects (19 §10 states), triggers alarms (noise bus, high priority), attracts the AI honestly (it hears the alarm where it sounds), destroys burnable items. Extinguish = repair-row interactions (smother/cut power); the main-valve/sprinkler crossover uses the water chain (§3). Everything persists through the generic save maps.

### 10c. Item combination & limited crafting (§49–50 — post-M1.5)

Combination = inventory-API compatibility rows (`CombinesWith[]` on item defs: battery+flashlight, fuse+fusebox slot, cable+component, repair-kit+machine — arbitrary combinations don't exist because nothing accepts them). **Crafting stays deliberately small and survival-oriented** (the request's own caveat): noise maker, improvised barricade, bandage, basic repair kit — each a recipe row (`Inputs[] via inventory consume, Output item, WorkPresses via the RepairComponent rhythm, ToolTag optional`), reusing capability flags and the work loop; no crafting stations, no tech trees, no survival-sim economy.

### 10d. Capture / rescue alternative (§54 — difficulty + story data)

An optional non-lethal end-state for enemy contact, keyed by difficulty profile + story flags: instead of death → respawn, a capture teleports the player to a held room (an authored `DA_RoomDef` capture point), confiscates designated items through the inventory API (never direct edits), records world-state keys, and re-arms the run: **CAPTURE → escape the held area (its own mini route/puzzle) → RECOVER items → CONTINUE**. The escape/recovery loop uses only existing grammar (routes, barriers, spawn points in the held room); frequency/cruelty scale via `DA_DifficultyProfile` fields; multiplayer revive rules (06 §5) stay authoritative where they apply.

### 10e. Safe zones, pacing & NPCs (2026-09-28 request §74–76, §104–106)

**Safe zones** are per-run data rows (`DA_SafeZoneDef`: room tag, amenities — storage stash / heal / planning map / item triage — and a reliability profile): safety is temporary BY LAW — enemy territory shifts (§10a), power state, and player actions (noise history, alarm triggers) degrade a zone's reliability during the run, and the run generator rolls WHICH zones exist per seed (§76's Run A/B/C), so no memorized safe strategy survives randomization. **Pacing** is the AI's own shape: the 13-state machine already breathes (patrol → investigate → return); the tension arc (Safety → Exploration → Suspicion → Threat → Chase → Escape → Temporary Safety) is enforced at the audio/presentation layer (04 §3) — the enemy is never perma-attacking. **Rescuable NPCs / trapped characters (§104–106):** an NPC is a simplified HONEST agent (follow / hide / flee / react-to-noise via the same noise bus; no omniscience, no quest-marker statics) with per-run location spawn families (upstairs/basement/locked room per seed); escort/rescue chains are authored as escape-grammar routes + objective rows (P13) — a multiplayer objective variant lives in 06 §5. Post-M2 content (rides the BT/BB migration).

### 10f. Player knowledge, maps, markings & search memory (2026-09-28 request §77–80)

**What the player knows is tracked, not assumed:** a player-knowledge record (journal data set) accumulates discovered rooms, observed clues, learned codes, known item requirements, discovered shortcuts/escape routes, and observed enemy behaviors — the UI never reveals an undiscovered fact. **The map is physical discovery:** an authored base map with per-area discovery flags (ground → upstairs → attic → basement → tunnels → railway), optional handwritten markings, and player annotations. **Player markers (§79):** chalk/notes/symbols/dropped objects as cheap world decals with save persistence — MP players see each other's marks (co-op coordination without voice). **Search memory (§80):** searched containers persist their state — a searched drawer stays OPEN, an emptied box stays VISIBLE-empty — giving genuine spatial memory; this is container state persistence (09 §3), never a magical item scanner or glowing markers (doc 14 P26 uncertainty law).
