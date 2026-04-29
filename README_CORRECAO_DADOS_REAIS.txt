Correção aplicada

- O histórico salva somente alterações reais confirmadas.
- Debounce independente por máquina e por campo: molde, blank, neck_ring e funil.
- Snapshots horários automáticos foram desativados para não gerar dados falsos/zeros no gráfico.
- O gráfico ignora registros antigos tipo hourly/snapshot_atual e usa apenas registros real_time*.
- Cada ponto do gráfico usa os valores completos reais no momento confirmado.
- Ao voltar para a aba de histórico, a máquina selecionada recarrega automaticamente sem precisar clicar em data/turno.
