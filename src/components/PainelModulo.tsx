import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  CalendarDays,
  CircleX,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileClock,
  FilePlus2,
  Package,
  PackageCheck,
  Pause,
  Play,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { BarraModulos } from "@/components/BarraModulos";
import { DetalhesPainel, type SecaoDetalhesPainel } from "@/components/DetalhesPainel";
import { DistribuicaoEstados, type EstadoDestinatario } from "@/components/DistribuicaoEstados";
import { Input } from "@/components/ui/input";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  agruparOrdensPorFila,
  formatarHora,
  formatarInteiro,
  formatarMoeda,
  paraNumero,
  totalOrdens,
  valorTotal,
  type OrdemWMS,
} from "@/lib/wms-api";
import {
  CONFIGURACAO_WMS_PADRAO,
  assinarApiAtiva,
  assinarCicloStatus,
  assinarConfiguracaoWms,
  consultaDaConfiguracao,
  lerApiAtiva,
  lerCicloStatusAtivo,
  lerConfiguracaoWms,
  type ConsultaEship,
} from "@/lib/wms-config";

const INTERVALO_SEGUNDOS = 120;
const INTERVALO_EVOLUCAO_MS = 2 * 60 * 60 * 1000;
const ATRASO_INICIO_CICLO_STATUS_MS = 20_000;
const DURACAO_STATUS_MS = 15_000;
const DURACAO_VISAO_GERAL_MS = 20_000;
const VALOR_CANCELADAS_HOJE_INICIAL = 0;
const CONFIGURACAO_GRAFICO_REABASTECIMENTO: ChartConfig = {
  quantidade: { label: "Posições bloqueadas", color: "var(--chart-1)" },
};
const CONFIGURACAO_GRAFICO_EVOLUCAO: ChartConfig = {
  quantidade: { label: "Ordens", color: "var(--chart-1)" },
  valor: { label: "Valor (R$)", color: "var(--chart-2)" },
};
const CONFIGURACAO_GRAFICO_IDADE: ChartConfig = {
  quantidade: { label: "Ordens", color: "var(--chart-1)" },
};
const CONFIGURACAO_GRAFICO_PEDIDOS: ChartConfig = {
  quantidade: { label: "Pedidos", color: "var(--chart-1)" },
  valor: { label: "Valor total", color: "var(--chart-2)" },
};
const CORES_GRAFICO_STATUS: Record<string, string> = {
  "1": "#94a3b8",
  "2": "#2563eb",
  "3": "#f97316",
  "4": "#16a34a",
  "5": "#6b7280",
  "6": "#38bdf8",
  "7": "#cbd5e1",
};
const FAIXAS_IDADE_ORDENS = [
  { id: "hoje", nome: "Hoje (até 24h)", rotulo: "Hoje" },
  { id: "24-48-horas", nome: "24–48 horas", rotulo: "24–48h" },
  { id: "48-72-horas", nome: "48–72 horas", rotulo: "48–72h" },
  { id: "72-horas-4-dias", nome: "72h–4 dias", rotulo: "72h–4d" },
  { id: "4-15-dias", nome: "4–15 dias", rotulo: "4–15d" },
  { id: "16-30-dias", nome: "16–30 dias", rotulo: "16–30d" },
  { id: "mais-30-dias", nome: "Mais de 30 dias", rotulo: ">30d" },
] as const;
const CARTOES_STATUS = [
  {
    id: "1",
    nome: "Lançados",
    estilo: "border-slate-300 bg-white text-slate-950",
    icone: FilePlus2,
  },
  { id: "2", nome: "Emitido", estilo: "border-blue-500 bg-blue-600 text-white", icone: FileCheck2 },
  {
    id: "3",
    nome: "Em operação",
    estilo: "border-orange-500 bg-orange-500 text-white",
    icone: Truck,
  },
  {
    id: "4",
    nome: "Conferida",
    estilo: "border-green-600 bg-green-600 text-white",
    icone: BadgeCheck,
  },
  {
    id: "5",
    nome: "Ag. Documentação",
    estilo: "border-gray-500 bg-gray-500 text-white",
    icone: FileClock,
  },
  {
    id: "6",
    nome: "Ag. Expedição",
    estilo: "border-sky-400 bg-sky-400 text-slate-950",
    icone: ClipboardCheck,
  },
  {
    id: "7",
    nome: "Embarcado",
    estilo: "border-white bg-white text-slate-950",
    icone: PackageCheck,
  },
] as const;
const IDS_COMBO_STATUS = CARTOES_STATUS.slice(0, 5).map(({ id }) => id);
const SECOES_DETALHES_DASHBOARD = [
  {
    titulo: "Cartões principais e filtros",
    itens: [
      {
        titulo: "Valor das ordens",
        descricao: "Soma dos valores das ordens consideradas pelos filtros atuais.",
      },
      {
        titulo: "Total de ordem",
        descricao: "Quantidade de ordens retornadas pela API dentro da consulta atual.",
      },
      {
        titulo: "Valor cancelado hoje",
        descricao: "Valor e quantidade de ordens canceladas hoje, conforme a consulta do painel.",
      },
      {
        titulo: "Ordens integradas hoje",
        descricao: "Quantidade e valor das ordens integradas hoje, fornecidos pela API.",
      },
      {
        titulo: "Cartões de status",
        descricao:
          "Mostram a quantidade em cada status. Toque em um status para filtrar ordens, cartões e visualizações relacionadas; toque novamente para remover o filtro.",
      },
    ],
  },
  {
    titulo: "Gráficos operacionais",
    itens: [
      {
        titulo: "Pedidos por status",
        descricao:
          "Gráfico de rosca com a quantidade de pedidos por status. A legenda também apresenta os valores; acompanha o filtro de status.",
      },
      {
        titulo: "Evolução das Ordens",
        descricao:
          "Compara a quantidade e o valor das ordens nos últimos sete dias. O botão de atualizar consulta esse período novamente.",
      },
      {
        titulo: "Reabastecimento por setor",
        descricao:
          "Funil de posições bloqueadas por setor, com a separação entre Peça e Produto indicada nos detalhes do gráfico.",
      },
      {
        titulo: "Ordens por tempo de criação",
        descricao:
          "Agrupa as ordens em faixas de idade, das criadas nas últimas 24 horas às mais antigas, usando a data de criação.",
      },
      {
        titulo: "Estado do destinatário do cliente",
        descricao:
          "Mapa e ranking dos cinco estados com mais pedidos. A intensidade do mapa representa o valor do frete; os detalhes mostram pedidos e valores.",
      },
    ],
  },
  {
    titulo: "Filas e produtos",
    itens: [
      {
        titulo: "Fila por família",
        descricao:
          "Agrupa pedidos por família de fila e resume quantidade e valor. Permite pesquisar uma família específica.",
      },
      {
        titulo: "Ranking de produtos com mais saídas",
        descricao:
          "Ordena os produtos pela quantidade de saídas e informa em quantos pedidos aparecem. Os filtros Peça/Produto e a pesquisa refinam a lista.",
      },
    ],
  },
  {
    titulo: "Conexão e atualização",
    itens: [
      {
        titulo: "Status da API",
        descricao:
          "Indica se as consultas estão pausadas, conectando, conectadas ou sem comunicação com a API E-SHIP.",
      },
      {
        titulo: "Última e próxima atualização",
        descricao:
          "Exibe o horário da atualização mais recente e a contagem regressiva para a próxima consulta automática.",
      },
    ],
  },
] satisfies SecaoDetalhesPainel[];
const formatadorValorCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
function formatarValorCompacto(valor: number): string {
  return formatadorValorCompacto.format(valor);
}

function descricaoProdutoResumida(descricao: string): string {
  return descricao.length > 20 ? `${descricao.slice(0, 19)}…` : descricao;
}

function nomeStatusResumido(nome: string): string {
  const nomes: Record<string, string> = {
    "Aguardando documentação": "Ag. documentação",
    "Aguardando Expedição": "Ag. expedição",
    "Aguardando reenvio": "Ag. reenvio",
    "Concluída/Despachada": "Concluída",
  };
  return nomes[nome] ?? nome;
}

function corIndicadorFila(nome: string): string {
  const familia = nome.toLocaleUpperCase("pt-BR");
  if (familia.startsWith("PEÇA")) return "bg-sky-400";
  if (familia.startsWith("MISTO")) return "bg-emerald-400";
  if (familia.startsWith("ONDA")) return "bg-amber-500";
  if (familia.startsWith("B2B")) return "bg-violet-500";
  if (familia.startsWith("DEDICADO")) return "bg-rose-500";
  return "bg-primary";
}

function corIndicadorProduto(categoria: ProdutoMaisSaidas["categoria"]): string {
  if (categoria === "peca") return "bg-sky-400";
  if (categoria === "produto") return "bg-orange-400";
  return "bg-muted-foreground";
}

function horasDesdeCriacao(dataHora?: string): number | undefined {
  const data = dataHora?.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/,
  );
  if (!data) return undefined;
  const ano = Number(data[1]);
  const mes = Number(data[2]);
  const dia = Number(data[3]);
  const hora = Number(data[4] ?? 0);
  const minuto = Number(data[5] ?? 0);
  const segundo = Number(data[6] ?? 0);
  const milissegundo = Number((data[7] ?? "").slice(0, 3).padEnd(3, "0"));
  const instanteOrdem = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo, milissegundo);
  const dataValidada = new Date(instanteOrdem);
  if (
    dataValidada.getUTCFullYear() !== ano ||
    dataValidada.getUTCMonth() !== mes - 1 ||
    dataValidada.getUTCDate() !== dia ||
    hora > 23 ||
    minuto > 59 ||
    segundo > 59
  ) {
    return undefined;
  }

  const agoraFortaleza = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date())
    .reduce<Record<string, number>>((partes, { type, value }) => {
      if (type !== "literal") partes[type] = Number(value);
      return partes;
    }, {});
  const instanteAtual = Date.UTC(
    agoraFortaleza["year"]!,
    agoraFortaleza["month"]! - 1,
    agoraFortaleza["day"]!,
    agoraFortaleza["hour"]!,
    agoraFortaleza["minute"]!,
    agoraFortaleza["second"]!,
  );
  const idadeEmHoras = Math.floor((instanteAtual - instanteOrdem) / 3_600_000);
  return idadeEmHoras >= 0 ? idadeEmHoras : undefined;
}

type ReabastecimentoPorSetor = {
  setor: string;
  peca: number;
  produto: number;
};

type ProdutoMaisSaidas = {
  statusId: string;
  id: string;
  codigo: string;
  descricao: string;
  categoria: "peca" | "produto" | "outro";
  quantidade: number;
  pedidos: number;
};

type StatusPedido = {
  id: string;
  nome: string;
  quantidade: number;
  valor: number;
};

type EvolucaoOrdem = {
  data: string;
  rotulo: string;
  quantidade: number;
  valor: number;
};

type ConsultaFn = (options: { data: ConsultaEship }) => Promise<{
  ordens: OrdemWMS[];
  statusPedidos?: StatusPedido[];
  evolucaoOrdens?: EvolucaoOrdem[];
  reabastecimentoPorSetor?: ReabastecimentoPorSetor[];
  rankingProdutos?: ProdutoMaisSaidas[];
  quantidadeCanceladasHoje?: number;
  valorCanceladasHoje?: number;
}>;

type ConsultaEvolucaoFn = (options: { data: ConsultaEship }) => Promise<EvolucaoOrdem[]>;

type ConsultaIntegracaoFn = (options: { data: ConsultaEship }) => Promise<{
  quantidadeIntegradasHoje: number;
  valorIntegradasHoje: number;
}>;

function CartaoIntegracaoDia({
  consulta,
  consultar,
  apiAtiva,
  conectado,
}: {
  consulta: ConsultaEship;
  consultar: ConsultaIntegracaoFn;
  apiAtiva: boolean;
  conectado: boolean;
}) {
  const consultarAPI = useServerFn(consultar);
  const consultarAPIRef = useRef(consultarAPI);
  consultarAPIRef.current = consultarAPI;
  const [quantidade, setQuantidade] = useState(0);
  const [valor, setValor] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!apiAtiva || !conectado) {
      setCarregando(apiAtiva && !conectado);
      return;
    }

    let ativo = true;
    const buscarIntegracoes = () => {
      setCarregando(true);
      setErro(false);

      void consultarAPIRef
        .current({ data: consulta })
        .then((resultado) => {
          if (!ativo) return;
          setQuantidade(resultado.quantidadeIntegradasHoje);
          setValor(resultado.valorIntegradasHoje);
        })
        .catch((error: unknown) => {
          console.error(
            "Falha ao consultar integração do dia",
            error instanceof Error ? error.name : "erro desconhecido",
          );
          if (ativo) setErro(true);
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });
    };

    buscarIntegracoes();
    const intervalo = window.setInterval(buscarIntegracoes, 60 * 60 * 1000);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
    };
  }, [apiAtiva, conectado, consulta]);

  return (
    <div className="panel flex min-w-0 items-center gap-3 p-3 lg:p-3.5 2xl:gap-2 2xl:p-2">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary lg:size-11">
        <CalendarDays aria-hidden="true" className="size-5 lg:size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-[0.12em] text-muted-foreground">
          INTEGRAÇÃO DO DIA
        </p>
        <p className="mt-0.5 break-words text-xl font-bold tabular-nums text-foreground lg:text-2xl">
          {erro ? "Indisponível" : carregando ? "Consultando..." : formatarMoeda(valor)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {erro
            ? "Falha ao consultar a API"
            : carregando
              ? "Calculando ordens integradas"
              : `${formatarInteiro(quantidade)} ordens integradas hoje`}
        </p>
      </div>
    </div>
  );
}

export function PainelModulo({
  titulo,
  subtitulo,
  consultar,
  consultarEvolucao,
  consultarIntegracao,
  consultaInicial,
  exibirGraficos = false,
}: {
  titulo: string;
  subtitulo: string;
  consultar: ConsultaFn;
  consultarEvolucao?: ConsultaEvolucaoFn;
  consultarIntegracao?: ConsultaIntegracaoFn;
  consultaInicial?: ConsultaEship;
  exibirGraficos?: boolean;
}) {
  const [ordens, setOrdens] = useState<OrdemWMS[]>([]);
  const [statusPedidos, setStatusPedidos] = useState<StatusPedido[]>([]);
  const [evolucaoOrdens, setEvolucaoOrdens] = useState<EvolucaoOrdem[]>([]);
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>([]);
  const [reabastecimentoPorSetor, setReabastecimentoPorSetor] = useState<ReabastecimentoPorSetor[]>(
    [],
  );
  const [rankingProdutos, setRankingProdutos] = useState<ProdutoMaisSaidas[]>([]);
  const [quantidadeCanceladasHoje, setQuantidadeCanceladasHoje] = useState(0);
  const [valorCanceladasHoje, setValorCanceladasHoje] = useState(VALOR_CANCELADAS_HOJE_INICIAL);
  const [buscaFila, setBuscaFila] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [categoriasProdutoSelecionadas, setCategoriasProdutoSelecionadas] = useState<
    ProdutoMaisSaidas["categoria"][]
  >([]);
  const [apiAtiva, setApiAtiva] = useState(true);
  const [preferenciaApiCarregada, setPreferenciaApiCarregada] = useState(false);
  const [cicloStatusAtivo, setCicloStatusAtivo] = useState(true);
  const [preferenciaCicloCarregada, setPreferenciaCicloCarregada] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [consultando, setConsultando] = useState(true);
  const [evolucaoCarregando, setEvolucaoCarregando] = useState(exibirGraficos);
  const [erroEvolucao, setErroEvolucao] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<string>("--:--:--");
  const [contador, setContador] = useState(INTERVALO_SEGUNDOS);
  const [consulta, setConsulta] = useState(() => obterConsultaAtiva(consultaInicial));
  const numeroConsultaAtual = useRef(0);
  const consultaDashboardEmAndamento = useRef(false);
  const consultaEvolucaoEmAndamento = useRef(false);
  const consultaRef = useRef(consulta);
  consultaRef.current = consulta;
  const consultarAPI = useServerFn(consultar);
  const consultarEvolucaoAPI = useServerFn(
    consultarEvolucao ?? (async (_options: { data: ConsultaEship }) => [] as EvolucaoOrdem[]),
  );

  useEffect(() => {
    for (const chave of [
      "wms-cartoes-personalizados",
      "wms-layout-cartoes",
      "wms-layout-colunas",
      "wms-layout-flexivel",
      "wms-painel:consultas-dashboards",
    ]) {
      window.localStorage.removeItem(chave);
    }
  }, []);

  useEffect(() => {
    const atualizar = () => {
      setApiAtiva(lerApiAtiva());
      setPreferenciaApiCarregada(true);
    };
    atualizar();
    return assinarApiAtiva(atualizar);
  }, []);

  useEffect(() => {
    const atualizar = () => {
      setCicloStatusAtivo(lerCicloStatusAtivo());
      setPreferenciaCicloCarregada(true);
    };
    atualizar();
    return assinarCicloStatus(atualizar);
  }, []);

  useEffect(() => {
    if (consultaInicial) {
      setConsulta(consultaInicial);
      return;
    }
    const atualizarConsulta = () => setConsulta(obterConsultaAtiva());
    return assinarConfiguracaoWms(atualizarConsulta);
  }, [consultaInicial]);

  const atualizarDashboard = useCallback(async () => {
    if (!preferenciaApiCarregada || !apiAtiva || consultaDashboardEmAndamento.current) return;
    consultaDashboardEmAndamento.current = true;
    const numeroConsulta = ++numeroConsultaAtual.current;
    setConsultando(true);
    try {
      const consultaParaAtualizacao: ConsultaEship = exibirGraficos
        ? {
            ...consulta,
            parametros: {
              ...consulta.parametros,
              ["statusOrdem"]: `[${CARTOES_STATUS.map(({ id }) => id).join(",")}]`,
            },
          }
        : consulta;
      const dados = await consultarAPI({ data: consultaParaAtualizacao });
      if (numeroConsulta !== numeroConsultaAtual.current) return;
      setOrdens(dados.ordens);
      setStatusPedidos(dados.statusPedidos ?? []);
      setReabastecimentoPorSetor(dados.reabastecimentoPorSetor ?? []);
      setRankingProdutos(dados.rankingProdutos ?? []);
      setQuantidadeCanceladasHoje(dados.quantidadeCanceladasHoje ?? 0);
      setValorCanceladasHoje(dados.valorCanceladasHoje ?? VALOR_CANCELADAS_HOJE_INICIAL);
      setConectado(true);
      setAtualizadoEm(formatarHora(new Date()));
    } catch {
      if (numeroConsulta === numeroConsultaAtual.current) {
        setConectado(false);
      }
    } finally {
      consultaDashboardEmAndamento.current = false;
      if (numeroConsulta === numeroConsultaAtual.current) {
        setContador(INTERVALO_SEGUNDOS);
        setConsultando(false);
      }
    }
  }, [apiAtiva, consulta, consultarAPI, exibirGraficos, preferenciaApiCarregada]);

  const atualizarEvolucao = useCallback(async () => {
    if (
      !exibirGraficos ||
      !consultarEvolucao ||
      !preferenciaApiCarregada ||
      !apiAtiva ||
      consultaEvolucaoEmAndamento.current
    ) {
      return;
    }
    consultaEvolucaoEmAndamento.current = true;
    setEvolucaoCarregando(true);
    setErroEvolucao(false);
    try {
      const dados = await consultarEvolucaoAPI({ data: consultaRef.current });
      setEvolucaoOrdens(dados);
    } catch {
      setErroEvolucao(true);
    } finally {
      consultaEvolucaoEmAndamento.current = false;
      setEvolucaoCarregando(false);
    }
  }, [apiAtiva, consultarEvolucao, consultarEvolucaoAPI, exibirGraficos, preferenciaApiCarregada]);

  useEffect(() => {
    if (!preferenciaApiCarregada) return;
    if (!apiAtiva) {
      numeroConsultaAtual.current += 1;
      setContador(INTERVALO_SEGUNDOS);
      setConsultando(false);
      return;
    }
    void atualizarDashboard();
    const id = window.setInterval(() => {
      setContador((s) => {
        if (s <= 1) {
          void atualizarDashboard();
          return INTERVALO_SEGUNDOS;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [apiAtiva, atualizarDashboard, exibirGraficos, preferenciaApiCarregada]);

  useEffect(() => {
    if (!exibirGraficos || !consultarEvolucao || !preferenciaApiCarregada) return;
    if (!apiAtiva) {
      setEvolucaoCarregando(false);
      return;
    }
    void atualizarEvolucao();
    const intervalo = window.setInterval(() => {
      void atualizarEvolucao();
    }, INTERVALO_EVOLUCAO_MS);
    return () => {
      window.clearInterval(intervalo);
    };
  }, [apiAtiva, atualizarEvolucao, consultarEvolucao, exibirGraficos, preferenciaApiCarregada]);

  useEffect(() => {
    if (!exibirGraficos || !preferenciaCicloCarregada || !cicloStatusAtivo) return;

    let indiceStatus = 0;
    let timeout: number;
    const avancarStatus = () => {
      if (indiceStatus === CARTOES_STATUS.length) {
        setStatusSelecionados([]);
        indiceStatus += 1;
        timeout = window.setTimeout(avancarStatus, DURACAO_VISAO_GERAL_MS);
        return;
      }

      if (indiceStatus === CARTOES_STATUS.length + 1) {
        setStatusSelecionados(IDS_COMBO_STATUS);
        indiceStatus = 0;
        timeout = window.setTimeout(avancarStatus, DURACAO_VISAO_GERAL_MS);
        return;
      }

      setStatusSelecionados([CARTOES_STATUS[indiceStatus]!.id]);
      indiceStatus += 1;
      timeout = window.setTimeout(avancarStatus, DURACAO_STATUS_MS);
    };

    timeout = window.setTimeout(avancarStatus, ATRASO_INICIO_CICLO_STATUS_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [cicloStatusAtivo, exibirGraficos, preferenciaCicloCarregada]);

  const ordensVisiveis =
    statusSelecionados.length > 0
      ? ordens.filter((ordem) => statusSelecionados.includes(ordem.statusId ?? ""))
      : ordens;
  const ordensPorIdade = FAIXAS_IDADE_ORDENS.map((faixa) => ({
    ...faixa,
    quantidade: 0,
  }));
  for (const ordem of ordensVisiveis) {
    const idade = horasDesdeCriacao(ordem.dataHora);
    if (idade === undefined) continue;
    const dias = Math.floor(idade / 24);
    const faixaId =
      idade < 24
        ? "hoje"
        : idade < 48
          ? "24-48-horas"
          : idade < 72
            ? "48-72-horas"
            : dias < 4
              ? "72-horas-4-dias"
              : dias <= 15
                ? "4-15-dias"
                : dias <= 30
                  ? "16-30-dias"
                  : "mais-30-dias";
    const faixa = ordensPorIdade.find(({ id }) => id === faixaId);
    if (faixa) faixa.quantidade += 1;
  }
  const statusPedidosVisiveis =
    statusSelecionados.length > 0
      ? statusPedidos.filter((status) => statusSelecionados.includes(status.id))
      : statusPedidos;
  const estadosDestinatarioVisiveis = (() => {
    const estados = new Map<string, EstadoDestinatario>();
    for (const ordem of ordensVisiveis) {
      const estado = ordem.estadoDestinatario;
      if (!estado) continue;
      const agregado = estados.get(estado.uf);
      if (agregado) {
        agregado.quantidade += 1;
        agregado.valor += paraNumero(ordem.infosAdicionais?.valordaordem);
        agregado.valorFrete += paraNumero(ordem.infosAdicionais?.valorfrete);
      } else {
        estados.set(estado.uf, {
          ...estado,
          quantidade: 1,
          valor: paraNumero(ordem.infosAdicionais?.valordaordem),
          valorFrete: paraNumero(ordem.infosAdicionais?.valorfrete),
        });
      }
    }
    return [...estados.values()].sort(
      (a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"),
    );
  })();
  const filas = agruparOrdensPorFila(ordensVisiveis);
  const filasFiltradas = filas.filter((fila) =>
    fila.nome.toLocaleLowerCase("pt-BR").includes(buscaFila.trim().toLocaleLowerCase("pt-BR")),
  );
  const reabastecimentoFunil = reabastecimentoPorSetor
    .map((setor) => ({ ...setor, quantidade: setor.peca + setor.produto }))
    .filter((setor) => setor.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
    .map((setor) => ({
      ...setor,
      rotulo: `Setor ${setor.setor} · ${formatarInteiro(setor.quantidade)}`,
    }));
  const produtosAgregados = new Map<string, ProdutoMaisSaidas>();
  for (const produto of rankingProdutos) {
    if (statusSelecionados.length > 0 && !statusSelecionados.includes(produto.statusId)) continue;
    const atual = produtosAgregados.get(produto.id);
    if (atual) {
      atual.quantidade += produto.quantidade;
      atual.pedidos += produto.pedidos;
    } else {
      produtosAgregados.set(produto.id, { ...produto });
    }
  }
  const termoBuscaProduto = buscaProduto.trim().toLocaleLowerCase("pt-BR");
  const produtosMaisSaidas = [...produtosAgregados.values()]
    .filter(
      (produto) =>
        (categoriasProdutoSelecionadas.length === 0 ||
          categoriasProdutoSelecionadas.includes(produto.categoria)) &&
        (!termoBuscaProduto ||
          `${produto.codigo} ${produto.descricao}`
            .toLocaleLowerCase("pt-BR")
            .includes(termoBuscaProduto)),
    )
    .sort((a, b) => b.quantidade - a.quantidade || a.codigo.localeCompare(b.codigo, "pt-BR"));
  return (
    <div className="min-h-screen bg-background text-foreground">
      <BarraModulos />
      <div className="mx-auto flex min-h-screen w-full max-w-none flex-col gap-3 p-3 pb-20 sm:gap-4 sm:p-4 sm:pb-20 md:pl-20 lg:gap-4 lg:p-5 lg:pb-5 lg:pl-22 2xl:gap-2 2xl:p-3 2xl:pl-20">
        <header className="panel flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-[0.12em] text-foreground lg:text-3xl">
              {titulo}
            </h1>
            <p className="mt-0.5 text-xs uppercase tracking-[0.2em] text-muted-foreground lg:text-sm">
              {subtitulo}
            </p>
          </div>
          {exibirGraficos ? (
            <DetalhesPainel titulo="Dashboard WMS" secoes={SECOES_DETALHES_DASHBOARD} />
          ) : null}
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-col gap-1 sm:items-end">
              <span
                className={
                  !apiAtiva
                    ? "inline-flex items-center gap-2 rounded-sm border border-border bg-muted px-3 py-1 text-sm font-semibold tracking-[0.15em] text-muted-foreground"
                    : consultando
                      ? "inline-flex items-center gap-2 rounded-sm border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-semibold tracking-[0.15em] text-primary"
                      : conectado
                        ? "inline-flex items-center gap-2 rounded-sm border border-status-ok/40 bg-status-ok/10 px-3 py-1 text-sm font-semibold tracking-[0.15em] text-status-ok"
                        : "inline-flex items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-1 text-sm font-semibold tracking-[0.15em] text-destructive"
                }
              >
                <span className="text-lg leading-none">●</span>
                {!apiAtiva
                  ? "API PAUSADA"
                  : consultando
                    ? "CONECTANDO"
                    : conectado
                      ? "CONECTADO"
                      : "OFFLINE"}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                <span className="text-[11px] tracking-[0.12em] text-muted-foreground lg:text-xs">
                  Última atualização: <span className="text-foreground">{atualizadoEm}</span>
                </span>
                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary lg:text-xs">
                  {apiAtiva ? (
                    <>
                      Próxima atualização em{" "}
                      <span className="tabular-nums text-foreground">{contador}s</span>
                    </>
                  ) : (
                    "Consultas pausadas"
                  )}
                </span>
              </div>
              {apiAtiva && !conectado && !consultando && (
                <span className="text-[11px] font-semibold tracking-[0.12em] text-destructive">
                  Falha na comunicação com a API E-SHIP
                </span>
              )}
            </div>
          </div>
        </header>

        {exibirGraficos && (
          <section
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Resumo do dashboard"
          >
            <div className="panel flex min-w-0 items-center gap-3 p-3 lg:p-3.5 2xl:gap-2 2xl:p-2">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary lg:size-11">
                <Package aria-hidden="true" className="size-5 lg:size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-[0.12em] text-muted-foreground">
                  VALOR DAS ORDENS
                </p>
                <p className="mt-0.5 break-words text-xl font-bold tabular-nums text-foreground lg:text-2xl">
                  {formatarMoeda(valorTotal(ordensVisiveis))}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Total das ordens consultadas</p>
              </div>
            </div>
            <div className="panel flex min-w-0 items-center gap-3 p-3 lg:p-3.5 2xl:gap-2 2xl:p-2">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary lg:size-11">
                <ClipboardList aria-hidden="true" className="size-5 lg:size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-[0.12em] text-muted-foreground">
                  TOTAL DE ORDEM
                </p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground lg:text-3xl">
                  {formatarInteiro(totalOrdens(ordensVisiveis))}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Ordens retornados pela API</p>
              </div>
            </div>
            <div className="panel flex min-w-0 items-center gap-3 p-3 lg:p-3.5 2xl:gap-2 2xl:p-2">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-destructive/15 text-destructive lg:size-11">
                <CircleX aria-hidden="true" className="size-5 lg:size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-[0.12em] text-muted-foreground">
                  VALOR CANCELADO HOJE
                </p>
                <p className="mt-0.5 break-words text-xl font-bold tabular-nums text-foreground lg:text-2xl">
                  {formatarMoeda(valorCanceladasHoje)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatarInteiro(quantidadeCanceladasHoje)} ordens canceladas hoje
                </p>
              </div>
            </div>
            {consultarIntegracao && (
              <CartaoIntegracaoDia
                consulta={consulta}
                consultar={consultarIntegracao}
                apiAtiva={apiAtiva}
                conectado={conectado}
              />
            )}
          </section>
        )}

        {exibirGraficos && (
          <section
            className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 xl:grid-cols-7"
            role="group"
            aria-label={
              statusSelecionados.length > 0
                ? `Filtrando por ${CARTOES_STATUS.filter(({ id }) =>
                    statusSelecionados.includes(id),
                  )
                    .map(({ nome }) => nome)
                    .join(", ")}`
                : "Todos os status ativos"
            }
          >
            {CARTOES_STATUS.map((cartao) => {
              const quantidade =
                statusPedidos.find((status) => status.id === cartao.id)?.quantidade ?? 0;
              const selecionado = statusSelecionados.includes(cartao.id);
              return (
                <button
                  key={cartao.id}
                  type="button"
                  aria-pressed={selecionado}
                  aria-label={`${
                    selecionado
                      ? statusSelecionados.length > 1
                        ? "Filtrar somente por"
                        : "Remover filtro de"
                      : "Filtrar por"
                  } ${cartao.nome}`}
                  onClick={() =>
                    setStatusSelecionados((atuais) =>
                      atuais.length === 1 && atuais[0] === cartao.id ? [] : [cartao.id],
                    )
                  }
                  className={`group flex min-h-12 min-w-0 items-center justify-between gap-1.5 rounded-xl border px-2 py-1.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-0 sm:min-h-14 sm:px-2.5 2xl:min-h-11 ${
                    statusSelecionados.length > 0 && !selecionado
                      ? "border-border bg-muted/50 text-muted-foreground opacity-55 hover:opacity-90"
                      : `${cartao.estilo} ${selecionado ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <cartao.icone
                      aria-hidden="true"
                      className="size-4 shrink-0 transition-transform duration-200 group-hover:scale-110 sm:size-[18px]"
                    />
                    <span className="truncate text-[11px] font-semibold leading-tight sm:text-sm 2xl:text-xs">
                      {cartao.nome}
                    </span>
                  </span>
                  <span className="shrink-0 text-base font-bold leading-none tabular-nums sm:text-xl">
                    {formatarInteiro(quantidade)}
                  </span>
                </button>
              );
            })}
          </section>
        )}

        {exibirGraficos && (
          <section
            className="grid gap-3 xl:grid-cols-[repeat(15,minmax(0,1fr))] xl:grid-rows-[23vh_48vh] xl:gap-2 2xl:grid-rows-[23vh_48vh]"
            aria-label="Indicadores do dashboard"
          >
            <div className="panel order-4 min-w-0 overflow-hidden p-3 lg:p-4 xl:order-1 xl:col-span-4 xl:col-start-1 xl:row-start-1 xl:h-[23vh] 2xl:order-1 2xl:col-start-1 2xl:h-[23vh]">
              <h2 className="mb-2 text-lg font-semibold text-foreground">Pedidos por status</h2>
              {statusPedidosVisiveis.length > 0 ? (
                <div className="grid h-[220px] min-h-0 grid-cols-[minmax(112px,0.85fr)_minmax(0,1.15fr)] items-center gap-1 overflow-hidden sm:h-[250px] sm:gap-2 2xl:h-[15vh]">
                  <div className="relative h-full min-h-0 min-w-0 overflow-hidden">
                    <ChartContainer
                      config={CONFIGURACAO_GRAFICO_PEDIDOS}
                      className="h-full w-full aspect-auto"
                    >
                      <PieChart>
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(_, payload) => payload[0]?.payload.nome}
                              formatter={(valor) => `${formatarInteiro(Number(valor))} pedidos`}
                            />
                          }
                        />
                        <Pie
                          data={statusPedidosVisiveis}
                          dataKey="quantidade"
                          nameKey="nome"
                          innerRadius="58%"
                          outerRadius="88%"
                          paddingAngle={2}
                          stroke="var(--background)"
                          strokeWidth={3}
                        >
                          {statusPedidosVisiveis.map((status) => (
                            <Cell
                              key={status.id}
                              fill={CORES_GRAFICO_STATUS[status.id] ?? "var(--chart-1)"}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                        {formatarInteiro(
                          statusPedidosVisiveis.reduce(
                            (total, status) => total + status.quantidade,
                            0,
                          ),
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">pedidos</span>
                    </div>
                  </div>
                  <ul className="flex min-h-0 min-w-0 flex-col justify-center gap-0 overflow-hidden">
                    {statusPedidosVisiveis.map((status) => (
                      <li
                        key={status.id}
                        className="grid h-[30px] min-h-0 min-w-0 grid-cols-[10px_minmax(0,1fr)_minmax(48px,auto)_auto] items-center gap-x-1 sm:grid-cols-[12px_minmax(0,1fr)_minmax(64px,auto)_auto] sm:gap-x-1.5 2xl:h-[17px]"
                      >
                        <span
                          aria-hidden="true"
                          className="size-2.5 rounded-full sm:size-3"
                          style={{
                            backgroundColor: CORES_GRAFICO_STATUS[status.id] ?? "var(--chart-1)",
                          }}
                        />
                        <span
                          className="truncate text-[13px] font-medium leading-5 text-muted-foreground sm:text-base 2xl:text-xs 2xl:leading-tight"
                          title={status.nome}
                        >
                          {nomeStatusResumido(status.nome)}
                        </span>
                        <span
                          className="truncate text-xs leading-4 text-muted-foreground sm:text-sm 2xl:text-xs 2xl:leading-tight"
                          title={formatarValorCompacto(status.valor)}
                        >
                          {formatarValorCompacto(status.valor)}
                        </span>
                        <span className="pl-1 text-xl font-bold leading-6 tabular-nums text-foreground sm:text-2xl 2xl:text-[15px] 2xl:leading-tight">
                          {formatarInteiro(status.quantidade)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="flex h-[300px] items-center justify-center text-sm text-muted-foreground 2xl:h-[12vh]">
                  Nenhum status de pedido encontrado na API.
                </p>
              )}
            </div>

            <div className="panel order-7 min-w-0 overflow-hidden p-3 lg:p-4 xl:order-3 xl:col-span-4 xl:col-start-8 xl:row-start-1 xl:h-[23vh] 2xl:order-3 2xl:row-start-1 2xl:h-[23vh]">
              <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h2 className="text-lg font-semibold text-foreground">Evolução das Ordens</h2>
                <span className="text-xs text-muted-foreground">últimos 7 dias</span>
                <button
                  type="button"
                  aria-label="Atualizar evolução das ordens"
                  title="Consultar novamente agora"
                  disabled={evolucaoCarregando && consultaEvolucaoEmAndamento.current}
                  onClick={() => void atualizarEvolucao()}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${evolucaoCarregando ? "animate-spin" : ""}`} />
                </button>
                {evolucaoCarregando ? (
                  <span
                    role="status"
                    aria-live="polite"
                    className="text-xs font-medium text-amber-600 dark:text-amber-400"
                  >
                    Consultando últimos 7 dias...
                  </span>
                ) : null}
              </div>
              {erroEvolucao ? (
                <p
                  role="status"
                  className="flex h-[190px] items-center justify-center text-center text-sm text-destructive 2xl:h-[15vh]"
                >
                  Falha ao consultar a Evolução das Ordens. Tentaremos novamente na próxima
                  atualização.
                </p>
              ) : (
                <ChartContainer
                  config={CONFIGURACAO_GRAFICO_EVOLUCAO}
                  className="h-[190px] aspect-auto 2xl:h-[15vh]"
                >
                  <ComposedChart
                    data={evolucaoOrdens}
                    margin={{ top: 24, right: 6, left: 2, bottom: 2 }}
                  >
                    <CartesianGrid vertical strokeDasharray="3 3" opacity={0.35} />
                    <XAxis
                      dataKey="rotulo"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      yAxisId="quantidade"
                      allowDecimals={false}
                      width={38}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="valor"
                      orientation="right"
                      width={76}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(valor: number) => formatarValorCompacto(valor)}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(_, payload) => payload[0]?.payload.data}
                          formatter={(valor, nome) =>
                            nome === "Valor (R$)"
                              ? formatarMoeda(Number(valor))
                              : `${formatarInteiro(Number(valor))} ordens`
                          }
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      yAxisId="quantidade"
                      dataKey="quantidade"
                      name="Ordens"
                      fill="var(--color-quantidade)"
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList
                        dataKey="quantidade"
                        position="insideTop"
                        formatter={(quantidade: number) =>
                          quantidade > 0 ? formatarInteiro(quantidade) : ""
                        }
                        fill="white"
                        stroke="#0b1730"
                        strokeWidth={2}
                        paintOrder="stroke"
                        fontSize={10}
                        fontWeight={700}
                      />
                      <LabelList
                        dataKey="valor"
                        position="top"
                        formatter={(valor: number) =>
                          valor > 0 ? formatarValorCompacto(valor) : ""
                        }
                        fill="var(--foreground)"
                        fontSize={9}
                        fontWeight={600}
                      />
                    </Bar>
                    <Line
                      yAxisId="valor"
                      dataKey="valor"
                      name="Valor (R$)"
                      type="monotone"
                      stroke="var(--color-valor)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ChartContainer>
              )}
            </div>

            <DistribuicaoEstados estados={estadosDestinatarioVisiveis} />

            <div className="panel order-5 min-w-0 p-3 lg:p-4 xl:order-2 xl:col-span-3 xl:col-start-5 xl:row-start-1 xl:h-[23vh] 2xl:order-2 2xl:row-start-1 2xl:h-[23vh] 2xl:overflow-hidden">
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                Reabastecimento por setor
              </h2>
              {reabastecimentoFunil.length > 0 ? (
                <ChartContainer
                  config={CONFIGURACAO_GRAFICO_REABASTECIMENTO}
                  className="h-[240px] aspect-auto sm:h-[250px] 2xl:h-[15vh]"
                >
                  <FunnelChart margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(_, payload) => `Setor ${payload[0]?.payload.setor}`}
                          formatter={(valor, _nome, item) => (
                            <div className="grid gap-1">
                              <span>{formatarInteiro(Number(valor))} posições bloqueadas</span>
                              <span className="text-muted-foreground">
                                Peça {formatarInteiro(Number(item.payload.peca))} · Produto{" "}
                                {formatarInteiro(Number(item.payload.produto))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Funnel
                      data={reabastecimentoFunil}
                      dataKey="quantidade"
                      nameKey="setor"
                      isAnimationActive
                    >
                      <LabelList
                        dataKey="quantidade"
                        position="center"
                        formatter={(quantidade: number) => formatarInteiro(quantidade)}
                        fill="white"
                        stroke="#0b1730"
                        strokeWidth={2}
                        paintOrder="stroke"
                        fontSize={12}
                        fontWeight={700}
                      />
                      <LabelList
                        dataKey="rotulo"
                        position="right"
                        fill="var(--foreground)"
                        fontSize={10}
                      />
                      {reabastecimentoFunil.map((setor, indice) => (
                        <Cell
                          key={setor.setor}
                          fill={
                            [
                              "var(--chart-1)",
                              "var(--chart-2)",
                              "var(--chart-3)",
                              "var(--chart-4)",
                              "var(--chart-5)",
                            ][indice % 5]!
                          }
                        />
                      ))}
                    </Funnel>
                  </FunnelChart>
                </ChartContainer>
              ) : (
                <p className="flex h-[300px] items-center justify-center text-sm text-muted-foreground 2xl:h-[13vh]">
                  Nenhuma posição bloqueada encontrada para o status informado.
                </p>
              )}
            </div>

            <div className="panel order-6 min-w-0 p-3 lg:p-4 xl:order-4 xl:col-span-4 xl:col-start-12 xl:row-start-1 xl:h-[23vh] 2xl:order-4 2xl:row-start-1 2xl:h-[23vh] 2xl:overflow-hidden">
              <div className="mb-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Ordens por tempo de criação
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Das mais recentes às mais antigas · baseado na dataHora da ordem
                </p>
              </div>
              <ChartContainer
                config={CONFIGURACAO_GRAFICO_IDADE}
                className="h-[180px] aspect-auto sm:h-[200px] 2xl:h-[15vh]"
              >
                <BarChart data={ordensPorIdade} margin={{ top: 22, right: 4, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                  <XAxis
                    dataKey="rotulo"
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickFormatter={(valor: number) =>
                      new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(valor)
                    }
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => payload[0]?.payload.nome}
                        formatter={(valor) => `${formatarInteiro(Number(valor))} ordens`}
                      />
                    }
                  />
                  <Bar
                    dataKey="quantidade"
                    name="Ordens"
                    fill="var(--color-quantidade)"
                    radius={[7, 7, 0, 0]}
                  >
                    <LabelList
                      dataKey="quantidade"
                      position="top"
                      formatter={(quantidade: number) => formatarInteiro(quantidade)}
                      fill="var(--foreground)"
                      fontSize={12}
                      fontWeight={600}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>

            <div className="panel order-1 min-w-0 p-3 lg:p-4 xl:order-5 xl:col-span-4 xl:col-start-1 xl:row-start-2 xl:h-[48vh] xl:overflow-hidden 2xl:order-6 2xl:h-[48vh]">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                      <ClipboardList aria-hidden="true" className="size-4" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Fila por família</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {filasFiltradas.length} de {filas.length} famílias · pedidos e valor total
                      </p>
                    </div>
                  </div>
                </div>
                <label className="relative block w-full sm:max-w-sm">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    aria-label="Pesquisar família de fila"
                    placeholder="Pesquisar fila..."
                    value={buscaFila}
                    onChange={(event) => setBuscaFila(event.target.value)}
                    className="h-9 rounded-xl border-border bg-background/60 pl-9 text-sm"
                  />
                </label>
              </div>
              <div className="space-y-2 sm:hidden">
                {filasFiltradas.map((fila) => (
                  <article
                    key={fila.nome}
                    className="rounded-lg border border-border/70 bg-background/30 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
                        <span
                          aria-hidden="true"
                          className={`size-2.5 shrink-0 rounded-full ${corIndicadorFila(fila.nome)}`}
                        />
                        <span className="break-words">{fila.nome}</span>
                      </h3>
                      <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                        {formatarMoeda(fila.valorTotal)}
                      </span>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Pedidos</dt>
                        <dd className="font-medium tabular-nums">
                          {formatarInteiro(fila.quantidade)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">% do total</dt>
                        <dd className="font-medium tabular-nums">
                          {totalOrdens(ordensVisiveis) > 0
                            ? `${formatarInteiro((fila.quantidade / totalOrdens(ordensVisiveis)) * 100)}%`
                            : "0%"}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
                {filasFiltradas.length === 0 && (
                  <p className="rounded-lg border border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                    Nenhuma fila encontrada.
                  </p>
                )}
              </div>
              <div className="hidden max-h-[300px] overflow-auto rounded-xl border border-border/70 sm:block xl:max-h-[40vh]">
                <table className="w-full table-fixed text-left text-sm 2xl:text-xs">
                  <thead className="bg-card text-xs font-semibold text-muted-foreground lg:text-sm">
                    <tr>
                      <th className="w-[42%] px-1.5 py-2 2xl:px-1">Família da fila</th>
                      <th className="w-[16%] px-1.5 py-2 text-right 2xl:px-1">Pedidos</th>
                      <th className="w-[15%] px-1.5 py-2 text-right 2xl:px-1">% do total</th>
                      <th className="w-[27%] px-1.5 py-2 text-right 2xl:px-1">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasFiltradas.map((fila) => (
                      <tr
                        key={fila.nome}
                        className="border-t border-border/60 transition-colors hover:bg-primary/10"
                      >
                        <td className="truncate px-1.5 py-1.5 font-semibold text-foreground 2xl:px-1">
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className={`size-2.5 rounded-full ${corIndicadorFila(fila.nome)}`}
                            />
                            {fila.nome}
                          </span>
                        </td>
                        <td className="truncate px-1.5 py-1.5 text-right tabular-nums 2xl:px-1">
                          {formatarInteiro(fila.quantidade)}
                        </td>
                        <td className="truncate px-1.5 py-1.5 text-right tabular-nums 2xl:px-1">
                          {totalOrdens(ordensVisiveis) > 0
                            ? `${formatarInteiro((fila.quantidade / totalOrdens(ordensVisiveis)) * 100)}%`
                            : "0%"}
                        </td>
                        <td className="truncate px-1.5 py-1.5 text-right font-semibold tabular-nums text-foreground 2xl:px-1">
                          {formatarMoeda(fila.valorTotal)}
                        </td>
                      </tr>
                    ))}
                    {filasFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          Nenhuma fila encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel order-2 min-w-0 p-3 lg:p-4 xl:order-6 xl:col-span-5 xl:col-start-5 xl:row-start-2 xl:h-[48vh] xl:overflow-hidden 2xl:order-5 2xl:col-start-5 2xl:h-[48vh]">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between 2xl:flex-col 2xl:items-stretch">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Package aria-hidden="true" className="size-4" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Ranking de produtos com mais saídas
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatarInteiro(produtosMaisSaidas.length)} produtos · quantidades dos
                      pedidos filtrados
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { categoria: "peca", nome: "Peça", cor: "sky" },
                      { categoria: "produto", nome: "Produto", cor: "orange" },
                    ] as const
                  ).map(({ categoria, nome, cor }) => {
                    const selecionado = categoriasProdutoSelecionadas.includes(categoria);
                    const classeSelecionada = {
                      sky: "border-sky-400 bg-sky-400 text-slate-950",
                      orange: "border-orange-400 bg-orange-400 text-slate-950",
                    }[cor];
                    const classeInativa = {
                      sky: "border-sky-400/50 text-sky-300 hover:bg-sky-400/10",
                      orange: "border-orange-400/50 text-orange-300 hover:bg-orange-400/10",
                    }[cor];
                    return (
                      <button
                        key={categoria}
                        type="button"
                        aria-pressed={selecionado}
                        onClick={() =>
                          setCategoriasProdutoSelecionadas((atuais) =>
                            selecionado
                              ? atuais.filter((item) => item !== categoria)
                              : [...atuais, categoria],
                          )
                        }
                        className={`min-h-9 rounded-xl border px-3 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          selecionado ? classeSelecionada : classeInativa
                        }`}
                      >
                        {nome}
                      </button>
                    );
                  })}
                  <label className="relative block w-full sm:w-64">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      aria-label="Pesquisar produto no ranking"
                      placeholder="Pesquisar código ou produto..."
                      value={buscaProduto}
                      onChange={(event) => setBuscaProduto(event.target.value)}
                      className="h-9 rounded-xl border-border bg-background/60 pl-9 text-sm"
                    />
                  </label>
                </div>
              </div>
              {produtosMaisSaidas.length > 0 ? (
                <>
                  <div className="max-h-[420px] space-y-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden xl:max-h-[40vh]">
                    {produtosMaisSaidas.map((produto, indice) => (
                      <article
                        key={produto.id}
                        className="rounded-lg border border-border/70 bg-background/30 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 gap-2">
                            <span className="font-bold tabular-nums text-primary">
                              {indice + 1}.
                            </span>
                            <div className="min-w-0">
                              <h3 className="flex items-start gap-2 break-words text-sm font-semibold text-foreground">
                                <span
                                  aria-hidden="true"
                                  className={`mt-1.5 size-2.5 shrink-0 rounded-full ${corIndicadorProduto(produto.categoria)}`}
                                />
                                <span title={produto.descricao}>
                                  {descricaoProdutoResumida(produto.descricao)}
                                </span>
                              </h3>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Código: {produto.codigo}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 text-right text-lg font-bold tabular-nums text-foreground">
                            {formatarInteiro(produto.quantidade)}
                            <span className="block text-xs font-normal text-muted-foreground">
                              saídas
                            </span>
                          </span>
                        </div>
                        <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                          Em {formatarInteiro(produto.pedidos)} pedidos
                        </p>
                      </article>
                    ))}
                  </div>
                  <div className="hidden max-h-[420px] overflow-y-auto overflow-x-hidden rounded-xl border border-border/70 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:block xl:max-h-[40vh]">
                    <table className="w-full table-fixed text-left text-sm">
                      <thead className="sticky top-0 bg-card text-xs font-semibold text-muted-foreground lg:text-sm">
                        <tr>
                          <th className="w-[7%] px-1 py-2.5 text-right sm:px-2">#</th>
                          <th className="w-[18%] px-1 py-2.5 sm:px-2">Código</th>
                          <th className="w-[40%] px-1 py-2.5 sm:px-2">Produto</th>
                          <th className="w-[17%] px-1 py-2.5 text-right sm:px-2">Pedidos</th>
                          <th className="w-[18%] px-1 py-2.5 text-right sm:px-2">Saídas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {produtosMaisSaidas.map((produto, indice) => (
                          <tr
                            key={produto.id}
                            className="border-t border-border/60 transition-colors hover:bg-primary/10"
                          >
                            <td className="truncate px-1 py-1.5 text-right font-semibold tabular-nums text-primary sm:px-2">
                              {indice + 1}
                            </td>
                            <td
                              className="truncate px-1 py-1.5 font-medium tabular-nums text-foreground sm:px-2"
                              title={produto.codigo}
                            >
                              {produto.codigo}
                            </td>
                            <td className="min-w-0 px-1 py-1.5 text-foreground sm:px-2">
                              <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                                <span
                                  aria-hidden="true"
                                  className={`size-2.5 shrink-0 rounded-full ${corIndicadorProduto(produto.categoria)}`}
                                />
                                <span className="truncate" title={produto.descricao}>
                                  {descricaoProdutoResumida(produto.descricao)}
                                </span>
                              </span>
                            </td>
                            <td className="truncate px-1 py-1.5 text-right tabular-nums sm:px-2">
                              {formatarInteiro(produto.pedidos)}
                            </td>
                            <td className="truncate px-1 py-1.5 text-right font-bold tabular-nums text-foreground sm:px-2">
                              {formatarInteiro(produto.quantidade)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="rounded-lg border border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado nos pedidos dos status selecionados.
                </p>
              )}
            </div>
          </section>
        )}

        {!exibirGraficos && (
          <footer className="panel px-5 py-3 text-center text-base tracking-[0.14em] text-muted-foreground">
            {apiAtiva ? (
              <>
                Próxima atualização em{" "}
                <span className="text-foreground tabular-nums">{contador}s</span>
              </>
            ) : (
              "Consultas da API pausadas"
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

function obterConsultaAtiva(consultaInicial?: ConsultaEship): ConsultaEship {
  if (consultaInicial) return consultaInicial;
  const configuracaoGeral = lerConfiguracaoWms() ?? CONFIGURACAO_WMS_PADRAO;
  return consultaDaConfiguracao(configuracaoGeral);
}
