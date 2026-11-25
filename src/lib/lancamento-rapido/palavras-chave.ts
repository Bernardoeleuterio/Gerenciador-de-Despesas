import type { CATEGORIAS_PADRAO } from "@/lib/dados/categorias-padrao";

type NomeDaCategoria = (typeof CATEGORIAS_PADRAO)[number]["nome"];

/**
 * Palavras que apontam a categoria, a partir da tabela do planejamento. Vale a
 * que aparece primeiro no texto; na mesma posição, a mais comprida ("mercado
 * livre" ganha de "mercado"). O plural simples já conta ("pizzas", "exames").
 *
 * As regras que a família ensina ao corrigir uma categoria passam na frente
 * destas. "Outros" não tem palavra: é quando nada casa, e a tela pergunta.
 */
export const PALAVRAS_CHAVE: Record<Exclude<NomeDaCategoria, "Outros">, readonly string[]> = {
  Mercado: [
    "mercado", "supermercado", "feira", "padaria", "açougue", "hortifruti", "sacolão",
    "quitanda", "atacadão", "assaí", "carrefour", "pão de açúcar", "pão", "pães",
  ],
  "Delivery e restaurantes": [
    "ifood", "rappi", "delivery", "lanche", "lanchonete", "pizza", "pizzaria", "restaurante",
    "almoço", "jantar", "marmita", "marmitex", "hambúrguer", "hamburguer", "mcdonalds",
    "mc donalds", "burger king", "sushi", "açaí",
  ],
  Transporte: [
    "uber", "táxi", "ônibus", "metrô", "trem", "posto", "gasolina", "etanol", "combustível",
    "estacionamento", "pedágio", "sem parar", "oficina", "mecânico", "ipva",
  ],
  Moradia: [
    "aluguel", "condomínio", "iptu", "manutenção", "reforma", "material de construção",
    "encanador", "eletricista", "diarista", "faxina",
  ],
  "Contas da casa": [
    "luz", "energia", "água", "gás", "botijão", "internet", "celular", "telefone",
  ],
  Saúde: [
    "farmácia", "drogaria", "remédio", "consulta", "exame", "dentista", "médico", "hospital",
    "plano de saúde", "academia", "psicólogo", "terapia",
  ],
  Educação: ["escola", "faculdade", "curso", "livro", "material", "mensalidade", "apostila"],
  Lazer: [
    "cinema", "show", "passeio", "viagem", "bar", "teatro", "ingresso", "parque", "festa",
    "hotel", "pousada",
  ],
  Assinaturas: [
    "netflix", "spotify", "prime", "amazon prime", "disney", "youtube", "icloud", "hbo",
    "globoplay", "deezer", "assinatura",
  ],
  Pets: ["ração", "pet shop", "petshop", "veterinário", "veterinária", "banho e tosa"],
  "Compras e cuidados": [
    "roupa", "sapato", "tênis", "cabelo", "barbeiro", "salão", "manicure", "presente",
    "perfume", "maquiagem", "shopee", "shein", "mercado livre", "amazon",
  ],
};
