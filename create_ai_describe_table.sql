-- Asistan: tablo kolonlarını information_schema'dan oku
-- Supabase SQL Editor'da çalıştırın.
-- Uygulama allowlist dışına çıkmaz; bu fonksiyon yalnızca public kolon meta döner.

create or replace function ai_describe_table(p_table text)
returns table (
  column_name text,
  data_type text,
  udt_name text,
  is_nullable text,
  column_default text,
  ordinal_position integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_table is null or p_table !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'invalid table name';
  end if;

  if not exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = p_table
      and t.table_type = 'BASE TABLE'
  ) then
    raise exception 'table not found: %', p_table;
  end if;

  return query
  select
    c.column_name::text,
    c.data_type::text,
    c.udt_name::text,
    c.is_nullable::text,
    c.column_default::text,
    c.ordinal_position::integer
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = p_table
  order by c.ordinal_position;
end;
$$;

grant execute on function ai_describe_table(text) to anon, authenticated, service_role;

notify pgrst, 'reload config';
