import os
import bpy
from mathutils import Vector
world_dir=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=4; scene.cycles.use_denoising=True
scene.render.resolution_x=720; scene.render.resolution_y=405; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.view_settings.look='AgX - Medium High Contrast'; scene.view_settings.exposure=1.4
jobs=[
 ('M5_stair_detail.png','CAM_StairHall',None),
 ('M5_roof_complete.png','CAM_RoofScape',None),
 ('M8_foyer_detail.png','CAM_Foyer',None),
 ('M8_dining_room.png',None,((-0.5,-9.5,2.5),(-2.0,-6.5,1.0))),
 ('M8_kitchen.png',None,((-20.5,-9.0,2.3),(-20.5,-5.5,1.1))),
 ('M8_library.png',None,((-10.0,-9.0,2.6),(-10.0,-5.5,1.2))),
 ('M8_wine_room.png',None,((18.0,-9.7,2.4),(18.0,-7.6,1.0))),
 ('M8_guest_bedroom.png',None,((-22.2,8.2,2.3),(-20.5,9.8,1.0))),
]
for name,cam_name,framing in jobs:
 if cam_name:
  cam=bpy.data.objects.get(cam_name)
  if not cam: raise RuntimeError('Missing '+cam_name)
 else:
  loc,target=framing; data=bpy.data.cameras.new('CAM_'+name); data.lens=50
  cam=bpy.data.objects.new('CAM_'+name,data); cam.location=loc
  cam.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler(); scene.collection.objects.link(cam)
 scene.camera=cam; scene.render.filepath=os.path.join(world_dir,'renders',name)
 bpy.ops.render.render(write_still=True); print('REVIEW_RENDER',name,flush=True)
