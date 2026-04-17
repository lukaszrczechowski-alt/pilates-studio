-- ============================================================
-- MIGRACJA: Single-tenant → Multi-tenant (studio_id)
-- Uruchom w Supabase SQL Editor (kolejność ma znaczenie!)
-- ============================================================

-- 1. Tabela studios
CREATE TABLE IF NOT EXISTS studios (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name    TEXT NOT NULL,
  slug    TEXT UNIQUE NOT NULL,          -- np. "paula" → paula.studiova.app
  domain  TEXT UNIQUE,                   -- własna domena np. paulapilates.pl
  features JSONB NOT NULL DEFAULT '{}',  -- { "physio": false, "group_classes": true }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Wstaw studio Pauliny (zapamiętaj UUID — będzie potrzebny niżej)
INSERT INTO studios (name, slug, domain)
VALUES ('Paula Pilates', 'paula', 'paulapilates.pl')
ON CONFLICT (slug) DO NOTHING;

-- 3. Zapisz UUID Pauliny do zmiennej (używane dalej)
DO $$
DECLARE
  paulina_id UUID;
BEGIN
  SELECT id INTO paulina_id FROM studios WHERE slug = 'paula';

  -- 4. Dodaj kolumnę studio_id do wszystkich tabel
  ALTER TABLE profiles       ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id);
  ALTER TABLE classes        ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id);
  ALTER TABLE bookings       ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id);
  ALTER TABLE waitlist       ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id);
  ALTER TABLE tokens         ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id);
  ALTER TABLE token_history  ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id);
  ALTER TABLE notifications  ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id);
  ALTER TABLE class_ratings  ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id);
  ALTER TABLE class_messages ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id);
  ALTER TABLE class_templates ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id);

  -- 5. Przypisz istniejące dane do studia Pauliny
  UPDATE profiles        SET studio_id = paulina_id WHERE studio_id IS NULL;
  UPDATE classes         SET studio_id = paulina_id WHERE studio_id IS NULL;
  UPDATE bookings        SET studio_id = paulina_id WHERE studio_id IS NULL;
  UPDATE waitlist        SET studio_id = paulina_id WHERE studio_id IS NULL;
  UPDATE tokens          SET studio_id = paulina_id WHERE studio_id IS NULL;
  UPDATE token_history   SET studio_id = paulina_id WHERE studio_id IS NULL;
  UPDATE notifications   SET studio_id = paulina_id WHERE studio_id IS NULL;
  UPDATE class_ratings   SET studio_id = paulina_id WHERE studio_id IS NULL;
  UPDATE class_messages  SET studio_id = paulina_id WHERE studio_id IS NULL;
  UPDATE class_templates SET studio_id = paulina_id WHERE studio_id IS NULL;

  -- 6. NOT NULL po migracji danych
  ALTER TABLE profiles        ALTER COLUMN studio_id SET NOT NULL;
  ALTER TABLE classes         ALTER COLUMN studio_id SET NOT NULL;
  ALTER TABLE bookings        ALTER COLUMN studio_id SET NOT NULL;
  ALTER TABLE waitlist        ALTER COLUMN studio_id SET NOT NULL;
  ALTER TABLE tokens          ALTER COLUMN studio_id SET NOT NULL;
  ALTER TABLE token_history   ALTER COLUMN studio_id SET NOT NULL;
  ALTER TABLE notifications   ALTER COLUMN studio_id SET NOT NULL;
  ALTER TABLE class_ratings   ALTER COLUMN studio_id SET NOT NULL;
  ALTER TABLE class_messages  ALTER COLUMN studio_id SET NOT NULL;
  ALTER TABLE class_templates ALTER COLUMN studio_id SET NOT NULL;

END $$;

-- 7. Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_profiles_studio        ON profiles(studio_id);
CREATE INDEX IF NOT EXISTS idx_classes_studio         ON classes(studio_id);
CREATE INDEX IF NOT EXISTS idx_bookings_studio        ON bookings(studio_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_studio        ON waitlist(studio_id);
CREATE INDEX IF NOT EXISTS idx_tokens_studio          ON tokens(studio_id);
CREATE INDEX IF NOT EXISTS idx_token_history_studio   ON token_history(studio_id);
CREATE INDEX IF NOT EXISTS idx_notifications_studio   ON notifications(studio_id);
CREATE INDEX IF NOT EXISTS idx_class_ratings_studio   ON class_ratings(studio_id);
CREATE INDEX IF NOT EXISTS idx_class_messages_studio  ON class_messages(studio_id);
CREATE INDEX IF NOT EXISTS idx_class_templates_studio ON class_templates(studio_id);

-- ============================================================
-- 8. RLS: każdy user widzi TYLKO dane swojego studia
--    Zasada: studio_id musi = studio_id z profilu zalogowanego usera
-- ============================================================

-- Helper function: zwraca studio_id zalogowanego usera
CREATE OR REPLACE FUNCTION auth_studio_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT studio_id FROM profiles WHERE id = auth.uid()
$$;

-- CLASSES
DROP POLICY IF EXISTS "studio_isolation" ON classes;
CREATE POLICY "studio_isolation" ON classes
  FOR ALL USING (studio_id = auth_studio_id());

-- BOOKINGS
DROP POLICY IF EXISTS "studio_isolation" ON bookings;
CREATE POLICY "studio_isolation" ON bookings
  FOR ALL USING (studio_id = auth_studio_id());

-- WAITLIST
DROP POLICY IF EXISTS "studio_isolation" ON waitlist;
CREATE POLICY "studio_isolation" ON waitlist
  FOR ALL USING (studio_id = auth_studio_id());

-- TOKENS
DROP POLICY IF EXISTS "studio_isolation" ON tokens;
CREATE POLICY "studio_isolation" ON tokens
  FOR ALL USING (studio_id = auth_studio_id());

-- TOKEN_HISTORY
DROP POLICY IF EXISTS "studio_isolation" ON token_history;
CREATE POLICY "studio_isolation" ON token_history
  FOR ALL USING (studio_id = auth_studio_id());

-- NOTIFICATIONS
DROP POLICY IF EXISTS "studio_isolation" ON notifications;
CREATE POLICY "studio_isolation" ON notifications
  FOR ALL USING (studio_id = auth_studio_id());

-- CLASS_RATINGS
DROP POLICY IF EXISTS "studio_isolation" ON class_ratings;
CREATE POLICY "studio_isolation" ON class_ratings
  FOR ALL USING (studio_id = auth_studio_id());

-- CLASS_MESSAGES
DROP POLICY IF EXISTS "studio_isolation" ON class_messages;
CREATE POLICY "studio_isolation" ON class_messages
  FOR ALL USING (studio_id = auth_studio_id());

-- CLASS_TEMPLATES
DROP POLICY IF EXISTS "studio_isolation" ON class_templates;
CREATE POLICY "studio_isolation" ON class_templates
  FOR ALL USING (studio_id = auth_studio_id());

-- PROFILES: klient widzi tylko profile ze swojego studia
DROP POLICY IF EXISTS "studio_isolation" ON profiles;
CREATE POLICY "studio_isolation" ON profiles
  FOR ALL USING (studio_id = auth_studio_id());

-- STUDIOS: każdy może czytać (potrzebne do publicznego page i get-studio API)
ALTER TABLE studios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON studios FOR SELECT USING (true);

-- ============================================================
-- GOTOWE — sprawdź wynik:
-- SELECT slug, domain FROM studios;
-- SELECT count(*) FROM profiles WHERE studio_id IS NOT NULL;
-- ============================================================
