import { describe, expect, it } from "vitest";
import { CATEGORIAS_PADRAO } from "@/lib/dados/categorias-padrao";
import { interpretar, type Catalogo, type Interpretacao } from "./interpretar";

/**
 * Os casos do dia a dia: o que uma família digita no celular, do jeito que
 * digita. Cada linha é um caso; para ensinar um caso novo ao parser, é só
 * acrescentar uma linha aqui.
 *
 * Hoje é quarta-feira, 25/11/2026. As categorias são as 12 padrão (o id é o
 * próprio nome, para ler fácil), e a família tem Pix/débito, dinheiro e dois
 * cartões.
 */
const HOJE = "2026-11-25";

const CATALOGO: Catalogo = {
  categorias: CATEGORIAS_PADRAO.map(({ nome }) => ({ id: nome, nome, tipo: "despesa" as const })),
  contas: [
    { id: "pix", nome: "Pix / débito", tipo: "conta" },
    { id: "dinheiro", nome: "Dinheiro", tipo: "dinheiro" },
    { id: "nubank", nome: "Nubank", tipo: "cartao" },
    { id: "inter", nome: "Cartão Inter", tipo: "cartao" },
  ],
  regras: [
    // O que a família já ensinou ao corrigir uma categoria
    { termo: "academia", categoriaId: "Lazer" },
    { termo: "seu zé", categoriaId: "Mercado" },
  ],
};

const PADRAO: Partial<Interpretacao> = {
  tipo: "despesa",
  data: HOJE,
  contaId: null,
  contasPossiveis: [],
  parcelas: 1,
  valoresPossiveis: [],
};

const categoria = (nome: string) => ({ categoriaId: nome, categoriaPor: "palavra-chave" as const });
const regra = (nome: string) => ({ categoriaId: nome, categoriaPor: "regra" as const });
const semCategoria = { categoriaId: null, categoriaPor: null };

const CASOS: [string, Partial<Interpretacao>][] = [
  // --- Os exemplos do planejamento
  ["50 ifood", { valorCentavos: 5_000, descricao: "ifood", ...categoria("Delivery e restaurantes") }],
  ["ifood 50", { valorCentavos: 5_000, descricao: "ifood", ...categoria("Delivery e restaurantes") }],
  ["32,90 farmácia ontem", { valorCentavos: 3_290, descricao: "farmácia", data: "2026-11-24", ...categoria("Saúde") }],
  ["2.500 aluguel", { valorCentavos: 250_000, descricao: "aluguel", ...categoria("Moradia") }],
  ["120 luz pix", { valorCentavos: 12_000, descricao: "luz", contaId: "pix", ...categoria("Contas da casa") }],
  ["600 geladeira 10x nubank", { valorCentavos: 60_000, descricao: "geladeira", parcelas: 10, contaId: "nubank", ...semCategoria }],
  ["+3500 salário", { tipo: "receita", valorCentavos: 350_000, descricao: "salário", ...semCategoria }],
  ["ifood", { valorCentavos: null, descricao: "ifood", ...categoria("Delivery e restaurantes") }],

  // --- Valor em qualquer formato e posição
  ["R$ 50 padaria", { valorCentavos: 5_000, descricao: "padaria", ...categoria("Mercado") }],
  ["R$89,90 tênis", { valorCentavos: 8_990, descricao: "tênis", ...categoria("Compras e cuidados") }],
  ["1.250,00 condomínio", { valorCentavos: 125_000, descricao: "condomínio", ...categoria("Moradia") }],
  ["50 reais de gasolina", { valorCentavos: 5_000, descricao: "gasolina", ...categoria("Transporte") }],
  ["gasolina 200 reais", { valorCentavos: 20_000, descricao: "gasolina", ...categoria("Transporte") }],
  ["uber 23.50", { valorCentavos: 2_350, descricao: "uber", ...categoria("Transporte") }],
  ["3 mil aluguel", { valorCentavos: 300_000, descricao: "aluguel", ...categoria("Moradia") }],
  ["internet 99,90", { valorCentavos: 9_990, descricao: "internet", ...categoria("Contas da casa") }],
  ["pão 7,5", { valorCentavos: 750, descricao: "pão", ...categoria("Mercado") }],
  ["50 conto pizza", { valorCentavos: 5_000, descricao: "pizza", ...categoria("Delivery e restaurantes") }],
  ["R$ 1.000.000 casa", { valorCentavos: 100_000_000, descricao: "casa", ...semCategoria }],
  ["50,90", { valorCentavos: 5_090, descricao: "", ...semCategoria }],

  // --- Datas
  ["almoço 35 ontem", { valorCentavos: 3_500, descricao: "almoço", data: "2026-11-24", ...categoria("Delivery e restaurantes") }],
  ["anteontem mercado 230,40", { valorCentavos: 23_040, descricao: "mercado", data: "2026-11-23", ...categoria("Mercado") }],
  ["antes de ontem uber 18", { valorCentavos: 1_800, descricao: "uber", data: "2026-11-23", ...categoria("Transporte") }],
  ["farmácia 45 dia 12", { valorCentavos: 4_500, descricao: "farmácia", data: "2026-11-12", ...categoria("Saúde") }],
  ["dia 30 luz 180", { valorCentavos: 18_000, descricao: "luz", data: "2026-10-30", ...categoria("Contas da casa") }],
  ["12/11 mercado 312,75", { valorCentavos: 31_275, descricao: "mercado", data: "2026-11-12", ...categoria("Mercado") }],
  ["19/11/2026 dentista 300", { valorCentavos: 30_000, descricao: "dentista", data: "2026-11-19", ...categoria("Saúde") }],
  ["consulta 250 sexta", { valorCentavos: 25_000, descricao: "consulta", data: "2026-11-20", ...categoria("Saúde") }],
  ["cinema 60 sábado", { valorCentavos: 6_000, descricao: "cinema", data: "2026-11-21", ...categoria("Lazer") }],
  ["quarta pizza 70", { valorCentavos: 7_000, descricao: "pizza", data: HOJE, ...categoria("Delivery e restaurantes") }],
  ["quarta passada pizza 70", { valorCentavos: 7_000, descricao: "pizza", data: "2026-11-18", ...categoria("Delivery e restaurantes") }],
  ["segunda-feira uber 15", { valorCentavos: 1_500, descricao: "uber", data: "2026-11-23", ...categoria("Transporte") }],
  ["domingo feira 85", { valorCentavos: 8_500, descricao: "feira", data: "2026-11-22", ...categoria("Mercado") }],
  ["hoje 25 padaria", { valorCentavos: 2_500, descricao: "padaria", ...categoria("Mercado") }],
  ["exames 300 dia 3", { valorCentavos: 30_000, descricao: "exames", data: "2026-11-03", ...categoria("Saúde") }],

  // --- Conta e forma de pagamento
  ["50 mercado dinheiro", { valorCentavos: 5_000, descricao: "mercado", contaId: "dinheiro", ...categoria("Mercado") }],
  ["uber 22 no débito", { valorCentavos: 2_200, descricao: "uber", contaId: "pix", ...categoria("Transporte") }],
  ["pix 80 diarista", { valorCentavos: 8_000, descricao: "diarista", contaId: "pix", ...categoria("Moradia") }],
  ["mercado 410 nubank", { valorCentavos: 41_000, descricao: "mercado", contaId: "nubank", ...categoria("Mercado") }],
  ["roupa 150 inter", { valorCentavos: 15_000, descricao: "roupa", contaId: "inter", ...categoria("Compras e cuidados") }],
  ["farmácia 38 no cartão", { valorCentavos: 3_800, descricao: "farmácia", contasPossiveis: ["nubank", "inter"], ...categoria("Saúde") }],
  ["posto 200 crédito", { valorCentavos: 20_000, descricao: "posto", contasPossiveis: ["nubank", "inter"], ...categoria("Transporte") }],
  ["netflix 55,90 nubank", { valorCentavos: 5_590, descricao: "netflix", contaId: "nubank", ...categoria("Assinaturas") }],

  // --- Parcelas
  ["notebook 4.500 12x nubank", { valorCentavos: 450_000, descricao: "notebook", parcelas: 12, contaId: "nubank", ...semCategoria }],
  ["tênis em 3x de 99,90", { valorCentavos: 29_970, descricao: "tênis", parcelas: 3, ...categoria("Compras e cuidados") }],
  ["sofá 2.400 em 6 vezes", { valorCentavos: 240_000, descricao: "sofá", parcelas: 6, ...semCategoria }],
  ["curso de inglês 3x 600", { valorCentavos: 60_000, descricao: "curso de inglês", parcelas: 3, ...categoria("Educação") }],
  ["fogão em 10x brastemp 1.200", { valorCentavos: 120_000, descricao: "fogão brastemp", parcelas: 10, ...semCategoria }],
  ["10 x 89 presente inter", { valorCentavos: 8_900, descricao: "presente", parcelas: 10, contaId: "inter", ...categoria("Compras e cuidados") }],

  // --- Receita: "+" no começo
  ["+ 1.200 freela", { tipo: "receita", valorCentavos: 120_000, descricao: "freela", ...semCategoria }],
  ["+150 reembolso mercado", { tipo: "receita", valorCentavos: 15_000, descricao: "reembolso mercado", ...semCategoria }],

  // --- Mais de um número: só escolhe se algo indica qual é o valor
  ["2 pizzas R$ 80", { valorCentavos: 8_000, descricao: "2 pizzas", ...categoria("Delivery e restaurantes") }],
  ["uber 99 25,90", { valorCentavos: 2_590, descricao: "uber 99", ...categoria("Transporte") }],
  ["mercado", { valorCentavos: null, descricao: "mercado", ...categoria("Mercado") }],
  ["0 mercado", { valorCentavos: null, descricao: "0 mercado", ...categoria("Mercado") }],

  // --- Categoria: regras da família, frases e plural
  ["academia 120", { valorCentavos: 12_000, descricao: "academia", ...regra("Lazer") }],
  ["padaria do seu zé 18", { valorCentavos: 1_800, descricao: "padaria do seu zé", ...regra("Mercado") }],
  ["mercado livre 230 capinha", { valorCentavos: 23_000, descricao: "mercado livre capinha", ...categoria("Compras e cuidados") }],
  ["amazon prime 19,90", { valorCentavos: 1_990, descricao: "amazon prime", ...categoria("Assinaturas") }],
  ["uber pro mercado 25", { valorCentavos: 2_500, descricao: "uber pro mercado", ...categoria("Transporte") }],
  ["ração do bob 160", { valorCentavos: 16_000, descricao: "ração do bob", ...categoria("Pets") }],
  ["presente aniversário 120", { valorCentavos: 12_000, descricao: "presente aniversário", ...categoria("Compras e cuidados") }],
  ["remédios 89,90", { valorCentavos: 8_990, descricao: "remédios", ...categoria("Saúde") }],
  ["Gastei 45 no McDonalds", { valorCentavos: 4_500, descricao: "McDonalds", ...categoria("Delivery e restaurantes") }],
  ["paguei a luz 210,37 ontem pix", { valorCentavos: 21_037, descricao: "luz", data: "2026-11-24", contaId: "pix", ...categoria("Contas da casa") }],
  ["bolsa 300", { valorCentavos: 30_000, descricao: "bolsa", ...semCategoria }],
  ["material de construção 540", { valorCentavos: 54_000, descricao: "material de construção", ...categoria("Moradia") }],
  ["material escolar 89", { valorCentavos: 8_900, descricao: "material escolar", ...categoria("Educação") }],
];

describe("lançamento rápido: casos do dia a dia", () => {
  it("são mais de 50", () => {
    expect(CASOS.length).toBeGreaterThan(50);
  });

  it.each(CASOS)("%s", (texto, esperado) => {
    expect(interpretar(texto, HOJE, CATALOGO)).toMatchObject({ ...PADRAO, ...esperado });
  });
});
