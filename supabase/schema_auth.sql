-- ============================================================================
-- ORTAK FUTBOLCU — Faz 5: Kullanıcı hesabı altyapısı (Supabase Auth)
-- 31 Ağustos 2026. Kerem'in isteği: "kullanıcı altyapısı kurulmalı. profil,
-- mail-şifre, avatar, bunların veritabanı bağlantıları vs. vs."
--
-- Bu dosyayı Supabase panelinde SQL Editor'e yapıştırıp ÇALIŞTIR (seed.sql'i
-- nasıl çalıştırdıysan aynı şekilde). Var olan hiçbir tabloya dokunmuyor,
-- sadece YENİ bir "profiles" tablosu ekliyor.
--
-- Not: Supabase projesinde Authentication > Providers'da "Email" sağlayıcısı
-- zaten varsayılan olarak açıktır — ekstra bir ayar gerekmiyor. İstersen
-- Authentication > Settings'ten "Confirm email" zorunluluğunu kapatabilirsin,
-- kapalıysa kullanıcı kayıt olur olmaz giriş yapabilir (test için pratik).
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_color text default '#8CFF6B', -- fotoğraf yerine ilk harf + renk avatarı (bkz. lib/cloudProfile.js)
  avatar_url text,                      -- ileride gerçek fotoğraf yüklenirse kullanılacak, şimdilik boş kalabilir
  xp int not null default 0,
  level int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Herkes sadece KENDİ profilini okuyup güncelleyebilir.
create policy "kullanıcı kendi profilini okuyabilir" on public.profiles
  for select using (auth.uid() = id);

create policy "kullanıcı kendi profilini güncelleyebilir" on public.profiles
  for update using (auth.uid() = id);

create policy "kullanıcı kendi profilini oluşturabilir" on public.profiles
  for insert with check (auth.uid() = id);

-- Yeni kullanıcı kayıt olduğunda (auth.users'a satır düşünce) otomatik
-- olarak boş bir profiles satırı oluşturan tetikleyici — standart Supabase
-- deseni. Bu sayede uygulama tarafında "profil yoksa oluştur" mantığı
-- yazmaya gerek kalmıyor.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
