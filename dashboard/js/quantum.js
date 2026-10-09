// QAOA statevector simulation (same maths as Qiskit Aer statevector), in the browser.
export function buildProblem(sites, clusters, K, radius) {
  const n = sites.length, N = 1 << n;
  const cover = sites.map(s => clusters.map(c => Math.hypot(s.x - c.x, s.z - c.z) <= radius));
  const total = clusters.reduce((a, c) => a + c.w, 0);
  const P = total * 0.1;
  const value = new Float64Array(N), cost = new Float64Array(N);
  for (let z = 0; z < N; z++) {
    let cnt = 0; const cov = new Array(clusters.length).fill(false);
    for (let i = 0; i < n; i++) if (z >> i & 1) { cnt++; cover[i].forEach((v, j) => { if (v) cov[j] = true; }); }
    let v = 0; cov.forEach((b, j) => { if (b) v += clusters[j].w; });
    value[z] = v; cost[z] = -v + P * (cnt - K) ** 2;
  }
  const norm = Float64Array.from(cost, c => c / total);
  let best = 0; for (let z = 1; z < N; z++) if (cost[z] < cost[best]) best = z;
  return { n, N, cost, norm, value, total, best, K };
}
export function qaoaState(pb, gammas, betas) {
  const { n, N, norm } = pb; const re = new Float64Array(N), im = new Float64Array(N);
  const a0 = 1 / Math.sqrt(N); re.fill(a0);
  for (let l = 0; l < gammas.length; l++) {
    const g = gammas[l] * Math.PI * 2, b = betas[l];
    for (let z = 0; z < N; z++) { const ph = -g * norm[z], c = Math.cos(ph), s = Math.sin(ph); const r = re[z], i = im[z]; re[z] = r * c - i * s; im[z] = r * s + i * c; }
    const cb = Math.cos(b), sb = Math.sin(b);
    for (let q = 0; q < n; q++) { const m = 1 << q; for (let z = 0; z < N; z++) if (!(z & m)) { const z1 = z | m; const ar = re[z], ai = im[z], br = re[z1], bi = im[z1];
      re[z] = cb * ar + sb * bi; im[z] = cb * ai - sb * br; re[z1] = cb * br + sb * ai; im[z1] = cb * bi - sb * ar; } }
  }
  const p = new Float64Array(N); for (let z = 0; z < N; z++) p[z] = re[z] ** 2 + im[z] ** 2; return p;
}
export const expect = (pb, p) => { let e = 0; for (let z = 0; z < pb.N; z++) e += p[z] * pb.norm[z]; return e; };
export const bits = (z, n) => Array.from({ length: n }, (_, i) => (z >> i) & 1);

export function sample(p, shots) { const N = p.length, cdf = new Float64Array(N); let s = 0; for (let i = 0; i < N; i++) { s += p[i]; cdf[i] = s; }
  const counts = new Map(); for (let k = 0; k < shots; k++) { const r = Math.random() * s; let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < r) lo = m + 1; else hi = m; } counts.set(lo, (counts.get(lo) || 0) + 1); } return counts; }

// CVaR objective (Barkoutsos et al., Quantum 2020): mean cost of the best alpha fraction of outcomes
export function cvar(pb, p, alpha = 0.1) { if (!pb.order) pb.order = [...pb.norm.keys()].sort((a, b) => pb.norm[a] - pb.norm[b]);
  let acc = 0, s = 0; for (const z of pb.order) { const t = Math.min(p[z], alpha - acc); s += t * pb.norm[z]; acc += t; if (acc >= alpha) break; } return s / alpha; }
