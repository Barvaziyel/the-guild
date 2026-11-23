import re, base64, subprocess, sys, numpy as np, os, json
import sys
SRC=sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ext', 'sf', 'FluidR3_GM')
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'samples')
SR=44100
def dec(mp3):
    p=subprocess.run(['ffmpeg','-v','error','-i','pipe:0','-f','f32le','-ac','2','-ar',str(SR),'pipe:1'],input=mp3,capture_output=True)
    a=np.frombuffer(p.stdout,dtype=np.float32).reshape(-1,2)
    return a
for f in sorted(os.listdir(SRC)):
    name=f.replace('-mp3.js','')
    if os.path.exists(f'{OUT}/{name}.npz'): continue
    txt=open(f'{SRC}/{f}').read()
    notes=dict(re.findall(r'"([A-G]b?\d)":\s*"data:audio/mp3;base64,([^"]+)"',txt))
    arrs={k:dec(base64.b64decode(v)) for k,v in notes.items()}
    np.savez_compressed(f'{OUT}/{name}.npz',**arrs)
    lens=[len(a)/SR for a in arrs.values()]
    print(name,len(arrs),'notes', 'dur %.2f-%.2f s'%(min(lens),max(lens)), flush=True)
