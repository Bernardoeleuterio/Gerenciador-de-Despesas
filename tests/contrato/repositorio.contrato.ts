import { beforeEach, expect, it } from "vitest";
import { CATEGORIAS_PADRAO } from "@/lib/dados/categorias-padrao";
import type { NovoLancamento, Repositorio } from "@/lib/dados/repositorio";

/** Um UUID que não é de nada nesta família. */
const ALHEIO = "7d2b6a3e-1c4f-4e8a-9b0d-5f6e7a8b9c0d";

/**
 * O contrato de todo Repositorio: a mesma suíte roda contra a demo (no npm test)
 * e contra o Supabase local (no CI). Chame dentro de um `describe`.
 *
 * `criar` devolve um repositório de uma família nova, recém-criada, com as
 * categorias padrão, ao menos uma conta, nenhum lançamento e nenhum convite
 * pendente; quem usa é admin, e há mais um membro comum.
 */
export function testarContrato(criar: () => Promise<Repositorio>) {
  let repo: Repositorio;
  let base: NovoLancamento;

  beforeEach(async () => {
    repo = await criar();
    const mercado = (await repo.categorias()).find((categoria) => categoria.nome === "Mercado");
    base = {
      tipo: "despesa",
      valorCentavos: 5_000,
      data: "2026-11-16",
      descricao: "mercado da semana",
      categoriaId: mercado!.id,
    };
  });

  it("conhece a família e quem está usando o app", async () => {
    const familia = await repo.familia();
    const eu = await repo.euMesmo();
    expect(familia.nome.length).toBeGreaterThan(0);
    expect((await repo.membros()).map((membro) => membro.id)).toContain(eu.id);
  });

  it("a família começa com as 12 categorias padrão, em ordem alfabética", async () => {
    const nomes = (await repo.categorias()).map((categoria) => categoria.nome);
    const esperado = CATEGORIAS_PADRAO.map((categoria) => categoria.nome).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
    expect(nomes).toEqual(esperado);
  });

  it("o lançamento volta completo: já pago, sem conta, e quem pagou é quem lançou", async () => {
    const eu = await repo.euMesmo();
    const criado = await repo.criarLancamento({ ...base, descricao: "  ifood  " });
    expect(criado).toEqual({
      id: expect.any(String),
      tipo: "despesa",
      valorCentavos: 5_000,
      data: "2026-11-16",
      descricao: "ifood",
      categoriaId: base.categoriaId,
      contaId: null,
      pagoPor: eu.id,
      status: "pago",
    });
  });

  it("dá para dizer que ninguém em especial pagou", async () => {
    const criado = await repo.criarLancamento({ ...base, pagoPor: null });
    expect(criado.pagoPor).toBeNull();
  });

  it("o lançamento aparece no mês dele, e só nele", async () => {
    const criado = await repo.criarLancamento({ ...base, data: "2026-11-30" });
    const ids = async (mes: string) => (await repo.lancamentosDoMes(mes)).map((l) => l.id);
    expect(await ids("2026-11")).toEqual([criado.id]);
    expect(await ids("2026-10")).toEqual([]);
    expect(await ids("2026-12")).toEqual([]);
  });

  it("lista o mês do mais recente para o mais antigo; no mesmo dia, o último lançado vem antes", async () => {
    const dia5 = await repo.criarLancamento({ ...base, data: "2026-11-05" });
    const dia20 = await repo.criarLancamento({ ...base, data: "2026-11-20" });
    const outroDia5 = await repo.criarLancamento({ ...base, data: "2026-11-05" });
    const ordem = (await repo.lancamentosDoMes("2026-11")).map((l) => l.id);
    expect(ordem).toEqual([dia20.id, outroDia5.id, dia5.id]);
  });

  it.each([
    ["valor zero", { valorCentavos: 0 }],
    ["centavo quebrado", { valorCentavos: 12.5 }],
    ["valor acima de R$ 10 milhões", { valorCentavos: 1_000_000_001 }],
    ["data que não existe", { data: "2026-02-30" }],
    ["descrição só com espaços", { descricao: "   " }],
  ])("recusa %s", async (_, errado) => {
    await expect(repo.criarLancamento({ ...base, ...errado })).rejects.toMatchObject({
      codigo: "invalido",
    });
  });

  it.each([
    ["categoria", { categoriaId: ALHEIO }],
    ["conta", { contaId: ALHEIO }],
    ["pessoa", { pagoPor: ALHEIO }],
  ])("recusa %s que não é da família", async (_, alheio) => {
    await expect(repo.criarLancamento({ ...base, ...alheio })).rejects.toMatchObject({
      codigo: "invalido",
    });
  });

  it("altera só o que foi pedido", async () => {
    const criado = await repo.criarLancamento(base);
    const conta = (await repo.contas())[0];
    const alterado = await repo.alterarLancamento(criado.id, { valorCentavos: 4_590, contaId: conta.id });
    expect(alterado).toEqual({ ...criado, valorCentavos: 4_590, contaId: conta.id });
    expect(await repo.lancamentosDoMes("2026-11")).toEqual([alterado]);
  });

  it("alterar com valor inválido não muda nada", async () => {
    const criado = await repo.criarLancamento(base);
    await expect(repo.alterarLancamento(criado.id, { valorCentavos: -1 })).rejects.toMatchObject({
      codigo: "invalido",
    });
    expect(await repo.lancamentosDoMes("2026-11")).toEqual([criado]);
  });

  it("exclui o lançamento", async () => {
    const criado = await repo.criarLancamento(base);
    await repo.excluirLancamento(criado.id);
    expect(await repo.lancamentosDoMes("2026-11")).toEqual([]);
  });

  it("alterar sem mudar nada devolve o lançamento como está", async () => {
    const criado = await repo.criarLancamento(base);
    expect(await repo.alterarLancamento(criado.id, {})).toEqual(criado);
  });

  it.each([
    ["que não existe", ALHEIO],
    ["que nem é um id", "nao-e-um-id"],
  ])("alterar ou excluir lançamento %s dá nao_encontrado", async (_, id) => {
    await expect(repo.alterarLancamento(id, { valorCentavos: 100 })).rejects.toMatchObject({
      codigo: "nao_encontrado",
    });
    await expect(repo.excluirLancamento(id)).rejects.toMatchObject({ codigo: "nao_encontrado" });
  });

  it("recusa mês em formato errado", async () => {
    await expect(repo.lancamentosDoMes("2026-13")).rejects.toMatchObject({ codigo: "invalido" });
  });

  it("o admin convida: o convite fica pendente, com o e-mail normalizado", async () => {
    const convite = await repo.convidar({ email: "  Bia@Exemplo.com ", apelido: " Bia " });
    expect(convite).toEqual({
      id: expect.any(String),
      email: "bia@exemplo.com",
      apelido: "Bia",
      papel: "membro",
    });
    expect(await repo.convites()).toEqual([convite]);
  });

  it.each([
    ["e-mail inválido", { email: "bia@", apelido: "Bia" }],
    ["sem apelido", { email: "bia@exemplo.com", apelido: "   " }],
    ["apelido longo demais", { email: "bia@exemplo.com", apelido: "B".repeat(41) }],
  ])("recusa convite com %s", async (_, errado) => {
    await expect(repo.convidar(errado)).rejects.toMatchObject({ codigo: "invalido" });
    expect(await repo.convites()).toEqual([]);
  });

  it("não convida o mesmo e-mail duas vezes", async () => {
    await repo.convidar({ email: "bia@exemplo.com", apelido: "Bia" });
    await expect(repo.convidar({ email: "BIA@exemplo.com", apelido: "Bia" })).rejects.toMatchObject({
      codigo: "invalido",
    });
  });

  it("cancela convite; cancelar o que não existe dá nao_encontrado", async () => {
    const convite = await repo.convidar({ email: "bia@exemplo.com", apelido: "Bia", papel: "admin" });
    await repo.cancelarConvite(convite.id);
    expect(await repo.convites()).toEqual([]);
    for (const id of [convite.id, "nao-e-um-id"]) {
      await expect(repo.cancelarConvite(id)).rejects.toMatchObject({ codigo: "nao_encontrado" });
    }
  });

  it("o admin remove outro membro: o que ele pagou fica sem 'quem pagou'", async () => {
    const eu = await repo.euMesmo();
    expect(eu.papel).toBe("admin");
    const outro = (await repo.membros()).find((membro) => membro.id !== eu.id)!;
    const lancamento = await repo.criarLancamento({ ...base, pagoPor: outro.id });

    await repo.removerMembro(outro.id);
    expect((await repo.membros()).map((membro) => membro.id)).toEqual([eu.id]);
    expect(await repo.lancamentosDoMes("2026-11")).toEqual([{ ...lancamento, pagoPor: null }]);
  });

  it("ninguém remove a si mesmo", async () => {
    const eu = await repo.euMesmo();
    await expect(repo.removerMembro(eu.id)).rejects.toMatchObject({ codigo: "invalido" });
    expect((await repo.membros()).map((membro) => membro.id)).toContain(eu.id);
  });

  it.each([
    ["que não existe", ALHEIO],
    ["que nem é um id", "nao-e-um-id"],
  ])("remover membro %s dá nao_encontrado", async (_, id) => {
    await expect(repo.removerMembro(id)).rejects.toMatchObject({ codigo: "nao_encontrado" });
  });

  it("a família começa sem regras de categoria", async () => {
    expect(await repo.regras()).toEqual([]);
  });

  it("ensina uma regra, com o termo normalizado", async () => {
    const mercado = base.categoriaId;
    const regra = await repo.salvarRegra("  Seu  Zé ", mercado);
    expect(regra).toEqual({ id: expect.any(String), termo: "seu ze", categoriaId: mercado });
    expect(await repo.regras()).toEqual([regra]);
  });

  it("ensinar de novo o mesmo termo troca a categoria, sem duplicar", async () => {
    const categorias = await repo.categorias();
    const lazer = categorias.find((categoria) => categoria.nome === "Lazer")!;
    const primeira = await repo.salvarRegra("academia", base.categoriaId);
    const corrigida = await repo.salvarRegra("Academia", lazer.id);
    expect(corrigida).toEqual({ id: primeira.id, termo: "academia", categoriaId: lazer.id });
    expect(await repo.regras()).toEqual([corrigida]);
  });

  it.each([
    ["sem termo", "   ", undefined],
    ["com termo longo demais", "a".repeat(61), undefined],
    ["com categoria de fora da família", "ifood", ALHEIO],
  ])("recusa regra %s", async (_, termo, categoriaId) => {
    await expect(repo.salvarRegra(termo, categoriaId ?? base.categoriaId)).rejects.toMatchObject({
      codigo: "invalido",
    });
    expect(await repo.regras()).toEqual([]);
  });
}
