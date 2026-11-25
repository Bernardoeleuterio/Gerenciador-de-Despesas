"use client";

import { useEffect } from "react";

export interface Aviso {
  /** Muda a cada aviso: reinicia os 5 segundos. */
  chave: string;
  texto: string;
  /** O lançamento que dá para desfazer, se for o caso. */
  desfazer?: string;
}

const DURACAO = 5_000;

/** "Gasto salvo. Desfazer" — some sozinho em 5 segundos. */
export function AvisoDesfazer(props: {
  aviso: Aviso | null;
  onDesfazer: (id: string) => void;
  onSumir: () => void;
}) {
  const { aviso, onDesfazer, onSumir } = props;

  useEffect(() => {
    if (!aviso) return;
    const relogio = window.setTimeout(onSumir, DURACAO);
    return () => window.clearTimeout(relogio);
  }, [aviso, onSumir]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none flex justify-center px-4">
      {aviso && (
        <div className="pointer-events-auto flex items-center gap-4 rounded-full bg-zinc-900 py-2 pr-2 pl-5 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          <span>{aviso.texto}</span>
          {aviso.desfazer && (
            <button
              type="button"
              className="rounded-full px-3 py-1.5 font-medium text-emerald-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white dark:text-emerald-700 dark:hover:bg-zinc-900/10"
              onClick={() => onDesfazer(aviso.desfazer!)}
            >
              Desfazer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
