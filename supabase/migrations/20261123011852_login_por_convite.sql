-- =============================================================================
-- Gerenciador de Despesas — login por convite (Etapa 4)
--
-- Cadastro fechado: entrar na família tem um caminho só, um convite para o seu
-- e-mail.
--   * O hook "Before User Created" do Supabase Auth nem deixa nascer a conta de
--     quem não tem convite (vale também para o login com Google).
--   * Conta com e-mail confirmado + convite para esse e-mail = membro. Acontece
--     no primeiro login, ou na hora do convite, se a pessoa já tinha conta
--     (quem foi removido e volta, por exemplo).
--   * O app não insere membro direto: o admin convida, e o banco faz o resto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Convites
-- -----------------------------------------------------------------------------

-- Como chamar a pessoa quando ela entrar.
alter table public.convites
  add column apelido text not null check (char_length(apelido) between 1 and 40);

-- Convite nasce e some (aceito ou cancelado); ninguém edita.
revoke update on public.convites from authenticated;

-- -----------------------------------------------------------------------------
-- Membros
-- -----------------------------------------------------------------------------

-- Membro só nasce de convite.
drop policy "admin adiciona membro" on public.membros;
revoke insert on public.membros from authenticated;

-- O admin não remove a si mesmo nem perde o próprio papel: a família não
-- fica sem admin por um clique errado.
drop policy "admin remove membro" on public.membros;
create policy "admin remove outro membro"
  on public.membros for delete to authenticated
  using (
    familia_id in (select privado.familias_onde_sou_admin())
    and user_id <> (select auth.uid())
  );

drop policy "admin altera membro" on public.membros;
create policy "admin altera membro"
  on public.membros for update to authenticated
  using (familia_id in (select privado.familias_onde_sou_admin()))
  with check (
    familia_id in (select privado.familias_onde_sou_admin())
    and (user_id <> (select auth.uid()) or papel = 'admin')
  );

-- -----------------------------------------------------------------------------
-- Convite vira membro
--
-- security definer: quem está entrando ainda não é membro, então o RLS não o
-- deixaria ler o convite nem criar o próprio membro.
-- -----------------------------------------------------------------------------

create function privado.aceitar_convites(p_user_id uuid, p_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  with aceitos as (
    delete from public.convites
    where email = lower(btrim(p_email))
    returning familia_id, apelido, papel
  )
  insert into public.membros (familia_id, user_id, apelido, papel)
  select familia_id, p_user_id, apelido, papel
  from aceitos
  on conflict (familia_id, user_id) do nothing;
$$;

-- Conta nova, ou e-mail confirmado depois: confere se há convite.
create function privado.aceitar_convites_da_conta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform privado.aceitar_convites(new.id, new.email);
  return null;
end;
$$;

create trigger contas_aceitam_convites
  after insert or update of email, email_confirmed_at on auth.users
  for each row
  when (new.email is not null and new.email_confirmed_at is not null)
  execute function privado.aceitar_convites_da_conta();

-- Convite para quem já tem conta: vira membro na hora.
create function privado.aceitar_convite_de_conta_existente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conta uuid;
begin
  select u.id into conta
  from auth.users u
  where lower(u.email) = new.email
    and u.email_confirmed_at is not null
  limit 1;

  if conta is not null then
    perform privado.aceitar_convites(conta, new.email);
  end if;
  return null;
end;
$$;

create trigger convites_para_conta_existente
  after insert on public.convites
  for each row execute function privado.aceitar_convite_de_conta_existente();

revoke all on function privado.aceitar_convites(uuid, text) from public;
revoke all on function privado.aceitar_convites_da_conta() from public;
revoke all on function privado.aceitar_convite_de_conta_existente() from public;

-- -----------------------------------------------------------------------------
-- Hook "Before User Created" do Supabase Auth
--
-- Roda antes de criar qualquer conta. Sem convite para o e-mail, recusa: a
-- conta nem nasce. Ligado em supabase/config.toml (local) e no painel do
-- Supabase (Authentication > Hooks), no projeto de verdade — por isso fica no
-- schema public, o que o painel oferece. A API não alcança: só o Supabase Auth
-- pode executá-lo.
-- -----------------------------------------------------------------------------

create function public.antes_de_criar_usuario(evento jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from public.convites c
      where c.email = lower(btrim(evento -> 'user' ->> 'email'))
    )
    then '{}'::jsonb
    else jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Acesso só por convite: peça ao admin da família para convidar o seu e-mail.'
      )
    )
  end;
$$;

-- O Supabase dá execute em toda função nova do public para anon, authenticated
-- e service_role: tira de todos, e dá só ao Supabase Auth.
revoke all on function public.antes_de_criar_usuario(jsonb)
  from public, anon, authenticated, service_role;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.antes_de_criar_usuario(jsonb) to supabase_auth_admin;
