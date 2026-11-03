# 00 — SILID UE5: Overview & Vision

**Project:** SILID — realistic first-person survival-horror in an abandoned Filipino house.
**Platform:** PC first (UE 5.4+); other platforms later.
**Team:** One developer. No dedicated artists, animators, sound designers, or multiplayer programmer.
**Status of this doc set:** the production blueprint. The C++ vertical slice in `ue5/Source/SILID/` is phase-1 code-complete against it.

---

## 1. One-paragraph vision

SILID is a closed, interconnected, **believably Filipino** house that the player must survive, restore, and escape — with a power chain (generator → fuel → fuses → breaker → rooms → devices), a security layer (CCTV, sensors), an honest AI stalker that only knows what it can see and hear, dynamic weather, and 1–4 player server-authoritative co-op. The game must feel like one real place built by a professional team, achieved by one developer through disciplined reuse of Unreal systems and licensed assets.

## 2. The five pillars

1. **It is one real house.** Consistent architecture, materials, weathering, scale, and light. No floating props, no style clashes, no asset-flip reads.
2. **Power is the game.** Most of the house is dead until the player restores the electrical chain; restoring it changes AI, security, and safety — both ways.
3. **The AI is honest.** It perceives sight + sound only (AI Perception). It never teleports behind you, never knows your position, never cheats. Fear comes from believability.
4. **Everything is data.** Items, rooms, objectives, story beats, difficulty, spawn tables — all Data Assets / DataTables / Gameplay Tags. Story, characters, enemy identity, objectives, and endings are replaceable without touching systems.
5. **Solo-scalability.** Every expensive thing is bought, downloaded (legitimately), or generated; every system is a reusable component; every design decision is judged by "can one person maintain this?"

### The experience test (2026-09-28, request §70 — binding)

SILID is evaluated **as a complete commercial game, not a collection of features.** Every major system must create **gameplay, information, risk, choice, or consequence** — the house must feel like a real place, objects real, the player physically present, the enemy intelligent, darkness dangerous, sound informative, discoveries meaningful, and electricity/water/vehicles/tunnels/randomization must each change how a run plays. If a feature does none of these things, it is reconsidered — no matter how impressive it looks. This test is applied at every phase gate (14 §2's done-definition), at the §12 location quality gate (19), and at the P30 release audit — it is a gate, not a suggestion.

## 3. Solo-dev decision rules (binding)

These rules restate spec §28 and apply to every future decision:

| Priority | Rule |
|---|---|
| 1 | If **Unreal** already provides it (Nanite, Lumen, VSM, World Partition, Chaos, Niagara, MetaSounds, Enhanced Input, AI Perception, BT/BB/NavMesh, AnimBP, Control Rig, SaveGame, replication), use the engine feature. Do not re-implement. |
| 2 | If a **legitimately licensed asset** solves it, buy/download it. Time is the scarcest resource. |
| 3 | If a **reusable Blueprint/C++ component** generalizes it (door, drawer, pickup, repairable…), build it once, configure many. |
| 4 | Only build **custom** what is *irreplaceable* (SILID's electricity chain logic, AI honesty rules, escape-route grammar). |
| 5 | Never hire. If a gap is truly unfillable, **cut or re-scope the feature** — see §7 below. |

### Anti-"asset flip" integration checklist (spec §27)

An asset only ships if it passes all of these:

- [ ] Material re-pointed to project master materials (§03 doc), tints/weathering consistent
- [ ] Scale verified against the 1u = 1cm grid and door/wall modules
- [ ] Lighting reacts correctly (Lumen GI + VSM; no baked-lighting mismatch)
- [ ] Collisions rebuilt or verified (trimesh for statics, simple for interactables)
- [ ] Audio attached through the project's MetaSound/attenuation system, not raw
- [ ] Naming convention followed (`SM_`, `SK_`, `M_`, `MI_`, `T_`, `NS_`, `PDA_`, `BP_`)
- [ ] Ledger entry exists in `ue5/docs/07-asset-licenses.md`

## 4. Core loop

**Enter → scout → restore power/water → find route requirements (keys/tools/components) → avoid or misdirect the Resident → escape via any unlocked route.**

Power restoration is both progress and threat: lights help you and help the AI see you; CCTV helps you and can be spotted/destroyed; the generator is loud.

## 5. Modes

| Mode | Status in plan |
|---|---|
| Single player | Complete, self-balancing experience (spec §21) — ships first |
| Private co-op (1–4) | Designed-in from day one (spec §20); server-authoritative |
| Online co-op | Same code path, dedicated/listen server, later phase |
| Public matchmaking | Optional, last; never blocks single-player |

## 6. What "replaceable story" means operationally (spec §25)

- Systems speak **Gameplay Tags and capability flags only** — no C++ string mentions of story nouns.
- All narrative text (notes, subtitles, objective wording, ending texts) lives in `PDA_StoryEntry` / `DA_Story` data assets keyed by tag, not in widgets or code.
- Character visuals are mesh/anim-set swaps behind `BP_SILIDCharacter` (§02 doc); enemy identity is a data-configured AI profile (§05 doc).
- Objectives and endings are rows in `DA_Objectives` / `DA_Endings`; the escape-route grammar (`ASILIDEscapeRoute`) already accepts any key tag / tool flags / component tags / prerequisite route — a designer changes the game without code.

The existing web-game build and the C++ slice already follow this rule (capability flags, tag-driven locks, data-driven room mutations). This doc set extends it to the full production.

## 7. The "no staff" fallback ladder

When something cannot be sourced or built solo, descend in order:

1. **Re-scope** — does the game lose anything essential without it? Usually no.
2. **Buy the asset** (Fab / Reallusion content / animation packs).
3. **Generate** — MetaHuman, procedural tools, Control Rig post-process, PCG.
4. **Simplify** — a static prop instead of a physics dress-up, a 2-state light instead of 6-state.
5. **Cut** — and record it in the roadmap's cut list with a one-line reason.

## 8. Doc index

| Doc | Contents |
|---|---|
| [01-architecture.md](01-architecture.md) | Module map, class/component framework, data-asset schemas, Gameplay Tags |
| [02-characters-animations.md](02-characters-animations.md) | MetaHuman/Reallusion pipeline, AnimBP/Control Rig, replaceable-mesh contract, Blender animation-pipeline role (§4a) |
| [03-environment-materials.md](03-environment-materials.md) | Modular kit sourcing, Filipino identity props, material system |
| [04-audio-vfx-lighting.md](04-audio-vfx-lighting.md) | MetaSounds, Niagara weather, Lumen/VSM lighting plan, day/night gameplay weight, seasons, wildlife |
| [05-systems.md](05-systems.md) | Electricity, water (+ failure states), security, AI (honesty law + director note), physics-noise, difficulty, injury/status design (§9), save |
| [06-multiplayer.md](06-multiplayer.md) | Server-authoritative 1–4, replicated state, solo adaptation |
| [07-asset-licenses.md](07-asset-licenses.md) | Verified 2025 licensing facts + per-asset ledger template |
| [08-roadmap.md](08-roadmap.md) | Solo-dev milestones, cut list, web-game → UE5 port map |
| [09-implementation-architecture.md](09-implementation-architecture.md) | **Canonical** implementation architecture — wins over other docs on conflict |
| [10-mood-reference.md](10-mood-reference.md) | "AFRAID" target atmosphere + fear-state pipeline + the darkness-floor law (§5) |
| [11-ownership-dependency.md](11-ownership-dependency.md) | **Canonical** ownership/dependency law — one owner per state; verified compliance table + fix list |
| [12-ue-implementation-boundaries.md](12-ue-implementation-boundaries.md) | **Canonical** Unreal type map — which UE class implements what; subsystem boundary corrections |
| [13-build-order.md](13-build-order.md) | **Canonical** build order — 22-phase ladder vs. slice status; vertical-slice-first law; current frontier P7→P8→P13→P16 |
| [14-exit-gates.md](14-exit-gates.md) | **Canonical** proof contract — deliverables + exit gates, five major gates A–E, gate-report format + current status |
| [15-risks-assumptions.md](15-risks-assumptions.md) | **Canonical** risk register (single source of truth) — actions, triggers, evidence rules + assumptions |
| [16-risk-governance.md](16-risk-governance.md) | (retired — consolidated into 15) |
| [16-risk-changelog.md](16-risk-changelog.md) | The register's append-only change log + dashboards |
| [17-expanded-world.md](17-expanded-world.md) | Expanded property/transportation program — **design-only, gated** (M1.5 + M1.7); absorbed the 2026-09-28 request's area lists (30–50 areas, attic, basement complex, tunnel network + access-gate table) |
| [18-vehicle-data-schemas.md](18-vehicle-data-schemas.md) | Vehicle/zone data schemas + the four run configurations + per-run escape flavors — **design-only, gated** |
| [19-art-direction.md](19-art-direction.md) | **Canonical art bible** — quality laws, pass pipeline, measurement standard, PCG dressing law (§4a), structural-systems realism (§6), quality gate, **Blender custom-asset pipeline (§13)** |
| [20-tech-stack.md](20-tech-stack.md) | **Canonical UE5 stack** — confirmed engine systems bound to SILID implementations, with fallbacks and proof gates |
| [21-first-editor-session.md](21-first-editor-session.md) | The ordered first editor session — compile, P0/P2/P9 gates, and the report templates that upgrade PENDING-COMPILE to evidence |

