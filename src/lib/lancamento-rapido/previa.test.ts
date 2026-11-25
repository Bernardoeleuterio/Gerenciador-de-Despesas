import { describe, expect, it } from "vitest";
import type { Catalogo } from "./interpretar";
import { montarPrevia, termoParaRegra, type Padroes } from "./previa";

const HOJE = "2026-11-25";
const CATALOGO: Catalogo = {
  categorias: [
    { id: "mercado", nome: "Mercado", tipo: "despesa" },
    { id: "delivery", nome: "Delivery e restaurantes", tipo: "despesa" },
    { id: "saude", nome: "Saúde", tipo: "despesa" },
    { id: "outros", nome: "Outros", tipo: "despesa" },
  ],
  contas: [
    { id: "pix", nome: "Pix / débito", tipo: "conta" },
    { id: "nubank", nome: "Nubank", tipo: "cartao" },
    { id: "inter", nome: "Inter", tipo: "cartao" },
  ],
  regras: [],
};
const PADROES: Padroes = { euId: "eu", contaPadraoId: "pix" };

const previa = (texto: string, escolhas = {}, catalogo = CATALOGO) =>
  montarPrevia(texto, HOJE, catalogo, PADROES, escolhas);

describe("montarPrevia", () => {
  it("'50 ifood': pronto para salvar, com quem lança pagando na conta de sempre", () => {
    expect(previa("50 ifood")).toMatchObject({
      bloqueio: null,
      categoriaPor: "palavra-chave",
      novo: {
        tipo: "despesa",
        valorCentavos: 5_000,
        data: HOJE,
        descricao: "ifood",
        categoriaId: "delivery",
        contaId: "pix",
        pagoPor: "eu",
      },
    });
  });

  it("sem texto, nada a salvar", () => {
    expect(previa("   ")).toMatchObject({ bloqueio: "vazio", novo: null });
  });

  it("sem valor, pede; com dois candidatos, pergunta qual", () => {
    expect(previa("ifood")).toMatchObject({ bloqueio: "sem-valor", novo: null });
    expect(previa("2 pizzas 80")).toMatchObject({ bloqueio: "valor-ambiguo", novo: null });
  });

  it("escolher um dos candidatos leva a descrição certa junto", () => {
    expect(previa("2 pizzas 80", { valorCentavos: 8_000 }).novo).toMatchObject({
      valorCentavos: 8_000,
      descricao: "2 pizzas",
    });
  });

  it("valor digitado no chip vale para o texto sem valor", () => {
    expect(previa("ifood", { valorCentavos: 3_500 }).novo).toMatchObject({
      valorCentavos: 3_500,
      descricao: "ifood",
    });
  });

  it("receita ainda não salva", () => {
    expect(previa("+3500 salário")).toMatchObject({ tipo: "receita", bloqueio: "receita", novo: null });
  });

  it("compra parcelada só salva se a pessoa aceitar à vista", () => {
    expect(previa("600 geladeira 10x")).toMatchObject({ parcelas: 10, bloqueio: "parcelado" });
    expect(previa("600 geladeira 10x", { aVista: true }).novo).toMatchObject({
      valorCentavos: 60_000,
      descricao: "geladeira",
    });
  });

  it("nada casou: vai para 'Outros', marcado como chute", () => {
    expect(previa("50 bolsa")).toMatchObject({
      categoriaId: "outros",
      categoriaPor: null,
      novo: { categoriaId: "outros" },
    });
  });

  it("sem 'Outros' na família e nada casou: pede a categoria", () => {
    const semOutros = { ...CATALOGO, categorias: CATALOGO.categorias.filter((c) => c.id !== "outros") };
    expect(previa("50 bolsa", {}, semOutros)).toMatchObject({ bloqueio: "sem-categoria" });
  });

  it("sem descrição, vale o nome da categoria", () => {
    expect(previa("50 pix").novo).toMatchObject({ descricao: "Outros", contaId: "pix" });
  });

  it("o que se escolhe nos chips vale mais que o texto", () => {
    const resultado = previa("50 ifood nubank", {
      categoriaId: "mercado",
      data: "2026-11-20",
      contaId: null,
      pagoPor: null,
    });
    expect(resultado.categoriaPor).toBe("escolha");
    expect(resultado.novo).toMatchObject({
      categoriaId: "mercado",
      data: "2026-11-20",
      contaId: null,
      pagoPor: null,
    });
  });

  it("'cartão' com dois cartões: não usa a conta de sempre, pergunta qual", () => {
    expect(previa("farmácia 38 cartão")).toMatchObject({
      contaId: null,
      contasPossiveis: ["nubank", "inter"],
    });
    expect(previa("farmácia 38 cartão", { contaId: "inter" })).toMatchObject({
      contaId: "inter",
      contasPossiveis: [],
    });
  });

  it("descrição comprida é cortada no limite do banco", () => {
    const longa = `${"a".repeat(130)} 50`;
    expect(previa(longa).novo?.descricao).toHaveLength(120);
  });
});

describe("termoParaRegra", () => {
  it("é a descrição, normalizada", () => {
    expect(termoParaRegra(previa("50 Seu Zé"))).toBe("seu ze");
  });

  it("sem descrição, não há o que ensinar", () => {
    expect(termoParaRegra(previa("50 pix"))).toBeNull();
  });
});
