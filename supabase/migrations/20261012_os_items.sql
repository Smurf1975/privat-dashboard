-- OS-fliken: ögonblicksbild av AI Native OS (appar, verktyg, körningar).
-- Kontrakt: docs/superpowers/specs/2026-10-12-os-flik-design.md
create table public.os_items (
  kind text not null check (kind in ('app','skill','mcp','plugin','run')),
  id text not null,
  data jsonb not null,
  collected_at timestamptz not null default now(),
  primary key (kind, id)
);

create table public.os_collect_log (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running','ok','error')),
  counts jsonb,
  error_summary text
);

alter table public.os_items enable row level security;
alter table public.os_collect_log enable row level security;
create policy os_items_mats_read on public.os_items for select
  using ((auth.jwt()->>'email') = 'mats@enmarks.se');
create policy os_collect_log_mats_read on public.os_collect_log for select
  using ((auth.jwt()->>'email') = 'mats@enmarks.se');

create or replace function public.os_get_ingest_secrets()
returns table(name text, secret text)
language sql security definer set search_path = public, vault as $$
  select s.name, s.decrypted_secret from vault.decrypted_secrets s
  where s.name in ('os_ingest_secret_current', 'os_ingest_secret_previous');
$$;
revoke all on function public.os_get_ingest_secrets() from public, anon, authenticated;
grant execute on function public.os_get_ingest_secrets() to service_role;
