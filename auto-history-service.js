// ================= SERVIÇO DE HISTÓRICO =================
// V3: registra somente alterações reais confirmadas.
// Debounce único por máquina: se Molde e Blank forem alterados em sequência,
// aguarda a máquina estabilizar e salva UM único snapshot com todos os campos.

(function () {
  'use strict';

  const DEBOUNCE_MS = 10 * 1000;
  const SAFETY_POLL_INTERVAL = 5 * 1000;
  const FIELDS = ['molde', 'blank', 'neck_ring', 'funil'];

  let confirmedValues = {};       // último estado salvo/confirmado por máquina
  let pendingTimers = {};         // um timer por máquina
  let pendingValues = {};         // último estado pendente por máquina
  let pendingFirstSeen = {};      // quando a janela de debounce começou
  let isRunning = false;

  const checkFirebase = setInterval(() => {
    if (typeof maquinasRef !== 'undefined' && typeof historicoRef !== 'undefined') {
      clearInterval(checkFirebase);
      startService();
    }
  }, 500);

  function startService() {
    if (isRunning) return;
    isRunning = true;

    loadInitialValues().then(() => {
      monitorRealtimeChanges();
      setInterval(runSafetyPolling, SAFETY_POLL_INTERVAL);
      console.log('✅ Histórico V3 ativo: debounce único por máquina, snapshot único por alteração agrupada');
    });
  }

  function parseNum(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function extractMachineValues(machineData) {
    machineData = machineData || {};
    return {
      molde: parseNum(machineData.molde ?? machineData.new_molde),
      blank: parseNum(machineData.blank ?? machineData.new_blank),
      neck_ring: parseNum(machineData.neck_ring ?? machineData.neckRing ?? machineData.neckring ?? machineData.new_neckring),
      funil: parseNum(machineData.funil ?? machineData.new_funil)
    };
  }

  function getSaoPauloParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).formatToParts(date).reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});

    return {
      dia: parts.day,
      mes: parts.month,
      ano: parts.year,
      hora: parts.hour === '24' ? '00' : parts.hour,
      minuto: parts.minute,
      segundo: parts.second
    };
  }

  function getSaoPauloTime(baseMs) {
    const now = new Date(Number(baseMs || Date.now()));
    const p = getSaoPauloParts(now);
    return {
      dataBR: `${p.dia}/${p.mes}/${p.ano}`,
      dataISO: `${p.ano}-${p.mes}-${p.dia}`,
      horaMinuto: `${p.hora}:${p.minuto}`,
      horaCompleta: `${p.hora}:${p.minuto}:${p.segundo}`,
      horaNum: parseInt(p.hora, 10) || 0,
      minutoNum: parseInt(p.minuto, 10) || 0,
      timestamp: now.getTime(),
      keyStamp: `${p.ano}${p.mes}${p.dia}_${p.hora}${p.minuto}${p.segundo}_${String(now.getMilliseconds()).padStart(3, '0')}`
    };
  }

  function valuesDiffer(a, b) {
    return FIELDS.some(field => parseNum(a?.[field]) !== parseNum(b?.[field]));
  }

  function changedMap(previous, current) {
    const out = {};
    FIELDS.forEach(field => {
      const diff = parseNum(current?.[field]) - parseNum(previous?.[field]);
      if (diff !== 0) out[field] = diff;
    });
    return out;
  }

  async function loadInitialValues() {
    try {
      const snapshot = await maquinasRef.once('value');
      const machines = snapshot.val() || {};
      Object.keys(machines).forEach(machineId => {
        confirmedValues[machineId] = extractMachineValues(machines[machineId]);
      });
      console.log('✅ Estado inicial carregado para histórico:', Object.keys(machines).length, 'máquinas');
    } catch (error) {
      console.error('❌ Erro ao carregar estado inicial do histórico:', error);
    }
  }

  function ensureMachineState(machineId) {
    if (!confirmedValues[machineId]) confirmedValues[machineId] = { molde: 0, blank: 0, neck_ring: 0, funil: 0 };
  }

  function scheduleMachineSnapshot(machineId, currentValues, source) {
    ensureMachineState(machineId);
    currentValues = extractMachineValues(currentValues || {});

    // Se voltou exatamente ao estado salvo, cancela pendência.
    if (!valuesDiffer(confirmedValues[machineId], currentValues)) {
      if (pendingTimers[machineId]) clearTimeout(pendingTimers[machineId]);
      delete pendingTimers[machineId];
      delete pendingValues[machineId];
      delete pendingFirstSeen[machineId];
      return;
    }

    pendingValues[machineId] = currentValues;
    if (!pendingFirstSeen[machineId]) pendingFirstSeen[machineId] = Date.now();

    // Debounce único por máquina: qualquer alteração reinicia a espera.
    if (pendingTimers[machineId]) clearTimeout(pendingTimers[machineId]);
    pendingTimers[machineId] = setTimeout(() => {
      confirmAndSaveMachine(machineId, source || 'unknown');
    }, DEBOUNCE_MS);
  }

  async function confirmAndSaveMachine(machineId, source) {
    try {
      ensureMachineState(machineId);
      delete pendingTimers[machineId];

      const snap = await maquinasRef.child(machineId).once('value');
      const currentValues = extractMachineValues(snap.val() || {});

      // Se houve nova alteração enquanto o timer vencia, reinicia a janela.
      const pending = pendingValues[machineId];
      if (pending && valuesDiffer(pending, currentValues)) {
        scheduleMachineSnapshot(machineId, currentValues, `${source}_rechecked`);
        return;
      }

      if (!valuesDiffer(confirmedValues[machineId], currentValues)) {
        delete pendingValues[machineId];
        delete pendingFirstSeen[machineId];
        return;
      }

      await saveConfirmedSnapshot(machineId, currentValues, source);
      confirmedValues[machineId] = { ...currentValues };
      delete pendingValues[machineId];
      delete pendingFirstSeen[machineId];
    } catch (error) {
      console.error(`❌ Erro ao confirmar/salvar histórico da máquina ${machineId}:`, error);
    }
  }

  async function saveConfirmedSnapshot(machineId, valores, source) {
    try {
      const sp = getSaoPauloTime(Date.now());

      const lastSnap = await historicoRef.child(machineId).orderByChild('timestamp').limitToLast(1).once('value');
      let lastRecord = null;
      lastSnap.forEach(child => { lastRecord = child.val(); });

      const lastValues = lastRecord ? extractMachineValues(lastRecord) : null;
      if (lastValues && !valuesDiffer(lastValues, valores)) return;

      const mudancas = changedMap(lastValues || confirmedValues[machineId], valores);
      const registro = {
        machineId,
        data: sp.dataBR,
        dataISO: sp.dataISO,
        hora: sp.horaMinuto,
        horaCompleta: sp.horaCompleta,
        horaNum: sp.horaNum,
        minutoNum: sp.minutoNum,
        timestamp: sp.timestamp,
        serverTimestamp: firebase.database.ServerValue.TIMESTAMP,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        molde: parseNum(valores.molde),
        blank: parseNum(valores.blank),
        neck_ring: parseNum(valores.neck_ring),
        funil: parseNum(valores.funil),
        mudancas,
        camposAlterados: Object.keys(mudancas),
        tipo: 'real_time',
        source: `debounce_maquina_${source || 'unknown'}`,
        confirmedDelayMs: DEBOUNCE_MS,
        debounceStartedAt: pendingFirstSeen[machineId] || null,
        created_at: new Date().toISOString()
      };

      await historicoRef.child(machineId).child(`rt_${sp.keyStamp}`).set(registro);
      console.log(`✅ Histórico V3 salvo uma vez ${machineId}: M:${registro.molde} BL:${registro.blank} N:${registro.neck_ring} F:${registro.funil} Campos: ${registro.camposAlterados.join(',')}`);
    } catch (error) {
      console.error(`❌ Erro ao salvar histórico da máquina ${machineId}:`, error);
    }
  }

  function monitorRealtimeChanges() {
    maquinasRef.on('child_changed', snapshot => {
      const machineId = snapshot.key;
      const values = extractMachineValues(snapshot.val() || {});
      scheduleMachineSnapshot(machineId, values, 'firebase_child_changed');
    });

    maquinasRef.on('child_added', snapshot => {
      const machineId = snapshot.key;
      if (!confirmedValues[machineId]) confirmedValues[machineId] = extractMachineValues(snapshot.val() || {});
    });
  }

  async function runSafetyPolling() {
    try {
      const snapshot = await maquinasRef.once('value');
      const machines = snapshot.val() || {};
      Object.keys(machines).forEach(machineId => {
        const values = extractMachineValues(machines[machineId]);
        scheduleMachineSnapshot(machineId, values, 'safety_polling');
      });
    } catch (error) {
      console.error('❌ Erro no polling do histórico:', error);
    }
  }

  window.getHistoryByDate = async function (machineId, dataBR) {
    const snapshot = await historicoRef.child(machineId).once('value');
    const dados = snapshot.val() || {};
    return Object.values(dados)
      .filter(item => item && item.tipo === 'real_time' && item.data === dataBR)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  };

  window.getMachineHistoryByDate = async function (machineId, dateISO) {
    if (!machineId || !dateISO) return [];
    const [ano, mes, dia] = String(dateISO).split('-');
    const dataBR = `${dia}/${mes}/${ano}`;
    const lista = await window.getHistoryByDate(machineId, dataBR);
    return lista.map(item => ({
      ...item,
      hora: parseNum(item.horaNum),
      minuto: parseNum(item.minutoNum)
    }));
  };

  window.forceManualRecord = async function (machineId) {
    const id = machineId || (document.getElementById('historyMachineSelect')?.value || '').replace(/^Máquina\s+/i, '').trim();
    if (!id) return false;
    const snap = await maquinasRef.child(id).once('value');
    const values = extractMachineValues(snap.val() || {});
    await saveConfirmedSnapshot(id, values, 'manual');
    confirmedValues[id] = values;
    return true;
  };

  window.WMHistoryDebounce = {
    scheduleMachineSnapshot,
    confirmAndSaveMachine,
    delayMs: DEBOUNCE_MS
  };
})();
