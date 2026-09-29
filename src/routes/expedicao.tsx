import { createFileRoute } from "@tanstack/react-router";
import { PainelModulo } from "@/components/PainelModulo";
import { consultarExpedicao } from "@/lib/wms.functions";

export const Route = createFileRoute("/expedicao")({
  head: () => ({
    meta: [
      { title: "Expedição — Painel WMS" },
      {
        name: "description",
        content: "Acompanhamento em tempo real da expedição: ordens, valores e fila do WMS.",
      },
      { property: "og:title", content: "Expedição — Painel WMS" },
      {
        property: "og:description",
        content: "Acompanhamento em tempo real da expedição da operação logística.",
      },
    ],
  }),
  component: Expedicao,
});

function Expedicao() {
  return (
    <PainelModulo
      titulo="EXPEDIÇÃO"
      subtitulo="Acompanhamento em tempo real da expedição"
      consultar={consultarExpedicao}
      configuracaoId="expedicao"
    />
  );
}
