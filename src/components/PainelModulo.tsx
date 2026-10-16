import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Package, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
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

const INTERVALO_SEGUNDOS = 30;
const CONFIGURACAO_GRAFICO_VALORES: ChartConfig = {
  valor: { label: "Valor", color: "var(--chart-1)" },
};
const CONFIGURACAO_GRAFICO_PEDIDOS: ChartConfig = {
  quantidade: { label: "Pedidos", color: "var(--chart-1)" },
  valor: { label: "Valor total", color: "var(--chart-2)" },
};
const CONFIGURACAO_GRAFICO_PARETO: ChartConfig = {
  quantidade: { label: "Ordens", color: "var(--chart-1)" },
  percentualAcumulado: { label: "Acumulado", color: "var(--chart-2)" },
};
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

type TransportePedido = {
  nome: string;
  quantidade: number;
};

type ConsultaFn = (options: { data: ConsultaEship }) => Promise<{
  ordens: OrdemWMS[];
  statusPedidos?: StatusPedido[];
  fretesPorStatus?: FretePorStatus[];
  transportePedidos?: TransportePedido[];
  estadosDestinatario?: EstadoDestinatario[];
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
  const [fretesPorStatus, setFretesPorStatus] = useState<FretePorStatus[]>([]);
  const [transportePedidos, setTransportePedidos] = useState<TransportePedido[]>([]);
  const [estadosDestinatario, setEstadosDestinatario] = useState<EstadoDestinatario[]>([]);
  const [buscaFila, setBuscaFila] = useState("");
  const [apiAtiva, setApiAtiva] = useState(true);
  const [preferenciaApiCarregada, setPreferenciaApiCarregada] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [consultando, setConsultando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<string>("--:--:--");
  const [contador, setContador] = useState(INTERVALO_SEGUNDOS);
  const [consulta, setConsulta] = useState(() => obterConsultaAtiva(consultaInicial));
  const carregando = useRef(false);
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
    if (!preferenciaApiCarregada || !apiAtiva || carregando.current) return;
    carregando.current = true;
    setConsultando(true);
    try {
      const dados = await consultarAPI({ data: consulta });
      setOrdens(dados.ordens);
      setStatusPedidos(dados.statusPedidos ?? []);
      setFretesPorStatus(dados.fretesPorStatus ?? []);
      setTransportePedidos(dados.transportePedidos ?? []);
      setEstadosDestinatario(dados.estadosDestinatario ?? []);
      setConectado(true);
      setAtualizadoEm(formatarHora(new Date()));
    } catch {
      setConectado(false);
    } finally {
      carregando.current = false;
      setContador(INTERVALO_SEGUNDOS);
      setConsultando(false);
    }
  }, [apiAtiva, consulta, consultarAPI, preferenciaApiCarregada]);

  useEffect(() => {
    if (!preferenciaApiCarregada) return;
    if (!apiAtiva) {
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

  const filas = agruparOrdensPorFila(ordens);
  const filasFiltradas = filas.filter((fila) =>
    fila.nome.toLocaleLowerCase("pt-BR").includes(buscaFila.trim().toLocaleLowerCase("pt-BR")),
  );
  const totalPedidosPorTransporte = transportePedidos.reduce(
    (total, transporte) => total + transporte.quantidade,
    0,
  );
  const paretoTransporte = (() => {
    const limiteTransportes = 12;
    const itens =
      transportePedidos.length > limiteTransportes
        ? [
            ...transportePedidos.slice(0, limiteTransportes),
            {
              nome: "Demais transportes",
              quantidade: transportePedidos
                .slice(limiteTransportes)
                .reduce((total, transporte) => total + transporte.quantidade, 0),
            },
          ]
        : transportePedidos;
    let acumulado = 0;
    return itens.map((transporte) => {
      acumulado += transporte.quantidade;
      return {
        ...transporte,
        percentualAcumulado:
          totalPedidosPorTransporte > 0 ? (acumulado / totalPedidosPorTransporte) * 100 : 0,
      };
    });
  })();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <BarraModulos />
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 p-4 pl-20 lg:gap-6 lg:p-6 lg:pl-22">
        <header className="panel flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-[0.12em] text-foreground lg:text-4xl">
              {titulo}
            </h1>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground lg:text-sm">
              {subtitulo}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
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
              <span className="text-xs tracking-[0.12em] text-muted-foreground lg:text-sm">
                Última atualização: <span className="text-foreground">{atualizadoEm}</span>
              </span>
              {apiAtiva && !conectado && !consultando && (
                <span className="text-xs font-semibold tracking-[0.12em] text-destructive">
                  Falha na comunicação com a API E-SHIP
                </span>
              )}
            </div>
          </div>
        </header>

        {exibirGraficos && (
          <section
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2"
            aria-label="Resumo do dashboard"
          >
            <div className="panel flex min-w-0 items-center gap-4 p-4 lg:p-5">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary lg:size-14">
                <Package aria-hidden="true" className="size-6 lg:size-7" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">
                  VALOR DAS ORDENS
                </p>
                <p className="mt-1 break-words text-2xl font-bold tabular-nums text-foreground lg:text-3xl">
                  {formatarMoeda(valorTotal(ordens))}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Total das ordens consultadas</p>
              </div>
            </div>
            <div className="panel flex min-w-0 items-center gap-4 p-4 lg:p-5">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary lg:size-14">
                <ClipboardList aria-hidden="true" className="size-6 lg:size-7" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">
                  TOTAL DE PEDIDOS
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-foreground lg:text-4xl">
                  {formatarInteiro(totalOrdens(ordens))}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Pedidos retornados pela API</p>
              </div>
            </div>
          </section>
        )}

        {exibirGraficos && (
          <section
            className="grid gap-3 xl:grid-cols-6 2xl:grid-cols-12"
            aria-label="Indicadores do dashboard"
          >
            <div className="panel order-1 min-w-0 p-4 lg:p-5 xl:col-span-3 2xl:col-span-5">
              <h2 className="mb-3 text-base font-semibold text-foreground">Pedidos por status</h2>
              {statusPedidos.length > 0 ? (
                <ChartContainer
                  config={CONFIGURACAO_GRAFICO_PEDIDOS}
                  className="h-[300px] aspect-auto"
                >
                  <BarChart
                    data={statusPedidos}
                    margin={{ top: 38, right: 8, left: 0, bottom: 74 }}
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
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickFormatter={(valor: number) =>
                        new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(valor)
                      }
                      tickLine={false}
                      axisLine={false}
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
                <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  Nenhum status de pedido encontrado na API.
                </p>
              )}
            </div>

            <DistribuicaoEstados estados={estadosDestinatario} />

            <div className="panel order-4 min-w-0 p-4 lg:p-5 xl:col-span-3 2xl:col-span-3">
              <h2 className="mb-3 text-base font-semibold text-foreground">
                Valor do frete por status
              </h2>
              {fretesPorStatus.length > 0 ? (
                <ChartContainer
                  config={CONFIGURACAO_GRAFICO_VALORES}
                  className="h-[300px] aspect-auto"
                >
                  <BarChart
                    data={fretesPorStatus}
                    margin={{ top: 24, right: 8, left: 4, bottom: 48 }}
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
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      tickFormatter={(valor: number) =>
                        new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(valor)
                      }
                      tickLine={false}
                      axisLine={false}
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

            <div className="panel order-3 min-w-0 p-4 lg:p-5 xl:col-span-3 2xl:col-span-5">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                      <ClipboardList aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-foreground">Fila por família</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
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
                    className="h-10 rounded-xl border-border bg-background/60 pl-9"
                  />
                </label>
              </div>
              <div className="max-h-[320px] overflow-auto rounded-xl border border-border/70">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="sticky top-0 bg-card text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Família da fila</th>
                      <th className="px-4 py-3 text-right">Pedidos</th>
                      <th className="px-4 py-3 text-right">% do total</th>
                      <th className="px-4 py-3 text-right">Valor total (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasFiltradas.map((fila) => (
                      <tr
                        key={fila.nome}
                        className="border-t border-border/60 transition-colors hover:bg-primary/10"
                      >
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className={`size-2.5 rounded-full ${corIndicadorFila(fila.nome)}`}
                            />
                            {fila.nome}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {formatarInteiro(fila.quantidade)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {totalOrdens(ordens) > 0
                            ? `${formatarInteiro((fila.quantidade / totalOrdens(ordens)) * 100)}%`
                            : "0%"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-foreground">
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

            <div className="panel order-5 min-w-0 p-4 lg:p-5 xl:col-span-6 2xl:col-span-4">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-foreground">
                  Pareto de pedidos por transporte
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Top 12 + demais · barras: ordens · linha: percentual acumulado
                </p>
              </div>
              {paretoTransporte.length > 0 ? (
                <ChartContainer
                  config={CONFIGURACAO_GRAFICO_PARETO}
                  className="h-[280px] aspect-auto"
                >
                  <ComposedChart
                    data={paretoTransporte}
                    margin={{ top: 30, right: 8, left: 0, bottom: 82 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="nome"
                      angle={-32}
                      textAnchor="end"
                      interval={0}
                      height={96}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="ordens"
                      allowDecimals={false}
                      tickFormatter={(valor: number) => formatarInteiro(valor)}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="percentual"
                      orientation="right"
                      domain={[0, 100]}
                      tickFormatter={(valor: number) => `${Math.round(valor)}%`}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          formatter={(valor, nome) =>
                            nome === "percentualAcumulado"
                              ? `${Number(valor).toFixed(1)}%`
                              : formatarInteiro(Number(valor))
                          }
                        />
                      }
                    />
                    <ReferenceLine
                      yAxisId="percentual"
                      y={80}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="5 5"
                    />
                    <Bar
                      yAxisId="ordens"
                      dataKey="quantidade"
                      fill="var(--color-quantidade)"
                      radius={[6, 6, 0, 0]}
                    >
                      <LabelList
                        dataKey="quantidade"
                        position="top"
                        formatter={(quantidade: number) => formatarInteiro(quantidade)}
                        fill="var(--foreground)"
                        fontSize={11}
                        fontWeight={600}
                      />
                    </Bar>
                    <Line
                      yAxisId="percentual"
                      dataKey="percentualAcumulado"
                      type="monotone"
                      stroke="var(--color-percentualAcumulado)"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ChartContainer>
              ) : (
                <p className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                  Nenhum dado de transporte encontrado na API.
                </p>
              )}
            </div>
          </section>
        )}

        <footer className="panel px-5 py-3 text-center text-sm tracking-[0.14em] text-muted-foreground">
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
