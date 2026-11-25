/** De R$ 0,01 a R$ 10 milhões: o mesmo limite do banco. */
export const VALOR_MINIMO = 1;
export const VALOR_MAXIMO = 1_000_000_000;

export interface Numero {
  centavos: number;
  /** Veio com vírgula ou ponto ("50,90", "2.500"): cara de dinheiro. */
  formatado: boolean;
}

// Padrão brasileiro: ponto separa milhar e vírgula separa centavos.
const FORMATOS: { regex: RegExp; milhar: string; decimal: string | null }[] = [
  { regex: /^\d+$/, milhar: "", decimal: null }, // 50
  { regex: /^\d{1,3}(\.\d{3})+$/, milhar: ".", decimal: null }, // 2.500
  { regex: /^\d+,\d{1,2}$/, milhar: "", decimal: "," }, // 50,90
  { regex: /^\d{1,3}(\.\d{3})+,\d{1,2}$/, milhar: ".", decimal: "," }, // 1.250,00
  // Ponto com 1 ou 2 casas não pode ser milhar: é o decimal do teclado americano
  { regex: /^\d+\.\d{1,2}$/, milhar: "", decimal: "." }, // 50.90
  { regex: /^\d{1,3}(,\d{3})+\.\d{1,2}$/, milhar: ",", decimal: "." }, // 1,250.00
];

/**
 * Lê um número escrito como dinheiro e devolve em centavos. O que é ambíguo
 * (como "1,250": mil duzentos e cinquenta ou um e vinte e cinco?) não vira
 * número — melhor perguntar do que chutar.
 */
export function lerNumero(texto: string): Numero | null {
  for (const { regex, milhar, decimal } of FORMATOS) {
    if (!regex.test(texto)) continue;
    const [inteiro, fracao = ""] = decimal ? texto.split(decimal) : [texto];
    const reais = Number(milhar ? inteiro.split(milhar).join("") : inteiro);
    const centavos = reais * 100 + Number(fracao.padEnd(2, "0") || "0");
    return { centavos, formatado: milhar !== "" || decimal !== null };
  }
  return null;
}

/** Está dentro do que o banco aceita? */
export function valorValido(centavos: number): boolean {
  return Number.isSafeInteger(centavos) && centavos >= VALOR_MINIMO && centavos <= VALOR_MAXIMO;
}
