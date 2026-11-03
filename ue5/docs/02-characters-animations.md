# 02 — Characters & Animation (no character designer required)

Goal (spec §2–3): realistic, replaceable characters with full animation coverage, built from MetaHuman / Reallusion / licensed libraries — never hand-modeled, never hand-animated from scratch.

---

## 1. The replaceable-mesh contract

`ASILIDCharacter` (exists) owns gameplay only. Visual identity is injected via `PDA_CharacterDef` (§01 doc §4):

```
PDA_CharacterDef
├─ SkeletalMesh            (MetaHuman / Reallusion / Fab import)
├─ AnimInstanceClass        (one shared ABP_SILID, see §4)
├─ FirstPersonArms          (mesh + anim class override)
├─ PersonaSoundSet          (breathing, effort, voice tags)
├─ HeightAdjust / CameraOffset / FootstepSurfaceMap
└─ MetaHumanQualityTier     (Full / Lite — see §6 perf)
```

**Law:** gameplay code references `PDA_CharacterDef`, never a mesh. Swapping the protagonist from MetaHuman "A" to Reallusion "B" or a custom sculpt is a data-asset edit — the spec's Player→Mesh→Clothing→AnimBP→Equipment→Inventory→Gameplay stack is realized as: components attach to the actor, the AnimBP targets the shared skeleton, and the mesh is one property.

## 2. Source decision (verified June 2025 licensing)

| Option | License status | Use for |
|---|---|---|
| **MetaHuman** | Covered by the **standard Unreal Engine EULA since MetaHuman 5.6 (June 2025)** — free to use for teams under $1M revenue; legacy MetaHuman EULA no longer the gate | **Primary.** All player presets, the protagonist, NPC family photos/cutscene humans |
| **Reallusion Character Creator / iClone** | Paid tool + **paid per-item game-embedding licenses** for content; EULA restricts **runtime player-driven re-skinning** of CC content | Optional NPC variants with fixed looks; only if a specific face/outfit isn't achievable in MetaHuman |
| **Fab sculpted characters** | Per-asset Fab Standard/Professional license (ledger) | The Resident, if a non-human look is wanted |

**Decision:** MetaHuman-first. Reasons beyond cost: shared skeleton across all MetaHumans means **one AnimBP retargets to every character** (huge solo win), and runtime customization (multiplayer character customization, spec §2) is legally clean — Reallusion explicitly disallows arbitrary player modification at runtime.

> Record in the ledger (`07-asset-licenses.md`): engine version at import, MetaHuman plugin version, and the EULA basis (UE EULA § MetaHuman).

## 3. Character production pipeline (per character, ~0.5–1 day)

1. **MetaHuman Creator** (cloud): face/body/clothing from presets → download variants via Fab/Quixel Bridge into the project (choose LODs; enable the MetaHuman plugin matching engine version).
2. **Slim it:** strip grooms if the character never appears in close-up cutscenes; use card-based hair or MetaHuman's Lite tier for gameplay.
3. **First-person:** use MetaHuman arms (hide body parts above neck) **or** a dedicated Fab first-person-arms pack bound to the same skeleton. Camera at head bone + `HeightAdjust`; hands IK to interactables (§5).
4. **Clothing:** MetaHuman outfit presets; fabric motion via Chaos Cloth only on hero characters — static clothing otherwise.
5. **Ledger + folder:** `Content/ThirdParty/MetaHuman/<Name>/…` (ThirdParty isolation, 09 doc §2).

**The Resident (enemy):** a MetaHuman or Fab character with a distinct `PDA_CharacterDef` + enemy AnimBP variant (hunched idle, crawl/attack overlays from licensed packs). Identity (human? spirit? effigy?) is story data — the AI controller doesn't care (spec §25).

## 4. Animation architecture — one AnimBP, skeleton-agnostic

- **`ABP_SILID`** targets the UE5/MetaHuman shared skeleton. State machine: `Idle → Walk/Run/Sprint (2D blendspaces by speed) → Crouch layer → Jump/Fall/Land → Interact overlays → Damage → Hiding → Downed/Revive`.
- **Anim Layers** (UE5) separate player-enemy variants without duplicating graphs: base locomotion layer + `EnemyLayer` (Resident gait) + `FPArmsLayer`.
- **Interaction overlays** via slot `UpperBody`/`FullBody`: pickup, door, drawer, tool-use, reload, shoot, melee, revive — one montage set per action family, retargeted once. **Contextual variants (2026-09-28 request §73):** important interactions get montage ROWS, not one generic clip — door (slow / fast / cautious / forced), drawer (normal / jammed / broken), generator (inspect / repair / install-component / refuel / start) — selected by the interactable's state + player context (crouch, injury, urgency) through the existing interface; the interaction contract stays one code path, the MONTAGE is what varies.
- **Control Rig post-process (procedural, no keyframes):**
  - Foot IK on stairs/uneven floors (raycast + two-bone IK)
  - Hand IK to `InteractionSocket` on doors/drawers/tools (this is what makes "integrated naturally" true: the hand reaches the actual handle)
  - Head-look toward focus/noise sources; procedural lean into acceleration
- **Motion Matching (Pose Search)** is the stretch goal for locomotion fluidity with a large locomotion pack; a plain state machine + blendspaces ships first (simpler, deterministic, co-op-safe).

### Animation sources (no manual animation)

| Need | Source | License note |
|---|---|---|
| Locomotion (walk/run/sprint/crouch/jump/fall) | UE5 mannequin content + Fab locomotion packs (e.g. Kubold "Movement Animset Pro"-style packs) | Fab per-asset license → ledger |
| Interact/pickup/tool/reload/melee | Fab interaction packs + Reallusion iClone exports where owned | Ledger; fixed-look rule N/A (no faces) |
| Damage/death/hiding/revive | Fab packs; hide = simple enter/exit montages | Ledger |
| Facial (story VO scenes, optional) | **MetaHuman Animator** (iPhone capture) or UE audio-driven facial animation | Included with MetaHuman |
| Climbing / vehicles | Scope-check first: climbing ladder + one garage-vehicle interaction; if a pack lacks it → fallback ladder (§7 of 00-overview): scripted volume-based climb, no full anim set | — |

**Integration law:** every gameplay-relevant animation event (footstep, hit confirm, drawer latch) is an **Anim Notify** → `NoiseEmitterComponent` / gameplay delegate. Animations are never allowed to contain logic; gameplay never polls animation state. This is the same "physics noise attracts AI" rule from the slice, now driven from notifies.

### 4a. Blender's role in the animation pipeline (2026-09-28 request §19)

The buy-first law (00 §7) governs animation exactly as it governs meshes: **licensed packs first** (§4 sources), Blender only for the gaps. When Blender IS the tool:

- **Workflow:** rig in Blender (Rigify) or import the character's existing rig → animate → export FBX with the project's shared-skeleton naming → retarget in UE5 via IK Rig to the shared skeleton → the AnimBP never changes. Props/interactable-specific anims (a specific drawer, the safe mechanism, a custom door) are the common Blender case — no licensed pack carries *your* furniture.
- **Provenance:** every `.blend` animation source file gets a ledger row (07 §1a — project-owned); packs they extend keep their own rows.
- **Constraints:** gameplay-facing anims stay simple (state-machine compatible — no mesh-dependent baking); Blender-authored clips must retarget to at least the MetaHuman shared skeleton or they are content-only (cutscene). Mocap-style realism comes from MetaHuman Animator and packs, not hand-keying — hand-keyed walk cycles are the last resort of the fallback ladder.
- **Trigger list (from the request's §19 animation list):** door/drawer/search/repair/tool-use interact montages tied to SILID's own prop geometry — everything else (locomotion, crouch, jump, melee, reload, hide, revive) ships from licensed sets.

## 5. First-person specifics

- Body hidden in FP (engine standard); FP arms mesh from `PDA_CharacterDef.FirstPersonArms` with its own lightweight AnimBP (aim offsets + interact IK only).
- Flashlight/tool/weapon attach to `hand_r` socket; recoil = Control Rig procedural + camera shake, no custom anims.
- **Body awareness (2026-09-28 request §74):** the player inhabits a physical body — visible FP arms at rest and in motion, legs when looking down (simple leg mesh + locomotion-driven), head-bob/breathing layers tied to stamina and the §05-doc stress row, injury affecting hand steadiness. Subtlety is capped by the P26 comfort/accessibility rules: every layer has an intensity scalar and can be disabled — presence, not motion sickness.
- Third-person (co-op partners) uses the full MetaHuman + same ABP — the co-op requirement is why the character stack is data-driven from day one.
- **Cinematic law (2026-09-28 request §120):** any cinematic moment (story beats, endings) uses the actual game assets, characters, lighting, and systems in-engine — Sequencer over game geometry, interactive scenes over gameplay camera; **never separate "fake" environments built for cinematics.**

## 6. Performance rules (characters are the heaviest thing in the game)

- MetaHuman **Lite** tier for all co-op players; Full tier only for the protagonist/close-up NPC if needed.
- LOD chain intact (MetaHumans ship LODs); grooms off in gameplay (groom hair ≫ budget; card hair for gameplay, grooms optional in cutscenes).
- Skinned meshes do **not** use Nanite — keep skeletal part counts low; static clothing props can be Nanite.
- One AnimBP class; per-instance data (not per-class) for variant costs.
- Tick-free: ABP driven by movement data the character already updates.

## 7. Acceptance criteria

- [ ] Protagonist + 4 co-op presets + 1 Resident all run through `PDA_CharacterDef` with zero C++ changes
- [ ] Swapping any character's mesh changes nothing else (test: swap mid-sprint in PIE)
- [ ] Hand IK reaches door handles/drawer pulls on at least 3 prop types
- [ ] Footstep notifies → noise events → AI hears (verified with a scripted AI listen test)
- [ ] FP arms + TP body coexist for remote players without visual glitches
- [ ] Every imported character/anim pack has a ledger row in `07-asset-licenses.md`
