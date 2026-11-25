import type { NovoLancamento, TipoLancamento } from "@/lib/dados/repositorio";
import { normalizarTermo } from "@/lib/dados/validacao";
import { interpretar, type Catalogo, type Interpretacao, type ValorPossivel } from "./interpretar";

/** O que a pessoa escolheu tocando nos chips: vale mais que o texto. */
export interface Escolhas {
  valorCentavos?: number;
  categoriaId?: string;
  data?: string;
  /** Nulo de propósito: "sem conta". */
  contaId?: string | null;
  /** Nulo de propósito: "ninguém em especial". */
  pagoPor?: string | null;
  /** Aceitou salvar a compra parcelada de uma vez só, à vista. */
  aVista?: boolean;
}

/** O que vale quando nem o texto nem os chips dizem. */
export interface Padroes {
  /** Quem está lançando: é quem pagou, se nada disser outra coisa. */
  euId: string;
  /** A última conta usada neste aparelho. */
  contaPadraoId: string | null;
}

/** Por que ainda não dá para salvar. */
export type Bloqueio =
  | "vazio"
  | "sem-valor"
  | "valor-ambiguo"
  | "receita"
  | "parcelado"
  | "sem-categoria";

export interface Previa {
  interpretacao: Interpretacao;
  tipo: TipoLancamento;
  valorCentavos: number | null;
  valoresPossiveis: ValorPossivel[];
  descricao: string;
  data: string;
  categoriaId: string | null;
  /** De onde veio a categoria; nulo quando é o "Outros" de quando nada casou. */
  categoriaPor: "regra" | "palavra-chave" | "escolha" | null;
  contaId: string | null;
  /** Quando o texto disse "cartão" e a família tem mais de um. */
  contasPossiveis: string[];
  pagoPor: string | null;
  parcelas: number;
  bloqueio: Bloqueio | null;
  /** Pronto para salvar — só quando não há bloqueio. */
  novo: NovoLancamento | null;
}

const LIMITE_DA_DESCRICAO = 120;

/**
 * Junta o que o texto diz (o parser), o que a pessoa escolheu nos chips e os
 * padrões (quem lança pagou; a última conta usada) na prévia que a tela
 * mostra — e no lançamento pronto para salvar. Função pura.
 */
export function montarPrevia(
  texto: string,
  hoje: string,
  catalogo: Catalogo,
  padroes: Padroes,
  escolhas: Escolhas = {},
): Previa {
  const lido = interpretar(texto, hoje, catalogo);

  const valorCentavos = escolhas.valorCentavos ?? lido.valorCentavos;
  // Escolheu um dos candidatos ("2 pizzas 80" → 80): a descrição é a dele
  const candidato = lido.valoresPossiveis.find((v) => v.valorCentavos === escolhas.valorCentavos);
  const descricao = candidato?.descricao ?? lido.descricao;

  const outros = catalogo.categorias.find((c) => c.tipo === lido.tipo && c.nome === "Outros");
  const categoriaId = escolhas.categoriaId ?? lido.categoriaId ?? outros?.id ?? null;
  const categoriaPor = escolhas.categoriaId ? "escolha" : lido.categoriaPor;

  const contaEscolhida = escolhas.contaId !== undefined;
  const contaId = contaEscolhida
    ? escolhas.contaId!
    : (lido.contaId ?? (lido.contasPossiveis.length > 0 ? null : padroes.contaPadraoId));
  const contasPossiveis = contaEscolhida ? [] : lido.contasPossiveis;
  const pagoPor = escolhas.pagoPor !== undefined ? escolhas.pagoPor : padroes.euId;
  const data = escolhas.data ?? lido.data;

  const bloqueio: Bloqueio | null =
    texto.trim() === ""
      ? "vazio"
      : lido.tipo === "receita"
        ? "receita"
        : valorCentavos === null
          ? lido.valoresPossiveis.length > 1
            ? "valor-ambiguo"
            : "sem-valor"
          : lido.parcelas > 1 && !escolhas.aVista
            ? "parcelado"
            : categoriaId === null
              ? "sem-categoria"
              : null;

  const nomeDaCategoria = catalogo.categorias.find((c) => c.id === categoriaId)?.nome ?? "";
  const novo: NovoLancamento | null =
    bloqueio === null
      ? {
          tipo: "despesa",
          valorCentavos: valorCentavos!,
          data,
          // Sem descrição ("50 pix"), vale o nome da categoria
          descricao: (descricao || nomeDaCategoria).slice(0, LIMITE_DA_DESCRICAO),
          categoriaId: categoriaId!,
          contaId,
          pagoPor,
        }
      : null;

  return {
    interpretacao: lido,
    tipo: lido.tipo,
    valorCentavos,
    valoresPossiveis: lido.valoresPossiveis,
    descricao,
    data,
    categoriaId,
    categoriaPor,
    contaId,
    contasPossiveis,
    pagoPor,
    parcelas: lido.parcelas,
    bloqueio,
    novo,
  };
}

/**
 * O termo da regra que a tela oferece quando a pessoa troca a categoria:
 * a descrição, normalizada. Nulo quando não há o que ensinar.
 */
export function termoParaRegra(previa: Previa): string | null {
  const termo = normalizarTermo(previa.descricao);
  return termo.length > 0 && termo.length <= 60 ? termo : null;
}
