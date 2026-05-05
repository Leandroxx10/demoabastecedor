CORREÇÃO - Cadastro real de usuário e edição direta do número
Data: 2026-05-04

Arquivos alterados:
- script.js
- style.css
- auth.js
- admin.js
- cadastro-usuario.html
- criar-usuarios.html
- firebase.database.rules.json

Resumo técnico:
1. Edição direta do valor no card
   - O número exibido no controle agora é clicável.
   - Clique direto no número abre o mesmo input usado pelo botão de teclado.
   - Enter confirma o valor.
   - Esc cancela a edição.
   - O botão de teclado continua funcionando, agora sem reabrir o input por causa do blur.

2. Cadastro real de usuários
   - O painel administrativo passou a criar usuários usando um app secundário do Firebase Auth.
   - Isso evita trocar a sessão do administrador atual ao criar uma nova conta.
   - O cadastro grava dados compatíveis no Realtime Database:
     uid, email, role, name, nome, isActive, ativo, createdAt, criadoEm, updatedAt e atualizadoEm.
   - Se o Auth for criado mas a gravação no Database falhar, a conta recém-criada é removida para evitar usuário órfão.

3. Login corrigido
   - O login não falha mais quando a regra do Database impede usuários comuns de atualizar lastLogin em users/{uid}.
   - O acesso só é liberado quando existe cadastro em users/{uid} e o usuário está ativo.
   - A normalização agora aceita campos legados: name/nome e isActive/ativo.

4. Regras do Database
   - As regras agora exigem que o usuário exista em users/{uid} para leitura/escrita operacional.
   - Isso evita acesso de contas criadas apenas no Firebase Auth, mas sem cadastro no banco.

Observação:
- Para criar usuários pelo painel, entre antes com uma conta administradora ativa.
- Publique também o arquivo firebase.database.rules.json no Firebase Console para aplicar a parte de segurança.
