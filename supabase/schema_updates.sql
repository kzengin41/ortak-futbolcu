-- 1. Hata Bildirimleri Tablosu
CREATE TABLE IF NOT EXISTS public.reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    player_name text NOT NULL,
    reason text NOT NULL,
    device_id text,
    status text DEFAULT 'pending'::text
);

-- 2. Oyun İstatistikleri Tablosu
CREATE TABLE IF NOT EXISTS public.game_stats (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    mode_id text NOT NULL,
    device_id text,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- RLS (Row Level Security) Ayarları
-- Herkes tabloya ekleme yapabilir ama sadece adminler okuyabilir.
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_stats ENABLE ROW LEVEL SECURITY;

-- Insert politikaları
CREATE POLICY "Anonim kullanicilar rapor ekleyebilir" 
ON public.reports FOR INSERT 
TO public 
WITH CHECK (true);

CREATE POLICY "Anonim kullanicilar istatistik ekleyebilir" 
ON public.game_stats FOR INSERT 
TO public 
WITH CHECK (true);
