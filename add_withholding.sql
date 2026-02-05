
-- Add withholding columns to tax_entries and incomes tables
-- withholding_rate: Percentage of the tax that is withheld (e.g., 20)
-- withholding_amount: The calculated amount withheld

ALTER TABLE tax_entries ADD COLUMN IF NOT EXISTS withholding_rate numeric default 0;
ALTER TABLE tax_entries ADD COLUMN IF NOT EXISTS withholding_amount numeric default 0;

ALTER TABLE incomes ADD COLUMN IF NOT EXISTS withholding_rate numeric default 0;
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS withholding_amount numeric default 0;
