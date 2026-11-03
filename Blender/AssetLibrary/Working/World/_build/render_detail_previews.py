import os, bpy
from mathutils import Vector
wd=r'C:\Users\Admin\Downloads\SILID-main1\Blender\AssetLibrary\Working\World'
s=bpy.context.scene
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=4;s.cycles.use_denoising=True
s.cycles.use_denoising=False
# Close-up reviews of the rooms should not allocate the whole forest and road.
for cname in ('WORLD_MASTER','ROAD_ENVIRONMENT','VEHICLE_BREAKDOWN','FOREST_ENVIRONMENT',
              'FOREST_VEGETATION','UNDERGROUND_ENVIRONMENT','GAMEPLAY_OBJECTS','COLLISION',
              'ANIMATIONS','EXPORT_ASSETS'):
    coll=bpy.data.collections.get(cname)
    if coll:
        coll.hide_render=True
s.render.resolution_x=720;s.render.resolution_y=405;s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=1.4
views=[
 ('M9_kitchen_detail.png',(-24,-7.8,2.0),(-20.5,-4.5,1.1)),
 ('M9_guest_bedroom_detail.png',(-23,6.3,2.1),(-20.5,9.4,1.0)),
 ('M9_lounge_detail.png',(5,-3.8,2.3),(5,-7.6,0.9)),
]
for i,(name,pos,target) in enumerate(views):
 d=bpy.data.cameras.new('CAM_'+name);d.lens=50;c=bpy.data.objects.new('CAM_'+name,d);s.collection.objects.link(c)
 c.location=pos;c.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y').to_euler();s.camera=c
 s.render.filepath=os.path.join(wd,'renders',name);bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(c,do_unlink=True);bpy.data.cameras.remove(d)
