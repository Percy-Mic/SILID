"""Prepare the three imported GLB rooms for SILID.

Run inside Blender:  blender -b -P scripts/prep_rooms_blender.py

Each asset is a room that was modelled or photogrammetrically captured at some
unknown scale, at some unknown yaw, with its own closed doors. The mansion has
rooms of known size and doors in known walls, so nothing about the raw file can
be used as-is:

  * the scans are captured at roughly four times life size and rotated 17-48
    degrees off the world axes;
  * their doorways are closed leaves merged into a single shell, so a doorway
    cannot be opened by hiding an object -- the aperture has to be physically
    cut out of the mesh where the mansion's own door will meet it;
  * one scan is a million triangles with a single 8k texture, which is far past
    what an Intel HD 4600 can hold.

The output is one GLB per room, in a common frame: floor at y = 0, the entry
wall's room-side face on z = 0, the interior extending towards -z, centred on
x = 0, and a real doorway cut through the entry wall on the centre line. That
frame is what src/world/glbRooms.js places, so the game never has to guess.

Measurements come from scripts/room_measure.py, which reads the floor slab
(the only surface in a capture that is flat, complete and exactly room-sized).
"""

import bpy
import bmesh
import json
import math
import os
import sys
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Blender", "AssetLibrary")
OUT = os.path.join(ROOT, "public", "assets", "rooms")

# yaw      degrees to rotate so the walls land on the axes (from wall normals)
# floorY   the floor's height in the asset's own frame
# entryZ   the entry wall's plane in the rotated frame
# entryX   the entry wall's centre in the rotated frame (x becomes 0)
# scale    metres per asset unit, chosen so the room fits its mansion room
# cut      height of the ceiling cut, metres above the floor (0 = keep)
# tex      longest edge for textures, px
# tris     decimation target
ROOMS = [
    {
        "name": "interrogation_room",
        "file": "interogation_room.glb",
        "yaw": 0.25,
        "floorY": -0.01,
        "entryZ": 2.52,
        "entryX": -0.01,
        "w": 4.51,
        "depth": 5.21,
        "scale": 1.0,
        "cut": 3.0,
        # 2.12: the house head is 2.15, so the aperture finishes *behind* the
        # lintel. A taller cut left a band of the corridor wall visible above
        # the door -- the black stripe in the first in-game photographs.
        "door": {"w": 1.0, "h": 2.12},
        "tex": 512,
        "tris": 130000,
    },
    {
        "name": "the_great_drawing_room",
        "file": "the_great_drawing_room.glb",
        "yaw": 48.25,
        "floorY": 0.15,
        "entryZ": 6.01,
        "entryX": -1.39,
        "w": 8.06,
        "depth": 11.95,
        "scale": 0.734,        # 11.95 m deep scan into GF-13's 8.78 m
        "cut": 4.18,
        "door": {"w": 1.2, "h": 2.12},
        "tex": 1536,
        "tris": 200000,
    },
    {
        "name": "the_billiards_room",
        "file": "the_billiards_room.glb",
        "yaw": 16.75,
        "floorY": 0.36,
        "entryZ": 15.47,
        "entryX": -0.9,
        "w": 16.01,
        "depth": 16.63,
        "scale": 0.32,         # 14.4 m ceiling into F3's 3.6 m
        "cut": 3.5,
        "door": {"w": 1.3, "h": 2.12},
        "tex": 1536,
        "tris": 200000,
    },
]

report = []


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def join_meshes():
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise RuntimeError("no meshes imported")
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    # GLB captures usually arrive under a root node carrying the capture's own
    # scale. Joined while still parented, that scale would be applied twice or
    # not at all depending on where the next transform lands, so the parent is
    # dropped first and the real world transform baked into the mesh.
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if obj.parent:
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def image_sizes():
    out = []
    for img in bpy.data.images:
        try:
            img.pixels[0]
        except Exception:
            continue
        out.append(tuple(img.size))
    return out


def cap_textures(limit):
    """Blender keeps the source resolution until asked; these captures ship one
    texture per material, some of them 8k, which alone would be most of the
    texture budget on this hardware. A packed image reports size 0 until it is
    actually read, so the pixels are touched first."""
    seen = 0
    for img in bpy.data.images:
        try:
            img.pixels[0]
        except Exception:
            continue
        w, h = img.size
        if w == 0 or h == 0:
            continue
        if max(w, h) > limit:
            f = limit / max(w, h)
            img.scale(max(1, int(w * f)), max(1, int(h * f)))
            img.pack()
            seen += 1
    return seen


def cull_strays(obj, halfW, halfD, top, margin=1.0):
    """Photogrammetry shells carry fly-away triangles -- a metre of wall flung
    five metres past the room. Left in, they float in the middle of the game
    room. Anything more than a wall's thickness past the room's box goes."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    doomed = []
    for f in bm.faces:
        c = f.calc_center_median()
        if not (-halfW - margin <= c.x <= halfW + margin):
            doomed.append(f)
        elif not (-margin <= c.y <= 2 * halfD + margin):
            doomed.append(f)
        elif not (-margin <= c.z <= top + margin):
            doomed.append(f)
    if doomed:
        bmesh.ops.delete(bm, geom=doomed, context="FACES")
        bm.to_mesh(me)
        me.update()
    bm.free()
    return len(doomed)


def make_lit():
    """The two captures are KHR_materials_unlit: a baked photograph. Kept unlit
    they ignore the flashlight entirely and glow in a dark house, so the base
    colour image is moved onto a Principled BSDF. The photograph stays the
    albedo -- nothing is replaced -- but now the room answers to light."""
    changed = 0
    for mat in bpy.data.materials:
        if not mat.use_nodes or not mat.node_tree:
            continue
        nodes = mat.node_tree.nodes
        out = next((n for n in nodes if n.type == "OUTPUT_MATERIAL"), None)
        if not out:
            continue
        tex = next((n for n in nodes if n.type == "TEX_IMAGE"), None)
        if tex is None:
            continue
        # already a lit material (the modelled cell) -- leave it alone
        if any(n.type == "BSDF_PRINCIPLED" for n in nodes):
            continue
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.inputs["Roughness"].default_value = 0.94
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.location = (out.location.x - 300, out.location.y)
        col = bsdf.inputs["Base Color"]
        mat.node_tree.links.new(tex.outputs["Color"], col)
        for l in list(mat.node_tree.links):
            if l.to_node == out:
                mat.node_tree.links.remove(l)
        mat.node_tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
        changed += 1
    return changed


def cut_door(obj, door):
    """Remove the wall and the closed leaf where the mansion's doorway meets it.

    A doorway cannot be faked with clipping planes: clipping removes a
    half-space, so it can only make a full-height slot. The faces are deleted
    instead, and the masonry reveal the architecture builds around its own
    opening hides the raw edge. The slot runs from 0.9 m outside the entry
    plane to 0.55 m inside it, which covers the wall and its leaf.
    """
    w = door["w"] / 2 + 0.03
    h = door["h"]
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    doomed = []
    for f in bm.faces:
        c = f.calc_center_median()
        if -w <= c.x <= w and 0.0 <= c.z <= h and -0.55 <= c.y <= 0.9:
            doomed.append(f)
    if not doomed:
        bm.free()
        return 0
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(me)
    bm.free()
    me.update()
    return len(doomed)


def smooth(obj, iterations, factor):
    """Scans decimate badly: collapse pulls the ragged capture boundary into
    spikes that stand out of walls. Relaxing the surface first gives the
    decimator something to work with, at 1/10 the vertices."""
    if not iterations:
        return
    mod = obj.modifiers.new("relax", "SMOOTH")
    mod.iterations = iterations
    mod.factor = factor
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def cut_above(obj, height):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    # Any vertex above the cut, not just the centroid: one big triangle with a
    # corner two metres up would otherwise leave a spike through the ceiling.
    doomed = [f for f in bm.faces if max(v.co.z for v in f.verts) > height]
    if not doomed:
        bm.free()
        return 0
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(me)
    bm.free()
    me.update()
    return len(doomed)


def decimate(obj, target):
    """Two passes, in the order that keeps a photographed room looking
    photographed.

    Planar dissolve removes only triangles that lie in the same plane -- flat
    plaster, floor, ceiling -- which on a scan is most of the count, and it
    moves nothing, so no surface changes shape. The collapse pass that follows
    does the rest, and is given a much easier job than it would have alone. An
    earlier version collapsed straight to 15%: it turned every ragged capture
    boundary into a spike, and smoothing those only spread them into a web of
    overlapping triangles that z-fought across the walls. UV discontinuities
    are held, so the collapser cannot walk a triangle across an atlas seam.
    """
    before = len(obj.data.polygons)
    if before <= target:
        return before, before
    bpy.context.view_layer.objects.active = obj
    planar = obj.modifiers.new("planar", "DECIMATE")
    planar.decimate_type = "DISSOLVE"
    planar.angle_limit = math.radians(3.0)
    planar.delimit = {"UV", "MATERIAL", "NORMAL", "SEAM"}
    bpy.ops.object.modifier_apply(modifier=planar.name)
    # Dissolve leaves n-gons; a collapse ratio is counted in triangles, so
    # triangulating here is what makes `target` mean what it says.
    tri = obj.modifiers.new("tri", "TRIANGULATE")
    tri.quad_method = "BEAUTY"
    tri.ngon_method = "BEAUTY"
    bpy.ops.object.modifier_apply(modifier=tri.name)
    mid = len(obj.data.polygons)
    if mid <= target:
        return before, mid
    mod = obj.modifiers.new("decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = target / mid
    mod.use_collapse_triangulate = True
    mod.delimit = {"UV", "MATERIAL"}
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return before, len(obj.data.polygons)


def prep(spec):
    clear()
    path = os.path.join(SRC, spec["file"])
    bpy.ops.import_scene.gltf(filepath=path)
    obj = join_meshes()

    s = spec["scale"]
    # The measured yaw is the glTF-frame correction. glTF's +Y rotation maps to
    # Blender's -Z rotation, so the same corner comes out level with +yaw here.
    yaw = math.radians(spec["yaw"])
    # Blender is Z-up and the importer has already converted the glTF axes, so
    # the glTF frame's entry plane z=entryZ is Blender y=-entryZ, and its floor
    # y=floorY is Blender z=floorY. The room frame wants the floor at z=0, the
    # entry wall on y=0 and the interior on +y (which the exporter turns back
    # into -z for the game).
    # Rotate into the aligned frame first: entryX and entryZ were measured in
    # that frame, so subtracting them before the rotation would be a different
    # translation entirely.
    M = (
        Matrix.Scale(s, 4)
        @ Matrix.Translation(Vector((-spec["entryX"], spec["entryZ"], -spec["floorY"])))
        @ Matrix.Rotation(yaw, 4, "Z")
    )
    obj.data.transform(M)
    obj.data.update()

    # All cutting happens on the raw scan, before any dissolve. Dissolve turns
    # thousands of small triangles into a few enormous n-gons, and a cut that
    # tests "any vertex inside the door box" then deletes a polygon spanning
    # metres of wall: the first run of this script opened a 2.5 m hole and
    # showed the plaster of the mansion wall behind it.
    door_n = 0
    if spec["door"]:
        door_n = cut_door(obj, spec["door"])
    cut_n = 0
    if spec["cut"]:
        cut_n = cut_above(obj, spec["cut"])
    strays = cull_strays(obj, spec["w"] * s / 2, spec["depth"] * s / 2, spec["cut"])
    before, after = decimate(obj, spec["tris"])
    changed = make_lit()
    capped = cap_textures(spec["tex"])

    # bounds in the finished frame, so the game can assert the fit
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    # in Blender's Z-up frame: x across, y into the room, z up

    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, spec["name"] + ".glb")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=dst,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_image_format="JPEG",
        export_jpeg_quality=84,
        export_yup=True,
    )

    info = {
        "name": spec["name"],
        "textureSizes": image_sizes(),
        "file": os.path.relpath(dst, ROOT).replace("\\", "/"),
        "bytes": os.path.getsize(dst),
        "trisBefore": before,
        "tris": after,
        "facesCutCeiling": cut_n,
        "facesCulled": strays,
        "facesCutDoor": door_n,
        "materialsLit": changed,
        "texturesCapped": capped,
        "bounds": {
            "x": [round(min(xs), 2), round(max(xs), 2)],
            "y": [round(min(ys), 2), round(max(ys), 2)],
            "z": [round(min(zs), 2), round(max(zs), 2)],
        },
    }
    print("[prep]", json.dumps(info))
    report.append(info)


for spec in ROOMS:
    prep(spec)

with open(os.path.join(OUT, "manifest.json"), "w") as fh:
    json.dump(report, fh, indent=2)
print("[prep] done", len(report))
