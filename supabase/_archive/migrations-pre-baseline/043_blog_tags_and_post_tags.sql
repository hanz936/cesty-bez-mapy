-- ================================================
-- Migration: 043_blog_tags_and_post_tags
-- Created: 2026-05-30
-- Description: Blog taxonomie — tabulka blog_tags + pole tag_ids na blog_posts.
--   Vzor migrace 009 (category_ids), NE join tabulka.
-- ================================================

-- 1) Tabulka tagů (Janin spravovaný seznam)
CREATE TABLE blog_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE blog_tags IS 'Tagy pro blogové články (spravované adminem)';

-- 2) Pole tag_ids na článku (M:N bez join tabulky, vzor category_ids)
ALTER TABLE blog_posts ADD COLUMN tag_ids uuid[] DEFAULT '{}';
COMMENT ON COLUMN blog_posts.tag_ids IS 'Pole ID tagů (vzor products.category_ids, migrace 009)';

-- 3) GIN index pro rychlý filtr „obsahuje tag" (PostgREST tag_ids=cs.{...})
CREATE INDEX idx_blog_posts_tag_ids ON blog_posts USING GIN(tag_ids);

-- 4) RLS na blog_tags: veřejné čtení (názvy nejsou citlivé), admin plný CRUD.
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_tags_public_read"
  ON blog_tags FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "blog_tags_admin_all"
  ON blog_tags FOR ALL
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Pozn.: blog_posts.tag_ids je součást řádku blog_posts → kryto stávající RLS blog_posts.
