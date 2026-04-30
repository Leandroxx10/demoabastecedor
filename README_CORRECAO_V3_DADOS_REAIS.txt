Correção V3 - gráfico com dados reais e horário de São Paulo

- O gráfico usa /historico para pontos confirmados.
- O último ponto também lê /maquinas para bater com o card atual.
- Esse ponto atual não é salvo no Firebase; é somente visual.
- Data/hora exibida em America/Sao_Paulo.
- Janela 24h usa Date.now() - 24h, sem -3h/+3h manual.
