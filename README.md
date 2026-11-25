# Gerenciador de Despesas

App para a família lançar gastos em segundos — digitando `50 ifood` — e ver, no fim do mês, quanto foi gasto, em quê e por quem.

> 🚧 **Em desenvolvimento.** Por enquanto existem a fundação (estrutura, modos, testes e CI), o banco com RLS, a camada de dados dos dois modos, o login com Google por convite, a tela de membros e o parser do lançamento rápido. A tela de lançamento vem a seguir.

## Duas versões do mesmo código

| | Família | Demo (portfólio) |
| :--- | :--- | :--- |
| **Dados** | Reais, no Supabase | Fictícios, no navegador de quem visita |
| **Entrada** | Login com Google, só por convite | Direto, sem login |
| **Backend** | Supabase (Auth, RLS, Realtime) | Nenhum |

O modo vem da variável `NEXT_PUBLIC_MODO`. Sem ela, o app sobe em **demo** — o modo que nunca toca em dado real. Um valor inválido derruba o build na hora, em vez de cair num modo que ninguém escolheu.

### A tela não sabe de onde vêm os dados

As telas só conhecem a interface `Repositorio` (`src/lib/dados/`), e `obterRepositorio()` entrega a implementação do modo atual:

- **`RepositorioSupabase`** — família: lê e grava no Supabase; quem garante as regras é o banco (RLS, FKs compostas, checks).
- **`RepositorioDemo`** — portfólio: guarda tudo no `localStorage` de quem visita e aplica, em código, as mesmas regras do banco.

Cada modo carrega só o próprio código: a demo nunca baixa o cliente do Supabase. Os totais do mês saem de uma função pura (`resumo.ts`), a mesma nos dois modos, em centavos inteiros.

Para os dois se comportarem igual, a **mesma suíte de testes de contrato** roda contra os dois: a demo no `npm test`, e o Supabase no CI, contra um Supabase local com login de verdade.

## Lançamento rápido

Um campo só: o texto vira um lançamento. Quem faz isso é `interpretar()` (`src/lib/lancamento-rapido/`), uma função pura — sem banco e sem tela, igual nos dois modos.

| Digitado | Vira |
| :--- | :--- |
| `50 ifood` | R$ 50,00 · Delivery e restaurantes · hoje |
| `32,90 farmácia ontem` | R$ 32,90 · Saúde · ontem |
| `120 luz pix` | R$ 120,00 · Contas da casa · Pix |
| `600 geladeira 10x nubank` | R$ 600,00 em 10 parcelas, no cartão Nubank |
| `tênis em 3x de 99,90` | R$ 299,70 em 3 parcelas |
| `+3500 salário` | Receita de R$ 3.500,00 |
| `2 pizzas 80` | Não chuta: pergunta se o valor é 2 ou 80 |

Ponto é milhar e vírgula é centavo, como no Brasil. "Dia 12", "12/11" e "sexta" são os mais recentes que não passam de hoje. A categoria vem primeiro das regras que a família ensinou e, depois, de palavras-chave. Os casos do dia a dia ficam em `casos.test.ts`, um por linha.

## Login só por convite

Na versão da família, entrar tem um caminho só: um convite para o seu e-mail do Google.

1. O admin convida, na tela de membros, o e-mail e o apelido da pessoa.
2. A pessoa entra com o Google. Antes de criar a conta, o hook *Before User Created* do Supabase Auth confere o convite: sem convite, a conta nem nasce.
3. Com a conta criada (e-mail confirmado pelo Google), um gatilho no banco transforma o convite em membro da família, com o apelido e o papel combinados.

O app não insere membro direto, e o admin não remove a si mesmo nem perde o próprio papel. A família e o convite do primeiro admin nascem de um seed (`npm run criar-familia`) que lê o e-mail do `.env.local` — e-mail de verdade não entra no repositório.

A sessão fica em cookies (`@supabase/ssr`): o `proxy.ts` renova o token e manda para `/entrar` quem não entrou. É uma conferência de conveniência; quem protege os dados é o RLS.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase · Vitest · GitHub Actions

## Rodando localmente

Requisito: Node.js 22.12 ou mais novo (recomendado: a versão do `.nvmrc`).

```bash
npm install
npm run dev
```

Abre em <http://localhost:3000>, em modo demo. Para o modo família, veja [Configurando a versão da família](#configurando-a-versão-da-família).

| Comando | O que faz |
| :--- | :--- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes (Vitest) |
| `npm run lint` | ESLint |
| `npm run build` | Build de produção |
| `npm run criar-familia` | Cria a família e o convite do admin (uma vez, no modo família) |

## Configurando a versão da família

Uma vez, para o projeto de verdade:

1. **Supabase:** crie um projeto e aplique as migrações: `npx supabase login`, `npx supabase link --project-ref <ref>` e `npx supabase db push`.
2. **Google Cloud:** em *APIs e serviços › Credenciais*, crie um ID do cliente OAuth do tipo *Aplicativo da Web*, com o URI de redirecionamento `https://<ref>.supabase.co/auth/v1/callback`.
3. **Supabase › Authentication:**
   - *Sign In / Providers:* ligue o **Google** com o ID e a chave secreta do cliente, e desligue o **Email** (ninguém entra com senha).
   - *URL Configuration:* *Site URL* `http://localhost:3000` e, em *Redirect URLs*, `http://localhost:3000/auth/callback` (e o endereço de produção, quando houver).
   - *Hooks:* adicione o **Before User Created**, do tipo Postgres, com a função `public.antes_de_criar_usuario`.
4. **`.env.local`:** copie o `.env.example`, ponha `NEXT_PUBLIC_MODO=familia` e preencha as variáveis do Supabase e do seed.
5. **Seed:** `npm run criar-familia`. Depois, apague a `SUPABASE_SECRET_KEY` do `.env.local`.
6. `npm run dev` e entre com o Google usando o `ADMIN_EMAIL`. Os outros, você convida pela tela de membros.

## Banco de dados

O schema vive em `supabase/migrations/` e só muda por migração. Tudo pertence a uma família, e o RLS só libera o que é da família de quem está logado. O que o RLS não cobre fica no próprio schema:

- **Chaves estrangeiras compostas** impedem apontar para dado de outra família — uma FK simples passaria, porque FK ignora o RLS.
- **Privilégios de coluna** impedem mover um lançamento para outra família ou trocar o autor num `UPDATE`.
- **Sem login, nada:** o papel `anon` não tem nem permissão de tabela.

Os testes em `tests/banco/` sobem um Postgres em memória ([PGlite](https://pglite.dev)), aplicam as migrações e provam o isolamento com duas famílias e as regras dos convites. Rodam no `npm test`, sem Docker. No CI, as mesmas migrações também sobem num Supabase local (banco, Auth e API), seguidas do advisor de segurança, dos testes de contrato do `RepositorioSupabase` e do login por convite de ponta a ponta (`tests/supabase/`).

## Estrutura

```text
src/app/          telas (App Router): início, entrar, membros e a volta do login
src/componentes/  pedaços de tela usados em mais de um lugar
src/proxy.ts      renova a sessão e manda para o login (modo família)
src/lib/          regras e configuração, sem tela (modo.ts, resumo.ts)
src/lib/dados/    a interface Repositorio e as duas implementações
src/lib/lancamento-rapido/  o parser do campo de lançamento ("50 ifood")
src/lib/supabase/ os clientes do Supabase: navegador (cookies) e servidor
scripts/          o seed da família (npm run criar-familia)
supabase/         configuração e migrações do banco (Supabase CLI)
tests/banco/      testes do schema, do RLS e dos convites num Postgres em memória
tests/contrato/   a suíte que demo e Supabase precisam passar igual
tests/supabase/   login por convite de ponta a ponta, no Supabase local do CI
.github/workflows CI: lint, testes, build, auditoria e Supabase local a cada push
```

## Segurança

- `.env.local` nunca vai para o Git; o `.env.example` lista as variáveis sem valor.
- A chave secreta do Supabase nunca usa o prefixo `NEXT_PUBLIC_`, que vai para o navegador, e só serve ao seed.
- Cadastro fechado: sem convite, o Supabase Auth nem cria a conta; e quem tem conta sem família não vê nada (RLS).
- O CI barra dependência de produção com vulnerabilidade alta ou crítica (`npm audit`).
- O RLS tem teste automatizado: a família A não lê, não cria e não altera nada da família B.
