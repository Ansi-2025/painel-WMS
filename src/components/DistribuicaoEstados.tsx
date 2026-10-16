import brazilMap from "@svg-maps/brazil";
import { useEffect, useRef, useState } from "react";

export type EstadoDestinatario = {
  uf: string;
  nome: string;
  quantidade: number;
  valor: number;
};

const CORES_MAPA = ["#17345d", "#1d4e89", "#2673c9", "#4799ef", "#8bc5ff"];
const formatarQuantidade = new Intl.NumberFormat("pt-BR");
const formatadorValorCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

function corDoEstado(quantidade: number): string {
  if (quantidade <= 0) return "#10213b";
  if (quantidade >= 100) return CORES_MAPA[4]!;
  if (quantidade >= 50) return CORES_MAPA[3]!;
  if (quantidade >= 20) return CORES_MAPA[2]!;
  return CORES_MAPA[1]!;
}

export function DistribuicaoEstados({ estados }: { estados: EstadoDestinatario[] }) {
  const mapaRef = useRef<SVGSVGElement>(null);
  const [centrosEstados, setCentrosEstados] = useState<Record<string, { x: number; y: number }>>(
    {},
  );
  const quantidadesPorUf = new Map(estados.map((estado) => [estado.uf.toUpperCase(), estado]));
  const totalPedidos = estados.reduce((total, estado) => total + estado.quantidade, 0);
  const maximo = Math.max(0, ...estados.map((estado) => estado.quantidade));
  const maioresEstados = [...estados]
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, 5);

  useEffect(() => {
    const svg = mapaRef.current;
    if (!svg) return;

    const centros: Record<string, { x: number; y: number }> = {};
    for (const path of svg.querySelectorAll<SVGPathElement>("path[data-uf]")) {
      const uf = path.getAttribute("data-uf");
      if (!uf) continue;
      const bounds = path.getBBox();
      centros[uf] = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
    }
    setCentrosEstados(centros);
  }, []);

  return (
    <section
      className="panel order-2 flex min-w-0 flex-col p-4 lg:p-5 xl:col-span-6 2xl:col-span-7"
      aria-label="Distribuição das ordens pelo estado do destinatário"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Distribuição das ordens por estado
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Estado do destinatário no endereço do cliente
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {formatarQuantidade.format(totalPedidos)} ordens mapeadas ·{" "}
          {formatadorValorCompacto.format(
            estados.reduce((total, estado) => total + estado.valor, 0),
          )}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 items-center gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex h-[420px] min-w-0 items-center justify-center lg:h-[500px]">
          <svg
            ref={mapaRef}
            viewBox={brazilMap.viewBox}
            role="img"
            aria-label="Mapa do Brasil com a quantidade de ordens por estado do destinatário"
            className="h-full w-full"
          >
            {brazilMap.locations.map((local) => {
              const estado = quantidadesPorUf.get(local.id.toUpperCase());
              const quantidade = estado?.quantidade ?? 0;
              return (
                <path
                  key={local.id}
                  data-uf={local.id.toUpperCase()}
                  d={local.path}
                  fill={corDoEstado(quantidade)}
                  stroke="#8bbcff"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                >
                  <title>
                    {local.name} ({local.id.toUpperCase()}): {formatarQuantidade.format(quantidade)}{" "}
                    pedidos · {formatadorValorCompacto.format(estado?.valor ?? 0)}
                  </title>
                </path>
              );
            })}
            {brazilMap.locations.map((local) => {
              const centro = centrosEstados[local.id.toUpperCase()];
              if (!centro) return null;
              return (
                <text
                  key={`label-${local.id}`}
                  x={centro.x}
                  y={centro.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  stroke="#10213b"
                  strokeWidth="2.5"
                  paintOrder="stroke"
                  fontSize="12"
                  fontWeight="700"
                  pointerEvents="none"
                  aria-hidden="true"
                >
                  {local.id.toUpperCase()}
                </text>
              );
            })}
          </svg>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="rounded-xl border border-border/70 bg-background/30 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Top 5 estados
            </h3>
            {maioresEstados.length > 0 ? (
              <ol className="space-y-4">
                {maioresEstados.map((estado) => (
                  <li key={estado.uf} className="grid grid-cols-[2rem_minmax(0,1fr)_5rem] gap-3">
                    <span className="text-xs font-semibold text-foreground">{estado.uf}</span>
                    <span className="h-4 overflow-hidden rounded bg-muted/60">
                      <span
                        className="block h-full rounded bg-primary"
                        style={{
                          width: `${maximo > 0 ? (estado.quantidade / maximo) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <span className="text-right text-xs tabular-nums text-foreground">
                      {formatarQuantidade.format(estado.quantidade)}
                      <span className="block font-normal text-muted-foreground">
                        {formatadorValorCompacto.format(estado.valor)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum estado informado pela API.</p>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-background/30 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pedidos por estado
            </h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {[
                { label: "100+", color: CORES_MAPA[4] },
                { label: "50–99", color: CORES_MAPA[3] },
                { label: "20–49", color: CORES_MAPA[2] },
                { label: "1–19", color: CORES_MAPA[1] },
                { label: "0", color: "#10213b" },
              ].map((faixa) => (
                <span key={faixa.label} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-3 rounded-sm border border-white/20"
                    style={{ backgroundColor: faixa.color }}
                  />
                  {faixa.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Mapa:{" "}
        <a
          href="https://github.com/VictorCazanave/svg-maps/tree/master/packages/brazil"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          Victor Cazanave / SVG Maps · CC BY 4.0
        </a>
      </p>
    </section>
  );
}
