import { describe, expect, it } from "vitest";
import { formatarReais, nomeDoDia, nomeDoMes } from "./formato";

// O Intl separa o "R$" com um espaço que não quebra (U+00A0)
const real = (texto: string) => texto.replace(" ", " ");

describe("formato", () => {
  it("reais à brasileira", () => {
    expect(formatarReais(5_000)).toBe(real("R$ 50,00"));
    expect(formatarReais(5_090)).toBe(real("R$ 50,90"));
    expect(formatarReais(250_000)).toBe(real("R$ 2.500,00"));
    expect(formatarReais(1)).toBe(real("R$ 0,01"));
  });

  it("nome do mês", () => {
    expect(nomeDoMes("2026-11")).toBe("novembro de 2026");
    expect(nomeDoMes("2027-01")).toBe("janeiro de 2027");
  });

  it("nome do dia, perto de hoje e longe", () => {
    const hoje = "2026-11-25"; // quarta
    expect(nomeDoDia("2026-11-25", hoje)).toBe("hoje");
    expect(nomeDoDia("2026-11-24", hoje)).toBe("ontem");
    expect(nomeDoDia("2026-11-23", hoje)).toBe("anteontem");
    expect(nomeDoDia("2026-11-20", hoje)).toBe("sexta");
    expect(nomeDoDia("2026-11-21", hoje)).toBe("sábado");
    expect(nomeDoDia("2026-11-18", hoje)).toBe("18/11");
    expect(nomeDoDia("2025-12-31", hoje)).toBe("31/12/2025");
    expect(nomeDoDia("2026-11-30", hoje)).toBe("30/11"); // futuro: só a data
  });
});
