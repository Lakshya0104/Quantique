import numpy as np, json, matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from qiskit import QuantumCircuit, transpile
from qiskit.circuit.library import ZZFeatureMap
from qiskit.quantum_info import Statevector
from qiskit_aer import AerSimulator
rng=np.random.default_rng(7)
style={'name':'bw','fontsize':13,'subfontsize':9,'displaycolor':{}}
def sty():
    d={'h':('#F237A6','#FFFFFF'),'x':('#121216','#FFFFFF'),'z':('#121216','#FFFFFF'),'p':('#FCE4F2','#121216'),'rz':('#FCE4F2','#121216'),'rx':('#FCE4F2','#121216'),'cx':('#121216','#FFFFFF'),'cz':('#121216','#FFFFFF'),'measure':('#FFFFFF','#121216'),'mcx':('#121216','#FFFFFF'),'unitary':('#FCE4F2','#121216'),'rzz':('#FCE4F2','#121216'),'mcphase':('#121216','#FFFFFF'),'cp':('#F237A6','#121216'),'oracle':('#121216','#FFFFFF'),'diffuser':('#F237A6','#FFFFFF')}
    return {'backgroundcolor':'#FFFFFF','linecolor':'#121216','textcolor':'#121216','gatefacecolor':'#FFFFFF','gatetextcolor':'#121216','displaycolor':d,'fontsize':13,'subfontsize':9}
def save(qc,name,**k):
    f=qc.draw('mpl',style=sty(),fold=-1,plot_barriers=False,**k); f.savefig(name,dpi=220,bbox_inches='tight',transparent=True); plt.close(f)
# magnetic map 4x4 (uT), fingerprint
B=np.round(45+6*np.sin(np.linspace(0,3,16)).reshape(4,4)+rng.normal(0,2.2,(4,4)),1)
target=11  # cell 1011
meas=B.flat[target]+0.15
marked=[i for i in range(16) if abs(B.flat[i]-meas)<0.6]
print('marked',marked)
# Grover
n=4
def oracle(qc,m):
    b=format(m,'04b')[::-1]
    for i,c in enumerate(b):
        if c=='0': qc.x(i)
    qc.h(3); qc.mcx([0,1,2],3); qc.h(3)
    for i,c in enumerate(b):
        if c=='0': qc.x(i)
def diff(qc):
    qc.h(range(4)); qc.x(range(4)); qc.h(3); qc.mcx([0,1,2],3); qc.h(3); qc.x(range(4)); qc.h(range(4))
g=QuantumCircuit(4); g.h(range(4))
for _ in range(2):
    for m in marked: oracle(g,m)
    diff(g)
g.measure_all()
sim=AerSimulator(); c=sim.run(transpile(g,sim),shots=4096,seed_simulator=11).result().get_counts()
counts={format(i,'04b'):c.get(format(i,'04b'),0) for i in range(16)}
# drawable grover (1 iteration, boxed)
from qiskit.circuit import Gate
gd=QuantumCircuit(4,4,name='g'); gd.h(range(4)); gd.barrier()
gd.append(Gate('oracle',4,[],label='Oracle Uf'),range(4)); gd.append(Gate('diffuser',4,[],label='Diffuser'),range(4)); gd.barrier()
gd.append(Gate('oracle',4,[],label='Oracle Uf'),range(4)); gd.append(Gate('diffuser',4,[],label='Diffuser'),range(4)); gd.barrier()
gd.measure(range(4),range(4))
save(gd,'grover.png')
# Ramsey + IPE: sensing qubit
gamma=28e9; tau=1e-6
r=QuantumCircuit(1,1); r.h(0); r.rz(0.8,0); r.h(0); r.measure(0,0)
from qiskit.circuit import Parameter
ph=Parameter('φ=γBτ'); r=QuantumCircuit(1,1); r.h(0); r.p(ph,0); r.barrier(); r.h(0); r.measure(0,0)
save(r,'ramsey.png')
k=Parameter('2ᵏφ'); w=Parameter('ω_k'); ipe=QuantumCircuit(2,1); ipe.x(1); ipe.h(0); ipe.cp(k,0,1); ipe.p(w,0); ipe.h(0); ipe.measure(0,0)
save(ipe,'ipe.png')
# Ramsey fringe data for chart: P(1) vs B
Bs=np.linspace(0,1.0,41)  # uT offset
# phase = 2*pi*gamma_e*B*tau with gamma 28 GHz/T, tau 20us -> 0.56 rad per uT *2pi
p1=[(1-np.cos(2*np.pi*28e9*b*1e-6*20e-6))/2 for b in Bs]
# ZZ feature map
fm=ZZFeatureMap(4,reps=1); save(fm.decompose(),'zz.png')
# kernel matrix on synthetic fingerprints, 3 zones
Z=[]; y=[]
for z,(mu) in enumerate([(0.3,0.8,0.2,0.5),(0.9,0.3,0.7,0.4),(0.5,0.5,1.0,0.9)]):
    for _ in range(8): Z.append(np.clip(np.array(mu)+rng.normal(0,0.07,4),0,1)*np.pi); y.append(z)
fm2=ZZFeatureMap(4,reps=2)
sv=[Statevector(fm2.assign_parameters(x)) for x in Z]
K=np.array([[abs(a.inner(b))**2 for b in sv] for a in sv])
from matplotlib.colors import LinearSegmentedColormap
cm=LinearSegmentedColormap.from_list('p',['#FFFFFF','#FCE4F2','#F237A6','#7A0F4F'])
f,a=plt.subplots(figsize=(4.2,4.2)); a.imshow(K,cmap=cm,vmin=0,vmax=1); a.set_xticks([3.5,11.5,19.5]); a.set_xticklabels(['Corridor','Stairwell','Lab'],fontsize=10); a.set_yticks([3.5,11.5,19.5]); a.set_yticklabels(['Corridor','Stairwell','Lab'],fontsize=10,rotation=90,va='center')
for s in a.spines.values(): s.set_visible(False)
a.tick_params(length=0)
for v in [7.5,15.5]: a.axhline(v,color='#121216',lw=.6); a.axvline(v,color='#121216',lw=.6)
f.savefig('kernel.png',dpi=220,bbox_inches='tight',transparent=True); plt.close(f)
inzone=np.mean([K[i,j] for i in range(24) for j in range(24) if y[i]==y[j] and i!=j]); cross=np.mean([K[i,j] for i in range(24) for j in range(24) if y[i]!=y[j]])
print('kernel in/cross',inzone,cross)
# QAOA p=1 on 4-node route graph
q=QuantumCircuit(4); q.h(range(4)); q.barrier()
ga=Parameter('γ'); be=Parameter('β')
for (i,j) in [(0,1),(1,2),(2,3),(0,3)]: q.rzz(2*ga,i,j)
q.barrier()
for i in range(4): q.rx(2*be,i)
q.measure_all()
save(q,'qaoa.png')
# drift sim
T=180; dt=1.0; t=np.arange(T)
def run(sig_mag,seed):
    r=np.random.default_rng(seed); errs=[]
    for trial in range(200):
        bias=r.normal(0,0.02); e=0; v=0; out=[]
        for k in t:
            v+=bias*dt+r.normal(0,0.01); e+=v*dt
            if sig_mag is not None and k%10==9:
                # fix accuracy: better sensor -> tighter fix
                fixsd=0.8+6*sig_mag
                e=r.normal(0,fixsd); v*=0.3
            out.append(abs(e))
        errs.append(out)
    return np.mean(errs,axis=0)
ins=run(None,1); mems=run(1.0,2); nv=run(0.05,3)
json.dump({'counts':counts,'marked':marked,'map':B.tolist(),'meas':meas,'fringeB':Bs.tolist(),'fringe':p1,
 't':t[::10].tolist(),'ins':ins[::10].round(1).tolist(),'mems':mems[::10].round(1).tolist(),'nv':nv[::10].round(1).tolist(),'kin':inzone,'kx':cross},open('data.json','w'))
print(counts); print('final',ins[-1],mems[-1],nv[-1])
