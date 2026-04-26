(function () {
  const steps = [
    {
      label: 'Etapa 1',
      title: 'Visão geral do cartão',
      description: 'Cada cartão representa uma máquina. O cabeçalho identifica a máquina e o chip de prefixo permite consultar rapidamente os dados técnicos vinculados.',
      callout: 'Primeiro localize a máquina correta. Depois valide o prefixo antes de qualquer apontamento.',
      target: '#demoHeader',
      action: () => {
        resetDemo();
        pulse('#demoHeader');
      }
    },
    {
      label: 'Etapa 2',
      title: 'Adicionar quantidades',
      description: 'Use os botões positivos para registrar entrada de peças. Os incrementos rápidos ajudam quando há reposição em lote.',
      callout: 'Para reposição simples, use +1 ou +2. Para volumes maiores, use +5 ou +10.',
      target: '#demoAddGroup',
      action: () => {
        resetDemo();
        pulse('#demoAddGroup');
        animateValue(12, 17);
      }
    },
    {
      label: 'Etapa 3',
      title: 'Remover quantidades',
      description: 'Use os botões negativos para consumo ou saída. O processo é o mesmo, mas sempre confirme a máquina antes de reduzir o saldo.',
      callout: 'Registre a baixa imediatamente após o consumo para manter o painel confiável.',
      target: '#demoRemoveGroup',
      action: () => {
        resetDemo();
        pulse('#demoRemoveGroup');
        animateValue(12, 10, true);
      }
    },
    {
      label: 'Etapa 4',
      title: 'Digitação direta pelo teclado',
      description: 'Quando precisar ajustar para um valor exato, use o botão do teclado. Ele troca a exibição pelo campo numérico para edição direta.',
      callout: 'Esse modo é ideal para correções exatas de inventário, contagem física e ajustes pontuais.',
      target: '#demoKeyboardBtn',
      action: () => {
        resetDemo();
        const keyboard = document.querySelector('#demoKeyboardBtn');
        const input = document.querySelector('#demoInput');
        const value = document.querySelector('#demoValue');
        keyboard.classList.add('pulse-target');
        keyboard.style.background = '#0f172a';
        keyboard.style.color = '#fff';
        value.style.display = 'none';
        input.style.display = 'block';
        input.value = 14;
        input.classList.add('bounce-soft');
      }
    },
    {
      label: 'Etapa 5',
      title: 'Consultar os dados do prefixo',
      description: 'Ao selecionar ou tocar no prefixo, o sistema exibe as informações associadas: processo, corredor, prateleira e demais componentes.',
      callout: 'Consulte o prefixo sempre que houver dúvida de localização ou composição do conjunto.',
      target: '#demoPrefixChip',
      action: () => {
        resetDemo();
        pulse('#demoPrefixChip');
        document.querySelector('#demoPrefixPanel').classList.add('visible');
      }
    },
    {
      label: 'Etapa 6',
      title: 'Boas práticas de apontamento',
      description: 'Faça o registro no momento da movimentação, revise o prefixo, prefira botões rápidos para rotina e use digitação direta apenas quando necessário.',
      callout: 'Precisão operacional depende de apontamento imediato, prefixo conferido e ajuste feito no item correto.',
      target: '#demoCard',
      action: () => {
        resetDemo();
        pulse('#demoCard');
      }
    }
  ];

  const stepLabel = document.getElementById('tutorialStepLabel');
  const stepTitle = document.getElementById('tutorialStepTitle');
  const stepDescription = document.getElementById('tutorialStepDescription');
  const callout = document.getElementById('tutorialCallout');
  const spotlight = document.getElementById('spotlightRing');
  const progress = document.getElementById('tutorialProgressBar');
  const listItems = [...document.querySelectorAll('#tutorialStepsList li')];
  const prevBtn = document.getElementById('prevStepBtn');
  const nextBtn = document.getElementById('nextStepBtn');
  const startBtn = document.getElementById('startTutorialBtn');
  let currentStep = 0;

  function pulse(selector) {
    document.querySelectorAll('.pulse-target').forEach(el => el.classList.remove('pulse-target'));
    const el = document.querySelector(selector);
    if (el) el.classList.add('pulse-target');
  }

  function resetDemo() {
    document.querySelectorAll('.pulse-target').forEach(el => el.classList.remove('pulse-target'));
    document.querySelectorAll('.shake-soft').forEach(el => el.classList.remove('shake-soft'));
    document.querySelectorAll('.bounce-soft').forEach(el => el.classList.remove('bounce-soft'));
    document.querySelector('#demoValue').style.display = 'block';
    document.querySelector('#demoValue').textContent = '12';
    document.querySelector('#demoValue').style.color = 'var(--accent)';
    document.querySelector('#demoInput').style.display = 'none';
    document.querySelector('#demoKeyboardBtn').style.background = '#e2e8f0';
    document.querySelector('#demoKeyboardBtn').style.color = '#334155';
    document.querySelector('#demoPrefixPanel').classList.remove('visible');
  }

  function animateValue(from, to, isDecrease = false) {
    const value = document.querySelector('#demoValue');
    value.textContent = String(from);
    value.style.color = isDecrease ? 'var(--error)' : 'var(--success)';
    value.classList.add(isDecrease ? 'shake-soft' : 'bounce-soft');
    setTimeout(() => {
      value.textContent = String(to);
    }, 180);
  }

  function positionSpotlight(selector) {
    const target = document.querySelector(selector);
    const stage = document.getElementById('tutorialStage');
    if (!target || !stage) return;

    const targetRect = target.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();

    spotlight.style.opacity = '1';
    spotlight.style.left = `${targetRect.left - stageRect.left - 10}px`;
    spotlight.style.top = `${targetRect.top - stageRect.top - 10}px`;
    spotlight.style.width = `${targetRect.width + 20}px`;
    spotlight.style.height = `${targetRect.height + 20}px`;
  }

  function renderStep(index) {
    currentStep = (index + steps.length) % steps.length;
    const step = steps[currentStep];
    stepLabel.textContent = step.label;
    stepTitle.textContent = step.title;
    stepDescription.textContent = step.description;
    callout.textContent = step.callout;
    progress.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
    listItems.forEach((item, i) => item.classList.toggle('active', i === currentStep));
    step.action();
    requestAnimationFrame(() => positionSpotlight(step.target));
  }

  prevBtn.addEventListener('click', () => renderStep(currentStep - 1));
  nextBtn.addEventListener('click', () => renderStep(currentStep + 1));
  startBtn.addEventListener('click', () => {
    document.querySelector('.tutorial-stage-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderStep(0);
  });

  listItems.forEach((item, index) => item.addEventListener('click', () => renderStep(index)));
  window.addEventListener('resize', () => positionSpotlight(steps[currentStep].target));

  renderStep(0);
})();
