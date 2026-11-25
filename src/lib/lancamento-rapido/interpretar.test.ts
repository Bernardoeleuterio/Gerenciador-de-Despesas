import { describe, expect, it } from "vitest";
import { interpretar, type Catalogo } from "./interpretar";

const HOJE = "2026-11-25";

const CATALOGO: Catalogo = {
  categorias: [
    { id: "mercado", nome: "Mercado", tipo: "despesa" },
    { id: "delivery", nome: "Delivery e restaurantes", tipo: "despesa" },
    { id: "saude", nome: "Saúde", tipo: "despesa" },
    { id: "salario", nome: "Salário", tipo: "receita" },
  ],
  contas: [
    { id: "nubank", nome: "Nubank", tipo: "cartao" },
    { id: "inter", nome: "Cartão Inter", tipo: "cartao" },
  ],
  regras: [],
};

describe("interpretar", () => {
  it("com mais de um número e nada que diga qual é o valor, não chuta: oferece os dois", () => {
    const resultado = interpretar("2 pizzas 80", HOJE, CATALOGO);
    expect(resultado.valorCentavos).toBeNull();
    expect(resultado.valoresPossiveis).toEqual([
      { valorCentavos: 200, descricao: "pizzas 80" },
      { valorCentavos: 8_000, descricao: "2 pizzas" },
    ]);
    // A categoria não depende de qual for o valor
    expect(resultado.categoriaId).toBe("delivery");
  });

  it("sem número nenhum, pede o valor e não oferece nada", () => {
    expect(interpretar("ifood", HOJE, CATALOGO)).toMatchObject({
      valorCentavos: null,
      valoresPossiveis: [],
    });
  });

  it("a regra da família passa na frente da palavra-chave", () => {
    const comRegra = { ...CATALOGO, regras: [{ termo: "Farmácia", categoriaId: "mercado" }] };
    expect(interpretar("farmácia 30", HOJE, comRegra)).toMatchObject({
      categoriaId: "mercado",
      categoriaPor: "regra",
    });
  });

  it("regra que aponta para categoria que não existe mais é ignorada", () => {
    const comRegra = { ...CATALOGO, regras: [{ termo: "farmácia", categoriaId: "apagada" }] };
    expect(interpretar("farmácia 30", HOJE, comRegra)).toMatchObject({
      categoriaId: "saude",
      categoriaPor: "palavra-chave",
    });
  });

  it("receita só vai para categoria de receita", () => {
    const comRegra = {
      ...CATALOGO,
      regras: [
        { termo: "salário", categoriaId: "salario" },
        { termo: "mercado", categoriaId: "mercado" },
      ],
    };
    expect(interpretar("+3500 salário", HOJE, comRegra)).toMatchObject({
      tipo: "receita",
      categoriaId: "salario",
    });
    // "mercado" é palavra de despesa: numa receita, não vale
    expect(interpretar("+50 reembolso mercado", HOJE, comRegra).categoriaId).toBeNull();
  });

  it("forma de pagamento sem conta daquele tipo: sai da descrição, e a conta fica para a tela", () => {
    expect(interpretar("50 mercado pix", HOJE, CATALOGO)).toMatchObject({
      descricao: "mercado",
      contaId: null,
      contasPossiveis: [],
    });
  });

  it("dois cartões citados pelo nome: a tela pergunta qual", () => {
    expect(interpretar("50 mercado nubank inter", HOJE, CATALOGO)).toMatchObject({
      contaId: null,
      contasPossiveis: ["nubank", "inter"],
    });
  });

  it("mais de 48 parcelas não é parcela (o banco não aceita): fica na descrição", () => {
    expect(interpretar("geladeira 600 60x", HOJE, CATALOGO)).toMatchObject({
      parcelas: 1,
      valorCentavos: 60_000,
      descricao: "geladeira 60x",
    });
  });

  it("valor acima de R$ 10 milhões não é valor", () => {
    expect(interpretar("11987654321 mercado", HOJE, CATALOGO).valorCentavos).toBeNull();
  });

  it("parcela de valor alto que estoura o limite não multiplica", () => {
    const resultado = interpretar("48x de 9.000.000 terreno", HOJE, CATALOGO);
    expect(resultado.parcelas).toBe(48);
    expect(resultado.valorCentavos).toBe(900_000_000);
  });

  it("guarda a descrição como foi digitada, com maiúsculas e acentos", () => {
    expect(interpretar("Almoço com a Ana 42", HOJE, CATALOGO).descricao).toBe("Almoço com a Ana");
  });

  it("é pura: mesma entrada, mesma saída, e não mexe no catálogo", () => {
    const congelado = structuredClone(CATALOGO);
    const primeira = interpretar("50 ifood ontem nubank", HOJE, CATALOGO);
    expect(interpretar("50 ifood ontem nubank", HOJE, CATALOGO)).toEqual(primeira);
    expect(CATALOGO).toEqual(congelado);
  });

  it("texto vazio ou só espaços: nada, sem erro", () => {
    expect(interpretar("   ", HOJE, CATALOGO)).toMatchObject({
      valorCentavos: null,
      descricao: "",
      categoriaId: null,
      data: HOJE,
    });
  });
});
