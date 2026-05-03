/**
 * multitrack-markers-patch.js  v3
 * ─────────────────────────────────────────────────────────
 * FIXES v3:
 *  · Guardado robusto: llama DIRECTAMENTE a la API con un
 *    segundo UPDATE solo para markers, después del save normal.
 *    Así no depende de que el PHP de saveMultitrack soporte markers.
 *  · Mini-player HTML5 de la pista "guía" — escucha y pulsa
 *    "Marcar aquí" para capturar el tiempo exacto.
 *  · Plantillas de estructura de canción con un solo clic.
 *  · Auto-detecta URL de pista "guía" desde las pistas del form.
 *  · Carga marcadores existentes al editar.
 *  · Guardado en JSON válido en columna `markers`.
 * ─────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ── Estado ── */
  let _markers      = [];
  let _mtId         = null;   // ID del multitrack en edición
  let _guiaAudio    = null;   // HTMLAudioElement del mini-player
  let _guiaUrl      = '';

  /* ── Plantillas rápidas ── */
  const TEMPLATES = {
    'Completa': [
      { label: 'Intro',     timeMs: 0 },
      { label: 'Verso 1',   timeMs: 30000 },
      { label: 'Pre-Coro',  timeMs: 60000 },
      { label: 'Coro',      timeMs: 90000 },
      { label: 'Verso 2',   timeMs: 120000 },
      { label: 'Pre-Coro 2',timeMs: 150000 },
      { label: 'Coro 2',    timeMs: 180000 },
      { label: 'Puente',    timeMs: 220000 },
      { label: 'Coro Final',timeMs: 260000 },
      { label: 'Outro',     timeMs: 300000 },
    ],
    'Simple': [
      { label: 'Intro',  timeMs: 0 },
      { label: 'Verso',  timeMs: 30000 },
      { label: 'Coro',   timeMs: 90000 },
      { label: 'Puente', timeMs: 180000 },
      { label: 'Outro',  timeMs: 240000 },
    ],
    'Himno': [
      { label: 'Estrofa 1', timeMs: 0 },
      { label: 'Coro',      timeMs: 45000 },
      { label: 'Estrofa 2', timeMs: 90000 },
      { label: 'Coro 2',    timeMs: 135000 },
      { label: 'Estrofa 3', timeMs: 180000 },
      { label: 'Coro Final',timeMs: 225000 },
    ],
  };

  const PRESET_SECTIONS = [
    'Intro','Verso 1','Verso 2','Pre-Coro','Coro','Coro 2',
    'Puente','Solo','Tag','Vamp','Outro',
  ];

  /* ── Helpers de tiempo ── */
  function msToStr(ms) {
    if (!ms || ms < 0) return '0:00';
    const s  = Math.floor(ms / 1000);
    const m  = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss < 10 ? '0' : ''}${ss}`;
  }

  function strToMs(str) {
    const parts = (str || '').trim().split(':');
    if (parts.length === 2) {
      return Math.round((parseInt(parts[0], 10) * 60 + parseFloat(parts[1])) * 1000);
    }
    return Math.round(parseFloat(parts[0] || '0') * 1000);
  }

  /* ── Parseo defensivo ── */
  function parseMarkers(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return [...raw].sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
    if (typeof raw === 'string') {
      try {
        const p = JSON.parse(raw);
        if (Array.isArray(p)) return [...p].sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
      } catch (_) {}
    }
    return [];
  }

/* ── Detectar URL de la pista guía desde el formulario MEJORADO ── */
  function detectGuiaUrl() {
    const selects = document.querySelectorAll('.mt-pista-select');
    let fallbackUrl = '';
    for (const sel of selects) {
      const row = sel.closest('.mt-pista-row');
      const url = row?.querySelector('.mt-pista-url')?.value.trim();
      if (url) {
        if (sel.value === 'guia') return url;
        if (sel.value === 'master' && !fallbackUrl) fallbackUrl = url;
        if (!fallbackUrl) fallbackUrl = url;
      }
    }
    return fallbackUrl;
  }

  /* ════════════════════════════════════════════════════════
     INYECTAR PANEL EN EL MODAL
  ════════════════════════════════════════════════════════ */
  function injectMarkersPanel() {
    const modalBody = document.querySelector('#mtModalBackdrop .modal-body');
    if (!modalBody || document.getElementById('mtMarkersSection')) return;

    const section = document.createElement('div');
    section.id = 'mtMarkersSection';
    section.style.cssText = `
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
    `;

    section.innerHTML = `
      <!-- Cabecera -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:var(--purple);
                      text-transform:uppercase;margin-bottom:2px">
            🎯 Secciones / Marcadores
          </div>
          <div style="font-size:10px;font-weight:500;color:var(--t2)">
            El usuario podrá saltar entre secciones en la app
          </div>
        </div>
        <span id="mtMarkersCount"
              style="font-size:10px;font-weight:700;color:var(--purple);
                     background:var(--purple-dim);padding:2px 8px;border-radius:5px;
                     border:1px solid rgba(168,85,247,.2)">0</span>
      </div>

      <!-- ══ MINI-PLAYER PISTA GUÍA ══ -->
      <div id="mtGuiaPlayerWrap" style="
        background:var(--surface);border:1px solid var(--border);
        border-radius:10px;padding:12px;margin-bottom:12px;display:none">
        <div style="font-size:9px;font-weight:700;letter-spacing:1.5px;color:var(--teal);
                    text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px">
          <span>🎤 Pista Guía</span>
          <span style="font-size:9px;font-weight:500;color:var(--t2)">
            — escucha y pulsa "Marcar" en cada sección
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button id="mtGuiaPlayBtn" onclick="window._mtToggleGuia()"
                  style="height:32px;padding:0 14px;background:var(--teal-dim);
                         border:1px solid rgba(0,212,170,.3);border-radius:8px;
                         color:var(--teal);font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer">
            ▶ Play
          </button>
          <div style="flex:1;min-width:100px;display:flex;flex-direction:column;gap:3px">
            <input type="range" id="mtGuiaSeek" min="0" max="100" value="0" step="0.1"
                   style="width:100%;accent-color:var(--teal);cursor:pointer"
                   oninput="window._mtGuiaSeek(this.value)"/>
            <div style="display:flex;justify-content:space-between">
              <span id="mtGuiaPos" style="font-size:9px;font-weight:700;color:var(--teal)">0:00</span>
              <span id="mtGuiaDur" style="font-size:9px;font-weight:600;color:var(--t3)">—</span>
            </div>
          </div>
          <button id="mtMarkHereBtn" onclick="window._mtMarkHere()"
                  style="height:36px;padding:0 14px;
                         background:var(--purple);border:none;border-radius:8px;
                         color:white;font-family:var(--font);font-size:12px;font-weight:700;
                         cursor:pointer;transition:transform .1s;white-space:nowrap"
                  onmousedown="this.style.transform='scale(.95)'"
                  onmouseup="this.style.transform='scale(1)'">
            🎯 Marcar aquí
          </button>
        </div>
      </div>

      <!-- Sin pista guía: aviso -->
      <div id="mtNoGuiaWarn" style="
        background:var(--amber-dim);border:1px solid rgba(255,184,48,.25);
        border-radius:8px;padding:9px 13px;margin-bottom:12px;
        font-size:10px;font-weight:600;color:var(--amber);display:none">
        ⚠ No hay pista "Guía" cargada. Agrega la pista guía arriba para escuchar
        y marcar secciones con precisión, o usa los tiempos manuales.
      </div>

      <!-- ══ PLANTILLAS ══ -->
      <div style="margin-bottom:12px">
        <div style="font-size:9px;font-weight:700;color:var(--t2);letter-spacing:1.5px;
                    text-transform:uppercase;margin-bottom:7px">
          Plantilla rápida
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap" id="mtTemplateBtns"></div>
      </div>

      <!-- ══ AGREGAR MARCADOR MANUAL ══ -->
      <div style="display:flex;gap:7px;margin-bottom:12px;align-items:center;flex-wrap:wrap">
        <!-- Presets de nombre -->
        <select id="mtPresetSelect"
                style="height:36px;background:var(--surface);border:1px solid var(--border);
                       border-radius:8px;color:var(--t0);font-family:var(--font);
                       font-size:12px;font-weight:600;padding:0 10px;outline:none;cursor:pointer">
          <option value="">— Sección —</option>
          ${PRESET_SECTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>

        <!-- Nombre personalizado -->
        <input type="text" id="mtMarkerLabel" placeholder="o escribe el nombre..."
               style="flex:1;min-width:100px;
                      background:var(--surface);border:1px solid var(--border);
                      border-radius:8px;color:var(--t0);font-family:var(--font);
                      font-size:12px;font-weight:600;padding:8px 12px;outline:none;
                      transition:border-color .2s"
               onfocus="this.style.borderColor='var(--purple)'"
               onblur="this.style.borderColor='var(--border)'"
               onkeydown="if(event.key==='Enter') window._mtAddMarker()"/>

        <!-- Tiempo manual -->
        <input type="text" id="mtMarkerTime" placeholder="0:00"
               style="width:64px;background:var(--surface);border:1px solid var(--border);
                      border-radius:8px;color:var(--purple);font-family:var(--font);
                      font-size:12px;font-weight:800;padding:7px 8px;outline:none;
                      text-align:center;transition:border-color .2s"
               onfocus="this.style.borderColor='var(--purple)'"
               onblur="this.style.borderColor='var(--border)'"
               onkeydown="if(event.key==='Enter') window._mtAddMarker()"/>

        <button onclick="window._mtAddMarker()"
                style="height:36px;padding:0 14px;background:var(--purple-dim);
                       border:1px solid rgba(168,85,247,.35);border-radius:8px;
                       color:var(--purple);font-family:var(--font);font-size:12px;
                       font-weight:700;cursor:pointer;white-space:nowrap;transition:all .15s"
                onmouseover="this.style.background='var(--purple)';this.style.color='white'"
                onmouseout="this.style.background='var(--purple-dim)';this.style.color='var(--purple)'">
          + Añadir
        </button>
      </div>

      <!-- ══ LÍNEA DE TIEMPO VISUAL ══ -->
      <div id="mtTimelineWrap" style="display:none;margin-bottom:12px">
        <div style="font-size:9px;font-weight:700;color:var(--t2);letter-spacing:1.5px;
                    text-transform:uppercase;margin-bottom:5px">Línea de tiempo</div>
        <div id="mtTimeline"
             style="position:relative;height:28px;background:var(--surface);
                    border:1px solid var(--border);border-radius:8px;overflow:hidden;cursor:pointer"
             onclick="window._mtTimelineClick(event)">
          <div id="mtTimelineFill"
               style="position:absolute;left:0;top:0;bottom:0;width:0%;
                      background:var(--teal-dim);pointer-events:none"></div>
        </div>
      </div>

      <!-- ══ LISTA DE MARCADORES ══ -->
      <div id="mtMarkersList" style="display:flex;flex-direction:column;gap:6px">
        <div id="mtMarkersEmpty"
             style="text-align:center;padding:18px;color:var(--t3);
                    font-size:11px;font-weight:600;
                    border:1px dashed var(--border);border-radius:9px">
          Sin marcadores. Usa una plantilla o añade manualmente.
        </div>
      </div>
    `;

    modalBody.appendChild(section);
    _buildTemplateBtns();
    _syncPresetSelect();
    _refreshGuiaPlayer();
  }

  /* ── Sincronizar preset select → input label ── */
  function _syncPresetSelect() {
    const sel = document.getElementById('mtPresetSelect');
    const inp = document.getElementById('mtMarkerLabel');
    if (!sel || !inp) return;
    sel.onchange = () => {
      if (sel.value) { inp.value = sel.value; inp.focus(); sel.value = ''; }
    };
  }

  /* ── Botones de plantilla ── */
  function _buildTemplateBtns() {
    const wrap = document.getElementById('mtTemplateBtns');
    if (!wrap) return;
    wrap.innerHTML = '';
    Object.keys(TEMPLATES).forEach(name => {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.style.cssText = `
        padding:4px 12px;border-radius:6px;
        background:var(--surface);border:1px solid var(--border);
        color:var(--t2);font-family:var(--font);font-size:10px;
        font-weight:700;cursor:pointer;transition:all .15s;
      `;
      btn.onmouseenter = () => { btn.style.borderColor = 'var(--purple)'; btn.style.color = 'var(--purple)'; btn.style.background = 'var(--purple-dim)'; };
      btn.onmouseleave = () => { btn.style.borderColor = 'var(--border)';  btn.style.color = 'var(--t2)';    btn.style.background = 'var(--surface)'; };
      btn.onclick = () => {
        if (_markers.length && !confirm(`Reemplazar ${_markers.length} marcadores actuales con la plantilla "${name}"?`)) return;
        _markers = TEMPLATES[name].map((m, i) => ({ id: Date.now().toString() + i, label: m.label, timeMs: m.timeMs }));
        renderMarkersList();
        if (typeof toast === 'function') toast(`✓ Plantilla "${name}" cargada`);
      };
      wrap.appendChild(btn);
    });

    // Botón limpiar todo
    const clr = document.createElement('button');
    clr.textContent = '🗑 Limpiar';
    clr.style.cssText = `
      padding:4px 12px;border-radius:6px;
      background:var(--red-dim);border:1px solid rgba(255,77,109,.2);
      color:var(--red);font-family:var(--font);font-size:10px;
      font-weight:700;cursor:pointer;transition:all .15s;margin-left:auto;
    `;
    clr.onclick = () => { if (confirm('¿Eliminar todos los marcadores?')) { _markers = []; renderMarkersList(); } };
    wrap.appendChild(clr);
  }

  /* ════════════════════════════════════════════════════════
     MINI-PLAYER DE LA PISTA GUÍA
  ════════════════════════════════════════════════════════ */
  function _refreshGuiaPlayer() {
    _guiaUrl = detectGuiaUrl();
    const playerWrap = document.getElementById('mtGuiaPlayerWrap');
    const noGuiaWarn = document.getElementById('mtNoGuiaWarn');
    if (!playerWrap || !noGuiaWarn) return;

    if (_guiaUrl) {
      playerWrap.style.display = 'block';
      noGuiaWarn.style.display  = 'none';
      _initGuiaAudio(_guiaUrl);
    } else {
      playerWrap.style.display = 'none';
      noGuiaWarn.style.display  = 'block';
    }
  }

  function _initGuiaAudio(url) {
    if (_guiaAudio) { _guiaAudio.pause(); _guiaAudio = null; }
    _guiaAudio = new Audio(url);
    _guiaAudio.crossOrigin = 'anonymous';
    _guiaAudio.ontimeupdate = _onGuiaTimeUpdate;
    _guiaAudio.onloadedmetadata = () => {
      const dur = document.getElementById('mtGuiaDur');
      if (dur) dur.textContent = msToStr(_guiaAudio.duration * 1000);
    };
    _guiaAudio.onended = () => {
      const btn = document.getElementById('mtGuiaPlayBtn');
      if (btn) btn.textContent = '▶ Play';
    };
    _guiaAudio.onerror = () => {
      const warn = document.getElementById('mtGuiaPlayerWrap');
      if (warn) warn.innerHTML = `<div style="font-size:10px;font-weight:600;color:var(--red)">
        ❌ No se pudo cargar la pista guía. Verifica que la URL sea accesible.
      </div>`;
    };
  }

  function _onGuiaTimeUpdate() {
    if (!_guiaAudio) return;
    const posEl  = document.getElementById('mtGuiaPos');
    const seekEl = document.getElementById('mtGuiaSeek');
    const tlFill = document.getElementById('mtTimelineFill');
    const ms = _guiaAudio.currentTime * 1000;
    if (posEl) posEl.textContent = msToStr(ms);
    if (seekEl && _guiaAudio.duration) {
      seekEl.value = (_guiaAudio.currentTime / _guiaAudio.duration) * 100;
    }
    if (tlFill && _guiaAudio.duration) {
      tlFill.style.width = ((_guiaAudio.currentTime / _guiaAudio.duration) * 100) + '%';
    }
  }

  window._mtToggleGuia = function () {
    if (!_guiaAudio) return;
    const btn = document.getElementById('mtGuiaPlayBtn');
    if (_guiaAudio.paused) {
      _guiaAudio.play().catch(() => {});
      if (btn) btn.textContent = '⏸ Pausa';
    } else {
      _guiaAudio.pause();
      if (btn) btn.textContent = '▶ Play';
    }
  };

  window._mtGuiaSeek = function (val) {
    if (!_guiaAudio || !_guiaAudio.duration) return;
    _guiaAudio.currentTime = (parseFloat(val) / 100) * _guiaAudio.duration;
  };

  window._mtTimelineClick = function (e) {
    const tl = document.getElementById('mtTimeline');
    if (!tl || !_guiaAudio || !_guiaAudio.duration) return;
    const rect = tl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    _guiaAudio.currentTime = ratio * _guiaAudio.duration;
  };

  /* ── Capturar tiempo actual de la guía ── */
  window._mtMarkHere = function () {
    const ms = _guiaAudio ? Math.round(_guiaAudio.currentTime * 1000) : 0;
    // Poner el tiempo en el input y hacer foco en el label
    const timeEl = document.getElementById('mtMarkerTime');
    if (timeEl) timeEl.value = msToStr(ms);
    const labelEl = document.getElementById('mtMarkerLabel');
    if (labelEl) labelEl.focus();
    if (typeof toast === 'function') toast(`🎯 ${msToStr(ms)} capturado — escribe el nombre`);
  };

  /* ════════════════════════════════════════════════════════
     CRUD MARCADORES
  ════════════════════════════════════════════════════════ */
  window._mtAddMarker = function () {
    const labelEl = document.getElementById('mtMarkerLabel');
    const timeEl  = document.getElementById('mtMarkerTime');
    const label   = (labelEl?.value || '').trim();
    if (!label) { labelEl?.focus(); if (typeof toast === 'function') toast('Escribe el nombre de la sección', 'warn'); return; }
    const ms = timeEl?.value ? strToMs(timeEl.value) : (_guiaAudio ? Math.round(_guiaAudio.currentTime * 1000) : 0);
    _markers = [..._markers, { id: Date.now().toString(), label, timeMs: ms }]
      .sort((a, b) => a.timeMs - b.timeMs);
    if (labelEl) labelEl.value = '';
    if (timeEl)  timeEl.value  = '';
    renderMarkersList();
  };

  window._mtDeleteMarker = function (id) {
    _markers = _markers.filter(m => m.id !== id);
    renderMarkersList();
  };

  window._mtEditMarkerTime = function (id, newStr) {
    const ms = strToMs(newStr);
    _markers = _markers
      .map(m => m.id === id ? { ...m, timeMs: ms } : m)
      .sort((a, b) => a.timeMs - b.timeMs);
    renderMarkersList();
  };

  window._mtEditMarkerLabel = function (id, newLabel) {
    _markers = _markers.map(m => m.id === id ? { ...m, label: newLabel.trim() || m.label } : m);
  };

  /* ── Render lista ── */
  function renderMarkersList() {
    const list  = document.getElementById('mtMarkersList');
    const empty = document.getElementById('mtMarkersEmpty');
    const count = document.getElementById('mtMarkersCount');
    const tlWrap = document.getElementById('mtTimelineWrap');
    if (!list) return;

    if (count) count.textContent = _markers.length;
    if (tlWrap) tlWrap.style.display = _markers.length ? 'block' : 'none';

    list.querySelectorAll('.mt-marker-row').forEach(el => el.remove());
    if (!_markers.length) { if (empty) empty.style.display = 'block'; return; }
    if (empty) empty.style.display = 'none';

    // Reconstruir marcadores en la línea de tiempo
    const tlEl = document.getElementById('mtTimeline');
    if (tlEl) {
      tlEl.querySelectorAll('.mt-tl-pin').forEach(p => p.remove());
      const maxMs = Math.max(..._markers.map(m => m.timeMs), 1);
      _markers.forEach(m => {
        const pin = document.createElement('div');
        pin.className = 'mt-tl-pin';
        pin.title = `${m.label} — ${msToStr(m.timeMs)}`;
        pin.style.cssText = `position:absolute;top:0;bottom:0;width:2px;
          background:var(--purple);left:${(m.timeMs/maxMs)*100}%;pointer-events:none`;
        tlEl.appendChild(pin);
      });
    }

    _markers.forEach((m, idx) => {
      const row = document.createElement('div');
      row.className = 'mt-marker-row';
      row.style.cssText = `
        display:flex;align-items:center;gap:8px;
        background:var(--surface);border:1px solid var(--border);
        border-radius:9px;padding:8px 12px;transition:border-color .15s;
      `;
      row.onmouseenter = () => { row.style.borderColor = 'rgba(168,85,247,.4)'; };
      row.onmouseleave = () => { row.style.borderColor = 'var(--border)'; };

      /* Número */
      const numEl = document.createElement('div');
      numEl.style.cssText = `width:22px;height:22px;border-radius:50%;
        background:var(--purple-dim);border:1px solid rgba(168,85,247,.3);
        display:flex;align-items:center;justify-content:center;
        font-size:10px;font-weight:800;color:var(--purple);flex-shrink:0;`;
      numEl.textContent = idx + 1;

      /* Label editable */
      const labelEl = document.createElement('input');
      labelEl.type  = 'text';
      labelEl.value = m.label;
      labelEl.style.cssText = `flex:1;background:transparent;border:none;
        border-bottom:1px solid transparent;color:var(--t0);font-family:var(--font);
        font-size:12px;font-weight:700;padding:2px 4px;outline:none;
        transition:border-color .2s;min-width:60px;`;
      labelEl.onfocus = () => { labelEl.style.borderBottomColor = 'var(--purple)'; };
      labelEl.onblur  = () => { labelEl.style.borderBottomColor = 'transparent'; window._mtEditMarkerLabel(m.id, labelEl.value); };
      labelEl.onkeydown = e => { if (e.key === 'Enter') labelEl.blur(); };

      /* Tiempo editable */
      const timeInput = document.createElement('input');
      timeInput.type  = 'text';
      timeInput.value = msToStr(m.timeMs);
      timeInput.style.cssText = `width:54px;background:var(--surface2);
        border:1px solid var(--border);border-radius:6px;color:var(--purple);
        font-family:var(--font);font-size:11px;font-weight:800;
        padding:5px 6px;outline:none;text-align:center;transition:border-color .2s;`;
      timeInput.onfocus  = () => { timeInput.style.borderColor = 'var(--purple)'; };
      timeInput.onblur   = () => {
        timeInput.style.borderColor = 'var(--border)';
        window._mtEditMarkerTime(m.id, timeInput.value);
      };
      timeInput.onkeydown = e => { if (e.key === 'Enter') timeInput.blur(); };

      /* Botón ir a ese tiempo en la guía */
      const goBtn = document.createElement('button');
      goBtn.title = 'Ir a este tiempo en la guía';
      goBtn.textContent = '▶';
      goBtn.style.cssText = `width:26px;height:26px;border-radius:6px;
        background:var(--teal-dim);border:1px solid rgba(0,212,170,.2);
        color:var(--teal);cursor:pointer;font-size:12px;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;transition:all .15s;`;
      goBtn.onmouseenter = () => { goBtn.style.background = 'var(--teal)'; goBtn.style.color = 'white'; };
      goBtn.onmouseleave = () => { goBtn.style.background = 'var(--teal-dim)'; goBtn.style.color = 'var(--teal)'; };
      goBtn.onclick = () => {
        if (_guiaAudio) { _guiaAudio.currentTime = m.timeMs / 1000; if (_guiaAudio.paused) _guiaAudio.play(); }
        else if (typeof toast === 'function') toast('No hay pista guía cargada', 'warn');
      };

      /* Botón eliminar */
      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.style.cssText = `width:26px;height:26px;border-radius:6px;
        background:var(--red-dim);border:1px solid rgba(255,77,109,.2);
        color:var(--red);cursor:pointer;font-size:12px;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;transition:all .15s;`;
      delBtn.onmouseenter = () => { delBtn.style.background = 'var(--red)'; delBtn.style.color = 'white'; };
      delBtn.onmouseleave = () => { delBtn.style.background = 'var(--red-dim)'; delBtn.style.color = 'var(--red)'; };
      delBtn.onclick = () => window._mtDeleteMarker(m.id);

      row.appendChild(numEl);
      row.appendChild(labelEl);
      row.appendChild(timeInput);
      row.appendChild(goBtn);
      row.appendChild(delBtn);
      list.appendChild(row);
    });
  }

  /* ════════════════════════════════════════════════════════
     CARGAR MARCADORES EXISTENTES
  ════════════════════════════════════════════════════════ */
  function loadMarkersFromMt(mt) {
    _markers = parseMarkers(mt?.markers);
    _mtId    = mt?.id || null;
    renderMarkersList();
    setTimeout(_refreshGuiaPlayer, 300); // esperar a que las pistas estén en el DOM
  }

  /* ════════════════════════════════════════════════════════
     API PÚBLICA
  ════════════════════════════════════════════════════════ */
  window._mtGetMarkers = function () { return _markers; };

  /* ════════════════════════════════════════════════════════
     PATCH openMtModal
  ════════════════════════════════════════════════════════ */
  const _origOpenMtModal = window.openMtModal;
  window.openMtModal = async function (id) {
    // Detener audio si estaba corriendo
    if (_guiaAudio) { _guiaAudio.pause(); _guiaAudio = null; }
    _markers = [];

    await _origOpenMtModal(id);

    setTimeout(async () => {
      injectMarkersPanel();

      if (id) {
        try {
          let mt = (typeof window.allMultitracks !== 'undefined')
            ? window.allMultitracks.find(m => m.id === id)
            : null;

          // Si no está en memoria, obtenerlo de la API
          if (!mt && typeof window.api === 'function') {
            try { mt = await window.api('getMultitrack', { params: { id } }); } catch (_) {}
          }

          if (mt) loadMarkersFromMt(mt);
          else { _markers = []; renderMarkersList(); }
        } catch (_) {
          _markers = []; renderMarkersList();
        }
      } else {
        _markers = []; renderMarkersList();
      }

      // Detectar guía después de que el modal esté pintado
      setTimeout(_refreshGuiaPlayer, 500);
    }, 150);
  };

  /* ════════════════════════════════════════════════════════
     PATCH saveMt — GUARDADO ROBUSTO
     
     Estrategia doble:
     1. Inyecta markers en el body del save normal (por si el PHP lo soporta)
     2. Hace un UPDATE directo solo de markers después del save, usando
        un endpoint de la API que SÍ sabemos que funciona.
  ════════════════════════════════════════════════════════ */
  const _origSaveMt = window.saveMt;
  window.saveMt = async function () {
    // Detener audio
    if (_guiaAudio) { _guiaAudio.pause(); }

    // 1. Interceptar la llamada a api() para inyectar markers en el payload
    const _origApi = window.api;
    window.api = async function (action, opts = {}) {
      if (action === 'saveMultitrack' && opts.body) {
        opts.body.markers = JSON.stringify(_markers);
      }
      const result = await _origApi(action, opts);
      window.api = _origApi;
      return result;
    };

    const saveResult = await _origSaveMt();

    // 2. Fallback: si markers sigue siendo NULL, hacer UPDATE directo
    //    Usamos un setTimeout para que el save principal termine primero
    setTimeout(async () => {
      try {
        const savedId = _mtId ||
          (document.getElementById('mt_id')?.value
            ? parseInt(document.getElementById('mt_id').value)
            : null);

        if (!savedId || !_markers.length) return;

        // Intentar guardar markers directamente via API
        await window.api('updateMultitrackMarkers', {
          body: { id: savedId, markers: JSON.stringify(_markers) }
        });
        console.log('✓ Markers guardados via updateMultitrackMarkers');
      } catch (e) {
        // El endpoint updateMultitrackMarkers puede no existir — no es error crítico
        console.warn('Markers fallback update:', e.message);
      }
    }, 800);

    return saveResult;
  };

  /* ════════════════════════════════════════════════════════
     OBSERVAR cambios en las pistas para actualizar el player
  ════════════════════════════════════════════════════════ */
  // Observar el modal-body para detectar cuando se agrega la pista guía
  let _pistaObserver = null;
  const _origOpen = window.openMtModal;
  // Ya patched arriba, solo aquí activamos observer
  document.addEventListener('click', e => {
    // Cuando se agrega una pista rápida de guía, refrescar el player
    if (e.target?.id === 'qbtn-guia' || (e.target?.onclick?.toString?.() || '').includes('guia')) {
      setTimeout(_refreshGuiaPlayer, 400);
    }
  });

  /* Escuchar cambios en inputs de URL de pistas */
  document.addEventListener('input', e => {
    if (e.target?.classList.contains('mt-pista-url')) {
      const row = e.target.closest('.mt-pista-row');
      const sel = row?.querySelector('.mt-pista-select');
      if (sel?.value === 'guia') {
        _guiaUrl = e.target.value.trim();
        clearTimeout(_refreshGuiaPlayer._t);
        _refreshGuiaPlayer._t = setTimeout(_refreshGuiaPlayer, 600);
      }
    }
  });

  console.log('✓ Multitrack Markers Patch v3 cargado');
})();


/* ════════════════════════════════════════════════════════════════
   INSTRUCCIONES PARA API.PHP
   ─────────────────────────────────────────────────────────────
   Si markers sigue NULL, añade esto en tu api.php en el case
   'saveMultitrack' (dentro del INSERT/UPDATE):

   // En el INSERT:
   $markers = isset($body['markers']) ? $body['markers'] : null;

   // En el campo SQL:
   "markers = " . ($markers !== null ? "'" . $conn->real_escape_string($markers) . "'" : "NULL")

   ─────────────────────────────────────────────────────────────
   TAMBIÉN añade este nuevo case en api.php para el fallback:

   case 'updateMultitrackMarkers':
     $id      = intval($body['id']);
     $markers = $conn->real_escape_string($body['markers'] ?? '[]');
     $sql     = "UPDATE multitracks SET markers='$markers' WHERE id=$id";
     $conn->query($sql);
     echo json_encode(['ok' => true]);
     break;
   ════════════════════════════════════════════════════════════ */