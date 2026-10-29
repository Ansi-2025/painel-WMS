import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { entrarPainel, verificarAutenticacao } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Painel WMS" },
      { name: "description", content: "Acesso protegido ao Painel WMS." },
    ],
  }),
  beforeLoad: async () => {
    if (await verificarAutenticacao()) throw redirect({ to: "/" });
  },
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const entrar = useServerFn(entrarPainel);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [contagem, setContagem] = useState<number | null>(30);

  const autenticarSenha = useCallback(
    async (senha: string) => {
      setErro("");
      setEnviando(true);
      setContagem(null);
      try {
        const resultado = await entrar({ data: { password: senha } });
        if (!resultado.sucesso) {
          setErro(resultado.erro ?? "Não foi possível entrar.");
          return;
        }
        await navigate({ to: "/", replace: true });
      } finally {
        setEnviando(false);
      }
    },
    [entrar, navigate],
  );

  function autenticar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void autenticarSenha(passwordInputRef.current?.value ?? "");
  }

  useEffect(() => {
    if (contagem === null || enviando) return;
    if (contagem === 5) {
      passwordInputRef.current?.focus();
      passwordInputRef.current?.click();
    }
    if (contagem === 0) {
      const senha = passwordInputRef.current?.value ?? "";
      if (senha.length === 0) {
        setErro("Digite a senha para acessar o painel.");
        setContagem(null);
        return;
      }
      void autenticarSenha(senha);
      return;
    }

    const timer = window.setTimeout(() => {
      setContagem((valor) => (valor === null ? null : valor - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [autenticarSenha, contagem, enviando]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="panel w-full max-w-md p-6 sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Acesso protegido
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-wide">Painel WMS</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Informe a senha para acessar o dashboard.
          </p>
        </div>
        <form className="space-y-4" onSubmit={autenticar}>
          <label className="block space-y-2 text-sm font-medium" htmlFor="senha">
            Senha
            <Input
              autoComplete="current-password"
              id="senha"
              name="password"
              ref={passwordInputRef}
              onChange={(event) => {
                setErro("");
              }}
              required
              type="password"
            />
          </label>
          {contagem !== null && (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Login automático em {contagem} segundos.
            </p>
          )}
          {erro && (
            <p aria-live="polite" className="text-sm font-medium text-destructive">
              {erro}
            </p>
          )}
          <Button className="w-full" disabled={enviando} type="submit">
            {enviando ? "Verificando..." : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
