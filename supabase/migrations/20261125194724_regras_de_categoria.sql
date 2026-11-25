-- =============================================================================
-- Gerenciador de Despesas — regras de categoria (Etapa 6)
--
-- Quando alguém corrige a categoria de um lançamento, o app pergunta "sempre
-- que aparecer ifood?". Com o sim, nasce uma regra: o termo aponta para a
-- categoria, e o parser passa a usá-la antes das palavras-chave.
-- =============================================================================

create table public.regras (
  id            uuid primary key default gen_random_uuid(),
  familia_id    uuid not null references public.familias (id) on delete cascade,
  -- O app manda o termo normalizado (minúsculo, sem acento); o banco confere o
  -- que dá para conferir sem extensão
  termo         text not null
                check (termo = lower(btrim(termo)) and char_length(termo) between 1 and 60),
  categoria_id  uuid not null,
  criado_por    uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em     timestamptz not null default now(),
  unique (familia_id, termo),
  -- FK composta: a regra só aponta para categoria da mesma família
  foreign key (categoria_id, familia_id)
    references public.categorias (id, familia_id) on delete cascade
);

create index regras_categoria_idx on public.regras (categoria_id, familia_id);

-- Os mesmos privilégios das outras tabelas: sem login, nada; e o UPDATE só
-- troca a categoria (família, termo e autor não mudam).
revoke all on public.regras from anon;
revoke truncate, references, trigger on public.regras from authenticated;
revoke update on public.regras from authenticated;
grant update (categoria_id) on public.regras to authenticated;

alter table public.regras enable row level security;

-- Toda a família ensina e todos usam: as regras valem para todo mundo.
create policy "membro usa as regras da família"
  on public.regras for all to authenticated
  using (familia_id in (select privado.familias_do_usuario()))
  with check (familia_id in (select privado.familias_do_usuario()));
