import { useState, type FormEvent } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ConfiguracaoConsultaModuloSchema,
  type ConfiguracaoConsultaModulo,
} from "@/lib/wms-config";

type LinhaParametro = { id: string; nome: string; valor: string };

export function ConfiguracaoConsultaModulo({
  titulo,
  configuracao,
  personalizada,
  textoRestaurar,
  aoSalvar,
  aoRestaurar,
}: {
  titulo: string;
  configuracao: ConfiguracaoConsultaModulo;
  personalizada: boolean;
  textoRestaurar: string;
  aoSalvar: (configuracao: ConfiguracaoConsultaModulo) => void;
  aoRestaurar: () => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [funcao, setFuncao] = useState(configuracao.funcao);
  const [parametros, setParametros] = useState<LinhaParametro[]>([]);
  const [erro, setErro] = useState("");

  function abrir() {
    setFuncao(configuracao.funcao);
    setParametros(
      Object.entries(configuracao.parametros).map(([nome, valor], indice) => ({
        id: `parametro-${indice}`,
        nome,
        valor,
      })),
    );
    setErro("");
    setAberta(true);
  }

  function atualizarParametro(id: string, campo: "nome" | "valor", valor: string) {
    setParametros((atuais) =>
      atuais.map((parametro) =>
        parametro.id === id ? { ...parametro, [campo]: valor } : parametro,
      ),
    );
    setErro("");
  }

  function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");

    const preenchidos = parametros.filter((parametro) => parametro.nome.trim() || parametro.valor);
    if (preenchidos.some((parametro) => !parametro.nome.trim())) {
      setErro("Informe o nome de cada parâmetro preenchido.");
      return;
    }

    const nomes = preenchidos.map((parametro) => parametro.nome.trim().toLowerCase());
    if (new Set(nomes).size !== nomes.length) {
      setErro("Cada parâmetro precisa ter um nome único.");
      return;
    }

    const validacao = ConfiguracaoConsultaModuloSchema.safeParse({
      funcao,
      parametros: Object.fromEntries(
        preenchidos.map(({ nome, valor }) => [nome.trim(), valor]),
      ),
    });
    if (!validacao.success) {
      setErro("Confira a função e os nomes dos parâmetros. api e funcao são reservados.");
      return;
    }

    aoSalvar(validacao.data);
    setAberta(false);
  }

  function restaurar() {
    aoRestaurar();
    setAberta(false);
  }

  return (
    <Dialog open={aberta} onOpenChange={setAberta}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        title={`Configurar consulta de ${titulo}`}
        aria-label={`Configurar consulta de ${titulo}`}
        onClick={abrir}
      >
        <Settings2 />
      </Button>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form onSubmit={salvar} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Consulta de {titulo}</DialogTitle>
            <DialogDescription>
              Defina a função e os parâmetros usados somente por este dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="funcaoConsultaModulo">Função da API</Label>
            <Input
              id="funcaoConsultaModulo"
              value={funcao}
              maxLength={120}
              required
              onChange={(event) => {
                setFuncao(event.target.value);
                setErro("");
              }}
            />
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Parâmetros
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setParametros((atuais) => [
                    ...atuais,
                    { id: crypto.randomUUID(), nome: "", valor: "" },
                  ])
                }
              >
                <Plus />
                Adicionar
              </Button>
            </div>

            <div className="space-y-3">
              {parametros.map((parametro, indice) => (
                <div key={parametro.id} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
                  <Input
                    aria-label={`Nome do parâmetro ${indice + 1}`}
                    value={parametro.nome}
                    maxLength={60}
                    placeholder="Nome"
                    onChange={(event) => atualizarParametro(parametro.id, "nome", event.target.value)}
                  />
                  <Input
                    aria-label={`Valor do parâmetro ${indice + 1}`}
                    value={parametro.valor}
                    maxLength={500}
                    placeholder="Valor"
                    onChange={(event) => atualizarParametro(parametro.id, "valor", event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover parâmetro ${indice + 1}`}
                    onClick={() =>
                      setParametros((atuais) => atuais.filter((linha) => linha.id !== parametro.id))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {erro && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {erro}
            </p>
          )}

          <DialogFooter className="gap-2">
            {personalizada && (
              <Button type="button" variant="ghost" onClick={restaurar}>
                {textoRestaurar}
              </Button>
            )}
            <Button type="submit">Salvar neste módulo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}