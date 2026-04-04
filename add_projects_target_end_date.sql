-- Projelerde takvim hedef tarihi (Finansal Takvim’de gösterilir)
alter table projects add column if not exists target_end_date date;
