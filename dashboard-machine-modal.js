// WMoldes V10 - modal rápido por máquina no dashboard
// Histórico isolado da máquina, com filtros 24h/turnos e leitura robusta do Firebase.
(function(){
  'use strict';

  let chart = null;
  let currentMachine = null;
  const TZ = 'America/Sao_Paulo';
  const PERIODS = {
    '24h': { label: '24h', start: '00:00', end: '23:59', next: false },
    'shift1': { label: 'Turno 1', start: '06:00', end: '14:00', next: false },
    'shift2': { label: 'Turno 2', start: '14:00', end: '22:00', next: false },
    'shift3': { label: 'Turno 3', start: '22:00', end: '06:00', next: true }
  };

  function pad(n){ return String(n).padStart(2,'0'); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function todayISO(){
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone:TZ, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
    const o = Object.fromEntries(parts.map(p => [p.type,p.value]));
    return `${o.year}-${o.month}-${o.day}`;
  }
  function brFromISO(iso){ const [y,m,d]=String(iso||'').split('-'); return y&&m&&d ? `${d}/${m}/${y}` : ''; }
  function addDaysISO(iso, days){ const d = new Date(`${iso}T12:00:00-03:00`); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function msFromISOTime(iso, time){ return new Date(`${iso}T${time}:00-03:00`).getTime(); }
  function rangeFor(iso, period){
    const p = PERIODS[period] || PERIODS['24h'];
    const endISO = p.next ? addDaysISO(iso, 1) : iso;
    return { startMs: msFromISOTime(iso, p.start), endMs: msFromISOTime(endISO, p.end) + 59000, label: p.label, start: p.start, end: p.end };
  }
  function spParts(ts){
    const parts = new Intl.DateTimeFormat('pt-BR', { timeZone:TZ, day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(new Date(ts));
    const o = Object.fromEntries(parts.map(p => [p.type,p.value]));
    const h = o.hour === '24' ? '00' : o.hour;
    return { br:`${o.day}/${o.month}/${o.year}`, iso:`${o.year}-${o.month}-${o.day}`, hora:`${h}:${o.minute}` };
  }
  function toISOFromAnyDate(v){
    const s = String(v || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,y]=s.split('/'); return `${y}-${m}-${d}`; }
    return '';
  }
  function parseDateTimeFromRecord(r){
    const candidates = [r.timestamp, r.serverTimestamp, r.createdAt, r.updatedServerAt, r.updatedAt, r.lastUpdated, r.created_at];
    for (const c of candidates) {
      if (typeof c === 'number' && c > 0) return c;
      if (c && typeof c === 'object') {
        if (typeof c.seconds === 'number') return c.seconds * 1000;
        if (typeof c._seconds === 'number') return c._seconds * 1000;
      }
      if (typeof c === 'string') {
        if (/^\d+$/.test(c) && Number(c) > 0) return Number(c);
        const parsed = Date.parse(c);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    const iso = toISOFromAnyDate(r.dataISO || r.data || r.date || r.dia);
    const hora = String(r.hora || r.time || r.createdTime || r.horario || '00:00').slice(0,5);
    if (iso) {
      const ms = new Date(`${iso}T${hora}:00-03:00`).getTime();
      return Number.isFinite(ms) ? ms : 0;
    }
    return 0;
  }
  function normalizeRow(id, raw){
    const r = raw || {};
    const ts = parseDateTimeFromRecord(r);
    const parts = ts ? spParts(ts) : { br: r.data || '', iso: toISOFromAnyDate(r.dataISO || r.data), hora: r.hora || '' };
    return {
      id,
      timestamp: ts,
      data: r.data || parts.br,
      dataISO: r.dataISO || parts.iso,
      hora: r.hora || parts.hora,
      molde: Number(r.molde ?? r.moldes ?? r.new_molde ?? 0),
      blank: Number(r.blank ?? r.blanks ?? r.new_blank ?? 0),
      neck_ring: Number(r.neck_ring ?? r.neckRing ?? r.neckrings ?? r.new_neckring ?? 0),
      funil: Number(r.funil ?? r.funis ?? r.new_funil ?? 0),
      tipo: r.tipo || r.source || ''
    };
  }
  function aliases(machine){
    const raw = String(machine || '').trim();
    const stripped = raw.replace(/^Máquina\s+/i,'').trim();
    const digits = (stripped.match(/\d+/) || [''])[0];
    const set = new Set([raw, stripped, `Máquina ${stripped}`, `Maquina ${stripped}`]);
    if (digits) { set.add(digits); set.add(String(Number(digits))); set.add(`Máquina ${Number(digits)}`); set.add(`Maquina ${Number(digits)}`); set.add(`machine_${Number(digits)}`); set.add(`maquina_${Number(digits)}`); }
    return set;
  }
  function matchesMachine(record, parentKey, machineAliases){
    const fields = [record?.machineId, record?.machine, record?.maquina, record?.maquinaId, record?.idMaquina, record?.machine_id, parentKey]
      .filter(v => v !== undefined && v !== null).map(v => String(v).trim());
    if (fields.some(v => machineAliases.has(v) || machineAliases.has(v.replace(/^Máquina\s+/i,'').trim()))) return true;
    const path = String(record?.path || record?.targetPath || record?.ref || '');
    for (const a of machineAliases) if (a && (path.includes(`historico/${a}/`) || path.includes(`maquinas/${a}/`) || path.includes(`/${a}/`))) return true;
    return false;
  }
  function collectRows(root, machine){
    const a = aliases(machine);
    const out = [];
    const seen = new Set();
    function add(id, value, parentKey=''){
      if (!value || typeof value !== 'object') return;
      const hasData = value.timestamp || value.serverTimestamp || value.createdAt || value.updatedAt || value.hora || value.data || value.dataISO || value.molde !== undefined || value.blank !== undefined || value.neck_ring !== undefined || value.funil !== undefined;
      if (!hasData || !matchesMachine(value, parentKey, a)) return;
      const row = normalizeRow(id, value);
      if (!row.timestamp) return;
      const key = `${row.timestamp}-${row.molde}-${row.blank}-${row.neck_ring}-${row.funil}-${id}`;
      if (!seen.has(key)) { seen.add(key); out.push(row); }
    }
    for (const alias of a) {
      const branch = root?.[alias];
      if (branch && typeof branch === 'object') Object.keys(branch).forEach(k => add(`${alias}_${k}`, branch[k], alias));
    }
    Object.keys(root || {}).forEach(parent => {
      const v = root[parent];
      add(`root_${parent}`, v, parent);
      if (v && typeof v === 'object') Object.keys(v).forEach(child => add(`${parent}_${child}`, v[child], parent));
    });
    return out;
  }
  async function liveSnapshot(machine){
    try {
      let data = (window.allAdminMachines && window.allAdminMachines[machine]) || (window.allMachinesData && window.allMachinesData[machine]) || null;
      if (!data && window.db) {
        const snap = await window.db.ref(`maquinas/${machine}`).once('value');
        data = snap.val();
      }
      if (!data) return null;
      return normalizeRow('estado_atual', { machineId: machine, timestamp: Date.now(), tipo:'estado_atual', ...data });
    } catch { return null; }
  }
  async function loadRows(machine, iso, period){
    if (!window.db) throw new Error('Firebase não inicializado');
    const histSnap = await window.db.ref('historico').once('value');
    const rows = collectRows(histSnap.val() || {}, machine);
    const { startMs, endMs } = rangeFor(iso, period);
    let filtered = rows.filter(r => r.timestamp >= startMs && r.timestamp <= endMs).sort((a,b)=>a.timestamp-b.timestamp);
    const live = await liveSnapshot(machine);
    if (live && live.timestamp >= startMs && live.timestamp <= endMs) {
      const last = filtered[filtered.length - 1];
      if (!last || last.molde !== live.molde || last.blank !== live.blank || last.neck_ring !== live.neck_ring || last.funil !== live.funil) filtered.push(live);
    }
    return filtered.sort((a,b)=>a.timestamp-b.timestamp);
  }
  function ensureModal(){
    let overlay = document.getElementById('wmMachineQuickModal');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'wmMachineQuickModal';
    overlay.className = 'wm-machine-modal-overlay';
    overlay.innerHTML = `
      <div class="wm-machine-modal-card" role="dialog" aria-modal="true" aria-labelledby="wmMachineModalTitle">
        <button class="wm-machine-modal-close" type="button" onclick="wmFecharModalMaquinaDashboard()" title="Fechar"><i class="fas fa-times"></i></button>
        <div class="wm-machine-modal-header">
          <div><h2 id="wmMachineModalTitle"><i class="fas fa-industry"></i> Máquina</h2><p>Histórico filtrado somente desta máquina.</p></div>
          <div class="wm-machine-modal-summary" id="wmMachineModalSummary"></div>
        </div>
        <div class="wm-machine-modal-filters">
          <label>Data <input type="date" id="wmMachineModalDate"></label>
          <div class="wm-machine-periods">
            <button type="button" data-wm-period="24h" class="active">24h</button>
            <button type="button" data-wm-period="shift1">Turno 1 <small>06:00 - 14:00</small></button>
            <button type="button" data-wm-period="shift2">Turno 2 <small>14:00 - 22:00</small></button>
            <button type="button" data-wm-period="shift3">Turno 3 <small>22:00 - 06:00</small></button>
          </div>
          <button type="button" class="wm-machine-apply" onclick="wmRecarregarModalMaquinaDashboard()"><i class="fas fa-sync-alt"></i> Aplicar</button>
        </div>
        <div class="wm-machine-modal-chart-wrap"><canvas id="wmMachineModalChart"></canvas><div id="wmMachineModalEmpty" class="wm-machine-modal-empty" hidden>Nenhum dado encontrado para este período.</div></div>
        <div class="wm-machine-modal-table-wrap"><table><thead><tr><th>Data</th><th>Hora</th><th>Moldes</th><th>Blanks</th><th>Neck Rings</th><th>Funís</th></tr></thead><tbody id="wmMachineModalTable"></tbody></table></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) window.wmFecharModalMaquinaDashboard(); });
    overlay.querySelectorAll('[data-wm-period]').forEach(btn => btn.addEventListener('click', () => {
      overlay.querySelectorAll('[data-wm-period]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window.wmRecarregarModalMaquinaDashboard();
    }));
    overlay.querySelector('#wmMachineModalDate').addEventListener('change', () => window.wmRecarregarModalMaquinaDashboard());
    return overlay;
  }
  function activePeriod(){ return document.querySelector('#wmMachineQuickModal [data-wm-period].active')?.dataset.wmPeriod || '24h'; }
  function render(rows, machine, iso, period){
    const canvas = document.getElementById('wmMachineModalChart');
    const empty = document.getElementById('wmMachineModalEmpty');
    const tbody = document.getElementById('wmMachineModalTable');
    const summary = document.getElementById('wmMachineModalSummary');
    const range = rangeFor(iso, period);
    summary.innerHTML = `<strong>${rows.length}</strong><span>registro(s)</span><small>${brFromISO(iso)} · ${range.label}</small>`;
    tbody.innerHTML = rows.map(r => `<tr><td>${esc(r.data)}</td><td>${esc(r.hora)}</td><td>${r.molde}</td><td>${r.blank}</td><td>${r.neck_ring}</td><td>${r.funil}</td></tr>`).join('');
    empty.hidden = rows.length > 0;
    empty.style.display = rows.length > 0 ? 'none' : 'flex';
    if (chart && typeof chart.destroy === 'function') chart.destroy();
    chart = null;
    if (!window.Chart || !canvas || rows.length === 0) return;
    chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels: rows.map(r => `${r.hora} (${String(r.data||'').slice(0,5)})`), datasets: [
        { label:'Moldes', data:rows.map(r=>r.molde), borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.08)', tension:.25, fill:false },
        { label:'Blanks', data:rows.map(r=>r.blank), borderColor:'#475569', backgroundColor:'rgba(71,85,105,.08)', tension:.25, fill:false },
        { label:'Neck Rings', data:rows.map(r=>r.neck_ring), borderColor:'#d97706', backgroundColor:'rgba(217,119,6,.08)', tension:.25, fill:false, hidden:true },
        { label:'Funís', data:rows.map(r=>r.funil), borderColor:'#9ca3af', backgroundColor:'rgba(156,163,175,.08)', tension:.25, fill:false, hidden:true }
      ] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'top' } }, scales:{ y:{ beginAtZero:true } } }
    });
  }

  window.wmAbrirModalMaquinaDashboard = async function(machineId){
    currentMachine = String(machineId).replace(/^Máquina\s+/i,'').trim();
    const overlay = ensureModal();
    overlay.querySelector('#wmMachineModalTitle').innerHTML = `<i class="fas fa-industry"></i> Máquina ${esc(currentMachine)}`;
    overlay.querySelector('#wmMachineModalDate').value = todayISO();
    overlay.querySelectorAll('[data-wm-period]').forEach(b => b.classList.toggle('active', b.dataset.wmPeriod === '24h'));
    overlay.classList.add('open');
    await window.wmRecarregarModalMaquinaDashboard();
  };

  window.wmRecarregarModalMaquinaDashboard = async function(){
    if (!currentMachine) return;
    const overlay = ensureModal();
    const iso = overlay.querySelector('#wmMachineModalDate').value || todayISO();
    const period = activePeriod();
    const empty = overlay.querySelector('#wmMachineModalEmpty');
    empty.hidden = false;
    empty.style.display = 'flex';
    empty.textContent = 'Carregando...';
    try {
      const rows = await loadRows(currentMachine, iso, period);
      empty.textContent = 'Nenhum dado encontrado para este período.';
      render(rows, currentMachine, iso, period);
    } catch (err) {
      console.error('Erro no modal rápido da máquina:', err);
      empty.hidden = false;
      empty.style.display = 'flex';
      empty.textContent = 'Erro ao carregar histórico desta máquina.';
    }
  };
  window.wmFecharModalMaquinaDashboard = function(){ document.getElementById('wmMachineQuickModal')?.classList.remove('open'); };
})();


// V11: abrir o gráfico ao clicar no card da máquina, não apenas no texto do título.
document.addEventListener('click', function wmDashboardMachineCardDelegatedClick(event) {
  const card = event.target.closest && event.target.closest('.machine-card[data-machine-id]');
  if (!card) return;
  if (event.target.closest('button, a, input, select, textarea, .details-btn, .carousel-btn, .wm-card-time-meta')) return;
  const id = card.getAttribute('data-machine-id');
  if (id && typeof window.wmAbrirModalMaquinaDashboard === 'function') {
    event.preventDefault();
    event.stopPropagation();
    window.wmAbrirModalMaquinaDashboard(id);
  }
}, true);
