# 21 — First Editor Session (the evidence bridge)

Every gate in doc 14 is currently PENDING-COMPILE because this repo has no UE toolchain. This doc is the ordered procedure for the session that converts the first gates into real evidence. It is written to be executed top-to-bottom in one sitting (~4–5 hours); each stage ends in a verifiable result, and a failure at any stage means **stop, fix, restart that stage** (doc 14 §6 rule 3 — never build past a failing stage).

**Format law:** the three gate reports produced here (P0, P2, P9) are appended to doc 14 in its §34 format — never reported in chat as complete.

---

## 0. Pre-flight (before opening anything)

- [ ] **Unreal Engine 5.4+** installed (5.3 minimum per doc 20 §3; record the exact version in the reports)
- [ ] **Visual Studio 2022** with the *Game development with C++* workload
- [ ] Disk headroom: ~30 GB for the first DerivedDataCache build
- [ ] Headphones (this session gates audio-adjacent behavior: door sounds, light-switch noise, AI hearing)
- [ ] A gamepad, if you have one (P2's controller checkbox — absence is a `[FAIL]`, honestly recorded)

**What this session deliberately does NOT do:** no asset imports, no art passes (doc 19's pipeline starts later), no M1.5 judging, no docs 17/18 content. Blockout geometry only. The goal is **proof of the code layer**, nothing else.

**What flips if the session succeeds:** P0 and P2 reports upgrade from PENDING-COMPILE to PASS-or-FAIL with evidence; the P9 report gets its first in-editor run (expected: partial); the frontier's P7 opens.

---

## Stage 1 — Open & compile (~30 min)

| # | Do | Verify |
|---|---|---|
| 1.1 | Right-click `SILID.uproject` → *Generate Visual Studio project files* | `SILID.sln` appears next to the uproject |
| 1.2 | Open the solution; select the **SILIDEditor** target (Development Editor, Win64); Build | Build succeeds — 0 errors. (Warnings: record count, fix nothing today) |
| 1.3 | If the build fails: read the first error, fix **that** error only, rebuild. Do not refactor | — |
| 1.4 | Launch the editor (accept the compile prompt if launching via the uproject instead) | Editor reaches the level viewport without fatal errors |
| 1.5 | Window → Developer Tools → Output Log: filter `LogSILID` | Module log lines present (the slice's scoped categories work) |

**Record:** engine version, build time, error/warning counts, anything surprising. This stage alone upgrades every "compiles" line in doc 14's three draft reports from PENDING-COMPILE to COMPILED.

---

## Stage 2 — P0 exit gate on a scratch map (~15 min)

The P0 gate needs a level to spawn into; the real house map doesn't exist yet, so prove the foundation on a scratch:

| # | Do | Verify |
|---|---|---|
| 2.1 | File → New Level → *Basic*. Save as `Content/SILID/Maps/LM_Scratch` | Map saved |
| 2.2 | Project Settings → Maps & Modes: set `LM_Scratch` as Editor Default **and** Game Default; GameMode Override → `SILIDGameMode` | Settings persist |
| 2.3 | Press **Play** | Player capsule spawns; no fatal log errors |
| 2.4 | Walk around with WASD, look with mouse, Sprint, Crouch, Jump | All respond (the code-built Enhanced Input works with zero editor assets) |
| 2.5 | `Shift+F1` out; Window → Output Log; check for Error/Fatal | None (warnings acceptable, recorded) |

**Now fill the P0 report** (template at the end of this doc) and append it to doc 14. Gate is PASS only when every box in the template is checked — "compiles" alone is not completion.

---

## Stage 3 — Blockout map per README §3A (~1–2 h)

Build `LM_House` — the 6–8-room blockout. **Use doc 19's measurement standard now**, even in graybox, so nothing gets rebuilt at the art pass:

- Interior doors **200 × 90 cm** · ceilings **280 cm** · stair risers **17–19 cm**, treads ~28 cm · counters ~90 cm · table ~75 cm
- Player eye height ~165 cm — walk through every room at eye level and sanity-check proportions against the furniture you place in Stage 4

| # | Do | Verify |
|---|---|---|
| 3.1 | Duplicate `LM_Scratch` → `LM_House`; keep scratch untouched | Map exists |
| 3.2 | Block out 6–8 rooms: sala/living, kitchen, bedroom, bathroom, utility (fusebox), garage/back door area, hallway connecting them | Rooms form a connected loop (no dead-end-only layouts — escape routes need alternatives) |
| 3.3 | Carve doorways; leave **one locked door** (bedroom), **one chain-able back door**, **one window route** | Three distinct exits physically exist |
| 3.4 | Add **`NavMeshBoundsVolume`** covering the entire house including all rooms the Resident must patrol | The AI cannot move without this — placement is mandatory (README §3A) |
| 3.5 | Set `LM_House` as both default maps (repeat 2.2) | — |
| 3.6 | Press Play, walk every room, jump in every corner | No geometry holes; player cannot leave the house; ceiling heights feel right |

**Anti-goal:** it looks like boxes. It should. This is Pass 1 of doc 19's ten-pass pipeline — its stage is *recorded*, and the art pass replaces it later.

---

## Stage 4 — Actor placement per README §3B (~1 h)

Minimum set for the P9 gate and the full interaction spine:

| Actor | Count | Notes |
|---|---|---|
| `BP_SILIDDoor` | 1 per doorway | Bedroom door: `UnlockItemId = item_key_house` |
| `BP_SILIDPickup` | ≥ 8 | Keys, batteries, one tool (hammer), fuse — each referencing its `PDA_Item` (Stage 5) |
| `BP_SILIDHideSpot` | ≥ 3 | Wardrobe (bedroom), under-bed, kitchen cabinet; set each camera socket |
| `BP_SILIDSafe` | 1 | 4-digit code; reward pickup inside |
| `BP_SILIDRadio` | 1 | In the sala; broadcast tag wired toward the safe's code |
| `BP_SILIDBarrier` | 3 | Planks on the window, chain on the back door, fusebox in utility (`bRestoresPower` true) |
| `BP_SILIDEscapeRoute` | 4 | MainDoor / BackDoor / Window / Hidden — wire key tags, tool flags, component tags, prerequisites per README §3B |
| `BP_SILIDSpawnPoint` | 6–12 **per family** | Families: `Items.Keys`, `Items.Battery`, `Items.Tool`, `Items.Components` — in drawers/shelves/counter corners |
| `BP_SILIDLightSwitch` | 1 per lit room | Room lights must be wired to the fusebox restore |
| `ASILIDResident` | 1 | Placed in the hallway's patrol midpoint |

**Placement discipline (doc 19 applies even now):** nothing floats; each object sits on a surface or hangs from a ceiling; hide-spot interiors stay clear. The randomizer only activates spawn points that actually exist — sparse placement produces sparse runs, so be generous.

---

## Stage 5 — Data assets per README §3C (~45 min)

Create `Content/SILID/Data/Items/PDA_<Name>` instances of `SILIDItemData`:

`item_key_house` · `item_key_rusty` · `item_battery` · `item_fuse` · `item_hammer` (**Flags.BreaksPlanks**) · `item_bolt_cutters` (**Flags.CutsChains**) · `item_screwdriver` (**Flags.TurnsScrews**) · `item_note_01`

- Set `ItemType` and the matching `FSILIDItemFlags` per README §3C — **barriers and escape routes query capabilities, never ids** (doc 11 compliance rule); a typo in a flag here breaks a route in Stage 7, which is exactly where you want to find it
- Display name + one-line description each; icons blank; world mesh = engine basic shape (allowed: pre-art-pass)
- Gameplay tags per the doc 01 schema (`Item.Key`, `Item.Tool`, …)

**Verify:** each pickup placed in Stage 4 references an existing PDA (no None references in the details panel). Save all.

---

## Stage 6 — HUD widget per README §3D (~30 min)

1. Create `Content/SILID/UI/WBP_SILIDHUD`, reparent to **`SILIDHUDWidget`**
2. Implement the C++ events as minimal text blocks: `ShowPrompt`, `ShowBattery`, `ShowStamina`, `ShowSubtitle`, `ShowExamine`, `ShowDeath`, `ShowEnding`
3. Assign to **`SILIDGameMode → HUDWidgetClass`**

Without the widget the game still runs (graceful degradation is by design) — but the P2 gate's prompt line and the P9 gate's perception cues are far easier to judge with it live, so build it before testing.

---

## Stage 7 — P9 exit gate run (~45 min)

The AI-honesty matrix from spec §11–12, run by hand with the HUD + `showdebug` assists:

| # | Stimulus | Expected (the honesty law — doc 05) |
|---|---|---|
| 7.1 | Idle: stay out of sight, silent | Resident patrols; **never** approaches your actual position |
| 7.2 | Walk past a doorway in its view | Sight stimulus → investigate → chase |
| 7.3 | Break line of sight (corner), stop moving | Chase → lost → **searches last known location**, not your real one |
| 7.4 | Crouch-walk behind it | No reaction (speed alters noise loudness — doc 05 noise table) |
| 7.5 | Sprint behind it | Hearing stimulus → investigate your *noise* position |
| 7.6 | Open a door near it | Door-sound investigation (the door emits on the bus) |
| 7.7 | Toggle a light switch while it's near | Device noise heard → investigates the switch, not you |
| 7.8 | Enter a hide spot while chased | Search of nearby hide spots (**risk**: difficulty gates discovery — expect possible discovery on Hard) |
| 7.9 | Let it lose you completely | Returns to patrol; no residual knowledge of your position |
| 7.10 | Die → respawn from save | Save/restore works mid-run (doc 14 P19 line) |

Also exercise the loop spine while the Resident is aggro'd: pick up the hammer → break window planks → open the safe (radio code) → grab the house key → unlock the bedroom → restore the fusebox → lights change state → reach MainDoor with key + padlock removed → **escape = win screen**. That single walk-through is the first live proof of Gates A and B's skeleton.

**Record** every row as observed, including failures. Failed rows go into the P9 report's TESTS as `[FAIL]` with the repro — they become the top of the next session's fix list (doc 14 §6 rule 3: the frontier returns to the failing phase).

---

## Stage 8 — Record the reports (~20 min)

Append the three reports to **doc 14** (its §6 rule 1 — never a chat claim), using the templates below verbatim. Then: commit the map + widgets as the session's artifacts, update doc 16a's changelog with one dated entry (what passed, what failed, the new frontier), and stop — **do not start P7 code in the same session.**

---

## Report templates (doc 14 §34 format)

```
PHASE: 0 (GATE A foundation)
NAME: Project Foundation
STATUS: PASS / FAIL
DELIVERABLES:
[PASS] Source module loads (LogSILID present in Output Log)
[PASS] Project compiles — UE <version>, <N> warnings, 0 errors
[PASS] Dev build launches; player spawns on LM_Scratch
[PASS] Input works (code-built Enhanced Input, zero editor assets)
[PASS] Repo structure clean (docs + Source + Build.cs only)
[FAIL] <anything not true>
TESTS:
[PASS] Fresh-generation + compile from clean solution
[PASS] Play-in-editor: no fatal runtime errors
[PASS] <extra observations>
EXIT GATE: PASS / FAIL
BLOCKERS:
- <none, or list>
NEXT PHASE: P2 report (below)
```

```
PHASE: 2 (GATE A)
NAME: Player Controller / Movement
STATUS: PASS / FAIL
DELIVERABLES:
[PASS] Character, camera, movement config (slice C++)
[PASS] Enhanced Input mappings (code-built; verified live)
[FAIL] Controller (gamepad) support — <present/absent this session>
[FAIL] Maps/Dev/PlayerMovementTest — <LM_Scratch used as substitute; formal map deferred>
TESTS:
[PASS] Walk / sprint / crouch / jump all respond
[PASS] Mouse look correct (sensitivity sane, no inversion)
[PASS] Movement replicated-ready (character uses engine replication defaults)
[PASS] Cannot escape test geometry (walked the full house boundary)
[FAIL] <anything not true>
EXIT GATE: PASS / FAIL
BLOCKERS:
- <none, or list>
NEXT PHASE: P3–P6 regression spot-checks, then P9
```

```
PHASE: 9 (GATE B partial)
NAME: AI Perception
STATUS: PASS / FAIL / PARTIAL
DELIVERABLES:
[PASS] AI Controller + sight/hearing perception (slice C++)
[FAIL] Maps/Dev/AITest — <deferred; matrix run by hand in LM_House>
TESTS:
[PASS/FAIL] 7.1 idle honesty — no omniscient approach
[PASS/FAIL] 7.2 sight stimulus → chase
[PASS/FAIL] 7.3 lost → searches LAST KNOWN location
[PASS/FAIL] 7.4 crouch-walk silent
[PASS/FAIL] 7.5 sprint heard
[PASS/FAIL] 7.6 door sound investigated
[PASS/FAIL] 7.7 switch noise investigated
[PASS/FAIL] 7.8 hiding searched (risk present)
[PASS/FAIL] 7.9 full reset to patrol
[PASS/FAIL] 7.10 death → save restore
EXIT GATE: PASS / FAIL
BLOCKERS:
- <failed rows with one-line repros>
NEXT PHASE: <fix list → re-run, or P7 opens>
```

**Honesty reminder:** a gate report with a failing row is still a *successful session* — it produces the evidence the whole doc-14 system exists for. Only a report nobody wrote is wasted.
