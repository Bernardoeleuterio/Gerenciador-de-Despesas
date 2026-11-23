import { MODO } from "@/lib/modo";

/** Deixa claro, em toda tela, se os dados são de verdade ou fictícios. */
export function SeloDoModo() {
  const emDemo = MODO === "demo";
  return (
    <span
      className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
        emDemo
          ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
          : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
      }`}
    >
      {emDemo ? "Modo demonstração — dados fictícios" : "Modo família"}
    </span>
  );
}
