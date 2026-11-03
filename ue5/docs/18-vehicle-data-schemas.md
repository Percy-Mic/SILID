# 18 — Vehicle & Zone Data Schemas (design-only, gate-compliant)

Companion to [17-expanded-world.md](17-expanded-world.md). Everything here is **data design**: schemas ready to become uassets when the M1.5/M1.7 gates open the build. No code, no implementation. Binding refs: escape grammar (`SILIDEscapeRoute`), noise bus (`FSILIDNoiseEvent`), capability flags (09 §5), validator (09 §8), zone record (17 §2).

---

## 1. `PDA_VehicleProfile` — the schema (UPrimaryDataAsset)

One profile configures any composed vehicle (car/motorcycle/train share `BP_SILIDVehicle` — 17 §5). Immutability law applies (data owns *what it is*; the vehicle actor owns *what it's doing* — doc 11 §3).

```text
PDA_VehicleProfile
├─ Identity
│   VehicleId (FName)            · DisplayName (FText)      · Class (Car/Motorcycle/Train/Bicycle/Skateboard)
├─ Parts[]  (FVehiclePartSpec)
│   PartTag (Power.Node.Engine | .Battery | .Starter | .Tire_FL… )
│   ConditionRange (0–100 spawn roll)  · FailureStates[] (Dead | Damaged | Missing)
│   RepairRequirements (FSILIDLockRequirement: tool capability + component tags)
│   ConsumesOnRepair (component/fuel tags)
├─ Fuel
│   FuelTypeTag (Item.Resource.Gasoline | .Diesel)  · Capacity  · StartLevel (roll)
│   ConsumptionPerDistance  · RefuelRequirement (tool capability: PriesOpen for cap, none…)
├─ Ignition
│   KeyTag (Lock.GarageCar …)  · bHotwireCapable  · HotwireRequirement (capability + time)
│   StarterSequence (parts that must be functional, ordered)
├─ Noise (drives FSILIDNoiseEvent loudness per state)
│   Idle (0.15) · Crank (0.5) · Running (0.85) · Revving (1.0) · Tag (Noise.Vehicle)
│   RadiusMult (per profile: train 3.0, car 1.5, motorcycle 1.0, bicycle 0.3, skateboard 0.15)
├─ Occupancy
│   Seats (1–4)  · DriverSocket / PassengerSockets  · bCarriesCargo  · CargoSlots (ContainerComponent size)
├─ Physics tier
│   ChaosWheeled (car/motorcycle) | SimplifiedMove (bicycle/skateboard) | RailBound (train)
│   MassClass, TopSpeed, HandlingProfile
└─ Escape integration
    EscapeRouteTag (Route.Car …)  · AvailabilityPool (see §4)
```

**State ownership check (doc 11 §1):** profile = configuration; the vehicle Actor owns fuel level/battery charge/engine state/doors/damage; inventory owns carried keys/components; randomizer owns *initial* rolls only. No rule violated by design.

## 2. The four run configurations (spec §7) as concrete profile rows

One car profile; the **run generator rolls which parts start failed and what repairs require** — the spec's Runs A–D are outcomes, not separate assets:

| Run | Key/Ignition | Fuel | Battery | Extra failure | Repair tool needs (examples) |
|---|---|---|---|---|---|
| A | Car key (KeyTag) | Low (refuel) | Dead → charge/replace | — | — |
| B | Car key | OK | Dead → replace | Tire_FL damaged | Wrench-family (TurnsScrews) + spare tire (component tag) |
| C | Car key | Low | Weak | Starter dead | Electrical tester (capability) + starter component |
| D | **Hotwire** (capability + hold-time) | Low | Dead | Electrical connection damaged | Wire cutters (CutsChains) + cable (component tag) |

Validator tie-in (09 §8): each configuration = dependency rows (key→ignition part→fuel→battery→escape); the closure check must prove every required item has ≥2 valid spawn points **before the run starts**. A configuration that fails validation → regenerate (spec §12's rule, exactly like fuse chains today).

## 3. Vehicle noise table (spec §23 — numbers the bus consumes)

| Vehicle | Idle | Moving | Start event | AI response expectation |
|---|---|---|---|---|
| Skateboard | — | 0.10–0.15 | — | Ignores unless very close |
| Bicycle | — | 0.15–0.25 | bell 0.2 | Notices at close range |
| Motorcycle | 0.35 | 0.6 | crank 0.5 | Investigates; chase risk |
| Car | 0.3 | 0.7–0.85 | **crank→roar 0.9** | **Major response: converge on garage** |
| Train | 0.5 | 1.0 (radius ×3) | startup 1.0 | Property-wide stimulus; the "escape window" drama |

All events carry the standard struct (location/loudness/tag/time); attenuation does the rest — walls, doors, floors already apply. The M1.7 gate asserts: start car → AI state leaves patrol within a bounded time.

## 4. Transportation availability pools (spec §22)

Per-run availability rolls live in the randomizer's data (families on `ASILIDSpawnPoint`-style points and route actors):

```text
VehicleAvailability (per run, weighted)
Car:        AVAILABLE 60% / DISABLED 40%
Motorcycle: AVAILABLE 55% / DISABLED 45%
Train:      AVAILABLE 25% / DISABLED 75%   (also gated on railway zone access)
Underground passage: per-route data
```

- **DISABLED** = the route actor deactivates (`ISILIDInteractable.CanInteract → false` with honest `GetMissingText`: "dead" flavor) — the escape grammar already supports per-route deactivation via prerequisites.
- **Primary escape selection:** the validator requires ≥1 reachable route; when car/train are rolled out, non-vehicle routes (main/back door, window, hidden passage) must still close — the existing guarantee, now including vehicle rows.
- Rule: availability affects *which* routes matter, never *whether* a run is winnable (A-015 untouched).

## 5. `DA_ZoneDef` — the zone record (spec §26 fields, finalized)

```text
DA_ZoneDef
├─ ZoneTag (Zone.House | Zone.Basement | Zone.Garage | Zone.Railway …)
├─ Streaming: World Partition cell range / level instance ref
├─ Ownership: WORLD/LEVEL (layout) — gameplay systems own their own state inside it
├─ Navigation: navmesh bounds ref; bEnemyTraversable; EnemyCostModifier (tunnels attract/deter)
├─ Lighting: default fixture set tag; exterior/interior flag
├─ Audio: ambience layer tag; reverb zone
├─ Spawns: SpawnPoint family map (loot table refs per family)
├─ Interactables: registration census (doors/containers/routes counts — audit input)
├─ Power/Water: node subtree tags (garage/railway circuits; well→pump chain)
├─ MP replication rules: relevancy policy; dormancy policy
└─ Save handling: zone-level state keys (power/water graph slices, cleared barriers)
```

Future zones (second house, forest, factory, church, town) are **new rows of this table** — spec §27's expansion law made mechanical.

## 6. Escape-route mapping (vehicle + zone routes → existing grammar)

| Route | KeyTag | Tools (capabilities) | Components | Prerequisites | Zone |
|---|---|---|---|---|---|
| Car escape | Lock.Car | (per config §2) | fuel/battery/starter parts | garage door route open | Garage |
| Motorcycle escape | Lock.Moto | — | fuel, battery | garage door | Garage |
| Train escape | Lock.Train | electrical repair | control panel, battery, brake key | railway circuit power | Railway |
| Underground passage | — | PriesOpen (grate) | — | tunnel discovered (story/route flag) | Underground |
| Window / main / back door | (existing) | (existing) | (existing) | (existing) | House |
| Window route (per-run flavor) | (existing) | (existing) | (existing) | availability roll picks which window | House |
| Service exit | (existing) | PriesOpen or key | — | utility/laundry access | House/Outdoor |
| Damaged-section exit | — | BreaksPlanks (clear) | — | barrier cleared + route discovered | Outdoor |
| Basement route | (existing) | (existing) | fuse/power if gated | basement complex access | Basement |
| Hidden passage (house) | — | — | — | PrerequisiteRoute (secret door) | House |

Every row is `ASILIDEscapeRoute` fields — **zero code**, the acceptance test for the whole expansion claim. The 2026-09-28 request's escape-route flavors (§8: front/back door, garage, vehicle, underground, railway, hidden passage, basement, window, service exit, damaged section) are all covered by rows in this table + §4's availability pools: per-run primary/secondary selection with **player-discovered** availability — no new route mechanics required.

## 7. Prototype data pack (what M1.7 will actually instantiate)

One car profile (config A default, B–D as alternate rows), one garage zone def, garage circuit power rows, one garage-door barrier (manual release + powered motor), key/fuel/battery item defs, 8–12 spawn points across house+garage for those items, one escape route (car), validator dependency rows. Small enough to build in days once the gates open — and it reuses every existing system, which is the point.
