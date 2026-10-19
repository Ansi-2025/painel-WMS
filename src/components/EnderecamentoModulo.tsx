import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Boxes,
  BrushCleaning,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CircleAlert,
  Info,
  Lightbulb,
  MapPin,
  Package,
  PackageSearch,
  RefreshCw,
  Search,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { BarraModulos } from "@/components/BarraModulos";
import { DetalhesPainel, type SecaoDetalhesPainel } from "@/components/DetalhesPainel";
import {
  lerCacheEnderecamento,
  salvarCacheEnderecamento,
  VERSAO_CACHE_ENDERECAMENTO,
} from "@/lib/enderecamento-cache";
import {
  consultarEnderecamentoPosicoesWms,
  consultarItensEnderecoWms,
  consultarOcupacoesDepositoWms,
  obterProgressoEnderecamentoWms,
  type EnderecamentoWms,
  type EnderecoArmazem,
  type ItemEnderecoArmazem,
  type OcupacoesDepositoWms,
  type ProgressoEnderecamentoWms,
} from "@/lib/wms.functions";

const INTERVALO_ATUALIZACAO_MS = 4 * 60 * 60 * 1000;
const VERIFICAR_ATUALIZACAO_MS = 60 * 1000;
const INTERVALO_CONSULTA_PROGRESSO_MS = 2000;
const ENDERECOS_POR_PAGINA = 50;
const CORES_STATUS = {
  desativadas: "#10b981",
  normais: "#0ea5e9",
  bloqueadas: "#f59e0b",
  inventario: "#f43f5e",
};
const formatadorInteiro = new Intl.NumberFormat("pt-BR");
const formatadorQuantidade = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 3,
});
const formatadorPercentual = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});
const TIPOS_POSICAO: Record<string, string> = {
  "1": "Estoque",
  "2": "Picking",
  "3": "Produção",
  "4": "Expedição",
  "5": "Recebimento",
  "6": "Parada",
  "7": "Retorno",
  "8": "Inventário",
};
const TIPOS_OCUPACAO: Record<string, string> = {
  "1": "SKU único",
  "2": "Múltiplos SKUs",
  "3": "SKU único com ranking",
  "4": "Múltiplos SKUs com ranking",
};
const SECOES_DETALHES_ENDERECAMENTO = [
  {
    titulo: "Cartões e filtros",
    itens: [
      {
        titulo: "Posições",
        descricao: "Total de endereços no escopo atual. Toque para limpar os filtros.",
      },
      {
        titulo: "Ocupadas e vazias",
        descricao:
          "Ocupadas são posições com itens retornados pela API de ocupação de produtos. Os contadores de ocupações e movimentadores do cadastro da posição não são usados.",
      },
      {
        titulo: "Ocupação",
        descricao:
          "Percentual de posições com itens retornados pela API de ocupação de produtos, dividido pelo total de posições.",
      },
      {
        titulo: "Ativas e desativadas",
        descricao:
          "Contagem por status da posição: normal/ativa ou desativada. Toque para filtrar a tabela e o mapa.",
      },
      {
        titulo: "Depósitos",
        descricao:
          "Cada botão mostra quantas posições estão associadas ao depósito. Toque para filtrar os dados vinculados.",
      },
    ],
  },
  {
    titulo: "Mapa e status",
    itens: [
      {
        titulo: "Mapa de endereçamento",
        descricao:
          "Organiza as ruas por setor. A porcentagem de cada rua usa as posições com itens retornados pela API de ocupação de produtos; as barras mostram a composição por bloqueadas, ocupadas, normais e desativadas. Toque em setor ou rua para filtrar.",
      },
      {
        titulo: "Status das posições",
        descricao:
          "Gráfico de rosca com a quantidade e a participação de cada status no conjunto visível. Toque em uma categoria para aplicar ou remover o filtro.",
      },
      {
        titulo: "Filtros do mapa",
        descricao:
          "Setor, rua, endereço, depósito, ocupação e status podem ser combinados. Os filtros aplicáveis também atualizam a tabela e os indicadores relacionados.",
      },
    ],
  },
  {
    titulo: "Alertas e insights",
    itens: [
      {
        titulo: "Posições bloqueadas",
        descricao:
          "Quantidade de posições com status bloqueado, sem incluir o status específico de bloqueio para inventário.",
      },
      {
        titulo: "Ruas com 100% de ocupação",
        descricao:
          "Número de ruas em que todas as posições estão ocupadas. Toque no alerta para abrir uma rua cheia.",
      },
      {
        titulo: "Setores com 0% de ocupação",
        descricao:
          "Quantidade de setores sem posições ocupadas; o alerta pode abrir um desses setores.",
      },
      {
        titulo: "Produtos em múltiplos endereços",
        descricao:
          "Número de produtos encontrados em mais de uma posição. Toque no cartão para filtrar mapa e tabela para as posições correspondentes.",
      },
      {
        titulo: "Insights rápidos",
        descricao:
          "Resume os setores de maior ocupação e disponibilidade (desconsiderando T e F), a rua mais ocupada e as posições bloqueadas.",
      },
    ],
  },
  {
    titulo: "Tabela e atualização",
    itens: [
      {
        titulo: "Endereços do armazém",
        descricao:
          "Lista os endereços do escopo filtrado, paginados. O atalho de detalhes mostra itens, saldo/quantidade e depósitos associados à posição.",
      },
      {
        titulo: "Tempo de retorno das APIs",
        descricao:
          "Exibe a duração da última consulta e o número de páginas retornadas para endereços e ocupações por depósito.",
      },
      {
        titulo: "Atualização",
        descricao:
          "Os dados são atualizados automaticamente a cada quatro horas ou manualmente pelo botão de atualizar. A indicação informa quando os dados foram carregados ou restaurados do cache.",
      },
    ],
  },
] satisfies SecaoDetalhesPainel[];
type FiltroEndereco = "todos" | "ocupadas" | "vazias" | "ativas" | "desativadas";
type RuaMapa = {
  setor: string;
  rua: string;
  total: number;
  ocupadas: number;
  normais: number;
  bloqueadas: number;
  desativadas: number;
  percentual: number;
};
type GrupoStatus = {
  id: string;
  nome: string;
  quantidade: number;
  cor: string;
  filtroId: string;
};

function formatarInteiro(valor: number): string {
  return formatadorInteiro.format(valor);
}

function formatarQuantidade(valor: number | null): string {
  return valor === null ? "Não informado" : formatadorQuantidade.format(valor);
}

function formatarDuracao(duracaoMs: number): string {
  if (duracaoMs < 1000) return `${Math.max(0, Math.round(duracaoMs))} ms`;
  const segundos = Math.round(duracaoMs / 1000);
  const minutos = Math.floor(segundos / 60);
  const segundosRestantes = segundos % 60;
  return minutos > 0 ? `${minutos} min ${segundosRestantes} s` : `${segundosRestantes} s`;
}

function formatarAtualizacao(valor: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Fortaleza",
  }).format(new Date(valor));
}

function CartaoIndicador({
  titulo,
  valor,
  detalhe,
  icone: Icone,
  cor,
  selecionado,
  filtroAtivo,
  desabilitado = false,
  onClick,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  icone: LucideIcon;
  cor: string;
  selecionado: boolean;
  filtroAtivo: boolean;
  desabilitado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={desabilitado}
      aria-pressed={selecionado}
      aria-label={`${selecionado ? "Remover filtro de" : "Filtrar por"} ${titulo}`}
      onClick={onClick}
      className={`panel flex min-h-[62px] min-w-0 items-center gap-2 px-2 py-1.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[68px] sm:px-3 ${
        selecionado
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
          : filtroAtivo
            ? "opacity-55 hover:opacity-90"
            : ""
      }`}
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${cor}`}>
        <Icone aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
          {titulo}
        </span>
        <span className="block text-xl font-bold tabular-nums text-foreground sm:text-2xl">
          {valor}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{detalhe}</span>
      </span>
    </button>
  );
}

function statusCorresponde(statusId: string, filtro: string | null): boolean {
  if (filtro === null) return true;
  if (filtro === "bloqueadas") return ehStatusBloqueado(statusId) && statusId !== "16";
  if (filtro === "outros")
    return !ehStatusBloqueado(statusId) && statusId !== "1" && statusId !== "4";
  return statusId === filtro;
}

function ehStatusBloqueado(statusId: string): boolean {
  const id = Number(statusId);
  return id >= 10 && id <= 19;
}

function normalizarEnderecoBusca(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function obterMapaEnderecamento(
  dados: EnderecamentoWms,
  depositoId: string | null,
  filtro: FiltroEndereco,
  statusId: string | null,
  posicoesProdutosMultiplos: ReadonlySet<string> | null,
): RuaMapa[] {
  const ruas = new Map<string, RuaMapa>();
  for (const endereco of dados.enderecos) {
    if (posicoesProdutosMultiplos && !posicoesProdutosMultiplos.has(endereco.id)) continue;
    const chave = `${endereco.setor}|${endereco.rua}`;
    const rua = ruas.get(chave) ?? {
      setor: endereco.setor,
      rua: endereco.rua,
      total: 0,
      ocupadas: 0,
      normais: 0,
      bloqueadas: 0,
      desativadas: 0,
      percentual: 0,
    };
    rua.total += 1;
    ruas.set(chave, rua);
  }

  for (const endereco of dados.enderecos) {
    if (posicoesProdutosMultiplos && !posicoesProdutosMultiplos.has(endereco.id)) continue;
    const ocupada = endereco.ocupacoesProduto > 0;
    const pertenceAoDeposito =
      depositoId === null ||
      (endereco.depositos ?? []).some((deposito) => deposito.id === depositoId);
    const correspondeAoFiltro =
      filtro === "todos" ||
      (filtro === "ocupadas" && ocupada) ||
      (filtro === "vazias" && !ocupada) ||
      (filtro === "ativas" && endereco.statusId === "1") ||
      (filtro === "desativadas" && endereco.statusId === "4");
    if (
      !pertenceAoDeposito ||
      !correspondeAoFiltro ||
      !statusCorresponde(endereco.statusId, statusId)
    ) {
      continue;
    }
    const chaveRua = `${endereco.setor}|${endereco.rua}`;
    const resumoRua = ruas.get(chaveRua);
    if (!resumoRua) continue;
    if (ehStatusBloqueado(endereco.statusId)) resumoRua.bloqueadas += 1;
    else if (endereco.statusId === "4") resumoRua.desativadas += 1;
    else if (ocupada) resumoRua.ocupadas += 1;
    else if (endereco.statusId === "1") resumoRua.normais += 1;
  }

  return [...ruas.values()]
    .map((rua) => ({
      ...rua,
      percentual: rua.total === 0 ? 0 : Math.round((rua.ocupadas / rua.total) * 100),
    }))
    .sort(
      (a, b) =>
        a.setor.localeCompare(b.setor, "pt-BR", { numeric: true }) ||
        a.rua.localeCompare(b.rua, "pt-BR", { numeric: true }),
    );
}

function anexarDadosDeposito(
  dados: EnderecamentoWms,
  resultado: OcupacoesDepositoWms,
): EnderecamentoWms {
  const dadosComDepositos = {
    ...dados,
    depositos: resultado.depositos,
    produtosComMultiplosEnderecos: resultado.produtosComMultiplosEnderecos,
    itensPorPosicao: resultado.itensPorPosicao,
    enderecos: dados.enderecos.map((endereco) => ({
      ...endereco,
      codigoPosicao:
        endereco.codigoPosicao ?? resultado.codigoPosicaoPorPosicao[endereco.id] ?? null,
      depositos: resultado.depositosPorPosicao[endereco.id] ?? [],
    })),
    temposApi: [
      ...dados.temposApi.filter((api) => api.funcao !== resultado.tempoApi.funcao),
      resultado.tempoApi,
    ],
  };
  return recalcularOcupacaoPelosItens(dadosComDepositos, resultado.itensPorPosicao, true);
}

function recalcularOcupacaoPelosItens(
  dados: EnderecamentoWms,
  itensPorPosicao: Record<string, ItemEnderecoArmazem[]>,
  carregada: boolean,
): EnderecamentoWms {
  const mapaRua = new Map<
    string,
    { setor: string; rua: string; total: number; ocupadas: number }
  >();
  const mapaSetor = new Map<string, { setor: string; total: number; ocupadas: number }>();
  let posicoesOcupadas = 0;
  let quantidadeOcupacoesProduto = 0;
  const enderecos = dados.enderecos.map((endereco) => {
    const quantidadeItens = carregada ? (itensPorPosicao[endereco.id]?.length ?? 0) : 0;
    const ocupada = quantidadeItens > 0;
    if (ocupada) posicoesOcupadas += 1;
    quantidadeOcupacoesProduto += quantidadeItens;

    const chaveRua = `${endereco.setor}|${endereco.rua}`;
    const resumoRua = mapaRua.get(chaveRua) ?? {
      setor: endereco.setor,
      rua: endereco.rua,
      total: 0,
      ocupadas: 0,
    };
    resumoRua.total += 1;
    if (ocupada) resumoRua.ocupadas += 1;
    mapaRua.set(chaveRua, resumoRua);

    const resumoSetor = mapaSetor.get(endereco.setor) ?? {
      setor: endereco.setor,
      total: 0,
      ocupadas: 0,
    };
    resumoSetor.total += 1;
    if (ocupada) resumoSetor.ocupadas += 1;
    mapaSetor.set(endereco.setor, resumoSetor);

    return {
      ...endereco,
      descricaoCompleta:
        endereco.descricaoCompleta ||
        [
          endereco.setor,
          endereco.rua,
          endereco.modulo,
          endereco.prateleira,
          `${endereco.posicao}${endereco.sufixo ?? ""}`,
        ].join(" - "),
      ocupacoesProduto: quantidadeItens,
    };
  });
  const totalPosicoes = enderecos.length;

  return {
    ...dados,
    enderecos,
    ocupacaoItensCarregada: carregada,
    posicoesOcupadas,
    posicoesVazias: totalPosicoes - posicoesOcupadas,
    quantidadeOcupacoesProduto,
    percentualOcupacao:
      totalPosicoes === 0 ? 0 : Math.round((posicoesOcupadas / totalPosicoes) * 1000) / 10,
    ocupacaoPorSetor: [...mapaSetor.values()]
      .map((setor) => ({
        ...setor,
        percentual: setor.total === 0 ? 0 : Math.round((setor.ocupadas / setor.total) * 100),
      }))
      .sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR", { numeric: true })),
    mapaCalor: [...mapaRua.values()]
      .map((rua) => ({
        ...rua,
        percentual: rua.total === 0 ? 0 : Math.round((rua.ocupadas / rua.total) * 100),
      }))
      .sort(
        (a, b) =>
          a.setor.localeCompare(b.setor, "pt-BR", { numeric: true }) ||
          a.rua.localeCompare(b.rua, "pt-BR", { numeric: true }),
      ),
  };
}

export function EnderecamentoModulo() {
  const [dados, setDados] = useState<EnderecamentoWms | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDepositos, setErroDepositos] = useState<string | null>(null);
  const [erroCache, setErroCache] = useState<string | null>(null);
  const [dadosRestauradosCache, setDadosRestauradosCache] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [filtroEndereco, setFiltroEndereco] = useState<FiltroEndereco>("todos");
  const [depositoSelecionado, setDepositoSelecionado] = useState<string | null>(null);
  const [setorSelecionado, setSetorSelecionado] = useState<string | null>(null);
  const [ruaSelecionada, setRuaSelecionada] = useState<string | null>(null);
  const [statusSelecionado, setStatusSelecionado] = useState<string | null>(null);
  const [somenteProdutosMultiplos, setSomenteProdutosMultiplos] = useState(false);
  const [buscaEndereco, setBuscaEndereco] = useState("");
  const [mensagemBusca, setMensagemBusca] = useState<string | null>(null);
  const [enderecoItens, setEnderecoItens] = useState<EnderecoArmazem | null>(null);
  const [itensEnderecoCarregados, setItensEnderecoCarregados] = useState<
    ItemEnderecoArmazem[] | null
  >(null);
  const [carregandoItensEndereco, setCarregandoItensEndereco] = useState(false);
  const [erroItensEndereco, setErroItensEndereco] = useState<string | null>(null);
  const [enderecoSelecionado, setEnderecoSelecionado] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<ProgressoEnderecamentoWms | null>(null);
  const [erroProgresso, setErroProgresso] = useState<string | null>(null);
  const requisicaoEmAndamento = useRef(false);
  const resultadoDepositosRef = useRef<OcupacoesDepositoWms | null>(null);
  const dadosDaConsultaRef = useRef<EnderecamentoWms | null>(null);
  const ultimaAtualizacaoRef = useRef(0);
  const filaGravacaoCacheRef = useRef<Promise<void>>(Promise.resolve());
  const requisicaoItensRef = useRef(0);
  const consultarPosicoes = useServerFn(consultarEnderecamentoPosicoesWms);
  const consultarItensEndereco = useServerFn(consultarItensEnderecoWms);
  const consultarDepositos = useServerFn(consultarOcupacoesDepositoWms);
  const consultarProgresso = useServerFn(obterProgressoEnderecamentoWms);

  const persistirCache = useCallback((dadosCache: EnderecamentoWms, completo: boolean) => {
    filaGravacaoCacheRef.current = filaGravacaoCacheRef.current
      .then(() => salvarCacheEnderecamento(dadosCache, completo))
      .catch((error: unknown) => {
        setErroCache(
          error instanceof Error
            ? error.message
            : "Não foi possível salvar os dados locais do Endereçamento.",
        );
      });
  }, []);

  const abrirDetalhesItens = async (endereco: EnderecoArmazem) => {
    const requisicao = ++requisicaoItensRef.current;
    setEnderecoItens(endereco);
    setItensEnderecoCarregados(dados?.itensPorPosicao?.[endereco.id] ?? null);
    setCarregandoItensEndereco(true);
    setErroItensEndereco(null);
    try {
      const itens = await consultarItensEndereco({
        data: {
          posicaoId: endereco.id,
          ...(endereco.codigoPosicao ? { codigoPosicao: endereco.codigoPosicao } : {}),
        },
      });
      if (requisicao !== requisicaoItensRef.current) return;
      setItensEnderecoCarregados(itens);
    } catch (error) {
      if (requisicao !== requisicaoItensRef.current) return;
      setErroItensEndereco(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar os itens deste endereço.",
      );
    } finally {
      if (requisicao === requisicaoItensRef.current) setCarregandoItensEndereco(false);
    }
  };

  const fecharDetalhesItens = () => {
    requisicaoItensRef.current += 1;
    setEnderecoItens(null);
    setItensEnderecoCarregados(null);
    setCarregandoItensEndereco(false);
    setErroItensEndereco(null);
  };

  const atualizar = useCallback(async () => {
    if (requisicaoEmAndamento.current) return;
    requisicaoEmAndamento.current = true;
    ultimaAtualizacaoRef.current = Date.now();
    const requestId = crypto.randomUUID();
    let monitorando = true;
    let consultaProgressoEmAndamento = false;
    setCarregando(true);
    setErro(null);
    setErroDepositos(null);
    setErroCache(null);
    setErroProgresso(null);
    resultadoDepositosRef.current = null;
    dadosDaConsultaRef.current = null;
    setProgresso({
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
    const intervaloProgresso = window.setInterval(() => {
      if (consultaProgressoEmAndamento || !monitorando) return;
      consultaProgressoEmAndamento = true;
      void consultarProgresso({ data: { requestId } })
        .then((atualizacao) => {
          setProgresso(atualizacao);
          setErroProgresso(null);
        })
        .catch(() => {
          setErroProgresso("Não foi possível atualizar o progresso agora; tentando novamente.");
        })
        .finally(() => {
          consultaProgressoEmAndamento = false;
        });
    }, INTERVALO_CONSULTA_PROGRESSO_MS);
    try {
      const consultaPosicoes = consultarPosicoes({ data: { requestId } })
        .then((resultado) => {
          const dadosAtualizados = resultadoDepositosRef.current
            ? anexarDadosDeposito(resultado, resultadoDepositosRef.current)
            : resultado;
          dadosDaConsultaRef.current = dadosAtualizados;
          setDadosRestauradosCache(false);
          setDados(dadosAtualizados);
          persistirCache(dadosAtualizados, resultadoDepositosRef.current !== null);
          setPagina(0);
          setProgresso((atual) =>
            atual
              ? {
                  ...atual,
                  apis: atual.apis.map((api) =>
                    api.funcao === "webServiceGetEnderecamento"
                      ? {
                          ...api,
                          paginasConcluidas: resultado.temposApi[0]?.paginas ?? 0,
                          totalPaginas: resultado.temposApi[0]?.paginas ?? null,
                          tempoDecorridoMs: resultado.temposApi[0]?.duracaoMs ?? 0,
                        }
                      : api,
                  ),
                }
              : atual,
          );
        })
        .catch((error: unknown) => {
          setErro(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os endereços do armazém.",
          );
        });
      const consultaDepositos = consultarDepositos({ data: { requestId } })
        .then((resultado) => {
          resultadoDepositosRef.current = resultado;
          const dadosDaConsulta = dadosDaConsultaRef.current;
          if (dadosDaConsulta) {
            const dadosAtualizados = anexarDadosDeposito(dadosDaConsulta, resultado);
            dadosDaConsultaRef.current = dadosAtualizados;
            setDadosRestauradosCache(false);
            setDados(dadosAtualizados);
            persistirCache(dadosAtualizados, true);
          }
          ultimaAtualizacaoRef.current = Date.now();
          setProgresso((atual) =>
            atual
              ? {
                  ...atual,
                  apis: atual.apis.map((api) =>
                    api.funcao === "webServiceGetOcupacaoProduto"
                      ? {
                          ...api,
                          paginasConcluidas: resultado.tempoApi.paginas,
                          totalPaginas: resultado.tempoApi.paginas,
                          tempoDecorridoMs: resultado.tempoApi.duracaoMs,
                        }
                      : api,
                  ),
                }
              : atual,
          );
        })
        .catch((error: unknown) => {
          setErroDepositos(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os depósitos e as ocupações.",
          );
        });
      await Promise.all([consultaPosicoes, consultaDepositos]);
    } finally {
      monitorando = false;
      window.clearInterval(intervaloProgresso);
      requisicaoEmAndamento.current = false;
      setCarregando(false);
    }
  }, [consultarDepositos, consultarPosicoes, consultarProgresso, persistirCache]);

  useEffect(() => {
    let ativo = true;
    const inicializar = async () => {
      let precisaAtualizar = true;
      try {
        const cache = await lerCacheEnderecamento();
        if (!ativo) return;
        if (cache) {
          const cacheComOcupacaoValidada = recalcularOcupacaoPelosItens(
            cache.dados,
            cache.dados.itensPorPosicao ?? {},
            cache.dados.itensPorPosicao !== undefined,
          );
          setDados(cacheComOcupacaoValidada);
          setDadosRestauradosCache(true);
          ultimaAtualizacaoRef.current = cache.salvoEm;
          precisaAtualizar =
            cache.versao !== VERSAO_CACHE_ENDERECAMENTO ||
            !cache.completo ||
            !cacheComOcupacaoValidada.ocupacaoItensCarregada ||
            Date.now() - cache.salvoEm >= INTERVALO_ATUALIZACAO_MS;
          setCarregando(precisaAtualizar);
        }
      } catch (error) {
        if (!ativo) return;
        setErroCache(
          error instanceof Error
            ? error.message
            : "Não foi possível restaurar os últimos dados locais do Endereçamento.",
        );
      }
      if (ativo && precisaAtualizar) setCarregando(true);
      if (ativo && precisaAtualizar) void atualizar();
    };
    void inicializar();
    const intervalo = window.setInterval(() => {
      if (
        !requisicaoEmAndamento.current &&
        Date.now() - ultimaAtualizacaoRef.current >= INTERVALO_ATUALIZACAO_MS
      ) {
        void atualizar();
      }
    }, VERIFICAR_ATUALIZACAO_MS);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
    };
  }, [atualizar]);

  const enderecos = dados?.enderecos ?? [];
  const depositos = dados?.depositos ?? [];
  const ocupacaoItensCarregada = dados?.ocupacaoItensCarregada ?? false;
  const posicoesProdutosMultiplos = useMemo(() => {
    const enderecosPorProduto = new Map<string, Set<string>>();
    for (const [posicaoId, itens] of Object.entries(dados?.itensPorPosicao ?? {})) {
      for (const item of itens) {
        const posicoes = enderecosPorProduto.get(item.id) ?? new Set<string>();
        posicoes.add(posicaoId);
        enderecosPorProduto.set(item.id, posicoes);
      }
    }
    return new Set(
      [...enderecosPorProduto.values()]
        .filter((posicoes) => posicoes.size > 1)
        .flatMap((posicoes) => [...posicoes]),
    );
  }, [dados?.itensPorPosicao]);
  const enderecosGeograficos = enderecos.filter(
    (endereco) =>
      (setorSelecionado === null || endereco.setor === setorSelecionado) &&
      (ruaSelecionada === null || endereco.rua === ruaSelecionada) &&
      (enderecoSelecionado === null || endereco.id === enderecoSelecionado),
  );
  const enderecosNoDepositoNaArea = enderecosGeograficos.filter((endereco) => {
    if (
      depositoSelecionado &&
      !(endereco.depositos ?? []).some((deposito) => deposito.id === depositoSelecionado)
    ) {
      return false;
    }
    return true;
  });
  const enderecosEscopoFisico = enderecosGeograficos.filter((endereco) =>
    statusCorresponde(endereco.statusId, statusSelecionado),
  );
  const enderecosStatusEscopo = enderecosNoDepositoNaArea.filter((endereco) =>
    statusCorresponde(endereco.statusId, statusSelecionado),
  );
  const enderecosFiltrados = enderecosStatusEscopo.filter((endereco) => {
    if (somenteProdutosMultiplos && !posicoesProdutosMultiplos.has(endereco.id)) return false;
    const ocupada = endereco.ocupacoesProduto > 0;
    switch (filtroEndereco) {
      case "ocupadas":
        return ocupada;
      case "vazias":
        return !ocupada;
      case "ativas":
        return endereco.statusId === "1";
      case "desativadas":
        return endereco.statusId === "4";
      default:
        return true;
    }
  });
  const filtroAtivo =
    filtroEndereco !== "todos" ||
    depositoSelecionado !== null ||
    setorSelecionado !== null ||
    ruaSelecionada !== null ||
    statusSelecionado !== null ||
    somenteProdutosMultiplos;
  const alternarFiltro = (filtro: FiltroEndereco) => {
    setFiltroEndereco((atual) => (atual === filtro ? "todos" : filtro));
    setPagina(0);
  };
  const alternarDeposito = (depositoId: string | null) => {
    setDepositoSelecionado((atual) => (atual === depositoId ? null : depositoId));
    setPagina(0);
  };
  const limparFiltros = () => {
    setFiltroEndereco("todos");
    setDepositoSelecionado(null);
    setSetorSelecionado(null);
    setRuaSelecionada(null);
    setStatusSelecionado(null);
    setSomenteProdutosMultiplos(false);
    setEnderecoSelecionado(null);
    setBuscaEndereco("");
    setMensagemBusca(null);
    setEnderecoItens(null);
    setPagina(0);
  };
  const alternarSetor = (setor: string) => {
    const proximoSetor = setorSelecionado === setor ? null : setor;
    setSetorSelecionado(proximoSetor);
    setRuaSelecionada(null);
    setEnderecoSelecionado(null);
    setPagina(0);
  };
  const alternarRua = (setor: string, rua: string) => {
    const proximaSelecao =
      setorSelecionado === setor && ruaSelecionada === rua ? null : { setor, rua };
    setSetorSelecionado(proximaSelecao?.setor ?? null);
    setRuaSelecionada(proximaSelecao?.rua ?? null);
    setEnderecoSelecionado(null);
    setPagina(0);
  };
  const alternarStatus = (statusId: string) => {
    setStatusSelecionado((atual) => (atual === statusId ? null : statusId));
    setPagina(0);
  };
  const buscarEndereco = () => {
    const chaveBusca = normalizarEnderecoBusca(buscaEndereco);
    if (!chaveBusca) {
      setEnderecoSelecionado(null);
      setMensagemBusca("Digite parte do endereço para localizar.");
      return;
    }
    const candidatos = depositoSelecionado
      ? enderecos.filter((endereco) =>
          (endereco.depositos ?? []).some((deposito) => deposito.id === depositoSelecionado),
        )
      : enderecos;
    const encontrado = candidatos.find((endereco) =>
      normalizarEnderecoBusca(
        [endereco.setor, endereco.rua, endereco.modulo, endereco.prateleira, endereco.posicao].join(
          " ",
        ),
      ).includes(chaveBusca),
    );
    if (!encontrado) {
      setEnderecoSelecionado(null);
      setMensagemBusca(
        depositoSelecionado
          ? "Endereço não encontrado nas posições vinculadas a este depósito."
          : "Endereço não encontrado.",
      );
      return;
    }
    setSetorSelecionado(encontrado.setor);
    setRuaSelecionada(encontrado.rua);
    setEnderecoSelecionado(encontrado.id);
    setStatusSelecionado(null);
    setFiltroEndereco("todos");
    setSomenteProdutosMultiplos(false);
    setMensagemBusca(null);
    setPagina(0);
  };
  const totalPaginas = Math.max(1, Math.ceil(enderecosFiltrados.length / ENDERECOS_POR_PAGINA));
  const totalEscopo = enderecosEscopoFisico.length;
  const totalExibido = enderecosFiltrados.length;
  const posicoesOcupadasEscopo = enderecosStatusEscopo.filter(
    (endereco) => endereco.ocupacoesProduto > 0,
  ).length;
  const posicoesVaziasEscopo = enderecosStatusEscopo.filter(
    (endereco) => endereco.ocupacoesProduto === 0,
  ).length;
  const percentualOcupacao = totalEscopo === 0 ? 0 : (posicoesOcupadasEscopo / totalEscopo) * 100;
  const mapaEnderecamento = dados
    ? obterMapaEnderecamento(
        dados,
        depositoSelecionado,
        filtroEndereco,
        statusSelecionado,
        somenteProdutosMultiplos ? posicoesProdutosMultiplos : null,
      )
    : [];
  const enderecosStatusVisiveis = enderecosFiltrados;
  const gruposStatus: GrupoStatus[] = [
    {
      id: "desativadas",
      nome: "Desativadas",
      quantidade: enderecosStatusVisiveis.filter((endereco) => endereco.statusId === "4").length,
      cor: CORES_STATUS.desativadas,
      filtroId: "4",
    },
    {
      id: "normais",
      nome: "Normais",
      quantidade: enderecosStatusVisiveis.filter((endereco) => endereco.statusId === "1").length,
      cor: CORES_STATUS.normais,
      filtroId: "1",
    },
    {
      id: "bloqueadas",
      nome: "Bloqueadas",
      quantidade: enderecosStatusVisiveis.filter(
        (endereco) =>
          endereco.statusId !== "1" && endereco.statusId !== "4" && endereco.statusId !== "16",
      ).length,
      cor: CORES_STATUS.bloqueadas,
      filtroId: "bloqueadas",
    },
    {
      id: "outros",
      nome: "Outros status",
      quantidade: enderecosStatusVisiveis.filter(
        (endereco) =>
          !ehStatusBloqueado(endereco.statusId) &&
          endereco.statusId !== "1" &&
          endereco.statusId !== "4",
      ).length,
      cor: "#a78bfa",
      filtroId: "outros",
    },
    {
      id: "inventario",
      nome: "Bloqueadas para inventário",
      quantidade: enderecosStatusVisiveis.filter((endereco) => endereco.statusId === "16").length,
      cor: CORES_STATUS.inventario,
      filtroId: "16",
    },
  ];
  const totalStatusVisivel = gruposStatus.reduce((total, status) => total + status.quantidade, 0);
  const gruposStatusExibidos = gruposStatus.filter(
    (grupo) => grupo.id !== "outros" || grupo.quantidade > 0,
  );
  const nomeDepositoSelecionado = depositos.find(
    (deposito) => deposito.id === depositoSelecionado,
  )?.nome;
  const percentualProgresso =
    progresso && progresso.apis.length > 0
      ? Math.round(
          (progresso.apis.reduce(
            (total, api) =>
              total +
              (api.totalPaginas && api.totalPaginas > 0
                ? Math.min(1, api.paginasConcluidas / api.totalPaginas)
                : 0),
            0,
          ) /
            progresso.apis.length) *
            100,
        )
      : 0;
  const setoresMapa = [...new Set(mapaEnderecamento.map((rua) => rua.setor))];
  const ruasMapa = mapaEnderecamento.filter(
    (rua) => setorSelecionado === null || rua.setor === setorSelecionado,
  );
  const ruasOrdenadas = [...ruasMapa].sort((a, b) =>
    a.rua.localeCompare(b.rua, "pt-BR", { numeric: true }),
  );
  const mapaParaExibicao = setorSelecionado ? ruasOrdenadas : mapaEnderecamento;
  const mapaFiltrado = mapaParaExibicao.filter(
    (rua) =>
      ruaSelecionada === null || (rua.setor === setorSelecionado && rua.rua === ruaSelecionada),
  );
  const setoresResumoPainel = [
    ...mapaEnderecamento
      .reduce((setores, rua) => {
        const setor = setores.get(rua.setor) ?? {
          setor: rua.setor,
          total: 0,
          ocupadas: 0,
          percentual: 0,
        };
        setor.total += rua.total;
        setor.ocupadas += rua.ocupadas;
        setores.set(rua.setor, setor);
        return setores;
      }, new Map<string, { setor: string; total: number; ocupadas: number; percentual: number }>())
      .values(),
  ]
    .map((setor) => ({
      ...setor,
      percentual: setor.total === 0 ? 0 : Math.round((setor.ocupadas / setor.total) * 100),
    }))
    .sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR", { numeric: true }));
  const setoresSemOcupacao =
    ocupacaoItensCarregada && depositoSelecionado === null
      ? setoresResumoPainel.filter((setor) => setor.percentual === 0).length
      : null;
  const ruasOcupadasTotal = mapaEnderecamento.filter(
    (rua) => rua.total > 0 && rua.percentual === 100,
  ).length;
  const setoresParaInsights = setoresResumoPainel.filter(
    (setor) => setor.setor !== "T" && setor.setor !== "F",
  );
  const setorMaisOcupado = [...setoresParaInsights].sort((a, b) => b.percentual - a.percentual)[0];
  const setorMaisDisponivel = [...setoresParaInsights].sort(
    (a, b) => a.percentual - b.percentual,
  )[0];
  const ruaMaisOcupada = [...mapaEnderecamento].sort(
    (a, b) => b.percentual - a.percentual || b.ocupadas - a.ocupadas,
  )[0];
  const quantidadeBloqueadas = enderecosStatusEscopo.filter(
    (endereco) => ehStatusBloqueado(endereco.statusId) && endereco.statusId !== "16",
  ).length;
  const bloqueadasInventario = enderecosStatusEscopo.filter(
    (endereco) => endereco.statusId === "16",
  ).length;
  const alertasAtivos = [
    quantidadeBloqueadas > 0,
    ruasOcupadasTotal > 0,
    setoresSemOcupacao !== null && setoresSemOcupacao > 0,
    (dados?.produtosComMultiplosEnderecos ?? 0) > 0,
  ].filter(Boolean).length;
  const enderecosVisiveis = enderecosFiltrados.slice(
    pagina * ENDERECOS_POR_PAGINA,
    (pagina + 1) * ENDERECOS_POR_PAGINA,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BarraModulos />
      <main className="mx-auto max-w-[1920px] space-y-2 px-2 pb-16 pt-2 sm:px-4 sm:pb-4 md:pl-16">
        <header className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-3 py-2 sm:px-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary sm:text-xs">
                Operação do armazém
              </p>
              <h1 className="text-lg font-black tracking-[0.12em] text-foreground sm:text-xl">
                ENDEREÇAMENTO
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Ocupação e estrutura física · BRANCO01
              </p>
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 sm:pl-4">
              {dados ? (
                <>
                  <h2 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                    Tempo de retorno das APIs
                  </h2>
                  {dados.temposApi.map((api) => (
                    <p key={api.funcao} className="text-xs text-foreground sm:text-sm">
                      <span className="text-muted-foreground">
                        {api.funcao === "webServiceGetEnderecamento"
                          ? "Endereços"
                          : "Ocupações por depósito"}
                        :
                      </span>{" "}
                      <strong className="tabular-nums">{formatarDuracao(api.duracaoMs)}</strong>
                      <span className="ml-1 text-[10px] text-muted-foreground sm:text-xs">
                        ({formatarInteiro(api.paginas)} páginas)
                      </span>
                    </p>
                  ))}
                </>
              ) : null}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={limparFiltros}
                disabled={!filtroAtivo}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background/50 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              >
                <BrushCleaning aria-hidden="true" className="size-4" />
                Limpar filtros
              </button>
              <DetalhesPainel titulo="Endereçamento" secoes={SECOES_DETALHES_ENDERECAMENTO} />
              <div className="text-right text-xs text-muted-foreground">
                <p>
                  {carregando
                    ? "Atualizando endereços..."
                    : dadosRestauradosCache
                      ? "Últimos dados salvos"
                      : "Última atualização"}
                </p>
                <p className="font-medium text-foreground">
                  {dados ? formatarAtualizacao(dados.atualizadoEm) : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void atualizar()}
                disabled={carregando}
                aria-label="Atualizar endereçamento"
                title="Atualizar agora"
                className="grid size-9 place-items-center rounded-lg border border-border bg-background/50 text-primary transition-colors hover:bg-primary/10 disabled:cursor-wait disabled:opacity-50"
              >
                <RefreshCw className={`size-4 ${carregando ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </header>

        {carregando && progresso ? (
          <section
            className="panel space-y-3 px-4 py-3"
            aria-label="Progresso de carregamento das APIs"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <RefreshCw aria-hidden="true" className="size-4 animate-spin text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Carregando dados das APIs</h2>
              </div>
              <span className="text-sm font-bold tabular-nums text-primary">
                {percentualProgresso}%
              </span>
            </div>
            <div
              className="h-3 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Progresso total do carregamento"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentualProgresso}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${percentualProgresso}%` }}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {progresso.apis.map((api) => {
                const percentualApi =
                  api.totalPaginas && api.totalPaginas > 0
                    ? Math.round((api.paginasConcluidas / api.totalPaginas) * 100)
                    : 0;
                const nomeApi =
                  api.funcao === "webServiceGetEnderecamento"
                    ? "Endereços"
                    : "Ocupações por depósito";
                return (
                  <div
                    key={api.funcao}
                    className="rounded-lg border border-border/70 bg-background/40 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <span className="font-semibold text-foreground">{nomeApi}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {api.totalPaginas
                          ? `${api.paginasConcluidas}/${api.totalPaginas} páginas · ${percentualApi}%`
                          : "Consultando primeira página"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tempo decorrido: {formatarDuracao(api.tempoDecorridoMs)}
                    </p>
                  </div>
                );
              })}
            </div>
            {erroProgresso ? (
              <p role="status" className="text-xs text-amber-300">
                O carregamento continua, mas o progresso detalhado está temporariamente
                indisponível: {erroProgresso}
              </p>
            ) : null}
          </section>
        ) : null}

        {erro ? (
          <div
            role="alert"
            className="panel flex flex-wrap items-center justify-between gap-3 border-destructive/50 px-4 py-3 text-sm"
          >
            <span className="flex items-center gap-2 text-destructive">
              <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
              {erro}
            </span>
            <button
              type="button"
              onClick={() => void atualizar()}
              className="rounded-md border border-border px-3 py-1.5 font-semibold hover:bg-muted"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {erroDepositos ? (
          <div
            role="alert"
            className="panel flex flex-wrap items-center justify-between gap-3 border-amber-500/50 px-4 py-3 text-sm"
          >
            <span className="text-amber-300">
              Endereços carregados, mas os depósitos não puderam ser carregados: {erroDepositos}
            </span>
            <button
              type="button"
              onClick={() => void atualizar()}
              className="rounded-md border border-border px-3 py-1.5 font-semibold hover:bg-muted"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {erroCache ? (
          <div role="status" className="panel border-amber-500/50 px-4 py-3 text-sm text-amber-300">
            Os dados continuam disponíveis nesta sessão, mas o cache local não pôde ser atualizado:{" "}
            {erroCache}
          </div>
        ) : null}

        {dados ? (
          <>
            <section
              aria-label="Indicadores de ocupação"
              role="group"
              className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6"
            >
              <CartaoIndicador
                titulo="Posições"
                valor={formatarInteiro(totalExibido)}
                detalhe={
                  depositoSelecionado
                    ? "posições vinculadas ao depósito"
                    : "endereços no armazém · limpar filtros"
                }
                icone={Warehouse}
                cor="bg-primary/15 text-primary"
                selecionado={!filtroAtivo}
                filtroAtivo={filtroAtivo}
                onClick={limparFiltros}
              />
              <CartaoIndicador
                titulo="Ocupadas"
                valor={ocupacaoItensCarregada ? formatarInteiro(posicoesOcupadasEscopo) : "—"}
                detalhe={
                  !ocupacaoItensCarregada
                    ? "consultando itens endereçados"
                    : depositoSelecionado
                      ? "posições ocupadas vinculadas"
                      : "com itens retornados pela API"
                }
                icone={Package}
                cor="bg-emerald-500/15 text-emerald-400"
                selecionado={filtroEndereco === "ocupadas"}
                filtroAtivo={filtroAtivo}
                desabilitado={!ocupacaoItensCarregada}
                onClick={() => alternarFiltro("ocupadas")}
              />
              <CartaoIndicador
                titulo="Vazias"
                valor={
                  !ocupacaoItensCarregada || depositoSelecionado
                    ? "—"
                    : formatarInteiro(posicoesVaziasEscopo)
                }
                detalhe={
                  !ocupacaoItensCarregada
                    ? "consultando itens endereçados"
                    : depositoSelecionado
                      ? "a API não associa vazias a depósitos"
                      : "sem itens retornados pela API"
                }
                icone={MapPin}
                cor="bg-sky-500/15 text-sky-400"
                selecionado={filtroEndereco === "vazias" && depositoSelecionado === null}
                filtroAtivo={filtroAtivo}
                desabilitado={!ocupacaoItensCarregada}
                onClick={() => {
                  if (depositoSelecionado) {
                    setDepositoSelecionado(null);
                    setFiltroEndereco("vazias");
                    setPagina(0);
                  } else {
                    alternarFiltro("vazias");
                  }
                }}
              />
              <CartaoIndicador
                titulo="Ocupação"
                valor={
                  ocupacaoItensCarregada
                    ? `${formatadorPercentual.format(percentualOcupacao)}%`
                    : "—"
                }
                detalhe={
                  !ocupacaoItensCarregada
                    ? "consultando itens endereçados"
                    : depositoSelecionado
                      ? "posições vinculadas / posições físicas"
                      : "posições com itens retornados"
                }
                icone={Package}
                cor="bg-orange-500/15 text-orange-400"
                selecionado={filtroEndereco === "ocupadas"}
                filtroAtivo={filtroAtivo}
                desabilitado={!ocupacaoItensCarregada}
                onClick={() => alternarFiltro("ocupadas")}
              />
              <CartaoIndicador
                titulo="Ativas"
                valor={formatarInteiro(
                  enderecosNoDepositoNaArea.filter((endereco) => endereco.statusId === "1").length,
                )}
                detalhe="status normal"
                icone={MapPin}
                cor="bg-violet-500/15 text-violet-400"
                selecionado={filtroEndereco === "ativas"}
                filtroAtivo={filtroAtivo}
                onClick={() => alternarFiltro("ativas")}
              />
              <CartaoIndicador
                titulo="Desativadas"
                valor={formatarInteiro(
                  enderecosNoDepositoNaArea.filter((endereco) => endereco.statusId === "4").length,
                )}
                detalhe="fora de operação"
                icone={CircleAlert}
                cor="bg-rose-500/15 text-rose-400"
                selecionado={filtroEndereco === "desativadas"}
                filtroAtivo={filtroAtivo}
                onClick={() => alternarFiltro("desativadas")}
              />
            </section>

            <section
              aria-label="Filtrar endereços por depósito"
              className="panel flex min-w-0 items-center gap-2 p-2"
            >
              <div className="shrink-0 pr-1">
                <h2 className="text-xs font-bold text-foreground">Depósitos</h2>
                <p className="hidden text-[10px] text-muted-foreground xl:block">
                  Toque para filtrar
                </p>
              </div>
              {carregando && depositos.length === 0 ? (
                <p className="shrink-0 text-xs text-muted-foreground">Carregando depósitos...</p>
              ) : null}
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  aria-pressed={depositoSelecionado === null}
                  onClick={() => alternarDeposito(null)}
                  className={`min-h-9 shrink-0 rounded-lg border px-3 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    depositoSelecionado === null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  Todos · {formatarInteiro(enderecos.length)}
                </button>
                {depositos.map((deposito) => {
                  const selecionado = depositoSelecionado === deposito.id;
                  return (
                    <button
                      key={deposito.id}
                      type="button"
                      aria-pressed={selecionado}
                      aria-label={`${selecionado ? "Remover filtro de" : "Filtrar por"} depósito ${deposito.nome}`}
                      onClick={() => alternarDeposito(deposito.id)}
                      className={`min-h-9 shrink-0 rounded-lg border px-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selecionado
                          ? "border-sky-400 bg-sky-400 text-slate-950"
                          : "border-sky-400/50 bg-background text-sky-300 hover:bg-sky-400/10"
                      }`}
                    >
                      <span className="text-xs font-bold">{deposito.nome}</span>
                      <span className="ml-1.5 text-[10px] tabular-nums opacity-90">
                        {formatarInteiro(deposito.posicoes)} pos.
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-2 xl:grid-cols-[minmax(0,1.65fr)_minmax(390px,0.9fr)]">
              <article className="panel min-w-0 overflow-hidden p-2.5 sm:p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-foreground">Mapa de endereçamento</h2>
                    <p className="text-[11px] text-muted-foreground">
                      Toque em uma rua para filtrar ·{" "}
                      {depositoSelecionado
                        ? `ocupação vinculada a ${nomeDepositoSelecionado ?? "depósito"}`
                        : "distribuição física do armazém"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="size-2.5 rounded-sm bg-emerald-500" /> Livre
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-2.5 rounded-sm bg-sky-500" /> Ocupada
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-2.5 rounded-sm bg-amber-500" /> Bloqueada
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-2.5 rounded-sm bg-slate-500" /> Desativada
                    </span>
                  </div>
                </div>
                <div className="mb-2 grid grid-cols-[minmax(90px,0.7fr)_minmax(90px,0.7fr)_minmax(150px,1.3fr)_auto] gap-1.5">
                  <select
                    aria-label="Filtrar mapa por setor"
                    value={setorSelecionado ?? ""}
                    onChange={(event) => {
                      setSetorSelecionado(event.target.value || null);
                      setRuaSelecionada(null);
                      setEnderecoSelecionado(null);
                      setPagina(0);
                    }}
                    className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                  >
                    <option value="">Todos os setores</option>
                    {setoresMapa.map((setor) => (
                      <option key={setor} value={setor}>
                        Setor {setor}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filtrar mapa por rua"
                    value={ruaSelecionada ? `${setorSelecionado}|${ruaSelecionada}` : ""}
                    onChange={(event) => {
                      const valorSelecionado = event.target.value;
                      if (valorSelecionado) {
                        const [setor, rua] = valorSelecionado.split("|");
                        setSetorSelecionado(setor || null);
                        setRuaSelecionada(rua || null);
                      } else {
                        setRuaSelecionada(null);
                      }
                      setEnderecoSelecionado(null);
                      setPagina(0);
                    }}
                    className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                  >
                    <option value="">Todas as ruas</option>
                    {ruasMapa.map((rua) => (
                      <option key={`${rua.setor}|${rua.rua}`} value={`${rua.setor}|${rua.rua}`}>
                        {rua.setor} · Rua {rua.rua}
                      </option>
                    ))}
                  </select>
                  <form
                    className="flex min-w-0"
                    onSubmit={(event) => {
                      event.preventDefault();
                      buscarEndereco();
                    }}
                  >
                    <input
                      aria-label="Buscar endereço"
                      value={buscaEndereco}
                      onChange={(event) => {
                        setBuscaEndereco(event.target.value);
                        setMensagemBusca(null);
                      }}
                      placeholder="Buscar endereço..."
                      className="h-9 min-w-0 flex-1 rounded-l-lg border border-r-0 border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground"
                    />
                    <button
                      type="submit"
                      aria-label="Localizar endereço"
                      className="grid size-9 shrink-0 place-items-center rounded-r-lg border border-border bg-primary/10 text-primary hover:bg-primary/20"
                    >
                      <Search className="size-4" />
                    </button>
                  </form>
                  {enderecoSelecionado ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEnderecoSelecionado(null);
                        setBuscaEndereco("");
                        setMensagemBusca(null);
                      }}
                      className="min-h-9 rounded-lg border border-border px-2 text-xs text-muted-foreground hover:bg-muted"
                    >
                      Limpar
                    </button>
                  ) : null}
                </div>
                {mensagemBusca ? (
                  <p role="status" className="mb-2 text-xs text-amber-300">
                    {mensagemBusca}
                  </p>
                ) : null}
                {enderecoSelecionado && enderecosGeograficos[0] ? (
                  <p className="mb-2 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary">
                    Endereço localizado: Setor {enderecosGeograficos[0].setor} · Rua{" "}
                    {enderecosGeograficos[0].rua} · Módulo {enderecosGeograficos[0].modulo} ·
                    Prateleira {enderecosGeograficos[0].prateleira} · Posição{" "}
                    {enderecosGeograficos[0].posicao}
                  </p>
                ) : null}
                <div className="warehouse-map max-h-[260px] min-h-[210px] overflow-auto rounded-xl border border-sky-900/70 bg-[#07172b] p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {!ocupacaoItensCarregada ? (
                    <p className="grid min-h-[190px] place-items-center text-center text-sm text-slate-400">
                      Aguardando os itens endereçados para calcular a ocupação.
                    </p>
                  ) : mapaFiltrado.length > 0 ? (
                    <div className="space-y-2">
                      {setoresMapa
                        .filter((setor) => setorSelecionado === null || setorSelecionado === setor)
                        .map((setor) => {
                          const ruasDoSetor = mapaFiltrado.filter((rua) => rua.setor === setor);
                          if (ruasDoSetor.length === 0) return null;
                          return (
                            <div key={setor} className="grid grid-cols-[48px_minmax(0,1fr)] gap-2">
                              <button
                                type="button"
                                aria-pressed={setorSelecionado === setor && ruaSelecionada === null}
                                onClick={() => alternarSetor(setor)}
                                className={`grid min-h-14 place-items-center rounded-lg border text-sm font-black text-slate-200 ${
                                  setorSelecionado === setor
                                    ? "border-sky-300 bg-sky-500/20"
                                    : "border-slate-700 bg-slate-900/70 hover:border-sky-500"
                                }`}
                              >
                                {setor}
                              </button>
                              <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-1.5">
                                {ruasDoSetor.map((rua) => {
                                  const totalBarras = 10;
                                  const percentuais = [
                                    (rua.bloqueadas / Math.max(1, rua.total)) * 100,
                                    (rua.ocupadas / Math.max(1, rua.total)) * 100,
                                    (rua.normais / Math.max(1, rua.total)) * 100,
                                    (rua.desativadas / Math.max(1, rua.total)) * 100,
                                  ];
                                  const contagens = percentuais.map((percentual) =>
                                    Math.round((percentual / 100) * totalBarras),
                                  );
                                  return (
                                    <button
                                      type="button"
                                      key={`${rua.setor}|${rua.rua}`}
                                      aria-pressed={
                                        setorSelecionado === rua.setor && ruaSelecionada === rua.rua
                                      }
                                      onClick={() => alternarRua(rua.setor, rua.rua)}
                                      title={`Setor ${rua.setor} · Rua ${rua.rua}: ${formatarInteiro(rua.total)} posições · ${formatarInteiro(rua.ocupadas)} ocupadas · ${formatarInteiro(rua.bloqueadas)} bloqueadas · ${formatadorPercentual.format(rua.percentual)}%`}
                                      className={`min-h-[54px] rounded-md border border-slate-600/80 bg-slate-800/80 px-1.5 py-1 text-left transition hover:border-sky-300 hover:bg-slate-700/80 ${
                                        setorSelecionado === rua.setor && ruaSelecionada === rua.rua
                                          ? "ring-2 ring-sky-300"
                                          : ""
                                      }`}
                                    >
                                      <span className="flex items-center justify-between gap-1 text-[10px] font-bold text-slate-100">
                                        <span>Rua {rua.rua}</span>
                                        <span>{rua.percentual}%</span>
                                      </span>
                                      <span className="mt-1 flex h-3.5 gap-px overflow-hidden rounded-sm">
                                        {Array.from({ length: totalBarras }, (_, index) => {
                                          const cor =
                                            index < contagens[0]!
                                              ? "#f59e0b"
                                              : index < contagens[0]! + contagens[1]!
                                                ? "#0ea5e9"
                                                : index <
                                                    contagens[0]! + contagens[1]! + contagens[2]!
                                                  ? "#10b981"
                                                  : index <
                                                      contagens[0]! +
                                                        contagens[1]! +
                                                        contagens[2]! +
                                                        contagens[3]!
                                                    ? "#64748b"
                                                    : "#1e293b";
                                          return (
                                            <span
                                              key={index}
                                              className="min-w-0 flex-1 rounded-[1px]"
                                              style={{ backgroundColor: cor }}
                                            />
                                          );
                                        })}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="grid min-h-[190px] place-items-center text-center text-sm text-slate-400">
                      Nenhuma rua encontrada para os filtros atuais.
                    </p>
                  )}
                </div>
              </article>

              <aside className="grid min-w-0 gap-2 lg:grid-cols-2 xl:grid-cols-1">
                <article className="panel min-w-0 p-2.5 sm:p-3">
                  <h2 className="mb-1 text-base font-bold text-foreground">Status das posições</h2>
                  <div className="grid grid-cols-[minmax(110px,0.8fr)_minmax(0,1fr)] items-center gap-2">
                    <div
                      className="relative mx-auto size-32"
                      role="img"
                      aria-label={`${formatarInteiro(totalStatusVisivel)} posições distribuídas por status`}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={gruposStatusExibidos}
                            dataKey="quantidade"
                            nameKey="nome"
                            cx="50%"
                            cy="50%"
                            innerRadius="66%"
                            outerRadius="94%"
                            paddingAngle={2}
                            stroke="none"
                            isAnimationActive={false}
                          >
                            {gruposStatusExibidos.map((grupo) => (
                              <Cell key={grupo.id} fill={grupo.cor} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black tabular-nums text-foreground">
                          {formatarInteiro(totalStatusVisivel)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">total</span>
                      </div>
                    </div>
                    <ul className="space-y-0.5">
                      {gruposStatusExibidos.map((grupo) => {
                        const percentual =
                          totalStatusVisivel === 0
                            ? 0
                            : (grupo.quantidade / totalStatusVisivel) * 100;
                        return (
                          <li key={grupo.id}>
                            <button
                              type="button"
                              aria-pressed={statusSelecionado === grupo.filtroId}
                              onClick={() => alternarStatus(grupo.filtroId)}
                              className={`grid min-h-8 w-full grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-1.5 rounded-md px-1 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                statusSelecionado === grupo.filtroId ? "bg-primary/10" : ""
                              }`}
                            >
                              <span
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: grupo.cor }}
                              />
                              <span className="truncate text-[11px] text-muted-foreground">
                                {grupo.nome}
                              </span>
                              <span className="text-right text-[11px] font-bold tabular-nums text-foreground">
                                {formatarInteiro(grupo.quantidade)}{" "}
                                <span className="font-normal text-muted-foreground">
                                  ({formatadorPercentual.format(percentual)}%)
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </article>
                <article className="panel min-w-0 p-2.5 sm:p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle aria-hidden="true" className="size-4 text-amber-400" />
                      <h2 className="text-sm font-bold text-foreground">Pontos de atenção</h2>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{alertasAtivos} itens</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => alternarStatus("bloqueadas")}
                      className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 text-left hover:bg-rose-500/20"
                    >
                      <Ban className="size-4 shrink-0 text-rose-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] text-rose-300">
                          Posições bloqueadas
                        </span>
                        <span className="block text-sm font-bold tabular-nums text-foreground">
                          {formatarInteiro(quantidadeBloqueadas)}
                        </span>
                      </span>
                      <ArrowUpRight className="size-3 shrink-0 text-rose-300" />
                    </button>
                    <button
                      type="button"
                      disabled={!ocupacaoItensCarregada}
                      onClick={() => {
                        const ruaCheia = mapaEnderecamento.find(
                          (rua) => rua.total > 0 && rua.percentual === 100,
                        );
                        if (ruaCheia) alternarRua(ruaCheia.setor, ruaCheia.rua);
                      }}
                      className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 text-left hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] text-amber-300">
                          Ruas com 100% de ocupação
                        </span>
                        <span className="block text-sm font-bold tabular-nums text-foreground">
                          {ocupacaoItensCarregada ? formatarInteiro(ruasOcupadasTotal) : "—"}
                        </span>
                      </span>
                      <ArrowUpRight className="size-3 shrink-0 text-amber-300" />
                    </button>
                    <button
                      type="button"
                      disabled={setoresSemOcupacao === null}
                      onClick={() => {
                        const setorVazio = setoresResumoPainel.find(
                          (setor) => setor.percentual === 0,
                        );
                        if (setorVazio) alternarSetor(setorVazio.setor);
                      }}
                      className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 text-left hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Info className="size-4 shrink-0 text-sky-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] text-sky-300">
                          Setores com 0% de ocupação
                        </span>
                        <span className="block text-sm font-bold tabular-nums text-foreground">
                          {setoresSemOcupacao === null
                            ? ocupacaoItensCarregada
                              ? "N/D por depósito"
                              : "Aguardando itens"
                            : formatarInteiro(setoresSemOcupacao)}
                        </span>
                      </span>
                      <ArrowUpRight className="size-3 shrink-0 text-sky-300" />
                    </button>
                    <button
                      type="button"
                      aria-pressed={somenteProdutosMultiplos}
                      disabled={
                        dados?.produtosComMultiplosEnderecos == null || !dados.itensPorPosicao
                      }
                      title={
                        dados?.produtosComMultiplosEnderecos == null || !dados.itensPorPosicao
                          ? "Atualize os dados para habilitar este filtro"
                          : "Filtrar posições com produtos armazenados em mais de um endereço"
                      }
                      onClick={() => {
                        setSomenteProdutosMultiplos((ativo) => !ativo);
                        setPagina(0);
                      }}
                      className={`flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 text-left transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${
                        somenteProdutosMultiplos ? "ring-2 ring-violet-300" : ""
                      }`}
                    >
                      <Boxes className="size-4 shrink-0 text-violet-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] text-violet-300">
                          Produtos em múltiplos endereços
                        </span>
                        <span className="block text-sm font-bold tabular-nums text-foreground">
                          {dados?.produtosComMultiplosEnderecos == null
                            ? "Atualize para calcular"
                            : formatarInteiro(dados.produtosComMultiplosEnderecos)}
                        </span>
                        <span className="block truncate text-[9px] text-violet-200/70">
                          {somenteProdutosMultiplos
                            ? "Filtro ativo · toque para remover"
                            : "Toque para filtrar os endereços"}
                        </span>
                      </span>
                    </button>
                  </div>
                  {depositoSelecionado ? (
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      Os alertas de produtos são gerais; a API não fornece esse resumo por depósito.
                    </p>
                  ) : null}
                  {bloqueadasInventario > 0 ? (
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      {formatarInteiro(bloqueadasInventario)} posições estão bloqueadas para
                      inventário.
                    </p>
                  ) : null}
                </article>
              </aside>
            </section>

            <section
              aria-label="Insights rápidos do armazém"
              className="panel grid grid-cols-2 items-center gap-1.5 p-2 sm:grid-cols-4 xl:grid-cols-[120px_repeat(4,minmax(0,1fr))]"
            >
              <div className="hidden items-center gap-2 px-2 xl:flex">
                <Lightbulb aria-hidden="true" className="size-5 text-amber-400" />
                <span className="text-sm font-semibold text-foreground">Insights rápidos</span>
              </div>
              <article className="flex min-h-12 items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-rose-500/15 text-rose-400">
                  <Package className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[10px] text-muted-foreground">Maior ocupação</p>
                  <p className="truncate text-xs font-semibold text-foreground">
                    Setor {ocupacaoItensCarregada ? (setorMaisOcupado?.setor ?? "—") : "—"} ·{" "}
                    {ocupacaoItensCarregada && setorMaisOcupado
                      ? `${setorMaisOcupado.percentual}%`
                      : "—"}
                  </p>
                </div>
              </article>
              <article className="flex min-h-12 items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sky-500/15 text-sky-400">
                  <MapPin className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[10px] text-muted-foreground">
                    Maior disponibilidade
                  </p>
                  <p className="truncate text-xs font-semibold text-foreground">
                    Setor {ocupacaoItensCarregada ? (setorMaisDisponivel?.setor ?? "—") : "—"} ·{" "}
                    {ocupacaoItensCarregada && setorMaisDisponivel
                      ? `${100 - setorMaisDisponivel.percentual}% livre`
                      : "—"}
                  </p>
                </div>
              </article>
              <article className="flex min-h-12 items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <Warehouse className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[10px] text-muted-foreground">Rua mais ocupada</p>
                  <p className="truncate text-xs font-semibold text-foreground">
                    {ocupacaoItensCarregada && ruaMaisOcupada
                      ? `${ruaMaisOcupada.setor} · Rua ${ruaMaisOcupada.rua} · ${formatarInteiro(ruaMaisOcupada.ocupadas)} posições`
                      : "—"}
                  </p>
                </div>
              </article>
              <article className="flex min-h-12 items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-400">
                  <Ban className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[10px] text-muted-foreground">Posições bloqueadas</p>
                  <p className="truncate text-xs font-semibold text-foreground">
                    {formatarInteiro(quantidadeBloqueadas)} ·{" "}
                    {totalEscopo === 0
                      ? "0%"
                      : `${formatadorPercentual.format((quantidadeBloqueadas / totalEscopo) * 100)}% do total`}
                  </p>
                </div>
              </article>
            </section>

            <details className="panel group min-w-0 overflow-hidden">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block text-sm font-bold text-foreground">
                    Endereços do armazém
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    Abrir consulta detalhada · {formatarInteiro(enderecosFiltrados.length)} posições
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <section className="min-w-0 overflow-hidden border-t border-border/70">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-3 py-3 sm:px-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Endereços do armazém</h2>
                    <p className="text-xs text-muted-foreground">
                      {depositoSelecionado
                        ? `${depositos.find((deposito) => deposito.id === depositoSelecionado)?.nome ?? "Depósito"} · ${formatarInteiro(enderecosFiltrados.length)} posições`
                        : filtroAtivo
                          ? `${formatarInteiro(enderecosFiltrados.length)} posições filtradas · toque no cartão selecionado para limpar`
                          : "Setor · Rua · Módulo · Prateleira · Posição"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatarInteiro(
                        enderecosFiltrados.length === 0 ? 0 : pagina * ENDERECOS_POR_PAGINA + 1,
                      )}
                      –
                      {formatarInteiro(
                        Math.min((pagina + 1) * ENDERECOS_POR_PAGINA, enderecosFiltrados.length),
                      )}{" "}
                      de {formatarInteiro(enderecosFiltrados.length)}
                    </span>
                    <button
                      type="button"
                      aria-label="Página anterior"
                      onClick={() => setPagina((atual) => Math.max(0, atual - 1))}
                      disabled={pagina === 0}
                      className="grid size-8 place-items-center rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-40"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {enderecosFiltrados.length === 0 ? 0 : pagina + 1}/{totalPaginas}
                    </span>
                    <button
                      type="button"
                      aria-label="Próxima página"
                      onClick={() => setPagina((atual) => Math.min(totalPaginas - 1, atual + 1))}
                      disabled={pagina >= totalPaginas - 1}
                      className="grid size-8 place-items-center rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-40"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="max-h-[48vh] overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <table className="w-full min-w-[1400px] table-fixed text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-card text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="w-[10%] px-3 py-2.5">Depósito</th>
                        <th className="w-[11%] px-3 py-2.5">Código PS</th>
                        <th className="w-[24%] px-3 py-2.5">Descrição completa</th>
                        <th className="w-[7%] px-3 py-2.5">Setor</th>
                        <th className="w-[6%] px-3 py-2.5">Rua</th>
                        <th className="w-[10%] px-3 py-2.5">Módulo</th>
                        <th className="w-[8%] px-3 py-2.5">Prateleira</th>
                        <th className="w-[8%] px-3 py-2.5">Posição</th>
                        <th className="w-[8%] px-3 py-2.5">Status</th>
                        <th className="w-[5%] px-3 py-2.5 text-right">Ocup.</th>
                        <th className="w-[3%] px-3 py-2.5 text-center">Itens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enderecosVisiveis.length === 0 ? (
                        <tr>
                          <td
                            colSpan={11}
                            className="px-3 py-8 text-center text-sm text-muted-foreground"
                          >
                            Nenhum endereço encontrado para este filtro.
                          </td>
                        </tr>
                      ) : (
                        enderecosVisiveis.map((endereco) => {
                          const status =
                            dados.statusPosicoes.find((item) => item.id === endereco.statusId)
                              ?.nome ?? "Outro status";
                          const ocupada = endereco.ocupacoesProduto > 0;
                          const nomeDepositos = (endereco.depositos ?? [])
                            .map((deposito) => deposito.nome)
                            .join(", ");
                          return (
                            <tr
                              key={endereco.id}
                              className="border-t border-border/60 transition-colors hover:bg-primary/5"
                            >
                              <td
                                className="truncate px-3 py-2 font-semibold"
                                title={nomeDepositos || "Sem vínculo de depósito"}
                              >
                                {nomeDepositos || "—"}
                              </td>
                              <td
                                className="truncate px-3 py-2 font-semibold tabular-nums text-primary"
                                title={endereco.codigoPosicao ?? "Código PS não informado pela API"}
                              >
                                {endereco.codigoPosicao ?? "—"}
                              </td>
                              <td
                                className="truncate px-3 py-2"
                                title={
                                  endereco.descricaoCompleta ??
                                  `Setor ${endereco.setor} · Rua ${endereco.rua} · Módulo ${endereco.modulo} · Prateleira ${endereco.prateleira} · Posição ${endereco.posicao}`
                                }
                              >
                                {endereco.descricaoCompleta ??
                                  `Setor ${endereco.setor} · Rua ${endereco.rua} · Módulo ${endereco.modulo} · Prateleira ${endereco.prateleira} · Posição ${endereco.posicao}`}
                              </td>
                              <td
                                className="truncate px-3 py-2 font-semibold"
                                title={endereco.setor}
                              >
                                Setor {endereco.setor}
                              </td>
                              <td className="truncate px-3 py-2 tabular-nums" title={endereco.rua}>
                                Rua {endereco.rua}
                              </td>
                              <td
                                className="truncate px-3 py-2 tabular-nums"
                                title={endereco.modulo}
                              >
                                Módulo {endereco.modulo}
                              </td>
                              <td
                                className="truncate px-3 py-2 tabular-nums"
                                title={endereco.prateleira}
                              >
                                Prateleira {endereco.prateleira}
                              </td>
                              <td
                                className="truncate px-3 py-2 tabular-nums"
                                title={endereco.posicao}
                              >
                                Posição {endereco.posicao}
                              </td>
                              <td
                                className="truncate px-3 py-2 text-muted-foreground"
                                title={status}
                              >
                                {status}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span
                                  className={`inline-flex min-w-14 justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    !ocupacaoItensCarregada
                                      ? "bg-muted text-muted-foreground"
                                      : ocupada
                                        ? "bg-emerald-500/15 text-emerald-400"
                                        : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {!ocupacaoItensCarregada
                                    ? "Verificando"
                                    : ocupada
                                      ? "Ocupada"
                                      : "Vazia"}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <button
                                  type="button"
                                  aria-label={`Ver itens e depósitos do endereço ${endereco.setor}, rua ${endereco.rua}, módulo ${endereco.modulo}, prateleira ${endereco.prateleira}, posição ${endereco.posicao}`}
                                  title="Ver itens, saldo e depósito endereçado"
                                  onClick={() => void abrirDetalhesItens(endereco)}
                                  className="inline-grid size-9 place-items-center rounded-lg border border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <PackageSearch aria-hidden="true" className="size-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </details>
            {enderecoItens ? (
              <div
                className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-3"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) fecharDetalhesItens();
                }}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="itens-endereco-titulo"
                  aria-describedby="itens-endereco-descricao"
                  tabIndex={-1}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") fecharDetalhesItens();
                  }}
                  className="relative max-h-[85vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-6"
                >
                  <button
                    type="button"
                    aria-label="Fechar detalhes dos itens"
                    onClick={fecharDetalhesItens}
                    className="absolute right-3 top-3 grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span aria-hidden="true" className="text-xl leading-none">
                      ×
                    </span>
                  </button>
                  <header className="space-y-1 pr-10">
                    <h2 id="itens-endereco-titulo" className="text-lg font-semibold leading-none">
                      Itens do endereço
                    </h2>
                    <p id="itens-endereco-descricao" className="text-sm text-muted-foreground">
                      <span className="block font-semibold text-primary">
                        {enderecoItens.codigoPosicao ?? "Código PS não informado pela API"}
                      </span>
                      {enderecoItens.descricaoCompleta ??
                        `Setor ${enderecoItens.setor} · Rua ${enderecoItens.rua} · Módulo ${enderecoItens.modulo} · Prateleira ${enderecoItens.prateleira} · Posição ${enderecoItens.posicao}`}
                    </p>
                  </header>
                  <section className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Itens retornados pela API
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {itensEnderecoCarregados === null
                          ? "Consultando itens endereçados..."
                          : `${formatarInteiro(itensEnderecoCarregados.length)} itens endereçados`}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Tipo da posição
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {TIPOS_POSICAO[enderecoItens.tipoPosicaoId] ||
                          (enderecoItens.tipoPosicaoId
                            ? `Tipo ${enderecoItens.tipoPosicaoId}`
                            : "Não informado")}{" "}
                        · ocupação{" "}
                        {TIPOS_OCUPACAO[enderecoItens.tipoOcupacaoId] ||
                          (enderecoItens.tipoOcupacaoId
                            ? `Tipo ${enderecoItens.tipoOcupacaoId}`
                            : "não informada")}
                      </p>
                    </div>
                  </section>
                  <section className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Depósito endereçado
                    </h3>
                    <p className="mt-1 text-base font-bold text-foreground">
                      {enderecoItens.depositos?.length
                        ? enderecoItens.depositos.map((deposito) => deposito.nome).join(", ")
                        : "Sem depósito associado"}
                    </p>
                  </section>
                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        Itens e saldo/quantidade
                      </h3>
                      {itensEnderecoCarregados !== null ? (
                        <span className="text-xs text-muted-foreground">
                          {formatarInteiro(itensEnderecoCarregados.length)} itens
                        </span>
                      ) : null}
                    </div>
                    {carregandoItensEndereco &&
                    (itensEnderecoCarregados === null || itensEnderecoCarregados.length === 0) ? (
                      <p
                        role="status"
                        className="rounded-lg border border-border/70 px-3 py-6 text-center text-sm text-muted-foreground"
                      >
                        Consultando os itens e saldos deste endereço...
                      </p>
                    ) : erroItensEndereco && itensEnderecoCarregados === null ? (
                      <p
                        role="alert"
                        className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-4 text-sm text-destructive"
                      >
                        {erroItensEndereco}
                      </p>
                    ) : itensEnderecoCarregados !== null ? (
                      itensEnderecoCarregados.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-border/70 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          <table className="w-full min-w-[560px] text-left text-sm">
                            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2">Código</th>
                                <th className="px-3 py-2">Descrição</th>
                                <th className="px-3 py-2 text-right">Saldo</th>
                                <th className="px-3 py-2">Depósito</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itensEnderecoCarregados.map((item) => (
                                <tr
                                  key={`${item.id}|${item.depositoId ?? "sem-deposito"}`}
                                  className="border-t border-border/60"
                                >
                                  <td className="px-3 py-2 font-semibold tabular-nums">
                                    {item.codigo}
                                  </td>
                                  <td className="px-3 py-2">{item.descricao}</td>
                                  <td
                                    className="px-3 py-2 text-right font-semibold tabular-nums"
                                    title={
                                      item.saldo === null
                                        ? "A API não forneceu o saldo; exibindo a quantidade ocupada informada."
                                        : "Saldo informado pela API."
                                    }
                                  >
                                    {formatarQuantidade(item.saldo ?? item.quantidade)}
                                    {item.saldo === null && item.quantidade !== null ? (
                                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                                        ocupada
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-2">
                                    {item.depositoNome ?? "Sem depósito informado"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                          A API não retornou itens endereçados para esta posição.
                        </p>
                      )
                    ) : (
                      <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-4 text-sm text-muted-foreground">
                        Os detalhes dos itens ainda não foram consultados.
                      </div>
                    )}
                    {erroItensEndereco && itensEnderecoCarregados !== null ? (
                      <p role="status" className="text-xs text-amber-300">
                        Mostrando os dados salvos; a atualização da API falhou: {erroItensEndereco}
                      </p>
                    ) : null}
                  </section>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
