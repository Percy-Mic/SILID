# 15 — Risk Register: Owners, Due Dates, Prevention & Mitigation (canonical — the single source of truth)

**Consolidation law:** this register is the *only* risk-management system (no separate governance/rules/schedule/policy docs). The three sufficient systems: **this register** + **the assumptions register** (§15) + **the phase exit gates** (doc 14). `16-risk-changelog.md` is the append-only log. Precedence: docs 09/11/12/13/14 keep their domains.

**Control law:** every risk carries OWNER + PREVENTION + MITIGATION + TRIGGER + TEST + EVIDENCE + TARGET. Prevention answers *"what do we do now so this is less likely"*; mitigation answers *"if it happens anyway, exactly how we contain/recover"* — both as **executable actions** (tasks, tests, code/asset/doc changes, validation procedures), never "test more" / "optimize later". If any of the seven is missing, the risk is not controlled.

**Status lifecycle:** OPEN (no sufficient action yet) → MITIGATING (action work active) → MONITORING (controls exist, evidence acceptable, risk remains possible) → RESOLVED (evidence exists). Alternates: BLOCKED, ACCEPTED (intentional, documented, owner-approved; critical gameplay/data risks normally never).

---

## 1. Ownership roles (solo-compatible; one accountable owner per risk)

TECHNICAL ARCHITECT (architecture, boundaries, dependencies, interfaces, debt, project structure) · GAMEPLAY SYSTEMS OWNER (player, interaction, inventory, tools, survival, weapons, puzzles, objectives, escape) · AI SYSTEMS OWNER (perception, BT, navigation, enemy states, search, stealth) · PROCEDURAL/RANDOMIZATION OWNER (seeds, placement, solvability, reproduction) · MULTIPLAYER OWNER (replication, authority, sessions, sync, reconnect) · WORLD/LEVEL OWNER (house, connectivity, placement, nav, streaming) · CONTENT/ASSET OWNER (assets, characters, licensing, consistency) · AUDIO/VFX OWNER · PERFORMANCE OWNER (CPU/GPU/memory/render/AI cost/physics/net) · QA/TEST OWNER (regression, acceptance, exit-gate verification) · RELEASE OWNER (packaging, cooking, RCs, shipping blockers).

## 2. Priorities & due dates

**P0 Critical** (can make the game unplayable/unwinnable, corrupt data, break MP, block shipping — addressed immediately) · **P1 High** (concrete mitigation required before the affected phase passes) · **P2 Medium** (tracked, scheduled; doesn't block the core loop now) · **P3 Low** · **P4 Accepted/Deferred**. Targets are dependency-based (`Before Phase X (Exit) / Vertical Slice / Multiplayer / Content Lock / RC / Shipping`); a calendar date may be added later and never overrides the dependency deadline. Overdue = target reached without evidence → status stays OPEN/MITIGATING, affected phase BLOCKED if applicable; due-date changes need Old/New/Reason/New-actions/Owner/Impact recorded in the changelog — never silent.

## 3. The register

| ID | Risk | Owner | Pri | Target | Blocking | Status | Evidence anchor |
|---|---|---|---|---|---|---|---|
| R-001 | Scope explosion | Technical Architect | P0 | Every major phase | Yes | MITIGATING | 13 §4 priority law · 08 §1 cut list |
| R-002 | Solo developer bottleneck | Technical Architect | P1 | Continuous | No | MITIGATING | 00 §7 buy-first ladder |
| R-003 | Asset licensing problem | Content/Asset | P0 | Before asset integration | Yes | MITIGATING | 07 ledger-as-gate |
| R-004 | Engine/API changes | Technical Architect | P1 | Project foundation | No | MITIGATING | 12 §1 version lock 5.4 |
| R-005 | Circular architecture dependencies | Technical Architect | P0 | Every architecture change | Yes | MITIGATING | 11 §2–4 + 12 §2–3 audits |
| R-006 | Giant god object | Technical Architect | P0 | Phase 1 | Yes | MITIGATING | 11 §8 checklist + 12 §9 headers |
| R-007 | Randomized run becomes unwinnable | Procedural | P0 | Phase 16 | **Yes — BLOCKING GATE C** | MITIGATING | 09 §8 validator design; proof = seed report |
| R-008 | Nonsensical item placement | Procedural | P1 | Phase 15 | Yes | MITIGATING | family pools + compatibility tags |
| R-009 | Repetitive randomization | Procedural | P1 | Phase 15–16 | No | MITIGATING | multiple pools per family (slice); telemetry planned |
| R-010 | Multiplayer desynchronization | Multiplayer | P0 | Phase 20 | Yes | MITIGATING | 06 §2 authority map |
| R-011 | Item duplication/exploit | Multiplayer | P0 | Phase 20 | Yes | MITIGATING | instance GUIDs (09 §5) + atomic transactions (12 §6) |
| R-012 | AI behaves unfairly | AI Systems | P1 | Phase 10–11 | Yes | MONITORING | 05 §5.1 honesty law; debug viz planned |
| R-013 | AI performance excessive | AI Systems | P1 | Phase 9–10 | No | MITIGATING | event-driven noise (no polling); one AI today |
| R-014 | Large house performance | Performance | P0 | Phase 17–27 | Yes | MITIGATING | 03 §7 budgets; blockout-first |
| R-015 | Physics unstable | Gameplay Systems | P1 | Phase 5 | No | MITIGATING | object-classification law (03 §6) |
| R-016 | Save corruption | QA/Test | P0 | Phase 22 | Yes | MITIGATING | versioned payload (slice) + atomic writes plan |
| R-017 | Story hard-coded into gameplay | Technical Architect | P1 | Phase 23 | No | MITIGATING | systems boot with empty DA_Story |
| R-018 | Feature creep | Technical Architect | P1 | Continuous | Yes | MITIGATING | 14 §3 gate-gated production entry |
| R-019 | Vertical slice fails | QA/Test | P0 | Phase 17 | Yes | MITIGATING | 13 §1 slice-first law; M1.5 gate |
| R-020 | Content inconsistency | Content/Asset | P1 | Phase 18–25 | No | MITIGATING | 00 §3 checklist + 10 parity test |
| R-021 | Character/animation pipeline complexity | Content/Asset | P1 | Phase 24 | No | MITIGATING | 02 §1–4 shared-skeleton contract |
| R-022 | Audio content too large | Audio/VFX | P2 | Phase 25 | No | MITIGATING | 04 §1 MetaSound families |
| R-023 | Network bandwidth excessive | Multiplayer | P1 | Phase 20–21 | No | MITIGATING | 06 §7 budgets + dormancy |
| R-024 | Third-party plugin dependency fails | Technical Architect | P1 | Continuous | No | MONITORING | engine-first law; wrapped OSS |
| R-025 | Build/cook/package failure | Release | P0 | Phase 0 onward | Yes | OPEN | recurring package test from P17 (no package run yet) |
| R-026 | Memory/storage growth | Performance | P1 | Phase 17–27 | No | MITIGATING | budgets (03 §7) + orphan audits (07) |
| R-027 | System complexity unmanageable | Technical Architect | P0 | Continuous | Yes | MITIGATING | cross-system gate tests (P8 model) |
| R-028 | Debugging becomes difficult | QA/Test | P1 | Phase 1 onward | Yes | MITIGATING | seed persistence (slice) + 12 §3 commands |
| R-029 | Multiplayer cheating/exploitation | Multiplayer | P0 | Phase 20 | No | MITIGATING | 06 §9 forgery drill |
| R-030 | Development knowledge lost | Technical Architect | P1 | Continuous | No | MITIGATING | this 18-doc set + ledger + changelog |
| R-031 | World-content expansion ahead of proven loop | World/Level | P0 | **Before phases A–H** (post-M1.5) | Yes | MITIGATING | governance ruling 2026-09-27 (changelog): doc 17 is design-only until M1.5 passes; transportation prototype gate first |

## 4. Concrete prevention & mitigation actions (the §3 table's executable core)

Actions below are the per-risk operational detail; each is a task, test, code change, or validation procedure. IDs follow the spec's `PREVENT-R-XXX-NN` / `MITIGATE-R-XXX-NN` formats (§6–7).

### P0 risks (the ones that can kill the project)

- **R-001 scope explosion.** PREVENT: every feature identifies dependencies + acceptance criteria before production; reject features that don't serve the current milestone (13 §4). MITIGATE: feature freeze; strip non-critical systems; return to vertical-slice scope; backlog the rest.
- **R-003 licensing.** PREVENT: ledger row (source/license/usage/restrictions, date-checked) **before integration**; prohibited-list check. MITIGATE: remove the questionable asset immediately; replace from the verified pool; asset-replacement list maintained in 07.
- **R-005 circular dependencies.** PREVENT: interface/subsystem boundary review on every architecture change (11 §8 checklist). MITIGATE: extract shared interface/data; move logic into the owning subsystem; refactor **before** continuing — never duplicate around it.
- **R-006 god object.** PREVENT: components/subsystems per responsibility; four-question class headers (12 §9). MITIGATE: split by responsibility; migrate incrementally; insert interfaces.
- **R-007 unwinnable runs — the model risk.** PREVENT: PREVENT-R-007-01 *generate the dependency graph for every mandatory objective item before enabling randomized spawning* (verification: a generated run contains a valid path from spawn to escape; failure → reject seed). MITIGATE: MITIGATE-R-007-01 *validator rejects the seed pre-entry*; max recovery scope = regenerate the full seed; player impact = **never sees an unwinnable run**. Evidence required: 1,000-seed report (§9).
- **R-010 desync.** PREVENT: server-authoritative state for every critical system (06 §2 list); clients request, never declare. MITIGATE: server corrects + resyncs the affected actor; recreate invalid replicated state; repro via deterministic test sequence.
- **R-011 duplication.** PREVENT: server validates pickup/drop/use/trade; authoritative instance GUIDs; **atomic** inventory transactions. MITIGATE: reject invalid transaction; restore authoritative inventory; log item id; resync client; restrict malicious client if needed.
- **R-014 house performance.** PREVENT: modular assets, Nanite where appropriate, World Partition, instancing, budget pre-declaration (03 §7). MITIGATE: reduce visible actors; lower effect quality scalably; adjust streaming; simplify the costliest materials; distance-disable systems.
- **R-016 save corruption.** PREVENT: versioned schema; validate on load; **atomic writes**; keep previous valid save. MITIGATE: reject corrupted save → load previous valid snapshot (spec's Current→Previous fallback); migrate versions; reset only unrecoverable data; never silently overwrite.
- **R-019 vertical slice failure.** PREVENT: slice before house (13 §1); complete player loop + acceptance tests as the gate. MITIGATE: stop content expansion; identify the missing dependency; reduce slice scope until complete and stable.
- **R-025 packaging failure.** PREVENT: regular clean builds from Phase 0 onward (recurring package test, doc 14 P27); reproducible packaging settings. MITIGATE: isolate failing module/asset/plugin; revert the last breaking change; rebuild clean.
- **R-027 system complexity.** PREVENT: ownership boundaries + interfaces + data-driven definitions + dependency documentation per system (09/11/12). MITIGATE: split the system; remove needless abstraction; replace duplicated implementations with shared components.
- **R-029 cheating.** PREVENT: everything server-authoritative (06 §2). MITIGATE: reject invalid requests; restore server state; record suspicious actions; invalidate compromised session state.

### P1 risks (named actions, condensed)

- **R-002:** reuse-first; automate repetitive validation → scope to core loop, substitute Unreal systems, defer polish. **R-004:** pin 5.4; isolate engine-specific code behind adapters → update adapters; disable non-critical plugin features. **R-008:** tagged spawn points with allowed categories → remove invalid spawn, regenerate that placement. **R-009:** multiple valid locations per family; track seed diversity in test reports → expand pools; reject diversity-failing seeds. **R-012:** perception/FOV/LOS/hearing thresholds + last-known-location only → on impossible state: log, capture target, clear perception, reset blackboard, return to patrol/search. **R-013:** throttled perception, event-driven hearing, no extra ticks → reduce update frequency, disable distant AI, lower active count. **R-015:** limit physics-enabled objects; proper collision profiles → disable simulation, restore transform, replace with scripted interaction. **R-017:** story in data assets only → move hard-coded values to data; route through objective/event interfaces. **R-018:** justification+owner+deps+risk+acceptance required pre-implementation → freeze, backlog, remove prototype code from production path. **R-020:** scale/material/lighting/prop standards; modular families → replace inconsistent assets, normalize, create missing variants. **R-021:** one primary character pipeline (MetaHuman); test locomotion before full production → retarget/replace set, simplify customization, verified fallback character. **R-023:** replicate authoritative state only; relevancy+dormancy → reduce frequency, client-side cosmetics. **R-024:** minimize plugins; document replacements → disable plugin, replace with Unreal-native, isolate behind interface. **R-026:** asset size tracking; texture/audio budgets → remove unused, compress, stream. **R-028:** structured logging + debug commands + seed display (12 §3) → reproduce on fixed seed, isolate subsystem, minimal repro. **R-030:** maintain the doc set + OwnershipMatrix/DependencyGraph equivalents → reconstruct from tests/source, document discoveries, restore boundaries first.

### P2

- **R-022:** reusable sound sets; centralized attenuation/reverb → compress, deduplicate, stream long sounds.

## 5. Critical-system action protocols (spec §8, adopted)

- **Randomization before any run starts:** the spec's 16-step sequence (seed → dependency graph → required items → candidates → accessibility → dependency order → tools → resources → generator → puzzles → escape → enemy → solvability simulation → reject invalid → regenerate → start only on success). Never let a player enter an unvalidated run.
- **Multiplayer action protocol:** client requests → server validates → server changes authoritative state → server replicates → clients present; prediction only where safe. Server-owned list = spec §8's full list (items, inventory, damage, weapons, doors, locks, generator, electricity, puzzles, objectives, AI, escape, revive).
- **AI fairness protocol:** perception input + FOV + distance + LOS + lighting + hearing + sound intensity + obstacle checks + last-known-location; no direct player position without legitimate perception. Impossible-state recovery: log → capture → clear invalid perception → reset blackboard → valid state → continue.
- **Electricity protocol:** every source/circuit/consumer/dependency/repair requirement defined and validated (generator/fuse/fuel) — if a dependency can't be satisfied, the run fails validation before gameplay. Example chain = spec's Generator→Main→Lighting→Security→Electronic Door→Restricted Area.
- **Inventory protocol:** authoritative ids; transactional add/remove; validated ownership; explicit stack rules; server validation in MP; save/load serialization tests. Failure: restore previous valid transaction; reject; log item id; resync.
- **Save protocol:** versioning; validation; atomic writes; previous-valid preservation; validate inventory/world references, run seed, objective state. Corrupt → previous valid save loads; never silently overwrite.

## 6. Triggers (measurable, per spec §10)

- **Performance:** target frame rate unmaintainable in the defined test scene → profile CPU/GPU, fix top contributors, rerun benchmark.
- **Randomization:** any seed fails mandatory solvability → auto-reject + record failure reason.
- **Multiplayer:** two clients show different authoritative inventory/world state → stop feature expansion; reproduce deterministically; find the authority violation; fix replication; rerun regression.
- **Save:** loaded save ≠ saved authoritative state → block save-system release; fixed save fixture; repair serialization/migration; rerun compatibility.
- **AI:** enemy detects player without valid stimulus → capture perception/debug state; find the invalid blackboard/perception write; correct authority path; rerun perception tests.

## 7. Minimum evidence for critical risks (spec §17)

- **R-007:** deterministic seed tests, hundreds/thousands of seeds, dependency + escape + required-item validation.
- **R-010:** 2–4 player tests covering simultaneous interactions, pickup/drop, inventory, doors, generator, puzzles, enemy state, revive, escape.
- **R-016:** save/load cycles, interrupted-save simulation, version migration, invalid-data handling, inventory + world restoration.
- **R-025:** clean package, development build, shipping build, fresh-environment validation where practical.
- **R-014:** full-house traversal, worst-case room, multiple active enemies, lighting, physics, VFX, MP where applicable, memory measurement.

## 8. Phase-gate risk review (spec §11) — runs before every exit gate

Review affected risks → check prevention actions → check mitigation actions → check triggers → verify evidence → verify owner → verify target → **verify no new P0/P1 was introduced** → mark resolved/monitoring/blocked → only then pass the gate. A phase never passes with an unresolved P0 directly threatening its deliverables; a P1 passes only with documented mitigation the owner accepts.

## 9. Feature-level & change-impact records (spec §12–13)

Feature record adds to the 12 §9 block: New Risks / Existing Risks Affected / Prevention 1-2-3 / Mitigation 1-2-3 / Verification+Evidence / **Rollback or Removal Plan** / Risk Status. The spec's "Randomized Generator Repair" example is adopted as the model. Change impact (spec §13) names Changed System/Owner/Direct+Indirect Dependencies/Affected Risks-Tests-Save-Replication-Randomization-AI-Performance + Rollback Plan — the inventory change cascade (→items→tools→weapons→repairs→objectives→randomization→save→MP) is the standing example of why foundational changes get impact reviews.

## 10. AI development agent requirements (spec §16 — binding)

Before significant features: inspect architecture, ownership, dependencies, affected risks, existing tests, save/replication/randomization/performance implications. After implementation: compile → run tests → gameplay validation → verify risk controls → **produce evidence** → update risk status → document unresolved risks → identify downstream systems. **Never mark a risk resolved because the code compiles.** In this repo: evidence items are authored as PENDING-COMPILE gate artifacts (doc 14's law) until the editor proves them.

## 11. New-risk template

The §3 row + the full record format: Risk/Category · P/I/Severity · Accountable+Supporting Owners · Affected Phase+Systems · Priority · Target · Review Point · Trigger · Prevention actions (numbered, executable) · Mitigation actions (numbered, executable) · Evidence Required · Blocking · Status · Notes.

## 12. Due-date change record

Old Target / New Target / Reason / New Prevention-Mitigation / Owner / Impact — appended to the changelog; never a silent move.

## 13. The control rule (spec §18)

Every important system: OWNER + PREVENTION + MITIGATION + TRIGGER + TEST + EVIDENCE + TARGET — anything missing = not controlled. Development loop: **Detect → Contain → Diagnose → Fix → Validate → Document → Continue.**

## 14. Dashboard (per milestone, in the changelog)

Status counts (Critical/High open, Overdue, Blocking, Mitigating, Accepted, Resolved) + top active risks with ID/Risk/Owner/Priority/Target/Blocking/**Next Action** — never the full register.

## 15. Assumptions register

Types: BASELINE · REQUIRED · PLANNED · TEMPORARY · UNVALIDATED. Lifecycle: UNVALIDATED → TESTED → VALIDATED (or INVALID → REVISE DESIGN). High-impact unvalidated assumptions are tested **before dependent systems expand**.

| ID | Assumption | Type | Evidence / validation gate |
|---|---|---|---|
| A-001 | UE5 primary engine | BASELINE | locked (uproject + docs) |
| A-002 | PC first, KB/M + controller | BASELINE | controller mappings pending (14 P0 gap) |
| A-003 | SP is the foundation; MP extends, never forks | BASELINE | 06 §1 same-code-path; validate at P20 |
| A-004 | Online co-op 1–4 | PLANNED | validate at P20/P29 stress gates |
| A-005 | Server authority for all critical state | BASELINE | 06 §2 map; forgery drill at P20 |
| A-006 | House = large interconnected property (20–40 areas) | BASELINE | 03 §1 program; count flexes on quality/perf |
| A-007 | Modular environment, not hand-modeled | BASELINE | 03 §2 kit law |
| A-008 | Licensed assets are resources, not dependencies | BASELINE | 07 ledger + replacement status |
| A-009 | Assets replaceable without rewriting gameplay | **REQUIRED** | data contracts; gate = 02 §7 swap test |
| A-010 | Story modular, replaceable | BASELINE | slice boots with empty story data |
| A-011 | Gameplay first | BASELINE | 13 §4 priority law |
| A-012 | Items change location per run; architecture stable | **REQUIRED** | **VALIDATED (web build: two-seed variance, seed persistence)** — re-prove in UE5 at P15 gate |
| A-013 | Randomization constrained by logic/progression/solvability | **REQUIRED** | family pools (slice); validator closure = P16 gate |
| A-014 | Deterministic seeds reproduce runs | **REQUIRED** | **VALIDATED (web: 169-check harness)** — re-prove in UE5 at P15 gate |
| A-015 | Every generated run has ≥1 valid completion path | **NON-NEGOTIABLE** | validator reject-and-regenerate; never ship without (R-007) |
| A-016 | Physical search, no "Search House" button | BASELINE | container/search design (12 §7); no auto-reveal |
| A-017 | Systems have real consequences | BASELINE | P8 automatic-consumer-reaction gate |
| A-018 | Electricity is a reusable system | BASELINE | 05 §2 tag-registry design |
| A-019 | AI has imperfect information | BASELINE | honesty law implemented in slice; auditable via R-012 viz |
| A-020 | Survival-horror combat, not a shooter | BASELINE | 09 §7 scope; limited ammo |
| A-021 | Physics only where it improves gameplay | BASELINE | R-015 classification |
| A-022 | Stability/performance beats visual quality | **NON-NEGOTIABLE** | budgets (03 §7) + packaged-build gating (R-025) |
| A-023 | Versioned saves preserve meaningful state | BASELINE | slice SaveVersion + additive maps |
| A-024 | Runs reproducible from seed + config for bug reports | **REQUIRED** | seed/difficulty in saves (slice); repro drill at P16 |
| A-025 | Editor perf ≠ shipping perf | BASELINE | recurring package test (R-025) |

**Currently UNVALIDATED (test before dependents expand):** A-004, A-013/A-015 (validator enforcement in UE5), A-014's UE5-side re-proof, R-013 multi-enemy perf, **A-026** (vehicle escape via existing escape grammar — prototype gate before any expansion) — exactly the P7→P8→P13→P16 frontier (doc 13 §4).

| ID | Assumption | Type | Evidence / validation gate |
|---|---|---|---|
| A-026 | Vehicles/trains integrate as escape routes via the existing escape grammar + noise bus, without new core systems | **REQUIRED** | transportation prototype loop (doc 17 §10) must pass before phases A–H start |
