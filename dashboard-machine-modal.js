// WMoldes - modal rápido por máquina no dashboard
// Mostra histórico da máquina com filtro por data e turno, sem sair da tela principal.
(function(){
  'use strict';

  let chart = null;
  let currentMachine = null;

  const PERIODS = {
    '24h': { label: '24h', start: '00:00', end: '23:59', next: false },
    'shift1': { label: 'Turno 1', start: '06:00', end: '14:00', next: false },
    'shift2': { label: 'Turno 2', start: '14:00', end: '22:00', next: false },
    'shift3': { label: 'Turno 3', start: '22:00', end: '06:00', next: true }
  };

  function pad(n){ return String(n).padStart(2,'0'); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function todayISO(){
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
    const o = Object.fromEntries(parts.map(p => [p.type,p.value]));
    return `${o.year}-${o.month}-${o.day}`;
  }
  function brFromISO(iso){ const [y,m,d]=String(iso||'').split('-'); return y&&m&&d ? `${d}/${m}/${y}` : ''; }
  function addDaysISO(iso, days){ const d = new Date(`${iso}T12:00:00-03:00`); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function msFromISOTime(iso, time){ return new Date(`${iso}T${time}:00-03:00`).getTime(); }
  function rangeFor(iso, period){
    const p = PERIODS[period] || PERIODS['24h'];
    const endISO = p.next ? addDaysISO(iso, 1) : iso;
    return { startMs: msFromISOTime(iso, p.start), endMs: msFromISOTime(endISO, p.end), label: p.label, start: p.start, end: p.end };
  }
  function spParts(ts){
    const parts = new Intl.DateTimeFormat('pt-BR', { timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(new Date(ts));
    const o = Object.fromEntries(parts.map(p => [p.type,p.value]));
    return { br:`${o.day}/${o.month}/${o.year}`, hora:`${o.hour}:${o.minute}` };
  }
  function parseDateTimeFromRecord(r){
    const numeric = Number(r.timestamp || r.createdAt || r.updatedAt || r.serverTimestamp || r.updatedServerAt || 0);
    if (numeric > 0) return numeric;
    const data = r.dataISO || (String(r.data||'').includes('/') ? String(r.data).split('/').reverse().join('-') : r.data);
    const hora = r.hora || r.time || r.createdTime || '00:00';
    if (data) {
      const ms = new Date(`${data}T${String(hora).slice(0,5)}:00-03:00`).getTime();
      return Number.isFinite(ms) ? ms : 0;
    }
    return 0;
  }
  function normalizeRow(id, raw){
    const r = raw || {};
    const ts = parseDateTimeFromRecord(r);
    const parts = ts ? spParts(ts) : { br: r.data || '', hora: r.hora || '' };
    return {
      id,
      timestamp: ts,
      data: r.data || parts.br,
      hora: r.hora || parts.hora,
      molde: Number(r.molde ?? r.moldes ?? 0),
      blank: Number(r.blank ?? r.blanks ?? 0),
      neck_ring: Number(r.neck_ring ?? r.neckRing ?? r.neckrings ?? 0),
      funil: Number(r.funil ?? r.funis ?? 0),
      tipo: r.tipo || r.source || ''
    };
  }
  async function loadRows(machine, iso, period){
    if (!window.db) throw new Error('Firebase não inicializado');
    const snap = await window.db.ref(`historico/${machine}`).once('value');
    const rows = [];
    snap.forEach(child => rows.push(normalizeRow(child.key, child.val())));
    const { startMs, endMs } = rangeFor(iso, period);
    return rows
      .filter(r => r.timestamp >= startMs && r.timestamp <= endMs)
      .filter(r => !r.tipo || String(r.tipo).includes('real_time') || String(r.tipo).includes('debounce') || String(r.tipo).includes('manual') || String(r.tipo).includes('history'))
      .sort((a,b)=>a.timestamp-b.timestamp);
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
          <div>
            <h2 id="wmMachineModalTitle"><i class="fas fa-industry"></i> Máquina</h2>
            <p>Histórico filtrado somente desta máquina.</p>
          </div>
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
        <div class="wm-machine-modal-table-wrap"><table><thead><tr><th>Hora</th><th>Moldes</th><th>Blanks</th><th>Neck Rings</th><th>Funís</th></tr></thead><tbody id="wmMachineModalTable"></tbody></table></div>
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
    tbody.innerHTML = rows.map(r => `<tr><td>${esc(r.hora)}</td><td>${r.molde}</td><td>${r.blank}</td><td>${r.neck_ring}</td><td>${r.funil}</td></tr>`).join('');
    empty.hidden = rows.length > 0;

    if (chart && typeof chart.destroy === 'function') chart.destroy();
    chart = null;
    if (!window.Chart || !canvas || rows.length === 0) return;
    chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: rows.map(r => `${r.hora}${r.data ? ' · '+r.data.slice(0,5) : ''}`),
        datasets: [
          { label:'Moldes', data:rows.map(r=>r.molde), borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.08)', tension:.25, fill:false },
          { label:'Blanks', data:rows.map(r=>r.blank), borderColor:'#475569', backgroundColor:'rgba(71,85,105,.08)', tension:.25, fill:false },
          { label:'Neck Rings', data:rows.map(r=>r.neck_ring), borderColor:'#d97706', backgroundColor:'rgba(217,119,6,.08)', tension:.25, fill:false, hidden:true },
          { label:'Funís', data:rows.map(r=>r.funil), borderColor:'#9ca3af', backgroundColor:'rgba(156,163,175,.08)', tension:.25, fill:false, hidden:true }
        ]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'top' } }, scales:{ y:{ beginAtZero:true } } }
    });
  }

  window.wmAbrirModalMaquinaDashboard = async function(machineId){
    currentMachine = machineId;
    const overlay = ensureModal();
    overlay.querySelector('#wmMachineModalTitle').innerHTML = `<i class="fas fa-industry"></i> Máquina ${esc(machineId)}`;
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
    empty.textContent = 'Carregando...';
    try {
      const rows = await loadRows(currentMachine, iso, period);
      empty.textContent = 'Nenhum dado encontrado para este período.';
      render(rows, currentMachine, iso, period);
    } catch (err) {
      console.error('Erro no modal rápido da máquina:', err);
      empty.hidden = false;
      empty.textContent = 'Erro ao carregar histórico desta máquina.';
    }
  };

  window.wmFecharModalMaquinaDashboard = function(){
    const overlay = document.getElementById('wmMachineQuickModal');
    if (overlay) overlay.classList.remove('open');
  };
})();
