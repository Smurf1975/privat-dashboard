-- Onyx nivåkoll: logg + cron-nyckel för edge-funktionen onyx-nivakoll.
-- Båda tabellerna läses/skrivs bara av service role (RLS på, inga policies).

create table if not exists public.onyx_nivakoll_log (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  ok boolean not null,
  antal int,
  details jsonb,
  error text
);
alter table public.onyx_nivakoll_log enable row level security;
comment on table public.onyx_nivakoll_log is 'Onyx nivåkoll: en rad per körning (coach-appen mot svenskalag). Endast service role.';

create table if not exists public.onyx_nivakoll_config (
  key text primary key,
  value text not null
);
alter table public.onyx_nivakoll_config enable row level security;
comment on table public.onyx_nivakoll_config is 'Onyx nivåkoll: cron-nyckel. Endast service role – inga RLS-policies.';

insert into public.onyx_nivakoll_config(key, value)
values ('cron_key', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- Söndag 21:00 Europe/Stockholm. pg_cron går i UTC: 19:00 (sommartid) och
-- 20:00 (vintertid); funktionen hoppar över anropet där Stockholm inte är 21.
select cron.unschedule('onyx-nivakoll') where exists (select 1 from cron.job where jobname = 'onyx-nivakoll');
select cron.schedule('onyx-nivakoll', '0 19,20 * * 0', $$
  select net.http_post(
    url := 'https://ncgxerxkgoxptcwvramn.supabase.co/functions/v1/onyx-nivakoll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-nivakoll-cron', (select value from public.onyx_nivakoll_config where key = 'cron_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
