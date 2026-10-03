import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  ChevronUp,
  Download,
  GripVertical,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { z } from "zod";
import { BarraModulos } from "@/components/BarraModulos";
import { ConfiguracaoConsultaModulo } from "@/components/ConfiguracaoConsultaModulo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  agruparOrdensPorFila,
  formatarHora,
  formatarInteiro,
  formatarMoeda,
  maiorValor,
  nomeFila,
  obterIdFila,
  paraNumero,
  totalInfosAdicionais,
  totalOrdens,
  valorTotal,
  type OrdemWMS,
} from "@/lib/wms-api";
import {
  CONFIGURACAO_WMS_PADRAO,
  assinarApiAtiva,
  assinarConfiguracaoConsultaModulo,
  assinarConfiguracaoWms,
  consultaDaConfiguracao,
  lerApiAtiva,
  lerConfiguracaoConsultaModulo,
  lerConfiguracaoWms,
  removerConfiguracaoConsultaModulo,
  salvarConfiguracaoConsultaModulo,
  type ConfiguracaoConsultaModulo as ConsultaModulo,
  type ConsultaEship,
  type ConfiguracaoWms,
} from "@/lib/wms-config";

const INTERVALO_SEGUNDOS = 30;
const CHAVE_CARTOES_PERSONALIZADOS = "wms-cartoes-personalizados";
const CHAVE_LAYOUT_CARTOES = "wms-layout-cartoes";

type LayoutCartao = {
  largura: number;
  altura: number;
  ordem: number;
};

type DefinicaoCartao = {
  id: string;
  titulo: string;
  valor: string;
  descricao: string;
  compacto?: boolean;
  removivel?: boolean;
};

function validarLayoutCartao(valor: unknown): valor is LayoutCartao {
  if (typeof valor !== "object" || valor === null) return false;
  const layout = valor as Partial<LayoutCartao>;
  return (
    typeof layout.largura === "number" &&
    Number.isInteger(layout.largura) &&
    layout.largura >= 1 &&
    layout.largura <= 12 &&
    typeof layout.altura === "number" &&
    Number.isInteger(layout.altura) &&
    layout.altura >= 8 &&
    layout.altura <= 24 &&
    Number.isFinite(layout.ordem)
  );
}

type IndicadorCartao =
  | "ordens"
  | "infosAdicionais"
  | "valorTotal"
  | "ordensComFila"
  | "filasDistintas"
  | "filaMaisComum"
  | "ordensFilaMaisComum"
  | "maiorValor";

type CartaoPersonalizado = {
  id: string;
  titulo: string;
  descricao: string;
  indicador: IndicadorCartao;
};

const ConfiguracaoCartoesJsonSchema = z
  .object({
    formato: z.literal("painel-wms-cartoes"),
    versao: z.literal(1),
    exportadoEm: z.string(),
    cartoes: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          titulo: z.string().trim().min(1).max(40),
          descricao: z.string().max(80),
          indicador: z.enum([
            "ordens",
            "infosAdicionais",
            "valorTotal",
            "ordensComFila",
            "filasDistintas",
            "filaMaisComum",
            "ordensFilaMaisComum",
            "maiorValor",
          ]),
        }),
      )
      .max(100),
    layout: z.object({
      colunas: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      flexivel: z.boolean(),
      cartoes: z.record(
        z.string(),
        z.object({
          largura: z.number().int().min(1).max(12),
          altura: z.number().int().min(8).max(24),
          ordem: z.number().finite(),
        }),
      ),
    }),
  })
  .strict()
  .superRefine((configuracao, contexto) => {
    const ids = new Set<string>();
    for (const cartao of configuracao.cartoes) {
      if (ids.has(cartao.id)) {
        contexto.addIssue({ code: "custom", message: "O arquivo contém cartões duplicados." });
        return;
      }
      ids.add(cartao.id);
    }

    const layoutsPermitidos = new Set([
      "ordens",
      "infos-adicionais",
      "valor-ordens",
      "ordens-fila",
      ...configuracao.cartoes.map((cartao) => `personalizado-${cartao.id}`),
    ]);
    for (const id of Object.keys(configuracao.layout.cartoes)) {
      if (!layoutsPermitidos.has(id)) {
        contexto.addIssue({ code: "custom", message: "O arquivo contém um layout desconhecido." });
        return;
      }
    }
  });

const INDICADORES_CARTAO: { id: IndicadorCartao; nome: string }[] = [
  { id: "ordens", nome: "Ordens retornadas" },
  { id: "infosAdicionais", nome: "Informações adicionais" },
  { id: "valorTotal", nome: "Valor total das ordens" },
  { id: "ordensComFila", nome: "Ordens com fila" },
  { id: "filasDistintas", nome: "Filas distintas" },
  { id: "filaMaisComum", nome: "Fila mais comum" },
  { id: "ordensFilaMaisComum", nome: "Ordens na fila mais comum" },
  { id: "maiorValor", nome: "Maior valor de ordem" },
];

function validarCartaoPersonalizado(valor: unknown): valor is CartaoPersonalizado {
  if (typeof valor !== "object" || valor === null) return false;
  const cartao = valor as Partial<CartaoPersonalizado>;
  return (
    typeof cartao.id === "string" &&
    typeof cartao.titulo === "string" &&
    typeof cartao.descricao === "string" &&
    INDICADORES_CARTAO.some((indicador) => indicador.id === cartao.indicador)
  );
}

type ConsultaFn = (options: { data: ConsultaEship }) => Promise<{ ordens: OrdemWMS[] }>;

export function PainelModulo({
  titulo,
  subtitulo,
  consultar,
  configuracaoId,
  configuracaoConsulta,
}: {
  titulo: string;
  subtitulo: string;
  consultar: ConsultaFn;
  configuracaoId: string;
  configuracaoConsulta?: ConsultaEship;
}) {
  const [ordens, setOrdens] = useState<OrdemWMS[]>([]);
  const [apiAtiva, setApiAtiva] = useState(true);
  const [preferenciaApiCarregada, setPreferenciaApiCarregada] = useState(false);
  const [conectado, setConectado] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<string>("--:--:--");
  const [contador, setContador] = useState(INTERVALO_SEGUNDOS);
  const [layoutColunas, setLayoutColunas] = useState<1 | 2 | 3 | 4>(() => {
    if (typeof window === "undefined") return 4;
    const salvo = window.localStorage.getItem("wms-layout-colunas");
    const valor = Number(salvo ?? "4");
    return [1, 2, 3, 4].includes(valor) ? (valor as 1 | 2 | 3 | 4) : 4;
  });
  const [layoutFlexivel, setLayoutFlexivel] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const salvo = window.localStorage.getItem("wms-layout-flexivel");
    return salvo === null ? true : salvo === "true";
  });
  const [modoMontagem, setModoMontagem] = useState(false);
  const [layoutCartoes, setLayoutCartoes] = useState<Record<string, LayoutCartao>>({});
  const [layoutCartoesCarregado, setLayoutCartoesCarregado] = useState(false);
  const [mensagemCartoes, setMensagemCartoes] = useState("");
  const entradaArquivoCartoes = useRef<HTMLInputElement>(null);
  const [cartoesPersonalizados, setCartoesPersonalizados] = useState<CartaoPersonalizado[]>([]);
  const [cartoesCarregados, setCartoesCarregados] = useState(false);
  const [dialogCartaoAberto, setDialogCartaoAberto] = useState(false);
  const [indicadorNovoCartao, setIndicadorNovoCartao] = useState<IndicadorCartao>("ordens");
  const [tituloNovoCartao, setTituloNovoCartao] = useState("");
  const [descricaoNovoCartao, setDescricaoNovoCartao] = useState("");
  const [consulta, setConsulta] = useState(() => obterConsultaAtiva(configuracaoId, configuracaoConsulta));
  const [consultaPersonalizada, setConsultaPersonalizada] = useState(
    () => lerConfiguracaoConsultaModulo(configuracaoId) !== null,
  );
  const carregando = useRef(false);
  const cartaoArrastado = useRef<string | null>(null);
  const consultarAPI = useServerFn(consultar);

  useEffect(() => {
    const atualizar = () => {
      setApiAtiva(lerApiAtiva());
      setPreferenciaApiCarregada(true);
    };
    atualizar();
    return assinarApiAtiva(atualizar);
  }, []);

  useEffect(() => {
    const atualizarConsulta = () => {
      setConsulta(obterConsultaAtiva(configuracaoId, configuracaoConsulta));
      setConsultaPersonalizada(lerConfiguracaoConsultaModulo(configuracaoId) !== null);
    };

    const cancelarConfiguracao = assinarConfiguracaoWms(atualizarConsulta);
    const cancelarConsultaModulo = assinarConfiguracaoConsultaModulo(
      configuracaoId,
      atualizarConsulta,
    );
    return () => {
      cancelarConfiguracao();
      cancelarConsultaModulo();
    };
  }, [configuracaoId, configuracaoConsulta]);

  function salvarConsultaModulo(novaConsulta: ConsultaModulo) {
    salvarConfiguracaoConsultaModulo(configuracaoId, novaConsulta);
    setConsultaPersonalizada(true);
    setConsulta(novaConsulta);
  }

  function restaurarConsultaModulo() {
    removerConfiguracaoConsultaModulo(configuracaoId);
    setConsultaPersonalizada(false);
    setConsulta(obterConsultaAtiva(configuracaoId, configuracaoConsulta));
  }

  const atualizarDashboard = useCallback(async () => {
    if (!preferenciaApiCarregada || !apiAtiva || carregando.current) return;
    carregando.current = true;
    try {
      const dados = await consultarAPI({ data: consulta });
      setOrdens(dados.ordens);
      setConectado(true);
      setAtualizadoEm(formatarHora(new Date()));
    } catch {
      setConectado(false);
    } finally {
      carregando.current = false;
      setContador(INTERVALO_SEGUNDOS);
    }
  }, [apiAtiva, consulta, consultarAPI, preferenciaApiCarregada]);

  useEffect(() => {
    if (!preferenciaApiCarregada) return;
    if (!apiAtiva) {
      setContador(INTERVALO_SEGUNDOS);
      return;
    }
    void atualizarDashboard();
    const id = window.setInterval(() => {
      setContador((s) => {
        if (s <= 1) {
          void atualizarDashboard();
          return INTERVALO_SEGUNDOS;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [apiAtiva, atualizarDashboard, preferenciaApiCarregada]);

  useEffect(() => {
    window.localStorage.setItem("wms-layout-colunas", String(layoutColunas));
  }, [layoutColunas]);

  useEffect(() => {
    window.localStorage.setItem("wms-layout-flexivel", String(layoutFlexivel));
  }, [layoutFlexivel]);

  useEffect(() => {
    try {
      const salvo: unknown = JSON.parse(window.localStorage.getItem(CHAVE_LAYOUT_CARTOES) ?? "{}");
      if (typeof salvo === "object" && salvo !== null && !Array.isArray(salvo)) {
        setLayoutCartoes(
          Object.fromEntries(Object.entries(salvo).filter(([, valor]) => validarLayoutCartao(valor))),
        );
      }
    } catch {
      setLayoutCartoes({});
    }
    setLayoutCartoesCarregado(true);
  }, []);

  useEffect(() => {
    if (!layoutCartoesCarregado) return;
    window.localStorage.setItem(CHAVE_LAYOUT_CARTOES, JSON.stringify(layoutCartoes));
  }, [layoutCartoes, layoutCartoesCarregado]);

  useEffect(() => {
    try {
      const salvos: unknown = JSON.parse(
        window.localStorage.getItem(CHAVE_CARTOES_PERSONALIZADOS) ?? "[]",
      );
      if (Array.isArray(salvos)) {
        setCartoesPersonalizados(salvos.filter(validarCartaoPersonalizado));
      }
    } catch {
      setCartoesPersonalizados([]);
    }
    setCartoesCarregados(true);
  }, []);

  useEffect(() => {
    if (!cartoesCarregados) return;
    window.localStorage.setItem(
      CHAVE_CARTOES_PERSONALIZADOS,
      JSON.stringify(cartoesPersonalizados),
    );
  }, [cartoesCarregados, cartoesPersonalizados]);

  function criarCartao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const titulo = tituloNovoCartao.trim();
    if (!titulo) return;

    setCartoesPersonalizados((atuais) => [
      ...atuais,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        titulo,
        descricao: descricaoNovoCartao.trim(),
        indicador: indicadorNovoCartao,
      },
    ]);
    setTituloNovoCartao("");
    setDescricaoNovoCartao("");
    setIndicadorNovoCartao("ordens");
    setDialogCartaoAberto(false);
  }

  function exportarCartoes() {
    const arquivo = {
      formato: "painel-wms-cartoes",
      versao: 1,
      exportadoEm: new Date().toISOString(),
      cartoes: cartoesPersonalizados,
      layout: {
        colunas: layoutColunas,
        flexivel: layoutFlexivel,
        cartoes: Object.fromEntries(
          cartoesDashboard.map(({ id, largura, altura, ordem }) => [id, { largura, altura, ordem }]),
        ),
      },
    };
    const blob = new Blob([JSON.stringify(arquivo, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `painel-wms-cartoes-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function importarCartoes(arquivo: File) {
    setMensagemCartoes("");
    if (arquivo.size > 1_000_000) {
      setMensagemCartoes("O arquivo excede o limite de 1 MB.");
      return;
    }

    try {
      const json: unknown = JSON.parse(await arquivo.text());
      const validacao = ConfiguracaoCartoesJsonSchema.safeParse(json);
      if (!validacao.success) {
        setMensagemCartoes("Arquivo inválido ou incompatível com o formato de cartões WMS.");
        return;
      }

      const existeConfiguracaoAtual =
        cartoesPersonalizados.length > 0 || Object.keys(layoutCartoes).length > 0;
      if (
        existeConfiguracaoAtual &&
        !window.confirm("A importação substituirá os cartões e o layout atuais. Deseja continuar?")
      ) {
        return;
      }

      setCartoesPersonalizados(validacao.data.cartoes);
      setLayoutCartoes(validacao.data.layout.cartoes);
      setLayoutColunas(validacao.data.layout.colunas);
      setLayoutFlexivel(validacao.data.layout.flexivel);
      const quantidade = validacao.data.cartoes.length;
      setMensagemCartoes(
        `Importação concluída: ${quantidade} ${quantidade === 1 ? "cartão personalizado" : "cartões personalizados"}.`,
      );
    } catch {
      setMensagemCartoes("Não foi possível ler o arquivo JSON selecionado.");
    }
  }

  const filas = agruparOrdensPorFila(ordens);
  const ordensComFila = filas.reduce((totalFilas, fila) => totalFilas + fila.quantidade, 0);
  const filaMaisComum = filas[0];
  const valoresIndicadores: Record<IndicadorCartao, string> = {
    ordens: formatarInteiro(totalOrdens(ordens)),
    infosAdicionais: formatarInteiro(totalInfosAdicionais(ordens)),
    valorTotal: formatarMoeda(valorTotal(ordens)),
    ordensComFila: formatarInteiro(ordensComFila),
    filasDistintas: formatarInteiro(filas.length),
    filaMaisComum: filaMaisComum?.nome ?? "—",
    ordensFilaMaisComum: formatarInteiro(filaMaisComum?.quantidade ?? 0),
    maiorValor: formatarMoeda(maiorValor(ordens)),
  };
  const definicoesCartoes: DefinicaoCartao[] = [
    {
      id: "ordens",
      titulo: "ORDENS",
      valor: valoresIndicadores.ordens,
      descricao: "Ordens retornadas pela API",
    },
    {
      id: "infos-adicionais",
      titulo: "INFOS ADICIONAIS",
      valor: valoresIndicadores.infosAdicionais,
      descricao: "Registros com informações adicionais",
    },
    {
      id: "valor-ordens",
      titulo: "VALOR DAS ORDENS",
      valor: valoresIndicadores.valorTotal,
      descricao: "Valor total das ordens consultadas",
      compacto: true,
    },
    {
      id: "ordens-fila",
      titulo: "ORDENS COM FILA",
      valor: valoresIndicadores.ordensComFila,
      descricao: "Ordens com uma fila atribuída",
    },
    ...cartoesPersonalizados.map((cartao) => ({
      id: `personalizado-${cartao.id}`,
      titulo: cartao.titulo,
      valor: valoresIndicadores[cartao.indicador],
      descricao: cartao.descricao,
      compacto: cartao.indicador === "valorTotal" || cartao.indicador === "maiorValor",
      removivel: true,
    })),
  ];
  const cartoesDashboard = definicoesCartoes
    .map((cartao, indice) => {
      const layout = layoutCartoes[cartao.id];
      return {
        ...cartao,
        largura: layout?.largura ?? 12 / layoutColunas,
        altura: layout?.altura ?? 10,
        ordem: layout?.ordem ?? indice,
      };
    })
    .sort((a, b) => a.ordem - b.ordem);

  function atualizarLayoutCartao(id: string, alteracoes: Partial<LayoutCartao>) {
    const cartao = cartoesDashboard.find((item) => item.id === id);
    if (!cartao) return;

    setLayoutCartoes((atuais) => ({
      ...atuais,
      [id]: {
        largura: cartao.largura,
        altura: cartao.altura,
        ordem: cartao.ordem,
        ...atuais[id],
        ...alteracoes,
      },
    }));
  }

  function reordenarCartao(id: string) {
    const origem = cartaoArrastado.current;
    if (!origem || origem === id) return;

    const reordenados = [...cartoesDashboard];
    const indiceOrigem = reordenados.findIndex((cartao) => cartao.id === origem);
    const indiceDestino = reordenados.findIndex((cartao) => cartao.id === id);
    if (indiceOrigem < 0 || indiceDestino < 0) return;

    const [movido] = reordenados.splice(indiceOrigem, 1);
    if (!movido) return;
    reordenados.splice(indiceDestino, 0, movido);
    setLayoutCartoes((atuais) => {
      const novosLayouts = { ...atuais };
      reordenados.forEach((cartao, ordem) => {
        novosLayouts[cartao.id] = {
          largura: cartao.largura,
          altura: cartao.altura,
          ...atuais[cartao.id],
          ordem,
        };
      });
      return novosLayouts;
    });
    cartaoArrastado.current = null;
  }

  function moverCartao(id: string, deslocamento: -1 | 1) {
    const indice = cartoesDashboard.findIndex((cartao) => cartao.id === id);
    const destino = cartoesDashboard[indice + deslocamento];
    if (!destino) return;
    cartaoArrastado.current = id;
    reordenarCartao(destino.id);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BarraModulos />
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 p-4 pl-20 lg:gap-6 lg:p-6 lg:pl-22">
        <header className="panel flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-[0.12em] text-foreground lg:text-4xl">
              {titulo}
            </h1>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground lg:text-sm">
              {subtitulo}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-col gap-1 sm:items-end">
              <span
                className={
                  !apiAtiva
                    ? "inline-flex items-center gap-2 rounded-sm border border-border bg-muted px-3 py-1 text-sm font-semibold tracking-[0.15em] text-muted-foreground"
                    : conectado
                    ? "inline-flex items-center gap-2 rounded-sm border border-status-ok/40 bg-status-ok/10 px-3 py-1 text-sm font-semibold tracking-[0.15em] text-status-ok"
                    : "inline-flex items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-1 text-sm font-semibold tracking-[0.15em] text-destructive"
                }
              >
                <span className="text-lg leading-none">●</span>
                {!apiAtiva ? "API PAUSADA" : conectado ? "CONECTADO" : "OFFLINE"}
              </span>
              <span className="text-xs tracking-[0.12em] text-muted-foreground lg:text-sm">
                Última atualização: <span className="text-foreground">{atualizadoEm}</span>
              </span>
              {apiAtiva && !conectado && (
                <span className="text-xs font-semibold tracking-[0.12em] text-destructive">
                  Falha na comunicação com a API WMS
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
              <div className="flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-card/80 px-2 py-1.5 shadow-sm backdrop-blur-sm">
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Layout
                </span>

                <div className="flex max-w-full flex-wrap items-center gap-1 rounded-md border border-border bg-background p-1">
                  {[1, 2, 3, 4].map((coluna) => (
                    <button
                      key={coluna}
                      type="button"
                      onClick={() => setLayoutColunas(coluna as 1 | 2 | 3 | 4)}
                      className={[
                        "min-w-8 rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors",
                        layoutColunas === coluna
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      ].join(" ")}
                      aria-pressed={layoutColunas === coluna}
                      aria-label={`Usar ${coluna} colunas`}
                    >
                      {coluna}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setLayoutFlexivel((valor) => !valor)}
                  className={[
                    "rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] transition-colors",
                    layoutFlexivel
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
                  ].join(" ")}
                  aria-pressed={layoutFlexivel}
                >
                  {layoutFlexivel ? "Flex" : "Fixo"}
                </button>
              </div>
              <ConfiguracaoConsultaModulo
                titulo={titulo}
                configuracao={{ funcao: consulta.funcao, parametros: consulta.parametros }}
                personalizada={consultaPersonalizada}
                textoRestaurar={
                  configuracaoConsulta ? "Restaurar definição original" : "Usar configuração geral"
                }
                aoSalvar={salvarConsultaModulo}
                aoRestaurar={restaurarConsultaModulo}
              />
              <Button
                type="button"
                variant={modoMontagem ? "secondary" : "outline"}
                size="sm"
                aria-pressed={modoMontagem}
                onClick={() => setModoMontagem((ativo) => !ativo)}
              >
                <GripVertical aria-hidden="true" />
                {modoMontagem ? "Concluir edição" : "Montar painel"}
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Exportar configurações dos cartões"
                  aria-label="Exportar configurações dos cartões"
                  disabled={!cartoesCarregados || !layoutCartoesCarregado}
                  onClick={exportarCartoes}
                >
                  <Download aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Importar configurações dos cartões"
                  aria-label="Importar configurações dos cartões"
                  disabled={!cartoesCarregados || !layoutCartoesCarregado}
                  onClick={() => entradaArquivoCartoes.current?.click()}
                >
                  <Upload aria-hidden="true" />
                </Button>
                <input
                  ref={entradaArquivoCartoes}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  aria-label="Arquivo JSON de configurações dos cartões"
                  onChange={(event) => {
                    const arquivo = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (arquivo) void importarCartoes(arquivo);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogCartaoAberto(true)}
                >
                  <Plus aria-hidden="true" />
                  Novo cartão
                </Button>
              </div>
            </div>
          </div>
        </header>

        <Dialog open={dialogCartaoAberto} onOpenChange={setDialogCartaoAberto}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo cartão personalizado</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={criarCartao}>
              <label className="block space-y-1.5 text-sm font-medium" htmlFor="cartao-titulo">
                Título
                <Input
                  id="cartao-titulo"
                  value={tituloNovoCartao}
                  onChange={(event) => setTituloNovoCartao(event.target.value)}
                  maxLength={40}
                  required
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium" htmlFor="cartao-indicador">
                Indicador
                <select
                  id="cartao-indicador"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={indicadorNovoCartao}
                  onChange={(event) =>
                    setIndicadorNovoCartao(event.target.value as IndicadorCartao)
                  }
                >
                  {INDICADORES_CARTAO.map((indicador) => (
                    <option key={indicador.id} value={indicador.id}>
                      {indicador.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 text-sm font-medium" htmlFor="cartao-descricao">
                Descrição
                <Input
                  id="cartao-descricao"
                  value={descricaoNovoCartao}
                  onChange={(event) => setDescricaoNovoCartao(event.target.value)}
                  maxLength={80}
                />
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogCartaoAberto(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Criar cartão</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {mensagemCartoes && (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {mensagemCartoes}
          </p>
        )}

        <div
          className={[
            "dashboard-cards-grid gap-4 lg:gap-6",
            layoutFlexivel ? "items-stretch" : "items-start",
          ].join(" ")}
        >
          {cartoesDashboard.map((cartao, indice) => (
            <Card
              key={cartao.id}
              largura={cartao.largura}
              altura={cartao.altura}
              titulo={cartao.titulo}
              valor={cartao.valor}
              descricao={cartao.descricao}
              compacto={cartao.compacto}
              removivel={cartao.removivel}
              emEdicao={modoMontagem}
              podeMoverCima={indice > 0}
              podeMoverBaixo={indice < cartoesDashboard.length - 1}
              aoMover={(deslocamento) => moverCartao(cartao.id, deslocamento)}
              aoAlterarTamanho={(largura, altura) =>
                atualizarLayoutCartao(cartao.id, { largura, altura })
              }
              aoIniciarArrasto={(event) => {
                cartaoArrastado.current = cartao.id;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", cartao.id);
              }}
              aoSoltar={() => reordenarCartao(cartao.id)}
              aoFinalizarArrasto={() => {
                cartaoArrastado.current = null;
              }}
              aoRemover={
                cartao.removivel
                  ? () =>
                      setCartoesPersonalizados((atuais) =>
                        atuais.filter((item) => `personalizado-${item.id}` !== cartao.id),
                      )
                  : undefined
              }
            />
          ))}
        </div>

        <footer className="panel px-5 py-3 text-center text-sm tracking-[0.14em] text-muted-foreground">
          {apiAtiva ? (
            <>
              Próxima atualização em <span className="text-foreground tabular-nums">{contador}s</span>
            </>
          ) : (
            "Consultas da API pausadas"
          )}
        </footer>
      </div>
    </div>
  );
}

function obterConsultaAtiva(
  configuracaoId: string,
  configuracaoConsulta?: ConsultaEship,
): ConsultaEship {
  const configuracaoGeral = lerConfiguracaoWms() ?? CONFIGURACAO_WMS_PADRAO;
  const configuracaoDoModulo = lerConfiguracaoConsultaModulo(configuracaoId);
  const consultaBase = configuracaoDoModulo ??
    (configuracaoConsulta
      ? { funcao: configuracaoConsulta.funcao, parametros: configuracaoConsulta.parametros }
      : consultaDaConfiguracao(configuracaoGeral));

  return consultaBase;
}

function Card({
  titulo,
  valor,
  descricao,
  compacto,
  largura,
  altura,
  removivel,
  emEdicao,
  podeMoverCima,
  podeMoverBaixo,
  aoMover,
  aoAlterarTamanho,
  aoIniciarArrasto,
  aoSoltar,
  aoFinalizarArrasto,
  aoRemover,
}: {
  titulo: string;
  valor: string;
  descricao: string;
  compacto?: boolean | undefined;
  largura: number;
  altura: number;
  removivel?: boolean | undefined;
  emEdicao: boolean;
  podeMoverCima: boolean;
  podeMoverBaixo: boolean;
  aoMover: (deslocamento: -1 | 1) => void;
  aoAlterarTamanho: (largura: number, altura: number) => void;
  aoIniciarArrasto: (event: DragEvent<HTMLButtonElement>) => void;
  aoSoltar: () => void;
  aoFinalizarArrasto: () => void;
  aoRemover?: (() => void) | undefined;
}) {
  return (
    <div
      className={[
        "panel dashboard-card relative border-l-4 border-l-primary px-5 py-5",
        emEdicao ? "outline outline-1 outline-primary/40" : "",
      ].join(" ")}
      style={{ gridColumn: `span ${largura}`, gridRow: `span ${altura}` }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        aoSoltar();
      }}
    >
      {emEdicao && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!podeMoverCima}
              onClick={() => aoMover(-1)}
              className="rounded-sm p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"
              aria-label={`Mover cartão ${titulo} para cima`}
              title="Mover para cima"
            >
              <ChevronUp className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={!podeMoverBaixo}
              onClick={() => aoMover(1)}
              className="rounded-sm p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"
              aria-label={`Mover cartão ${titulo} para baixo`}
              title="Mover para baixo"
            >
              <ChevronDown className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              draggable
              onDragStart={aoIniciarArrasto}
              onDragEnd={aoFinalizarArrasto}
              className="cursor-grab rounded-sm p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
              aria-label={`Arrastar cartão ${titulo}`}
              title="Arrastar para reordenar"
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
              L
              <input
                type="number"
                min={1}
                max={12}
                value={largura}
                onChange={(event) =>
                  aoAlterarTamanho(
                    Math.min(12, Math.max(1, Number(event.target.value) || 1)),
                    altura,
                  )
                }
                className="h-7 w-12 rounded-sm border border-input bg-background px-1 text-center text-xs text-foreground"
                aria-label={`Largura do cartão ${titulo} em unidades`}
              />
            </label>
            <span className="text-xs text-muted-foreground" aria-hidden="true">
              ×
            </span>
            <label className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
              A
              <input
                type="number"
                min={8}
                max={24}
                value={altura}
                onChange={(event) =>
                  aoAlterarTamanho(
                    largura,
                    Math.min(24, Math.max(8, Number(event.target.value) || 8)),
                  )
                }
                className="h-7 w-12 rounded-sm border border-input bg-background px-1 text-center text-xs text-foreground"
                aria-label={`Altura do cartão ${titulo} em unidades`}
              />
            </label>
          </div>
        </div>
      )}
      {removivel && aoRemover && (
        <button
          type="button"
          onClick={aoRemover}
          className="absolute right-3 top-3 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remover cartão ${titulo}`}
          title="Remover cartão"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      )}
      <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">{titulo}</p>
      <p
        className={
          compacto
            ? "mt-2 text-3xl font-bold tabular-nums text-foreground lg:text-5xl"
            : "mt-2 text-5xl font-bold tabular-nums text-foreground lg:text-7xl"
        }
      >
        {valor}
      </p>
      <p className="mt-2 text-xs text-muted-foreground lg:text-sm">{descricao}</p>
    </div>
  );
}

