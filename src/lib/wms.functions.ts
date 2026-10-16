import { createServerFn } from "@tanstack/react-start";
import { paraNumero, type OrdemWMS } from "./wms-api";
import { PARAMETROS_ESHIP, STATUS_ORDEM, STATUS_ORDEM_OPERACIONAIS } from "./wms-parameters";
import { ConsultaEshipSchema, type ConsultaEship } from "./wms-config";

const TIMEOUT_REQUISICAO_ESHIP_MS = 30_000;

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

type OrdemDetalhadaEship = {
  id?: number | string;
  idStatus?: number | string;
  status?: { id?: number | string; descricao?: string };
  transporte?: string | number | { id?: string | number; descricao?: string; nome?: string };
  nomeTransporte?: string;
  infosAdicionais?: {
    transporte?: string;
    nomeTransporte?: string;
  };
  ordem?: {
    id?: number | string;
    idStatus?: number | string;
    status?: { id?: number | string; descricao?: string };
    transporte?: string | number | { id?: string | number; descricao?: string; nome?: string };
    nomeTransporte?: string;
    infosAdicionais?: {
      transporte?: string;
      nomeTransporte?: string;
    };
  };
};

function normalizarChavePaginacao(chave: string): string {
  return chave.toLowerCase().replace(/[^a-z0-9]/g, "");
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

async function consultarPaginasEship<T>(consulta: ConsultaEship, funcao: string): Promise<T[]> {
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
  const dadosCompletos: T[] = [];
  let pagina = 1;
  let totalPaginas: number | undefined;

  while (totalPaginas === undefined || pagina <= totalPaginas) {
    const parametros = new URLSearchParams(parametrosBase);
    parametros.set("pagina", String(pagina));
    parametros.set("quantidadeRegistros", String(quantidadePorPagina));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_REQUISICAO_ESHIP_MS);
    let res: Response;
    try {
      res = await fetch(`https://branco.eship.com.br/v3/?${parametros}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        console.error("Tempo esgotado ao consultar E-SHIP", { funcao, pagina });
        throw new Error("Tempo esgotado na comunicação com a API E-SHIP");
      }
      console.error("Falha na requisição à E-SHIP", {
        funcao,
        pagina,
        erro: error instanceof Error ? error.name : "erro desconhecido",
      });
      throw new Error("Falha na comunicação com a API E-SHIP");
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      console.error("E-SHIP status", res.status);
      throw new Error("Falha na comunicação com a API WMS");
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("json")) {
      console.error("E-SHIP content-type inesperado", contentType);
      throw new Error("A API E-SHIP não retornou JSON");
    }

    const json = (await res.json()) as RespostaPaginaEship<T>;
    const body = json?.corpo?.body;
    if (!Array.isArray(body?.dados)) {
      throw new Error("A API E-SHIP retornou uma lista de dados inválida");
    }

    dadosCompletos.push(...body.dados);
    totalPaginas ??= obterTotalPaginas(body.dadosPaginacao, quantidadePorPagina);

    if (
      body.dados.length === 0 ||
      (totalPaginas === undefined && body.dados.length < quantidadePorPagina)
    ) {
      break;
    }
    pagina += 1;
  }

  return dadosCompletos;
}

async function consultarEship(consulta: ConsultaEship): Promise<{ ordens: OrdemWMS[] }> {
  const dados = await consultarPaginasEship<OrdemWMS>(consulta, consulta.funcao);
  return {
    ordens: dados.map((o) => ({
      ordem: o.ordem,
      codigo: o.codigo,
      infosAdicionais: o.infosAdicionais
        ? {
            valordaordem: o.infosAdicionais.valordaordem,
            valorfrete: o.infosAdicionais.valorfrete,
            fila: o.infosAdicionais.fila,
            transporte: o.infosAdicionais.transporte,
            nomeTransporte: o.infosAdicionais.nomeTransporte,
          }
        : undefined,
      transporte: o.transporte,
      nomeTransporte: o.nomeTransporte,
    })),
  };
}

type FretePorStatus = {
  id: string;
  nome: string;
  valor: number;
};

type StatusPedido = {
  id: string;
  nome: string;
  quantidade: number;
  valor: number;
};

type TransportePedido = {
  nome: string;
  quantidade: number;
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

const nomesTransportes = new Map(
  (PARAMETROS_ESHIP.find(({ chave }) => chave === "transporte")?.opcoes ?? []).map(
    ({ id, descricao }) => [id, descricao],
  ),
);

function obterNomeTransporte(ordem: OrdemDetalhadaEship): string | undefined {
  const valor =
    ordem.nomeTransporte ??
    ordem.ordem?.nomeTransporte ??
    ordem.infosAdicionais?.nomeTransporte ??
    ordem.ordem?.infosAdicionais?.nomeTransporte ??
    ordem.transporte ??
    ordem.ordem?.transporte ??
    ordem.infosAdicionais?.transporte ??
    ordem.ordem?.infosAdicionais?.transporte;
  if (typeof valor === "object") {
    const nome = valor.descricao ?? valor.nome;
    if (nome?.trim()) return nome.trim();
    if (valor.id !== undefined) return nomesTransportes.get(String(valor.id)) ?? String(valor.id);
    return undefined;
  }
  if (valor === undefined || String(valor).trim() === "") return undefined;
  const texto = String(valor).trim();
  return nomesTransportes.get(texto) ?? texto;
}

async function consultarDashboard(consulta: ConsultaEship): Promise<{
  ordens: OrdemWMS[];
  statusPedidos: StatusPedido[];
  fretesPorStatus: FretePorStatus[];
  transportePedidos: TransportePedido[];
}> {
  const parametroStatus = consulta.parametros["statusOrdem"]?.trim();
  const statusSelecionados = parametroStatus
    ? new Set(parametroStatus.match(/\d+/g) ?? [])
    : new Set(STATUS_ORDEM_OPERACIONAIS.map(({ id }) => id));
  const status = STATUS_ORDEM.filter(({ id }) => statusSelecionados.has(id));
  if (status.length === 0) {
    return { ordens: [], statusPedidos: [], fretesPorStatus: [], transportePedidos: [] };
  }

  const consultaDashboard: ConsultaEship = {
    ...consulta,
    parametros: {
      ...consulta.parametros,
      ["statusOrdem"]: `[${status.map(({ id }) => id).join(",")}]`,
    },
  };
  const [resultadoInfos, ordensDetalhadas] = await Promise.all([
    consultarEship(consultaDashboard),
    consultarPaginasEship<OrdemDetalhadaEship>(consultaDashboard, "webServiceGetOrdem"),
  ]);

  const statusPorOrdem = new Map<string, { id: string; nome?: string }>();
  const transportePorOrdem = new Map<string, string>();
  const contagemPorStatus = new Map<string, number>();
  const nomePorStatus = new Map(status.map(({ id, descricao }) => [id, descricao]));
  for (const ordem of ordensDetalhadas) {
    const identificador = ordem.id ?? ordem.ordem?.id;
    const statusOrdem = obterStatusOrdem(ordem);
    if (identificador === undefined || !statusOrdem || !statusSelecionados.has(statusOrdem.id))
      continue;
    statusPorOrdem.set(String(identificador), statusOrdem);
    const nomeTransporte = obterNomeTransporte(ordem);
    if (nomeTransporte) transportePorOrdem.set(String(identificador), nomeTransporte);
    if (statusOrdem.nome) nomePorStatus.set(statusOrdem.id, statusOrdem.nome);
  }

  for (const statusOrdem of statusPorOrdem.values()) {
    contagemPorStatus.set(statusOrdem.id, (contagemPorStatus.get(statusOrdem.id) ?? 0) + 1);
  }

  const valorPorStatus = new Map<string, number>();
  const transportePorNome = new Map<string, number>();
  for (const ordem of resultadoInfos.ordens) {
    const identificador = String(ordem.ordem);
    const statusOrdem = statusPorOrdem.get(identificador);
    if (statusOrdem) {
      valorPorStatus.set(
        statusOrdem.id,
        (valorPorStatus.get(statusOrdem.id) ?? 0) + paraNumero(ordem.infosAdicionais?.valordaordem),
      );
    }
    const nomeTransporte =
      ordem.nomeTransporte ??
      ordem.infosAdicionais?.nomeTransporte ??
      (ordem.transporte
        ? (nomesTransportes.get(ordem.transporte) ?? ordem.transporte)
        : undefined) ??
      (ordem.infosAdicionais?.transporte
        ? (nomesTransportes.get(ordem.infosAdicionais.transporte) ??
          ordem.infosAdicionais.transporte)
        : undefined) ??
      transportePorOrdem.get(identificador) ??
      "Sem transporte";
    transportePorNome.set(nomeTransporte, (transportePorNome.get(nomeTransporte) ?? 0) + 1);
  }

  const ordensSemStatus = resultadoInfos.ordens.filter(
    (ordem) => !statusPorOrdem.has(String(ordem.ordem)),
  );
  if (ordensSemStatus.length > 0) {
    console.error("E-SHIP não retornou status para todas as ordens", ordensSemStatus.length);
    throw new Error("A API E-SHIP não retornou status para todas as ordens consultadas");
  }

  const fretePorStatus = new Map<string, number>();
  for (const ordem of resultadoInfos.ordens) {
    const statusOrdem = statusPorOrdem.get(String(ordem.ordem));
    if (!statusOrdem) continue;
    fretePorStatus.set(
      statusOrdem.id,
      (fretePorStatus.get(statusOrdem.id) ?? 0) + paraNumero(ordem.infosAdicionais?.valorfrete),
    );
  }

  return {
    ordens: resultadoInfos.ordens,
    statusPedidos: status.map(({ id, descricao }) => ({
      id,
      nome: nomePorStatus.get(id) ?? descricao,
      quantidade: contagemPorStatus.get(id) ?? 0,
      valor: valorPorStatus.get(id) ?? 0,
    })),
    fretesPorStatus: status.map(({ id, descricao }) => ({
      id,
      nome: nomePorStatus.get(id) ?? descricao,
      valor: fretePorStatus.get(id) ?? 0,
    })),
    transportePedidos: [...transportePorNome]
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

export const consultarWms = createServerFn({ method: "POST" })
  .validator((data) => ConsultaEshipSchema.parse(data))
  .handler(({ data }) => consultarEship(data));

export const consultarDashboardWms = createServerFn({ method: "POST" })
  .validator((data) => ConsultaEshipSchema.parse(data))
  .handler(({ data }) => consultarDashboard(data));

export const consultarFuncao = createServerFn({ method: "POST" })
  .validator((data) => ConsultaEshipSchema.parse(data))
  .handler(({ data }) => consultarEship(data));
