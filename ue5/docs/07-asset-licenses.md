# 07 — Asset Management & License Ledger (verified 2025 facts)

Goal (spec §23): every third-party asset recorded; nothing ripped, stolen, pirated, or license-incompatible. **The ledger is a ship-blocker: no ledger row, no build.**

---

## 1. Verified licensing facts (researched September 2026, cross-checked June 2025 changes)

| Source | License | Cost | Notes |
|---|---|---|---|
| **Unreal Engine** | Unreal EULA: 5% royalty after **US$1M lifetime revenue per product** | Free until then | Applies per product |
| **MetaHuman** (since MetaHuman 5.6, **June 2025**) | Covered by the **standard Unreal Engine EULA** — free to use, including commercial, for teams under the $1M threshold; usable in engines beyond UE per newer terms | Free (under EULA) | Old separate MetaHuman license superseded; record engine/plugin version in ledger anyway |
| **Megascans / Quixel Bridge** | **Free-for-all period ended Dec 31, 2024. Since 2025: paid** via Fab under the **Fab Standard License**; assets *claimed* during the free window remain usable per the Transition FAQ | Paid (per asset/collection) | Don't promise "free Megascans" anywhere; Bridge migrating to Fab |
| **Fab marketplace** | **Standard license** (default): royalty-free commercial use in interactive products, no attribution required, no player-modification sublicensing; **Personal vs Professional** purchase tiers for many packs (indie vs. >$200K revenue/company tiers) | Varies | Per-asset rows in ledger: tier purchased + invoice ref |
| **Poly Haven** | **CC0** (public domain): commercial OK, **no attribution required** (attribution still good practice) | Free | Textures, HDRIs, models, audio (Poly Haven mixes) |
| **Sonniss GDC game audio packs** | Royalty-free **commercial** use in games; yearly dumps "GDC Game Audio Bundle" | Free (as published) | Ledger: bundle year + URL |
| **Reallusion CC/iClone content** | Paid **game-embedding license per content item**; runtime player-driven re-skinning restricted | Paid (tool + per-content) | Fixed-look characters only; see 02 doc §2 |
| **Mixamo** | Adobe terms: free for use in your projects/animations; **redistribution of raw assets prohibited**; exporting to UE for use in a game is the intended flow | Free | No re-selling the animations as assets |
| **Epic content examples / engine samples** | Per-sample EULAs, generally usable in UE projects | Free | Check each sample's EULA box in the launcher |

> **Re-verify before each purchase** — marketplace terms change. Record the *date checked* per row. Anything unclear → e-mail the vendor; screenshot the answer into `ue5/docs/licenses-communication/`.

### 1a. Blender-authored (in-house) assets (spec request §1)

Assets modeled in **Blender** are project-owned: no third-party license applies to the mesh itself. They still get a **ledger row** — the ledger is a provenance record, not just a payment record — so the milestone audits (§3 step 4: every shipped asset must trace to a row) don't flag in-house meshes as orphans:

```
BL-XXXX,(asset name),Blender (in-house),n/a,Project-owned (original work),n/a,
<date checked = creation date>,0,,<used for>,Content/SILID/... + .blend path,5.4,no,
<provenance: .blend file path; note any scanned photo reference and its license>
```

Rules: (1) the `.blend` source file path goes in `notes` and the blend file ships in `Content/SILID/Blender/…` mirroring game folders (doc 19 §13.4); (2) if a Blender asset was sculpted from, traced over, or textured with **derived sources** (photo references, scanned textures, purchased brushes), those sources get their **own ledger rows** — the in-house row covers only original work; (3) Blender-authored content must never embed ripped or illegally extracted game data (§2 applies fully); (4) export presets/naming follow doc 19 §13.2/13.4 so QC can tie `SM_…` game assets back to their blend sources by name.

## 2. Prohibited (hard rules)

- Ripped game assets (models/textures/sounds from any shipped game)
- Pirated marketplace packs, license-sharing across studios
- "Personal use only" assets in the commercial build
- AI-generated assets trained on scraped data where the vendor can't warrant output rights (project decision: avoid; the identity of SILID is hand-sourced + licensed)
- Any asset whose EULA forbids the intended use (e.g. player-driven customization of Reallusion content)

## 3. The ledger (maintained in `ue5/docs/asset-ledger.csv`)

### CSV columns

```
id, asset_name, source, source_url, license_name, license_url,
license_version_or_date_checked, cost_usd, purchase_invoice_ref,
used_for, content_path, engine_version, attribution_required,
dependencies, replacement_status, notes
```

### Seed rows (fill as assets are added — start of project)

```csv
id,asset_name,source,source_url,license_name,license_url,license_version_or_date_checked,cost_usd,purchase_invoice_ref,used_for,content_path,engine_version,attribution_required,notes
UE-ENGINE,Unreal Engine 5.4,Epic,https://www.unrealengine.com,Unreal EULA (5% royalty after $1M/product),https://www.unrealengine.com/en-US/eula,2026-09-27,0,,whole game,,5.4,no,royalty after $1M per product
UE-METAHUMAN,MetaHuman Creator 5.6,Epic,https://metahuman.com,Unreal EULA (MH under UE EULA since 5.6),https://www.unrealengine.com/eula/mhc,2026-09-27,0,,protagonist + co-op presets + Resident,Content/ThirdParty/MetaHuman/,5.6,no,record plugin version per import
PH-TEX-PACK,Poly Haven textures (selected set),Poly Haven,https://polyhaven.com,CC0,https://polyhaven.com/faq,2026-09-27,0,,plaster/wood/concrete/fabric surfaces,Content/ThirdParty/PolyHaven/,5.4,no (goodwill note in credits),per-file list maintained in folder
SONNISS-GDC,Sonniss GDC Audio Bundle 2025,Sonniss,https://sonniss.com/gameaudiogdc,royalty-free commercial (Sonniss terms),https://sonniss.com/gameaudiogdc,2026-09-27,0,,foley/ambience/weather layers,Content/ThirdParty/Sonniss/,5.4,no,bundle year matters - keep the bundle zip archived
MIXAMO-ANIM,Mixamo locomotion set (if used),Adobe,https://www.mixamo.com,Adobe Mixamo terms,https://www.adobe.com/legal/terms.html,2026-09-27,0,,locomotion retarget source,Content/ThirdParty/Mixamo/,5.4,no,no redistribution of raw assets
FAB-XXXX,(example row template) Fab pack — FILL ON PURCHASE,Fab,https://fab.com,Fab Standard,https://fab.com/licensing,<date checked>,<cost>,<invoice id>,<system>,<content path>,5.4,no,<re-verify terms at purchase>
```

### Process

1. **Before import:** check license, add row with date-checked; unclear → vendor email first.
2. **At import:** content path lives under `Content/ThirdParty/<Source>/…` (09 doc §2 isolation rule) — the audit is path-based.
3. **At ship:** regenerate the ledger (sorted by source), generate a credits screen from rows where `attribution_required=yes`, archive invoices + the Sonniss bundle zips + vendor email screenshots in the project's legal folder (outside git or in LFS).
4. **Audits:** every milestone (08 doc), grep content folders for orphan assets (no ledger row) — untracked assets are removed, not retro-licensed.

## 4. Attribution & credits policy

- In-game credits screen + project page list: "Built with Unreal Engine", Poly Haven (courtesy, not required), purchased-pack creators (as their license requests), Sonniss (courtesy).
- No asset creator is misrepresented; no "everything made by us" claims. The ledger is the source of truth for the credits generator.

## 5. LLM/AI content note (current-reality guard)

If any tool-assisted texture or text is ever used, the *vendor's* output-rights terms are recorded in the ledger like any other source. Project default remains: licensed human-made + engine-generated content only (keeps the chain simple and defensible).

## 6. Acceptance criteria

- [ ] Every content folder under `Content/ThirdParty/<Source>/…` maps to ≥ 1 ledger row by path prefix
- [ ] Zero assets without `license_url` + `date_checked`
- [ ] Invoices archived for every `cost_usd > 0` row
- [ ] Credits screen generated from the ledger, reviewed at RC
