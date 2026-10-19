import type { EnderecamentoWms } from "@/lib/wms.functions";

const DATABASE_NAME = "painel-wms";
const DATABASE_VERSION = 1;
const STORE_NAME = "cache";
const CACHE_KEY = "enderecamento";
export const VERSAO_CACHE_ENDERECAMENTO = 6;

export type CacheEnderecamento = {
  versao?: number;
  dados: EnderecamentoWms;
  salvoEm: number;
  completo: boolean;
};

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o cache."));
  });
}

function aguardarTransacao(transacao: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transacao.oncomplete = () => resolve();
    transacao.onabort = () =>
      reject(transacao.error ?? new Error("A transação do cache foi cancelada."));
    transacao.onerror = () =>
      reject(transacao.error ?? new Error("Não foi possível acessar o cache."));
  });
}

export async function lerCacheEnderecamento(): Promise<CacheEnderecamento | null> {
  const banco = await abrirBanco();
  try {
    const transacao = banco.transaction(STORE_NAME, "readonly");
    const leitura = aguardarTransacao(transacao);
    const request = transacao.objectStore(STORE_NAME).get(CACHE_KEY) as IDBRequest<
      CacheEnderecamento | undefined
    >;
    const resultado = await new Promise<CacheEnderecamento | null>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () =>
        reject(request.error ?? new Error("Não foi possível ler o cache de Endereçamento."));
    });
    await leitura;
    return resultado;
  } finally {
    banco.close();
  }
}

export async function salvarCacheEnderecamento(
  dados: EnderecamentoWms,
  completo: boolean,
): Promise<void> {
  const banco = await abrirBanco();
  try {
    const transacao = banco.transaction(STORE_NAME, "readwrite");
    const gravacao = aguardarTransacao(transacao);
    transacao.objectStore(STORE_NAME).put(
      {
        versao: VERSAO_CACHE_ENDERECAMENTO,
        dados,
        salvoEm: Date.now(),
        completo,
      } satisfies CacheEnderecamento,
      CACHE_KEY,
    );
    await gravacao;
  } finally {
    banco.close();
  }
}
