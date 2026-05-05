Correção aplicada - Tour abrindo sozinho ao relogar

Problema identificado:
- O tour era iniciado automaticamente quando a URL continha o parâmetro ?tour=1.
- Após sair e entrar novamente, o login em index.html usava window.location.reload(), preservando a URL atual.
- Se a URL ainda estava como index.html?tour=1, o tour voltava a abrir sozinho a cada relogin.
- Além disso, o script do tour podia tentar iniciar mesmo com a tela de login visível, porque verificava apenas se #mainContent existia no DOM.

Alterações realizadas:
1. tutorial-tour.js atualizado para versão 20260504v22.
2. O parâmetro tour é removido da URL assim que é consumido, usando history.replaceState.
3. O tour só inicia se #mainContent estiver realmente visível e a tela de login não estiver visível.
4. Quando o parâmetro ?tour=1 é usado vindo do manual, o script espera o painel principal ficar pronto antes de iniciar.
5. index.html atualizado para carregar tutorial-tour.js?v=20260504v22.
6. sw.js atualizado para novo cache wmoldes-pwa-v22-tour-relogin-fix.

Resultado esperado:
- Clicar em "Iniciar tour" continua funcionando normalmente.
- Clicar no botão do manual que abre index.html?tour=1 inicia o tour apenas uma vez.
- Depois de logout/login ou recarregamento da página, o tour não abre sozinho.
