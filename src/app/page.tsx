import { SeloDoModo } from "@/componentes/selo-do-modo";
import { Painel } from "./painel";

export default function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <SeloDoModo />

      <h1 className="text-3xl font-semibold tracking-tight">Gerenciador de Despesas</h1>

      <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
        Lance um gasto em segundos — digitando{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.9em] text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
          50 ifood
        </code>{" "}
        — e veja no fim do mês quanto a família gastou, em quê e por quem.
      </p>

      <Painel />

      <p className="text-sm text-zinc-500">
        Em construção: por enquanto, o login e os membros da família.
      </p>
    </main>
  );
}
