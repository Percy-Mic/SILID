import os, bpy
from mathutils import Vector
wd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); s=bpy.context.scene
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=4;s.cycles.use_denoising=True
s.render.resolution_x=720;s.render.resolution_y=405;s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=1.4
d=bpy.data.cameras.new('CAM_GroundKitchenReview');d.lens=50;c=bpy.data.objects.new('CAM_GroundKitchenReview',d)
c.location=(-20.5,-9.0,2.3);c.rotation_euler=(Vector((-20.5,-5.5,1.1))-Vector(c.location)).to_track_quat('-Z','Y').to_euler();s.collection.objects.link(c)
s.camera=c;s.render.filepath=os.path.join(wd,'renders','M8_kitchen.png');bpy.ops.render.render(write_still=True)
