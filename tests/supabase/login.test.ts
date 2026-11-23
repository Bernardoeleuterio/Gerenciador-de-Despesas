import { describe, expect, it } from "vitest";
import { RepositorioSupabase } from "@/lib/dados/supabase";
import { criarFamilia } from "../../scripts/criar-familia.mjs";
import { novaPessoa, supabaseLocal } from "./local";

/**
 * O login por convite de ponta a ponta, no Supabase local do CI: o hook do
 * Auth, os gatilhos que transformam convite em membro e o seed. O cadastro com
 * e-mail e senha faz o papel do login com o Google, que não roda no CI.
 */
const local = supabaseLocal();

describe.runIf(local)("login por convite (Supabase local)", () => {
  it("sem convite, o Auth nem cria a conta", async () => {
    const estranho = novaPessoa("estranho");
    const { data, error } = await local!.anonimo().auth.signUp({
      email: estranho.email,
      password: estranho.senha,
    });
    expect(error?.message).toMatch(/só por convite/);
    expect(data.user).toBeNull();

    const { data: contas } = await local!.admin.auth.admin.listUsers({ perPage: 1000 });
    expect(contas.users.map((conta) => conta.email)).not.toContain(estranho.email);
  });

  it("com convite, a pessoa entra na família já no primeiro login, com o apelido e o papel do convite", async () => {
    const familia = await local!.novaFamilia("Família do Login");
    const bia = novaPessoa("bia");
    await local!.convidar(familia, bia.email, "Bia");

    const { error } = await local!.anonimo().auth.signUp({ email: bia.email, password: bia.senha });
    expect(error).toBeNull();

    const repo = new RepositorioSupabase(await local!.entrar(bia));
    expect(await repo.familia()).toEqual({ id: familia, nome: "Família do Login" });
    expect(await repo.euMesmo()).toMatchObject({ apelido: "Bia", papel: "membro" });
  });

  it("membro comum não vê convites, não convida e não remove ninguém", async () => {
    const familia = await local!.novaFamilia();
    const dona = novaPessoa("dona");
    const comum = novaPessoa("comum");
    await local!.convidar(familia, dona.email, "Dona", "admin");
    await local!.convidar(familia, comum.email, "Comum");
    await local!.criarConta(dona);
    await local!.criarConta(comum);
    await local!.convidar(familia, "pendente@example.com", "Pendente");

    const repo = new RepositorioSupabase(await local!.entrar(comum));
    const daDona = (await repo.membros()).find((membro) => membro.apelido === "Dona")!;
    expect(await repo.convites()).toEqual([]);
    await expect(repo.convidar({ email: "cris@example.com", apelido: "Cris" })).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
    await expect(repo.removerMembro(daDona.id)).rejects.toMatchObject({ codigo: "sem_permissao" });
  });

  it("quem foi removido ainda entra, mas não vê família nenhuma", async () => {
    const familia = await local!.novaFamilia();
    const saiu = novaPessoa("saiu");
    await local!.convidar(familia, saiu.email, "Saiu");
    await local!.criarConta(saiu);
    const { error } = await local!.admin.from("membros").delete().eq("familia_id", familia);
    expect(error).toBeNull();

    const repo = new RepositorioSupabase(await local!.entrar(saiu));
    await expect(repo.euMesmo()).rejects.toMatchObject({
      codigo: "sem_permissao",
      message: expect.stringMatching(/ainda não faz parte/),
    });
  });

  it("o seed cria a família, as contas e o convite do admin, que entra como admin", async () => {
    // O seed só roda num projeto sem família: tira as que os outros testes criaram
    const { error } = await local!.admin.from("familias").delete().not("id", "is", null);
    expect(error).toBeNull();

    const dono = novaPessoa("dono");
    const familia = await criarFamilia(local!.admin, {
      nome: " Família Seed ",
      email: ` ${dono.email.toUpperCase()} `,
      apelido: "Dono",
    });
    await expect(
      criarFamilia(local!.admin, { nome: "Outra", email: "outra@example.com", apelido: "Outra" }),
    ).rejects.toThrow(/Já existe uma família/);

    await local!.criarConta(dono);
    const repo = new RepositorioSupabase(await local!.entrar(dono));
    expect(await repo.familia()).toEqual({ id: familia, nome: "Família Seed" });
    expect(await repo.euMesmo()).toMatchObject({ apelido: "Dono", papel: "admin" });
    expect((await repo.contas()).map((conta) => conta.nome)).toEqual(["Dinheiro", "Pix / débito"]);
    expect(await repo.categorias()).toHaveLength(12);
  });
});
