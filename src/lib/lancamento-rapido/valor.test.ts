import { describe, expect, it } from "vitest";
import { lerNumero, valorValido } from "./valor";

describe("lerNumero", () => {
  it.each([
    ["50", 5_000, false],
    ["50,90", 5_090, true],
    ["50,5", 5_050, true],
    ["0,99", 99, true],
    ["2.500", 250_000, true],
    ["1.250,00", 125_000, true],
    ["1.000.000", 100_000_000, true],
    ["50.90", 5_090, true], // ponto com 2 casas é decimal (teclado americano)
    ["9.5", 950, true],
    ["1,250.00", 125_000, true], // padrão americano completo
    ["007", 700, false],
  ])("%s → %i centavos", (texto, centavos, formatado) => {
    expect(lerNumero(texto)).toEqual({ centavos, formatado });
  });

  it.each([
    ["1,250", "mil e duzentos e cinquenta, ou um e vinte e cinco? Não chuta"],
    ["50,901", "três casas depois da vírgula"],
    ["2.50.0", "ponto fora do lugar"],
    ["10x", "parcela, não valor"],
    ["12h", "hora"],
    ["19:30", "hora"],
    ["10%", "porcentagem"],
    ["ps5", "nome de produto"],
    ["", "vazio"],
  ])("%s não é valor (%s)", (texto) => {
    expect(lerNumero(texto)).toBeNull();
  });
});

describe("valorValido", () => {
  it("vai de R$ 0,01 a R$ 10 milhões, como no banco", () => {
    expect(valorValido(0)).toBe(false);
    expect(valorValido(1)).toBe(true);
    expect(valorValido(1_000_000_000)).toBe(true);
    expect(valorValido(1_000_000_001)).toBe(false);
  });
});
