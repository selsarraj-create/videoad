-- Add 'data' JSONB column to projects for storing storyboard state
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN projects.data IS 'Stores the full project/storyboard state (shots, mode, model, etc.)';
