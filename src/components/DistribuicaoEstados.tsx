import brazilMap from "@svg-maps/brazil";
import { useEffect, useRef, useState } from "react";

export type EstadoDestinatario = {
  uf: string;
  nome: string;
  quantidade: number;
  valor: number;
  valorFrete: number;
};

const CORES_MAPA = ["#17345d", "#1d4e89", "#2673c9", "#4799ef", "#8bc5ff"];
const formatarQuantidade = new Intl.NumberFormat("pt-BR");
const formatadorValorCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const formatadorValorOrdensCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 0,
});

function valorFinito(valor: number | undefined): number {
  return typeof valor === "number" && Number.isFinite(valor) ? Math.max(0, valor) : 0;
}

function corDoEstado(valorFrete: number, maximoFrete: number): string {
  if (valorFrete <= 0 || maximoFrete <= 0) return "#10213b";
  const faixa = Math.min(
    Math.ceil((valorFrete / maximoFrete) * CORES_MAPA.length),
    CORES_MAPA.length,
  );
  return CORES_MAPA[faixa - 1]!;
}

export function DistribuicaoEstados({ estados }: { estados: EstadoDestinatario[] }) {
  const mapaRef = useRef<SVGSVGElement>(null);
  const [centrosEstados, setCentrosEstados] = useState<Record<string, { x: number; y: number }>>(
    {},
  );
  const quantidadesPorUf = new Map(estados.map((estado) => [estado.uf.toUpperCase(), estado]));
  const totalPedidos = estados.reduce((total, estado) => total + estado.quantidade, 0);
  const totalFrete = estados.reduce((total, estado) => total + valorFinito(estado.valorFrete), 0);
  const maximoFrete = Math.max(0, ...estados.map((estado) => valorFinito(estado.valorFrete)));
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
      className="panel order-3 flex min-w-0 flex-col p-3 lg:p-4 xl:order-7 xl:col-span-6 xl:col-start-10 xl:row-start-2 xl:row-span-1 xl:h-[48vh] xl:overflow-hidden 2xl:order-7"
      aria-label="Distribuição pelo estado do destinatário do cliente"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground 2xl:text-xl">
            Estado do destinatário do cliente
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Distribuição de ordens e valor do frete
          </p>
        </div>
        <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-right font-semibold tabular-nums text-foreground sm:px-4">
          <p className="text-sm sm:text-base">
            {formatarQuantidade.format(totalPedidos)} ordens mapeadas
          </p>
          <p className="text-base text-primary sm:text-lg">
            Frete: {formatadorValorCompacto.format(totalFrete)}
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 items-stretch gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(200px,0.8fr)]">
        <div className="flex h-[200px] min-w-0 items-center justify-center sm:h-[230px] lg:h-[260px] xl:h-[34vh]">
          <svg
            ref={mapaRef}
            viewBox={brazilMap.viewBox}
            role="img"
            aria-label="Mapa do Brasil com o valor do frete por estado do destinatário"
            className="h-full w-full"
          >
            {brazilMap.locations.map((local) => {
              const estado = quantidadesPorUf.get(local.id.toUpperCase());
              const quantidade = estado?.quantidade ?? 0;
              const valorFrete = valorFinito(estado?.valorFrete);
              return (
                <path
                  key={local.id}
                  data-uf={local.id.toUpperCase()}
                  d={local.path}
                  fill={corDoEstado(valorFrete, maximoFrete)}
                  stroke="#8bbcff"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                >
                  <title>
                    {local.name} ({local.id.toUpperCase()}): {formatarQuantidade.format(quantidade)}{" "}
                    pedidos · ordens {formatadorValorOrdensCompacto.format(estado?.valor ?? 0)} ·
                    frete {formatadorValorCompacto.format(valorFrete)}
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
                  fontSize="15"
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

        <div className="flex min-w-0 flex-col">
          <div className="flex h-full min-w-0 flex-col rounded-xl border border-border/70 bg-background/30 p-3 sm:p-4">
            <h3 className="mb-3 text-base font-semibold uppercase tracking-wide text-muted-foreground sm:text-lg 2xl:text-base">
              Top 5 estados
            </h3>
            {maioresEstados.length > 0 ? (
              <ol className="flex min-h-0 flex-1 flex-col justify-evenly gap-1 overflow-y-auto">
                {maioresEstados.map((estado) => (
                  <li
                    key={estado.uf}
                    className="grid grid-cols-[2rem_minmax(0,1fr)_1.5rem_auto] items-center gap-2 2xl:gap-1"
                  >
                    <span className="text-sm font-semibold text-foreground sm:text-base">
                      {estado.uf}
                    </span>
                    <span className="h-3 overflow-hidden rounded bg-muted/60">
                      <span
                        className="block h-full rounded bg-primary"
                        style={{
                          width: `${maximo > 0 ? (estado.quantidade / maximo) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <span className="text-right text-sm font-semibold tabular-nums text-foreground sm:text-base">
                      {formatarQuantidade.format(estado.quantidade)}
                    </span>
                    <span
                      className="text-right text-xs tabular-nums text-muted-foreground"
                      title={`Valor das ordens: ${formatadorValorOrdensCompacto.format(estado.valor)}`}
                    >
                      {formatadorValorOrdensCompacto.format(estado.valor)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum estado informado pela API.</p>
            )}
          </div>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
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
