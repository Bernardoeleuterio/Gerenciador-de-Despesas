import { describe, expect, it } from "vitest";
import { limitesDoMes, validarAlteracaoLancamento, validarNovoLancamento } from "./validacao";

const CATEGORIA = "3f1c2a9e-6b1d-4c0a-9a57-0c5f4f2d8e11";

const valido = {
  tipo: "despesa" as const,
  valorCentavos: 5000,
  data: "2026-11-16",
  descricao: "ifood",
  categoriaId: CATEGORIA,
};

describe("validarNovoLancamento", () => {
  it("aceita um lançamento comum e tira os espaços das pontas da descrição", () => {
    expect(validarNovoLancamento({ ...valido, descricao: "  ifood  " }).descricao).toBe("ifood");
  });

  it.each([0, -1, 12.5, 1_000_000_001])("recusa o valor %s em centavos", (valorCentavos) => {
    expect(() => validarNovoLancamento({ ...valido, valorCentavos })).toThrow(
      expect.objectContaining({ codigo: "invalido" }),
    );
  });

  it.each(["2026-02-30", "2026-13-01", "16/11/2026", "2026-11-1"])("recusa a data %s", (data) => {
    expect(() => validarNovoLancamento({ ...valido, data })).toThrow(
      expect.objectContaining({ codigo: "invalido" }),
    );
  });

  it("aceita 29 de fevereiro só em ano bissexto", () => {
    expect(validarNovoLancamento({ ...valido, data: "2028-02-29" }).data).toBe("2028-02-29");
    expect(() => validarNovoLancamento({ ...valido, data: "2026-02-29" })).toThrow();
  });

  it("recusa descrição vazia, só com espaços ou longa demais", () => {
    for (const descricao of ["", "   ", "x".repeat(121)]) {
      expect(() => validarNovoLancamento({ ...valido, descricao })).toThrow();
    }
  });

  it("recusa campo que não existe no lançamento", () => {
    expect(() =>
      validarNovoLancamento({ ...valido, familiaId: CATEGORIA } as unknown as typeof valido),
    ).toThrow(expect.objectContaining({ codigo: "invalido" }));
  });
});

describe("validarAlteracaoLancamento", () => {
  it("aceita mudar um campo só, com as mesmas regras", () => {
    expect(validarAlteracaoLancamento({ valorCentavos: 4590 })).toEqual({ valorCentavos: 4590 });
    expect(() => validarAlteracaoLancamento({ valorCentavos: 0 })).toThrow();
  });
});

describe("limitesDoMes", () => {
  it("vai do dia 1 até o dia 1 do mês seguinte", () => {
    expect(limitesDoMes("2026-11")).toEqual({ inicio: "2026-11-01", fimExclusivo: "2026-12-01" });
  });

  it("vira o ano em dezembro", () => {
    expect(limitesDoMes("2026-12")).toEqual({ inicio: "2026-12-01", fimExclusivo: "2027-01-01" });
  });

  it.each(["2026-13", "2026-1", "nov/2026"])("recusa o mês %s", (mes) => {
    expect(() => limitesDoMes(mes)).toThrow(expect.objectContaining({ codigo: "invalido" }));
  });
});
