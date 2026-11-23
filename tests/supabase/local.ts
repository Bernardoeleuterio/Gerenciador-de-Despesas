import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Papel } from "@/lib/dados";

export interface Pessoa {
  email: string;
  senha: string;
}

/** Uma pessoa de teste, com e-mail único: o mesmo Supabase serve a todos os testes. */
export function novaPessoa(prefixo: string): Pessoa {
  return { email: `${prefixo}-${crypto.randomUUID()}@example.com`, senha: crypto.randomUUID() };
}

const semSessaoGuardada = { auth: { persistSession: false, autoRefreshToken: false } };

function semErro(resposta: { error: unknown }): void {
  if (resposta.error) throw resposta.error;
}

/**
 * O Supabase local que o CI sobe com `supabase start` (banco, Auth e API).
 * Sem as variáveis — no `npm test` comum —, devolve null, e os testes que
 * dependem dele ficam de fora.
 */
export function supabaseLocal() {
  const url = process.env.SUPABASE_TESTE_URL;
  const chavePublica = process.env.SUPABASE_TESTE_CHAVE_PUBLICA;
  const chaveSecreta = process.env.SUPABASE_TESTE_CHAVE_SECRETA;
  if (!url || !chavePublica || !chaveSecreta) return null;

  // Os testes criam contas e famílias: isso nunca pode acontecer num projeto real.
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Os testes do Supabase só rodam no Supabase local, não em ${host}.`);
  }

  // O service role faz o papel do seed: passa por cima do RLS.
  const admin = createClient(url, chaveSecreta, semSessaoGuardada);

  return {
    admin,

    /** Quem ainda não entrou: só a chave publishable, como o navegador. */
    anonimo: () => createClient(url, chavePublica, semSessaoGuardada),

    /** Família nova, com as categorias padrão (gatilho) e uma conta. */
    async novaFamilia(nome = "Família Teste"): Promise<string> {
      const familia = await admin.from("familias").insert({ nome }).select("id").single();
      semErro(familia);
      const id: string = familia.data!.id;
      semErro(await admin.from("contas").insert({ familia_id: id, nome: "Pix / débito", tipo: "conta" }));
      return id;
    },

    /** Apaga a família; membros, contas, categorias e lançamentos vão junto. */
    async apagarFamilia(id: string): Promise<void> {
      semErro(await admin.from("familias").delete().eq("id", id));
    },

    async convidar(familiaId: string, email: string, apelido: string, papel: Papel = "membro") {
      semErro(await admin.from("convites").insert({ familia_id: familiaId, email, apelido, papel }));
    },

    /** Faz o papel do primeiro login com o Google: cria a conta, com e-mail já confirmado. */
    async criarConta(pessoa: Pessoa): Promise<string> {
      const { data, error } = await admin.auth.admin.createUser({
        email: pessoa.email,
        password: pessoa.senha,
        email_confirm: true,
      });
      if (error) throw error;
      return data.user.id;
    },

    /** Um cliente logado como a pessoa (cada login conta no limite do Auth). */
    async entrar(pessoa: Pessoa): Promise<SupabaseClient> {
      const cliente = createClient(url, chavePublica, semSessaoGuardada);
      semErro(await cliente.auth.signInWithPassword({ email: pessoa.email, password: pessoa.senha }));
      return cliente;
    },
  };
}
