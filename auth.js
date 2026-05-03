
// ================= SISTEMA DE AUTENTICAÇÃO FIREBASE =================

function checkAuth() {
    return new Promise((resolve, reject) => {
        if (!auth) {
            reject(new Error("Firebase Auth não está inicializada"));
            return;
        }

        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user || null);
        }, (error) => {
            unsubscribe();
            reject(error);
        });
    });
}

async function getCurrentUserData(user = auth.currentUser) {
    if (!user) return null;

    try {
        const snapshot = await db.ref(`users/${user.uid}`).once('value');
        const userData = snapshot.val();

        if (!userData) return null;

        return {
            uid: user.uid,
            email: user.email,
            ...userData,
            role: normalizeRole(userData.role),
            isActive: userData.isActive !== false
        };
    } catch (error) {
        console.error("❌ Erro ao carregar dados do usuário:", error);
        return null;
    }
}

async function login(email, password) {
    try {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const userCredential = await auth.signInWithEmailAndPassword(normalizedEmail, password);
        const userData = await getCurrentUserData(userCredential.user);

        if (!userData || userData.isActive === false) {
            await auth.signOut();
            return {
                success: false,
                error: "Usuário sem permissão de acesso. Verifique o cadastro no painel administrativo."
            };
        }

        await db.ref(`users/${userCredential.user.uid}`).update({
            email: normalizedEmail,
            lastLogin: Date.now()
        });

        localStorage.setItem('userEmail', normalizedEmail);
        localStorage.setItem('userUID', userCredential.user.uid);

        await writeAuditLog({
            action: 'login no sistema',
            details: 'Usuário autenticado com sucesso.',
            entityType: 'auth',
            entityId: userCredential.user.uid,
            targetPath: `users/${userCredential.user.uid}`,
            before: null,
            after: { lastLogin: Date.now() }
        });

        return { success: true, user: userCredential.user, userData };
    } catch (error) {
        console.error("❌ Erro no login:", error);

        let errorMessage = "Erro ao fazer login. Verifique suas credenciais.";
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = "Usuário não encontrado.";
                break;
            case 'auth/wrong-password':
                errorMessage = "Senha incorreta.";
                break;
            case 'auth/invalid-email':
                errorMessage = "Email inválido.";
                break;
            case 'auth/user-disabled':
                errorMessage = "Esta conta foi desativada.";
                break;
            case 'auth/too-many-requests':
                errorMessage = "Muitas tentativas. Tente novamente mais tarde.";
                break;
        }

        return { success: false, error: errorMessage };
    }
}

async function logout() {
    try {
        const actor = getAuditUser();
        await writeAuditLog({
            action: 'logout do sistema',
            details: 'Usuário encerrou a sessão.',
            entityType: 'auth',
            entityId: actor.uid,
            targetPath: `users/${actor.uid || 'desconhecido'}`
        });

        await auth.signOut();
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userUID');

        return true;
    } catch (error) {
        console.error("❌ Erro no logout:", error);
        return false;
    }
}

async function isAdmin(user) {
    const userData = await getCurrentUserData(user);
    return !!userData && userData.isActive && userData.role === 'admin';
}

async function protectAdminPage() {
    try {
        const user = await checkAuth();

        if (!user) {
            if (typeof mostrarNotificacao === 'function') {
                mostrarNotificacao("Por favor, faça login para acessar esta página", "error");
            }
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
            return null;
        }

        if (!(await isAdmin(user))) {
            if (typeof mostrarNotificacao === 'function') {
                mostrarNotificacao("Acesso negado. Apenas administradores podem acessar esta página.", "error");
            }
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1200);
            return null;
        }

        return user;
    } catch (error) {
        console.error("❌ Erro na verificação de acesso administrativo:", error);
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
        return null;
    }
}

window.checkAuth = checkAuth;
window.login = login;
window.logout = logout;
window.isAdmin = isAdmin;
window.protectAdminPage = protectAdminPage;
window.getCurrentUserData = getCurrentUserData;
