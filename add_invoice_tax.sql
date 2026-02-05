
-- Add tax_rate column to recurring_expenses
ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS tax_rate numeric default 0;
