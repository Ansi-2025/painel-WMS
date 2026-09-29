import { createFileRoute } from "@tanstack/react-router";
import { PainelModulo } from "@/components/PainelModulo";
import { consultarIndicadores } from "@/lib/wms.functions";

export const Route = createFileRoute("/indicadores")({
  head: () => ({
    meta: [
      { title: "Indicadores — Painel WMS" },
      {
        name: "description",
        content: "Indicadores em tempo real da operação logística: ordens, valores e fila do WMS.",
      },
      { property: "og:title", content: "Indicadores — Painel WMS" },
      {
        property: "og:description",
        content: "Indicadores em tempo real da operação logística.",
      },
    ],
  }),
  component: Indicadores,
});

function Indicadores() {
  return (
    <PainelModulo
      titulo="INDICADORES"
      subtitulo="Indicadores em tempo real da operação"
      consultar={consultarIndicadores}
      configuracaoId="indicadores"
    />
  );
}
