-- Audit Logs Table for AI Assistant Actions
create table if not exists audit_logs (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  action_type text not null, -- e.g., 'mark_paid', 'update_due_date', 'create_expense'
  entity_id uuid, -- ID of the affected record (debt_id, expense_id, etc.)
  before_state jsonb, -- State of the record before change (optional)
  after_state jsonb, -- State of the record after change (optional)
  reason text, -- AI's reasoning for this action
  status text default 'success' -- success, failed
);

-- Enable RLS (Optional, but good practice)
alter table audit_logs enable row level security;

-- Allow read/write for authenticated users (or restrict as needed)
create policy "Enable all access for authenticated users" 
on audit_logs for all 
using (auth.role() = 'authenticated');
