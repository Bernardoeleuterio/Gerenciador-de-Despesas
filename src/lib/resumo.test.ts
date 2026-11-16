import { describe, expect, it } from "vitest";
import type { Lancamento } from "@/lib/dados/repositorio";
import { resumir } from "./resumo";

let sequencia = 0;
function lancamento(dados: Partial<Lancamento>): Lancamento {
  sequencia += 1;
  return {
    id: `l${sequencia}`,
    tipo: "despesa",
    valorCentavos: 1000,
    data: "2026-11-10",
    descricao: "teste",
    categoriaId: "mercado",
    contaId: null,
    pagoPor: "ana",
    status: "pago",
    ...dados,
  };
}

describe("resumir", () => {
  it("mês sem lançamento: tudo zero", () => {
    expect(resumir([])).toEqual({
      despesasCentavos: 0,
      receitasCentavos: 0,
      saldoCentavos: 0,
      despesasPrevistasCentavos: 0,
      porCategoria: [],
      porPessoa: [],
    });
  });

  it("soma em centavos inteiros: 10 vezes R$ 0,10 dá R$ 1,00 exato", () => {
    const dezCentavos = Array.from({ length: 10 }, () => lancamento({ valorCentavos: 10 }));
    expect(resumir(dezCentavos).despesasCentavos).toBe(100);
  });

  it("saldo é o que entrou menos o que saiu", () => {
    const resumo = resumir([
      lancamento({ tipo: "receita", valorCentavos: 350_000, categoriaId: "salario" }),
      lancamento({ valorCentavos: 120_000 }),
      lancamento({ valorCentavos: 4_590 }),
    ]);
    expect(resumo).toMatchObject({
      receitasCentavos: 350_000,
      despesasCentavos: 124_590,
      saldoCentavos: 225_410,
    });
  });

  it("despesa prevista fica fora do total e aparece separada", () => {
    const resumo = resumir([
      lancamento({ valorCentavos: 5_000 }),
      lancamento({ valorCentavos: 21_800, status: "previsto", categoriaId: "contas" }),
    ]);
    expect(resumo.despesasCentavos).toBe(5_000);
    expect(resumo.despesasPrevistasCentavos).toBe(21_800);
    expect(resumo.porCategoria).toEqual([{ categoriaId: "mercado", totalCentavos: 5_000 }]);
  });

  it("agrupa por categoria e por pessoa, da maior para a menor", () => {
    const resumo = resumir([
      lancamento({ categoriaId: "delivery", valorCentavos: 5_000, pagoPor: "bia" }),
      lancamento({ categoriaId: "mercado", valorCentavos: 30_000, pagoPor: "ana" }),
      lancamento({ categoriaId: "delivery", valorCentavos: 7_000, pagoPor: "bia" }),
      lancamento({ categoriaId: "outros", valorCentavos: 2_000, pagoPor: null }),
    ]);
    expect(resumo.porCategoria).toEqual([
      { categoriaId: "mercado", totalCentavos: 30_000 },
      { categoriaId: "delivery", totalCentavos: 12_000 },
      { categoriaId: "outros", totalCentavos: 2_000 },
    ]);
    expect(resumo.porPessoa).toEqual([
      { membroId: "ana", totalCentavos: 30_000 },
      { membroId: "bia", totalCentavos: 12_000 },
      { membroId: null, totalCentavos: 2_000 },
    ]);
  });

  it("receita não entra no gasto por categoria nem por pessoa", () => {
    const resumo = resumir([lancamento({ tipo: "receita", valorCentavos: 100_000 })]);
    expect(resumo.porCategoria).toEqual([]);
    expect(resumo.porPessoa).toEqual([]);
  });
});
