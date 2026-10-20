"""Builds the Ethan Mixter Arcade in Blender, bakes room lighting, exports GLB.

Run:  bvenv/bin/python blender/build_arcade.py <outdir>
Blender world: hall runs along +Y (entrance at y=-6, back wall at y=24), Z up.
glTF export converts to Y-up, so Blender +Y becomes three.js -Z.
"""
import bpy, bmesh, math, json, sys, os
from mathutils import Vector, Matrix

OUT = sys.argv[-1] if len(sys.argv) > 1 else '/home/claude/arcade/build'
os.makedirs(OUT, exist_ok=True)
BAKE_SAMPLES = int(os.environ.get('BAKE_SAMPLES', '96'))

ROOM_W, Y0, Y1, ROOM_H = 8.0, -5.0, 19.0, 3.4
HX = ROOM_W / 2

GAMES = [
    # id, side (-1 left / +1 right), y, accent
    ('kepler-drift',       -1,  3.0, (0.42, 0.48, 1.00)),
    ('fps-chess',          -1,  6.6, (1.00, 0.76, 0.20)),
    ('coffee-shop-tycoon', -1, 10.2, (0.10, 0.80, 0.50)),
    ('red-shirt-kid',      -1, 13.8, (1.00, 0.16, 0.16)),
    ('repulsor-forge',      1,  3.0, (0.13, 0.78, 0.95)),
    ('foam-forge',          1,  6.6, (0.70, 0.92, 0.10)),
    ('pontoon-battle',      1, 10.2, (1.00, 0.40, 0.20)),
    ('forgeframe-duel',     1, 13.8, (1.00, 0.22, 0.66)),
]
screen_colors = json.load(open('/home/claude/arcade/screen_colors.json'))

# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- materials
_mats = {}
def mat(name, color=(0.5, 0.5, 0.5), rough=0.5, metal=0.0, emit=None, strength=1.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit is not None:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = strength
    _mats[name] = m
    return m

def norm_col(c, floor=0.25):
    m = max(c) or 1
    return tuple(max(floor, x / m) for x in c)

# ---------------------------------------------------------------- mesh helpers
def new_obj(name, bm, material=None, parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    if material:
        ob.data.materials.append(material)
    if parent:
        ob.parent = parent
    return ob

def L(f, z, x=0.0):
    """Cabinet local coords: f = forward distance (front faces -Y), z = height, x = right."""
    return Vector((x, -f, z))

def extrude_profile(name, prof, x0, x1, material, parent):
    bm = bmesh.new()
    a = [bm.verts.new(L(f, z, x0)) for f, z in prof]
    b = [bm.verts.new(L(f, z, x1)) for f, z in prof]
    n = len(prof)
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_obj(name, bm, material, parent)

def quad(name, center, right, up, w, h, material, parent, facing, uv=True):
    """Flat quad; UV (0,0) bottom-left as seen by a viewer looking at its front."""
    r, u = right.normalized() * (w / 2), up.normalized() * (h / 2)
    bm = bmesh.new()
    vs = [bm.verts.new(center - r - u), bm.verts.new(center + r - u),
          bm.verts.new(center + r + u), bm.verts.new(center - r + u)]
    f = bm.faces.new(vs)
    f.normal_update()
    if f.normal.dot(facing) < 0:
        f.normal_flip()
    if uv:
        lay = bm.loops.layers.uv.new('UVMap')
        uvs = {vs[0]: (0, 0), vs[1]: (1, 0), vs[2]: (1, 1), vs[3]: (0, 1)}
        for loop in f.loops:
            loop[lay].uv = uvs[loop.vert]
    return new_obj(name, bm, material, parent)

def box(name, mn, mx, material, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    c = (Vector(mn) + Vector(mx)) / 2
    s = Vector(mx) - Vector(mn)
    for v in bm.verts:
        v.co = Vector((v.co.x * s.x, v.co.y * s.y, v.co.z * s.z)) + c
    return new_obj(name, bm, material, parent)

def cylinder(name, center, radius, depth, material, parent, segs=20):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=radius, radius2=radius, depth=depth)
    for v in bm.verts:
        v.co += center
    return new_obj(name, bm, material, parent)

def sphere(name, center, radius, material, parent):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=radius)
    for v in bm.verts:
        v.co += center
    for f in bm.faces:
        f.smooth = True
    return new_obj(name, bm, material, parent)

def tube_along(name, pts, radius, material, parent, closed=True):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*co, 1)
    sp.use_cyclic_u = closed
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    ob.parent = parent
    return ob

def text_mesh(name, body, size, loc, rot, material, extrude=0.02, align='CENTER'):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = 0.004
    cu.align_x = align
    cu.align_y = 'CENTER'
    cu.space_character = 1.05
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    ob.data.materials.append(material)
    return ob

# ---------------------------------------------------------------- cabinet
PROFILE = [(-0.42, 0.0), (0.40, 0.0), (0.40, 0.84), (0.50, 0.89), (0.50, 0.94),
           (0.16, 1.03), (0.04, 1.56), (0.17, 1.60), (0.17, 1.94), (-0.42, 1.94)]

M_BODY = mat('Cab_Body', (0.035, 0.035, 0.045), rough=0.35)
M_BEZEL = mat('Cab_Bezel', (0.005, 0.005, 0.006), rough=0.25)
M_METAL = mat('Cab_Metal', (0.55, 0.56, 0.6), rough=0.3, metal=1.0)
M_STICK = mat('Cab_Stick', (0.02, 0.02, 0.02), rough=0.4)

def build_cabinet(gid, side, y, accent):
    root = bpy.data.objects.new(f'Cabinet_{gid}', None)
    bpy.context.collection.objects.link(root)
    root.location = (side * (HX - 0.62), y, 0)
    root.rotation_euler = (0, 0, math.radians(90 if side < 0 else -90))

    dark_acc = tuple(c * 0.35 for c in accent)
    m_side = mat(f'Cab_Side_{gid}', dark_acc, rough=0.45)
    m_neon = mat(f'Neon_{gid}', accent, emit=accent, strength=9.0)
    m_btn = mat(f'Btn_{gid}', accent, rough=0.3, emit=accent, strength=1.5)
    sc = norm_col(screen_colors.get(gid, (0.5, 0.4, 1.0)))
    glow = tuple(0.6 * s + 0.4 * a for s, a in zip(sc, accent))
    m_screen = mat(f'Screen_{gid}', (0, 0, 0), emit=glow, strength=6.0)
    m_marq = mat(f'Marquee_{gid}', (0, 0, 0), emit=accent, strength=5.0)

    extrude_profile(f'CabSideL_{gid}', PROFILE, -0.37, -0.33, m_side, root)
    extrude_profile(f'CabSideR_{gid}', PROFILE, 0.33, 0.37, m_side, root)
    body = [(f * 0.985 if f > 0 else f, z) for f, z in PROFILE]
    extrude_profile(f'CabBody_{gid}', body, -0.33, 0.33, M_BODY, root)

    # neon T-molding around both side panels
    for sx in (-0.374, 0.374):
        tube_along(f'CabTrim_{gid}_{"L" if sx < 0 else "R"}', [tuple(L(f, z, sx)) for f, z in PROFILE], 0.006, m_neon, root)

    # screen: slope from (0.16,1.03) to (0.04,1.56)
    s0, s1 = Vector((0.16, 1.03)), Vector((0.04, 1.56))
    up2 = (s1 - s0).normalized()
    n2 = Vector((up2.y, -up2.x))  # forward-ish normal in (f,z)
    mid = (s0 + s1) / 2
    up = L(up2.x, up2.y) - L(0, 0)
    fwd = L(n2.x, n2.y) - L(0, 0)
    right = Vector((1, 0, 0))
    c = L(mid.x, mid.y) + fwd * 0.003
    quad(f'CabBezel_{gid}', c, right, up, 0.62, 0.50, M_BEZEL, root, fwd)
    quad(f'Screen_{gid}', L(mid.x, mid.y) + fwd * 0.008, right, up, 0.54, 0.405, m_screen, root, fwd)

    # marquee
    quad(f'Marquee_{gid}', L(0.172, 1.77), right, Vector((0, 0, 1)), 0.64, 0.30, m_marq, root, Vector((0, -1, 0)))
    # coin door
    quad(f'CoinDoor_{gid}', L(0.402, 0.48), right, Vector((0, 0, 1)), 0.26, 0.32, M_METAL, root, Vector((0, -1, 0)), uv=False)
    for i, xx in enumerate((-0.05, 0.05)):
        quad(f'CoinSlot_{gid}_{i}', L(0.405, 0.56, xx), right, Vector((0, 0, 1)), 0.035, 0.06,
             mat('CoinSlot', (0.9, 0.1, 0.05), emit=(1, 0.12, 0.04), strength=5), root, Vector((0, -1, 0)), uv=False)
    # kick-plate glow strip
    quad(f'Kick_{gid}', L(0.403, 0.05), right, Vector((0, 0, 1)), 0.66, 0.035, m_neon, root, Vector((0, -1, 0)), uv=False)

    # control panel: top runs from (0.50,0.94) front to (0.16,1.03) back
    def panel_z(f):
        t = (0.50 - f) / 0.34
        return 0.94 + t * 0.09
    fj = 0.36
    cylinder(f'StickBase_{gid}', L(fj, panel_z(fj) + 0.004, -0.16), 0.035, 0.01, M_STICK, root)
    cylinder(f'StickShaft_{gid}', L(fj, panel_z(fj) + 0.045, -0.16), 0.007, 0.08, M_METAL, root, 10)
    sphere(f'StickBall_{gid}', L(fj, panel_z(fj) + 0.095, -0.16), 0.024, m_btn, root)
    for i, (bx, bf) in enumerate(((0.02, 0.38), (0.10, 0.36), (0.18, 0.34), (0.06, 0.30), (0.14, 0.28))):
        cylinder(f'Btn_{gid}_{i}', L(bf, panel_z(bf) + 0.008, bx), 0.022, 0.016, m_btn, root, 16)

    # interaction anchor in front of the screen
    anchor = bpy.data.objects.new(f'Play_{gid}', None)
    bpy.context.collection.objects.link(anchor)
    anchor.parent = root
    anchor.location = L(1.1, 0.0)
    return root

for gid, side, y, acc in GAMES:
    build_cabinet(gid, side, y, acc)

# ---------------------------------------------------------------- room
def room_plane(name, center, size, rot, color):
    bpy.ops.mesh.primitive_plane_add(size=1, location=center, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(scale=True)
    m = mat(f'Room_{name}', color, rough=0.9)
    ob.data.materials.append(m)
    return ob

LEN = Y1 - Y0
CY = (Y0 + Y1) / 2
floor = room_plane('Floor', (0, CY, 0), (ROOM_W, LEN), (0, 0, 0), (0.55, 0.55, 0.6))
ceil = room_plane('Ceiling', (0, CY, ROOM_H), (ROOM_W, LEN), (math.pi, 0, 0), (0.1, 0.1, 0.12))
wl = room_plane('Wall_L', (-HX, CY, ROOM_H / 2), (ROOM_H, LEN), (0, math.pi / 2, 0), (0.18, 0.14, 0.3))
wr = room_plane('Wall_R', (HX, CY, ROOM_H / 2), (ROOM_H, LEN), (0, -math.pi / 2, 0), (0.18, 0.14, 0.3))
wb = room_plane('Wall_Back', (0, Y1, ROOM_H / 2), (ROOM_W, ROOM_H), (math.pi / 2, 0, 0), (0.12, 0.1, 0.2))
wf = room_plane('Wall_Front', (0, Y0, ROOM_H / 2), (ROOM_W, ROOM_H), (-math.pi / 2, 0, 0), (0.12, 0.1, 0.2))
ROOM = [floor, ceil, wl, wr, wb, wf]
for ob in ROOM:
    # make sure each room surface faces into the room
    ob.data.update()
    n = ob.matrix_world.to_3x3() @ ob.data.polygons[0].normal
    toward = Vector((0, CY, ROOM_H / 2)) - ob.matrix_world @ ob.data.polygons[0].center
    if n.dot(toward) < 0:
        ob.data.flip_normals()

# neon wall stripes + ceiling strips
PINK, CYAN, PURPLE = (1.0, 0.18, 0.62), (0.1, 0.85, 1.0), (0.55, 0.3, 1.0)
m_pink = mat('Neon_Pink', PINK, emit=PINK, strength=7)
m_cyan = mat('Neon_Cyan', CYAN, emit=CYAN, strength=7)
m_purple = mat('Neon_Purple', PURPLE, emit=PURPLE, strength=5)
m_white = mat('Neon_White', (1, 1, 1), emit=(1, 0.95, 0.88), strength=6)
box('NeonStripe_L', (-HX + 0.005, Y0, 2.35), (-HX + 0.03, Y1, 2.38), m_purple)
box('NeonStripe_R', (HX - 0.03, Y0, 2.35), (HX - 0.005, Y1, 2.38), m_purple)
box('NeonCeil_L', (-1.32, Y0 + 1, ROOM_H - 0.04), (-1.28, Y1 - 1, ROOM_H - 0.005), m_pink)
box('NeonCeil_R', (1.28, Y0 + 1, ROOM_H - 0.04), (1.32, Y1 - 1, ROOM_H - 0.005), m_cyan)
box('Baseboard_L', (-HX, Y0, 0), (-HX + 0.03, Y1, 0.1), m_cyan)
box('Baseboard_R', (HX - 0.03, Y0, 0), (HX, Y1, 0.1), m_pink)

LIGHT_YS = [-2.6, 1.2, 4.8, 8.4, 12.0, 15.6]
for i, ly in enumerate(LIGHT_YS):
    box(f'CeilPanel_{i}', (-0.6, ly - 0.25, ROOM_H - 0.02), (0.6, ly + 0.25, ROOM_H - 0.001), m_white)
    bpy.ops.object.light_add(type='AREA', location=(0, ly, ROOM_H - 0.03))
    lt = bpy.context.active_object
    lt.data.shape = 'RECTANGLE'
    lt.data.size, lt.data.size_y = 1.2, 0.5
    lt.data.energy = 22
    lt.data.color = (1.0, 0.92, 0.85)

# back wall neon sign
text_mesh('Sign_Name', 'ETHAN MIXTER', 0.56, (0, Y1 - 0.06, 2.62), (math.pi / 2, 0, 0), m_pink, extrude=0.03)
text_mesh('Sign_Arcade', 'A R C A D E', 0.38, (0, Y1 - 0.06, 2.0), (math.pi / 2, 0, 0), m_cyan, extrude=0.03)
# sign backing glow line
box('Sign_Underline', (-2.4, Y1 - 0.05, 1.72), (2.4, Y1 - 0.02, 1.75), m_purple)

# GitHub cabinet at the back, facing the entrance
gh = build_cabinet('github', 0, Y1 - 1.1, (0.62, 0.48, 1.0))
gh.location = (0, Y1 - 1.1, 0)
gh.rotation_euler = (0, 0, 0)

# entrance-side sign (behind the player at spawn)
text_mesh('Sign_Exit', 'INSERT COIN', 0.3, (0, Y0 + 0.06, 2.55), (math.pi / 2, 0, math.pi), m_cyan, extrude=0.02)

# convert curves/text to meshes so they export & bake as geometry
bpy.ops.object.select_all(action='DESELECT')
for ob in list(bpy.data.objects):
    if ob.type in ('CURVE', 'FONT'):
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
bpy.ops.object.convert(target='MESH')

# ---------------------------------------------------------------- bake room lighting
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = BAKE_SAMPLES
scene.cycles.max_bounces = 4
scene.cycles.diffuse_bounces = 3
scene.world = bpy.data.worlds.new('World')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0

BAKE_RES = {'Floor': (512, 1536), 'Ceiling': (256, 768), 'Wall_L': (256, 1536), 'Wall_R': (256, 1536),
            'Wall_Back': (512, 256), 'Wall_Front': (512, 256)}
# Plane UVs: U follows local X, V follows local Y. For walls that means U=height (scaled first).
for ob in ROOM:
    w, h = BAKE_RES[ob.name]
    img = bpy.data.images.new(f'LM_{ob.name}', w, h, float_buffer=True)
    m = ob.data.materials[0]
    nt = m.node_tree
    node = nt.nodes.new('ShaderNodeTexImage')
    node.image = img
    nt.nodes.active = node

bpy.ops.object.select_all(action='DESELECT')
for ob in ROOM:
    ob.select_set(True)
bpy.context.view_layer.objects.active = floor
bake = scene.render.bake
bake.use_pass_direct = True
bake.use_pass_indirect = True
bake.use_pass_color = False
bake.margin = 4
print('baking...', flush=True)
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'})
print('baked', flush=True)

lm_meta = {}
for ob in ROOM:
    img = bpy.data.images[f'LM_{ob.name}']
    px = list(img.pixels)
    # store raw linear floats so we can tone-map / encode outside Blender
    import array
    path = os.path.join(OUT, f'lm_{ob.name}.f32')
    array.array('f', px).tofile(open(path, 'wb'))
    lm_meta[ob.name] = {'w': img.size[0], 'h': img.size[1]}
    # remove bake node so it doesn't confuse exporter
    nt = ob.data.materials[0].node_tree
    nt.nodes.remove(nt.nodes.active)
json.dump(lm_meta, open(os.path.join(OUT, 'lightmaps.json'), 'w'))

# ---------------------------------------------------------------- export
for ob in list(bpy.data.objects):
    if ob.type == 'LIGHT':
        bpy.data.objects.remove(ob)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'arcade.glb'), export_format='GLB',
                          export_apply=True, export_lights=False, export_cameras=False,
                          export_extras=False, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'arcade.blend'))
print('done', flush=True)
