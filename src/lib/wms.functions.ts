import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { paraNumero, type OrdemWMS } from "./wms-api";
import {
  ARMAZEM_BRANCO01_ID,
  STATUS_ORDEM,
  STATUS_ORDEM_OPERACIONAIS,
  TIPOS_ORDEM_PADRAO_DASHBOARD,
} from "./wms-parameters";
import { ConsultaEshipSchema, type ConsultaEship } from "./wms-config";
import { PRODUCT_IMAGE_LINKS } from "./product-image-links.generated";
import { exigirAcessoDashboard, exigirSessao } from "@/lib/server/auth.server";

const TIMEOUT_REQUISICAO_ESHIP_MS = 30_000;
const TIMEOUT_ENDERECAMENTO_ESHIP_MS = 60_000;
const CONCORRENCIA_ENDERECAMENTO = 4;
const MAX_TENTATIVAS_POR_PAGINA = 3;
const ATRASO_BASE_RETENTATIVA_MS = 700;

class FalhaPaginaEship extends Error {
  constructor(
    message: string,
    readonly retentavel: boolean,
  ) {
    super(message);
    this.name = "FalhaPaginaEship";
  }
}

// A chave da API existe somente no ambiente do servidor.
// Todos os módulos consomem o mesmo formato de dados; muda apenas a função da API.
type RespostaPaginaEship<T> = {
  corpo?: {
    body?: {
      dados?: T[];
      dadosPaginacao?: Record<string, unknown>;
    };
  };
};

type DataHoraEship = string | { date?: string; timezone_type?: number; timezone?: string } | null;

type PlanoInventarioEship = {
  id?: number | string;
  idModeloDistribuicao?: number | string;
  qtdPrevista?: number | string;
  status?: { id?: number | string; descricao?: string };
  produto?: {
    id?: number | string;
    idTipo?: number | string;
    codigo?: string;
    descricao?: string;
  };
  posicao?: {
    id?: number | string;
    codigo?: string;
    idSetor?: number | string;
  };
  armazem?: {
    id?: number | string;
  };
  deposito?: {
    id?: number | string;
    descricao?: string;
    idArmazem?: number | string;
  };
  inventario?: {
    id?: number | string;
    descricao?: string;
    dataHoraCriacao?: DataHoraEship;
    finalizado?: boolean;
  };
};

type InventarioEship = {
  id?: number | string;
  descricao?: string;
  dataHoraCriacao?: DataHoraEship;
  finalizado?: boolean;
  tipo?: { descricao?: string };
  armazem?: { id?: number | string };
  planos?: PlanoInventarioEship[];
};

export type ItemPlanoInventarioWms = {
  id: string;
  tipoRegistro: "Produto" | "Posição";
  categoriaProduto: "Peça" | "Produto" | "Outro" | null;
  codigo: string;
  descricaoProduto: string;
  enderecoCompleto: string | null;
  indicePosicao: string | null;
  rua: string | null;
  setor: string | null;
  linkImagem: string | null;
  deposito: string;
  statusId: string;
  status: string;
};

export type RuaInventarioWms = {
  id: string;
  setor: string;
  rua: string;
  contagens: number;
};

export type StatusPlanoInventarioWms = {
  id: string;
  nome: string;
  quantidade: number;
};

export type PainelInventarioWms = {
  inventario: {
    id: string;
    descricao: string;
    criadoEm: string | null;
    finalizado: boolean;
    tipo: string;
  };
  itens: ItemPlanoInventarioWms[];
  status: StatusPlanoInventarioWms[];
  ruas: RuaInventarioWms[];
  enderecosSemRua: number;
  atualizadoEm: string;
};

type OrdemEship = Omit<OrdemWMS, "dataHora"> & {
  dataHora?: DataHoraEship;
};

type OrdemDetalhadaEship = {
  id?: number | string;
  idStatus?: number | string;
  dataHora?: DataHoraEship;
  valorTotal?: number | string;
  infos?: {
    valordaordem?: string | number;
  };
  status?: { id?: number | string; descricao?: string };
  produtosOrdem?: ProdutoOrdemEship[];
  enderecoDestinatario?: {
    municipio?: {
      estado?: { sigla?: string; descricao?: string };
    };
  };
  ordem?: {
    id?: number | string;
    idStatus?: number | string;
    dataHora?: DataHoraEship;
    status?: { id?: number | string; descricao?: string };
    produtosOrdem?: ProdutoOrdemEship[];
    enderecoDestinatario?: {
      municipio?: {
        estado?: { sigla?: string; descricao?: string };
      };
    };
  };
};

type InfoOrdemEship = {
  ordem?: number | string;
  infosAdicionais?: {
    valordaordem?: string | number;
  };
};

type EnderecamentoEship = {
  descricao?: string;
  posicao?: {
    id?: number | string;
    codigo?: string;
    codigoPosicao?: string;
    descricao?: string;
    descricaoCompleta?: string;
    enderecoFormatado?: string;
    sufixo?: string;
    indice?: number | string;
    prateleira?: string | number;
    idSetor?: number | string;
    idStatus?: number | string;
    idTipo?: number | string;
    idTipoOcupacao?: number | string;
    rua?: { id?: number | string; descricao?: string };
    modulo?: { id?: number | string; descricao?: string };
  };
};

type DepositoEndereco = {
  id: string;
  nome: string;
};

export type ItemEnderecoArmazem = {
  id: string;
  codigo: string;
  descricao: string;
  quantidade: number | null;
  saldo: number | null;
  depositoId: string | null;
  depositoNome: string | null;
};

type ResumoDeposito = DepositoEndereco & {
  posicoes: number;
  quantidadeProdutos: number;
};

export type EnderecoArmazem = {
  id: string;
  codigoPosicao: string | null;
  descricaoCompleta: string;
  setor: string;
  rua: string;
  modulo: string;
  prateleira: string;
  posicao: string;
  sufixo: string;
  statusId: string;
  tipoPosicaoId: string;
  tipoOcupacaoId: string;
  ocupacoesProduto: number;
  depositos: DepositoEndereco[];
};

type OcupacaoPorRua = {
  setor: string;
  rua: string;
  total: number;
  ocupadas: number;
  percentual: number;
};

type OcupacaoPorSetor = {
  setor: string;
  total: number;
  ocupadas: number;
  percentual: number;
};

type ResumoStatusPosicao = {
  id: string;
  nome: string;
  quantidade: number;
};

type ApiEnderecoNome = "webServiceGetEnderecamento" | "webServiceGetOcupacaoProduto";

type ProgressoApiEnderecamento = {
  funcao: ApiEnderecoNome;
  paginasConcluidas: number;
  totalPaginas: number | null;
  tempoDecorridoMs: number;
};

export type ProgressoEnderecamentoWms = {
  requestId: string;
  concluido: boolean;
  apis: ProgressoApiEnderecamento[];
};

export type TempoApiEnderecamento = {
  funcao: ApiEnderecoNome;
  paginas: number;
  duracaoMs: number;
};

export type OcupacoesDepositoWms = {
  depositos: ResumoDeposito[];
  depositosPorPosicao: Record<string, DepositoEndereco[]>;
  itensPorPosicao: Record<string, ItemEnderecoArmazem[]>;
  codigoPosicaoPorPosicao: Record<string, string>;
  produtosComMultiplosEnderecos: number | null;
  tempoApi: TempoApiEnderecamento;
};

export type EnderecamentoWms = {
  totalPosicoes: number;
  posicoesOcupadas: number;
  posicoesVazias: number;
  posicoesAtivas: number;
  posicoesDesativadas: number;
  ocupacaoItensCarregada: boolean;
  quantidadeOcupacoesProduto: number;
  percentualOcupacao: number;
  ocupacaoPorSetor?: OcupacaoPorSetor[];
  statusPosicoes: ResumoStatusPosicao[];
  mapaCalor: OcupacaoPorRua[];
  enderecos: EnderecoArmazem[];
  depositos?: ResumoDeposito[];
  produtosComMultiplosEnderecos?: number | null;
  itensPorPosicao?: Record<string, ItemEnderecoArmazem[]>;
  temposApi: TempoApiEnderecamento[];
  atualizadoEm: string;
};

const progressoEnderecamentoPorRequisicao = new Map<string, ProgressoEnderecamentoWms>();
const CONSULTA_ENDERECAMENTO_REQUEST_SCHEMA = z.object({
  requestId: z.string().uuid(),
});
const CONSULTA_ITENS_ENDERECO_SCHEMA = z.object({
  posicaoId: z.string().trim().min(1).max(255),
  codigoPosicao: z.string().trim().min(1).max(255).optional(),
});

function salvarProgressoEnderecamento(progresso: ProgressoEnderecamentoWms): void {
  progressoEnderecamentoPorRequisicao.set(progresso.requestId, progresso);
}

function atualizarProgressoApiEnderecamento(
  requestId: string,
  funcao: ApiEnderecoNome,
  atualizacao: Partial<ProgressoApiEnderecamento>,
): void {
  const progresso = progressoEnderecamentoPorRequisicao.get(requestId);
  if (!progresso) return;
  const apis = progresso.apis.map((api) =>
    api.funcao === funcao ? { ...api, ...atualizacao } : api,
  );
  salvarProgressoEnderecamento({
    ...progresso,
    concluido: apis.every(
      (api) => api.totalPaginas !== null && api.paginasConcluidas >= api.totalPaginas,
    ),
    apis,
  });
}

type ProdutoOrdemEship = {
  quantidade?: number | string;
  produto?: {
    id?: number | string;
    codigo?: string;
    descricao?: string;
    idTipo?: number | string;
    tipo?: {
      id?: number | string;
    };
  };
};

type ProdutoMaisSaidas = {
  statusId: string;
  id: string;
  codigo: string;
  descricao: string;
  categoria: "peca" | "produto" | "outro";
  quantidade: number;
  pedidos: number;
};

function normalizarChavePaginacao(chave: string): string {
  return chave.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizarDataHora(dataHora?: DataHoraEship): string | undefined {
  if (typeof dataHora === "string") return dataHora;
  if (dataHora && typeof dataHora.date === "string") return dataHora.date;
  return undefined;
}

function obterNumeroPaginacao(
  paginacao: Record<string, unknown> | undefined,
  chaves: string[],
): number | undefined {
  if (!paginacao) return undefined;

  for (const [chave, valor] of Object.entries(paginacao)) {
    if (!chaves.includes(normalizarChavePaginacao(chave))) continue;
    const numero = typeof valor === "number" ? valor : Number(valor);
    if (Number.isSafeInteger(numero) && numero >= 0) return numero;
  }
  return undefined;
}

function obterTotalPaginas(
  paginacao: Record<string, unknown> | undefined,
  quantidadePorPagina: number,
): number | undefined {
  const totalPaginas = obterNumeroPaginacao(paginacao, [
    "totalpaginas",
    "quantidadepaginas",
    "numeropaginas",
    "quantidadedepaginas",
    "totalpages",
  ]);
  if (totalPaginas !== undefined) return totalPaginas;

  const totalRegistros = obterNumeroPaginacao(paginacao, [
    "totalregistros",
    "quantidadetotalregistros",
    "totalrecords",
  ]);
  if (totalRegistros === undefined) return undefined;
  return Math.ceil(totalRegistros / quantidadePorPagina);
}

async function consultarPaginasEship<T>(
  consulta: ConsultaEship,
  funcao: string,
  concorrencia = 1,
  aoConcluirPagina?: (paginasConcluidas: number, totalPaginas: number | null) => void,
  timeoutMs = TIMEOUT_REQUISICAO_ESHIP_MS,
  limitePaginas?: number,
): Promise<T[]> {
  const apiKey = process.env["API_KEY"]?.trim() || process.env["ESHIP_API_KEY"]?.trim();
  if (!apiKey) throw new Error("API_KEY não configurada no servidor");

  const parametrosBase = new URLSearchParams({ api: apiKey });
  parametrosBase.set("funcao", funcao);
  for (const [nome, valor] of Object.entries(consulta.parametros)) {
    if (valor.trim()) parametrosBase.set(nome, valor.trim());
  }

  const quantidadePorPaginaConfigurada = Number.parseInt(
    parametrosBase.get("quantidadeRegistros") ?? "",
    10,
  );
  const quantidadePorPagina =
    Number.isSafeInteger(quantidadePorPaginaConfigurada) && quantidadePorPaginaConfigurada > 0
      ? quantidadePorPaginaConfigurada
      : 100;
  const consultarPaginaUmaVez = async (
    pagina: number,
  ): Promise<{ dados: T[]; paginacao?: Record<string, unknown> }> => {
    const parametros = new URLSearchParams(parametrosBase);
    parametros.set("pagina", String(pagina));
    parametros.set("quantidadeRegistros", String(quantidadePorPagina));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`https://branco.eship.com.br/v3/?${parametros}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new FalhaPaginaEship("Tempo esgotado na comunicação com a API E-SHIP", true);
      }
      throw new FalhaPaginaEship("Falha na comunicação com a API E-SHIP", true);
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      const retentavel =
        res.status === 408 || res.status === 425 || res.status === 429 || res.status >= 500;
      throw new FalhaPaginaEship(
        `Falha na comunicação com a API WMS (HTTP ${res.status})`,
        retentavel,
      );
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("json")) {
      throw new FalhaPaginaEship("A API E-SHIP não retornou JSON", true);
    }

    let json: RespostaPaginaEship<T>;
    try {
      json = (await res.json()) as RespostaPaginaEship<T>;
    } catch {
      throw new FalhaPaginaEship("A API E-SHIP retornou um JSON inválido", true);
    }
    const body = json?.corpo?.body;
    if (!Array.isArray(body?.dados)) {
      throw new FalhaPaginaEship("A API E-SHIP retornou uma lista de dados inválida", true);
    }

    return { dados: body.dados, paginacao: body.dadosPaginacao };
  };
  const consultarPagina = async (
    pagina: number,
  ): Promise<{ dados: T[]; paginacao?: Record<string, unknown> }> => {
    for (let tentativa = 1; ; tentativa += 1) {
      try {
        return await consultarPaginaUmaVez(pagina);
      } catch (error) {
        const retentavel = !(error instanceof FalhaPaginaEship) || error.retentavel;
        if (!retentavel || tentativa >= MAX_TENTATIVAS_POR_PAGINA) {
          console.error("Falha definitiva ao consultar página da E-SHIP", {
            funcao,
            pagina,
            tentativas: tentativa,
          });
          throw error;
        }
        const atrasoMs = ATRASO_BASE_RETENTATIVA_MS * 2 ** (tentativa - 1);
        console.warn("Falha temporária ao consultar página da E-SHIP; tentando novamente", {
          funcao,
          pagina,
          tentativa: tentativa + 1,
          maxTentativas: MAX_TENTATIVAS_POR_PAGINA,
          atrasoMs,
        });
        await new Promise<void>((resolve) => setTimeout(resolve, atrasoMs));
      }
    }
  };

  const primeiraPagina = await consultarPagina(1);
  const dadosCompletos = [...primeiraPagina.dados];
  const totalPaginas = obterTotalPaginas(primeiraPagina.paginacao, quantidadePorPagina);
  let paginasConcluidas = 1;
  aoConcluirPagina?.(paginasConcluidas, totalPaginas ?? null);
  if (limitePaginas !== undefined && totalPaginas !== undefined && totalPaginas > limitePaginas) {
    throw new Error("A busca do endereço retornou páginas demais; o filtro não foi aplicado.");
  }

  if (totalPaginas === undefined) {
    let pagina = 2;
    let quantidadeAnterior = primeiraPagina.dados.length;
    while (quantidadeAnterior >= quantidadePorPagina) {
      if (limitePaginas !== undefined && paginasConcluidas >= limitePaginas) {
        throw new Error("A busca do endereço não foi limitada pela API.");
      }
      const resultado = await consultarPagina(pagina);
      quantidadeAnterior = resultado.dados.length;
      dadosCompletos.push(...resultado.dados);
      paginasConcluidas += 1;
      aoConcluirPagina?.(paginasConcluidas, null);
      pagina += 1;
    }
    aoConcluirPagina?.(paginasConcluidas, paginasConcluidas);
    return dadosCompletos;
  }

  const paginasParalelas = Math.max(1, Math.min(10, Math.floor(concorrencia)));
  for (let paginaInicial = 2; paginaInicial <= totalPaginas; paginaInicial += paginasParalelas) {
    const numerosPagina = Array.from(
      { length: Math.min(paginasParalelas, totalPaginas - paginaInicial + 1) },
      (_, indice) => paginaInicial + indice,
    );
    const resultados = await Promise.all(
      numerosPagina.map(async (numeroPagina) => {
        const resultado = await consultarPagina(numeroPagina);
        paginasConcluidas += 1;
        aoConcluirPagina?.(paginasConcluidas, totalPaginas);
        return resultado;
      }),
    );
    for (const resultado of resultados) {
      dadosCompletos.push(...resultado.dados);
    }
  }

  return dadosCompletos;
}

async function consultarApiEnderecamentoComTempo<T>(
  requestId: string,
  consulta: ConsultaEship,
  funcao: ApiEnderecoNome,
): Promise<{ dados: T[]; tempo: TempoApiEnderecamento }> {
  const iniciadoEm = Date.now();
  const dados = await consultarPaginasEship<T>(
    consulta,
    funcao,
    CONCORRENCIA_ENDERECAMENTO,
    (paginasConcluidas, totalPaginas) =>
      atualizarProgressoApiEnderecamento(requestId, funcao, {
        paginasConcluidas,
        totalPaginas,
        tempoDecorridoMs: Date.now() - iniciadoEm,
      }),
    TIMEOUT_ENDERECAMENTO_ESHIP_MS,
  );
  const progressoApi = progressoEnderecamentoPorRequisicao
    .get(requestId)
    ?.apis.find((api) => api.funcao === funcao);
  if (!progressoApi) throw new Error(`Não foi possível obter o progresso de ${funcao}`);

  return {
    dados,
    tempo: {
      funcao,
      paginas: progressoApi.totalPaginas ?? progressoApi.paginasConcluidas,
      duracaoMs: Date.now() - iniciadoEm,
    },
  };
}

async function consultarEship(consulta: ConsultaEship): Promise<{ ordens: OrdemWMS[] }> {
  const dados = await consultarPaginasEship<OrdemEship>(consulta, consulta.funcao);
  return {
    ordens: dados.map((o) => {
      const dataHora = normalizarDataHora(o.dataHora);
      return {
        ordem: o.ordem,
        codigo: o.codigo,
        ...(dataHora ? { dataHora } : {}),
        infosAdicionais: o.infosAdicionais
          ? {
              valordaordem: o.infosAdicionais.valordaordem,
              valorfrete: o.infosAdicionais.valorfrete,
              fila: o.infosAdicionais.fila,
            }
          : undefined,
      };
    }),
  };
}

type StatusPedido = {
  id: string;
  nome: string;
  quantidade: number;
  valor: number;
};

type EvolucaoOrdem = {
  data: string;
  rotulo: string;
  quantidade: number;
  valor: number;
};

type OcupacaoProdutoEship = {
  idPosicao?: number | string;
  idDeposito?: number | string;
  idProduto?: number | string;
  codigoProduto?: string;
  codigoItem?: string;
  codigoBarrasProduto?: string;
  descricaoProduto?: string;
  quantidade?: number | string;
  saldo?: number | string;
  saldoProduto?: number | string;
  saldoItensProduto?: number | string;
  deposito?: {
    id?: number | string;
    descricao?: string;
    idArmazem?: number | string;
  };
  produto?: {
    id?: number | string;
    codigo?: string;
    descricao?: string;
    idTipo?: number | string;
    codigoBarras?: string;
  };
  status?: {
    descricao?: string;
  };
  posicao?: {
    id?: number | string;
    codigo?: string;
    enderecoFormatado?: string;
  };
};

type ReabastecimentoPorSetor = {
  setor: string;
  peca: number;
  produto: number;
};

function obterStatusOrdem(ordem: OrdemDetalhadaEship): { id: string; nome?: string } | undefined {
  const status = ordem.status ?? ordem.ordem?.status;
  const id = status?.id ?? ordem.idStatus ?? ordem.ordem?.idStatus;
  if (id === undefined || id === null || String(id).trim() === "") return undefined;
  return {
    id: String(id),
    ...(status?.descricao ? { nome: status.descricao } : {}),
  };
}

function obterEstadoDestinatario(
  ordem: OrdemDetalhadaEship,
): NonNullable<OrdemWMS["estadoDestinatario"]> | undefined {
  const estado =
    ordem.enderecoDestinatario?.municipio?.estado ??
    ordem.ordem?.enderecoDestinatario?.municipio?.estado;
  const uf = estado?.sigla?.trim().toUpperCase();
  const nome = estado?.descricao?.trim();
  if (!uf || !nome) return undefined;
  return { uf, nome };
}

function obterDiaHojeFortaleza(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const data = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${data["year"]}-${data["month"]}-${data["day"]}`;
}

function obterIntervaloHojeFortaleza(): { inicio: string; fim: string } {
  const dia = obterDiaHojeFortaleza();
  return { inicio: `${dia} 00:00:00`, fim: `${dia} 23:59:59` };
}

function obterUltimosSeteDiasFortaleza(): EvolucaoOrdem[] {
  const hoje = obterDiaHojeFortaleza();
  const [ano, mes, dia] = hoje.split("-").map(Number);
  return Array.from({ length: 7 }, (_, indice) => {
    const data = new Date(Date.UTC(ano!, mes! - 1, dia! - 6 + indice));
    const chave = data.toISOString().slice(0, 10);
    return {
      data: chave,
      rotulo: new Intl.DateTimeFormat("pt-BR", {
        timeZone: "UTC",
        day: "2-digit",
        month: "2-digit",
      }).format(data),
      quantidade: 0,
      valor: 0,
    };
  });
}

async function consultarDashboard(consulta: ConsultaEship): Promise<{
  ordens: OrdemWMS[];
  statusPedidos: StatusPedido[];
  evolucaoOrdens: EvolucaoOrdem[];
  reabastecimentoPorSetor: ReabastecimentoPorSetor[];
  rankingProdutos: ProdutoMaisSaidas[];
  quantidadeCanceladasHoje: number;
  valorCanceladasHoje: number;
}> {
  const parametroStatus = consulta.parametros["statusOrdem"]?.trim();
  const statusSelecionados = parametroStatus
    ? new Set(parametroStatus.match(/\d+/g) ?? [])
    : new Set(STATUS_ORDEM_OPERACIONAIS.map(({ id }) => id));
  const status = STATUS_ORDEM.filter(({ id }) => statusSelecionados.has(id));
  if (status.length === 0) {
    return {
      ordens: [],
      statusPedidos: [],
      evolucaoOrdens: obterUltimosSeteDiasFortaleza(),
      reabastecimentoPorSetor: [],
      rankingProdutos: [],
      quantidadeCanceladasHoje: 0,
      valorCanceladasHoje: 0,
    };
  }

  const consultaDashboard: ConsultaEship = {
    ...consulta,
    parametros: {
      ...consulta.parametros,
      ["armazem"]: ARMAZEM_BRANCO01_ID,
      ["statusOrdem"]: `[${status.map(({ id }) => id).join(",")}]`,
      ["tipoOrdem"]:
        consulta.parametros["tipoOrdem"] ?? `[${TIPOS_ORDEM_PADRAO_DASHBOARD.join(",")}]`,
    },
  };
  const incrementarConfigurado = consultaDashboard.parametros["incrementar"]?.match(/\d+/g) ?? [];
  const consultaDetalhada: ConsultaEship = {
    ...consultaDashboard,
    parametros: {
      ...consultaDashboard.parametros,
      ["incrementar"]: `[${[...new Set([...incrementarConfigurado, "75", "80", "91"])].join(",")}]`,
    },
  };
  const intervaloHoje = obterIntervaloHojeFortaleza();
  const consultaCanceladasHoje: ConsultaEship = {
    ...consultaDashboard,
    parametros: {
      ...consultaDashboard.parametros,
      ["statusOrdem"]: "[10]",
      ["dataHoraInicialAtualizacao"]: intervaloHoje.inicio,
      ["dataHoraFinalAtualizacao"]: intervaloHoje.fim,
    },
  };
  const consultaOcupacao: ConsultaEship = {
    funcao: "webServiceGetOcupacaoProduto",
    parametros: {
      ["armazem"]: ARMAZEM_BRANCO01_ID,
      ["statusOcupacao"]: "[3]",
    },
  };
  const [resultadoInfos, ordensDetalhadas, resultadoCanceladasHoje, ocupacoesProduto] =
    await Promise.all([
      consultarEship(consultaDashboard),
      consultarPaginasEship<OrdemDetalhadaEship>(consultaDetalhada, "webServiceGetOrdem"),
      consultarEship(consultaCanceladasHoje),
      consultarPaginasEship<OcupacaoProdutoEship>(consultaOcupacao, "webServiceGetOcupacaoProduto"),
    ]);
  const posicoesPorSetor = new Map<string, { peca: Set<string>; produto: Set<string> }>();
  for (const ocupacao of ocupacoesProduto) {
    if (ocupacao.status?.descricao?.trim() !== "Bloqueada") continue;
    const endereco = ocupacao.posicao?.enderecoFormatado?.trim();
    const setor = endereco?.split("-")[0]?.trim().toUpperCase();
    if (!setor) continue;
    const tipoProduto = String(ocupacao.produto?.idTipo ?? "");
    if (tipoProduto !== "8" && tipoProduto !== "7") continue;
    const identificador = ocupacao.idPosicao ?? ocupacao.posicao?.id ?? endereco.toUpperCase();
    const posicoes = posicoesPorSetor.get(setor) ?? {
      peca: new Set<string>(),
      produto: new Set<string>(),
    };
    posicoes[tipoProduto === "8" ? "peca" : "produto"].add(String(identificador));
    posicoesPorSetor.set(setor, posicoes);
  }
  const reabastecimentoPorSetor = [...posicoesPorSetor]
    .map(([setor, posicoes]) => ({
      setor,
      peca: posicoes.peca.size,
      produto: posicoes.produto.size,
    }))
    .sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR", { numeric: true }));
  const ordensUnicas = [
    ...new Map(resultadoInfos.ordens.map((ordem) => [String(ordem.ordem), ordem])).values(),
  ];
  const ordensComValor = ordensUnicas.filter((ordem) =>
    Boolean(ordem.infosAdicionais?.valordaordem?.trim()),
  );
  const ordensCanceladasHoje = [
    ...new Map(
      resultadoCanceladasHoje.ordens
        .filter((ordem) => Boolean(ordem.infosAdicionais?.valordaordem?.trim()))
        .map((ordem) => [String(ordem.ordem), ordem]),
    ).values(),
  ];
  const valorCanceladasHoje = ordensCanceladasHoje.reduce(
    (total, ordem) => total + paraNumero(ordem.infosAdicionais?.valordaordem),
    0,
  );
  const quantidadeCanceladasHoje = ordensCanceladasHoje.length;

  const statusPorOrdem = new Map<string, { id: string; nome?: string }>();
  const dataHoraPorOrdem = new Map<string, string>();
  const estadoDestinatarioPorOrdem = new Map<string, NonNullable<OrdemWMS["estadoDestinatario"]>>();
  const contagemPorStatus = new Map<string, number>();
  const nomePorStatus = new Map(status.map(({ id, descricao }) => [id, descricao]));
  const produtosPorStatus = new Map<
    string,
    Map<string, Omit<ProdutoMaisSaidas, "statusId" | "pedidos"> & { ordens: Set<string> }>
  >();
  for (const ordem of ordensDetalhadas) {
    const identificador = ordem.id ?? ordem.ordem?.id;
    const statusOrdem = obterStatusOrdem(ordem);
    if (identificador === undefined || !statusOrdem || !statusSelecionados.has(statusOrdem.id))
      continue;
    statusPorOrdem.set(String(identificador), statusOrdem);
    const dataHora = normalizarDataHora(ordem.dataHora ?? ordem.ordem?.dataHora);
    if (dataHora) dataHoraPorOrdem.set(String(identificador), dataHora);
    const estadoDestinatario = obterEstadoDestinatario(ordem);
    if (estadoDestinatario) {
      estadoDestinatarioPorOrdem.set(String(identificador), estadoDestinatario);
    }
    if (statusOrdem.nome) nomePorStatus.set(statusOrdem.id, statusOrdem.nome);

    const produtos = ordem.produtosOrdem ?? ordem.ordem?.produtosOrdem ?? [];
    for (const item of produtos) {
      const produto = item.produto;
      const idProduto = produto?.id ?? produto?.codigo;
      const tipoProduto = String(produto?.idTipo ?? produto?.tipo?.id ?? "");
      const categoria: ProdutoMaisSaidas["categoria"] =
        tipoProduto === "8" ? "peca" : tipoProduto === "7" ? "produto" : "outro";
      const quantidade =
        typeof item.quantidade === "number" ? item.quantidade : paraNumero(item.quantidade);
      if (!idProduto || !Number.isFinite(quantidade) || quantidade <= 0) continue;

      const produtosDoStatus = produtosPorStatus.get(statusOrdem.id) ?? new Map();
      const chaveProduto = String(idProduto);
      const agregado = produtosDoStatus.get(chaveProduto) ?? {
        id: chaveProduto,
        codigo: produto?.codigo?.trim() || chaveProduto,
        descricao: produto?.descricao?.trim() || "Produto sem descrição",
        categoria,
        quantidade: 0,
        ordens: new Set<string>(),
      };
      agregado.quantidade += quantidade;
      agregado.ordens.add(String(identificador));
      produtosDoStatus.set(chaveProduto, agregado);
      produtosPorStatus.set(statusOrdem.id, produtosDoStatus);
    }
  }
  const rankingProdutos: ProdutoMaisSaidas[] = [...produtosPorStatus].flatMap(
    ([statusId, produtos]) =>
      [...produtos.values()]
        .map(({ ordens, ...produto }) => ({
          ...produto,
          statusId,
          pedidos: ordens.size,
        }))
        .sort((a, b) => b.quantidade - a.quantidade || a.codigo.localeCompare(b.codigo, "pt-BR")),
  );

  for (const ordem of ordensComValor) {
    const statusOrdem = statusPorOrdem.get(String(ordem.ordem));
    if (!statusOrdem) continue;
    contagemPorStatus.set(statusOrdem.id, (contagemPorStatus.get(statusOrdem.id) ?? 0) + 1);
  }

  const valorPorStatus = new Map<string, number>();
  for (const ordem of ordensComValor) {
    const identificador = String(ordem.ordem);
    const statusOrdem = statusPorOrdem.get(identificador);
    if (statusOrdem) {
      valorPorStatus.set(
        statusOrdem.id,
        (valorPorStatus.get(statusOrdem.id) ?? 0) + paraNumero(ordem.infosAdicionais?.valordaordem),
      );
    }
  }

  const ordensSemStatus = ordensComValor.filter(
    (ordem) => !statusPorOrdem.has(String(ordem.ordem)),
  );
  if (ordensSemStatus.length > 0) {
    console.error("E-SHIP não retornou status para todas as ordens", ordensSemStatus.length);
    throw new Error("A API E-SHIP não retornou status para todas as ordens consultadas");
  }

  const ordensComStatus = ordensComValor.map((ordem) => {
    const identificador = String(ordem.ordem);
    const statusOrdem = statusPorOrdem.get(identificador);
    const dataHora = dataHoraPorOrdem.get(identificador) ?? ordem.dataHora;
    const estadoDestinatario = estadoDestinatarioPorOrdem.get(identificador);
    return {
      ...ordem,
      ...(dataHora ? { dataHora } : {}),
      ...(statusOrdem ? { statusId: statusOrdem.id } : {}),
      ...(estadoDestinatario ? { estadoDestinatario } : {}),
    };
  });

  return {
    ordens: ordensComStatus,
    statusPedidos: status.map(({ id, descricao }) => ({
      id,
      nome: nomePorStatus.get(id) ?? descricao,
      quantidade: contagemPorStatus.get(id) ?? 0,
      valor: valorPorStatus.get(id) ?? 0,
    })),
    evolucaoOrdens: obterUltimosSeteDiasFortaleza(),
    reabastecimentoPorSetor,
    rankingProdutos,
    quantidadeCanceladasHoje,
    valorCanceladasHoje,
  };
}

async function consultarDadosEvolucaoOrdens(consulta: ConsultaEship): Promise<EvolucaoOrdem[]> {
  const parametrosEvolucao = {
    ["incluirInfo"]: "true",
    ["armazem"]: ARMAZEM_BRANCO01_ID,
    ["statusOrdem"]: "[1,2,3,4,5,6,7,8]",
    ["tipoOrdem"]:
      consulta.parametros["tipoOrdem"] ?? `[${TIPOS_ORDEM_PADRAO_DASHBOARD.join(",")}]`,
    ["periodoLancamento"]: "7",
  };
  const consultaDatasEvolucao: ConsultaEship = {
    funcao: "webServiceGetOrdem",
    parametros: { ...parametrosEvolucao, ["incrementar"]: "[75]" },
  };
  const consultaValoresEvolucao: ConsultaEship = {
    funcao: "webServiceGetInfosOrdem",
    parametros: parametrosEvolucao,
  };
  const [ordens, infosOrdens] = await Promise.all([
    consultarPaginasEship<OrdemDetalhadaEship>(consultaDatasEvolucao, "webServiceGetOrdem"),
    consultarPaginasEship<InfoOrdemEship>(consultaValoresEvolucao, "webServiceGetInfosOrdem"),
  ]);
  const valoresPorOrdem = new Map<string, number>();
  for (const info of infosOrdens) {
    if (info.ordem === undefined || info.ordem === null) continue;
    const valorInformado = info.infosAdicionais?.valordaordem;
    if (valorInformado === undefined || String(valorInformado).trim() === "") continue;
    const valor = typeof valorInformado === "number" ? valorInformado : paraNumero(valorInformado);
    if (Number.isFinite(valor)) valoresPorOrdem.set(String(info.ordem), valor);
  }

  const evolucaoOrdens = obterUltimosSeteDiasFortaleza();
  const diasEvolucao = new Map(evolucaoOrdens.map((dia) => [dia.data, dia]));
  const ordensUnicas = [
    ...new Map(ordens.map((ordem, indice) => [String(ordem.id ?? indice), ordem])).values(),
  ];

  for (const ordem of ordensUnicas) {
    const dataHora = normalizarDataHora(ordem.dataHora);
    const data = dataHora?.match(/^(\d{4}-\d{2}-\d{2})\s/)?.[1];
    if (!data) continue;
    const dia = diasEvolucao.get(data);
    if (!dia) continue;
    dia.quantidade += 1;
    const valor = valoresPorOrdem.get(String(ordem.id));
    if (valor !== undefined) dia.valor += valor;
  }

  return evolucaoOrdens;
}

async function consultarEnderecamentoPosicoes(requestId: string): Promise<EnderecamentoWms> {
  const consulta: ConsultaEship = {
    funcao: "webServiceGetEnderecamento",
    parametros: {
      ["armazem"]: ARMAZEM_BRANCO01_ID,
      ["pagina"]: "1",
      ["quantidadeRegistros"]: "100",
      ["ordenacao"]: "1",
    },
  };
  const { dados: posicoes, tempo } = await consultarApiEnderecamentoComTempo<EnderecamentoEship>(
    requestId,
    consulta,
    "webServiceGetEnderecamento",
  );
  const statusNomes: Record<string, string> = {
    "1": "Normal",
    "2": "Inconsistente",
    "3": "Em conferência",
    "4": "Desativada",
    "10": "Bloqueada",
    "11": "Bloqueada para inserção",
    "12": "Bloqueada para retirada",
    "13": "Bloqueada por requisição",
    "14": "Bloqueada por remessa",
    "15": "Bloqueada por erro de conferência",
    "16": "Bloqueada para inventário",
    "17": "Bloqueada por separação",
    "18": "Bloqueada por emissão",
    "19": "Bloqueada para retirada por movimentação",
  };
  const setores: Record<string, string> = {
    "1": "A",
    "2": "B",
    "3": "C",
    "4": "D",
    "9": "F",
    "10": "E",
    "7": "P",
    "11": "T",
  };
  const statusContagem = new Map<string, number>();
  const mapaRua = new Map<string, OcupacaoPorRua>();
  const mapaSetor = new Map<string, OcupacaoPorSetor>();
  const enderecos: EnderecoArmazem[] = [];
  let posicoesAtivas = 0;
  let posicoesDesativadas = 0;

  for (const item of posicoes) {
    const posicao = item.posicao;
    if (!posicao) continue;
    const setorId = String(posicao.idSetor ?? "");
    const setor = setores[setorId] ?? (setorId ? `Setor ${setorId}` : "Sem setor");
    const rua = posicao.rua?.descricao?.trim() || "Sem rua";
    const modulo = posicao.modulo?.descricao?.trim() || "Sem módulo";
    const prateleira = String(posicao.prateleira ?? "—");
    const indice = String(posicao.indice ?? "—");
    const sufixo = posicao.sufixo?.trim() ?? "";
    const statusId = String(posicao.idStatus ?? "");
    const chaveStatus = statusId || "desconhecido";

    if (statusId === "1") posicoesAtivas += 1;
    if (statusId === "4") posicoesDesativadas += 1;
    statusContagem.set(chaveStatus, (statusContagem.get(chaveStatus) ?? 0) + 1);

    const chaveRua = `${setor}|${rua}`;
    const resumoRua = mapaRua.get(chaveRua) ?? {
      setor,
      rua,
      total: 0,
      ocupadas: 0,
      percentual: 0,
    };
    resumoRua.total += 1;
    mapaRua.set(chaveRua, resumoRua);

    const resumoSetor = mapaSetor.get(setor) ?? {
      setor,
      total: 0,
      ocupadas: 0,
      percentual: 0,
    };
    resumoSetor.total += 1;
    mapaSetor.set(setor, resumoSetor);

    enderecos.push({
      id: String(posicao.id ?? `${setor}|${rua}|${modulo}|${posicao.prateleira}|${posicao.indice}`),
      codigoPosicao: posicao.codigoPosicao?.trim() || posicao.codigo?.trim() || null,
      descricaoCompleta:
        item.descricao?.trim() ||
        [setor, rua, modulo, prateleira, `${indice}${sufixo}`].join(" - "),
      setor,
      rua,
      modulo,
      prateleira,
      posicao: indice,
      sufixo,
      statusId: chaveStatus,
      tipoPosicaoId: String(posicao.idTipo ?? ""),
      tipoOcupacaoId: String(posicao.idTipoOcupacao ?? ""),
      ocupacoesProduto: 0,
      depositos: [],
    });
  }

  for (const resumoRua of mapaRua.values()) {
    resumoRua.percentual =
      resumoRua.total === 0 ? 0 : Math.round((resumoRua.ocupadas / resumoRua.total) * 100);
  }
  for (const resumoSetor of mapaSetor.values()) {
    resumoSetor.percentual =
      resumoSetor.total === 0 ? 0 : Math.round((resumoSetor.ocupadas / resumoSetor.total) * 100);
  }
  enderecos.sort(
    (a, b) =>
      a.setor.localeCompare(b.setor, "pt-BR", { numeric: true }) ||
      a.rua.localeCompare(b.rua, "pt-BR", { numeric: true }) ||
      a.modulo.localeCompare(b.modulo, "pt-BR", { numeric: true }) ||
      a.prateleira.localeCompare(b.prateleira, "pt-BR", { numeric: true }) ||
      a.posicao.localeCompare(b.posicao, "pt-BR", { numeric: true }),
  );
  const totalPosicoes = enderecos.length;

  return {
    totalPosicoes,
    posicoesOcupadas: 0,
    posicoesVazias: totalPosicoes,
    posicoesAtivas,
    posicoesDesativadas,
    ocupacaoItensCarregada: false,
    quantidadeOcupacoesProduto: 0,
    percentualOcupacao: 0,
    ocupacaoPorSetor: [...mapaSetor.values()].sort((a, b) =>
      a.setor.localeCompare(b.setor, "pt-BR", { numeric: true }),
    ),
    statusPosicoes: [...statusContagem]
      .map(([id, quantidade]) => ({
        id,
        nome: statusNomes[id] ?? "Outro status",
        quantidade,
      }))
      .sort((a, b) => b.quantidade - a.quantidade),
    mapaCalor: [...mapaRua.values()].sort(
      (a, b) =>
        a.setor.localeCompare(b.setor, "pt-BR", { numeric: true }) ||
        a.rua.localeCompare(b.rua, "pt-BR", { numeric: true }),
    ),
    enderecos,
    depositos: [],
    temposApi: [tempo],
    atualizadoEm: new Date().toISOString(),
  };
}

async function consultarOcupacoesDeposito(requestId: string): Promise<OcupacoesDepositoWms> {
  const consulta: ConsultaEship = {
    funcao: "webServiceGetOcupacaoProduto",
    parametros: {
      ["armazem"]: ARMAZEM_BRANCO01_ID,
      ["pagina"]: "1",
      ["quantidadeRegistros"]: "100",
      ["ordenacao"]: "1",
    },
  };
  const { dados: ocupacoes, tempo } = await consultarApiEnderecamentoComTempo<OcupacaoProdutoEship>(
    requestId,
    consulta,
    "webServiceGetOcupacaoProduto",
  );
  const depositosPorPosicao = new Map<string, Map<string, DepositoEndereco>>();
  const itensPorPosicao = new Map<string, Map<string, ItemEnderecoArmazem>>();
  const codigoPosicaoPorPosicao = new Map<string, string>();
  const posicoesPorProduto = new Map<string, Set<string>>();
  const resumoPorDeposito = new Map<
    string,
    { deposito: DepositoEndereco; posicoes: Set<string>; quantidadeProdutos: number }
  >();
  for (const ocupacao of ocupacoes) {
    const depositoIdInformado = ocupacao.deposito?.id ?? ocupacao.idDeposito;
    const armazemId = ocupacao.deposito?.idArmazem;
    if (armazemId !== undefined && String(armazemId) !== ARMAZEM_BRANCO01_ID) {
      continue;
    }

    const posicaoId = String(ocupacao.idPosicao ?? ocupacao.posicao?.id ?? "");
    const nome = ocupacao.deposito?.descricao?.trim();
    if (!posicaoId) continue;
    if (ocupacao.posicao?.codigo?.trim()) {
      codigoPosicaoPorPosicao.set(posicaoId, ocupacao.posicao.codigo.trim());
    }
    const produtoId =
      ocupacao.idProduto ??
      ocupacao.produto?.id ??
      ocupacao.codigoProduto ??
      ocupacao.codigoItem ??
      ocupacao.produto?.codigo;
    const codigo =
      ocupacao.codigoItem ??
      ocupacao.codigoProduto ??
      ocupacao.produto?.codigo ??
      ocupacao.codigoBarrasProduto ??
      ocupacao.produto?.codigoBarras ??
      (produtoId === undefined ? "" : String(produtoId));
    if (produtoId !== undefined && String(produtoId).trim()) {
      const chaveProduto = String(produtoId);
      const posicoesProduto = posicoesPorProduto.get(chaveProduto) ?? new Set<string>();
      posicoesProduto.add(posicaoId);
      posicoesPorProduto.set(chaveProduto, posicoesProduto);
    }

    if (produtoId !== undefined || codigo) {
      const itensDaPosicao = itensPorPosicao.get(posicaoId) ?? new Map();
      const chaveItem = `${String(produtoId ?? codigo)}|${String(depositoIdInformado ?? "")}`;
      const quantidade = Number(ocupacao.quantidade);
      const saldoRaw = ocupacao.saldo ?? ocupacao.saldoProduto ?? ocupacao.saldoItensProduto;
      const saldo = saldoRaw === undefined ? null : Number(saldoRaw);
      const produto = {
        id: String(produtoId ?? codigo),
        codigo: codigo || String(produtoId ?? "—"),
        descricao:
          ocupacao.descricaoProduto?.trim() ||
          ocupacao.produto?.descricao?.trim() ||
          "Descrição não informada pela API",
        quantidade: Number.isFinite(quantidade) ? quantidade : null,
        saldo: saldo !== null && Number.isFinite(saldo) ? saldo : null,
        depositoId: depositoIdInformado === undefined ? null : String(depositoIdInformado),
        depositoNome: nome || null,
      } satisfies ItemEnderecoArmazem;
      const existente = itensDaPosicao.get(chaveItem);
      if (existente) {
        const quantidadeAtualizada =
          existente.quantidade === null || produto.quantidade === null
            ? null
            : existente.quantidade + produto.quantidade;
        itensDaPosicao.set(chaveItem, {
          ...existente,
          quantidade: quantidadeAtualizada,
          saldo:
            existente.saldo === null || produto.saldo === null
              ? null
              : existente.saldo + produto.saldo,
        });
      } else {
        itensDaPosicao.set(chaveItem, produto);
      }
      itensPorPosicao.set(posicaoId, itensDaPosicao);
    }

    if (depositoIdInformado === undefined || !nome) continue;
    const deposito = { id: String(depositoIdInformado), nome };
    const depositosDaPosicao = depositosPorPosicao.get(posicaoId) ?? new Map();
    depositosDaPosicao.set(deposito.id, deposito);
    depositosPorPosicao.set(posicaoId, depositosDaPosicao);

    const resumo = resumoPorDeposito.get(deposito.id) ?? {
      deposito,
      posicoes: new Set<string>(),
      quantidadeProdutos: 0,
    };
    resumo.posicoes.add(posicaoId);
    resumo.quantidadeProdutos += Number(ocupacao.quantidade) || 0;
    resumoPorDeposito.set(deposito.id, resumo);
  }

  return {
    depositos: [...resumoPorDeposito.values()]
      .map(({ deposito, posicoes, quantidadeProdutos }) => ({
        ...deposito,
        posicoes: posicoes.size,
        quantidadeProdutos,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    depositosPorPosicao: Object.fromEntries(
      [...depositosPorPosicao].map(([posicaoId, depositos]) => [
        posicaoId,
        [...depositos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      ]),
    ),
    codigoPosicaoPorPosicao: Object.fromEntries(codigoPosicaoPorPosicao),
    itensPorPosicao: Object.fromEntries(
      [...itensPorPosicao].map(([posicaoId, itens]) => [
        posicaoId,
        [...itens.values()].sort((a, b) =>
          a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }),
        ),
      ]),
    ),
    produtosComMultiplosEnderecos:
      posicoesPorProduto.size > 0
        ? [...posicoesPorProduto.values()].filter((posicoes) => posicoes.size > 1).length
        : null,
    tempoApi: tempo,
  };
}

async function consultarItensEndereco(
  posicaoId: string,
  codigoPosicao?: string,
): Promise<ItemEnderecoArmazem[]> {
  const consultarPorIdentificador = async (
    identificador: string,
    parametro: "idPosicao" | "codigoPosicao",
  ) => {
    const consulta: ConsultaEship = {
      funcao: "webServiceGetOcupacaoProduto",
      parametros: {
        ["armazem"]: ARMAZEM_BRANCO01_ID,
        [parametro]: identificador,
        ["pagina"]: "1",
        ["quantidadeRegistros"]: "100",
        ["ordenacao"]: "1",
      },
    };
    return consultarPaginasEship<OcupacaoProdutoEship>(
      consulta,
      "webServiceGetOcupacaoProduto",
      1,
      undefined,
      TIMEOUT_REQUISICAO_ESHIP_MS,
      1,
    );
  };
  const correspondeIdentificador = (
    ocupacao: OcupacaoProdutoEship,
    identificador: string | undefined,
  ) =>
    Boolean(identificador?.trim()) &&
    [ocupacao.idPosicao, ocupacao.posicao?.id, ocupacao.posicao?.codigo].some(
      (valor) => String(valor ?? "").trim() === identificador?.trim(),
    );
  const filtrarOcupacoesDaPosicao = (ocupacoes: OcupacaoProdutoEship[]) =>
    ocupacoes.filter(
      (ocupacao) =>
        correspondeIdentificador(ocupacao, posicaoId) ||
        correspondeIdentificador(ocupacao, codigoPosicao),
    );
  let ocupacoes: OcupacaoProdutoEship[] = [];
  let erroConsultaPorId: unknown;
  try {
    ocupacoes = await consultarPorIdentificador(posicaoId, "idPosicao");
  } catch (error) {
    erroConsultaPorId = error;
  }
  let ocupacoesDaPosicao = filtrarOcupacoesDaPosicao(ocupacoes);
  if (
    (erroConsultaPorId !== undefined || ocupacoesDaPosicao.length === 0) &&
    codigoPosicao?.trim() &&
    codigoPosicao.trim() !== posicaoId.trim()
  ) {
    try {
      ocupacoes = await consultarPorIdentificador(codigoPosicao.trim(), "codigoPosicao");
    } catch (error) {
      const erroOriginal =
        erroConsultaPorId instanceof Error ? erroConsultaPorId.message : "falha não identificada";
      const erroAlternativo = error instanceof Error ? error.message : "falha não identificada";
      throw new Error(
        `A consulta do endereço falhou pelo ID (${erroOriginal}) e pelo código PS (${erroAlternativo}).`,
      );
    }
    ocupacoesDaPosicao = filtrarOcupacoesDaPosicao(ocupacoes);
  } else if (erroConsultaPorId !== undefined) {
    throw erroConsultaPorId;
  }

  return ocupacoesDaPosicao.map((ocupacao) => {
    const idProduto =
      ocupacao.idProduto ??
      ocupacao.produto?.id ??
      ocupacao.codigoProduto ??
      ocupacao.codigoItem ??
      ocupacao.produto?.codigo;
    const codigo =
      ocupacao.codigoItem ??
      ocupacao.codigoProduto ??
      ocupacao.produto?.codigo ??
      ocupacao.codigoBarrasProduto ??
      ocupacao.produto?.codigoBarras ??
      (idProduto === undefined ? "—" : String(idProduto));
    const saldoRaw = ocupacao.saldo ?? ocupacao.saldoProduto ?? ocupacao.saldoItensProduto;
    const quantidade = Number(ocupacao.quantidade);
    const saldo = saldoRaw === undefined ? null : Number(saldoRaw);
    return {
      id: String(idProduto ?? codigo),
      codigo,
      descricao:
        ocupacao.descricaoProduto?.trim() ||
        ocupacao.produto?.descricao?.trim() ||
        "Descrição não informada pela API",
      quantidade: Number.isFinite(quantidade) ? quantidade : null,
      saldo: saldo !== null && Number.isFinite(saldo) ? saldo : null,
      depositoId:
        ocupacao.deposito?.id === undefined && ocupacao.idDeposito === undefined
          ? null
          : String(ocupacao.deposito?.id ?? ocupacao.idDeposito),
      depositoNome: ocupacao.deposito?.descricao?.trim() || null,
    };
  });
}

async function consultarIntegracaoDoDia(
  consulta: ConsultaEship,
): Promise<{ quantidadeIntegradasHoje: number; valorIntegradasHoje: number }> {
  const consultaIntegracoes: ConsultaEship = {
    funcao: consulta.funcao,
    parametros: {
      incluirInfo: "true",
      armazem: ARMAZEM_BRANCO01_ID,
      statusOrdem: "[6,5,8,4,7,3,2,1,10]",
      tipoOrdem: "[12,10,20,14,4,13,6,2]",
      periodoLancamento: "10004",
    },
  };
  const resultado = await consultarEship(consultaIntegracoes);
  const ordensIntegradasHoje = [
    ...new Map(resultado.ordens.map((ordem) => [String(ordem.ordem), ordem])).values(),
  ];

  return {
    quantidadeIntegradasHoje: ordensIntegradasHoje.length,
    valorIntegradasHoje: ordensIntegradasHoje.reduce(
      (total, ordem) => total + paraNumero(ordem.infosAdicionais?.valordaordem),
      0,
    ),
  };
}

export const consultarWms = createServerFn({ method: "POST" })
  .validator((data) => ConsultaEshipSchema.parse(data))
  .handler(async ({ data }) => {
    await exigirSessao();
    return consultarEship(data);
  });

export const consultarDashboardWms = createServerFn({ method: "POST" })
  .validator((data) => ConsultaEshipSchema.parse(data))
  .handler(async ({ data }) => {
    await exigirAcessoDashboard();
    return consultarDashboard(data);
  });

export const consultarEvolucaoOrdensWms = createServerFn({ method: "POST" })
  .validator((data) => ConsultaEshipSchema.parse(data))
  .handler(async ({ data }) => {
    await exigirAcessoDashboard();
    return consultarDadosEvolucaoOrdens(data);
  });

function prepararProgressoEnderecamento(requestId: string): void {
  if (progressoEnderecamentoPorRequisicao.has(requestId)) return;
  for (const [id, progresso] of progressoEnderecamentoPorRequisicao) {
    if (progresso.concluido && id !== requestId) progressoEnderecamentoPorRequisicao.delete(id);
  }
  salvarProgressoEnderecamento({
    requestId,
    concluido: false,
    apis: [
      {
        funcao: "webServiceGetEnderecamento",
        paginasConcluidas: 0,
        totalPaginas: null,
        tempoDecorridoMs: 0,
      },
      {
        funcao: "webServiceGetOcupacaoProduto",
        paginasConcluidas: 0,
        totalPaginas: null,
        tempoDecorridoMs: 0,
      },
    ],
  });
}

export const consultarEnderecamentoPosicoesWms = createServerFn({ method: "POST" })
  .validator((data) => CONSULTA_ENDERECAMENTO_REQUEST_SCHEMA.parse(data))
  .handler(async ({ data }) => {
    await exigirSessao();
    prepararProgressoEnderecamento(data.requestId);
    return consultarEnderecamentoPosicoes(data.requestId);
  });

const STATUS_PLANO_INVENTARIO: Record<string, string> = {
  "1": "Gerado",
  "2": "Em contagem",
  "3": "Contagem parada",
  "4": "Aguardando ajuste",
  "5": "Em ajuste",
  "6": "Ajustado",
  "7": "Finalizado",
  "8": "Cancelado",
};

async function consultarPainelInventario(): Promise<PainelInventarioWms> {
  const funcaoPlanos = "webServiceGetPlanoInventario";
  const parametrosBase = {
    incluirInfo: "true",
    statusPlanoInventario: "[1,2,3,4,5]",
    pagina: "1",
    quantidadeRegistros: "100",
    ordenacao: "2",
  };
  const candidatos = await consultarPaginasEship<PlanoInventarioEship>(
    { funcao: funcaoPlanos, parametros: parametrosBase },
    funcaoPlanos,
    1,
    undefined,
    TIMEOUT_REQUISICAO_ESHIP_MS,
    10,
  );
  const maisRecente = candidatos.find(
    (item) =>
      String(item.deposito?.idArmazem ?? "") === ARMAZEM_BRANCO01_ID &&
      item.inventario?.id !== undefined &&
      item.inventario.id !== null,
  );
  if (!maisRecente?.inventario?.id) {
    throw new Error("Não há um plano de inventário em andamento no armazém BRANCO01.");
  }

  const idInventario = String(maisRecente.inventario.id);
  const inventarios = await consultarPaginasEship<InventarioEship>(
    {
      funcao: "webServiceGetInventario",
      parametros: {
        incluirInfo: "true",
        inventario: idInventario,
        pagina: "1",
        quantidadeRegistros: "1",
        ordenacao: "2",
      },
    },
    "webServiceGetInventario",
    1,
    undefined,
    TIMEOUT_REQUISICAO_ESHIP_MS,
  );
  const inventario = inventarios.find(
    (item) =>
      String(item.id ?? "") === idInventario &&
      String(item.armazem?.id ?? "") === ARMAZEM_BRANCO01_ID,
  );
  if (!inventario) {
    throw new Error(`A API webServiceGetInventario não retornou o inventário ${idInventario}.`);
  }

  const planos = (inventario.planos ?? []).filter(
    (item) => String(item.armazem?.id ?? "") === ARMAZEM_BRANCO01_ID,
  );
  if (planos.length === 0) {
    throw new Error(`O inventário ${idInventario} não retornou registros para BRANCO01.`);
  }

  const idsPosicao = [
    ...new Set(
      planos
        .map((item) => item.posicao?.id)
        .filter((id): id is number | string => id !== undefined && id !== null)
        .map(String),
    ),
  ];
  const enderecos = idsPosicao.length
    ? await consultarPaginasEship<EnderecamentoEship>(
        {
          funcao: "webServiceGetEnderecamento",
          parametros: {
            armazem: ARMAZEM_BRANCO01_ID,
            idPosicao: `[${idsPosicao.join(",")}]`,
            pagina: "1",
            quantidadeRegistros: "100",
            ordenacao: "1",
          },
        },
        "webServiceGetEnderecamento",
        1,
        undefined,
        TIMEOUT_REQUISICAO_ESHIP_MS,
        2,
      )
    : [];
  const enderecosPorId = new Map(
    enderecos
      .filter((item) => item.posicao?.id !== undefined && item.posicao.id !== null)
      .map((item) => [String(item.posicao?.id), item]),
  );
  const setores: Record<string, string> = {
    "1": "A",
    "2": "B",
    "3": "C",
    "4": "D",
    "9": "F",
    "10": "E",
    "7": "P",
    "11": "T",
  };
  const itens = planos.map((item, indice): ItemPlanoInventarioWms => {
    const endereco = item.posicao?.id ? enderecosPorId.get(String(item.posicao.id)) : undefined;
    const statusId = String(item.status?.id ?? "");
    const tipoProdutoId = String(item.produto?.idTipo ?? "");
    const codigoProduto = item.produto?.codigo?.trim() || "";
    const idSetor = endereco?.posicao?.idSetor ?? item.posicao?.idSetor;
    return {
      id: String(item.id ?? `${idInventario}-${indice}`),
      tipoRegistro: item.posicao ? "Posição" : "Produto",
      categoriaProduto: item.posicao
        ? null
        : tipoProdutoId === "8"
          ? "Peça"
          : tipoProdutoId === "7"
            ? "Produto"
            : "Outro",
      codigo: item.posicao?.codigo?.trim() || codigoProduto || "—",
      descricaoProduto:
        item.produto?.descricao?.trim() ||
        (item.posicao ? "Contagem por endereço" : "Descrição não informada pela API"),
      enderecoCompleto: endereco?.descricao?.trim() || item.posicao?.codigo?.trim() || null,
      indicePosicao:
        endereco?.posicao?.indice === undefined || endereco.posicao.indice === null
          ? null
          : String(endereco.posicao.indice),
      rua: endereco?.posicao?.rua?.descricao?.trim() || null,
      setor: idSetor ? (setores[String(idSetor)] ?? `Setor ${idSetor}`) : null,
      linkImagem:
        !item.posicao && codigoProduto ? (PRODUCT_IMAGE_LINKS[codigoProduto] ?? null) : null,
      deposito: item.deposito?.descricao?.trim() || "—",
      statusId,
      status:
        item.status?.descricao?.trim() ||
        STATUS_PLANO_INVENTARIO[statusId] ||
        "Status não informado",
    };
  });

  const quantidadesPorStatus = new Map<string, StatusPlanoInventarioWms>();
  for (const item of itens) {
    const chave = item.statusId || item.status;
    const status = quantidadesPorStatus.get(chave);
    if (status) {
      status.quantidade += 1;
    } else {
      quantidadesPorStatus.set(chave, {
        id: chave,
        nome: item.status,
        quantidade: 1,
      });
    }
  }

  const contagensPorRua = new Map<string, RuaInventarioWms>();
  for (const item of itens) {
    if (item.tipoRegistro !== "Posição" || !item.rua) continue;
    const id = `${item.setor ?? ""}:${item.rua}`;
    const rua = contagensPorRua.get(id);
    if (rua) {
      rua.contagens += 1;
    } else {
      contagensPorRua.set(id, {
        id,
        setor: item.setor ?? "Sem setor",
        rua: item.rua,
        contagens: 1,
      });
    }
  }
  const enderecosSemRua = itens.filter(
    (item) => item.tipoRegistro === "Posição" && !item.rua,
  ).length;

  return {
    inventario: {
      id: idInventario,
      descricao: inventario.descricao?.trim() || `Inventário ${idInventario}`,
      criadoEm: normalizarDataHora(inventario.dataHoraCriacao) ?? null,
      finalizado: inventario.finalizado ?? false,
      tipo: inventario.tipo?.descricao?.trim() || "Não informado",
    },
    itens,
    status: [...quantidadesPorStatus.values()].sort(
      (a, b) => Number(a.id) - Number(b.id) || a.nome.localeCompare(b.nome, "pt-BR"),
    ),
    ruas: [...contagensPorRua.values()].sort(
      (a, b) =>
        a.setor.localeCompare(b.setor, "pt-BR", { numeric: true }) ||
        a.rua.localeCompare(b.rua, "pt-BR", { numeric: true }),
    ),
    enderecosSemRua,
    atualizadoEm: new Date().toISOString(),
  };
}

export const consultarInventarioWms = createServerFn({ method: "POST" }).handler(async () => {
  await exigirSessao();
  return consultarPainelInventario();
});

export const consultarOcupacoesDepositoWms = createServerFn({ method: "POST" })
  .validator((data) => CONSULTA_ENDERECAMENTO_REQUEST_SCHEMA.parse(data))
  .handler(async ({ data }) => {
    await exigirSessao();
    prepararProgressoEnderecamento(data.requestId);
    return consultarOcupacoesDeposito(data.requestId);
  });

export const consultarItensEnderecoWms = createServerFn({ method: "POST" })
  .validator((data) => CONSULTA_ITENS_ENDERECO_SCHEMA.parse(data))
  .handler(async ({ data }) => {
    await exigirSessao();
    return consultarItensEndereco(data.posicaoId, data.codigoPosicao);
  });

export const obterProgressoEnderecamentoWms = createServerFn({ method: "POST" })
  .validator((data) => CONSULTA_ENDERECAMENTO_REQUEST_SCHEMA.parse(data))
  .handler(async ({ data }) => {
    await exigirSessao();
    return (
      progressoEnderecamentoPorRequisicao.get(data.requestId) ?? {
        requestId: data.requestId,
        concluido: false,
        apis: [
          {
            funcao: "webServiceGetEnderecamento",
            paginasConcluidas: 0,
            totalPaginas: null,
            tempoDecorridoMs: 0,
          },
          {
            funcao: "webServiceGetOcupacaoProduto",
            paginasConcluidas: 0,
            totalPaginas: null,
            tempoDecorridoMs: 0,
          },
        ],
      }
    );
  });

export const consultarIntegracaoDiaWms = createServerFn({ method: "POST" })
  .validator((data) => ConsultaEshipSchema.parse(data))
  .handler(async ({ data }) => {
    await exigirAcessoDashboard();
    return consultarIntegracaoDoDia(data);
  });

export const consultarFuncao = createServerFn({ method: "POST" })
  .validator((data) => ConsultaEshipSchema.parse(data))
  .handler(async ({ data }) => {
    await exigirSessao();
    return consultarEship(data);
  });
