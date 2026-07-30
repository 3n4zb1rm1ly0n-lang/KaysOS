-- Hesaplama: kalem sonuç etkisi (kesinti / ek / dahil etme)
alter table company_finance_calc_lines
  add column if not exists result_effect text not null default 'deduction';

update company_finance_calc_lines
set result_effect = 'addition'
where is_deduction = false;

notify pgrst, 'reload config';
