import type { SupabaseClient } from "@supabase/supabase-js";
import { describe } from "vitest";
import { RepositorioSupabase } from "@/lib/dados/supabase";
import { novaPessoa, supabaseLocal } from "../supabase/local";
import { testarContrato } from "./repositorio.contrato";

/**
 * O mesmo contrato da demo, contra um Supabase de verdade: banco, Auth e API
 * locais, com RLS e FKs compostas valendo. Roda no CI depois do
 * `supabase start`; sem as variáveis (no `npm test` comum), fica de fora.
 */
const local = supabaseLocal();

describe.runIf(local)("contrato: RepositorioSupabase (Supabase local)", () => {
  const eu = novaPessoa("eu");
  const ana = novaPessoa("ana");
  let cliente: SupabaseClient | undefined;
  let familiaAnterior: string | undefined;

  // Duas pessoas para a suíte inteira (o Auth limita os logins por minuto),
  // mas uma família nova a cada teste: a anterior é apagada, com os membros.
  testarContrato(async () => {
    if (familiaAnterior) await local!.apagarFamilia(familiaAnterior);
    const familia = await local!.novaFamilia();
    familiaAnterior = familia;

    // Entrar na família é sempre por convite. Na primeira vez as contas ainda
    // não existem: o convite deixa o hook do Auth criá-las, e o gatilho as faz
    // membros. Depois, as contas já existem, e o convite vale na hora.
    await local!.convidar(familia, eu.email, "Eu", "admin");
    await local!.convidar(familia, ana.email, "Ana");
    if (!cliente) {
      await local!.criarConta(eu);
      await local!.criarConta(ana);
      cliente = await local!.entrar(eu);
    }
    return new RepositorioSupabase(cliente);
  });
});
