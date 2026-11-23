import { CATEGORIAS_PADRAO } from "./categorias-padrao";
import {
  ErroRepositorio,
  ordenarPor,
  type AlteracaoLancamento,
  type Categoria,
  type Conta,
  type Convite,
  type Familia,
  type Lancamento,
  type Membro,
  type NovoConvite,
  type NovoLancamento,
  type Repositorio,
} from "./repositorio";
import {
  limitesDoMes,
  validarAlteracaoLancamento,
  validarNovoConvite,
  validarNovoLancamento,
} from "./validacao";

/** O pedaço do localStorage que a demo usa — injetável, para testar sem navegador. */
export interface Armazenamento {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

export const CHAVE_DEMO = "gerenciador-de-despesas:demo";
const VERSAO = 1;

interface LancamentoGuardado extends Lancamento {
  /** Ordem de criação: desempata lançamentos do mesmo dia. */
  sequencia: number;
}

interface EstadoDemo {
  versao: typeof VERSAO;
  familia: Familia;
  euId: string;
  membros: Membro[];
  categorias: Categoria[];
  contas: Conta[];
  lancamentos: LancamentoGuardado[];
  proximaSequencia: number;
  convites: Convite[];
}

function estadoInicial(): EstadoDemo {
  const voce: Membro = { id: crypto.randomUUID(), apelido: "Visitante", papel: "admin" };
  const ana: Membro = { id: crypto.randomUUID(), apelido: "Ana", papel: "membro" };
  const conta = (nome: string, tipo: Conta["tipo"], extra: Partial<Conta> = {}): Conta => ({
    id: crypto.randomUUID(),
    nome,
    tipo,
    donoId: null,
    diaFechamento: null,
    diaVencimento: null,
    ...extra,
  });

  return {
    versao: VERSAO,
    familia: { id: crypto.randomUUID(), nome: "Família Demo" },
    euId: voce.id,
    membros: [voce, ana],
    categorias: CATEGORIAS_PADRAO.map(({ nome, icone }) => ({
      id: crypto.randomUUID(),
      nome,
      icone,
      tipo: "despesa",
    })),
    contas: [
      conta("Pix / débito", "conta"),
      conta("Cartão de crédito", "cartao", { donoId: voce.id, diaFechamento: 3, diaVencimento: 10 }),
      conta("Dinheiro", "dinheiro"),
    ],
    lancamentos: [],
    proximaSequencia: 1,
    convites: [],
  };
}

function carregar(armazenamento: Armazenamento | null): EstadoDemo | null {
  if (!armazenamento) return null;
  try {
    const texto = armazenamento.getItem(CHAVE_DEMO);
    if (!texto) return null;
    const estado = JSON.parse(texto) as Partial<EstadoDemo>;
    const valido =
      estado.versao === VERSAO &&
      Array.isArray(estado.membros) &&
      Array.isArray(estado.categorias) &&
      Array.isArray(estado.contas) &&
      Array.isArray(estado.lancamentos);
    if (!valido) return null;
    // Guardado antes dos convites existirem: segue valendo, sem convite nenhum
    return { ...(estado as EstadoDemo), convites: Array.isArray(estado.convites) ? estado.convites : [] };
  } catch {
    // JSON quebrado ou armazenamento bloqueado (aba anônima): começa do zero
    return null;
  }
}

/** Uma cópia só com o que a tela conhece: mexer nela não muda o que está guardado. */
function semSequencia(guardado: LancamentoGuardado): Lancamento {
  return {
    id: guardado.id,
    tipo: guardado.tipo,
    valorCentavos: guardado.valorCentavos,
    data: guardado.data,
    descricao: guardado.descricao,
    categoriaId: guardado.categoriaId,
    contaId: guardado.contaId,
    pagoPor: guardado.pagoPor,
    status: guardado.status,
  };
}

/**
 * A versão do portfólio: sem backend, sem login, sem chave. Cada visitante mexe
 * numa cópia que vive só no próprio navegador (localStorage).
 *
 * Sem banco para garantir as regras, quem garante é o código — as mesmas regras
 * do banco, conferidas pela mesma suíte de testes de contrato.
 */
export class RepositorioDemo implements Repositorio {
  private readonly estado: EstadoDemo;

  constructor(private readonly armazenamento: Armazenamento | null = null) {
    this.estado = carregar(armazenamento) ?? estadoInicial();
  }

  async familia(): Promise<Familia> {
    return structuredClone(this.estado.familia);
  }

  async euMesmo(): Promise<Membro> {
    const eu = this.estado.membros.find((membro) => membro.id === this.estado.euId);
    if (!eu) throw new ErroRepositorio("sem_permissao", "Você não faz parte desta família.");
    return structuredClone(eu);
  }

  async membros(): Promise<Membro[]> {
    return ordenarPor(structuredClone(this.estado.membros), (membro) => membro.apelido);
  }

  async categorias(): Promise<Categoria[]> {
    return ordenarPor(structuredClone(this.estado.categorias), (categoria) => categoria.nome);
  }

  async contas(): Promise<Conta[]> {
    return ordenarPor(structuredClone(this.estado.contas), (conta) => conta.nome);
  }

  async lancamentosDoMes(mes: string): Promise<Lancamento[]> {
    const { inicio, fimExclusivo } = limitesDoMes(mes);
    return this.estado.lancamentos
      .filter((lancamento) => lancamento.data >= inicio && lancamento.data < fimExclusivo)
      .sort((a, b) => b.data.localeCompare(a.data) || b.sequencia - a.sequencia)
      .map(semSequencia);
  }

  async criarLancamento(novo: NovoLancamento): Promise<Lancamento> {
    const dados = validarNovoLancamento(novo);
    this.conferirReferencias(dados);

    const lancamento: LancamentoGuardado = {
      id: crypto.randomUUID(),
      tipo: dados.tipo,
      valorCentavos: dados.valorCentavos,
      data: dados.data,
      descricao: dados.descricao,
      categoriaId: dados.categoriaId,
      contaId: dados.contaId ?? null,
      pagoPor: dados.pagoPor === undefined ? this.estado.euId : dados.pagoPor,
      status: dados.status ?? "pago",
      sequencia: this.estado.proximaSequencia++,
    };
    this.estado.lancamentos.push(lancamento);
    this.salvar();
    return semSequencia(lancamento);
  }

  async alterarLancamento(id: string, mudancas: AlteracaoLancamento): Promise<Lancamento> {
    const dados = validarAlteracaoLancamento(mudancas);
    const lancamento = this.buscar(id);
    this.conferirReferencias(dados);

    for (const [campo, valor] of Object.entries(dados)) {
      if (valor !== undefined) Object.assign(lancamento, { [campo]: valor });
    }
    this.salvar();
    return semSequencia(lancamento);
  }

  async excluirLancamento(id: string): Promise<void> {
    const lancamento = this.buscar(id);
    this.estado.lancamentos.splice(this.estado.lancamentos.indexOf(lancamento), 1);
    this.salvar();
  }

  async convites(): Promise<Convite[]> {
    if (!this.souAdmin()) return [];
    return ordenarPor(structuredClone(this.estado.convites), (convite) => convite.apelido);
  }

  async convidar(novo: NovoConvite): Promise<Convite> {
    const dados = validarNovoConvite(novo);
    this.exigirAdmin();
    if (this.estado.convites.some((convite) => convite.email === dados.email)) {
      throw new ErroRepositorio("invalido", "Já existe um convite para esse e-mail.");
    }
    // Na demo ninguém tem conta: o convite fica pendente, e ninguém recebe nada
    const convite: Convite = {
      id: crypto.randomUUID(),
      email: dados.email,
      apelido: dados.apelido,
      papel: dados.papel ?? "membro",
    };
    this.estado.convites.push(convite);
    this.salvar();
    return structuredClone(convite);
  }

  async cancelarConvite(id: string): Promise<void> {
    this.exigirAdmin();
    const indice = this.estado.convites.findIndex((convite) => convite.id === id);
    if (indice === -1) throw new ErroRepositorio("nao_encontrado", "Convite não encontrado.");
    this.estado.convites.splice(indice, 1);
    this.salvar();
  }

  async removerMembro(id: string): Promise<void> {
    this.exigirAdmin();
    if (id === this.estado.euId) {
      throw new ErroRepositorio("invalido", "Você não pode remover a si mesmo.");
    }
    const indice = this.estado.membros.findIndex((membro) => membro.id === id);
    if (indice === -1) throw new ErroRepositorio("nao_encontrado", "Membro não encontrado.");
    this.estado.membros.splice(indice, 1);
    // O papel dos "on delete set null" do banco
    for (const lancamento of this.estado.lancamentos) {
      if (lancamento.pagoPor === id) lancamento.pagoPor = null;
    }
    for (const conta of this.estado.contas) {
      if (conta.donoId === id) conta.donoId = null;
    }
    this.salvar();
  }

  private souAdmin(): boolean {
    return this.estado.membros.some((membro) => membro.id === this.estado.euId && membro.papel === "admin");
  }

  private exigirAdmin(): void {
    if (!this.souAdmin()) throw new ErroRepositorio("sem_permissao", "Só o admin da família faz isso.");
  }

  private buscar(id: string): LancamentoGuardado {
    const lancamento = this.estado.lancamentos.find((item) => item.id === id);
    if (!lancamento) throw new ErroRepositorio("nao_encontrado", "Lançamento não encontrado.");
    return lancamento;
  }

  /** O papel das FKs compostas do banco: tudo aponta para algo desta família. */
  private conferirReferencias(dados: AlteracaoLancamento): void {
    const { categorias, contas, membros } = this.estado;
    if (dados.categoriaId !== undefined && !categorias.some((item) => item.id === dados.categoriaId)) {
      throw new ErroRepositorio("invalido", "A categoria não é desta família.");
    }
    if (dados.contaId != null && !contas.some((item) => item.id === dados.contaId)) {
      throw new ErroRepositorio("invalido", "A conta não é desta família.");
    }
    if (dados.pagoPor != null && !membros.some((item) => item.id === dados.pagoPor)) {
      throw new ErroRepositorio("invalido", "Quem pagou não é desta família.");
    }
  }

  private salvar(): void {
    try {
      this.armazenamento?.setItem(CHAVE_DEMO, JSON.stringify(this.estado));
    } catch {
      // Sem espaço ou armazenamento bloqueado: a demo segue funcionando em memória
    }
  }
}
