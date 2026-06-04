-- ================================================
-- Migration 018: Newsletter Consent Performance Index
-- ================================================
-- Created: 2026-01-11
-- Description: Add partial index for active newsletter consents
--              Optimizes queries for users with opt-in status
-- ================================================
-- ISSUE: Current index on newsletter_consent_log:
--        CREATE INDEX idx_newsletter_consent_email ON newsletter_consent_log(email);
--
--        This index includes ALL records (opt-in AND opt-out)
--        Most queries filter by consent_given = true
--        Example: "Which users have opted in to newsletter?"
-- ================================================
-- SOLUTION: Add partial index with WHERE clause
--           Smaller index → faster queries → less disk space
-- ================================================
-- PERFORMANCE IMPACT:
--   - Index size: ~50% smaller (only opt-in records)
--   - Query speed: Faster for "active subscribers" queries
--   - Write speed: Unchanged (inserts still fast)
-- ================================================
-- REFERENCES:
--   - https://www.postgresql.org/docs/current/indexes-partial.html
--   - https://supabase.com/docs/guides/database/postgres/indexes
-- ================================================

-- Add partial index for active newsletter consents
-- Only indexes records where consent_given = true
CREATE INDEX IF NOT EXISTS idx_newsletter_consent_active
  ON newsletter_consent_log(email, created_at DESC)
  WHERE consent_given = true;

-- Add helpful comment
COMMENT ON INDEX idx_newsletter_consent_active IS
  'Partial index for active newsletter subscribers (consent_given = true). Optimizes queries for opt-in status.';

-- ================================================
-- USAGE EXAMPLES
-- ================================================
-- This index will be used for queries like:
--
-- 1. Get latest consent status for email:
--    SELECT * FROM newsletter_consent_log
--    WHERE email = 'user@example.com'
--      AND consent_given = true
--    ORDER BY created_at DESC
--    LIMIT 1;
--
-- 2. Count active subscribers:
--    SELECT COUNT(DISTINCT email)
--    FROM newsletter_consent_log
--    WHERE consent_given = true;
--
-- 3. Get all active subscribers:
--    SELECT DISTINCT ON (email) email, created_at
--    FROM newsletter_consent_log
--    WHERE consent_given = true
--    ORDER BY email, created_at DESC;
-- ================================================

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 018 completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Added partial index: idx_newsletter_consent_active';
  RAISE NOTICE '   - Columns: email, created_at DESC';
  RAISE NOTICE '   - Filter: WHERE consent_given = true';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ Performance improvements:';
  RAISE NOTICE '   - ~50%% smaller index size (only opt-in records)';
  RAISE NOTICE '   - Faster queries for active subscriber lists';
  RAISE NOTICE '   - Optimized for GDPR consent verification';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Best practice: Partial indexes for filtered queries';
END $$;
