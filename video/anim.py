import numpy as np, json, matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt, imageio_ffmpeg as I
from matplotlib.animation import FFMpegWriter, FuncAnimation
from matplotlib.colors import LinearSegmentedColormap
plt.rcParams['animation.ffmpeg_path']=I.get_ffmpeg_exe()
plt.rcParams['font.family']='Carlito'
PINK='#F237A6'; INK='#121216'; GREY='#A8A8B2'
d=json.load(open('durs.json')); FPS=25
def fig():
    f=plt.figure(figsize=(19.2,10.8),dpi=100); f.patch.set_facecolor('white'); return f
# ---- drift
f=fig(); ax=f.add_axes([0.06,0.08,0.88,0.76]); ax.set_axis_off()
f.text(0.06,0.93,'GPS LOST · INERTIAL DRIFT vs VOID-NAV',fontsize=16,color=PINK,family='DejaVu Sans Mono',weight='bold')
f.text(0.06,0.87,'The drone recognises the magnetic fingerprint and corrects itself',fontsize=30,color=INK,family='Caladea',weight='bold')
x=np.linspace(0,10,400); yy=np.linspace(0,5,200); X,Y=np.meshgrid(x,yy)
Bf=np.sin(X*1.3)*np.cos(Y*1.7)+0.6*np.sin(X*0.5+Y)+0.3*np.cos(3*X-2*Y)
cm=LinearSegmentedColormap.from_list('p',['#FFFFFF','#FDEBF5','#F9C4E2'])
ax.imshow(Bf,extent=[0,10,0,5],origin='lower',cmap=cm,aspect='auto',alpha=.9)
ax.contour(X,Y,Bf,levels=8,colors='#F237A6',linewidths=.5,alpha=.35)
tx=np.linspace(0.3,9.7,400); ty=2.5+1.2*np.sin(tx*0.7)+0.3*np.sin(tx*2.1)
ins_y=ty+0.012*(np.arange(400)**1.55)/40; ins_x=tx-0.0015*np.arange(400)
rng=np.random.default_rng(3); vy=ty.copy(); vx=tx.copy(); err=0; fixes=[]
for i in range(400):
    err+=0.004+rng.normal(0,0.002)
    if i%70==69: err=0; fixes.append(i)
    vy[i]=ty[i]+err*1.2
ax.set_xlim(0,10); ax.set_ylim(0,5)
lt,=ax.plot([],[],color=INK,lw=2.5,ls=(0,(6,5)),label='True path')
li,=ax.plot([],[],color=GREY,lw=4,label='Inertial only')
lv,=ax.plot([],[],color=PINK,lw=4.5,label='VOID-NAV')
di,=ax.plot([],[],'o',color=GREY,ms=16); dv,=ax.plot([],[],'o',color=PINK,ms=18,mec='white',mew=3)
leg=ax.legend(loc='lower right',fontsize=18,frameon=False)
ring=[ax.add_patch(plt.Circle((0,0),0.01,fill=False,ec=PINK,lw=3,alpha=0)) ]
lab=ax.text(0,0,'',fontsize=17,color=PINK,weight='bold')
eb=f.text(0.94,0.06,'',fontsize=22,ha='right',color=INK,family='Caladea')
N=int(d[2]*FPS)
def up(fr):
    i=min(399,int(fr/(N*0.85)*399))
    lt.set_data(tx[:i+1],ty[:i+1]); li.set_data(ins_x[:i+1],ins_y[:i+1]); lv.set_data(vx[:i+1],vy[:i+1])
    di.set_data([ins_x[i]],[ins_y[i]]); dv.set_data([vx[i]],[vy[i]])
    last=[q for q in fixes if q<=i]
    if last and i-last[-1]<25:
        k=(i-last[-1])/25; ring[0].center=(vx[last[-1]],vy[last[-1]]); ring[0].set_radius(0.1+0.5*k); ring[0].set_alpha(1-k)
        lab.set_position((vx[last[-1]]+0.15,vy[last[-1]]-0.45)); lab.set_text('magnetic fix ✓')
    else: ring[0].set_alpha(0); lab.set_text('')
    e1=np.hypot(ins_x[i]-tx[i],ins_y[i]-ty[i])*60; e2=abs(vy[i]-ty[i])*60
    eb.set_text(f'error  ·  inertial {e1:5.0f} m    VOID-NAV {e2:4.1f} m')
FuncAnimation(f,up,frames=N).save('drift.mp4',writer=FFMpegWriter(fps=FPS,codec='libx264',extra_args=['-pix_fmt','yuv420p','-crf','20'])); plt.close(f)
# ---- grover
M={6,11}; a=np.full(16,0.25); st=[('Equal superposition  H⊗⁴',a.copy())]
for r in (1,2):
    a=a.copy(); a[list(M)]*=-1; st.append((f'Round {r}: oracle flips the matching cells',a.copy()))
    a=2*a.mean()-a; st.append((f'Round {r}: diffuser amplifies them',a.copy()))
f=fig(); ax=f.add_axes([0.07,0.14,0.86,0.62])
f.text(0.07,0.93,"GROVER'S SEARCH · 4 QUBITS · 16 MAP CELLS",fontsize=16,color=PINK,family='DejaVu Sans Mono',weight='bold')
f.text(0.07,0.86,'Amplitude amplification finds the matching cells',fontsize=30,color=INK,family='Caladea',weight='bold')
st_t=f.text(0.07,0.80,'',fontsize=22,color='#5E5E6A',family='Caladea',style='italic')
labels=[format(i,'04b') for i in range(16)]
bars=ax.bar(range(16),np.zeros(16),color=[PINK if i in M else '#D9D9DF' for i in range(16)],width=0.72)
ax.axhline(0,color=INK,lw=1); ax.set_ylim(-0.45,1.0); ax.set_xticks(range(16)); ax.set_xticklabels(labels,fontsize=15,family='DejaVu Sans Mono')
for s in ['top','right','bottom']: ax.spines[s].set_visible(False)
ax.set_ylabel('amplitude',fontsize=18,color='#5E5E6A'); ax.tick_params(axis='y',labelsize=14)
pt=ax.text(0,0,'',fontsize=20,color=PINK,weight='bold',ha='center')
N=int(d[6]*FPS); seg=N/(len(st)-0.3)
def up(fr):
    k=min(len(st)-1,fr/seg); i=int(k); t=min(1,(k-i)*1.8); t=t*t*(3-2*t)
    v=st[i][1] if i==len(st)-1 else st[i][1]*(1-t)+st[i+1][1]*t
    for b,h in zip(bars,v): b.set_height(h)
    st_t.set_text(st[min(len(st)-1,i+ (1 if t>0.5 and i<len(st)-1 else 0))][0])
    if k>=len(st)-1.2: pt.set_position((8.5,0.88)); pt.set_text(f'P(0110) + P(1011) ≈ {sum(v[list(M)]**2):.0%}')
    else: pt.set_text('')
FuncAnimation(f,up,frames=N).save('grover.mp4',writer=FFMpegWriter(fps=FPS,codec='libx264',extra_args=['-pix_fmt','yuv420p','-crf','20'])); plt.close(f)
print('ok')
