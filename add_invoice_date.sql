
-- Add invoice_date column to incomes table
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS invoice_date date;

-- Optionally, backfill existing records to have invoice_date = date
UPDATE incomes SET invoice_date = date WHERE invoice_date IS NULL;
