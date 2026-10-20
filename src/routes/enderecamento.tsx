import { createFileRoute, redirect } from "@tanstack/react-router";
import { EnderecamentoModulo } from "@/components/EnderecamentoModulo";
import { obterPapelAutenticado } from "@/lib/auth.functions";

export const Route = createFileRoute("/enderecamento")({
  beforeLoad: async () => {
    if ((await obterPapelAutenticado()) !== "admin") throw redirect({ to: "/" });
  },
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
