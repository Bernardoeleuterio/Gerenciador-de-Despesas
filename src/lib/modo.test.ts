import { describe, expect, it } from "vitest";
import { lerModo } from "./modo";

describe("lerModo", () => {
  it("sem a variável, sobe em demo — o modo que nunca toca em dado real", () => {
    expect(lerModo(undefined)).toBe("demo");
    expect(lerModo("")).toBe("demo");
    expect(lerModo("   ")).toBe("demo");
  });

  it("aceita os dois modos", () => {
    expect(lerModo("familia")).toBe("familia");
    expect(lerModo("demo")).toBe("demo");
  });

  it("ignora maiúsculas, espaços e acento", () => {
    expect(lerModo(" Família ")).toBe("familia");
    expect(lerModo("DEMO")).toBe("demo");
  });

  it("valor inválido derruba na hora, em vez de cair num modo que ninguém escolheu", () => {
    expect(() => lerModo("producao")).toThrow(/NEXT_PUBLIC_MODO inválido/);
    expect(() => lerModo("famila")).toThrow(/Use "familia" ou "demo"/);
  });
});
