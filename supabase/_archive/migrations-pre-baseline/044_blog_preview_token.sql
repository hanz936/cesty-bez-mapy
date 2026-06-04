-- ================================================
-- Migration: 044_blog_preview_token
-- Created: 2026-05-30
-- Description: Per-post náhledový token pro náhled NEpublikovaných konceptů
--   přes Edge funkci get-blog-preview (service-role, token-gated).
--   Vzor 2026 best practice: preview API + tajný per-content token.
-- ================================================

ALTER TABLE blog_posts
  ADD COLUMN preview_token uuid NOT NULL DEFAULT gen_random_uuid();

COMMENT ON COLUMN blog_posts.preview_token IS
  'Tajný token pro náhled konceptu přes edge fn get-blog-preview (per článek, rotovatelný).';
