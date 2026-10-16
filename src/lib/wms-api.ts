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
  transporte?: string | undefined;
  nomeTransporte?: string | undefined;
  fila?: string | undefined;
  peso?: string;
}

export interface OrdemWMS {
  ordem: number;
  codigo: string;
  transporte?: string | undefined;
  nomeTransporte?: string | undefined;
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
  const limpo = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
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

function normalizarNomeFila(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function nomeFamiliaFila(nome: string): string {
  const chave = normalizarNomeFila(nome);
  const familias: [RegExp, string][] = [
    [/^ONDAATRASAD[AO]\d+$/, "ONDA ATRASADA"],
    [/^ONDA\d+$/, "ONDA"],
    [/^(?:PRODMISTO|PECAMIST[AO])ATRASAD[AO]\d+$/, "MISTO ATRASADO"],
    [/^(?:PRODMISTO|PECAMIST[AO])\d+$/, "MISTO"],
    [/^PECAATRASAD[AO]\d+$/, "PEÇA ATRASADA"],
    [/^PECA\d+$/, "PEÇA"],
    [/^LINHA\d+(?:T2)?$/, "LINHA"],
    [/^COEX\d+$/, "COEX"],
    [
      /^(?:AMAZON|B2B|DIFAL|EXPORTACAO|GAZIN|GURGEL|LEROY|MKT|OBRAMAX)(?:PECA|PECAS|PROD|PRODUTO)$/,
      "",
    ],
    [/^CLIENTERETIRA(?:PECA|PROD)$/, "RETIRADA CLIENTE"],
    [/^SAC(?:PECA|PRODUCAO|PRODUTO)$/, "SAC"],
    [/^SLOBSPARCIAL(?:ALMOX|EXPED)$/, "SLOB PARCIAL"],
    [/^SLOBSTOTALALMOX$/, "SLOB TOTAL"],
    [/^MADEIRA(?:PECA|PRODUTO)$/, "MADEIRA"],
    [/^TECIDOS(?:PECA|PECAS|PROD)$/, "TECIDOS"],
    [/^TRANSFORMACAO(?:PECA|PROD)$/, "TRANSFORMAÇÃO"],
    [/^TRANSF?(?:PECA|PROD)$/, "TRANSFERÊNCIA"],
    [/^TRIANGULAR(?:PECA|PRD)$/, "TRIANGULAR"],
  ];

  for (const [padrao, familia] of familias) {
    if (!padrao.test(chave)) continue;
    if (familia) return familia;
    return chave.replace(/(?:PECA|PECAS|PRODUTO|PROD)$/, "");
  }
  if (/(?:PECAS?|PRODUTO|PROD|PRD)$/.test(chave)) {
    return chave.replace(/(?:PECAS?|PRODUTO|PROD|PRD)$/, "");
  }
  return nome;
}

export function agruparOrdensPorFila(ordens: OrdemWMS[]): FilaAgrupada[] {
  const contagens = new Map<string, FilaAgrupada>();
  for (const ordem of ordens) {
    const id = obterIdFila(ordem.infosAdicionais?.fila);
    if (!id) continue;
    const nome = nomeFamiliaFila(nomeFila(id));
    const existente = contagens.get(nome);
    if (existente) {
      existente.quantidade += 1;
      existente.valorTotal += paraNumero(ordem.infosAdicionais?.valordaordem);
    } else {
      contagens.set(nome, {
        id,
        nome,
        quantidade: 1,
        valorTotal: paraNumero(ordem.infosAdicionais?.valordaordem),
      });
    }
  }

  return [...contagens.values()]
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"))
    .map((fila) =>
      fila.nome === "Fila não identificada" ? { ...fila, nome: "OUTRAS FILAS" } : fila,
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
