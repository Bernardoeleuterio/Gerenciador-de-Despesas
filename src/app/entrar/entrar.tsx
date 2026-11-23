"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { aviso, botaoPrincipal } from "@/componentes/estilos";
import { supabaseDoNavegador } from "@/lib/supabase/navegador";

/** Abre o login do Google; a volta é em /auth/callback. */
export function BotaoGoogle() {
  const [abrindo, setAbrindo] = useState(false);
  const [falhou, setFalhou] = useState(false);

  async function entrar() {
    setAbrindo(true);
    setFalhou(false);
    try {
      const supabase = await supabaseDoNavegador();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // Celular dividido: deixa escolher qual conta Google usar
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
      // Daqui o navegador segue para o Google
    } catch {
      setFalhou(true);
      setAbrindo(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={botaoPrincipal} disabled={abrindo} onClick={entrar}>
        {abrindo ? "Abrindo o Google…" : "Entrar com o Google"}
      </button>
      {falhou && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          Não deu para abrir o login do Google. Tente de novo.
        </p>
      )}
    </div>
  );
}

/** A volta do Google sem sessão (/entrar?erro=1): sem convite, ou a pessoa desistiu. */
export function AvisoDeErro() {
  const erro = useSearchParams().get("erro");
  if (!erro) return null;
  return (
    <p role="alert" className={aviso}>
      Não deu para entrar. O acesso é só por convite: confira se o admin da família convidou esse
      e-mail do Google.
    </p>
  );
}
