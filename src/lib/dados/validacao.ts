import { z } from "zod";
import { ErroRepositorio, type AlteracaoLancamento, type NovoLancamento } from "./repositorio";

/**
 * As regras de um lançamento, as mesmas do banco (os `check` da migração).
 *
 * No modo família elas adiantam o erro antes da ida ao servidor — quem garante
 * de verdade é o banco. Na demo, que não tem banco, são elas que garantem.
 */
const esquemaNovoLancamento = z.strictObject({
  tipo: z.enum(["despesa", "receita"]),
  valorCentavos: z.number().int().min(1).max(1_000_000_000),
  // z.iso.date() conhece o calendário: recusa 2026-02-30 e aceita 2028-02-29
  data: z.iso.date(),
  descricao: z.string().trim().min(1).max(120),
  categoriaId: z.uuid(),
  contaId: z.uuid().nullable().optional(),
  pagoPor: z.uuid().nullable().optional(),
  status: z.enum(["previsto", "pago"]).optional(),
});

const esquemaAlteracaoLancamento = esquemaNovoLancamento.partial();

const esquemaMes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function validar<T>(esquema: z.ZodType<T>, valor: unknown, oQue: string): T {
  const resultado = esquema.safeParse(valor);
  if (!resultado.success) {
    const campos = resultado.error.issues.map((issue) => issue.path.join(".") || oQue).join(", ");
    throw new ErroRepositorio("invalido", `${oQue} inválido (${campos}).`, { cause: resultado.error });
  }
  return resultado.data;
}

export function validarNovoLancamento(novo: NovoLancamento): NovoLancamento {
  return validar(esquemaNovoLancamento, novo, "Lançamento");
}

export function validarAlteracaoLancamento(mudancas: AlteracaoLancamento): AlteracaoLancamento {
  return validar(esquemaAlteracaoLancamento, mudancas, "Alteração");
}

/** Primeiro dia do mês e primeiro dia do mês seguinte (exclusivo), em `AAAA-MM-DD`. */
export function limitesDoMes(mes: string): { inicio: string; fimExclusivo: string } {
  validar(esquemaMes, mes, "Mês");
  const [ano, numero] = mes.split("-").map(Number);
  const [anoSeguinte, mesSeguinte] = numero === 12 ? [ano + 1, 1] : [ano, numero + 1];
  return {
    inicio: `${mes}-01`,
    fimExclusivo: `${anoSeguinte}-${String(mesSeguinte).padStart(2, "0")}-01`,
  };
}
