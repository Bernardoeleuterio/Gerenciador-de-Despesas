-- =============================================================================
-- Gerenciador de Despesas — schema inicial (Etapa 3)
--
-- Tudo pertence a uma família (familia_id), e o RLS só libera o que é da
-- família de quem está logado. O que o RLS não cobre fica no próprio schema:
--   * FKs compostas impedem apontar para dado de outra família (FK ignora RLS);
--   * privilégios de coluna impedem trocar familia_id ou criado_por num UPDATE;
--   * anon não tem nem permissão de tabela.
-- =============================================================================

-- Funções auxiliares ficam num schema que a API do Supabase não expõe.
create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

create table public.familias (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 1 and 80),
  criado_em  timestamptz not null default now()
);

create table public.membros (
  id          uuid primary key default gen_random_uuid(),
  familia_id  uuid not null references public.familias (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  apelido     text not null check (char_length(apelido) between 1 and 40),
  papel       text not null default 'membro' check (papel in ('admin', 'membro')),
  criado_em   timestamptz not null default now(),
  unique (familia_id, user_id),
  unique (id, familia_id)
);

-- Cadastro fechado: só quem tem convite vira membro (o fluxo entra na Etapa 4).
create table public.convites (
  id          uuid primary key default gen_random_uuid(),
  familia_id  uuid not null references public.familias (id) on delete cascade,
  email       text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  papel       text not null default 'membro' check (papel in ('admin', 'membro')),
  criado_em   timestamptz not null default now(),
  unique (familia_id, email)
);

create table public.contas (
  id              uuid primary key default gen_random_uuid(),
  familia_id      uuid not null references public.familias (id) on delete cascade,
  nome            text not null check (char_length(nome) between 1 and 40),
  tipo            text not null check (tipo in ('conta', 'cartao', 'dinheiro')),
  dono_id         uuid, -- nulo = da casa
  dia_fechamento  smallint check (dia_fechamento between 1 and 31),
  dia_vencimento  smallint check (dia_vencimento between 1 and 31),
  criado_em       timestamptz not null default now(),
  unique (familia_id, nome),
  unique (id, familia_id),
  foreign key (dono_id, familia_id)
    references public.membros (id, familia_id) on delete set null (dono_id),
  -- fechamento e vencimento: obrigatórios no cartão, proibidos no resto
  check (
    case when tipo = 'cartao'
      then dia_fechamento is not null and dia_vencimento is not null
      else dia_fechamento is null and dia_vencimento is null
    end
  )
);

create table public.categorias (
  id          uuid primary key default gen_random_uuid(),
  familia_id  uuid not null references public.familias (id) on delete cascade,
  nome        text not null check (char_length(nome) between 1 and 40),
  icone       text,
  tipo        text not null default 'despesa' check (tipo in ('despesa', 'receita')),
  criado_em   timestamptz not null default now(),
  unique (familia_id, nome),
  unique (id, familia_id)
);

create table public.lancamentos (
  id               uuid primary key default gen_random_uuid(),
  familia_id       uuid not null references public.familias (id) on delete cascade,
  tipo             text not null check (tipo in ('despesa', 'receita')),
  -- centavos inteiros, sempre positivos; acima de R$ 10 milhões é quase certo
  -- que alguém mandou reais onde se esperava centavos
  valor_centavos   bigint not null check (valor_centavos between 1 and 1000000000),
  data             date not null, -- o dia do gasto, sem fuso
  descricao        text not null check (char_length(descricao) between 1 and 120),
  categoria_id     uuid not null,
  conta_id         uuid,
  pago_por         uuid,
  criado_por       uuid default auth.uid() references auth.users (id) on delete set null,
  status           text not null default 'pago' check (status in ('previsto', 'pago')),
  parcelamento_id  uuid,
  parcela_num      smallint,
  parcela_total    smallint,
  recorrencia_id   uuid, -- a FK entra com a tabela recorrencias, na Fase 2
  criado_em        timestamptz not null default now(),
  -- tudo o que o lançamento aponta é da mesma família
  foreign key (categoria_id, familia_id)
    references public.categorias (id, familia_id),
  foreign key (conta_id, familia_id)
    references public.contas (id, familia_id) on delete set null (conta_id),
  foreign key (pago_por, familia_id)
    references public.membros (id, familia_id) on delete set null (pago_por),
  -- parcela: os três campos juntos, ou nenhum
  check (
    (parcelamento_id is null and parcela_num is null and parcela_total is null)
    or (
      parcelamento_id is not null
      and parcela_total between 2 and 48
      and parcela_num between 1 and parcela_total
    )
  )
);

-- -----------------------------------------------------------------------------
-- Índices: toda consulta começa por "desta família"; e as FKs têm índice
-- -----------------------------------------------------------------------------

create index lancamentos_familia_data_idx on public.lancamentos (familia_id, data);
create index lancamentos_categoria_idx    on public.lancamentos (categoria_id, familia_id);
create index lancamentos_conta_idx        on public.lancamentos (conta_id, familia_id);
create index lancamentos_pago_por_idx     on public.lancamentos (pago_por, familia_id);
create index lancamentos_criado_por_idx   on public.lancamentos (criado_por);
create index contas_dono_idx              on public.contas (dono_id, familia_id);
create index membros_user_idx             on public.membros (user_id);
create index convites_email_idx           on public.convites (email);

-- -----------------------------------------------------------------------------
-- Funções auxiliares do RLS
--
-- security definer: rodam como dono das tabelas, então leem membros sem passar
-- pelo RLS de membros — sem isso, a policy de membros consultaria membros e
-- entraria em recursão. Retornam um conjunto, e a policy usa
-- "familia_id in (select ...)": o Postgres calcula a lista uma vez por consulta,
-- não uma vez por linha.
-- -----------------------------------------------------------------------------

create function privado.familias_do_usuario()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.familia_id
  from public.membros m
  where m.user_id = (select auth.uid());
$$;

create function privado.familias_onde_sou_admin()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.familia_id
  from public.membros m
  where m.user_id = (select auth.uid())
    and m.papel = 'admin';
$$;

revoke all on function privado.familias_do_usuario() from public;
revoke all on function privado.familias_onde_sou_admin() from public;
grant execute on function privado.familias_do_usuario() to authenticated;
grant execute on function privado.familias_onde_sou_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- Toda família nasce com as categorias padrão (decididas na Etapa 1)
-- -----------------------------------------------------------------------------

create function privado.criar_categorias_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categorias (familia_id, nome, icone) values
    (new.id, 'Mercado', '🛒'),
    (new.id, 'Delivery e restaurantes', '🍔'),
    (new.id, 'Transporte', '🚗'),
    (new.id, 'Moradia', '🏠'),
    (new.id, 'Contas da casa', '💡'),
    (new.id, 'Saúde', '💊'),
    (new.id, 'Educação', '📚'),
    (new.id, 'Lazer', '🎬'),
    (new.id, 'Assinaturas', '📺'),
    (new.id, 'Pets', '🐾'),
    (new.id, 'Compras e cuidados', '🛍️'),
    (new.id, 'Outros', '📦');
  return new;
end;
$$;

revoke all on function privado.criar_categorias_padrao() from public;

create trigger familias_categorias_padrao
  after insert on public.familias
  for each row execute function privado.criar_categorias_padrao();

-- -----------------------------------------------------------------------------
-- Privilégios
-- -----------------------------------------------------------------------------

-- Sem login, nada: anon não tem nem permissão de tabela.
revoke all on
  public.familias, public.membros, public.convites,
  public.contas, public.categorias, public.lancamentos
from anon;

-- Nada que passe por cima do RLS ou que ninguém precise.
revoke truncate, references, trigger on
  public.familias, public.membros, public.convites,
  public.contas, public.categorias, public.lancamentos
from authenticated;

-- Família se cria e se apaga só pelo seed (service role), nunca pelo app.
revoke insert, delete on public.familias from authenticated;

-- O UPDATE só alcança estas colunas: familia_id, criado_por e chaves não mudam.
revoke update on
  public.familias, public.membros, public.convites,
  public.contas, public.categorias, public.lancamentos
from authenticated;
grant update (nome) on public.familias to authenticated;
grant update (apelido, papel) on public.membros to authenticated;
grant update (papel) on public.convites to authenticated;
grant update (nome, tipo, dono_id, dia_fechamento, dia_vencimento) on public.contas to authenticated;
grant update (nome, icone, tipo) on public.categorias to authenticated;
grant update (
  tipo, valor_centavos, data, descricao, categoria_id, conta_id, pago_por,
  status, parcelamento_id, parcela_num, parcela_total
) on public.lancamentos to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.familias    enable row level security;
alter table public.membros     enable row level security;
alter table public.convites    enable row level security;
alter table public.contas      enable row level security;
alter table public.categorias  enable row level security;
alter table public.lancamentos enable row level security;

-- familias: membro vê a sua; admin renomeia.
create policy "membro vê a própria família"
  on public.familias for select to authenticated
  using (id in (select privado.familias_do_usuario()));

create policy "admin renomeia a família"
  on public.familias for update to authenticated
  using (id in (select privado.familias_onde_sou_admin()))
  with check (id in (select privado.familias_onde_sou_admin()));

-- membros: todos da família se veem; só admin adiciona, altera ou remove.
create policy "membro vê os membros da família"
  on public.membros for select to authenticated
  using (familia_id in (select privado.familias_do_usuario()));

create policy "admin adiciona membro"
  on public.membros for insert to authenticated
  with check (familia_id in (select privado.familias_onde_sou_admin()));

create policy "admin altera membro"
  on public.membros for update to authenticated
  using (familia_id in (select privado.familias_onde_sou_admin()))
  with check (familia_id in (select privado.familias_onde_sou_admin()));

create policy "admin remove membro"
  on public.membros for delete to authenticated
  using (familia_id in (select privado.familias_onde_sou_admin()));

-- convites: só admin vê e mexe.
create policy "admin gerencia convites"
  on public.convites for all to authenticated
  using (familia_id in (select privado.familias_onde_sou_admin()))
  with check (familia_id in (select privado.familias_onde_sou_admin()));

-- contas e categorias: todo membro usa (decisão da Etapa 1: todos lançam e veem).
create policy "membro usa as contas da família"
  on public.contas for all to authenticated
  using (familia_id in (select privado.familias_do_usuario()))
  with check (familia_id in (select privado.familias_do_usuario()));

create policy "membro usa as categorias da família"
  on public.categorias for all to authenticated
  using (familia_id in (select privado.familias_do_usuario()))
  with check (familia_id in (select privado.familias_do_usuario()));

-- lançamentos: todo membro vê, edita e apaga; e só lança em nome próprio.
create policy "membro vê os lançamentos da família"
  on public.lancamentos for select to authenticated
  using (familia_id in (select privado.familias_do_usuario()));

create policy "membro lança em nome próprio"
  on public.lancamentos for insert to authenticated
  with check (
    familia_id in (select privado.familias_do_usuario())
    and criado_por = (select auth.uid())
  );

create policy "membro edita lançamentos da família"
  on public.lancamentos for update to authenticated
  using (familia_id in (select privado.familias_do_usuario()))
  with check (familia_id in (select privado.familias_do_usuario()));

create policy "membro apaga lançamentos da família"
  on public.lancamentos for delete to authenticated
  using (familia_id in (select privado.familias_do_usuario()));
