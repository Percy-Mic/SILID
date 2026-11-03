"""Join each local CC0 Poly Haven furniture GLTF into a complete, centered GLB.

Run with Blender in background mode. The GLB keeps materials/textures and
avoids Unreal importing only one loose mesh from a multi-part prop.
"""

import bpy
import os
from mathutils import Vector


ROOT = r"C:\Users\Admin\Downloads\SILID-main"
SOURCE = os.path.join(ROOT, "Blender", "AssetLibrary", "Source", "PolyHaven")
OUTPUT = os.path.join(ROOT, "ue5", "Saved", "ImportReady")
MODELS = {
    "bookshelf": "wooden_bookshelf_worn/gltf/1k/wooden_bookshelf_worn_1k.gltf",
    "sofa": "painted_wooden_sofa/gltf/1k/painted_wooden_sofa_1k.gltf",
    "table": "painted_wooden_table/gltf/1k/painted_wooden_table_1k.gltf",
    "chair": "dining_chair_02/gltf/1k/dining_chair_02_1k.gltf",
    "armchair": "chinese_armchair/gltf/1k/chinese_armchair_1k.gltf",
    "bed": "GothicBed_01/gltf/1k/GothicBed_01_1k.gltf",
    "nightstand": "painted_wooden_nightstand/gltf/1k/painted_wooden_nightstand_1k.gltf",
    "round_table": "round_wooden_table_01/gltf/1k/round_wooden_table_01_1k.gltf",
    "vase": "antique_ceramic_vase_01/gltf/1k/antique_ceramic_vase_01_1k.gltf",
    "plant": "potted_plant_01/gltf/1k/potted_plant_01_1k.gltf",
    "oil_lamp": "vintage_oil_lamp/gltf/1k/vintage_oil_lamp_1k.gltf",
    "kettle": "vintage_electric_kettle/gltf/1k/vintage_electric_kettle_1k.gltf",
    "alarm_clock": "alarm_clock_01/gltf/1k/alarm_clock_01_1k.gltf",
    "wall_clock": "wall_clock/gltf/1k/wall_clock_1k.gltf",
    "tea_set": "tea_set_01/gltf/1k/tea_set_01_1k.gltf",
}


def make_pbr_material(name, color, metallic, roughness):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return material


def add_door_block(name, dimensions, location, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel > 0.0:
        modifier = obj.modifiers.new("Soft worn arrises", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def prepare(key, relative_path):
    reset_scene()
    source = os.path.join(SOURCE, *relative_path.split("/"))
    bpy.ops.import_scene.gltf(filepath=source)
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not objects:
        raise RuntimeError("No mesh objects imported for " + key)

    # Bake node transforms before joining; otherwise pieces such as a tea set,
    # bedside clock or lamp would be collapsed onto a single origin.
    for obj in objects:
        obj.data.transform(obj.matrix_world)
        obj.location = (0.0, 0.0, 0.0)
        obj.rotation_euler = (0.0, 0.0, 0.0)
        obj.scale = (1.0, 1.0, 1.0)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = "SILID_" + key

    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    min_x = min(p.x for p in corners)
    max_x = max(p.x for p in corners)
    min_y = min(p.y for p in corners)
    max_y = max(p.y for p in corners)
    min_z = min(p.z for p in corners)
    obj.data.transform(
        __import__("mathutils").Matrix.Translation(
            Vector((-(min_x + max_x) * 0.5, -(min_y + max_y) * 0.5, -min_z))
        )
    )
    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.scale = (1.0, 1.0, 1.0)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    output = os.path.join(OUTPUT, "SILID_" + key + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=output,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_yup=True,
    )
    print("Prepared %s: %d source mesh parts -> %s" % (key, len(objects), output))


def prepare_panelled_door():
    reset_scene()
    dark_wood = make_pbr_material("Door Walnut", (0.13, 0.065, 0.027), 0.0, 0.54)
    raised_wood = make_pbr_material("Door Raised Panels", (0.19, 0.095, 0.042), 0.0, 0.48)
    brass = make_pbr_material("Door Oxidized Brass", (0.32, 0.20, 0.075), 0.72, 0.36)

    parts = [add_door_block("Leaf slab", (1.00, 0.10, 2.12), (0, 0, 1.06), dark_wood, 0.012)]
    for face in (-1, 1):
        front_y = face * 0.057
        for row, z in enumerate((0.48, 1.52)):
            panel = add_door_block(
                "Raised panel %s %d" % ("front" if face < 0 else "back", row + 1),
                (0.69, 0.014, 0.77), (0, front_y, z), raised_wood, 0.018,
            )
            parts.append(panel)
            trim_y = face * 0.068
            parts.extend([
                add_door_block("Panel stile L", (0.035, 0.012, 0.82), (-0.365, trim_y, z), dark_wood, 0.006),
                add_door_block("Panel stile R", (0.035, 0.012, 0.82), (0.365, trim_y, z), dark_wood, 0.006),
                add_door_block("Panel rail top", (0.75, 0.012, 0.035), (0, trim_y, z + 0.41), dark_wood, 0.006),
                add_door_block("Panel rail bottom", (0.75, 0.012, 0.035), (0, trim_y, z - 0.41), dark_wood, 0.006),
            ])

        # A simple period latch with round escutcheons on both faces.
        latch_x = 0.405
        z = 1.00
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.032, depth=0.012, location=(latch_x, face * 0.068, z), rotation=(1.5708, 0, 0))
        plate = bpy.context.object
        plate.name = "Aged brass latch plate"
        plate.data.materials.append(brass)
        parts.append(plate)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.025, location=(latch_x, face * 0.085, z))
        knob = bpy.context.object
        knob.name = "Worn brass door knob"
        knob.scale = (1.0, 0.75, 1.0)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        knob.data.materials.append(brass)
        parts.append(knob)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    leaf = bpy.context.view_layer.objects.active
    leaf.name = "SILID_panelled_door"
    # The active leaf object's origin is already at the center of the slab;
    # its hinge-side location is assigned by the Unreal door actor.
    leaf.location = (0, 0, 0)
    bpy.context.view_layer.update()
    output = os.path.join(OUTPUT, "SILID_door.glb")
    bpy.ops.export_scene.gltf(
        filepath=output,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_yup=True,
    )
    print("Prepared detailed panelled timber door -> " + output)


os.makedirs(OUTPUT, exist_ok=True)
for model_key, model_path in MODELS.items():
    prepare(model_key, model_path)
prepare_panelled_door()
