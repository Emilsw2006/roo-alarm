-- Borrado completo de cuenta: datos de usuario, alarmas, suscripción (user_settings) y auth.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.mission_history where user_id = uid;
  delete from public.streak_history where user_id = uid;
  delete from public.alarms where user_id = uid;
  delete from public.user_settings where user_id = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
