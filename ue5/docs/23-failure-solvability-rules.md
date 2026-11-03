# 23 — Failure & Solvability Rules

**Golden Rule:** SILID may be difficult, unpredictable, and punishing — but it must **never be unwinnable because of its own systems.**

**Role / precedence:** this doc is the canonical statement of the *failure law* and its validator requirements. Doc 09 §8 owns the dependency-graph design; doc 15 A-015 owns the non-negotiable assumption; doc 14 P16 owns the gate. This doc binds all three into one checklist and records the audit of the in-repo validator.

**Environment law (doc 14 §6):** in-repo work authors deliverables and marks proof `PENDING-COMPILE` until the editor session runs it.

---

## 1. Every generated run must be solvable before gameplay starts

Generate seed → place randomized items/keys/tools/fuel/fuse/enemy/progression states → run the solvability validator → **if it fails, discard the seed and generate another** → never launch an unwinnable run.

## 2. Required items must always be reachable

A required item may not: spawn behind a locked door that requires that same item · spawn inside a container that cannot currently be opened · spawn in an inaccessible room · spawn behind a permanently disabled system · be placed somewhere the player cannot physically reach.

## 3. Dependency chains must be valid

The generator must never require an item that can only be obtained after the generator is repaired. The valid chain is:

`Screwdriver → Wiring → Fuse → Install → Fuel → Start → Electricity → Open Exit → Escape`

## 4. Required resources cannot be permanently lost

The player must not be able to accidentally: throw away the only required tool · destroy the only required item · consume the only required resource · drop an item into an unreachable location · trigger a state that permanently removes a required item. **If an item can be discarded, there must be a recovery mechanism or another valid copy.**

## 5. Player-caused failure is allowed

**Legitimate:** enemy catches player · noise → investigation · wasting time · dangerous route · failing to hide.
**Not legitimate (system bugs):** required fuse inside an inaccessible container · screwdriver behind its own locked door · exit permanently impossible from randomization · generator requires an item that cannot spawn · enemy permanently blocks the only required path · a required item deleted by a bug.

## 6. Enemy AI must never create an unavoidable progression lock

The enemy may patrol important areas, guard routes, investigate the generator, chase, and force a hide or a different route — but must not permanently occupy the only required location with no viable alternative.

## 7. At least one complete solution must always exist

`Player Start → Search Areas → Required Items → Generator → Repair → Power → Exit → Escape`. Every arrow must be an actually reachable game state.

## 8. Randomization may change **where**, never **whether**

Moving the screwdriver/fuse/fuel between rooms is fine; putting any required item in an impossible location is not.

## 9. Validate before spawning the player

Intended order: generate seed → run state → place items → configure locks → configure generator → configure enemy → **validate** → solvable? → start gameplay : regenerate seed.

## 10. Validator requirements (minimum)

Player start reachable · every required item has a valid spawn · every required container reachable **and openable** · required dependency order valid · generator reachable · generator requirements satisfiable · generator can restore power · powered exit reachable · exit openable · escape completable · no required item permanently lost · no locked-door dependency cycle · enemy configuration creates no deadlock.

## 11. Test many generated runs

≥20 manual seeds · automated validation across many seeds · deliberately difficult configs · deaths and restarts · dropping required items · leaving and re-entering areas · enemy chasing during generator progression · power restoration · exit completion. **Target: 0 known unwinnable generated runs.**

## 12. Failure classification

| Failure | Result |
|---|---|
| Player made a bad decision | Valid gameplay failure |
| Enemy caught player | Valid gameplay failure |
| Player ran out of time/resources | Valid gameplay failure |
| Randomizer created impossible dependency | **System bug** |
| Required item unreachable | **System bug** |
| Generator impossible to repair | **System bug** |
| Exit impossible to reach | **System bug** |
| Enemy permanently blocks progression | **System bug** |
| Save/restart corrupts run | **System bug** |

---

## AUDIT — rules vs. the in-repo validator (inspection-level, 2026-10-07)

Implementation: `Systems/SILIDSolvabilityTypes.h` (pure model/report vocabulary — no UObject), `SILIDSolvabilityEvaluator.cpp` (monotone-fixpoint closure, cycle + supply-exhaustion detection), `SILIDSolvabilityValidator.*` (`ValidateSeed` / `FindNextValidSeed` / `ValidateSeedBatch` + `SILID.ValidateSeeds|DumpGraph|ValidateSeed` execs), `SILIDSolvabilityTests.cpp` (200-seed harness, determinism assertions). All `PENDING-COMPILE`.

| Rule | Status | Evidence / gap |
|---|---|---|
| 1 · solvable **before** play | **◐ GAP** | `ValidateSeed`/`FindNextValidSeed` exist, but **nothing calls them** — `grep` finds references only inside the validator's own files + the test. `ASILIDGameMode::BeginPlay` rolls `RunSeed` and never validates or rejects it. |
| 2 · items always reachable | ◐ | Model has `UnreachableItem` + spawn candidates gated by `ValidationRoomId`. The **"inside a container that cannot be opened"** sub-case is unmodelable: there is **no `Container` node kind** (and no container actors yet). |
| 3 · dependency chains valid | ✅ code | Evaluator detects `CircularDependency` (a node unreachable while demanding itself). |
| 4 · resources never permanently lost | **✗ GAP** | The validator is a **pre-run static** closure; it cannot see runtime loss (throw/drop/destroy the only key). No recovery/fallback-copy guarantee exists. `SupplyCount`/`ExhaustedSupply` only cover *placement-time* scarcity. |
| 5 · player failure allowed | ✅ by design | `EFailure` vocabulary enumerates system-level faults only; player mistakes are outside its scope. |
| 6 · enemy never locks progression | ◐ assumption | Enemy is deliberately **not** a solvability input (`FPlacement::EnemyStartRoom` is report-only: "the AI is honest and cannot make a run unwinnable"). This is an **assumption**, not a proof. |
| 7 · one complete solution exists | ✅ code | Fixpoint closure from `StartNodeId`; solvable when any `EscapeNodeIds` route becomes available. |
| 8 · changes where, not whether | ✅ code | The `FModel` is static per map; only `FPlacement` varies per seed. |
| 9 · validate before spawning player | **◐ GAP** | Same root cause as rule 1 — the documented 16-step order (doc 09 §8, doc 15) is not implemented at run start. |
| 10 · validator requirements | ◐ | ✅ start reachable · ✅ every item spawnable (`MissingItem`) · ✅ dependency order · ✅ generator reachable/requirements/power (`Machine` + virtual `Machine.Power`) · ✅ powered exit reachable/openable · ✅ escape completable · ✅ no locked-door cycle. **✗ required container reachable/openable** (no container kind) · **✗ no item permanently lost** (runtime) · **◐ enemy deadlock** (by exclusion). |
| 11 · test many runs | ◐ | ✅ automated 200-seed harness + per-seed evidence + determinism (`SILID.Validator.SeedBatch.100Plus`). ✗ it runs a **synthetic** house, not the map; real-map `SILID.ValidateSeeds 200` and the ≥20 manual seeds are editor work. |
| 12 · failure classification | ✅/◐ | `EFailure` codes + the table above exist; save/restart corruption is a runtime concern outside the validator. |

### Headline findings

1. **The reject-before-play gate is implemented but NOT wired.** This is the highest-severity gap: the spec's rule 1/9 and doc 15's `A-015 NON-NEGOTIABLE` both require that the GameMode reject an invalid seed before the player enters. Today the runtime never calls the validator, so an unwinnable seed would launch. Doc 15 §168 already flags *"A-015 (validator enforcement in UE5)"* as **UNVALIDATED** — consistent with this finding.
2. **Containers are unmodelable** (rule 2/10). This is the same missing-actor gap recorded in [doc 22](22-smallest-playable-scope.md) §10; the rule cannot be enforced until a `Container` node kind exists.
3. **Runtime item loss has no recovery** (rule 4) — a static pre-run validator structurally cannot cover it.
4. **Enemy non-blocking is an assumption**, not a proven property (rule 6).
5. **The validator has only ever run against a synthetic model** (rule 11); the real-map proof is pending.

### Next actions (in order)

1. **Wire the gate:** call `ValidateSeed` / `FindNextValidSeed` in the seed-acceptance path (GameMode + randomizer, per doc 09 §8's 16-step order and doc 15 §4's regenerate loop). Exit gate: reject-before-play exercised in the editor.
2. **Add a `Container` node kind** + reachability/openability check once the container actors land.
3. **Add a runtime required-item guarantee** (fallback copy or a recovery path) for rule 4.
4. **Prove or model the enemy constraint** (feasibility test vs. a soft graph constraint) for rule 6.
5. **Run the real-map 200-seed batch + ≥20 manual seeds**; record the §11 evidence.

**Status: rules 3, 5, 7, 8, 12 are enforced; rules 1, 9 are implemented-but-unwired; rules 2, 4, 6, 10, 11 are partial, with rule 4 and the container sub-case structurally unenforceable today.**
