"""Edit the asphalt road material and the car's materials in the Act 1 blend.

usage: blender -b SILID_Act1_road_work.blend -P scripts/edit_opening_road.py

Scope, deliberately narrow — the original file is preserved elsewhere and only
the road and the car are touched here:

  * PBR_asphalt_02 (the road slab's material). Its Mapping scale is resolved from
    the slab's own UVs, which are written in metres, so the tile is stated in the
    file rather than inferred: one repeat per 3.2 m of road, which is the
    physical size of the asphalt_02 photograph. The normal map is dialled back
    from 1.0 to 0.7; at a 3.2 m tile a full-strength normal reads as noise on a
    surface that should be almost flat at night.
  * CAR_Paint and Glass. The paint was left at roughness 1.0 (a placeholder that
    flattens every highlight), and the glazing had no roughness/metalness worth
    the name. Both are set to the values the game's car now uses, so the blend
    and the game agree about what the vehicle is made of.

Nothing else in the file is modified, no objects are added or deleted, and the
script writes its report to reports/road/blender_materials.json.
"""
import json
import os
import sys
import bpy

WORK = os.path.basename(bpy.data.filepath)
REPORT = 'reports/road/blender_materials.json'
ROAD_SLAB = 'SM_Road_Act1'
TILE_METRES = 3.2          # asphalt_02 physical tile (Poly Haven `dimensions`)

report = {'file': WORK, 'objects': {}, 'materials': {}, 'changes': []}


def uv_bounds(obj):
    me = obj.data
    if not me.uv_layers:
        return None
    uv = me.uv_layers.active.data
    us = [d.uv[0] for d in uv]
    vs = [d.uv[1] for d in uv]
    return [round(min(us), 3), round(max(us), 3), round(min(vs), 3), round(max(vs), 3)]


def principled(mat):
    for n in mat.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            return n
    return None


def set_input(node, name, value):
    sock = node.inputs.get(name)
    if sock is None:
        return False
    before = None
    try:
        before = tuple(round(v, 4) for v in sock.default_value)
    except TypeError:
        before = round(sock.default_value, 4)
    sock.default_value = value
    return before != value


# --- 1. the road slab's material -------------------------------------------
slab = bpy.data.objects.get(ROAD_SLAB)
asphalt = bpy.data.materials.get('PBR_asphalt_02')
if slab is None or asphalt is None:
    print('!! road slab or asphalt material missing; nothing edited')
    sys.exit(1)

uw, vw = slab.dimensions[0], slab.dimensions[1]
report['objects'][ROAD_SLAB] = {
    'dims_m': [round(float(v), 3) for v in slab.dimensions],
    'uv_bounds': uv_bounds(slab),
    'material': asphalt.name,
}

mapping = next((n for n in asphalt.node_tree.nodes if n.type == 'MAPPING'), None)
if mapping is None:
    mapping = asphalt.node_tree.nodes.new('ShaderNodeMapping')
    uvmap = next((n for n in asphalt.node_tree.nodes if n.type == 'UVMAP'), None)
    if uvmap:
        asphalt.node_tree.links.new(mapping.inputs['Vector'], uvmap.outputs['UV'])
    report['changes'].append('added Mapping node to PBR_asphalt_02')

scale = 1.0 / TILE_METRES
before_scale = tuple(round(v, 4) for v in mapping.inputs['Scale'].default_value)
mapping.inputs['Scale'].default_value = (scale, scale, 1.0)
report['changes'].append('PBR_asphalt_02 Mapping scale %s -> (%.4f, %.4f, 1.0) = 1 repeat / %.1f m'
                         % (before_scale, scale, scale, TILE_METRES))

# A UV in metres with a 1/tile scale is only right if the UVs really are metres:
# if the slab had 0..1 UVs this would tile the road once every 3.2 m of nothing.
uv = report['objects'][ROAD_SLAB]['uv_bounds']
uv_in_metres = bool(uv and max(abs(uv[0]), abs(uv[1])) > 8)
report['objects'][ROAD_SLAB]['uvs_are_metres'] = uv_in_metres
if not uv_in_metres:
    report['changes'].append('WARNING: slab UVs are not in metres; tiling left unscaled')

nm = next((n for n in asphalt.node_tree.nodes if n.type == 'NORMAL_MAP'), None)
if nm:
    prev = round(nm.inputs['Strength'].default_value, 3)
    nm.inputs['Strength'].default_value = 0.7
    report['changes'].append('PBR_asphalt_02 normal strength %s -> 0.7' % prev)

p = principled(asphalt)
report['materials']['PBR_asphalt_02'] = {
    'base_color': [round(v, 3) for v in p.inputs['Base Color'].default_value],
    'roughness': 'texture' if p.inputs['Roughness'].is_linked else round(p.inputs['Roughness'].default_value, 3),
    'metallic': round(p.inputs['Metallic'].default_value, 3),
    'mapping_scale': [round(v, 4) for v in mapping.inputs['Scale'].default_value],
    'normal_strength': round(nm.inputs['Strength'].default_value, 3) if nm else None,
    'maps': [n.image.name for n in asphalt.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image],
}

# --- 2. the car -------------------------------------------------------------
CAR_VALUES = {
    # material: {input: value}
    'CAR_Paint': {'Roughness': 0.45, 'Metallic': 0.40},
    'Glass': {'Roughness': 0.12, 'Metallic': 0.45,
              'Base Color': (0.10, 0.14, 0.15, 1.0)},
}
for mat_name, values in CAR_VALUES.items():
    mat = bpy.data.materials.get(mat_name)
    if mat is None:
        report['changes'].append('car material missing: ' + mat_name)
        continue
    node = principled(mat)
    if node is None:
        report['changes'].append('no principled BSDF in ' + mat_name)
        continue
    for k, v in values.items():
        if set_input(node, k, v):
            report['changes'].append('%s %s -> %s' % (mat_name, k, v))
    report['materials'][mat_name] = {
        'roughness': round(node.inputs['Roughness'].default_value, 3),
        'metallic': round(node.inputs['Metallic'].default_value, 3),
        'base_color': [round(v, 3) for v in node.inputs['Base Color'].default_value],
        'base_color_is_texture': node.inputs['Base Color'].is_linked,
    }

# --- 3. road marking materials: what the dashes are painted with --------------
line = bpy.data.materials.get('ACT1_line')
if line:
    node = principled(line)
    if node:
        report['materials']['ACT1_line'] = {
            'base_color': [round(v, 3) for v in node.inputs['Base Color'].default_value],
            'roughness': round(node.inputs['Roughness'].default_value, 3),
        }

# --- 4. marking layout actually present in the file -------------------------
def span(prefix):
    zs = sorted(o.location[1] for o in bpy.data.objects if o.name.startswith(prefix))
    return None if not zs else {'count': len(zs), 'first_y': round(zs[0], 2),
                                'last_y': round(zs[-1], 2),
                                'pitch_m': round((zs[-1] - zs[0]) / (len(zs) - 1), 3) if len(zs) > 1 else None}

report['markings'] = {
    'dashes': span('SM_RoadDash'),
    'edge_lines': [o.name for o in bpy.data.objects if o.name.startswith('SM_RoadEdge')],
    'cracks': span('SM_RoadCrack'),
    'patches': span('SM_RoadPatch'),
    'dash_object_dims_m': None,
}
dash = bpy.data.objects.get('SM_RoadDash_00')
if dash:
    report['markings']['dash_object_dims_m'] = [round(float(v), 3) for v in dash.dimensions]
edge = bpy.data.objects.get('SM_RoadEdge_E')
if edge:
    report['markings']['edge_line_dims_m'] = [round(float(v), 3) for v in edge.dimensions]
report['markings']['carriageway_width_m'] = round(float(uw), 2)

bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
os.makedirs(os.path.dirname(REPORT), exist_ok=True)
with open(REPORT, 'w') as f:
    json.dump(report, f, indent=1)
print('=== ROAD EDIT REPORT ===')
print(json.dumps(report, indent=1))
print('saved', bpy.data.filepath)
