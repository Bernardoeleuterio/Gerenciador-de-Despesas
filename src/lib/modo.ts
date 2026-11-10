/**
 * O mesmo código roda em dois modos:
 * - "familia": dados reais no Supabase (login, RLS) — a versão privada da casa;
 * - "demo": sem backend, com dados fictícios no navegador — a versão do portfólio.
 *
 * Sem a variável, o app sobe em "demo": é o modo que nunca toca em dado real.
 * Valor inválido derruba o app na hora (fail fast), em vez de cair num modo
 * que ninguém escolheu.
 */
export type Modo = "familia" | "demo";

const MODOS: readonly Modo[] = ["familia", "demo"];

function ehModo(valor: string): valor is Modo {
  return (MODOS as readonly string[]).includes(valor);
}

export function lerModo(valor: string | undefined): Modo {
  if (valor === undefined || valor.trim() === "") return "demo";

  const normalizado = valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // tira os acentos: "família" → "familia"

  if (ehModo(normalizado)) return normalizado;

  throw new Error(
    `NEXT_PUBLIC_MODO inválido: "${valor}". Use "familia" ou "demo".`,
  );
}

// Referência literal: o Next troca `process.env.NEXT_PUBLIC_MODO` pelo valor no build.
export const MODO: Modo = lerModo(process.env.NEXT_PUBLIC_MODO);
