-- Add new columns for Advanced Motion Controls
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS camera_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS motion_reference_url TEXT;

-- Comment for documentation
COMMENT ON COLUMN jobs.camera_metadata IS 'Stores camera control parameters (pan, tilt, zoom, roll)';
COMMENT ON COLUMN jobs.motion_reference_url IS 'URL to the motion driving video reference';
