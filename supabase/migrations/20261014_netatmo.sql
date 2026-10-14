-- Netatmo: publika väderstationer runt Väster, Nyköping (netatmo-proxy).
-- netatmo_auth: Netatmo byter refresh-token vid varje förnyelse, så den måste sparas server-side.
-- netatmo_cache: senaste sammanställning; edge-funktioner delar inte minne mellan anrop.
-- Båda: RLS på utan policies → bara service_role (funktionen) kommer åt dem.
create table public.netatmo_auth (
  id text primary key default 'me',
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.netatmo_cache (
  id text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.netatmo_auth enable row level security;
alter table public.netatmo_cache enable row level security;
