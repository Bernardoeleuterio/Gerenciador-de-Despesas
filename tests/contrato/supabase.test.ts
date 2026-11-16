import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe } from "vitest";
import { RepositorioSupabase } from "@/lib/dados/supabase";
import { testarContrato } from "./repositorio.contrato";

/**
 * O mesmo contrato da demo, contra um Supabase de verdade: banco, Auth e API
 * locais, com RLS e FKs compostas valendo. Roda no CI depois do
 * `supabase start`; sem as variáveis (no `npm test` comum), fica de fora.
 */
const url = process.env.SUPABASE_TESTE_URL;
const chavePublica = process.env.SUPABASE_TESTE_CHAVE_PUBLICA;
const chaveSecreta = process.env.SUPABASE_TESTE_CHAVE_SECRETA;

const semSessaoGuardada = { auth: { persistSession: false, autoRefreshToken: false } };

describe.runIf(url && chavePublica && chaveSecreta)("contrato: RepositorioSupabase (Supabase local)", () => {
  let pessoa: { admin: SupabaseClient; cliente: SupabaseClient; usuarioId: string } | undefined;
  let familiaAnterior: string | undefined;

  async function entrar() {
    // O teste cria usuários e famílias: isso nunca pode acontecer num projeto real.
    const host = new URL(url!).hostname;
    if (host !== "127.0.0.1" && host !== "localhost") {
      throw new Error(`Os testes de contrato só rodam no Supabase local, não em ${host}.`);
    }

    const admin = createClient(url!, chaveSecreta!, semSessaoGuardada);
    const email = `teste-${crypto.randomUUID()}@example.com`;
    const senha = crypto.randomUUID();
    const criado = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (criado.error) throw criado.error;

    const cliente = createClient(url!, chavePublica!, semSessaoGuardada);
    const login = await cliente.auth.signInWithPassword({ email, password: senha });
    if (login.error) throw login.error;

    return { admin, cliente, usuarioId: criado.data.user.id };
  }

  // Uma pessoa só, porque o Auth limita os logins por minuto; mas cada teste
  // ganha uma família nova (a anterior é apagada, e o membro vai junto).
  testarContrato(async () => {
    pessoa ??= await entrar();
    const { admin, cliente, usuarioId } = pessoa;

    if (familiaAnterior) {
      const apagada = await admin.from("familias").delete().eq("id", familiaAnterior);
      if (apagada.error) throw apagada.error;
    }

    // Família só nasce pelo service role (no app, pelo seed); o gatilho cria as categorias.
    const familia = await admin.from("familias").insert({ nome: "Família Teste" }).select("id").single();
    if (familia.error) throw familia.error;
    familiaAnterior = familia.data.id;

    const membro = await admin
      .from("membros")
      .insert({ familia_id: familia.data.id, user_id: usuarioId, apelido: "Eu", papel: "admin" });
    if (membro.error) throw membro.error;

    // Contas não nascem sozinhas (na família de verdade, vêm do seed)
    const conta = await admin
      .from("contas")
      .insert({ familia_id: familia.data.id, nome: "Pix / débito", tipo: "conta" });
    if (conta.error) throw conta.error;

    return new RepositorioSupabase(cliente);
  });
});
