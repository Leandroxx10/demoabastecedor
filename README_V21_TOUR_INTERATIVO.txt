WMoldes - Abastecedor V21
Tour interativo profissional dentro do sistema

Alterações principais:
1. Adicionado botão "Iniciar tour" no painel principal do abastecedor.
2. Criados os arquivos:
   - tutorial-tour.js
   - tutorial-tour.css
3. O tour destaca partes reais da tela com foco visual, texto explicativo, navegação por botões e teclado.
4. Termos do painel principal ajustados de "produção" para "abastecimento" onde se referem ao uso operacional do abastecedor.
5. O Manual continua disponível em página separada pelo botão "Manual".
6. Adicionado acesso ao tour pelo tutorial.html com link para index.html?tour=1.
7. Service worker atualizado para limpar cache antigo e incluir os novos arquivos.

Como usar:
- Acesse o painel do abastecedor.
- Clique em "Iniciar tour".
- Navegue com Próxima/Anterior ou teclado:
  - seta direita: próxima etapa
  - seta esquerda: etapa anterior
  - Esc: sair do tour

Validações executadas:
- node --check tutorial-tour.js
- node --check script.js
- node --check sw.js
