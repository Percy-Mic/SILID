# 13 — Build Order (canonical)

Strict dependency-aware sequence: **build the vertical slice first, prove the loop, only then scale.** The most important milestone is *not* the large house — it is **a small, complete, replayable, randomized SILID run playable from beginning to escape.** If the slice is not fun and reliable, do not expand to 40 rooms; fix the foundation.

**Precedence:** docs 09 (architecture) · 11 (ownership) · 12 (Unreal types) define *how* things are built; this doc defines **when and in what order**; doc 14 defines **what counts as done** (deliverables + exit gates per phase). Deviation ledger continues (D1–D10 so far). **One structural note:** the slice was built build-vs-buy, so several later phases (AI, escape, randomization) already exist and are verified. The ordering law therefore applies to **new systems**; existing verified systems are *re-validated at their gate*, never rebuilt — but P7/P8 (tools/repairs/electricity) must not be skipped: they are the current build frontier before any further AI/weapon expansion.

**Failure law:** [doc 23](23-failure-solvability-rules.md) is the canonical solvability/failure contract — no run may ever be unwinnable through the game's own systems; its audit tracks the reject-before-play gate (A-015).

**Smallest playable target:** [doc 22](22-smallest-playable-scope.md) defines the SPS — the smallest real game (5 areas, one enemy, generator + escape loop). It is the practical scope fence for the P17 slice: build nothing larger until doc 22 §9 passes.

---

## 1. The 22-phase ladder → slice status

### P0–P8 (foundation → electricity)

| Phase | Acceptance gate | Status in slice |
|---|---|---|
| **P0** Project Foundation | Compile · launch · spawn player · KB/M + controller input · no fatal errors · intended folders | ✅ **Exists:** `SILID.uproject` (UE 5.4), module + deps, GameMode/PlayerController/Character, Enhanced Input built in code, `LogSILID`, native tags. **Added:** GameState/PlayerState skeletons (12 §1) + `Config/` defaults. **Remaining:** gamepad mappings, folder migration (12 §8) |
| **P1** Core Architecture | Interfaces/components/subsystem skeletons compile + attach; no circular deps; no god manager | ✅ **Mostly:** `ISILIDInteractable`/`ISILIDSaveable` full; Inventory/Health/Flashlight/NoiseEmitter components full; Randomizer/Save/Difficulty/GameInstance subsystems working. **Remaining:** Damageable/Usable/Repairable/PowerConsumer interface stubs (09 §4), Stamina/Equipment skeletons (D2), Run/Electricity/Objective/Validation/Noise skeletons (12 §3) |
| **P2** Player Controller | Walk/run/sprint/crouch/jump/look feel acceptable, KB+M and controller | ✅ **Exists** (speed curves, stamina, crouch toggle, code-built IMC). **Remaining:** gamepad; feel pass is subjective and must be played in editor |
| **P3** Interaction Framework | One code path interacts with door/drawer/switch/pickup — no per-type player code | ✅ **Exists** (focus trace → `ISILIDInteractable`; Door/Pickup/LightSwitch; prompts). **Remaining:** D10 event-driven prompt push; Drawer/Container test actors; `FSILIDInteractionContext` + priority/distance hooks (09 §4) |
| **P4** Items + Inventory | Find→pickup→see→use→drop→re-pickup→save | ✅ **Mostly:** ItemData/Pickup/Inventory (stack, save, drop, throw). **Remaining:** instance struct (09 §5), weight/rarity fields, the first 7 PDA items, inventory UI (HUD hooks exist) |
| **P5** World Interaction | Searchable small test environment; no full house | ◐ **Partial:** Door/HideSpot/Barrier/LightSwitch exist; Container/Drawer need the 09 §3 components |
| **P6** Player Survival | Damage/heal/downed/noise from multiple sources | ✅ **Mostly:** `ApplyDamage` request path, stamina, noise emit. **Remaining:** fall/trap/environmental damage sources wired, medical items, downed = co-op phase (06 §5) |
| **P7** Tools + Repairs | Tool used on compatible object; requirements from **data**, not player logic | 🆕 **Core new build:** RepairComponent + `FSILIDLockRequirement` evaluation (11 §5); capability flags already proven by the slice's barriers |
| **P8** Electricity + Generator | Generator→network→consumers react **automatically** through the subsystem; OFF/ON/damaged/fuse/fuel tests | 🆕 **Code-complete (PENDING-COMPILE, doc 14 §11–12):** `UElectricalSystemSubsystem` (node graph, source state machine, overload/breaker, fuse pressure, 1 Hz board), `USILIDElectricPoweredComponent` (tag registry, OnPowerChanged push), generator composed not subclassed, P7 OnRepaired seam, door/barrier/route power requirements, P16 validator `Machine.Power` extension. Remaining: the BP test network + DA_PowerGraph bootstrap (editor content, doc 21) |

### P9–P22 (AI → shipping)

| Phase | Acceptance gate | Status in slice |
|---|---|---|
| **P9** AI Perception | No magic knowledge; sight/hear matrix passes (visible/hidden/behind-wall/crouch; footstep/door/throw/generator) | ✅ **Exists & exceeds:** AI Perception sight+hearing + noise bus (13 states). **Re-validate at gate:** scripted perception matrix test — do not assume
| **P10** Enemy Behavior | Reacts to information, never coordinates | ✅ **Exists** (state machine). **P10.1 later:** BT/BB migration per 09 §6 — behavior-equivalence first, never mid-slice
| **P11** Hiding + Stealth | Not an auto-invisibility flag; enemy searches suspicious spots | ✅ **Exists** (HideSpot + seen-near search rule). Re-validate
| **P12** Weapons + Combat | Melee first, then firearms; limited ammo; meaningful noise | ◐ **Partial:** melee/throw/capability flags exist; weapon defs/recoil/ammo economy are new (09 §7). Keep survival-horror focus| **P13** Puzzles + Objectives | Objectives react to **events**, never manually completed | 🆕 **Objective fabric code-complete (PENDING-COMPILE, doc 14 §13–14):** `USILIDObjectiveData` rows + `USILIDObjectiveSubsystem` (story-tag ledger, tag-query + progress evaluation, event-only completion — GameMode escape delegate, `RepairComponent::OnAnyRepaired`, Electrical buses → `Story.*` tags), HUD objective line, raw-fact save seams. Safe/Radio/CodeLock puzzle types exist from the slice. Remaining: the six-type census + `DA_Story` rows (editor content) | **P14** Escape | ≥1 complete route playable | ✅ **Exists** (`ASILIDEscapeRoute` grammar: key/tool/component/prerequisite — matches spec exactly). Extend with garage/vehicle variants later
| **P15** Randomization | Small house first: deterministic loop BEFORE randomizing | ⚠ **Ordered inversion (the one divergence):** the slice randomizes already — but its contract matches the spec's end state (seeded, family pools, guaranteed-first, fairness, difficulty-scaled counts). Compensating control: deterministic loop is *proven* in the web build's non-random regression mode; UE5 must re-prove it in the P15 gate. **Do not extend randomization until P13's event-driven objectives exist** |
| **P16** Solvability Validation | Hundreds of seeds automated; invalid → regenerate; never start invalid | ◐ **Pure core landed (see note):** `SILIDSolvabilityTypes`/`Evaluator` (pure C++ fixpoint closure, supply ledger, structured failures), `USILIDSolvabilityValidator` subsystem (read-only extraction, per-seed draw, batch runner, execs), 200-seed automation harness — all PENDING-COMPILE. **Out-of-order note:** built at user directive ahead of P8/P13; the evaluator is content-agnostic, but the P16 *exit gate* re-runs after P8/P13 land so machines/objectives appear in the graph |
| **P17** Large House | 20–40 areas, modular, per-room passes | 🆕 After the slice loop is fun — the M2 gate (08 §1). **Spec §46 law: never skip the vertical slice** |
| **P18** Multiplayer | Ordered 15-step conversion (12 §29), 2-player test at every step | 📄 Design locked (06 doc §1–9); the authority map is already slice-shaped (server-only AI, server-validated requirements)
| **P19** Save/Load | Save→quit→reload→continue consistent | ✅ **Exists** (versioned payload, ISaveable, seed persistence). Extend: graph states + story flags; D6 GameInstance move
| **P20** Presentation | Assets/audio/lighting/weather/UI polish | 📄 Docs 02–04, 10; zone-by-zone loop (03 §5)
| **P21** Optimization | Profile first; fix real bottlenecks only | 📄 Budgets in 03 §7, 06 §7; acceptance in 08 M5
| **P22** Testing + Shipping | Release-candidate checklist (spec §45) | 📄 Validator stress (1,000+ seeds), AI stress, network stress gates live in 09 §8 + 06 §8

### The vertical-slice reconciliation (spec §46 vs. 08's M-ladder)

The spec's slice (5–8 rooms, 1 generator, 1 network, 1 enemy, 1 hiding system, 5–10 tools/items, 1 weapon, 1 puzzle, 1 randomized chain, 1 escape, complete run) **is** the existing slice's scope + the P7/P8/P13 gaps. Mapping: 08's M0 = P0/P1; M1 = P2–P8 on one floor; M1.5 (new, between M1 and M2) = **P13 objectives + P16 validator on the small house = the spec's "small complete loop" gate**; M2 = P17 house; M4 = P18. If M1.5 is not fun, fix foundation — do not build M2.

Every phase's full record follows the extended chain: PHASE → DELIVERABLES → DEPENDENCIES → RISKS → OWNERS → TARGET RESOLUTION → IMPLEMENTATION → TESTS → EXIT GATE (spec §18 template; owners/priorities/targets from doc 16 §3; reports in docs 14/16a).

## 2. Definition of done (every phase, spec §47)

IMPLEMENT → PLAY → TEST → DEBUG → VALIDATE → DOCUMENT. A feature is done only when: works in-game · respects ownership (11) · respects UE boundaries (12) · integrates with existing systems · no circular deps · testable · handles failure states (`FSILIDOperationResult`) · multiplayer-safe if applicable · save-safe if applicable · doesn't break randomization · no unjustified Tick · has debug visibility. Phase = playable + acceptance checked, never "it compiles."

## 3. The AI development rule (spec §48, binding on this assistant)

Never generate hundreds of files at once without testing. Cycle: define architecture → smallest functional unit → compile → run → test → fix → integrate → continue. If compilation fails, fix the current phase before adding another system; never stack unresolved systems on broken architecture. In this repo (no UE build available), the cycle is: **implement unit → self-review against docs 11/12 headers → fill feature-spec block (12 §9) → document gate**; compile/run happen at the user's editor session, one phase at a time.

## 4. Feature priority rule (spec §49, binding)

CORE GAMEPLAY > REQUIRED DEPENDENCIES > REPLAYABILITY > MULTIPLAYER > CONTENT > VISUAL POLISH. Fancy menus, cinematics, post-processing, decoration, and story scenes never take priority over broken interaction, inventory, AI, electricity, randomization, or solvability. **Integration-completeness law (2026-09-28, request §121):** a feature is not complete merely because it works by itself — it is complete when it works correctly with the rest of SILID. Every new system must connect (vehicle → fuel/electricity/inventory/tools/physics/sound/AI/objectives/escape; generator → electricity/lighting/CCTV/doors/water/AI/sound/objectives; tunnel → exploration/navigation/hazards/resources/enemies/puzzles/escape; weapon → inventory/ammunition/sound/AI perception/damage/physics/MP; weather → lighting/sound/visibility/AI/surfaces/atmosphere). Prioritize systemic interaction, emergence, replayability, and player choice over feature count. Concretely next: **P7 → P8 → P13 → P16**, then the M1.5 fun gate. (P7, P8, P13 delivered; P16's pure core delivered early by directive — remaining frontier: **P16's editor-side gate re-run**, then the M1.5 fun gate.) **Ruling reaffirmed 2026-09-28** (doc 16a entry): the 19-section request (Blender pipeline + 30–50-area house/basement/tunnels/vehicles + modular story) landed as *documentation/process* (docs 19 §13, 03 §2a, 07 §1a; area lists absorbed into 17/18 as design targets) — world expansion phases A–H (§5) stay gated on M1.5 + M1.7 (R-031), and story modularity stays as designed (data-driven objectives/`DA_Story`, §00 doc §6; no system rewrites). The request's randomization demands (§13–14: items move every run; invalid seeds rejected) are the **already-implemented** randomizer + P16 validator law — no change.

## 5. Post-slice expansion phases (doc 17 — GATED)

After the vertical slice (P17/M1.5) and the **M1.7 transportation prototype gate** (doc 17 §10), the expanded world builds in order: **A** house expansion (30–50 areas) → **B** exterior (yard/garden/shed/greenhouse) → **C** garage complex → **D** transportation (car/motorcycle/bicycle/skateboard) → **E** underground network → **F** railway + train → **G** world randomization (vehicle availability/requirements join the validator) → **H** multiplayer transportation. **GATE RULE (R-031): none of A–H starts until M1.5 passes; D–H additionally require M1.7.** Scope law unchanged: bigger world, not more rooms.

## 6. Final progression (spec §50, adapted)

EMPTY PROJECT ✅ → PLAYABLE CHARACTER ✅ → INTERACTABLE ROOM ✅ → INVENTORY ✅ (instance upgrade pending) → SEARCHABLE HOUSE ◐ → SURVIVAL ✅ (damage sources pending) → TOOLS ✅ (P7, PENDING-COMPILE) → GENERATOR/ELECTRICITY ✅ (P8, PENDING-COMPILE) → AI ✅ → STEALTH ✅ → WEAPONS ◐ → PUZZLES ✅ (P13 objective fabric, PENDING-COMPILE) → ESCAPE ✅ → RANDOMIZED RUN ✅ (validated-in-web) → **VALIDATED RANDOMIZED RUN 🔜** (P16 gate re-run is next) → SMALL COMPLETE LOOP ⏳ (the M1.5 gate) → LARGE HOUSE → MULTIPLAYER → STORY → ASSETS → AUDIO/LIGHTING/VFX → OPTIMIZATION → SHIPPING. ✅ = verified or re-validate at gate · 🔜 = current frontier · ⏳ = the gate that decides everything after it.

## 7. The 25-prompt spec — reconciliation matrix (2026-09-28)

The 25-prompt request (enemy AI → stealth → physics → audio → lighting →
dressing → puzzles → electricity/water → vehicles → events → run director →
co-op → polish) is recorded in doc 16a with per-prompt dispositions.
Summary vs. the ladder — **no reordering resulted** (R-018):

| Request prompts | Ladder / gate home |
|---|---|
| Advanced enemy AI · dynamic director · stealth · hiding duration | P9/P10/P11 gate re-proofs (05 §5 law + difficulty profiles); director pacing = post-M1.5 data extension |
| Physics & interaction · search & discovery · camera/first-person | P5/P12 content + P26 UI (09 §3/§5, 19 §10, 02 §4/§5) |
| Horror audio · dynamic lighting/darkness | P25 pass (04 §1/§4 complete) + M2 budgets; darkness-as-gameplay already binding |
| Procedural house dressing | Art pass 5 (19 §4a — PCG rulesets per room type; module ratified 20 §2) |
| Puzzle generation · run director/replayability | Data authoring over LANDED systems (P7 rows + barriers + randomizer + P16 validator) |
| Generator & electricity | LANDED P8 (PENDING-COMPILE) — the three chains are DA_PowerGraph rows |
| Water & plumbing | 05 §3 design (+ new failure states) — post-slice build |
| Vehicle/train repair | M1.7-gated (17 §5, 18 §1–3) |
| Inventory/equipment · injury & survival · dynamic events | P4/P6 instance+equipment upgrades; 05 §9 injury block (post-M1.5); RoomDirector events |
| Animation pipeline | 02 §4 (+ new §4a Blender role) |
| Multiplayer co-op | P18 (GATE D) — 06 doc design unchanged |
| Save/recovery · UI/UX · storytelling · AAA polish gate | P19/P22/P23/P26/P30 rows; polish gate already binding (19 §12) |

The M1.5 fun gate remains the only door to everything after it.

## 8. Prompt library 26–70 (2026-09-28) — pointer

The second prompt batch (living house, house-state, destruction, enemy
memory/learning/archetypes/ecosystem/territory, noise propagation,
surface footsteps, weather/day-night/seasons/wildlife, tunnels identity,
flooding, fire, security, phones/cameras, inspection/combination/
crafting, traps, dynamic escapes, death/capture, item economy,
risk/reward, secrets, environmental puzzles, objectives, procedural
story, endings, accessibility, photo mode, debug toolkit, automated
seed testing, perf budgets, asset consistency, Blender pipeline, asset
library, the "real game" test) is ruled in doc 16a with all 45
per-prompt dispositions. New design rows landed: 05 §5.2 (memory &
learning) + §10a–d (enemy archetypes/ecosystem, fire, crafting/combos,
capture), 19 §9 (content taxonomy) + §10 (damage states), 04 §3
(day/night gameplay weight, seasons, wildlife), 00 §2 (the experience
test — binding). Enemy-facing systems deliberately wait for the BT/BB
migration (M2); everything else activates at its existing gate. Frontier
unchanged: P16 editor-side gate re-run → M1.5.

## 9. Dependency-graph prompt + prompts 73–121 (2026-09-28) — pointer

The third batch (systemic horror, tension pacing, safe zones, player
knowledge/maps/markings, search memory, containers, semantic placement,
interaction/hands/weight/durability/tools, evidence, chases, non-lethal
play, scarcity, optional objectives, rescue/NPC, MP proximity/authority,
streaming, verticality, landmarks, contrast, silence/music, cinematics,
the anti-procedural law) is ruled in doc 16a with all dispositions.
The lead dependency-graph prompt IS the landed P16 validator. New laws
landed: 09 §12 (semantic placement + the anti-procedural law), 05 §5.2
(evidence investigation) + §10e (safe zones/pacing/NPCs) + §10f (knowledge/maps/markings/search memory), 04 §3 (tension arc + silence
law), 02 §5 (cinematic law). MP prompts stay doc 06 design; enemy-facing
rows ride the BT/BB migration (M2). Frontier unchanged: P16 editor-side
gate re-run → M1.5.

## 10. Prompts 71–121, second list (2026-09-28) — pointer

The fourth batch (movement/hands/body-awareness, fear/stress, horror
direction + no-cheap-jumpscare, encounter pacing, carrying/two-handed,
enemy weaknesses, emergent/systemic chains, seed replay, ghost/replay
debug, AI simulation, MP proximity/authority, modularity/mod support,
visual QA, mirrors/CCTV framing, NG+/endless modes, the integration-
completeness law) is ruled in doc 16a with all dispositions. New rows:
04 §3 (horror direction law + never-list), 02 §4/§5 (contextual
montage variants + body awareness), 09 §5 (physical-carry classes) +
§10 (ghost/replay tape), 13 §2 (integration-completeness law). Already
landed from prior batches: safe zones, knowledge/maps, silence law,
NPC/rescue, server authority, anti-procedural law. Frontier unchanged:
P16 editor-side gate re-run → M1.5.
