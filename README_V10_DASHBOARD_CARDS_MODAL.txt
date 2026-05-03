V10 - Correção solicitada

1. Horários nos cards do painel
- Adicionado horário atual em tempo real no card.
- Adicionada última atualização da máquina no card.
- A última atualização usa updatedServerAt, updatedAt, lastUpdated, lastUpdate, ultimaAtualizacao, timestamp ou createdAt.

2. Modal ao clicar no nome/código da máquina
- O clique no nome/código/prefixo da máquina abre o modal com histórico somente daquela máquina.
- O modal possui filtros por data, 24h, Turno 1, Turno 2 e Turno 3.
- Turno 3 segue 22:00 do dia selecionado até 06:00 do dia seguinte.

3. Busca robusta dos dados do gráfico no modal
- O modal agora varre /historico de forma ampla, igual ao histórico admin.
- Compatível com /historico/{maquina}/{pushId} e estruturas antigas/inconsistentes.
- Não bloqueia mais registros por tipo desconhecido quando o registro possui timestamp/dados válidos.
- Usa fallback do estado atual da máquina quando o histórico ainda não chegou ao cliente.

4. Cache
- Versionamento do dashboard-machine-modal.js atualizado para v10.
