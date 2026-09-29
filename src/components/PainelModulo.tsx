import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { BarraModulos } from "@/components/BarraModulos";
import { ConfiguracaoConsultaModulo } from "@/components/ConfiguracaoConsultaModulo";
import {
  filaMedia,
  filaTotal,
  formatarHora,
  formatarInteiro,
  formatarMoeda,
  maiorFila,
  maiorValor,
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

  const pico = maiorFila(ordens);
  const total = filaTotal(ordens);

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
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-6">
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
            titulo="FILA TOTAL"
            valor={formatarInteiro(filaTotal(ordens))}
            descricao="Soma da fila das ordens"
          />
        </section>

        <section className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr] lg:gap-6">
          <div className="panel flex flex-col overflow-hidden">
            <h2 className="border-b border-border px-5 py-3 text-sm font-semibold tracking-[0.2em] text-muted-foreground">
              ORDENS EM ACOMPANHAMENTO
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Ordem</th>
                    <th className="px-5 py-3 font-medium">Valor da Ordem</th>
                    <th className="px-5 py-3 font-medium">Fila</th>
                    <th className="px-5 py-3 font-medium">Distribuição da Fila</th>
                  </tr>
                </thead>
                <tbody>
                  {ordens.map((o) => {
                    const fila = paraNumero(o.infosAdicionais?.fila);
                    const pctNum = total > 0 ? (fila / total) * 100 : 0;
                    const pct = pctNum.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
                    return (
                      <tr key={o.codigo} className="border-t border-border">
                        <td className="px-5 py-4 text-lg font-semibold tabular-nums lg:text-2xl">
                          {o.ordem}
                        </td>
                        <td className="px-5 py-4 text-base tabular-nums text-foreground lg:text-xl">
                          {formatarMoeda(paraNumero(o.infosAdicionais?.valordaordem))}
                        </td>
                        <td className="px-5 py-4 text-lg font-semibold tabular-nums text-primary lg:text-2xl">
                          {formatarInteiro(fila)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-3 w-full max-w-[320px] rounded-sm bg-muted">
                              <div
                                className="h-3 rounded-sm bg-primary"
                                style={{ width: `${pctNum}%` }}
                              />
                            </div>
                            <span className="w-12 shrink-0 text-sm tabular-nums text-muted-foreground">
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {ordens.length === 0 && (
                    <tr className="border-t border-border">
                      <td
                        colSpan={4}
                        className="px-5 py-10 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma ordem recebida.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel flex flex-col">
            <h2 className="border-b border-border px-5 py-3 text-sm font-semibold tracking-[0.2em] text-muted-foreground">
              RESUMO OPERACIONAL
            </h2>
            <div className="flex flex-1 flex-col divide-y divide-border">
              <Resumo rotulo="Fila média por ordem" valor={formatarInteiro(filaMedia(ordens))} />
              <Resumo rotulo="Maior fila" valor={formatarInteiro(pico)} />
              <Resumo rotulo="Maior valor de ordem" valor={formatarMoeda(maiorValor(ordens))} />
              <Resumo rotulo="Última atualização" valor={atualizadoEm} />
            </div>
          </div>
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

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-1 flex-col justify-center px-5 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-foreground lg:text-4xl">{valor}</p>
    </div>
  );
}
