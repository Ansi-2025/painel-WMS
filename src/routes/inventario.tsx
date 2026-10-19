import { createFileRoute } from "@tanstack/react-router";
import { InventarioModulo } from "@/components/InventarioModulo";

export const Route = createFileRoute("/inventario")({
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
