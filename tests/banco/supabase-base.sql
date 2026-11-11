-- O pedaço do Supabase que as migrações esperam encontrar, para os testes
-- rodarem num Postgres em memória (PGlite), sem Docker:
--   * os papéis anon, authenticated e service_role;
--   * o schema auth, com auth.users e auth.uid() (igual ao do Supabase);
--   * os privilégios padrão que o Supabase dá no schema public.
-- O CI também aplica as migrações no Postgres de verdade do Supabase.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;

create table auth.users (
  id     uuid primary key,
  email  text unique
);

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
