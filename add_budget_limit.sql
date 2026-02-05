
-- Add monthly_limit column to categories table for Budget features
ALTER TABLE categories ADD COLUMN IF NOT EXISTS monthly_limit numeric default 0;
