import { z } from "zod";

const parametrosSchema = z
  .record(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_]{0,59}$/), z.string().max(500))
  .superRefine((parametros, contexto) => {
    for (const nome of Object.keys(parametros)) {
      if (["api", "funcao"].includes(nome.toLowerCase())) {
        contexto.addIssue({
          code: "custom",
          path: [nome],
          message: "Este parâmetro é reservado.",
        });
      }
    }
  })
  .transform((parametros) => ({ incluirInfo: "true", ...parametros }));

export const ConfiguracaoConsultaModuloSchema = z.object({
  funcao: z.string().trim().min(1).max(120),
  parametros: parametrosSchema,
});

export type ConfiguracaoConsultaModulo = z.infer<typeof ConfiguracaoConsultaModuloSchema>;

export const ConsultaEshipSchema = ConfiguracaoConsultaModuloSchema;

export type ConsultaEship = z.infer<typeof ConsultaEshipSchema>;

export const ConfiguracaoWmsSchema = z.object({
  funcao: z.string().trim().min(1).max(120),
  parametros: parametrosSchema.default({}),
});

export type ConfiguracaoWms = z.infer<typeof ConfiguracaoWmsSchema>;

export const ModuloPersonalizadoSchema = ConfiguracaoConsultaModuloSchema.extend({
  id: z.string().uuid(),
  nome: z.string().trim().min(1).max(40),
});

export type ModuloPersonalizado = z.infer<typeof ModuloPersonalizadoSchema>;

export const CONFIGURACAO_WMS_PADRAO: ConfiguracaoWms = {
  funcao: "webServiceGetInfosOrdem",
  parametros: {
    incluirInfo: "true",
    statusOrdem: "[4]",
    tipoOrdem: "[12,10,20,14,4,13,6,2]",
    pagina: "1",
    quantidadeRegistros: "100",
    ordenacao: "2",
  },
};

export const CONFIGURACAO_WMS_VAZIA: ConfiguracaoWms = {
  funcao: "",
  parametros: { incluirInfo: "true" },
};

const CHAVE_STORAGE = "wms-painel:configuracao-api";
const CHAVE_MODULOS = "wms-painel:modulos-personalizados";
const CHAVE_CONSULTAS_DASHBOARDS = "wms-painel:consultas-dashboards";
const CHAVE_API_ATIVA = "wms-painel:api-ativa";
const EVENTO_MODULOS = "wms-painel:modulos-personalizados-alterados";
const EVENTO_CONFIGURACAO = "wms-painel:configuracao-alterada";
const EVENTO_CONSULTA_DASHBOARD = "wms-painel:consulta-dashboard-alterada";
const EVENTO_API_ATIVA = "wms-painel:api-ativa-alterada";

export function lerApiAtiva(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(CHAVE_API_ATIVA) !== "false";
}

export function salvarApiAtiva(ativa: boolean): void {
  window.localStorage.setItem(CHAVE_API_ATIVA, String(ativa));
  window.dispatchEvent(new Event(EVENTO_API_ATIVA));
}

export function assinarApiAtiva(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const atualizarEmOutraAba = (event: StorageEvent) => {
    if (event.key === CHAVE_API_ATIVA) callback();
  };

  window.addEventListener(EVENTO_API_ATIVA, callback);
  window.addEventListener("storage", atualizarEmOutraAba);
  return () => {
    window.removeEventListener(EVENTO_API_ATIVA, callback);
    window.removeEventListener("storage", atualizarEmOutraAba);
  };
}

function removerChavesApiLegadas(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(removerChavesApiLegadas);
  if (typeof valor !== "object" || valor === null) return valor;

  return Object.fromEntries(
    Object.entries(valor)
      .filter(([chave]) => chave !== "apiKey")
      .map(([chave, item]) => [chave, removerChavesApiLegadas(item)]),
  );
}

function lerJsonSemChavesApi(chave: string): unknown {
  const salvo = window.localStorage.getItem(chave);
  if (!salvo) return null;

  const valor: unknown = JSON.parse(salvo);
  const seguro = removerChavesApiLegadas(valor);
  if (JSON.stringify(seguro) !== JSON.stringify(valor)) {
    window.localStorage.setItem(chave, JSON.stringify(seguro));
  }
  return seguro;
}

export function lerConfiguracaoWms(): ConfiguracaoWms | null {
  if (typeof window === "undefined") return null;

  try {
    const armazenada = lerJsonSemChavesApi(CHAVE_STORAGE);
    if (typeof armazenada !== "object" || armazenada === null || Array.isArray(armazenada)) {
      return null;
    }
    const dadosArmazenados = armazenada as Record<string, unknown>;
    const dados =
      "parametros" in dadosArmazenados
        ? dadosArmazenados
        : {
            funcao: dadosArmazenados.funcao,
            parametros: Object.fromEntries(
              Object.entries(dadosArmazenados).filter(
                ([chave, item]) => chave !== "funcao" && typeof item === "string" && item,
              ),
            ),
          };
    const resultado = ConfiguracaoWmsSchema.safeParse(dados);
    return resultado.success ? resultado.data : null;
  } catch {
    return null;
  }
}

export function salvarConfiguracaoWms(configuracao: ConfiguracaoWms): void {
  const validada = ConfiguracaoWmsSchema.parse(configuracao);
  window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(validada));
  window.dispatchEvent(new Event(EVENTO_CONFIGURACAO));
}

export function assinarConfiguracaoWms(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const atualizarNaOutraAba = (event: StorageEvent) => {
    if (event.key === CHAVE_STORAGE) callback();
  };

  window.addEventListener(EVENTO_CONFIGURACAO, callback);
  window.addEventListener("storage", atualizarNaOutraAba);
  return () => {
    window.removeEventListener(EVENTO_CONFIGURACAO, callback);
    window.removeEventListener("storage", atualizarNaOutraAba);
  };
}

export function listarModulosPersonalizados(): ModuloPersonalizado[] {
  if (typeof window === "undefined") return [];

  try {
    const valor = lerJsonSemChavesApi(CHAVE_MODULOS);
    if (!valor) return [];
    const resultado = z.array(ModuloPersonalizadoSchema).safeParse(valor);
    return resultado.success ? resultado.data : [];
  } catch {
    return [];
  }
}

export function salvarModuloPersonalizado(modulo: ModuloPersonalizado): void {
  const validado = ModuloPersonalizadoSchema.parse(modulo);
  const modulos = listarModulosPersonalizados().filter((item) => item.id !== validado.id);
  window.localStorage.setItem(CHAVE_MODULOS, JSON.stringify([...modulos, validado]));
  window.dispatchEvent(new Event(EVENTO_MODULOS));
}

export function removerModuloPersonalizado(id: string): void {
  const modulos = listarModulosPersonalizados().filter((item) => item.id !== id);
  window.localStorage.setItem(CHAVE_MODULOS, JSON.stringify(modulos));
  window.dispatchEvent(new Event(EVENTO_MODULOS));
}

export function buscarModuloPersonalizado(id: string): ModuloPersonalizado | null {
  return listarModulosPersonalizados().find((modulo) => modulo.id === id) ?? null;
}

export function assinarModulosPersonalizados(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENTO_MODULOS, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENTO_MODULOS, callback);
    window.removeEventListener("storage", callback);
  };
}

export function consultaDaConfiguracao(configuracao: ConfiguracaoWms): ConsultaEship {
  return ConsultaEshipSchema.parse({
    funcao: configuracao.funcao,
    parametros: configuracao.parametros,
  });
}

export function lerConfiguracaoConsultaModulo(
  id: string,
): ConfiguracaoConsultaModulo | null {
  if (typeof window === "undefined") return null;

  try {
    const consultas = lerJsonSemChavesApi(CHAVE_CONSULTAS_DASHBOARDS);
    if (typeof consultas !== "object" || consultas === null || Array.isArray(consultas)) return null;
    const resultado = ConfiguracaoConsultaModuloSchema.safeParse(consultas[id]);
    return resultado.success ? resultado.data : null;
  } catch {
    return null;
  }
}

export function salvarConfiguracaoConsultaModulo(
  id: string,
  configuracao: ConfiguracaoConsultaModulo,
): void {
  const validada = ConfiguracaoConsultaModuloSchema.parse(configuracao);
  let consultas: Record<string, unknown> = {};
  try {
    const salvo = window.localStorage.getItem(CHAVE_CONSULTAS_DASHBOARDS);
    if (salvo) consultas = JSON.parse(salvo) as Record<string, unknown>;
  } catch {
    consultas = {};
  }
  window.localStorage.setItem(
    CHAVE_CONSULTAS_DASHBOARDS,
    JSON.stringify({ ...consultas, [id]: validada }),
  );
  window.dispatchEvent(new CustomEvent(EVENTO_CONSULTA_DASHBOARD, { detail: id }));
}

export function removerConfiguracaoConsultaModulo(id: string): void {
  let consultas: Record<string, unknown> = {};
  try {
    const salvo = window.localStorage.getItem(CHAVE_CONSULTAS_DASHBOARDS);
    if (salvo) consultas = JSON.parse(salvo) as Record<string, unknown>;
  } catch {
    consultas = {};
  }
  delete consultas[id];
  window.localStorage.setItem(CHAVE_CONSULTAS_DASHBOARDS, JSON.stringify(consultas));
  window.dispatchEvent(new CustomEvent(EVENTO_CONSULTA_DASHBOARD, { detail: id }));
}

export function assinarConfiguracaoConsultaModulo(
  id: string,
  callback: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const atualizarNesteNavegador = (event: Event) => {
    if (event instanceof CustomEvent && event.detail === id) callback();
  };
  const atualizarEmOutraAba = (event: StorageEvent) => {
    if (event.key === CHAVE_CONSULTAS_DASHBOARDS) callback();
  };

  window.addEventListener(EVENTO_CONSULTA_DASHBOARD, atualizarNesteNavegador);
  window.addEventListener("storage", atualizarEmOutraAba);
  return () => {
    window.removeEventListener(EVENTO_CONSULTA_DASHBOARD, atualizarNesteNavegador);
    window.removeEventListener("storage", atualizarEmOutraAba);
  };
}