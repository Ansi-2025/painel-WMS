import { createFileRoute } from "@tanstack/react-router";
import { PainelModulo } from "@/components/PainelModulo";
import { consultarWms } from "@/lib/wms.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel Operacional WMS" },
      {
        name: "description",
        content:
          "Painel de acompanhamento em tempo real da operação logística: ordens, valores e fila do WMS.",
      },
      { property: "og:title", content: "Painel Operacional WMS" },
      {
        property: "og:description",
        content:
          "Acompanhamento em tempo real de ordens, valores e fila da operação logística.",
      },
    ],
  }),
  component: Painel,
});

function Painel() {
  return (
    <PainelModulo
      titulo="PAINEL OPERACIONAL WMS"
      subtitulo="Acompanhamento em tempo real da operação"
      consultar={consultarWms}
      configuracaoId="painel-operacional"
    />
  );
}
