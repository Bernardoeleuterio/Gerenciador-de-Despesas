import type { Metadata } from "next";
import Link from "next/link";
import { SeloDoModo } from "@/componentes/selo-do-modo";
import { Membros } from "./membros";

export const metadata: Metadata = { title: "Membros — Gerenciador de Despesas" };

export default function PaginaDeMembros() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <Link href="/" className="w-fit text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        ← Início
      </Link>
      <SeloDoModo />
      <h1 className="text-3xl font-semibold tracking-tight">Membros da família</h1>
      <Membros />
    </main>
  );
}
