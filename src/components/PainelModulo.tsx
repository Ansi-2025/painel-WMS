import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BarraModulos } from "@/components/BarraModulos";
import { ConfiguracaoConsultaModulo } from "@/components/ConfiguracaoConsultaModulo";
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
  assinarConfiguracaoConsultaModulo,
  assinarConfiguracaoWms,
  consultaDaConfiguracao,
  lerConfiguracaoConsultaModulo,
  lerConfiguracaoWms,
  removerConfiguracaoConsultaModulo,
  salvarConfiguracaoConsultaModulo,
  type ConfiguracaoConsultaModulo as ConsultaModulo,
  type ConsultaEship,
  type ConfiguracaoWms,
} from "@/lib/wms-config";

const INTERVALO_SEGUNDOS = 30;

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
  const [consulta, setConsulta] = useState(() => obterConsultaAtiva(configuracaoId, configuracaoConsulta));
  const [consultaPersonalizada, setConsultaPersonalizada] = useState(
    () => lerConfiguracaoConsultaModulo(configuracaoId) !== null,
  );
  const carregando = useRef(false);
  const consultarAPI = useServerFn(consultar);

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
    setConsulta({ ...novaConsulta, apiKey: lerConfiguracaoWms()?.apiKey ?? "" });
  }

  function restaurarConsultaModulo() {
    removerConfiguracaoConsultaModulo(configuracaoId);
    setConsultaPersonalizada(false);
    setConsulta(obterConsultaAtiva(configuracaoId, configuracaoConsulta));
  }

  const atualizarDashboard = useCallback(async () => {
    if (carregando.current) return;
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
  }, [consultarAPI, consulta]);

  useEffect(() => {
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
  }, [atualizarDashboard]);

  useEffect(() => {
    window.localStorage.setItem("wms-layout-colunas", String(layoutColunas));
  }, [layoutColunas]);

  useEffect(() => {
    window.localStorage.setItem("wms-layout-flexivel", String(layoutFlexivel));
  }, [layoutFlexivel]);

  const filas = agruparOrdensPorFila(ordens);
  const ordensComFila = filas.reduce((totalFilas, fila) => totalFilas + fila.quantidade, 0);
  const filaMaisComum = filas[0];
  const contagensFilas = new Map(filas.map((fila) => [fila.id, fila.quantidade]));
  const classesGridCards = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
  }[layoutColunas];
  const classesGridResumo = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
  }[layoutColunas];

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
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex flex-col gap-1 sm:items-end">
              <span
                className={
                  conectado
                    ? "inline-flex items-center gap-2 rounded-sm border border-status-ok/40 bg-status-ok/10 px-3 py-1 text-sm font-semibold tracking-[0.15em] text-status-ok"
                    : "inline-flex items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-1 text-sm font-semibold tracking-[0.15em] text-destructive"
                }
              >
                <span className="text-lg leading-none">●</span>
                {conectado ? "CONECTADO" : "OFFLINE"}
              </span>
              <span className="text-xs tracking-[0.12em] text-muted-foreground lg:text-sm">
                Última atualização: <span className="text-foreground">{atualizadoEm}</span>
              </span>
              {!conectado && (
                <span className="text-xs font-semibold tracking-[0.12em] text-destructive">
                  Falha na comunicação com a API WMS
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card/80 px-2 py-1.5 shadow-sm backdrop-blur-sm">
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Layout
                </span>

                <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
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
            </div>
          </div>
        </header>

        <GridPersonalizado
          cols={classesGridCards}
          flexivel={layoutFlexivel}
          className="lg:gap-6"
        >
          <Card
            titulo="ORDENS"
            valor={formatarInteiro(totalOrdens(ordens))}
            descricao="Ordens retornadas pela API"
          />
          <Card
            titulo="INFOS ADICIONAIS"
            valor={formatarInteiro(totalInfosAdicionais(ordens))}
            descricao="Registros com informações adicionais"
          />
          <Card
            titulo="VALOR DAS ORDENS"
            valor={formatarMoeda(valorTotal(ordens))}
            descricao="Valor total das ordens consultadas"
            compacto
          />
          <Card
            titulo="ORDENS COM FILA"
            valor={formatarInteiro(ordensComFila)}
            descricao="Ordens com uma fila atribuída"
          />
        </GridPersonalizado>

        <section className="panel flex flex-col">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold tracking-[0.2em] text-muted-foreground">
            RESUMO OPERACIONAL
          </h2>
          <GridPersonalizado cols={classesGridResumo} flexivel={layoutFlexivel}>
            <Resumo rotulo="Filas distintas" valor={formatarInteiro(filas.length)} />
            <Resumo rotulo="Fila mais comum" valor={filaMaisComum?.nome ?? "—"} compacto />
            <Resumo
              rotulo="Ordens nessa fila"
              valor={formatarInteiro(filaMaisComum?.quantidade ?? 0)}
            />
            <Resumo rotulo="Maior valor de ordem" valor={formatarMoeda(maiorValor(ordens))} />
            <Resumo rotulo="Última atualização" valor={atualizadoEm} />
          </GridPersonalizado>
        </section>

        <footer className="panel px-5 py-3 text-center text-sm tracking-[0.14em] text-muted-foreground">
          Próxima atualização em <span className="text-foreground tabular-nums">{contador}s</span>
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

  return { ...consultaBase, apiKey: configuracaoGeral.apiKey };
}

function GridPersonalizado({
  children,
  cols = "grid-cols-1",
  flexivel = false,
  className = "",
}: {
  children: ReactNode;
  cols?: string;
  flexivel?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        "grid gap-4",
        cols,
        flexivel ? "items-stretch" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

function Card({
  titulo,
  valor,
  descricao,
  compacto,
}: {
  titulo: string;
  valor: string;
  descricao: string;
  compacto?: boolean;
}) {
  return (
    <div className="panel border-l-4 border-l-primary px-5 py-5">
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

function Resumo({
  rotulo,
  valor,
  compacto = false,
}: {
  rotulo: string;
  valor: string;
  compacto?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center px-5 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{rotulo}</p>
      <p
        className={
          compacto
            ? "mt-1 break-words text-xl font-bold text-foreground lg:text-2xl"
            : "mt-1 text-3xl font-bold tabular-nums text-foreground lg:text-4xl"
        }
      >
        {valor}
      </p>
    </div>
  );
}
