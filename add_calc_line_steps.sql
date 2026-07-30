-- Hesaplama satırları: kaynak + matematik adım zinciri
-- Supabase SQL Editor'da çalıştırın.

alter table company_finance_calc_lines
  add column if not exists source_type text not null default 'gross';

alter table company_finance_calc_lines
  add column if not exists source_line_id uuid references company_finance_calc_lines(id) on delete set null;

alter table company_finance_calc_lines
  add column if not exists steps jsonb not null default '[]'::jsonb;

-- Eski tek yüzde satırlarını bir adımlık zincire çevir
update company_finance_calc_lines
set steps = jsonb_build_array(
  jsonb_build_object('op', 'percent', 'value', coalesce(percentage, 0))
)
where steps = '[]'::jsonb
  and coalesce(percentage, 0) <> 0;

notify pgrst, 'reload config';
