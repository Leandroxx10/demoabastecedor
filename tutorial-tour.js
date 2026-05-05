/* =========================================================
   WMoldes - Tour interativo operacional
   Versão: 2026-05-04 v22
   Observação: utiliza o termo "abastecimento" em vez de "produção".
   ========================================================= */
(function () {
  'use strict';

  const TOUR_VERSION = '20260504v22';
  const MOBILE_QUERY = '(max-width: 768px)';

  const steps = [
    {
      title: 'Painel de Controle de Abastecimento',
      selector: '#tituloPrincipal',
      icon: 'fa-industry',
      text: 'Esta é a tela principal do abastecedor. Ela concentra filtros, atalhos, totais, dashboard e os cards das máquinas em tempo real.',
      note: 'Use este painel para acompanhar o abastecimento de moldes, blanks, neck rings e funis sem sair da tela operacional.'
    },
    {
      title: 'Filtro rápido de máquina',
      selector: '#filtro',
      icon: 'fa-search',
      text: 'Digite o código da máquina para localizar rapidamente um card específico, como A1, B3, C7 ou D10.',
      note: 'O filtro é útil quando há muitos cards visíveis e você precisa atuar em uma máquina específica.'
    },
    {
      title: 'Atalhos operacionais',
      selector: '#btnAtalhosRapidos',
      icon: 'fa-bolt',
      text: 'Abra links, sistemas, páginas ou arquivos usados na rotina. Os atalhos ficam salvos para acesso rápido.',
      note: 'Use o botão + dentro do modal para cadastrar nome, URL/caminho e comentário explicativo.'
    },
    {
      title: 'Tela cheia',
      selector: '#btnTelaCheia',
      icon: 'fa-expand',
      text: 'Ative a tela cheia para usar o painel em monitor de operação ou TV industrial, com maior área útil de visualização.',
      note: 'Para sair, use o mesmo botão ou pressione Esc no teclado.'
    },
    {
      title: 'Ver críticos',
      selector: '#btnCriticos',
      icon: 'fa-exclamation-triangle',
      text: 'Mostra apenas máquinas com itens abaixo do limite configurado. Ajuda a priorizar o que precisa de abastecimento primeiro.',
      note: 'Os limites são definidos no painel administrativo, por item: Molde, Blank, Neck Ring e Funil.'
    },
    {
      title: 'Atualização manual',
      selector: 'button.primary',
      icon: 'fa-sync-alt',
      text: 'Força uma recarga dos dados quando for necessário conferir imediatamente o estado atual salvo no Firebase.',
      note: 'O sistema também trabalha em tempo real, mas este botão é útil em casos de rede instável ou cache do navegador.'
    },
    {
      title: 'Filtros por forno',
      selector: '.filtro-fornos',
      icon: 'fa-fire',
      text: 'Separe a visualização por Forno A, B, C ou D. O botão Todos os Fornos retorna para a visualização completa.',
      note: 'Use estes filtros para reduzir a tela ao setor onde você está atuando.'
    },
    {
      title: 'Resumo geral',
      selector: '#totais',
      icon: 'fa-chart-pie',
      text: 'Mostra totais consolidados de Moldes, Blanks, Neck Rings, Funis e a quantidade de máquinas críticas.',
      note: 'Esse bloco serve como leitura rápida antes de entrar nos detalhes de cada card.'
    },
    {
      title: 'Abas Dashboard e Controle',
      selector: '.tabs-header',
      icon: 'fa-layer-group',
      text: 'A aba Dashboard mostra gráficos gerais. A aba Controle de Abastecimento concentra os cards para lançamento e acompanhamento.',
      note: 'Ao alternar entre abas, os dados continuam sincronizados com o banco.'
    },
    {
      title: 'Modo compacto',
      selector: '#btnModoCompacto',
      icon: 'fa-compress-alt',
      text: 'Reduz a altura dos cards para enxergar mais máquinas na tela. É recomendado para monitores menores ou visão geral por setor.',
      note: 'No modo compacto, a identificação da máquina fica mais objetiva e os controles ocupam menos espaço.'
    },
    {
      title: 'Cards das máquinas',
      selector: '.maquina, #painel',
      before: function () { openControleTab(); },
      icon: 'fa-server',
      text: 'Cada card representa uma máquina. Ele mostra código, horário atual, última atualização, status, quantidades e controles de abastecimento.',
      note: 'Um clique no código marca ou remove amostra. Dois cliques rápidos abrem o gráfico individual da máquina.'
    },
    {
      title: 'Lançamentos de abastecimento',
      selector: '.linha, #painel',
      before: function () { openControleTab(); },
      icon: 'fa-plus-minus',
      text: 'Use os botões + e - para ajustar quantidades. O sistema agrupa alterações próximas para gravar o histórico uma única vez com os valores finais.',
      note: 'Esse comportamento reduz duplicidade quando Molde e Blank são alterados em sequência.'
    },
    {
      title: 'Digitação direta',
      selector: '.btn-digitado, #painel',
      before: function () { openControleTab(); },
      icon: 'fa-keyboard',
      text: 'O botão de teclado permite informar um valor exato quando o ajuste por incremento não for suficiente.',
      note: 'Após digitar, pressione Enter ou saia do campo para confirmar.'
    },
    {
      title: 'Prefixo e manutenção',
      selector: '.prefixo-container, #painel',
      before: function () { openControleTab(); },
      icon: 'fa-tools',
      text: 'Quando habilitado, o card mostra prefixo da máquina e o controle de parada para manutenção.',
      note: 'Eventos de manutenção são registrados em intervalo, com início e fim, para aparecerem corretamente no histórico.'
    },
    {
      title: 'Dashboard de abastecimento',
      selector: '#dashboard .graficos-container, .tabs-header',
      before: function () { openDashboardTab(); },
      icon: 'fa-chart-column',
      text: 'O Dashboard apresenta gráficos de estoque atual e estoque total por máquina, incluindo rolagem horizontal quando necessário.',
      note: 'Use os controles acima do gráfico para exibir ou ocultar Neck Ring e Funil.'
    },
    {
      title: 'Manual completo',
      selector: '.tutorial-btn',
      icon: 'fa-book-open',
      text: 'O Manual abre uma página dedicada com explicações mais completas, animações e orientações de uso.',
      note: 'O tour interativo é rápido e contextual. O manual é melhor para treinamento detalhado de novos usuários.'
    }
  ];

  let currentIndex = 0;
  let active = false;
  let layer = null;
  let card = null;
  let spotlight = null;
  let pulse = null;
  let toast = null;
  let lastFocused = null;
  let resizeTimer = null;

  function ensureFontAwesomeIcon(icon) {
    return icon ? `<i class="fas ${icon}" aria-hidden="true"></i>` : '<i class="fas fa-route" aria-hidden="true"></i>';
  }

  function createLayer() {
    if (layer) return;

    layer = document.createElement('div');
    layer.className = 'wm-tour-layer';
    layer.setAttribute('aria-live', 'polite');

    const backdrop = document.createElement('div');
    backdrop.className = 'wm-tour-backdrop';
    backdrop.addEventListener('click', function () {
      showToast('Use os botões do tour ou pressione Esc para sair.');
    });

    spotlight = document.createElement('div');
    spotlight.className = 'wm-tour-spotlight';

    pulse = document.createElement('div');
    pulse.className = 'wm-tour-pulse';

    card = document.createElement('section');
    card.className = 'wm-tour-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', 'Tour interativo do sistema');

    card.innerHTML = `
      <div class="wm-tour-card-header">
        <div>
          <span class="wm-tour-kicker"><i class="fas fa-route"></i> Tour interativo</span>
          <h2 class="wm-tour-title" id="wmTourTitle"></h2>
        </div>
        <button type="button" class="wm-tour-close" id="wmTourClose" title="Fechar tour" aria-label="Fechar tour">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="wm-tour-card-body">
        <p class="wm-tour-text" id="wmTourText"></p>
        <div class="wm-tour-note" id="wmTourNote"></div>
      </div>
      <div class="wm-tour-progress-wrap">
        <div class="wm-tour-progress-meta">
          <span id="wmTourStepLabel">Etapa 1 de ${steps.length}</span>
          <span>${TOUR_VERSION}</span>
        </div>
        <div class="wm-tour-progress"><span id="wmTourProgress"></span></div>
      </div>
      <div class="wm-tour-keyboard">
        <span>Atalhos:</span>
        <kbd>←</kbd><span>anterior</span>
        <kbd>→</kbd><span>próxima</span>
        <kbd>Esc</kbd><span>sair</span>
      </div>
      <div class="wm-tour-actions">
        <button type="button" class="wm-tour-btn" id="wmTourPrev"><i class="fas fa-chevron-left"></i> Anterior</button>
        <button type="button" class="wm-tour-btn ghost" id="wmTourSkip">Pular</button>
        <button type="button" class="wm-tour-btn primary" id="wmTourNext">Próxima <i class="fas fa-chevron-right"></i></button>
      </div>
    `;

    toast = document.createElement('div');
    toast.className = 'wm-tour-toast';

    layer.appendChild(backdrop);
    layer.appendChild(spotlight);
    layer.appendChild(pulse);
    layer.appendChild(card);
    document.body.appendChild(layer);
    document.body.appendChild(toast);

    card.querySelector('#wmTourClose').addEventListener('click', stop);
    card.querySelector('#wmTourSkip').addEventListener('click', stop);
    card.querySelector('#wmTourPrev').addEventListener('click', prev);
    card.querySelector('#wmTourNext').addEventListener('click', next);
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(function () {
      toast.classList.remove('visible');
    }, 2200);
  }

  function openControleTab() {
    if (typeof window.openTab === 'function') {
      window.openTab('controle');
    } else {
      document.querySelector('#controle')?.classList.add('active');
      document.querySelector('#dashboard')?.classList.remove('active');
    }
  }

  function openDashboardTab() {
    if (typeof window.openTab === 'function') {
      window.openTab('dashboard');
    } else {
      document.querySelector('#dashboard')?.classList.add('active');
      document.querySelector('#controle')?.classList.remove('active');
    }
  }

  function getTarget(step) {
    const selectors = String(step.selector || '').split(',').map(s => s.trim()).filter(Boolean);
    for (const selector of selectors) {
      const found = document.querySelector(selector);
      if (found && isVisible(found)) return found;
    }
    return document.querySelector('#mainContent') || document.body;
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function isMainContentReady() {
    const main = document.querySelector('#mainContent');
    const login = document.querySelector('#loginScreen');
    return !!main && isVisible(main) && (!login || !isVisible(login));
  }

  function start(index) {
    if (!isMainContentReady()) {
      return false;
    }

    currentIndex = Number.isInteger(index) ? Math.max(0, Math.min(index, steps.length - 1)) : 0;
    active = true;
    lastFocused = document.activeElement;
    createLayer();
    document.body.classList.add('wm-tour-body-lock');
    layer.style.display = 'block';
    render();
    document.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('resize', handleResize, true);
    window.addEventListener('scroll', handleResize, true);
    return true;
  }

  function stop() {
    active = false;
    document.body.classList.remove('wm-tour-body-lock');
    document.removeEventListener('keydown', handleKeydown, true);
    window.removeEventListener('resize', handleResize, true);
    window.removeEventListener('scroll', handleResize, true);

    if (layer) layer.style.display = 'none';
    if (toast) toast.classList.remove('visible');

    try { localStorage.setItem('wm_tour_interativo_visto', TOUR_VERSION); } catch (_) {}

    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch (_) {}
    }
  }

  function next() {
    if (currentIndex >= steps.length - 1) {
      stop();
      return;
    }
    currentIndex += 1;
    render();
  }

  function prev() {
    if (currentIndex <= 0) return;
    currentIndex -= 1;
    render();
  }

  function handleKeydown(event) {
    if (!active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      stop();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prev();
    }
  }

  function handleResize() {
    if (!active) return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(positionCurrentStep, 80);
  }

  function render() {
    const step = steps[currentIndex];
    if (typeof step.before === 'function') {
      try { step.before(); } catch (_) {}
    }

    window.setTimeout(function () {
      const title = card.querySelector('#wmTourTitle');
      const text = card.querySelector('#wmTourText');
      const note = card.querySelector('#wmTourNote');
      const label = card.querySelector('#wmTourStepLabel');
      const progress = card.querySelector('#wmTourProgress');
      const prevBtn = card.querySelector('#wmTourPrev');
      const nextBtn = card.querySelector('#wmTourNext');

      title.textContent = step.title;
      text.textContent = step.text;
      note.innerHTML = `${ensureFontAwesomeIcon('fa-circle-info')} <span>${step.note || 'Avance para continuar o treinamento.'}</span>`;
      label.textContent = `Etapa ${currentIndex + 1} de ${steps.length}`;
      progress.style.width = `${((currentIndex + 1) / steps.length) * 100}%`;
      prevBtn.disabled = currentIndex === 0;
      nextBtn.innerHTML = currentIndex === steps.length - 1
        ? 'Concluir <i class="fas fa-check"></i>'
        : 'Próxima <i class="fas fa-chevron-right"></i>';

      const kicker = card.querySelector('.wm-tour-kicker');
      kicker.innerHTML = `${ensureFontAwesomeIcon(step.icon)} Tour interativo`;

      positionCurrentStep();
      const close = card.querySelector('#wmTourClose');
      if (close) close.focus({ preventScroll: true });
    }, 120);
  }

  function positionCurrentStep() {
    const step = steps[currentIndex];
    const target = getTarget(step);

    if (target && target.scrollIntoView) {
      try { target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); } catch (_) { target.scrollIntoView(); }
    }

    window.setTimeout(function () {
      const rect = target.getBoundingClientRect();
      const padding = 10;
      const top = Math.max(8, rect.top - padding);
      const left = Math.max(8, rect.left - padding);
      const width = Math.min(window.innerWidth - left - 8, rect.width + padding * 2);
      const height = Math.min(window.innerHeight - top - 8, rect.height + padding * 2);

      spotlight.style.top = `${top}px`;
      spotlight.style.left = `${left}px`;
      spotlight.style.width = `${Math.max(80, width)}px`;
      spotlight.style.height = `${Math.max(44, height)}px`;

      pulse.style.left = `${left + Math.max(40, width / 2)}px`;
      pulse.style.top = `${top + Math.max(24, Math.min(height / 2, 80))}px`;

      positionCard({ top, left, width, height });
    }, 230);
  }

  function positionCard(targetBox) {
    const margin = 14;
    const cardWidth = Math.min(430, window.innerWidth - 28);
    const cardHeight = Math.min(card.offsetHeight || 360, window.innerHeight - 32);

    if (window.matchMedia(MOBILE_QUERY).matches) {
      card.style.left = `${margin}px`;
      card.style.right = `${margin}px`;
      card.style.top = 'auto';
      card.style.bottom = '12px';
      return;
    }

    let left = targetBox.left + targetBox.width + 20;
    let top = targetBox.top;

    if (left + cardWidth > window.innerWidth - margin) {
      left = targetBox.left - cardWidth - 20;
    }

    if (left < margin) {
      left = Math.min(Math.max(margin, targetBox.left), window.innerWidth - cardWidth - margin);
      top = targetBox.top + targetBox.height + 20;
    }

    if (top + cardHeight > window.innerHeight - margin) {
      top = window.innerHeight - cardHeight - margin;
    }

    if (top < margin) top = margin;

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.right = 'auto';
    card.style.bottom = 'auto';
  }

  function maybeShowFirstUseHint() {
    const btn = document.querySelector('#btnIniciarTour');
    if (!btn) return;
    let seen = null;
    try { seen = localStorage.getItem('wm_tour_interativo_visto'); } catch (_) {}
    if (!seen) {
      btn.classList.add('wm-tour-attention');
      window.setTimeout(function () { btn.classList.remove('wm-tour-attention'); }, 2800);
    }
  }

  window.WMInteractiveTour = {
    start,
    stop,
    next,
    prev,
    version: TOUR_VERSION
  };

  function removeTourQueryParam() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('tour')) return;
      url.searchParams.delete('tour');
      const cleanUrl = url.pathname + (url.search ? url.search : '') + url.hash;
      window.history.replaceState(window.history.state, document.title, cleanUrl);
    } catch (_) {}
  }

  function waitForMainContentAndStart(attempt) {
    if (start(0)) return;
    if (attempt >= 20) return;
    window.setTimeout(function () {
      waitForMainContentAndStart(attempt + 1);
    }, 250);
  }

  function startFromQueryParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('tour')) return;
      removeTourQueryParam();
      window.setTimeout(function () {
        waitForMainContentAndStart(0);
      }, 300);
    } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    maybeShowFirstUseHint();
    startFromQueryParam();
  });
})();
