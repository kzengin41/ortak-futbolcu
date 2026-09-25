-- ============================================================================
-- GÜVENLİK SERTLEŞTİRMESİ — 12 Eylül 2026
--
-- UX/yayın denetiminin bulduğu iki ciddi açığı kapatıyor. Uygulama kodunda
-- HİÇBİR DEĞİŞİKLİK GEREKTİRMEZ — mevcut çağrılar aynen çalışmaya devam eder,
-- sadece kötüye kullanım yolları kapanır.
--
-- ÇALIŞTIRMA: Supabase panelinde SQL Editor'e yapıştır ve çalıştır.
-- Tamamı idempotent (iki kez çalıştırmak zarar vermez).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) VERİ TABLOLARINDA RLS HİÇ AÇILMAMIŞTI
--
-- schema.sql clubs / players / player_clubs tablolarını oluşturuyor ama
-- yalnızca rooms ve rounds için RLS açıyor. Supabase'de public şemasındaki
-- tablolar PostgREST üzerinden yayınlanır ve anon rolüne varsayılan yetkiler
-- verilir. RLS kapalıyken anon anahtarı sahibi bu tabloları okumakla kalmaz,
-- YAZABİLİR, GÜNCELLEYEBİLİR VE SİLEBİLİR. O anahtar APK'nın içinde.
-- Tek bir DELETE isteği bütün oyuncu veritabanını silebilirdi.
-- ---------------------------------------------------------------------------
ALTER TABLE public.clubs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clubs herkes okur"        ON public.clubs;
DROP POLICY IF EXISTS "players herkes okur"      ON public.players;
DROP POLICY IF EXISTS "player_clubs herkes okur" ON public.player_clubs;

-- Bu veriler zaten herkese açık olmalı; sadece YAZMA kapatılıyor.
CREATE POLICY "clubs herkes okur"        ON public.clubs        FOR SELECT USING (true);
CREATE POLICY "players herkes okur"      ON public.players      FOR SELECT USING (true);
CREATE POLICY "player_clubs herkes okur" ON public.player_clubs FOR SELECT USING (true);


-- ---------------------------------------------------------------------------
-- 2) ODA VE TUR MUTASYONLARI SINIRSIZDI
--
-- step6_online.sql şunu yapıyordu:
--     CREATE POLICY ... ON rooms FOR UPDATE TO public USING (true);
-- WITH CHECK yazılmadığı için bu pratikte "herkes her satırı istediği değere
-- çevirebilir" demek. Sonuçları: başkasının odasının skorunu yazmak,
-- rounds.winner'ı ezmek, rooms.player2_id üzerine yazıp BAŞKASININ OYUNUNU
-- ELE GEÇİRMEK. Bu, schema.sql'in ilk satırlarında kurulan "hakem her zaman
-- sunucudur" mimarisini tamamen geçersiz kılıyordu.
--
-- Doğru nihai çözüm anonim oturum (auth.uid()) + ona dayalı politikalar; ama
-- o, istemci tarafında kimlik şemasını değiştirmeyi gerektiriyor. Buradaki
-- tetikleyiciler, uygulama koduna hiç dokunmadan en yıkıcı yolları şimdiden
-- kapatıyor: RLS politikaları OLD ve NEW satırlarını karşılaştıramaz,
-- tetikleyiciler karşılaştırabilir.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rooms_koruma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (bizim scriptlerimiz, edge function'lar) kısıtlardan muaf.
  IF coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Kimlik alanları değiştirilemez.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.player1_id IS DISTINCT FROM OLD.player1_id THEN
    RAISE EXCEPTION 'Oda kimliği değiştirilemez';
  END IF;

  -- İkinci oyuncu SADECE boşken atanabilir; sonradan üzerine yazılamaz
  -- (oyun ele geçirme yolu buydu).
  IF OLD.player2_id IS NOT NULL AND NEW.player2_id IS DISTINCT FROM OLD.player2_id THEN
    RAISE EXCEPTION 'İkinci oyuncu değiştirilemez';
  END IF;

  -- Skor yalnızca 0 veya 1 artabilir; asla azalamaz, asla sıçrayamaz.
  IF NEW.score1 < OLD.score1 OR NEW.score1 > OLD.score1 + 1
     OR NEW.score2 < OLD.score2 OR NEW.score2 > OLD.score2 + 1 THEN
    RAISE EXCEPTION 'Geçersiz skor değişimi';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rooms_koruma_trg ON public.rooms;
CREATE TRIGGER rooms_koruma_trg
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.rooms_koruma();


CREATE OR REPLACE FUNCTION public.rounds_koruma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.room_id IS DISTINCT FROM OLD.room_id THEN
    RAISE EXCEPTION 'Tur kimliği değiştirilemez';
  END IF;

  -- Tur bir kez sonuçlandıysa sonucu bir daha yazılamaz. "İlk buzz'layan
  -- kazanır" hakemliğini anlamlı kılan tek kural bu.
  IF OLD.resolved AND (
       NEW.winner IS DISTINCT FROM OLD.winner
       OR NEW.resolved IS DISTINCT FROM OLD.resolved
       OR NEW.buzzed_by IS DISTINCT FROM OLD.buzzed_by
     ) THEN
    RAISE EXCEPTION 'Sonuçlanmış tur değiştirilemez';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rounds_koruma_trg ON public.rounds;
CREATE TRIGGER rounds_koruma_trg
  BEFORE UPDATE ON public.rounds
  FOR EACH ROW EXECUTE FUNCTION public.rounds_koruma();


-- ---------------------------------------------------------------------------
-- 3) OnlineLobbyScreen'in kullandığı ama şemada HİÇ OLMAYAN kolon
--
-- screens/OnlineLobbyScreen.js hem .eq("is_ranked", ...) hem de
-- .insert({ is_ranked: ... }) yapıyor. Bu kolon hiçbir SQL dosyasında yok —
-- canlıda elle eklenmemişse oda kurma PostgREST hatasıyla düşüyor.
-- ---------------------------------------------------------------------------
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS is_ranked boolean NOT NULL DEFAULT false;


-- ---------------------------------------------------------------------------
-- 4) Avatar dosyaları silinemiyordu (KVKK/GDPR silme hakkı)
--
-- schema_cloud_sync.sql "avatars" bucket'ına yükleme ve okuma politikası
-- veriyor ama DELETE yok — kullanıcı yüklediği fotoğrafı kaldıramıyordu.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "kullanici kendi avatarini silebilir" ON storage.objects;
CREATE POLICY "kullanici kendi avatarini silebilir"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
