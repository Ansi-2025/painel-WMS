import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  CircleAlert,
  ClipboardList,
  ExternalLink,
  Image as ImageIcon,
  LayoutGrid,
  MapPin,
  Package,
  Pause,
  Play,
  RefreshCw,
  ChartColumn,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarraModulos } from "@/components/BarraModulos";
import { DetalhesPainel, type SecaoDetalhesPainel } from "@/components/DetalhesPainel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assinarApiAtiva, lerApiAtiva } from "@/lib/wms-config";
import {
  consultarInventarioWms,
  type PainelInventarioWms,
  type StatusPlanoInventarioWms,
} from "@/lib/wms.functions";

const INTERVALO_ATUALIZACAO_MS = 2 * 60 * 1000;
const formatadorInteiro = new Intl.NumberFormat("pt-BR");
const CORES_STATUS: Record<string, string> = {
  "1": "#94a3b8",
  "2": "#2563eb",
  "3": "#f97316",
  "4": "#a855f7",
  "5": "#0ea5e9",
  "6": "#16a34a",
  "7": "#059669",
  "8": "#ef4444",
};
const CARTOES_RESUMO = [
  { titulo: "Em contagem", statusId: "2", icone: Play, cor: "text-blue-500" },
  { titulo: "Contagem parada", statusId: "3", icone: Pause, cor: "text-orange-500" },
  {
    titulo: "Aguardando ajuste",
    statusId: "4",
    icone: ClipboardList,
    cor: "text-violet-500",
  },
  { titulo: "Em ajuste", statusId: "5", icone: RefreshCw, cor: "text-sky-500" },
] as const;
type FiltroStatusInventario = {
  ids: string[];
  nome: string;
};
const SECOES_DETALHES_INVENTARIO = [
  {
    titulo: "Indicadores",
    itens: [
      {
        titulo: "Registros no plano",
        descricao:
          "Quantidade total de planos de produto e de posição retornados para o inventário ativo.",
      },
      {
        titulo: "Cartões de status",
        descricao:
          "Quantidade de registros em cada etapa do plano, conforme o status informado pela API.",
      },
      {
        titulo: "Distribuição por status",
        descricao:
          "Gráfico que compara a quantidade de registros em cada status presente no plano.",
      },
    ],
  },
  {
    titulo: "Mapa e tabela",
    itens: [
      {
        titulo: "Mapa de endereçamento",
        descricao:
          "Mostra as posições do inventário agrupadas por setor e rua, com a quantidade de contagens planejadas em cada rua. Os endereços completos são associados pela API de Endereçamento.",
      },
      {
        titulo: "Itens do plano",
        descricao:
          "Permite pesquisar itens por código, descrição, endereço, depósito ou status e alternar entre registros por produto e por posição. Produtos são identificados como Peça ou Produto; quando há link correspondente na planilha, o atalho abre o documento/imagem.",
      },
      {
        titulo: "Atualização",
        descricao:
          "Os dados são consultados ao abrir o módulo, manualmente pelo botão Atualizar e a cada dois minutos enquanto as consultas automáticas estão ativas.",
      },
    ],
  },
] satisfies SecaoDetalhesPainel[];

function formatarInteiro(valor: number): string {
  return formatadorInteiro.format(valor);
}

function obterStatus(status: StatusPlanoInventarioWms[], id: string): number {
  return status.find((item) => item.id === id)?.quantidade ?? 0;
}

function formatarDataHora(valor: string | null): string {
  if (!valor) return "Data não informada";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

function formatarAtualizacao(valor: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(valor));
}

function formatarDuracao(duracaoMs: number): string {
  if (duracaoMs < 1000) return `${Math.max(0, Math.round(duracaoMs))} ms`;
  const segundos = Math.round(duracaoMs / 1000);
  const minutos = Math.floor(segundos / 60);
  const segundosRestantes = segundos % 60;
  return minutos > 0 ? `${minutos} min ${segundosRestantes} s` : `${segundosRestantes} s`;
}

function CartaoResumo({
  titulo,
  valor,
  icone: Icone,
  cor,
  ativo,
  onClick,
}: {
  titulo: string;
  valor: number;
  icone: typeof Package;
  cor: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`panel min-h-28 w-full p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5 ${
        ativo ? "border-primary ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
          {titulo}
        </span>
        <Icone aria-hidden="true" className={`size-5 shrink-0 ${cor}`} />
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
        {formatarInteiro(valor)}
      </p>
    </button>
  );
}

function GraficoStatus({
  status,
  filtroAtivo,
  onSelecionarStatus,
}: {
  status: StatusPlanoInventarioWms[];
  filtroAtivo: FiltroStatusInventario | null;
  onSelecionarStatus: (filtro: FiltroStatusInventario) => void;
}) {
  const total = status.reduce((soma, item) => soma + item.quantidade, 0);
  const formatadorPercentual = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });

  return (
    <section className="panel min-w-0 p-3 sm:p-4">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
          <Package aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-wide text-foreground sm:text-base">
            VISÃO GERAL DO INVENTÁRIO
          </h2>
          <p className="text-[11px] text-muted-foreground sm:text-xs">
            Status dos registros no plano ativo
          </p>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(112px,0.9fr)_minmax(0,1.1fr)] items-center gap-2 sm:gap-3">
        <div
          className="relative aspect-square w-full"
          role="img"
          aria-label={`Distribuição de ${formatarInteiro(total)} registros por status`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={status}
                dataKey="quantidade"
                nameKey="nome"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={1}
                stroke="none"
                isAnimationActive={false}
              >
                {status.map((item) => (
                  <Cell
                    key={item.id}
                    fill={CORES_STATUS[item.id] ?? "#64748b"}
                    fillOpacity={filtroAtivo && !filtroAtivo.ids.includes(item.id) ? 0.25 : 1}
                    onClick={() => onSelecionarStatus({ ids: [item.id], nome: item.nome })}
                    cursor="pointer"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(valor) => [formatarInteiro(Number(valor)), "Registros"]}
                contentStyle={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  borderRadius: "0.75rem",
                  color: "var(--foreground)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">
              {formatarInteiro(total)}
            </span>
            <span className="text-[10px] text-muted-foreground sm:text-xs">Total</span>
          </div>
        </div>
        <ul className="min-w-0 space-y-2">
          {status.map((item) => {
            const percentual = total === 0 ? 0 : (item.quantidade / total) * 100;
            const ativo = filtroAtivo?.ids.includes(item.id) ?? false;
            return (
              <li key={item.id} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => onSelecionarStatus({ ids: [item.id], nome: item.nome })}
                  className={`grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 rounded-md px-1 py-1 text-left text-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    ativo ? "bg-primary/10" : ""
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: CORES_STATUS[item.id] ?? "#64748b" }}
                    />
                    <span className="truncate">{item.nome}</span>
                  </span>
                  <span className="min-w-6 text-right font-semibold tabular-nums text-foreground sm:text-sm">
                    {formatarInteiro(item.quantidade)}
                  </span>
                  <span className="min-w-10 text-right text-[10px] tabular-nums text-muted-foreground sm:min-w-12 sm:text-xs">
                    {formatadorPercentual.format(percentual)}%
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function MapaEnderecamento({
  ruas,
  enderecosSemRua,
  itens,
}: {
  ruas: PainelInventarioWms["ruas"];
  enderecosSemRua: number;
  itens: PainelInventarioWms["itens"];
}) {
  const [modo, setModo] = useState<"ruas" | "grafico">("ruas");
  const [setorSelecionado, setSetorSelecionado] = useState("todos");
  const [ruaSelecionada, setRuaSelecionada] = useState("todas");
  const [buscaEndereco, setBuscaEndereco] = useState("");
  const alturaGrafico = Math.max(240, ruas.length * 38);
  const posicoes = itens.filter((item) => item.tipoRegistro === "Posição");
  const gruposPorRua = new Map<
    string,
    { id: string; setor: string; rua: string; itens: typeof posicoes }
  >();
  for (const item of posicoes) {
    if (!item.setor || !item.rua) continue;
    const id = `${item.setor}:${item.rua}`;
    const grupo = gruposPorRua.get(id);
    if (grupo) {
      grupo.itens.push(item);
    } else {
      gruposPorRua.set(id, {
        id,
        setor: item.setor,
        rua: item.rua,
        itens: [item],
      });
    }
  }
  const gruposOrdenados = [...gruposPorRua.values()]
    .map((grupo) => ({
      ...grupo,
      itens: grupo.itens.sort(
        (a, b) =>
          Number(a.indicePosicao ?? Number.MAX_SAFE_INTEGER) -
            Number(b.indicePosicao ?? Number.MAX_SAFE_INTEGER) ||
          a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }),
      ),
    }))
    .sort(
      (a, b) =>
        a.setor.localeCompare(b.setor, "pt-BR", { numeric: true }) ||
        a.rua.localeCompare(b.rua, "pt-BR", { numeric: true }),
    );
  const setores = [...new Set(gruposOrdenados.map((grupo) => grupo.setor))];
  const ruasDisponiveis = gruposOrdenados.filter(
    (grupo) => setorSelecionado === "todos" || grupo.setor === setorSelecionado,
  );
  const buscaNormalizada = buscaEndereco.trim().toLocaleLowerCase("pt-BR");
  const gruposVisiveis = ruasDisponiveis
    .filter((grupo) => ruaSelecionada === "todas" || grupo.id === ruaSelecionada)
    .map((grupo) => ({
      ...grupo,
      itens: grupo.itens.filter((item) => {
        if (!buscaNormalizada) return true;
        return [item.codigo, item.enderecoCompleto, item.indicePosicao, item.rua, item.setor]
          .filter(Boolean)
          .some((valor) => valor?.toLocaleLowerCase("pt-BR").includes(buscaNormalizada));
      }),
    }))
    .filter((grupo) => grupo.itens.length > 0);
  const ruasGrafico = gruposVisiveis.map((grupo) => ({
    id: grupo.id,
    setor: grupo.setor,
    rua: grupo.rua,
    contagens: grupo.itens.length,
  }));
  const totalPosicoesVisiveis = ruasGrafico.reduce((total, rua) => total + rua.contagens, 0);
  const statusLegenda = [
    ...new Map(
      posicoes.map((item) => [
        item.statusId || item.status,
        { id: item.statusId || item.status, nome: item.status },
      ]),
    ).values(),
  ].sort((a, b) => Number(a.id) - Number(b.id) || a.nome.localeCompare(b.nome, "pt-BR"));

  const selecionarSetor = (setor: string) => {
    setSetorSelecionado(setor);
    setRuaSelecionada("todas");
  };

  return (
    <section className="panel min-w-0 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <h2 className="text-base font-bold tracking-wide text-foreground sm:text-lg">
              MAPA DE ENDEREÇAMENTO
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Toque em uma rua para filtrar · quantidade de posições no inventário
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
          {statusLegenda.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground sm:text-xs"
            >
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ backgroundColor: CORES_STATUS[item.id] ?? "#64748b" }}
              />
              {item.nome}
            </span>
          ))}
        </div>
      </div>
      {posicoes.length ? (
        <>
          <div className="mb-2 grid gap-2 sm:grid-cols-[minmax(150px,0.7fr)_minmax(150px,0.7fr)_minmax(220px,1.3fr)_auto]">
            <select
              aria-label="Filtrar setor do inventário"
              value={setorSelecionado}
              onChange={(event) => selecionarSetor(event.target.value)}
              className="h-9 min-w-0 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="todos">Todos os setores</option>
              {setores.map((setor) => (
                <option key={setor} value={setor}>
                  Setor {setor}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar rua do inventário"
              value={ruaSelecionada}
              onChange={(event) => setRuaSelecionada(event.target.value)}
              className="h-9 min-w-0 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="todas">Todas as ruas</option>
              {ruasDisponiveis.map((grupo) => (
                <option key={grupo.id} value={grupo.id}>
                  Setor {grupo.setor} · Rua {grupo.rua}
                </option>
              ))}
            </select>
            <label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
              <input
                aria-label="Buscar endereço no inventário"
                value={buscaEndereco}
                onChange={(event) => setBuscaEndereco(event.target.value)}
                placeholder="Buscar endereço..."
                className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
              <Search aria-hidden="true" className="size-4 shrink-0" />
            </label>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
              {(
                [
                  ["ruas", "Ruas", LayoutGrid],
                  ["grafico", "Gráfico", ChartColumn],
                ] as const
              ).map(([valor, rotulo, Icone]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={modo === valor}
                  onClick={() => setModo(valor)}
                  className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors ${
                    modo === valor
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icone aria-hidden="true" className="size-3.5" />
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[clamp(100px,15vh,200px)] min-h-0 overflow-auto rounded-xl border border-border/70 bg-muted/10 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-2.5">
            {modo === "ruas" ? (
              <div className="space-y-2">
                {setores
                  .filter((setor) => setorSelecionado === "todos" || setor === setorSelecionado)
                  .map((setor) => {
                    const gruposSetor = gruposVisiveis.filter((grupo) => grupo.setor === setor);
                    if (!gruposSetor.length) return null;
                    return (
                      <div key={setor} className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            selecionarSetor(setorSelecionado === setor ? "todos" : setor)
                          }
                          aria-pressed={setorSelecionado === setor}
                          className={`grid w-9 shrink-0 place-items-center rounded-lg border text-xs font-bold transition-colors ${
                            setorSelecionado === setor
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-background text-foreground hover:bg-muted"
                          }`}
                        >
                          {setor}
                        </button>
                        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                          {gruposSetor.map((grupo) => {
                            const selecionada =
                              setorSelecionado === grupo.setor && ruaSelecionada === grupo.id;
                            return (
                              <button
                                key={grupo.id}
                                type="button"
                                aria-pressed={selecionada}
                                onClick={() => {
                                  if (selecionada) {
                                    setSetorSelecionado("todos");
                                    setRuaSelecionada("todas");
                                  } else {
                                    setSetorSelecionado(grupo.setor);
                                    setRuaSelecionada(grupo.id);
                                  }
                                }}
                                className={`min-w-0 rounded-xl border p-2 text-left transition-colors ${
                                  selecionada
                                    ? "border-primary bg-primary/10"
                                    : "border-border bg-background/80 hover:border-primary/50 hover:bg-background"
                                }`}
                              >
                                <span className="mb-1 flex items-center justify-between gap-2">
                                  <span className="truncate text-[10px] font-bold text-foreground sm:text-[11px]">
                                    Rua {grupo.rua}
                                  </span>
                                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-foreground">
                                    {formatarInteiro(grupo.itens.length)}{" "}
                                    {grupo.itens.length === 1 ? "posição" : "posições"}
                                  </span>
                                </span>
                                <span className="flex flex-wrap gap-[2px]">
                                  {grupo.itens.map((item) => (
                                    <span
                                      key={item.id}
                                      title={`${item.enderecoCompleto ?? item.codigo} · ${item.status}`}
                                      className="h-3 w-3 rounded-sm ring-1 ring-black/10"
                                      style={{
                                        backgroundColor: CORES_STATUS[item.statusId] ?? "#64748b",
                                      }}
                                    />
                                  ))}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                {!gruposVisiveis.length ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma posição do inventário corresponde aos filtros.
                  </p>
                ) : null}
              </div>
            ) : (
              <div
                className="w-full"
                style={{ height: `${Math.min(alturaGrafico, 1800)}px`, minHeight: "240px" }}
                role="img"
                aria-label="Quantidade de posições inventariadas por rua"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ruasGrafico}
                    layout="vertical"
                    margin={{ top: 4, right: 44, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis allowDecimals={false} type="number" />
                    <YAxis
                      dataKey={(item: (typeof ruas)[number]) => `${item.setor} · Rua ${item.rua}`}
                      interval={0}
                      tick={{ fontSize: 12 }}
                      type="category"
                      width={118}
                    />
                    <Tooltip
                      formatter={(valor) => [formatarInteiro(Number(valor)), "Posições"]}
                      labelFormatter={(_, payload) => {
                        const rua = payload[0]?.payload as (typeof ruasGrafico)[number] | undefined;
                        return rua ? `Setor ${rua.setor} · Rua ${rua.rua}` : "";
                      }}
                      contentStyle={{
                        background: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "0.75rem",
                        color: "var(--foreground)",
                      }}
                    />
                    <Bar
                      dataKey="contagens"
                      name="Posições"
                      fill="var(--chart-1)"
                      radius={[0, 6, 6, 0]}
                    >
                      {ruasGrafico.map((rua) => (
                        <Cell key={rua.id} fill="#2563eb" />
                      ))}
                      <LabelList
                        dataKey="contagens"
                        fill="var(--foreground)"
                        formatter={(valor) => formatarInteiro(Number(valor))}
                        position="right"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:text-sm">
            <span>
              {formatarInteiro(totalPosicoesVisiveis)}{" "}
              {totalPosicoesVisiveis === 1
                ? "posição inventariada em"
                : "posições inventariadas em"}{" "}
              {formatarInteiro(gruposVisiveis.length)}{" "}
              {gruposVisiveis.length === 1 ? "rua" : "ruas"}
            </span>
            {enderecosSemRua ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <CircleAlert aria-hidden="true" className="size-4" />
                {formatarInteiro(enderecosSemRua)} posições sem rua identificada
              </span>
            ) : null}
          </footer>
        </>
      ) : (
        <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border bg-muted/20 px-5 py-8 text-center">
          <div>
            <CircleAlert aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
            <h3 className="mt-3 text-base font-semibold text-foreground">Nenhuma rua encontrada</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {enderecosSemRua || !gruposOrdenados.length
                ? `${formatarInteiro(enderecosSemRua)} posições do inventário não foram associadas a uma rua.`
                : "O inventário não retornou posições associadas a ruas no armazém BRANCO01."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function TabelaItens({ itens }: { itens: PainelInventarioWms["itens"] }) {
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "Produto" | "Posição">("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<"todos" | "Peça" | "Produto">("todos");
  const [buscaItem, setBuscaItem] = useState("");
  const produtos = itens.filter((item) => item.tipoRegistro === "Produto");
  const termoBusca = buscaItem
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  const itensVisiveis = itens.filter((item) => {
    const correspondeBusca =
      termoBusca === "" ||
      [
        item.tipoRegistro,
        item.categoriaProduto,
        item.codigo,
        item.descricaoProduto,
        item.enderecoCompleto,
        item.indicePosicao,
        item.rua,
        item.setor,
        item.deposito,
        item.status,
      ]
        .filter((valor): valor is string => valor !== null)
        .some((valor) =>
          valor
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("pt-BR")
            .includes(termoBusca),
        );

    return (
      correspondeBusca &&
      (filtroTipo === "todos" || item.tipoRegistro === filtroTipo) &&
      (filtroTipo !== "Produto" ||
        filtroCategoria === "todos" ||
        item.categoriaProduto === filtroCategoria)
    );
  });
  const exibirEndereco = filtroTipo !== "Produto";

  return (
    <section className="panel flex w-full min-w-0 flex-col overflow-hidden xl:min-h-0">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div>
          <h2 className="text-base font-bold tracking-wide text-foreground sm:text-lg">
            ITENS DO PLANO
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Produtos identificados como Peça ou Produto; endereços completos nas contagens por
            posição.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <label className="relative block w-full sm:w-56">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Pesquisar itens do inventário"
              placeholder="Pesquisar código ou descrição..."
              value={buscaItem}
              onChange={(event) => setBuscaItem(event.target.value)}
              className="h-9 rounded-lg border-border bg-background/60 pl-9 pr-9 text-xs"
            />
            {buscaItem ? (
              <button
                type="button"
                aria-label="Limpar pesquisa de itens"
                onClick={() => setBuscaItem("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </label>
          {(
            [
              ["todos", "Todos"],
              ["Produto", "Por produto"],
              ["Posição", "Por posição"],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={filtroTipo === valor}
              onClick={() => setFiltroTipo(valor)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                filtroTipo === valor
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {rotulo}
              <span className="ml-1.5 tabular-nums">
                {formatarInteiro(
                  valor === "todos"
                    ? itens.length
                    : itens.filter((item) => item.tipoRegistro === valor).length,
                )}
              </span>
            </button>
          ))}
          {filtroTipo === "Produto"
            ? (
                [
                  ["todos", "Todos produtos"],
                  ["Peça", "Peça"],
                  ["Produto", "Produto"],
                ] as const
              ).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={filtroCategoria === valor}
                  onClick={() => setFiltroCategoria(valor)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    filtroCategoria === valor
                      ? valor === "Peça"
                        ? "border-sky-500 bg-sky-500 text-white"
                        : valor === "Produto"
                          ? "border-orange-500 bg-orange-500 text-white"
                          : "border-primary bg-primary text-primary-foreground"
                      : valor === "Peça"
                        ? "border-sky-500/40 bg-sky-500/5 text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"
                        : valor === "Produto"
                          ? "border-orange-500/40 bg-orange-500/5 text-orange-700 hover:bg-orange-500/10 dark:text-orange-300"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  {rotulo}
                  <span className="ml-1.5 tabular-nums">
                    {formatarInteiro(
                      valor === "todos"
                        ? produtos.length
                        : produtos.filter((item) => item.categoriaProduto === valor).length,
                    )}
                  </span>
                </button>
              ))
            : null}
        </div>
      </header>
      <div className="max-h-[30vh] min-h-0 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:max-h-none xl:flex-1">
        <table
          className={`w-full ${exibirEndereco ? "min-w-[1120px]" : "min-w-[1000px]"} border-collapse text-left text-sm`}
        >
          <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 font-semibold">Tipo</th>
              <th className="px-3 py-1.5 font-semibold">Imagem</th>
              {exibirEndereco ? <th className="px-3 py-1.5 font-semibold">Endereço</th> : null}
              <th className="px-3 py-1.5 font-semibold">Código / PS</th>
              <th className="px-3 py-1.5 font-semibold">Descrição</th>
              <th className="px-3 py-1.5 font-semibold">Depósito</th>
              <th className="px-3 py-1.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {itensVisiveis.length === 0 ? (
              <tr>
                <td
                  colSpan={exibirEndereco ? 7 : 6}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  Nenhum item corresponde aos filtros selecionados.
                </td>
              </tr>
            ) : null}
            {itensVisiveis.map((item) => (
              <tr
                key={item.id}
                className={`transition-colors ${
                  item.categoriaProduto === "Peça"
                    ? "bg-sky-500/[0.035] hover:bg-sky-500/[0.08]"
                    : item.categoriaProduto === "Produto"
                      ? "bg-orange-500/[0.035] hover:bg-orange-500/[0.08]"
                      : "hover:bg-muted/30"
                }`}
              >
                <td className="whitespace-nowrap px-3 py-1.5">
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="font-medium text-foreground">{item.tipoRegistro}</span>
                    {item.categoriaProduto ? (
                      <span
                        className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${
                          item.categoriaProduto === "Peça"
                            ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                            : item.categoriaProduto === "Produto"
                              ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.categoriaProduto}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5">
                  {item.linkImagem ? (
                    <a
                      href={item.linkImagem}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Ver imagem do produto ${item.codigo}`}
                      title={`Ver imagem do produto ${item.codigo}`}
                      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ImageIcon aria-hidden="true" className="size-3.5" />
                      <ExternalLink aria-hidden="true" className="size-3" />
                    </a>
                  ) : (
                    <span
                      className="text-muted-foreground"
                      title="Sem link correspondente na planilha"
                    >
                      —
                    </span>
                  )}
                </td>
                {exibirEndereco ? (
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-foreground">
                    {item.enderecoCompleto ?? "—"}
                  </td>
                ) : null}
                <td className="whitespace-nowrap px-3 py-1.5 font-mono font-semibold text-foreground">
                  {item.codigo}
                </td>
                <td className="min-w-[280px] px-3 py-1.5 text-foreground">
                  {item.descricaoProduto}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-foreground">{item.deposito}</td>
                <td className="whitespace-nowrap px-3 py-1.5">
                  <span
                    className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                    style={{ backgroundColor: CORES_STATUS[item.statusId] ?? "#64748b" }}
                  >
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function InventarioModulo() {
  const consultarInventario = useServerFn(consultarInventarioWms);
  const montado = useRef(false);
  const [dados, setDados] = useState<PainelInventarioWms | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [apiAtiva, setApiAtiva] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusInventario | null>(null);
  const [duracaoConsultaMs, setDuracaoConsultaMs] = useState<number | null>(null);

  const selecionarFiltroStatus = useCallback((filtro: FiltroStatusInventario | null) => {
    setFiltroStatus((atual) => {
      if (filtro === null) return null;
      const mesmosIds =
        atual !== null &&
        atual.ids.length === filtro.ids.length &&
        filtro.ids.every((id) => atual.ids.includes(id));
      return mesmosIds ? null : filtro;
    });
  }, []);

  const atualizar = useCallback(async () => {
    const inicioConsulta = performance.now();
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await consultarInventario();
      if (montado.current) setDados(resultado);
    } catch (error) {
      if (montado.current) {
        setErro(
          error instanceof Error ? error.message : "Não foi possível consultar o inventário.",
        );
      }
    } finally {
      if (montado.current) {
        setDuracaoConsultaMs(performance.now() - inicioConsulta);
        setCarregando(false);
      }
    }
  }, [consultarInventario]);

  useEffect(() => {
    const classeScrollOculto = "inventario-scrollbars-hidden";
    document.documentElement.classList.add(classeScrollOculto);
    return () => document.documentElement.classList.remove(classeScrollOculto);
  }, []);

  useEffect(() => {
    montado.current = true;
    setApiAtiva(lerApiAtiva());
    void atualizar();
    const cancelarAssinatura = assinarApiAtiva(() => setApiAtiva(lerApiAtiva()));
    return () => {
      montado.current = false;
      cancelarAssinatura();
    };
  }, [atualizar]);

  useEffect(() => {
    if (!apiAtiva) return;
    const intervalo = window.setInterval(() => void atualizar(), INTERVALO_ATUALIZACAO_MS);
    return () => window.clearInterval(intervalo);
  }, [apiAtiva, atualizar]);

  const statusFinalizados =
    dados === null ? 0 : obterStatus(dados.status, "6") + obterStatus(dados.status, "7");
  const itensFiltrados = dados
    ? filtroStatus
      ? dados.itens.filter((item) => filtroStatus.ids.includes(item.statusId))
      : dados.itens
    : [];
  const cartoes = dados
    ? [
        {
          titulo: "Registros no plano",
          valor: dados.itens.length,
          icone: Package,
          cor: "text-primary",
          filtro: null,
        },
        ...CARTOES_RESUMO.map((cartao) => ({
          titulo: cartao.titulo,
          valor: obterStatus(dados.status, cartao.statusId),
          icone: cartao.icone,
          cor: cartao.cor,
          filtro: { ids: [cartao.statusId], nome: cartao.titulo },
        })),
        {
          titulo: "Ajustados / finalizados",
          valor: statusFinalizados,
          icone: BadgeCheck,
          cor: "text-emerald-500",
          filtro: { ids: ["6", "7"], nome: "Ajustados / finalizados" },
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BarraModulos />
      <main className="mx-auto flex min-h-screen max-w-[1900px] flex-col gap-4 p-3 pb-20 pt-4 sm:p-4 sm:pb-20 md:pl-20 lg:gap-5 lg:p-6 lg:pb-6 lg:pl-22">
        <header className="panel flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-[0.12em] text-foreground lg:text-4xl">
              INVENTÁRIO
            </h1>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground sm:text-sm">
              Plano ativo mais recente · armazém BRANCO01
            </p>
            {dados ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                <span className="font-semibold text-foreground">
                  Inventário: {dados.inventario.id}
                </span>
                <span className="font-medium text-foreground">{dados.inventario.descricao}</span>
                <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 font-semibold">
                  {dados.inventario.tipo}
                </span>
                <span>Criado em {formatarDataHora(dados.inventario.criadoEm)}</span>
                <span>Atualizado às {formatarAtualizacao(dados.atualizadoEm)}</span>
                <span>
                  Tempo de carregamento via API:{" "}
                  <strong className="font-semibold text-foreground">
                    {carregando
                      ? "Consultando..."
                      : duracaoConsultaMs === null
                        ? "—"
                        : formatarDuracao(duracaoConsultaMs)}
                  </strong>
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <DetalhesPainel titulo="Inventário" secoes={SECOES_DETALHES_INVENTARIO} />
            <Button
              type="button"
              onClick={() => void atualizar()}
              disabled={carregando}
              className="h-10 gap-2 px-3"
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-4 ${carregando ? "animate-spin" : ""}`}
              />
              <span>{carregando ? "Atualizando..." : "Atualizar"}</span>
            </Button>
          </div>
        </header>

        {erro ? (
          <div
            className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground"
            role="alert"
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold">Falha ao carregar o inventário</p>
              <p className="mt-1 text-muted-foreground">{erro}</p>
            </div>
          </div>
        ) : null}

        {dados ? (
          <>
            <section
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
              aria-label="Resumo do inventário"
            >
              {cartoes.map((cartao) => {
                const ativo =
                  cartao.filtro === null
                    ? filtroStatus === null
                    : filtroStatus !== null &&
                      cartao.filtro.ids.length === filtroStatus.ids.length &&
                      cartao.filtro.ids.every((id) => filtroStatus.ids.includes(id));
                return (
                  <CartaoResumo
                    key={cartao.titulo}
                    titulo={cartao.titulo}
                    valor={cartao.valor}
                    icone={cartao.icone}
                    cor={cartao.cor}
                    ativo={ativo}
                    onClick={() => selecionarFiltroStatus(cartao.filtro)}
                  />
                );
              })}
            </section>

            {filtroStatus ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                <span className="font-medium text-foreground">
                  Filtro de status: <span className="text-primary">{filtroStatus.nome}</span>
                  <span className="ml-2 text-muted-foreground">
                    ({formatarInteiro(itensFiltrados.length)} itens)
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => selecionarFiltroStatus(null)}
                  className="h-9 gap-1.5 px-2"
                >
                  <X aria-hidden="true" className="size-4" />
                  Limpar filtro
                </Button>
              </div>
            ) : null}

            <section className="grid min-w-0 gap-4 xl:h-[clamp(240px,28vh,320px)] xl:grid-cols-[minmax(0,0.5fr)_minmax(0,1.5fr)]">
              <GraficoStatus
                status={dados.status}
                filtroAtivo={filtroStatus}
                onSelecionarStatus={selecionarFiltroStatus}
              />
              <TabelaItens itens={itensFiltrados} />
            </section>

            <MapaEnderecamento
              ruas={dados.ruas}
              enderecosSemRua={dados.enderecosSemRua}
              itens={itensFiltrados}
            />
          </>
        ) : carregando ? (
          <section className="panel grid min-h-72 place-items-center px-4 py-10 text-center">
            <div>
              <RefreshCw aria-hidden="true" className="mx-auto size-8 animate-spin text-primary" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                Consultando o plano de inventário...
              </p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
