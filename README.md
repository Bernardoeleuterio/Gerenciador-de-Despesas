# Gerenciador de Despesas

App para a família lançar gastos em segundos — digitando `50 ifood` — e ver, no fim do mês, quanto foi gasto, em quê e por quem.

> 🚧 **Em desenvolvimento.** Por enquanto existem a fundação do projeto (estrutura, modos, testes e CI) e o banco de dados com RLS.

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

## Banco de dados

O schema vive em `supabase/migrations/` e só muda por migração. Tudo pertence a uma família, e o RLS só libera o que é da família de quem está logado. O que o RLS não cobre fica no próprio schema:

- **Chaves estrangeiras compostas** impedem apontar para dado de outra família — uma FK simples passaria, porque FK ignora o RLS.
- **Privilégios de coluna** impedem mover um lançamento para outra família ou trocar o autor num `UPDATE`.
- **Sem login, nada:** o papel `anon` não tem nem permissão de tabela.

Os testes em `tests/banco/` sobem um Postgres em memória ([PGlite](https://pglite.dev)), aplicam as migrações e provam o isolamento com duas famílias. Rodam no `npm test`, sem Docker. No CI, as mesmas migrações também sobem no Postgres do Supabase, seguidas do advisor de segurança.

## Estrutura

```text
src/app/          telas (App Router)
src/lib/          regras e configuração, sem tela (ex.: modo.ts)
supabase/         configuração e migrações do banco (Supabase CLI)
tests/banco/      testes do schema e do RLS num Postgres em memória
.github/workflows CI: lint, testes, build, auditoria e migrações a cada push
```

## Segurança

- `.env.local` nunca vai para o Git; o `.env.example` lista as variáveis sem valor.
- A chave secreta do Supabase nunca usa o prefixo `NEXT_PUBLIC_`, que vai para o navegador.
- O CI barra dependência de produção com vulnerabilidade alta ou crítica (`npm audit`).
- O RLS tem teste automatizado: a família A não lê, não cria e não altera nada da família B.
