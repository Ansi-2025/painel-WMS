import { createServerFn } from "@tanstack/react-start";
import type { OrdemWMS } from "./wms-api";
import {
  ConsultaEshipSchema,
  type ConsultaEship,
} from "./wms-config";

// A chave ESHIP_API_KEY existe somente no ambiente do servidor.
// Todos os módulos consomem o mesmo formato de dados; muda apenas a função da API.
async function consultarEship(
  consulta: ConsultaEship,
): Promise<{ ordens: OrdemWMS[] }> {
  const apiKey = process.env["ESHIP_API_KEY"]?.trim();
  if (!apiKey) throw new Error("ESHIP_API_KEY não configurada no servidor");

  const parametros = new URLSearchParams({ api: apiKey });
  parametros.set("funcao", consulta.funcao);
  for (const [nome, valor] of Object.entries(consulta.parametros)) {
    if (valor.trim()) parametros.set(nome, valor.trim());
  }

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
  const json = (await res.json()) as {
    corpo?: { body?: { dados?: OrdemWMS[] } };
  };
  const dados = json?.corpo?.body?.dados ?? [];
  return {
    ordens: dados.map((o) => ({
      ordem: o.ordem,
      codigo: o.codigo,
      infosAdicionais: o.infosAdicionais
        ? {
            valordaordem: o.infosAdicionais.valordaordem,
            fila: o.infosAdicionais.fila,
          }
        : undefined,
    })),
  };
}

export const consultarWms = createServerFn({ method: "POST" })
  .validator((data) => ConsultaEshipSchema.parse(data))
  .handler(({ data }) => consultarEship(data));

export const consultarExpedicao = consultarWms;
export const consultarEstoque = consultarWms;
export const consultarIndicadores = consultarWms;
export const consultarMonitoramento = consultarWms;

export const consultarFuncao = createServerFn({ method: "POST" })
  .validator((data) => ConsultaEshipSchema.parse(data))
  .handler(({ data }) => consultarEship(data));
