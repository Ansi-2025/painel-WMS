import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { criarSessao, limparSessao, sessaoValida } from "@/lib/server/auth.server";

export const verificarAutenticacao = createServerFn({ method: "GET" }).handler(async () => {
  return sessaoValida();
});

export const entrarPainel = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ password: z.string().min(1).max(512) }).parse(data))
  .handler(async ({ data }) => {
    if (!process.env["USER_CONTROLER"]?.trim()) {
      return { sucesso: false, erro: "A senha de acesso não está configurada no servidor." };
    }
    const sucesso = await criarSessao(data.password);
    return sucesso ? { sucesso: true, erro: null } : { sucesso: false, erro: "Senha incorreta." };
  });

export const sairPainel = createServerFn({ method: "POST" }).handler(() => {
  limparSessao();
  return { sucesso: true };
});
