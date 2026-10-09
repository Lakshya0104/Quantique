import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import * as Z from './zone.js';
import { buildProblem, qaoaState, bits, sample, cvar } from './quantum.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const PCOL = ['#ff2d55', '#ff8a1f', '#f5d547', '#2fe08a'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ============ STATE ============ */
const S = { msgs: [], clusters: new Map(), running: false, t0: null, selected: null, filter: 'all', muted: false, voiceLang: 'multi', phones: 0,
  hospitals: Z.HOSPITALS.map(h => ({ ...h, free: h.beds })), ambs: [], log: [], down: new Set(), mstat: { del: 0, re: 0, dup: 0, hops: [] }, plan: null, bootT: Date.now() };
Z.HOSPITALS.forEach((h, i) => { for (let k = 0; k < (h.trauma ? 2 : 1); k++) S.ambs.push({ id: `TS-108-${String(i * 2 + k + 21).padStart(3, '0')}`, base: h, lat: h.lat, lon: h.lon, status: 'AVAILABLE' }); });
const nodeOf = id => Z.NET.find(n => n.id === id);

/* ============ RENDERER ============ */
const wrap = $('#three');
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
Object.assign(renderer.domElement.style,{position:"absolute",top:0,left:0,display:"block"}); wrap.appendChild(renderer.domElement);
const labelR = new CSS2DRenderer(); Object.assign(labelR.domElement.style, { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }); wrap.appendChild(labelR.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x04070d); scene.fog = new THREE.Fog(0x04070d, 60, 140);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400); camera.position.set(0, 40, 46);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enableDamping: true, dampingFactor: .07, maxPolarAngle: Math.PI * .44, minDistance: 8, maxDistance: 95, autoRotate: false, autoRotateSpeed: .3 });
function fit() { const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return; renderer.setSize(w, h); labelR.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(fit).observe(wrap); fit();
scene.add(new THREE.HemisphereLight(0x8fc4ff, 0x05070d, 1.0));
const sun = new THREE.DirectionalLight(0xbfe0ff, 1.1); sun.position.set(-30, 50, 20); scene.add(sun);

const L = (t, x, y, z, cls) => { const d = document.createElement('div'); d.className = cls; if (typeof t === 'string') d.textContent = t; else d.appendChild(t); const o = new CSS2DObject(d); o.position.set(x, y, z); scene.add(o); return o; };

/* ============ MAP: real GHMC wards ============ */
const proj = c => { const p = Z.toXZ(c[1], c[0]); return new THREE.Vector3(p.x, 0, p.z); };
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x060a12, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.02; scene.add(ground);
// whole city wards (context, faint)
{ const pos = []; Z.GEO.ghmc.forEach(w => { const pts = w.c.map(proj); for (let i = 0; i < pts.length - 1; i++) pos.push(pts[i].x, .01, pts[i].z, pts[i + 1].x, .01, pts[i + 1].z); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1a3550, transparent: true, opacity: .7 }))); }
// zone wards (filled + glowing outline + names)
const zonePolys = Z.GEO.zone.map(w => w.c.map(c => { const p = Z.toXZ(c[1], c[0]); return [p.x, p.z]; }));
Z.GEO.zone.forEach((w, i) => { const shp = new THREE.Shape(zonePolys[i].map(([x, z]) => new THREE.Vector2(x, -z)));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shp), new THREE.MeshBasicMaterial({ color: 0x0b1b2e, transparent: true, opacity: .95 })); m.rotation.x = -Math.PI / 2; m.position.y = .005; scene.add(m);
  const pts = zonePolys[i].map(([x, z]) => new THREE.Vector3(x, .06, z)); const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2f8fc0, transparent: true, opacity: .9 })); scene.add(ln);
  const cx = zonePolys[i].reduce((a, p) => a + p[0], 0) / zonePolys[i].length, cz = zonePolys[i].reduce((a, p) => a + p[1], 0) / zonePolys[i].length; L(Z.wardName(w.n).toUpperCase(), cx, .3, cz, 'lbl w'); });
const pip = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const inZone = (x, z) => zonePolys.some(p => pip(x, z, p));
const bb = zonePolys.flat().reduce((a, [x, z]) => ({ x0: Math.min(a.x0, x), x1: Math.max(a.x1, x), z0: Math.min(a.z0, z), z1: Math.max(a.z1, z) }), { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 });
// buildings inside the zone
const B = { mesh: null, list: [] };
{ const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, .5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x223650, roughness: .75, metalness: .15 }); const N = 4200, inst = new THREE.InstancedMesh(geo, mat, N); const m4 = new THREE.Matrix4(); let k = 0, guard = 0;
  while (k < N && guard++ < 60000) { const x = bb.x0 + Math.random() * (bb.x1 - bb.x0), z = bb.z0 + Math.random() * (bb.z1 - bb.z0); if (!inZone(x, z)) continue;
    const w = .18 + Math.random() * .32, d = .18 + Math.random() * .32, h = (.08 + Math.random() ** 2 * .45), r = (Math.random() - .5) * .3;
    B.list.push({ x, z, w, d, h, r }); m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), new THREE.Vector3(w, h, d)); inst.setMatrixAt(k, m4); inst.setColorAt(k, new THREE.Color(0x223650).offsetHSL(0, 0, Math.random() * .06)); k++; }
  inst.count = k; scene.add(inst); B.mesh = inst; }
function collapseAround(x0, z0, rad) { const m4 = new THREE.Matrix4(); B.list.forEach((b, i) => { const d = Math.hypot(b.x - x0, b.z - z0); if (d > rad || Math.random() < .35) return;
    m4.compose(new THREE.Vector3(b.x, 0, b.z), new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - .5) * .5, b.r, (Math.random() - .5) * .5)), new THREE.Vector3(b.w * 1.2, b.h * .25, b.d * 1.2)); B.mesh.setMatrixAt(i, m4); B.mesh.setColorAt(i, new THREE.Color(0x5a2a22)); });
  B.mesh.instanceMatrix.needsUpdate = true; B.mesh.instanceColor.needsUpdate = true; }

/* ============ HEAT (smooth survivor density texture) ============ */
const HN = 512, hc = document.createElement('canvas'); hc.width = hc.height = HN; const hctx = hc.getContext('2d'); const htex = new THREE.CanvasTexture(hc); htex.colorSpace = THREE.SRGBColorSpace;
const PADX = 3, hx0 = bb.x0 - PADX, hx1 = bb.x1 + PADX, hz0 = bb.z0 - PADX, hz1 = bb.z1 + PADX;
const heatPlane = new THREE.Mesh(new THREE.PlaneGeometry(hx1 - hx0, hz1 - hz0), new THREE.MeshBasicMaterial({ map: htex, transparent: true, depthWrite: false, opacity: .92 }));
heatPlane.rotation.x = -Math.PI / 2; heatPlane.position.set((hx0 + hx1) / 2, .09, (hz0 + hz1) / 2); scene.add(heatPlane);
const RAMP = [[0, [20, 50, 90, 0]], [.12, [43, 212, 196, 90]], [.35, [245, 213, 71, 170]], [.6, [255, 138, 31, 210]], [.82, [255, 45, 85, 235]], [1, [255, 156, 240, 250]]];
const rampRGBA = v => { v = Math.max(0, Math.min(1, v)); for (let i = 1; i < RAMP.length; i++) if (v <= RAMP[i][0]) { const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i], t = (v - a) / (b - a); return ca.map((c, j) => c + (cb[j] - c) * t); } return RAMP.at(-1)[1]; };
const rampHex = v => { const [r, g, b] = rampRGBA(v); return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join(''); };
const blobs = []; // {x,z,w,r}
function drawHeat() { const F = new Float32Array(HN * HN); let mx = 0;
  blobs.forEach(b => { const cx = (b.x - hx0) / (hx1 - hx0) * HN, cz = (b.z - hz0) / (hz1 - hz0) * HN, rr = b.r / (hx1 - hx0) * HN, R = Math.ceil(rr * 3);
    for (let y = Math.max(0, Math.floor(cz - R)); y < Math.min(HN, cz + R); y++) for (let x = Math.max(0, Math.floor(cx - R)); x < Math.min(HN, cx + R); x++) { const d2 = ((x - cx) ** 2 + (y - cz) ** 2) / (rr * rr); if (d2 < 9) F[y * HN + x] += b.w * Math.exp(-d2 / 2); } });
  for (const v of F) mx = Math.max(mx, v); const norm = Math.max(mx, 14); const img = hctx.createImageData(HN, HN);
  for (let i = 0; i < F.length; i++) { const [r, g, b, a] = rampRGBA(F[i] / norm); img.data.set([r, g, b, F[i] < .02 ? 0 : a], i * 4); }
  hctx.putImageData(img, 0, 0); htex.needsUpdate = true; }
drawHeat();

/* ============ NETWORK (nodes, relays, gateway) ============ */
const net3 = new Map(); const linkGrp = new THREE.Group(); scene.add(linkGrp);
Z.NET.forEach(n => { const p = Z.toXZ(n.lat, n.lon), g = new THREE.Group(), col = n.kind === 'node' ? 0xa78bfa : 0x39d0ff;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, n.kind === 'gw' ? 3 : 2), new THREE.MeshStandardMaterial({ color: 0x9cc3d8 })); pole.position.y = n.kind === 'gw' ? 1.5 : 1;
  const top = new THREE.Mesh(n.kind === 'node' ? new THREE.OctahedronGeometry(.32) : new THREE.SphereGeometry(n.kind === 'gw' ? .4 : .26, 16, 16), new THREE.MeshBasicMaterial({ color: col })); top.position.y = n.kind === 'gw' ? 3.1 : 2.1;
  g.add(pole, top); if (n.kind === 'gw') { const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, .3, 6), new THREE.MeshBasicMaterial({ color: 0x39d0ff })); g.add(base); }
  g.position.set(p.x, 0, p.z); g.userData = { top, n }; scene.add(g); net3.set(n.id, g);
  L(n.kind === 'gw' ? '◆ COMMAND POST · GATEWAY' : n.id, p.x, n.kind === 'gw' ? 3.9 : 2.8, p.z, n.kind === 'gw' ? 'lbl h' : 'lbl nd'); });
const arc = (a, b, ha = 2.1, hb = 2.1, lift = 1.6) => { const pa = new THREE.Vector3(a.x, ha, a.z), pb = new THREE.Vector3(b.x, hb, b.z), m = pa.clone().add(pb).multiplyScalar(.5); m.y += lift; return new THREE.QuadraticBezierCurve3(pa, m, pb); };
const neigh = id => { const a = nodeOf(id); return Z.NET.filter(b => b.id !== id && !S.down.has(b.id) && Z.distKm(a, b) <= Z.RANGE_KM); };
function hopDist() { const d = { GW: 0 }, q = ['GW']; while (q.length) { const c = q.shift(); neigh(c).forEach(n => { if (d[n.id] === undefined) { d[n.id] = d[c] + 1; q.push(n.id); } }); } return d; }
function route(from) { const d = hopDist(); if (d[from] === undefined) return null; const path = [from]; let cur = from; while (cur !== 'GW') { const nx = neigh(cur).filter(n => d[n.id] < d[cur]).sort((a, b) => d[a.id] - d[b.id])[0]; if (!nx) return null; cur = nx.id; path.push(cur); } return path; }
function drawLinks() { linkGrp.clear(); const d = hopDist();
  for (let i = 0; i < Z.NET.length; i++) for (let j = i + 1; j < Z.NET.length; j++) { const a = Z.NET[i], b = Z.NET[j]; if (Z.distKm(a, b) > Z.RANGE_KM) continue; const down = S.down.has(a.id) || S.down.has(b.id);
    const c = arc(Z.toXZ(a.lat, a.lon), Z.toXZ(b.lat, b.lon), a.kind === 'gw' ? 3.1 : 2.1, b.kind === 'gw' ? 3.1 : 2.1, .9);
    linkGrp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(24)), new THREE.LineBasicMaterial({ color: down ? 0x5a2030 : 0x2a8fc8, transparent: true, opacity: down ? .35 : .45 }))); }
  net3.forEach((g, id) => g.userData.top.material.color.set(S.down.has(id) ? 0x5a2030 : g.userData.n.kind === 'node' ? 0xa78bfa : 0x39d0ff)); }
drawLinks();
const packets = [];
function packet3D(path, color) { const pts = path.map(id => { const n = nodeOf(id); return { ...Z.toXZ(n.lat, n.lon), h: n.kind === 'gw' ? 3.1 : 2.1 }; });
  const curves = []; for (let i = 0; i < pts.length - 1; i++) curves.push(arc(pts[i], pts[i + 1], pts[i].h, pts[i + 1].h, 1.4));
  const s = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 12), new THREE.MeshBasicMaterial({ color })); const trail = new THREE.Mesh(new THREE.SphereGeometry(.45, 12, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .25 }));
  scene.add(s, trail); packets.push({ s, trail, curves, t: 0 }); }
// hospitals in / near zone
Z.HOSPITALS.forEach(h => { const p = Z.toXZ(h.lat, h.lon); if (Math.hypot(p.x, p.z) > 36) return; const g = new THREE.Group();
  const a = new THREE.Mesh(new THREE.BoxGeometry(1, .26, .32), new THREE.MeshBasicMaterial({ color: 0x2fe08a })), b = a.clone(); b.rotation.y = Math.PI / 2; g.add(a, b); g.position.set(p.x, 1.6, p.z); scene.add(g);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.6), new THREE.MeshBasicMaterial({ color: 0x2fe08a, transparent: true, opacity: .5 })); pole.position.set(p.x, .8, p.z); scene.add(pole);
  L('✚ ' + h.name, p.x, 2.4, p.z, 'lbl h'); });

/* ============ PINS (survivors per SOS point) ============ */
const pins = new Map();
function upsertPin(c) { const n = nodeOf(c.node), p = Z.toXZ(n.lat, n.lon); const col = c.state === 'DISPATCHED' ? '#2fe08a' : PCOL[c.prio];
  let P = pins.get(c.node); if (!P) { const g = new THREE.Group(); const beam = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 5, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: .8 })); beam.position.y = 2.5;
      const ring = new THREE.Mesh(new THREE.RingGeometry(.4, .5, 40), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .12;
      g.add(beam, ring); g.position.set(p.x + .6, 0, p.z + .6); scene.add(g); const el = document.createElement('div'); el.className = 'pin'; el.onclick = () => focusCluster(c.node);
      const lab = L(el, p.x + .6, 5.4, p.z + .6, ''); lab.element.style.pointerEvents = 'auto'; P = { g, beam, ring, el, born: performance.now() }; pins.set(c.node, P); }
  P.beam.material.color.set(col); P.ring.material.color.set(col); P.el.style.setProperty('--c', col);
  const stuck = c.stuck, other = c.people - c.stuck;
  P.el.innerHTML = `<i>${stuck || c.people}</i><span>${stuck ? 'survivors stuck' : (c.cat === 'SAFE' ? 'safe' : 'need help')}<small>${c.ward} · ${c.msgs.length} SOS${other > 0 && stuck ? ` · +${other} other` : ''}</small></span>`; }

/* ============ CAMERA & LOOP ============ */
let fly = null;
function flyTo(pos, tgt, dur = 1.8) { fly = { f: camera.position.clone(), t: pos.clone(), ft: controls.target.clone(), tt: tgt.clone(), k: 0, dur }; }
function focusCluster(id) { const n = nodeOf(id), p = Z.toXZ(n.lat, n.lon); flyTo(new THREE.Vector3(p.x + 6, 13, p.z + 15), new THREE.Vector3(p.x, 0, p.z)); }
$('#vTop').onclick = () => flyTo(new THREE.Vector3(0, 70, .1), new THREE.Vector3(0, 0, 0));
$('#vTilt').onclick = () => flyTo(new THREE.Vector3(0, 34, 40), new THREE.Vector3(0, 0, 0));
$('#vSpin').onclick = () => controls.autoRotate = !controls.autoRotate;
const waves = []; const clk = new THREE.Clock();
function loop() { requestAnimationFrame(loop); const dt = clk.getDelta(), t = performance.now() / 1000;
  if (fly) { fly.k = Math.min(1, fly.k + dt / fly.dur); const e = 1 - Math.pow(1 - fly.k, 3); camera.position.lerpVectors(fly.f, fly.t, e); controls.target.lerpVectors(fly.ft, fly.tt, e); if (fly.k >= 1) fly = null; }
  controls.update();
  pins.forEach(P => { const a = ((t * 1000 - P.born) % 1800) / 1800; P.ring.scale.setScalar(1 + a * 6); P.ring.material.opacity = (1 - a) * .9; });
  net3.forEach((g, id) => { if (!S.down.has(id)) g.userData.top.scale.setScalar(1 + Math.sin(t * 3 + id.charCodeAt(1)) * .12); });
  for (let j = packets.length - 1; j >= 0; j--) { const p = packets[j]; p.t += dt * 1.3; const s = Math.floor(p.t); if (s >= p.curves.length) { scene.remove(p.s, p.trail); packets.splice(j, 1); continue; } const pos = p.curves[s].getPoint(p.t - s); p.s.position.copy(pos); p.trail.position.lerp(pos, .35); }
  for (let j = waves.length - 1; j >= 0; j--) { const w = waves[j]; w.t += dt * .45; if (w.t < 0) { w.m.visible = false; continue; } w.m.visible = true; w.m.scale.setScalar(1 + w.t * 30); w.m.material.opacity = Math.max(0, .9 - w.t); if (w.t > 1) { scene.remove(w.m); waves.splice(j, 1); } }
  S.ambs.forEach(a => { if (a.status === 'AVAILABLE') return; const g = ambMesh(a), p = Z.toXZ(a.lat, a.lon); g.position.set(p.x, 0, p.z); g.userData.l.material.color.set(Math.sin(t * 12) > 0 ? 0xff2d55 : 0x39d0ff); });
  renderer.render(scene, camera); labelR.render(scene, camera); }
loop();
function shock(x, z) { for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(.95, 1, 80), new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(x, .15, z); scene.add(m); waves.push({ m, t: -i * .45 }); } }
const ambM = new Map();
function ambMesh(a) { if (ambM.has(a.id)) return ambM.get(a.id); const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.7, .35, .35), new THREE.MeshBasicMaterial({ color: 0xffffff })); b.position.y = .25;
  const l = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2d55 })); l.position.y = .52; g.add(b, l); g.userData.l = l; scene.add(g); ambM.set(a.id, g); return g; }

/* ============ SEMANTIC ENCODER (runs on the node) ============ */
const NUMW = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6 };
function understand(text, panic) { const lo = (text || '').toLowerCase(); const r = { cat: panic ? 'TRAPPED' : 'RESCUE', injured: 'MAYBE', flags: [], hits: [] };
  Z.RULES.forEach(rule => rule.k.forEach(k => { if (lo.includes(k.toLowerCase())) { r.hits.push(k); if (rule.set) { if (rule.set.cat && !(r.cat === 'TRAPPED' && rule.set.cat !== 'TRAPPED')) r.cat = rule.set.cat; if (rule.set.injured) r.injured = rule.set.injured; } if (rule.flag && !r.flags.includes(rule.flag)) r.flags.push(rule.flag); } }));
  if (r.cat === 'TRAPPED' && r.flags.includes('BLEEDING')) r.injured = 'YES';
  const m = lo.match(/(\d+)\s*(of us|people|ppl|लोग|మంది|members)?/) || lo.match(/(\d+)/); let people = m ? parseInt(m[1]) : null;
  if (!people) { for (const [w, v] of Object.entries(NUMW)) if (lo.includes(w)) people = v; } r.people = Math.min(255, people || 1); if (m) r.hits.push(m[0].trim());
  if (panic) r.flags.push('PANIC');
  r.prio = r.cat === 'TRAPPED' || r.flags.includes('BLEEDING') || panic ? 0 : (r.cat === 'MEDICAL' || r.flags.includes('ELDERLY')) ? 1 : r.cat === 'FOOD_WATER' ? 2 : r.cat === 'SAFE' ? 3 : 1;
  return r; }
function encode(m) { const rnd = () => Math.floor(Math.random() * 256); const id = m.id.match(/../g).map(h => parseInt(h, 16));
  const nodeIx = Z.NET.findIndex(n => n.id === m.node); const t = Math.min(65535, Math.round((Date.now() - S.bootT) / 1000));
  const b = [...id, 0x0A, nodeIx & 255, (1 << 6) | (m.prio << 4) | 4, Z.CAT[m.cat] || 7, m.people & 255, ({ NO: 0, YES: 1, MAYBE: 2 }[m.injured]) << 6, m.flags.reduce((a, f) => a | (Z.FLAGS[f] || 0), 0), t >> 8, t & 255, rnd(), rnd(), rnd()];
  return b; }
const BLAB = ['ID', 'ID', 'ID', 'ID', 'NODE', 'NODE', 'P·H', 'CAT', 'PPL', 'INJ', 'FLAG', 'TIME', 'TIME', 'MAC', 'MAC', 'MAC'];
const BCOL = ['#ff8a1f', '#ff8a1f', '#ff8a1f', '#ff8a1f', '#39d0ff', '#39d0ff', '#ff2d55', '#2fe08a', '#2fe08a', '#2fe08a', '#2fe08a', '#a78bfa', '#a78bfa', '#8b9ab0', '#8b9ab0', '#8b9ab0'];
const scQueue = []; let scBusy = false;
async function showCompression(m) { scQueue.push(m); if (scBusy) return; scBusy = true;
  while (scQueue.length) { const x = scQueue.shift(); const card = $('#sc'); card.classList.remove('hidden');
    const raw = x.text ? new TextEncoder().encode(x.text).length : 0;
    let html = x.text ? x.text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) : '<span class="muted">Panic button pressed: no text</span>';
    card.innerHTML = `<div class="h"><b>⚡ Semantic compression on node ${x.node}</b><span>${x.lang.toUpperCase()} · ${x.ward}</span></div><div class="raw" id="scRaw"></div><div class="fields" id="scF"></div><div class="bytes" id="scB"></div>
      <div class="f"><span>${raw ? `${raw} bytes of text (UTF-8)` : 'button press'} → <b>16 bytes</b>${raw ? ` · <b>${(raw / 16).toFixed(1)}× smaller</b>` : ''} · location from node ID</span><span>meaning sent as codes · full text kept on the node</span></div>`;
    // typewriter
    const rawEl = $('#scRaw'); if (x.text) { for (let i = 1; i <= x.text.length; i += Math.max(1, Math.round(x.text.length / 30))) { rawEl.textContent = '“' + x.text.slice(0, i) + '”'; await sleep(28); } } rawEl.innerHTML = '“' + html + '”';
    await sleep(200); let h2 = html; [...new Set(x.hits)].sort((a, b) => b.length - a.length).forEach(k => { const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); h2 = h2.replace(re, s => `<mark>${s}</mark>`); }); rawEl.innerHTML = x.text ? '“' + h2 + '”' : html;
    const fields = [`CATEGORY=${x.cat}`, `PEOPLE=${x.people}`, `INJURED=${x.injured}`, ...x.flags.map(f => `FLAG=${f}`), `PRIORITY=P${x.prio}`];
    $('#scF').innerHTML = fields.map(f => `<span class="fd">${f}</span>`).join(''); for (const el of $$('#scF .fd')) { await sleep(140); el.classList.add('on'); }
    $('#scB').innerHTML = x.bytes.map((b, i) => `<div class="by" style="--bc:${BCOL[i]}"><b>${b.toString(16).padStart(2, '0').toUpperCase()}</b><small>${BLAB[i]}</small></div>`).join('');
    for (const el of $$('#scB .by')) { await sleep(55); el.classList.add('on'); }
    await sleep(scQueue.length ? 1800 : 4200); }
  scBusy = false; }

/* ============ INGEST ============ */
function ingest(raw) { // raw: {node, ward, text, lang, gloss, panic, src, id?, rssi, snr}
  const id = raw.id || Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, '0');
  if (S.msgs.find(m => m.id === id)) { S.mstat.dup++; return; }
  const u = raw.parsed || understand(raw.text, raw.panic);
  const n = nodeOf(raw.node) || nodeOf('N1');
  const m = { id, ...raw, ...u, node: n.id, loc: { lat: n.lat, lon: n.lon, src: raw.src === 'live' ? 'Rescue-node location (configured, no GPS module)' : 'Rescue-node location (simulated)' }, state: 'UNREAD', t: Date.now() };
  m.bytes = encode(m); S.msgs.unshift(m);
  // cluster
  const c = S.clusters.get(m.node) || { node: m.node, ward: m.ward, msgs: [], people: 0, stuck: 0, prio: 3, cat: m.cat, state: 'UNREAD' };
  c.msgs.push(m); c.people += m.people; if (m.cat === 'TRAPPED' || m.cat === 'INJURED' || m.panic) c.stuck += m.people; c.prio = Math.min(c.prio, m.prio); c.cat = c.stuck ? 'TRAPPED' : m.cat; c.state = 'UNREAD'; S.clusters.set(m.node, c);
  const p = Z.toXZ(n.lat, n.lon); blobs.push({ x: p.x + (Math.random() - .5) * 1.5, z: p.z + (Math.random() - .5) * 1.5, w: m.people * [3, 1.6, 1, .25][m.prio], r: 1.2 + Math.sqrt(m.people) * .35, msg: m.id }); drawHeat();
  upsertPin(c);
  const path = raw.src === 'live' ? [m.node, 'GW'] : route(m.node); if (path) { m.hops = path.length - 1; packet3D(path, new THREE.Color(PCOL[m.prio]).getHex()); meshPacket(path); S.mstat.del++; S.mstat.hops.push(path.length - 1); }
  showCompression(m);
  if (m.prio === 0) { toast(m); siren(); speak(m); flash(); }
  log(`SOS ${m.id} · ${Z.CAT_LABEL[m.cat]} · ${m.people} ppl · ${m.ward}${raw.src === 'live' ? ' · LIVE LoRa' : ''}`);
  refresh(true); }

/* ============ STATES ============ */
function setState(m, st, extra = {}) { if (m.state === 'DISPATCHED' || (m.state === 'READ' && st === 'UNREAD')) return; m.state = st; Object.assign(m, extra);
  const c = S.clusters.get(m.node); if (c) { c.state = c.msgs.every(x => x.state === 'DISPATCHED') ? 'DISPATCHED' : c.msgs.some(x => x.state === 'UNREAD') ? 'UNREAD' : 'READ'; upsertPin(c); }
  blobs.forEach(b => { if (b.msg === m.id && st === 'DISPATCHED') b.w *= .2; }); drawHeat();
  if (m.src === 'live') serialSend({ type: 'status', id: m.id, state: st }); log(`${m.id} → ${st}${extra.unit ? ' · ' + extra.unit : ''}`); refresh(true); }

/* ============ UI ============ */
const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? s + 's ago' : Math.floor(s / 60) + 'm ago'; };
const nearestHosp = (loc, n = 3) => S.hospitals.map(h => ({ h, d: Z.distKm(loc, h) })).sort((a, b) => a.d - b.d).slice(0, n);
const nearestAmb = loc => S.ambs.filter(a => a.status === 'AVAILABLE').map(a => ({ a, d: Z.distKm(loc, a) })).sort((x, y) => x.d - y.d);
function refresh() { const stuck = [...S.clusters.values()].reduce((a, c) => a + (c.state === 'DISPATCHED' ? 0 : c.stuck), 0);
  $('#kStuck').textContent = stuck; $('#kCrit').textContent = S.msgs.filter(m => m.prio === 0 && m.state === 'UNREAD').length; $('#kOpen').textContent = S.msgs.length; $('#kDisp').textContent = S.msgs.filter(m => m.state === 'DISPATCHED').length;
  $('#badgeUnread').textContent = S.msgs.filter(m => m.state === 'UNREAD').length; renderQueue(); renderList(); if (S.selected) renderDetail(); renderResources(); }
function score(c) { return c.msgs.filter(m => m.state !== 'DISPATCHED').reduce((a, m) => a + m.people * [10, 5, 2, .3][m.prio] * (m.state === 'UNREAD' ? 1.3 : 1), 0); }
function renderQueue() { const arr = [...S.clusters.values()].map(c => ({ c, s: score(c) })).sort((a, b) => b.s - a.s); if (!arr.length) return;
  const mx = Math.max(...arr.map(x => x.s), 1);
  $('#attnList').innerHTML = arr.map(({ c, s }, i) => { const col = c.state === 'DISPATCHED' ? '#2fe08a' : rampHex(.35 + .65 * s / mx), n = nodeOf(c.node), hs = nearestHosp(n, 1)[0], am = nearestAmb(n)[0];
    const flags = [...new Set(c.msgs.flatMap(m => m.flags))], unread = c.msgs.filter(m => m.state === 'UNREAD').length;
    return `<div class="qz" style="--c:${col}" data-n="${c.node}"><div class="r"><div><div class="mono" style="font-size:12px;color:${col}">#${i + 1} · ${c.state === 'DISPATCHED' ? 'RESCUE DISPATCHED' : Z.PRIO_LABEL[c.prio]}</div><div class="nm">${c.ward}</div></div>
      <div class="cnt">${c.stuck || c.people}<small>${c.stuck ? 'stuck' : 'people'}</small></div></div>
      <div class="why">${c.msgs.length} SOS · ${unread} unread · node ${c.node}<br>✚ ${hs.h.name} ${hs.d.toFixed(1)} km${am ? ` · 🚑 ~${Math.max(2, Math.round(am.d / 25 * 60))} min` : ''}</div>
      <div class="tags">${flags.map(f => `<span class="tg ${['BLEEDING', 'GAS', 'PANIC'].includes(f) ? 'r' : ''}">${f}</span>`).join('')}</div></div>`; }).join('');
  $$('#attnList .qz').forEach(e => e.onclick = () => focusCluster(e.dataset.n)); }
function renderList() { const f = S.filter; const arr = S.msgs.filter(m => f === 'all' || (f === 'crit' && m.prio === 0) || (f === 'unread' && m.state === 'UNREAD') || (f === 'read' && m.state === 'READ') || (f === 'disp' && m.state === 'DISPATCHED')).sort((a, b) => (a.state === 'DISPATCHED') - (b.state === 'DISPATCHED') || a.prio - b.prio || b.t - a.t);
  $('#msgList').innerHTML = arr.map(m => `<div class="mi ${m.state === 'UNREAD' ? 'unread' : ''} ${S.selected === m.id ? 'sel' : ''}" style="--c:${PCOL[m.prio]}" data-id="${m.id}"><div class="mr"><span style="color:${PCOL[m.prio]}">${Z.PRIO_LABEL[m.prio]}${m.src === 'live' ? '<span class="src live">LIVE LoRa</span>' : '<span class="src sim">SIM</span>'}</span><span class="pill st-${m.state}">${m.state}</span></div>
   <div class="mt">${m.panic ? 'Panic button · ' : ''}${Z.CAT_LABEL[m.cat]} · ${m.people} ${m.people > 1 ? 'people' : 'person'}</div><div class="ms">${m.ward} · ${ago(m.t)}${m.text ? ' · “' + m.text + '”' : ''}</div></div>`).join('') || '<p class="muted" style="padding:20px">No messages yet.</p>';
  $$('#msgList .mi').forEach(e => e.onclick = () => select(e.dataset.id)); }
function select(id) { S.selected = id; const m = S.msgs.find(x => x.id === id); if (m && m.state === 'UNREAD') setState(m, 'READ'); renderList(); renderDetail(); }
function renderDetail() { const m = S.msgs.find(x => x.id === S.selected); if (!m) return; const hs = nearestHosp(m.loc), ams = nearestAmb(m.loc).slice(0, 3);
  $('#detail').innerHTML = `<div class="dh"><div><div class="mono" style="font-size:13px;color:${PCOL[m.prio]}">${Z.PRIO_LABEL[m.prio]} · SOS #${m.id}${m.src === 'live' ? '<span class="src live">LIVE LoRa HARDWARE</span>' : '<span class="src sim">SIMULATED</span>'}</div>
   <div class="dcat">${m.panic ? 'Panic button · ' : ''}${Z.CAT_LABEL[m.cat]}</div><div class="muted" style="font-size:15px">${m.ward} · node ${m.node} · ${ago(m.t)} · ${m.hops || 1} hop${(m.hops || 1) > 1 ? 's' : ''}${m.rssi ? ` · RSSI ${m.rssi} dBm` : ''}</div></div><span class="pill st-${m.state}" style="font-size:14px;padding:7px 14px">${m.state}</span></div>
   ${m.text ? `<div class="quote">“${m.text}”</div>${m.gloss ? `<div class="gloss">Meaning: ${m.gloss}</div>` : ''}` : '<div class="quote muted">Panic button: no text</div>'}
   <div class="facts"><div><label>People</label><b>${m.people}</b></div><div><label>Injured</label><b style="color:${m.injured === 'YES' ? '#ff2d55' : 'inherit'}">${m.injured}</b></div><div><label>Flags</label><b style="font-size:15px">${m.flags.join(', ') || '—'}</b></div><div><label>Location</label><b style="font-size:14px">${m.loc.lat.toFixed(4)}, ${m.loc.lon.toFixed(4)}</b><small class="muted" style="font-size:11px">${m.loc.src}</small></div></div>
   <h4>Received packet · 16 bytes</h4><div class="bytes" style="display:grid;grid-template-columns:repeat(16,1fr);gap:4px;margin-bottom:16px">${m.bytes.map((b, i) => `<div style="text-align:center"><b style="display:block;font-family:var(--m);font-size:14px;padding:7px 0;border-radius:6px;background:${BCOL[i]};color:#04070d">${b.toString(16).padStart(2, '0').toUpperCase()}</b><small style="font-size:9.5px;color:var(--mut);font-family:var(--m)">${BLAB[i]}</small></div>`).join('')}</div>
   <div class="near"><div class="nb"><h4>Nearest hospitals</h4>${hs.map(x => `<div class="row"><span>✚ ${x.h.name}</span><span>${x.d.toFixed(1)} km · <b style="color:#2fe08a">${x.h.free}</b> beds</span></div>`).join('')}</div>
   <div class="nb"><h4>Nearest free ambulances</h4>${ams.map(x => `<div class="row"><span>🚑 ${x.a.id}</span><span>~${Math.max(2, Math.round(x.d / 25 * 60))} min</span></div>`).join('') || '<p class="muted">None free: escalate to 108</p>'}</div></div>
   <div class="dispatch">${m.state === 'DISPATCHED' ? `<div style="font-size:17px;color:#2fe08a;font-weight:700">✓ Rescue dispatched: ${m.unit}</div>` :
   `<select id="dSel">${ams.map(x => `<option value="amb:${x.a.id}">🚑 ${x.a.id} → ${nearestHosp(m.loc, 1)[0].h.name}</option>`).join('')}<option value="team:GHMC DRF Team 2">⛑ GHMC DRF Team 2</option><option value="team:Fire & Emergency Unit 4">🚒 Fire & Emergency Unit 4</option></select><button class="go" id="dGo">Confirm rescue dispatched</button>`}</div>
   <div class="leds">Survivor's node: <span><i class="led ${m.state !== 'UNREAD' ? 'o' : ''}"></i>READ</span><span><i class="led ${m.state === 'DISPATCHED' ? 'g' : ''}"></i>DISPATCHED</span>${m.src === 'live' ? '<span style="color:#2fe08a">· sent back over LoRa</span>' : ''}</div>`;
  const go = $('#dGo'); if (go) go.onclick = () => { const [kind, id] = $('#dSel').value.split(/:(.*)/s); let unit = id;
    if (kind === 'amb') { const a = S.ambs.find(x => x.id === id); Object.assign(a, { status: 'EN ROUTE', target: m, from: { lat: a.lat, lon: a.lon }, start: Date.now() }); const h = nearestHosp(m.loc, 1)[0].h; h.free = Math.max(0, h.free - Math.min(m.people, 4)); unit = `${id} · ${h.name}`; log(`108 → ${id} · ${h.name} pre-alerted`); }
    setState(m, 'DISPATCHED', { unit }); }; }
function renderResources() { const top = [...S.clusters.values()].sort((a, b) => score(b) - score(a))[0]; const ref = top ? nodeOf(top.node) : Z.C0;
  $('#hospList').innerHTML = S.hospitals.map(h => ({ h, d: Z.distKm(ref, h) })).sort((a, b) => a.d - b.d).map(({ h, d }) => `<div class="hc"><div><div class="hn">✚ ${h.name}</div><div class="ha">${h.area} · ${d.toFixed(1)} km from top hotspot${h.trauma ? ' · trauma' : ''}</div></div><div class="hb">${h.free}<small>beds free</small></div><div class="bar"><i style="width:${100 - h.free / h.beds * 100}%"></i></div><div class="hl"><span class="pill ss">LINK · SIMULATED</span></div></div>`).join('');
  $('#ambList').innerHTML = S.ambs.map(a => `<div class="ac"><div><div class="an">🚑 ${a.id}</div><div class="as">${a.status === 'AVAILABLE' ? 'at ' + a.base.name : '→ ' + a.target.ward}</div></div><span class="pill ${a.status === 'AVAILABLE' ? 'sa' : a.status === 'EN ROUTE' ? 'se' : 'ss'}">${a.status}</span></div>`).join('');
  $('#agList').innerHTML = Z.AGENCIES.map(g => `<div class="ac"><div><div class="an">${g.icon} ${g.name}</div><div class="as">${g.role}</div></div><span class="pill ss">LINKED · SIM</span></div>`).join(''); }
function log(s) { S.log.unshift(`<div><span>${new Date().toLocaleTimeString('en-GB')}</span> ${s}</div>`); S.log.length = Math.min(S.log.length, 80); $('#log').innerHTML = S.log.join(''); }

/* ============ ALERTS ============ */
function toast(m) { const d = document.createElement('div'); d.className = 'toast crit'; d.style.setProperty('--c', PCOL[0]);
  d.innerHTML = `<div class="t1"><span>CRITICAL · ${m.ward}</span><span>${m.src === 'live' ? 'LIVE LoRa' : 'SIM'}</span></div><div class="t2">${m.panic ? 'Panic button · ' : ''}${m.people} ${m.people > 1 ? 'people' : 'person'} ${Z.CAT_LABEL[m.cat].toLowerCase()}${m.injured === 'YES' ? ' · injured' : ''}</div><div class="t3">${m.gloss || m.text || 'structured SOS'}</div>`;
  d.onclick = () => { openTab('inbox'); select(m.id); }; $('#toasts').prepend(d); $$('#toasts .toast').slice(2).forEach(x => x.remove()); setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 8000); }
let actx; function siren() { if (S.muted) return; try { actx = actx || new AudioContext(); const o = actx.createOscillator(), g = actx.createGain(); o.type = 'triangle'; o.connect(g); g.connect(actx.destination); const t = actx.currentTime; [0, .3, .6].forEach((d, i) => o.frequency.setValueAtTime(i % 2 ? 620 : 880, t + d)); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + .95); o.start(t); o.stop(t + 1); } catch (e) { } }
const hospName = m => nearestHosp(m.loc, 1)[0].h.name;
const VT = { en: m => `Critical alert. ${m.people} ${m.people > 1 ? 'people' : 'person'} ${m.cat === 'TRAPPED' ? 'trapped' : 'in danger'} in ${m.ward}.${m.injured === 'YES' ? ' Injuries reported.' : ''} Nearest hospital: ${hospName(m)}.`,
  hi: m => `गंभीर चेतावनी। ${m.ward} में ${m.people} लोग फँसे हुए हैं।${m.injured === 'YES' ? ' घायल हैं।' : ''} निकटतम अस्पताल ${hospName(m)}।`,
  te: m => `అత్యవసర హెచ్చరిక. ${m.ward} లో ${m.people} మంది చిక్కుకున్నారు.${m.injured === 'YES' ? ' గాయాలు ఉన్నాయి.' : ''} సమీప ఆసుపత్రి ${hospName(m)}.` };
const LANG = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' };
const pickVoice = c => { const v = speechSynthesis.getVoices(); return v.find(x => x.lang === c) || v.find(x => x.lang.startsWith(c.slice(0, 2))) || (c.startsWith('en') ? v.find(x => x.lang.startsWith('en')) : null); };
function speak(m) { if (S.muted || !('speechSynthesis' in window)) return; (S.voiceLang === 'multi' ? ['en', 'hi', 'te'] : [S.voiceLang]).forEach(l => { const v = pickVoice(LANG[l]); if (!v && l !== 'en') return; const u = new SpeechSynthesisUtterance(VT[l](m)); u.lang = LANG[l]; if (v) u.voice = v; u.rate = 1; speechSynthesis.speak(u); }); }
speechSynthesis?.getVoices();
const flash = () => { const f = $('#flash'); f.style.opacity = 1; setTimeout(() => f.style.opacity = 0, 300); };

/* ============ CONTEXT MAPS + INTRO ============ */
function fitPath(polys, W, H, pad = 10, bbox) { const all = (bbox || polys).flat(); const xs = all.map(p => p[0]), ys = all.map(p => p[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0)), ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
  const f = ([x, y]) => [ox + (x - x0) * s, oy + (y1 - y) * s]; return { f, d: p => 'M' + p.map(q => f(q).map(v => v.toFixed(1)).join(',')).join('L') + 'Z' }; }
const HYD = [78.4867, 17.385], ZONE_NAMES = new Set(Z.GEO.zone.map(w => w.n));
{ const t = fitPath(Z.GEO.telangana, 200, 200); const hp = t.f(HYD);
  $('#ctxTel').innerHTML = Z.GEO.telangana.map(p => `<path d="${t.d(p)}" fill="rgba(57,208,255,.08)" stroke="#2f8fc0" stroke-width="1.2"/>`).join('') + `<circle cx="${hp[0]}" cy="${hp[1]}" r="5" fill="#ff2d55"><animate attributeName="r" values="4;8;4" dur="1.6s" repeatCount="indefinite"/></circle><text x="100" y="194" text-anchor="middle" fill="#8b9ab0" font-size="13" font-family="Sora">Telangana</text>`;
  const h = fitPath(Z.GEO.ghmc.map(w => w.c), 200, 200);
  $('#ctxHyd').innerHTML = Z.GEO.ghmc.map(w => `<path d="${h.d(w.c)}" fill="${ZONE_NAMES.has(w.n) ? 'rgba(255,45,85,.55)' : 'rgba(57,208,255,.05)'}" stroke="${ZONE_NAMES.has(w.n) ? '#ff2d55' : '#1f4a6a'}" stroke-width=".6"/>`).join('') + `<text x="100" y="194" text-anchor="middle" fill="#8b9ab0" font-size="13" font-family="Sora">Hyderabad · GHMC</text>`; }
async function intro() { const ov = $('#intro'), svg = $('#introSvg'), cap = $('#introCap'); ov.classList.remove('hidden', 'fade');
  const t = fitPath(Z.GEO.telangana, 1000, 700, 40); const hp = t.f(HYD);
  svg.innerHTML = Z.GEO.telangana.map(p => `<path d="${t.d(p)}" fill="rgba(57,208,255,.05)" stroke="#39d0ff" stroke-width="2.5" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="animation:draw 1.6s ease forwards"/>`).join('') +
    `<circle cx="${hp[0]}" cy="${hp[1]}" r="0" fill="#ff2d55"><animate attributeName="r" values="0;14;9" dur="1s" begin="1.2s" fill="freeze"/></circle><circle cx="${hp[0]}" cy="${hp[1]}" r="10" fill="none" stroke="#ff2d55" stroke-width="2" opacity="0"><animate attributeName="r" values="10;70" dur="1.4s" begin="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="1.4s" begin="1.4s" repeatCount="indefinite"/></circle>`;
  cap.innerHTML = 'TELANGANA<small>SIMULATED EARTHQUAKE · M5.8</small>'; await sleep(2600);
  const h = fitPath(Z.GEO.ghmc.map(w => w.c), 1000, 700, 40);
  svg.innerHTML = Z.GEO.ghmc.map((w, i) => `<path d="${h.d(w.c)}" fill="${ZONE_NAMES.has(w.n) ? 'rgba(255,45,85,0)' : 'rgba(57,208,255,.04)'}" stroke="${ZONE_NAMES.has(w.n) ? '#ff2d55' : '#2f6f9a'}" stroke-width="${ZONE_NAMES.has(w.n) ? 2 : .8}" opacity="0">
    <animate attributeName="opacity" to="1" dur=".4s" begin="${(i % 30) * .03}s" fill="freeze"/>${ZONE_NAMES.has(w.n) ? `<animate attributeName="fill" to="rgba(255,45,85,.55)" dur=".8s" begin="1.1s" fill="freeze"/>` : ''}</path>`).join('');
  cap.innerHTML = 'HYDERABAD · 145 GHMC WARDS<small>DISASTER ZONE: MUSHEERABAD · 12 WARDS</small>'; await sleep(2900);
  ov.classList.add('fade'); camera.position.set(0, 95, 2); controls.target.set(0, 0, 0); flyTo(new THREE.Vector3(4, 30, 38), new THREE.Vector3(0, 0, 0), 2.6); await sleep(900); ov.classList.add('hidden'); }

/* ============ SIMULATION ============ */
let timers = [];
async function startSim(skipIntro) { if (S.running) { S.running = false; timers.forEach(clearTimeout); $('#btnSim').textContent = '▶ Simulate disaster'; return; }
  S.running = true; $('#btnSim').textContent = '⏸ Pause'; if (!skipIntro) await intro();
  S.t0 = Date.now(); shock(0, 0); flash(); siren(); collapseAround(0, 0, 9); [['N1', 3], ['N3', 3], ['N4', 2.5]].forEach(([id, r]) => { const p = Z.toXZ(nodeOf(id).lat, nodeOf(id).lon); collapseAround(p.x, p.z, r); });
  const b = $('#scenarioBanner'); b.innerHTML = '⚠ SIMULATED · M5.8 quake · Musheerabad, Hyderabad'; b.classList.remove('hidden');
  log('SIMULATED disaster · rescue teams deploy VOID-NAV nodes N1–N5');
  // phones detected by scanning (Scenario A): faint heat
  timers.push(setInterval(() => { if (!S.running) return; S.phones += 2 + Math.floor(Math.random() * 5); }, 2500));
  Z.SCRIPT.forEach(s => timers.push(setTimeout(() => S.running && ingest({ ...s, src: 'sim' }), s.at * 1000)));
  timers.push(setTimeout(() => { const m = S.msgs.find(x => x.cat === 'SAFE'); if (m) setState(m, 'READ'); }, 40000)); }
$('#btnSim').onclick = () => startSim(false);
setInterval(() => { $('#clock').textContent = new Date().toLocaleTimeString('en-GB'); if (S.t0) { const s = Math.floor((Date.now() - S.t0) / 1000); $('#elapsed').textContent = `T+${String(s / 60 | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
  S.ambs.forEach(a => { if (a.status !== 'EN ROUTE') return; const k = Math.min(1, (Date.now() - a.start) / 20000); a.lat = a.from.lat + (a.target.loc.lat - a.from.lat) * k; a.lon = a.from.lon + (a.target.loc.lon - a.from.lon) * k; if (k >= 1) { a.status = 'AT SCENE'; log(`${a.id} on scene · ${a.target.ward}`); } });
  if (S.msgs.length) { renderResources(); if ($('#inbox').classList.contains('on')) renderList(); } }, 1000);

/* ============ TABS / CONTROLS ============ */
function openTab(id) { $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === id)); $$('.tab').forEach(t => t.classList.toggle('on', t.id === id)); if (id === 'situation') fit(); if (id === 'mesh') drawMesh(); }
$$('#tabs button').forEach(b => b.onclick = () => openTab(b.dataset.tab));
$$('.filters button').forEach(b => b.onclick = () => { $$('.filters button').forEach(x => x.classList.remove('on')); b.classList.add('on'); S.filter = b.dataset.f; renderList(); });
$('#voiceLang').onchange = e => S.voiceLang = e.target.value;
$('#btnMute').onclick = e => { S.muted = !S.muted; e.target.textContent = S.muted ? '🔇' : '🔊'; if (S.muted) speechSynthesis.cancel(); };

/* ============ HARDWARE (Web Serial) ============ */
let port, writer;
async function connectHW() { if (!('serial' in navigator)) { alert('Open this page in Google Chrome or Microsoft Edge to connect the ESP32 (Web Serial).'); return; }
  try { port = await navigator.serial.requestPort(); await port.open({ baudRate: 115200 }); } catch (e) { return; }
  $('#modeBadge').className = 'mode live'; $('#modeBadge').textContent = 'LIVE · LoRa'; $('#btnHW').textContent = '⚡ Hardware live'; log('ESP32 LoRa gateway connected (USB)'); writer = port.writable.getWriter();
  const dec = new TextDecoderStream(); port.readable.pipeTo(dec.writable); const rd = dec.readable.getReader(); let buf = '';
  while (true) { const { value, done } = await rd.read(); if (done) break; buf += value; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); onLine(line); } } }
function onLine(line) { if (!line.startsWith('{')) return; let j; try { j = JSON.parse(line); } catch (e) { return; }
  if (j.type === 'sos') { const parsed = j.cat ? { cat: String(j.cat).toUpperCase(), prio: j.prio ?? 0, injured: j.injured || 'MAYBE', people: parseInt(j.people) || 1, flags: j.flags || [], hits: [] } : null;
    const nodeId = Z.NET.find(n => n.id === j.node) ? j.node : 'N1'; const ward = S.clusters.get(nodeId)?.ward || 'Musheerabad';
    ingest({ id: j.id, node: nodeId, ward, text: j.text || '', lang: 'live', panic: !!j.panic, src: 'live', rssi: j.rssi, parsed: parsed && (j.text ? { ...understand(j.text, j.panic), ...parsed, hits: understand(j.text).hits } : parsed) }); }
  if (j.type === 'hello') log(`beacon ${j.node} · ${j.hops_to_gw ?? '?'} hops · RSSI ${j.rssi ?? '?'}`); }
async function serialSend(o) { if (!writer) return; try { await writer.write(new TextEncoder().encode(JSON.stringify(o) + '\n')); log(`→ node over LoRa: ${o.id} ${o.state}`); } catch (e) { } }
$('#btnHW').onclick = connectHW;

/* ============ MESH TAB ============ */
const svg = $('#meshSvg'); const nb = Z.NET.reduce((a, n) => ({ a: Math.min(a.a, n.lat), b: Math.max(a.b, n.lat), c: Math.min(a.c, n.lon), d: Math.max(a.d, n.lon) }), { a: 90, b: -90, c: 180, d: -180 });
const sx = lon => 60 + (lon - nb.c) / (nb.d - nb.c) * 520, sy = lat => 470 - (lat - nb.a) / (nb.b - nb.a) * 420;
function drawMesh(hl) { const d = hopDist(); let h = '';
  for (let i = 0; i < Z.NET.length; i++) for (let j = i + 1; j < Z.NET.length; j++) { const a = Z.NET[i], b = Z.NET[j]; if (Z.distKm(a, b) > Z.RANGE_KM) continue; const down = S.down.has(a.id) || S.down.has(b.id), on = hl && hl.some((x, k) => (x === a.id && hl[k + 1] === b.id) || (x === b.id && hl[k + 1] === a.id));
    h += `<line x1="${sx(a.lon)}" y1="${sy(a.lat)}" x2="${sx(b.lon)}" y2="${sy(b.lat)}" stroke="${on ? '#39d0ff' : down ? '#5a2030' : '#24476a'}" stroke-width="${on ? 4 : 2}" ${down ? 'stroke-dasharray="6 6"' : ''}/>`; }
  Z.NET.forEach(n => { const down = S.down.has(n.id), col = down ? '#ff2d55' : n.kind === 'gw' ? '#39d0ff' : n.kind === 'node' ? '#a78bfa' : '#2bd4c4';
    h += `<g data-id="${n.id}" style="cursor:${n.kind === 'relay' ? 'pointer' : 'default'}"><circle cx="${sx(n.lon)}" cy="${sy(n.lat)}" r="${n.kind === 'gw' ? 25 : 19}" fill="#0a1220" stroke="${col}" stroke-width="3"/><text x="${sx(n.lon)}" y="${sy(n.lat) + 5}" text-anchor="middle" fill="${col}" font-size="14" font-weight="700" font-family="Sora">${down ? '✕' : n.id}</text>
    <text x="${sx(n.lon)}" y="${sy(n.lat) + (n.kind === 'gw' ? 43 : 37)}" text-anchor="middle" fill="#8b9ab0" font-size="12" font-family="JetBrains Mono">${down ? 'offline' : d[n.id] !== undefined ? d[n.id] + ' hop' : 'no route'}</text></g>`; });
  svg.innerHTML = h + '<g id="pk"></g>';
  svg.querySelectorAll('g[data-id]').forEach(g => g.onclick = () => { const id = g.dataset.id; if (nodeOf(id).kind !== 'relay') return; S.down.has(id) ? S.down.delete(id) : S.down.add(id); S.mstat.re++; mstats(); drawLinks(); drawMesh(); log(`Relay ${id} ${S.down.has(id) ? 'FAILED · routes recomputed' : 'restored'}`); const p = route('N3'); if (p) { meshPacket(p); packet3D(p, 0xffffff); } }); }
function meshPacket(path) { if (!$('#mesh').classList.contains('on')) return; drawMesh(path); const g = svg.querySelector('#pk'), pts = path.map(nodeOf); const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', 8); c.setAttribute('fill', '#fff'); g.appendChild(c);
  let t = 0; const st = () => { t += .025; const s = Math.floor(t); if (s >= pts.length - 1) { c.remove(); return; } const a = pts[s], b = pts[s + 1], f = t - s; c.setAttribute('cx', sx(a.lon) + (sx(b.lon) - sx(a.lon)) * f); c.setAttribute('cy', sy(a.lat) + (sy(b.lat) - sy(a.lat)) * f); requestAnimationFrame(st); }; st(); }
function mstats() { $('#mDel').textContent = S.mstat.del; $('#mRe').textContent = S.mstat.re; $('#mDup').textContent = S.mstat.dup; const h = S.mstat.hops; $('#mHops').textContent = h.length ? (h.reduce((a, b) => a + b, 0) / h.length).toFixed(1) : '–'; }
drawMesh(); setInterval(() => { mstats(); if ($('#mesh').classList.contains('on')) { const n = ['N1', 'N2', 'N3', 'N4', 'N5'][Math.random() * 5 | 0], p = route(n); if (p) meshPacket(p); } }, 2600);

/* ============ QUANTUM (CVaR-QAOA relay planner) ============ */
const NQ = 8, KQ = 3;
const circuitHTML = st => { let h = '<svg viewBox="0 0 900 110" width="100%" height="110">'; for (let q = 0; q < NQ; q++) { const y = 9 + q * 12.6; h += `<line x1="40" y1="${y}" x2="880" y2="${y}" stroke="#24476a"/><text x="6" y="${y + 4}" fill="#8b9ab0" font-size="10" font-family="JetBrains Mono">q${q}</text>`; }
  [['H', 60, '#39d0ff', 70], ['e^-iγC', 220, '#ff8a1f', 180], ['e^-iβX', 470, '#a78bfa', 180], ['M', 760, '#2fe08a', 70]].forEach(([t, x, c, w], i) => { const on = st >= i; h += `<rect x="${x}" y="2" width="${w}" height="104" rx="8" fill="${on ? c : '#101a2a'}" stroke="${c}"/><text x="${x + w / 2}" y="60" text-anchor="middle" fill="${on ? '#04070d' : c}" font-size="16" font-weight="800" font-family="Sora">${t}</text>`; }); return h + '</svg>'; };
$('#circuit').innerHTML = circuitHTML(-1);
const SITES = [[-1.4, .6], [-.6, -.1], [.3, .9], [1.0, .2], [-1.0, -1.1], [.1, -.6], [.9, -1.0], [1.6, -.5]].map(([x, y]) => { const g = Z.fromKm(x, y); return Z.toXZ(g.lat, g.lon); });
function qClusters() { const cl = [...S.clusters.values()].map(c => { const n = nodeOf(c.node), p = Z.toXZ(n.lat, n.lon); return { ...p, w: c.people * (c.prio === 0 ? 3 : 1) }; });
  return cl.length >= 3 ? cl : Z.NET.filter(n => n.kind === 'node').map(n => ({ ...Z.toXZ(n.lat, n.lon), w: 5 })); }
let qRun = false;
$('#btnQAOA').onclick = async () => { if (qRun) return; qRun = true; $('#btnDeploy').disabled = true; const pb = buildProblem(SITES, qClusters(), KQ, 8.5);
  const land = $('#land').getContext('2d'), G = 30, W = 300, H = 230; land.clearRect(0, 0, W, H); $('#circuit').innerHTML = circuitHTML(0); await sleep(300);
  let best = { e: 9, g: 0, b: 0 }; const Es = []; for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const g = i / (G - 1), b = j / (G - 1) * Math.PI, e = cvar(pb, qaoaState(pb, [g], [b])); Es.push(e); if (e < best.e) best = { e, g, b }; }
  const e0 = Math.min(...Es), e1 = Math.max(...Es);
  for (let i = 0; i < G; i++) { for (let j = 0; j < G; j++) { land.fillStyle = rampHex(1 - (Es[i * G + j] - e0) / (e1 - e0 || 1)); land.fillRect(i * W / G, H - (j + 1) * H / G, W / G + 1, H / G + 1); } $('#circuit').innerHTML = circuitHTML(i % 2 ? 1 : 2); await sleep(28); }
  land.strokeStyle = '#fff'; land.lineWidth = 2; land.beginPath(); land.arc(best.g * (W - W / G) + W / G / 2, H - (best.b / Math.PI * (H - H / G) + H / G / 2), 8, 0, 7); land.stroke();
  $('#circuit').innerHTML = circuitHTML(3); const p = qaoaState(pb, [best.g], [best.b]); const SH = 1024, cnts = sample(p, SH);
  const order = [...cnts.keys()].sort((x, y) => cnts.get(y) - cnts.get(x)).slice(0, 14); const bestS = [...cnts.keys()].reduce((a, z) => pb.cost[z] < pb.cost[a] ? z : a); if (!order.includes(bestS)) order[13] = bestS;
  const hc2 = $('#hist').getContext('2d'), HW2 = 360, HH2 = 230;
  for (let f = 1; f <= 20; f++) { hc2.clearRect(0, 0, HW2, HH2); const mx = cnts.get(order[0]); order.forEach((z, i) => { const h = cnts.get(z) / mx * (HH2 - 52) * f / 20, x = 10 + i * 24.5, opt = z === bestS; hc2.fillStyle = opt ? '#a78bfa' : '#2bd4c4'; hc2.globalAlpha = opt ? 1 : .5; hc2.fillRect(x, HH2 - 32 - h, 18, h); hc2.globalAlpha = 1;
      if (opt) { hc2.fillStyle = '#fff'; hc2.font = '10px Sora'; hc2.fillText('best', x - 2, HH2 - 36 - h); } hc2.save(); hc2.translate(x + 13, HH2 - 3); hc2.rotate(-Math.PI / 2); hc2.fillStyle = opt ? '#fff' : '#8b9ab0'; hc2.font = '9px JetBrains Mono'; hc2.fillText(z.toString(2).padStart(NQ, '0'), 0, 0); hc2.restore(); }); await sleep(30); }
  const opt = [...pb.cost.keys()].filter(z => pb.cost[z] <= pb.cost[pb.best] + 1e-9), match = pb.cost[bestS] <= pb.cost[pb.best] + 1e-9, amp = opt.reduce((a, z) => a + p[z], 0) * pb.N / opt.length, hits = opt.reduce((a, z) => a + (cnts.get(z) || 0), 0);
  const chosen = bits(bestS, NQ).map((v, i) => v ? i : -1).filter(i => i >= 0);
  $('#qResult').className = 'qres'; $('#qResult').innerHTML = `CVaR-QAOA (p = 1, ${SH} shots) places relays at sites <b>${chosen.join(', ')}</b>, covering <b>${(pb.value[bestS] / pb.total * 100).toFixed(0)}%</b> of reported survivors. Exact search over all ${pb.N} options: <b>${match ? 'same optimum ✓' : 'not reached (re-run)'}</b>. Optimum amplified <b>${amp.toFixed(1)}×</b> vs random; sampled <b>${hits}</b>× in ${SH} shots.<br><span class="muted" style="font-size:13px">8 qubits · statevector simulation in-browser (same maths as Qiskit Aer) · no speed-up claimed at this size.</span>`;
  S.plan = { chosen }; $('#btnDeploy').disabled = false; qRun = false; log(`QAOA relay plan · sites ${chosen.join(', ')}`); };
const planG = new THREE.Group(); scene.add(planG);
$('#btnDeploy').onclick = () => { planG.clear(); SITES.forEach((s, i) => { const on = S.plan.chosen.includes(i); const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.RingGeometry(on ? 8.3 : .5, on ? 8.5 : .65, 80), new THREE.MeshBasicMaterial({ color: on ? 0xa78bfa : 0x4a5a70, transparent: true, opacity: on ? .55 : .8, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; r.position.y = .14; g.add(r);
    if (on) { const o = new THREE.Mesh(new THREE.OctahedronGeometry(.55), new THREE.MeshBasicMaterial({ color: 0xa78bfa })); o.position.y = 3.4; g.add(o); planG.add(L('⚛ QAOA relay site ' + i, s.x, 4.3, s.z, 'lbl q')); } g.position.set(s.x, 0, s.z); planG.add(g); });
  openTab('situation'); flyTo(new THREE.Vector3(0, 55, 30), new THREE.Vector3(0, 0, 0)); };

/* ============ BOOT ============ */
camera.position.set(4, 30, 38); controls.target.set(0, 0, 0); renderResources(); log('VOID-NAV Command ready · Musheerabad zone loaded (12 GHMC wards)');
{ const q = new URLSearchParams(location.search); if (q.get('autosim')) { S.muted = true; startSim(true); const n = +(q.get('n') || 0); Z.SCRIPT.slice(0, n).forEach(s => ingest({ ...s, src: 'sim' })); }
  if (q.get('tab')) setTimeout(() => openTab(q.get('tab')), 300); if (q.get('qaoa')) setTimeout(() => $('#btnQAOA').click(), 600); if (q.get('open')) setTimeout(() => select(S.msgs.find(m => m.prio === 0)?.id), 500); if (q.get('intro')) startSim(false); }
window.VOIDNAV = { ingest, S };
