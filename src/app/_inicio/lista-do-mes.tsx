import type { Categoria, Lancamento } from "@/lib/dados";
import { formatarReais, nomeDoDia } from "@/lib/formato";

/** Os gastos do mês, do mais recente para o mais antigo. */
export function ListaDoMes(props: {
  lancamentos: Lancamento[];
  categorias: Categoria[];
  hoje: string;
  /** O que acabou de ser salvo: aparece destacado por um instante. */
  recente: string | null;
}) {
  const { lancamentos, categorias, hoje, recente } = props;
  const categoria = new Map(categorias.map((c) => [c.id, c]));

  if (lancamentos.length === 0) {
    return (
      <p className="py-10 text-zinc-500">
        Nenhum gasto ainda neste mês. Escreva no campo lá embaixo, por exemplo{" "}
        <span className="whitespace-nowrap font-medium text-zinc-700 dark:text-zinc-300">50 mercado</span>, e
        aperte Enter.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {lancamentos.map((lancamento) => {
        const daCategoria = categoria.get(lancamento.categoriaId);
        return (
          <li
            key={lancamento.id}
            className={`flex items-center gap-3 py-3 transition-colors duration-700 ${
              lancamento.id === recente ? "bg-emerald-50 dark:bg-emerald-950/40" : ""
            }`}
          >
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg dark:bg-zinc-800"
            >
              {daCategoria?.icone ?? "📦"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate">{lancamento.descricao}</p>
              <p className="truncate text-sm text-zinc-500">{daCategoria?.nome ?? "Sem categoria"}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold tabular-nums">{formatarReais(lancamento.valorCentavos)}</p>
              <p className="text-sm text-zinc-500">{nomeDoDia(lancamento.data, hoje)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
