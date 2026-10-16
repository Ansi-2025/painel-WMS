# Painel WMS

Dashboard para acompanhar ordens e filas da operação logística por meio da API E-SHIP. A interface foi preparada para telas de TV e também se adapta a computadores, tablets e smartphones.

## Recursos

- Acompanhamento do valor total e da quantidade de pedidos.
- Cartões interativos para filtrar as ordens por status sem repetir a consulta à API a cada seleção.
- Gráficos de pedidos e valores de frete por status.
- Gráfico de ordens por tempo de criação, das últimas 24 horas a mais de 30 dias; ordens sem data válida não são exibidas.
- Distribuição das ordens por estado do destinatário, com quantidade e valor.
- Resumo das filas por família, com pesquisa.
- Atualização automática dos dados a cada 2 minutos.
- O dashboard principal consulta somente o armazém BRANCO01.
- O resumo mostra o valor das ordens canceladas no dia, pela data da última atualização da ordem no fuso de Fortaleza.
- A consulta padrão do dashboard usa os tipos de ordem Montagem, Suframa, Difal, Agendamento, SAC e Ecommerce, conforme os filtros do WMS.
- As contagens consideram apenas ordens com o campo “Valor da ordem” preenchido, como no relatório atual do WMS.
- Navegação adaptada para celular, tablet, computador e TV.
