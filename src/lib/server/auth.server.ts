import { getRequest, getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import type { PapelAcesso } from "@/lib/auth.types";

const COOKIE_SESSAO = "wms_painel_session";
const DURACAO_SESSAO_SEGUNDOS = 12 * 60 * 60;
const codificador = new TextEncoder();

function obterSenha(papel: PapelAcesso): string | undefined {
  const nomeVariavel = papel === "admin" ? "USER_CONTROLER" : "MONITOR";
  return process.env[nomeVariavel]?.trim() || undefined;
}

function obterChave(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    codificador.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function codificarBase64Url(bytes: Uint8Array): string {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodificarBase64Url(valor: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(valor)) return null;
  try {
    const base64 = valor.replaceAll("-", "+").replaceAll("_", "/");
    const binario = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
  } catch {
    return null;
  }
}

function adicionarCookie(valor: string, maxAge: number): void {
  const request = getRequest();
  const encaminhadoPorHttps =
    getRequestHeader("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
  const seguro = new URL(request.url).protocol === "https:" || encaminhadoPorHttps;
  setResponseHeader(
    "Set-Cookie",
    `${COOKIE_SESSAO}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${seguro ? "; Secure" : ""}`,
  );
  setResponseHeader("Cache-Control", "no-store");
}

function lerCookieSessao(): string | null {
  const cookie = getRequestHeader("cookie");
  if (!cookie) return null;

  const prefixo = `${COOKIE_SESSAO}=`;
  const valor = cookie
    .split(";")
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith(prefixo));
  return valor ? valor.slice(prefixo.length) : null;
}

export async function criarSessao(password: string): Promise<boolean> {
  setResponseHeader("Cache-Control", "no-store");
  let papel: PapelAcesso | null = null;
  for (const candidato of ["admin", "monitor"] as const) {
    const secret = obterSenha(candidato);
    if (!secret) continue;
    const key = await obterChave(secret);
    const assinaturaEsperada = await crypto.subtle.sign("HMAC", key, codificador.encode(secret));
    if (await crypto.subtle.verify("HMAC", key, assinaturaEsperada, codificador.encode(password))) {
      papel = candidato;
      break;
    }
  }
  if (!papel) return false;

  const expiracao = Math.floor(Date.now() / 1000) + DURACAO_SESSAO_SEGUNDOS;
  const secret = obterSenha(papel);
  if (!secret) return false;
  const payload = `v2.${papel}.${expiracao}`;
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    await obterChave(secret),
    codificador.encode(payload),
  );
  adicionarCookie(
    `${payload}.${codificarBase64Url(new Uint8Array(assinatura))}`,
    DURACAO_SESSAO_SEGUNDOS,
  );
  return true;
}

export async function obterPapelSessao(): Promise<PapelAcesso | null> {
  setResponseHeader("Cache-Control", "private, no-store");
  const token = lerCookieSessao();
  if (!token) return null;

  const partes = token.split(".");
  let papel: PapelAcesso;
  let payload: string;
  let expiracaoTexto: string;
  let assinaturaTexto: string;
  if (partes.length === 4 && partes[0] === "v2") {
    const [, papelTexto, expiracao, assinatura] = partes;
    if (papelTexto !== "admin" && papelTexto !== "monitor") return null;
    papel = papelTexto;
    expiracaoTexto = expiracao;
    assinaturaTexto = assinatura;
    payload = `v2.${papel}.${expiracaoTexto}`;
  } else if (partes.length === 2) {
    [expiracaoTexto, assinaturaTexto] = partes;
    papel = "admin";
    payload = expiracaoTexto;
  } else {
    return null;
  }

  const expiracao = Number(expiracaoTexto);
  const assinatura = decodificarBase64Url(assinaturaTexto);
  if (
    !Number.isSafeInteger(expiracao) ||
    expiracao <= Math.floor(Date.now() / 1000) ||
    !assinatura ||
    assinatura.length !== 32
  )
    return null;

  const secret = obterSenha(papel);
  if (!secret) return null;
  const chave = await obterChave(secret);
  return (await crypto.subtle.verify("HMAC", chave, assinatura, codificador.encode(payload)))
    ? papel
    : null;
}

export async function sessaoValida(): Promise<boolean> {
  return (await obterPapelSessao()) !== null;
}

export async function exigirSessao(): Promise<void> {
  const papel = await obterPapelSessao();
  if (!papel) throw new Error("Autenticação necessária");
  if (papel !== "admin") throw new Error("Acesso administrativo necessário");
}

export async function exigirAcessoDashboard(): Promise<void> {
  if (!(await obterPapelSessao())) throw new Error("Autenticação necessária");
}

export function limparSessao(): void {
  adicionarCookie("", 0);
}
