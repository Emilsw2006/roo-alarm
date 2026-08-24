-- RLS + RPCs de seguridad (tokens / cuentas).
-- El cliente autenticado solo ve y edita SUS filas.
-- rescue_tokens y longest_streak no se pueden inflar con UPDATE directo.

-- Trigger de perfil al registrarse (si aún no existía)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.user_settings enable row level security;
alter table public.alarms enable row level security;
alter table public.mission_history enable row level security;
alter table public.streak_history enable row level security;

revoke all on table public.user_settings from public, anon;
revoke all on table public.alarms from public, anon;
revoke all on table public.mission_history from public, anon;
revoke all on table public.streak_history from public, anon;

grant select, insert, update, delete on table public.user_settings to authenticated;
grant select, insert, update, delete on table public.alarms to authenticated;
grant select, insert, update, delete on table public.mission_history to authenticated;
grant select, insert, update, delete on table public.streak_history to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists user_settings_select_own on public.user_settings;
drop policy if exists user_settings_insert_own on public.user_settings;
drop policy if exists user_settings_update_own on public.user_settings;
drop policy if exists user_settings_delete_own on public.user_settings;

create policy user_settings_select_own on public.user_settings
  for select to authenticated using (user_id = auth.uid());
create policy user_settings_insert_own on public.user_settings
  for insert to authenticated with check (user_id = auth.uid());
create policy user_settings_update_own on public.user_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_settings_delete_own on public.user_settings
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists alarms_select_own on public.alarms;
drop policy if exists alarms_insert_own on public.alarms;
drop policy if exists alarms_update_own on public.alarms;
drop policy if exists alarms_delete_own on public.alarms;

create policy alarms_select_own on public.alarms
  for select to authenticated using (user_id = auth.uid());
create policy alarms_insert_own on public.alarms
  for insert to authenticated with check (user_id = auth.uid());
create policy alarms_update_own on public.alarms
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy alarms_delete_own on public.alarms
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists mission_history_select_own on public.mission_history;
drop policy if exists mission_history_insert_own on public.mission_history;
drop policy if exists mission_history_update_own on public.mission_history;
drop policy if exists mission_history_delete_own on public.mission_history;

create policy mission_history_select_own on public.mission_history
  for select to authenticated using (user_id = auth.uid());
create policy mission_history_insert_own on public.mission_history
  for insert to authenticated with check (user_id = auth.uid());
create policy mission_history_update_own on public.mission_history
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mission_history_delete_own on public.mission_history
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists streak_history_select_own on public.streak_history;
drop policy if exists streak_history_insert_own on public.streak_history;
drop policy if exists streak_history_update_own on public.streak_history;
drop policy if exists streak_history_delete_own on public.streak_history;

create policy streak_history_select_own on public.streak_history
  for select to authenticated using (user_id = auth.uid());
create policy streak_history_insert_own on public.streak_history
  for insert to authenticated with check (user_id = auth.uid());
create policy streak_history_update_own on public.streak_history
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy streak_history_delete_own on public.streak_history
  for delete to authenticated using (user_id = auth.uid());

-- Impide inflar tokens / longest_streak / premium desde el cliente.
-- Las funciones SECURITY DEFINER (postgres) sí pueden cambiarlos.
create or replace function public.protect_user_settings_sensitive_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.rescue_tokens := 0;
      new.longest_streak := 0;
      new.is_subscribed := coalesce(new.is_subscribed, false);
      -- Premium: el cliente aún sincroniza RevenueCat; no lo forzamos a false
      -- en UPDATE para no romper restore. INSERT sí nace sin suscripción.
      new.is_subscribed := false;
      new.subscription_plan := null;
      new.subscription_status := null;
      new.subscription_expires_at := null;
      new.subscribed_at := null;
    elsif tg_op = 'UPDATE' then
      new.rescue_tokens := old.rescue_tokens;
      new.longest_streak := old.longest_streak;
      new.user_id := old.user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_user_settings_sensitive on public.user_settings;
create trigger protect_user_settings_sensitive
  before insert or update on public.user_settings
  for each row execute function public.protect_user_settings_sensitive_columns();

create or replace function public.spend_rescue_token()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  remaining integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.user_settings
  set rescue_tokens = rescue_tokens - 1,
      updated_at = now()
  where user_id = uid
    and rescue_tokens > 0
  returning rescue_tokens into remaining;

  if remaining is null then
    raise exception 'No rescue tokens';
  end if;

  return remaining;
end;
$$;

create or replace function public.apply_streak_rewards(p_streak integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_longest integer := 0;
  current_tokens integer := 0;
  next_longest integer;
  next_tokens integer;
  awarded boolean := false;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_streak is null or p_streak < 0 then
    raise exception 'Invalid streak';
  end if;

  select coalesce(longest_streak, 0), coalesce(rescue_tokens, 0)
    into current_longest, current_tokens
  from public.user_settings
  where user_id = uid;

  if not found then
    insert into public.user_settings (user_id) values (uid);
    current_longest := 0;
    current_tokens := 0;
  end if;

  next_longest := current_longest;
  next_tokens := current_tokens;

  if p_streak > current_longest then
    next_longest := p_streak;
  end if;

  if p_streak > 0 and (p_streak = 3 or p_streak = 21 or p_streak % 30 = 0) then
    next_tokens := current_tokens + 1;
    awarded := true;
  end if;

  update public.user_settings
  set longest_streak = next_longest,
      rescue_tokens = next_tokens,
      updated_at = now()
  where user_id = uid;

  return jsonb_build_object(
    'longest_streak', next_longest,
    'rescue_tokens', next_tokens,
    'token_awarded', awarded
  );
end;
$$;

revoke all on function public.spend_rescue_token() from public, anon;
revoke all on function public.apply_streak_rewards(integer) from public, anon;
grant execute on function public.spend_rescue_token() to authenticated;
grant execute on function public.apply_streak_rewards(integer) to authenticated;
