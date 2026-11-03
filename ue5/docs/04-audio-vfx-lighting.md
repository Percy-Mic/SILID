# 04 — Audio, VFX & Lighting (no sound designer, no VFX artist)

Goal (spec §12–14): professional dynamic audio and weather/lighting from MetaSounds, Niagara, and UE5 lighting systems + licensed libraries. The existing `USILIDAudioDirector` is the code anchor.

---

## 1. Audio architecture (MetaSounds-first)

### Sources (all licensed — no custom recording sessions)

| Category | Source | Notes |
|---|---|---|
| Footsteps/surface impacts, cloth, breathing | Fab foley packs; **Sonniss GDC packs** (free, commercial, yearly dumps — ledger with year/link) | Surface-mapped: wood/concrete/tile/grass |
| Doors, drawers, latches, keys, metal | Fab SFX packs, Poly Haven audio (CC0) | One family per prop class |
| Generator, electrical buzz, fluorescent flicker, fuse | Fab "mechanical/electrical" packs | Loop + start/stop layers |
| Rain (light/heavy on tin roof!), wind, thunder | Sonniss/Fab weather packs | **Tin-roof rain is a Filipino identity sound** — priority buy |
| House ambience (creaks, settling, animal scratch) | Sonniss/Fab/Poly Haven | Layered, time-of-power-dependent |
| Enemy vocals/breath | Fab creature/vocal packs, pitched/processed | Identity is story data (§25) |
| Music/stingers | Fab horror music packs, or free CC0 via Sonniss/OpenGameArt (ledger) | `USILIDAudioDirector` ducks music under stingers (exists) |
| VO (optional later) | MetaHuman Animator facial + own recordings, or skip VO | Text-first story keeps VO optional |

### MetaSound graph rules

- **`MS_Footstep_Surfaces`** — one MetaSound, physical-surface switch inputs; Anim Notifies send surface tag (§02 doc §4).
- **`MS_Door`**, **`MS_Drawer`**, **`MS_Generator`** — state-driven (open amount, latch hit, fuel level, RPM), exposed parameters set from C++/BP props. No one-shot Cues for continuous machines.
- **`MS_Rain_Exterior`** — intensity-driven (drizzle→downpour), roof material switch (tin), interior LPF/occlusion crossfade.
- **`USILIDAudioDirector`** (exists): ambient layering by room tag + power state, 3D stingers, music ducking; MetaSounds get exposed parameters from room data (`DA_RoomDef.AmbienceLayer`).

### Spatial behavior (engine features, zero custom code)

- **Sound Attenuation** assets per family (footsteps small radius, generator huge, alarm bigger).
- **Occlusion/Reverb:** UE5 built-in spatial settings; reverb zones per room from `DA_RoomDef.ReverbZone` (basement = stone, sala = wood). Simple volume occlusion raycast in `USILIDAudioDirector` (1 Hz, not per-frame).
- **Honest audio:** the AI hears the same attenuation radii the player hears — one `FSILIDNoiseEvent{Location, Loudness, Tag, Radius}` (exists) drives both audio presentation and AI perception. No separate "gameplay noise" fiction.

## 2. VFX (Niagara systems, library-first)

| System | Approach |
|---|---|
| Rain + splash | Niagara rain (Fab/Niagara library) + roof splash emitters; intensity parameter from weather system |
| Fog/dust motes | Volumetric fog (engine) + local Niagara dust sheets in dusty rooms; motes in flashlight cones |
| Electrical | Sparks (Niagara), fluorescent flicker (light script + audio), fuse-blow puff |
| Generator exhaust | Smoke wisp emitter, state-driven |
| Fire (candles/emergency) | Niagara flame pack; candle lights are gameplay (power-independent light) |
| Water | Drips (post-rain), puddle decals + master-material wetness; tabo pour effect on water restore |
| Blood/damage | Kept minimal and diegetic (survival horror, not shooter) — one Niagara pack |

Rules: every Niagara system is a project asset **parameterized by intensity**, and every emitter inherits the weather vector (shared wind parameter). No per-room bespoke emitters beyond dust placement.

## 3. Weather system (gameplay-integrated, spec §13)

A small `WeatherSubsystem` (WorldSubsystem): states `Clear / Drizzle / Heavy / Storm`, each a `PDA_WeatherProfile { RainIntensity, WindVector, ThunderRate, AudioLayer, ExteriorLightTemp, PuddleLevel, AISoundScale }`.

- **Gameplay hooks (why weather matters):** rain masks player footsteps partially (AISoundScale < 1 on outdoor-noise events), storm thunder covers generator start (the one loud thing you can't hide — sometimes you wait for thunder to mask it), wetness makes surfaces slippery-noisy (higher footstep loudness on tile), exterior visibility drops (fog + darkness).
- RoomDirector may trigger story weather beats via data (`DA_Story.TriggerCondition`).
- The web game's storm/lightning ambience maps here (port map, 08 doc).
- **Day/night with gameplay weight (2026-09-28 request §38):** the directional/sky curves above are driven by a time-of-day profile; periods carry data rows (visibility curve, ambience layer, **patrol/aggression weighting via difficulty data — never direct AI writes**, escape-availability modifiers through the route grammar). Never cosmetic by law: if a period changes nothing gameplay-readable, the period doesn't ship.
- **Seasons as configuration (§39):** rainy/dry/storm season = config layer over the existing `PDA_WeatherProfile` set (frequency weights, `AISoundScale` bias, mud = surface-noise rows on outdoor PhysicalSurfaces, overgrowth = dressing/PCG data 19 §4a). Config-only; the same map supports all conditions (post-M1.5).
- **Wildlife as ambience + distraction, not simulation (§40):** insects/birds/rats/frogs/bats = audio layers (04 §1 sources), small Niagara/ambient critters, and rare scripted distraction events emitted through the noise bus (a rat skitter IS a noise event the AI may investigate — honest, and a player learnable tool). No wildlife AI ecosystem; the request's own caveat adopted.
- **The tension arc & the silence law (2026-09-28 requests §74, §117–119):** the director's layer composition follows the pacing arc — **Safety → Exploration → Suspicion → Threat → Chase → Escape → Temporary Safety** — and **silence is a mandated layer**: deliberate low/no-music periods where ambience, house creaks, breathing, rain, and electrical hum carry the tension alone. No looping horror track; music intensity responds to AI distance / chase state / player health / darkness through the existing state data, transitioning subtly enough to stay unnoticed ("Did I actually hear something?" is the target — unexplained noises, distant attenuated footsteps, and sounds-from-another-floor ride the honest noise bus, so they are *usually* real).
- **Horror direction law (2026-09-28 requests §80–81, §114–115):** horror comes from **anticipation, uncertainty, vulnerability, sound, environment, and consequence** — the systemic sources (RoomDirector mutations, noise-bus events, power state, the AI's honest behavior) carry the load, with director-style moments bound to **cooldowns, context requirements, and probability controls as data rows** — never spammed. Jumpscares are RARE BY LAW, and the never-list is binding: no constant loud stingers, no random images covering the screen, no fake system errors, no unavoidable scripted attacks, no excessive camera shake. Framing/composition does quiet work: authored sightlines, doorway silhouettes, partially visible rooms, tunnel perspectives (03 §1's loop law is what makes "what the player thinks they saw" possible); reflective surfaces (mirrors, windows, wet floors) used sparingly and honestly — reflections reveal real world state (Lumen SSR/planar where budgeted), never scripted mirror scares.

## 4. Lighting design (Lumen + VSM, gameplay-integrated)

### Fixtures (all are PowerConsumers or independent)

| Fixture | Power-dependent | Gameplay role |
|---|---|---|
| Fluorescent + E27 bulbs | Yes (per-room power node) | Reveals room; **also helps AI see you** (§05 doc AI vision scale by light) |
| Ceiling fan light combos | Yes | Sala/kwarto anchor fixtures |
| Emergency lights | Battery-backed (independent) | Post-power-loss fallback in hallway/electrical room |
| Flashlight (component, exists) | Battery | Player-controlled; battery economy (D-cells) |
| Candles, gasera | No | Player-placed safe light; limited count; can be blown out by wind gusts (weather hook) |
| Exterior security light | Yes + CCTV node | Backyard/garage visibility |
| Broken/flickering | Per-fixture `FlickerProfile` | Misdirection; AI investigates flicker events (noise-tagged) |

### Rules

- **VSM everywhere** (interior = many small shadowed lights), Lumen GI for bounce; emissive materials do fake glow, shadow only for hero fixtures — keeps light count sane.
- One **ExponentialHeightFog + volumetric** global; per-room fog via local fog volumes in basement/tunnel only.
- Post-process: film grain + vignette subtle, chromatic aberration only on damage; color graded per power state via LUT (cold-dead house → warm-alive house when power restored — the restore is *felt*).
- Day→night + storm curves owned by the WeatherSubsystem (§3) driving directional light/sky; interior mostly power-driven.

### 4a. Playable darkness (2026-09-28 request — binding for every map pass + the P25 gate)

Darkness is gameplay, never blindness. **The visibility floor (doc 10 §5):** at the darkest legal point the player can still identify walls, floors, furniture, doors, stairs, large objects, silhouettes, and hazards — enough to make a reasonable gameplay decision. Pure black screens, artificial darkness overlays, and darkness that hides collision or bad assets are forbidden (doc 10 §1's "true blacks" governs LIT pockets, not unlit rooms).

| # | Rule |
|---|---|
| 1 | **Ambient floors:** no power ≠ no light — Skylight/moonlight through windows, light ingress under/through doors, exterior sources (street/security/garage/railway/neighbor lights) entering nearby rooms, emergency/battery/candle sources (§4 table), subtle equipment glow, reflective-surface lift. Gradients of darkness, never one flat black |
| 2 | **Per-area tiers** (authored `DA_RoomDef` light data): windowed rooms brightest, interior hallway near-floor, small-window bathroom moderate, basement/extremely low, attic slivers, garage gaps, tunnels lowest with occasional environmental illumination — the house must never read as uniformly dark |
| 3 | **Exposure discipline:** slow eye adaptation on dark entry (detail emerges over a beat — never exaggerated, never sudden clarity); min/max EV capped so darks crush without graying to mush; Lumen GI bounce carries indirect response; no adaptation pumping |
| 4 | **Flashlight discipline:** significant advantage without room wash — realistic beam distance + falloff, peripheral darkness retained, useful cone in front, surroundings stay uncertain. Battery economy stays as landed (gradual drain, flicker + indicator + audio warnings, replaceable) — never sudden cut-off |
| 5 | **The restore contrast gate:** power-off (moonlight/silhouettes/beam/emergency sources) vs power-on (ceiling fixtures, lamps, appliance glow, CCTV, powered machinery) must be an immediately readable transformation — "the house has changed" is the acceptance sentence; the §4 LUT cold-dead→warm-alive shift is checked as an A/B at the P8/P25 gates |
| 6 | **AI obeys the same visibility rules (05 §5.4):** sight scales with local light on BOTH sides — darkness penalizes detection but is never invisibility, flashlight-on is easier to spot at range/angle, and the AI never receives magical position signals in darkness. The honesty law covers the dark |
| 7 | **Darkness creates choices (A-017 lens):** use the flashlight? risk the dark hallway? flip a light and be seen? wait for daylight? restore the generator? — if a dark area produces no decision, it is tuned wrong |

## 5. Acceptance criteria

- [ ] Every sound plays through MetaSounds/attenuation assets; no raw wave plays unpositioned
- [ ] AI hears exactly what the audio presents (shared noise event struct — audit test)
- [ ] Storm changes gameplay: masked footsteps test + thunder-masked generator start works
- [ ] Power restore visibly+audibly transforms the house (LUT, ambience layer, fixture states)
- [ ] Light count per area within budget (03 doc §7); VSM cost verified at 1080p mid-GPU
- [ ] **Playable-darkness check (§4a):** per-area tier census recorded; darkest room passes the visibility floor (player can name floor/wall/door/silhouette); restore A/B contrast obvious; no pure-black interiors anywhere
- [ ] All audio/VFX/lighting assets have ledger rows (07 doc)
