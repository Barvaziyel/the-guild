import sys, numpy as np, subprocess
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from engine import SR
def load(p):
    out=subprocess.run(['ffmpeg','-v','error','-i',p,'-f','f32le','-ac','2','-ar',str(SR),'pipe:1'],capture_output=True).stdout
    return np.frombuffer(out,dtype=np.float32).reshape(-1,2)
paths=sys.argv[1:]
fig,axes=plt.subplots(len(paths),1,figsize=(14,3.2*len(paths)))
axes=np.atleast_1d(axes)
for ax,p in zip(axes,paths):
    a=load(p); m=a.mean(1)
    ax.specgram(m,NFFT=4096,Fs=SR,noverlap=2048,cmap='magma',vmin=-130)
    ax.set_ylim(0,5000); ax.set_title(p)
    rms=np.array([np.sqrt(np.mean(m[i:i+SR//2]**2)) for i in range(0,len(m),SR//2)])
    ax2=ax.twinx(); ax2.plot(np.arange(len(rms))*0.5,20*np.log10(rms+1e-9),'c'); ax2.set_ylim(-60,0)
    seam=np.abs(a[-1]-a[0]).max(); step=np.abs(np.diff(a,axis=0)).max()
    print(p,'len %.2f'%(len(a)/SR),'seam jump %.4f vs max step %.4f'%(seam,step))
plt.tight_layout(); plt.savefig('/tmp/look.png',dpi=60)
