import type { NextRequest } from "next/server";
import { MODO } from "@/lib/modo";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

/**
 * A volta do login com o Google. O Supabase manda um código de uso único, que
 * vira a sessão, guardada em cookies. Se o Auth recusou a conta (sem convite)
 * ou a pessoa desistiu no Google, não vem código: volta para o login com aviso.
 */
export async function GET(request: NextRequest) {
  if (MODO === "demo") return irPara("/");

  const codigo = request.nextUrl.searchParams.get("code");
  if (codigo) {
    const supabase = await supabaseDoServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return irPara("/");
  }
  return irPara("/entrar?erro=1");
}

/**
 * Redireciona com endereço relativo: o navegador continua no mesmo endereço em
 * que fez o login (127.0.0.1 ou localhost, celular na rede de casa, domínio
 * de produção), e os cookies da sessão vão junto. Os cookies gravados pelo
 * Supabase entram nesta resposta.
 */
function irPara(caminho: string) {
  return new Response(null, { status: 303, headers: { Location: caminho } });
}
