import { describe, expect, it } from "vitest";
import {
  diaDaSemana,
  hojeEmSaoPaulo,
  somarDias,
  ultimaData,
  ultimoDiaDaSemana,
  ultimoDiaDoMes,
} from "./datas";

const HOJE = "2026-11-25"; // uma quarta-feira

describe("datas", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(somarDias("2028-03-01", -1)).toBe("2028-02-29"); // bissexto
    expect(somarDias("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("sabe o dia da semana", () => {
    expect(diaDaSemana(HOJE)).toBe(3);
  });

  it("hoje é o de São Paulo, não o de Greenwich", () => {
    // 23h30 de 25/11 em São Paulo já é 26/11 em UTC
    expect(hojeEmSaoPaulo(new Date("2026-11-26T02:30:00Z"))).toBe("2026-11-25");
    expect(hojeEmSaoPaulo(new Date("2026-11-26T03:30:00Z"))).toBe("2026-11-26");
  });

  it("'dia N' é o mais recente que não passa de hoje", () => {
    expect(ultimoDiaDoMes(HOJE, 12)).toBe("2026-11-12");
    expect(ultimoDiaDoMes(HOJE, 25)).toBe("2026-11-25");
    expect(ultimoDiaDoMes(HOJE, 30)).toBe("2026-10-30");
    expect(ultimoDiaDoMes(HOJE, 31)).toBe("2026-10-31");
    expect(ultimoDiaDoMes("2026-03-05", 30)).toBe("2026-01-30"); // fevereiro não tem dia 30
    expect(ultimoDiaDoMes("2026-01-10", 15)).toBe("2025-12-15");
    expect(ultimoDiaDoMes(HOJE, 0)).toBeNull();
    expect(ultimoDiaDoMes(HOJE, 32)).toBeNull();
  });

  it("'12/11' é a ocorrência mais recente; com o ano, é aquela", () => {
    expect(ultimaData(HOJE, 12, 11)).toBe("2026-11-12");
    expect(ultimaData(HOJE, 30, 11)).toBe("2025-11-30");
    expect(ultimaData(HOJE, 29, 2)).toBe("2024-02-29");
    expect(ultimaData(HOJE, 3, 1, 2027)).toBe("2027-01-03");
    expect(ultimaData(HOJE, 3, 1, 27)).toBe("2027-01-03");
    expect(ultimaData(HOJE, 30, 2)).toBeNull();
    expect(ultimaData(HOJE, 1, 13)).toBeNull();
  });

  it("'sexta' é a mais recente; no próprio dia, é hoje — 'passada' pula hoje", () => {
    expect(ultimoDiaDaSemana(HOJE, 5, true)).toBe("2026-11-20");
    expect(ultimoDiaDaSemana(HOJE, 3, true)).toBe(HOJE);
    expect(ultimoDiaDaSemana(HOJE, 3, false)).toBe("2026-11-18");
    expect(ultimoDiaDaSemana(HOJE, 0, true)).toBe("2026-11-22");
  });
});
