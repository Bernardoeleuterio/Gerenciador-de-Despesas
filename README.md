# Gerenciador de Despesas

App para a família lançar gastos em segundos — digitando `50 ifood` — e ver, no fim do mês, quanto foi gasto, em quê e por quem.

> 🚧 **Em desenvolvimento.** Por enquanto existem a fundação do projeto (estrutura, modos, testes e CI), o banco de dados com RLS e a camada de dados dos dois modos. As telas vêm a seguir.

## Duas versões do mesmo código

| | Família | Demo (portfólio) |
| :--- | :--- | :--- |
| **Dados** | Reais, no Supabase | Fictícios, no navegador de quem visita |
| **Entrada** | Login com Google, cadastro fechado | "Entrar como visitante" |
| **Backend** | Supabase (Auth, RLS, Realtime) | Nenhum |

O modo vem da variável `NEXT_PUBLIC_MODO`. Sem ela, o app sobe em **demo** — o modo que nunca toca em dado real. Um valor inválido derruba o build na hora, em vez de cair num modo que ninguém escolheu.

### A tela não sabe de onde vêm os dados

As telas só conhecem a interface `Repositorio` (`src/lib/dados/`), e `obterRepositorio()` entrega a implementação do modo atual:

- **`RepositorioSupabase`** — família: lê e grava no Supabase; quem garante as regras é o banco (RLS, FKs compostas, checks).
- **`RepositorioDemo`** — portfólio: guarda tudo no `localStorage` de quem visita e aplica, em código, as mesmas regras do banco.

Cada modo carrega só o próprio código: a demo nunca baixa o cliente do Supabase. Os totais do mês saem de uma função pura (`resumo.ts`), a mesma nos dois modos, em centavos inteiros.

Para os dois se comportarem igual, a **mesma suíte de testes de contrato** roda contra os dois: a demo no `npm test`, e o Supabase no CI, contra um Supabase local com login de verdade.

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

Os testes em `tests/banco/` sobem um Postgres em memória ([PGlite](https://pglite.dev)), aplicam as migrações e provam o isolamento com duas famílias. Rodam no `npm test`, sem Docker. No CI, as mesmas migrações também sobem num Supabase local (banco, Auth e API), seguidas do advisor de segurança e dos testes de contrato do `RepositorioSupabase`.

## Estrutura

```text
src/app/          telas (App Router)
src/lib/          regras e configuração, sem tela (modo.ts, resumo.ts)
src/lib/dados/    a interface Repositorio e as duas implementações
supabase/         configuração e migrações do banco (Supabase CLI)
tests/banco/      testes do schema e do RLS num Postgres em memória
tests/contrato/   a suíte que demo e Supabase precisam passar igual
.github/workflows CI: lint, testes, build, auditoria e Supabase local a cada push
```

## Segurança

- `.env.local` nunca vai para o Git; o `.env.example` lista as variáveis sem valor.
- A chave secreta do Supabase nunca usa o prefixo `NEXT_PUBLIC_`, que vai para o navegador.
- O CI barra dependência de produção com vulnerabilidade alta ou crítica (`npm audit`).
- O RLS tem teste automatizado: a família A não lê, não cria e não altera nada da família B.
