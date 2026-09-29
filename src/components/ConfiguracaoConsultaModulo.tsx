import { useState, type FormEvent } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParametrosEshipEditor } from "@/components/ParametrosEshipEditor";
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
  const [parametros, setParametros] = useState(configuracao.parametros);
  const [erro, setErro] = useState("");

  function abrir() {
    setFuncao(configuracao.funcao);
    setParametros(configuracao.parametros);
    setErro("");
    setAberta(true);
  }

  function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");

    const validacao = ConfiguracaoConsultaModuloSchema.safeParse({
      funcao,
      parametros,
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

          <ParametrosEshipEditor
            idPrefix={`consulta-${titulo.toLowerCase().replace(/\s+/g, "-")}`}
            valores={parametros}
            onChange={setParametros}
          />

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