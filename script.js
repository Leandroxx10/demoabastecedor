// ====================================================
// CONFIGURAÇÃO PRINCIPAL
// ====================================================

// Dados das máquinas
let dadosMaquinas = {};

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
    estoqueMinimo: 3
};

// Configuração de filtro por forno
let fornoAtivo = 'todos';
let modoCompactoAtivo = localStorage.getItem('modoCompacto') === 'true';
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
            config = configSalva;
            
            // Aplicar configurações aos checkboxes (se o painel admin existir)
            if (document.getElementById('toggleReserva')) {
                document.getElementById('toggleReserva').checked = config.mostrarReserva;
                document.getElementById('toggleFunil').checked = config.mostrarFunil;
                document.getElementById('toggleNeckring').checked = config.mostrarNeckring;
                document.getElementById('toggleBlank').checked = config.mostrarBlank;
                document.getElementById('toggleMolde').checked = config.mostrarMolde;
                document.getElementById('togglePrefixo').checked = config.mostrarPrefixo;
                document.getElementById('toggleAlertas').checked = config.alertasAtivos;
                document.getElementById('toggleAnimacoes').checked = config.animacoesAtivas;
                document.getElementById('autoAtualizar').checked = config.autoAtualizar;
                document.getElementById('mostrarTotais').checked = config.mostrarTotais;
                document.getElementById('mostrarGraficos').checked = config.mostrarGraficos;
                document.getElementById('estoqueMinimo').value = config.estoqueMinimo;
            }
            
            // Atualizar label do estoque mínimo
            document.getElementById('estoqueMinimoLabel').textContent = config.estoqueMinimo;
            
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
        }
    }).catch(error => {
        console.error("❌ Erro ao carregar configurações:", error);
    });
}

// ====================================================
// CARREGAR PREFIXOS
// ====================================================

async function carregarPrefixos() {
    try {
        prefixos = await getPrefixosFromFirebase();
        console.log("✅ Prefixos carregados:", prefixos.length);
    } catch (error) {
        console.error("❌ Erro ao carregar prefixos:", error);
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
    
    // Listener para configurações (sincroniza entre todos os usuários)
    db.ref("configuracoes").on("value", snapshot => {
        const configSalva = snapshot.val();
        if (configSalva) {
            config = configSalva;
            
            // Aplicar configurações imediatamente
            document.getElementById('estoqueMinimoLabel').textContent = config.estoqueMinimo;
            
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
        maquinasFiltradas = maquinasFiltradas.filter(([_, m]) =>
            (m.molde || 0) <= config.estoqueMinimo ||
            (m.blank || 0) <= config.estoqueMinimo ||
            (m.funil || 0) <= config.estoqueMinimo
        );
    }

    if (fornoAtivo !== "todos") {
        maquinasFiltradas = maquinasFiltradas.filter(([id]) => maquinaPertenceAoForno(id, fornoAtivo));
    }

    maquinasFiltradas.sort((a, b) => ordenarMaquinasPorId(a[0], b[0]));

    for (let [id, m] of maquinasFiltradas) {
        if (filtro && !id.toLowerCase().includes(filtro)) continue;

        totalMolde += m.molde || 0;
        totalBlank += m.blank || 0;
        totalNeckRing += m.neck_ring || 0;
        totalFunil += m.funil || 0;

        const alerta = config.alertasAtivos && (
            (m.molde || 0) <= config.estoqueMinimo ||
            (m.blank || 0) <= config.estoqueMinimo ||
            (m.funil || 0) <= config.estoqueMinimo
        );

        if (alerta) totalCriticos++;

        let maquinaHTML = `
            <div class="maquina ${alerta ? "alerta" : ""}">
                <div class="maquina-header">
                    <div class="maquina-id"><i class="fas fa-industry"></i> Máquina ${id}</div>`;

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
                                    <div class="select-search-container">
                                        <input type="text" class="select-search" placeholder="Pesquisar prefixo..."
                                               oninput="filtrarOpcoes('${id}', this.value)">
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
                        </div>
                    </div>`;
        }

        maquinaHTML += `
                </div>`;

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

        if (alerta) {
            maquinaHTML += `
                <div class="alert-message">
                    <i class="fas fa-exclamation-triangle"></i> Estoque em nível crítico (≤ ${config.estoqueMinimo} peças)
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
    const itens = select.querySelectorAll('div:not(.select-search-container)');
    
    itens.forEach(item => {
        if (item.textContent.toLowerCase().includes(termo.toLowerCase())) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
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

function alterar(maquinaId, tipo, delta) {
    // 1. Atualização IMEDIATA na tela (SEM esperar Firebase)
    const element = document.getElementById(`${maquinaId}-${tipo}`);
    if (element) {
        const currentValue = parseInt(element.textContent) || 0;
        const newValue = Math.max(0, currentValue + delta);
        element.textContent = newValue;
        
        // Feedback visual RÁPIDO
        element.style.transform = 'scale(1.1)';
        element.style.color = '#0ea5e9';
        setTimeout(() => {
            element.style.transform = '';
            element.style.color = '';
        }, 200);
    }
    
    // 2. Enviar para Firebase EM SEGUNDO PLANO (não bloqueia)
    setTimeout(() => {
        const ref = db.ref(`maquinas/${maquinaId}/${tipo}`);
        ref.set(parseInt(element.textContent) || 0);
    }, 0);
}

// ====================================================
// FUNÇÃO: ATUALIZAR PREFIXO DA MÁQUINA
// ====================================================

function atualizarPrefixo(maquinaId, prefixoId) {
    const ref = db.ref(`maquinas/${maquinaId}/prefixo`);
    ref.set(prefixoId);
    
    mostrarNotificacao(`Prefixo atualizado para: ${prefixoId}`, "info");
}

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
    const fornoNormalizado = ["A", "B", "C", "D"].includes(forno) ? forno : "todos";
    fornoAtivo = fornoNormalizado;

    const botoes = {
        todos: document.getElementById("btnTodos"),
        A: document.getElementById("btnFornoA"),
        B: document.getElementById("btnFornoB"),
        C: document.getElementById("btnFornoC"),
        D: document.getElementById("btnFornoD")
    };

    Object.values(botoes).forEach(btn => {
        if (btn) btn.classList.remove("active");
    });

    const botaoAtivo = botoes[fornoAtivo] || botoes.todos;
    if (botaoAtivo) botaoAtivo.classList.add("active");

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
    graficoProducao.data.datasets = [
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
        },
        {
            label: "Neck Ring",
            data: neckrings,
            backgroundColor: "rgba(79, 70, 229, 0.8)",
            borderColor: "rgba(79, 70, 229, 1)",
            borderWidth: 1
        },
        {
            label: "Funil",
            data: funis,
            backgroundColor: "rgba(245, 158, 11, 0.8)",
            borderColor: "rgba(245, 158, 11, 1)",
            borderWidth: 1
        }
    ];
    
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
    graficoTotal.data.datasets = [
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
        },
        {
            label: "Neck Ring Total",
            data: neckringsTotal,
            backgroundColor: "rgba(79, 70, 229, 0.6)",
            borderColor: "rgba(79, 70, 229, 1)",
            borderWidth: 1
        },
        {
            label: "Funil Total",
            data: funisTotal,
            backgroundColor: "rgba(245, 158, 11, 0.6)",
            borderColor: "rgba(245, 158, 11, 1)",
            borderWidth: 1
        }
    ];
    
    graficoTotal.update();
}

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
    config.estoqueMinimo = parseInt(document.getElementById('estoqueMinimo').value) || 3;
    
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
        
        document.getElementById('estoqueMinimoLabel').textContent = config.estoqueMinimo;
        
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

function atualizarPorInput(maquinaId, tipo, valor) {
    const spanElement = document.getElementById(`${maquinaId}-${tipo}`);
    const inputElement = document.getElementById(`input-${maquinaId}-${tipo}`);
    const btnElement = inputElement.closest('.controles').querySelector('.btn-digitado');
    
    // Converter valor para número
    const novoValor = parseInt(valor) || 0;
    
    // Atualizar visualmente
    spanElement.textContent = novoValor;
    inputElement.value = novoValor;
    
    // Voltar para modo visual
    spanElement.style.display = 'block';
    inputElement.style.display = 'none';
    btnElement.innerHTML = '<i class="fas fa-keyboard"></i>';
    btnElement.classList.remove('ativo-digitacao');
    
    // Atualizar no banco de dados
    db.ref(`maquinas/${maquinaId}/${tipo}`).set(novoValor);
    
    // Feedback
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
