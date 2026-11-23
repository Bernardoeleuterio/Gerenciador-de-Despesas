// Cria a família no Supabase (modo família): as contas básicas e o convite do
// admin. Roda uma vez só, com as variáveis no .env.local, que nunca vai para o Git:
//
//   npm run criar-familia
//
//   NEXT_PUBLIC_SUPABASE_URL   a URL do projeto
//   SUPABASE_SECRET_KEY        a chave secreta — só aqui, nunca no app
//   FAMILIA_NOME               ex.: Família Silva
//   ADMIN_EMAIL                o seu e-mail do Google (fica fora do repositório)
//   ADMIN_APELIDO              como você aparece no app
//
// Depois é só entrar no app com o Google: o convite vira membro (admin).

import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin cliente com a chave secreta
 * @param {{ nome?: string, email?: string, apelido?: string }} dados
 * @returns {Promise<string>} o id da família criada
 */
export async function criarFamilia(admin, dados) {
  const nome = dados.nome?.trim();
  const email = dados.email?.trim().toLowerCase();
  const apelido = dados.apelido?.trim();
  if (!nome || !email || !apelido) {
    throw new Error("Faltou FAMILIA_NOME, ADMIN_EMAIL ou ADMIN_APELIDO.");
  }

  // Caixa único: uma família por projeto.
  const existentes = await admin.from("familias").select("id", { count: "exact", head: true });
  if (existentes.error) throw existentes.error;
  if (existentes.count) {
    throw new Error("Já existe uma família neste projeto: o seed só roda uma vez.");
  }

  // As 12 categorias padrão nascem junto (gatilho do banco).
  const familia = await admin.from("familias").insert({ nome }).select("id").single();
  if (familia.error) throw familia.error;
  const familiaId = familia.data.id;

  try {
    // Contas: o básico. Cartões, com fechamento e vencimento, entram depois.
    const contas = await admin.from("contas").insert([
      { familia_id: familiaId, nome: "Pix / débito", tipo: "conta" },
      { familia_id: familiaId, nome: "Dinheiro", tipo: "dinheiro" },
    ]);
    if (contas.error) throw contas.error;

    const convite = await admin
      .from("convites")
      .insert({ familia_id: familiaId, email, apelido, papel: "admin" });
    if (convite.error) throw convite.error;
  } catch (erro) {
    // Sem deixar família pela metade: apaga e deixa rodar de novo
    await admin.from("familias").delete().eq("id", familiaId);
    throw erro;
  }

  return familiaId;
}

// Pelo terminal (npm run criar-familia)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !chave) {
    console.error("Faltou NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY no .env.local.");
    process.exit(1);
  }
  const admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    await criarFamilia(admin, {
      nome: process.env.FAMILIA_NOME,
      email: process.env.ADMIN_EMAIL,
      apelido: process.env.ADMIN_APELIDO,
    });
    console.log("Família criada. Agora entre no app com o Google usando o ADMIN_EMAIL.");
  } catch (erro) {
    console.error("Não deu para criar a família:", erro instanceof Error ? erro.message : erro);
    process.exit(1);
  }
}
