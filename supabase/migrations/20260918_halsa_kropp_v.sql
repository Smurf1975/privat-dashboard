-- halsa_kropp_v — en rad per vägning. Läsytan för Kroppen-kortet i dashboarden.
-- Additiv: rör ingen befintlig tabell, vy eller policy. Ångras med DROP VIEW.
-- security_invoker → RLS på halsa_metrics gäller den som frågar (endast Mats).
-- Vågens egna extravärden (BMI, muskelmassa, vatten …) ligger i weight-postens raw
-- och packas upp här i stället för att bli egna metrics — ingest är oförändrad.
create or replace view halsa_kropp_v with (security_invoker = true) as
with v as (
  select distinct on (ts) ts, value as vikt, raw
  from halsa_metrics
  where metric = 'weight_kg'
  order by ts, dedup_end_ts desc
)
select
  v.ts,
  (v.ts at time zone 'Europe/Stockholm')::date        as dag,
  v.vikt,
  f.value                                             as fett_pct,
  l.value                                             as mager_kg,
  (v.raw->>'bmi')::numeric                            as bmi,
  (v.raw->>'muskelmassa_kg')::numeric                 as muskel_kg,
  (v.raw->>'vatten_pct')::numeric                     as vatten_pct,
  (v.raw->>'visceralt_fett')::numeric                 as visceralt,
  (v.raw->>'benmassa_kg')::numeric                    as benmassa_kg,
  (v.raw->>'bmr')::numeric                            as bmr
from v
left join lateral (
  select value from halsa_metrics m
  where m.metric = 'body_fat_pct' and m.ts = v.ts
  order by m.dedup_end_ts desc limit 1
) f on true
left join lateral (
  select value from halsa_metrics m
  where m.metric = 'lean_body_mass_kg' and m.ts = v.ts
  order by m.dedup_end_ts desc limit 1
) l on true;

comment on view halsa_kropp_v is 'En rad per vägning (Eufy-vågen via Vagen-kortet). Extravärden uppackade ur weight-postens raw. Se docs/HEALTH-ARCHITECTURE.md.';
