from pathlib import Path
import shutil
root=Path(__file__).parent
out=root/'dist'
out.mkdir(exist_ok=True)
for name in ['index.html','style.css','game.js','multiplayer.js']:
    shutil.copy2(root/name,out/name)
print('Built Foam Forge static game.')
