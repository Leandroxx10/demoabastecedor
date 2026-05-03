/* WMoldes - atualização em tempo real dos cards clonados no modo Tela Cheia */
(function () {
  'use strict';

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  let timer = null;
  let observer = null;
  let debounce = null;
  let lastSignature = '';

  function overlay() {
    return qs('#wmFullscreenCarouselOverlay');
  }

  function isMaintenance(card) {
    return card?.dataset?.maintenance === 'true' || card?.classList?.contains('maintenance') || /manuten[cç][aã]o/i.test(card?.textContent || '');
  }

  function isVisible(card) {
    const style = getComputedStyle(card);
    return style.display !== 'none' && style.visibility !== 'hidden' && card.offsetParent !== null;
  }

  function includeHiddenMachines() {
    return qs('#wmFsAllMachines')?.classList.contains('active') === true;
  }

  function showMaintenanceMachines() {
    const btn = qs('#wmFsMaintenance');
    return !btn || btn.classList.contains('active');
  }

  function cardsPerSlide() {
    const value = Number(qs('#wmFsCardsPerSlide')?.value || localStorage.getItem('wmoldes_fs_cards_per_slide') || 1);
    return Math.max(1, Math.min(4, value || 1));
  }

  function sourceCards() {
    const cards = qsa('#fornoSections .machine-card, #cardsContainer .machine-card');
    const seen = new Set();
    return cards.filter(card => {
      const key = card.dataset.machineId || card.textContent.trim().slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      if (!includeHiddenMachines() && !isVisible(card)) return false;
      if (!showMaintenanceMachines() && isMaintenance(card)) return false;
      return true;
    });
  }

  function copyCanvas(sourceCard, cloneCard) {
    qsa('canvas', sourceCard).forEach((sourceCanvas, index) => {
      const cloneCanvas = qsa('canvas', cloneCard)[index];
      if (!cloneCanvas) return;
      try {
        cloneCanvas.width = sourceCanvas.width;
        cloneCanvas.height = sourceCanvas.height;
        cloneCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0);
      } catch (_) {}
    });
  }

  function currentIndex(overlayEl) {
    const counterText = qs('#wmFsCounter', overlayEl)?.textContent || '';
    const match = counterText.match(/(\d+)\s*\//);
    if (match) return Math.max(0, Number(match[1]) - 1);

    const track = qs('#wmFsTrack', overlayEl);
    const transform = track?.style?.transform || '';
    const pct = transform.match(/translateX\(-([\d.]+)%\)/);
    if (pct) return Math.max(0, Math.round(Number(pct[1]) / 100));
    return 0;
  }

  function buildSignature(cards) {
    return cards.map(card => {
      const id = card.dataset.machineId || '';
      const maintenance = card.dataset.maintenance || '';
      return id + '|' + maintenance + '|' + card.textContent.replace(/\s+/g, ' ').trim();
    }).join('§');
  }

  function render(force) {
    const overlayEl = overlay();
    if (!overlayEl) return;
    const track = qs('#wmFsTrack', overlayEl);
    if (!track) return;

    const cards = sourceCards();
    const signature = cardsPerSlide() + '|' + includeHiddenMachines() + '|' + showMaintenanceMachines() + '|' + buildSignature(cards);
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    const perSlide = cardsPerSlide();
    const oldIndex = currentIndex(overlayEl);
    track.innerHTML = '';

    if (!cards.length) {
      track.innerHTML = '<div class="wm-fs-empty">Nenhuma máquina encontrada com os filtros atuais.</div>';
      const counter = qs('#wmFsCounter', overlayEl);
      if (counter) counter.textContent = '0 máquinas';
      return;
    }

    for (let i = 0; i < cards.length; i += perSlide) {
      const group = cards.slice(i, i + perSlide);
      const slide = document.createElement('div');
      slide.className = 'wm-fs-slide cards-' + perSlide;
      group.forEach(source => {
        const clone = source.cloneNode(true);
        clone.removeAttribute('id');
        qsa('[id]', clone).forEach(el => el.removeAttribute('id'));
        slide.appendChild(clone);
        copyCanvas(source, clone);
      });
      track.appendChild(slide);
    }

    const totalSlides = qsa('.wm-fs-slide', overlayEl).length;
    const nextIndex = Math.max(0, Math.min(oldIndex, totalSlides - 1));
    track.style.transform = 'translateX(-' + (nextIndex * 100) + '%)';

    const counter = qs('#wmFsCounter', overlayEl);
    if (counter) counter.textContent = (nextIndex + 1) + ' / ' + totalSlides + '  •  ' + cards.length + ' máquinas';
  }

  function schedule(force) {
    clearTimeout(debounce);
    debounce = setTimeout(() => render(force), 180);
  }

  function startObserver() {
    if (observer || typeof MutationObserver === 'undefined') return;
    const roots = ['#fornoSections', '#cardsContainer'].map(id => qs(id)).filter(Boolean);
    if (!roots.length) return;
    observer = new MutationObserver(() => schedule(true));
    roots.forEach(root => observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-maintenance']
    }));
  }

  function loop() {
    const active = !!overlay();
    if (active) {
      startObserver();
      render(false);
    } else {
      lastSignature = '';
    }
  }

  document.addEventListener('wmoldes:machines-updated', () => schedule(true));
  document.addEventListener('fullscreenchange', () => schedule(true));
  document.addEventListener('click', event => {
    if (event.target.closest('#fullscreenCarouselBtn, #wmFsAllMachines, #wmFsMaintenance, #wmFsCardsPerSlide')) {
      schedule(true);
    }
  }, true);
  document.addEventListener('change', event => {
    if (event.target.closest('#wmFsCardsPerSlide')) schedule(true);
  }, true);

  timer = setInterval(loop, 1000);
  setTimeout(() => schedule(true), 500);

  window.WMFullscreenRealtimePatch = {
    refresh: () => render(true)
  };
})();
