import { Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type SecaoDetalhesPainel = {
  titulo: string;
  itens: { titulo: string; descricao: string }[];
};

export function DetalhesPainel({
  titulo,
  secoes,
}: {
  titulo: string;
  secoes: SecaoDetalhesPainel[];
}) {
  const [aberto, setAberto] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const elementoAnterior = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (elementoAnterior instanceof HTMLElement) elementoAnterior.focus();
    };
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-background/50 px-3 text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info aria-hidden="true" className="size-4 text-primary" />
        Detalhes
      </button>
      {aberto ? (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-3"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAberto(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="detalhes-painel-titulo"
            tabIndex={-1}
            ref={dialogRef}
            onKeyDown={(event) => {
              if (event.key === "Escape") setAberto(false);
            }}
            className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-6"
          >
            <button
              type="button"
              aria-label="Fechar detalhes"
              onClick={() => setAberto(false)}
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
            <header className="mb-5 space-y-1 pr-10">
              <h2 id="detalhes-painel-titulo" className="text-xl font-bold text-foreground">
                Detalhes · {titulo}
              </h2>
              <p className="text-sm text-muted-foreground">
                Guia rápido dos cartões, indicadores e gráficos exibidos neste módulo.
              </p>
            </header>
            <div className="space-y-5">
              {secoes.map((secao) => (
                <section key={secao.titulo} aria-label={secao.titulo}>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-primary">
                    {secao.titulo}
                  </h3>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {secao.itens.map((item) => (
                      <div
                        key={item.titulo}
                        className="rounded-lg border border-border/70 bg-muted/20 p-3"
                      >
                        <dt className="text-sm font-semibold text-foreground">{item.titulo}</dt>
                        <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {item.descricao}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
