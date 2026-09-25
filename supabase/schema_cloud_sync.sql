-- ============================================================================
-- ORTAK FUTBOLCU — Faz 5 devamı (31 Ağustos 2026): gerçek fotoğraf avatarı +
-- Ansiklopedi/istatistik verisinin buluta yedeklenmesi.
--
-- Bu dosyayı da Supabase SQL Editor'de ÇALIŞTIR (schema_auth.sql'den SONRA —
-- profiles tablosunun zaten var olması gerekiyor).
-- ============================================================================

-- 1) Ansiklopedi (açılan futbolcular) ve istatistiklerin (galibiyet/mağlubiyet/
--    seri) buluta yedeklenmesi için profiles'a iki yeni jsonb kolon.
--    Basit tutuldu: ilişkisel tablolar yerine tek satırda JSON olarak
--    saklanıyor — cihaz-local AsyncStorage'daki formatın birebir aynısı,
--    ekstra dönüştürme gerekmiyor.
alter table public.profiles
  add column if not exists pokedex_unlocked jsonb not null default '[]'::jsonb,
  add column if not exists stats_json jsonb not null default '{}'::jsonb;

-- 2) Avatar fotoğrafları için Storage bucket. Herkes okuyabilir (public),
--    ama sadece giriş yapmış kullanıcı KENDİ klasörüne (kendi user id'si
--    adındaki klasöre) yazabilir.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatarlar herkese açık okunabilir"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "kullanıcı kendi avatar klasörüne yükleyebilir"
on storage.objects for insert
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "kullanıcı kendi avatarını güncelleyebilir"
on storage.objects for update
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
