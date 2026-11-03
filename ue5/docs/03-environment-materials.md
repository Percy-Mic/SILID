# 03 — Environment, Materials & Filipino Identity

Goal (spec §4, §6, §7, §8): a large interconnected, unmistakably **Filipino** house assembled from modular licensed kits and consistent master materials — not modeled room-by-room, not an asset-flip collage.

> **Quality law lives in [19-art-direction.md](19-art-direction.md)**: no-primitives rule, the 10-pass location pipeline, the measurement standard (doors 200×90, ceilings 280, real-scale vehicles…), density tiers, variation/imperfection, import QC, and the location quality gate. This doc owns *sourcing and layout*; doc 19 owns *visual quality*.

---

## 1. House program (20–40 meaningful areas)

Floors: **Ground / Second / Roof deck-lite (attic) / Basement (+ hidden basement) / Exterior.**

| Zone | Areas | Notes |
|---|---|---|
| Living spine | Entrance/foyer, sala (living), dining, kusina (kitchen), hallway, stairs | The "public" loop; best-lit when power is on; CCTV covers part of it |
| Service | Pantry, dirty kitchen, laundry, water pump area, helper's room | Power/water infrastructure lives here (§05 doc) |
| Private | 3–4 bedrooms (kwarto), office/aklat, 2 bathrooms (banyo) | Loot drawers, hiding spots, story props |
| Utility | Generator room, electrical room, storage/bodega, workshop | Fusebox, breaker, breaker panels, tools |
| Below | Basement, **hidden basement** (secret door), maintenance tunnel | Dark, no windows, escape-route backbone |
| Above | Attic, service corridors (maids'/back stairs) | Classic horror verticals; cat-and-mouse layer |
| Exterior | Garden, backyard, shed, garage, carport, gate | Weather exposure; alternate approaches |

≈ 30 areas — **expanded to 40–50 by the property program** ([17-expanded-world.md](17-expanded-world.md): second-floor detail, attic as a full area, basement complex, garage; house remains the center, the property becomes playable world, gated post-M1.5). Interconnection rules: **every floor has ≥2 vertical connections** (main stairs + back/service stairs + attic ladder + basement stairs), and **no dead-end room without an alternate exit path** (window, vent, connected closet) so the AI never traps the player unfairly.

### Room record
Each area gets a `DA_RoomDef` row (§01 doc §4): tag, floor, bounds, default power node, ambience/reverb, CCTV coverage, loot table, memory props. The RoomDirector (exists) mutates rooms by tag; the web game's six rooms (Sala, Kusina, Aklat, Hallway, Kwarto, Bodega) map onto these directly.

## 2. Modular kit strategy

Buy **one** primary architectural kit, not five:

1. **Primary kit (required):** a modular house/interior kit from Fab with wall/floor/ceiling/door/window/stairs/railing/trim pieces, real-world scale, Lumen-ready. Filter Fab for "modular", "interior", "PBR", check each candidate's triangle/Nanite-readiness and material layout before purchase.
2. **Secondary kits:** a rustic/aged-wood kit and a tropical/exterior kit for the shed/garden/basement.
3. **Scans:** **Poly Haven** (CC0, no attribution required, commercial OK) for textures, HDRIs and props; **Fab/Megascans** where a specific surface is needed — **paid since 2025** (verified; see 07 doc) — buy once per project, put in ledger.

**Kit discipline:** one wall height (e.g. 280cm), one floor grid (e.g. 100cm), door modules matched to the kit's opening modules. If a second kit must mix in, it gets a full material re-skin through project master materials (§4) and a scale check — this is the anti-asset-flip line.

### 2a. The Blender + licensed-library hybrid pass (per location; spec requests §1–3)

Sourcing per location is a **hybrid pass, decided room-by-room on this decision order**: (1) licensed kit/scan piece exists → buy/use it (ledger row); (2) kit piece exists but lacks construction detail → buy it, then **Blender detail pass** (add hinges/handles/screws/panels/cables, re-skin to project masters — doc 19 §13.2 hardware set); (3) nothing licensed serves → **Blender-authored** per the doc 19 §13 standard (scale-first modeling, UV/bake, master materials, ledger provenance row). The pass is spreadsheet-tracked per location alongside the §5 dressing pass so every location records which of its pieces came from which route — and a location can't be called visually complete (doc 19 FINAL stage) until its hybrid pass is done and QC'd (doc 19 §8).

Blender-authored pieces must match the kits they sit beside: same wall-height/grid discipline (§2), ±10% scale law (doc 19 §3), same master materials. Custom-made only where no library can serve — that boundary is what keeps a one-person pipeline feasible while the no-primitives law (doc 19 §1) still holds.

## 3. Filipino identity pass (the differentiator)

The house reads Filipino through **props and finishes**, not architecture rewrites. The slice's room names already establish this.

| Layer | Props (all purchasable/CC0 unless noted) | Placement rule |
|---|---|---|
| Furniture | capiz-window cabinets, carved wooden platera, akadama/bamboo seating, mono-block chairs, carved dining set, OLD colonial rocking chair | Mixed eras: 60s–90s accumulation, not a catalog |
| Appliances | electric fan (the Filipino one), CRT TV, gasul tank, rice cooker, water dispenser, old refrigerator | Few, placed on power nodes — turning on power *does things* |
| Devotional | Santo/Santo Niño niche, crucifix, last-supper frame, palm-Sunday palms behind frames, misa cards | Every bedroom + sala; often dust-covered |
| Paper | old calendars (pharma/gas brand), school yearbooks, bola-bond paper, photo albums, newspaper stacks | Notes/diegetic hints carrier (story data) |
| Household | tabo + timba (dipper+bucket) in every bathroom, basurahan, doormats, tuperwares, sewing machine | Interactable candidates; tabo ties into water system |
| Structure | capiz sliding windows, ventanillas, wooden louvers, ceiling fan, fluorescent + E27 bulb fixtures | Kit mods + material swaps |
| Exterior | banana/taro plants,sampaguita pots, clothesline, tricycle/jeepney parts (shed), sari-sari shelf | Garden/backyard texture |

**Identity law:** any generic-looking kit piece gets a Filipino layer before ship — capiz/venetian blinds over plain windows, religious item per bedroom, calendar in kitchen, tabo in bathroom. A 30-area checklist column per room keeps this honest.

Custom-made only where no library can serve: family photo frames (UI-printed textures from generated faces/stock — license-safe), handwritten notes (own handwriting/fonts), story-specific props. Everything else is sourced.

## 4. Material system (reusability is the whole point)

**Master materials (few, parameterized), material instances (many):**

```
M_Master_Opaque      — albedo/normal/rough/metal/AO + per-instance:
                       Dust, Wetness, Rust, PaintColor, PaintLayers, Emissive
M_Master_Foliage     — two-sided foliage, wind (WPO from wind vector shared with weather)
M_Master_Glass       — thin-translucency, refraction off (perf), dust parameter
M_Master_Water       — for sinks/tubs/puddles (wetness from WaterSystem)
M_Decal_Master       — stains/mold/cracks/dust sheets (decals, not unique meshes)
MI_ (instances)      — per-surface: NARRA_Wood_Dark, CHAPEL_Concrete, CEILING_White_Paint…
```

- **Nanite** on all static architecture + dense props; instanced meshes for repeated items (chairs, jars); keep translucency out of Nanite paths.
- **Weathering via parameters, not new textures:** the same plaster master yields clean / dusty / water-stained / mold-spotted variants per room through `Dust/Wetness/Rust` scalars — rooms can look 40-years-damp without 40 unique materials.
- **Texture budget:** 2K hero surfaces (kitchen, entrance), 1K everywhere else; only Poly Haven CC0 or purchased scans; every source file kept in the source-named folder for the license audit.
- **PPM:** Lumen reflections pick up emissive fixtures; check every new material in the Lumen-verification room (LM_Test_Blockout) before it enters the house.

## 5. Construction workflow (solo-paced)

1. **Blockout LM_Test_Blockout** (BSP/blocking meshes only) — validate loops, sightlines, AI nav, chase distances, CCTV angles. **Before any pretty assets.**
2. Swap to kit modules zone-by-zone; World Partition grid over the map; one data layer per zone (dusty/normal).
3. Per-room dressing pass (props from the identity table) — 2–4 hours/room target, spreadsheet-tracked.
4. Filipino pass per room (§3 checklist).
5. Lighting pass (04 doc), audio pass (04 doc), then move to the next zone — never polish all rooms once at the end.

## 6. World Partition & streaming notes

- One persistent map `LM_House` (World Partition, cell ~30m) — the house is interior-heavy; separate exterior cells for garden/street keep light complexity sane.
- **Data layers:** `Dusty`, `PostPower`, `Rainy` variants of dressing sets toggled at runtime by the RoomDirector — this is how "the house changes" without level reloads.
- HLODs off (interior); World Partition is used for streaming and team-workflow, not for open-world draw distance.

## 7. Performance budget (per view, mid-range GPU)

| Budget | Target |
|---|---|
| Nanite statics | ~1.5M visible tris OK; instanced props keep draws low |
| Non-Nanite | translucent/foliage/skeletal — strict, minimal |
| Lights (Lumen) | ≤ 64 shadowed per area cluster; rest via emissive + Lumen GI |
| Materials | ≤ 4 unique per room (instances don't count) |
| Draw calls | ≤ 2500 total view; instancing + ISM first tool |

## 8. Acceptance criteria

- [ ] 20–40 areas built from ≤ 3 kits + Poly Haven, all through master materials
- [ ] Filipino checklist column ≥ 80% per room, 100% on sala/kusina/entrance
- [ ] Every room has ≥ 2 exit paths (spec §5 interconnection)
- [ ] Blockout-validated chase loop: player can loop the AI through ≥ 2 floors
- [ ] No kit-mix visual clash: side-by-side screenshot test in LM_Test_Blockout
- [ ] Ledger rows exist for every kit/scan/texture pack (07 doc)
