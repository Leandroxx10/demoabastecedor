// ================= CONFIGURAÇÃO DO FIREBASE =================

// Suas credenciais do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyACjKi3thEvR4NJryXLWeXhA5Lpwc8f9cA",
  authDomain: "painelinfomaq.firebaseapp.com",
  databaseURL: "https://painelinfomaq-default-rtdb.firebaseio.com",
  projectId: "painelinfomaq",
  storageBucket: "painelinfomaq.firebasestorage.app",
  messagingSenderId: "79791250650",
  appId: "1:79791250650:web:9f0b0efeaaaf0e28a3d9e3"
};

// Inicializar Firebase
let app;
if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
} else {
    app = firebase.app();
}

// Obter serviços do Firebase
const auth = firebase.auth();
const db = firebase.database();

// Referências principais
const maquinasRef = db.ref("maquinas");
const historicoRef = db.ref("historico");
const comentariosRef = db.ref("comentarios");
const imagensRef = db.ref("imagens");
const adminConfigRef = db.ref("adminConfig");
const manutencaoRef = db.ref("manutencao");
const configuracoesRef = db.ref("configuracoes");
const usersRef = db.ref("users");
const logsRef = db.ref("logs");
const backupsRef = db.ref("backups");
const systemSettingsRef = db.ref("systemSettings");

// Limites padrão
const DEFAULT_LIMITS = {
    CRITICO: 3,
    BAIXO: 5,
    NORMAL: 6
};

// Carregar limites específicos da máquina
async function getLimitsForMachine(machineId) {
    return new Promise((resolve, reject) => {
        adminConfigRef.child("machineLimits").child(machineId).once("value")
            .then(snapshot => {
                const customLimits = snapshot.val();
                if (customLimits) {
                    resolve({
                        CRITICO: customLimits.critico || DEFAULT_LIMITS.CRITICO,
                        BAIXO: customLimits.baixo || DEFAULT_LIMITS.BAIXO,
                        NORMAL: customLimits.normal || DEFAULT_LIMITS.NORMAL
                    });
                } else {
                    resolve({ ...DEFAULT_LIMITS });
                }
            })
            .catch(error => {
                console.error("❌ Erro ao carregar limites:", error);
                reject(error);
            });
    });
}

// Salvar limites da máquina
async function saveMachineLimits(machineId, limits) {
    return new Promise((resolve, reject) => {
        adminConfigRef.child("machineLimits").child(machineId).set(limits)
            .then(() => {
                console.log(`✅ Limites salvos para máquina ${machineId}:`, limits);
                resolve(true);
            })
            .catch(error => {
                console.error(`❌ Erro ao salvar limites para máquina ${machineId}:`, error);
                reject(error);
            });
    });
}

// ================= FUNÇÕES DE MANUTENÇÃO =================

// Definir status de manutenção da máquina
async function setMachineMaintenance(machineId, isInMaintenance, reason = "") {
    console.log(`🔧 Definindo manutenção para ${machineId}: ${isInMaintenance}, motivo: "${reason}"`);
    
    return new Promise((resolve, reject) => {
        if (isInMaintenance) {
            // Colocar em manutenção
            const maintenanceData = {
                isInMaintenance: true,
                reason: reason,
                startedAt: Date.now(),
                startedBy: 'Administrador',
                updatedAt: Date.now()
            };
            
            manutencaoRef.child(machineId).set(maintenanceData)
                .then(() => {
                    console.log(`✅ Máquina ${machineId} colocada em manutenção`);
                    resolve(true);
                })
                .catch(error => {
                    console.error(`❌ Erro ao colocar máquina ${machineId} em manutenção:`, error);
                    reject(error);
                });
        } else {
            // Retirar da manutenção
            manutencaoRef.child(machineId).remove()
                .then(() => {
                    console.log(`✅ Máquina ${machineId} retirada da manutenção`);
                    resolve(true);
                })
                .catch(error => {
                    console.error(`❌ Erro ao retirar máquina ${machineId} da manutenção:`, error);
                    reject(error);
                });
        }
    });
}

// Obter status de manutenção da máquina
async function getMachineMaintenanceStatus(machineId) {
    return new Promise((resolve, reject) => {
        manutencaoRef.child(machineId).once("value")
            .then(snapshot => {
                const data = snapshot.val();
                resolve(data || { isInMaintenance: false });
            })
            .catch(error => {
                console.error(`❌ Erro ao obter status de manutenção da máquina ${machineId}:`, error);
                reject(error);
            });
    });
}

// ================= FUNÇÕES AUXILIARES =================

// Verificar conexão com o Firebase (para páginas com conexão status)
function checkFirebaseConnection() {
    const connectedRef = db.ref(".info/connected");
    connectedRef.on("value", function(snap) {
        if (snap.val() === true) {
            console.log("✅ Conectado ao Firebase");
            // Apenas atualiza se o elemento existir
            const statusElement = document.getElementById('connectionStatus');
            if (statusElement) {
                statusElement.textContent = 'Conectado ao servidor';
                statusElement.style.color = '#10b981';
            }
        } else {
            console.log("⚠️ Desconectado do Firebase");
            const statusElement = document.getElementById('connectionStatus');
            if (statusElement) {
                statusElement.textContent = 'Desconectado do servidor';
                statusElement.style.color = '#ef4444';
            }
        }
    });
}

// Inicializar verificação de conexão (se o elemento existir)
if (document.getElementById('connectionStatus')) {
    document.addEventListener('DOMContentLoaded', function() {
        checkFirebaseConnection();
    });
}


// ================= SEGURANÇA, NORMALIZAÇÃO E AUDITORIA =================

function normalizeRole(role) {
    const value = String(role || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    if (value === 'admin' || value === 'administrador') return 'admin';
    if (value === 'lideranca' || value === 'lider') return 'lideranca';
    if (value === 'carregador' || value === 'abastecedor' || value === 'operador') return 'carregador';
    return value || 'carregador';
}

function normalizePrefixObject(key, data = {}) {
    const displayName =
        data.prefixoDetalhado ||
        data.prefixo_detalhado ||
        data.detalhado ||
        data.descricao ||
        data.nome ||
        key;

    return {
        id: key,
        nome: data.nome || key,
        displayName,
        prefixoDetalhado: displayName,
        ...data
    };
}

function buildPrefixList(prefixosData) {
    if (!prefixosData) return [];
    return Object.keys(prefixosData).map(key => normalizePrefixObject(key, prefixosData[key]));
}

function findPrefixRecord(prefixos, value) {
    const search = String(value || '').trim();
    return (prefixos || []).find(pref =>
        pref.id === search ||
        pref.nome === search ||
        pref.displayName === search ||
        pref.prefixoDetalhado === search ||
        pref.prefixo_detalhado === search
    ) || null;
}

function getMachinePrefixDisplay(machine, prefixos = []) {
    if (!machine) return '';
    return (
        machine.prefixoDetalhado ||
        machine.prefixo_detalhado ||
        findPrefixRecord(prefixos, machine.prefixo)?.displayName ||
        machine.prefixo ||
        ''
    );
}

async function getPrefixosFromFirebase() {
    const snapshot = await db.ref('prefixDatabase').once('value');
    return buildPrefixList(snapshot.val());
}


function getPrefixImageUrl(prefixData = {}) {
    const directCandidates = [
        prefixData.imageUrl,
        prefixData.imageURL,
        prefixData.imagemUrl,
        prefixData.imagemURL,
        prefixData.linkImagem,
        prefixData.image,
        prefixData.img,
        prefixData.imgbb,
        prefixData.url,
        typeof prefixData.imagem === 'string' ? prefixData.imagem : null
    ].filter(Boolean);

    if (prefixData.imagem && typeof prefixData.imagem === 'object') {
        directCandidates.unshift(
            prefixData.imagem.url,
            prefixData.imagem.display_url,
            prefixData.imagem.thumb?.url,
            prefixData.imagem.medium?.url,
            prefixData.imagem.image?.url
        );
    }

    const isImageLike = (value) =>
        typeof value === 'string' &&
        (
            value.includes('i.ibb.co/') ||
            value.includes('ibb.co/') ||
            value.includes('imgbb.com/') ||
            /\.(png|jpg|jpeg|webp|gif|avif|svg)(\?.*)?$/i.test(value)
        );

    const visited = new Set();

    function deepFind(value) {
        if (!value || typeof value !== 'object') return '';
        if (visited.has(value)) return '';
        visited.add(value);

        for (const entry of Object.values(value)) {
            if (isImageLike(entry)) return entry;
            if (entry && typeof entry === 'object') {
                const nested = deepFind(entry);
                if (nested) return nested;
            }
        }
        return '';
    }

    const firstDirect = directCandidates.find(isImageLike);
    return firstDirect || deepFind(prefixData) || '';
}

function formatPrefixFieldLabel(key) {
    return String(key || '')
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, char => char.toUpperCase());
}


function getAuditUser() {
    const user = auth.currentUser;
    return {
        uid: user?.uid || null,
        email: user?.email || localStorage.getItem('userEmail') || 'desconhecido'
    };
}

function sanitizeForLog(value) {
    if (value === undefined) return null;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return String(value);
    }
}


function getSaoPauloISODateForAudit(date = new Date()) {
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
}

async function writeAuditLog({ action, details = '', targetPath = '', entityType = '', entityId = '', before = null, after = null, extra = {} }) {
    try {
        const actor = getAuditUser();
        const timestamp = Date.now();
        const payload = {
            user: actor.email,
            uid: actor.uid,
            action,
            details,
            entityType,
            entityId,
            targetPath,
            before: sanitizeForLog(before),
            after: sanitizeForLog(after),
            extra: sanitizeForLog(extra),
            timestamp,
            date: getSaoPauloISODateForAudit(new Date(timestamp))
        };
        await db.ref('logs').push(payload);
    } catch (error) {
        console.error('❌ Erro ao registrar auditoria:', error);
    }
}

async function updateWithAudit(path, updates, meta = {}) {
    const ref = db.ref(path);
    const beforeSnap = await ref.once('value');
    const before = beforeSnap.val();
    const after = { ...(before || {}), ...(updates || {}) };

    await ref.update(updates);
    await writeAuditLog({
        action: meta.action || `atualizou ${path}`,
        details: meta.details || '',
        targetPath: path,
        entityType: meta.entityType || '',
        entityId: meta.entityId || '',
        before,
        after,
        extra: meta.extra || {}
    });
    return true;
}

async function setWithAudit(path, value, meta = {}) {
    const ref = db.ref(path);
    const beforeSnap = await ref.once('value');
    const before = beforeSnap.val();

    await ref.set(value);
    await writeAuditLog({
        action: meta.action || `definiu ${path}`,
        details: meta.details || '',
        targetPath: path,
        entityType: meta.entityType || '',
        entityId: meta.entityId || '',
        before,
        after: value,
        extra: meta.extra || {}
    });
    return true;
}

async function removeWithAudit(path, meta = {}) {
    const ref = db.ref(path);
    const beforeSnap = await ref.once('value');
    const before = beforeSnap.val();

    await ref.remove();
    await writeAuditLog({
        action: meta.action || `removeu ${path}`,
        details: meta.details || '',
        targetPath: path,
        entityType: meta.entityType || '',
        entityId: meta.entityId || '',
        before,
        after: null,
        extra: meta.extra || {}
    });
    return true;
}

// Exportar para uso global
window.db = db;
window.auth = auth;
window.maquinasRef = maquinasRef;
window.historicoRef = historicoRef;
window.comentariosRef = comentariosRef;
window.imagensRef = imagensRef;
window.adminConfigRef = adminConfigRef;
window.manutencaoRef = manutencaoRef;
window.configuracoesRef = configuracoesRef;
window.usersRef = usersRef;
window.logsRef = logsRef;
window.backupsRef = backupsRef;
window.systemSettingsRef = systemSettingsRef;
window.DEFAULT_LIMITS = DEFAULT_LIMITS;
window.getLimitsForMachine = getLimitsForMachine;
window.saveMachineLimits = saveMachineLimits;
window.setMachineMaintenance = setMachineMaintenance;
window.getMachineMaintenanceStatus = getMachineMaintenanceStatus;

console.log("✅ Firebase configurado e funções exportadas");


window.normalizeRole = normalizeRole;
window.normalizePrefixObject = normalizePrefixObject;
window.buildPrefixList = buildPrefixList;
window.findPrefixRecord = findPrefixRecord;
window.getMachinePrefixDisplay = getMachinePrefixDisplay;
window.getPrefixosFromFirebase = getPrefixosFromFirebase;
window.getPrefixImageUrl = getPrefixImageUrl;
window.formatPrefixFieldLabel = formatPrefixFieldLabel;
window.getAuditUser = getAuditUser;
window.writeAuditLog = writeAuditLog;
window.updateWithAudit = updateWithAudit;
window.setWithAudit = setWithAudit;
window.removeWithAudit = removeWithAudit;
