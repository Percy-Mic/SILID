"""SILID_COMPLETE_WORLD — build the whole game world in one Blender file.

    blender -b --factory-startup --python build_world.py -- [--site-only] [--no-render]

The project is assembled rather than hand-edited, so it can be rebuilt after a
change to plan.js without anybody re-typing a room. The master file is saved at
Blender/AssetLibrary/Working/World/SILID_COMPLETE_WORLD.blend.

Renders are written to Word/renders as milestone stills. They are real Cycles
renders of the actual scene, not viewport screenshots: a headless Blender has no
window to screenshot, and claiming a live viewport would be a lie.
"""

import math
import os
import sys
import time

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import world_common as W
import world_site as SITE
import world_underground as UNDERGROUND

# repo root: _build -> World -> Working -> AssetLibrary -> Blender -> SILID-main
ROOT = HERE
for _ in range(5):
    ROOT = os.path.dirname(ROOT)
WORLD_DIR = os.path.dirname(HERE)
RENDER_DIR = os.path.join(WORLD_DIR, 'renders')


def argv_flags():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return {
        'site_only': '--site-only' in args,
        'render': '--no-render' not in args,
        'quick': '--quick' in args,
    }


# --- lighting ---------------------------------------------------------------
def lighting(coll):
    scene = bpy.context.scene

    world = bpy.data.worlds.new('SILID_Night')
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Color'].default_value = (0.0075, 0.0105, 0.0145, 1.0)
    bg.inputs['Strength'].default_value = 1.0
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])

    moon = bpy.data.lights.new('MOON', 'SUN')
    moon.energy = 1.5
    moon.color = (0.62, 0.72, 0.94)
    moon.angle = math.radians(1.4)
    ob = bpy.data.objects.new('MOON', moon)
    # Light travels from the south-west, so the approach elevation is the lit
    # one. A moon behind the house leaves the front of a 46 m facade unreadable
    # at exactly the distance the player first sees it.
    direction = Vector((0.34, -0.78, -0.52))
    ob.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    coll.objects.link(ob)

    sky = bpy.data.lights.new('SKY_Fill', 'AREA')
    sky.shape = 'RECTANGLE'
    sky.size = 120
    sky.size_y = 120
    sky.energy = 320
    sky.color = (0.35, 0.45, 0.62)
    ob = bpy.data.objects.new('SKY_Fill', sky)
    ob.location = (0, 2, 70)
    coll.objects.link(ob)

    # practicals: a house at night is a few warm rooms, not a lit facade
    warm = [
        ('LAMP_Porch', 0.0, 10.2, 4.4, 180, 9),
        ('LAMP_Foyer', -3.0, 6.0, 3.2, 165, 8),
        ('LAMP_Gallery', -8.0, 0.0, 3.4, 220, 12),
        ('LAMP_GalleryEast', 2.0, 0.0, 3.4, 190, 10),
        ('LAMP_Dining', -3.0, -6.0, 3.2, 140, 8),
        ('LAMP_Living', -10.0, 6.0, 3.2, 140, 8),
        ('LAMP_StairHall', -3.6, 7.0, 7.0, 180, 8),
        ('LAMP_Master', -2.0, -6.0, 7.2, 140, 8),
        ('LAMP_Attic', -3.0, -6.0, 11.0, 110, 8),
        ('LAMP_Deck', 2.0, -8.5, 15.0, 120, 7),
        ('LAMP_Bell', 11.0, 7.0, 14.2, 90, 6),
        # a bulkhead over the service ladder: the climb has to be readable at
        # night for the same reason a real service door has a lamp over it
        ('LAMP_Ladder', -12.5, -12.5, 10.7, 150, 9),
    ]
    for name, x, z, y, power, radius in warm:
        lamp = bpy.data.lights.new(name, 'POINT')
        lamp.energy = power
        lamp.color = (1.0, 0.72, 0.44)
        lamp.shadow_soft_size = 0.18
        lamp.use_custom_distance = True
        lamp.cutoff_distance = radius
        ob = bpy.data.objects.new(name, lamp)
        ob.location = (x, z, y)      # game -> Blender
        coll.objects.link(ob)

    # the gate lamps, failing, and the car's hazards after the breakdown
    for i, (x, z, y, p) in enumerate(((-17.0, 22.0, 3.0, 60), (-10.2, 22.0, 3.0, 45))):
        lamp = bpy.data.lights.new('LAMP_Gate_%d' % i, 'POINT')
        lamp.energy = p
        lamp.color = (1.0, 0.66, 0.36)
        lamp.use_custom_distance = True
        lamp.cutoff_distance = 7
        ob = bpy.data.objects.new('LAMP_Gate_%d' % i, lamp)
        ob.location = (x, z, y)
        coll.objects.link(ob)


# --- atmosphere ------------------------------------------------------------
def atmosphere(coll):
    """Fog, and a moon you can actually see.

    The fog is a composited mist pass, not a scattering volume: it costs a few
    milliseconds instead of doubling every render, and it gives the forest the
    depth cue a night scene needs without washing the house out. The moon is a
    real emissive body in the sky, because a flat black background reads as a
    missing sky rather than as night.
    """
    scene = bpy.context.scene
    # Depth is a pass every Cycles frame already has. The mist pass is cheaper
    # to author but silently writes nothing on some builds, which is how the
    # first version of this scene ended up with no fog at all.
    scene.view_layers[0].use_pass_z = True
    scene.render.use_compositing = True
    scene.use_nodes = True
    nt = scene.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    rl.location = (-420, 0)
    mist = nt.nodes.new('CompositorNodeMapRange')
    mist.location = (-180, -160)
    mist.inputs[1].default_value = 8.0
    mist.inputs[2].default_value = 190.0
    mist.inputs[3].default_value = 0.0
    mist.inputs[4].default_value = 0.74
    nt.links.new(rl.outputs['Depth'], mist.inputs[0])
    fog = nt.nodes.new('CompositorNodeMixRGB')
    fog.location = (60, -40)
    fog.blend_type = 'MIX'
    fog.inputs[2].default_value = (0.022, 0.032, 0.047, 1.0)
    nt.links.new(mist.outputs[0], fog.inputs[0])
    nt.links.new(rl.outputs['Image'], fog.inputs[1])
    comp = nt.nodes.new('CompositorNodeComposite')
    comp.location = (320, -40)
    nt.links.new(fog.outputs[0], comp.inputs['Image'])

    me = bpy.data.meshes.new('MOON_Disc')
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=7.0)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(W.material('moon', 0xdce6f2, rough=1.0, emission=0xdfe9f6, emission_strength=22.0))
    ob = bpy.data.objects.new('MOON_Disc', me)
    ob.location = (-150, -250, 245)     # high and south: it hangs over the drive
    coll.objects.link(ob)


# --- cameras and renders ----------------------------------------------------
def camera(name, coll, x, z, y, tx, tz, ty, lens=35.0):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.sensor_width = 36
    cam.clip_start = 0.08
    cam.clip_end = 800
    ob = bpy.data.objects.new(name, cam)
    loc = Vector((x, z, y))
    ob.location = loc
    ob.rotation_euler = (Vector((tx, tz, ty)) - loc).to_track_quat('-Z', 'Y').to_euler()
    coll.objects.link(ob)
    return ob


def ortho_camera(name, coll, x, z, y, tx, tz, ty, scale):
    cam = bpy.data.cameras.new(name)
    cam.type = 'ORTHO'
    cam.ortho_scale = scale
    cam.clip_start = 0.1
    cam.clip_end = 900
    ob = bpy.data.objects.new(name, cam)
    loc = Vector((x, z, y))
    ob.location = loc
    ob.rotation_euler = (Vector((tx, tz, ty)) - loc).to_track_quat('-Z', 'Y').to_euler()
    coll.objects.link(ob)
    return ob


def cameras(coll):
    cams = {}
    cams['site'] = ortho_camera('CAM_SitePlan', coll, 0, 10, 190, 0, 10, 0, 300)
    cams['road'] = camera('CAM_Road', coll, -72, 9, 2.0, -56.8, 28, 1.3, 30)
    cams['approach'] = camera('CAM_Approach', coll, -2, 52, 3.0, 0, 10, 16.0, 30)
    # Default review view: an elevated three-quarter camera keeps the full
    # mansion in frame and reveals its pavilion roofs and facade depth.
    cams['front'] = camera('CAM_FrontElevation', coll, 32, 66, 25, 0, 0, 8.5, 36)
    cams['west'] = camera('CAM_WestFlank', coll, -58, 30, 6.0, -20, 2, 12.0, 34)
    cams['east'] = camera('CAM_EastFlank', coll, 56, 26, 6.0, 20, 4, 12.0, 30)
    cams['roof'] = camera('CAM_RoofScape', coll, 40, 44, 34, 0, 0, 15.0, 40)
    cams['deck'] = camera('CAM_RoofDeck', coll, -19, 6, 21.5, -2, -6, 12.2, 28)
    cams['ladder'] = camera('CAM_Ladder', coll, -12.6, -19, 6.0, -12.5, -11, 7.0, 28)
    cams['foyer'] = camera('CAM_Foyer', coll, 0.2, 9.6, 1.65, -3.6, 4.6, 1.6, 24)
    cams['gallery'] = camera('CAM_Gallery', coll, 6.6, 0.2, 1.65, -13.0, 0.0, 1.5, 22)
    cams['stair'] = camera('CAM_StairHall', coll, 1.8, 8.6, 1.7, -4.2, 6.0, 5.4, 22)
    cams['underground'] = camera('CAM_Underground_Cave', coll, 36.8, 6.0, -1.30,
                                 45.0, 5.6, -1.8, 34)
    cams['cistern'] = camera('CAM_CisternCourt', coll, 58.8, 6.0, 4.4,
                             59.4, 6.0, -0.9, 36)
    return cams


def configure_render(samples=24, res=(960, 540)):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 5
    scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 2
    scene.cycles.transmission_bounces = 2
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 1.0


def render(cam, path, samples=24, res=(960, 540)):
    scene = bpy.context.scene
    scene.camera = cam
    configure_render(samples, res)
    scene.render.filepath = path
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    W.log('render %s (%.1fs)' % (os.path.basename(path), time.time() - t0))


def main():
    flags = argv_flags()
    t0 = time.time()
    W.reset()
    W.palette()
    plan = W.load_plan(ROOT)
    root, colls = W.build_collections()

    W.log('building site')
    SITE.build_ground(colls['WORLD_MASTER'])
    SITE.build_pond(colls['WORLD_MASTER'])
    SITE.build_road(colls['ROAD_ENVIRONMENT'], colls)
    SITE.build_drive(colls['ROAD_ENVIRONMENT'], colls)
    car = plan['terrain']['car']
    car_rot = plan['terrain'].get('carRot', math.pi)
    SITE.build_car(colls['VEHICLE_BREAKDOWN'], car['x'], car['z'], car_rot)
    SITE.build_forest(colls, plan, (car['x'], car['z']))
    W.bind_environment_textures()

    if not flags['site_only']:
        try:
            import world_mansion
            W.log('building mansion')
            world_mansion.build(colls, plan)
            W.log('building preserved underground connector')
            UNDERGROUND.build(colls['UNDERGROUND_ENVIRONMENT'], colls['GAMEPLAY_OBJECTS'])
            try:
                import world_interiors
                W.log('furnishing')
                world_interiors.build(colls, plan, ROOT)
            except ImportError:
                W.log('interiors module not present yet')
        except ImportError:
            W.log('mansion module not present yet')

    lighting(colls['LIGHTING'])
    atmosphere(colls['LIGHTING'])
    cams = cameras(colls['CAMERAS'])

    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.camera = cams['front']
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0.6
    scene.frame_start = 1
    scene.frame_end = 60
    scene.render.fps = 24
    if not any(marker.name == 'TREE_WIND_LOOP' for marker in scene.timeline_markers):
        scene.timeline_markers.new('TREE_WIND_LOOP', frame=1)
    # Save the opening workspace in camera view so the authored world is the
    # first thing visible when a reviewer opens the master blend.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.region_3d.view_perspective = 'CAMERA'
                # Open the master in a textured view and clear the dense
                # helper/camera overlays that obscured the actual estate.
                space.shading.type = 'MATERIAL'
                space.shading.use_scene_world = True
                space.shading.use_scene_lights = True
                space.overlay.show_extras = False
                space.overlay.show_relationship_lines = False
                space.overlay.show_floor = False
                space.overlay.show_axis_x = False
                space.overlay.show_axis_y = False
    # Blender add-ons can leave unlinked widget meshes in the file datablocks.
    # They are not part of the estate and have no scene users; remove them so
    # the deliverable contains only reachable scene content. Reuse duplicate
    # texture datablocks that point to the same file with the same color space.
    for ob in list(bpy.data.objects):
        if ob.users == 0:
            bpy.data.objects.remove(ob)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras,
                       bpy.data.lights, bpy.data.armatures):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)
    images_by_key = {}
    for image in list(bpy.data.images):
        if image.source != 'FILE' or not image.filepath:
            continue
        path = os.path.normcase(os.path.normpath(bpy.path.abspath(image.filepath)))
        key = (path, image.colorspace_settings.name, tuple(image.size), image.source)
        prior = images_by_key.get(key)
        if prior is None:
            images_by_key[key] = image
        else:
            image.user_remap(prior)
            bpy.data.images.remove(image)

    out = os.path.join(WORLD_DIR, 'SILID_COMPLETE_WORLD.blend')
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=out)
    W.log('saved %s (%.1fs)' % (out, time.time() - t0))

    if flags['render']:
        os.makedirs(RENDER_DIR, exist_ok=True)
        quick = flags['quick']
        picks = [('site', 'M1_site_plan.png', 8, (1100, 1100)),
                 ('road', 'M2_road.png', 16 if quick else 28, (960, 540))]
        if not flags['site_only']:
            picks += [('front', 'M3_front.png', 16 if quick else 32, (1100, 620)),
                      ('west', 'M3_west_flank.png', 16 if quick else 28, (960, 540)),
                      ('east', 'M3_east_flank.png', 16 if quick else 28, (960, 540)),
                      ('roof', 'M5_roofscape.png', 16 if quick else 28, (960, 540)),
                      ('deck', 'M5_roof_deck.png', 16 if quick else 28, (960, 540)),
                      ('ladder', 'M5_ladder.png', 16 if quick else 28, (800, 900)),
                      ('foyer', 'M6_foyer.png', 16 if quick else 32, (960, 540)),
                      ('gallery', 'M6_gallery.png', 16 if quick else 32, (960, 540)),
                      ('stair', 'M5_stair.png', 16 if quick else 28, (960, 540))]
        for key, name, samples, res in picks:
            render(cams[key], os.path.join(RENDER_DIR, name), samples, res)

    stats = {
        'objects': len(bpy.data.objects),
        'meshes': len(bpy.data.meshes),
        'materials': len(bpy.data.materials),
        'lights': len(bpy.data.lights),
        'polygons': sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'),
    }
    W.log('objects %(objects)d meshes %(meshes)d materials %(materials)d '
          'polys %(polygons)d' % stats)


main()
