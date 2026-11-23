"use client";

import { useState } from "react";
import { MODO } from "@/lib/modo";
import { sair } from "@/lib/supabase/navegador";
import { botaoDiscreto } from "./estilos";

/** Só no modo família: a demo não tem login. */
export function BotaoSair() {
  const [saindo, setSaindo] = useState(false);
  if (MODO === "demo") return null;

  return (
    <button
      type="button"
      className={botaoDiscreto}
      disabled={saindo}
      onClick={() => {
        setSaindo(true);
        sair().catch(() => setSaindo(false));
      }}
    >
      {saindo ? "Saindo…" : "Sair"}
    </button>
  );
}
