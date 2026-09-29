import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { BarraModulos } from "@/components/BarraModulos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { consultarWms } from "@/lib/wms.functions";
import {
  ConfiguracaoWmsSchema,
  CONFIGURACAO_WMS_VAZIA,
  listarModulosPersonalizados,
  lerConfiguracaoWms,
  ModuloPersonalizadoSchema,
  removerChaveApiWms,
  removerModuloPersonalizado,
  salvarModuloPersonalizado,
  salvarConfiguracaoWms,
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
  const [chaveApi, setChaveApi] = useState("");
  const [chaveConfigurada, setChaveConfigurada] = useState(false);
  const [modulos, setModulos] = useState<ModuloPersonalizado[]>([]);
  const [nomeModulo, setNomeModulo] = useState("");
  const [funcaoModulo, setFuncaoModulo] = useState("");
  const [parametrosModulo, setParametrosModulo] = useState([{ nome: "", valor: "" }]);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [mensagemModulo, setMensagemModulo] = useState("");
  const consultar = useServerFn(consultarWms);

  useEffect(() => {
    const salva = lerConfiguracaoWms() ?? CONFIGURACAO_WMS_VAZIA;
    setConfiguracao({ ...salva, apiKey: "" });
    setChaveConfigurada(Boolean(salva.apiKey));
    setModulos(listarModulosPersonalizados());
  }, []);

  async function salvarEtestar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");

    const chaveParaSalvar = chaveApi.trim() || lerConfiguracaoWms()?.apiKey || "";
    const validacao = ConfiguracaoWmsSchema.safeParse({
      ...configuracao,
      apiKey: chaveParaSalvar,
    });
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

    setConfiguracao({ ...validacao.data, apiKey: "" });
    setChaveApi("");
    setChaveConfigurada(Boolean(validacao.data.apiKey));
    setSalvando(true);
    try {
      const resposta = await consultar({ data: validacao.data });
      setMensagem(`Configuração salva. Conexão confirmada: ${resposta.ordens.length} ordens retornadas.`);
    } catch (error) {
      const detalhe =
        error instanceof Error
          ? error.message.replace(/([?&]api=)[^&\s]+/gi, "$1[oculta]").slice(0, 180)
          : "erro desconhecido";
      setMensagem(
        detalhe === "Configuração ausente"
          ? "Configuração salva. Informe a chave no campo acima ou configure ESHIP_API_KEY no servidor."
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

  function limparChaveApi() {
    removerChaveApiWms();
    setChaveConfigurada(false);
    setChaveApi("");
    setMensagem("Chave pessoal removida deste navegador.");
  }

  function atualizarParametro(indice: number, campo: "nome" | "valor", valor: string) {
    setParametrosModulo((atuais) =>
      atuais.map((parametro, posicao) =>
        posicao === indice ? { ...parametro, [campo]: valor } : parametro,
      ),
    );
    setMensagemModulo("");
  }

  function criarModulo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagemModulo("");

    const linhasPreenchidas = parametrosModulo.filter(
      (parametro) => parametro.nome.trim() || parametro.valor,
    );
    if (linhasPreenchidas.some((parametro) => !parametro.nome.trim())) {
      setMensagemModulo("Informe o nome de cada parâmetro preenchido.");
      return;
    }

    const nomes = linhasPreenchidas.map((parametro) => parametro.nome.trim().toLowerCase());
    if (new Set(nomes).size !== nomes.length) {
      setMensagemModulo("Cada parâmetro precisa ter um nome único.");
      return;
    }

    const validacao = ModuloPersonalizadoSchema.safeParse({
      id: crypto.randomUUID(),
      nome: nomeModulo,
      funcao: funcaoModulo,
      parametros: Object.fromEntries(
        linhasPreenchidas.map(({ nome, valor }) => [nome.trim(), valor]),
      ),
    });
    if (!validacao.success) {
      setMensagemModulo("Confira o nome, a função e os nomes dos parâmetros informados.");
      return;
    }

    salvarModuloPersonalizado(validacao.data);
    setModulos(listarModulosPersonalizados());
    setNomeModulo("");
    setFuncaoModulo("");
    setParametrosModulo([{ nome: "", valor: "" }]);
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
            <ConfigItem label="Chave da API" valor="Opcional por navegador; substitui a chave do servidor" />
          </dl>
        </section>

        <form onSubmit={(event) => void salvarEtestar(event)} className="panel overflow-hidden">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold tracking-[0.2em] text-muted-foreground">
            PARÂMETROS DA CONSULTA
          </h2>
          <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="apiKey">Chave da API E-SHIP</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="apiKey"
                  name="apiKey"
                  type="password"
                  autoComplete="new-password"
                  maxLength={500}
                  value={chaveApi}
                  placeholder={
                    chaveConfigurada
                      ? "Chave pessoal configurada; digite para substituir"
                      : "Cole sua chave pessoal (opcional)"
                  }
                  onChange={(event) => {
                    setChaveApi(event.target.value);
                    setMensagem("");
                  }}
                />
                {chaveConfigurada && (
                  <Button type="button" variant="outline" onClick={limparChaveApi}>
                    <Trash2 />
                    Remover chave
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Salva neste navegador e enviada ao servidor apenas para consultar a E-SHIP. A
                chave não é exibida novamente no campo.
              </p>
            </div>
            <Campo
              id="funcao"
              label="Função da API"
              placeholder="Nome documentado pela E-SHIP"
              value={configuracao.funcao}
              required
              onChange={(valor) => atualizarCampo("funcao", valor)}
            />
            <Campo
              id="ordem"
              label="Ordem"
              placeholder="Opcional"
              value={configuracao.ordem}
              onChange={(valor) => atualizarCampo("ordem", valor)}
            />
            <Campo
              id="statusOrdem"
              label="Status da ordem"
              placeholder="Formato aceito pela API"
              value={configuracao.statusOrdem}
              onChange={(valor) => atualizarCampo("statusOrdem", valor)}
            />
            <Campo
              id="tipoOrdem"
              label="Tipos de ordem"
              placeholder="Formato aceito pela API"
              value={configuracao.tipoOrdem}
              onChange={(valor) => atualizarCampo("tipoOrdem", valor)}
            />
            <Campo
              id="pagina"
              label="Página"
              placeholder="Opcional"
              value={configuracao.pagina}
              onChange={(valor) => atualizarCampo("pagina", valor)}
            />
            <Campo
              id="quantidadeRegistros"
              label="Quantidade de registros"
              placeholder="Opcional"
              value={configuracao.quantidadeRegistros}
              onChange={(valor) => atualizarCampo("quantidadeRegistros", valor)}
            />
            <Campo
              id="ordenacao"
              label="Ordenação"
              placeholder="Opcional"
              value={configuracao.ordenacao}
              onChange={(valor) => atualizarCampo("ordenacao", valor)}
            />
          </div>
          <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm text-muted-foreground">
              As configurações salvas neste navegador serão usadas por todos os dashboards e
              módulos personalizados. A chave pessoal substitui a chave padrão do servidor.
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

            <div className="border-t border-border px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Parâmetros
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setParametrosModulo((atuais) => [...atuais, { nome: "", valor: "" }])
                  }
                >
                  <Plus />
                  Adicionar parâmetro
                </Button>
              </div>
              <div className="space-y-3">
                {parametrosModulo.map((parametro, indice) => (
                  <div key={indice} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
                    <Input
                      aria-label={`Nome do parâmetro ${indice + 1}`}
                      value={parametro.nome}
                      maxLength={60}
                      placeholder="Nome"
                      onChange={(event) => atualizarParametro(indice, "nome", event.target.value)}
                    />
                    <Input
                      aria-label={`Valor do parâmetro ${indice + 1}`}
                      value={parametro.valor}
                      maxLength={500}
                      placeholder="Valor"
                      onChange={(event) => atualizarParametro(indice, "valor", event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover parâmetro ${indice + 1}`}
                      disabled={parametrosModulo.length === 1}
                      onClick={() =>
                        setParametrosModulo((atuais) =>
                          atuais.filter((_, posicao) => posicao !== indice),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-sm text-muted-foreground">
                Cada módulo salva sua própria função e seus parâmetros neste navegador. A chave da
                API pessoal configurada acima será usada nas consultas deste navegador.
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