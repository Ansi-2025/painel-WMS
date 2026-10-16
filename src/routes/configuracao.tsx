import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarraModulos } from "@/components/BarraModulos";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { assinarApiAtiva, lerApiAtiva, salvarApiAtiva } from "@/lib/wms-config";

export const Route = createFileRoute("/configuracao")({
  head: () => ({
    meta: [
      { title: "Configuração — Painel WMS" },
      {
        name: "description",
        content: "Configuração da integração com a API WMS.",
      },
    ],
  }),
  component: Configuracao,
});

function Configuracao() {
  const [apiAtiva, setApiAtiva] = useState(true);

  useEffect(() => {
    setApiAtiva(lerApiAtiva());
    return assinarApiAtiva(() => setApiAtiva(lerApiAtiva()));
  }, []);

  function atualizarEstadoApi(ativa: boolean) {
    salvarApiAtiva(ativa);
    setApiAtiva(ativa);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BarraModulos />
      <main className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 p-3 pb-20 sm:p-4 sm:pb-20 md:pl-20 lg:gap-6 lg:p-6 lg:pb-6 lg:pl-22">
        <header className="panel px-5 py-4">
          <h1 className="text-2xl font-bold tracking-[0.12em] text-foreground lg:text-4xl">
            CONFIGURAÇÃO
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground lg:text-sm">
            Integração com a API WMS
          </p>
        </header>

        <section className="panel overflow-hidden">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold tracking-[0.2em] text-muted-foreground">
            CONEXÃO
          </h2>
          <dl className="grid gap-px bg-border sm:grid-cols-2">
            <ConfigItem label="Método HTTP" valor="GET" />
            <ConfigItem label="Endpoint" valor="https://branco.eship.com.br/v3/" />
          </dl>
          <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
            <div>
              <Label htmlFor="api-ativa" className="text-sm font-semibold">
                Consultas automáticas da API
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                {apiAtiva
                  ? "Ativas neste navegador. Os módulos atualizam a cada 2 minutos."
                  : "Pausadas neste navegador em todos os módulos."}
              </p>
            </div>
            <Switch
              id="api-ativa"
              checked={apiAtiva}
              onCheckedChange={atualizarEstadoApi}
              aria-label={apiAtiva ? "Pausar consultas da API" : "Ativar consultas da API"}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function ConfigItem({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="min-w-0 bg-card px-5 py-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-medium text-foreground">{valor}</dd>
    </div>
  );
}
