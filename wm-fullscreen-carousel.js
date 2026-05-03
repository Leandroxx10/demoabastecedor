/* WMoldes - Tela Cheia: carrossel único automático com controles profissionais */
(function () {
  'use strict';

  const STORAGE = {
    speed: 'wmoldes_fs_speed_seconds',
    perPage: 'wmoldes_fs_cards_per_slide',
    includeHidden: 'wmoldes_fs_include_all_machines',
    showMaintenance: 'wmoldes_fs_show_maintenance'
  };

  const state = {
    active: false,
    index: 0,
    dir: 1,
    timer: null,
    speed: Number(localStorage.getItem(STORAGE.speed) || 6),
    perPage: Number(localStorage.getItem(STORAGE.perPage) || 1),
    includeHidden: localStorage.getItem(STORAGE.includeHidden) === 'true',
    showMaintenance: localStorage.getItem(STORAGE.showMaintenance) !== 'false',
    sourceCards: []
  };

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  function isMaintenance(card) {
    return card?.dataset?.maintenance === 'true' || card?.classList?.contains('maintenance') || /manuten[cç][aã]o/i.test(card?.textContent || '');
  }

  function isVisible(card) {
    const st = getComputedStyle(card);
    return st.display !== 'none' && st.visibility !== 'hidden' && card.offsetParent !== null;
  }

  function getCards() {
    let list = qsa('#fornoSections .machine-card, #cardsContainer .machine-card');
    const seen = new Set();
    list = list.filter(card => {
      const id = card.dataset.machineId || card.textContent.trim().slice(0, 60);
      if (seen.has(id)) return false;
      seen.add(id);
      if (!state.includeHidden && !isVisible(card)) return false;
      if (!state.showMaintenance && isMaintenance(card)) return false;
      return true;
    });
    return list;
  }

  function chunkCards(cards, size) {
    const chunks = [];
    for (let i = 0; i < cards.length; i += size) chunks.push(cards.slice(i, i + size));
    return chunks;
  }

  function copyCanvasPixels(srcCanvas, dstCanvas) {
    if (!srcCanvas || !dstCanvas) return;
    try {
      const srcW = srcCanvas.width || 100;
      const srcH = srcCanvas.height || 100;
      dstCanvas.width = srcW;
      dstCanvas.height = srcH;
      const ctx = dstCanvas.getContext('2d');
      ctx.clearRect(0, 0, srcW, srcH);
      ctx.drawImage(srcCanvas, 0, 0, srcW, srcH);
    } catch (_) {}
  }

  function copyCanvasesBetween(srcCard, dstCard) {
    if (!srcCard || !dstCard) return;
    const srcCanvases = qsa('canvas', srcCard);
    const dstCanvases = qsa('canvas', dstCard);
    srcCanvases.forEach((srcCanvas, index) => copyCanvasPixels(srcCanvas, dstCanvases[index]));
  }

  function copyCanvases(srcCards, dstRoot) {
    const dstCards = qsa('.machine-card', dstRoot);
    srcCards.forEach((src, i) => copyCanvasesBetween(src, dstCards[i]));
  }

  function setSpeed(v) {
    state.speed = Math.max(2, Math.min(30, Number(v) || 6));
    localStorage.setItem(STORAGE.speed, String(state.speed));
    qsa('#fullscreenSpeedRange,#wmFsSpeedRange').forEach(e => e.value = state.speed);
    qsa('#fullscreenSpeedValue,#wmFsSpeedValue').forEach(e => e.textContent = state.speed + 's');
    restart();
  }

  function setPerPage(v) {
    state.perPage = Math.max(1, Math.min(4, Number(v) || 1));
    localStorage.setItem(STORAGE.perPage, String(state.perPage));
    const input = qs('#wmFsCardsPerSlide');
    const value = qs('#wmFsCardsPerSlideValue');
    if (input) input.value = state.perPage;
    if (value) value.textContent = state.perPage;
    if (state.active) rebuildOverlay();
  }

  function setIncludeHidden(v) {
    state.includeHidden = !!v;
    localStorage.setItem(STORAGE.includeHidden, String(state.includeHidden));
    if (state.active) rebuildOverlay();
  }

  function setShowMaintenance(v) {
    state.showMaintenance = !!v;
    localStorage.setItem(STORAGE.showMaintenance, String(state.showMaintenance));
    if (state.active) rebuildOverlay();
  }

  function findSourceCardForClone(clone) {
    const id = clone?.dataset?.machineId;
    if (!id) return null;
    return qsa('#fornoSections .machine-card, #cardsContainer .machine-card').find(card => card.dataset.machineId === id) || null;
  }

  function refreshCloneFromSource(clone, source) {
    if (!clone || !source) return;
    clone.innerHTML = source.innerHTML;
    clone.className = source.className;
    clone.dataset.machineId = source.dataset.machineId || '';
    clone.dataset.forno = source.dataset.forno || '';
    clone.dataset.maintenance = source.dataset.maintenance || 'false';
    clone.dataset.status = source.dataset.status || '';
    clone.removeAttribute('id');
    qsa('[id]', clone).forEach(el => el.removeAttribute('id'));
    copyCanvasesBetween(source, clone);
    clone.style.transform = 'translateZ(0)';
  }

  function refreshVisibleFullscreenCards() {
    const overlay = qs('#wmFullscreenCarouselOverlay');
    if (!overlay || !state.active) return;

    const sourceNow = getCards();
    const sourceIds = sourceNow.map(card => card.dataset.machineId).filter(Boolean).join('|');
    const cloneIds = qsa('.wm-fs-slide .machine-card', overlay).map(card => card.dataset.machineId).filter(Boolean).join('|');

    // Se entrou/saiu máquina por filtro/manutenção, recria uma vez no ponto seguro da troca.
    if (sourceIds !== cloneIds) {
      const keepIndex = state.index;
      state.sourceCards = sourceNow;
      makeOverlay(state.sourceCards);
      const total = qsa('#wmFullscreenCarouselOverlay .wm-fs-slide').length;
      state.index = Math.max(0, Math.min(keepIndex, total - 1));
      update();
      return;
    }

    // Atualiza os clones somente no checkpoint do carrossel, antes da próxima rolagem.
    qsa('.wm-fs-slide .machine-card', overlay).forEach(clone => {
      refreshCloneFromSource(clone, findSourceCardForClone(clone));
    });
    update();
  }


  function step() {
    refreshVisibleFullscreenCards();
    const total = qsa('#wmFullscreenCarouselOverlay .wm-fs-slide').length;
    if (total <= 1) return;
    if (state.index >= total - 1) state.dir = -1;
    if (state.index <= 0) state.dir = 1;
    state.index += state.dir;
    update();
  }

  function restart() {
    clearInterval(state.timer);
    if (state.active) state.timer = setInterval(step, state.speed * 1000);
  }

  function update() {
    const overlay = qs('#wmFullscreenCarouselOverlay');
    const track = qs('#wmFsTrack', overlay || document);
    if (!track) return;
    track.style.transform = 'translateX(-' + (state.index * 100) + '%)';
    const totalSlides = qsa('.wm-fs-slide', overlay).length;
    const totalCards = qsa('.wm-fs-slide .machine-card', overlay).length;
    const counter = qs('#wmFsCounter', overlay);
    if (counter) counter.textContent = totalSlides ? (state.index + 1) + ' / ' + totalSlides + '  •  ' + totalCards + ' máquinas' : '0 máquinas';
  }

  function controlButton(id, icon, text, active) {
    return '<button type="button" id="' + id + '" class="wm-fs-chip ' + (active ? 'active' : '') + '"><i class="fas ' + icon + '"></i> ' + text + '</button>';
  }

  function makeOverlay(sourceCards) {
    qs('#wmFullscreenCarouselOverlay')?.remove();
    const chunks = chunkCards(sourceCards, state.perPage);
    const overlay = document.createElement('div');
    overlay.id = 'wmFullscreenCarouselOverlay';
    overlay.innerHTML = `
      <div class="wm-fs-topbar">
        <div class="wm-fs-title"><i class="fas fa-industry"></i> Máquinas em tela cheia</div>
        <div class="wm-fs-controls">
          ${controlButton('wmFsAllMachines', 'fa-layer-group', 'Todas as máquinas', state.includeHidden)}
          ${controlButton('wmFsMaintenance', state.showMaintenance ? 'fa-eye' : 'fa-eye-slash', state.showMaintenance ? 'Manutenção visível' : 'Manutenção oculta', state.showMaintenance)}
          <label class="wm-fs-select">Cards por tela
            <select id="wmFsCardsPerSlide">
              <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
            </select>
          </label>
          <label class="wm-fs-speed">Velocidade <input type="range" min="2" max="30" step="1" value="${state.speed}" id="wmFsSpeedRange"><strong id="wmFsSpeedValue">${state.speed}s</strong></label>
          <button type="button" id="wmFsClose" class="wm-fs-close"><i class="fas fa-compress"></i> Sair</button>
        </div>
      </div>
      <div class="wm-fs-viewport"><div class="wm-fs-track" id="wmFsTrack"></div></div>
      <div class="wm-fs-counter" id="wmFsCounter"></div>`;

    const track = qs('#wmFsTrack', overlay);
    if (!chunks.length) {
      track.innerHTML = '<div class="wm-fs-empty">Nenhuma máquina encontrada com os filtros atuais.</div>';
    }
    chunks.forEach(group => {
      const slide = document.createElement('div');
      slide.className = 'wm-fs-slide cards-' + state.perPage;
      group.forEach(card => {
        const clone = card.cloneNode(true);
        clone.removeAttribute('id');
        qsa('[id]', clone).forEach(el => el.removeAttribute('id'));
        slide.appendChild(clone);
      });
      track.appendChild(slide);
      copyCanvases(group, slide);
      requestAnimationFrame(() => copyCanvases(group, slide));
    });
    document.body.appendChild(overlay);

    const per = qs('#wmFsCardsPerSlide', overlay);
    if (per) { per.value = state.perPage; per.addEventListener('change', e => setPerPage(e.target.value)); }
    qs('#wmFsClose', overlay)?.addEventListener('click', deactivate);
    qs('#wmFsSpeedRange', overlay)?.addEventListener('input', e => setSpeed(e.target.value));
    qs('#wmFsAllMachines', overlay)?.addEventListener('click', () => setIncludeHidden(!state.includeHidden));
    qs('#wmFsMaintenance', overlay)?.addEventListener('click', () => setShowMaintenance(!state.showMaintenance));
    return overlay;
  }

  function rebuildOverlay() {
    state.sourceCards = getCards();
    state.index = 0;
    state.dir = 1;
    makeOverlay(state.sourceCards);
    update();
    restart();
  }

  function activate() {
    state.sourceCards = getCards();
    if (!state.sourceCards.length) { alert('Nenhuma máquina disponível para exibir no carrossel.'); return; }
    state.active = true;
    state.index = 0;
    state.dir = 1;
    document.body.classList.add('wm-fullscreen-active');
    const btn = qs('#fullscreenCarouselBtn');
    if (btn) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); btn.innerHTML = '<i class="fas fa-compress"></i> Sair Tela Cheia'; }
    const overlay = makeOverlay(state.sourceCards);
    update(); restart();
    if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {});
  }

  function deactivate() {
    state.active = false;
    clearInterval(state.timer);
    state.timer = null;
    document.body.classList.remove('wm-fullscreen-active');
    qs('#wmFullscreenCarouselOverlay')?.remove();
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    const btn = qs('#fullscreenCarouselBtn');
    if (btn) { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); btn.innerHTML = '<i class="fas fa-expand"></i> Tela Cheia'; }
  }

  function ensureHeaderButton() {
    const controls = qs('.header-controls');
    if (!controls) return;
    qs('#themeBtn')?.remove();
    if (!qs('#fullscreenCarouselBtn')) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.id = 'fullscreenCarouselBtn';
      btn.type = 'button';
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = '<i class="fas fa-expand"></i> Tela Cheia';
      controls.insertBefore(btn, controls.firstChild);
    }
    if (!qs('#fullscreenSpeedControl')) {
      const label = document.createElement('label');
      label.className = 'speed-control';
      label.id = 'fullscreenSpeedControl';
      label.innerHTML = '<span>Velocidade</span><input type="range" id="fullscreenSpeedRange" min="2" max="30" step="1" value="' + state.speed + '"><strong id="fullscreenSpeedValue">' + state.speed + 's</strong>';
      controls.insertBefore(label, qs('#fullscreenCarouselBtn').nextSibling);
    }
  }

  function css() {
    if (qs('#wmFullscreenCarouselCss')) return;
    const st = document.createElement('style');
    st.id = 'wmFullscreenCarouselCss';
    st.textContent = `
      .speed-control{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border,#dbe3ef);border-radius:8px;background:var(--card-bg,#fff);color:var(--text,#0f172a);font-size:13px;font-weight:700}.speed-control input{width:110px;accent-color:var(--primary,#2563eb)}.speed-control strong{min-width:32px;color:var(--primary,#2563eb)}#fullscreenCarouselBtn.active{background:var(--primary,#2563eb)!important;color:#fff!important;border-color:var(--primary,#2563eb)!important}
      .machine-prefix{background:transparent!important;color:#000!important;border-radius:0!important;padding:0!important;margin-left:6px!important;font-size:22px!important;line-height:1!important;font-weight:900!important;max-width:230px!important;letter-spacing:.2px}body.dark-mode .machine-prefix{color:#000!important;text-shadow:0 1px 0 rgba(255,255,255,.55)}
      #wmFullscreenCarouselOverlay{position:fixed;inset:0;z-index:99999;background:linear-gradient(135deg,#f8fafc 0%,#eaf2ff 100%);display:flex;flex-direction:column;padding:16px;overflow:hidden}.wm-fs-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 14px;background:rgba(255,255,255,.96);border:1px solid #dbe3ef;border-radius:18px;box-shadow:0 12px 30px rgba(15,23,42,.10)}.wm-fs-title{display:flex;align-items:center;gap:10px;font-size:24px;font-weight:900;color:#0f172a;white-space:nowrap}.wm-fs-controls{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}.wm-fs-chip,.wm-fs-close{border:1px solid #dbe3ef;border-radius:12px;padding:11px 14px;background:#fff;color:#0f172a;font-weight:900;cursor:pointer}.wm-fs-chip.active{background:#2563eb;color:#fff;border-color:#2563eb}.wm-fs-select,.wm-fs-speed{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:900;color:#0f172a;background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:8px 12px}.wm-fs-select select{border:0;background:#eef4ff;border-radius:8px;padding:6px 10px;font-weight:900}.wm-fs-speed input{width:150px;accent-color:#2563eb}.wm-fs-speed strong{min-width:38px;color:#2563eb}.wm-fs-close{background:#2563eb;color:#fff;border-color:#2563eb}.wm-fs-viewport{flex:1;overflow:hidden;display:flex;align-items:center;margin-top:18px}.wm-fs-track{display:flex;width:100%;height:100%;transition:transform 900ms cubic-bezier(.22,.61,.36,1);will-change:transform}.wm-fs-slide{flex:0 0 100%;display:grid;gap:22px;align-items:center;justify-content:center;padding:16px}.wm-fs-slide.cards-1{grid-template-columns:minmax(300px,min(74vw,980px))}.wm-fs-slide.cards-2{grid-template-columns:repeat(2,minmax(300px,46vw))}.wm-fs-slide.cards-3{grid-template-columns:repeat(3,minmax(270px,31vw))}.wm-fs-slide.cards-4{grid-template-columns:repeat(4,minmax(240px,23vw))}.wm-fs-counter{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,.84);color:#fff;padding:8px 14px;border-radius:999px;font-weight:900}.wm-fs-empty{flex:0 0 100%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#0f172a}
      .wm-fs-slide .machine-card{width:100%!important;min-width:0!important;min-height:68vh!important;padding:30px!important;border-radius:28px!important;box-shadow:0 26px 70px rgba(15,23,42,.18)!important}.wm-fs-slide.cards-2 .machine-card{min-height:62vh!important}.wm-fs-slide.cards-3 .machine-card,.wm-fs-slide.cards-4 .machine-card{min-height:56vh!important;padding:22px!important}.wm-fs-slide .machine-name{font-size:42px!important}.wm-fs-slide.cards-2 .machine-name{font-size:34px!important}.wm-fs-slide.cards-3 .machine-name,.wm-fs-slide.cards-4 .machine-name{font-size:26px!important}.wm-fs-slide .machine-name i{font-size:.82em!important}.wm-fs-slide .machine-prefix{font-size:44px!important;max-width:520px!important}.wm-fs-slide.cards-2 .machine-prefix{font-size:34px!important}.wm-fs-slide.cards-3 .machine-prefix,.wm-fs-slide.cards-4 .machine-prefix{font-size:26px!important}.wm-fs-slide .gauges-container{gap:56px!important;justify-content:center!important}.wm-fs-slide.cards-3 .gauges-container,.wm-fs-slide.cards-4 .gauges-container{gap:18px!important}.wm-fs-slide .gauge-title{font-size:18px!important}.wm-fs-slide .gauge-canvas,.wm-fs-slide .gauge-canvas canvas{width:210px!important;height:210px!important}.wm-fs-slide.cards-2 .gauge-canvas,.wm-fs-slide.cards-2 .gauge-canvas canvas{width:170px!important;height:170px!important}.wm-fs-slide.cards-3 .gauge-canvas,.wm-fs-slide.cards-3 .gauge-canvas canvas,.wm-fs-slide.cards-4 .gauge-canvas,.wm-fs-slide.cards-4 .gauge-canvas canvas{width:130px!important;height:130px!important}.wm-fs-slide .gauge-value{font-size:42px!important}.wm-fs-slide.cards-3 .gauge-value,.wm-fs-slide.cards-4 .gauge-value{font-size:28px!important}.wm-fs-slide .gauge-label{font-size:16px!important}.wm-fs-slide .status-indicators{font-size:22px!important;padding:22px!important}.wm-fs-slide.cards-3 .status-indicators,.wm-fs-slide.cards-4 .status-indicators{font-size:15px!important;padding:14px!important}.wm-fs-slide .status-value{font-size:28px!important}.wm-fs-slide .details-btn{font-size:18px!important;padding:16px 22px!important}
      @media(max-width:1100px){.wm-fs-topbar{align-items:flex-start;flex-direction:column}.wm-fs-controls{justify-content:flex-start}.wm-fs-slide.cards-3,.wm-fs-slide.cards-4{grid-template-columns:repeat(2,minmax(280px,46vw))}}@media(max-width:760px){.speed-control{width:100%;justify-content:space-between}.wm-fs-slide,.wm-fs-slide.cards-1,.wm-fs-slide.cards-2,.wm-fs-slide.cards-3,.wm-fs-slide.cards-4{grid-template-columns:92vw}.wm-fs-slide .machine-card{min-height:68vh!important}.wm-fs-speed input{width:110px}}
    `;
    document.head.appendChild(st);
  }

  function bind() {
    css(); ensureHeaderButton(); setSpeed(state.speed);
    const btn = qs('#fullscreenCarouselBtn');
    if (btn && btn.dataset.wmFsBound !== 'true') {
      btn.dataset.wmFsBound = 'true';
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); state.active ? deactivate() : activate(); });
    }
    const range = qs('#fullscreenSpeedRange');
    if (range && range.dataset.wmFsBound !== 'true') {
      range.dataset.wmFsBound = 'true';
      range.addEventListener('input', e => setSpeed(e.target.value));
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.active) deactivate(); });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && state.active) deactivate(); });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', bind) : bind();
})();
