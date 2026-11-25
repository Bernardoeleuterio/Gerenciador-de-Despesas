// Datas como "AAAA-MM-DD", sem fuso: o dia do gasto é só um dia. As contas
// usam Date em UTC, que não tem horário de verão nem fuso para atrapalhar.

function paraDate(dia: string): Date {
  const [ano, mes, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, d));
}

function paraTexto(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** A data existe no calendário? (30/02 não existe; 29/02/2028 existe.) */
function dataValida(ano: number, mes: number, dia: number): string | null {
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const existe =
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
  return existe ? paraTexto(data) : null;
}

export function somarDias(dia: string, dias: number): string {
  const data = paraDate(dia);
  data.setUTCDate(data.getUTCDate() + dias);
  return paraTexto(data);
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(dia: string): number {
  return paraDate(dia).getUTCDay();
}

/** O dia de hoje em São Paulo — é o "hoje" que o parser recebe. */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/**
 * "dia 12": o dia 12 mais recente que não passa de hoje. Se o mês não tem
 * esse dia ("dia 31" em novembro), vai para o mês anterior que tiver.
 */
export function ultimoDiaDoMes(hoje: string, dia: number): string | null {
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return null;
  let [ano, mes] = hoje.split("-").map(Number);
  for (let tentativas = 0; tentativas < 3; tentativas++) {
    const data = dataValida(ano, mes, dia);
    if (data && data <= hoje) return data;
    mes -= 1;
    if (mes === 0) {
      mes = 12;
      ano -= 1;
    }
  }
  return null;
}

/**
 * "12/11": a ocorrência mais recente que não passa de hoje (se ainda não
 * chegou este ano, é a do ano passado). Com o ano ("12/11/2026"), é aquela.
 */
export function ultimaData(hoje: string, dia: number, mes: number, ano?: number): string | null {
  if (ano !== undefined) {
    const completo = ano < 100 ? 2000 + ano : ano;
    return dataValida(completo, mes, dia);
  }
  const anoDeHoje = Number(hoje.slice(0, 4));
  const esteAno = dataValida(anoDeHoje, mes, dia);
  if (esteAno && esteAno <= hoje) return esteAno;
  // 29/02 só existe em ano bissexto: procura o mais recente
  for (let anoAnterior = anoDeHoje - 1; anoAnterior >= anoDeHoje - 8; anoAnterior--) {
    const data = dataValida(anoAnterior, mes, dia);
    if (data) return data;
  }
  return null;
}

/**
 * "sexta": a sexta mais recente — hoje, se hoje é sexta. "sexta passada":
 * a de antes de hoje.
 */
export function ultimoDiaDaSemana(hoje: string, alvo: number, contarHoje: boolean): string {
  let recuo = (diaDaSemana(hoje) - alvo + 7) % 7;
  if (recuo === 0 && !contarHoje) recuo = 7;
  return somarDias(hoje, -recuo);
}
