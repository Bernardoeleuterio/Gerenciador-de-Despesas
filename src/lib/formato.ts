// Como a tela fala de dinheiro e de datas, sempre do jeito brasileiro.

const REAIS = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 5000 → "R$ 50,00" (o espaço depois do R$ não quebra a linha). */
export function formatarReais(centavos: number): string {
  return REAIS.format(centavos / 100);
}

const MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const DIA_DA_SEMANA = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" });

function paraDate(dia: string): Date {
  const [ano, mes, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, d ?? 1));
}

/** "2026-11" → "novembro de 2026". */
export function nomeDoMes(mes: string): string {
  return MES.format(paraDate(mes));
}

/**
 * Como a tela chama um dia: "hoje", "ontem", "anteontem", o dia da semana
 * até seis dias atrás ("sexta"), "20/11" no mesmo ano ou "20/11/2025".
 */
export function nomeDoDia(dia: string, hoje: string): string {
  const dias = Math.round((paraDate(hoje).getTime() - paraDate(dia).getTime()) / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias === 2) return "anteontem";
  if (dias > 2 && dias < 7) return DIA_DA_SEMANA.format(paraDate(dia)).replace("-feira", "");
  const [ano, mes, d] = dia.split("-");
  return ano === hoje.slice(0, 4) ? `${d}/${mes}` : `${d}/${mes}/${ano}`;
}
