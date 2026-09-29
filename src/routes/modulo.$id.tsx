import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PainelModulo } from "@/components/PainelModulo";
import { BarraModulos } from "@/components/BarraModulos";
import { consultarFuncao } from "@/lib/wms.functions";
import {
  buscarModuloPersonalizado,
  type ModuloPersonalizado,
} from "@/lib/wms-config";

export const Route = createFileRoute("/modulo/$id")({
  head: () => ({ meta: [{ title: "Módulo personalizado — Painel WMS" }] }),
  component: ModuloDinamico,
});

function ModuloDinamico() {
  const { id } = Route.useParams();
  const [modulo, setModulo] = useState<ModuloPersonalizado | null>(null);

  useEffect(() => {
    setModulo(buscarModuloPersonalizado(id));
  }, [id]);

  if (!modulo) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <BarraModulos />
        <main className="mx-auto max-w-[1800px] p-6 pl-20 lg:pl-22">
          <div className="panel px-5 py-4">
            <h1 className="text-xl font-semibold">Módulo não encontrado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este módulo pode ter sido removido neste navegador.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <PainelModulo
      titulo={modulo.nome.toUpperCase()}
      subtitulo="Consulta configurada para este módulo"
      consultar={consultarFuncao}
      configuracaoConsulta={{ funcao: modulo.funcao, parametros: modulo.parametros }}
    />
  );
}