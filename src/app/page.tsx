import { MODO } from "@/lib/modo";

export default function Inicio() {
  const emDemo = MODO === "demo";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <span
        className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
          emDemo
            ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
            : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
        }`}
      >
        {emDemo ? "Modo demonstração — dados fictícios" : "Modo família"}
      </span>

      <h1 className="text-3xl font-semibold tracking-tight">
        Gerenciador de Despesas
      </h1>

      <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
        Lance um gasto em segundos — digitando{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.9em] text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
          50 ifood
        </code>{" "}
        — e veja no fim do mês quanto a família gastou, em quê e por quem.
      </p>

      <p className="text-sm text-zinc-500">
        Em construção: por enquanto, só a fundação do projeto.
      </p>
    </main>
  );
}
