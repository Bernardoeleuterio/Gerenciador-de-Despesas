# Gerenciador de Despesas

App para a família lançar gastos em segundos — digitando `50 ifood` — e ver, no fim do mês, quanto foi gasto, em quê e por quem.

> 🚧 **Em desenvolvimento.** Por enquanto existe só a fundação do projeto: estrutura, modos, testes e CI.

## Duas versões do mesmo código

| | Família | Demo (portfólio) |
| :--- | :--- | :--- |
| **Dados** | Reais, no Supabase | Fictícios, no navegador de quem visita |
| **Entrada** | Login com Google, cadastro fechado | "Entrar como visitante" |
| **Backend** | Supabase (Auth, RLS, Realtime) | Nenhum |

O modo vem da variável `NEXT_PUBLIC_MODO`. Sem ela, o app sobe em **demo** — o modo que nunca toca em dado real. Um valor inválido derruba o build na hora, em vez de cair num modo que ninguém escolheu.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase · Vitest · GitHub Actions

## Rodando localmente

Requisito: Node.js 22.12 ou mais novo (recomendado: a versão do `.nvmrc`).

```bash
npm install
npm run dev
```

Abre em <http://localhost:3000>, em modo demo. Para o modo família, copie o `.env.example` para `.env.local` e preencha as variáveis do Supabase.

| Comando | O que faz |
| :--- | :--- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes (Vitest) |
| `npm run lint` | ESLint |
| `npm run build` | Build de produção |

## Estrutura

```text
src/app/          telas (App Router)
src/lib/          regras e configuração, sem tela (ex.: modo.ts)
supabase/         configuração e migrações do banco (Supabase CLI)
.github/workflows CI: lint, testes, build e auditoria a cada push
```

## Segurança

- `.env.local` nunca vai para o Git; o `.env.example` lista as variáveis sem valor.
- A chave secreta do Supabase nunca usa o prefixo `NEXT_PUBLIC_`, que vai para o navegador.
- O CI barra dependência de produção com vulnerabilidade alta ou crítica (`npm audit`).
