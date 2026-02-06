-- Add monthly_limit to categories if it doesn't exist
alter table categories add column if not exists monthly_limit numeric default 0;

-- Optional: Create a view or function to compare expenses vs budget
-- But for now, the AI tool will handle the logic.
