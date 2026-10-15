import { PARAMETROS_ESHIP } from "@/lib/wms-parameters";

/** Tipos e agregações dos dados de ordens retornados pela API WMS. */

export interface InfosAdicionais {
  norigem?: string;
  ndacompra?: string;
  valordaordem?: string | undefined;
  tipodefrete?: string;
  condicaopagamento?: string;
  depositoretirada?: string;
  alterartransporte?: string;
  valorfrete?: string | undefined;
  transportealterado?: string;
  fila?: string | undefined;
  peso?: string;
}

export interface OrdemWMS {
  ordem: number;
  codigo: string;
  infosAdicionais?: InfosAdicionais | undefined;
}

export interface RespostaWMS {
  erros: unknown;
  corpo: {
    body: {
      dadosPaginacao: Record<string, number>;
      dados: OrdemWMS[];
    };
  };
}

/* ----------------------- Funções de tratamento ----------------------- */

export function paraNumero(valor?: string): number {
  if (!valor) return 0;
  const texto = valor.trim();
  const limpo = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

export function obterOrdens(dados: RespostaWMS): OrdemWMS[] {
  return dados?.corpo?.body?.dados ?? [];
}

export function totalOrdens(ordens: OrdemWMS[]): number {
  return ordens.length;
}

export function totalInfosAdicionais(ordens: OrdemWMS[]): number {
  return ordens.filter((o) => !!o.infosAdicionais).length;
}

export function valorTotal(ordens: OrdemWMS[]): number {
  return ordens.reduce((s, o) => s + paraNumero(o.infosAdicionais?.valordaordem), 0);
}

export type FilaAgrupada = {
  id: string;
  nome: string;
  quantidade: number;
  valorTotal: number;
};

const nomesFilas = new Map(
  (PARAMETROS_ESHIP.find((parametro) => parametro.chave === "infoFila")?.opcoes ?? []).map(
    ({ id, descricao }) => [id, descricao],
  ),
);

export function obterIdFila(fila?: string): string {
  return fila?.trim() ?? "";
}

export function nomeFila(fila?: string): string {
  const id = obterIdFila(fila);
  if (!id) return "Sem fila";
  return nomesFilas.get(id) ?? "Fila não identificada";
}

export function agruparOrdensPorFila(ordens: OrdemWMS[]): FilaAgrupada[] {
  const contagens = new Map<string, FilaAgrupada>();
  for (const ordem of ordens) {
    const id = obterIdFila(ordem.infosAdicionais?.fila);
    if (!id) continue;
    const nome = nomeFila(id);
    const existente = contagens.get(id);
    if (existente) {
      existente.quantidade += 1;
      existente.valorTotal += paraNumero(ordem.infosAdicionais?.valordaordem);
    } else {
      contagens.set(id, {
        id,
        nome,
        quantidade: 1,
        valorTotal: paraNumero(ordem.infosAdicionais?.valordaordem),
      });
    }
  }

  let indiceFilaSemDescricao = 0;
  return [...contagens.values()]
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"))
    .map((fila) =>
      fila.nome === "Fila não identificada"
        ? { ...fila, nome: `Fila sem descrição ${++indiceFilaSemDescricao}` }
        : fila,
    );
}

export function maiorValor(ordens: OrdemWMS[]): number {
  return ordens.reduce((m, o) => Math.max(m, paraNumero(o.infosAdicionais?.valordaordem)), 0);
}

/* ----------------------- Formatação ----------------------- */

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarMoeda(valor: number): string {
  return moeda.format(valor);
}

export function formatarInteiro(valor: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(valor));
}

export function formatarHora(data: Date): string {
  return data.toLocaleTimeString("pt-BR", { hour12: false });
}
