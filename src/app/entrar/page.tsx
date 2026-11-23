import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { botaoPrincipal } from "@/componentes/estilos";
import { SeloDoModo } from "@/componentes/selo-do-modo";
import { MODO } from "@/lib/modo";
import { AvisoDeErro, BotaoGoogle } from "./entrar";

export const metadata: Metadata = { title: "Entrar — Gerenciador de Despesas" };

export default function Entrar() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <SeloDoModo />
      <h1 className="text-3xl font-semibold tracking-tight">Gerenciador de Despesas</h1>

      {MODO === "demo" ? (
        <>
          <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            A demonstração não tem login: os dados são fictícios e ficam só no seu navegador.
          </p>
          <Link href="/" className={`${botaoPrincipal} w-fit`}>
            Abrir a demonstração
          </Link>
        </>
      ) : (
        <>
          <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Entre com a conta Google que o admin da família convidou.
          </p>
          <Suspense fallback={null}>
            <AvisoDeErro />
          </Suspense>
          <BotaoGoogle />
          <p className="text-sm text-zinc-500">
            Primeira vez? Peça ao admin da família para convidar o seu e-mail do Google.
          </p>
        </>
      )}
    </main>
  );
}
