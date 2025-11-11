-- ================================================
-- CESTY BEZ MAPY - Hotfix: Custom Access Token Hook
-- ================================================
-- Created: 2025-11-09
-- Description: Fix variable shadowing issue in custom_access_token_hook
-- Issue: PostgreSQL error "missing FROM-clause entry for table custom_access_token_hook"
-- Root cause: Using custom_access_token_hook.user_id for local variable instead of direct event parameter
-- Solution: Remove user_id from DECLARE and use (event->>'user_id')::uuid directly in WHERE clause
-- ================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  is_admin boolean;
BEGIN
  -- Extract claims from event
  claims := event->'claims';

  -- Check if user is admin - read user_id directly from event parameter
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (event->>'user_id')::uuid
    AND ur.role = 'admin'
  ) INTO is_admin;

  -- Add custom claims to JWT
  claims := jsonb_set(claims, '{is_admin}', to_jsonb(is_admin));
  claims := jsonb_set(claims, '{user_role}',
    to_jsonb(CASE WHEN is_admin THEN 'admin' ELSE 'user' END)
  );

  -- Return updated claims (Supabase will merge into JWT)
  RETURN jsonb_build_object('claims', claims);
END;
$$;

-- Verify the function was updated
SELECT 'Custom Access Token Hook successfully updated!' AS status;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Custom Access Token Hook hotfix applied successfully!';
  RAISE NOTICE '🔧 Fixed: Variable shadowing issue with user_id';
  RAISE NOTICE '📝 Change: Removed user_id from DECLARE, using event parameter directly';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NOTE: This fix was already applied via SQL Editor on 2025-11-09';
  RAISE NOTICE '          This file serves as documentation of the hotfix';
END $$;
