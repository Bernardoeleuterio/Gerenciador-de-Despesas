import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configSupabaseDoBuild } from "./config";

/**
 * O cliente do Supabase no servidor, para rotas (Route Handlers): lê e grava a
 * sessão nos cookies da requisição. Os dados em si, as telas leem no navegador.
 */
export async function supabaseDoServidor() {
  const { url, chave } = configSupabaseDoBuild();
  const cookiesDaRequisicao = await cookies();
  return createServerClient(url, chave, {
    cookies: {
      getAll: () => cookiesDaRequisicao.getAll(),
      setAll: (novos) => {
        for (const { name, value, options } of novos) cookiesDaRequisicao.set(name, value, options);
      },
    },
  });
}
