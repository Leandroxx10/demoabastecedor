/* =========================================================
   WMoldes - Núcleo de histórico confiável
   Corrige: fuso America/Sao_Paulo, concorrência entre abas,
   registros invisíveis no gráfico e horário real do lançamento.
   ========================================================= */
(function () {
  'use strict';

  const TZ = 'America/Sao_Paulo';
  const FIELDS = ['molde', 'blank', 'neck_ring', 'funil'];
  let serverOffsetMs = 0;

  function n(value) {
    const num = parseInt(value, 10);
    return Number.isFinite(num) ? Math.max(0, num) : 0;
  }

  function normalizeField(field) {
    const raw = String(field || '').trim();
    if (/^neck_?ring$|^neckring$|^new_neckring$/i.test(raw)) return 'neck_ring';
    if (/^new_molde$/i.test(raw)) return 'molde';
    if (/^new_blank$/i.test(raw)) return 'blank';
    if (/^new_funil$/i.test(raw)) return 'funil';
    return raw;
  }

  function normalizeMachineValues(data) {
    data = data || {};
    return {
      molde: n(data.molde ?? data.new_molde),
      blank: n(data.blank ?? data.new_blank),
      neck_ring: n(data.neck_ring ?? data.neckRing ?? data.neckring ?? data.new_neckring),
      funil: n(data.funil ?? data.new_funil)
    };
  }

  function getSPParts(ms) {
    const date = new Date(Number(ms || Date.now()));
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(date).reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    const hour = parts.hour === '24' ? '00' : parts.hour;
    return {
      dia: parts.day, mes: parts.month, ano: parts.year,
      hora: hour, minuto: parts.minute, segundo: parts.second,
      dataBR: `${parts.day}/${parts.month}/${parts.year}`,
      dataISO: `${parts.year}-${parts.month}-${parts.day}`,
      horaMinuto: `${hour}:${parts.minute}`,
      horaCompleta: `${hour}:${parts.minute}:${parts.second}`,
      horaNum: parseInt(hour, 10) || 0,
      minutoNum: parseInt(parts.minute, 10) || 0
    };
  }

  function getServerNowMs() {
    return Date.now() + serverOffsetMs;
  }

  function safeKey(value) {
    return String(value || '').replace(/[.#$\/[\]]/g, '_').replace(/\s+/g, '_').slice(0, 180);
  }

  function hasChanged(previous, current) {
    if (!previous) return true;
    const prev = normalizeMachineValues(previous);
    const cur = normalizeMachineValues(current);
    return FIELDS.some(field => n(prev[field]) !== n(cur[field]));
  }

  async function ensureRefs() {
    if (!window.firebase || !window.db) throw new Error('Firebase ainda não foi inicializado.');
    if (!window.maquinasRef) window.maquinasRef = window.db.ref('maquinas');
    if (!window.historicoRef) window.historicoRef = window.db.ref('historico');
  }

  async function readMachine(machineId) {
    await ensureRefs();
    const snap = await window.maquinasRef.child(machineId).once('value');
    return snap.val() || {};
  }

  async function saveMachineSnapshot(machineId, machineData, meta) {
    await ensureRefs();
    machineId = String(machineId || '').trim();
    if (!machineId) return null;

    const values = normalizeMachineValues(machineData || {});
    const eventTimeMs = Number(meta && meta.eventTimeMs) || getServerNowMs();
    const sp = getSPParts(eventTimeMs);
    const field = normalizeField(meta && meta.field);
    const origem = (meta && meta.origem) || 'sistema';
    const idSeed = `${sp.ano}${sp.mes}${sp.dia}_${sp.hora}${sp.minuto}${sp.segundo}_${String(eventTimeMs % 1000).padStart(3, '0')}_${safeKey(origem)}_${safeKey(field || 'snapshot')}`;
    const ref = window.historicoRef.child(machineId).child(`rt_${idSeed}`);

    let lastValues = null;
    try {
      const lastSnap = await window.historicoRef.child(machineId).orderByChild('timestamp').limitToLast(1).once('value');
      lastSnap.forEach(child => { lastValues = child.val(); });
    } catch (_) {}

    if (lastValues && !hasChanged(lastValues, values)) return null;

    const registro = {
      machineId,
      data: sp.dataBR,
      dataISO: sp.dataISO,
      hora: sp.horaMinuto,
      horaCompleta: sp.horaCompleta,
      horaNum: sp.horaNum,
      minutoNum: sp.minutoNum,
      timestamp: eventTimeMs,
      serverTimestamp: window.firebase.database.ServerValue.TIMESTAMP,
      createdAt: window.firebase.database.ServerValue.TIMESTAMP,
      molde: values.molde,
      blank: values.blank,
      neck_ring: values.neck_ring,
      funil: values.funil,
      mudancas: {
        molde: values.molde - n(lastValues && (lastValues.molde ?? lastValues.new_molde)),
        blank: values.blank - n(lastValues && (lastValues.blank ?? lastValues.new_blank)),
        neck_ring: values.neck_ring - n(lastValues && (lastValues.neck_ring ?? lastValues.neckring ?? lastValues.new_neckring)),
        funil: values.funil - n(lastValues && (lastValues.funil ?? lastValues.new_funil))
      },
      tipo: 'real_time',
      origem,
      source: (meta && meta.source) || origem,
      field: field || '',
      uid: (window.firebase.auth && window.firebase.auth().currentUser && window.firebase.auth().currentUser.uid) || '',
      user: (window.firebase.auth && window.firebase.auth().currentUser && window.firebase.auth().currentUser.email) || '',
      clientSavedAt: new Date(eventTimeMs).toISOString()
    };

    const tx = await ref.transaction(current => current || registro);
    return tx.committed ? registro : null;
  }

  async function saveSnapshotFromFirebase(machineId, meta) {
    const data = await readMachine(machineId);
    return saveMachineSnapshot(machineId, data, meta || {});
  }

  async function atomicDelta(machineId, field, delta, meta) {
    await ensureRefs();
    const normalizedField = normalizeField(field);
    const eventTimeMs = getServerNowMs();
    const ref = window.maquinasRef.child(machineId).child(normalizedField);
    let committedValue = 0;
    const result = await ref.transaction(current => {
      const next = Math.max(0, n(current) + Number(delta || 0));
      committedValue = next;
      return next;
    });
    if (!result.committed) throw new Error('Transação cancelada pelo Firebase.');
    committedValue = n(result.snapshot && result.snapshot.val());
    const machineData = await readMachine(machineId);
    await saveMachineSnapshot(machineId, machineData, {
      ...(meta || {}),
      eventTimeMs,
      field: normalizedField,
      origem: (meta && meta.origem) || 'botao_rapido',
      source: 'atomic_transaction'
    });
    return committedValue;
  }

  async function setFieldAndSnapshot(machineId, field, value, meta) {
    await ensureRefs();
    const normalizedField = normalizeField(field);
    const eventTimeMs = getServerNowMs();
    await window.maquinasRef.child(machineId).child(normalizedField).set(n(value));
    const machineData = await readMachine(machineId);
    await saveMachineSnapshot(machineId, machineData, {
      ...(meta || {}),
      eventTimeMs,
      field: normalizedField,
      origem: (meta && meta.origem) || 'digitacao_manual',
      source: 'set_field_snapshot'
    });
    return n(value);
  }

  function startOffsetListener() {
    try {
      if (!window.firebase || !window.db) return;
      window.db.ref('.info/serverTimeOffset').on('value', snap => {
        const offset = Number(snap.val() || 0);
        if (Number.isFinite(offset)) serverOffsetMs = offset;
      });
    } catch (err) {
      console.warn('[WMHistory] Não foi possível ler serverTimeOffset:', err);
    }
  }

  window.WMHistory = {
    TZ,
    normalizeField,
    normalizeMachineValues,
    getSPParts,
    getServerNowMs,
    saveMachineSnapshot,
    saveSnapshotFromFirebase,
    atomicDelta,
    setFieldAndSnapshot,
    readMachine
  };

  startOffsetListener();
})();
