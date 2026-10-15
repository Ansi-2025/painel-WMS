import { useServerFn } from "@tanstack/react-start";
import { Boxes, ClipboardList, ListOrdered, Package, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { BarraModulos } from "@/components/BarraModulos";
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

type FretePorStatus = {
  id: string;
  nome: string;
  valor: number;
};

type StatusPedido = {
  id: string;
  nome: string;
  quantidade: number;
};

type ConsultaFn = (options: { data: ConsultaEship }) => Promise<{
  ordens: OrdemWMS[];
  statusPedidos?: StatusPedido[];
  fretesPorStatus?: FretePorStatus[];
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
  const valoresPorFila = [...filas]
    .sort((a, b) => b.valorTotal - a.valorTotal || a.nome.localeCompare(b.nome, "pt-BR"))
    .map(({ nome, valorTotal: total, quantidade }) => ({
      nome,
      valor: total,
      quantidade,
    }));
  const ordensComFila = filas.reduce((totalFilas, fila) => totalFilas + fila.quantidade, 0);
  const filaMaisComum = filas[0];
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
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
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
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-300 lg:size-14">
                <ListOrdered aria-hidden="true" className="size-6 lg:size-7" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">
                  FILA COM MAIS PEDIDOS
                </p>
                <p className="mt-1 break-words text-2xl font-bold text-foreground lg:text-3xl">
                  {filaMaisComum?.nome ?? "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatarInteiro(filaMaisComum?.quantidade ?? 0)} pedidos
                </p>
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
            <div className="panel flex min-w-0 items-center gap-4 p-4 lg:p-5">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-300 lg:size-14">
                <Boxes aria-hidden="true" className="size-6 lg:size-7" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">
                  PEDIDOS COM FILA
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-foreground lg:text-4xl">
                  {formatarInteiro(ordensComFila)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Ordens com fila identificada</p>
              </div>
            </div>
          </section>
        )}

        {exibirGraficos && (
          <section className="grid gap-3 xl:grid-cols-3" aria-label="Indicadores do dashboard">
            <div className="panel min-w-0 p-4 lg:p-5">
              <h2 className="mb-3 text-base font-semibold text-foreground">
                Valor das ordens por fila
              </h2>
              {valoresPorFila.length > 0 ? (
                <div className="overflow-x-auto">
                  <ChartContainer
                    config={CONFIGURACAO_GRAFICO_VALORES}
                    className="h-[260px] aspect-auto"
                    style={{ minWidth: `${Math.max(640, valoresPorFila.length * 76)}px` }}
                  >
                    <BarChart
                      data={valoresPorFila}
                      margin={{ top: 28, right: 16, left: 8, bottom: 70 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="nome"
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                        height={84}
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
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            formatter={(valor) => formatarMoeda(Number(valor))}
                            labelFormatter={(nome, payload) => {
                              const quantidade = payload[0]?.payload.quantidade;
                              return `${nome} · ${formatarInteiro(Number(quantidade ?? 0))} ordens`;
                            }}
                          />
                        }
                      />
                      <Bar dataKey="valor" fill="var(--color-valor)" radius={4}>
                        <LabelList
                          dataKey="valor"
                          position="top"
                          formatter={(valor: number) => formatarValorCompacto(valor)}
                          fill="var(--foreground)"
                          fontSize={12}
                          fontWeight={600}
                        />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              ) : (
                <p className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                  Nenhuma fila encontrada no retorno da API.
                </p>
              )}
            </div>

            <div className="panel min-w-0 p-5">
              <h2 className="mb-3 text-base font-semibold text-foreground">Pedidos por status</h2>
              {statusPedidos.length > 0 ? (
                <ChartContainer
                  config={CONFIGURACAO_GRAFICO_PEDIDOS}
                  className="h-[260px] aspect-auto"
                >
                  <BarChart
                    data={statusPedidos}
                    margin={{ top: 24, right: 8, left: 0, bottom: 74 }}
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
                          formatter={(valor) => formatarInteiro(Number(valor))}
                        />
                      }
                    />
                    <Bar dataKey="quantidade" fill="var(--color-quantidade)" radius={[7, 7, 0, 0]}>
                      <LabelList
                        dataKey="quantidade"
                        position="top"
                        formatter={(quantidade: number) => formatarInteiro(quantidade)}
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

            <div className="panel min-w-0 p-4 lg:p-5">
              <h2 className="mb-3 text-base font-semibold text-foreground">
                Valor do frete por status
              </h2>
              {fretesPorStatus.length > 0 ? (
                <ChartContainer
                  config={CONFIGURACAO_GRAFICO_VALORES}
                  className="h-[260px] aspect-auto"
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
                <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  Nenhum frete encontrado para os status selecionados.
                </p>
              )}
            </div>

            <div className="panel min-w-0 p-4 xl:col-span-3 lg:p-5">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Fila por família</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {filasFiltradas.length} de {filas.length} famílias · pedidos e valor total
                  </p>
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
              <div className="max-h-64 overflow-auto rounded-xl border border-border/70">
                <table className="w-full min-w-[640px] text-left text-sm">
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
                        <td className="px-4 py-3 font-medium text-foreground">{fila.nome}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatarInteiro(fila.quantidade)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {totalOrdens(ordens) > 0
                            ? `${formatarInteiro((fila.quantidade / totalOrdens(ordens)) * 100)}%`
                            : "0%"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
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
