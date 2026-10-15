import { createServerFn } from "@tanstack/react-start";
import { paraNumero, type OrdemWMS } from "./wms-api";
import { STATUS_ORDEM_OPERACIONAIS } from "./wms-parameters";
import { ConsultaEshipSchema, type ConsultaEship } from "./wms-config";

// A chave ESHIP_API_KEY existe somente no ambiente do servidor.
// Todos os módulos consomem o mesmo formato de dados; muda apenas a função da API.
type RespostaPaginaEship = {
  corpo?: {
    body?: {
      dados?: OrdemWMS[];
      dadosPaginacao?: Record<string, unknown>;
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

async function consultarEship(consulta: ConsultaEship): Promise<{ ordens: OrdemWMS[] }> {
  const apiKey = process.env["ESHIP_API_KEY"]?.trim();
  if (!apiKey) throw new Error("ESHIP_API_KEY não configurada no servidor");

  const parametrosBase = new URLSearchParams({ api: apiKey });
  parametrosBase.set("funcao", consulta.funcao);
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
  const ordens: OrdemWMS[] = [];
  let pagina = 1;
  let totalPaginas: number | undefined;

  while (totalPaginas === undefined || pagina <= totalPaginas) {
    const parametros = new URLSearchParams(parametrosBase);
    parametros.set("pagina", String(pagina));
    parametros.set("quantidadeRegistros", String(quantidadePorPagina));

    const res = await fetch(`https://branco.eship.com.br/v3/?${parametros}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.error("E-SHIP status", res.status);
      throw new Error("Falha na comunicação com a API WMS");
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("json")) {
      console.error("E-SHIP content-type inesperado", contentType);
      throw new Error("A API E-SHIP não retornou JSON");
    }

    const json = (await res.json()) as RespostaPaginaEship;
    const body = json?.corpo?.body;
    if (!Array.isArray(body?.dados)) {
      throw new Error("A API E-SHIP retornou uma lista de dados inválida");
    }

    ordens.push(...body.dados);
    totalPaginas ??= obterTotalPaginas(body.dadosPaginacao, quantidadePorPagina);

    if (
      body.dados.length === 0 ||
      (totalPaginas === undefined && body.dados.length < quantidadePorPagina)
    ) {
      break;
    }
    pagina += 1;
  }

  return {
    ordens: ordens.map((o) => ({
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

async function consultarDashboard(
  consulta: ConsultaEship,
): Promise<{ ordens: OrdemWMS[]; fretesPorStatus: FretePorStatus[] }> {
  const parametroStatus = consulta.parametros["statusOrdem"]?.trim();
  const statusSelecionados = parametroStatus
    ? new Set(parametroStatus.match(/\d+/g) ?? [])
    : new Set(STATUS_ORDEM_OPERACIONAIS.map(({ id }) => id));
  const status = STATUS_ORDEM_OPERACIONAIS.filter(({ id }) => statusSelecionados.has(id));
  const resultados: { status: (typeof status)[number]; ordens: OrdemWMS[] }[] = [];
  let proximoStatus = 0;

  async function consultarProximoStatus(): Promise<void> {
    while (proximoStatus < status.length) {
      const indice = proximoStatus;
      proximoStatus += 1;
      const itemStatus = status[indice];
      if (!itemStatus) continue;

      const resultado = await consultarEship({
        ...consulta,
        parametros: { ...consulta.parametros, ["statusOrdem"]: `[${itemStatus.id}]` },
      });
      resultados[indice] = { status: itemStatus, ordens: resultado.ordens };
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(3, status.length) }, () => consultarProximoStatus()),
  );

  return {
    ordens: resultados.flatMap((resultado) => resultado.ordens),
    fretesPorStatus: resultados.map(({ status: itemStatus, ordens }) => ({
      id: itemStatus.id,
      nome: itemStatus.descricao,
      valor: ordens.reduce((total, ordem) => total + paraNumero(ordem.infosAdicionais?.valorfrete), 0),
    })),
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
