# 10 — Mood Reference: "AFRAID" (target atmosphere)

Derived from the reference screenshot (attic interior at night): warm single-source light grazing dusty walls, near-black void filled with drifting dust motes, heavy dark vignette crushing the frame edges, and a small serif emotional-state caption — **AFRAID** — in the lower-left.

This is the bar every lighting/post/UI pass is checked against (04 doc owns the systems; this doc owns the *feel*).

---

## 1. What the reference establishes

| Element | Reading | Rule for SILID |
|---|---|---|
| **One warm source** | A single unseen amber lamp grazes the wall from upper-left; everything else falls to black | Most rooms: one hero warm source + darkness. Never multiple competing ambient sources at rest |
| **True blacks** | The void is near-pure black, not gray haze | Darkness means *darkness*. Auto-exposure biased low; no fog wash, no ambient fill lifting shadows |
| **Dust as the atmosphere** | Motes drift through the dark; speckled spatter texture on walls/ceiling | Dust is the game's air: motes in light cones (Niagara), speckle/mold in wall masters (03 doc weathering params) |
| **Warm/decayed palette** | Amber key (#c9a06a-range), brown-black shadows, aged wood | LUT direction: warm highlights, desaturated mids, cool-less shadows; nothing clean or white |
| **Vignette-driven framing** | Heavy dark red-brown vignette eats the frame edges | Vignette ~0.4+ baseline, tinted warm-dark; it tightens as fear rises (below) |
| **State as typography** | "AFRAID" — small, serif, letterspaced, lowercase field in the HUD corner | Fear made visible with one word, no bars or icons (below) |

## 2. The fear-state pipeline (the "AFRAID" label, made systemic)

The caption is a readout of a protagonist **fear state** — wire it, don't paint it:

- **Inputs (all existing signals):** AI proximity/state (`EResidentState` + distance), darkness (local light level on player), stamina/exhaustion, damage, story events (RoomDirector severity tags: Ambient→Unsettling→Violating — already data-driven in the slice).
- **Aggregation:** `USILIDFearComponent` (small, on the character) computes Fear 0–1 from weighted inputs (weights in `DA_DifficultyProfile` — fear tuning is data, per difficulty).
- **Outputs:**
  - HUD word ladder (data asset): `CALM → UNEASY → AFRAID → TERRIFIED` — the reference's typography, exactly one word, serif, letterspaced, lower-left.
  - Post: vignette intensity, subtle heartbeat audio layer (MetaSound param), breath foley rate, camera micro-sway — all scaled by Fear.
  - Gameplay hooks (optional, difficulty-gated): high fear raises footstep noise loudness (shaky steps) and slows interact hold-speed — fear costs you, honestly.
- Fear is **never fake**: it only reads real stimuli (AI honesty law applies to the UI too).

## 3. UE5 recipe to hit the reference (concrete)

- **Lighting:** one warm PointLight/RectLight per room at rest (temp ~4200–4800K), Lumen GI; flashlight is the only cool-neutral source; emergency lights slightly green-shifted (different fear flavor). Shadow softness via VSM; flicker profiles on dying fixtures (04 doc §4).
- **Exposure:** manual-ish — min EV low, max EV capped so lit pockets stay warm and darks crush; avoid eye-adaptation pumping (kills dread) — lock adaptation speed slow.
- **Post:** film grain low but present; vignette base 0.4 warm-dark; local exposure for lamp-vs-void contrast; DOF subtle on examine camera; chromatic aberration reserved for damage/fear spikes.
- **Fog:** exponential height fog near-zero indoors; darkness carries the mood, not haze.
- **Dust:** global Niagara motes with wind/draft parameters (weather hook, 04 doc §3) + master-material speckle/mold params on walls/ceilings (03 doc §4) — both are *parameters*, not bespoke per-room art.
- **Audio bed:** room tone + house-settle creaks under everything; fear raises the heartbeat/breath layer only (04 doc §1).

## 4. The parity test

Blockout room + one lamp + one mote system must survive the screenshot A/B:

- [ ] Screenshot next to the reference: same warmth, same true-black void, same mote visibility, same edge crush
- [ ] One-word fear label legible at lower-left, serif, no bars/icons
- [ ] Fear rises from real stimuli only (walk at lit AI vs. hide in dark: label responds correctly)
- [ ] No gray lift anywhere in shadow (histogram check: darks near 0)
- [ ] 30-second idle in the room feels heavy, not empty — if it feels empty, add house-settle audio, not light

## 5. The darkness-floor law (2026-09-28 — refines §1's "true blacks")

**Scope reconciliation:** §1's true blacks describe the MOOD of lit pockets (the lamp-vs-void contrast that makes the AFRAID frame); they are **not** a license for unplayable rooms. The binding rule for every unlit space:

> **The player must always retain enough visual information to navigate and decide.** At the darkest legal point they can still tell floor from wall, find the door, place themselves in the room, and spot large obstacles and silhouettes. If they cannot, the lighting is too dark — raise the ambient floor (Skylight/moonlight ingress, door-crack light, exterior bleed, emergency sources), never force staring at a black screen.

- **Power off ≠ black:** ambient remains — moonlit windows with silhouettes and recognizable layouts, light under doors, exterior light entering rooms, emergency/battery/candle sources, reflective lift. Gradients of darkness, not one flat black; per-area tiers (04 §4a rule 2) keep rooms distinguishable.
- **Uncertainty is the product — "I can see something in that hallway, but I can't see everything."** Partial information creates tension; zero information creates frustration, which is a defect, not horror.
- **Forbidden:** complete black rooms/screens, artificial darkness overlays, excessive vignette as a darkness substitute, and darkness used to hide collision problems or bad assets. Darkness must come from the actual lighting environment.
- **Eye adaptation is subtle:** dark entry reads darker for a beat, then ambient detail emerges slightly — never exaggerated, never sudden clarity (the §3 exposure recipe already locks slow adaptation; this sets its intent).
- **The flashlight is the first reliable CONTROLLED light, not the only vision source** — significant advantage (inspect/read/search), no room wash, battery economy as landed (warnings before death, never sudden cut-off).
- **Parity additions:** the §4 test gains two rows — [ ] darkest room passes the visibility floor (floor/wall/door/silhouette identifiable) · [ ] power-restore A/B is an obvious transformation (04 §4a rule 5).
