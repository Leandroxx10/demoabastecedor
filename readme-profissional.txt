WMoldes - Pacote profissional pronto para deploy

- Visualização do olho organizada por seções: "Terminações" aparece uma única vez como título, com os campos abaixo sem repetição no rótulo
Inclui:
- Ícone do teclado com contraste em cinza escuro para melhor leitura
- Página independente de Tutorial com animações, foco guiado e orientação profissional de uso
- Botão "Tutorial" integrado na barra superior do painel principal
- Visualização detalhada do prefixo com campos separados
- Botão de olho visível também no mobile
- PWA configurado (manifest, service worker e cache dos arquivos do tutorial)
- Logs automáticos de alterações
- Regras do Firebase Realtime Database

Arquivos novos:
- tutorial.html
- tutorial.css
- tutorial.js
- manifest.webmanifest
- sw.js
- pwa-register.js
- firebase.database.rules.json

Deploy:
1. Publique todos os arquivos na raiz do hosting.
2. Publique as regras em firebase.database.rules.json no Realtime Database.
3. Confirme que os links de imagem dos prefixos estão em campos como imageUrl, imagem, imgbb ou linkImagem.
4. Abra a aplicação no navegador, valide o botão Tutorial e instale como app se desejar.
