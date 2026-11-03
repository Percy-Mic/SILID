import bpy, os
for n in ("base_Marco","base_Caretaker","cast_v2_pair"):
    p=r"C:\Users\Admin\Downloads\SILID-main\Blender\AssetLibrary\Working\Characters\shots\%s.png"%n
    if not os.path.exists(p): continue
    im=bpy.data.images.load(p)
    im.scale(700, 875)
    im.filepath_raw=p.replace(".png","_s.jpg"); im.file_format='JPEG'
    bpy.context.scene.render.image_settings.quality=88
    im.save()
    print("saved", im.filepath_raw, os.path.getsize(im.filepath_raw))
