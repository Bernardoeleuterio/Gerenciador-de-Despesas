import { describe, expect, it } from "vitest";
import { CHAVE_DEMO, RepositorioDemo, type Armazenamento } from "@/lib/dados/demo";
import { testarContrato } from "./repositorio.contrato";

class ArmazenamentoEmMemoria implements Armazenamento {
  readonly itens = new Map<string, string>();
  getItem(chave: string) {
    return this.itens.get(chave) ?? null;
  }
  setItem(chave: string, valor: string) {
    this.itens.set(chave, valor);
  }
}

describe("contrato: RepositorioDemo", () => {
  testarContrato(async () => new RepositorioDemo(new ArmazenamentoEmMemoria()));
});

describe("RepositorioDemo no navegador", () => {
  const lancamento = async (repo: RepositorioDemo) => {
    const mercado = (await repo.categorias()).find((categoria) => categoria.nome === "Mercado")!;
    return repo.criarLancamento({
      tipo: "despesa",
      valorCentavos: 5_000,
      data: "2026-11-16",
      descricao: "mercado",
      categoriaId: mercado.id,
    });
  };

  it("recarregar a página mantém os lançamentos", async () => {
    const armazenamento = new ArmazenamentoEmMemoria();
    const criado = await lancamento(new RepositorioDemo(armazenamento));
    const depoisDoF5 = new RepositorioDemo(armazenamento);
    expect(await depoisDoF5.lancamentosDoMes("2026-11")).toEqual([criado]);
  });

  it("dado guardado quebrado ou de outra versão: começa do zero, sem travar", async () => {
    for (const lixo of ["{não é json", JSON.stringify({ versao: 999 })]) {
      const armazenamento = new ArmazenamentoEmMemoria();
      armazenamento.setItem(CHAVE_DEMO, lixo);
      const repo = new RepositorioDemo(armazenamento);
      expect(await repo.categorias()).toHaveLength(12);
      expect(await repo.lancamentosDoMes("2026-11")).toEqual([]);
    }
  });

  it("se o navegador não deixa guardar, a demo segue funcionando em memória", async () => {
    const bloqueado: Armazenamento = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const repo = new RepositorioDemo(bloqueado);
    const criado = await lancamento(repo);
    expect(await repo.lancamentosDoMes("2026-11")).toEqual([criado]);
  });

  it("o que a tela recebe é cópia: mexer nela não muda o que está guardado", async () => {
    const repo = new RepositorioDemo(new ArmazenamentoEmMemoria());
    const criado = await lancamento(repo);
    criado.valorCentavos = 1;
    expect((await repo.lancamentosDoMes("2026-11"))[0].valorCentavos).toBe(5_000);
  });

  it("dado guardado antes dos convites existirem continua valendo", async () => {
    const armazenamento = new ArmazenamentoEmMemoria();
    const criado = await lancamento(new RepositorioDemo(armazenamento));
    const antigo = JSON.parse(armazenamento.getItem(CHAVE_DEMO)!);
    delete antigo.convites;
    armazenamento.setItem(CHAVE_DEMO, JSON.stringify(antigo));

    const repo = new RepositorioDemo(armazenamento);
    expect(await repo.lancamentosDoMes("2026-11")).toEqual([criado]);
    expect(await repo.convites()).toEqual([]);
  });

  it("na pele de um membro comum: não vê convites, não convida e não remove ninguém", async () => {
    const armazenamento = new ArmazenamentoEmMemoria();
    const daAdmin = new RepositorioDemo(armazenamento);
    const convite = await daAdmin.convidar({ email: "bia@exemplo.com", apelido: "Bia" });
    const membros = await daAdmin.membros();
    const ana = membros.find((membro) => membro.apelido === "Ana")!;
    const voce = membros.find((membro) => membro.apelido === "Visitante")!;

    // A mesma família, agora usada pela Ana
    const estado = JSON.parse(armazenamento.getItem(CHAVE_DEMO)!);
    armazenamento.setItem(CHAVE_DEMO, JSON.stringify({ ...estado, euId: ana.id }));
    const daAna = new RepositorioDemo(armazenamento);

    expect(await daAna.convites()).toEqual([]);
    const semPermissao = { codigo: "sem_permissao" };
    await expect(daAna.convidar({ email: "cris@exemplo.com", apelido: "Cris" })).rejects.toMatchObject(semPermissao);
    await expect(daAna.cancelarConvite(convite.id)).rejects.toMatchObject(semPermissao);
    await expect(daAna.removerMembro(voce.id)).rejects.toMatchObject(semPermissao);
  });
});
