# 16a — Risk Change Log (append-only)

The **[15-risks-assumptions.md](15-risks-assumptions.md)** register's append-only log: one dated entry per risk status change, phase risk review, gate report, or dashboard. Never rewrite history — append. (Doc 16 is retired/consolidated into 15.)

---

## 2026-09-27 — Baseline registration (governance established)

Register created (doc 15 §1) with in-repo bindings; governance rules adopted (doc 16). Initial statuses recorded from code/doc audits, not optimism. Owner of all roles: the solo developer (Tech Architect / Gameplay / AI / Procedural / Multiplayer / World / Content / Audio / Performance / QA / Release).

```
SILID RISK DASHBOARD — 2026-09-27 (baseline)
CRITICAL OPEN: 0      HIGH OPEN: 4 (R-004, R-009, R-013, R-015)
OVERDUE: 0            BLOCKING: 1 (R-007 → GATE C / P15-P16)
MITIGATING: 22        MONITORING: 3 (R-012, R-024, + R-013 shared)
ACCEPTED: 0           RESOLVED: 0   (none yet — no gate has run in editor)
```

**Top active risks:**

| ID | Owner | Impact | Due | Current mitigation | Blocking |
|---|---|---|---|---|---|
| R-007 | Procedural Owner | CRITICAL | Before P16 exit | Validator design locked (09 §8); reject-and-regenerate | **YES — GATE C** |
| R-018 | Technical Architect | CRITICAL | Continuous | Feature priority law (13 §4); gate-gated production entry | No |
| R-019 | Gameplay Systems | CRITICAL | Before Large House | Vertical-slice-first law; M1.5 fun gate | No |
| R-005 | Technical Architect | CRITICAL | Before dependent phase | Ownership/layer audits done (11, 12); review checklist binding | No |
| R-025 | Release Owner | CRITICAL | Before every RC | Recurring package test from P17 (14 P27) | No |

**Next review:** at P7 phase start (next phase per doc 13 §4 frontier).

---

<!-- ENTRIES BELOW -->

## 2026-09-27 — Register upgraded to controlled-risk format (prevention/mitigation actions + triggers + minimum evidence)

Spec alignment: every risk now carries executable prevention + mitigation actions (doc 15 §4), measurable triggers (§6), minimum evidence for the five critical risks (§7), phase-gate review steps (§8), feature/change-impact record formats with rollback plans (§9), and the AI-agent evidence rule — never resolve a risk because code compiles (§10). Consolidation into doc 15 completed per the single-source-of-truth law; doc 16 retired to a stub.

Status changes: none (baseline statuses stand). Evidence positions: all RESOLVED claims remain blocked on editor-run proof (doc 14 PENDING-COMPILE law). R-007 remains BLOCKING GATE C — its action protocol (PREVENT-R-007-01/MITIGATE-R-007-01) is now fully specified in doc 15 §4; the blocker lifts only on the 1,000-seed evidence report.

Next review: P7 phase start (frontier unchanged: P7 → P8 → P13 → P16).

---

## 2026-09-27 — AI-agent pre-implementation check: Expanded World / Transportation spec (doc 17)

Per doc 15 §10 — inspected architecture (09/12), ownership (11), dependencies, active risks, assumptions, current phase (13), exit gates (14).

```
Feature: Expanded world — property zones, garage complex, car/motorcycle/train,
          underground network, railway, transportation escape routes
Owner: WORLD/LEVEL OWNER (zones/rooms) + GAMEPLAY SYSTEMS OWNER (vehicle state)
Affected Systems: escape routes, noise bus, randomization, electricity (garage/
          railway circuits), water (well→pump chain), objectives, save, multiplayer,
          AI hearing, world partition streaming
Dependencies: P8 electricity, P13 objectives, P14 escape grammar, P16 validator
          — ALL PRE-EXISTING; no core system needs rewriting (spec §27 verified
          against escape-route grammar, noise bus, tag registries, zone data)
New Risks: R-031 WORLD-CONTENT EXPANSION AHEAD OF PROVEN LOOP (P0, BLOCKING for
          phases A–H) — full register row in doc 15 §3
Existing Risks Affected: R-001/R-019 (scope law), R-014/R-026 (perf budgets scale
          to property), R-023 (vehicle state replication), R-008/R-009 (vehicle
          placement/availability pools join the validator)
Assumptions: A-026 vehicle escape integrates via existing escape grammar —
          UNVALIDATED, prototype gate before any expansion (spec §29)
Target Resolution: R-031 holds until M1.5 fun gate PASSES (doc 14 GATE B)
Tests Required: transportation prototype loop (spec §29 chain) as a 14-doc
          gate; vehicle noise→AI-hearing assertion; vehicle availability
          randomization in validator seed tests
Proceed: YES — authoring documentation/data designs ONLY (doc 17). NO
          implementation of phases A–H until M1.5 passes. Frontier UNCHANGED:
          P7 → P8 → P13 → P16.
```

New register row R-031 recorded in doc 15 §3 (status MITIGATING — mitigation is
the governance ruling itself + the prototype gate).

---

## 2026-09-28 — Technology stack ratified (doc 20)

The confirmed UE5 stack (Enhanced Input, AI Perception + BT/BB, NavMesh, Nanite,
Lumen, Niagara, MetaSounds/spatial audio, World Partition, replication,
Gameplay Tags + Data Assets) is now a binding doc, not a recurring question:
per-feature SILID bindings, Build.cs module plan (frontier needs zero new
modules), selection rules (engine-feature-before-custom with deviation-ledger
enforcement; no parallel implementations; rendering enableable-never-load-bearing),
fallbacks, and proof gates per feature.

No risk status changes. Reinforces R-004 (engine lock: 5.4+ target, milestone-
gated upgrades) and R-005 (re-implementing a ratified entry = architecture
violation). Frontier unchanged: P7 → P8 → P13 → P16.

---

## 2026-09-28 — First-editor-session checklist published (doc 21)

The operational bridge for clearing the PENDING-COMPILE ledger: an ordered,
~4–5 hour session procedure (compile → P0 scratch gate → doc-19-measured
blockout map → actors/data/HUD → the 10-row P9 AI-honesty matrix) ending in
three fill-in gate reports in doc 14 §34 format. Doc 14 §6 rule 2 now names
doc 21 as the procedure.

R-025 (packaging/build failure, P0) prevention gets its first concrete
execution: Stage 1's clean-solution compile is the recurring-build discipline
starting at the source level. No status changes; R-007 remains BLOCKING
GATE C. Next review: P7 phase start — or immediately after the first editor
session if its P9 report yields failures (frontier returns per doc 14 §6
rule 3).

---

## 2026-09-28 — AI-agent pre-implementation check: P7 Tools & Repair

Per doc 15 §10 — inspected architecture (09 §3), ownership (11 §1: inventory
API-only mutation, damage-as-request, emit-don't-search), Unreal boundaries
(12 §6 structured results, §9 feature-spec format, §11 acceptance bar),
risks, assumptions, current phase (13: P7 is the frontier), exit gates (14
P7 deliverables).

```
Feature: P7 repair system — USILIDRepairComponent + ISILIDRepairable +
          data-driven requirement rows
Owner: GAMEPLAY SYSTEMS OWNER
Affected Systems: inventory (read/consume via API only), noise bus (work is
          loud), save payload (replay-based restore), objectives/validator
          (consume OnRepaired downstream), P8 electricity (first consumer)
Dependencies: existing interaction spine, capability queries, item registry
          — all pre-existing; zero new Build.cs modules (doc 20 §2)
Affected Risks: R-005/R-027 (contained: composition, no new coupling),
          R-016 (save-safe: replay restore never bakes requirement config),
          R-008 (repair requirements join validator sets at P16)
New Risks: none — additive interface with default impls; existing 20+
          implementors untouched
Assumptions: none new; work rhythm reuses the barrier's proven hit-loop law
Target Resolution: Before P7 exit gate (doc 14)
Tests Required: doc 14 P7 chain in editor (tool→inspect→correct tool→consume
          →functional), wrong-tool/missing-component failure codes, save/load
          persistence, repair noise heard by Resident
Proceed: YES — code deliverables only; gate remains PENDING-COMPILE until
          the editor session proves the chain (doc 14 §6 rule 2)
```

---

## 2026-09-28 — AI-agent pre-implementation check: P16 validator + expanded-house request ruling

Per doc 15 §10. Two requests this turn: "expand the house" and the P16 validator.

```
Feature A: Expand the house (expanded-world content)
Ruling: NO IMPLEMENTATION — doc 17's phases A–H remain gated on M1.5 (doc 13
          note; R-031 MITIGATING). Redirected to the gate that opens them.
Feature B: P16 USILIDSolvabilityValidator as pure C++ (docs 09 §8, 12)
Owner: PROCEDURAL/RANDOMIZATION OWNER
Affected Systems: randomizer (laws mirrored, never invoked), GameMode
          (seed acceptance), P7 repair components (requirement extraction),
          P8/P13 (machines/objectives enter the graph at their gates)
Dependencies: none new — pure C++ per doc 12 mandate; no new modules
Affected Risks: R-007 (PRIMARY — this IS its prevention action
          PREVENT-R-007-01), R-008/R-009 (validation grounds placement),
          R-028 (structured failure detail = the debugging tool)
New Risks: none. Out-of-order build (P16 before P8/P13) accepted: evaluator
          is content-agnostic; gate re-runs after P8/P13 (doc 13 note)
Assumptions: A-014 determinism (asserted per seed in the harness),
          A-015 solvability (the subsystem's purpose)
Target Resolution: Before Phase 16 Exit — the R-007 blocker lifts only on
          the 1,000-seed evidence report (doc 15 §7)
Tests Required: SILID.Validator.PureEvaluator.Basics;
          SILID.Validator.SeedBatch.100Plus (200 seeds, evidence +
          determinism); real-map SILID.ValidateSeeds in-editor
Proceed: YES (B, code deliverables only — PENDING-COMPILE) /
          NO for A (gated, design already locked in doc 17/18)
```

Note: R-007 status remains MITIGATING/BLOCKING-GATE-C — the mechanism now
exists in code, but doc 15 §9's evidence rule (hundreds/thousands of seeds
validated) requires the editor/CI runs before any status change.

---

## 2026-09-28 — AI-agent pre-implementation check: P8 Electricity (generator → fusebox → breaker → tag-registered consumers)

Per doc 15 §10 — inspected architecture (09 §3 composition law, 01 §4
`DA_PowerGraph` rows, 01 §5 `Power.Node.*` tags, 01 §6 the ElectricalSystem's
1 Hz board-tick allowance), ownership (11 §1: power distribution owned by
`UElectricalSystemSubsystem`, subsystem API only, per-node state events),
Unreal boundaries (12 §1 WorldSubsystem type map, §4 registration contract,
§6 structured results, §9 feature-spec format, §10 dispatcher discipline),
stack (20 §2: zero new modules), risks, assumptions, current phase (13 §4:
P8 is the frontier; P7 landed, P16 pure core landed early by directive),
exit gates (14 P8: OFF→repair→ON with **automatic** consumer response;
single authoritative power owner).

```
Feature: P8 electricity — UElectricalSystemSubsystem (WorldSubsystem,
          tag registry, per-circuit node tree, load/breaker model, 1 Hz
          board) + USILIDElectricPoweredComponent (consumer component,
          OnPowerChanged) + USILIDGeneratorComponent (source state machine:
          Off→NoFuel→NeedsRepair→Fueled→Running) + additive power
          requirements on door/barrier/escape-route/repair + validator
          extraction extension (power chain joins the P16 graph)
Owner: GAMEPLAY SYSTEMS OWNER for electrical state — the subsystem is the
          SINGLE authoritative owner (doc 11 §1); components own nothing
          but their registration + reaction
Affected Systems: P7 repair (OnRepaired is the generator's fix input),
          noise bus (start/failed-start/breaker events — risk/reward baked
          into restore attempts per doc 05 §2), save payload (generic maps,
          replay-safe), P13 objectives (consume OnPowerStateChanged later),
          AI (lit-rooms-boost-sight hook now, tuning at P9 gate), P16
          validator (machines/consumers enter the graph at this phase)
Dependencies: registration law (12 §4), FSILIDOperationResult, SILIDTags,
          repair component, noise emitter — all pre-existing; zero new
          Build.cs modules (doc 20 §2)
Affected Risks: R-005/R-027 (contained: tag registry + components, no hard
          refs — a new powered prop needs zero subsystem changes per doc
          12 §11), R-016 (save-safe: generic Flags/Counters keyed by node
          id), R-007/R-008 (validator graph gains the power chain — the
          spec's electricity protocol, doc 15 §5, validates dependencies
          BEFORE gameplay), R-013 (single 1 Hz board tick — the one new
          tick, explicitly allowed by doc 01 §6)
New Risks: none new — P8's risk was pre-registered (the electricity
          protocol in doc 15 §5)
Assumptions: A-017 (systems have real consequences — automatic consumer
          response IS this phase's gate), A-018 (electricity is a reusable
          tag-registry system — the design being implemented)
Target Resolution: Before P8 exit gate (doc 14)
Tests Required: doc 14 P8 chain in editor: generator start → fusebox →
          breaker → rooms/devices react automatically; overload trips the
          breaker after grace; fuse replace restores; brown-out flicker at
          low condition; failed start = sputter noise (smaller radius);
          save/load restores graph state; powered-locked door/route open
          only with power
Proceed: YES — code deliverables only; gate remains PENDING-COMPILE until
          the editor session proves the chain (doc 14 §6 rule 2)
```

Scope note: generator/fusebox ACTORS stay Blueprint shells (doc 09 §3
composition law — no generator-specific C++ actor class). Also recorded:
pre-implementation reading surfaced a latent P16 compile defect —
`SILID_LOG/WARN/ERROR(LogSILID, …)` call sites pass a category first while
the current macros bake `LogSILID` in. Fixed this pass by adding the doc 12
§5 per-category macros (additive; old call sites keep compiling).

---

## 2026-09-28 — AI-agent pre-implementation check: 19-section spec (Blender pipeline + expanded house/basement/tunnels/vehicles + survival story)

Per doc 15 §10 — inspected architecture (09), ownership (11), boundaries
(12), stack (20), build order (13), gates (14), risks (15), and the
existing design-only docs (17/18) the request overlaps.

```
Feature: 19-section request — Blender-centered realistic asset pipeline;
          anti-primitive quality bar (REAL OBJECT → REAL MATERIAL → REAL
          CONSTRUCTION → REAL WEAR → REAL INTERACTION); licensed-asset mix
          (Fab/Megascans/MetaHuman/Poly Haven, ledger enforced); house
          expansion to 30–50+ areas (attic as a full gameplay area);
          greatly expanded basement complex; large original tunnel network
          (gameplay-relevant, gated by tools/power/debris); multiple escape
          routes per run; property + vehicle/railway system; original
          Granny-genre-structure story (explicit no-copy of Granny
          characters/map/assets); modular replaceable story; survival-
          first decision loop; per-run item randomization; guaranteed-
          solvable randomization; lived-in rooms + environmental
          storytelling; professional UE5 presentation; staged expansion
          (vertical slice first, then 17-step expansion order)
Owner: NO implementation owner this turn — ruling splits the request:
          documentation/process owners act now; world content owners wait
          for the gates
Affected Systems: docs 03/07/19 (pipeline, quality bar, licensing), docs
          17/18 (area lists as design targets, reaffirmed gated), doc 13
          (stage order reaffirmed), doc 09 §9 + doc 01 §4 (story
          modularity — already designed as DA_Story/DA_Objective data).
          NO core systems touched; zero code changes for the world/story
          portions of the request
Dependencies: governance only — R-031 (doc 15 §3) + doc 17's status gate
          already cover the expansion request; M1.5 fun gate (doc 14
          GATE B) and M1.7 transportation prototype (doc 17 §10) are the
          preconditions for world content
Affected Risks: R-031 (PRIMARY — this request is precisely the scope pull
          R-031 exists for; the gate ruling is re-issued, status stays
          MITIGATING), R-018/R-019 (priority + scope law: slice first,
          fix-the-foundation-not-expand), R-007 (spec §14's solvability
          demands are ALREADY the P16 validator's law — implemented,
          PENDING-COMPILE; 1,000-seed evidence still owed), R-009
          (expansion spawn pools join the validator later), R-014/R-026
          (expansion perf budgets activate with phases A–H, not before)
New Risks: none — no new risk class; every section of the request maps
          onto an existing registered risk or an existing design doc
Assumptions: A-015 (validator guarantees solvable runs — spec §14 is its
          acceptance contract), A-026 (vehicle escape via the existing
          escape grammar — proven at M1.7), story-modularity already
          carried by pillar 4 + doc 00 §6 (systems speak tags/capability
          flags only)
Target Resolution: world-expansion gates lift at M1.5 + M1.7; the Blender
          pipeline + quality-bar documentation lands immediately (docs are
          the deliverable this turn); P13 objectives remain the code
          frontier (it is the event-driven core the story data hangs on)
Tests Required: none new this turn (no code). Unchanged future tests: doc
          14 gate chains, M1.7 loop proof, P16 gate re-run after P13,
          R-007's 1,000-seed evidence report
Proceed: YES — documentation/process only (docs 19/03/07/17/18/13 +
          README/00 indexes, plus P13 per the standing frontier). NO —
          implementation of house/basement/attic/tunnel/vehicle/railway
          content until M1.5 PASSES + M1.7 prototype (R-031). NO — story
          system rewrites: modularity already designed (doc 09 §9, doc 01
          §4; DA_Story/DA_Objective); the story data assets will be
          authored as CONTENT at the story milestone. Frontier
          UNCHANGED: P13 → P16 editor-side gate re-run → M1.5.
```

Section disposition (all 19 sections of the request, so nothing is lost):
§1–3 Blender pipeline + quality bar + licensed mix → docs 19 §13, 03 §2a,
07 §1a (this turn). §4 house 30–50/attic → doc 17 §3 absorbs the area
lists (design-only; doc 03 §1 keeps 40–50 with the property program).
§5 basement complex → doc 17 §3 basement row extended. §6–7 tunnel network
+ gameplay relevance → doc 17 §7 extended (access-gate list matches the
existing barrier/repair/escape/power grammar). §8 multiple escape routes →
already implemented (`ASILIDEscapeRoute` grammar + validator guarantee);
new flavors recorded in doc 17/18 tables. §9 vehicle/railway → doc 17 §5/
18 §1–6 unchanged, gated (M1.7). §10–11 original + modular story → doc 00
§6 / doc 01 §4 / doc 09 §9 reaffirmed; no rewrite. §12 survival loop →
pillars/roadmap unchanged. §13–14 randomization + solvability →
randomizer + P16 validator already enforce; noted in doc 13. §15–16
lived-in + environmental storytelling → doc 19 §4–§5 recipes already
binding. §17 presentation → doc 20 stack binding already covers. §18
staged expansion → doc 13 §5 phases A–H re-affirmed, gate rule restated.
§19 quality standard → doc 19 §12 quality gate already binding.
Frontier note: P13 (ObjectiveSubsystem per doc 09 §9, consuming P7/P8
delegates) proceeds this turn as planned — it is the system the modular
story data plugs into.

---

## 2026-09-28 — AI-agent pre-implementation check: P13 Puzzles + Objectives (objective fabric)

Per doc 15 §10 — inspected architecture (09 §9 verbatim design), ownership
(11 §1: objectives row; upward events only), boundaries (12 §1 WorldSubsystem
type map, §4 registration, §5 logging, §9 feature-spec format, §10
event/tick discipline), stack (20 §2: zero new modules), risks, current
phase (13 §4: P13 is the frontier after P8), exit gates (14 P13:
event-driven objectives, never manual completion).

```
Feature: P13 objective fabric — USILIDObjectiveData rows (tag-query +
          progress schema per 09 §9) + USILIDObjectiveSubsystem (story-tag
          ledger, event-only evaluation) + RepairComponent::OnAnyRepaired
          component-static + Story.* native tags + HUD objective push +
          save seams (raw facts, replayed activation)
Owner: GAMEPLAY SYSTEMS OWNER for objective state — the subsystem is the
          single authoritative owner of active/completed/failed sets,
          progress, and the ledger (doc 11 §1 row now verified code)
Affected Systems: P7 repair (static fabric broadcast added — additive,
          fires after OnRepaired), P8 electricity (its buses are consumed,
          zero changes to that subsystem), GameMode (HUD objective push +
          existing OnEscapeReached consumed), SaveSubsystem (SaveTo before
          the saveable walk, LoadFrom after the power graph — mirrors the
          P8 seam law), P16 validator (GetMissingRequirements is the
          objective-requirements extraction surface at the re-run),
          HUD widget (PushObjective helper — WBP implements visuals)
Dependencies: Gameplay Tags, save generic maps, existing delegates — all
          pre-existing; zero new Build.cs modules (doc 20 §2)
Affected Risks: R-005/R-027 contained (delegate-only integration, zero
          hard refs to props/routes/generators), R-016 contained (raw
          facts + replayed activation, no baked state), R-019 advanced
          (the M1.5 fun gate's objective layer now exists in code),
          R-007/R-008 noted (objectives join the graph at the P16 re-run)
New Risks: none — the design was pre-registered (09 §9); the one new
          surface (component-static delegate) is C++-only by Blueprint
          limitation and documented in the feature-spec block
Assumptions: A-017 (events have real consequences — completion chains
          must fire in the editor test), A-015 (validated runs — objective
          requirements enter validation at the P16 re-run)
Target Resolution: Before P13 exit gate (doc 14 §14)
Tests Required: doc 14 P13 chain in editor: event-only completion (repair
          chain, power chain, escape chain), progress rows, optional rows
          never block, save/load ledger replay with zero duplicate
          completions, SILID.Debug.Objectives dump
Proceed: YES — code deliverables only; gate remains PENDING-COMPILE until
          the editor session proves the chains (doc 14 §6 rule 2). The
          six-type puzzle census + DA_Story row authoring are editor
          content, tracked as [FAIL] rows in the gate report. Frontier
          after this: P16 editor-side gate re-run, then M1.5 prep.
```

Note recorded en route: objective failure conditions defer to the co-op
phase (doc 06 §5 downed/revive) — the slice's death is the GameMode's,
so `FailObjective` exists for authored chains only and optional rows
cannot fail. No deviation entries required; doc 12 §1 rows updated
(USILIDObjectiveSubsystem ✅, USILIDObjectiveData ✅).

---

## 2026-09-28 — AI-agent pre-implementation check: 25-prompt spec (AI/stealth/physics/audio/lighting/dressing/puzzles/injury/events/MP/polish)

Per doc 15 §10 — inspected 05 (systems/AI law), 04 (audio/lighting), 02
(characters/animation), 09 (architecture/save split), 12 (type map), 20
(stack — PCG already ratified), 13 (frontier), 14 (gates), 15 (R-018/R-019
scope law), 19 (quality gate). Finding: **~85% of the request is already
designed, landed, or gated** in this doc set; the reconciliation below is
the record. NO code changes this turn (frontier law: P16 re-run → M1.5).

```
Feature: 25-prompt request — realistic house architecture; advanced enemy
          AI; dynamic enemy director; advanced stealth; physics &
          interaction; horror audio; dynamic lighting/darkness; procedural
          house dressing (PCG); search & discovery; puzzle generation;
          generator/electricity chains; water & plumbing; vehicle repair;
          inventory/equipment; injury & survival; dynamic events;
          replayability/run director; first-person camera; animation
          pipeline; co-op design; dynamic difficulty; save/recovery;
          professional UI/UX; environmental storytelling; AAA polish gate
          — plus the requester's 13-step priority order
Owner: NO implementation owner this turn — documentation ruling only;
          per-prompt dispositions name the existing owner docs
Affected Systems: docs 19/02/05/09/13 receive ADDITIVE design rows (see
          below); zero C++ changes; zero Build.cs changes
Dependencies: governance only — every prompt lands on an existing phase
          row (13), gate (14), or design doc section
Affected Risks: R-018/R-019 (scope law — the 13-step order must NOT
          preempt M1.5; ruling below), R-007 (prompt §17's solvability
          demands = the landed P16 law), R-013/R-014 (physics/VFX budgets
          activate at their phases, not before), R-023 (co-op prompts =
          doc 06 design, P18 gate)
New Risks: none — every prompt maps to an existing registered risk or
          design section; the only new laws are additive doc rows
Assumptions: none new
Target Resolution: the request's build-relevant items activate at their
          named phases/gates; nothing precedes M1.5
Tests Required: none new this turn; per-prompt gate tests already named
          in doc 14 rows (P9/P11 senses+hiding matrix, P25 audio, P26 UI,
          P30 RC audit, GATE D desync discipline)
Proceed: YES — additive documentation only (doc 19 §4a PCG dressing law
          + §6 structural-systems realism; doc 02 §4a Blender animation
          pipeline; doc 05 §3 water failure states + §5.3 director note
          + §9 injury/status design; doc 09 §7 dual-slot save recovery;
          doc 13 §7 reconciliation matrix). NO — any reordering of the
          ladder, any pre-M1.5 implementation, any vehicle/water/MP code
          (their gates hold). Frontier UNCHANGED: P16 editor-side gate
          re-run → M1.5 fun gate.
```

Per-prompt dispositions (all 25, so nothing is lost): **§1 house
architecture** → exists (docs 03 §1/§5, 19 §2/§3/§12); structural-systems
realism (plumbing runs, conduit, ventilation, roof structure, drainage,
maintenance access) added to 19 §6. **§2 enemy AI** → exists as law +
design (05 §5.1–5.4 honesty/behaviors/light-scaling/equipment; thrown
objects §5.2; cameras §4; BT/BB 09 §6) — P9/P10 gates re-prove. **§3
dynamic director** → absorbed into 05 §5.3 (difficulty profiles +
RoomDirector): aggression/pacing is a DATA-layer extension post-M1.5;
never-cheat/never-random-kill = §5.1 law verbatim. **§4 stealth** →
exists (05 §1 surface noise, §5.4 light scaling, HideSpot system, 19 §10
interaction classes) — P11 gate. **§5 physics & interaction** → exists
(05 §1 physics→noise, 19 §10 classes, 12 type map, `ChaosVehicles` module
row) — P5/P12 content. **§6 horror audio** → exists (04 §1 complete:
per-surface MetaSound, occlusion 1 Hz, reverb zones, honest-audio law) —
P25 gate. **§7 lighting/darkness** → exists (04 §4 fixture table:
flashlight/candles/emergency/flicker; light = power = gameplay) — M2
budgets. **§8 procedural dressing** → NEW LAW: 19 §4a PCG rulesets keyed
by room type (module already ratified, 20 §2) with validator/spawn-point
exclusion rules. **§9 search & discovery** → designed (09 §3
Container/Drawer components, 19 §5 recipes; no-glowing-markers = doc 14
P26 uncertainty law) — P5/P26. **§10 puzzle generation** → exists by
construction: P7 requirement rows + barrier grammar + randomizer + P16
validator (randomized-but-solvable IS the mechanism); new puzzle types =
data rows, gated with their phases. **§11 generator/electricity** →
LANDED P8 (PENDING-COMPILE): the prompt's three chains are exactly
`DA_PowerGraph` rows; failure propagation = SolvePower. **§12 water** →
designed (05 §3); failure states (leaks/blockage/pressure/flooding) added
to §3; build remains post-slice (roadmap). **§13 vehicle repair** →
designed + gated (17 §5, 18 §1–3: parts[] randomization = run configs) —
M1.7. **§14 inventory/equipment** → designed (09 §5 instance/weight/rarity,
§3 Equipment component; quick slots = P26 UI). **§15 injury & survival** →
NEW DESIGN: 05 §9 status-effects-as-data-rows block (deliberately small,
post-M1.5, R-018). **§16 dynamic events** → exists (RoomDirector
data-driven mutations + the one-event-fabric law) — systemic-not-scripted
is the RoomDirector contract. **§17 replayability/run director** →
landed pure core (randomizer + P16 validator + seed persistence; 09 §8
chain verbatim). **§18 camera/first-person** → exists (02 §4 Control Rig
foot/hand IK + lean, §5 FP specifics; comfort/accessibility = P26) — P2
feel gate. **§19 animation pipeline** → exists (02 §4 one-AnimBP +
sources); Blender's role added as 02 §4a. **§20 co-op** → designed (06
authority map + §5 primitives incl. the prompt's split-up/distract/repair-
together/revive/CCTV/vehicles list) — GATE D. **§21 dynamic difficulty** →
exists (DifficultySubsystem + DA_DifficultyProfile: awareness/scarcity/
patrol/repair-times as data) — the prompt's "configuration not duplicated
code" is already the law. **§22 save/recovery** → exists (versioned
generic maps, corruption policy 09 §10: reject + fresh-run, never silent)
— dual-slot write named as the P22 recovery mechanism (09 §7). **§23
UI/UX** → designed (14 P26 row, 12 CommonUI row, HUD C++ base) — WBP
content pass. **§24 environmental storytelling** → exists (19 §5 recipes,
03 §3 paper layer, Document items, DA_Story/P23 swap demo). **§25 polish
quality gate** → already BINDING, not advisory: 19 §12 location gate + §8
import QC + per-phase regression gate (14 §1) + P30 RC audit + validator
(impossible runs) + 06 §8 (desync).

Priority-order ruling: the requester's 13-step order (AI → stealth →
physics → audio → lighting → dressing → puzzles → electricity+water →
vehicles → events → run director → co-op → polish) maps onto the ladder
as follows and does NOT reorder it: AI/stealth = P9/P11 gate re-proofs;
physics/audio/lighting = P5/P25 content at their phases; dressing = art
pass 5 (PCG); puzzle generation = data authoring over landed systems;
electricity = landed P8, water = post-slice; vehicles = M1.7-gated;
events/run-director = existing subsystems; co-op = P18; polish = P30.
The M1.5 fun gate remains the only door to everything beyond it (R-018).

---

## 2026-09-28 — AI-agent pre-implementation check: prompt library 26–70 (living house, simulation, horror/AI depth, environment, replayability, MP, technical, production)

Per doc 15 §10 — inspected 05 (AI law, water, security), 04 (weather/
lighting/audio), 09 (architecture, save split, objectives), 11 (ownership),
13 (frontier + §7 matrix), 14 (gates P9–P30), 17/18 (gated world), 19
(QC/pipeline), 20 (stack), 06 (co-op), 15 (scope law). Finding: the 45
prompts are overwhelmingly the doc set's existing design restated at
higher resolution; the NEW design surface is small and is landed below as
additive rows. NO code changes; frontier UNCHANGED (P16 re-run → M1.5).

```
Feature: prompts 26–70 — living house; house state simulation; destruction;
          barricades; enemy memory; enemy learning; enemy archetypes;
          enemy ecosystem; territories; noise propagation; surface
          footsteps; weather; day/night; seasons; wildlife; vegetation;
          underground identity; flooding; fire & smoke; security; phones/
          radios; cameras; item inspection; item combination; crafting;
          traps; dynamic escapes; death/failure; capture/rescue; item
          economy; risk/reward; secrets; environmental puzzles; dynamic
          objectives; procedural story; endings; accessibility; photo
          mode; debug toolkit; automated testing; perf budgets; asset
          consistency; Blender→UE5 pipeline; asset library; the "real
          game" test
Owner: NO implementation owner this turn — ruling + additive design rows
          only; per-prompt dispositions name existing owners
Affected Systems: docs 05 (§5.2 learning + new §10 design notes), 19
          (§9 folder taxonomy + §10 destruction note), 04 (§3 time/season/
          wildlife), 00 (§2 experience test), 13 (§8 pointer). Zero C++
          changes, zero Build.cs changes
Dependencies: governance only; every prompt lands on an existing phase
          row/gate or named design section
Affected Risks: R-018/R-019 (scope law — none of this preempts M1.5),
          R-013/R-014/R-015 (perf-conscious scope: destruction/fire/flood
          are controlled + budget-gated, per the prompts' own caveats),
          R-008/R-009 (validator coverage extends with secrets/traps —
          their spawn pools join the graph when built), R-023 (MP prompts
          stay doc 06 design)
New Risks: none — the only genuinely new mechanics (learning, fire,
          capture, crafting, destruction) are designed INSIDE existing
          laws: events-only completion, ownership table, failure codes,
          and the validator's guarantee
Assumptions: none new
Target Resolution: each prompt activates at its named phase/gate; the
          enemy-memory/learning row lands with the BT/BB migration (M2)
Tests Required: none new this turn; per-prompt tests already named in
          doc 14 (P9 honesty matrix, P11 hiding, P28 seed stress, P30 RC,
          R-007's 1,000-seed evidence)
Proceed: YES — additive documentation only (05 §5.2 memory/learning bullet
          + §10 design notes; 19 §9 taxonomy + §10 destruction; 04 §3
          time/season/wildlife; 00 §2 experience test; 13 §8). NO — any
          reordering, pre-M1.5 implementation, or mechanic outside its
          named gate. The request's own scope caveats ("do not make the
          whole house destructible", "avoid a giant crafting game", "do
          not turn wildlife into a simulation") are adopted INTO the
          design rows as limits.
```

Per-prompt dispositions (26–70, complete): **26 living house** → landed
P8 + designed water/security (05 §2–4); systems-influence-each-other IS
the tag-registry + event-fabric law; new consumer types (TVs, phones,
clocks, appliances) = ElectricPowered registrations, zero subsystem
changes (doc 12 §11 bar). **27 house state** → landed: ISaveable +
generic maps + seed persistence; "never magically reset" = save law
verbatim. **28 destruction** → NEW NOTE (19 §10): damage STATES on
interactable meshes + physics knock-over; no runtime geometry surgery.
**29 barricades** → exists (Barrier family + Door + physics classes;
furniture-against-door = Physical-class placement, AI interacts via BT
branch 05 §5.2). **30 enemy memory** → exists as law (05 §5.1 blackboard
= stimulus memory, never truth; decay); detail row added §5.2. **31
enemy learning** → NEW (05 §5.2): repetition-profile → bias-weights,
honest, capped. **32–34 archetypes/ecosystem/territory** → NEW design
notes (05 §10a): one controller + PDA profiles (the replaceable-mesh
contract applied to AI); inter-enemy facts ride the existing noise bus;
territories = DA_ZoneDef enemy fields (18 §5) — all post-M2 content at
current gates. **35 noise propagation** → exists (04 §1 honest audio:
attenuation/walls/floors on the shared struct; garage-vs-bedroom
behavior = radius/attenuation data). **36 surface footsteps** → exists
(04 §1 MS_Footstep_Surfaces; 02 notifies; §5.4 speed) — P25 content.
**37 weather** → exists (04 §3 WeatherSubsystem with AISoundScale,
thunder-masking, wetness). **38 day/night** → exists as §04 §3/§4 hooks
(directional/sky curves, escape availability data); gameplay weight
reaffirmed. **39 seasons** → NEW (04 §3): season = config layer over the
existing weather profile (rainy/dry/storm profiles, mud = surface-noise
rows, overgrowth = dressing data) — config-only, post-M1.5. **40
wildlife** → NEW (04 §3): Niagara/ambience + scripted distraction events
through the noise bus; NOT a simulation (the request's own caveat). **41
vegetation** → exists (03 §4 foliage master + wind vector; PCG §4a
placement) — art pass content. **42 underground identity** → exists
(17 §7 tunnel identity; master-material wetness/rust; 04 reverb zones).
**43 flooding** → designed (05 §3 failure states, this turn's earlier
rows; the request's broken-pipe→valve→pump chain is exactly those rows).
**44 fire** → NEW design note (05 §10b): electrical-short/stove/generator
sources as power-node events, spread as budget-gated VFX + damage
volumes, alarms/attract via the noise bus, extinguish = repair rows —
performance-conscious per the prompt's caveat, post-M1.5. **45 security**
→ exists (05 §4 device table incl. backup power/UPS, access cards = key
tags). **46 phone/radio** → partially exists (Radio puzzle actor; phones
= Document/noise-emitting interactables + DA_Story clues; walkie-talkie
= P18 MP comms row in 06). **47 cameras** → exists (05 §4 CCTV;
recordings/night-vision = content extensions at P25). **48 item
inspection** → exists (Examine path + document items; voltage/label
clues = item description data) — P26 UI polish. **49 item combination**
→ exists by inventory API design (consumable/compatibility checks);
recipe data rows named in 05 §10c. **50 crafting** → NEW design note
(05 §10c): limited, survival-oriented recipes (noise maker, barricade,
bandage, repair kit), capability-flag reuse, deliberately small. **51
traps** → designed (damage/trap sources doc 14 P6; reusable grammar:
noise-tagged triggers, RepairComponent disable, capability queries;
spawn pools join the validator when built). **52 dynamic escapes** →
landed + validator-guaranteed (escape grammar + per-run availability
rolls; the three example chains are exactly 18 §6 route rows + repair
rows). **53 death/failure** → exists (GameMode respawn-from-save,
difficulty options, downed = P18; permadeath = difficulty-profile flag,
trivially data). **54 capture/rescue** → NEW design note (05 §10d):
capture = non-lethal end-state alternative keyed by difficulty/story
data — teleport-to-held-room + inventory confiscation (API-only) +
world-state keys; the CAPTURE→ESCAPE→RECOVER loop is the escape/restart
techniques already present, re-entered. **55 item economy** → exists
(randomizer difficulty loot multipliers + fuse pressure; scarcity drift
= director note 05 §5.3). **56 risk/reward** → exists by design (spawn
families in gated zones; validator guarantees reachability once the gate
opens — danger is patrol/hazard data, never solvability). **57 secrets**
→ exists (PrerequisiteRoute grammar, hidden basement/attic passages in
17 §3; per-run accessibility = availability-pool law). **58 environmental
puzzles** → exists (trace-cables/valves = the power/water graphs made
diegetic; inspect-labels = Document items; no new puzzle machinery).
**59 dynamic objectives** → LANDED P13 (Requirements tag queries on
USILIDObjectiveData = generated-from-world-state; "Restore the generator"
with fuel+tool+fuse deps is precisely the row schema). **60 procedural
story** → exists (DA_Story rows keyed by story tags; P13 ledger supplies
facts; P23 swap demo is the gate). **61 multiple endings** → exists by
data (DA_Endings/DA_Story rows selected by ledger state; GameMode ending
hooks exist). **62 accessibility** → exists (14 P26 row; LocalSettings
subsystem 12 §1; subtitle/FOV/colorblind HUD hooks). **63 photo mode** →
NEW one-liner (14 P26 content note landed in 19 §12 acceptance): pause +
hide-UI + free cam — P26/P30 content; doubles as the visual-QC harness
the art pass already needs. **64 debug toolkit** → exists (09 §10 exec
list + landed SILID.Debug.Power/Objectives + validator execs; shipping-
compiled-out law stated there). **65 automated testing** → exists (landed
200-seed harness + validator execs + P28 stress gate; the request's
Seed/PASS/FAILED report format is the validator's existing output). **66
perf budgets** → exists (03 §7, 06 §7, M5 gate — set BEFORE the big
house, exactly as asked). **67 asset consistency** → exists (19 §8 import
QC table — scale/collision/UV/naming/Nanite rows; P30 audit closes it).
**68 Blender→UE5 pipeline** → exists (19 §13.2/13.4 = the pipeline
stages verbatim: model→UV→bake→export→import→masters→QC→ledger). **69
asset library** → NEW LAW (19 §9 taxonomy): the request's folder tree is
adopted under Content/SILID/ with the prefix law. **70 the real-game
test** → NEW LAW (00 §2): the experience test — every major system must
create gameplay, information, risk, choice, or consequence; features that
do none are reconsidered. Already partially embodied (19 §12, 14 §2
done-definition); now explicit in the overview.

Note: the enemy-facing items (30/31/32/33/34) deliberately wait for the
BT/BB migration (09 §6, M2) — building learning/ecosystems on the
to-be-replaced enum controller would violate the no-second-implementation
rule (20 §3 rule 2).

---

## 2026-09-28 — AI-agent pre-implementation check: prompts 71–121 (second list: movement/hands/body-awareness, horror direction, knowledge/containers, NPCs, systemic chains, dev tooling, modes)

Per doc 15 §10 — inspected 02 (§4/§4a/§5 animation+FP), 04 (§1/§3/§4
audio+lighting+pacing law), 05 (§5 AI, §10 notes, §10e/§10f landed last
pass), 09 (§4 interaction contract, §5 instances, §8 validator, §10
debug), 11 (ownership), 13 (§7–9 matrices), 14 (P2 feel gate, P26,
P28), 06 (authority), 19 (QC), 00 (§3 decision rules, §2 experience
test). Finding: heavy overlap with the two prior batches — safe rooms,
knowledge/maps, silence, NPC/rescue, server authority, and the anti-
procedural law already landed (doc 16a, this date). The NEW surface:
no-cheap-jumpscare law, contextual animation VARIANTS, body awareness,
two-handed carry, ghost/replay debug, and the §121 integration-
completeness law. NO code changes; frontier UNCHANGED.

```
Feature: prompts 71–121 (2nd numbering) — advanced movement; physical
          hands; contextual animation; body awareness; fear/stress;
          dynamic music; silence & ambience; occlusion audio; enemy
          audio intelligence; procedural horror moments; no-cheap-
          jumpscare; encounter director; safe rooms; dynamic safe/
          unsafe; player knowledge; in-world navigation; physical map;
          dynamic map discovery; carrying/weight; two-handed; object
          persistence; NPCs; survivor/rescue; companion AI; enemy vs
          environment; enemy destructibility; weaknesses; adaptive
          resources; choice consequences; multi-solution puzzles;
          systemic chains; emergent gameplay; seed replay; ghost/replay
          debug; AI simulation tests; MP proximity; separation; friendly
          fire; server authority; modularity; data-driven; mod support;
          photo-realism QA; environmental camera; mirrors; CCTV horror;
          milestone events; difficulty presets; NG+; endless mode; the
          integration-completeness law
Owner: NO implementation owner this turn — ruling + additive design rows
Affected Systems: docs 04 (§3 horror-direction law), 02 (§4 variants +
          §5 body awareness), 09 (§10 ghost/replay + §5 carry), 13 (§10
          pointer + §2 law). Zero C++ changes
Dependencies: governance only
Affected Risks: R-018/R-019 (scope law), R-023 (MP rows = doc 06),
          R-013 (AI sim tests land with the validator harness family)
New Risks: none
Assumptions: none new
Target Resolution: each prompt at its named gate; horror-direction law
          binds the P25 pass and every content pass from now
Tests Required: none new this turn
Proceed: YES — additive documentation only. NO — reordering, pre-M1.5
          implementation.
```

Per-prompt dispositions (complete): **71 movement** → exists (P2 landed
slice: walk/run/sprint/crouch/stamina curves, code-built Enhanced Input;
crawl/lean/vault/climb/slide/swim = 02 §4 state machine + Control Rig
additives at their content passes; injured/exhausted movement = the 05
§9 status modifiers; carrying = §89 note this pass; MP replication =
Character defaults). **72/73 hands + contextual animation** → exists (02
§4 slot montages + hand IK + §4a Blender role) — VARIANTS law added (02
§4): context-driven montage rows per interaction family, no generic
single-anim. **74 body awareness** → NEW (02 §5): visible FP arms +
legs-on-look-down + head-bob/breath layers — subtlety capped by P26
comfort. **75 fear/stress** → NEW-ish (05 §9 adjacent row): a stress
modifier data row on the status system (breathing/heartbeat/hand-tremor
presentation via P26-capped effects; never removes control — the
request's own rule). **76/77 music/silence** → LANDED last pass (04 §3
tension arc + silence law). **78 occlusion** → exists (04 §1: 1 Hz
occlusion raycast in the director, reverb zones per DA_RoomDef;
material-aware transmission = attenuation data refinement at P25). **79
enemy audio intelligence** → exists (04 §1 enemy vocal/breath layer + 02
notifies; the AI's audible state is its honest audible behavior —
nothing extra to build). **80/81 horror moments + no-cheap-jumpscare** →
NEW LAW (04 §3): the RoomDirector + noise bus already provide systemic
sources; cooldowns/context/probability controls are data rows on
da_Director events; jumpscares rare BY LAW, and the never-list (random
images, fake errors, unavoidable scripted attacks, excessive shake) is
adopted as binding design law. **82 encounter director** → exists (05
§5.3 director note + §10e pacing: cadence via difficulty/director data,
never direct AI writes; tension-and-release is §10e's arc). **83/84
safe/dynamic zones** → LANDED last pass (05 §10e). **85–88
knowledge/navigation/maps** → LANDED last pass (05 §10f; landmark/in-
world navigation = 17 §2 + 19 §5 recipes; maps never reveal enemy/items
= the uncertainty law, 14 P26). **89 carrying/weight** → NEW NOTE (09
§5): physical-carry classes on the instance struct (small/two-handed/
fragile/noisy) — movement/stamina/noise couplings via existing modifier
hooks. **90 two-handed** → merged into the same row. **91 object
persistence** → LANDED (drop = instance + actor spawn, ISaveable
generic maps; "remains until intentionally moved" is the save law). **
92–94 NPCs/survivor/companion** → LANDED last pass (05 §10e honest-
agent rows; companion follow/wait/hide = follow-behavior data, post-M2). **95/96 enemy vs environment/destructibility** → exists (05 §5.2
door interplay + hide-spot search + evidence; controlled reactions = §
10b fire-style damage volumes; never free physics abuse). **97
weaknesses** → NEW design row (05 §10a adjacent): discoverable weakness
rows on PDA_EnemyProfile (trap-tag vulnerabilities, light sensitivity,
narrow-space blockers) — learned through play, never menu-displayed
(P26 law). **98 adaptive resources** → exists (randomizer multipliers +
validator guarantee: required progression always obtainable — the
validator IS that promise). **99 choice consequences** → exists (the
P8 double-edge law: lights help you AND the AI; alarm-vs-lock
tradeoffs are the security design 05 §4; window-break noise = the
noise bus). **100 multi-solution puzzles** → exists by grammar (escape
routes already support key OR tool OR component OR prerequisite per
route — alternatives are authored rows; 18 §6). **101 systemic chains**
→ LANDED as the architecture itself (tag-registry power/water + event
fabric + the P8 chain; the prompt's exact example is the DA_PowerGraph
+ P13 objective chains). **102 emergent gameplay** → exists (05 §1
one-noise-source law + physics→noise + RoomDirector; no scripting of
sequences). **103 seed replay** → LANDED (seed persistence + save
restore + SILID_ValidateSeed execs). **104 ghost/replay debug** → NEW
(09 §10): dev-only event-tape (interactions/pickups/perception
summaries) compiled out of shipping, feeding run-failure debugging. **105
AI simulation tests** → exists (validator harness family + P9 gate
matrix + P28 stress; extend to perception sims at the BT/BB gate). **
106–109 MP** → designed (06 §5 primitives + authority map; proximity
voice/interference = P18 content; friendly-fire = configurable data
row in 06). **110/111 modularity/data-driven** → exist as the doc set's
spine (00 §6 replaceable-story law; 11 §1 ownership; 12 §1 type map —
the prompt's class list matches 1:1). **112 mod support** → exists
architecturally (data-driven everything + zone expansion law = the
substrate modding needs; no editor commitment, nothing blocking it).
**113 photo-realism QA** → exists (19 §8 import QC + §12 gate + §2
10-pass — visual review IS the FINAL-stage gate). **114/115
environmental camera/mirrors** → NEW SENTENCE (04 §3): composition/
silhouette/framing via authored sightlines (03 §1 loop law) + reflection
surfaces used sparingly and honestly (no scripted mirror scares — §81
law). **116 CCTV horror** → exists (05 §4: camera vision is real — AI
can be watched, cameras can be destroyed; monitoring = information
system by design). **117 milestone events** → exists (P13 story-tag
ledger + RoomDirector conditions; time-based-world = milestone-keyed by
design). **118 difficulty presets** → exists (DA_DifficultyProfile +
Easy/Normal/Hard; Story/Nightmare/Custom = additional profile rows,
zero code). **119 NG+** → NEW data note (13 §2 adjacent): NG+ = seed +
profile + unlock rows on existing data — no new systems. **120 endless
mode** → NEW design row (13 §2 adjacent): continuous objective-
generation over the P13/P16 machinery — post-M4 optional mode, gated.
**121 feature-checklist law** → NEW LAW (13 §2): the integration-
completeness rule — a feature is complete only when it works correctly
with the rest of SILID; every new system must connect (vehicle→
fuel/electricity/inventory/…, generator→lighting/CCTV/doors/water/AI/
objectives — the prompt's own examples are the doc set's existing
wiring); adopted into the §2 done-definition.

---

## 2026-09-28 — Design request: playable darkness / low-light visibility (19 sections — presentation + tuning law)

Per doc 15 §10 — inspected 10 (mood law — this request REFINES it, see
below), 04 (§4 lighting design), 05 (§5.4 light/AI double edge), 14
(P8/P25 gates), 19 (quality gate). The request is ~90% restatement of
existing law (darkness-as-gameplay, flashlight economy, power-restore
transformation, AI-light double edge all already binding); the NEW law
is the **visibility floor**: darkness must never become unplayable
blackness, and "true blacks" (doc 10 §1) is now scoped to LIT pockets —
a reconciliation, not a conflict. Landed as doc 04 §4a (design rows) +
doc 10 §5 (the darkness-floor law + parity additions). NO code changes;
editor tuning at the P25 pass. Frontier UNCHANGED.

```
Feature: Playable darkness — power-off ≠ zero visibility (ambient/
          moonlight/ingress floors, per-area light tiers, exposure
          adaptation, beam discipline, battery warning curve, emergency
          sources, restore contrast, darkness-driven choices, AI obeys
          the same visibility rules, no pure-black horror effects,
          the always-playable minimum rule)
Owner: PRESENTATION/ART + AUDIO/LIGHTING (docs 04/10); gameplay side
          (AI sight scaling, flashlight economy) already owned and
          landed by GAMEPLAY SYSTEMS (05 §5.4, slice flashlight)
Affected Systems: docs 04/10 (additive law rows); doc 05 §5.4 note.
          Zero C++ changes — this is editor tuning + a binding bar for
          the P25 lighting pass and every map pass after it
Dependencies: Lumen/Skylight/exposure (doc 20 stack rows), weather
          profiles (04 §3), power state (05 §2), flashlight component
          (landed)
Affected Risks: R-014/R-015 noted (no new systems; exposure/volumetric
          budgets checked at M2); R-019 (readability is part of the M1.5
          fun gate — unplayable darkness would fail it)
New Risks: none (the request itself is the mitigation for a real
          usability hazard — unplayable darkness)
Assumptions: A-017 (darkness creates choices — the §13 decision list is
          the test)
Target Resolution: binding at the P25 lighting pass and the M1.5/M2
          visual gates; first proof at the doc 21 blockout lighting step
Tests Required: P25 gate rows already named; added: per-area light-tier
          census (§4a tiers), restore A/B contrast check, histogram
          floor check (doc 10 §5)
Proceed: YES — additive documentation only. NO — code changes, no
          reordering. Frontier UNCHANGED: P16 editor-side gate re-run →
          M1.5.
```

Section dispositions (all 19): §1 no-zero-visibility + §2 realistic
low-light + §9 eye adaptation + §16/§17/§18 the minimum rules → doc 10
§5 (the law) + 04 §4a rows 1–3. §3 flashlight advantage + §4 beam
discipline → 04 §4a row 4 (the slice's flashlight component is the
anchor; tuning at P25). §5 per-area tiers → 04 §4a row 5 (ties to
DA_RoomDef light data + 17 §7 tunnel identity). §6 time-of-day + §7
moonlight + §8 exterior ingress → 04 §4a row 6 (04 §3 weather profiles
carry the day/night/storm data already). §10 battery management →
landed slice behavior (gradual drain + flicker warnings) reaffirmed in
04 §4a row 4. §11 emergency sources → exists (04 §4 fixture table) +
row 7 placement law. §12 restore contrast → 04 §4a row 8 (the LUT
cold-dead→warm-alive law was already in 04 §4 — now an explicit A/B
gate). §13 darkness-creates-choices → exists (A-017 + the risk/reward
design; listed as the §4a acceptance lens). §14/§15 AI visibility rules
→ exists (05 §5.4 light-scaling double edge — "no magical location
signal" IS the honesty law; darkness is not invisibility either) —
reaffirmed, zero changes. §19 the progression target → the §4a/§5
acceptance tests encode it.

---

## 2026-09-28 — Design request: advanced enemy perception, darkness, stealth & investigation (50 sections — the visibility/awareness tuning law)

Per doc 15 §10 — inspected 05 (§5.1 honesty law, §5.2 memory/evidence,
§5.4 light double-edge, §10a enemy profiles), 01 (noise struct), 09 (§6
BT/BB migration, §10 debug), 02 (anim notifies), 04 (§1 honest audio,
masking via weather AISoundScale), 06 (authority), 14 (P9/P11 gates),
15 (R-013 perf). Finding: the request's core rule IS the landed honesty
law verbatim; ~85% maps to existing design. The NEW law: the graded
**visibility formula + awareness score + suspicion bands + flashlight-
beam detection + noise masking + hiding distinction rules**, landed as
05 §5.5 (tuning law for the P9/P11 gates + the BT/BB migration). The
request's `FSILIDNoiseEvent` already exists with that exact shape (01
§3 struct: Location/Loudness/Tag/Time + radius derivation). NO code
changes; frontier UNCHANGED (P16 re-run → M1.5).

```
Feature: perception model (multi-source evaluation, awareness state
          ladder + optional states, graded visibility factors —
          lighting/movement/posture/distance/obstruction/flashlight —
          FOV cones, smooth distance curves, LOS blockers + partial
          cover, noise taxonomy + propagation + surface footsteps +
          environmental masking, suspicion growth/decay, last-known-
          location + search regions, door/object evidence, hiding
          (seen-entry vs unseen) + probabilistic spot checks, enemy
          memory, multi-enemy uncertain communication, CCTV as
          perception source, generator/power perception effects,
          flashlight strategy modes, fair-detection + subtle feedback,
          component architecture, data structures, awareness score,
          five scenario examples, imperfection, perception profiles,
          difficulty scaling (never wallhacks), MP server authority,
          performance tiers, debug visualization, 23 test cases, 26
          acceptance criteria, the final philosophy)
Owner: GAMEPLAY SYSTEMS (AI perception — the existing honest controller
          owns it); the §5.5 law binds its tuning at P9/P11 and the BT/BB
          migration (M2)
Affected Systems: doc 05 (new §5.5), doc 09 §10 (debug print), docs
          01/02/04/06/14 rows unchanged (they already carry the noise
          struct, notifies, masking, authority, gate tests). Zero C++
          changes this turn
Dependencies: AI Perception (stack row 2), noise bus (landed), light
          data (04 §4a tiers), hide spots (landed)
Affected Risks: R-013 (perf tiers adopted — distance-scaled perception
          updates), R-023 (server authority reaffirmed, 06 §2)
New Risks: none
Assumptions: A-016 reaffirmed (AI honesty is the differentiator)
Target Resolution: tuning law binds P9/P11 gate re-proofs + the BT/BB
          migration; debug viz lands with the M2 AI work
Tests Required: the request's 23 test cases merge into the P9 honesty
          matrix + P11 hiding matrix (doc 14) — the five scenario
          examples (A–E) become scripted gate rows
Proceed: YES — additive documentation only. Frontier UNCHANGED.
```

Section dispositions (all 50): §1 model + §2 state ladder + §39
architecture + §40 structs + §41 awareness score → 05 §5.5 (the state
ladder maps onto the existing 13-state enum as its evidence-graded
view; structs mostly exist — NoiseEvent verbatim). §3–§13 (unaware
behavior, darkness/movement/posture/flashlight/FOV/distance/LOS/partial
cover) → 05 §5.5 rows 1–3 (the visibility formula). §14 noise taxonomy
+ struct → exists (noise bus + EmitNoise; taxonomy = emit-site data).
§15 propagation → exists (attenuation law, 04 §1). §16 surface
footsteps → exists (04 §1 MS_Footstep_Surfaces). §17/§18 environmental
noise + masking → exists (04 §3 AISoundScale, thunder-mask) + §5.5 row
4 formalizes masking as perception data. §19/§20 suspicion + decay →
§5.5 row 5 (suspicion bands; decay exists in the state machine's
Search→Return arc). §21/§22/§23 last-known + search region → exists (05
§5.2 + §5.5 row 6 records the region rule). §24 evidence → landed (05
§5.2). §25–§27 hiding → §5.5 row 7 (seen-entry = known, unseen =
probabilistic checks — the seen-near rule generalized). §28 memory →
exists (05 §5.2 learning row, M2). §29/§30 multi-enemy + comms → exists
(05 §10a: shared noise bus, approximate-area alerts only). §31 CCTV →
exists (05 §4: camera vision is real; "power gives visibility but adds
surveillance" = the P8 double-edge). §32/§33 generator/power → LANDED
P8 (start 0.9 / sputter 0.4 / breaker 0.6 noise law + running hum). §34
/§35 double-edge + flashlight modes → exists (05 §5.4 + §4a row 7 —
player-controlled risk). §36 beam reaction → §5.5 row 3. §37/§38 fair
detection + feedback → §5.5 row 8 (the fairness law + diegetic-only
feedback). §42 scenarios A–E → scripted P9/P11 gate rows. §43
imperfection → §5.5 row 9. §44 profiles → exists (05 §10a
PDA_EnemyProfile). §45 difficulty → exists (DA_DifficultyProfile;
"never wallhacks" = §5.1). §46 MP → exists (06 §2). §47 perf → §5.5 row
10 (R-013 tiers). §48 debug → 09 §10 print format. §49/§50 tests → doc
14 matrices. FINAL philosophy → §5.5 closing law.

---

## 2026-09-28 — AI-agent pre-implementation check: dependency-graph prompt + prompts 73–121 (systemic horror, pacing, knowledge/containers, tools, evidence, chases, optional objectives, MP, world, music, presentation)

Per doc 15 §10 — inspected 09 (§8 landed validator, §12 governing
principle), 05 (AI law, §10 notes), 02 (animation/FP), 04 (music/ambience
law), 11 (ownership), 13 (frontier), 17 (landmarks/zones), 18 (route
rows), 19 (§5 recipes/contrast), 06 (co-op), 14 (gates). Finding: the
lead dependency-graph prompt IS the landed P16 validator verbatim (nodes,
requirement edges, per-run graph variation, reachability guarantee,
reject-and-regenerate). Prompts 73–121 map onto existing law at ~90%; the
new surface is small and additive. NO code changes; frontier UNCHANGED.

```
Feature: dependency graph as progression + prompts 73–121 — systemic
          horror; psychological tension pacing; safe rooms; dynamic safe
          zones; player knowledge; map discovery; player markings; search
          history; intelligent containers; semantic item placement;
          contextual interaction; animation-driven interaction; hand IK;
          physical inventory; weight; durability; tool specialization;
          tool failure feedback; enemy evidence investigation; footprints;
          search patterns; chase director; pursuit routes; dynamic
          barricades; enemy damage reactions; weapon consequences;
          non-lethal survival; scarcity director; contextual loot tables;
          rare items; optional objectives; rescue; NPC survival AI; NPC
          locations; MP proximity; voice/radio; separation; MP rescue;
          item ownership; server authority; streaming; vertical design;
          landmarks; contrast; silence; dynamic music; adaptive music;
          cinematics; the anti-procedural law
Owner: NO implementation owner this turn — ruling + additive design rows
Affected Systems: docs 05 (§5.2 evidence + §10e/§10f), 09 (§12
          anti-procedural law), 02 (cinematic law), 13 (§9 pointer). Zero
          C++ changes
Dependencies: governance only
Affected Risks: R-007/R-008 (the lead prompt = the validator's purpose;
          semantic placement tightens R-009), R-018/R-019 (scope law),
          R-023 (MP prompts = doc 06 design)
New Risks: none
Assumptions: none new
Target Resolution: each prompt at its named gate; pacing/music laws bind
          the P25 audio pass; knowledge/container laws bind P5/P26
Tests Required: none new this turn
Proceed: YES — additive documentation only. NO — reordering, pre-M1.5
          implementation, or mechanics outside their gates.
```

Per-prompt dispositions (complete): **dependency graph** → LANDED P16
(`SILIDSolvabilityTypes` graph nodes + requirement kinds, closure
reachability, per-seed placement variation, reject-and-regenerate,
`SILID_DumpGraph` prints the graph); the example tree is exactly a
validator model: route nodes (Escape → Garage | Tunnel), machines
(Generator/Pump), items (Fuel/Key/Tool), rooms (Garage) with requirement
edges — randomization changes placement/machine states per run, the
closure proves every required node reachable, invalid seeds rejected.
**73 systemic horror** → exists by law: the noise bus + RoomDirector
mutations + power events ARE the systemic sources (distant footsteps =
attenuated noise events; lights-off = breaker trip; doors change state =
RoomDirector); scripted jump scares were never the design (04 §1 honest
audio; 10 §4 ambience). **74 psychological tension** → NEW LAW (04 §3
pacing arc): Safety → Exploration → Suspicion → Threat → Chase → Escape
→ Temporary Safety; the audio director's existing layer composition gets
the pacing mandate — the AI already patrols/returns rather than
perma-attacking (13 states). **75/76 safe rooms/dynamic safe zones** →
NEW (05 §10e): safe-zone data rows per run (storage/heal/planning),
reliability decays with enemy territory shifts (05 §10a) — never
permanent, rolled per seed. **77–80 knowledge/map/markings/search
history** → NEW (05 §10f): a player-knowledge record (discovered
rooms/clues/codes/routes via a journal data set), progressive map
revelation (authored map + discovery flags, handwritten annotations),
player markers (chalk/notes/dropped objects — MP-shareable), and search
persistence law: searched containers STAY open/empty visually — spatial
memory, never a magical scanner. **81/82/101 containers/semantic
placement/loot tables** → designed (09 §3 Container/Drawer components +
18 spawn families); semantic probability rows (screwdriver→workshop,
medicine→bathroom, fuel→garage) landed as 09 §12 law; randomizer family
pools already place within tagged rooms (ValidationRoomId). **83
contextual prompts** → exists (GetInteractionText per implementor;
"Insert Fuse"-style verbs = data on the implementor). **84–86
animation/hands/physical inventory** → exists (02 §4 montages + §4a, §5
FP arms + sockets + hand IK; 19 §10 classes). **87 weight** → designed
(09 §5 instance struct WeightKg; stamina coupling = character read).
**88 durability** → designed (09 §5 Durability + 09 §3 DurabilityComponent).
**89/90 tool specialization + failure** → exists (capability flags +
RepairComponent failure codes with WHY text; specialization = tool-tag
rows). **91/92 evidence/footprints** → NEW SENTENCE (05 §5.2):
evidence-recording for enemy investigation (open doors/moved furniture —
the BT/BB memory already records these; wet/muddy footprints via
master-material wetness + decal component, budget-gated optional).
**93 search patterns** → exists (05 §5.2 investigate→search→timeout;
expanding radius; hide-spot seen-near rule). **94/95 chase director/pursuit
routes** → exists (13-state machine + difficulty profiles; route
alternatives are the map's authored loops — 03 §1 interconnection law
guarantees ≥2 exits per room, which is what makes chases winnable).
**96 dynamic barricades** → exists (19 §10 Physical class + Barrier
family; enemy response via BT branch). **97 enemy damage reactions** →
designed (09 §7 weapon defs; hit reactions = AnimMontage overlays 02 §4;
physical response law noted — no invisible HP). **98 weapon consequences**
→ exists (gunshot = loud noise event on the shared bus → AI convergence;
05 §5.2; M1.7 vehicle noise law analog). **99 non-lethal survival** →
exists (hide/distract/barricade are the core loop; combat is optional by
design — P12 keeps survival-horror focus). **100 scarcity director** →
exists (randomizer difficulty loot multipliers + validator guarantee;
05 §5.3 director note bounds drift). **102 rare items** → exists by
construction (availability pools + guaranteed-first fairness + validator
reachability — rare never means mandatory-unless-guaranteed). **103
optional objectives** → LANDED P13 (bOptional rows never block). **104
rescue** → NEW SENTENCE (05 §10a): trapped-character rescue = escape
grammar + escort as follow-behavior NPC row (post-M2); MP objective
variant in 06 §5. **105/106 NPC survival AI + locations** → NEW design
row (05 §10e adjacent): NPCs = simplified honest AI (flee/hide/follow,
noise-bus consumers, no omniscience) + per-run location spawn families —
post-M2 content. **107–110 MP proximity/voice/separation/rescue** →
designed (06 §5 co-op primitives; proximity audio = 04 §1 attenuation;
walkie-talkie/interference = content at P18). **111/112 item ownership +
server authority** → exists (06 §2 authority map: inventory/damage/
doors/randomization/enemy/escape all server-owned; "never trust the
client" is the doc's first law). **113 streaming** → exists (20 §1 row 9
World Partition + 18 §5 DA_ZoneDef; M3 gate). **114 vertical design** →
exists (03 §1 ≥2 vertical connections law; 17 §3 attic/basement/tunnels). **
115 landmarks** → exists (17 §2 zone philosophy + 19 §5 recipes give
identity anchors; landmark list = authoring checklist for doc 03 §3).
**116 contrast** → NEW SENTENCE (19 §5): rooms are dressed with a
contrast pass (normal vs damaged vs bright vs wet) — horror reads
difference, not uniformity. **117/118/119 silence/dynamic/adaptive music**
→ exists (04 §1 director: layered ambience, music ducking; AFRAID recipe
doc 10); NEW LAW (04 §3): silence is a mandated layer — no looping
horror track; intensity responds to AI distance/chase/health/darkness
via existing state data, transitions subtle. **120 cinematics** → NEW
LAW (02 §5): any cinematic uses game assets/systems in-engine — no
separate fake environments. **121 anti-procedural** → NEW LAW (09 §12):
"authored house, rearranged possibilities" — randomization acts only on
authored possibility spaces (semantic placement rows, designed puzzle
constraints, authored route variants, room-typed dressing); never
meaningless randomness; the validator's guarantee + semantic rows are
the enforcement.
