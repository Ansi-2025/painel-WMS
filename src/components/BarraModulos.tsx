import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Boxes, ChartColumn, LayoutDashboard, Settings2, Truck } from "lucide-react";
import {
  assinarModulosPersonalizados,
  listarModulosPersonalizados,
  type ModuloPersonalizado,
} from "@/lib/wms-config";

export const MODULOS = [
  { nome: "Painel Operacional", icone: LayoutDashboard, to: "/" },
  { nome: "Expedição", icone: Truck, to: "/expedicao" },
  { nome: "Estoque", icone: Boxes, to: "/estoque" },
  { nome: "Indicadores", icone: ChartColumn, to: "/indicadores" },
  { nome: "Monitoramento", icone: Activity, to: "/monitoramento" },
  { nome: "Configuração", icone: Settings2, to: "/configuracao" },
] as const;

export function BarraModulos() {
  const [modulosPersonalizados, setModulosPersonalizados] = useState<ModuloPersonalizado[]>([]);

  useEffect(() => {
    const atualizar = () => setModulosPersonalizados(listarModulosPersonalizados());
    atualizar();
    return assinarModulosPersonalizados(atualizar);
  }, []);

  return (
    <aside className="group fixed inset-y-0 left-0 z-50 flex w-14 flex-col border-r border-border bg-card/95 backdrop-blur transition-[width] duration-300 ease-out hover:w-56">
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <LayoutDashboard className="h-6 w-6 shrink-0 text-primary" />
        <span className="whitespace-nowrap text-sm font-bold tracking-[0.18em] text-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          MÓDULOS
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-hidden py-3">
        {MODULOS.map((m) => (
          <Link
            key={m.nome}
            to={m.to}
            title={m.nome}
            className="mx-2 flex items-center gap-3 rounded-sm border-l-4 border-l-transparent px-2.5 py-3 text-left text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            activeProps={{
              className:
                "mx-2 flex items-center gap-3 rounded-sm border-l-4 border-l-primary bg-primary/10 px-2.5 py-3 text-left text-primary",
            }}
            activeOptions={{ exact: true }}
          >
            <m.icone className="h-5 w-5 shrink-0" />
            <span className="flex min-w-0 flex-col opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="whitespace-nowrap text-sm font-semibold tracking-[0.08em]">
                {m.nome}
              </span>
            </span>
          </Link>
        ))}
        {modulosPersonalizados.map((modulo) => (
          <Link
            key={modulo.id}
            to="/modulo/$id"
            params={{ id: modulo.id }}
            title={modulo.nome}
            className="mx-2 flex items-center gap-3 rounded-sm border-l-4 border-l-transparent px-2.5 py-3 text-left text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            activeProps={{
              className:
                "mx-2 flex items-center gap-3 rounded-sm border-l-4 border-l-primary bg-primary/10 px-2.5 py-3 text-left text-primary",
            }}
          >
            <Settings2 className="h-5 w-5 shrink-0" />
            <span className="flex min-w-0 flex-col opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="whitespace-nowrap text-sm font-semibold tracking-[0.08em]">
                {modulo.nome}
              </span>
            </span>
          </Link>
        ))}
      </nav>
      <div className="border-t border-border px-4 py-3">
        <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          WMS Painel
        </span>
      </div>
    </aside>
  );
}
