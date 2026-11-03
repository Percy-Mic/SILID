# 17 — Expanded World: Property, Vehicles & Transportation (DESIGN-ONLY — gated)

> **Status gate (spec §29 + doc 15 R-031):** this doc is the *design record* for the expanded world. **No implementation of its phases begins until the M1.5 small-complete-loop gate PASSES** (doc 14 GATE B) — and even then, the **transportation prototype** (§10) is built before any world expansion. The house remains the center of the game; the property becomes playable world; nothing here rewrites core systems (spec §27 verified against the escape grammar, noise bus, tag registries, and zone data). **Re-affirmed 2026-09-28** against the 19-section request (Blender pipeline + expanded house/tunnels/vehicles + survival story): the request's area lists were absorbed below as design targets (see the changelog entry, doc 16a); the gate stands — house/basement/attic/tunnel/vehicle content stays unimplemented until M1.5 + M1.7.

---

## 1. World philosophy (spec §1)

Not a horror house — a **large private property and surrounding environment**: main house, secondary buildings, outdoor areas, underground spaces, utility infrastructure, transportation, hidden and maintenance areas, locked areas that open later, and multiple escapes. The player gradually realizes the house is the center of something larger. The environment is gameplay: **Explore → Search → Repair → Unlock → Travel → Discover → Survive → Escape**. Guiding rule: *bigger world, more interconnected systems, more meaningful exploration — not simply more rooms.*

## 2. Zone architecture (spec §26–27 — modular zones, not a hardcoded world)

Every zone is a World Partition cell set with the same record (`DA_ZoneDef`): streaming boundary, gameplay owner (WORLD/LEVEL), navigation, lighting, audio layers, spawn points, interactables, enemy traversal rules, MP replication rules, save handling.

```
World (LM_Property — World Partition)
├── House (ground/second/attic)      ├── Service Road
├── Basement (main/workshop/gen/utility/hidden) ├── Railway (track/platform/shed/signal box/train)
├── Garage (bay/workshop/storage)    ├── Outdoor (front/side/back yard, garden, greenhouse, well)
├── Yard / Shed / Greenhouse         ├── Underground Network (drainage/maintenance/electrical/water tunnels)
└── Future zones (second property, forest, factory, church, town…)
```

**Expansion law:** future zones arrive as *new `DA_ZoneDef`s + data + prefabs*, never as edits to inventory/interaction/AI/electricity/tools/randomization/MP/save (spec §27). The escape grammar (`ASILIDEscapeRoute`: key tag / tool flags / component tags / prerequisite route), the noise bus, and the tag registries already accept train/car/underground routes with **zero code changes** — that is the acceptance test for every new zone.

## 3. Main house expansion (30–50 areas; spec §2–5)

Doc 03's ~30-area program extends to **40–50** (every area must serve ≥1 purpose from the spec's list — searching, hiding, puzzles, traversal, patrol, resources, repair, story, shortcuts, locked progression, rewards, escape prep; no room-count inflation):

- **Ground floor:** entrance/foyer/staircase/coat area/locked side door · sala (living) · dining · kusina (kitchen) · pantry · bathroom · guest room · study (safe, locked drawers) · office (filing cabinets) · family room · storage/bodega · utility room · laundry (labahan) · dirty kitchen · **workshop access · garage access** — the Filipino identity pass (03 §3) still governs every room's dressing.
- **Second floor:** master bedroom (balcony) · children's bedroom (crawl-space connection) · 2–3 guest bedrooms (**important items may spawn in different ones per run** — spawn-point families span them) · upstairs bathroom (hidden access) · hallway (patrol route) · library (ladder, secret-passage candidate) · storage room · balcony (traversal/escape/hazard) · locked rooms · maintenance/service areas · **back/service stairs** (the ≥2-vertical-connections law, 03 §1).
- **Attic — a full gameplay area (request §4):** old furniture, boxes, clothing, broken appliances, exposed wiring, wooden beams, crawl spaces, hidden compartments, ventilation runs, dust/cobwebs, damaged flooring (hazard + noise texture), hidden objects, secret passages, roof access, locked trunks, possible enemy lair; gameplay = retrieve/repair/shortcut/roof route/second entry (this is where the web build's `hintFor` floor-leak rule gets its attic test).
- **Basement complex (request §5 — not one empty room):** main basement (shelves/workbench/pipes) · workshop (drill/parts/electrical) · generator room (gen/fuel/fusebox/panel/cables) · electrical room · utility room (pump/valves/pressure/pipes) · boiler room · water pump room · cold/old storage · storage/bodega · maintenance corridor linking utilities · underground corridor · drainage area · abandoned room · hidden basement room (secret door) · **underground passage / tunnel entrance** to garage/garden/shed/secondary building/escape. Multiple corridors, doors, level changes, obstacles and alternate routes; no single-room basement.

## 4. Garage complex (spec §6)

A major location: large vehicle bay + small workshop + tool storage + shelves/tires/parts/fuel storage/battery charger/workbench/vehicle lift/electrical panel/storage room. Contains the car, motorcycle, bicycles. **The garage door is a real gameplay system:** electricity / manual release / repaired motor / key / remote / mechanical repair — implemented as an ordinary `ASILIDBarrier`-family interactable + ElectricPowered component (09 §3), not new code.

## 5. Vehicles as composed gameplay objects (spec §7–9, §21–25)

**No new vehicle framework.** A vehicle = an Actor composed of the existing component kit + a vehicle-profile data asset:

```
BP_SILIDVehicle (car / motorcycle / train share it)
├── InteractionComponent (doors/trunk/hood/seat per socket)
├── ContainerComponent (glovebox/trunk storage — vehicle inventory)
├── Repairable + Durability components (per-part condition)
├── RequiresItemComponent (key tag / capability)
├── ElectricPoweredComponent (battery state → starter/starter-circuit)
├── NoiseEmitterComponent (engine state → Noise.Vehicle.Scaled)
├── PDA_VehicleProfile { parts[], fuelType, seatCount, noiseProfile, anim/physics tier }
└── Chaos Wheeled Vehicle physics (car/motorcycle) — engine feature, no custom physics
```

- **Component states:** engine, battery, fuel, tires, starter, lights, brakes, damage, doors, trunk — each a condition + repair requirement from `PDA_VehicleProfile`; randomized requirement sets are *data rows* (spec's Runs A–D are four profile configurations).
- **Noise law (spec §23):** skateboard low → bicycle low/med → motorcycle high → car very high → train extreme; AI hears through the existing bus with distance/walls/floors attenuation. **Engine start → loud noise → enemy response → escape under pressure is the intended drama, emergent from existing systems.**
- **Train (spec §11–13):** lives in the railway zone; same composed object, more parts (control panel, battery, brake release, doors, lights); maintenance shed/signal box stock the existing tool families. The house must never contain the train — the world grows around it.
- **Bicycle/skateboard (spec §10):** optional traversal tools — simplified physics, noise cost, shortcut value; never required.
- **Escape integration (spec §22):** each vehicle/underground/passage option is an `ASILIDEscapeRoute` whose requirements + availability come from the run generator; the validator (09 §8) gains vehicle-requirement rows — a run with primary escape = car must validate key/fuel/battery reachability exactly like fuse reachability today.

## 6. Exterior, water, electrical infrastructure (spec §14–19)

- **Outdoor:** front (driveway/gate/porch/mailbox/lighting) · side (pipes/cables/AC units/drainage/hidden entrance) · back (clothesline/shed/garden) · greenhouse (water/electricity/ventilation/crawlspace) · shed (a genuine spawn location for tools/fuel).
- **Well→water chain:** WELL → PUMP → MAIN LINE → HOUSE → fixtures — exactly the §05-doc water subsystem with the well as source node; failures cascade (bathrooms, machinery, underground access) and repair requirements randomize.
- **Property electrical:** MAIN → HOUSE/GARAGE/RAILWAY circuits → CCTV/CAR/TRAIN consumers — the `DA_PowerGraph` simply grows nodes; progressive restoration (house → garage → railway) is data, and the generator's loud-start risk economics extend naturally.

## 7. Underground network (spec §19 + request §6–7)

Drainage/maintenance/electrical/water tunnels, sewer sections, underground storage chamber, abandoned construction areas, underground workshop, collapsed sections, railway access/escape tunnels, hidden passageways, connection to the house/property: shortcuts, alternate routes, hiding, enemy encounters (the AI's navmesh spans tunnels — hiding down there is not automatically safe), resource discovery, puzzles, tool progression, environmental storytelling, **randomized item locations** (tunnel spawn-point families join the pools), and escape routes. Original SILID identity throughout — the Granny-genre *structure* (trapped → explore → repair → unlock → escape) without its characters, map, assets, names, dialogue, enemy design, or puzzles.

**Tunnel access gates (request §7) — all existing grammar, zero new code:** each gate below is one of the systems already shipped; the randomizer rolls which gates a run uses, the validator proves the chain is solvable:

| Access gate | Implemented as | Grammar |
|---|---|---|
| Restore electricity | powered barrier/door/motor on the route | `Power.Node.*` + `ElectricPowered` (P8) |
| Repair equipment | generator/pump/machine with requirement rows | `RepairComponent` rows (P7) |
| Find a tool | tool-gated barrier | capability flags (`TurnsScrews`/`PriesOpen`/`CutsChains`) |
| Remove debris | planks/collapse barrier (N hits) | `ASILIDBarrier` planks family |
| Open a locked gate | key/padlock barrier | `Lock.*` tags + key items |
| Restore water | well→pump chain node powers the section | §05-doc water subsystem (design) |
| Cut wires / electrical | tool-gated component on the route | capability flags + component consumption |
| Solve a puzzle | code lock / prerequisite route | `CodeLockComponent` + route prerequisites |

**Request §8 escape flavors** (window, service exit, damaged-section, basement route, hidden passage) join the §18-doc §6 route table as design rows — the run generator picks primary/secondary escapes per run and **the player discovers which**; §18 §4's availability-pool law already covers "available vs. disabled per run".

## 8. Multiplayer transportation (spec §24)

Vehicle state is server-authoritative (fuel/damage/doors/trunk/inventory); enter/exit replicate; passengers ride; players cooperate on repairs (the doc-06 §5 primitives apply: one repairs battery while another hunts fuel, one watches CCTV, one distracts). Vehicle rows join the MP randomization tests (same placement on all clients).

## 9. Build order — post-slice phases (spec §28–29, appended to doc 13)

**Transportation prototype first (spec §29):** House → Garage → Car → Fuel → Battery → Repair → Engine → Enemy hears engine → Escape. Once reliable: expand garage → motorcycle → outdoor → underground → railway → train → world randomization → MP transportation (Phases A–H in doc 13 §6).

Data schemas for everything above (vehicle profile, run configurations, noise table, availability pools, zone records, route mapping, prototype data pack): **[18-vehicle-data-schemas.md](18-vehicle-data-schemas.md)**.

## 10. The transportation prototype gate (new M1.7)

| Item | Requirement |
|---|---|
| Scope | One garage bay, one car (key/fuel/battery/repair states), garage door, generator-backed garage circuit |
| Loop | Discover car → diagnose → find key/fuel/battery → repair → **start engine (loud)** → survive enemy response → escape by car |
| Variance | ≥2 requirement configurations across seeds, validator-validated |
| Proves | A-026; vehicle-as-composition; noise→AI consequence; escape-grammar fit |
| Gate | M1.7 = GATE B extension — **fail → fix vehicle integration, never expand the world** |
