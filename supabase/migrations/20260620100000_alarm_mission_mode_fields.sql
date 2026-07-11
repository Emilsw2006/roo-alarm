alter table public.alarms
  add column if not exists mission_mode text default 'personalized'
    check (mission_mode in ('personalized', 'roulette'));

alter table public.alarms
  add column if not exists enabled_missions jsonb not null default '[]'::jsonb;
