import { createServerFn } from "@tanstack/react-start";
import { paraNumero, type OrdemWMS } from "./wms-api";
import { STATUS_ORDEM, STATUS_ORDEM_OPERACIONAIS } from "./wms-parameters";
import { ConsultaEshipSchema, type ConsultaEship } from "./wms-config";
import { exigirSessao } from "@/lib/server/auth.server";

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
  enderecoDestinatario?: {
    municipio?: {
      estado?: { sigla?: string; descricao?: string };
    };
  };
  ordem?: {
    id?: number | string;
    idStatus?: number | string;
    status?: { id?: number | string; descricao?: string };
    enderecoDestinatario?: {
      municipio?: {
        estado?: { sigla?: string; descricao?: string };
      };
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
          }
        : undefined,
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

async function consultarDashboard(consulta: ConsultaEship): Promise<{
  ordens: OrdemWMS[];
  statusPedidos: StatusPedido[];
  fretesPorStatus: FretePorStatus[];
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
      fretesPorStatus: [],
    };
  }

  const consultaDashboard: ConsultaEship = {
    ...consulta,
    parametros: {
      ...consulta.parametros,
      ["statusOrdem"]: `[${status.map(({ id }) => id).join(",")}]`,
    },
  };
  const incrementarConfigurado = consultaDashboard.parametros["incrementar"]?.match(/\d+/g) ?? [];
  const consultaDetalhada: ConsultaEship = {
    ...consultaDashboard,
    parametros: {
      ...consultaDashboard.parametros,
      ["incrementar"]: `[${[...new Set([...incrementarConfigurado, "75", "91"])].join(",")}]`,
    },
  };
  const [resultadoInfos, ordensDetalhadas] = await Promise.all([
    consultarEship(consultaDashboard),
    consultarPaginasEship<OrdemDetalhadaEship>(consultaDetalhada, "webServiceGetOrdem"),
  ]);

  const statusPorOrdem = new Map<string, { id: string; nome?: string }>();
  const estadoDestinatarioPorOrdem = new Map<string, NonNullable<OrdemWMS["estadoDestinatario"]>>();
  const contagemPorStatus = new Map<string, number>();
  const nomePorStatus = new Map(status.map(({ id, descricao }) => [id, descricao]));
  for (const ordem of ordensDetalhadas) {
    const identificador = ordem.id ?? ordem.ordem?.id;
    const statusOrdem = obterStatusOrdem(ordem);
    if (identificador === undefined || !statusOrdem || !statusSelecionados.has(statusOrdem.id))
      continue;
    statusPorOrdem.set(String(identificador), statusOrdem);
    const estadoDestinatario = obterEstadoDestinatario(ordem);
    if (estadoDestinatario) {
      estadoDestinatarioPorOrdem.set(String(identificador), estadoDestinatario);
    }
    if (statusOrdem.nome) nomePorStatus.set(statusOrdem.id, statusOrdem.nome);
  }

  for (const statusOrdem of statusPorOrdem.values()) {
    contagemPorStatus.set(statusOrdem.id, (contagemPorStatus.get(statusOrdem.id) ?? 0) + 1);
  }

  const valorPorStatus = new Map<string, number>();
  for (const ordem of resultadoInfos.ordens) {
    const identificador = String(ordem.ordem);
    const statusOrdem = statusPorOrdem.get(identificador);
    if (statusOrdem) {
      valorPorStatus.set(
        statusOrdem.id,
        (valorPorStatus.get(statusOrdem.id) ?? 0) + paraNumero(ordem.infosAdicionais?.valordaordem),
      );
    }
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

  const ordensComStatus = resultadoInfos.ordens.map((ordem) => {
    const identificador = String(ordem.ordem);
    const statusOrdem = statusPorOrdem.get(identificador);
    const estadoDestinatario = estadoDestinatarioPorOrdem.get(identificador);
    return {
      ...ordem,
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
    fretesPorStatus: status.map(({ id, descricao }) => ({
      id,
      nome: nomePorStatus.get(id) ?? descricao,
      valor: fretePorStatus.get(id) ?? 0,
    })),
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
    await exigirSessao();
    return consultarDashboard(data);
  });

export const consultarFuncao = createServerFn({ method: "POST" })
  .validator((data) => ConsultaEshipSchema.parse(data))
  .handler(async ({ data }) => {
    await exigirSessao();
    return consultarEship(data);
  });
