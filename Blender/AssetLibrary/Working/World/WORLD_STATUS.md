# SILID World Build Status

Updated 2026-11-01

## Current master

`Blender/AssetLibrary/Working/World/SILID_COMPLETE_WORLD.blend` is the single continuous Blender master. Rebuild it from the repository root with:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 4.2\blender.exe' -b --factory-startup --python 'Blender/AssetLibrary/Working/World/_build/build_world.py' -- --no-render
```

The scene has 4,763 objects, 4,508 mesh objects, 4,540,458 polygons, 150 lights, 121 materials, and 233 image datablocks. The mansion has 60 rooms over the basement and four upper levels, with 79 doors and 101 windows. The Blender underground route connects the basement through a tunnel, cave, and cistern court to the forest edge.

## Current finish

The builder binds 19 licensed Poly Haven PBR material sets. Diffuse and roughness are projected in world space; normal maps use per-face UV projection in world metres. The maps and downloaded Poly Haven tree, furniture and prop assets are packed into the master file, with source records in `ASSET_LICENSES.md` and `Blender/AssetLibrary/Source/PolyHaven/`.

The forest uses textured, alpha-card Island Tree models in three foliage levels around the estate and approach; only the far perimeter uses lightweight silhouettes. One hero tree keeps its full canopy, with lighter leaf-card meshes for the rest. Leaf vertices have a gentle looping shape-key sway over a 60-frame Blender timeline. Seven Poly Haven furniture models replace prominent sofas, chairs, tables, beds and bookshelves. Room interiors now have door- and window-aware walnut dado panels, chair rails, source sconces and bedroom mirrors. The foyer and main stair receive period chandeliers; dining, kitchen, library and wine-room surfaces receive room-specific downloaded props. Uneven warm practicals add lit pockets and dark rooms for the night interior. A fitted runner and softened tread edges dress the stair flights; turned collars and restored landing rail segments complete the balustrades.

Weathered slate now covers all seven enclosed fourth-floor rooms, including the observation gallery and observatory, plus the three cross-gables. The azotea remains an intentionally open, walkable roof deck with its service hatch and ladder route. Room assignments and furniture placements are listed in `reports/world/interior_design_schedule.md`.

The master opens with its elevated three-quarter mansion camera selected and the Layout viewport in camera view. Current previews are in `Blender/AssetLibrary/Working/World/renders/`: site plan, road, mansion front, ground-floor layout, foyer, cave connector, cistern court, stair, roofscape and first-floor dining, kitchen, library, wine-room and bedroom views.

## Validation

Run the automated scene audit with:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 4.2\blender.exe' -b 'Blender/AssetLibrary/Working/World/SILID_COMPLETE_WORLD.blend' --python 'Blender/AssetLibrary/Working/World/_build/validate_world.py'
```

The last recorded audit (before the latest room finish and roof additions) reported 28 checks passed and 0 failed. It covered room floors and head clearance, stairs and roof access, furniture placement and doorway clearance, packed PBR maps, scene budget, and underground route continuity. The latest saved scene has not been rerun through that audit; no in-game runtime test has been completed.

## Remaining art work

This is a detailed, furnished full-world base, not a photoreal final. Preview renders are low-sample review views; the night lighting and narrow room cameras still leave some spaces difficult to read. The far tree perimeter still uses simplified silhouettes, and the mansion facade proportions and repeated room props need further authored detail and wear. The open azotea is intentionally not roofed. Exterior capiz windows have modeled louvered shutter leaves. The Blender cistern service door is a static set piece; the file does not implement game interaction. No final runtime export or performance check on the target i5 machine has been completed.


