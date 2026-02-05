
-- Add entry_type column to distinguish between manual income and manual expense
-- Default to 'expense' for backward compatibility
ALTER TABLE tax_entries ADD COLUMN IF NOT EXISTS entry_type text DEFAULT 'expense';
