import { Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { LayoutDashboard, LogOut, Settings2 } from "lucide-react";
import { sairPainel } from "@/lib/auth.functions";
import {
  assinarModulosPersonalizados,
  listarModulosPersonalizados,
  type ModuloPersonalizado,
} from "@/lib/wms-config";

export const MODULOS = [
  { nome: "Dashboard", icone: LayoutDashboard, to: "/" },
  { nome: "Configuração", icone: Settings2, to: "/configuracao" },
] as const;

export function BarraModulos() {
  const [modulosPersonalizados, setModulosPersonalizados] = useState<ModuloPersonalizado[]>([]);
  const [saindo, setSaindo] = useState(false);
  const navigate = useNavigate();
  const sair = useServerFn(sairPainel);
  const linkClassName =
    "mx-1 flex min-w-[72px] flex-1 flex-col items-center justify-center gap-0.5 border-t-2 border-t-transparent px-2 py-1 text-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:mx-2 md:flex-row md:justify-start md:gap-3 md:border-l-4 md:border-t-0 md:px-2.5 md:py-3 md:text-left";
  const activeLinkClassName =
    "mx-1 flex min-w-[72px] flex-1 flex-col items-center justify-center gap-0.5 border-t-2 border-t-primary bg-primary/10 px-2 py-1 text-center text-primary md:mx-2 md:flex-row md:justify-start md:gap-3 md:border-l-4 md:border-t-0 md:px-2.5 md:py-3 md:text-left";

  useEffect(() => {
    const atualizar = () => setModulosPersonalizados(listarModulosPersonalizados());
    atualizar();
    return assinarModulosPersonalizados(atualizar);
  }, []);

  return (
    <aside className="group fixed inset-x-0 bottom-0 top-auto z-50 flex h-16 w-full flex-row border-t border-border bg-card/95 backdrop-blur md:inset-y-0 md:left-0 md:right-auto md:h-auto md:w-14 md:flex-col md:border-r md:border-t-0 md:transition-[width] md:duration-300 md:ease-out md:hover:w-56">
      <div className="hidden h-16 items-center gap-3 border-b border-border px-4 md:flex">
        <LayoutDashboard className="h-6 w-6 shrink-0 text-primary" />
        <span className="whitespace-nowrap text-sm font-bold tracking-[0.18em] text-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          MÓDULOS
        </span>
      </div>
      <nav className="flex w-full flex-row items-stretch justify-around gap-1 overflow-x-auto px-1 py-1 md:flex-1 md:flex-col md:justify-start md:overflow-hidden md:py-3">
        {MODULOS.map((m) => (
          <Link
            key={m.nome}
            to={m.to}
            title={m.nome}
            className={linkClassName}
            activeProps={{
              className: activeLinkClassName,
            }}
            activeOptions={{ exact: true }}
          >
            <m.icone className="h-5 w-5 shrink-0 md:h-5 md:w-5" />
            <span className="flex min-w-0 flex-col md:opacity-0 md:transition-opacity md:duration-200 md:group-hover:opacity-100">
              <span className="whitespace-nowrap text-[10px] font-semibold leading-none tracking-wide md:text-sm md:leading-normal md:tracking-[0.08em]">
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
            className={linkClassName}
            activeProps={{
              className: activeLinkClassName,
            }}
          >
            <Settings2 className="h-5 w-5 shrink-0" />
            <span className="flex min-w-0 flex-col md:opacity-0 md:transition-opacity md:duration-200 md:group-hover:opacity-100">
              <span className="whitespace-nowrap text-[10px] font-semibold leading-none tracking-wide md:text-sm md:leading-normal md:tracking-[0.08em]">
                {modulo.nome}
              </span>
            </span>
          </Link>
        ))}
        <button
          className={`${linkClassName} md:mt-auto`}
          disabled={saindo}
          onClick={async () => {
            setSaindo(true);
            try {
              await sair();
              await navigate({ to: "/login", replace: true });
            } finally {
              setSaindo(false);
            }
          }}
          title="Sair"
          type="button"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="flex min-w-0 flex-col md:opacity-0 md:transition-opacity md:duration-200 md:group-hover:opacity-100">
            <span className="whitespace-nowrap text-[10px] font-semibold leading-none tracking-wide md:text-sm md:leading-normal md:tracking-[0.08em]">
              {saindo ? "Saindo..." : "Sair"}
            </span>
          </span>
        </button>
      </nav>
      <div className="hidden border-t border-border px-4 py-3 md:block">
        <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          WMS Painel
        </span>
      </div>
    </aside>
  );
}
