import * as Q from './qaoa.js';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const PC = ['var(--red)', 'var(--org)', 'var(--yel)'], PL = ['CRITICAL', 'URGENT', 'INFO'];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const post = (u, b = {}) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
const S = { msgs: new Map(), seq: 0, sel: null, link: true, mode: 'EMULATED', muted: false, started: false, read: new Set() };

/* ---------- tabs / clock ---------- */
$$('#nav button').forEach(b => b.onclick = () => { $$('#nav button').forEach(x => x.classList.toggle('on', x === b)); $$('.tab').forEach(t => t.classList.toggle('on', t.id === b.dataset.t)); if (b.dataset.t === 'map') setTimeout(initMap, 30); });
setInterval(() => $('#clock').textContent = new Date().toLocaleTimeString('en-IN', { hour12: false }), 1000);
$('#go').onclick = () => { S.started = true; $('#sound').remove(); audio(); };
$('#mute').onclick = () => { S.muted = !S.muted; $('#mute').textContent = S.muted ? '🔇' : '🔊'; };

/* ---------- sound + voice (critical only) ---------- */
let ac;
const audio = () => { try { ac = ac || new AudioContext(); } catch (e) {} return ac; };
function beep(seq) { if (S.muted || !audio()) return; let t = ac.currentTime; seq.forEach(([f, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = f; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); t += d; }); }
const siren = () => beep([[740, .18], [988, .18], [740, .18], [988, .18]]);
function speak(m) { if (S.muted || !('speechSynthesis' in window)) return; const d = m.decoded;
  const u = new SpeechSynthesisUtterance(`Critical SOS. ${d.cat.replace('_', ' ').toLowerCase()}, ${d.people} people${d.bleeding === 'YES' ? ', active bleeding' : ''}. Beacon N1.`); u.lang = 'en-IN'; u.rate = 1.02; speechSynthesis.speak(u); }
setInterval(() => { if ([...S.msgs.values()].some(m => m.prio === 0 && !S.read.has(m.id) && m.state === 'DELIVERED')) beep([[880, .12]]); }, 2500);  // alarm until opened

/* ---------- toasts ---------- */
function toast(html, cls = '') { const t = document.createElement('div'); t.className = 'toast ' + cls; t.innerHTML = html; $('#toasts').prepend(t);
  while ($('#toasts').children.length > 3) $('#toasts').lastChild.remove(); setTimeout(() => t.remove(), 7000); }

/* ---------- server feed ---------- */
async function boot() { const j = await (await fetch('/api/state')).json(); S.seq = j.seq; setLink(j.link, j.mode);
  j.msgs.filter(m => m.state !== 'SENDING' && m.state !== 'FAILED').forEach(m => { S.msgs.set(m.id, m); if (m.state !== 'DELIVERED') S.read.add(m.id); });
  render(); poll(); }
async function poll() { try { const j = await (await fetch('/api/feed?since=' + S.seq, { cache: 'no-store' })).json(); setLink(j.link, j.mode);
    for (const e of j.events) { S.seq = Math.max(S.seq, e.seq); onEvent(e); } } catch (e) { feed('Server not reachable. Is server.py running?'); }
  setTimeout(poll, 700); }
function onEvent(e) { if (e.msg && typeof e.msg === 'string') feed(e.msg);
  if (e.kind === 'sos') { const m = e.msg; S.msgs.set(m.id, m); feed(`<b>SOS ${m.id}</b> landed · P${m.prio} · ${m.decoded.cat}`);
    if (m.prio === 0) { siren(); speak(m); toast(`<small>CRITICAL · BEACON N1 · ${m.live ? 'LIVE · SOS Node1' : 'EMULATED LoRa'}</small><b>${title(m)}</b>${esc(m.note || m.report)}`); }
    else toast(`<small>${PL[m.prio]} · BEACON N1</small><b>${title(m)}</b>${esc(m.note || '')}`, 'info');
    render(); lab(m); drawMapData(); }
  if (e.kind === 'status' || e.kind === 'status_ack' || e.kind === 'status_fail') refresh(e.id);
  if (e.kind === 'clear') { S.msgs.clear(); S.sel = null; render(); }
  if (e.kind === 'node' && e.id) nodeLeds(); }
async function refresh(id) { const j = await (await fetch('/api/state')).json(); j.msgs.forEach(m => { if (S.msgs.has(m.id)) S.msgs.set(m.id, m); }); render(); }
function setLink(up, mode) { const live = mode === 'LIVE'; S.link = up; S.mode = mode; $('#link').classList.toggle('down', !up);
  $('#linkTxt').textContent = live ? (up ? 'SOS Node1 online' : 'SOS Node1 not connected') : (up ? 'LoRa link up' : 'Gateway unplugged');
  $('#modeTag').textContent = live ? 'LIVE NODE' : 'EMULATED'; $('#modeTag').className = 'tag ' + (live ? 't-real' : 't-emu');
  $('#plug').hidden = live; $('#btn').hidden = live; $('#boardTag').textContent = live ? 'LIVE' : 'EMULATED'; $('#boardTag').className = 'tag ' + (live ? 't-real' : 't-emu');
  $('#boardName').textContent = live ? 'SOS Node1 (ESP32 on USB)' : 'Beacon node N1';
  $('#plug').textContent = up ? 'Unplug gateway' : 'Plug gateway back in'; }
$('#plug').onclick = () => post('/api/link', { up: !S.link });
$('#btn').onclick = () => { post('/api/button'); feed('<b>Push button pressed</b> on beacon N1'); };
$('#clear').onclick = () => post('/api/clear');
function feed(t) { const d = document.createElement('div'); d.innerHTML = `<span style="color:var(--dim)">${new Date().toLocaleTimeString('en-IN', { hour12: false })}</span> ${t}`; $('#feed').prepend(d); while ($('#feed').children.length > 60) $('#feed').lastChild.remove(); nodeLeds(); }

/* ---------- beacon LEDs (mirror of node state, from server) ---------- */
async function nodeLeds() { try { const j = await (await fetch('/api/state')).json(); const ms = j.msgs; const last = ms[ms.length - 1];
    const st = last ? last.state : 'IDLE'; const o = $('#lO'), g = $('#lG');
    o.className = 'l org ' + (st === 'SENDING' ? 'fast' : st === 'DELIVERED' ? 'slow' : (st === 'READ' || st === 'DISPATCHED') ? 'solid' : '');
    g.className = 'l grn ' + (st === 'DISPATCHED' ? 'solid' : '');
    $('#ledTxt').textContent = { IDLE: 'Idle · hotspot "VOID-NAV SOS" on', SENDING: `Sending ${last?.id} · try ${last?.tries}/8 · orange fast blink`, DELIVERED: 'Delivered · orange slow blink', READ: 'Read by rescuer · orange solid', DISPATCHED: 'Dispatched · green solid', FAILED: 'Not delivered after 8 tries' }[st]; } catch (e) {} }

/* ---------- inbox ---------- */
const title = m => m.button ? 'Push-button SOS · details unknown' : `${m.decoded.cat.replace('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase())} · ${m.decoded.people} ${m.decoded.people === '1' ? 'person' : 'people'}`;
const dstate = m => m.state === 'DELIVERED' ? 'UNREAD' : m.state;
function render() { const arr = [...S.msgs.values()].sort((a, b) => a.prio - b.prio || b.t - a.t);
  const unread = arr.filter(m => m.state === 'DELIVERED' && !S.read.has(m.id)).length; $('#nUnread').hidden = !unread; $('#nUnread').textContent = unread;
  const ip = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? null : location.host;
  $('#list').innerHTML = arr.length ? arr.map(m => `<div class="card ${S.sel === m.id ? 'sel' : ''} ${m.state === 'DELIVERED' && !S.read.has(m.id) ? 'unread' : ''}" style="--c:${PC[m.prio]}" data-id="${m.id}">
    <div class="r1"><span style="color:${PC[m.prio]}">${PL[m.prio]} · ${m.id}</span><span class="pill s-${dstate(m)}">${dstate(m)}</span></div>
    <div class="r2">${title(m)}</div><div class="r3">${esc(m.note) || esc(m.report)}</div></div>`).join('')
    : `<div class="empty"><b>No SOS yet.</b><br>On the survivor phone (same Wi-Fi / hotspot as this laptop) open<br><code id="phoneUrl">http://&lt;laptop-IP&gt;:8000/</code><br>The exact address is printed in the server window. Or press the beacon push-button →</div>`;
  $$('#list .card').forEach(c => c.onclick = () => open(c.dataset.id));
  detail(); }
function open(id) { S.sel = id; const m = S.msgs.get(id); if (m && m.state === 'DELIVERED' && !S.read.has(id)) { S.read.add(id); post('/api/read', { id }); } render(); }
const FIELDS = [['CAT', 4, '--red'], ['INJ', 2, '--org'], ['BLD', 2, '--org'], ['PPL', 3, '--yel'], ['POS', 3, '--yel'], ['VULN', 4, '--vio'], ['NEEDS', 8, '--cyan'], ['URG', 4, '--red'], ['MIN', 10, '--mut']];
function bits(hex) { let v = BigInt('0x' + hex), out = [], sh = 40; for (const [n, w, c] of FIELDS) { sh -= w; const x = Number((v >> BigInt(sh)) & ((1n << BigInt(w)) - 1n)); out.push(`<span style="--c:var(${c});animation-delay:${out.length * 70}ms">${x.toString(2).padStart(w, '0')}<em>${n}</em></span>`); } return out.join(''); }
function detail() { const m = S.msgs.get(S.sel); const D = $('#detail');
  if (!m) { D.innerHTML = `<div class="empty" style="font-size:16px"><b>Select an SOS.</b><br>Opening a card marks it <b style="color:var(--org)">READ</b> and the survivor's phone is told over LoRa. Dispatch is a separate step.</div>`; return; }
  const d = m.decoded, st = dstate(m), age = Math.round((Date.now() / 1000 - m.t));
  const conf = m.status_confirmed === true ? '<span class="ok">✓ confirmed at node</span>' : m.status_confirmed === false ? '<span style="color:var(--red)">status not confirmed at node</span>' : m.down?.length ? '<span style="color:var(--org)">sending to node…</span>' : '';
  D.innerHTML = `<div class="dt"><div><span class="mono" style="color:${PC[m.prio]};font-size:13px">${PL[m.prio]} ${d.urgency}/15 · SOS ${m.id}</span> <span class="tag ${m.live ? 't-real' : 't-emu'}">${m.live ? 'LIVE · SOS Node1' : 'EMULATED LoRa'}</span>
      <h2>${title(m)}</h2><div class="meta">${m.live ? 'SOS Node1' : 'Beacon N1'} · Musheerabad · ${age < 60 ? age + ' s' : Math.round(age / 60) + ' min'} ago · ${m.lang.toUpperCase()}</div></div><span class="pill s-${st}" style="font-size:13px;padding:6px 12px">${st}</span></div>
    ${m.note ? `<div class="words"><small>SURVIVOR'S OWN WORDS</small>“${esc(m.note)}”</div>` : ''}
    <div class="rep"><small>DECODED FROM 5-BYTE SEMCODE TOKEN</small>${esc(m.report)}</div>
    <div class="kv"><div><label>People</label><b>${d.people}</b></div><div><label>Position</label><b style="font-size:14px">${d.pos.replace('_', ' ')}</b></div><div><label>${m.live ? 'Phone → node Wi-Fi RSSI' : 'RSSI / SNR (emulated)'}</label><b>${m.rssi ?? '—'} <small style="font-size:12px">dBm</small>${m.live ? '' : ' / ' + (m.snr ?? '—')}</b></div><div><label>Hops · try</label><b>${m.hops ?? '—'} · ${m.tries}</b></div></div>
    <div class="mono" style="font-size:12px;color:var(--mut)">TOKEN <span style="color:var(--vio);font-size:15px">${m.token.match(/../g).join(' ')}</span> · ${m.meter.token_bytes} B on air (${m.meter.token_ms} ms) vs ${m.meter.text_bytes} B as text (${m.meter.text_ms} ms)</div>
    <div class="bits">${bits(m.token)}</div>
    <div class="act">${m.state === 'DISPATCHED' ? `<b class="ok">✓ Dispatched: ${esc(m.team)}</b>` : `<select id="team"><option>NDRF Team 2</option><option>GHMC DRF Team 1</option><option>Fire & Emergency Unit 4</option><option>108 Ambulance TS-108-021</option></select><button class="pri" id="disp">Dispatch</button>`}</div>
    <div class="act"><input id="rtxt" maxlength="120" placeholder="Reply to survivor (sent over LoRa)"><button id="rsend">Send reply</button>
      <button class="qr">Team arriving in 10 min, stay where you are</button><button class="qr">Bang on a pipe or wall every 5 minutes</button></div>
    <div class="leds">Survivor's beacon: <span><i class="led ${['READ', 'DISPATCHED'].includes(m.state) ? 'o' : ''}"></i>READ</span><span><i class="led ${m.state === 'DISPATCHED' ? 'g' : ''}"></i>DISPATCHED</span> ${conf}</div>
    ${m.replies?.length ? `<div style="margin-top:10px;color:var(--mut);font-size:13px">Replies delivered: ${m.replies.map(r => '“' + esc(r.text) + '”').join(' · ')}</div>` : ''}`;
  const dp = $('#disp'); if (dp) dp.onclick = () => post('/api/dispatch', { id: m.id, text: $('#team').value }).then(() => refresh());
  const rs = text => text && post('/api/reply', { id: m.id, text }).then(() => { toast(`<small>REPLY QUEUED FOR ${m.id}</small><b>${esc(text)}</b>`, 'info'); refresh(); });
  $('#rsend').onclick = () => { rs($('#rtxt').value.trim()); $('#rtxt').value = ''; };
  $$('.qr').forEach(b => b.onclick = () => rs(b.textContent)); }

/* ---------- map ---------- */
let map, heatL, pinL;
const NODE_LL = [17.4127, 78.5083];
async function initMap() { if (map) { map.invalidateSize(); drawMapData(); return; }
  const { GEO } = await import('./lib/geo.js'); const Z = await import('./lib/zone.js');
  map = L.map('mapEl', { zoomSnap: .25, zoomControl: false, attributionControl: true }); L.control.zoom({ position: 'topright' }).addTo(map);
  // street layers need internet (no API key). Ward boundaries below are bundled and always work offline.
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'darktiles', attribution: '© OpenStreetMap contributors' });
  const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: 'Tiles © Esri' });
  const esriLbl = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, pane: 'overlayPane' });
  let errs = 0, ok = 0; osm.on('tileload', () => ok++); osm.on('tileerror', () => { if (++errs > 6 && !ok && map.hasLayer(osm)) { map.removeLayer(osm); esri.addTo(map); esriLbl.addTo(map); $('#mapNote').textContent = 'Street map: Esri (OpenStreetMap unreachable).'; } });
  osm.addTo(map);
  L.control.layers({ 'Street map (OpenStreetMap)': osm, 'Dark street map (Esri)': esri, 'Offline: wards only': L.layerGroup() }, null, { position: 'topright' }).addTo(map);
  GEO.ghmc.forEach(w => L.polygon(w.c.map(c => [c[1], c[0]]), { color: '#43c6ff', weight: .8, opacity: .5, fillOpacity: 0, interactive: false }).addTo(map));
  const zl = L.featureGroup(GEO.zone.map(w => L.polygon(w.c.map(c => [c[1], c[0]]), { color: '#43c6ff', weight: 2.5, fillColor: '#43c6ff', fillOpacity: .07 })
    .bindTooltip(w.n.replace(/^ward\s*\d+\s*/i, '').replace(/^\d+\s*/, ''), { permanent: true, direction: 'center', className: 'wl' }))).addTo(map);
  Z.HOSPITALS.forEach(h => L.marker([h.lat, h.lon], { icon: L.divIcon({ className: '', html: `<div class="hpin"><b>✚</b><span>${h.name}</span></div>`, iconSize: [0, 0] }) }).addTo(map));
  map.fitBounds(zl.getBounds(), { paddingTopLeft: [340, 30], paddingBottomRight: [30, 30] });
  heatL = L.layerGroup().addTo(map); pinL = L.layerGroup().addTo(map);
  L.marker(NODE_LL, { icon: L.divIcon({ className: '', html: '<div class="npin"><b></b><span id="npinTxt">SOS Node1</span></div>', iconSize: [0, 0] }), zIndexOffset: 1000 }).addTo(map);
  drawMapData(); }
function drawMapData() { mapCount(); if (!map) return; heatL.clearLayers(); const ms = [...S.msgs.values()];
  const ppl = ms.reduce((a, m) => a + (m.people_n || 1), 0), crit = ms.filter(m => m.prio === 0).length;
  if (ms.length) [600, 380, 200].forEach((r, i) => L.circle(NODE_LL, { radius: r, stroke: false, fillColor: ['#f6d04d', '#ff9f1c', '#ff3b5c'][i], fillOpacity: Math.min(.45, .12 + ppl * .015 + crit * .03), interactive: false }).addTo(heatL));
  L.circle(NODE_LL, { radius: 120, color: '#43c6ff', weight: 1, dashArray: '4 6', fill: false, interactive: false }).bindTooltip('SOS Node1 Wi-Fi reach (~30–100 m)').addTo(heatL); }
function mapCount() { const ms = [...S.msgs.values()], n = ms.length, ppl = ms.reduce((a, m) => a + (m.people_n || 1), 0), crit = ms.filter(m => m.prio === 0).length;
  $('#mapCount').innerHTML = `<b style="color:var(--fg);font-size:22px">${n}</b> SOS · <b style="color:var(--red)">${crit}</b> critical · ~${ppl} people`;
  const t = $('#npinTxt'); if (t) t.textContent = `SOS Node1 · ${n} SOS · ~${ppl} people`; }

/* ---------- lab · semantic meter ---------- */
function lab(m) { const r = m ? m.meter : { text_bytes: 102, token_bytes: 15, text_ms: 554, token_ms: 164.9 };
  const rows = [['As free text', r.text_bytes, r.text_ms, 'var(--org)'], ['SemCode token', r.token_bytes, r.token_ms, 'var(--grn)']];
  $('#meter').innerHTML = rows.map(([n, b, ms, c]) => `<div class="mrow"><span>${n}<br><span class="mono" style="color:var(--mut)">${b} bytes</span></span><div class="mbar"><i style="background:${c}" data-w="${Math.min(100, ms / Math.max(r.text_ms, 1) * 100)}"></i></div><b class="mono">${ms} ms</b></div>`).join('')
    + `<div style="font-size:12px;color:var(--mut)">${m ? 'Latest SOS ' + m.id + ': “' + esc(m.meter.words.slice(0, 90)) + '…”' : 'Playbook example. Send an SOS to measure yours.'}</div>`;
  requestAnimationFrame(() => $$('#meter .mbar i').forEach(i => i.style.width = i.dataset.w + '%'));
  $('#mSave').textContent = '−' + Math.round((1 - r.token_ms / r.text_ms) * 100) + '%'; $('#mBytes').textContent = `${r.text_bytes}→${r.token_bytes}`; $('#mCap').textContent = (r.text_ms / r.token_ms).toFixed(1) + '×'; }
lab();

/* ---------- lab · self-healing simulator (rules of sim/selfheal.py) ---------- */
const NODES = { S: [60, 300], G: [940, 300], R1: [250, 380], R2: [250, 200], R3: [450, 420], R4: [450, 180], R5: [650, 400], R6: [650, 200], R7: [450, 300], R8: [800, 300] };
const RANGE = 260, BEACON = 30, EXPIRE = 90, SOS_EVERY = 20, HOP = .3, ACKT = 2, SPEED = 40, TEND = 2400;
const lk = (a, b) => Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1]) <= RANGE;
let H;
function hReset() { const ids = Object.keys(NODES); H = { t: 0, alive: Object.fromEntries(ids.map(n => [n, true])), hops: Object.fromEntries(ids.map(n => [n, n === 'G' ? 0 : 99])),
    heard: Object.fromEntries(ids.map(n => [n, {}])), nb: Object.fromEntries(ids.map(n => [n, Math.random() * BEACON])), msgs: [], sent: 0, del: 0, fixPath: null, fix: [], fixDel: 0, killed: [], running: false, nextSos: 5, ev: [[600, 'kill'], [1200, 'kill'], [1700, 'revive']], flash: [] };
  hDraw(); }
function curPath() { const p = ['S']; let c = 'S', g = 0; while (c !== 'G' && g++ < 12) { const live = Object.entries(H.heard[c]).filter(([m, [ts]]) => H.t - ts <= EXPIRE && H.alive[c]); const nx = live.filter(([m, [, h]]) => h < H.hops[c]).sort((a, b) => a[1][1] - b[1][1])[0]; if (!nx) return null; c = nx[0]; p.push(c); } return c === 'G' ? p : null; }
function hStep(dt) { H.t += dt; const t = H.t;
  H.ev = H.ev.filter(([et, k]) => { if (t < et) return true; if (k === 'kill') { const p = curPath() || []; const v = p.find(n => n !== 'S' && n !== 'G' && H.alive[n]); if (v) { H.alive[v] = false; H.killed.push(v); feedH(`${v} destroyed`); } }
    else if (H.killed.length) { const v = H.killed.shift(); H.alive[v] = true; feedH(`${v} back online`); } return false; });
  for (const n in NODES) if (H.alive[n] && t >= H.nb[n]) { H.nb[n] = t + BEACON + (Math.random() * 10 - 5); for (const m in NODES) if (m !== n && H.alive[m] && lk(n, m)) H.heard[m][n] = [t, H.hops[n]]; }
  for (const n in NODES) { if (n === 'G' || !H.alive[n]) continue; const live = Object.entries(H.heard[n]).filter(([, [ts]]) => t - ts <= EXPIRE); H.heard[n] = Object.fromEntries(live); H.hops[n] = live.length ? 1 + Math.min(...live.map(([, [, h]]) => h)) : 99; }
  if (!H.fixPath && t > 61) H.fixPath = curPath();
  if (t >= H.nextSos) { H.nextSos += SOS_EVERY; H.sent++; H.msgs.push({ at: 'S', busy: 0, born: t, x: NODES.S[0], y: NODES.S[1] }); if (H.fixPath) H.fix.push({ i: 0, busy: 0 }); }
  for (const m of H.msgs) { if (m.busy > t) continue; if (m.to) { if (H.alive[m.to]) { m.at = m.to; } else { delete H.heard[m.at][m.to]; } m.to = null; }
    if (m.at === 'G') { m.done = true; H.del++; continue; }
    const live = Object.entries(H.heard[m.at] || {}).filter(([, [ts, h]]) => t - ts <= EXPIRE && h < H.hops[m.at]).sort((a, b) => a[1][1] - b[1][1]);
    if (!live.length || !H.alive[m.at]) continue;            // store and carry
    m.to = live[0][0]; m.busy = t + (H.alive[m.to] ? HOP : ACKT); }
  H.msgs = H.msgs.filter(m => !m.done);
  if (H.fixPath) for (const f of H.fix) { if (f.busy > t) continue; const nx = H.fixPath[f.i + 1]; if (!nx) continue; if (H.alive[nx]) { f.i++; f.busy = t + HOP; if (nx === 'G') { f.done = true; H.fixDel++; } } }
  H.fix = H.fix.filter(f => !f.done); }
function feedH(s) { H.flash.push({ s, t: H.t }); }
function hDraw() { const sv = $('#heal'); const p = curPath() || []; const pe = new Set(p.slice(1).map((n, i) => p[i] + n));
  let s = ''; const ids = Object.keys(NODES);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = ids[i], b = ids[j]; if (!lk(a, b)) continue; const on = pe.has(a + b) || pe.has(b + a), dead = !H.alive[a] || !H.alive[b];
    s += `<line x1="${NODES[a][0]}" y1="${NODES[a][1]}" x2="${NODES[b][0]}" y2="${NODES[b][1]}" stroke="${dead ? '#3a1c26' : on ? '#43c6ff' : '#22304a'}" stroke-width="${on ? 5 : 2}" ${dead ? 'stroke-dasharray="6 6"' : ''}/>`; }
  for (const m of H.msgs) { const a = NODES[m.at], b = m.to ? NODES[m.to] : a, k = m.to ? Math.min(1, 1 - (m.busy - H.t) / HOP) : 0; const x = a[0] + (b[0] - a[0]) * Math.max(0, k), y = a[1] + (b[1] - a[1]) * Math.max(0, k);
    s += `<circle cx="${x}" cy="${y - 26}" r="8" fill="#ff3b5c"/>`; }
  const q = H.msgs.filter(m => m.at === 'S' && !m.to).length;
  for (const n of ids) { const [x, y] = NODES[n], al = H.alive[n], col = n === 'S' ? '#ff9f1c' : n === 'G' ? '#2fe08a' : '#43c6ff';
    s += `<g data-n="${n}" style="cursor:${n[0] === 'R' ? 'pointer' : 'default'}"><circle cx="${x}" cy="${y}" r="${n.length === 1 ? 30 : 24}" fill="${al ? '#0d1420' : '#2a0d14'}" stroke="${al ? col : '#ff3b5c'}" stroke-width="3"/>
      <text x="${x}" y="${y + 6}" text-anchor="middle" font-size="18" font-weight="700" fill="${al ? '#eef3fc' : '#ff3b5c'}">${al ? n : '✕'}</text>
      <text x="${x}" y="${y + 50}" text-anchor="middle" font-size="13" fill="#8b9ab2">${n === 'S' ? 'survivor node' : n === 'G' ? 'gateway' : H.hops[n] < 99 ? H.hops[n] + ' hops' : 'no route'}</text></g>`; }
  if (q > 1) s += `<text x="60" y="230" text-anchor="middle" font-size="14" fill="#ff9f1c">${q} stored</text>`;
  const fl = H.flash.filter(f => H.t - f.t < 120).slice(-1)[0]; if (fl) s += `<text x="500" y="500" text-anchor="middle" font-size="20" font-weight="700" fill="#ff3b5c">${fl.s} · t = ${Math.round(fl.t)} s</text>`;
  sv.innerHTML = s; sv.querySelectorAll('g[data-n]').forEach(g => g.onclick = () => { const n = g.dataset.n; if (n[0] !== 'R') return; H.alive[n] = !H.alive[n]; feedH(`${n} ${H.alive[n] ? 'revived' : 'destroyed'} (manual)`); hDraw(); });
  $('#hHeal').textContent = `${H.del} / ${H.sent}`; $('#hFix').textContent = `${H.fixDel} / ${H.sent}`; $('#hQ').textContent = H.msgs.length; $('#hClock').textContent = `t = ${Math.round(H.t)} s / ${TEND} s`; }
let hLast = 0;
function hLoop(ts) { if (!H.running) return; const dt = Math.min(.1, (ts - (hLast || ts)) / 1000) * SPEED; hLast = ts; for (let k = 0; k < 8; k++) hStep(dt / 8); hDraw(); if (H.t >= TEND) { H.running = false; $('#hRun').textContent = '▶ Run again'; return; } requestAnimationFrame(hLoop); }
$('#hRun').onclick = () => { if (H.t >= TEND) hReset(); H.running = !H.running; $('#hRun').textContent = H.running ? '⏸ Pause' : '▶ Resume'; hLast = 0; if (H.running) requestAnimationFrame(hLoop); };
$('#hReset').onclick = () => { hReset(); $('#hRun').textContent = '▶ Run 40-minute scenario'; };
hReset();

/* ---------- lab · QAOA ---------- */
const P = Q.setup(); let qRes = null;
function qMap(chosen = []) { const d = Q.DEMO; let s = '';
  chosen.forEach(i => s += `<circle cx="${d.sites[i][0]}" cy="${1000 - d.sites[i][1]}" r="0" fill="rgba(169,145,255,.10)" stroke="#a991ff" stroke-width="3" stroke-dasharray="10 8"><animate attributeName="r" to="${d.radius_m}" dur=".9s" fill="freeze"/></circle>`);
  const cov = new Set(chosen.flatMap(i => [...P.cov[i]]));
  d.clusters.forEach(([x, y, w], j) => s += `<circle cx="${x}" cy="${1000 - y}" r="${10 + w * 2.6}" fill="${cov.has(j) ? '#2fe08a' : '#ff3b5c'}" fill-opacity=".75"/><text x="${x}" y="${1000 - y + 6}" text-anchor="middle" font-size="18" font-weight="700" fill="#06101a">${w}</text>`);
  d.sites.forEach(([x, y], i) => { const on = chosen.includes(i); s += `<rect x="${x - 20}" y="${1000 - y - 20}" width="40" height="40" rx="6" fill="${on ? '#a991ff' : '#121b2b'}" stroke="${on ? '#fff' : '#5d6b82'}" stroke-width="3"/><text x="${x}" y="${1000 - y + 7}" text-anchor="middle" font-size="20" font-weight="700" fill="${on ? '#0b0620' : '#8b9ab2'}">${i}</text>`; });
  $('#qmap').innerHTML = s; }
function qCirc(active = -1) { let s = ''; for (let q = 0; q < 8; q++) s += `<line x1="40" y1="${20 + q * 28}" x2="510" y2="${20 + q * 28}" stroke="#22304a"/><text x="4" y="${25 + q * 28}" font-size="12" fill="#8b9ab2">q${q}</text>`;
  const blk = (x, w, c, t, on) => `<rect x="${x}" y="8" width="${w}" height="220" rx="6" fill="${c}" opacity="${on ? 1 : .28}"/><text x="${x + w / 2}" y="122" text-anchor="middle" font-size="12" font-weight="700" fill="#06101a" transform="rotate(-90 ${x + w / 2} 118)">${t}</text>`;
  s += blk(46, 34, '#43c6ff', 'Dicke |K=3⟩', active >= 0);
  for (let l = 0; l < 3; l++) { s += blk(92 + l * 132, 56, '#ff9f1c', `cost e^-iγ${l + 1}H`, active > l * 2); s += blk(154 + l * 132, 56, '#a991ff', `XY mixer β${l + 1}`, active > l * 2 + 1); }
  s += blk(486, 24, '#2fe08a', 'measure', active >= 7); $('#qcirc').innerHTML = s; }
function qHist(st) { const top = st.top.slice(0, 10), mx = top[0][1]; let s = '';
  top.forEach(([b, c], i) => { const h = c / mx * 150, x = 10 + i * 51, opt = P.pplOf[b] === P.bestP; s += `<rect x="${x}" y="${170 - h}" width="40" height="${h}" rx="4" fill="${opt ? '#a991ff' : '#2b5f7f'}"><animate attributeName="height" from="0" to="${h}" dur=".8s"/><animate attributeName="y" from="170" to="${170 - h}" dur=".8s"/></rect>
    <text x="${x + 20}" y="${165 - h}" text-anchor="middle" font-size="11" fill="#eef3fc">${(c / st.shots * 100).toFixed(1)}%</text><text x="${x + 20}" y="190" text-anchor="middle" font-size="11" fill="#8b9ab2">${P.chosenOf(b).join('')}</text><text x="${x + 20}" y="206" text-anchor="middle" font-size="10" fill="${opt ? '#cbbcff' : '#5d6b82'}">${P.pplOf[b]}p</text>`; });
  $('#qhist').innerHTML = s; }
qMap(); qCirc();
$('#qRun').onclick = async () => { $('#qRun').disabled = true; const ref = qRes || await (await fetch('data/qaoa_result.json')).json(); qRes = ref;
  $('#qStat').textContent = 'Preparing Dicke state…'; qMap(); $('#proof').innerHTML = '';
  for (let a = 0; a <= 7; a++) { qCirc(a); $('#qStat').textContent = a === 0 ? 'Dicke state: every plan with exactly 3 relays' : a < 7 ? `Layer ${Math.ceil(a / 2)}: ${a % 2 ? 'cost (RZ + RZZ)' : 'XY mixer (RXX + RYY ring)'}` : 'Measuring 8,192 shots'; await new Promise(r => setTimeout(r, 330)); }
  const t0 = performance.now(); const prob = Q.run(P, ref.qaoa.gammas, ref.qaoa.betas); const st = Q.stats(P, prob); const ms = performance.now() - t0;
  qHist(st); qMap(st.mostFrequent); const got = P.people(st.mostFrequent);
  $('#qStat').textContent = `Done · 256-amplitude statevector in ${ms.toFixed(0)} ms`;
  const row = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
  $('#proof').innerHTML = row('QAOA most frequent plan', `sites ${st.mostFrequent.join(', ')}`) + row('People covered', `${got} / ${P.total}`)
    + row('Brute force optimum (56 plans)', `${P.bestP} people <span class="ok">${got === P.bestP ? '✓ match' : '✗'}</span>`)
    + row('P(optimum) QAOA, live', `<span style="color:var(--vio)">${(st.pOpt * 100).toFixed(1)}%</span>`) + row('P(optimum) random valid plan', `${(st.pRandValid * 100).toFixed(1)}%`)
    + row('Advantage over chance', `<span class="ok">${(st.pOpt / st.pRandValid).toFixed(1)}×</span>`) + row('Samples with exactly 3 relays', `${(st.pValid * 100).toFixed(0)}%`)
    + row('Expected coverage', `${(st.expRatio * 100).toFixed(1)}% vs ${(st.randRatio * 100).toFixed(1)}% random`)
    + row('Qiskit Aer reference run', `${(ref.qaoa.p_optimum * 100).toFixed(1)}% · depth ${ref.qaoa.circuit_depth}`)
    + `<div style="display:block;color:var(--mut);font-size:12px;line-height:1.5">No speed-up claimed: brute force solves 56 plans in ${P.tBrute.toFixed(2)} ms. The value is a verified formulation that scales: 100 sites, K = 10 is 1.7 × 10¹³ plans.</div>`;
  $('#qRun').disabled = false; };

boot();
