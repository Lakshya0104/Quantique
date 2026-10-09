import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as D from './data.js';
import { buildProblem, qaoaState, expect, bits, sample, cvar } from './quantum.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const PRIO_COL = ['#ff2d55', '#ff8a1f', '#f5d547', '#2fe08a'];
const PRIO_W = [10, 5, 2, 0.4];

/* ================= STATE ================= */
const S = {
  msgs: [], seq: 0, running: false, t0: null, live: false, selected: null, filter: 'all',
  muted: false, voiceLang: 'multi', phones: 0, relaysDown: new Set(),
  hospitals: D.HOSPITALS.map(h => ({ ...h, free: h.beds })),
  ambs: [], log: [], meshStats: { del: 0, re: 0, dup: 0, hops: [] }, plan: null,
};
D.HOSPITALS.forEach((h, i) => { for (let k = 0; k < (h.trauma ? 2 : 1); k++) S.ambs.push({ id: `TS-108-${String(i * 2 + k + 11).padStart(3, '0')}`, base: h, lat: h.lat + (Math.random() - .5) * .004, lon: h.lon + (Math.random() - .5) * .004, status: 'AVAILABLE', target: null }); });

/* ================= 3D SCENE ================= */
const wrap = $('#three');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(wrap.clientWidth, wrap.clientHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; wrap.appendChild(renderer.domElement);
const labelR = new CSS2DRenderer(); labelR.setSize(wrap.clientWidth, wrap.clientHeight);
Object.assign(labelR.domElement.style, { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }); wrap.appendChild(labelR.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x04070d); scene.fog = new THREE.FogExp2(0x04070d, 0.012);
const camera = new THREE.PerspectiveCamera(45, wrap.clientWidth / wrap.clientHeight, 0.1, 500);
camera.position.set(3, 24, 26);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .06; controls.maxPolarAngle = Math.PI * .47; controls.minDistance = 6; controls.maxDistance = 90;
controls.target.set(1, 0, 0); controls.autoRotate = true; controls.autoRotateSpeed = .35;
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(wrap.clientWidth, wrap.clientHeight), 0.75, 0.45, 0.55); composer.addPass(bloom); composer.addPass(new OutputPass());
scene.add(new THREE.HemisphereLight(0x5aa0ff, 0x05070d, 0.9));
const dl = new THREE.DirectionalLight(0x9fd3ff, 0.8); dl.position.set(-20, 40, 10); scene.add(dl);

// ground + grid
const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: 0x070c16, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const grid = new THREE.GridHelper(120, 120, 0x1b3b5c, 0x0e2236); grid.material.transparent = true; grid.material.opacity = .35; grid.position.y = .01; scene.add(grid);
// lake
{ const L = D.toXZ(D.LAKE.lat, D.LAKE.lon); const sh = new THREE.Shape(); sh.absellipse(0, 0, D.LAKE.rLon * D.K, D.LAKE.rLat * D.K, 0, Math.PI * 2);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 48), new THREE.MeshBasicMaterial({ color: 0x0c4a78, transparent: true, opacity: .85 }));
  m.rotation.x = -Math.PI / 2; m.position.set(L.x, .03, L.z); scene.add(m); addLabel(D.LAKE.name, L.x, .2, L.z, 'lbl'); }
// river
{ const pts = D.RIVER.map(([la, lo]) => { const p = D.toXZ(la, lo); return new THREE.Vector3(p.x, .04, p.z); });
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, .28, 6), new THREE.MeshBasicMaterial({ color: 0x0e5a8a, transparent: true, opacity: .8 }));
  tube.scale.y = .15; scene.add(tube); }
// buildings
{ const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, .5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a2a40, emissive: 0x0a1a2e, emissiveIntensity: .25, roughness: .7, metalness: .2 });
  const N = 3400, inst = new THREE.InstancedMesh(geo, mat, N), m4 = new THREE.Matrix4(); let k = 0;
  const L = D.toXZ(D.LAKE.lat, D.LAKE.lon), rnd = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  while (k < N) {
    let x, z, h; if (Math.random() < .8) { const a = D.AREAS[Math.floor(Math.random() * D.AREAS.length)]; const c = D.toXZ(a.lat, a.lon);
      x = c.x + rnd() * 2.6; z = c.z + rnd() * 2.6; h = (a.tall ? .6 + Math.random() * 2.4 : .15 + Math.random() * .7) * (Math.random() < .05 ? 2 : 1); }
    else { x = (Math.random() - .5) * 40; z = (Math.random() - .5) * 36; h = .1 + Math.random() * .35; }
    if (((x - L.x) / (D.LAKE.rLon * D.K + .3)) ** 2 + ((z - L.z) / (D.LAKE.rLat * D.K + .3)) ** 2 < 1) continue;
    const w = .12 + Math.random() * .25; m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(w, h, w * (0.7 + Math.random() * .6)));
    inst.setMatrixAt(k++, m4);
  }
  scene.add(inst); }
// area labels
D.AREAS.forEach(a => { const p = D.toXZ(a.lat, a.lon); addLabel(a.name, p.x, .3, p.z - 1.6, 'lbl'); });
// hospitals
const hospMeshes = [];
D.HOSPITALS.forEach(h => { const p = D.toXZ(h.lat, h.lon);
  const g = new THREE.Group(); const c1 = new THREE.Mesh(new THREE.BoxGeometry(.9, .22, .28), new THREE.MeshBasicMaterial({ color: 0x2fe08a })), c2 = c1.clone(); c2.rotation.y = Math.PI / 2;
  g.add(c1, c2); g.position.set(p.x, 1.4, p.z); scene.add(g); hospMeshes.push(g);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.4), new THREE.MeshBasicMaterial({ color: 0x2fe08a, transparent: true, opacity: .5 })); pole.position.set(p.x, .7, p.z); scene.add(pole);
  addLabel('✚ ' + h.name.replace(' Hospitals','').replace(' Hospital',''), p.x, 2.1, p.z, 'lbl h'); });
// command post
{ const p = D.toXZ(D.COMMAND_POST.lat, D.COMMAND_POST.lon); const m = new THREE.Mesh(new THREE.CylinderGeometry(.7, .9, .4, 6), new THREE.MeshBasicMaterial({ color: 0x39d0ff }));
  m.position.set(p.x, .2, p.z); scene.add(m); addLabel('◆ COMMAND POST', p.x, 1, p.z, 'lbl h'); }

function addLabel(text, x, y, z, cls) { const d = document.createElement('div'); d.className = cls; d.textContent = text; const o = new CSS2DObject(d); o.position.set(x, y, z); scene.add(o); return o; }

// heat hex columns
const HEX_R = .85, HW = Math.sqrt(3) * HEX_R, HH = 1.5 * HEX_R;
const cellKey = (x, z) => { const r = Math.round(z / HH), c = Math.round((x - (r & 1) * HW / 2) / HW); return r + ':' + c; };
const cellCenter = k => { const [r, c] = k.split(':').map(Number); return { x: c * HW + (r & 1) * HW / 2, z: r * HH }; };
const MAXC = 400; const hexGeo = new THREE.CylinderGeometry(HEX_R * .93, HEX_R * .93, 1, 6); hexGeo.translate(0, .5, 0);
const hexMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: .78, depthWrite: false });
const hexes = new THREE.InstancedMesh(hexGeo, hexMat, MAXC); hexes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); hexes.count = 0; scene.add(hexes);
const hexCap = new THREE.InstancedMesh(new THREE.CylinderGeometry(HEX_R * .95, HEX_R * .95, .05, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 }), MAXC); hexCap.count = 0; scene.add(hexCap);
const hexState = new Map(); // key -> {h, target}
const RAMP = [[0, '#14325a'], [.2, '#2bd4c4'], [.45, '#f5d547'], [.65, '#ff8a1f'], [.85, '#ff2d55'], [1, '#ff9cf0']].map(([t, c]) => [t, new THREE.Color(c)]);
const ramp = v => { v = Math.max(0, Math.min(1, v)); for (let i = 1; i < RAMP.length; i++) if (v <= RAMP[i][0]) { const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i]; return ca.clone().lerp(cb, (v - a) / (b - a)); } return RAMP.at(-1)[1].clone(); };

// beacons
const beacons = new Map(); // msg id -> group
const beamGeo = new THREE.CylinderGeometry(.05, .05, 6, 8); beamGeo.translate(0, 3, 0);
function addBeacon(m) { const p = D.toXZ(m.loc.lat, m.loc.lon), col = new THREE.Color(PRIO_COL[m.prio]); const g = new THREE.Group();
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: m.prio === 0 ? .9 : .5 })); beam.scale.y = m.prio === 0 ? 1 : .55;
  const ring = new THREE.Mesh(new THREE.RingGeometry(.25, .34, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .06;
  const orb = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 16), new THREE.MeshBasicMaterial({ color: col })); orb.position.y = m.prio === 0 ? 6 : 3.3;
  g.add(beam, ring, orb); g.position.set(p.x, 0, p.z); g.userData = { ring, beam, orb, born: performance.now(), m }; scene.add(g); beacons.set(m.id, g); }
function styleBeacon(m) { const g = beacons.get(m.id); if (!g) return; const c = m.state === 'DISPATCHED' ? new THREE.Color('#2fe08a') : new THREE.Color(PRIO_COL[m.prio]);
  g.userData.beam.material.color = c; g.userData.ring.material.color = c; g.userData.orb.material.color = c; if (m.state === 'DISPATCHED') g.userData.beam.material.opacity = .25; }

// mesh in 3D
const meshNodes3 = new Map(); const linkGroup = new THREE.Group(); scene.add(linkGroup);
D.MESH.nodes.forEach(n => { const p = D.toXZ(n.lat, n.lon); const g = new THREE.Group();
  const col = n.kind === 'gw' ? 0x39d0ff : n.kind === 'node' ? 0xa78bfa : 0x39d0ff;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .07, 2.2), new THREE.MeshStandardMaterial({ color: 0x8fb8d8 })); pole.position.y = 1.1;
  const top = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 16), new THREE.MeshBasicMaterial({ color: col })); top.position.y = 2.25;
  g.add(pole, top); g.position.set(p.x, 0, p.z); g.userData = { top, n }; scene.add(g); meshNodes3.set(n.id, g); });
const packets = [];
function arc(a, b, h = 2.6) { const pa = new THREE.Vector3(a.x, 2.25, a.z), pb = new THREE.Vector3(b.x, 2.25, b.z); const mid = pa.clone().add(pb).multiplyScalar(.5); mid.y += h; return new THREE.QuadraticBezierCurve3(pa, mid, pb); }
function drawLinks() { linkGroup.clear(); const nodes = D.MESH.nodes;
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const a = nodes[i], b = nodes[j]; if (Math.hypot(a.lat - b.lat, a.lon - b.lon) > D.MESH.range) continue;
    const down = S.relaysDown.has(a.id) || S.relaysDown.has(b.id); const c = arc(D.toXZ(a.lat, a.lon), D.toXZ(b.lat, b.lon), 1.2);
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(30)), new THREE.LineBasicMaterial({ color: down ? 0x5a2030 : 0x2a7fb0, transparent: true, opacity: down ? .3 : .55 })); linkGroup.add(l); }
  meshNodes3.forEach((g, id) => { g.userData.top.material.color.set(S.relaysDown.has(id) ? 0x5a2030 : (g.userData.n.kind === 'node' ? 0xa78bfa : 0x39d0ff)); }); }
drawLinks();
function sendPacket3D(pathIds, from, color = 0xffffff) { const pts = []; if (from) pts.push(D.toXZ(from.lat, from.lon)); pathIds.forEach(id => { const n = D.MESH.nodes.find(x => x.id === id); pts.push(D.toXZ(n.lat, n.lon)); });
  const curves = []; for (let i = 0; i < pts.length - 1; i++) curves.push(arc(pts[i], pts[i + 1], 1.4 + i * .1));
  const s = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 12), new THREE.MeshBasicMaterial({ color })); scene.add(s); packets.push({ s, curves, t: 0 }); }

// ambulances
const ambMeshes = new Map();
function ambMesh(a) { if (ambMeshes.has(a.id)) return ambMeshes.get(a.id); const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(.5, .28, .28), new THREE.MeshBasicMaterial({ color: 0xffffff })); b.position.y = .2;
  const l = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2d55 })); l.position.y = .42; g.add(b, l); g.userData.l = l; scene.add(g); ambMeshes.set(a.id, g); return g; }

// attention markers
const attnLabels = [];
// planned relays
const planGroup = new THREE.Group(); scene.add(planGroup);
// shockwave
const waves = [];
function shock(lat, lon) { const p = D.toXZ(lat, lon); for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, side: THREE.DoubleSide }));
  r.rotation.x = -Math.PI / 2; r.position.set(p.x, .1, p.z); scene.add(r); waves.push({ r, t: -i * .5 }); } }

/* ================= CAMERA ================= */
let fly = null;
function flyTo(x, z, dist = 14, polar = .9) { const from = camera.position.clone(), ft = controls.target.clone(); const to = new THREE.Vector3(x + dist * .35, dist * Math.cos(polar) * 1.6, z + dist * .9);
  fly = { from, to, ft, tt: new THREE.Vector3(x, 0, z), t: 0 }; controls.autoRotate = false; }
$('#vTop').onclick = () => { fly = { from: camera.position.clone(), to: new THREE.Vector3(controls.target.x, 55, controls.target.z + .1), ft: controls.target.clone(), tt: controls.target.clone(), t: 0 }; };
$('#vTilt').onclick = () => flyTo(1, 0, 34);
$('#vSpin').onclick = () => { controls.autoRotate = !controls.autoRotate; };

/* ================= LOOP ================= */
const clock = new THREE.Clock();
function loop() { requestAnimationFrame(loop); const dt = clock.getDelta(), t = performance.now() / 1000;
  if (fly) { fly.t = Math.min(1, fly.t + dt / 1.6); const e = 1 - Math.pow(1 - fly.t, 3); camera.position.lerpVectors(fly.from, fly.to, e); controls.target.lerpVectors(fly.ft, fly.tt, e); if (fly.t >= 1) fly = null; }
  controls.update();
  // hex animation
  let i = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  hexState.forEach((h, k) => { h.h += (h.target - h.h) * Math.min(1, dt * 3); if (h.h < .02 && h.target === 0) { hexState.delete(k); return; } if (i >= MAXC) return;
    const c = cellCenter(k), hh = .05 + h.h * 9 * (1 + (h.v > .8 ? Math.sin(t * 4) * .04 : 0));
    m4.compose(new THREE.Vector3(c.x, 0, c.z), q, new THREE.Vector3(1, hh, 1)); hexes.setMatrixAt(i, m4); hexes.setColorAt(i, ramp(h.v));
    m4.compose(new THREE.Vector3(c.x, hh, c.z), q, new THREE.Vector3(1, 1, 1)); hexCap.setMatrixAt(i, m4); hexCap.setColorAt(i, ramp(Math.min(1, h.v + .12)).multiplyScalar(1.1)); i++; });
  hexes.count = hexCap.count = i; hexes.instanceMatrix.needsUpdate = hexCap.instanceMatrix.needsUpdate = true; if (hexes.instanceColor) hexes.instanceColor.needsUpdate = true; if (hexCap.instanceColor) hexCap.instanceColor.needsUpdate = true;
  beacons.forEach(g => { const u = g.userData, a = ((t - u.born / 1000) % 1.6) / 1.6; u.ring.scale.setScalar(1 + a * (u.m.prio === 0 ? 5 : 3)); u.ring.material.opacity = (1 - a) * (u.m.state === 'DISPATCHED' ? .2 : .9); u.orb.position.y = (u.m.prio === 0 ? 6 : 3.3) + Math.sin(t * 2 + u.born) * .15; });
  meshNodes3.forEach((g, id) => { if (!S.relaysDown.has(id)) g.userData.top.scale.setScalar(1 + Math.sin(t * 3 + id.charCodeAt(1)) * .15); });
  for (let j = packets.length - 1; j >= 0; j--) { const p = packets[j]; p.t += dt * 1.6; const seg = Math.floor(p.t); if (seg >= p.curves.length) { scene.remove(p.s); packets.splice(j, 1); continue; } p.s.position.copy(p.curves[seg].getPoint(p.t - seg)); }
  for (let j = waves.length - 1; j >= 0; j--) { const w = waves[j]; w.t += dt * .5; if (w.t < 0) { w.r.visible = false; continue; } w.r.visible = true; w.r.scale.setScalar(1 + w.t * 22); w.r.material.opacity = Math.max(0, 1 - w.t); if (w.t > 1) { scene.remove(w.r); waves.splice(j, 1); } }
  S.ambs.forEach(a => { if (a.status === 'AVAILABLE') return; const g = ambMesh(a), p = D.toXZ(a.lat, a.lon); g.position.set(p.x, 0, p.z); g.userData.l.material.color.set(Math.sin(t * 12) > 0 ? 0xff2d55 : 0x39d0ff); });
  planGroup.children.forEach(c => { if (c.userData.ring) c.userData.ring.rotation.z += dt; });
  composer.render(); labelR.render(scene, camera);
}
loop();
addEventListener('resize', () => { const w = wrap.clientWidth, h = wrap.clientHeight; if (!w) return; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); composer.setSize(w, h); labelR.setSize(w, h); });

/* ================= MESH ROUTING ================= */
const nodeById = id => D.MESH.nodes.find(n => n.id === id);
function neighbours(id) { const a = nodeById(id); return D.MESH.nodes.filter(b => b.id !== id && !S.relaysDown.has(b.id) && Math.hypot(a.lat - b.lat, a.lon - b.lon) <= D.MESH.range); }
function hopDist() { const d = { GW: 0 }, q = ['GW']; while (q.length) { const c = q.shift(); neighbours(c).forEach(n => { if (d[n.id] === undefined) { d[n.id] = d[c] + 1; q.push(n.id); } }); } return d; }
function routeFrom(lat, lon) { const d = hopDist(); const cand = D.MESH.nodes.filter(n => n.kind !== 'gw' && !S.relaysDown.has(n.id) && d[n.id] !== undefined).sort((a, b) => Math.hypot(a.lat - lat, a.lon - lon) - Math.hypot(b.lat - lat, b.lon - lon));
  if (!cand.length) return null; let cur = cand[0].id; const path = [cur]; while (cur !== 'GW') { const nx = neighbours(cur).filter(n => d[n.id] < d[cur]).sort((a, b) => d[a.id] - d[b.id])[0]; if (!nx) return null; cur = nx.id; path.push(cur); } return path; }

/* ================= MESSAGES ================= */
function nearestHosp(loc, n = 3) { return S.hospitals.map(h => ({ h, d: D.distKm(loc, h) })).sort((a, b) => a.d - b.d).slice(0, n); }
function nearestAmb(loc) { return S.ambs.filter(a => a.status === 'AVAILABLE').map(a => ({ a, d: D.distKm(loc, a) })).sort((x, y) => x.d - y.d); }
function areaOf(loc) { return D.AREAS.map(a => ({ a, d: D.distKm(loc, a) })).sort((x, y) => x.d - y.d)[0].a; }

function ingest(m) {
  m.id = m.id || (Math.random().toString(16).slice(2, 10).toUpperCase()); if (S.msgs.find(x => x.id === m.id)) { S.meshStats.dup++; renderMeshStats(); return; }
  m.state = 'UNREAD'; m.t = Date.now(); m.area = areaOf(m.loc).name; S.msgs.unshift(m);
  const path = m.src === 'live' ? null : routeFrom(m.loc.lat, m.loc.lon);
  if (path) { m.hops = path.length; m.path = path; sendPacket3D(path, m.loc, new THREE.Color(PRIO_COL[m.prio]).getHex()); meshPacket(path); S.meshStats.del++; S.meshStats.hops.push(path.length); renderMeshStats(); }
  addBeacon(m); toast(m); if (m.prio === 0) { siren(); speak(m); flashScreen(); }
  logLine(`SOS ${m.id} · ${D.CAT_LABEL[m.cat]} · ${m.area}${m.src === 'live' ? ' · LIVE LoRa' : ''}`);
  refresh();
}
function setState(m, st, extra = {}) { if (m.state === 'DISPATCHED' || (m.state === 'READ' && st === 'UNREAD')) return; m.state = st; Object.assign(m, extra); styleBeacon(m);
  if (m.src === 'live') serialSend({ type: 'status', id: m.id, state: st });
  logLine(`${m.id} → ${st}${extra.unit ? ' · ' + extra.unit : ''}`); refresh(); }

/* ================= ATTENTION ================= */
function computeHeat() { const now = Date.now(), cells = new Map();
  S.msgs.forEach(m => { const p = D.toXZ(m.loc.lat, m.loc.lon), k = cellKey(p.x, p.z); const age = (now - m.t) / 1000;
    let w = PRIO_W[m.prio] * (1 + Math.log2(1 + (m.people || 1))) * (1 + Math.min(age, 300) / 150);
    if (m.injured === 'YES') w *= 1.3; if (m.state === 'UNREAD') w *= 1.35; if (m.state === 'DISPATCHED') w *= .15;
    const c = cells.get(k) || { s: 0, msgs: [] }; c.s += w; c.msgs.push(m); cells.set(k, c);
    // spill into neighbours for smooth heat
    [[HW, 0], [-HW, 0], [HW / 2, HH], [-HW / 2, HH], [HW / 2, -HH], [-HW / 2, -HH]].forEach(([dx, dz]) => { const k2 = cellKey(p.x + dx, p.z + dz); const c2 = cells.get(k2) || { s: 0, msgs: [] }; c2.s += w * .28; cells.set(k2, c2); }); });
  const mx = Math.max(25, ...[...cells.values()].map(c => c.s));
  hexState.forEach(h => h.target = 0);
  cells.forEach((c, k) => { const v = c.s / mx; if (v < .07) return; const h = hexState.get(k) || { h: 0, target: 0, v: 0 }; h.target = v; h.v = v; hexState.set(k, h); });
  return [...cells.entries()].filter(([, c]) => c.msgs.length).map(([k, c]) => ({ k, ...c, v: c.s / mx })).sort((a, b) => b.s - a.s); }

function renderAttention(cells) { const top = cells.slice(0, 4); attnLabels.forEach(l => scene.remove(l)); attnLabels.length = 0;
  if (!top.length) { $('#attnList').innerHTML = '<p class="muted">No open requests.</p>'; return; }
  $('#attnList').innerHTML = top.map((c, i) => { const ms = c.msgs, open = ms.filter(m => m.state !== 'DISPATCHED'), crit = open.filter(m => m.prio === 0), unread = open.filter(m => m.state === 'UNREAD');
    const ppl = open.reduce((a, m) => a + (m.people || 1), 0), loc = ms[0].loc, hs = nearestHosp(loc, 1)[0], am = nearestAmb(loc)[0]; const col = '#' + ramp(c.v).getHexString();
    const cc = cellCenter(c.k); const lab = addLabel(`#${i + 1}`, cc.x, c.v * 9 + 1.2, cc.z, 'lbl a'); lab.element.style.setProperty('--c', col); attnLabels.push(lab);
    return `<div class="az" style="--c:${col}"><div class="r"><span class="rank">#${i + 1} PRIORITY ZONE</span><span class="sc">${Math.round(c.v * 100)}</span></div>
    <div class="nm">${ms[0].area}</div><div class="why">${crit.length ? `<b style="color:#ff2d55">${crit.length} critical</b> · ` : ''}${unread.length} unread · ~${ppl} people<br>
    Nearest hospital: <b>${hs.h.name}</b> ${hs.d.toFixed(1)} km${am ? ` · ambulance ~${Math.max(2, Math.round(am.d / 30 * 60))} min` : ' · <b style="color:#ff8a1f">no free ambulance</b>'}</div>
    <div class="act"><button class="ghost sm" data-fx="${cc.x}" data-fz="${cc.z}">Focus 3D</button><button class="ghost sm" data-open="${(unread[0] || open[0] || ms[0]).id}">Open top SOS</button></div></div>`; }).join('');
  $$('#attnList [data-fx]').forEach(b => b.onclick = () => flyTo(+b.dataset.fx, +b.dataset.fz, 11));
  $$('#attnList [data-open]').forEach(b => b.onclick = () => { openTab('inbox'); select(b.dataset.open); }); }

/* ================= UI RENDER ================= */
let lastAttn = 0;
function refresh(force) { const open = S.msgs.filter(m => m.state !== 'DISPATCHED');
  $('#kOpen').textContent = open.length; $('#kCrit').textContent = S.msgs.filter(m => m.prio === 0 && m.state === 'UNREAD').length;
  $('#kPeople').textContent = S.msgs.reduce((a, m) => a + (m.people || 1), 0); $('#kDisp').textContent = S.msgs.filter(m => m.state === 'DISPATCHED').length;
  $('#kRelays').textContent = `${7 - S.relaysDown.size}/7`; $('#kPhones').textContent = S.phones;
  const un = S.msgs.filter(m => m.state === 'UNREAD').length; $('#badgeUnread').textContent = un;
  const cells = computeHeat(); if (force || performance.now() - lastAttn > 600) { renderAttention(cells); lastAttn = performance.now(); }
  renderList(); if (S.selected) renderDetail(); renderResources(); }

const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? s + 's ago' : Math.floor(s / 60) + 'm ago'; };
function renderList() { const f = S.filter; const arr = S.msgs.filter(m => f === 'all' || (f === 'crit' && m.prio === 0) || (f === 'unread' && m.state === 'UNREAD') || (f === 'read' && m.state === 'READ') || (f === 'disp' && m.state === 'DISPATCHED'))
  .sort((a, b) => (a.state === 'DISPATCHED') - (b.state === 'DISPATCHED') || a.prio - b.prio || b.t - a.t);
  $('#msgList').innerHTML = arr.map(m => `<div class="mi ${m.state === 'UNREAD' ? 'unread' : ''} ${S.selected === m.id ? 'sel' : ''}" style="--c:${PRIO_COL[m.prio]}" data-id="${m.id}">
   <div class="mr"><span style="color:${PRIO_COL[m.prio]}">${D.PRIO_LABEL[m.prio]}${m.src === 'live' ? '<span class="src live">LIVE LoRa</span>' : '<span class="src sim">SIM</span>'}</span><span class="pill st-${m.state}">${m.state}</span></div>
   <div class="mt">${m.panic ? 'PANIC BUTTON · ' : ''}${D.CAT_LABEL[m.cat]} · ${m.people || 1} ${m.people > 1 ? 'people' : 'person'}</div>
   <div class="ms">${m.area} · ${ago(m.t)}${m.text ? ' · “' + m.text + '”' : ''}</div></div>`).join('') || '<p class="muted" style="padding:20px">Nothing here yet.</p>';
  $$('#msgList .mi').forEach(e => e.onclick = () => select(e.dataset.id)); }
function select(id) { S.selected = id; const m = S.msgs.find(x => x.id === id); if (m && m.state === 'UNREAD') setState(m, 'READ'); renderList(); renderDetail(); }
function renderDetail() { const m = S.msgs.find(x => x.id === S.selected); if (!m) return; const hs = nearestHosp(m.loc, 3), ams = nearestAmb(m.loc).slice(0, 3);
  $('#detail').innerHTML = `<div class="dh"><div><div style="font-family:var(--m);font-size:13px;color:${PRIO_COL[m.prio]}">${D.PRIO_LABEL[m.prio]} · SOS #${m.id}${m.src === 'live' ? '<span class="src live">LIVE LoRa HARDWARE</span>' : '<span class="src sim">SIMULATED</span>'}</div>
   <div class="dcat">${m.panic ? 'Panic button · ' : ''}${D.CAT_LABEL[m.cat]}</div><div class="muted" style="font-size:15px">${m.area} · received ${ago(m.t)} · via ${m.hops || 1} hop${(m.hops || 1) > 1 ? 's' : ''}${m.rssi ? ` · RSSI ${m.rssi} dBm · SNR ${m.snr}` : ''}</div></div>
   <span class="pill st-${m.state}" style="font-size:14px;padding:7px 14px">${m.state}</span></div>
   ${m.text ? `<div class="quote">“${m.text}”</div>${m.gloss ? `<div class="gloss">Meaning: ${m.gloss} <span class="src sim">${m.lang.toUpperCase()}</span></div>` : ''}` : '<div class="quote muted">No text: structured answers only</div>'}
   <div class="facts"><div><label>People</label><b>${m.people || 1}</b></div><div><label>Injured</label><b style="color:${m.injured === 'YES' ? '#ff2d55' : 'inherit'}">${m.injured}</b></div><div><label>Flags</label><b style="font-size:15px">${(m.flags || []).join(', ') || '—'}</b></div>
   <div><label>Location</label><b style="font-size:14px">${m.loc.lat.toFixed(4)}, ${m.loc.lon.toFixed(4)}</b><small class="muted" style="font-size:11px">${m.loc.src}</small></div></div>
   <div class="near"><div class="nb"><h4>Nearest hospitals</h4>${hs.map(x => `<div class="row"><span>✚ ${x.h.name}</span><span>${x.d.toFixed(1)} km · <b style="color:#2fe08a">${x.h.free}</b> beds</span></div>`).join('')}</div>
   <div class="nb"><h4>Nearest free ambulances</h4>${ams.map(x => `<div class="row"><span>🚑 ${x.a.id}</span><span>~${Math.max(2, Math.round(x.d / 30 * 60))} min</span></div>`).join('') || '<p class="muted">None free: escalate to 108 control</p>'}</div></div>
   <div class="dispatch">${m.state === 'DISPATCHED' ? `<div style="font-size:17px;color:#2fe08a;font-weight:700">✓ Rescue dispatched: ${m.unit}</div>` :
   `<select id="dSel">${ams.map(x => `<option value="amb:${x.a.id}">🚑 ${x.a.id} → ${nearestHosp(m.loc, 1)[0].h.name}</option>`).join('')}<option value="team:GHMC DRF Team 4">⛑ GHMC DRF Team 4</option><option value="team:Fire & Emergency Unit 7">🚒 Fire & Emergency Unit 7</option></select>
   <button class="go" id="dGo">Confirm rescue dispatched</button>`}</div>
   <div class="leds">Survivor's node shows: <span><i class="led ${m.state !== 'UNREAD' ? 'o' : ''}"></i>READ</span><span><i class="led ${m.state === 'DISPATCHED' ? 'g' : ''}"></i>DISPATCHED</span>${m.src === 'live' ? '<span style="color:#2fe08a">· sent over LoRa</span>' : ''}</div>`;
  const go = $('#dGo'); if (go) go.onclick = () => { const v = $('#dSel').value, [kind, id] = v.split(/:(.*)/s); let unit = id;
    if (kind === 'amb') { const a = S.ambs.find(x => x.id === id); a.status = 'EN ROUTE'; a.target = m; a.from = { lat: a.lat, lon: a.lon }; a.start = Date.now(); const h = nearestHosp(m.loc, 1)[0].h; h.free = Math.max(0, h.free - Math.min(m.people || 1, 3)); unit = `${id} · ${h.name}`; logLine(`108 → ${id} assigned · ${h.name} notified`); }
    setState(m, 'DISPATCHED', { unit }); toastSimple('Rescue dispatched', `${unit} → ${m.area}`, '#2fe08a'); }; }

function renderResources() { const top = S.msgs.find(m => m.state !== 'DISPATCHED' && m.prio === 0) || S.msgs[0]; const ref = top ? top.loc : D.COMMAND_POST;
  $('#hospList').innerHTML = S.hospitals.map(h => ({ h, d: D.distKm(ref, h) })).sort((a, b) => a.d - b.d).map(({ h, d }) => `<div class="hc"><div><div class="hn">✚ ${h.name}</div><div class="ha">${h.area} · ${d.toFixed(1)} km${h.trauma ? ' · trauma care' : ''}</div></div>
    <div class="hb">${h.free}<small>beds free</small></div><div class="bar"><i style="width:${100 - h.free / h.beds * 100}%"></i></div><div class="hl"><span class="pill ss">LINK · SIMULATED</span>${h.free < h.beds * .3 ? '<span class="pill se">NEAR CAPACITY</span>' : ''}</div></div>`).join('');
  $('#ambList').innerHTML = S.ambs.map(a => `<div class="ac"><div><div class="an">🚑 ${a.id}</div><div class="as">${a.status === 'AVAILABLE' ? 'at ' + a.base.name : '→ ' + (a.target?.area || '') + (a.status === 'AT SCENE' ? ' · on scene' : '')}</div></div>
    <span class="pill ${a.status === 'AVAILABLE' ? 'sa' : a.status === 'EN ROUTE' ? 'se' : 'ss'}">${a.status}</span></div>`).join('');
  $('#agList').innerHTML = D.AGENCIES.map(g => `<div class="ac"><div><div class="an">${g.icon} ${g.name}</div><div class="as">${g.role}</div></div><span class="pill ss">LINKED · SIM</span></div>`).join(''); }
function logLine(s) { const t = new Date().toLocaleTimeString('en-GB'); S.log.unshift(`<div><span>${t}</span> ${s}</div>`); S.log.length = Math.min(S.log.length, 80); const el = $('#log'); if (el) el.innerHTML = S.log.join(''); }

/* ================= TOASTS, SIREN, VOICE ================= */
function toast(m) { const d = document.createElement('div'); d.className = 'toast' + (m.prio === 0 ? ' crit' : ''); d.style.setProperty('--c', PRIO_COL[m.prio]);
  d.innerHTML = `<div class="t1"><span>${D.PRIO_LABEL[m.prio]} · ${m.area}</span><span>${m.src === 'live' ? 'LIVE LoRa' : 'SIM'}</span></div><div class="t2">${m.panic ? 'Panic button · ' : ''}${D.CAT_LABEL[m.cat]} · ${m.people || 1} people${m.injured === 'YES' ? ' · injured' : ''}</div><div class="t3">${m.text ? '“' + m.text + '”' : 'structured SOS'}</div>`;
  d.onclick = () => { openTab('inbox'); select(m.id); }; $('#toasts').prepend(d); const lim = $('#situation').classList.contains('on') ? 3 : 1; const all = $$('#toasts .toast'); if (all.length > lim) all.slice(lim).forEach(x => x.remove());
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, ($('#situation').classList.contains('on') ? 1 : .5) * (m.prio === 0 ? 9000 : 5500)); }
function toastSimple(a, b, c) { toast({ prio: 3, area: a, cat: 'OTHER', people: 0, text: b, src: 'sys' }); }
let actx; function siren() { if (S.muted) return; try { actx = actx || new AudioContext(); const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sawtooth'; o.connect(g); g.connect(actx.destination);
  const t = actx.currentTime; [0, .25, .5, .75].forEach((d, i) => o.frequency.setValueAtTime(i % 2 ? 660 : 880, t + d)); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.08, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + 1); o.start(t); o.stop(t + 1.05); } catch (e) { } }
const VT = {
  en: m => `Critical alert. ${m.people || 1} ${m.people > 1 ? 'people' : 'person'} ${m.cat === 'INJURED' ? 'injured' : 'trapped'} in ${m.area}. ${m.injured === 'YES' ? 'Injuries reported. ' : ''}Nearest hospital, ${nearestHosp(m.loc, 1)[0].h.name}.`,
  hi: m => `गंभीर चेतावनी। ${m.area} में ${m.people || 1} लोग ${m.cat === 'INJURED' ? 'घायल' : 'फँसे'} हैं। निकटतम अस्पताल ${nearestHosp(m.loc, 1)[0].h.name}।`,
  te: m => `అత్యవసర హెచ్చరిక. ${m.area} లో ${m.people || 1} మంది ${m.cat === 'INJURED' ? 'గాయపడ్డారు' : 'చిక్కుకున్నారు'}. సమీప ఆసుపత్రి ${nearestHosp(m.loc, 1)[0].h.name}.`,
};
const LANG = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' }; let lastSpeak = 0;
function pickVoice(code) { const vs = speechSynthesis.getVoices(); return vs.find(v => v.lang === code) || vs.find(v => v.lang.startsWith(code.slice(0, 2))) || (code.startsWith('en') ? vs.find(v => v.lang.startsWith('en')) : null); }
function speak(m) { if (S.muted || !('speechSynthesis' in window)) return; if (Date.now() - lastSpeak < 7000) return; lastSpeak = Date.now();
  const langs = S.voiceLang === 'multi' ? ['en', 'hi', 'te'] : [S.voiceLang];
  langs.forEach(l => { const v = pickVoice(LANG[l]); if (!v && l !== 'en') return; const u = new SpeechSynthesisUtterance(VT[l](m)); u.lang = LANG[l]; if (v) u.voice = v; u.rate = 1.02; speechSynthesis.speak(u); }); }
speechSynthesis?.getVoices();
function flashScreen() { const f = $('#flash'); f.style.opacity = 1; setTimeout(() => f.style.opacity = 0, 350); }

/* ================= SIMULATION ================= */
const ZONES = D.AREAS.filter(a => a.risk > .3);
function simMessage() { const z = pickWeighted(ZONES, a => a.risk ** 2), tpl = pickWeighted(D.MSG_TEMPLATES, t => [3, 1.4, 1, .5][t.prio]);
  const loc = { lat: z.lat + (Math.random() - .5) * .016, lon: z.lon + (Math.random() - .5) * .016, src: 'SIMULATED location' };
  ingest({ ...tpl, flags: tpl.flags || [], people: tpl.cat === 'SAFE' ? 1 + Math.floor(Math.random() * 4) : [1, 2, 3, 4, 6, 8][Math.floor(Math.random() * 6)], loc, src: 'sim', rssi: -60 - Math.round(Math.random() * 45), snr: (Math.random() * 12 - 2).toFixed(1) }); }
function pickWeighted(arr, w) { const ws = arr.map(w), s = ws.reduce((a, b) => a + b, 0); let r = Math.random() * s; for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; } return arr[0]; }
let simTimer = null;
function startSim() { if (S.running) { S.running = false; clearTimeout(simTimer); $('#btnSim').textContent = '▶ Simulate disaster'; return; }
  S.running = true; S.t0 = S.t0 || Date.now(); $('#btnSim').textContent = '⏸ Pause simulation';
  const ep = D.AREAS.find(a => a.id === 'MUS'); shock(ep.lat, ep.lon); flashScreen(); siren();
  const b = $('#scenarioBanner'); b.innerHTML = '⚠ SIMULATED · M6.1 earthquake · Musheerabad, Hyderabad · cellular down'; b.classList.remove('hidden');
  flyTo(1, -2, 26); logLine('SIMULATED disaster declared · VOID-NAV mesh activated');
  const tick = () => { if (!S.running) return; const el = (Date.now() - S.t0) / 1000; const rate = el < 20 ? 1.4 : el < 120 ? 2.6 : 5;
    simMessage(); S.phones += 3 + Math.floor(Math.random() * 9);
    if (Math.random() < .12) { const m = S.msgs.find(x => x.prio === 3 && x.state === 'UNREAD'); if (m) setState(m, 'READ'); }
    simTimer = setTimeout(tick, rate * 1000 * (.5 + Math.random())); };
  setTimeout(tick, 900); }
$('#btnSim').onclick = startSim;
setInterval(() => { // ambulances move + clock
  $('#clock').textContent = new Date().toLocaleTimeString('en-GB');
  if (S.t0) { const s = Math.floor((Date.now() - S.t0) / 1000); $('#elapsed').textContent = `T+${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
  S.ambs.forEach(a => { if (a.status !== 'EN ROUTE') return; const k = Math.min(1, (Date.now() - a.start) / 22000); a.lat = a.from.lat + (a.target.loc.lat - a.from.lat) * k; a.lon = a.from.lon + (a.target.loc.lon - a.from.lon) * k;
    if (k >= 1) { a.status = 'AT SCENE'; logLine(`${a.id} on scene · ${a.target.area}`); renderResources(); } });
  if (S.msgs.length) refresh(); }, 1000);

/* ================= TABS & CONTROLS ================= */
function openTab(id) { $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === id)); $$('.tab').forEach(t => t.classList.toggle('on', t.id === id)); if (id === 'situation') dispatchEvent(new Event('resize')); if (id === 'mesh') drawMesh(); }
$$('#tabs button').forEach(b => b.onclick = () => openTab(b.dataset.tab));
$$('.filters button').forEach(b => b.onclick = () => { $$('.filters button').forEach(x => x.classList.remove('on')); b.classList.add('on'); S.filter = b.dataset.f; renderList(); });
$('#voiceLang').onchange = e => S.voiceLang = e.target.value;
$('#btnMute').onclick = e => { S.muted = !S.muted; e.target.textContent = S.muted ? '🔇' : '🔊'; if (S.muted) speechSynthesis.cancel(); };

/* ================= HARDWARE (Web Serial) ================= */
let port, writer;
const LIVE_LOC = { lat: 17.4399, lon: 78.4983, src: 'CONFIGURED demo location (no GPS on node)' };
async function connectHW() { if (!('serial' in navigator)) { alert('Use Google Chrome or Edge on a laptop: Web Serial is needed to read the ESP32 gateway.'); return; }
  try { port = await navigator.serial.requestPort(); await port.open({ baudRate: 115200 }); } catch (e) { return; }
  S.live = true; $('#modeBadge').className = 'mode live'; $('#modeBadge').textContent = 'LIVE · LoRa GATEWAY'; $('#btnHW').textContent = '⚡ Hardware connected';
  logLine('ESP32 LoRa gateway connected over USB'); writer = port.writable.getWriter();
  const dec = new TextDecoderStream(); port.readable.pipeTo(dec.writable); const rd = dec.readable.getReader(); let buf = '';
  while (true) { const { value, done } = await rd.read(); if (done) break; buf += value; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); handleLine(line); } } }
function handleLine(line) { if (!line.startsWith('{')) return; let j; try { j = JSON.parse(line); } catch (e) { return; }
  if (j.type === 'sos') { const tpl = { cat: (j.cat || 'RESCUE').toUpperCase(), prio: j.prio ?? 0 };
    ingest({ id: j.id, cat: D.CAT_LABEL[tpl.cat] ? tpl.cat : 'OTHER', prio: tpl.prio, injured: j.injured || 'MAYBE', people: parseInt(j.people) || 1, text: j.text || '', panic: !!j.panic, flags: j.flags || [], lang: 'raw',
      loc: j.loc && j.loc.lat ? { ...j.loc, src: j.loc.src || 'node GPS' } : { ...LIVE_LOC, lat: LIVE_LOC.lat + (Math.random() - .5) * .002 }, src: 'live', rssi: j.rssi, snr: j.snr, hops: j.hops || 1 });
    const m = S.msgs[0]; if (m && m.src === 'live') sendPacket3D(['GW'], m.loc, 0xffffff); }
  if (j.type === 'hello') logLine(`beacon ${j.node} · ${j.hops_to_gw ?? '?'} hops · RSSI ${j.rssi ?? '?'}`); }
async function serialSend(o) { if (!writer) return; try { await writer.write(new TextEncoder().encode(JSON.stringify(o) + '\n')); logLine(`→ node: ${o.id} ${o.state} (over LoRa)`); } catch (e) { } }
$('#btnHW').onclick = connectHW;

/* ================= MESH SVG ================= */
const svg = $('#meshSvg'); const BB = (() => { const la = D.MESH.nodes.map(n => n.lat), lo = D.MESH.nodes.map(n => n.lon); return { a: Math.min(...la), b: Math.max(...la), c: Math.min(...lo), d: Math.max(...lo) }; })();
const sx = lon => 60 + (lon - BB.c) / (BB.d - BB.c) * 520, sy = lat => 470 - (lat - BB.a) / (BB.b - BB.a) * 420;
function drawMesh(hl) { const d = hopDist(); let h = '';
  for (let i = 0; i < D.MESH.nodes.length; i++) for (let j = i + 1; j < D.MESH.nodes.length; j++) { const a = D.MESH.nodes[i], b = D.MESH.nodes[j]; if (Math.hypot(a.lat - b.lat, a.lon - b.lon) > D.MESH.range) continue;
    const down = S.relaysDown.has(a.id) || S.relaysDown.has(b.id); const on = hl && hl.some((x, k) => (x === a.id && hl[k + 1] === b.id) || (x === b.id && hl[k + 1] === a.id));
    h += `<line x1="${sx(a.lon)}" y1="${sy(a.lat)}" x2="${sx(b.lon)}" y2="${sy(b.lat)}" stroke="${on ? '#39d0ff' : down ? '#5a2030' : '#24476a'}" stroke-width="${on ? 4 : 2}" ${down ? 'stroke-dasharray="6 6"' : ''}/>`; }
  D.MESH.nodes.forEach(n => { const down = S.relaysDown.has(n.id), col = down ? '#ff2d55' : n.kind === 'gw' ? '#39d0ff' : n.kind === 'node' ? '#a78bfa' : '#2bd4c4';
    h += `<g data-id="${n.id}" style="cursor:${n.kind === 'relay' ? 'pointer' : 'default'}"><circle cx="${sx(n.lon)}" cy="${sy(n.lat)}" r="${n.kind === 'gw' ? 24 : 18}" fill="#0a1220" stroke="${col}" stroke-width="3"/>
    <text x="${sx(n.lon)}" y="${sy(n.lat) + 5}" text-anchor="middle" fill="${col}" font-size="14" font-weight="700" font-family="Sora">${down ? '✕' : n.id}</text>
    <text x="${sx(n.lon)}" y="${sy(n.lat) + (n.kind === 'gw' ? 42 : 36)}" text-anchor="middle" fill="#8b9ab0" font-size="12" font-family="JetBrains Mono">${down ? 'offline' : d[n.id] !== undefined ? d[n.id] + ' hop' : 'no route'}</text></g>`; });
  h += `<g id="pk"></g>`; svg.innerHTML = h;
  svg.querySelectorAll('g[data-id]').forEach(g => g.onclick = () => { const id = g.dataset.id; if (nodeById(id).kind !== 'relay') return;
    S.relaysDown.has(id) ? S.relaysDown.delete(id) : S.relaysDown.add(id); S.meshStats.re++; renderMeshStats(); drawLinks(); drawMesh(); logLine(`Relay ${id} ${S.relaysDown.has(id) ? 'FAILED (missed 3 beacons)' : 'restored'} · routes recomputed`);
    const p = routeFrom(nodeById('N2').lat, nodeById('N2').lon); if (p) meshPacket(p); refresh(); }); }
function meshPacket(path) { if (!$('#mesh').classList.contains('on')) return; drawMesh(path); const g = svg.querySelector('#pk'); const pts = path.map(id => nodeById(id));
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', 8); c.setAttribute('fill', '#fff'); c.setAttribute('filter', 'drop-shadow(0 0 8px #39d0ff)'); g.appendChild(c);
  let t = 0; const step = () => { t += .025; const s = Math.floor(t); if (s >= pts.length - 1) { c.remove(); return; } const a = pts[s], b = pts[s + 1], f = t - s;
    c.setAttribute('cx', sx(a.lon) + (sx(b.lon) - sx(a.lon)) * f); c.setAttribute('cy', sy(a.lat) + (sy(b.lat) - sy(a.lat)) * f); requestAnimationFrame(step); }; step(); }
function renderMeshStats() { $('#mDel').textContent = S.meshStats.del; $('#mRe').textContent = S.meshStats.re; $('#mDup').textContent = S.meshStats.dup; const h = S.meshStats.hops; $('#mHops').textContent = h.length ? (h.reduce((a, b) => a + b, 0) / h.length).toFixed(1) : '–'; }
drawMesh(); setInterval(() => { if ($('#mesh').classList.contains('on') && !S.running) { const n = ['N1', 'N2', 'N3', 'N4'][Math.floor(Math.random() * 4)]; const p = routeFrom(nodeById(n).lat, nodeById(n).lon); if (p) meshPacket(p); } }, 2500);

/* ================= QUANTUM QAOA ================= */
const NQ = 8, KQ = 3;
function circuitHTML(stage) { let h = '<svg viewBox="0 0 900 120" width="100%" height="120">'; for (let q = 0; q < NQ; q++) { const y = 10 + q * 13.5; h += `<line x1="40" y1="${y}" x2="880" y2="${y}" stroke="#24476a"/><text x="6" y="${y + 4}" fill="#8b9ab0" font-size="10" font-family="JetBrains Mono">q${q}</text>`; }
  const blocks = [['H', 60, '#39d0ff'], ['e^-iγC', 220, '#ff8a1f'], ['e^-iβX', 470, '#a78bfa'], ['M', 760, '#2fe08a']];
  blocks.forEach(([t, x, c], i) => { const on = stage >= i; h += `<rect x="${x}" y="2" width="${i === 1 || i === 2 ? 180 : 70}" height="114" rx="8" fill="${on ? c : '#101a2a'}" opacity="${on ? .9 : 1}" stroke="${c}"/><text x="${x + (i === 1 || i === 2 ? 90 : 35)}" y="64" text-anchor="middle" fill="${on ? '#04070d' : c}" font-size="16" font-weight="800" font-family="Sora">${t}</text>`; });
  return h + '</svg>'; }
$('#circuit').innerHTML = circuitHTML(-1);
function qProblem() { // candidate sites = top heat cells (or zone centres), clusters = open messages
  const open = S.msgs.filter(m => m.state !== 'DISPATCHED'); let clusters;
  if (open.length >= 4) { const g = new Map(); open.forEach(m => { const p = D.toXZ(m.loc.lat, m.loc.lon), k = cellKey(p.x, p.z); const c = g.get(k) || { ...cellCenter(k), w: 0 }; c.w += (m.people || 1) * (m.prio === 0 ? 2 : 1); g.set(k, c); }); clusters = [...g.values()]; }
  else clusters = ZONES.map(a => ({ ...D.toXZ(a.lat, a.lon), w: Math.round(a.risk * 10) }));
  const sorted = [...clusters].sort((a, b) => b.w - a.w); const sites = [];
  for (const c of sorted) { if (sites.length >= NQ) break; const s = { x: c.x + (Math.random() - .5) * 1.5, z: c.z + (Math.random() - .5) * 1.5 }; if (sites.every(o => Math.hypot(o.x - s.x, o.z - s.z) > 2.2)) sites.push(s); }
  while (sites.length < NQ) sites.push({ x: (Math.random() - .5) * 26, z: (Math.random() - .5) * 20 });
  return { sites, clusters }; }
let qRunning = false;
$('#btnQAOA').onclick = async () => { if (qRunning) return; qRunning = true; $('#btnDeploy').disabled = true;
  const { sites, clusters } = qProblem(); const pb = buildProblem(sites, clusters, KQ, 5.5);
  const land = $('#land').getContext('2d'), G = 30, W = 300, H = 230; land.clearRect(0, 0, W, H);
  $('#circuit').innerHTML = circuitHTML(0); await sleep(350); $('#circuit').innerHTML = circuitHTML(1); await sleep(250);
  let best = { e: 9, g: 0, b: 0 }; const Es = [];
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const g = i / (G - 1), b = j / (G - 1) * Math.PI; const e = cvar(pb, qaoaState(pb, [g], [b])); Es.push(e); if (e < best.e) best = { e, g, b }; }
  const eMin = Math.min(...Es), eMax = Math.max(...Es);
  for (let i = 0; i < G; i++) { for (let j = 0; j < G; j++) { const e = Es[i * G + j]; land.fillStyle = '#' + ramp(1 - (e - eMin) / (eMax - eMin || 1)).getHexString(); land.fillRect(i * W / G, H - (j + 1) * H / G, W / G + 1, H / G + 1); }
    $('#circuit').innerHTML = circuitHTML(i % 2 ? 1 : 2); await sleep(28); }
  land.strokeStyle = '#fff'; land.lineWidth = 2; land.beginPath(); land.arc(best.g * (W - W / G) + W / G / 2, H - (best.b / Math.PI * (H - H / G) + H / G / 2), 8, 0, 7); land.stroke();
  land.fillStyle = '#e8eef7'; land.font = '11px JetBrains Mono'; land.fillText('γ →', W - 30, H - 6); land.fillText('β ↑', 4, 12);
  const gs = [best.g], bs = [best.b];
  $('#circuit').innerHTML = circuitHTML(3); const p = qaoaState(pb, gs, bs);
  // measure: 1024 shots, evaluate each sampled bitstring classically, keep the best
  const SH = 1024, cnts = sample(p, SH); const order = [...cnts.keys()].sort((x, y) => cnts.get(y) - cnts.get(x)).slice(0, 14);
  if (cnts.has(pb.best) && !order.includes(pb.best)) order[order.length - 1] = pb.best;
  let bestS = [...cnts.keys()].reduce((a, z) => pb.cost[z] < pb.cost[a] ? z : a);
  const hc = $('#hist').getContext('2d'), HW2 = 360, HH2 = 230;
  for (let f = 1; f <= 20; f++) { hc.clearRect(0, 0, HW2, HH2); const mx = cnts.get(order[0]); order.forEach((z, i) => { const h = (cnts.get(z) / mx) * (HH2 - 52) * f / 20, x = 10 + i * 24.5; const opt = z === bestS;
      hc.fillStyle = opt ? '#a78bfa' : '#2bd4c4'; hc.globalAlpha = opt ? 1 : .5; hc.fillRect(x, HH2 - 32 - h, 18, h); hc.globalAlpha = 1;
      if (opt) { hc.fillStyle = '#fff'; hc.font = '10px Sora'; hc.fillText('best', x - 2, HH2 - 36 - h); }
      hc.save(); hc.translate(x + 13, HH2 - 3); hc.rotate(-Math.PI / 2); hc.fillStyle = opt ? '#fff' : '#8b9ab0'; hc.font = '9px JetBrains Mono'; hc.fillText(z.toString(2).padStart(NQ, '0'), 0, 0); hc.restore(); }); await sleep(30); }
  hc.fillStyle = '#8b9ab0'; hc.font = '11px Sora'; hc.fillText(`${SH} shots · top outcomes`, HW2 - 150, 14);
  const optSet = [...pb.cost.keys()].filter(z => pb.cost[z] <= pb.cost[pb.best] + 1e-9); const chosen = bits(bestS, NQ).map((v, i) => v ? i : -1).filter(i => i >= 0), cov = pb.value[bestS] / pb.total * 100, match = pb.cost[bestS] <= pb.cost[pb.best] + 1e-9, amp = optSet.reduce((a, z) => a + p[z], 0) * pb.N / optSet.length, optHits = optSet.reduce((a, z) => a + (cnts.get(z) || 0), 0);
  $('#qResult').className = 'qres'; $('#qResult').innerHTML = `CVaR-QAOA (p = 1, ${SH} shots) proposes relays at sites <b>${chosen.join(', ')}</b> → covers <b>${cov.toFixed(0)}%</b> of reported people. Exact search over all ${pb.N} options: <b>${match ? 'same optimum ✓' : 'not reached (re-run)'}</b>. The best answer's probability was amplified <b>${amp.toFixed(1)}×</b> over random guessing; optimal answers appeared <b>${optHits}</b> times in ${SH} shots.<br><span class="muted" style="font-size:13px">8 qubits · statevector simulation in-browser (same maths as Qiskit Aer) · sample, then evaluate classically, as QAOA is used in practice · no speed-up claimed at this size.</span>`;
  S.plan = { sites, chosen }; $('#btnDeploy').disabled = false; qRunning = false; logLine(`QAOA relay plan · sites ${chosen.join(',')} · ${match ? 'matches exact' : 'near-optimal'}`); };
$('#btnDeploy').onclick = () => { planGroup.clear(); S.plan.sites.forEach((s, i) => { const on = S.plan.chosen.includes(i); const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(on ? 5.3 : .4, on ? 5.5 : .5, 64), new THREE.MeshBasicMaterial({ color: on ? 0xa78bfa : 0x445566, transparent: true, opacity: on ? .5 : .6, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .08; g.userData.ring = ring;
    g.add(ring); if (on) { const p = new THREE.Mesh(new THREE.OctahedronGeometry(.45), new THREE.MeshBasicMaterial({ color: 0xa78bfa })); p.position.y = 3.2; g.add(p); const l = addLabel('⚛ QAOA relay', s.x, 4, s.z, 'lbl q'); planGroup.add(l); }
    g.position.set(s.x, 0, s.z); planGroup.add(g); }); openTab('situation'); flyTo(1, 0, 30); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

refresh(true); renderResources(); logLine('VOID-NAV Command ready · waiting for SOS');
window.VOIDNAV = { ingest, S }; // debug / manual injection

// test / kiosk hooks: ?autosim=1&tab=inbox
{ const q = new URLSearchParams(location.search); if (q.get('autosim')) { S.muted = true; startSim(); const n = +(q.get('n') || 0); for (let i = 0; i < n; i++) simMessage(); }
  if (q.get('tab')) setTimeout(() => openTab(q.get('tab')), 300); if (q.get('qaoa')) setTimeout(() => $('#btnQAOA').click(), 600); if (q.get('open')) setTimeout(() => select(S.msgs.find(m => m.prio === 0)?.id), 500); }

addEventListener('load', () => dispatchEvent(new Event('resize')));
