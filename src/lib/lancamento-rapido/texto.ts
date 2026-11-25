/** Minúsculo e sem acento: é assim que o parser compara palavras ("Farmácia" = "farmacia"). */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export interface Pedaco {
  /** Como a pessoa digitou, sem a pontuação das pontas. */
  original: string;
  /** Minúsculo e sem acento, para comparar. */
  normal: string;
}

export function pedaco(original: string): Pedaco {
  return { original, normal: normalizar(original) };
}

// Pontuação que sobra nas pontas de uma palavra: "ifood," "(pix)" "- 50".
// O "+" do começo fica: ele diz que é receita. O "." do fim sai ("50." → "50").
const PONTA_INICIAL = /^[,;:!?"'()\-–—]+/;
const PONTA_FINAL = /[,;:!?"'().\-–—]+$/;

/** Quebra o texto em palavras, sem a pontuação das pontas. */
export function quebrar(texto: string): Pedaco[] {
  return texto
    .split(/\s+/)
    .map((parte) => parte.replace(PONTA_INICIAL, "").replace(PONTA_FINAL, ""))
    .filter((parte) => parte.length > 0)
    .map(pedaco);
}

/** A palavra casa com a forma de referência, aceitando o plural simples ("pizzas", "lanches"). */
export function casaPalavra(palavra: string, referencia: string): boolean {
  return palavra === referencia || palavra === `${referencia}s` || palavra === `${referencia}es`;
}
