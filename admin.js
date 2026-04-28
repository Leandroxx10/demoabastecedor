// ====================================================
// PAINEL ADMINISTRATIVO
// ====================================================

// Variáveis globais
let dadosMaquinas = {};

document.addEventListener('DOMContentLoaded', async function() {
    console.log("🚀 Inicializando painel administrativo...");
    
    try {
        // Verificar autenticação e permissões
        const user = await protectAdminPage();
        if (!user) {
            console.log("❌ Usuário não autenticado ou sem permissão");
            return;
        }
        
        console.log("✅ Acesso autorizado para:", user.email);
        
        // Ocultar preloader
        setTimeout(() => {
            const preloader = document.getElementById('preloader');
            if (preloader) {
                preloader.style.display = 'none';
            }
        }, 500);
        
        // Carregar dados iniciais
        await carregarDashboard();
        await carregarUsuarios();
        await carregarConfiguracoesMaquinas();
        
        // Configurar formulário de usuário
        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', criarUsuario);
        }
        
        // Configurar formulário de configurações
        const systemSettings = document.getElementById('systemSettings');
        if (systemSettings) {
            systemSettings.addEventListener('submit', salvarConfiguracoesSistema);
        }
        
        // Carregar logs iniciais
        loadLogs('today');
        
    } catch (error) {
        console.error("❌ Erro na inicialização:", error);
        mostrarNotificacaoAdmin("Erro ao inicializar o painel: " + error.message, "error");
    }
});

// ====================================================
// FUNÇÕES DAS TABS
// ====================================================

function openAdminTab(tabId) {
    // Remover active de todas as tabs
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Adicionar active à tab selecionada
    const tabBtn = document.querySelector(`.admin-tab-btn[onclick*="${tabId}"]`);
    if (tabBtn) tabBtn.classList.add('active');
    
    const tabContent = document.getElementById(tabId);
    if (tabContent) tabContent.classList.add('active');
    
    // Carregar dados específicos da tab
    switch(tabId) {
        case 'dashboard':
            carregarDashboard();
            break;
        case 'users':
            carregarUsuarios();
            break;
        case 'logs':
            loadLogs('today');
            break;
        case 'machines':
            carregarConfiguracoesMaquinas();
            break;
    }
}

// ====================================================
// DASHBOARD
// ====================================================

async function carregarDashboard() {
    try {
        // Carregar estatísticas
        const [usersSnapshot, machinesSnapshot, prefixesSnapshot, logsSnapshot] = await Promise.all([
            db.ref('users').once('value'),
            db.ref('maquinas').once('value'),
            db.ref('prefixDatabase').once('value'),
            db.ref('logs').once('value')
        ]);
        
        const usersCount = usersSnapshot.numChildren();
        const machinesCount = machinesSnapshot.numChildren();
        const prefixesCount = prefixesSnapshot.numChildren();
        
        // Contar mudanças de hoje
        const hoje = new Date().toISOString().split('T')[0];
        let changesToday = 0;
        logsSnapshot.forEach(log => {
            if (log.val().date === hoje) {
                changesToday++;
            }
        });
        
        // Atualizar estatísticas
        const statUsers = document.getElementById('stat-users');
        const statMachines = document.getElementById('stat-machines');
        const statPrefixes = document.getElementById('stat-prefixes');
        const statChanges = document.getElementById('stat-changes');
        
        if (statUsers) statUsers.textContent = usersCount;
        if (statMachines) statMachines.textContent = machinesCount;
        if (statPrefixes) statPrefixes.textContent = prefixesCount;
        if (statChanges) statChanges.textContent = changesToday;
        
        // Carregar atividades recentes
        await carregarAtividadesRecentes();
        
    } catch (error) {
        console.error("❌ Erro ao carregar dashboard:", error);
        mostrarNotificacaoAdmin("Erro ao carregar dashboard: " + error.message, "error");
    }
}

async function carregarAtividadesRecentes() {
    try {
        const logsRef = db.ref('logs').orderByChild('timestamp').limitToLast(10);
        const snapshot = await logsRef.once('value');
        const atividades = [];
        
        snapshot.forEach(log => {
            atividades.push(log.val());
        });
        
        // Ordenar por timestamp (mais recente primeiro)
        atividades.sort((a, b) => b.timestamp - a.timestamp);
        
        // Exibir atividades
        const container = document.getElementById('recent-activity');
        if (!container) return;
        
        if (atividades.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);">Nenhuma atividade recente</div>';
            return;
        }
        
        let html = '';
        atividades.forEach(activity => {
            const time = new Date(activity.timestamp).toLocaleString('pt-BR');
            html += `
                <div class="log-item">
                    <div class="log-time">${time}</div>
                    <div class="log-action">
                        <span class="log-user">${activity.user}</span> ${activity.action}
                    </div>
                    ${activity.details ? `<div style="font-size: 0.85rem; color: var(--text-light); margin-top: 3px;">${activity.details}</div>` : ''}
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error("❌ Erro ao carregar atividades:", error);
    }
}

// ====================================================
// GERENCIAMENTO DE USUÁRIOS
// ====================================================

async function carregarUsuarios() {
    try {
        const snapshot = await db.ref('users').once('value');
        const container = document.getElementById('usersList');
        
        if (!container) return;
        
        if (!snapshot.exists()) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);">Nenhum usuário cadastrado</div>';
            return;
        }
        
        let html = '';
        snapshot.forEach(userSnap => {
            const user = userSnap.val();
            const userId = userSnap.key;
            
            // Criar avatar com as iniciais
            const name = user.name || user.email.split('@')[0];
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            
            // Cor baseada no role
            let roleColor = 'var(--text-light)';
            let roleText = 'Carregador';
            
            if (normalizeRole(user.role) === 'admin') {
                roleColor = 'var(--error)';
                roleText = 'Administrador';
            } else if (normalizeRole(user.role) === 'lideranca') {
                roleColor = 'var(--warning)';
                roleText = 'Liderança';
            }
            
            html += `
                <div class="user-item">
                    <div class="user-info">
                        <div class="user-avatar" style="background: ${roleColor}20; color: ${roleColor}">
                            ${initials}
                        </div>
                        <div class="user-details">
                            <div class="user-email">${user.email}</div>
                            <div class="user-role" style="color: ${roleColor}">
                                <i class="fas fa-user-tag"></i> ${roleText}
                                ${user.name ? ` • ${user.name}` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="user-actions">
                        ${user.role !== 'admin' ? `
                            <button class="btn-small btn-edit" onclick="editarUsuario('${userId}')">
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button class="btn-small btn-delete" onclick="excluirUsuario('${userId}', '${user.email}')">
                                <i class="fas fa-trash"></i> Excluir
                            </button>
                        ` : `
                            <span style="color: var(--text-light); font-size: 0.85rem;">
                                <i class="fas fa-shield-alt"></i> Administrador
                            </span>
                        `}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error("❌ Erro ao carregar usuários:", error);
        mostrarNotificacaoAdmin("Erro ao carregar usuários: " + error.message, "error");
    }
}

async function criarUsuario(e) {
    e.preventDefault();
    
    const email = document.getElementById('newEmail')?.value.trim();
    const password = document.getElementById('newPassword')?.value;
    const role = document.getElementById('newRole')?.value;
    const name = document.getElementById('newName')?.value.trim();
    
    if (!email || !password) {
        mostrarNotificacaoAdmin("Preencha todos os campos obrigatórios", "error");
        return;
    }
    
    try {
        // Verificar se já existe um usuário com este email
        const usersSnapshot = await db.ref('users').orderByChild('email').equalTo(email).once('value');
        if (usersSnapshot.exists()) {
            mostrarNotificacaoAdmin("Já existe um usuário com este email", "error");
            return;
        }
        
        // Criar usuário no Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const userId = userCredential.user.uid;
        
        // Salvar informações adicionais no Database
        await db.ref(`users/${userId}`).set({
            email: email,
            role: role || 'Carregador',
            name: name || null,
            createdAt: Date.now(),
            createdBy: auth.currentUser.email,
            lastLogin: null,
            isActive: true
        });
        
        // Log da ação
        await logAction(`criou o usuário ${email} (${role})`);
        
        // Limpar formulário
        const userForm = document.getElementById('userForm');
        if (userForm) userForm.reset();
        
        // Recarregar lista de usuários
        await carregarUsuarios();
        
        mostrarNotificacaoAdmin(`Usuário ${email} criado com sucesso!`, "success");
        
    } catch (error) {
        console.error("❌ Erro ao criar usuário:", error);
        
        let errorMessage = "Erro ao criar usuário: ";
        switch(error.code) {
            case 'auth/email-already-in-use':
                errorMessage = "Este email já está em uso.";
                break;
            case 'auth/invalid-email':
                errorMessage = "Email inválido.";
                break;
            case 'auth/operation-not-allowed':
                errorMessage = "Operação não permitida.";
                break;
            case 'auth/weak-password':
                errorMessage = "Senha muito fraca. Use pelo menos 6 caracteres.";
                break;
            default:
                errorMessage += error.message;
        }
        
        mostrarNotificacaoAdmin(errorMessage, "error");
    }
}

async function editarUsuario(userId) {
    // Implementar edição de usuário
    mostrarNotificacaoAdmin("Funcionalidade em desenvolvimento", "info");
}

async function excluirUsuario(userId, email) {
    if (!confirm(`Tem certeza que deseja excluir o usuário ${email}? Esta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        // Verificar se é o próprio usuário
        if (userId === auth.currentUser.uid) {
            mostrarNotificacaoAdmin("Você não pode excluir sua própria conta", "error");
            return;
        }
        
        // Marcar como inativo no Database
        await db.ref(`users/${userId}`).update({
            isActive: false,
            deactivatedAt: Date.now(),
            deactivatedBy: auth.currentUser.email
        });
        
        // Log da ação
        await logAction(`desativou o usuário ${email}`);
        
        // Recarregar lista de usuários
        await carregarUsuarios();
        
        mostrarNotificacaoAdmin(`Usuário ${email} desativado com sucesso`, "success");
        
    } catch (error) {
        console.error("❌ Erro ao excluir usuário:", error);
        mostrarNotificacaoAdmin("Erro ao excluir usuário: " + error.message, "error");
    }
}

// ====================================================
// CONFIGURAÇÕES DE MÁQUINAS
// ====================================================

async function carregarConfiguracoesMaquinas() {
    try {
        const snapshot = await db.ref('maquinas').once('value');
        const container = document.getElementById('machineSettings');
        
        if (!container) return;
        
        if (!snapshot.exists()) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);">Nenhuma máquina cadastrada</div>';
            return;
        }
        
        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">';
        
        snapshot.forEach(machineSnap => {
            const machineId = machineSnap.key;
            const machine = machineSnap.val();
            
            // Salvar nos dados globais para uso posterior
            dadosMaquinas[machineId] = machine;
            
            html += `
                <div style="background: var(--bg); padding: 15px; border-radius: var(--radius-sm); border: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div style="font-weight: 600; color: var(--text);">Máquina ${machineId}</div>
                        <button class="btn-small" onclick="editarConfigMaquina('${machineId}')" style="background: var(--primary); color: white;">
                            <i class="fas fa-cog"></i>
                        </button>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text-light);">
                        Prefixo: ${getMachinePrefixDisplay(machine, prefixos) || 'N/A'}<br>
                        Molde: ${machine.molde || 0} | Blank: ${machine.blank || 0}<br>
                        Neck Ring: ${machine.neck_ring || 0} | Funil: ${machine.funil || 0}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error("❌ Erro ao carregar configurações de máquinas:", error);
        mostrarNotificacaoAdmin("Erro ao carregar configurações: " + error.message, "error");
    }
}

function editarConfigMaquina(machineId) {
    // Carregar configurações atuais
    const machine = dadosMaquinas[machineId] || {};
    
    // Abrir modal de edição
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;
    
    modal.innerHTML = `
        <div style="background: var(--card); border-radius: 12px; max-width: 500px; width: 100%; border: 1px solid var(--border);">
            <div style="padding: 25px; position: relative;">
                <button onclick="this.closest('.modal-overlay').remove()" 
                        style="position: absolute; top: 15px; right: 15px; background: none; border: none; color: var(--text-light); font-size: 20px; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
                
                <h3 style="font-size: 18px; margin-bottom: 20px; color: var(--text);">
                    <i class="fas fa-cog"></i> Configurações da Máquina ${machineId}
                </h3>
                
                <div style="display: grid; gap: 15px;">
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text);">Prefixo</label>
                        <input type="text" id="editPrefixo-${machineId}" value="${machine.prefixo || ''}" 
                               style="width: 100%; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg); color: var(--text);">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text);">Estoque Mínimo Molde</label>
                            <input type="number" id="editMinMolde-${machineId}" value="${machine.estoque_minimo_molde || 3}" 
                                   style="width: 100%; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg); color: var(--text);" min="1" max="50">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text);">Estoque Mínimo Blank</label>
                            <input type="number" id="editMinBlank-${machineId}" value="${machine.estoque_minimo_blank || 3}" 
                                   style="width: 100%; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg); color: var(--text);" min="1" max="50">
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; display: flex; gap: 10px;">
                        <button onclick="salvarConfigMaquina('${machineId}'); this.closest('.modal-overlay').remove()" 
                                class="btn" style="flex: 1; background: var(--primary); color: white;">
                            <i class="fas fa-save"></i> Salvar
                        </button>
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                class="btn" style="flex: 1; background: var(--card); border: 1px solid var(--border); color: var(--text);">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function salvarConfigMaquina(machineId) {
    try {
        const prefixoElement = document.getElementById(`editPrefixo-${machineId}`);
        const minMoldeElement = document.getElementById(`editMinMolde-${machineId}`);
        const minBlankElement = document.getElementById(`editMinBlank-${machineId}`);
        
        if (!prefixoElement || !minMoldeElement || !minBlankElement) {
            mostrarNotificacaoAdmin("Erro ao encontrar elementos do formulário", "error");
            return;
        }
        
        const prefixo = prefixoElement.value;
        const minMolde = parseInt(minMoldeElement.value) || 3;
        const minBlank = parseInt(minBlankElement.value) || 3;
        
        await db.ref(`maquinas/${machineId}`).update({
            prefixo: prefixo,
            estoque_minimo_molde: minMolde,
            estoque_minimo_blank: minBlank
        });
        
        await logAction(`atualizou configurações da máquina ${machineId}`);
        
        mostrarNotificacaoAdmin(`Configurações da máquina ${machineId} salvas com sucesso!`, "success");
        
        // Recarregar configurações
        await carregarConfiguracoesMaquinas();
        
    } catch (error) {
        console.error("❌ Erro ao salvar configurações:", error);
        mostrarNotificacaoAdmin("Erro ao salvar configurações: " + error.message, "error");
    }
}

// ====================================================
// LOGS E HISTÓRICO
// ====================================================

async function loadLogs(period) {
    try {
        const container = document.getElementById('activityLogs');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i> Carregando logs...</div>';
        
        let query = db.ref('logs').orderByChild('timestamp');
        
        // Aplicar filtro de período
        if (period !== 'all') {
            const now = new Date();
            let startTimestamp;
            
            switch(period) {
                case 'today':
                    startTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                    break;
                case 'week':
                    startTimestamp = now.getTime() - (7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startTimestamp = now.getTime() - (30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startTimestamp = 0;
            }
            
            query = query.startAt(startTimestamp);
        }
        
        const snapshot = await query.once('value');
        const logs = [];
        
        snapshot.forEach(logSnap => {
            logs.push({
                id: logSnap.key,
                ...logSnap.val()
            });
        });
        
        // Ordenar por timestamp (mais recente primeiro)
        logs.sort((a, b) => b.timestamp - a.timestamp);
        
        if (logs.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);">Nenhum log encontrado</div>';
            return;
        }
        
        let html = '';
        logs.forEach(log => {
            const time = new Date(log.timestamp).toLocaleString('pt-BR');

            let icon = 'fas fa-info-circle';
            let color = 'var(--info)';

            if ((log.action || '').includes('criou') || (log.action || '').includes('adicionou')) {
                icon = 'fas fa-plus-circle';
                color = 'var(--success)';
            } else if ((log.action || '').includes('excluiu') || (log.action || '').includes('removeu') || (log.action || '').includes('desativou')) {
                icon = 'fas fa-minus-circle';
                color = 'var(--error)';
            } else if ((log.action || '').includes('atualizou') || (log.action || '').includes('editou') || (log.action || '').includes('digitou')) {
                icon = 'fas fa-edit';
                color = 'var(--warning)';
            } else if ((log.action || '').includes('login') || (log.action || '').includes('acessou')) {
                icon = 'fas fa-sign-in-alt';
                color = 'var(--primary)';
            }

            const summaryParts = [
                log.entityType ? `Tipo: ${log.entityType}` : '',
                log.entityId ? `ID: ${log.entityId}` : '',
                log.targetPath ? `Caminho: ${log.targetPath}` : ''
            ].filter(Boolean).join(' • ');

            html += `
                <div class="log-item">
                    <div class="log-time">
                        <i class="${icon}" style="color: ${color}; margin-right: 5px;"></i>
                        ${time}
                    </div>
                    <div class="log-action">
                        <span class="log-user">${log.user || 'desconhecido'}</span> ${log.action || 'ação registrada'}
                    </div>
                    ${log.details ? `<div style="font-size: 0.85rem; color: var(--text-light); margin-top: 3px;">${log.details}</div>` : ''}
                    ${summaryParts ? `<div style="font-size: 0.82rem; color: var(--text-light); margin-top: 6px;">${summaryParts}</div>` : ''}
                    ${(log.before !== null && log.before !== undefined) || (log.after !== null && log.after !== undefined) ? `
                        <details style="margin-top: 8px;">
                            <summary style="cursor: pointer; color: var(--primary);">Ver antes e depois</summary>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px;">
                                <div style="background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:10px;">
                                    <div style="font-size:0.8rem; color:var(--text-light); margin-bottom:6px;">Antes</div>
                                    <pre style="white-space:pre-wrap; word-break:break-word; font-size:0.78rem; margin:0;">${JSON.stringify(log.before, null, 2)}</pre>
                                </div>
                                <div style="background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:10px;">
                                    <div style="font-size:0.8rem; color:var(--text-light); margin-bottom:6px;">Depois</div>
                                    <pre style="white-space:pre-wrap; word-break:break-word; font-size:0.78rem; margin:0;">${JSON.stringify(log.after, null, 2)}</pre>
                                </div>
                            </div>
                        </details>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error("❌ Erro ao carregar logs:", error);
        const container = document.getElementById('activityLogs');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--error);">Erro ao carregar logs</div>';
        }
    }
}

// ====================================================
// CONFIGURAÇÕES DO SISTEMA
// ====================================================

async function salvarConfiguracoesSistema(e) {
    e.preventDefault();
    
    try {
        const systemMaintenanceElement = document.getElementById('systemMaintenance');
        const sessionTimeoutElement = document.getElementById('sessionTimeout');
        const backupFrequencyElement = document.getElementById('backupFrequency');
        
        if (!systemMaintenanceElement || !sessionTimeoutElement || !backupFrequencyElement) {
            mostrarNotificacaoAdmin("Elementos do formulário não encontrados", "error");
            return;
        }
        
        const systemMaintenance = systemMaintenanceElement.checked;
        const sessionTimeout = parseInt(sessionTimeoutElement.value) || 30;
        const backupFrequency = backupFrequencyElement.value;
        
        await db.ref('systemSettings').set({
            maintenanceMode: systemMaintenance,
            sessionTimeout: sessionTimeout,
            backupFrequency: backupFrequency,
            updatedAt: Date.now(),
            updatedBy: auth.currentUser.email
        });
        
        await logAction('atualizou configurações do sistema');
        
        mostrarNotificacaoAdmin("Configurações do sistema salvas com sucesso!", "success");
        
    } catch (error) {
        console.error("❌ Erro ao salvar configurações:", error);
        mostrarNotificacaoAdmin("Erro ao salvar configurações: " + error.message, "error");
    }
}

// ====================================================
// BACKUP E RESTAURAÇÃO
// ====================================================

async function createBackup() {
    try {
        mostrarNotificacaoAdmin("Criando backup...", "info");
        
        // Coletar dados do sistema
        const [maquinasSnapshot, prefixosSnapshot, configSnapshot, usersSnapshot] = await Promise.all([
            db.ref('maquinas').once('value'),
            db.ref('prefixDatabase').once('value'),
            db.ref('configuracoes').once('value'),
            db.ref('users').once('value')
        ]);
        
        const backupData = {
            timestamp: Date.now(),
            createdBy: auth.currentUser.email,
            maquinas: maquinasSnapshot.val() || {},
            prefixos: prefixosSnapshot.val() || {},
            configuracoes: configSnapshot.val() || {},
            users: usersSnapshot.val() || {}
        };
        
        // Salvar backup no Firebase
        const backupId = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        await db.ref(`backups/${backupId}`).set(backupData);
        
        // Log da ação
        await logAction('criou um backup do sistema');
        
        mostrarNotificacaoAdmin("Backup criado com sucesso!", "success");
        
    } catch (error) {
        console.error("❌ Erro ao criar backup:", error);
        mostrarNotificacaoAdmin("Erro ao criar backup: " + error.message, "error");
    }
}

async function restoreBackup() {
    // Implementar restauração de backup
    mostrarNotificacaoAdmin("Funcionalidade em desenvolvimento", "info");
}

// ====================================================
// FUNÇÕES AUXILIARES
// ====================================================

async function logAction(action, details = '', extra = {}) {
    try {
        const actor = getAuditUser();
        await writeAuditLog({
            action,
            details,
            entityType: extra.entityType || 'manual',
            entityId: extra.entityId || '',
            targetPath: extra.targetPath || '',
            before: extra.before || null,
            after: extra.after || null,
            extra
        });
    } catch (error) {
        console.error("❌ Erro ao registrar log:", error);
    }
}

function mostrarNotificacaoAdmin(msg, tipo = "success") {
    // Remover notificações anteriores
    document.querySelectorAll('.admin-toast').forEach(toast => toast.remove());
    
    const toast = document.createElement("div");
    toast.className = `admin-toast ${tipo}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 25px;
        right: 25px;
        background: var(--card);
        color: var(--text);
        padding: 16px 24px;
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow-lg);
        animation: fadein 0.4s, fadeout 0.4s 2.6s;
        z-index: 1000;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 400px;
        font-size: 1rem;
        border-left: 4px solid ${tipo === 'error' ? 'var(--error)' : tipo === 'warning' ? 'var(--warning)' : tipo === 'info' ? 'var(--info)' : 'var(--success)'};
        border: 1px solid var(--border);
    `;
    
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
// EXPORTAR FUNÇÕES
// ====================================================

window.openAdminTab = openAdminTab;
window.carregarUsuarios = carregarUsuarios;
window.criarUsuario = criarUsuario;
window.editarUsuario = editarUsuario;
window.excluirUsuario = excluirUsuario;
window.editarConfigMaquina = editarConfigMaquina;
window.salvarConfigMaquina = salvarConfigMaquina;
window.loadLogs = loadLogs;
window.createBackup = createBackup;
window.restoreBackup = restoreBackup;
window.salvarConfiguracoesSistema = salvarConfiguracoesSistema;
window.mostrarNotificacaoAdmin = mostrarNotificacaoAdmin;

console.log("✅ Painel administrativo carregado");
