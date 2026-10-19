import { createFileRoute } from "@tanstack/react-router";
import { EnderecamentoModulo } from "@/components/EnderecamentoModulo";

export const Route = createFileRoute("/enderecamento")({
  head: () => ({
    meta: [
      { title: "Endereçamento — Painel WMS" },
      {
        name: "description",
        content: "Ocupação e endereços físicos do armazém BRANCO01.",
      },
    ],
  }),
  component: EnderecamentoModulo,
});
