import type { Lancamento } from "@/lib/dados/repositorio";

export interface TotalPorCategoria {
  categoriaId: string;
  totalCentavos: number;
}

export interface TotalPorPessoa {
  /** Nulo quando o lançamento não diz quem pagou. */
  membroId: string | null;
  totalCentavos: number;
}

export interface Resumo {
  /** Despesas já pagas. */
  despesasCentavos: number;
  /** Receitas já recebidas. */
  receitasCentavos: number;
  /** Receitas menos despesas, só do que já aconteceu. */
  saldoCentavos: number;
  /** Despesas previstas (contas fixas ainda não pagas): ficam fora do total. */
  despesasPrevistasCentavos: number;
  /** Despesas pagas por categoria, da maior para a menor. */
  porCategoria: TotalPorCategoria[];
  /** Despesas pagas por pessoa, da maior para a menor. */
  porPessoa: TotalPorPessoa[];
}

/**
 * Os totais saem daqui, calculados na hora a partir dos lançamentos: nada de
 * total guardado, que é o que dessincronizou no Dashboard Financeiro antigo.
 * A mesma função serve à família e à demo.
 */
export function resumir(lancamentos: readonly Lancamento[]): Resumo {
  let despesasCentavos = 0;
  let receitasCentavos = 0;
  let despesasPrevistasCentavos = 0;
  const porCategoria = new Map<string, number>();
  const porPessoa = new Map<string | null, number>();

  for (const lancamento of lancamentos) {
    const valor = lancamento.valorCentavos;

    if (lancamento.status === "previsto") {
      if (lancamento.tipo === "despesa") despesasPrevistasCentavos += valor;
      continue;
    }

    if (lancamento.tipo === "receita") {
      receitasCentavos += valor;
      continue;
    }

    despesasCentavos += valor;
    porCategoria.set(lancamento.categoriaId, (porCategoria.get(lancamento.categoriaId) ?? 0) + valor);
    porPessoa.set(lancamento.pagoPor, (porPessoa.get(lancamento.pagoPor) ?? 0) + valor);
  }

  return {
    despesasCentavos,
    receitasCentavos,
    saldoCentavos: receitasCentavos - despesasCentavos,
    despesasPrevistasCentavos,
    porCategoria: [...porCategoria]
      .map(([categoriaId, totalCentavos]) => ({ categoriaId, totalCentavos }))
      .sort((a, b) => b.totalCentavos - a.totalCentavos || a.categoriaId.localeCompare(b.categoriaId)),
    porPessoa: [...porPessoa]
      .map(([membroId, totalCentavos]) => ({ membroId, totalCentavos }))
      .sort((a, b) => b.totalCentavos - a.totalCentavos || String(a.membroId).localeCompare(String(b.membroId))),
  };
}
