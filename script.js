// ====================================================
// CONFIGURAÇÃO PRINCIPAL
// ====================================================

// Dados das máquinas
let dadosMaquinas = {};
let machineMaintenance = {};

// Prefixos pré-definidos - AGORA CARREGADOS DO FIREBASE
let prefixos = [];

// Configurações do sistema (agora sincronizadas com Firebase)
let config = {
    mostrarReserva: true,
    mostrarFunil: true,
    mostrarNeckring: true,
    mostrarBlank: true,
    mostrarMolde: true,
    mostrarPrefixo: true,
    alertasAtivos: true,
    animacoesAtivas: true,
    autoAtualizar: true,
    mostrarTotais: true,
    mostrarGraficos: true,
    tema: 'ciano',
    estoqueMinimo: 3,
    estoqueMinimoMolde: 3,
    estoqueMinimoBlank: 3,
    estoqueMinimoNeckring: 3,
    estoqueMinimoFunil: 3,
    criticoMoldeAtivo: true,
    criticoBlankAtivo: true,
    criticoNeckringAtivo: true,
    criticoFunilAtivo: true
};

// Configuração de filtro por forno
let fornosAtivos = new Set();
let modoCompactoAtivo = localStorage.getItem('modoCompacto') === 'true';
let mostrarNeckRingDashboard = localStorage.getItem('mostrarNeckRingDashboard') === 'true';
let mostrarFunilDashboard = localStorage.getItem('mostrarFunilDashboard') === 'true';
let clicksTitulo = 0;
let timeoutClicks = null;

// Controle para mostrar apenas máquinas críticas
let mostrarCriticos = false;

// Estado do modo escuro
let modoEscuroAtivo = localStorage.getItem('modoEscuro') === 'true';

// Elementos DOM
const loginScreen = document.getElementById('loginScreen');
const mainContent = document.getElementById('mainContent');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('errorMessage');
const preloader = document.getElementById('preloader');
const tituloPrincipal = document.getElementById('tituloPrincipal');

// Gráficos
let graficoProducao = null;
let graficoTotal = null;

// ====================================================
// INICIALIZAÇÃO
// ====================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log("🚀 Inicializando sistema...");
    
    // Aplicar modo escuro se estiver ativo
    if (modoEscuroAtivo) {
        document.body.classList.add('dark-mode');
        document.querySelector('.dark-mode-toggle').innerHTML = '<i class="fas fa-sun"></i> Modo Claro';
    }

    aplicarEstadoModoCompacto(false);
    
    // Ocultar preloader após 1.5 segundos
    setTimeout(() => {
        preloader.style.opacity = '0';
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 500);
    }, 1500);
    
    // Verificar autenticação
    const user = await checkAuth();
    
    if (user) {
        // Usuário autenticado
        loginScreen.style.display = 'none';
        mainContent.style.display = 'block';
        
        // Carregar configurações
        carregarConfiguracoes();
        
        // Carregar prefixos
        carregarPrefixos();
        
        // Inicializar listeners do Firebase
        inicializarFirebaseListeners();
        
        // Inicializar gráficos
        inicializarGraficos();
        
        // Configurar evento do título
        configurarEventoTitulo();
        
        console.log("✅ Sistema inicializado para:", user.email);
    } else {
        // Mostrar tela de login
        loginScreen.style.display = 'block';
        mainContent.style.display = 'none';
        
        // Configurar formulário de login
        configurarLogin();
    }
});

function normalizarConfiguracoes(configSalva = {}) {
    const base = { ...config, ...configSalva };
    const legado = Number.parseInt(base.estoqueMinimo, 10);
    const limitePadrao = Number.isFinite(legado) ? legado : 3;
    base.estoqueMinimoMolde = Number.parseInt(base.estoqueMinimoMolde, 10);
    base.estoqueMinimoBlank = Number.parseInt(base.estoqueMinimoBlank, 10);
    base.estoqueMinimoNeckring = Number.parseInt(base.estoqueMinimoNeckring, 10);
    base.estoqueMinimoFunil = Number.parseInt(base.estoqueMinimoFunil, 10);
    if (!Number.isFinite(base.estoqueMinimoMolde)) base.estoqueMinimoMolde = limitePadrao;
    if (!Number.isFinite(base.estoqueMinimoBlank)) base.estoqueMinimoBlank = limitePadrao;
    if (!Number.isFinite(base.estoqueMinimoNeckring)) base.estoqueMinimoNeckring = limitePadrao;
    if (!Number.isFinite(base.estoqueMinimoFunil)) base.estoqueMinimoFunil = limitePadrao;
    base.estoqueMinimo = Math.min(base.estoqueMinimoMolde, base.estoqueMinimoBlank, base.estoqueMinimoNeckring, base.estoqueMinimoFunil);
    base.criticoMoldeAtivo = base.criticoMoldeAtivo !== false;
    base.criticoBlankAtivo = base.criticoBlankAtivo !== false;
    base.criticoNeckringAtivo = base.criticoNeckringAtivo !== false;
    base.criticoFunilAtivo = base.criticoFunilAtivo !== false;
    return base;
}
function obterRegrasCriticas() {
    return [
        { campo: 'molde', rotulo: 'Molde', limite: config.estoqueMinimoMolde, ativo: config.criticoMoldeAtivo },
        { campo: 'blank', rotulo: 'Blank', limite: config.estoqueMinimoBlank, ativo: config.criticoBlankAtivo },
        { campo: 'neck_ring', rotulo: 'Neck Ring', limite: config.estoqueMinimoNeckring, ativo: config.criticoNeckringAtivo },
        { campo: 'funil', rotulo: 'Funil', limite: config.estoqueMinimoFunil, ativo: config.criticoFunilAtivo }
    ];
}
function obterItensCriticos(maquina) {
    return obterRegrasCriticas().filter(regra => regra.ativo && ((maquina?.[regra.campo] || 0) <= regra.limite));
}
function maquinaEstaCritica(maquina) { return obterItensCriticos(maquina).length > 0; }
function atualizarResumoLimitesCriticos() {
    const el = document.getElementById('estoqueMinimoLabel');
    if (!el) return;
    const ativos = obterRegrasCriticas().filter(regra => regra.ativo);
    el.textContent = ativos.length ? ativos.map(regra => `${regra.rotulo} ≤ ${regra.limite}`).join(' | ') : 'nenhum item ativo';
}
function aplicarConfiguracoesNoPainelAdmin() {
    const setChecked = (id, value) => { const el = document.getElementById(id); if (el) el.checked = Boolean(value); };
    const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
    setChecked('toggleReserva', config.mostrarReserva);
    setChecked('toggleFunil', config.mostrarFunil);
    setChecked('toggleNeckring', config.mostrarNeckring);
    setChecked('toggleBlank', config.mostrarBlank);
    setChecked('toggleMolde', config.mostrarMolde);
    setChecked('togglePrefixo', config.mostrarPrefixo);
    setChecked('toggleAlertas', config.alertasAtivos);
    setChecked('toggleAnimacoes', config.animacoesAtivas);
    setChecked('autoAtualizar', config.autoAtualizar);
    setChecked('mostrarTotais', config.mostrarTotais);
    setChecked('mostrarGraficos', config.mostrarGraficos);
    setChecked('criticoMoldeAtivo', config.criticoMoldeAtivo);
    setChecked('criticoBlankAtivo', config.criticoBlankAtivo);
    setChecked('criticoNeckringAtivo', config.criticoNeckringAtivo);
    setChecked('criticoFunilAtivo', config.criticoFunilAtivo);
    setValue('estoqueMinimoMolde', config.estoqueMinimoMolde);
    setValue('estoqueMinimoBlank', config.estoqueMinimoBlank);
    setValue('estoqueMinimoNeckring', config.estoqueMinimoNeckring);
    setValue('estoqueMinimoFunil', config.estoqueMinimoFunil);
}

// ====================================================
// SISTEMA DE LOGIN
// ====================================================

function configurarLogin() {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!email || !password) {
            mostrarErroLogin("Preencha todos os campos");
            return;
        }
        
        const resultado = await login(email, password);
        
        if (resultado.success) {
            // Login bem-sucedido
            mostrarNotificacao("Login realizado com sucesso!", "success");
            
            // Recarregar a página para inicializar o sistema
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } else {
            // Login falhou
            mostrarErroLogin(resultado.error);
        }
    });
}

function mostrarErroLogin(mensagem) {
    errorMessage.textContent = mensagem;
    errorMessage.style.display = 'block';
    passwordInput.classList.add('error');
    
    setTimeout(() => {
        passwordInput.classList.remove('error');
    }, 1000);
}

// ====================================================
// CARREGAR CONFIGURAÇÕES
// ====================================================

function carregarConfiguracoes() {
    db.ref("configuracoes").once("value").then(snapshot => {
        const configSalva = snapshot.val();
        if (configSalva) {
            config = normalizarConfiguracoes(configSalva);
            aplicarConfiguracoesNoPainelAdmin();
            atualizarResumoLimitesCriticos();
            
            // Aplicar tema
            aplicarTema(config.tema);
            
            // Aplicar visibilidade dos totais
            const totaisElement = document.getElementById('totais');
            if (totaisElement) {
                totaisElement.style.display = config.mostrarTotais ? 'grid' : 'none';
            }
            
            // Aplicar visibilidade dos gráficos
            const graficosElement = document.querySelector('.graficos-container');
            if (graficosElement) {
                graficosElement.style.display = config.mostrarGraficos ? 'grid' : 'none';
            }
            
            console.log("✅ Configurações carregadas");
        } else {
            config = normalizarConfiguracoes(config);
            aplicarConfiguracoesNoPainelAdmin();
            atualizarResumoLimitesCriticos();
            aplicarTema(config.tema);
        }
    }).catch(error => {
        console.error("❌ Erro ao carregar configurações:", error);
    });
}

// ====================================================
// CARREGAR PREFIXOS
// ====================================================

function carregarPrefixos() {
    try {
        if (typeof db === 'undefined') {
            console.warn("⚠️ Firebase ainda não inicializado para carregar prefixos");
            prefixos = [];
            return;
        }

        // Listener em tempo real: quando um prefixo detalhado for criado/editado/removido
        // em qualquer um dos dois projetos, os selects e os cards são atualizados sem refresh.
        db.ref("prefixDatabase").on("value", snapshot => {
            try {
                prefixos = buildPrefixList(snapshot.val() || {});
                console.log("✅ Prefixos detalhados sincronizados:", prefixos.length);

                if (typeof dadosMaquinas !== 'undefined' && Object.keys(dadosMaquinas || {}).length > 0) {
                    criarPainel(dadosMaquinas);
                }
            } catch (innerError) {
                console.error("❌ Erro ao processar prefixos:", innerError);
                prefixos = [];
            }
        }, error => {
            console.error("❌ Erro ao sincronizar prefixos:", error);
            prefixos = [];
        });
    } catch (error) {
        console.error("❌ Erro ao iniciar sincronização de prefixos:", error);
        prefixos = [];
    }
}

// ====================================================
// INICIALIZAR LISTENERS DO FIREBASE
// ====================================================

function inicializarFirebaseListeners() {
    // Listener para dados das máquinas
    db.ref("maquinas").on("value", snapshot => {
        const dados = snapshot.val();
        if (dados) {
            dadosMaquinas = dados;
            criarPainel(dados);
            
            // Atualizar gráficos
            if (config.mostrarGraficos) {
                atualizarGrafico(dados);
                atualizarGraficoTotal(dados);
            }
        }
    });
    
    // Listener para manutenção (compartilhado entre os dois sites)
    db.ref("manutencao").on("value", snapshot => {
        machineMaintenance = snapshot.val() || {};
        window.machineMaintenance = machineMaintenance;
        if (Object.keys(dadosMaquinas).length > 0) {
            criarPainel(dadosMaquinas);
        }
    });

    // Listener para configurações (sincroniza entre todos os usuários)
    db.ref("configuracoes").on("value", snapshot => {
        const configSalva = snapshot.val();
        if (configSalva) {
            config = configSalva;
            
            // Aplicar configurações imediatamente
            atualizarResumoLimitesCriticos();
            
            const totaisElement = document.getElementById('totais');
            if (totaisElement) {
                totaisElement.style.display = config.mostrarTotais ? 'grid' : 'none';
            }
            
            const graficosElement = document.querySelector('.graficos-container');
            if (graficosElement) {
                graficosElement.style.display = config.mostrarGraficos ? 'grid' : 'none';
            }
            
            aplicarTema(config.tema);
            
            // Atualizar painel se necessário
            if (Object.keys(dadosMaquinas).length > 0) {
                criarPainel(dadosMaquinas);
            }
        }
    });
}

// ====================================================
// FUNÇÃO: CRIAR PAINEL DE MÁQUINAS
// ====================================================

function criarPainel(maquinas) {
    dadosMaquinas = maquinas || {};
    const filtroInput = document.getElementById("filtro");
    const filtro = filtroInput ? filtroInput.value.toLowerCase().trim() : "";
    const painel = document.getElementById("painel");

    if (!painel) return;

    painel.innerHTML = "";

    let totalMolde = 0;
    let totalBlank = 0;
    let totalNeckRing = 0;
    let totalFunil = 0;
    let totalCriticos = 0;

    let maquinasFiltradas = Object.entries(dadosMaquinas);

    if (mostrarCriticos) {
        maquinasFiltradas = maquinasFiltradas.filter(([_, m]) => maquinaEstaCritica(m));
    }

    if (fornosAtivos.size > 0) {
        maquinasFiltradas = maquinasFiltradas.filter(([id]) =>
            Array.from(fornosAtivos).some(forno => maquinaPertenceAoForno(id, forno))
        );
    }

    maquinasFiltradas.sort((a, b) => ordenarMaquinasPorId(a[0], b[0]));

    for (let [id, m] of maquinasFiltradas) {
        if (filtro && !id.toLowerCase().includes(filtro)) continue;

        totalMolde += m.molde || 0;
        totalBlank += m.blank || 0;
        totalNeckRing += m.neck_ring || 0;
        totalFunil += m.funil || 0;

        const itensCriticos = obterItensCriticos(m);
        const alerta = config.alertasAtivos && itensCriticos.length > 0;

        if (itensCriticos.length > 0) totalCriticos++;

        const isInMaintenance = isMachineInMaintenance(id);
        const maintenanceReason = machineMaintenance[id]?.reason || machineMaintenance[id]?.motivo || '';

        const maquinaAmostra = Boolean(m.amostra);

        let maquinaHTML = `
            <div class="maquina ${alerta ? "alerta" : ""} ${maquinaAmostra ? "maquina-amostra" : ""} ${isInMaintenance ? "maintenance" : ""}">
                <div class="maquina-header">
                    <button
                        type="button"
                        class="maquina-id maquina-id-clickable ${maquinaAmostra ? "ativa" : ""}"
                        onclick="alternarMaquinaAmostra('${id}')"
                        title="Marcar ou desmarcar ${id} como máquina amostra"
                        aria-pressed="${maquinaAmostra}">
                        <i class="fas fa-industry"></i>
                        <span class="maquina-texto">Máquina</span><span class="maquina-codigo">${id}</span>
                    </button>`;

        if (config.mostrarPrefixo) {
            const currentPrefixo = m.prefixo || "";
            const currentPrefixDisplay = getMachinePrefixDisplay(m, prefixos);
            const currentPrefixRecord =
                findPrefixRecord(prefixos, currentPrefixo) ||
                findPrefixRecord(prefixos, currentPrefixDisplay);

            maquinaHTML += `
                    <div class="prefixo-container">
                        <div class="prefixo-actions">
                            <div class="custom-select">
                                <div class="select-selected" onclick="toggleCustomSelect('${id}')">
                                    ${currentPrefixDisplay || currentPrefixo || "Selecione um prefixo"}
                                </div>
                                <div class="select-items" id="select-${id}">
                                    <div class="select-search-container prefix-create-row">
                                        <input type="text" id="prefix-search-${id}" class="select-search" placeholder="Pesquisar prefixo..."
                                               oninput="filtrarOpcoes('${id}', this.value)" onkeydown="criarPrefixoComEnter(event, '${id}')">
                                        <button type="button" class="prefix-add-btn" onclick="criarPrefixoPeloFiltro('${id}', event)" title="Criar prefixo principal e vincular à máquina">
                                            <i class="fas fa-plus"></i>
                                        </button>
                                    </div>
                                    ${prefixos.map(pref => `
                                        <div onclick="selecionarPrefixo('${id}', '${pref.id}')"
                                             ${pref.id === currentPrefixo || pref.displayName === currentPrefixDisplay ? "class=\"selected\"" : ""}>
                                            <strong>${pref.displayName || pref.nome}</strong>
                                            ${pref.id !== (pref.displayName || pref.nome) ? `<small style="display:block; opacity:.7; margin-top:2px;">${pref.id}</small>` : ""}
                                        </div>
                                    `).join("")}
                                </div>
                            </div>
                            <button
                                type="button"
                                class="prefixo-view-btn ${currentPrefixRecord ? "" : "disabled"}"
                                onclick="abrirDetalhesPrefixo('${id}')"
                                title="Visualizar informações do prefixo detalhado"
                                ${currentPrefixRecord ? "" : "disabled"}>
                                <i class="fas fa-eye"></i>
                            </button>
                            <button
                                type="button"
                                class="maintenance-toggle-btn ${isMachineInMaintenance(id) ? 'active' : ''}"
                                onclick="toggleMachineMaintenance('${id}')"
                                title="${isMachineInMaintenance(id) ? 'Retirar da manutenção' : 'Colocar em parada para manutenção'}"
                                aria-pressed="${isMachineInMaintenance(id)}">
                                <i class="fas fa-tools"></i>
                            </button>
                        </div>
                    </div>`;
        }

        maquinaHTML += `
                </div>`;

        if (isInMaintenance) {
            maquinaHTML += `
                <div class="maintenance-message">
                    <i class="fas fa-tools"></i> Parada para manutenção${maintenanceReason ? `: ${maintenanceReason}` : ''}
                </div>`;
        }

        if (config.mostrarMolde) {
            maquinaHTML += renderLinhaControle(id, "molde", "Molde", "fas fa-cube", "molde-bg", m.molde || 0);
            if (config.mostrarReserva) maquinaHTML += renderLinhaControle(id, "molde_reserva", "Reserva", "fas fa-warehouse", "molde-bg", m.molde_reserva || 0, true);
        }

        if (config.mostrarBlank) {
            maquinaHTML += renderLinhaControle(id, "blank", "Blank", "fas fa-cube", "blank-bg", m.blank || 0);
            if (config.mostrarReserva) maquinaHTML += renderLinhaControle(id, "blank_reserva", "Reserva", "fas fa-warehouse", "blank-bg", m.blank_reserva || 0, true);
        }

        if (config.mostrarNeckring) {
            maquinaHTML += renderLinhaControle(id, "neck_ring", "Neck Ring", "fas fa-ring", "neckring-bg", m.neck_ring || 0);
            if (config.mostrarReserva) maquinaHTML += renderLinhaControle(id, "neck_ring_reserva", "Reserva", "fas fa-warehouse", "neckring-bg", m.neck_ring_reserva || 0, true);
        }

        if (config.mostrarFunil) {
            maquinaHTML += renderLinhaControle(id, "funil", "Funil", "fas fa-filter", "funil-bg", m.funil || 0);
            if (config.mostrarReserva) maquinaHTML += renderLinhaControle(id, "funil_reserva", "Reserva", "fas fa-warehouse", "funil-bg", m.funil_reserva || 0, true);
        }

        if (maquinaAmostra) {
            maquinaHTML += `
                <div class="amostra-message">
                    <i class="fas fa-vial"></i> Máquina amostra
                </div>`;
        }

        if (alerta) {
            maquinaHTML += `
                <div class="alert-message">
                    <i class="fas fa-exclamation-triangle"></i> Estoque crítico: ${itensCriticos.map(item => `${item.rotulo} ≤ ${item.limite}`).join(' | ')}
                </div>`;
        }

        maquinaHTML += `
            </div>`;

        painel.insertAdjacentHTML("beforeend", maquinaHTML);
    }

    atualizarTotais(totalMolde, totalBlank, totalNeckRing, totalFunil, totalCriticos);
}

function renderLinhaControle(maquinaId, tipo, rotulo, icone, classeBotao, valor, reserva = false) {
    const labelClass = obterClasseLabel(tipo);
    const reservaClass = reserva ? " reserva" : "";
    const reservaLabelClass = reserva ? " reserva-label" : "";

    return `
        <div class="linha${reservaClass}">
            <span class="${labelClass}${reservaLabelClass}"><i class="${icone}"></i> ${rotulo}:</span>
            <div class="controles">
                <div class="btn-group decrementos">
                    <button class="${classeBotao}" onclick="alterar('${maquinaId}', '${tipo}', -10)">-10</button>
                    <button class="${classeBotao}" onclick="alterar('${maquinaId}', '${tipo}', -5)">-5</button>
                    <button class="${classeBotao}" onclick="alterar('${maquinaId}', '${tipo}', -2)">-2</button>
                    <button class="${classeBotao}" onclick="alterar('${maquinaId}', '${tipo}', -1)">-1</button>
                </div>
                <div class="valor-controle">
                    <span id="${maquinaId}-${tipo}">${valor}</span>
                    <input type="number" class="input-digitado" id="input-${maquinaId}-${tipo}" value="${valor}"
                           onblur="atualizarPorInput('${maquinaId}', '${tipo}', this.value)"
                           onkeypress="if(event.key === 'Enter') { atualizarPorInput('${maquinaId}', '${tipo}', this.value); this.blur(); }">
                </div>
                <div class="btn-group incrementos">
                    <button class="${classeBotao}" onclick="alterar('${maquinaId}', '${tipo}', 1)">+1</button>
                    <button class="${classeBotao}" onclick="alterar('${maquinaId}', '${tipo}', 2)">+2</button>
                    <button class="${classeBotao}" onclick="alterar('${maquinaId}', '${tipo}', 5)">+5</button>
                    <button class="${classeBotao}" onclick="alterar('${maquinaId}', '${tipo}', 10)">+10</button>
                </div>
                <button class="btn-digitado" onclick="toggleModoDigitado('${maquinaId}', '${tipo}')" title="Digitar valor manualmente" aria-label="Digitar valor manualmente">
                    <i class="fas fa-keyboard"></i>
                </button>
            </div>
        </div>`;
}

function obterClasseLabel(tipo) {
    if (tipo.startsWith("molde")) return "molde-label";
    if (tipo.startsWith("blank")) return "blank-label";
    if (tipo.startsWith("neck_ring")) return "neckring-label";
    if (tipo.startsWith("funil")) return "funil-label";
    return "molde-label";
}

function maquinaPertenceAoForno(maquinaId, forno) {
    const id = String(maquinaId).trim().toUpperCase();
    if (forno === "A") return /^A[1-6]$/.test(id);
    if (forno === "B") return /^B[1-8]$/.test(id);
    if (forno === "C") return /^C[1-8]$/.test(id);
    if (forno === "D") return /^D1[0-5]$/.test(id) || /^1[0-5]$/.test(id);
    return true;
}

function ordenarMaquinasPorId(a, b) {
    const parse = (value) => {
        const match = String(value).toUpperCase().match(/^([A-Z]*)(\d+)$/);
        return match ? { prefixo: match[1] || "D", numero: Number(match[2]) } : { prefixo: String(value), numero: 0 };
    };
    const itemA = parse(a);
    const itemB = parse(b);
    if (itemA.prefixo !== itemB.prefixo) return itemA.prefixo.localeCompare(itemB.prefixo);
    return itemA.numero - itemB.numero;
}

// ====================================================
// FUNÇÕES AUXILIARES
// ====================================================

function atualizarTotais(totalMolde, totalBlank, totalNeckRing, totalFunil, totalCriticos) {
    const totalMoldeElement = document.getElementById("total-molde");
    const totalBlankElement = document.getElementById("total-blank");
    const totalNeckringElement = document.getElementById("total-neckring");
    const totalFunilElement = document.getElementById("total-funil");
    const totalCriticosElement = document.getElementById("total-criticos");
    
    if (totalMoldeElement) totalMoldeElement.textContent = totalMolde;
    if (totalBlankElement) totalBlankElement.textContent = totalBlank;
    if (totalNeckringElement) totalNeckringElement.textContent = totalNeckRing;
    if (totalFunilElement) totalFunilElement.textContent = totalFunil;
    if (totalCriticosElement) totalCriticosElement.textContent = totalCriticos;
    
    // Atualizar o botão de críticos
    const btn = document.getElementById("btnCriticos");
    if (btn) {
        btn.innerHTML = mostrarCriticos ? 
            `<i class="fas fa-check-circle"></i> Exibindo Críticos (${totalCriticos})` : 
            `<i class="fas fa-exclamation-triangle"></i> Ver Críticos`;
            
        if (mostrarCriticos) {
            btn.classList.add("criticos");
        } else {
            btn.classList.remove("criticos");
        }
    }
}

// ====================================================
// FUNÇÕES PARA O SELECT PESQUISÁVEL
// ====================================================

function toggleCustomSelect(maquinaId) {
    const select = document.getElementById(`select-${maquinaId}`);
    const btn = document.querySelector(`#select-${maquinaId}`).previousElementSibling;
    
    // Fechar todos os outros selects abertos
    document.querySelectorAll('.select-items').forEach(el => {
        if (el.id !== `select-${maquinaId}`) {
            el.style.display = 'none';
            el.previousElementSibling.classList.remove('select-arrow-active');
        }
    });
    
    if (select.style.display === 'block') {
        select.style.display = 'none';
        btn.classList.remove('select-arrow-active');
    } else {
        select.style.display = 'block';
        btn.classList.add('select-arrow-active');
    }
}

function filtrarOpcoes(maquinaId, termo) {
    const select = document.getElementById(`select-${maquinaId}`);
    if (!select) return;
    const itens = select.querySelectorAll(':scope > div:not(.select-search-container)');
    const busca = String(termo || '').toLowerCase();
    
    itens.forEach(item => {
        if (item.textContent.toLowerCase().includes(busca)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

function normalizarNovoPrefixo(valor) {
    return String(valor || '').trim().replace(/\s+/g, ' ');
}

function validarChaveFirebasePrefixo(prefixo) {
    return prefixo && !/[.#$\[\]\/]/.test(prefixo);
}

function criarPrefixoComEnter(event, maquinaId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        criarPrefixoPeloFiltro(maquinaId, event);
    }
}

async function criarPrefixoPeloFiltro(maquinaId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const input = document.getElementById(`prefix-search-${maquinaId}`);
    const prefixoId = normalizarNovoPrefixo(input ? input.value : '');

    if (!prefixoId) {
        mostrarNotificacao('Digite o prefixo no campo de pesquisa para criar.', 'warning');
        return;
    }

    if (!validarChaveFirebasePrefixo(prefixoId)) {
        mostrarNotificacao('O prefixo não pode conter os caracteres . # $ [ ] /', 'error');
        return;
    }

    try {
        const ref = db.ref(`prefixDatabase/${prefixoId}`);
        const snap = await ref.once('value');

        if (!snap.exists()) {
            await ref.set({
                nome: prefixoId,
                displayName: prefixoId,
                prefixoDetalhado: prefixoId,
                criadoEm: Date.now(),
                origem: 'atalho_card_maquina'
            });
        }

        if (!prefixos.some(pref => pref.id === prefixoId)) {
            prefixos.push({
                id: prefixoId,
                nome: prefixoId,
                displayName: prefixoId,
                prefixoDetalhado: prefixoId
            });
        }

        selecionarPrefixo(maquinaId, prefixoId);
        mostrarNotificacao(snap.exists() ? `Prefixo vinculado: ${prefixoId}` : `Prefixo criado e vinculado: ${prefixoId}`, 'success');
    } catch (error) {
        console.error('❌ Erro ao criar prefixo:', error);
        mostrarNotificacao('Erro ao criar/vincular prefixo.', 'error');
    }
}

function selecionarPrefixo(maquinaId, prefixoId) {
    // Atualizar o texto exibido
    const btn = document.querySelector(`#select-${maquinaId}`).previousElementSibling;
    btn.textContent = prefixoId;
    btn.classList.remove('select-arrow-active');
    
    // Fechar o dropdown
    document.getElementById(`select-${maquinaId}`).style.display = 'none';
    
    // Atualizar no banco de dados
    atualizarPrefixo(maquinaId, prefixoId);
}

// Fechar selects ao clicar fora
document.addEventListener('click', function(event) {
    if (!event.target.matches('.select-selected') && !event.target.matches('.select-items *')) {
        document.querySelectorAll('.select-items').forEach(el => {
            el.style.display = 'none';
            el.previousElementSibling.classList.remove('select-arrow-active');
        });
    }
});

// ====================================================
// FUNÇÃO: ALTERAR QUANTIDADE DE PEÇAS
// ====================================================

async function alterar(maquinaId, tipo, delta) {
    if (isMachineInMaintenance(maquinaId)) {
        mostrarNotificacao('Máquina em parada para manutenção.', 'warning');
        return;
    }

    const normalizedTipo = (window.WMHistory && WMHistory.normalizeField) ? WMHistory.normalizeField(tipo) : tipo;
    const element = document.getElementById(`${maquinaId}-${tipo}`) || document.getElementById(`${maquinaId}-${normalizedTipo}`);
    const previousValue = parseInt(element?.textContent) || 0;
    const optimisticValue = Math.max(0, previousValue + Number(delta || 0));

    if (element) {
        element.textContent = optimisticValue;
        element.style.transform = 'scale(1.1)';
        element.style.color = '#0ea5e9';
        setTimeout(() => {
            element.style.transform = '';
            element.style.color = '';
        }, 200);
    }

    try {
        let committedValue;
        if (window.WMHistory && typeof WMHistory.atomicDelta === 'function') {
            committedValue = await WMHistory.atomicDelta(maquinaId, normalizedTipo, delta, {
                origem: 'abastecedor_botao',
                field: normalizedTipo
            });
        } else {
            const ref = db.ref(`maquinas/${maquinaId}/${normalizedTipo}`);
            const tx = await ref.transaction(current => Math.max(0, (parseInt(current, 10) || 0) + Number(delta || 0)));
            if (!tx.committed) throw new Error('Transação cancelada.');
            committedValue = parseInt(tx.snapshot.val(), 10) || 0;
        }
        if (element) element.textContent = committedValue;
    } catch (error) {
        console.error('❌ Erro ao alterar quantidade:', error);
        if (element) element.textContent = previousValue;
        mostrarNotificacao(`Erro ao salvar alteração da máquina ${maquinaId}.`, 'error');
    }
}

// ====================================================
// FUNÇÃO: ATUALIZAR PREFIXO DA MÁQUINA
// ====================================================

function atualizarPrefixo(maquinaId, prefixoId) {
    const ref = db.ref(`maquinas/${maquinaId}/prefixo`);
    ref.set(prefixoId);
    
    mostrarNotificacao(`Prefixo atualizado para: ${prefixoId}`, "info");
}


function alternarMaquinaAmostra(maquinaId) {
    const atual = Boolean(dadosMaquinas?.[maquinaId]?.amostra);
    const novoEstado = !atual;

    if (!dadosMaquinas[maquinaId]) {
        dadosMaquinas[maquinaId] = {};
    }
    dadosMaquinas[maquinaId].amostra = novoEstado;

    db.ref(`maquinas/${maquinaId}/amostra`).set(novoEstado)
        .then(() => {
            criarPainel(dadosMaquinas);
            mostrarNotificacao(
                novoEstado
                    ? `Máquina ${maquinaId} marcada como amostra.`
                    : `Máquina ${maquinaId} removida de amostra.`,
                "info"
            );
        })
        .catch(error => {
            dadosMaquinas[maquinaId].amostra = atual;
            mostrarNotificacao(`Erro ao atualizar máquina amostra: ${error.message}`, "error");
        });
}

window.alternarMaquinaAmostra = alternarMaquinaAmostra;

// ====================================================
// FUNÇÃO: FILTRAR MÁQUINAS
// ====================================================

function filtrar() {
    criarPainel(dadosMaquinas);
}

// ====================================================
// FUNÇÃO: FILTRAR POR FORNO
// ====================================================

function filtrarPorForno(forno) {
    const botoes = {
        todos: document.getElementById("btnTodos"),
        A: document.getElementById("btnFornoA"),
        B: document.getElementById("btnFornoB"),
        C: document.getElementById("btnFornoC"),
        D: document.getElementById("btnFornoD")
    };

    if (forno === "todos") {
        fornosAtivos.clear();
    } else if (["A", "B", "C", "D"].includes(forno)) {
        if (fornosAtivos.has(forno)) {
            fornosAtivos.delete(forno);
        } else {
            fornosAtivos.add(forno);
        }
    }

    Object.entries(botoes).forEach(([chave, btn]) => {
        if (!btn) return;

        const ativo = chave === "todos"
            ? fornosAtivos.size === 0
            : fornosAtivos.has(chave);

        btn.classList.toggle("active", ativo);
        btn.setAttribute("aria-pressed", String(ativo));
    });

    filtrar();
}

function aplicarEstadoModoCompacto(notificar = true) {
    const btn = document.getElementById("btnModoCompacto");
    document.body.classList.toggle("modo-compacto", modoCompactoAtivo);

    if (btn) {
        btn.classList.toggle("active", modoCompactoAtivo);
        btn.setAttribute("aria-pressed", String(modoCompactoAtivo));
        btn.innerHTML = modoCompactoAtivo
            ? '<i class="fas fa-up-right-and-down-left-from-center"></i> Modo Normal'
            : '<i class="fas fa-compress-alt"></i> Modo Compacto';
    }

    if (notificar) {
        mostrarNotificacao(modoCompactoAtivo ? "Modo compacto ativado" : "Modo compacto desativado", "info");
    }
}

function alternarModoCompacto() {
    modoCompactoAtivo = !modoCompactoAtivo;
    localStorage.setItem("modoCompacto", String(modoCompactoAtivo));
    aplicarEstadoModoCompacto(true);
}

window.alternarModoCompacto = alternarModoCompacto;

// ====================================================
// FUNÇÃO: ALTERNAR VISUALIZAÇÃO DE CRÍTICOS
// ====================================================

function alternarCriticos() {
    mostrarCriticos = !mostrarCriticos;
    criarPainel(dadosMaquinas);
}

// ====================================================
// FUNÇÃO: ALTERNAR MODO ESCURO
// ====================================================

function alternarModoEscuro() {
    const body = document.body;
    const btn = document.querySelector('.dark-mode-toggle');
    
    body.classList.toggle('dark-mode');
    modoEscuroAtivo = body.classList.contains('dark-mode');
    
    // Salvar preferência no localStorage
    localStorage.setItem('modoEscuro', modoEscuroAtivo);
    
    // Atualizar texto do botão
    if (modoEscuroAtivo) {
        btn.innerHTML = '<i class="fas fa-sun"></i> Modo Claro';
        mostrarNotificacao("Modo escuro ativado", "info");
    } else {
        btn.innerHTML = '<i class="fas fa-moon"></i> Modo Escuro';
        mostrarNotificacao("Modo claro ativado", "info");
    }
}

// ====================================================
// FUNÇÃO: RECARREGAR DADOS
// ====================================================

function recarregarDados() {
    db.ref("maquinas").once("value").then(snapshot => {
        const dados = snapshot.val();
        if (dados) {
            criarPainel(dados);
            atualizarGrafico(dados);
            atualizarGraficoTotal(dados);
            mostrarNotificacao("Dados atualizados com sucesso!", "info");
        }
    });
}

// ====================================================
// FUNÇÃO: TROCAR DE ABA
// ====================================================

function openTab(tabId) {
    // Esconder todas as abas
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));
    
    // Remover classe ativa de todos os botões
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Mostrar aba selecionada
    document.getElementById(tabId).classList.add('active');
    
    // Ativar botão da aba selecionada
    event.currentTarget.classList.add('active');
    
    // Atualizar gráficos se necessário
    if (tabId === 'dashboard' && Object.keys(dadosMaquinas).length > 0) {
        atualizarGrafico(dadosMaquinas);
        atualizarGraficoTotal(dadosMaquinas);
    }
}

// ====================================================
// FUNÇÃO: MOSTRAR NOTIFICAÇÃO
// ====================================================

function mostrarNotificacao(msg, tipo = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`;
    
    let icon = "fas fa-check-circle";
    if (tipo === "error") icon = "fas fa-exclamation-circle";
    if (tipo === "warning") icon = "fas fa-exclamation-triangle";
    if (tipo === "info") icon = "fas fa-info-circle";
    
    toast.innerHTML = `<i class="${icon}"></i> ${msg}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = "fadeout 0.4s forwards";
        setTimeout(() => { toast.remove(); }, 400);
    }, 3000);
}

// ====================================================
// FUNÇÃO: GERAR PDF
// ====================================================

async function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const dataAtual = new Date();
    const dataStr = dataAtual.toLocaleDateString('pt-BR');
    const horaStr = dataAtual.toLocaleTimeString('pt-BR');
    const dataISO = dataAtual.toISOString().split("T")[0];

    // Configurações do relatório
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(`Relatório de Produção - WMoldes`, doc.internal.pageSize.width / 2, 15, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text(`Data: ${dataStr} | Hora: ${horaStr}`, doc.internal.pageSize.width / 2, 22, { align: "center" });

    // Preparar dados para a tabela
    const body = Object.keys(dadosMaquinas).map(id => {
        const m = dadosMaquinas[id];
        
        return [
            id, 
            m.prefixo || 'N/A',
            m.molde || 0,
            m.molde_reserva || 0,
            m.blank || 0,
            m.blank_reserva || 0,
            m.neck_ring || 0,
            m.neck_ring_reserva || 0,
            m.funil || 0,
            m.funil_reserva || 0
        ];
    });

    // Criar tabela no PDF
    doc.autoTable({
        startY: 30,
        head: [
            ['Máquina', 'Prefixo', 'Molde', 'Molde Reserva', 'Blank', 'Blank Reserva', 'Neck Ring', 'Neck Ring Reserva', 'Funil', 'Funil Reserva']
        ],
        body: body,
        theme: 'grid',
        headStyles: {
            fillColor: [14, 165, 233],
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        styles: {
            fontSize: 9,
            cellPadding: 3,
            valign: 'middle'
        },
        columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 22 },
            2: { cellWidth: 15 },
            3: { cellWidth: 20 },
            4: { cellWidth: 15 },
            5: { cellWidth: 20 },
            6: { cellWidth: 18 },
            7: { cellWidth: 22 },
            8: { cellWidth: 15 },
            9: { cellWidth: 20 }
        }
    });

    // Adicionar rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
        doc.text(`© WMoldes ${new Date().getFullYear()}`, 20, doc.internal.pageSize.height - 10);
    }

    // Salvar o PDF
    const nomeArquivo = `relatorio_producao_${dataISO}.pdf`;
    doc.save(nomeArquivo);
    
    // Notificar o usuário
    mostrarNotificacao(`PDF gerado: ${nomeArquivo}`, "info");
}

// ====================================================
// GRÁFICOS
// ====================================================

function inicializarGraficos() {
    sincronizarControlesDashboard();
    // Inicializar gráficos vazios
    const ctxProducao = document.getElementById("graficoProducao");
    const ctxTotal = document.getElementById("graficoTotal");
    
    if (ctxProducao) {
        graficoProducao = new Chart(ctxProducao, {
            type: "bar",
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "top" },
                    tooltip: { backgroundColor: 'rgba(30, 41, 59, 0.9)' }
                }
            }
        });
    }
    
    if (ctxTotal) {
        graficoTotal = new Chart(ctxTotal, {
            type: "bar",
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "top" },
                    tooltip: { backgroundColor: 'rgba(30, 41, 59, 0.9)' }
                }
            }
        });
    }
}

function atualizarGrafico(dados) {
    if (!config.mostrarGraficos || !graficoProducao) return;
    
    const maquinas = Object.keys(dados);
    const moldes = maquinas.map(id => dados[id].molde || 0);
    const blanks = maquinas.map(id => dados[id].blank || 0);
    const neckrings = maquinas.map(id => dados[id].neck_ring || 0);
    const funis = maquinas.map(id => dados[id].funil || 0);

    graficoProducao.data.labels = maquinas;
    const datasets = [
        {
            label: "Molde",
            data: moldes,
            backgroundColor: "rgba(14, 165, 233, 0.8)",
            borderColor: "rgba(14, 165, 233, 1)",
            borderWidth: 1
        },
        {
            label: "Blank",
            data: blanks,
            backgroundColor: "rgba(12, 74, 110, 0.8)",
            borderColor: "rgba(12, 74, 110, 1)",
            borderWidth: 1
        }
    ];

    if (mostrarNeckRingDashboard) {
        datasets.push({
            label: "Neck Ring",
            data: neckrings,
            backgroundColor: "rgba(79, 70, 229, 0.8)",
            borderColor: "rgba(79, 70, 229, 1)",
            borderWidth: 1
        });
    }

    if (mostrarFunilDashboard) {
        datasets.push({
            label: "Funil",
            data: funis,
            backgroundColor: "rgba(245, 158, 11, 0.8)",
            borderColor: "rgba(245, 158, 11, 1)",
            borderWidth: 1
        });
    }

    graficoProducao.data.datasets = datasets;    
    graficoProducao.update();
}

function atualizarGraficoTotal(dados) {
    if (!config.mostrarGraficos || !graficoTotal) return;
    
    const maquinas = Object.keys(dados);
    
    // Calcular totais (máquina + reserva)
    const moldesTotal = maquinas.map(id => 
        (dados[id].molde || 0) + (dados[id].molde_reserva || 0)
    );
    
    const blanksTotal = maquinas.map(id => 
        (dados[id].blank || 0) + (dados[id].blank_reserva || 0)
    );
    
    const neckringsTotal = maquinas.map(id => 
        (dados[id].neck_ring || 0) + (dados[id].neck_ring_reserva || 0)
    );
    
    const funisTotal = maquinas.map(id => 
        (dados[id].funil || 0) + (dados[id].funil_reserva || 0)
    );

    graficoTotal.data.labels = maquinas;
    const datasets = [
        {
            label: "Molde Total",
            data: moldesTotal,
            backgroundColor: "rgba(14, 165, 233, 0.6)",
            borderColor: "rgba(14, 165, 233, 1)",
            borderWidth: 1
        },
        {
            label: "Blank Total",
            data: blanksTotal,
            backgroundColor: "rgba(12, 74, 110, 0.6)",
            borderColor: "rgba(12, 74, 110, 1)",
            borderWidth: 1
        }
    ];

    if (mostrarNeckRingDashboard) {
        datasets.push({
            label: "Neck Ring Total",
            data: neckringsTotal,
            backgroundColor: "rgba(79, 70, 229, 0.6)",
            borderColor: "rgba(79, 70, 229, 1)",
            borderWidth: 1
        });
    }

    if (mostrarFunilDashboard) {
        datasets.push({
            label: "Funil Total",
            data: funisTotal,
            backgroundColor: "rgba(245, 158, 11, 0.6)",
            borderColor: "rgba(245, 158, 11, 1)",
            borderWidth: 1
        });
    }

    graficoTotal.data.datasets = datasets;    
    graficoTotal.update();
}


function sincronizarControlesDashboard() {
    const neck = document.getElementById('toggleGraficoNeckRing');
    const funil = document.getElementById('toggleGraficoFunil');

    if (neck) neck.checked = mostrarNeckRingDashboard;
    if (funil) funil.checked = mostrarFunilDashboard;
}

function atualizarVisualizacaoDashboard() {
    const neck = document.getElementById('toggleGraficoNeckRing');
    const funil = document.getElementById('toggleGraficoFunil');

    mostrarNeckRingDashboard = Boolean(neck?.checked);
    mostrarFunilDashboard = Boolean(funil?.checked);

    localStorage.setItem('mostrarNeckRingDashboard', String(mostrarNeckRingDashboard));
    localStorage.setItem('mostrarFunilDashboard', String(mostrarFunilDashboard));

    atualizarGrafico(dadosMaquinas);
    atualizarGraficoTotal(dadosMaquinas);
}

window.atualizarVisualizacaoDashboard = atualizarVisualizacaoDashboard;

// ====================================================
// PAINEL ADMINISTRATIVO
// ====================================================

function configurarEventoTitulo() {
    tituloPrincipal.addEventListener('click', function() {
        clicksTitulo++;
        
        if (timeoutClicks) {
            clearTimeout(timeoutClicks);
        }
        
        timeoutClicks = setTimeout(() => {
            clicksTitulo = 0;
        }, 2000);
        
        if (clicksTitulo === 5) {
            abrirPainelAdmin();
            clicksTitulo = 0;
        }
    });
}

// Aplicar tema selecionado
function aplicarTema(tema) {
    // Remover todos os temas
    document.body.classList.remove('tema-verde', 'tema-roxo', 'tema-vermelho', 'tema-laranja');
    
    // Aplicar novo tema
    if (tema !== 'ciano') {
        document.body.classList.add(`tema-${tema}`);
    }
    
    // Atualizar seleção visual
    document.querySelectorAll('.tema-option').forEach(el => {
        el.classList.remove('active');
    });
    const temaElement = document.querySelector(`.tema-${tema}`);
    if (temaElement) {
        temaElement.classList.add('active');
    }
}

// Selecionar tema
function selecionarTema(tema) {
    aplicarTema(tema);
    config.tema = tema;
}

// Painel administrativo
function abrirPainelAdmin() {
    document.getElementById('painelAdmin').classList.add('active');
    document.getElementById('adminOverlay').classList.add('active');
}

function fecharPainelAdmin() {
    document.getElementById('painelAdmin').classList.remove('active');
    document.getElementById('adminOverlay').classList.remove('active');
}

// Salvar configurações no Firebase
function salvarConfiguracoes() {
    config.mostrarReserva = document.getElementById('toggleReserva').checked;
    config.mostrarFunil = document.getElementById('toggleFunil').checked;
    config.mostrarNeckring = document.getElementById('toggleNeckring').checked;
    config.mostrarBlank = document.getElementById('toggleBlank').checked;
    config.mostrarMolde = document.getElementById('toggleMolde').checked;
    config.mostrarPrefixo = document.getElementById('togglePrefixo').checked;
    config.alertasAtivos = document.getElementById('toggleAlertas').checked;
    config.animacoesAtivas = document.getElementById('toggleAnimacoes').checked;
    config.autoAtualizar = document.getElementById('autoAtualizar').checked;
    config.mostrarTotais = document.getElementById('mostrarTotais').checked;
    config.mostrarGraficos = document.getElementById('mostrarGraficos').checked;
    config.estoqueMinimoMolde = Math.max(0, parseInt(document.getElementById('estoqueMinimoMolde').value, 10) || 0);
    config.estoqueMinimoBlank = Math.max(0, parseInt(document.getElementById('estoqueMinimoBlank').value, 10) || 0);
    config.estoqueMinimoNeckring = Math.max(0, parseInt(document.getElementById('estoqueMinimoNeckring').value, 10) || 0);
    config.estoqueMinimoFunil = Math.max(0, parseInt(document.getElementById('estoqueMinimoFunil').value, 10) || 0);
    config.estoqueMinimo = Math.min(config.estoqueMinimoMolde, config.estoqueMinimoBlank, config.estoqueMinimoNeckring, config.estoqueMinimoFunil);
    config.criticoMoldeAtivo = document.getElementById('criticoMoldeAtivo').checked;
    config.criticoBlankAtivo = document.getElementById('criticoBlankAtivo').checked;
    config.criticoNeckringAtivo = document.getElementById('criticoNeckringAtivo').checked;
    config.criticoFunilAtivo = document.getElementById('criticoFunilAtivo').checked;
    
    // Salvar no Firebase
    setWithAudit("configuracoes", config, {
        action: 'atualizou configurações do painel principal',
        details: 'Configurações visuais e operacionais do painel foram alteradas.',
        entityType: 'configuracao',
        entityId: 'painel-principal'
    }).then(() => {
        // Aplicar configurações imediatamente
        const totaisElement = document.getElementById('totais');
        if (totaisElement) {
            totaisElement.style.display = config.mostrarTotais ? 'grid' : 'none';
        }
        
        const graficosElement = document.querySelector('.graficos-container');
        if (graficosElement) {
            graficosElement.style.display = config.mostrarGraficos ? 'grid' : 'none';
        }
        
        atualizarResumoLimitesCriticos();
        
        if (Object.keys(dadosMaquinas).length > 0) {
            criarPainel(dadosMaquinas);
        }
        
        mostrarNotificacao("Configurações salvas no servidor!", "success");
        fecharPainelAdmin();
    }).catch(error => {
        mostrarNotificacao("Erro ao salvar configurações: " + error.message, "error");
    });
}


// ====================================================
// DETALHES DO PREFIXO
// ====================================================

function getPrefixRecordByMachine(maquinaId) {
    const machine = dadosMaquinas?.[maquinaId];
    if (!machine) return null;

    return (
        findPrefixRecord(prefixos, machine.prefixo) ||
        findPrefixRecord(prefixos, machine.prefixoDetalhado) ||
        findPrefixRecord(prefixos, machine.prefixo_detalhado) ||
        null
    );
}

function normalizePrefixValue(value) {
    if (Array.isArray(value)) {
        return value.join(', ');
    }

    return String(value);
}

function collectPrefixEntries(obj, hiddenKeys) {
    const entries = [];

    Object.entries(obj || {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        if (hiddenKeys.has(key)) return;

        if (Array.isArray(value)) {
            if (!value.length) return;
            entries.push({ label: formatPrefixFieldLabel(key), value: value.join(', ') });
            return;
        }

        if (typeof value === 'object') {
            const nestedEntries = collectPrefixEntries(value, hiddenKeys);
            if (nestedEntries.length) {
                entries.push({
                    label: formatPrefixFieldLabel(key),
                    value: nestedEntries,
                    isGroup: true
                });
            }
            return;
        }

        entries.push({ label: formatPrefixFieldLabel(key), value: normalizePrefixValue(value) });
    });

    return entries;
}

function renderPrefixEntry(entry) {
    if (entry.isGroup) {
        const groupItems = entry.value.map(item => renderPrefixEntry(item)).join('');
        return `
            <section class="prefixo-detail-section">
                <div class="prefixo-detail-section-title">${entry.label}</div>
                <div class="prefixo-detail-section-grid">${groupItems}</div>
            </section>
        `;
    }

    const normalizedValue = String(entry.value).startsWith('http')
        ? `<a href="${entry.value}" target="_blank" rel="noopener noreferrer">${entry.value}</a>`
        : `${entry.value}`;

    return `
        <div class="prefixo-detail-item">
            <div class="prefixo-detail-label">${entry.label}</div>
            <div class="prefixo-detail-value">${normalizedValue}</div>
        </div>
    `;
}

function renderPrefixDetails(prefixRecord) {
    if (!prefixRecord) {
        return '<div class="prefixo-detail-empty">Nenhuma informação detalhada encontrada para este prefixo.</div>';
    }

    const hiddenKeys = new Set([
        'image', 'img', 'imageUrl', 'imageURL', 'imagem', 'imagemUrl', 'imagemURL', 'linkImagem', 'imgbb', 'url',
        'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'createdEm', 'atualizadoEm', 'criadoEm', 'criadoPor',
        'nome', 'displayName', 'prefixoDetalhado', 'prefixo_detalhado', 'id', 'prefixGrande'
    ]);

    const imageUrl = getPrefixImageUrl(prefixRecord);
    const entries = collectPrefixEntries(prefixRecord, hiddenKeys);
    const entriesHtml = entries.map(renderPrefixEntry).join('');

    return `
        <div class="prefixo-detail-layout ${imageUrl ? 'has-image' : 'no-image'}">
            ${imageUrl ? `
                <div class="prefixo-detail-image-wrap">
                    <img src="${imageUrl}" alt="Imagem do prefixo" class="prefixo-detail-image" onclick="viewPrefixImageFull('${imageUrl}')" />
                    <a href="${imageUrl}" target="_blank" rel="noopener noreferrer" class="prefixo-detail-link">
                        <i class="fas fa-up-right-from-square"></i> Abrir imagem
                    </a>
                </div>` : ''}
            <div class="prefixo-detail-grid">${entriesHtml || '<div class="prefixo-detail-empty">Nenhum campo adicional encontrado.</div>'}</div>
        </div>
    `;
}

function fecharModalPrefixo() {
    const overlay = document.getElementById('prefixoModalOverlay');
    if (overlay) overlay.remove();
}

function abrirDetalhesPrefixo(maquinaId) {
    const machine = dadosMaquinas?.[maquinaId];
    const prefixRecord = getPrefixRecordByMachine(maquinaId);

    if (!machine || !prefixRecord) {
        mostrarNotificacao('Nenhum prefixo detalhado disponível para esta máquina.', 'warning');
        return;
    }

    fecharModalPrefixo();

    const overlay = document.createElement('div');
    overlay.id = 'prefixoModalOverlay';
    overlay.className = 'prefixo-modal-overlay';
    overlay.innerHTML = `
        <div class="prefixo-modal-card">
            <button type="button" class="prefixo-modal-close" onclick="fecharModalPrefixo()">
                <i class="fas fa-times"></i>
            </button>
            <div class="prefixo-modal-header">
                <div>
                    <div class="prefixo-modal-subtitle">Máquina ${maquinaId}</div>
                    <h3>${prefixRecord.displayName || prefixRecord.nome || prefixRecord.id}</h3>
                </div>
            </div>
            ${renderPrefixDetails(prefixRecord)}
        </div>
    `;

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) fecharModalPrefixo();
    });

    document.body.appendChild(overlay);
}

// ====================================================
// EXPORTAR FUNÇÕES PARA USO GLOBAL
// ====================================================

// Exportar funções principais
window.filtrar = filtrar;
window.filtrarPorForno = filtrarPorForno;
window.alternarCriticos = alternarCriticos;
window.alternarModoEscuro = alternarModoEscuro;
window.recarregarDados = recarregarDados;
window.openTab = openTab;
window.gerarPDF = gerarPDF;
window.logout = logout;

// Exportar funções de controle
window.alterar = alterar;
window.toggleCustomSelect = toggleCustomSelect;
window.filtrarOpcoes = filtrarOpcoes;
window.selecionarPrefixo = selecionarPrefixo;
window.atualizarPrefixo = atualizarPrefixo;
window.abrirDetalhesPrefixo = abrirDetalhesPrefixo;
window.fecharModalPrefixo = fecharModalPrefixo;

// Exportar funções do painel admin
window.selecionarTema = selecionarTema;
window.abrirPainelAdmin = abrirPainelAdmin;
window.fecharPainelAdmin = fecharPainelAdmin;
window.salvarConfiguracoes = salvarConfiguracoes;

// Exportar função de notificação
window.mostrarNotificacao = mostrarNotificacao;

// ====================================================
// FUNÇÕES PARA MODO DIGITADO
// ====================================================

function toggleModoDigitado(maquinaId, tipo) {
    const spanElement = document.getElementById(`${maquinaId}-${tipo}`);
    const inputElement = document.getElementById(`input-${maquinaId}-${tipo}`);
    const btnElement = event.currentTarget;
    
    if (inputElement.style.display === 'none' || inputElement.style.display === '') {
        // Mostrar input, esconder span
        spanElement.style.display = 'none';
        inputElement.style.display = 'block';
        inputElement.focus();
        inputElement.select();
        btnElement.innerHTML = '<i class="fas fa-check"></i>';
        btnElement.classList.add('ativo-digitacao');
    } else {
        // Mostrar span, esconder input
        atualizarPorInput(maquinaId, tipo, inputElement.value);
    }
}

async function atualizarPorInput(maquinaId, tipo, valor) {
    const spanElement = document.getElementById(`${maquinaId}-${tipo}`);
    const inputElement = document.getElementById(`input-${maquinaId}-${tipo}`);
    const btnElement = inputElement.closest('.controles').querySelector('.btn-digitado');
    const valorAtual = parseInt(spanElement.textContent) || 0;
    const novoValor = Math.max(0, parseInt(valor, 10) || 0);

    spanElement.textContent = novoValor;
    inputElement.value = novoValor;
    spanElement.style.display = 'block';
    inputElement.style.display = 'none';
    btnElement.innerHTML = '<i class="fas fa-keyboard"></i>';
    btnElement.classList.remove('ativo-digitacao');

    try {
        if (window.WMHistory && typeof WMHistory.setFieldAndSnapshot === 'function') {
            await WMHistory.setFieldAndSnapshot(maquinaId, tipo, novoValor, {
                origem: 'abastecedor_digitacao',
                field: tipo
            });
        } else {
            await db.ref(`maquinas/${maquinaId}/${tipo}`).set(novoValor);
        }
    } catch (error) {
        console.error('❌ Erro ao atualizar valor digitado:', error);
        spanElement.textContent = valorAtual;
        inputElement.value = valorAtual;
        mostrarNotificacao(`Erro ao salvar ${tipo} da máquina ${maquinaId}.`, 'error');
        return;
    }

    spanElement.style.transform = 'scale(1.1)';
    spanElement.style.color = '#0ea5e9';
    setTimeout(() => {
        spanElement.style.transform = '';
        spanElement.style.color = '';
    }, 200);

    mostrarNotificacao(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} da máquina ${maquinaId} atualizado para ${novoValor}`, "info");
}

// Exportar as novas funções
window.toggleModoDigitado = toggleModoDigitado;
window.atualizarPorInput = atualizarPorInput;

// Exportar função de notificação
window.mostrarNotificacao = mostrarNotificacao;

console.log("✅ Script principal carregado");


// ====================================================
// MANUTENÇÃO COMPARTILHADA ENTRE PAINEL E ABASTECEDOR
// ====================================================
function isMachineInMaintenance(machineId) {
    const status = machineMaintenance?.[machineId];
    return !!(status && (status.isInMaintenance === true || status.status === 'maintenance' || status.status === 'manutencao'));
}

async function toggleMachineMaintenance(machineId) {
    const current = isMachineInMaintenance(machineId);
    const action = current ? 'retirar esta máquina da manutenção' : 'colocar esta máquina em parada para manutenção';
    if (!confirm(`Deseja ${action}?`)) return;

    try {
        if (current) {
            await db.ref(`manutencao/${machineId}`).remove();
            mostrarNotificacao(`Máquina ${machineId} retomada da produção.`, 'success');
        } else {
            const reason = prompt('Motivo da manutenção (opcional):') || '';
            await db.ref(`manutencao/${machineId}`).set({
                isInMaintenance: true,
                status: 'maintenance',
                reason: reason.trim(),
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                source: 'controle-por-maquina'
            });
            mostrarNotificacao(`Máquina ${machineId} em parada para manutenção.`, 'success');
        }
    } catch (error) {
        console.error('Erro ao atualizar manutenção:', error);
        mostrarNotificacao('Erro ao atualizar manutenção.', 'error');
    }
}
