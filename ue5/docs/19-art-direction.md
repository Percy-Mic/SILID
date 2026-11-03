# 19 — Art Direction: Professional Environment Quality (canonical art bible)

**The law:** *"If an object exists in the world, it should look like the real object it represents."* A car looks like a real car; a refrigerator like a real refrigerator; the house like an actual Filipino house. Never a box standing in for a detailed real-world object — unless the box is the object (a taped cardboard box may be a box; a refrigerator may not).

**Precedence:** doc 03 owns *sourcing & layout* (kits, Filipino prop checklist, house program); doc 02 characters; docs 04+10 lighting/audio/mood; doc 07 licensing. **This doc owns visual quality law**: the no-primitives rule, the pass pipeline, scale standard, density, storytelling, variation/imperfection, QC, and the quality gate.

---

## 1. The quality laws (spec §1, §31)

1. **No placeholder geometry ships.** Primitives (cubes, planes, untextured blocks) exist only during blockout/collision/nav/prototype/measurement. The distinction is *tracked per location*: every space knows which pipeline stage it's in (§2) — a stage is a status, not a hope.
2. **Gameplay working ≠ visually complete.** A feature's visual completeness is judged only at FINAL stage of the §2 pipeline.
3. **Fix quality before density.** Never solve ugly with more objects: asset quality → proportions → geometry → materials → lighting → composition → placement → storytelling — *then* increase density. A room full of low-quality objects is still an ugly room.
4. **Solo pipeline:** everything modeled is bought (licensed), generated (MetaHuman), or kit-assembled. Hand-modeling is the last resort of the fallback ladder (00 §7). "No primitives" never means "model everything" — it means *select real assets*.

## 2. The 10-pass location pipeline (spec §28 — the per-location process)

Every major location moves through named passes; **a location's stage is recorded** in the room checklist (03 §3) so nothing silently sits at graybox:

```
1 BLOCKOUT → 2 ARCHITECTURE → 3 FURNITURE → 4 PROP DRESSING → 5 CLUTTER
→ 6 MATERIALS → 7 WEAR → 8 LIGHTING → 9 AUDIO → 10 GAMEPLAY VERIFY
```

| Pass | Output | Failure that sends it back |
|---|---|---|
| 1 Blockout | Dimensions, nav, flow, connections (03 §5 workflow) | chase loop / sightlines fail |
| 2 Architecture | Real kit pieces replace primitives; no uninterrupted walls (§6 surfaces) | scale violates §3 |
| 3 Furniture | Real furniture/appliances placed with purpose (§5) | room reads empty/generic |
| 4 Prop dressing | Functional objects (what the room *does*) | storytelling unclear |
| 5 Clutter | Secondary/tertiary/micro layers (§4) — gravity-honest | floating, uniform duplication |
| 6 Materials | PBR through master materials (03 §4); variation (§7) | flat/one-material building |
| 7 Wear | Age/dust/stains/scratches — varied, not tiled decals (§7) | identical dirt everywhere |
| 8 Lighting | Practical + environmental per docs 04/10; power-state aware | uniform lighting |
| 9 Audio | Per-family object audio (04 §1) with attenuation/reverb | silent interactions |
| 10 Gameplay verify | Nav/interaction/AI/physics/MP/performance intact after art | art broke play |

## 3. Project measurement standard (spec §4 — documented dimensions, UU = cm)

The one table every asset and room is checked against:

| Element | Standard |
|---|---|
| Player eye height / capsule | 165 cm eyes · capsule 180 cm (half 90) |
| Door (interior) | 200 H × 90 W cm (frame +5); main door 210 × 100 |
| Ceiling height | 270–280 cm interior (matches the 280 cm kit wall module, 03 §2); 240 cm for old-service rooms |
| Stairs | Riser 17–19 cm · going 27–30 cm · width ≥ 100 cm |
| Windows (jalousie/capiz) | Sill 90–100 cm · H 120–150 |
| Table / desk | 75 H cm · chair seat 45 H |
| Bed | 190×150 (double) · mattress top 55 H |
| Refrigerator | 150–170 H; rice cooker 25 H; electric fan 40–120 (stand) |
| Car (sedan) | L 450 × W 175 × H 145 cm · wheelbase ~260; motorcycle L 200; bicycle L 170; skateboard 80 |
| Train carriage | L 2000 × W 280 × H 350 cm — rail gauge 1435 mm standard |
| Counter / kitchen worktop | 90 H cm |
| Electrical panel / meter | 60–120 H mounted 150 cm center |
| Interaction reach | **240 cm = `ASILIDCharacter::InteractionReach` (slice value — the binding already exists)** |

**Rule:** any imported asset failing scale by >±10% is rescaled or rejected at import QC (§8) — a "toy-sized" car is a hard reject, not a judgement call.

## 4. Prop density hierarchy (spec §7 — no empty rooms)

Every room layers four tiers (03 §5's dressing pass + §3's Filipino pass execute this):

```
TIER 1 ARCHITECTURE      walls, floor, ceiling, windows, doors
TIER 2 PRIMARY OBJECTS   large furniture, appliances (the room's purpose)
TIER 3 FUNCTIONAL OBJECTS cabinets' contents, tableware, tools, electronics, storage
TIER 4 MICRO DETAILS     cables, switches, stains, dust, screws, slippers, papers
```

Target feel: **"organized enough to be believable, messy enough to feel lived in."** A room missing tiers 3–4 reads as a box regardless of tier-2 quality. Clutter respects physics/gravity — nothing floats (enforced again at pass 10).

### 4a. PCG procedural dressing (engine-feature law — 20 §2)

Density comes from **PCG graphs, not hand-placement** (the solo-dev rule: engine feature before custom — the `PCG` module row in 20 §2 activates at art pass 5).

- **One ruleset per room type**, keyed by `DA_RoomDef`: kitchen → dishes/utensils/rice cooker/food containers; bedroom → clothes/books/pillows/bags; workshop → tools/screws/parts; garage → vehicle equipment/tires/fuel; basement → storage/utility/rust; bathroom → tabo/timba/toiletries. Filipino-identity props (03 §3) ride the same rulesets.
- **The four density tiers (§4) are the graph's layers** — PCG fills tier 3–4 clutter over authored tier 1–2; it never re-places gameplay-critical objects.
- **Exclusion law (hard):** PCG respects exclusion volumes/zones around **spawn points, interactables, nav-cutters, and door/swing volumes** — generated clutter can never block a spawn, a search, an escape route, or AI nav. Interaction classes (§10) come from the placed asset's class, and **Gameplay-Critical objects are never PCG-placed** — the randomizer owns those, always.
- **Gravity-honest output** is still enforced at pass 10 — generated clutter obeys the same float-test as hand-placed (§4).
- **Determinism:** a PCG graph seeded from the run seed is validator-compatible; unseeded random streams are rejected in dressing graphs that touch spawn-adjacent zones.

## 5. Environmental storytelling recipes (spec §6 — purposeful placement)

Rooms are dressed from *use*, not from a furniture list. Canonical recipe (kitchen): plates + cups + utensils + rice cooker + pots + condiments + food containers + dish rack + cleaning products + towels + trash bin + fridge magnets + water dispenser + cabinets/drawers + outlets + extension cords + **worn countertop, grease, stains, small clutter**. Bedroom recipe: bed + pillows/sheets/blanket + wardrobe + clothing + slippers + bags + bedside table + lamp + books + charger + outlet + curtains + personal objects + dust.

Each recipe ties back to gameplay: containers are searchable (12 §7), outlets/appliances sit on power nodes (05 §2), personal objects carry story data (notes/photos as Document items). Doc 03 §3's Filipino checklist column is the cultural layer *on top of* these recipes — both apply per room.

## 6. Architecture & exterior quality (spec §15)

- Exterior detail set: roof structure, gutters, downspouts, framed windows with curtains, door handles/locks, **electric meter, utility cables, AC units**, exterior lights, drainage, painted concrete, cracks/stains/weathering.
- **No uninterrupted wall planes:** break surfaces with sections, windows, trim, pipes, vents, cables, balconies, structural elements, material changes — composition first, decals never as a substitute.
- Filipino architecture identity (extends 03 §3): concrete + painted plaster houses, tiled floors, metal gates, capiz/jalousie/sliding windows, corrugated roofing, concrete stairs — references live in the room checklist.
- **Structural-systems realism (2026-09-28 request §1):** buildings read as *constructed*, not decorated — plumbing runs (visible risers, traps under sinks, the water tank line), electrical conduit/meter/junction boxes and switch gear, ceiling ventilation and capiz vents, roof structure (trusses, purlins, corrugated sheets with sag and rust), drainage (gutters, downspouts, scuppers, yard drains), and **maintenance access** (panels, cleanouts, the access hatch to service runs). These are where the game's systems live visibly: the power chain (05 §2) and water chain (05 §3) terminate at objects the player can find by reading the building.

## 7. Variation & imperfection (spec §18–19)

**Variation:** common objects ship in variation sets — chairs (plastic/wooden/upholstered/damaged), boxes (sizes/damaged/taped/plastic bins), cabinets (clean/worn/painted/metal) — with **controlled random variation** at placement (rotation offsets, wear params) so repetition never reads as copy-paste. Repeating identical meshes visibly = gate failure.

**Imperfection:** scratches, chipped paint, faded surfaces, stains, dust, fingerprints, water marks, rust, small cracks, worn edges, discoloration, accumulated dirt — applied through the master-material weathering parameters (03 §4: Dust/Wetness/Rust) and varied **per instance**, never identical decals tiled everywhere.

## 8. Import QC (spec §25 — every external asset passes)

| Check | Criterion |
|---|---|
| Visual | correct scale (§3 ±10%), orientation, proportions, believable materials, no geometry errors, no floating components |
| Technical | collision built, Nanite where appropriate, LODs where needed, material count, texture size, memory, **naming convention (§9)** |
| Gameplay | interaction sockets present, usable collision, physics class assigned, nav-compatible, replication-compatible if required |
| Integration | the 00 §3 anti-asset-flip checklist + **ledger row before import** (07 §3) |

Failed scale/orientation is fixed at import, never shipped; the QC checklist is appended to the ledger row's notes.

## 9. Naming & organization (spec §26–27)

Naming: `SM_House_Wall_A`, `SM_House_Window_Jalousie_A`, `SM_Furniture_Chair_Plastic_A`, `SM_Appliance_RiceCooker_A`, `SM_Vehicle_Car_Sedan_A`, `SM_Railway_Train_Carriage_A`, `SM_Tool_Wrench_A` — prefix law (12 §2) + category law; `_A/_B/_C` = variation sets. Organization follows doc 01 §8's `Content/SILID/…` + `Content/ThirdParty/<Source>/…` split. **The SILID content taxonomy (adopted 2026-09-28, request §69) — binding folder law under `Content/SILID/`:**

```
Content/SILID/
├── Architecture/   ├── Furniture/    ├── Props/       ├── Tools/
├── Weapons/        ├── Vehicles/     ├── Train/       ├── Electrical/
├── Plumbing/       ├── Tunnels/      ├── Vegetation/  ├── Characters/
├── Animations/     ├── Audio/        ├── VFX/         ├── UI/
├── Materials/      ├── Maps/         ├── Data/        ├── Blender/   (§13.4 sources)
└── Blueprints/
```

Every asset sits in exactly one category folder (name-prefixed to match — the §8 import QC checks both), variations as `_A/_B/_C` beside their base, and the Blender/ source tree mirrors the game folders it feeds.

## 10. Interaction & physics classes (spec §21)

Every object gets exactly one interaction class at placement: **Decorative** (static, no physics) · **Physical** (Chaos sim, push/throw — noise on impact) · **Interactive** (Interactable + container/switch/etc.) · **Gameplay-Critical** (save-relevant, validator-relevant: keys, fuses, tools, escape components). The class drives physics cost (R-015), save keys, and clutter system rules (gravity-honest placement).

**Controlled damage states (2026-09-28 request §28 — the destruction law):** appropriate objects carry **authored damage states** — swappable meshes or decal+state layers (`Intact → Cracked → Broken`), plus physics knock-over for Physical-class props (furniture topples; glass shatters to debris + noise). **No runtime geometry destruction, no fracturing sims by default** — the request's own caveat is binding: the house is never wholesale destructible; damage states exist where they create gameplay (windows → entry/noise, boards → escape prep, locks → force-open, lights → darkness shift, vehicles → 18 §2 part failures). Every damage state persists through the generic save maps and is noise-tagged (the AI hears what breaks).

## 11. Atmospheric & audio detail (spec §23–24)

Atmosphere: dust, subtle fog, humidity sheen, rain + wet surfaces, wind, leaves, smoke/steam, sparks — Niagara per doc 04 §2, **supporting geometry, never covering it**. Audio: per-family object sound (door hinge/handle/latch/impact; car door/lock/ignition/engine/tires; train doors/brakes/rail hum; generator startup/idle/failure) through MetaSounds with attenuation + reverb (04 §1) — semantic events only, never gameplay-dependent.

## 12. The quality gate (spec §30 — binding for every location and the whole game)

A section is **not visually complete** if: primitives remain · major objects lack real models · materials are flat · rooms are empty · furniture floats · scale is wrong · repetition is obvious · vehicles look prototypical · lighting doesn't interact with materials · no environmental storytelling · exteriors unfinished · key surfaces lack detail.

**The chain:** Silhouette → Geometry → Materials → Detail → Dressing → Lighting → Audio → Gameplay → Performance — every link passes before the location's stage is set to FINAL; FINAL locations feed the screenshot parity tests (10 §4, 03 §8) and the release-candidate visual audit (14 P30).

**The recognition test (spec §32):** a player looking at any object should think *"that's a real refrigerator / real car / actual Filipino house"* — never *"that's a box representing one."* REAL PLACE → REAL OBJECTS → REAL MATERIALS → REAL WEAR → REAL INTERACTION → REAL GAMEPLAY.

---

## 13. The Blender pipeline (custom-asset standard — spec requests §1, §2, §19)

Blender is the project's **custom-modeling tool** inside the sourcing ladder (§1 law 4: buy → generate → kit-assemble → hand-model last). It is used where no licensed kit/scan serves: gameplay-specific objects, story props, damaged/destroyed variants, kit-gap pieces (Filipino-identity props especially — §03 doc §3), and detail passes on purchased pieces. Blender is **never** used to rebuild what a licensed asset already provides — that is the buy-first law, not a Blender limit.

### 13.1 When an asset is Blender-authored (the trigger list)

| Trigger | Examples | Note |
|---|---|---|
| Gameplay-critical and specific | generator shells' unique parts, fusebox interior, safe mechanism, escape hatches | must read as the real object (§12 gate) |
| Filipino identity, unsourced | capiz window inserts, ventanilla frames, tabo/timba, santo niche, old calendar props | the cultural layer is hand-made when libraries have no match |
| Damage/destroyed variants | broken flooring, collapsed shelving, smashed door panels, burnt wiring | scanned sets rarely carry consistent damage states |
| Detail enrichment of purchased kits | added hinges/handles/screws/panels on kit doors, cable runs, vents | re-skin through project masters (§03 doc §4) after editing |
| Architecture gap-fills | odd-length walls, custom trim, jalousie window modules the kit lacks | matched to the kit's grid + one wall height (§03 doc §2) |
| Tunnels/basement structures | drainage channels, pipe runs, electrical conduits, support frames, rusted gates | modular pieces, kit discipline applies below ground too |
| Vehicles beyond purchased | roof racks, rust patches, missing-panel variants, train interior fittings | composed on top of purchased base meshes where bought |

### 13.2 Modeling standard (every custom mesh ships with)

Real-world scale from the first vertex (§3 table; 1 u = 1 cm — set Blender units to metric, meters, ×100 on export or use a 0.01 scale export preset). Believable construction over silhouette-only: **bevels on every machined/wooden edge** (nothing ships knife-edge except sheet metal), **actual thickness** on walls/panels/containers (no zero-thickness shells near camera), seams/joints where real parts meet, and the hardware set — handles, hinges, screws/bolts, panels, vents, cables, connectors, switches — where the real object has them. Proportions checked against §3 before material work begins; a toy-scaled object is reworked, not dressed.

Workflow per asset: **block to real scale → hard-surface model (or sculpt-then-retopo for organic/worn forms) → UV unwrap (non-overlapping for unique texels; overlap only on mirrored/wrapped parts with matching wear) → bake high→low (normal + AO + curvature) → PBR texture through project masters → LOD/import QC (§8)**. Retopology is mandatory after sculpting: quads/edge-flow at density appropriate to Nanite (detail meshes may skip LOD chains but still need clean normals for baking).

### 13.3 Material & bake discipline

Baked maps feed the **project master materials** (§03 doc §4) — never bespoke node graphs per asset: albedo/normal/roughness/metallic/AO map to master parameters; weathering rides the Dust/Wetness/Rust instance parameters (§7), not baked-in dirt that can't vary per room. Bake cage margin and padding consistent (4–8 px at 1K–2K); texture budget per §03 doc §4 (2K hero, 1K standard). One asset = one material instance wherever possible; material count is an import-QC row (§8).

### 13.4 Blend-file organization & provenance

`Content/SILID/Blender/` mirrors the game folder structure (one `.blend` per asset or tight family, same `SM_…` naming, `_HIGH` suffix for sculpt/bake sources). Every `.blend` referenced by a shipped asset gets a **ledger row** (§07 doc §3 — Blender-authored = `source: Blender (in-house)`, license: project-owned, `$0`, provenance note = blend-file path). Export standard: FBX (unit-checked), forward X / up Z, nanite-appropriate triangulation at import; export presets are saved in the Blender user config and named in the ledger notes.

### 13.5 Blender ↔ engine consistency (the chain, mapped to the §12 gate)

Spec's chain — **Shape → Scale → Materials → Detail → Wear → Placement → Lighting → Interaction** — is exactly §2's pipeline with Blender's role per link: Shape/Scale = §13.2 (block + measure in Blender, verify ±10% at import QC §8); Materials = §13.3 (masters, not bespoke); Detail = the hardware set + bakes; Wear = master parameters per instance (§7); Placement/variation = §4 density tiers + controlled random variation; Lighting/Interaction = passes 8–10 (practicals on power nodes, interaction sockets, collision, physics class). A Blender asset that fails any link goes back — §12's gate applies to self-made assets exactly as to purchased ones, and the no-primitives law (§1) applies double: a hand-modeled cube is worse than a purchased cabinet.
