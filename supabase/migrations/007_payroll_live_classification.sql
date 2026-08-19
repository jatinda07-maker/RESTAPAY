alter table if exists public.payroll_entries
  add column if not exists job_type text,
  add column if not exists labor_classification text,
  add column if not exists department text;

-- These fields allow payroll writes and realtime events to carry the classification
-- needed by Food/Alcohol cost and Manager Allocation immediately, without waiting
-- for a page reload or a secondary employee lookup.
