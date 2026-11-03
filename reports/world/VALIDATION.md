# SILID_COMPLETE_WORLD — validation

Run against the saved master file. 29 checks, 0 failed, 1 warnings.

| check | result | measurement |
|---|---|---|
| master collection | **PASS** | all 18 collections present |
| stair reaches the fourth floor | **PASS** | tread extremes 0.12 m .. 11.60 m (expected 0.10 .. 11.60) |
| stair head clearance | **PASS** | minimum 3.55 m above the treads at (-2.87, 9.06, 8.0) (STAIR_Treads) |
| roof covers every closed pavilion | **PASS** | 7 of 7 pavilions covered |
| ladder landing height | **PASS** | landing top at 11.52 m (azotea 11.60) |
| ladder stands clear of the wall | **PASS** | nothing obstructs the climb |
| hatch opening in the parapet | **PASS** | through the gap: 11.82 m (F3_Ceiling); beside it: 12.84 m (DECK_BalustradeRail) |
| furniture stands on its floor | **PASS** | 280 pieces checked, 0 floating, 0 sunk |
| furniture stays inside its room | **PASS** | 0 outside room bounds |
| doorways are clear of furniture | **PASS** | 0 pieces in a door approach |
| surface props rest on their supports | **PASS** | 140 surface props checked, 0 floating or sunk |
| every visible mesh has a material | **PASS** | 0 without a material |
| no inverted closed shells | **PASS** | 0 meshes with negative volume |
| no empty meshes | **PASS** | 0 empty meshes |
| licensed PBR maps are packed | **PASS** | 367 image nodes, 195 unique maps, 0 unpacked |
| scene budget | **WARN** | 4866 objects, 6177363 polygons, 150 lights, 117 materials, 210 images |
| car is on the carriageway shoulder | **PASS** | car 3.58 m from the road centreline |
| present: terrain | **PASS** | bounds x -200.0..200.0  y -190.0..210.0  z -1.6..0.0 |
| present: carriageway | **PASS** | bounds x -69.4..-55.1  y -175.0..215.0  z 0.1..0.1 |
| present: drive | **PASS** | bounds x -58.5..2.1  y 11.3..34.5  z 0.0..0.1 |
| present: mansion shell | **PASS** | bounds x -24.2..21.2  y -14.9..14.7  z 0.0..4.2 |
| present: roof | **PASS** | bounds x -24.1..16.2  y -12.1..12.1  z 14.6..18.5 |
| present: ladder | **PASS** | bounds x -12.9..-12.1  y -11.5..-11.0  z 0.1..12.9 |
| present: stairs | **PASS** | bounds x -5.0..-2.3  y 4.2..9.2  z 0.1..11.6 |
| present: stair hall | **PASS** | bounds x -24.0..20.5  y -11.1..11.1  z 0.0..4.2 |
| basement-to-forest underground connector | **PASS** | six connected sections, service door and both route endpoints present |
| basement has no daylight windows | **PASS** | 0 mesh(es) |
| every room has its floor slab | **PASS** | 0 rooms without a floor at their level |
| every room has head clearance | **PASS** | 0 rooms under 2.15 m to the ceiling |
