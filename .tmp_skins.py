import bpy, os
for n,p in (("old",r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\mhdata\skins\old_asian_male\old_lightskinned_male_diffuse2.png"),("mid",r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\mhdata\skins\middleage_asian_male\middleage_lightskinned_male_diffuse2.png")):
    im=bpy.data.images.load(p); print(n, im.size[:])
    im.scale(640,640); im.filepath_raw=r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\preview\skin_%s_s.jpg"%n; im.file_format='JPEG'; im.save(); print("saved", os.path.getsize(im.filepath_raw))
