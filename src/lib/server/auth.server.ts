import { getRequest, getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

const COOKIE_SESSAO = "wms_painel_session";
const DURACAO_SESSAO_SEGUNDOS = 12 * 60 * 60;
const codificador = new TextEncoder();

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
  const secret = process.env["USER_CONTROLER"]?.trim();
  if (!secret) return false;

  const key = await obterChave(secret);
  const assinaturaEsperada = await crypto.subtle.sign("HMAC", key, codificador.encode(secret));
  const senhaValida = await crypto.subtle.verify(
    "HMAC",
    key,
    assinaturaEsperada,
    codificador.encode(password),
  );
  if (!senhaValida) return false;

  const expiracao = Math.floor(Date.now() / 1000) + DURACAO_SESSAO_SEGUNDOS;
  const payload = String(expiracao);
  const assinatura = await crypto.subtle.sign("HMAC", key, codificador.encode(payload));
  adicionarCookie(
    `${payload}.${codificarBase64Url(new Uint8Array(assinatura))}`,
    DURACAO_SESSAO_SEGUNDOS,
  );
  return true;
}

export async function sessaoValida(): Promise<boolean> {
  setResponseHeader("Cache-Control", "private, no-store");
  const secret = process.env["USER_CONTROLER"]?.trim();
  const token = lerCookieSessao();
  if (!secret || !token) return false;

  const [expiracaoTexto, assinaturaTexto, ...restante] = token.split(".");
  if (!expiracaoTexto || !assinaturaTexto || restante.length > 0) return false;
  const expiracao = Number(expiracaoTexto);
  const assinatura = decodificarBase64Url(assinaturaTexto);
  if (
    !Number.isSafeInteger(expiracao) ||
    expiracao <= Math.floor(Date.now() / 1000) ||
    !assinatura ||
    assinatura.length !== 32
  ) {
    return false;
  }

  const chave = await obterChave(secret);
  return crypto.subtle.verify("HMAC", chave, assinatura, codificador.encode(expiracaoTexto));
}

export async function exigirSessao(): Promise<void> {
  if (!(await sessaoValida())) throw new Error("Autenticação necessária");
}

export function limparSessao(): void {
  adicionarCookie("", 0);
}
