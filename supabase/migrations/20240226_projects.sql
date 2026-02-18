-- ============================================================
-- Projects Table — Add VTO Pipeline State & Scene History
-- ============================================================
-- NOTE: A `projects` table already exists (linked to workspaces).
-- This migration adds the VTO pipeline columns to the existing table.

-- ────────────────────────────────────────────────────────────
-- 1. Project status enum
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        CREATE TYPE project_status AS ENUM (
            'DRAFT',
            'SCENE_GENERATED',
            'OUTFIT_SELECTED',
            'PROCESSING_VIDEO',
            'COMPLETED'
        );
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. Add VTO pipeline columns to existing projects table
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- Direct user reference (existing table uses workspace_id → workspaces.user_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='user_id') THEN
        ALTER TABLE projects ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;

    -- Identity reference
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='identity_id') THEN
        ALTER TABLE projects ADD COLUMN identity_id UUID;
    END IF;

    -- Pipeline status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='pipeline_status') THEN
        ALTER TABLE projects ADD COLUMN pipeline_status project_status DEFAULT 'DRAFT';
    END IF;

    -- Credit tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='credits_paid') THEN
        ALTER TABLE projects ADD COLUMN credits_paid BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;

    -- Reroll tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='reroll_count') THEN
        ALTER TABLE projects ADD COLUMN reroll_count INTEGER DEFAULT 0 NOT NULL;
    END IF;

    -- Scene history (JSONB array of { id, url, prompt, created_at })
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='scene_history') THEN
        ALTER TABLE projects ADD COLUMN scene_history JSONB DEFAULT '[]'::jsonb NOT NULL;
    END IF;

    -- Which scene is currently selected
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='active_scene_index') THEN
        ALTER TABLE projects ADD COLUMN active_scene_index INTEGER DEFAULT 0 NOT NULL;
    END IF;

    -- Generation prompt
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='prompt') THEN
        ALTER TABLE projects ADD COLUMN prompt TEXT;
    END IF;

    -- Pipeline outputs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='fashn_render_url') THEN
        ALTER TABLE projects ADD COLUMN fashn_render_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='veo_video_url') THEN
        ALTER TABLE projects ADD COLUMN veo_video_url TEXT;
    END IF;

    -- Timestamps (if not already present)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='updated_at') THEN
        ALTER TABLE projects ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3. Indexes
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_pipeline_status ON projects(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- ────────────────────────────────────────────────────────────
-- 4. Backfill user_id from workspace chain for existing rows
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='workspace_id') THEN
        UPDATE projects p
        SET user_id = w.user_id
        FROM workspaces w
        WHERE p.workspace_id = w.id AND p.user_id IS NULL;
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 5. Auto-update updated_at trigger
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_projects_updated_at();

-- ────────────────────────────────────────────────────────────
-- 6. Reroll limit constraint (max 3)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reroll_limit') THEN
        ALTER TABLE projects ADD CONSTRAINT chk_reroll_limit
            CHECK (reroll_count >= 0 AND reroll_count <= 3);
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 7. RLS policy for the new user_id column
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'projects' AND policyname = 'Users can view own projects by user_id'
    ) THEN
        EXECUTE 'CREATE POLICY "Users can view own projects by user_id" ON projects FOR SELECT USING (auth.uid() = user_id)';
    END IF;
END $$;
