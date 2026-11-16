import { MODO, type Modo } from "@/lib/modo";
import type { Armazenamento } from "./demo";
import type { Repositorio } from "./repositorio";

// As telas importam tudo daqui: tipos, erros e o repositório do modo atual.
export type * from "./repositorio";
export { ErroRepositorio } from "./repositorio";

export interface ConfiguracaoRepositorio {
  modo: Modo;
  /** Onde a demo guarda os dados; null = só em memória. */
  armazenamento: Armazenamento | null;
  supabaseUrl?: string;
  supabaseChave?: string;
}

/**
 * Monta o repositório do modo pedido. Cada modo carrega só o próprio código
 * (import dinâmico): a demo nunca baixa o cliente do Supabase.
 */
export async function criarRepositorio(config: ConfiguracaoRepositorio): Promise<Repositorio> {
  if (config.modo === "demo") {
    const { RepositorioDemo } = await import("./demo");
    return new RepositorioDemo(config.armazenamento);
  }

  const { supabaseUrl, supabaseChave } = config;
  if (!supabaseUrl || !supabaseChave) {
    const faltando = [
      !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
      !supabaseChave && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ].filter(Boolean);
    throw new Error(`Modo família sem ${faltando.join(" e ")}. Veja o .env.example.`);
  }

  const [{ createClient }, { RepositorioSupabase }] = await Promise.all([
    import("@supabase/supabase-js"),
    import("./supabase"),
  ]);
  return new RepositorioSupabase(createClient(supabaseUrl, supabaseChave));
}

let repositorioDaPagina: Promise<Repositorio> | null = null;

/**
 * O repositório que as telas usam — trocar `NEXT_PUBLIC_MODO` troca o modo sem
 * mexer em tela nenhuma.
 *
 * Um só por página: duas cópias da demo teriam estados diferentes, e a última
 * a salvar apagaria a outra no localStorage. E só no navegador: no servidor
 * não há localStorage nem sessão, e um repositório guardado aqui seria o mesmo
 * para todos os visitantes.
 */
export function obterRepositorio(): Promise<Repositorio> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("obterRepositorio() só roda no navegador: use num componente cliente."),
    );
  }
  repositorioDaPagina ??= criarRepositorio({
    modo: MODO,
    armazenamento: armazenamentoDoNavegador(),
    // Referências literais: o Next troca pelo valor no build.
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseChave: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }).catch((erro: unknown) => {
    repositorioDaPagina = null; // falhou: a próxima chamada tenta de novo
    throw erro;
  });
  return repositorioDaPagina;
}

function armazenamentoDoNavegador(): Armazenamento | null {
  try {
    return window.localStorage;
  } catch {
    // Safari com cookies bloqueados lança erro só de acessar o localStorage
    return null;
  }
}
