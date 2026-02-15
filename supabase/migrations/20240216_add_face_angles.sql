-- Expand angle constraint to include face close-up angles
ALTER TABLE identity_views DROP CONSTRAINT IF EXISTS identity_views_angle_check;
ALTER TABLE identity_views ADD CONSTRAINT identity_views_angle_check
    CHECK (angle IN ('front', 'profile', 'three_quarter', 'face_front', 'face_side'));

-- Update unique constraint to cover new angles
ALTER TABLE identity_views DROP CONSTRAINT IF EXISTS identity_views_identity_id_angle_key;
ALTER TABLE identity_views ADD CONSTRAINT identity_views_identity_id_angle_key UNIQUE(identity_id, angle);
