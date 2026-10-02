"""QAOA relay placement for RescueMesh: choose K relay spots that maximise survivor coverage."""
import numpy as np, itertools
from qiskit import QuantumCircuit, transpile
from qiskit.circuit.library import DiagonalGate
from qiskit_aer import AerSimulator
from scipy.optimize import minimize
rng=np.random.default_rng(4)
# 6 candidate relay spots, 8 survivor clusters (weight = estimated people), coverage radius
spots=np.array([[1,1],[4,1],[7,2],[2,5],[5,5],[8,6]],float)
clusters=np.array([[1,2],[3,1],[6,1],[8,3],[2,6],[4,6],[6,5],[8,7]],float); w=np.array([3,1,2,4,2,5,1,3])
R=2.4; K=2; P=6.0
cover=(np.linalg.norm(clusters[:,None]-spots[None],axis=2)<=R)
def cost(x):
    x=np.array(x); covered=(cover@x)>0
    return -(w@covered) + P*(x.sum()-K)**2
n=6; diag_c=np.array([cost([int(b) for b in format(z,'06b')[::-1]]) for z in range(2**n)])
sim=AerSimulator()
def circ(params,p):
    g,b=params[:p],params[p:]; qc=QuantumCircuit(n); qc.h(range(n))
    for l in range(p):
        qc.append(DiagonalGate(list(np.exp(-1j*g[l]*diag_c/ np.abs(diag_c).max()))),range(n))
        for i in range(n): qc.rx(2*b[l],i)
    qc.measure_all(); return qc
def energy(params,p,shots=2048):
    c=sim.run(transpile(circ(params,p),sim),shots=shots,seed_simulator=7).result().get_counts()
    return sum(v*diag_c[int(k,2)] for k,v in c.items())/shots, c
best=None
for p in (1,2):
    for s in range(6):
        x0=rng.uniform(0,np.pi,2*p)
        r=minimize(lambda t:energy(t,p)[0],x0,method='COBYLA',options={'maxiter':120})
        e,c=energy(r.x,p,8192)
        if best is None or e<best[0]: best=(e,p,c)
e,p,c=best
top=max(c,key=lambda k:-diag_c[int(k,2)] if c[k]>40 else -1e9)
opt=int(np.argmin(diag_c))
pick=[i for i,b in enumerate(format(int(top,2),'06b')[::-1]) if b=='1']
print('p =',p,'| QAOA best sampled relays',pick,'covers',-diag_c[int(top,2)],'people')
print('brute-force optimum',[i for i,b in enumerate(format(opt,'06b')[::-1]) if b=='1'],'covers',-diag_c[opt])
print('probability of optimum in QAOA samples',f"{c.get(format(opt,'06b'),0)/8192:.1%}",'vs random',f"{1/64:.1%}")
print('total people',w.sum())
