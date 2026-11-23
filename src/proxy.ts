import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { MODO } from "@/lib/modo";
import { configSupabaseDoBuild } from "@/lib/supabase/config";

/** O que abre sem login. */
const ABERTAS = ["/entrar", "/auth/"];

/**
 * Antes de cada página (modo família): renova a sessão quando o token vence e
 * manda quem não entrou para o login. É uma conferência de conveniência — quem
 * protege os dados de verdade é o RLS do banco.
 */
export async function proxy(request: NextRequest) {
  if (MODO === "demo") return NextResponse.next(); // a demo não tem login

  const { url, chave } = configSupabaseDoBuild();
  let resposta = NextResponse.next({ request });
  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (novos) => {
        for (const { name, value } of novos) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of novos) resposta.cookies.set(name, value, options);
      },
    },
  });

  // Nada entre criar o cliente e esta chamada: é ela que renova o token.
  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (!logado && !ABERTAS.some((rota) => pathname.startsWith(rota))) {
    return redirecionar(request, "/entrar", resposta);
  }
  if (logado && pathname === "/entrar") return redirecionar(request, "/", resposta);
  return resposta;
}

/** Redireciona levando os cookies que o Supabase acabou de renovar. */
function redirecionar(request: NextRequest, destino: string, resposta: NextResponse) {
  const redirecionamento = NextResponse.redirect(new URL(destino, request.url));
  for (const cookie of resposta.cookies.getAll()) redirecionamento.cookies.set(cookie);
  return redirecionamento;
}

export const config = {
  // Tudo, menos os arquivos estáticos
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
