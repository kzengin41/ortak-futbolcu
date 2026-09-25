-- 1. Rooms tablosuna game_mode alanı ekleyelim
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS game_mode text DEFAULT 'classic';

-- 2. Rounds tablosuna yeni modlar için gerekli kolonları ekleyelim
ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS game_state jsonb DEFAULT '{}'::jsonb;
-- game_state içinde whoami_player, clues, draft_team_a, draft_team_b, winner vb. her şeyi JSON olarak tutabiliriz!
-- Bu sayede backend'de her yeni mod için tabloyu değiştirmek zorunda kalmayız.

-- 3. RLS İzinlerini Esnetelim (İstemci Odaklı Mimari - Host-Client)
-- Who Am I ve Draft modlarında oyun motoru (gameEngine.js) karmaşık JSON verilerine ihtiyaç duyduğu için 
-- (örn: başarılar, kupalar), round üretimini Player 1 (Host) yapıp Supabase'e kaydedecek.
CREATE POLICY "Anonim kullanicilar rounds ekleyebilir" 
ON public.rounds FOR INSERT 
TO public 
WITH CHECK (true);

CREATE POLICY "Anonim kullanicilar rounds güncelleyebilir" 
ON public.rounds FOR UPDATE 
TO public 
USING (true);

-- Rooms tablosuna da aynısını yapalım (Draft modunda rakip kendi takımını seçecek vs)
CREATE POLICY "Anonim kullanicilar rooms güncelleyebilir" 
ON public.rooms FOR UPDATE 
TO public 
USING (true);
