import { createFileRoute, redirect } from "@tanstack/react-router";
import { InventarioModulo } from "@/components/InventarioModulo";
import { obterPapelAutenticado } from "@/lib/auth.functions";

export const Route = createFileRoute("/inventario")({
  beforeLoad: async () => {
    if ((await obterPapelAutenticado()) !== "admin") throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Inventário — Painel WMS" },
      {
        name: "description",
        content: "Acompanhamento do plano de inventário do armazém BRANCO01.",
      },
    ],
  }),
  component: InventarioModulo,
});
