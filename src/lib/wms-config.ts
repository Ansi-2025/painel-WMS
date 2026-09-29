import { z } from "zod";

const parametrosSchema = z
  .record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,59}$/), z.string().max(500))
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
  });

export const ConsultaEshipSchema = z.object({
  funcao: z.string().trim().min(1).max(120),
  parametros: parametrosSchema,
  apiKey: z.string().max(500).optional(),
});

export type ConsultaEship = z.infer<typeof ConsultaEshipSchema>;

export const ConfiguracaoWmsSchema = z.object({
  funcao: z.string().trim().min(1).max(120),
  apiKey: z.string().max(500).default(""),
  ordem: z.string().trim().max(120),
  statusOrdem: z.string().trim().max(120),
  tipoOrdem: z.string().trim().max(120),
  pagina: z.string().trim().max(20),
  quantidadeRegistros: z.string().trim().max(20),
  ordenacao: z.string().trim().max(20),
});

export type ConfiguracaoWms = z.infer<typeof ConfiguracaoWmsSchema>;

export const ModuloPersonalizadoSchema = ConsultaEshipSchema.extend({
  id: z.string().uuid(),
  nome: z.string().trim().min(1).max(40),
});

export type ModuloPersonalizado = z.infer<typeof ModuloPersonalizadoSchema>;

export const CONFIGURACAO_WMS_PADRAO: ConfiguracaoWms = {
  funcao: "webServiceGetInfosOrdem",
  apiKey: "",
  ordem: "",
  statusOrdem: "[4]",
  tipoOrdem: "[12,10,20,14,4,13,6,2]",
  pagina: "1",
  quantidadeRegistros: "100",
  ordenacao: "2",
};

export const CONFIGURACAO_WMS_VAZIA: ConfiguracaoWms = {
  funcao: "",
  apiKey: "",
  ordem: "",
  statusOrdem: "",
  tipoOrdem: "",
  pagina: "",
  quantidadeRegistros: "",
  ordenacao: "",
};

const CHAVE_STORAGE = "wms-painel:configuracao-api";
const CHAVE_MODULOS = "wms-painel:modulos-personalizados";
const EVENTO_MODULOS = "wms-painel:modulos-personalizados-alterados";
const EVENTO_CONFIGURACAO = "wms-painel:configuracao-alterada";

export function lerConfiguracaoWms(): ConfiguracaoWms | null {
  if (typeof window === "undefined") return null;

  try {
    const valor = window.localStorage.getItem(CHAVE_STORAGE);
    if (!valor) return null;
    const resultado = ConfiguracaoWmsSchema.safeParse(JSON.parse(valor));
    return resultado.success ? resultado.data : null;
  } catch {
    return null;
  }
}

export function salvarConfiguracaoWms(configuracao: ConfiguracaoWms): void {
  window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(configuracao));
  window.dispatchEvent(new Event(EVENTO_CONFIGURACAO));
}

export function removerChaveApiWms(): void {
  const configuracao = lerConfiguracaoWms() ?? CONFIGURACAO_WMS_PADRAO;
  salvarConfiguracaoWms({ ...configuracao, apiKey: "" });
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
    const valor = window.localStorage.getItem(CHAVE_MODULOS);
    if (!valor) return [];
    const resultado = z.array(ModuloPersonalizadoSchema).safeParse(JSON.parse(valor));
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
  const { funcao, apiKey, ...campos } = configuracao;
  const parametros = Object.fromEntries(
    Object.entries(campos).filter(([, valor]) => valor.trim()),
  );
  return ConsultaEshipSchema.parse({ funcao, parametros, apiKey });
}