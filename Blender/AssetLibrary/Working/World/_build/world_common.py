"""SILID_COMPLETE_WORLD — shared build library.

One coordinate system, one material set, one way to make a mesh.

The game is authored in metres with +x east, +z north and +y up. Blender is
Z-up, so every number in this package stays in GAME coordinates and is mapped
once, here:

    Blender (X, Y, Z) = game (x, z, y)

That is a rotation about X by -90 degrees, not a mirror: east stays east and
north becomes +Y. Read a dimension in plan.js, type it unchanged.

Everything is built from closed boxes and closed slabs. That matters for more
than tidiness: `mesh.validate()` plus `recalc_face_normals` on a closed shell
cannot leave a roof plane or a wall facing into the house, which is the class of
error that made the east cross-gable invisible in the game before it was fixed.
"""

import math
import os
import random

import bmesh
import bpy
from mathutils import Vector

ROOT_NAME = 'SILID_COMPLETE_WORLD'

# The master collection tree the brief asks for. Order matters only for the
# outliner; every builder links into one of these by name.
TOP_COLLECTIONS = [
    'WORLD_MASTER',
    'ROAD_ENVIRONMENT',
    'VEHICLE_BREAKDOWN',
    'FOREST_ENVIRONMENT',
    'FOREST_VEGETATION',
    'MANSION_EXTERIOR',
    'UNDERGROUND_ENVIRONMENT',
    'MANSION_GROUND_FLOOR',
    'MANSION_SECOND_FLOOR',
    'MANSION_THIRD_FLOOR',
    'MANSION_FOURTH_FLOOR',
    'MANSION_ROOF',
    'MANSION_COURTYARD',
    'MANSION_STAIRS',
    'MANSION_DOORS_WINDOWS',
    'MANSION_FURNITURE',
    'MANSION_PROPS',
    'GAMEPLAY_OBJECTS',
    'LIGHTING',
    'CAMERAS',
    'ANIMATIONS',
    'COLLISION',
    'EXPORT_ASSETS',
]

# Level id -> the collection its walls and floors belong in.
LEVEL_COLLECTION = {
    'B1': 'MANSION_FOURTH_FLOOR',      # service cellar, kept with the service wing
    'GF': 'MANSION_GROUND_FLOOR',
    'F2': 'MANSION_SECOND_FLOOR',
    'F3': 'MANSION_THIRD_FLOOR',
    'F4': 'MANSION_FOURTH_FLOOR',
}


# --- scene and collections -------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    return scene


def build_collections():
    scene = bpy.context.scene
    root = bpy.data.collections.new(ROOT_NAME)
    scene.collection.children.link(root)
    made = {}
    for name in TOP_COLLECTIONS:
        c = bpy.data.collections.new(name)
        root.children.link(c)
        made[name] = c
    return root, made


def sub_collection(parent, name):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c


def empty(name, coll, x=0.0, y=0.0, z=0.0, size=0.6, props=None):
    """An organizer at a game-space point; not rendered."""
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'PLAIN_AXES'
    e.empty_display_size = size
    e.location = (x, z, y)          # game -> Blender
    if props:
        for k, v in props.items():
            e[k] = v
    coll.objects.link(e)
    return e


# --- materials -------------------------------------------------------------
MAT = {}


def _srgb(hex_color):
    """0xRRGGBB -> linear-ish RGB floats. Blender takes linear; the sRGB curve
    on a dark night palette is close enough to identity not to fight here."""
    r = ((hex_color >> 16) & 255) / 255.0
    g = ((hex_color >> 8) & 255) / 255.0
    b = (hex_color & 255) / 255.0
    return (r, g, b, 1.0)


def material(name, color, rough=0.7, metal=0.0, noise=None, bump=0.0,
             alpha=1.0, emission=None, emission_strength=0.0, sheen=0.0):
    """A Principled surface with a restrained procedural grain.

    `noise` is (scale, strength): the scale is in metres, so a wall gets a 14 m
    mottle and a board gets a 1.4 m one. The noise does not tint the object into
    a different colour, it only breaks up a flat render.
    """
    if name in MAT:
        return MAT[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    out.location = (520, 0)
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (240, 0)
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    base = _srgb(color)
    bsdf.inputs['Base Color'].default_value = base
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if 'Sheen Weight' in bsdf.inputs:
        bsdf.inputs['Sheen Weight'].default_value = sheen
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        mat.blend_method = 'BLEND'
        mat.show_transparent_back = True
    if emission:
        bsdf.inputs['Emission Color'].default_value = _srgb(emission)
        bsdf.inputs['Emission Strength'].default_value = emission_strength

    if noise:
        scale, strength = noise
        tex = nodes.new('ShaderNodeTexCoord')
        tex.location = (-620, 0)
        n = nodes.new('ShaderNodeTexNoise')
        n.location = (-400, 0)
        n.inputs['Scale'].default_value = 1.0 / max(0.05, scale)
        n.inputs['Detail'].default_value = 5.0
        n.inputs['Roughness'].default_value = 0.62
        links.new(tex.outputs['Object'], n.inputs['Vector'])
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.location = (-180, 80)
        d = 1.0 - strength
        ramp.color_ramp.elements[0].color = tuple(c * d for c in base[:3]) + (1.0,)
        ramp.color_ramp.elements[1].color = tuple(min(1.0, c * (1.0 + strength * 0.6)) for c in base[:3]) + (1.0,)
        ramp.color_ramp.elements[0].position = 0.32
        ramp.color_ramp.elements[1].position = 0.72
        links.new(n.outputs['Fac'], ramp.inputs['Fac'])
        links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
        if bump:
            b = nodes.new('ShaderNodeBump')
            b.location = (0, -220)
            b.inputs['Strength'].default_value = bump
            b.inputs['Distance'].default_value = 0.06
            links.new(n.outputs['Fac'], b.inputs['Height'])
            links.new(b.outputs['Normal'], bsdf.inputs['Normal'])

    MAT[name] = mat
    return mat


def tint_by_object(mat, a, b, fac=0.55):
    """Break up shared vegetation meshes without duplicating materials.

    Every tree of one archetype shares a mesh and therefore a material. Without
    this, a canopy is the same green 250 times and the forest reads as a
    pattern. Object Info's Random output differs per object, so one material can
    carry a whole hillside of slightly different trees at no draw-call cost.
    """
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    if not bsdf or not bsdf.inputs['Base Color'].links:
        return
    src = bsdf.inputs['Base Color'].links[0].from_socket
    info = nt.nodes.new('ShaderNodeObjectInfo')
    info.location = (-420, -320)
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.location = (-230, -320)
    ramp.color_ramp.elements[0].color = _srgb(a)
    ramp.color_ramp.elements[1].color = _srgb(b)
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.location = (0, -320)
    mix.inputs['Factor'].default_value = fac
    nt.links.new(src, mix.inputs[6])
    nt.links.new(info.outputs['Random'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])


def palette():
    """The mansion's materials, derived from the values the game uses.

    These are the same families facade.js and materials.js work in: rusticated
    stone below, limewashed render and dark narra above, weathered galvanised
    iron on every roof. Values are deliberately low-saturation because the whole
    world is seen at night.
    """
    # Values are kept low on purpose. Under a 1.5-strength moon and AgX, a
    # 0xb9b4a4 limewash clips to paper white and the house reads as an
    # architectural model; eighty years of smoke and rain put it nearer 0x6f.
    material('stone', 0x5c574d, rough=0.92, noise=(2.6, 0.26), bump=0.4)
    material('stone_dark', 0x403d36, rough=0.95, noise=(2.2, 0.2), bump=0.32)
    material('lime', 0x7b766a, rough=0.9, noise=(5.0, 0.2), bump=0.2)
    material('plaster_blue', 0x3f4f56, rough=0.86, noise=(4.0, 0.16), bump=0.1)
    material('plaster_warm', 0x6f644f, rough=0.88, noise=(4.5, 0.16), bump=0.1)
    material('wallpaper', 0x3c463a, rough=0.9, noise=(1.6, 0.22), bump=0.05)
    material('wood_timber', 0x352b23, rough=0.72, noise=(1.8, 0.3), bump=0.3)
    material('wood_narra', 0x3e271c, rough=0.42, noise=(1.3, 0.24), bump=0.22)
    material('wood_dark', 0x200f09, rough=0.5, noise=(1.1, 0.2), bump=0.18)
    material('wood_floor', 0x3b2c1e, rough=0.55, noise=(1.5, 0.3), bump=0.25)
    material('wood_floor_old', 0x332517, rough=0.62, noise=(1.4, 0.32), bump=0.3)
    material('concrete', 0x57554e, rough=0.95, noise=(3.2, 0.16), bump=0.28)
    material('underground_brick', 0x55453a, rough=0.94, noise=(2.6, 0.18), bump=0.16)
    material('underground_rock', 0x494840, rough=0.97, noise=(1.8, 0.16), bump=0.22)
    material('concrete_floor', 0x5a5850, rough=0.93, noise=(2.4, 0.14), bump=0.2)
    material('roof_iron', 0x646b69, rough=0.55, metal=0.5, noise=(0.55, 0.22), bump=0.4)
    material('roof_slate', 0x464844, rough=0.88, noise=(1.8, 0.18), bump=0.2)
    material('roof_rust', 0x6a4a37, rough=0.85, metal=0.2, noise=(0.8, 0.3), bump=0.4)
    material('iron', 0x1b1c1d, rough=0.46, metal=0.7, noise=(1.2, 0.12))
    material('brass', 0x8a6a33, rough=0.32, metal=0.9)
    material('capiz', 0xd6c5a2, rough=0.62, alpha=0.78, emission=0x3a2a12, emission_strength=0.12)
    material('glass', 0x8fa2a0, rough=0.08, metal=0.1, alpha=0.35, emission=0x2a1c0c, emission_strength=0.25)
    material('ground', 0x33382a, rough=0.97, noise=(3.0, 0.3), bump=0.2)
    material('asphalt', 0x27282a, rough=0.9, noise=(1.4, 0.18), bump=0.3)
    material('gravel', 0x4f4c42, rough=0.96, noise=(1.0, 0.3), bump=0.35)
    material('water', 0x1b2b2c, rough=0.08, metal=0.2)
    material('foliage', 0x2b3a22, rough=0.88, noise=(0.9, 0.3))
    material('foliage_light', 0x39492c, rough=0.9, noise=(0.8, 0.28))
    material('bark', 0x2e2820, rough=0.95, noise=(0.7, 0.3), bump=0.4)
    material('bamboo', 0x59603b, rough=0.8, noise=(0.5, 0.2))
    material('cloth_dark', 0x241f1b, rough=0.95)
    material('velvet', 0x3a2420, rough=0.85)
    material('linen', 0x7d7462, rough=0.9)
    material('porcelain', 0x9c9a8f, rough=0.2)
    material('brass_lamp', 0x6e5526, rough=0.35, metal=0.85)
    material('light_warm', 0xffd29a, rough=0.5, emission=0xffc785, emission_strength=6.0)
    material('lamp_glass', 0xd8c49a, rough=0.3, alpha=0.6, emission=0xffcf94, emission_strength=3.0)
    material('paint_car', 0x2b322c, rough=0.38, metal=0.06)
    material('tyre', 0x0d0d0e, rough=0.94)
    material('chrome', 0xb6b6ae, rough=0.22, metal=1.0)
    material('car_glass', 0x1a2426, rough=0.09, metal=0.2, alpha=0.55)
    material('tail_light', 0x5a0d0d, rough=0.28, emission=0x8a1010, emission_strength=2.0)
    material('head_light', 0xffe6b8, rough=0.15, emission=0xffe2b4, emission_strength=8.0)
    tint_by_object(MAT['foliage'], 0xb9d0a2, 0x7f9a72, 0.5)
    tint_by_object(MAT['foliage_light'], 0xc7d7a8, 0x8fae76, 0.45)
    tint_by_object(MAT['bark'], 0xb0a898, 0x6f6a5e, 0.4)
    return MAT


def bind_environment_textures():
    """Bind the project's licensed tileable PBR maps to the master materials.

    Geometry.Position gives consistent metre-scale projection even on the
    builder's merged, UV-free meshes. Image files stay in the licensed source
    library and are packed into the .blend so the master opens independently.
    """
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..'))
    library = os.path.join(root, 'Blender', 'AssetLibrary', 'Source', 'PolyHaven')
    bindings = [
        ('asphalt', 'asphalt_02', 'asphalt_02_diff_2k.jpg', 'asphalt_02_rough_2k.jpg', 'asphalt_02_nor_gl_2k.jpg', 3.2),
        ('ground_field', 'forrest_ground_01', 'forrest_ground_01_diff_1k.jpg', 'forrest_ground_01_rough_1k.jpg', 'forrest_ground_01_nor_gl_1k.jpg', 5.0),
        ('plaster_blue', 'blue_plaster_weathered', 'blue_plaster_weathered_diff_1k.jpg', 'blue_plaster_weathered_rough_1k.jpg', 'blue_plaster_weathered_nor_gl_1k.jpg', 2.4),
        ('concrete', 'concrete_wall_003', 'concrete_wall_003_diff_1k.jpg', 'concrete_wall_003_rough_1k.jpg', 'concrete_wall_003_nor_gl_1k.jpg', 2.6),
        ('underground_brick', 'brick_wall_006', 'brick_wall_006_diff_1k.jpg', 'brick_wall_006_rough_1k.jpg', 'brick_wall_006_nor_gl_1k.jpg', 2.4),
        ('underground_rock', 'concrete_wall_007', 'concrete_wall_007_diff_1k.jpg', 'concrete_wall_007_rough_1k.jpg', 'concrete_wall_007_nor_gl_1k.jpg', 2.2),
        ('stone', 'concrete_wall_003', 'concrete_wall_003_diff_1k.jpg', 'concrete_wall_003_rough_1k.jpg', 'concrete_wall_003_nor_gl_1k.jpg', 2.6),
        ('lime', 'damaged_plaster', 'damaged_plaster_diff_1k.jpg', 'damaged_plaster_rough_1k.jpg', 'damaged_plaster_nor_gl_1k.jpg', 2.0),
        ('wood_timber', 'wood_planks_grey', 'wood_planks_grey_diff_1k.jpg', 'wood_planks_grey_rough_1k.jpg', 'wood_planks_grey_nor_gl_1k.jpg', 2.4),
        ('wood_narra', 'wood_planks_dirt', 'wood_planks_dirt_diff_1k.jpg', 'wood_planks_dirt_rough_1k.jpg', 'wood_planks_dirt_nor_gl_1k.jpg', 2.4),
        ('wallpaper', 'decrepit_wallpaper', 'decrepit_wallpaper_diff_1k.jpg', 'decrepit_wallpaper_rough_1k.jpg', 'decrepit_wallpaper_nor_gl_1k.jpg', 2.0),
        ('plaster_warm', 'damaged_plaster', 'damaged_plaster_diff_1k.jpg', 'damaged_plaster_rough_1k.jpg', 'damaged_plaster_nor_gl_1k.jpg', 2.0),
        ('wood_floor', 'old_wooden_floor_01', 'old_wooden_floor_01_diff_1k.jpg', 'old_wooden_floor_01_rough_1k.jpg', 'old_wooden_floor_01_nor_gl_1k.jpg', 3.0),
        ('wood_floor_old', 'old_wooden_floor_01', 'old_wooden_floor_01_diff_1k.jpg', 'old_wooden_floor_01_rough_1k.jpg', 'old_wooden_floor_01_nor_gl_1k.jpg', 3.0),
        ('concrete_floor', 'concrete_floor_worn_001', 'concrete_floor_worn_001_diff_1k.jpg', 'concrete_floor_worn_001_rough_1k.jpg', 'concrete_floor_worn_001_nor_gl_1k.jpg', 2.6),
        ('roof_iron', 'corrugated_iron_02', 'corrugated_iron_02_diff_1k.jpg', 'corrugated_iron_02_rough_1k.jpg', 'corrugated_iron_02_nor_gl_1k.jpg', 2.0),
        ('roof_slate', 'roof_slates_03', 'roof_slates_03_diff_1k.jpg', 'roof_slates_03_rough_1k.jpg', 'roof_slates_03_nor_gl_1k.jpg', 3.0),
        ('roof_rust', 'rusty_metal_sheet', 'rusty_metal_sheet_diff_1k.jpg', 'rusty_metal_sheet_rough_1k.jpg', 'rusty_metal_sheet_nor_gl_1k.jpg', 1.6),
        ('bark', 'tree_bark_03', 'tree_bark_03_diff_1k.jpg', 'tree_bark_03_rough_1k.jpg', 'tree_bark_03_nor_gl_1k.jpg', 1.0),
    ]
    loaded_images = {}
    linked = 0
    for mat_name, slug, diffuse_name, rough_name, normal_name, tile_metres in bindings:
        mat = bpy.data.materials.get(mat_name)
        diffuse_path = os.path.join(library, slug, diffuse_name)
        rough_path = os.path.join(library, slug, rough_name)
        normal_path = os.path.join(library, slug, normal_name)
        if not mat or not os.path.isfile(diffuse_path) or not os.path.isfile(rough_path) or not os.path.isfile(normal_path):
            print('[SILID-WORLD] texture skipped:', mat_name, flush=True)
            continue
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf:
            continue
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        geo = nodes.new('ShaderNodeNewGeometry')
        geo.label = 'World-space triplanar PBR'
        geo.location = (-1150, 20)
        pos = nodes.new('ShaderNodeVectorMath')
        pos.operation = 'SCALE'
        pos.inputs['Scale'].default_value = 1.0 / tile_metres
        pos.location = (-970, 80)
        links.new(geo.outputs['Position'], pos.inputs[0])
        psep = nodes.new('ShaderNodeSeparateXYZ')
        psep.location = (-790, 100)
        links.new(pos.outputs['Vector'], psep.inputs['Vector'])
        nsep = nodes.new('ShaderNodeSeparateXYZ')
        nsep.location = (-970, -260)
        links.new(geo.outputs['Normal'], nsep.inputs['Vector'])

        weights = []
        for idx, axis in enumerate(('X', 'Y', 'Z')):
            absolute = nodes.new('ShaderNodeMath')
            absolute.operation = 'ABSOLUTE'
            absolute.location = (-770, -250 - idx * 55)
            links.new(nsep.outputs[axis], absolute.inputs[0])
            weights.append(absolute)
        xy_sum = nodes.new('ShaderNodeMath')
        xy_sum.operation = 'ADD'
        xy_sum.location = (-590, -340)
        links.new(weights[0].outputs[0], xy_sum.inputs[0])
        links.new(weights[1].outputs[0], xy_sum.inputs[1])
        safe_xy_sum = nodes.new('ShaderNodeMath')
        safe_xy_sum.operation = 'MAXIMUM'
        safe_xy_sum.inputs[1].default_value = 0.0001
        safe_xy_sum.location = (-410, -150)
        links.new(xy_sum.outputs[0], safe_xy_sum.inputs[0])
        total = nodes.new('ShaderNodeMath')
        total.operation = 'ADD'
        total.location = (-410, -340)
        links.new(xy_sum.outputs[0], total.inputs[0])
        links.new(weights[2].outputs[0], total.inputs[1])

        def ratio(numerator, denominator, x, y):
            node = nodes.new('ShaderNodeMath')
            node.operation = 'DIVIDE'
            node.location = (x, y)
            links.new(numerator.outputs[0], node.inputs[0])
            links.new(denominator.outputs[0], node.inputs[1])
            return node

        wx = ratio(weights[1], safe_xy_sum, -230, -180)
        wz = ratio(weights[2], total, -230, -320)
        coords = (
            ('X', 'Y', 'Z'),  # X-facing planes use YZ
            ('Y', 'X', 'Z'),  # Y-facing planes use XZ
            ('Z', 'X', 'Y'),  # horizontal planes use XY
        )

        def sample(filename, colorspace, row):
            planes = []
            for i, (label, u, v) in enumerate(coords):
                combine = nodes.new('ShaderNodeCombineXYZ')
                combine.location = (-600, row + i * 90)
                links.new(psep.outputs[u], combine.inputs['X'])
                links.new(psep.outputs[v], combine.inputs['Y'])
                img_path = os.path.join(library, slug, filename)
                img = loaded_images.get(img_path)
                if img is None:
                    img = bpy.data.images.load(img_path, check_existing=True)
                    if not img.packed_file:
                        img.pack()
                    img.filepath = '//../../../../Blender/AssetLibrary/Source/PolyHaven/%s/%s' % (slug, filename)
                    img.colorspace_settings.name = colorspace
                    loaded_images[img_path] = img
                tex = nodes.new('ShaderNodeTexImage')
                tex.image = img
                tex.extension = 'REPEAT'
                tex.label = '%s %s-plane | %.1f m tile' % (slug, label, tile_metres)
                tex.location = (-370, row + i * 90)
                links.new(combine.outputs['Vector'], tex.inputs['Vector'])
                planes.append(tex)
            horizontal = nodes.new('ShaderNodeMixRGB')
            horizontal.blend_type = 'MIX'
            horizontal.location = (-100, row + 40)
            links.new(wx.outputs[0], horizontal.inputs[0])
            links.new(planes[0].outputs['Color'], horizontal.inputs[1])
            links.new(planes[1].outputs['Color'], horizontal.inputs[2])
            mixed = nodes.new('ShaderNodeMixRGB')
            mixed.blend_type = 'MIX'
            mixed.location = (100, row + 40)
            links.new(wz.outputs[0], mixed.inputs[0])
            links.new(horizontal.outputs['Color'], mixed.inputs[1])
            links.new(planes[2].outputs['Color'], mixed.inputs[2])
            return mixed

        diffuse = sample(diffuse_name, 'sRGB', 440)
        roughness = sample(rough_name, 'Non-Color', -520)
        old_base_link = next((link.from_socket for link in links
                              if link.to_socket == bsdf.inputs['Base Color']), None)
        old_rough = float(bsdf.inputs['Roughness'].default_value)
        tint = nodes.new('ShaderNodeMixRGB')
        tint.blend_type = 'MIX'
        tint.inputs[0].default_value = 0.38
        tint.location = (330, 350)
        if old_base_link:
            links.new(old_base_link, tint.inputs[1])
        else:
            tint.inputs[1].default_value = bsdf.inputs['Base Color'].default_value
        links.new(diffuse.outputs['Color'], tint.inputs[2])
        links.new(tint.outputs['Color'], bsdf.inputs['Base Color'])
        rough_mix = nodes.new('ShaderNodeMixRGB')
        rough_mix.blend_type = 'MIX'
        rough_mix.inputs[0].default_value = 0.32
        rough_mix.inputs[1].default_value = (old_rough, old_rough, old_rough, 1.0)
        rough_mix.location = (330, -220)
        links.new(roughness.outputs['Color'], rough_mix.inputs[2])
        links.new(rough_mix.outputs['Color'], bsdf.inputs['Roughness'])
        # The mesh UVs are projected per face in world metres. Use the same
        # metre scale as the triplanar color and roughness maps.
        img = loaded_images.get(normal_path)
        if img is None:
            img = bpy.data.images.load(normal_path, check_existing=True)
            if not img.packed_file:
                img.pack()
            img.filepath = '//../../../../Blender/AssetLibrary/Source/PolyHaven/%s/%s' % (slug, normal_name)
            img.colorspace_settings.name = 'Non-Color'
            loaded_images[normal_path] = img
        uv = nodes.new('ShaderNodeTexCoord')
        uv.location = (-600, -780)
        mapping = nodes.new('ShaderNodeMapping')
        mapping.location = (-390, -780)
        mapping.inputs['Scale'].default_value = (1.0 / tile_metres, 1.0 / tile_metres, 1.0)
        links.new(uv.outputs['UV'], mapping.inputs['Vector'])
        normal_tex = nodes.new('ShaderNodeTexImage')
        normal_tex.image = img
        normal_tex.extension = 'REPEAT'
        normal_tex.label = '%s normal | %.1f m tile' % (slug, tile_metres)
        normal_tex.location = (-150, -780)
        links.new(mapping.outputs['Vector'], normal_tex.inputs['Vector'])
        normal = nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value = 0.4
        normal.location = (80, -780)
        links.new(normal_tex.outputs['Color'], normal.inputs['Color'])
        bump_node = next((n for n in nodes if n.type == 'BUMP' and n.inputs.get('Normal').is_linked), None)
        normal_target = bump_node.inputs['Normal'] if bump_node else bsdf.inputs['Normal']
        links.new(normal.outputs['Normal'], normal_target)
        linked += 1
    print('[SILID-WORLD] PBR texture sets bound:', linked, flush=True)



# --- geometry --------------------------------------------------------------
class Bucket:
    """Accumulates closed shells in game coordinates for one material.

    One bucket becomes one mesh. A floor's plaster walls are one object, its
    joinerys another; that is what keeps a 60-room house inside a frame budget
    without making the outliner unreadable.
    """

    def __init__(self):
        self.verts = []
        self.faces = []

    def __len__(self):
        return len(self.faces)

    def box(self, x0, x1, z0, z1, y0, y1):
        if x1 < x0:
            x0, x1 = x1, x0
        if z1 < z0:
            z0, z1 = z1, z0
        if y1 < y0:
            y0, y1 = y1, y0
        if x1 - x0 < 1e-4 or z1 - z0 < 1e-4 or y1 - y0 < 1e-4:
            return
        i = len(self.verts)
        self.verts += [
            (x0, z0, y0), (x1, z0, y0), (x1, z1, y0), (x0, z1, y0),
            (x0, z0, y1), (x1, z0, y1), (x1, z1, y1), (x0, z1, y1),
        ]
        self.faces += [
            (i + 0, i + 3, i + 2, i + 1),
            (i + 4, i + 5, i + 6, i + 7),
            (i + 0, i + 1, i + 5, i + 4),
            (i + 1, i + 2, i + 6, i + 5),
            (i + 2, i + 3, i + 7, i + 6),
            (i + 3, i + 0, i + 4, i + 7),
        ]

    def prism(self, corners, thickness, axis='y'):
        """A closed slab from a four-point top face.

        `corners` are four (x, z, y) points in game space, wound so the face
        normal points out. The slab is extruded by `thickness` along -axis; the
        default is down, which is the only direction a roof sheet, a tread or a
        landing ever has thickness.
        """
        if len(corners) != 4:
            raise ValueError('prism takes four corners')
        i = len(self.verts)
        off = (0.0, 0.0, -thickness) if axis == 'y' else (-thickness, 0.0, 0.0)
        for p in corners:
            self.verts.append(tuple(p))
        for p in corners:
            self.verts.append((p[0] + off[0], p[1] + off[1], p[2] + off[2]))
        self.faces.append((i, i + 1, i + 2, i + 3))
        self.faces.append((i + 4, i + 7, i + 6, i + 5))
        for k in range(4):
            a, b = i + k, i + (k + 1) % 4
            self.faces.append((a, b, b + 4, a + 4))

    def tri_prism(self, corners, thickness, axis='y'):
        """A closed triangular prism (gable ends, hip ends)."""
        if len(corners) != 3:
            raise ValueError('tri_prism takes three corners')
        i = len(self.verts)
        off = (0.0, 0.0, -thickness) if axis == 'y' else (-thickness, 0.0, 0.0)
        for p in corners:
            self.verts.append(tuple(p))
        for p in corners:
            self.verts.append((p[0] + off[0], p[1] + off[1], p[2] + off[2]))
        self.faces.append((i, i + 1, i + 2))
        self.faces.append((i + 3, i + 5, i + 4))
        for k in range(3):
            a, b = i + k, i + (k + 1) % 3
            self.faces.append((a, b, b + 3, a + 3))

    def cylinder(self, cx, cz, y0, y1, r, seg=10):
        """A vertical prism: posts, tank legs, chimney pots, bollards."""
        i = len(self.verts)
        for k in range(seg):
            a = 2 * math.pi * k / seg
            self.verts.append((cx + r * math.cos(a), cz + r * math.sin(a), y0))
        for k in range(seg):
            a = 2 * math.pi * k / seg
            self.verts.append((cx + r * math.cos(a), cz + r * math.sin(a), y1))
        for k in range(seg):
            a, b = k, (k + 1) % seg
            self.faces.append((i + a, i + b, i + seg + b, i + seg + a))
        self.faces.append(tuple(range(i + seg, i + 2 * seg))[::-1])
        self.faces.append(tuple(range(i, i + seg)))

    def beam(self, p0, p1, w, h, axis='x'):
        """A rectangular member between two points in a vertical plane.

        Used for handrails, strings, wires-as-bars and small branches. `axis`
        is the direction the width is measured in; the height is vertical.
        """
        x0, z0, y0 = p0
        x1, z1, y1 = p1
        dx, dz, dy = x1 - x0, z1 - z0, y1 - y0
        length = math.sqrt(dx * dx + dz * dz + dy * dy)
        if length < 1e-4:
            return
        # perpendicular in plan, so the member has width across its run
        px, pz = -dz / length, dx / length
        if abs(px) < 1e-6 and abs(pz) < 1e-6:
            px, pz = 1.0, 0.0
        i = len(self.verts)
        for sy in (-h / 2, h / 2):
            for sx in (-w / 2, w / 2):
                self.verts.append((x0 + px * sx, z0 + pz * sx, y0 + sy))
                self.verts.append((x1 + px * sx, z1 + pz * sx, y1 + sy))
        # 0,1 = start w-, 2,3 = start w+? order: (-w,-h),(-w,+h),(+w,-h),(+w,+h)
        v = [i + 0, i + 1, i + 2, i + 3, i + 4, i + 5, i + 6, i + 7]
        # indices: 0 start(-w,-h) 1 start(-w,+h) 2 start(+w,-h) 3 start(+w,+h)
        #          4 end(-w,-h)   5 end(-w,+h)   6 end(+w,-h)   7 end(+w,+h)
        self.faces += [
            (v[0], v[2], v[6], v[4]),
            (v[1], v[5], v[7], v[3]),
            (v[0], v[4], v[5], v[1]),
            (v[2], v[3], v[7], v[6]),
            (v[0], v[1], v[3], v[2]),
            (v[4], v[6], v[7], v[5]),
        ]


def world_uv(me):
    """Project metre-scale UVs per face, preserving a consistent tile size."""
    layer = me.uv_layers.get('WorldMetres') or me.uv_layers.new(name='WorldMetres')
    me.update()
    for poly in me.polygons:
        nx, ny, nz = poly.normal
        if abs(nx) >= abs(ny) and abs(nx) >= abs(nz):
            uaxis, vaxis = 1, 2
            sign = 1.0 if nx >= 0 else -1.0
        elif abs(ny) >= abs(nz):
            uaxis, vaxis = 0, 2
            sign = -1.0 if ny >= 0 else 1.0
        else:
            uaxis, vaxis = 0, 1
            sign = 1.0 if nz >= 0 else -1.0
        for loop_index in poly.loop_indices:
            vertex = me.vertices[me.loops[loop_index].vertex_index].co
            layer.data[loop_index].uv = (vertex[uaxis], vertex[vaxis] * sign)


def make_mesh(name, bucket, mat, coll, smooth=False):
    if not bucket.verts:
        return None
    me = bpy.data.meshes.new(name)
    me.from_pydata(bucket.verts, [], bucket.faces)
    me.validate(verbose=False)
    me.update()
    if mat:
        me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    world_uv(me)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return ob


def recalc(ob):
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()


# --- wall runs -------------------------------------------------------------
def subtract_spans(a0, a1, gaps):
    """Split [a0,a1] around a list of (u0,u1) openings. Returns solid spans."""
    spans = [(a0, a1)]
    for g0, g1 in gaps:
        out = []
        for s0, s1 in spans:
            if g1 <= s0 or g0 >= s1:
                out.append((s0, s1))
                continue
            if g0 > s0:
                out.append((s0, g0))
            if g1 < s1:
                out.append((g1, s1))
        spans = out
    return [(s0, s1) for s0, s1 in spans if s1 - s0 > 1e-4]


def wall_run(bucket, axis, c, a0, a1, thickness, y0, y1, openings=None,
             fill_material_sill=True):
    """One wall on a plan line, with real openings cut through it.

    `axis` follows plan.js: 'x' is a wall running along X at z = c, 'z' is a
    wall running along Z at x = c. `openings` is [(a0, a1, yOpen0, yOpen1)] —
    doorways go to the floor, windows start at the sill, and every opening gets
    a lintel above it so the wall still carries the floor over it.
    """
    openings = openings or []
    lo = c - thickness / 2.0
    hi = c + thickness / 2.0
    spans = subtract_spans(a0, a1, [(o[0], o[1]) for o in openings])
    for s0, s1 in spans:
        if axis == 'x':
            bucket.box(s0, s1, lo, hi, y0, y1)
        else:
            bucket.box(lo, hi, s0, s1, y0, y1)
    for o0, o1, oy0, oy1 in openings:
        oy0 = max(y0, oy0)
        oy1 = min(y1, oy1)
        if oy1 - oy0 < 1e-4:
            continue
        # head over the opening
        if oy1 < y1 - 1e-4:
            if axis == 'x':
                bucket.box(o0, o1, lo, hi, oy1, y1)
            else:
                bucket.box(lo, hi, o0, o1, oy1, y1)
        # sill under a window
        if oy0 > y0 + 1e-4:
            if axis == 'x':
                bucket.box(o0, o1, lo, hi, y0, oy0)
            else:
                bucket.box(lo, hi, o0, o1, y0, oy0)


# --- terrain ---------------------------------------------------------------
def _smooth(t):
    if t <= 0:
        return 0.0
    if t >= 1:
        return 1.0
    return t * t * (3 - 2 * t)


def _rect_mask(x, z, x0, x1, z0, z1, feather):
    dx = max(x0 - x, 0.0, x - x1)
    dz = max(z0 - z, 0.0, z - z1)
    d = max(dx, dz)
    return 1.0 - _smooth(d / feather)


def _rect_soft(x, z, x0, x1, z0, z1, feather):
    """Distance-based mask for the pad: no hard edge across the lawn."""
    dx = max(x0 - x, 0.0, x - x1)
    dz = max(z0 - z, 0.0, z - z1)
    d = math.hypot(dx, dz)
    return _smooth(d / feather)


class Terrain:
    """The game's analytic height field, ported line for line.

    The same function drives the Blender ground mesh, the road ribbon and every
    tree base, so there is no seam between the road, the verge and the lawn and
    nothing floats. Values mirror src/world/terrain.js; if that file changes,
    this class must change with it.
    """

    ROAD_X = -62.0
    CARRIAGE = 7.2
    GROUND_RADIUS = 190.0
    MANSION = dict(x0=-24.0, x1=22.0, z0=-11.0, z1=11.0)
    POND = dict(x=-30.0, z=46.0, r=9.5, y=-1.35)
    CAR = dict(x=-56.8, z=26.0)

    def road_center(self, z):
        return self.ROAD_X + 3.2 * math.sin((z - 10) * 0.012) + 1.4 * math.sin(z * 0.031)

    def pond_carve(self, x, z):
        d = math.hypot(x - self.POND['x'], z - self.POND['z'])
        if d > self.POND['r'] * 1.35:
            return 0.0
        t = _smooth(1 - d / (self.POND['r'] * 1.25))
        return -2.05 * t * t

    def stream_carve(self, x, z):
        ax, az, bx, bz = -10.0, 58.0, -26.0, 48.0
        dx, dz = bx - ax, bz - az
        l = dx * dx + dz * dz
        t = max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / l))
        px, pz = ax + t * dx, az + t * dz
        d = math.hypot(x - px, z - pz)
        if d > 5:
            return 0.0
        return -0.85 * _smooth(1 - d / 5)

    def cistern_carve(self, h, x, z):
        C = dict(bed=-1.56, x0=55.55, x1=62.65, z0=2.15, z1=9.85, bank=1.15)
        S = dict(x0=62.2, x1=68.9, z0=6.95, z1=8.85, runX0=61.8, runX1=67.0,
                 bottom=-1.44, top=0.85, drop=0.28)
        if S['x0'] < x < S['x1'] and S['z0'] < z < S['z1']:
            t = max(0.0, min(1.0, (x - S['runX0']) / (S['runX1'] - S['runX0'])))
            return min(h, S['bottom'] + t * (S['top'] - S['bottom']) - S['drop'])
        if h <= C['bed']:
            return h
        dx = max(C['x0'] - x, 0.0, x - C['x1'])
        dz = max(C['z0'] - z, 0.0, z - C['z1'])
        d = math.hypot(dx, dz)
        if d > C['bank']:
            return h
        t = _smooth(1 - d / C['bank'])
        return h - (h - C['bed']) * t

    def height(self, x, z):
        m = self.MANSION
        mansion_pad = _rect_mask(x, z, m['x0'] - 8, m['x1'] + 8, m['z0'] - 8, m['z1'] + 8, 12)
        road_mask = _rect_mask(x, z, self.ROAD_X - 6.5, self.ROAD_X + 6.5, -220, 220, 10)
        path_mask = _rect_mask(x, z, -18, 2, 12, 30, 8)
        flat = max(mansion_pad, road_mask, path_mask * 0.75)

        h = (0.55 * math.sin(x * 0.041 + 0.7) * math.cos(z * 0.037)
             + 0.32 * math.sin(x * 0.093 + 1.9) * math.sin(z * 0.081)
             + 0.18 * math.cos(x * 0.19 + z * 0.14))
        h += 0.9 * _smooth((x - 15) / 60) + 0.6 * _smooth((-z - 20) / 70)
        r = math.hypot(x, z)
        h += 15 * _smooth((r - self.GROUND_RADIUS) / 55)
        h = h * (1 - flat) + 0.005 * flat
        h += self.pond_carve(x, z) + self.stream_carve(x, z)

        pad = _rect_soft(x, z, m['x0'], m['x1'], m['z0'], m['z1'], 1.5)
        h = h * (1 - pad)

        rd = x - self.road_center(z)
        t = 1 - min(1.0, (rd / 4.6) ** 2)
        h += road_mask * 0.05 * max(0.0, t)
        return self.cistern_carve(h, x, z)


# --- small utilities -------------------------------------------------------
def load_plan(root):
    import json
    path = os.path.join(root, 'reports/world/world_plan.json')
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def object_bounds(ob):
    from mathutils import Vector as V
    bb = [ob.matrix_world @ V(c) for c in ob.bound_box]
    return (min(v.x for v in bb), max(v.x for v in bb),
            min(v.y for v in bb), max(v.y for v in bb),
            min(v.z for v in bb), max(v.z for v in bb))


def log(msg):
    print(f'[world] {msg}', flush=True)
