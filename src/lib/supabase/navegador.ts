import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirConfigSupabase, type ConfigSupabase } from "./config";

/**
 * O cliente do Supabase no navegador (modo família). A sessão fica em cookies,
 * e não no localStorage: assim o servidor (proxy e /auth/callback) enxerga o
 * mesmo login. No navegador, é sempre o mesmo cliente.
 *
 * Carregado sob demanda: a demo nunca baixa o código do Supabase.
 */
export async function supabaseDoNavegador(config?: ConfigSupabase): Promise<SupabaseClient> {
  const { url, chave } =
    config ??
    exigirConfigSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  const { createBrowserClient } = await import("@supabase/ssr");
  return createBrowserClient(url, chave);
}

/** Sai da conta e carrega o login do zero: o repositório da página vai junto. */
export async function sair(): Promise<void> {
  const supabase = await supabaseDoNavegador();
  await supabase.auth.signOut();
  // Carga completa de propósito (e não router.push): nada da sessão fica na memória
  window.location.replace(new URL("/entrar", window.location.href));
}
