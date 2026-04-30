Correção V4 - Histórico Admin / Gráfico

- O gráfico agora usa somente registros reais salvos em /historico com tipo real_time.
- Removido o ponto artificial baseado em Date.now() / estado atual de /maquinas.
- Isso impede que o último ponto mude de 07:11 para 07:12, 07:13 etc. sem novo lançamento real.
- O horário exibido continua compatível com America/Sao_Paulo.
- O card atual pode divergir do gráfico até que o auto-history-service confirme e grave uma nova alteração real no /historico.
