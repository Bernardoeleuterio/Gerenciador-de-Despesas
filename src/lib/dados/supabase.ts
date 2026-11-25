import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import {
  ErroRepositorio,
  ordenarPor,
  type AlteracaoLancamento,
  type Categoria,
  type CodigoErro,
  type Conta,
  type Convite,
  type Familia,
  type Lancamento,
  type Membro,
  type NovoConvite,
  type NovoLancamento,
  type Regra,
  type Repositorio,
} from "./repositorio";
import {
  limitesDoMes,
  validarAlteracaoLancamento,
  validarNovoConvite,
  validarNovoLancamento,
  validarRegra,
} from "./validacao";

// As linhas como o banco devolve (snake_case).
interface LinhaMembro {
  id: string;
  familia_id: string;
  apelido: string;
  papel: Membro["papel"];
}

interface LinhaConta {
  id: string;
  nome: string;
  tipo: Conta["tipo"];
  dono_id: string | null;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
}

interface LinhaLancamento {
  id: string;
  tipo: Lancamento["tipo"];
  valor_centavos: number;
  data: string;
  descricao: string;
  categoria_id: string;
  conta_id: string | null;
  pago_por: string | null;
  status: Lancamento["status"];
}

interface LinhaRegra {
  id: string;
  termo: string;
  categoria_id: string;
}

const COLUNAS_REGRA = "id, termo, categoria_id";

function paraRegra(linha: LinhaRegra): Regra {
  return { id: linha.id, termo: linha.termo, categoriaId: linha.categoria_id };
}

const COLUNAS_LANCAMENTO =
  "id, tipo, valor_centavos, data, descricao, categoria_id, conta_id, pago_por, status";

const COLUNA: Record<keyof NovoLancamento, keyof LinhaLancamento> = {
  tipo: "tipo",
  valorCentavos: "valor_centavos",
  data: "data",
  descricao: "descricao",
  categoriaId: "categoria_id",
  contaId: "conta_id",
  pagoPor: "pago_por",
  status: "status",
};

function paraLancamento(linha: LinhaLancamento): Lancamento {
  return {
    id: linha.id,
    tipo: linha.tipo,
    valorCentavos: Number(linha.valor_centavos),
    data: linha.data,
    descricao: linha.descricao,
    categoriaId: linha.categoria_id,
    contaId: linha.conta_id,
    pagoPor: linha.pago_por,
    status: linha.status,
  };
}

// Códigos do Postgres e do PostgREST, traduzidos para o que a tela sabe tratar.
const DADO_INVALIDO = new Set([
  "23502", // faltou campo obrigatório
  "23503", // FK composta: aponta para algo que não é desta família
  "23505", // repetido (ex.: dois convites para o mesmo e-mail)
  "23514", // check da tabela
  "22P02", // texto onde se esperava uuid ou número
  "22003", // número fora da faixa
  "22007", // data mal formada
  "22008", // data que não existe
]);
const SEM_PERMISSAO = new Set(["42501", "PGRST301", "PGRST302", "PGRST303"]);

const MENSAGEM: Record<CodigoErro, string> = {
  invalido: "O banco recusou os dados: confira o lançamento.",
  nao_encontrado: "Lançamento não encontrado.",
  sem_permissao: "Você não tem permissão para isso.",
  indisponivel: "Não deu para falar com o servidor. Tente de novo.",
};

/** O erro do banco vira um código; o original fica em `cause`, fora da tela. */
function traduzir(erro: { code?: string; message: string }): ErroRepositorio {
  const codigo: CodigoErro = DADO_INVALIDO.has(erro.code ?? "")
    ? "invalido"
    : SEM_PERMISSAO.has(erro.code ?? "")
      ? "sem_permissao"
      : "indisponivel";
  return new ErroRepositorio(codigo, MENSAGEM[codigo], { cause: erro });
}

function naoEncontrado(oQue = "Lançamento"): ErroRepositorio {
  return new ErroRepositorio("nao_encontrado", `${oQue} não encontrado.`);
}

function exigirAdmin(eu: Membro): void {
  if (eu.papel !== "admin") {
    throw new ErroRepositorio("sem_permissao", "Só o admin da família faz isso.");
  }
}

/** Um id que nem tem forma de uuid não existe — igual à demo, sem ir ao banco. */
const FORMA_DE_UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

interface Contexto {
  familia: Familia;
  eu: Membro;
}

/**
 * A versão da família: os dados moram no Supabase e quem garante as regras é o
 * banco (RLS, FKs compostas, checks). A validação daqui só adianta o erro.
 *
 * Toda consulta filtra pela família de quem está logado. O RLS já impediria
 * ver outra família; o filtro deixa a intenção explícita e usa o índice.
 */
export class RepositorioSupabase implements Repositorio {
  private contextoEmUso: Promise<Contexto> | null = null;
  private usuarioDoContexto: string | null = null;

  constructor(private readonly cliente: SupabaseClient) {
    // Saiu ou trocou de conta: a família e o membro guardados são de outra pessoa.
    cliente.auth.onAuthStateChange((_evento, sessao) => {
      if ((sessao?.user.id ?? null) !== this.usuarioDoContexto) this.contextoEmUso = null;
    });
  }

  async familia(): Promise<Familia> {
    return { ...(await this.contexto()).familia };
  }

  async euMesmo(): Promise<Membro> {
    return { ...(await this.contexto()).eu };
  }

  async membros(): Promise<Membro[]> {
    const linhas = await this.listar<LinhaMembro>("membros", "id, familia_id, apelido, papel");
    return ordenarPor(
      linhas.map(({ id, apelido, papel }) => ({ id, apelido, papel })),
      (membro) => membro.apelido,
    );
  }

  async categorias(): Promise<Categoria[]> {
    const linhas = await this.listar<Categoria>("categorias", "id, nome, icone, tipo");
    return ordenarPor(linhas, (categoria) => categoria.nome);
  }

  async contas(): Promise<Conta[]> {
    const linhas = await this.listar<LinhaConta>(
      "contas",
      "id, nome, tipo, dono_id, dia_fechamento, dia_vencimento",
    );
    return ordenarPor(
      linhas.map((linha) => ({
        id: linha.id,
        nome: linha.nome,
        tipo: linha.tipo,
        donoId: linha.dono_id,
        diaFechamento: linha.dia_fechamento,
        diaVencimento: linha.dia_vencimento,
      })),
      (conta) => conta.nome,
    );
  }

  async lancamentosDoMes(mes: string): Promise<Lancamento[]> {
    const { inicio, fimExclusivo } = limitesDoMes(mes);
    const { familia } = await this.contexto();
    const { data, error } = await this.cliente
      .from("lancamentos")
      .select(COLUNAS_LANCAMENTO)
      .eq("familia_id", familia.id)
      .gte("data", inicio)
      .lt("data", fimExclusivo)
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false });
    if (error) throw traduzir(error);
    return (data as LinhaLancamento[]).map(paraLancamento);
  }

  async criarLancamento(novo: NovoLancamento): Promise<Lancamento> {
    const dados = validarNovoLancamento(novo);
    const { familia, eu } = await this.contexto();
    const { data, error } = await this.cliente
      .from("lancamentos")
      .insert({
        familia_id: familia.id,
        tipo: dados.tipo,
        valor_centavos: dados.valorCentavos,
        data: dados.data,
        descricao: dados.descricao,
        categoria_id: dados.categoriaId,
        conta_id: dados.contaId ?? null,
        pago_por: dados.pagoPor === undefined ? eu.id : dados.pagoPor,
        status: dados.status ?? "pago",
        // criado_por fica com o banco: o default é auth.uid(), e o RLS confere
      })
      .select(COLUNAS_LANCAMENTO)
      .single();
    if (error) throw traduzir(error);
    return paraLancamento(data as LinhaLancamento);
  }

  async alterarLancamento(id: string, mudancas: AlteracaoLancamento): Promise<Lancamento> {
    const dados = validarAlteracaoLancamento(mudancas);
    if (!FORMA_DE_UUID.test(id)) throw naoEncontrado();

    const colunas = Object.fromEntries(
      Object.entries(dados)
        .filter(([, valor]) => valor !== undefined)
        .map(([campo, valor]) => [COLUNA[campo as keyof NovoLancamento], valor]),
    );
    const { familia } = await this.contexto();
    const tabela = this.cliente.from("lancamentos");
    const consulta =
      Object.keys(colunas).length === 0
        ? tabela.select(COLUNAS_LANCAMENTO)
        : tabela.update(colunas).select(COLUNAS_LANCAMENTO);
    const { data, error } = await consulta
      .eq("id", id)
      .eq("familia_id", familia.id)
      .maybeSingle();
    if (error) throw traduzir(error);
    if (!data) throw naoEncontrado();
    return paraLancamento(data as LinhaLancamento);
  }

  async excluirLancamento(id: string): Promise<void> {
    if (!FORMA_DE_UUID.test(id)) throw naoEncontrado();
    const { familia } = await this.contexto();
    const { data, error } = await this.cliente
      .from("lancamentos")
      .delete()
      .eq("id", id)
      .eq("familia_id", familia.id)
      .select("id");
    if (error) throw traduzir(error);
    if (data.length === 0) throw naoEncontrado();
  }

  async convites(): Promise<Convite[]> {
    // Para quem não é admin, o RLS devolve a lista vazia
    const linhas = await this.listar<Convite>("convites", "id, email, apelido, papel");
    return ordenarPor(linhas, (convite) => convite.apelido);
  }

  async convidar(novo: NovoConvite): Promise<Convite> {
    const dados = validarNovoConvite(novo);
    const { familia, eu } = await this.contexto();
    exigirAdmin(eu);
    // Se a pessoa já tem conta, o banco transforma o convite em membro na hora
    const { data, error } = await this.cliente
      .from("convites")
      .insert({
        familia_id: familia.id,
        email: dados.email,
        apelido: dados.apelido,
        papel: dados.papel ?? "membro",
      })
      .select("id, email, apelido, papel")
      .single();
    if (error?.code === "23505") {
      throw new ErroRepositorio("invalido", "Já existe um convite para esse e-mail.", { cause: error });
    }
    if (error) throw traduzir(error);
    return data as Convite;
  }

  async cancelarConvite(id: string): Promise<void> {
    const { familia, eu } = await this.contexto();
    exigirAdmin(eu);
    if (!FORMA_DE_UUID.test(id)) throw naoEncontrado("Convite");
    const { data, error } = await this.cliente
      .from("convites")
      .delete()
      .eq("id", id)
      .eq("familia_id", familia.id)
      .select("id");
    if (error) throw traduzir(error);
    if (data.length === 0) throw naoEncontrado("Convite");
  }

  async removerMembro(id: string): Promise<void> {
    const { familia, eu } = await this.contexto();
    exigirAdmin(eu);
    if (id === eu.id) throw new ErroRepositorio("invalido", "Você não pode remover a si mesmo.");
    if (!FORMA_DE_UUID.test(id)) throw naoEncontrado("Membro");
    // Os lançamentos ficam: o banco põe "quem pagou" como nulo (on delete set null)
    const { data, error } = await this.cliente
      .from("membros")
      .delete()
      .eq("id", id)
      .eq("familia_id", familia.id)
      .select("id");
    if (error) throw traduzir(error);
    if (data.length === 0) throw naoEncontrado("Membro");
  }

  async regras(): Promise<Regra[]> {
    const linhas = await this.listar<LinhaRegra>("regras", COLUNAS_REGRA);
    return ordenarPor(linhas.map(paraRegra), (regra) => regra.termo);
  }

  async salvarRegra(termo: string, categoriaId: string): Promise<Regra> {
    const dados = validarRegra(termo, categoriaId);
    const { familia } = await this.contexto();
    const tabela = () => this.cliente.from("regras");

    // Já existe? Troca a categoria. Senão, cria. (Dois em paralelo criando o
    // mesmo termo: o segundo esbarra no unique e cai na troca.)
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const trocada = await tabela()
        .update({ categoria_id: dados.categoriaId })
        .eq("familia_id", familia.id)
        .eq("termo", dados.termo)
        .select(COLUNAS_REGRA);
      if (trocada.error) throw traduzir(trocada.error);
      if (trocada.data.length > 0) return paraRegra(trocada.data[0] as LinhaRegra);

      const criada = await tabela()
        .insert({ familia_id: familia.id, termo: dados.termo, categoria_id: dados.categoriaId })
        .select(COLUNAS_REGRA)
        .single();
      if (!criada.error) return paraRegra(criada.data as LinhaRegra);
      if (criada.error.code !== "23505") throw traduzir(criada.error);
    }
    throw new ErroRepositorio("indisponivel", MENSAGEM.indisponivel);
  }

  private async listar<T>(tabela: string, colunas: string): Promise<T[]> {
    const { familia } = await this.contexto();
    const { data, error } = await this.cliente
      .from(tabela)
      .select(colunas)
      .eq("familia_id", familia.id);
    if (error) throw traduzir(error);
    return data as T[];
  }

  /** Quem está logado e de que família: buscado uma vez, guardado até trocar de conta. */
  private contexto(): Promise<Contexto> {
    this.contextoEmUso ??= this.carregarContexto().catch((erro: unknown) => {
      this.contextoEmUso = null; // falhou: a próxima chamada tenta de novo
      throw erro;
    });
    return this.contextoEmUso;
  }

  private async carregarContexto(): Promise<Contexto> {
    const { data: usuario, error: erroLogin } = await this.cliente.auth.getUser();
    if (erroLogin && isAuthRetryableFetchError(erroLogin)) {
      throw new ErroRepositorio("indisponivel", MENSAGEM.indisponivel, { cause: erroLogin });
    }
    if (!usuario.user) {
      throw new ErroRepositorio("sem_permissao", "Entre na sua conta para continuar.", {
        cause: erroLogin,
      });
    }
    const usuarioId = usuario.user.id;

    // Caixa único: uma família por pessoa. Se um dia houver mais, vale a primeira.
    const membro = await this.cliente
      .from("membros")
      .select("id, familia_id, apelido, papel")
      .eq("user_id", usuarioId)
      .order("criado_em")
      .limit(1)
      .maybeSingle();
    if (membro.error) throw traduzir(membro.error);
    if (!membro.data) {
      throw new ErroRepositorio("sem_permissao", "Você ainda não faz parte de uma família.");
    }
    const eu = membro.data as LinhaMembro;

    const familia = await this.cliente
      .from("familias")
      .select("id, nome")
      .eq("id", eu.familia_id)
      .single();
    if (familia.error) throw traduzir(familia.error);

    this.usuarioDoContexto = usuarioId;
    return {
      familia: familia.data as Familia,
      eu: { id: eu.id, apelido: eu.apelido, papel: eu.papel },
    };
  }
}
