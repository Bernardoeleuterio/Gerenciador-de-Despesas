/**
 * As 12 categorias com que toda família nasce (decididas na Etapa 1).
 *
 * No banco, quem cria é um trigger da migração; na demo, é esta lista. Um teste
 * do banco compara as duas, para que não se separem.
 */
export const CATEGORIAS_PADRAO = [
  { nome: "Mercado", icone: "🛒" },
  { nome: "Delivery e restaurantes", icone: "🍔" },
  { nome: "Transporte", icone: "🚗" },
  { nome: "Moradia", icone: "🏠" },
  { nome: "Contas da casa", icone: "💡" },
  { nome: "Saúde", icone: "💊" },
  { nome: "Educação", icone: "📚" },
  { nome: "Lazer", icone: "🎬" },
  { nome: "Assinaturas", icone: "📺" },
  { nome: "Pets", icone: "🐾" },
  { nome: "Compras e cuidados", icone: "🛍️" },
  { nome: "Outros", icone: "📦" },
] as const;
