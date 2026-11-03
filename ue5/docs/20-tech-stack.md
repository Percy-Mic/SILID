# 20 — Confirmed Technology Stack (canonical)

The engine is **Unreal Engine 5** and the architecture is **C++ + Blueprints** — ratified. This doc freezes *which* UE5 feature implements *which* SILID concern so the question is never re-litigated per system, and so every named system has a fallback and a proof gate.

**Precedence:** doc 09 wins on architecture, doc 11 on state ownership, doc 12 on which *Unreal type* each system uses. Doc 20 wins on *feature selection* — if a proposal re-implements something listed here, the proposal is rejected, not the stack.

---

## 1. The stack, bound to SILID

| # | UE5 system | SILID binding | Status | Fallback if it fails |
|---|---|---|---|---|
| 1 | **Enhanced Input** | `ASILIDPlayerController` — IA→command→owner flow; mappings built **in code** (no editor assets needed to compile/run) | ✅ live in slice (P2 exit gate proves it in-editor) | None needed — it is the standard path |
| 2 | **AI Perception** (sight + hearing) | `USILIDResidentController` config in C++; stimuli = `FSILIDNoiseEvent` bus + sight config. The AI-honesty law (doc 05) forbids any other information source | ✅ live in slice (P9 exit gate) | Hand-rolled perceiver only if AIPerception cannot meet a specific honesty rule — decision recorded in doc 12 deviations |
| 3 | **Behavior Trees + Blackboard** | AI decision layer. **Deferred M2+ migration** (doc 09 §6): the 13-state enum is honest and matches spec; BT/BB replaces it behavior-first, refactor-second — no hybrid period | ◐ designed, deferred | Keep the enum longer; BT migration is not a gate dependency |
| 4 | **NavMesh** | `NavMeshBoundsVolume` per map (README §3A); dynamic obstacles (doors/barriers) use nav modifiers | ◐ editor-configured per map (P9 gate) | Hand-written steering is **rejected** — nav gap is a blocker, not a workaround |
| 5 | **Nanite** | Statics/props/kit meshes from the art pass (doc 19 pass 2+). **Not** on: skinned characters, deform-interaction actors, low-poly collision proxies | ◐ editor feature, first used at M2 art pass | Non-Nanite LOD chain — geometry budget exists regardless (doc 03) |
| 6 | **Lumen** (+ VSM) | Lighting reality layer implementing the doc 10 recipe (warm hero source, true blacks). Lighting is gameplay: light state = power state (doc 05) | ◐ editor feature, budget-proven at M2 | VSM-only + emissive boost; darkness gameplay is unaffected |
| 7 | **Niagara** | Weather (doc 04), dust motes (doc 10), sparks/steam/water (doc 17 zones). VFX never owns authoritative state (doc 14 P25 gate) | ✅ module in `Build.cs` (private); content from P8 onward | Cascade/legacy only as last resort — not expected |
| 8 | **MetaSounds + spatial audio** | All audio through the doc 04 graph rules; per-surface footsteps, generator hum, AI vocal layer; `USILIDAudioDirector` ✅ already composes layers | ◐ director C++ exists ✅; MetaSound assets from P25 pass | Raw SoundCue fallback acceptable for one-off SFX, never for the director's layering |
| 9 | **World Partition / streaming** | The doc 03 house program and doc 17 zones: each zone = streamed cell set with its own nav/lighting/audio budgets; `DA_ZoneDef` is the data layer (doc 18) | ◐ designed; enabled when the large house builds (M3) | One-file-per-actor + manual level streaming — same zoning data |
| 10 | **Replication** (1–4 co-op) | Server-authoritative per doc 06; `ASILIDGameState`/`PlayerState` 🆕 (doc 12 §1); every ownership row in doc 11 §1 names its replication side | ◐ designed; live at P18–P21 (GATE D) | None — co-op does not ship without server authority (A-005) |
| 11 | **Gameplay Tags + Data Assets** | The architecture spine: `USILIDTags` ✅, `USILIDItemData` ✅, capability flags ✅, every 🆕 `PDA_/DA_` schema in docs 01/18. Adding content = adding rows, never C++ | ✅ live in slice | None — this *is* the data architecture (pillar 4) |

---

## 2. Module reality (from `Source/SILID/SILID.Build.cs`)

Current public deps: `Core, CoreUObject, Engine, InputCore, EnhancedInput, AIModule, NavigationSystem, GameplayTags, UMG, PhysicsCore`; private: `Slate, SlateCore, Niagara`. That covers **P0–P16 as written** — the frontier needs **no new modules**.

Additions arrive with their phases, one PR each, never speculative:

| Module | When | Why |
|---|---|---|
| `GameplayTasks` | BT/BB migration (M2) | BT task plumbing with AIModule |
| `Niagara` → public | P8 electricity VFX / M1.7 | C++ systems spawning gameplay-relevant VFX |
| `MetasoundEngine` (+ `AudioMixer`) | P25 audio pass | C++ control of MetaSound parameters |
| `ChaosVehicles` | M1.7 transportation prototype | Car/motorcycle physics tier (doc 18) — simplified tier stays on `PhysicsCore` |
| `PCG` | Art pass 5 (doc 19) | Clutter placement tooling |
| `SignificanceManager` | M3 perf work | R-013/R-014 mitigation (distance-based AI/VFX throttling) |
| `OnlineSubsystem*` | P18 only | Session layer per doc 06 topology |

---

## 3. Binding selection rules

1. **Engine feature before custom** — restated from overview §3 rule 1, now with teeth: re-implementing anything in §1's table is an architecture violation to be filed in doc 12's deviation ledger, not a stylistic choice.
2. **No second implementation.** When a UE5 system is adopted, the custom path it replaces is *deleted at migration*, not kept in parallel (BT/BB migration removes the enum driving logic; nothing keeps both).
3. **Rendering features are enableable, never load-bearing.** The game must run and pass gameplay gates with Nanite/Lumen disabled — they change *quality*, never *behavior*. Lighting-as-gameplay keys on power state, not on GI features.
4. **Every adoption has a fallback column.** A stack entry without a fallback is not ratified.
5. **Editor features still need proof gates.** Nanite/Lumen/World Partition claims are proven at their named gate on target hardware (doc 14 PENDING-COMPILE law) — "it's a UE feature" is not evidence (doc 15 §9).
6. **Engine version lock (R-004).** Target 5.4+, minimum 5.3 (README §2). Upgrades happen only between milestones, on an upgrade branch, with the regression harness run before merge — never mid-phase.

---

## 4. Proof gates per stack entry

| Entry | Proven at |
|---|---|
| Enhanced Input | P2 exit (movement/controller gate) |
| AI Perception + NavMesh | P9 exit (stimulus table in doc 14) |
| BT/BB | M2 AI refactor gate — behavior parity with the 13-state baseline required |
| Nanite/Lumen | M2 art/lighting budgets on target hardware (doc 03/19) |
| Niagara weather/dust | P8 (sparks) + M2 (weather) |
| MetaSounds | P25 audio pass attenuation/reverb gate |
| World Partition | M3 full-house traversal gate |
| Replication | P20 exit — two clients, one randomized run (GATE D) |
| Tags + Data Assets | Already proven in slice code; re-proven by the P16 validator consuming them |
