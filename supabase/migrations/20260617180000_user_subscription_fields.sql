-- Subscription state persisted on user_settings (synced from RevenueCat on purchase/restore)

alter table public.user_settings
  add column if not exists is_subscribed boolean not null default false,
  add column if not exists subscription_plan text,
  add column if not exists subscription_status text,
  add column if not exists subscription_expires_at timestamptz,
  add column if not exists subscribed_at timestamptz;

comment on column public.user_settings.is_subscribed is 'True when user has active premium access (RevenueCat entitlement)';
comment on column public.user_settings.subscription_plan is 'annual | weekly | unknown';
comment on column public.user_settings.subscription_status is 'active | trial | expired | cancelled';
