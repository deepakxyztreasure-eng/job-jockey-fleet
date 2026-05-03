-- Add new job statuses
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'completion_requested';
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'issue';