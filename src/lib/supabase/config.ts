export interface ConfigSupabase {
  url: string;
  /** A chave publishable: vai para o navegador por design, quem protege os dados é o RLS. */
  chave: string;
}

/** Confere a URL e a chave do modo família; se faltar algo, o erro diz o quê. */
export function exigirConfigSupabase(url?: string, chave?: string): ConfigSupabase {
  if (url && chave) return { url, chave };
  const faltando = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !chave && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);
  throw new Error(`Modo família sem ${faltando.join(" e ")}. Veja o .env.example.`);
}

/** As variáveis do build. Referências literais: o Next troca pelo valor no build. */
export function configSupabaseDoBuild(): ConfigSupabase {
  return exigirConfigSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
