# Ethan Mixter Arcade

The homepage is a 3D arcade. Drop `index.html` and the `arcade/` folder into the root of
`ethanmixter.github.io` (this replaces the old list homepage; the arcade has its own "All games" list view).

## Adding a game
1. Add two 640x480 screenshots: `arcade/screens/<id>-1.jpg` (title screen) and `<id>-2.jpg` (gameplay).
2. Add an entry to `GAMES` in `index.html` (id, title, tag, color, url, how, blurb).
3. Add a cabinet in `arcade/blender/build_arcade.py` (`GAMES` list: id, side, y position, accent colour) and rebuild:

```
pip install bpy          # Blender as a Python module (5.2)
python arcade/blender/build_arcade.py arcade/build     # models, bakes lighting, exports arcade.glb
python arcade/blender/encode_lm.py arcade/build arcade/lm 0.8
```
Then convert `arcade/build/arcade.glb` to `arcade/arcade.gltf.json` (or point `index.html` at the .glb directly;
GitHub Pages serves .glb fine). `arcade/blender/arcade.blend` is the scene if you want to open it in Blender.

Set `BAKE_SAMPLES=24` for a quick preview bake; the shipped bake used 192.
