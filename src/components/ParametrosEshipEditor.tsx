import { useState } from "react";
import { Check, ChevronsUpDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  type DefinicaoParametroEship,
  PARAMETROS_ESHIP,
  obterDefinicaoParametro,
  valorInicialParametro,
} from "@/lib/wms-parameters";

const SEM_FILTRO = "__sem_filtro__";
const PARAMETRO_MANUAL = "__parametro_manual__";
const GRUPOS_PARAMETROS_ESHIP = (() => {
  const agrupados = new Map<string, DefinicaoParametroEship[]>();
  for (const parametro of PARAMETROS_ESHIP) {
    const existentes = agrupados.get(parametro.grupo) ?? [];
    agrupados.set(parametro.grupo, [...existentes, parametro]);
  }
  return [...agrupados.entries()];
})();

function lerIdsMultipla(valor: string): string[] {
  return valor.match(/-?\d+/g) ?? [];
}

export function ParametrosEshipEditor({
  idPrefix,
  valores,
  onChange,
}: {
  idPrefix: string;
  valores: Record<string, string>;
  onChange: (valores: Record<string, string>) => void;
}) {
  const [erro, setErro] = useState("");

  function adicionarParametro(chave: string) {
    if (!chave || chave === SEM_FILTRO) return;
    if (chave === PARAMETRO_MANUAL) {
      const numero = Object.keys(valores).filter((nome) => nome.startsWith("parametroPersonalizado")).length + 1;
      onChange({ ...valores, [`parametroPersonalizado${numero}`]: "" });
      return;
    }
    onChange({ ...valores, [chave]: valorInicialParametro(chave) });
  }

  function atualizarValor(chave: string, valor: string) {
    onChange({ ...valores, [chave]: valor });
    setErro("");
  }

  function renomearParametro(chaveAtual: string, novaChave: string) {
    if (!novaChave.trim()) {
      setErro("O nome do parâmetro não pode ficar vazio.");
      return;
    }
    if (novaChave in valores && novaChave !== chaveAtual) {
      setErro("Esse parâmetro já foi adicionado.");
      return;
    }
    const proximos: Record<string, string> = {};
    for (const [chave, valor] of Object.entries(valores)) {
      proximos[chave === chaveAtual ? novaChave : chave] = valor;
    }
    onChange(proximos);
    setErro("");
  }

  function renderizarValor(chave: string, valor: string) {
    const definicao = obterDefinicaoParametro(chave);
    const id = `${idPrefix}-${chave}`;

    if (definicao?.multiplo && definicao.opcoes) {
      const selecionados = lerIdsMultipla(valor);
      const descricoes = selecionados.map(
        (selecionado) =>
          definicao.opcoes?.find((opcao) => opcao.id === selecionado)?.descricao ?? selecionado,
      );

      return (
        <div className="space-y-1">
          <SeletorMultiplo
            descricao={definicao.descricao}
            opcoes={definicao.opcoes}
            selecionados={selecionados}
            onChange={(novosIds) =>
              atualizarValor(chave, novosIds.length ? `[${novosIds.join(",")}]` : "")
            }
          />
          {selecionados.length > 0 && (
            <p className="text-xs text-muted-foreground">{descricoes.join(", ")}</p>
          )}
        </div>
      );
    }

    if (definicao?.opcoes) {
      return (
        <Select
          value={valor || SEM_FILTRO}
          onValueChange={(novoValor) => atualizarValor(chave, novoValor === SEM_FILTRO ? "" : novoValor)}
        >
          <SelectTrigger id={id} aria-label={definicao.descricao}>
            <SelectValue placeholder="Sem filtro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_FILTRO}>Sem filtro</SelectItem>
            {definicao.opcoes.map((opcao) => (
              <SelectItem key={opcao.id} value={opcao.id}>
                {opcao.id} — {opcao.descricao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    const tipo = definicao?.tipo;
    return (
      <Input
        id={id}
        aria-label={definicao?.descricao ?? `Valor de ${chave}`}
        type={tipo === "DATE" ? "date" : tipo === "INT" ? "number" : "text"}
        step={tipo === "INT" ? "1" : undefined}
        value={valor}
        placeholder={tipo === "DATETIME" ? "AAAA-MM-DD HH:MM:SS" : tipo ?? "Texto"}
        required={definicao?.obrigatorio}
        maxLength={tipo === "STRING" ? 500 : undefined}
        onChange={(event) => atualizarValor(chave, event.target.value)}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-adicionar`}>Adicionar parâmetro da E-SHIP</Label>
          <Select value="" onValueChange={adicionarParametro}>
            <SelectTrigger id={`${idPrefix}-adicionar`}>
              <SelectValue placeholder="Escolha um parâmetro" />
            </SelectTrigger>
            <SelectContent>
              {GRUPOS_PARAMETROS_ESHIP.map(([grupo, parametros]) => (
                <SelectGroup key={grupo}>
                  <SelectLabel>{grupo}</SelectLabel>
                  {parametros
                    .filter((parametro) => !(parametro.chave in valores))
                    .map((parametro) => (
                      <SelectItem key={parametro.chave} value={parametro.chave}>
                        {parametro.descricao} ({parametro.chave})
                      </SelectItem>
                    ))}
                </SelectGroup>
              ))}
              <SelectGroup>
                <SelectLabel>Avançado</SelectLabel>
                <SelectItem value={PARAMETRO_MANUAL}>Outro parâmetro</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {Object.entries(valores).length > 0 ? (
        <div className="space-y-3">
          {Object.entries(valores).map(([chave, valor]) => {
            const definicao = obterDefinicaoParametro(chave);
            const identificador = `${idPrefix}-${chave}`;
            return (
              <div key={chave} className="grid gap-3 rounded-sm border border-border p-3 sm:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1.3fr)_auto] sm:items-end">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={`${identificador}-nome`}>
                    {definicao?.descricao ?? "Parâmetro personalizado"}
                  </Label>
                  {definicao ? (
                    <p id={`${identificador}-nome`} className="truncate font-mono text-xs text-muted-foreground">
                      {chave} · {definicao.tipo}{definicao.obrigatorio ? " · obrigatório" : ""}
                    </p>
                  ) : (
                    <Input
                      id={`${identificador}-nome`}
                      aria-label={`Nome do parâmetro ${chave}`}
                      value={chave}
                      maxLength={60}
                      onChange={(event) => renomearParametro(chave, event.target.value)}
                    />
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={identificador}>Valor</Label>
                  {renderizarValor(chave, valor)}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${definicao?.descricao ?? chave}`}
                  disabled={definicao?.obrigatorio}
                  onClick={() => {
                    const { [chave]: _removido, ...restantes } = valores;
                    onChange(restantes);
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum parâmetro adicional selecionado.</p>
      )}

      {erro && <p role="alert" className="text-sm font-medium text-destructive">{erro}</p>}
    </section>
  );
}

function SeletorMultiplo({
  descricao,
  opcoes,
  selecionados,
  onChange,
}: {
  descricao: string;
  opcoes: { id: string; descricao: string }[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
}) {
  const label =
    selecionados.length === 0
      ? "Sem filtro"
      : selecionados.length === 1
        ? `${selecionados.length} selecionado`
        : `${selecionados.length} selecionados`;

  function alternar(id: string) {
    onChange(
      selecionados.includes(id)
        ? selecionados.filter((selecionado) => selecionado !== id)
        : [...selecionados, id],
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={descricao}
          aria-expanded="false"
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${descricao.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
            <CommandGroup>
              {opcoes.map((opcao) => {
                const selecionado = selecionados.includes(opcao.id);
                return (
                  <CommandItem
                    key={opcao.id}
                    value={`${opcao.id} ${opcao.descricao}`}
                    onSelect={() => alternar(opcao.id)}
                  >
                    <Checkbox checked={selecionado} aria-hidden="true" tabIndex={-1} />
                    <span>{opcao.id} — {opcao.descricao}</span>
                    {selecionado && <Check className="ml-auto" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}