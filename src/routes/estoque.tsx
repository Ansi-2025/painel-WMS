import { createFileRoute } from "@tanstack/react-router";
import { PainelModulo } from "@/components/PainelModulo";
import { consultarEstoque } from "@/lib/wms.functions";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Painel WMS" },
      {
        name: "description",
        content: "Acompanhamento em tempo real do estoque: ordens, valores e fila do WMS.",
      },
      { property: "og:title", content: "Estoque — Painel WMS" },
      {
        property: "og:description",
        content: "Acompanhamento em tempo real do estoque da operação logística.",
      },
    ],
  }),
  component: Estoque,
});

function Estoque() {
  return (
    <PainelModulo
      titulo="ESTOQUE"
      subtitulo="Acompanhamento em tempo real do estoque"
      consultar={consultarEstoque}
    />
  );
}
