// admin.js — Recurso Musical Admin Panel
const API = '/api/api';
let _token = null, _username = 'Admin';
let _allTuts = [], _allCans = [], _allMts = [];
let _chartCats = null, _chartDoughnut = null;
let _mtModal = { pistas: [], id: null };
const PISTA_TIPOS = ['master','click','guia','bateria','bajo','guitarra','piano','cuerdas','vientos','coros'];

// ── TOKEN ────────────────────────────────────────────────────
function getToken() { return _token || (_token = localStorage.getItem('rm_admin_token')); }
function setToken(t) { _token = t; localStorage.setItem('rm_admin_token', t); }
function clearToken() { _token = null; localStorage.removeItem('rm_admin_token'); }

// ── API ──────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const tok = getToken();
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (tok) headers['X-RM-Token'] = tok;
  Object.assign(headers, opts.headers || {});
  const res = await fetch(API + path, { ...opts, headers });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error('Respuesta inválida: ' + text.slice(0, 120)); }
}

// ── AUTH ─────────────────────────────────────────────────────
async function doLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  btn.textContent = 'Entrando...'; btn.disabled = true;
  try {
    const d = await apiFetch('?action=login', { method: 'POST', body: JSON.stringify({ username: user, password: pass }) });
    if (d.ok) {
      setToken(d.token);
      _username = d.username || user;
      localStorage.setItem('rm_username', _username);
      showApp();
    } else { showLoginErr(d.error || 'Credenciales incorrectas'); }
  } catch (e) { showLoginErr(e.message); }
  btn.textContent = 'ENTRAR'; btn.disabled = false;
}

function showLoginErr(msg) {
  document.getElementById('loginErrorMsg').textContent = msg;
  document.getElementById('loginError').style.display = 'flex';
}

function togglePwd() {
  const inp = document.getElementById('loginPass');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function doLogout() {
  try { await apiFetch('?action=logout'); } catch {}
  clearToken(); localStorage.removeItem('rm_username');
  location.reload();
}

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.querySelector('.layout').style.display = 'flex';
  setUserUI(_username);
  setDashDate();
  goTo('dashboard', document.querySelector('[data-page=dashboard]'));
  loadAll();
}

function setUserUI(name) {
  const initial = (name || 'A')[0].toUpperCase();
  ['userAvatarTop','userMenuAvatar'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = initial; });
  ['userNameTop','userMenuName','welcomeName'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = name; });
}

function setDashDate() {
  const e = document.getElementById('dashDate');
  if (e) e.textContent = new Date().toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

// ── NAVIGATION ───────────────────────────────────────────────
function goTo(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-icon').forEach(n => n.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  if (el) el.classList.add('active');
  const titles = { dashboard:'Dashboard', tutoriales:'Tutoriales', nuevo:'Nuevo Tutorial', cancionero:'Cancionero', nuevaCancion:'Nueva Canción', importar:'Importar JSON', multitracks:'Multitracks', config:'Configuración' };
  setText('topTitle', titles[page] || page);
  const newBtn = document.getElementById('topNewBtn');
  if (newBtn) {
    const newMap = { tutoriales:'Nuevo Tutorial', cancionero:'Nueva Canción', multitracks:'Nuevo Multitrack' };
    if (newMap[page]) { newBtn.style.display = 'flex'; setText('topNewTxt', newMap[page]); }
    else newBtn.style.display = 'none';
  }
  if (page === 'tutoriales' && !_allTuts.length) loadTutoriales();
  if (page === 'cancionero' && !_allCans.length) loadCancionero();
  if (page === 'multitracks' && !_allMts.length) loadMultitracks();
}

function topNewAction() {
  const id = document.querySelector('.page.active')?.id || '';
  if (id === 'page-tutoriales') { clearTutForm(); goTo('nuevo', document.querySelector('[data-page=nuevo]')); }
  else if (id === 'page-cancionero') { document.getElementById('canEditId').value = ''; goTo('nuevaCancion', document.querySelector('[data-page=nuevaCancion]')); }
  else if (id === 'page-multitracks') openMtModal();
}

// ── LOAD ALL ─────────────────────────────────────────────────
async function loadAll() {
  await Promise.allSettled([loadTutoriales(), loadCancionero(), loadMultitracks()]);
  updateDashboard();
}

// ── DASHBOARD ────────────────────────────────────────────────
function updateDashboard() {
  const tuts = _allTuts;
  const cans = _allCans;
  const withLetra = cans.filter(c => (c.cancion_letra || '').trim().length > 10);
  const favs = [...tuts, ...cans].filter(t => t.es_favorito == 1);
  const cats = [...new Set(tuts.map(t => t.categoria).filter(Boolean))];
  setText('st-tut', tuts.length);
  setText('st-can', cans.length);
  setText('st-letra', withLetra.length);
  setText('st-favs', favs.length);
  setText('st-cats', cats.length);
  renderRecentTable(tuts.slice(0, 8));
  renderActivityFeed([...tuts, ...cans].slice(0, 8));
  renderCharts(tuts, cans);
}

function renderRecentTable(items) {
  const el = document.getElementById('recentTable');
  if (!el) return;
  if (!items.length) { el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--t3)">Sin tutoriales</div>'; return; }
  el.innerHTML = `<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:10px 16px;font-size:10px;font-weight:700;color:var(--t2);letter-spacing:1px">TÍTULO</th><th style="text-align:left;padding:10px 16px;font-size:10px;font-weight:700;color:var(--t2);letter-spacing:1px">ARTISTA</th><th style="text-align:left;padding:10px 16px;font-size:10px;font-weight:700;color:var(--t2);letter-spacing:1px">CAT</th><th style="text-align:left;padding:10px 16px;font-size:10px;font-weight:700;color:var(--t2);letter-spacing:1px">FECHA</th></tr></thead><tbody>${
    items.map(t => `<tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 16px;font-size:12px;font-weight:600;color:var(--t0)">${esc(t.titulo)}</td><td style="padding:10px 16px;font-size:11px;color:var(--t2)">${esc(t.artista)}</td><td style="padding:10px 16px"><span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:4px;background:var(--acc-dim);color:var(--acc)">${esc(t.categoria||'—')}</span></td><td style="padding:10px 16px;font-size:11px;color:var(--t2)">${esc(t.fecha||'—')}</td></tr>`).join('')
  }</tbody></table>`;
}

function renderActivityFeed(items) {
  const el = document.getElementById('activityFeed');
  if (!el) return;
  el.innerHTML = items.map(t => `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><div style="width:6px;height:6px;border-radius:50%;background:var(--acc);margin-top:5px;flex-shrink:0"></div><div><div style="font-size:12px;font-weight:600;color:var(--t0)">${esc(t.titulo)}</div><div style="font-size:10px;color:var(--t2);margin-top:2px">${esc(t.artista)}</div></div></div>`).join('') || '<div style="color:var(--t3);font-size:12px;text-align:center;padding:16px">Sin actividad</div>';
}

function renderCharts(tuts, cans) {
  const catCounts = {};
  tuts.forEach(t => { const c = t.categoria || 'Otro'; catCounts[c] = (catCounts[c] || 0) + 1; });
  const cats = Object.keys(catCounts), vals = cats.map(c => catCounts[c]);
  const ctx1 = document.getElementById('chartCats');
  if (ctx1 && typeof Chart !== 'undefined') {
    if (_chartCats) _chartCats.destroy();
    _chartCats = new Chart(ctx1, { type:'bar', data:{ labels:cats, datasets:[{ data:vals, backgroundColor:'rgba(124,106,247,0.7)', borderRadius:6, borderSkipped:false }] }, options:{ plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false},ticks:{color:'#8a87a0',font:{size:10}}}, y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#8a87a0',font:{size:10}}} }, responsive:true, maintainAspectRatio:false } });
  }
  const withLetra = cans.filter(c => (c.cancion_letra||'').trim().length > 10).length;
  const without = cans.length - withLetra;
  const ctx2 = document.getElementById('chartDoughnut');
  if (ctx2 && typeof Chart !== 'undefined') {
    if (_chartDoughnut) _chartDoughnut.destroy();
    _chartDoughnut = new Chart(ctx2, { type:'doughnut', data:{ labels:['Con cifrado','Sin cifrado'], datasets:[{ data:[withLetra, without], backgroundColor:['rgba(124,106,247,0.8)','rgba(255,255,255,0.06)'], borderWidth:0 }] }, options:{ plugins:{legend:{display:false}}, cutout:'70%', responsive:true, maintainAspectRatio:false } });
  }
  const legend = document.getElementById('doughnutLegend');
  if (legend) legend.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><div style="width:10px;height:10px;border-radius:3px;background:rgba(124,106,247,0.8)"></div><div><div style="font-size:13px;font-weight:800;color:var(--t0)">${withLetra}</div><div style="font-size:10px;color:var(--t2)">Con cifrado</div></div></div><div style="display:flex;align-items:center;gap:8px"><div style="width:10px;height:10px;border-radius:3px;background:rgba(255,255,255,0.06)"></div><div><div style="font-size:13px;font-weight:800;color:var(--t0)">${without}</div><div style="font-size:10px;color:var(--t2)">Sin cifrado</div></div></div>`;
}

// ── TUTORIALES ───────────────────────────────────────────────
async function loadTutoriales() {
  try {
    const data = await apiFetch('?action=getTutoriales&cat=Todos');
    if (!Array.isArray(data)) throw new Error(data?.error || 'Error');
    _allTuts = data.filter(t => !t.tipo || t.tipo === 'tutorial');
    renderTutorialesTable(_allTuts);
  } catch(e) { setHtml('mainTableWrap', errBox(e.message)); }
}

function setFilter(cat, el) {
  document.querySelectorAll('#page-tutoriales .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderTutorialesTable(cat === 'Todos' ? _allTuts : _allTuts.filter(t => t.categoria === cat));
}

function renderTutorialesTable(tuts) {
  const wrap = document.getElementById('mainTableWrap');
  if (!wrap) return;
  if (!tuts.length) { wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t3);font-size:13px;font-weight:600">Sin tutoriales</div>'; return; }
  wrap.innerHTML = `<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid var(--border)">${['MINIATURA','TÍTULO','ARTISTA','CATEGORÍA','DUR','ACCIONES'].map(h=>`<th style="text-align:left;padding:10px 14px;font-size:10px;font-weight:700;color:var(--t2);letter-spacing:1px">${h}</th>`).join('')}</tr></thead><tbody>${
    tuts.map(t => `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 14px">${t.youtube_id?`<img src="https://i.ytimg.com/vi/${esc(t.youtube_id)}/default.jpg" style="width:64px;height:36px;object-fit:cover;border-radius:4px" onerror="this.style.display='none'"/>`:'—'}</td>
      <td style="padding:8px 14px"><div style="font-size:12px;font-weight:700;color:var(--t0)">${esc(t.titulo)}</div>${t.capo&&t.capo!=='0'?`<span style="font-size:9px;background:var(--teal-dim);color:var(--teal);padding:1px 5px;border-radius:3px;font-weight:700">Capo ${esc(t.capo)}</span>`:''}</td>
      <td style="padding:8px 14px;font-size:11px;color:var(--t2)">${esc(t.artista)}</td>
      <td style="padding:8px 14px"><span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:4px;background:var(--acc-dim);color:var(--acc)">${esc(t.categoria||'—')}</span></td>
      <td style="padding:8px 14px;font-size:11px;color:var(--t2)">${esc(t.duracion||'—')}</td>
      <td style="padding:8px 14px"><div style="display:flex;gap:5px"><button onclick="editTutorial(${t.id})" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--t1);font-size:11px;cursor:pointer">✏</button><button onclick="deleteTutorial(${t.id},'${esc(t.titulo).replace(/'/g,"\\'")}')" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(248,113,113,0.2);background:rgba(248,113,113,0.08);color:var(--red);font-size:11px;cursor:pointer">🗑</button></div></td>
    </tr>`).join('')
  }</tbody></table>`;
}

function editTutorial(id) {
  const t = _allTuts.find(x => x.id == id);
  if (!t) return;
  document.getElementById('editId').value = id;
  ['youtube_id','titulo','artista','duracion','descripcion','cancion_titulo','cancion_tono','cancion_bpm','capo','intro','cancion_letra'].forEach(k => setVal('f_'+k, t[k]||''));
  selectCat(t.categoria || 'Guitarra');
  updateYtPrev();
  goTo('nuevo', document.querySelector('[data-page=nuevo]'));
  goWizStep(1);
}

async function deleteTutorial(id, titulo) {
  if (!confirm(`¿Eliminar "${titulo}"?`)) return;
  try {
    await apiFetch(`?action=deleteTutorial&id=${id}`);
    _allTuts = _allTuts.filter(t => t.id != id);
    renderTutorialesTable(_allTuts);
    updateDashboard();
  } catch(e) { alert('Error: ' + e.message); }
}

async function saveTutorial() {
  const id = getVal('editId');
  const titulo = getVal('f_titulo').trim();
  if (!titulo) { showValidation('El título es obligatorio'); return; }
  const payload = {
    titulo, tipo:'tutorial',
    artista: getVal('f_artista').trim() || 'Recurso Musical',
    youtube_id: extractYtId(getVal('f_youtube_id')),
    duracion: getVal('f_duracion'), descripcion: getVal('f_descripcion'),
    categoria: getVal('f_categoria') || 'Guitarra',
    cancion_titulo: getVal('f_cancion_titulo'), cancion_tono: getVal('f_cancion_tono'),
    cancion_bpm: parseInt(getVal('f_cancion_bpm')) || 0,
    capo: getVal('f_capo') || '0', intro: getVal('f_intro'),
    cancion_letra: getVal('f_cancion_letra'), imagen: '',
  };
  if (id) payload.id = parseInt(id);
  const btn = document.getElementById('saveTutBtn');
  const txt = document.getElementById('saveTutBtnTxt');
  btn.disabled = true; txt.textContent = 'Guardando...';
  try {
    const d = await apiFetch(`?action=${id ? 'updateTutorial' : 'addTutorial'}`, { method:'POST', body:JSON.stringify(payload) });
    if (!d.ok && !d.id) throw new Error(d.error || 'Error al guardar');
    clearTutForm();
    await loadTutoriales();
    goTo('tutoriales', document.querySelector('[data-page=tutoriales]'));
    updateDashboard();
  } catch(e) { showValidation(e.message); }
  btn.disabled = false; txt.textContent = id ? '💾 Actualizar' : '🎬 Publicar Tutorial';
}

function showValidation(msg) {
  const e = document.getElementById('tw-validate-msg');
  if (e) { e.textContent = msg; e.style.display = 'block'; }
}

function clearTutForm() {
  document.getElementById('editId').value = '';
  ['f_youtube_id','f_titulo','f_artista','f_duracion','f_descripcion','f_cancion_titulo','f_cancion_tono','f_cancion_bpm','f_capo','f_intro','f_cancion_letra'].forEach(id => setVal(id,''));
  selectCat('Guitarra');
  const v = document.getElementById('tw-validate-msg'); if (v) v.style.display='none';
  updateYtPrev();
}

// ── WIZARD ───────────────────────────────────────────────────
function goWizStep(n) {
  for (let i = 1; i <= 4; i++) {
    document.getElementById('tw-step-'+i)?.classList.toggle('active', i===n);
    document.getElementById('tw-btn-'+i)?.classList.toggle('active', i===n);
  }
  if (n === 4) renderFinalPreview();
}

function renderFinalPreview() {
  const ytId = extractYtId(getVal('f_youtube_id'));
  setText('finalTitulo', getVal('f_titulo')||'—');
  setText('finalArtista', getVal('f_artista')||'—');
  setText('finalCat', (getVal('f_categoria')||'Guitarra').toUpperCase());
  const thumb = document.getElementById('ytThumbFinal');
  if (thumb) { if(ytId){thumb.src=`https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`;thumb.style.display='';}else thumb.style.display='none'; }
  const pills = document.getElementById('finalPills');
  if (pills) {
    const arr = [];
    const t=getVal('f_cancion_tono');if(t)arr.push(t);
    const b=getVal('f_cancion_bpm');if(b)arr.push(b+' BPM');
    const c=getVal('f_capo');if(c&&c!=='0')arr.push('Capo '+c);
    const d=getVal('f_duracion');if(d)arr.push(d);
    pills.innerHTML = arr.map(i=>`<span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:6px;background:var(--surface2);color:var(--t2);border:1px solid var(--border)">${esc(i)}</span>`).join('');
  }
  const st = document.getElementById('saveTutBtnTxt');
  if (st) st.textContent = document.getElementById('editId').value ? '💾 Actualizar' : '🎬 Publicar Tutorial';
}

// ── YOUTUBE ──────────────────────────────────────────────────
function extractYtId(input) {
  if (!input) return '';
  const m = input.trim().match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})|^([a-zA-Z0-9_-]{11})$/);
  return m ? (m[1]||m[2]) : input.trim();
}

function updateYtPrev() {
  const id = extractYtId(getVal('f_youtube_id'));
  const strip = document.getElementById('ytPreviewStrip');
  const prev = document.getElementById('ytPrev');
  const metaId = document.getElementById('ytMetaId');
  const dot = document.getElementById('ytStatusDot');
  if (id && id.length >= 11) {
    if (prev) prev.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
    if (metaId) metaId.textContent = id;
    if (strip) strip.style.display = 'flex';
    if (dot) dot.style.background = 'var(--green)';
  } else {
    if (strip) strip.style.display = 'none';
    if (dot) dot.style.background = 'var(--border)';
  }
}

// ── CATEGORY ─────────────────────────────────────────────────
function selectCat(cat) {
  setVal('f_categoria', cat);
  document.querySelectorAll('.cat-option').forEach(e => e.classList.remove('selected'));
  document.getElementById('cat-'+cat)?.classList.add('selected');
  const isMusic = cat==='Guitarra'||cat==='Piano';
  const musicFields = document.getElementById('s2MusicFields');
  const mtInfo = document.getElementById('s2MultitrackInfo');
  const pgInfo = document.getElementById('s2ProgramaInfo');
  if (musicFields) musicFields.style.display = isMusic ? 'block' : 'none';
  if (mtInfo) mtInfo.style.display = cat==='Multitracks' ? 'flex' : 'none';
  if (pgInfo) pgInfo.style.display = cat==='Programas' ? 'flex' : 'none';
  if (cat==='Guitarra'||cat==='Piano') { const s3Skip=document.getElementById('s3SkipPanel'); const s3Ai=document.getElementById('s3AiPanel'); const s3Nav=document.getElementById('s3Nav'); if(s3Skip)s3Skip.style.display='none'; if(s3Ai)s3Ai.style.display='block'; if(s3Nav)s3Nav.style.display='flex'; }
  else { const s3Skip=document.getElementById('s3SkipPanel'); const s3Ai=document.getElementById('s3AiPanel'); const s3Nav=document.getElementById('s3Nav'); if(s3Skip){s3Skip.style.display='block';setText('s3SkipCat',cat);} if(s3Ai)s3Ai.style.display='none'; if(s3Nav)s3Nav.style.display='none'; }
}

// ── CANCIONERO PICKER ────────────────────────────────────────
let _spItems = [];
async function spSearch() {
  const q = document.getElementById('spInput')?.value || '';
  if (q.length < 2) { setHtml('spDropdown',''); return; }
  try {
    const data = await apiFetch(`?action=buscar&q=${encodeURIComponent(q)}&tipo=cancionero`);
    _spItems = Array.isArray(data) ? data : [];
    const dd = document.getElementById('spDropdown');
    if (dd) dd.innerHTML = _spItems.slice(0,8).map(c => `<div onclick="spSelect(${c.id})" style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''"><span style="font-weight:700;color:var(--t0)">${esc(c.cancion_titulo||c.titulo)}</span> <span style="color:var(--t3)">${esc(c.artista||'')}</span></div>`).join('') || '<div style="padding:8px 12px;font-size:11px;color:var(--t3)">Sin resultados</div>';
  } catch {}
}

function spSelect(id) {
  const c = _spItems.find(x => x.id == id) || _allCans.find(x => x.id == id);
  if (!c) return;
  ['cancion_titulo','artista','cancion_tono','cancion_bpm','capo','intro','cancion_letra'].forEach(k => setVal('f_'+k, c[k]||''));
  setHtml('spDropdown',''); setVal('spInput','');
  const sel = document.getElementById('spSelected');
  if (sel) { sel.style.display='flex'; setText('spSelName',c.cancion_titulo||c.titulo||''); setText('spSelArtist',c.artista||''); }
}

function spClear() {
  const sel = document.getElementById('spSelected');
  if (sel) sel.style.display='none';
  setVal('spInput',''); setHtml('spDropdown','');
}

// ── GEMINI ───────────────────────────────────────────────────
async function genGemini(mode) {
  const isTut = mode === 'tut';
  const geminiKey = (document.getElementById(isTut?'geminiKeyInput':'cfgGemini')?.value || '').trim() || localStorage.getItem('gemini_key') || '';
  if (!geminiKey) { alert('Ingresa tu API Key de Gemini primero'); return; }
  const song = getVal(isTut?'ai_song':'can_ai_song');
  const artist = getVal(isTut?'ai_artist':'can_ai_artist');
  const key = getVal(isTut?'ai_key':'can_ai_key');
  const statusEl = document.getElementById(isTut?'aiStatus':'canAiStatus');
  const btn = document.getElementById(isTut?'aiGenBtn':'canAiBtn');
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--t2)">Generando con Gemini...</span>';
  const prompt = `Genera el cifrado completo de "${song}" de ${artist||'artista cristiano'}${key?' en tono '+key:''}.\nFormato: secciones como [Verso 1], [Coro] en línea sola, acordes en corchetes antes de cada sílaba.\nEjemplo: [G]Grande y [D]fuerte es el [Em]Señor\nDevuelve solo el texto del cifrado.`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({contents:[{parts:[{text:prompt}]}]}) });
    const d = await res.json();
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error(d.error?.message || 'Sin respuesta de Gemini');
    if (isTut) {
      setVal('f_cancion_letra', text);
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)">✓ Generado correctamente</span>';
    } else {
      setText('iaLvSong', song); setText('iaLvArtist', artist);
      document.getElementById('iaLvBody').innerHTML = esc(text).replace(/\n/g,'<br>');
      document.getElementById('iaLetraViewer').style.display = 'block';
      window._iaGenerated = { song, artist, key, text };
      if (statusEl) statusEl.innerHTML = '';
    }
  } catch(e) {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--red)">Error: ${esc(e.message)}</span>`;
  }
  if (btn) btn.disabled = false;
}

function saveGeminiKey() {
  const k = document.getElementById('geminiKeyInput')?.value || '';
  localStorage.setItem('gemini_key', k);
  const s = document.getElementById('keySaved');
  if (s) { s.style.display='block'; setTimeout(()=>s.style.display='none',2000); }
}

// ── SEARCH ───────────────────────────────────────────────────
function onSearch() {
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const page = document.querySelector('.page.active')?.id || '';
  if (page === 'page-tutoriales') renderTutorialesTable(q ? _allTuts.filter(t => (t.titulo+t.artista).toLowerCase().includes(q)) : _allTuts);
  else if (page === 'page-cancionero') renderCancioneroTable(q ? _allCans.filter(t => ((t.cancion_titulo||t.titulo)+t.artista).toLowerCase().includes(q)) : _allCans);
}

// ── CANCIONERO ───────────────────────────────────────────────
async function loadCancionero() {
  try {
    const data = await apiFetch('?action=getTutoriales&cat=Todos');
    if (!Array.isArray(data)) throw new Error(data?.error || 'Error');
    _allCans = data.filter(t => t.tipo === 'cancionero');
    renderCancioneroTable(_allCans);
  } catch(e) { setHtml('canTableWrap', errBox(e.message)); }
}

function setCanFilter(cat, el) {
  document.querySelectorAll('#page-cancionero .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderCancioneroTable(cat === 'Todos' ? _allCans : _allCans.filter(t => t.categoria === cat));
}

function renderCancioneroTable(cans) {
  const wrap = document.getElementById('canTableWrap');
  if (!wrap) return;
  if (!cans.length) { wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t3);font-size:13px;font-weight:600">Sin canciones</div>'; return; }
  wrap.innerHTML = `<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid var(--border)">${['CANCIÓN','ARTISTA','TONO','BPM','CAPO','CIFRADO','ACCIONES'].map(h=>`<th style="text-align:left;padding:10px 14px;font-size:10px;font-weight:700;color:var(--t2);letter-spacing:1px">${h}</th>`).join('')}</tr></thead><tbody>${
    cans.map(c => `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 14px;font-size:12px;font-weight:700;color:var(--t0)">${esc(c.cancion_titulo||c.titulo||'—')}</td>
      <td style="padding:8px 14px;font-size:11px;color:var(--t2)">${esc(c.artista)}</td>
      <td style="padding:8px 14px"><span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:4px;background:var(--teal-dim);color:var(--teal)">${esc(c.cancion_tono||'—')}</span></td>
      <td style="padding:8px 14px;font-size:11px;color:var(--t2)">${c.cancion_bpm||'—'}</td>
      <td style="padding:8px 14px;font-size:11px;color:var(--t2)">${c.capo&&c.capo!=='0'?c.capo:'—'}</td>
      <td style="padding:8px 14px">${(c.cancion_letra||'').length>10?'<span style="color:var(--green);font-size:11px;font-weight:700">✓ Sí</span>':'<span style="color:var(--t3);font-size:11px">No</span>'}</td>
      <td style="padding:8px 14px"><div style="display:flex;gap:5px"><button onclick="editCancion(${c.id})" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--t1);font-size:11px;cursor:pointer">✏</button><button onclick="deleteCancion(${c.id},'${esc(c.cancion_titulo||c.titulo).replace(/'/g,"\\'")}')" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(248,113,113,0.2);background:rgba(248,113,113,0.08);color:var(--red);font-size:11px;cursor:pointer">🗑</button></div></td>
    </tr>`).join('')
  }</tbody></table>`;
}

function editCancion(id) {
  const c = _allCans.find(x => x.id == id);
  if (!c) return;
  document.getElementById('canEditId').value = id;
  switchTab('manual', document.querySelectorAll('.nc-tab')[2]);
  renderManualForm(c);
  goTo('nuevaCancion', document.querySelector('[data-page=nuevaCancion]'));
}

async function deleteCancion(id, titulo) {
  if (!confirm(`¿Eliminar "${titulo}"?`)) return;
  try {
    await apiFetch(`?action=deleteTutorial&id=${id}`);
    _allCans = _allCans.filter(c => c.id != id);
    renderCancioneroTable(_allCans); updateDashboard();
  } catch(e) { alert('Error: ' + e.message); }
}

function renderManualForm(data = {}) {
  const wrap = document.getElementById('manualFormInner');
  if (!wrap) return;
  const cats = ['Alabanza','Adoración','Coro','Himno'];
  const tonos = ['','C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'];
  wrap.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      <div class="clean-field" style="grid-column:1/-1"><label class="clean-label">Título canción *</label><input type="text" class="clean-input" id="mn_titulo" value="${esc(data.cancion_titulo||data.titulo||'')}"/></div>
      <div class="clean-field"><label class="clean-label">Artista</label><input type="text" class="clean-input" id="mn_artista" value="${esc(data.artista||'')}"/></div>
      <div class="clean-field"><label class="clean-label">Categoría</label><select class="clean-select" id="mn_cat">${cats.map(c=>`<option value="${c}" ${(data.categoria||'Alabanza')===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="clean-field"><label class="clean-label">Tono</label><select class="clean-select" id="mn_tono">${tonos.map(t=>`<option value="${t}" ${(data.cancion_tono||'')===t?'selected':''}>${t||'—'}</option>`).join('')}</select></div>
      <div class="clean-field"><label class="clean-label">BPM</label><input type="number" class="clean-input" id="mn_bpm" value="${data.cancion_bpm||''}" placeholder="120"/></div>
      <div class="clean-field"><label class="clean-label">Capo (0=sin)</label><input type="number" class="clean-input" id="mn_capo" value="${data.capo||'0'}" min="0" max="12"/></div>
      <div class="clean-field"><label class="clean-label">Intro (ej: G Em C D)</label><input type="text" class="clean-input" id="mn_intro" value="${esc(data.intro||'')}"/></div>
    </div>
    <div class="clean-field" style="margin-bottom:16px"><label class="clean-label">Cifrado / Letra</label><textarea class="clean-textarea" id="mn_letra" style="min-height:220px">${esc(data.cancion_letra||'')}</textarea></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-acc" onclick="saveCancion()">💾 Guardar Canción</button>
      <button class="btn btn-ghost" onclick="goTo('cancionero',document.querySelector('[data-page=cancionero]'))">Cancelar</button>
    </div>`;
}

async function saveCancion() {
  const id = document.getElementById('canEditId')?.value;
  const titulo = getVal('mn_titulo').trim();
  if (!titulo) { alert('El título es obligatorio'); return; }
  const payload = {
    titulo, cancion_titulo: titulo, tipo:'cancionero',
    artista: getVal('mn_artista') || 'Recurso Musical',
    categoria: getVal('mn_cat') || 'Alabanza',
    cancion_tono: getVal('mn_tono'),
    cancion_bpm: parseInt(getVal('mn_bpm')) || 0,
    capo: getVal('mn_capo') || '0',
    intro: getVal('mn_intro'),
    cancion_letra: getVal('mn_letra'),
    youtube_id: '', descripcion: '', duracion: '', imagen: '',
  };
  if (id) payload.id = parseInt(id);
  try {
    const d = await apiFetch(`?action=${id?'updateTutorial':'addTutorial'}`, { method:'POST', body:JSON.stringify(payload) });
    if (!d.ok && !d.id) throw new Error(d.error || 'Error');
    await loadCancionero(); goTo('cancionero', document.querySelector('[data-page=cancionero]')); updateDashboard();
  } catch(e) { alert('Error: ' + e.message); }
}

function switchTab(tab, el) {
  document.querySelectorAll('.nc-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nc-panel').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('ptab-'+tab)?.classList.add('active');
  if (tab === 'manual') { document.getElementById('canEditId').value = ''; renderManualForm(); }
}

async function searchOnline() {
  const song = getVal('srch_song').trim();
  if (!song) return;
  const q = song + ' ' + (getVal('srch_artist').trim());
  const status = document.getElementById('srchStatus');
  const btn = document.getElementById('srchBtn');
  if (status) status.innerHTML = '<span style="color:var(--t2)">Buscando...</span>';
  if (btn) btn.disabled = true;
  try {
    const data = await apiFetch(`?action=searchLetras&q=${encodeURIComponent(q)}`);
    const wrap = document.getElementById('srchResultsWrap');
    const list = document.getElementById('srchResultsList');
    if (!Array.isArray(data) || !data.length) { if(status) status.innerHTML='<span style="color:var(--amber)">Sin resultados</span>'; }
    else {
      if (status) status.innerHTML = '';
      list.innerHTML = data.map(r => `<div onclick="window.open('${esc(r.url)}','_blank')" style="padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;color:var(--t0)" onmouseover="this.style.borderColor='var(--acc)'" onmouseout="this.style.borderColor='var(--border)'">${esc(r.titulo)} <span style="color:var(--t3);font-weight:500;font-size:10px">${esc(r.fuente)}</span></div>`).join('');
      wrap.style.display = 'block';
    }
  } catch(e) { if(status) status.innerHTML=`<span style="color:var(--red)">Error: ${esc(e.message)}</span>`; }
  if (btn) { btn.disabled=false; document.getElementById('srchTxt').textContent='Buscar'; }
}

function closeLetraViewer() { document.getElementById('letraViewer').style.display='none'; }
function guardarDesdeVisor() { switchTab('manual',null); }
function guardarDesdeIa() {
  if (!window._iaGenerated) return;
  const { song, artist, key, text } = window._iaGenerated;
  document.getElementById('canEditId').value = '';
  switchTab('manual', null);
  setVal('mn_titulo', song); setVal('mn_artista', artist); setVal('mn_tono', key); setVal('mn_letra', text);
  document.getElementById('iaLetraViewer').style.display = 'none';
}

// ── IMPORT JSON ──────────────────────────────────────────────
let _importData = [];
function previewImport() {
  try {
    _importData = JSON.parse(getVal('importJson'));
    if (!Array.isArray(_importData)) throw 0;
    setText('importCount', _importData.length + ' canciones');
    document.getElementById('importBtn').disabled = false;
    const preview = document.getElementById('importPreview');
    if (preview && _importData.length) {
      preview.style.display = 'block';
      document.getElementById('importPreviewTable').innerHTML = `<thead><tr><th>Título</th><th>Artista</th><th>Tono</th></tr></thead><tbody>${_importData.slice(0,5).map(r=>`<tr><td>${esc(r.titulo||r.cancion_titulo||'—')}</td><td>${esc(r.artista||'—')}</td><td>${esc(r.tono||r.cancion_tono||'—')}</td></tr>`).join('')}</tbody>`;
    }
  } catch { setText('importCount','JSON inválido'); document.getElementById('importBtn').disabled=true; _importData=[]; }
}

async function startImport() {
  if (!_importData.length) return;
  const btn=document.getElementById('importBtn'), progress=document.getElementById('importProgress'), bar=document.getElementById('progressBar'), label=document.getElementById('progressLabel'), pct=document.getElementById('progressPct');
  btn.disabled=true; progress.style.display='block';
  for (let i=0; i<_importData.length; i++) {
    const item = _importData[i];
    const payload = { titulo:item.titulo||item.cancion_titulo||'—', cancion_titulo:item.cancion_titulo||item.titulo||'—', artista:item.artista||'Recurso Musical', cancion_tono:item.tono||item.cancion_tono||'', cancion_bpm:parseInt(item.bpm||item.cancion_bpm)||0, capo:String(item.capo||'0'), intro:item.intro||'', cancion_letra:item.letra||item.cancion_letra||'', tipo:'cancionero', categoria:item.categoria||'Alabanza', youtube_id:'', descripcion:'', duracion:'', imagen:item.imagen||'' };
    try { await apiFetch('?action=addTutorial',{method:'POST',body:JSON.stringify(payload)}); } catch {}
    const p = Math.round((i+1)/_importData.length*100);
    if(bar)bar.style.width=p+'%'; if(pct)pct.textContent=p+'%'; if(label)label.textContent=`Importando ${i+1}/${_importData.length}...`;
  }
  if(label)label.textContent=`✓ ${_importData.length} canciones importadas`;
  btn.disabled=false;
  await loadCancionero(); updateDashboard();
}

function exportarCancioneroJSON() {
  const data = _allCans.map(c=>({titulo:c.cancion_titulo||c.titulo,artista:c.artista,tono:c.cancion_tono,bpm:c.cancion_bpm,capo:c.capo,intro:c.intro,letra:c.cancion_letra,imagen:c.imagen}));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.download = 'cancionero.json'; a.click();
}

// ── MULTITRACKS ──────────────────────────────────────────────
async function loadMultitracks() {
  try {
    const data = await apiFetch('?action=getMultitracks');
    if (!Array.isArray(data)) throw new Error(data?.error||'Error');
    _allMts = data; renderMtTable(data);
  } catch(e) { setHtml('mtTableWrap', errBox(e.message)); }
}

function renderMtTable(mts) {
  const wrap = document.getElementById('mtTableWrap');
  if (!wrap) return;
  if (!mts.length) { wrap.innerHTML='<div style="padding:40px;text-align:center;color:var(--t3);font-size:13px;font-weight:600">Sin multitracks</div>'; return; }
  wrap.innerHTML = `<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid var(--border)">${['PORTADA','TÍTULO','ARTISTA','TONO','BPM','ACCIONES'].map(h=>`<th style="text-align:left;padding:10px 14px;font-size:10px;font-weight:700;color:var(--t2);letter-spacing:1px">${h}</th>`).join('')}</tr></thead><tbody>${
    mts.map(m=>`<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 14px">${m.imagen_url?`<img src="${esc(m.imagen_url)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px" onerror="this.style.display='none'"/>`:'—'}</td>
      <td style="padding:8px 14px;font-size:12px;font-weight:700;color:var(--t0)">${esc(m.titulo)}</td>
      <td style="padding:8px 14px;font-size:11px;color:var(--t2)">${esc(m.artista||'—')}</td>
      <td style="padding:8px 14px"><span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:4px;background:var(--teal-dim);color:var(--teal)">${esc(m.tono||'—')}</span></td>
      <td style="padding:8px 14px;font-size:11px;color:var(--t2)">${m.bpm||'—'}</td>
      <td style="padding:8px 14px"><div style="display:flex;gap:5px"><button onclick="editMt(${m.id})" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--t1);font-size:11px;cursor:pointer">✏</button><button onclick="deleteMt(${m.id},'${esc(m.titulo).replace(/'/g,"\\'")}')" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(248,113,113,0.2);background:rgba(248,113,113,0.08);color:var(--red);font-size:11px;cursor:pointer">🗑</button></div></td>
    </tr>`).join('')
  }</tbody></table>`;
}

function openMtModal(data = {}) {
  _mtModal = { pistas: data.pistas ? [...data.pistas] : [], id: data.id || null };
  setVal('mt_id', data.id||''); setVal('mt_titulo', data.titulo||''); setVal('mt_artista', data.artista||'');
  setVal('mt_tono', data.tono||''); setVal('mt_bpm', data.bpm||''); setVal('mt_compas', data.compas||'4/4');
  setVal('mt_duracion', data.duracion||''); setVal('mt_imagen_url', data.imagen_url||'');
  setText('mtModalTitle', data.id ? 'Editar Multitrack' : 'Nuevo Multitrack');
  renderMtPistas(); renderMtQuickBtns(); mtPreviewImg();
  document.getElementById('mtModalBackdrop').style.display = 'flex';
}

async function editMt(id) {
  try { openMtModal(await apiFetch(`?action=getMultitrack&id=${id}`)); } catch(e) { alert(e.message); }
}

function closeMtModal() { document.getElementById('mtModalBackdrop').style.display = 'none'; }

function mtPreviewImg() {
  const url = getVal('mt_imagen_url');
  const wrap = document.getElementById('mtImgPreviewWrap'), img = document.getElementById('mtImgPreviewEl');
  if (url && wrap && img) { wrap.style.display='block'; img.src=url; } else if(wrap) wrap.style.display='none';
}

function renderMtQuickBtns() {
  const wrap = document.getElementById('mtQuickBtns');
  if (wrap) wrap.innerHTML = PISTA_TIPOS.map(t => `<button class="btn btn-ghost btn-sm" onclick="addMtPistaRow('${t}','')" style="font-size:10px;padding:4px 8px;border-radius:6px">${t}</button>`).join('');
}

function addMtPistaRow(tipo, url) {
  _mtModal.pistas.push({ tipo, url: url||'' });
  renderMtPistas();
}

function renderMtPistas() {
  const list = document.getElementById('mtPistasList'), empty = document.getElementById('mtPistasEmpty');
  if (!list) return;
  if (!_mtModal.pistas.length) { list.innerHTML=''; if(empty)empty.style.display='block'; return; }
  if (empty) empty.style.display='none';
  list.innerHTML = _mtModal.pistas.map((p,i) => `<div style="display:flex;gap:7px;align-items:center">
    <select class="clean-select" style="width:110px;font-size:11px" onchange="_mtModal.pistas[${i}].tipo=this.value">${PISTA_TIPOS.map(t=>`<option value="${t}" ${p.tipo===t?'selected':''}>${t}</option>`).join('')}</select>
    <input type="text" class="clean-input" value="${esc(p.url)}" placeholder="https://..." style="flex:1;font-size:11px" oninput="_mtModal.pistas[${i}].url=this.value"/>
    <button onclick="_mtModal.pistas.splice(${i},1);renderMtPistas()" style="padding:5px 9px;border-radius:6px;border:1px solid rgba(248,113,113,0.2);background:rgba(248,113,113,0.08);color:var(--red);cursor:pointer;font-size:11px">✕</button>
  </div>`).join('');
}

async function saveMt() {
  const titulo = getVal('mt_titulo').trim();
  if (!titulo) { alert('El título es obligatorio'); return; }
  const payload = { titulo, artista:getVal('mt_artista'), tono:getVal('mt_tono'), bpm:parseInt(getVal('mt_bpm'))||0, compas:getVal('mt_compas')||'4/4', duracion:getVal('mt_duracion'), imagen_url:getVal('mt_imagen_url'), pistas:_mtModal.pistas.filter(p=>p.url) };
  const id = getVal('mt_id'); if(id) payload.id = parseInt(id);
  const btn=document.getElementById('mtSaveBtn'), txt=document.getElementById('mtSaveTxt');
  if(btn)btn.disabled=true; if(txt)txt.textContent='Guardando...';
  try {
    const d = await apiFetch('?action=saveMultitrack',{method:'POST',body:JSON.stringify(payload)});
    if (!d.ok) throw new Error(d.error||'Error');
    closeMtModal(); await loadMultitracks();
  } catch(e) { alert('Error: '+e.message); }
  if(btn)btn.disabled=false; if(txt)txt.textContent='💾 Guardar Multitrack';
}

async function deleteMt(id, titulo) {
  if (!confirm(`¿Eliminar "${titulo}"?`)) return;
  try { await apiFetch(`?action=deleteMultitrack&id=${id}`); _allMts=_allMts.filter(m=>m.id!=id); renderMtTable(_allMts); } catch(e) { alert(e.message); }
}

// ── CONFIG ───────────────────────────────────────────────────
async function checkConnection() {
  try { const d=await apiFetch('?action=check'); alert(d.ok?'✓ Conexión OK':'✗ '+d.error); } catch(e) { alert('✗ '+e.message); }
}
async function runSetup() {
  try { const d=await apiFetch('?action=setup&secret=rm_secret_2024_FSSsfxK9pL'); alert(d.msg||'OK'); } catch(e) { alert(e.message); }
}
async function changePassword() {
  const current=getVal('cfgPassCurrent'), newP=getVal('cfgPassNew'), conf=getVal('cfgPassConfirm');
  if(!current||!newP){alert('Completa los campos');return;}
  if(newP!==conf){alert('Las contraseñas no coinciden');return;}
  try { const d=await apiFetch('?action=changePassword',{method:'POST',body:JSON.stringify({current_password:current,new_password:newP})}); alert(d.ok?'✓ Contraseña actualizada':d.error||'Error'); } catch(e) { alert(e.message); }
}
function saveConfig() {
  ['Gemini','Genius','Drive'].forEach(k => { const v=getVal('cfg'+k); if(v) localStorage.setItem(k.toLowerCase()+'_key',v); });
  alert('✓ Keys guardadas');
}

// ── THEME ────────────────────────────────────────────────────
function toggleTheme() {
  const html=document.documentElement, isDark=html.getAttribute('data-theme')==='dark';
  html.setAttribute('data-theme', isDark?'light':'dark');
  const knob=document.getElementById('themeKnob'); if(knob)knob.textContent=isDark?'🌙':'☀️';
  const lbl=document.getElementById('themeMenuLabel'); if(lbl)lbl.textContent=isDark?'Modo Oscuro':'Modo Claro';
}

// ── USER MENU ────────────────────────────────────────────────
function toggleUserMenu() { document.getElementById('userMenu')?.classList.toggle('open'); }
function closeUserMenu() { document.getElementById('userMenu')?.classList.remove('open'); }
function openAvatarModal() {}

// ── MISC ─────────────────────────────────────────────────────
function toggleSelectMode() {}
function selectAllCanciones() {}
function deselectAllCanciones() {}
function confirmBulkDelete() {}
function startBatchCovers() { alert('Próximamente'); }
function confirmWipeCancionero() { if(confirm('¿Vaciar TODO el cancionero?')) alert('Por implementar'); }

// ── UTILS ────────────────────────────────────────────────────
function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function getVal(id) { return document.getElementById(id)?.value ?? ''; }
function setVal(id, v) { const e=document.getElementById(id); if(e) e.value=v; }
function setText(id, v) { const e=document.getElementById(id); if(e) e.textContent=v; }
function setHtml(id, v) { const e=document.getElementById(id); if(e) e.innerHTML=v; }
function errBox(msg) { return `<div style="padding:40px;text-align:center;color:var(--red);font-size:13px;font-weight:600">${esc(msg)}</div>`; }

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', e => { if(!document.getElementById('userMenuWrap')?.contains(e.target)) closeUserMenu(); });
  const gk=localStorage.getItem('gemini_key');
  if(gk){const i=document.getElementById('geminiKeyInput');if(i)i.value=gk;const c=document.getElementById('cfgGemini');if(c)c.value=gk;}
  const tok=getToken();
  if(tok){_username=localStorage.getItem('rm_username')||'Admin';showApp();}
  else { document.querySelector('.layout').style.display='none'; }
});
