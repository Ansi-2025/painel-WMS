import { createFileRoute } from "@tanstack/react-router";
import { PainelModulo } from "@/components/PainelModulo";
import {
  consultarDashboardWms,
  consultarEvolucaoOrdensWms,
  consultarIntegracaoDiaWms,
} from "@/lib/wms.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard WMS" },
      {
        name: "description",
        content:
          "Dashboard de acompanhamento em tempo real da operação logística: ordens, valores e filas do WMS.",
      },
      { property: "og:title", content: "Dashboard WMS" },
      {
        property: "og:description",
        content:
          "Acompanhamento em tempo real de ordens, valores por fila e reabastecimento por setor.",
      },
    ],
  }),
  component: Painel,
});

function Painel() {
  return (
    <PainelModulo
      titulo="DASHBOARD WMS"
      subtitulo="Acompanhamento em tempo real da operação"
      consultar={consultarDashboardWms}
      consultarEvolucao={consultarEvolucaoOrdensWms}
      consultarIntegracao={consultarIntegracaoDiaWms}
      exibirGraficos
    />
  );
}
