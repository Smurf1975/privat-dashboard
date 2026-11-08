-- Kunskap-fliken: kartan över Knowledge Base lagras som kind='kb' (id='graph') i os_items.
alter table public.os_items drop constraint os_items_kind_check;
alter table public.os_items add constraint os_items_kind_check
  check (kind in ('app','skill','mcp','plugin','run','kb'));
