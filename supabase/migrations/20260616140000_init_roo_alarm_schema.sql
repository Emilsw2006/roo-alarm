-- Roo Alarm schema (structure only, no seed data)

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  language text default 'es',
  default_mission text,
  default_sound text default 'radar_classic',
  personalized_mission text,
  mission_mode text default 'personalized' check (mission_mode in ('personalized', 'roulette')),
  enabled_missions jsonb not null default '["make_bed"]'::jsonb,
  snooze_enabled boolean not null default false,
  protected_days jsonb not null default '[0,1,2,3,4]'::jsonb,
  rescue_tokens integer not null default 0,
  longest_streak integer not null default 0,
  wake_up_thought text,
  stay_in_bed_reason text,
  usual_wake_time timestamptz,
  snooze_habit text,
  alarm_count integer,
  single_alarm_confidence text,
  wake_up_feeling text,
  wake_up_duration text,
  target_wake_time timestamptz,
  alarm_sound jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alarms (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  time text not null,
  ampm text not null check (ampm in ('AM', 'PM')),
  mission text not null default '',
  label text not null default '',
  sound text,
  custom_mission text,
  specific_date text,
  enabled boolean not null default true,
  last_triggered_date date,
  last_completed_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alarms_user_id_idx on public.alarms(user_id);

create table if not exists public.mission_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  alarm_id bigint references public.alarms(id) on delete set null,
  mission_type text not null,
  custom_mission_text text,
  created_at timestamptz not null default now()
);

create index if not exists mission_history_user_id_idx on public.mission_history(user_id);

create table if not exists public.streak_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  streak_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists streak_history_user_id_date_idx on public.streak_history(user_id, date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;
