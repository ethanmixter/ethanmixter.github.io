import numpy as np, json, sys
from PIL import Image, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
meta = json.load(open(f'{src}/lightmaps.json'))
arrs = {}
for k, m in meta.items():
    a = np.fromfile(f'{src}/lm_{k}.f32', dtype=np.float32).reshape(m['h'], m['w'], 4)[::-1, :, :3]
    arrs[k] = a
    print(k, a.shape, 'p50 %.3f p99 %.3f max %.3f' % (np.percentile(a, 50), np.percentile(a, 99), a.max()))
allv = np.concatenate([a.reshape(-1, 3) for a in arrs.values()])
scale = float(np.percentile(allv, 99.5))
print('scale', scale)
for k, a in arrs.items():
    v = np.clip(a / scale, 0, 1)
    srgb = np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)
    im = Image.fromarray((srgb * 255 + 0.5).astype(np.uint8))
    im = im.filter(ImageFilter.GaussianBlur(float(sys.argv[3]) if len(sys.argv) > 3 else 1.2))
    im.save(f'{dst}/lm_{k}.png', optimize=True)
json.dump({'scale': scale}, open(f'{dst}/lm.json', 'w'))
