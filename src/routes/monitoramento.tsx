import { createFileRoute } from "@tanstack/react-router";
import { PainelModulo } from "@/components/PainelModulo";
import { consultarMonitoramento } from "@/lib/wms.functions";

export const Route = createFileRoute("/monitoramento")({
  head: () => ({
    meta: [
      { title: "Monitoramento — Painel WMS" },
      {
        name: "description",
        content: "Monitoramento em tempo real da operação logística: ordens, valores e fila do WMS.",
      },
      { property: "og:title", content: "Monitoramento — Painel WMS" },
      {
        property: "og:description",
        content: "Monitoramento em tempo real da operação logística.",
      },
    ],
  }),
  component: Monitoramento,
});

function Monitoramento() {
  return (
    <PainelModulo
      titulo="MONITORAMENTO"
      subtitulo="Monitoramento em tempo real da operação"
      consultar={consultarMonitoramento}
      configuracaoId="monitoramento"
    />
  );
}
