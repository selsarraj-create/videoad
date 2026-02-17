-- ============================================================================
-- Escrow Schema: PaymentIntent tracking on bounties, payouts_enabled on profiles
-- ============================================================================

-- 1. Escrow Status Enum
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE escrow_status AS ENUM ('unpaid', 'held', 'released', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add escrow columns to bounties
-- ============================================================================

ALTER TABLE bounties
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
    ADD COLUMN IF NOT EXISTS escrow_status escrow_status DEFAULT 'unpaid',
    ADD COLUMN IF NOT EXISTS amount_captured integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bounties_escrow_status ON bounties(escrow_status);
CREATE INDEX IF NOT EXISTS idx_bounties_stripe_pi ON bounties(stripe_payment_intent_id);

-- 3. Add payouts_enabled to profiles
-- ============================================================================

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS payouts_enabled boolean DEFAULT false;
