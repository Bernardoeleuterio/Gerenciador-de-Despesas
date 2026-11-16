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
 * categorias padrão e nenhum lançamento.
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

  it("alterar ou excluir o que não existe dá nao_encontrado", async () => {
    await expect(repo.alterarLancamento(ALHEIO, { valorCentavos: 100 })).rejects.toMatchObject({
      codigo: "nao_encontrado",
    });
    await expect(repo.excluirLancamento(ALHEIO)).rejects.toMatchObject({ codigo: "nao_encontrado" });
  });

  it("recusa mês em formato errado", async () => {
    await expect(repo.lancamentosDoMes("2026-13")).rejects.toMatchObject({ codigo: "invalido" });
  });
}
