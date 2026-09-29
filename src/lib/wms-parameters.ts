export type OpcaoParametroEship = { id: string; descricao: string };

export type DefinicaoParametroEship = {
  chave: string;
  descricao: string;
  tipo: "STRING" | "INT" | "DATE" | "DATETIME" | "BOOL";
  grupo: string;
  opcoes?: OpcaoParametroEship[];
  multiplo?: boolean;
  obrigatorio?: boolean;
};

const statusOrdem: OpcaoParametroEship[] = [
  { id: "1", descricao: "Lançado" },
  { id: "2", descricao: "Emitido" },
  { id: "3", descricao: "Em operação" },
  { id: "4", descricao: "Conferida" },
  { id: "5", descricao: "Aguardando documentação" },
  { id: "6", descricao: "Aguardando Expedição" },
  { id: "7", descricao: "Em Expedição" },
  { id: "8", descricao: "Concluída/Despachada" },
  { id: "9", descricao: "Aguardando reenvio" },
  { id: "10", descricao: "Cancelada" },
  { id: "11", descricao: "Devolvida" },
];

const tipoOrdem: OpcaoParametroEship[] = [
  { id: "1", descricao: "Produção" },
  { id: "2", descricao: "Venda" },
  { id: "3", descricao: "Transferência" },
  { id: "4", descricao: "Montagem" },
  { id: "5", descricao: "Requisição" },
  { id: "6", descricao: "Suframa" },
  { id: "7", descricao: "Embalagem" },
  { id: "8", descricao: "sdfasdf" },
  { id: "9", descricao: "Sucata" },
  { id: "10", descricao: "Difal" },
  { id: "11", descricao: "Manutenção" },
  { id: "12", descricao: "Agendamento" },
  { id: "13", descricao: "SAC" },
  { id: "14", descricao: "Exportação" },
  { id: "15", descricao: "Ressuprimento" },
  { id: "20", descricao: "Ecommerce" },
  { id: "21", descricao: "Transformação" },
  { id: "22", descricao: "Agrupamento" },
];

const periodo: OpcaoParametroEship[] = [
  { id: "10004", descricao: "Hoje" },
  { id: "10005", descricao: "Ontem" },
  ...Array.from({ length: 33 }, (_, indice) => ({
    id: String(indice + 1),
    descricao: String(indice + 1),
  })),
  { id: "10003", descricao: "Mês atual" },
  { id: "10001", descricao: "Mês anterior" },
  { id: "10002", descricao: "Próximo mês" },
  { id: "10006", descricao: "Mês retrasado" },
];

const periodoLancamentoMaiorQue: OpcaoParametroEship[] = [
  { id: "10004", descricao: "Hoje" },
  { id: "10005", descricao: "Ontem" },
  ...Array.from({ length: 84 }, (_, indice) => ({
    id: String(indice + 1),
    descricao: String(indice + 1),
  })),
  { id: "10003", descricao: "Mês atual" },
  { id: "10001", descricao: "Mês anterior" },
  { id: "10002", descricao: "Próximo mês" },
  { id: "10006", descricao: "Mês retrasado" },
];

const horas: OpcaoParametroEship[] = Array.from({ length: 7 }, (_, indice) => ({
  id: String(indice + 1),
  descricao: String(indice + 1),
}));

const infoCampos: OpcaoParametroEship[] = [
  [351, "Nº da Nota venda"], [352, "Nº da Compra"], [353, "Depósito - Retirada"],
  [354, "Tipo Operação"], [355, "Setor"], [356, "Fila"], [357, "Nº Origem"],
  [358, "Req. Cancelamento"], [359, "Req. Devolução"], [360, "Data Faturamento (final)"],
  [361, "Data Faturamento (inicial)"], [362, "Valor Nota"], [367, "Motivo Cancelamento"],
  [368, "Depósito Destino"], [369, "Cod. Fiscal"], [370, "Chave"], [371, "Valor Frete"],
  [372, "Série da nota"], [373, "Data de emissão da nota"], [374, "Situação da nota"],
  [375, "Tipo de frete"], [376, "Valor da ordem"], [377, "Data vinda da integração"],
  [378, "Data do embarque"], [379, "Prazo"], [380, "Data cálculo prazo"], [381, "URL externa"],
  [382, "Nº Embarque pré-definido"], [383, "Rota"], [384, "Nº Carga"], [385, "Peso"],
  [386, "Data da Compra"], [387, "Canal de Venda"], [388, "Nº da Compra Ecommerce"],
  [389, "Transporte Alterado"], [390, "Alterar Transporte"], [391, "Classe Imposto"],
  [392, "Nº da Compra Canal de Venda"], [393, "IE Remetente"], [394, "IE Destinatário"],
  [395, "Armazém Origem"], [396, "Código integração Multisoft"], [397, "Nº Coleta"],
  [398, "Nº Máquina"], [399, "Nº Instalação"], [400, "Último status enviado"],
  [401, "Processo ID"], [402, "Nº da Nota retorno"], [403, "Série da nota de retorno"],
  [404, "Data de emissão da nota de retorno"], [405, "Valor Nota de Retorno"],
  [406, "Cod. Fiscal Nota de Retorno"], [407, "Chave Nota de Retorno"],
  [408, "Valor Frete Nota Retorno"], [409, "Qtd. Volumes Nota"],
  [410, "Qtd. Volumes Nota Retorno"], [411, "Nº da Nota Remessa"],
  [412, "Série da nota de Remessa"], [413, "Data de emissão da nota de remessa"],
  [414, "Valor Nota de Remessa"], [415, "Cod. Fiscal Nota de Remessa"],
  [416, "Chave Nota de Remessa"], [417, "Valor Frete Nota Remessa"],
  [418, "Data Previsão de Entrega"], [419, "Id Nota"], [420, "Identificador Externo"],
  [421, "Quantidade Solicitada"], [18, "Observação"], [1702, "Condição de Pagamento"],
].map(([id, descricao]) => ({ id: String(id), descricao: String(descricao) }));

const filas: OpcaoParametroEship[] = [
  [63, "ABASTECIMENTOLINHA"], [258, "AGRISHOWPECA"], [44, "AGRUPSETORD"],
  [216, "AMAZONPECA"], [215, "AMAZONPROD"], [62, "APON"], [155, "B2BPECA"],
  [64, "B2BPROD"], [233, "BANCADA"], [28, "CLIENTERETIRAPECA"],
  [29, "CLIENTERETIRAPROD"], [227, "COEX01"], [239, "COEX02"], [244, "COEX03"],
  [247, "COEX04"], [259, "DEDICADO"], [206, "DIFALPEÇA"], [205, "DIFALPRODUTO"],
  [209, "EXPORTACAOPECA"], [210, "EXPORTACAOPROD"], [65, "GARANTIA"],
  [128, "GAZINPECA"], [154, "GAZINPROD"], [213, "GURGELPEÇA"], [214, "GURGELPRODUTO"],
  [204, "INSPECAO"], [77, "KIT"], [147, "LEROYPECA"], [146, "LEROYPROD"],
  [49, "LINHA01"], [48, "LINHA01T2"], [51, "LINHA02"], [50, "LINHA02T2"],
  [52, "LINHA03"], [53, "LINHA03T2"], [55, "LINHA04"], [54, "LINHA04T2"],
  [56, "LINHA05"], [57, "LINHA05T2"], [59, "LINHA06"], [58, "LINHA06T2"],
  [254, "LJB"], [222, "MADEIRA PEÇA"], [223, "MADEIRA PRODUTO"],
  [245, "MARTINSPRODUTO"], [84, "MAXTON"], [196, "MBCPECA"], [225, "MKT PRODUTO"],
  [224, "MKTPEÇA"], [200, "NAOSELECIONAR"], [255, "OBRAMAXPECA"],
  [256, "OBRAMAXPROD"], [164, "ONDA01"], [165, "ONDA02"], [166, "ONDA03"],
  [167, "ONDA04"], [269, "ONDA05"], [26, "ONDAATRASADO01"], [170, "ONDAATRASADO02"],
  [207, "ONDAATRASADO03"], [271, "ONDAATRASADO04"], [272, "ONDAATRASADO05"],
  [261, "PECA-ATRASADA01"], [262, "PECA-ATRASADA02"], [263, "PECA-ATRASADA03"],
  [264, "PECA-ATRASADA04"], [265, "PECA-ATRASADA05"], [180, "PECA01"], [181, "PECA02"],
  [182, "PECA03"], [183, "PECA04"], [184, "PECA05"], [172, "PECAMISTA01"],
  [173, "PECAMISTA02"], [174, "PECAMISTA03"], [175, "PECAMISTA04"], [176, "PECAMISTA05"],
  [14, "PECAMISTOATRASADO01"], [186, "PECAMISTOATRASADO02"], [16, "PECAMISTOATRASADO03"],
  [160, "PECAMISTOATRASADO04"], [144, "PECAMISTOATRASADO05"], [188, "PRODMISTO01"],
  [189, "PRODMISTO02"], [190, "PRODMISTO03"], [191, "PRODMISTO04"], [192, "PRODMISTO05"],
  [197, "PRODMISTOATRASADO01"], [267, "PRODMISTOATRASADO02"],
  [268, "PRODMISTOATRASADO03"], [163, "PRODMISTOATRASADO04"],
  [266, "PRODMISTOATRASADO05"], [142, "REQUISICAO"], [145, "SACPECA"],
  [95, "SACPRODUCAO"], [203, "SACPRODUTO"], [273, "SETOR C p/ A"],
  [274, "SETOR E p/ A"], [112, "SLOBSPARCIALALMOX"], [81, "SLOBSPARCIALEXPED"],
  [129, "SLOBSTOTALALMOX"], [111, "SUCATA"], [211, "TECIDOSPECAS"],
  [212, "TECIDOSPROD"], [134, "TESTE02"], [30, "TESTENAOMEXER"],
  [43, "TRANSFORMACAOPECA"], [45, "TRANSFORMACAOPROD"], [260, "TRANSFPROD"],
  [141, "TRANSPECA"], [201, "TRIANGULARPECA"], [202, "TRIANGULARPRD"],
  [159, "URGENTEPECA"], [230, "VACUO"],
].map(([id, descricao]) => ({ id: String(id), descricao: String(descricao) }));

const armazens: OpcaoParametroEship[] = [
  { id: "10", descricao: "BRANCO01" },
  { id: "54", descricao: "TREINAMENTO" },
];

const transportes: OpcaoParametroEship[] = [
  [262, "ALFA"], [292, "AMISTAD TRANSPORTES"], [64, "APUCARANA"], [61, "ATUALCARGAS"],
  [278, "AZUL LINHAS AEREAS BRASILEIRAS S A"], [259, "BBM"], [237, "BERTOLINI"],
  [130, "BRASPRESS"], [189, "BULKY LOG TRASPORTES LTDA"], [288, "CARLOS AUGUSTO NUNES"],
  [260, "CARVALIMA"], [274, "CASTLOGISTICA"], [273, "CLARO TRANS"],
  [229, "CLIENTE RETIRA (COLABORADOR)"], [65, "CLIENTERETIRA"], [66, "CLIENTERETIRA01"],
  [183, "CONNECT LOGISTICA E SOLUCOES EM TRADE MARKETING LTDA"], [281, "CORREIOS"],
  [230, "COTACAO"], [251, "DAB TRANS"], [284, "DELATRANS TRANSPORTE"], [275, "DUCHICO S.A"],
  [265, "EBTRANS EXPRESSO"], [285, "ECOLOG TRANSPORTES"], [267, "EFITRANS"],
  [238, "EXP. SÃO MIGUEL"], [236, "FL BRASIL SOLISTICA"], [154, "GLOBAL"],
  [287, "GLOBAL AIR"], [279, "JAMEF TRANSPORTES EIRELI"], [261, "LTSL ENCOMENDAS"],
  [291, "MAIA TRANSPORTES"], [264, "NATIVA"], [269, "PANEX"],
  [258, "PASSARO VERDE EXPRESSO LTDA"], [52, "PATRUS"], [266, "PLAV TRANS"],
  [71, "PROPRIO"], [280, "REIS TRANS"], [289, "RODOCAMI TRANSPORTES RODOVIARIOS LTDA"],
  [235, "RODONAVES"], [272, "SAFE WAY"], [290, "SOMENTE PARA ANEXOS"],
  [94, "STADLER"], [263, "TERMACO"], [254, "TRANSSOUZA"],
].map(([id, descricao]) => ({ id: String(id), descricao: String(descricao) }));

const anexos: OpcaoParametroEship[] = [
  [2, "DOCUMENTOS / IT / POP"], [3, "FOTOS"], [4, "XMLDANFE"], [5, "VIDEOS"],
  [6, "JSON"], [7, "ETIQUETA"], [8, "LOG"], [9, "XML"], [10, "REPORT"],
  [11, "ASSINATURA"], [12, "ARQUIVOS"], [13, "CERTIFICADO"], [14, "CONFIGURAÇÃO"],
  [15, "VALORES"], [16, "ÁUDIO"],
].map(([id, descricao]) => ({ id: String(id), descricao: String(descricao) }));

const ordemSort: OpcaoParametroEship[] = [
  { id: "1", descricao: "Mais antigo" },
  { id: "2", descricao: "Mais recente" },
];

const cadastroBranco: OpcaoParametroEship[] = [{ id: "2", descricao: "BRANCO" }];
const incrementar: OpcaoParametroEship[] = [
  [75, "Status"], [76, "Tipo"], [77, "FalhaOperacao"], [78, "Armazem"],
  [79, "Produto"], [80, "ProdutoOrdem"], [81, "OrdemSaida"], [82, "Reserva"],
  [83, "Informacao"], [84, "InformacaoEspecifica"], [85, "InformacaoOperacao"],
  [86, "Transporte"], [87, "Historico"], [88, "Remetente"], [89, "Destinatario"],
  [90, "EnderecoRemetente"], [91, "EnderecoDestinatario"],
].map(([id, descricao]) => ({ id: String(id), descricao: String(descricao) }));

const periodoCampos: DefinicaoParametroEship[] = [
  { chave: "periodoLancamento", descricao: "Período de lançamento", tipo: "INT", grupo: "Datas e períodos", opcoes: periodo },
  { chave: "periodoEmbarqueOrdem", descricao: "Período de embarque", tipo: "INT", grupo: "Datas e períodos", opcoes: periodo },
  { chave: "periodoFaturamento", descricao: "Período de faturamento", tipo: "INT", grupo: "Datas e períodos", opcoes: periodo },
  { chave: "periodoLancamentoMaiorQue", descricao: "Lançamento nos últimos dias", tipo: "INT", grupo: "Datas e períodos", opcoes: periodoLancamentoMaiorQue },
  { chave: "periodoLancamentoHora", descricao: "Período de lançamento por hora", tipo: "INT", grupo: "Datas e períodos", opcoes: horas },
  { chave: "periodoLancamentoHoraDiaUtil", descricao: "Lançamento por hora (dia útil)", tipo: "INT", grupo: "Datas e períodos", opcoes: horas },
  { chave: "periodoLancamentoHoraMais", descricao: "Lançamento por hora (adicional)", tipo: "INT", grupo: "Datas e períodos", opcoes: horas },
];

const informacoesOrdem = infoCampos.map(({ id, descricao }) => ({
  chave: id,
  descricao: `ORD — ${descricao}`,
  tipo: "STRING" as const,
  grupo: "Informações da ordem",
}));

const informacoesParciais = [351, 352, 355, 357, 358, 359, 362, 367, 370, 371, 374, 375, 376, 379, 381, 382, 383, 384, 385, 387, 388, 389, 390, 391, 392, 393, 394, 396, 397, 398, 399, 400, 401, 402, 405, 407, 408, 411, 414, 416, 417, 419, 420, 421, 18, 1702];

export const PARAMETROS_ESHIP: DefinicaoParametroEship[] = [
  { chave: "ordem", descricao: "Ordem", tipo: "STRING", grupo: "Consulta geral" },
  { chave: "tipoFrete", descricao: "Tipo de frete", tipo: "STRING", grupo: "Consulta geral" },
  { chave: "statusOrdem", descricao: "Status da ordem", tipo: "INT", grupo: "Consulta geral", opcoes: statusOrdem, multiplo: true },
  { chave: "tipoOrdem", descricao: "Tipo de ordem", tipo: "INT", grupo: "Consulta geral", opcoes: tipoOrdem, multiplo: true },
  { chave: "numeroOrigem", descricao: "Número de origem", tipo: "STRING", grupo: "Consulta geral" },
  { chave: "criadoPor", descricao: "Criado por (ID do usuário)", tipo: "INT", grupo: "Consulta geral" },
  { chave: "incluirInfo", descricao: "Incluir informações detalhadas", tipo: "BOOL", grupo: "Consulta geral", obrigatorio: true, opcoes: [{ id: "true", descricao: "Sim" }, { id: "false", descricao: "Não" }] },
  { chave: "dataLancamento", descricao: "Data inicial de lançamento", tipo: "DATE", grupo: "Datas e períodos" },
  { chave: "dataFinalLancamento", descricao: "Data final de lançamento", tipo: "DATE", grupo: "Datas e períodos" },
  { chave: "dataEmbarqueOrdem", descricao: "Data inicial de embarque", tipo: "DATE", grupo: "Datas e períodos" },
  { chave: "dataFinalEmbarqueOrdem", descricao: "Data final de embarque", tipo: "DATE", grupo: "Datas e períodos" },
  { chave: "dataHoraLancamento", descricao: "Data e hora de lançamento", tipo: "DATETIME", grupo: "Datas e períodos" },
  { chave: "dataHoraFinalLancamento", descricao: "Data e hora final de lançamento", tipo: "DATETIME", grupo: "Datas e períodos" },
  { chave: "dataHoraInicialAtualizacao", descricao: "Data e hora inicial de atualização", tipo: "DATETIME", grupo: "Datas e períodos" },
  { chave: "dataHoraFinalAtualizacao", descricao: "Data e hora final de atualização", tipo: "DATETIME", grupo: "Datas e períodos" },
  ...periodoCampos,
  { chave: "infoFila", descricao: "Fila", tipo: "INT", grupo: "Filtros de informação", opcoes: filas },
  { chave: "infoValor", descricao: "Valor da informação", tipo: "INT", grupo: "Filtros de informação" },
  { chave: "infoValorMenorQue", descricao: "Valor menor que", tipo: "INT", grupo: "Filtros de informação" },
  { chave: "infoValorMaiorQue", descricao: "Valor maior que", tipo: "INT", grupo: "Filtros de informação" },
  { chave: "preVolumetria", descricao: "Pré-volumetria", tipo: "INT", grupo: "Filtros de informação" },
  { chave: "preVolumetriaMaiorQue", descricao: "Pré-volumetria maior que", tipo: "INT", grupo: "Filtros de informação" },
  { chave: "preVolumetriaMenorQue", descricao: "Pré-volumetria menor que", tipo: "INT", grupo: "Filtros de informação" },
  { chave: "preVolumetriaPeso", descricao: "Peso da pré-volumetria", tipo: "INT", grupo: "Filtros de informação" },
  { chave: "preVolumetriaPesoMaiorQue", descricao: "Peso da pré-volumetria maior que", tipo: "INT", grupo: "Filtros de informação" },
  { chave: "preVolumetriaPesoMenorQue", descricao: "Peso da pré-volumetria menor que", tipo: "INT", grupo: "Filtros de informação" },
  { chave: "infoNotNull", descricao: "Informação preenchida", tipo: "INT", grupo: "Filtros de informação", opcoes: infoCampos },
  { chave: "infoNull", descricao: "Informação vazia", tipo: "INT", grupo: "Filtros de informação", opcoes: infoCampos },
  { chave: "tipoInfo", descricao: "Tipo de informação", tipo: "INT", grupo: "Filtros de informação", opcoes: infoCampos },
  { chave: "infoFilaTexto", descricao: "Texto da fila", tipo: "STRING", grupo: "Filtros de informação" },
  { chave: "infoNumeroNota", descricao: "Número da nota", tipo: "STRING", grupo: "Filtros de informação" },
  { chave: "observacao", descricao: "Observação", tipo: "STRING", grupo: "Filtros de informação" },
  { chave: "dadoInfo", descricao: "Valor da informação", tipo: "STRING", grupo: "Filtros de informação" },
  { chave: "likeInfo", descricao: "Buscar texto parcial", tipo: "STRING", grupo: "Filtros de informação" },
  { chave: "periodoLancamentoMesAtualFinal", descricao: "Data final do mês atual (lançamento)", tipo: "STRING", grupo: "Datas e períodos" },
  { chave: "periodoLancamentoUltimoMesInicial", descricao: "Data inicial do mês anterior (lançamento)", tipo: "STRING", grupo: "Datas e períodos" },
  { chave: "periodoEmbarqueMesAtualFinal", descricao: "Data final do mês atual (embarque)", tipo: "STRING", grupo: "Datas e períodos" },
  { chave: "periodoEmbarqueUltimoMesInicial", descricao: "Data inicial do mês anterior (embarque)", tipo: "STRING", grupo: "Datas e períodos" },
  { chave: "periodoFaturamentoMesAtualFinal", descricao: "Data final do mês atual (faturamento)", tipo: "STRING", grupo: "Datas e períodos" },
  { chave: "periodoFaturamentoUltimoMesInicial", descricao: "Data inicial do mês anterior (faturamento)", tipo: "STRING", grupo: "Datas e períodos" },
  ...informacoesOrdem,
  ...informacoesParciais.map((id) => {
    const campo = infoCampos.find((item) => item.id === String(id));
    return {
      chave: `${id}likeInfo`,
      descricao: `ORD — ${campo?.descricao ?? id} (parcial)`,
      tipo: "STRING" as const,
      grupo: "Informações da ordem",
    };
  }),
  { chave: "anexosDisponiveis", descricao: "Anexos disponíveis", tipo: "INT", grupo: "Outros", opcoes: anexos },
  { chave: "anexosIndisponiveis", descricao: "Anexos indisponíveis", tipo: "INT", grupo: "Outros", opcoes: anexos },
  { chave: "cadastro", descricao: "Cadastro", tipo: "INT", grupo: "Cadastros", opcoes: cadastroBranco },
  { chave: "cadastroSuperior", descricao: "Cadastro superior", tipo: "INT", grupo: "Cadastros", opcoes: cadastroBranco },
  { chave: "codigoCadastro", descricao: "Código do cadastro", tipo: "STRING", grupo: "Cadastros" },
  { chave: "nomeCadastro", descricao: "Nome do cadastro", tipo: "STRING", grupo: "Cadastros" },
  { chave: "descricaoCadastro", descricao: "Descrição do cadastro", tipo: "STRING", grupo: "Cadastros" },
  { chave: "cnpj", descricao: "CNPJ", tipo: "STRING", grupo: "Cadastros" },
  { chave: "cpf", descricao: "CPF", tipo: "STRING", grupo: "Cadastros" },
  { chave: "armazem", descricao: "Armazém", tipo: "INT", grupo: "Armazém e transporte", opcoes: armazens },
  { chave: "tipoArmazem", descricao: "Tipo de armazém", tipo: "INT", grupo: "Armazém e transporte", opcoes: [{ id: "1", descricao: "Movimentação" }, { id: "2", descricao: "Entreposto" }] },
  { chave: "statusArmazem", descricao: "Status do armazém", tipo: "INT", grupo: "Armazém e transporte", opcoes: [{ id: "1", descricao: "Ativado" }, { id: "2", descricao: "Desativado" }] },
  { chave: "codigoTransporte", descricao: "Código do transporte", tipo: "STRING", grupo: "Armazém e transporte" },
  { chave: "nomeTransporte", descricao: "Nome do transporte", tipo: "STRING", grupo: "Armazém e transporte" },
  { chave: "transporte", descricao: "Transporte", tipo: "INT", grupo: "Armazém e transporte", opcoes: transportes },
  { chave: "transporteMultiplo", descricao: "Transportes", tipo: "INT", grupo: "Armazém e transporte", opcoes: transportes, multiplo: true },
  { chave: "statusTransporte", descricao: "Status do transporte", tipo: "INT", grupo: "Armazém e transporte", opcoes: [{ id: "1", descricao: "Ativado" }, { id: "2", descricao: "Desativado" }] },
  { chave: "cadastroTransporte", descricao: "Cadastro do transporte", tipo: "INT", grupo: "Armazém e transporte", opcoes: cadastroBranco },
  { chave: "pagina", descricao: "Página", tipo: "INT", grupo: "Paginação" },
  { chave: "quantidadeRegistros", descricao: "Quantidade de registros", tipo: "INT", grupo: "Paginação" },
  { chave: "ordenacao", descricao: "Ordenação", tipo: "INT", grupo: "Paginação", opcoes: ordemSort },
  { chave: "incrementar", descricao: "Incrementar entidade", tipo: "STRING", grupo: "Paginação", opcoes: incrementar },
];

export function obterDefinicaoParametro(chave: string): DefinicaoParametroEship | undefined {
  return PARAMETROS_ESHIP.find((parametro) => parametro.chave === chave);
}

export function valorInicialParametro(chave: string): string {
  if (chave === "incluirInfo") return "true";
  return "";
}