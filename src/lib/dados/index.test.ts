import { afterEach, describe, expect, it, vi } from "vitest";

const SUPABASE = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "chave-de-teste",
};

/** Carrega o módulo do zero, como num build novo com estas variáveis. */
async function buildCom(variaveis: Record<string, string>) {
  vi.resetModules();
  for (const [nome, valor] of Object.entries(variaveis)) vi.stubEnv(nome, valor);
  const dados = await import("./index");
  const { RepositorioDemo } = await import("./demo");
  const { RepositorioSupabase } = await import("./supabase");
  return { ...dados, RepositorioDemo, RepositorioSupabase };
}

function noNavegador() {
  const itens = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (chave: string) => itens.get(chave) ?? null,
      setItem: (chave: string, valor: string) => void itens.set(chave, valor),
    },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("criarRepositorio", () => {
  it("demo: funciona sem chave nenhuma", async () => {
    const { criarRepositorio, RepositorioDemo } = await buildCom({});
    const repo = await criarRepositorio({ modo: "demo", armazenamento: null });
    expect(repo).toBeInstanceOf(RepositorioDemo);
  });

  it("família: Supabase", async () => {
    const { criarRepositorio, RepositorioSupabase } = await buildCom({});
    const repo = await criarRepositorio({
      modo: "familia",
      armazenamento: null,
      supabaseUrl: SUPABASE.NEXT_PUBLIC_SUPABASE_URL,
      supabaseChave: SUPABASE.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
    expect(repo).toBeInstanceOf(RepositorioSupabase);
  });

  it("família sem URL ou chave: o erro diz o que falta", async () => {
    const { criarRepositorio } = await buildCom({});
    await expect(criarRepositorio({ modo: "familia", armazenamento: null })).rejects.toThrow(
      "sem NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
    await expect(
      criarRepositorio({ modo: "familia", armazenamento: null, supabaseUrl: "http://127.0.0.1:54321" }),
    ).rejects.toThrow("sem NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  });
});

describe("obterRepositorio", () => {
  it("NEXT_PUBLIC_MODO escolhe o repositório, sem mexer em tela", async () => {
    noNavegador();
    const demo = await buildCom({ NEXT_PUBLIC_MODO: "demo" });
    expect(await demo.obterRepositorio()).toBeInstanceOf(demo.RepositorioDemo);

    const familia = await buildCom({ NEXT_PUBLIC_MODO: "familia", ...SUPABASE });
    expect(await familia.obterRepositorio()).toBeInstanceOf(familia.RepositorioSupabase);
  });

  it("a página inteira divide o mesmo repositório", async () => {
    noNavegador();
    const { obterRepositorio } = await buildCom({ NEXT_PUBLIC_MODO: "demo" });
    expect(await obterRepositorio()).toBe(await obterRepositorio());
  });

  it("a demo guarda no localStorage do navegador", async () => {
    noNavegador();
    const { obterRepositorio } = await buildCom({ NEXT_PUBLIC_MODO: "demo" });
    const { CHAVE_DEMO } = await import("./demo");
    const repo = await obterRepositorio();
    const [mercado] = await repo.categorias();
    await repo.criarLancamento({
      tipo: "despesa",
      valorCentavos: 100,
      data: "2026-11-16",
      descricao: "pão",
      categoriaId: mercado.id,
    });
    expect(window.localStorage.getItem(CHAVE_DEMO)).toContain("pão");
  });

  it("no servidor, recusa: lá um repositório seria de todos os visitantes", async () => {
    const { obterRepositorio } = await buildCom({ NEXT_PUBLIC_MODO: "demo" });
    await expect(obterRepositorio()).rejects.toThrow(/só roda no navegador/);
  });

  it("se a criação falha, a próxima chamada tenta de novo", async () => {
    noNavegador();
    const { obterRepositorio, RepositorioSupabase } = await buildCom({ NEXT_PUBLIC_MODO: "familia" });
    await expect(obterRepositorio()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);

    for (const [nome, valor] of Object.entries(SUPABASE)) vi.stubEnv(nome, valor);
    expect(await obterRepositorio()).toBeInstanceOf(RepositorioSupabase);
  });
});
