/**
 * Camada de dados do Painel Operacional WMS.
 *
 * Hoje retorna um JSON mockado. Para conectar a API real do WMS,
 * substitua o corpo de `consultarAPI()` pelo fetch indicado abaixo.
 */

export interface InfosAdicionais {
  norigem?: string;
  ndacompra?: string;
  valordaordem?: string | undefined;
  tipodefrete?: string;
  condicaopagamento?: string;
  depositoretirada?: string;
  alterartransporte?: string;
  valorfrete?: string;
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
  const limpo = valor.trim().replace(/\./g, "").replace(",", ".");
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

export function filaTotal(ordens: OrdemWMS[]): number {
  return ordens.reduce((s, o) => s + paraNumero(o.infosAdicionais?.fila), 0);
}

export function filaMedia(ordens: OrdemWMS[]): number {
  const qtd = ordens.length;
  return qtd === 0 ? 0 : filaTotal(ordens) / qtd;
}

export function maiorFila(ordens: OrdemWMS[]): number {
  return ordens.reduce((m, o) => Math.max(m, paraNumero(o.infosAdicionais?.fila)), 0);
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
