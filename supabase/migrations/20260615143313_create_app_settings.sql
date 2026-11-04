create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Locked down: no anon/authenticated access. Only the service role (Edge Function) can read/write.
drop policy if exists app_settings_deny_select on public.app_settings;
drop policy if exists app_settings_deny_all on public.app_settings;
create policy app_settings_deny_select on public.app_settings for select using (false);
create policy app_settings_deny_all on public.app_settings for all using (false) with check (false);

insert into public.app_settings(key, value) values
  ('whatsapp_number', jsonb_build_object('number','525555550199'))
on conflict (key) do nothing;
