import { useServerFn } from "@tanstack/react-start";
import { CircleX, ClipboardList, Package, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { BarraModulos } from "@/components/BarraModulos";
import { DistribuicaoEstados, type EstadoDestinatario } from "@/components/DistribuicaoEstados";
import { Input } from "@/components/ui/input";
import {
  ChartContainer,
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
  assinarConfiguracaoWms,
  consultaDaConfiguracao,
  lerApiAtiva,
  lerConfiguracaoWms,
  type ConsultaEship,
} from "@/lib/wms-config";

const INTERVALO_SEGUNDOS = 120;
const ATRASO_INICIO_CICLO_STATUS_MS = 20_000;
const DURACAO_STATUS_MS = 15_000;
const VALOR_CANCELADAS_HOJE_INICIAL = 0;
const CONFIGURACAO_GRAFICO_VALORES: ChartConfig = {
  valor: { label: "Valor", color: "var(--chart-1)" },
};
const CONFIGURACAO_GRAFICO_IDADE: ChartConfig = {
  quantidade: { label: "Ordens", color: "var(--chart-1)" },
};
const CONFIGURACAO_GRAFICO_PEDIDOS: ChartConfig = {
  quantidade: { label: "Pedidos", color: "var(--chart-1)" },
  valor: { label: "Valor total", color: "var(--chart-2)" },
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
  { id: "1", nome: "Lançados", estilo: "border-slate-300 bg-white text-slate-950" },
  { id: "2", nome: "Emitido", estilo: "border-blue-500 bg-blue-600 text-white" },
  { id: "3", nome: "Em operação", estilo: "border-orange-500 bg-orange-500 text-white" },
  { id: "4", nome: "Conferida", estilo: "border-green-600 bg-green-600 text-white" },
  {
    id: "5",
    nome: "Ag. Documentação",
    estilo: "border-gray-500 bg-gray-500 text-white",
  },
  {
    id: "6",
    nome: "Ag. Expedição",
    estilo: "border-sky-400 bg-sky-400 text-slate-950",
  },
  { id: "7", nome: "Em Expedição", estilo: "border-white bg-white text-slate-950" },
] as const;
const formatadorValorCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatarValorCompacto(valor: number): string {
  return formatadorValorCompacto.format(valor);
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

type ConsultaFn = (options: { data: ConsultaEship }) => Promise<{
  ordens: OrdemWMS[];
  statusPedidos?: StatusPedido[];
  fretesPorStatus?: FretePorStatus[];
  quantidadeCanceladasHoje?: number;
  valorCanceladasHoje?: number;
}>;

export function PainelModulo({
  titulo,
  subtitulo,
  consultar,
  consultaInicial,
  exibirGraficos = false,
}: {
  titulo: string;
  subtitulo: string;
  consultar: ConsultaFn;
  consultaInicial?: ConsultaEship;
  exibirGraficos?: boolean;
}) {
  const [ordens, setOrdens] = useState<OrdemWMS[]>([]);
  const [statusPedidos, setStatusPedidos] = useState<StatusPedido[]>([]);
  const [statusSelecionado, setStatusSelecionado] = useState<string | null>(null);
  const [fretesPorStatus, setFretesPorStatus] = useState<FretePorStatus[]>([]);
  const [quantidadeCanceladasHoje, setQuantidadeCanceladasHoje] = useState(0);
  const [valorCanceladasHoje, setValorCanceladasHoje] = useState(VALOR_CANCELADAS_HOJE_INICIAL);
  const [buscaFila, setBuscaFila] = useState("");
  const [apiAtiva, setApiAtiva] = useState(true);
  const [preferenciaApiCarregada, setPreferenciaApiCarregada] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [consultando, setConsultando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<string>("--:--:--");
  const [contador, setContador] = useState(INTERVALO_SEGUNDOS);
  const [consulta, setConsulta] = useState(() => obterConsultaAtiva(consultaInicial));
  const numeroConsultaAtual = useRef(0);
  const consultarAPI = useServerFn(consultar);

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
    if (consultaInicial) {
      setConsulta(consultaInicial);
      return;
    }
    const atualizarConsulta = () => setConsulta(obterConsultaAtiva());
    return assinarConfiguracaoWms(atualizarConsulta);
  }, [consultaInicial]);

  const atualizarDashboard = useCallback(async () => {
    if (!preferenciaApiCarregada || !apiAtiva) return;
    const numeroConsulta = ++numeroConsultaAtual.current;
    setConsultando(true);
    try {
      const consultaComStatus: ConsultaEship = {
        ...consulta,
        parametros: {
          ...consulta.parametros,
          ["statusOrdem"]: `[${CARTOES_STATUS.map(({ id }) => id).join(",")}]`,
        },
      };
      const dados = await consultarAPI({ data: consultaComStatus });
      if (numeroConsulta !== numeroConsultaAtual.current) return;
      setOrdens(dados.ordens);
      setStatusPedidos(dados.statusPedidos ?? []);
      setFretesPorStatus(dados.fretesPorStatus ?? []);
      setQuantidadeCanceladasHoje(dados.quantidadeCanceladasHoje ?? 0);
      setValorCanceladasHoje(dados.valorCanceladasHoje ?? VALOR_CANCELADAS_HOJE_INICIAL);
      setConectado(true);
      setAtualizadoEm(formatarHora(new Date()));
    } catch {
      if (numeroConsulta === numeroConsultaAtual.current) setConectado(false);
    } finally {
      if (numeroConsulta === numeroConsultaAtual.current) {
        setContador(INTERVALO_SEGUNDOS);
        setConsultando(false);
      }
    }
  }, [apiAtiva, consulta, consultarAPI, preferenciaApiCarregada]);

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
  }, [apiAtiva, atualizarDashboard, preferenciaApiCarregada]);

  useEffect(() => {
    if (!exibirGraficos) return;

    let indiceStatus = 0;
    let intervalo: number | undefined;
    const inicio = window.setTimeout(() => {
      setStatusSelecionado(CARTOES_STATUS[indiceStatus]!.id);
      intervalo = window.setInterval(() => {
        indiceStatus = (indiceStatus + 1) % CARTOES_STATUS.length;
        setStatusSelecionado(CARTOES_STATUS[indiceStatus]!.id);
      }, DURACAO_STATUS_MS);
    }, ATRASO_INICIO_CICLO_STATUS_MS);

    return () => {
      window.clearTimeout(inicio);
      if (intervalo !== undefined) window.clearInterval(intervalo);
    };
  }, [exibirGraficos]);

  const ordensVisiveis = statusSelecionado
    ? ordens.filter((ordem) => ordem.statusId === statusSelecionado)
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
  const statusPedidosVisiveis = statusSelecionado
    ? statusPedidos.filter((status) => status.id === statusSelecionado)
    : statusPedidos;
  const fretesPorStatusVisiveis = statusSelecionado
    ? fretesPorStatus.filter((frete) => frete.id === statusSelecionado)
    : fretesPorStatus;
  const estadosDestinatarioVisiveis = (() => {
    const estados = new Map<string, EstadoDestinatario>();
    for (const ordem of ordensVisiveis) {
      const estado = ordem.estadoDestinatario;
      if (!estado) continue;
      const agregado = estados.get(estado.uf);
      if (agregado) {
        agregado.quantidade += 1;
        agregado.valor += paraNumero(ordem.infosAdicionais?.valordaordem);
      } else {
        estados.set(estado.uf, {
          ...estado,
          quantidade: 1,
          valor: paraNumero(ordem.infosAdicionais?.valordaordem),
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
  return (
    <div className="min-h-screen bg-background text-foreground">
      <BarraModulos />
      <div className="mx-auto flex min-h-screen w-full max-w-none flex-col gap-3 p-3 pb-20 sm:gap-4 sm:p-4 sm:pb-20 md:pl-20 lg:gap-4 lg:p-5 lg:pb-5 lg:pl-22">
        <header className="panel flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-[0.12em] text-foreground lg:text-3xl">
              {titulo}
            </h1>
            <p className="mt-0.5 text-xs uppercase tracking-[0.2em] text-muted-foreground lg:text-sm">
              {subtitulo}
            </p>
          </div>
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
              <span className="text-[11px] tracking-[0.12em] text-muted-foreground lg:text-xs">
                Última atualização: <span className="text-foreground">{atualizadoEm}</span>
              </span>
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
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            aria-label="Resumo do dashboard"
          >
            <div className="panel flex min-w-0 items-center gap-3 p-3 lg:p-3.5">
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
            <div className="panel flex min-w-0 items-center gap-3 p-3 lg:p-3.5">
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
            <div className="panel flex min-w-0 items-center gap-3 p-3 lg:p-3.5">
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
          </section>
        )}

        {exibirGraficos && (
          <section
            className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 xl:grid-cols-7"
            role="group"
            aria-label={
              statusSelecionado
                ? `Filtrando por ${CARTOES_STATUS.find(({ id }) => id === statusSelecionado)?.nome}`
                : "Todos os status ativos"
            }
          >
            {CARTOES_STATUS.map((cartao) => {
              const quantidade =
                statusPedidos.find((status) => status.id === cartao.id)?.quantidade ?? 0;
              const selecionado = statusSelecionado === cartao.id;
              return (
                <button
                  key={cartao.id}
                  type="button"
                  aria-pressed={selecionado}
                  aria-label={`${selecionado ? "Remover filtro de" : "Filtrar por"} ${cartao.nome}`}
                  onClick={() =>
                    setStatusSelecionado((atual) => (atual === cartao.id ? null : cartao.id))
                  }
                  className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-1.5 text-center shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-16 sm:px-2 sm:py-2 ${
                    statusSelecionado && !selecionado
                      ? "border-border bg-muted/50 text-muted-foreground opacity-55 hover:opacity-90"
                      : `${cartao.estilo} ${selecionado ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`
                  }`}
                >
                  <span className="text-xs font-semibold leading-tight sm:text-base lg:text-lg">
                    {cartao.nome}
                  </span>
                  <span className="text-lg font-bold tabular-nums leading-none sm:text-2xl">
                    {formatarInteiro(quantidade)}
                  </span>
                </button>
              );
            })}
          </section>
        )}

        {exibirGraficos && (
          <section className="grid gap-3 xl:grid-cols-12" aria-label="Indicadores do dashboard">
            <div className="panel order-3 min-w-0 p-3 lg:p-4 xl:order-2 xl:col-span-4">
              <h2 className="mb-2 text-lg font-semibold text-foreground">Pedidos por status</h2>
              {statusPedidosVisiveis.length > 0 ? (
                <ChartContainer
                  config={CONFIGURACAO_GRAFICO_PEDIDOS}
                  className="h-[180px] aspect-auto sm:h-[200px]"
                >
                  <BarChart
                    data={statusPedidosVisiveis}
                    margin={{ top: 32, right: 4, left: 0, bottom: 64 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="nome"
                      tickFormatter={nomeStatusResumido}
                      angle={-28}
                      textAnchor="end"
                      interval={0}
                      height={94}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickFormatter={(valor: number) =>
                        new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(valor)
                      }
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          formatter={(valor, nome) =>
                            nome === "valor"
                              ? formatarMoeda(Number(valor))
                              : formatarInteiro(Number(valor))
                          }
                        />
                      }
                    />
                    <Bar dataKey="quantidade" fill="var(--color-quantidade)" radius={[7, 7, 0, 0]}>
                      <LabelList
                        dataKey="quantidade"
                        position="insideTop"
                        formatter={(quantidade: number) => formatarInteiro(quantidade)}
                        fill="white"
                        fontSize={12}
                        fontWeight={600}
                      />
                      <LabelList
                        dataKey="valor"
                        position="top"
                        formatter={(valor: number) => formatarValorCompacto(valor)}
                        fill="var(--foreground)"
                        fontSize={11}
                        fontWeight={600}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                  Nenhum status de pedido encontrado na API.
                </p>
              )}
            </div>

            <DistribuicaoEstados estados={estadosDestinatarioVisiveis} />

            <div className="panel order-4 min-w-0 p-3 lg:p-4 xl:order-3 xl:col-span-4">
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                Valor do frete por status
              </h2>
              {fretesPorStatusVisiveis.length > 0 ? (
                <ChartContainer
                  config={CONFIGURACAO_GRAFICO_VALORES}
                  className="h-[180px] aspect-auto sm:h-[200px]"
                >
                  <BarChart
                    data={fretesPorStatusVisiveis}
                    margin={{ top: 22, right: 4, left: 0, bottom: 44 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="nome"
                      tickFormatter={nomeStatusResumido}
                      angle={-18}
                      textAnchor="end"
                      interval={0}
                      height={56}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickFormatter={(valor: number) =>
                        new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(valor)
                      }
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent formatter={(valor) => formatarMoeda(Number(valor))} />
                      }
                    />
                    <Bar dataKey="valor" fill="var(--color-valor)" radius={[7, 7, 0, 0]}>
                      <LabelList
                        dataKey="valor"
                        position="top"
                        formatter={(valor: number) => formatarValorCompacto(valor)}
                        fill="var(--foreground)"
                        fontSize={11}
                        fontWeight={600}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                  Nenhum frete encontrado para os status selecionados.
                </p>
              )}
            </div>

            <div className="panel order-5 min-w-0 p-3 lg:p-4 xl:order-1 xl:col-span-4">
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
                className="h-[180px] aspect-auto sm:h-[200px]"
              >
                <BarChart data={ordensPorIdade} margin={{ top: 22, right: 4, left: 0, bottom: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
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

            <div className="panel order-1 min-w-0 p-3 lg:p-4 xl:order-4 xl:col-span-5 2xl:col-span-5">
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
              <div className="hidden rounded-xl border border-border/70 sm:block">
                <table className="w-full min-w-[500px] text-left text-sm">
                  <thead className="bg-card text-xs font-semibold text-muted-foreground lg:text-sm">
                    <tr>
                      <th className="px-3 py-2.5">Família da fila</th>
                      <th className="px-3 py-2.5 text-right">Pedidos</th>
                      <th className="px-3 py-2.5 text-right">% do total</th>
                      <th className="px-3 py-2.5 text-right">Valor total (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasFiltradas.map((fila) => (
                      <tr
                        key={fila.nome}
                        className="border-t border-border/60 transition-colors hover:bg-primary/10"
                      >
                        <td className="px-3 py-1.5 font-semibold text-foreground">
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className={`size-2.5 rounded-full ${corIndicadorFila(fila.nome)}`}
                            />
                            {fila.nome}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatarInteiro(fila.quantidade)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {totalOrdens(ordensVisiveis) > 0
                            ? `${formatarInteiro((fila.quantidade / totalOrdens(ordensVisiveis)) * 100)}%`
                            : "0%"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-foreground">
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
          </section>
        )}

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
      </div>
    </div>
  );
}

function obterConsultaAtiva(consultaInicial?: ConsultaEship): ConsultaEship {
  if (consultaInicial) return consultaInicial;
  const configuracaoGeral = lerConfiguracaoWms() ?? CONFIGURACAO_WMS_PADRAO;
  return consultaDaConfiguracao(configuracaoGeral);
}
