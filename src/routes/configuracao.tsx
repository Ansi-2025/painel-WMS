import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { BarraModulos } from "@/components/BarraModulos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ParametrosEshipEditor } from "@/components/ParametrosEshipEditor";
import { consultarWms } from "@/lib/wms.functions";
import {
  ConfiguracaoWmsSchema,
  CONFIGURACAO_WMS_VAZIA,
  assinarApiAtiva,
  consultaDaConfiguracao,
  lerApiAtiva,
  listarModulosPersonalizados,
  lerConfiguracaoWms,
  ModuloPersonalizadoSchema,
  removerModuloPersonalizado,
  salvarModuloPersonalizado,
  salvarConfiguracaoWms,
  salvarApiAtiva,
  type ModuloPersonalizado,
  type ConfiguracaoWms,
} from "@/lib/wms-config";

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
  const [configuracao, setConfiguracao] = useState(CONFIGURACAO_WMS_VAZIA);
  const [apiAtiva, setApiAtiva] = useState(true);
  const [modulos, setModulos] = useState<ModuloPersonalizado[]>([]);
  const [nomeModulo, setNomeModulo] = useState("");
  const [funcaoModulo, setFuncaoModulo] = useState("");
  const [parametrosModulo, setParametrosModulo] = useState<Record<string, string>>({ incluirInfo: "true" });
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [mensagemModulo, setMensagemModulo] = useState("");
  const consultar = useServerFn(consultarWms);

  useEffect(() => {
    const salva = lerConfiguracaoWms() ?? CONFIGURACAO_WMS_VAZIA;
    setConfiguracao(salva);
    setApiAtiva(lerApiAtiva());
    setModulos(listarModulosPersonalizados());
    return assinarApiAtiva(() => setApiAtiva(lerApiAtiva()));
  }, []);

  async function salvarEtestar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");

    const validacao = ConfiguracaoWmsSchema.safeParse(configuracao);
    if (!validacao.success) {
      setMensagem("Informe a função da API antes de salvar.");
      return;
    }

    try {
      salvarConfiguracaoWms(validacao.data);
    } catch {
      setMensagem("Não foi possível salvar a configuração neste navegador.");
      return;
    }

    setConfiguracao(validacao.data);
    setSalvando(true);
    try {
      const resposta = await consultar({ data: consultaDaConfiguracao(validacao.data) });
      setMensagem(`Configuração salva. Conexão confirmada: ${resposta.ordens.length} ordens retornadas.`);
    } catch (error) {
      const detalhe =
        error instanceof Error
          ? error.message.replace(/([?&]api=)[^&\s]+/gi, "$1[oculta]").slice(0, 180)
          : "erro desconhecido";
      setMensagem(
        detalhe === "ESHIP_API_KEY não configurada no servidor"
          ? "Configuração salva, mas não foi possível testar a conexão. Verifique a configuração do servidor."
          : `Configuração salva, mas o teste falhou: ${detalhe}`,
      );
    } finally {
      setSalvando(false);
    }
  }

  function atualizarCampo(campo: keyof ConfiguracaoWms, valor: string) {
    setConfiguracao((atual) => ({ ...atual, [campo]: valor }));
    setMensagem("");
  }

  function atualizarEstadoApi(ativa: boolean) {
    salvarApiAtiva(ativa);
    setApiAtiva(ativa);
  }

  function criarModulo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagemModulo("");

    const validacao = ModuloPersonalizadoSchema.safeParse({
      id: crypto.randomUUID(),
      nome: nomeModulo,
      funcao: funcaoModulo,
      parametros: parametrosModulo,
    });
    if (!validacao.success) {
      setMensagemModulo("Confira o nome, a função e os nomes dos parâmetros informados.");
      return;
    }

    salvarModuloPersonalizado(validacao.data);
    setModulos(listarModulosPersonalizados());
    setNomeModulo("");
    setFuncaoModulo("");
    setParametrosModulo({ incluirInfo: "true" });
    setMensagemModulo("Módulo criado e adicionado à navegação.");
  }

  function excluirModulo(id: string) {
    removerModuloPersonalizado(id);
    setModulos(listarModulosPersonalizados());
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BarraModulos />
      <main className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 p-4 pl-20 lg:gap-6 lg:p-6 lg:pl-22">
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
                  ? "Ativas neste navegador. Os módulos atualizam a cada 30 segundos."
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

        <form onSubmit={(event) => void salvarEtestar(event)} className="panel overflow-hidden">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold tracking-[0.2em] text-muted-foreground">
            PARÂMETROS DA CONSULTA
          </h2>
          <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <Campo
              id="funcao"
              label="Função da API"
              placeholder="Nome documentado pela E-SHIP"
              value={configuracao.funcao}
              required
              onChange={(valor) => atualizarCampo("funcao", valor)}
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <ParametrosEshipEditor
                idPrefix="consulta-geral"
                valores={configuracao.parametros}
                onChange={(parametros) => atualizarCampo("parametros", parametros)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm text-muted-foreground">
              As configurações salvas neste navegador serão usadas por todos os dashboards e
              módulos personalizados.
            </p>
            <Button type="submit" disabled={salvando}>
              <Save />
              {salvando ? "Testando conexão..." : "Salvar e testar"}
            </Button>
          </div>
          {mensagem && (
            <p role="status" aria-live="polite" className="border-t border-border px-5 py-3 text-sm">
              {mensagem}
            </p>
          )}
        </form>

        <section className="panel overflow-hidden">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold tracking-[0.2em] text-muted-foreground">
            MÓDULOS PERSONALIZADOS
          </h2>
          <form onSubmit={criarModulo}>
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nomeModulo">Nome do módulo</Label>
                <Input
                  id="nomeModulo"
                  value={nomeModulo}
                  maxLength={40}
                  required
                  placeholder="Ex.: Devoluções"
                  onChange={(event) => setNomeModulo(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="funcaoModulo">Função da API</Label>
                <Input
                  id="funcaoModulo"
                  value={funcaoModulo}
                  maxLength={120}
                  required
                  placeholder="Nome documentado pela E-SHIP"
                  onChange={(event) => setFuncaoModulo(event.target.value)}
                />
              </div>
            </div>

            <div className="border-t border-border p-5">
              <ParametrosEshipEditor
                idPrefix="novo-modulo"
                valores={parametrosModulo}
                onChange={setParametrosModulo}
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-sm text-muted-foreground">
                Cada módulo salva sua própria função e seus parâmetros neste navegador.
              </p>
              <Button type="submit">
                <Plus />
                Criar módulo
              </Button>
            </div>
            {mensagemModulo && (
              <p role="status" aria-live="polite" className="border-t border-border px-5 py-3 text-sm">
                {mensagemModulo}
              </p>
            )}
          </form>

          {modulos.length > 0 && (
            <ul className="divide-y divide-border border-t border-border">
              {modulos.map((modulo) => (
                <li key={modulo.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{modulo.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {modulo.funcao} · {Object.keys(modulo.parametros).length} parâmetros
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir módulo ${modulo.nome}`}
                    onClick={() => excluirModulo(modulo.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
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

function Campo({
  id,
  label,
  placeholder,
  value,
  required = false,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  required?: boolean;
  onChange: (valor: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}{required ? " *" : ""}</Label>
      <Input
        id={id}
        name={id}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}