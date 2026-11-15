-- Säkerhetsrevision 2026-11-15: barnens namn och veckopeng gick att läsa utan inloggning.
-- Verifierat: som rollen anon returnerade familj_barn_status() båda barnen med
-- namn, sysslor och pott. Funktionerna är SECURITY DEFINER och hoppar därför över RLS.
--
-- Widgeten påverkas inte: familj_widget_feed() är själv SECURITY DEFINER och anropar
-- de här funktionerna som ägaren, inte som anon. familj_widget_* lämnas orörda
-- (de kräver widget-koden). Inloggade föräldrar behåller åtkomst via authenticated.
-- Ångra: grant execute on function ... to anon;

revoke execute on function public.familj_barn_status(date, date) from public, anon;
revoke execute on function public.familj_grundpott(uuid, date)   from public, anon;
revoke execute on function public.familj_bonuspott(uuid, date)   from public, anon;
revoke execute on function public.familj_extrapott(uuid, date)   from public, anon;

grant execute on function public.familj_barn_status(date, date) to authenticated, service_role;
grant execute on function public.familj_grundpott(uuid, date)   to authenticated, service_role;
grant execute on function public.familj_bonuspott(uuid, date)   to authenticated, service_role;
grant execute on function public.familj_extrapott(uuid, date)   to authenticated, service_role;
