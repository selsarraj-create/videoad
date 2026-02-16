-- ============================================================
-- Phase 1: SaaS Affiliate Engine — Schema
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Extend Profiles with subscription tier
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='subscription_status') THEN
        ALTER TABLE profiles ADD COLUMN subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'pro'));
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. Instagram Connections — OAuth tokens & IG profile
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instagram_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    ig_user_id TEXT NOT NULL,               -- Instagram-scoped user ID
    ig_username TEXT,                        -- @handle
    ig_profile_picture_url TEXT,
    page_id TEXT NOT NULL,                   -- Linked Facebook Page ID
    page_name TEXT,
    access_token TEXT NOT NULL,              -- Long-lived token (encrypted at rest by Supabase)
    token_expires_at TIMESTAMPTZ NOT NULL,
    scopes TEXT[] DEFAULT '{}',              -- Granted permission scopes
    account_type TEXT DEFAULT 'BUSINESS'     -- BUSINESS or CREATOR
        CHECK (account_type IN ('BUSINESS', 'CREATOR')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ig_connections_user ON instagram_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_ig_connections_ig_user ON instagram_connections(ig_user_id);
CREATE INDEX IF NOT EXISTS idx_ig_connections_token_expiry ON instagram_connections(token_expires_at);

ALTER TABLE instagram_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ig connection"
    ON instagram_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ig connection"
    ON instagram_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ig connection"
    ON instagram_connections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ig connection"
    ON instagram_connections FOR DELETE
    USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 3. Post Affiliate Links — Rakuten URLs mapped to IG posts
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_affiliate_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    ig_media_id TEXT NOT NULL,               -- Instagram post/reel media ID
    ig_media_url TEXT,                       -- Permalink to the post
    ig_media_thumbnail TEXT,                 -- Thumbnail for UI
    rakuten_link TEXT NOT NULL,              -- Base Rakuten affiliate URL
    product_name TEXT DEFAULT '',
    product_brand TEXT DEFAULT '',
    product_price NUMERIC(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, ig_media_id)
);

CREATE INDEX IF NOT EXISTS idx_post_links_user ON post_affiliate_links(user_id);
CREATE INDEX IF NOT EXISTS idx_post_links_media ON post_affiliate_links(ig_media_id);

ALTER TABLE post_affiliate_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own post links"
    ON post_affiliate_links FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 4. DM Log — Audit trail of automated messages
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dm_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    ig_recipient_id TEXT NOT NULL,           -- Recipient IG-scoped ID
    ig_recipient_username TEXT,
    message_type TEXT NOT NULL DEFAULT 'affiliate_link'
        CHECK (message_type IN ('affiliate_link', 'sizing_render', 'sizing_text', 'follow_up')),
    content TEXT,                            -- Message body (redacted PII)
    ig_media_id TEXT,                        -- Which post triggered it
    rakuten_link TEXT,                       -- Link sent (if any)
    sub_id TEXT,                             -- u1 tracking param
    disclosure_included BOOLEAN DEFAULT true,
    sent_at TIMESTAMPTZ DEFAULT now(),
    delivery_status TEXT DEFAULT 'sent'
        CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'rate_limited')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_log_user ON dm_log(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_log_sent ON dm_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_dm_log_recipient ON dm_log(ig_recipient_id);

ALTER TABLE dm_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dm log"
    ON dm_log FOR SELECT
    USING (auth.uid() = user_id);

-- Insert-only via service role (webhook handlers)
-- Users cannot insert/update/delete DM logs directly

-- ────────────────────────────────────────────────────────────
-- 5. Click Events — SubID-tracked affiliate clicks
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS click_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    sub_id TEXT NOT NULL,                    -- u1=user_{{id}}_post_{{id}}
    post_id TEXT,                            -- Extracted from sub_id
    rakuten_link TEXT,
    referrer TEXT,                           -- Where the click came from
    converted BOOLEAN DEFAULT false,
    commission_amount NUMERIC(10,2) DEFAULT 0,
    platform_fee_saved NUMERIC(10,2) DEFAULT 0,  -- vs LTK/ShopMy
    clicked_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clicks_user ON click_events(user_id);
CREATE INDEX IF NOT EXISTS idx_clicks_sub_id ON click_events(sub_id);
CREATE INDEX IF NOT EXISTS idx_clicks_date ON click_events(clicked_at);

ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clicks"
    ON click_events FOR SELECT
    USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 6. Rate Limit Tracking (lightweight, DB-based)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dm_rate_limits (
    ig_account_id TEXT PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    message_count INT NOT NULL DEFAULT 0
);

-- No RLS needed — only accessed by service role in webhooks
