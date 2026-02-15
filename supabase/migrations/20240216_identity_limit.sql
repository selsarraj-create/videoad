-- Enforce a maximum of 5 identities per user
-- Uses a BEFORE INSERT trigger to reject inserts that would exceed the limit.

CREATE OR REPLACE FUNCTION check_identity_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO current_count
    FROM identities
    WHERE user_id = NEW.user_id;

    IF current_count >= 5 THEN
        RAISE EXCEPTION 'Identity limit reached. Maximum 5 identities per user.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_insert_identity_limit ON identities;
CREATE TRIGGER before_insert_identity_limit
    BEFORE INSERT ON identities
    FOR EACH ROW
    EXECUTE FUNCTION check_identity_limit();
