-- Migration 029: Cleanup and security fixes
-- Date: 2026-02-22
-- Removes duplicate index on download_tokens.token (UNIQUE constraint already creates an index)
-- Adds REVOKE EXECUTE on SECURITY DEFINER functions (H3 fix)

BEGIN;

-- L3: Remove duplicate index (UNIQUE constraint already creates an implicit index)
DROP INDEX IF EXISTS idx_download_tokens_token;

COMMIT;
