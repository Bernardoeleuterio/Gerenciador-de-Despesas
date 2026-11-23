/**
 * O que as telas sabem sobre os dados — e só isso.
 *
 * Existem duas implementações: RepositorioSupabase (versão da família, dados
 * reais) e RepositorioDemo (versão do portfólio, dados fictícios no navegador).
 * Nenhuma tela importa o Supabase direto; a mesma suíte de testes de contrato
 * roda contra as duas, para que se comportem igual.
 */

export type TipoLancamento = "despesa" | "receita";
export type StatusLancamento = "previsto" | "pago";
export type Papel = "admin" | "membro";
export type TipoConta = "conta" | "cartao" | "dinheiro";

export interface Familia {
  id: string;
  nome: string;
}

export interface Membro {
  id: string;
  apelido: string;
  papel: Papel;
}

export interface Categoria {
  id: string;
  nome: string;
  icone: string | null;
  tipo: TipoLancamento;
}

export interface Conta {
  id: string;
  nome: string;
  tipo: TipoConta;
  donoId: string | null;
  diaFechamento: number | null;
  diaVencimento: number | null;
}

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  /** Centavos inteiros, sempre positivos: quem diz se entrou ou saiu é o `tipo`. */
  valorCentavos: number;
  /** O dia do gasto, `AAAA-MM-DD`, sem fuso. */
  data: string;
  descricao: string;
  categoriaId: string;
  contaId: string | null;
  /** O membro que pagou; nulo se ninguém foi indicado. */
  pagoPor: string | null;
  status: StatusLancamento;
}

export interface NovoLancamento {
  tipo: TipoLancamento;
  valorCentavos: number;
  data: string;
  descricao: string;
  categoriaId: string;
  contaId?: string | null;
  /** Sem `pagoPor`, quem pagou é quem lançou. */
  pagoPor?: string | null;
  /** Sem `status`, o lançamento já nasce pago. */
  status?: StatusLancamento;
}

export type AlteracaoLancamento = Partial<NovoLancamento>;

/** Um convite que ainda não virou membro. */
export interface Convite {
  id: string;
  /** Sempre minúsculo e sem espaços nas pontas. */
  email: string;
  /** Como a pessoa vai aparecer quando entrar. */
  apelido: string;
  papel: Papel;
}

export interface NovoConvite {
  email: string;
  apelido: string;
  /** Sem `papel`, a pessoa entra como membro. */
  papel?: Papel;
}

export interface Repositorio {
  familia(): Promise<Familia>;
  /** O membro que está usando o app. */
  euMesmo(): Promise<Membro>;
  /** Ordem alfabética por apelido. */
  membros(): Promise<Membro[]>;
  /** Ordem alfabética por nome. */
  categorias(): Promise<Categoria[]>;
  /** Ordem alfabética por nome. */
  contas(): Promise<Conta[]>;
  /** `mes` no formato `AAAA-MM`; do lançamento mais recente para o mais antigo. */
  lancamentosDoMes(mes: string): Promise<Lancamento[]>;
  criarLancamento(novo: NovoLancamento): Promise<Lancamento>;
  alterarLancamento(id: string, mudancas: AlteracaoLancamento): Promise<Lancamento>;
  excluirLancamento(id: string): Promise<void>;
  /** Convites pendentes, por apelido. Só o admin vê; para os outros, lista vazia. */
  convites(): Promise<Convite[]>;
  /** Só o admin. Se a pessoa já tem conta com esse e-mail, entra na hora. */
  convidar(novo: NovoConvite): Promise<Convite>;
  /** Só o admin. */
  cancelarConvite(id: string): Promise<void>;
  /** Só o admin, e nunca a si mesmo. Os lançamentos ficam, sem "quem pagou". */
  removerMembro(id: string): Promise<void>;
}

export type CodigoErro = "invalido" | "nao_encontrado" | "sem_permissao" | "indisponivel";

/** Todo erro que sai de um repositório tem um código que a tela sabe tratar. */
export class ErroRepositorio extends Error {
  readonly codigo: CodigoErro;

  constructor(codigo: CodigoErro, mensagem: string, opcoes?: { cause?: unknown }) {
    super(mensagem, opcoes);
    this.name = "ErroRepositorio";
    this.codigo = codigo;
  }
}

/** Ordena por um texto, em português (acento e caixa não atrapalham a ordem). */
export function ordenarPor<T>(itens: T[], texto: (item: T) => string): T[] {
  return [...itens].sort((a, b) => texto(a).localeCompare(texto(b), "pt-BR"));
}
