import { ErroRepositorio } from "@/lib/dados";

/** O texto que a tela mostra para um erro: o do repositório, ou um genérico. */
export function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ErroRepositorio) return erro.message;
  return "Algo deu errado. Tente de novo.";
}

/** Entrou com o Google, mas não é membro de família nenhuma (sem convite, ou removido). */
export function semFamilia(erro: unknown): boolean {
  return erro instanceof ErroRepositorio && erro.codigo === "sem_permissao";
}
