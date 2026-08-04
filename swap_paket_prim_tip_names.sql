-- İsim düzeltmesi: kazançlı sistem = sanal.
-- Daha önce 'hemen' olarak kaydedilen (yüksek prim) günleri 'sanal' yapar.
-- Bir kez çalıştırın.

update company_finance_paket_prim_days
set tip = case tip
  when 'hemen' then 'sanal'
  when 'sanal' then 'hemen'
  else tip
end
where tip in ('hemen', 'sanal');
