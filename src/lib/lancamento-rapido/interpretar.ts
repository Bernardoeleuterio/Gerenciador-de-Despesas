import type { Categoria, Conta, TipoLancamento } from "@/lib/dados/repositorio";
import { ultimaData, ultimoDiaDaSemana, ultimoDiaDoMes, somarDias } from "./datas";
import { PALAVRAS_CHAVE } from "./palavras-chave";
import { casaPalavra, normalizar, pedaco, quebrar, type Pedaco } from "./texto";
import { lerNumero, valorValido } from "./valor";

/** Uma regra que a família ensinou: quando o texto tem o termo, a categoria é esta. */
export interface RegraDeCategoria {
  termo: string;
  categoriaId: string;
}

/** O que o parser precisa saber da família para reconhecer contas e categorias. */
export interface Catalogo {
  categorias: readonly Pick<Categoria, "id" | "nome" | "tipo">[];
  contas: readonly Pick<Conta, "id" | "nome" | "tipo">[];
  regras: readonly RegraDeCategoria[];
}

export interface ValorPossivel {
  valorCentavos: number;
  /** A descrição se este for o valor (os outros números ficam nela). */
  descricao: string;
}

export interface Interpretacao {
  tipo: TipoLancamento;
  /** Nulo quando não há valor, ou há mais de um candidato: a tela pede, não chuta. */
  valorCentavos: number | null;
  /** Os candidatos, quando há mais de um número e nada indica qual é o valor. */
  valoresPossiveis: ValorPossivel[];
  /** O que sobrou do texto: sem valor, data, conta e parcelas. Pode vir vazia. */
  descricao: string;
  /** AAAA-MM-DD; sem data no texto, é hoje. */
  data: string;
  /** Nula quando nada casou: a tela sugere "Outros" e pergunta. */
  categoriaId: string | null;
  categoriaPor: "regra" | "palavra-chave" | null;
  /** Nula quando o texto não cita conta: a tela usa a padrão de quem lança. */
  contaId: string | null;
  /** Quando o texto aponta um tipo de conta que a família tem mais de uma ("cartão"). */
  contasPossiveis: string[];
  /** 1 = à vista. */
  parcelas: number;
}

/**
 * Transforma o texto do lançamento rápido ("50 ifood ontem pix") num
 * lançamento: valor, descrição, data, categoria, conta e parcelas. Função
 * pura, sem banco e sem tela — roda igual nos dois modos e no teste.
 *
 * `hoje` é AAAA-MM-DD, no fuso de São Paulo (ver `hojeEmSaoPaulo`).
 */
export function interpretar(texto: string, hoje: string, catalogo: Catalogo): Interpretacao {
  const pedacos = quebrar(texto);
  const usados = new Set<number>();

  const tipo = lerSinal(pedacos, usados);
  const data = lerData(pedacos, usados, hoje) ?? hoje;
  const parcelamento = lerParcelas(pedacos, usados);
  const parcelas = parcelamento?.quantas ?? 1;
  const conta = lerConta(pedacos, usados, catalogo.contas);

  const candidatos = lerValores(pedacos, usados);
  // "10x de 89,90": o valor é de cada parcela, e o total é a soma delas
  const dePorParcela = parcelamento && pedacos[parcelamento.fim + 1]?.normal === "de";
  const porParcela = dePorParcela
    ? candidatos.find((candidato) => candidato.indices[0] === parcelamento.fim + 2)
    : undefined;
  if (porParcela && valorValido(porParcela.centavos * parcelas)) {
    porParcela.centavos *= parcelas;
    porParcela.indices.unshift(parcelamento!.fim + 1);
    porParcela.marcado = true;
  }
  const escolhido = escolherValor(candidatos);
  const ambiguo = escolhido === null && candidatos.length > 1;

  const descricaoCom = (candidato: CandidatoAValor | null) => {
    const ocupados = new Set(usados);
    for (const indice of candidato?.indices ?? []) ocupados.add(indice);
    return descrever(pedacos, ocupados);
  };
  const descricao = descricaoCom(escolhido);
  // A categoria olha só as palavras, nunca os números
  const semNumeros = new Set(usados);
  for (const candidato of candidatos) for (const indice of candidato.indices) semNumeros.add(indice);
  const categoria = lerCategoria(descrever(pedacos, semNumeros), tipo, catalogo);

  return {
    tipo,
    valorCentavos: escolhido?.centavos ?? null,
    valoresPossiveis: ambiguo
      ? candidatos.map((candidato) => ({
          valorCentavos: candidato.centavos,
          descricao: descricaoCom(candidato),
        }))
      : [],
    descricao,
    data,
    categoriaId: categoria?.id ?? null,
    categoriaPor: categoria?.por ?? null,
    contaId: conta.id,
    contasPossiveis: conta.possiveis,
    parcelas,
  };
}

// ----------------------------------------------------------------------------
// Receita: "+" no começo
// ----------------------------------------------------------------------------

function lerSinal(pedacos: Pedaco[], usados: Set<number>): TipoLancamento {
  const primeiro = pedacos[0];
  if (!primeiro?.original.startsWith("+")) return "despesa";
  const resto = primeiro.original.slice(1);
  if (resto) pedacos[0] = pedaco(resto);
  else usados.add(0);
  return "receita";
}

// ----------------------------------------------------------------------------
// Data: hoje, ontem, anteontem, "dia 12", "12/11", "sexta"
// ----------------------------------------------------------------------------

const DIAS_DA_SEMANA: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

const DIA_E_MES = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/;

function lerDiaEMes(texto: string, hoje: string): string | null {
  const partes = DIA_E_MES.exec(texto);
  if (!partes) return null;
  const [, dia, mes, ano] = partes;
  return ultimaData(hoje, Number(dia), Number(mes), ano === undefined ? undefined : Number(ano));
}

function lerData(pedacos: Pedaco[], usados: Set<number>, hoje: string): string | null {
  const palavra = (indice: number) => (usados.has(indice) ? undefined : pedacos[indice]?.normal);

  for (let i = 0; i < pedacos.length; i++) {
    const atual = palavra(i);
    if (atual === undefined) continue;
    let achou: { data: string | null; ocupa: number } | null = null;

    if (atual === "hoje") achou = { data: hoje, ocupa: 1 };
    else if (atual === "ontem") achou = { data: somarDias(hoje, -1), ocupa: 1 };
    else if (atual === "anteontem") achou = { data: somarDias(hoje, -2), ocupa: 1 };
    else if (atual === "antes" && palavra(i + 1) === "de" && palavra(i + 2) === "ontem") {
      achou = { data: somarDias(hoje, -2), ocupa: 3 };
    } else if (atual === "dia" && palavra(i + 1) !== undefined) {
      const seguinte = palavra(i + 1)!;
      const data = /^\d{1,2}$/.test(seguinte)
        ? ultimoDiaDoMes(hoje, Number(seguinte))
        : lerDiaEMes(seguinte, hoje);
      if (data) achou = { data, ocupa: 2 };
    } else if (DIA_E_MES.test(atual)) {
      const data = lerDiaEMes(atual, hoje);
      if (data) achou = { data, ocupa: 1 };
    } else {
      // "sexta", "sexta-feira", "sexta feira", "sexta passada" (sábado e
      // domingo não têm "feira": em "domingo feira 85", a feira é o gasto)
      const [nome, sufixo] = atual.split("-");
      const alvo = DIAS_DA_SEMANA[nome];
      const temFeira = alvo >= 1 && alvo <= 5;
      if (alvo !== undefined && (sufixo === undefined || (sufixo === "feira" && temFeira))) {
        let ocupa = 1;
        if (sufixo === undefined && temFeira && palavra(i + 1) === "feira") ocupa += 1;
        const passada = ["passada", "passado"].includes(palavra(i + ocupa) ?? "");
        if (passada) ocupa += 1;
        achou = { data: ultimoDiaDaSemana(hoje, alvo, !passada), ocupa };
      }
    }

    if (achou?.data) {
      for (let j = 0; j < achou.ocupa; j++) usados.add(i + j);
      return achou.data;
    }
  }
  return null;
}

// ----------------------------------------------------------------------------
// Parcelas: "10x", "10 x", "em 10x", "10 vezes"
// ----------------------------------------------------------------------------

const MAXIMO_DE_PARCELAS = 48; // o mesmo limite do banco

function lerParcelas(pedacos: Pedaco[], usados: Set<number>): { quantas: number; fim: number } | null {
  const palavra = (indice: number) => (usados.has(indice) ? undefined : pedacos[indice]?.normal);

  for (let i = 0; i < pedacos.length; i++) {
    const atual = palavra(i);
    if (atual === undefined) continue;
    let achou: { quantas: number; ocupa: number } | null = null;

    const colado = /^(\d{1,2})x$/.exec(atual);
    if (colado) achou = { quantas: Number(colado[1]), ocupa: 1 };
    else if (/^\d{1,2}$/.test(atual) && ["x", "vezes"].includes(palavra(i + 1) ?? "")) {
      achou = { quantas: Number(atual), ocupa: 2 };
    }

    if (achou && achou.quantas >= 1 && achou.quantas <= MAXIMO_DE_PARCELAS) {
      for (let j = 0; j < achou.ocupa; j++) usados.add(i + j);
      // "em 10x": o "em" vai junto
      if (i > 0 && palavra(i - 1) === "em") usados.add(i - 1);
      return { quantas: achou.quantas, fim: i + achou.ocupa - 1 };
    }
  }
  return null;
}

// ----------------------------------------------------------------------------
// Valor: "50", "50,90", "R$ 50", "2.500", "1.250,00", "50 reais", "3 mil"
// ----------------------------------------------------------------------------

const MOEDA = new Set(["reais", "real", "conto", "contos", "pila", "pilas"]);

interface CandidatoAValor {
  centavos: number;
  indices: number[];
  /** Tem "R$" ou "reais": é dinheiro com certeza. */
  marcado: boolean;
  /** Tem vírgula ou ponto: cara de dinheiro. */
  formatado: boolean;
}

function lerValores(pedacos: Pedaco[], usados: Set<number>): CandidatoAValor[] {
  const palavra = (indice: number) => (usados.has(indice) ? undefined : pedacos[indice]?.normal);
  const candidatos: CandidatoAValor[] = [];

  for (let i = 0; i < pedacos.length; i++) {
    const atual = palavra(i);
    if (atual === undefined) continue;

    // "R$ 50", "R$50"
    let indices = [i];
    let marcado = false;
    let texto = atual;
    if (atual === "r$" && palavra(i + 1) !== undefined) {
      indices = [i, i + 1];
      texto = palavra(i + 1)!;
      marcado = true;
    } else if (atual.startsWith("r$")) {
      texto = atual.slice(2);
      marcado = true;
    }

    const numero = lerNumero(texto);
    if (!numero) continue;
    let centavos = numero.centavos;

    // "3 mil", "1,5 mil"
    let fim = indices[indices.length - 1];
    if (palavra(fim + 1) === "mil") {
      centavos *= 1000;
      fim += 1;
      indices.push(fim);
    }
    // "50 reais", "50 conto"
    if (MOEDA.has(palavra(fim + 1) ?? "")) {
      marcado = true;
      fim += 1;
      indices.push(fim);
    }

    if (!valorValido(centavos)) continue;
    candidatos.push({ centavos, indices, marcado, formatado: numero.formatado });
    i = fim;
  }
  return candidatos;
}

/** Um candidato só, ou o único com cara de dinheiro. Senão, ninguém: não chuta. */
function escolherValor(candidatos: CandidatoAValor[]): CandidatoAValor | null {
  if (candidatos.length <= 1) return candidatos[0] ?? null;
  const marcados = candidatos.filter((candidato) => candidato.marcado);
  if (marcados.length === 1) return marcados[0];
  const formatados = (marcados.length > 1 ? marcados : candidatos).filter((c) => c.formatado);
  return formatados.length === 1 ? formatados[0] : null;
}

// ----------------------------------------------------------------------------
// Conta: "pix", "débito", "dinheiro", "cartão", o nome da conta ("nubank")
// ----------------------------------------------------------------------------

const FORMAS: Record<string, Conta["tipo"]> = {
  pix: "conta",
  debito: "conta",
  dinheiro: "dinheiro",
  especie: "dinheiro",
  cartao: "cartao",
  credito: "cartao",
};

/** Palavras que não identificam uma conta sozinhas ("Cartão de crédito", "Pix / débito"). */
const GENERICAS = new Set([...Object.keys(FORMAS), "conta", "corrente", "banco", "de", "do", "da", "e"]);

function palavrasProprias(nome: string): string[] {
  return normalizar(nome)
    .split(/[^a-z0-9]+/)
    .filter((palavra) => palavra.length > 1 && !GENERICAS.has(palavra));
}

function lerConta(
  pedacos: Pedaco[],
  usados: Set<number>,
  contas: Catalogo["contas"],
): { id: string | null; possiveis: string[] } {
  const porPalavra = new Map<string, Set<string>>();
  for (const conta of contas) {
    for (const palavra of palavrasProprias(conta.nome)) {
      porPalavra.set(palavra, (porPalavra.get(palavra) ?? new Set()).add(conta.id));
    }
  }

  const citadas = new Set<string>();
  let forma: { palavra: string; tipo: Conta["tipo"] } | null = null;
  pedacos.forEach((atual, indice) => {
    if (usados.has(indice)) return;
    const pelaPalavra = porPalavra.get(atual.normal);
    if (pelaPalavra?.size === 1) {
      citadas.add([...pelaPalavra][0]);
      usados.add(indice);
    } else if (FORMAS[atual.normal]) {
      forma ??= { palavra: atual.normal, tipo: FORMAS[atual.normal] };
      usados.add(indice);
    }
  });

  if (citadas.size === 1) return { id: [...citadas][0], possiveis: [] };
  if (citadas.size > 1) return { id: null, possiveis: [...citadas] };
  if (!forma) return { id: null, possiveis: [] };

  const { palavra, tipo } = forma;
  const doTipo = contas.filter((conta) => conta.tipo === tipo);
  if (doTipo.length === 1) return { id: doTipo[0].id, possiveis: [] };
  // Várias contas correntes: "pix" vai para a que tem Pix no nome. ("Cartão"
  // não desempata: está no nome de quase todo cartão.)
  if (palavra === "pix" || palavra === "debito") {
    const peloNome = doTipo.filter((conta) => normalizar(conta.nome).split(/[^a-z0-9]+/).includes(palavra));
    if (peloNome.length === 1) return { id: peloNome[0].id, possiveis: [] };
  }
  return { id: null, possiveis: doTipo.map((conta) => conta.id) };
}

// ----------------------------------------------------------------------------
// Descrição: o que sobrou, sem as palavras de ligação das pontas
// ----------------------------------------------------------------------------

const PONTAS = new Set([
  "no", "na", "nos", "nas", "de", "do", "da", "dos", "das", "em", "pro", "pra", "pros", "pras",
  "para", "com", "o", "a", "os", "as", "e", "um", "uma",
  "gastei", "paguei", "comprei", "dei", "deu", "foi",
]);

function descrever(pedacos: Pedaco[], usados: Set<number>): string {
  const sobra = pedacos.filter((_, indice) => !usados.has(indice));
  let inicio = 0;
  let fim = sobra.length;
  while (inicio < fim && PONTAS.has(sobra[inicio].normal)) inicio++;
  while (fim > inicio && PONTAS.has(sobra[fim - 1].normal)) fim--;
  return sobra
    .slice(inicio, fim)
    .map((parte) => parte.original)
    .join(" ");
}

// ----------------------------------------------------------------------------
// Categoria: primeiro as regras da família, depois as palavras-chave
// ----------------------------------------------------------------------------

/** Onde a expressão aparece primeiro nas palavras (ou -1). */
function posicao(palavras: string[], expressao: string[]): number {
  for (let i = 0; i + expressao.length <= palavras.length; i++) {
    if (expressao.every((parte, j) => casaPalavra(palavras[i + j], parte))) return i;
  }
  return -1;
}

/** A que aparece primeiro; na mesma posição, a mais comprida. */
function melhor<T>(achados: { item: T; posicao: number; tamanho: number }[]): T | null {
  achados.sort((a, b) => a.posicao - b.posicao || b.tamanho - a.tamanho);
  return achados[0]?.item ?? null;
}

function lerCategoria(
  descricao: string,
  tipo: TipoLancamento,
  catalogo: Catalogo,
): { id: string; por: "regra" | "palavra-chave" } | null {
  const palavras = normalizar(descricao).split(/[^a-z0-9$]+/).filter(Boolean);
  if (palavras.length === 0) return null;
  const doTipo = new Map(
    catalogo.categorias.filter((categoria) => categoria.tipo === tipo).map((c) => [c.id, c]),
  );

  const achar = (expressao: string) => {
    const partes = normalizar(expressao).split(/[^a-z0-9$]+/).filter(Boolean);
    return { posicao: partes.length ? posicao(palavras, partes) : -1, tamanho: partes.length };
  };

  const pelaRegra = melhor(
    catalogo.regras
      .filter((regra) => doTipo.has(regra.categoriaId))
      .map((regra) => ({ item: regra.categoriaId, ...achar(regra.termo) }))
      .filter((achado) => achado.posicao >= 0),
  );
  if (pelaRegra) return { id: pelaRegra, por: "regra" };

  const porNome = new Map([...doTipo.values()].map((categoria) => [normalizar(categoria.nome), categoria.id]));
  const pelaPalavra = melhor(
    Object.entries(PALAVRAS_CHAVE).flatMap(([nome, expressoes]) => {
      const id = porNome.get(normalizar(nome));
      if (!id) return [];
      return expressoes
        .map((expressao) => ({ item: id, ...achar(expressao) }))
        .filter((achado) => achado.posicao >= 0);
    }),
  );
  return pelaPalavra ? { id: pelaPalavra, por: "palavra-chave" } : null;
}
