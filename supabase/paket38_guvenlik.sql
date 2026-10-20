-- ============================================================================
-- PAKET 38 — BİLDİR / ENGELLE (App Store kural 1.2, kullanıcı içeriği)
-- 20 Ekim 2026
--
-- Apple, kullanıcıların birbirini gördüğü uygulamalarda (bizde: online takma
-- adlar, liderlik tablosu) şunları istiyor: uygunsuz içeriği süzme (var:
-- _ad_uygun_mu), kullanıcıyı BİLDİRME, kullanıcıyı ENGELLEME ve bildirimlere
-- zamanında bakma. Bu dosya bildir + engelle tarafını kurar.
--
--   • engeller    : kim kimi engelledi. Engellenenle bir daha EŞLEŞİLMEZ
--                   (iki yönde de: engelleyen de engellenen de birbirinin
--                   odasına düşmez; kontrol lib/onlineLobi.js'te).
--   • sikayetler  : bildirimler. Takma ad ÜÇ farklı kişiden "uygunsuz ad"
--                   bildirimi alırsa ad OTOMATİK silinir ("Oyuncu" görünür).
--                   Diğer bildirimler Kerem'in bakması için tabloda bekler
--                   (bkz. olcum_sorgulari.sql sonundaki sorgu).
--   • liderlik2   : liderlik + oyuncu kimliği (satırdan bildir/engelle için);
--                   engellediğin oyuncunun adı sana "Engellenen oyuncu" görünür.
--
-- Supabase → SQL Editor'da BİR KEZ çalıştır. Tekrar çalıştırmak zararsız.
-- ============================================================================

create table if not exists public.engeller (
  engelleyen uuid not null references auth.users(id) on delete cascade,
  engellenen uuid not null references auth.users(id) on delete cascade,
  olusturuldu timestamptz not null default now(),
  primary key (engelleyen, engellenen),
  check (engelleyen <> engellenen)
);
create index if not exists engeller_engellenen_idx on public.engeller (engellenen);

create table if not exists public.sikayetler (
  id bigint generated always as identity primary key,
  sikayet_eden uuid not null references auth.users(id) on delete cascade,
  sikayet_edilen uuid not null references auth.users(id) on delete cascade,
  sebep text not null,                 -- ad | davranis | hile | diger
  aciklama text,
  baglam text,                         -- liderlik | mac_sonu:<mod>
  takma_ad text,                       -- bildirim anındaki ad (sonradan değişse de kalsın)
  durum text not null default 'yeni',  -- yeni | otomatik_ad_silindi | incelendi
  olusturuldu timestamptz not null default now()
);
create index if not exists sikayetler_edilen_idx on public.sikayetler (sikayet_edilen, sebep, olusturuldu);

alter table public.engeller enable row level security;
alter table public.sikayetler enable row level security;
-- Bilerek HİÇ policy yok: okuma/yazma yalnız aşağıdaki fonksiyonlarla.
revoke all on public.engeller, public.sikayetler from anon, authenticated;

-- ---------------------------------------------------------------- bildir
create or replace function public.oyuncu_bildir(p_oyuncu uuid, p_sebep text, p_aciklama text default null, p_baglam text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ben uuid := auth.uid();
  v_sebep text := case when p_sebep in ('ad', 'davranis', 'hile', 'diger') then p_sebep else 'diger' end;
  v_ad text;
  v_sayi int;
begin
  if ben is null then return jsonb_build_object('durum', 'oturum_yok'); end if;
  if p_oyuncu is null or p_oyuncu = ben then return jsonb_build_object('durum', 'gecersiz'); end if;
  if not exists (select 1 from auth.users u where u.id = p_oyuncu) then return jsonb_build_object('durum', 'gecersiz'); end if;
  -- Aynı kişiyi aynı sebeple 24 saatte bir kez bildirebilirsin (sel olmasın).
  if exists (
    select 1 from public.sikayetler s
    where s.sikayet_eden = ben and s.sikayet_edilen = p_oyuncu and s.sebep = v_sebep
      and s.olusturuldu > now() - interval '24 hours'
  ) then
    return jsonb_build_object('durum', 'zaten');
  end if;
  -- Kişi başı günde en fazla 30 bildirim.
  if (select count(*) from public.sikayetler s where s.sikayet_eden = ben and s.olusturuldu > now() - interval '24 hours') >= 30 then
    return jsonb_build_object('durum', 'sinir');
  end if;

  select d.takma_ad into v_ad from public.derece d where d.oyuncu = p_oyuncu;
  insert into public.sikayetler (sikayet_eden, sikayet_edilen, sebep, aciklama, baglam, takma_ad)
  values (ben, p_oyuncu, v_sebep, left(nullif(btrim(coalesce(p_aciklama, '')), ''), 300), left(p_baglam, 60), v_ad);

  -- Uygunsuz ad: aynı ad için 3 farklı kişiden bildirim → ad silinir.
  if v_sebep = 'ad' and v_ad is not null then
    select count(distinct s.sikayet_eden) into v_sayi
    from public.sikayetler s
    where s.sikayet_edilen = p_oyuncu and s.sebep = 'ad' and s.takma_ad = v_ad;
    if v_sayi >= 3 then
      update public.derece set takma_ad = null, guncellendi = now() where oyuncu = p_oyuncu and takma_ad = v_ad;
      update public.sikayetler set durum = 'otomatik_ad_silindi'
      where sikayet_edilen = p_oyuncu and sebep = 'ad' and takma_ad = v_ad and durum = 'yeni';
      return jsonb_build_object('durum', 'tamam', 'ad_silindi', true);
    end if;
  end if;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ---------------------------------------------------------------- engelle
create or replace function public.oyuncu_engelle(p_oyuncu uuid, p_engelle boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ben uuid := auth.uid();
begin
  if ben is null then return jsonb_build_object('durum', 'oturum_yok'); end if;
  if p_oyuncu is null or p_oyuncu = ben then return jsonb_build_object('durum', 'gecersiz'); end if;
  if coalesce(p_engelle, true) then
    if not exists (select 1 from auth.users u where u.id = p_oyuncu) then return jsonb_build_object('durum', 'gecersiz'); end if;
    if (select count(*) from public.engeller e where e.engelleyen = ben) >= 500 then
      return jsonb_build_object('durum', 'sinir');
    end if;
    insert into public.engeller (engelleyen, engellenen) values (ben, p_oyuncu) on conflict do nothing;
  else
    delete from public.engeller where engelleyen = ben and engellenen = p_oyuncu;
  end if;
  return jsonb_build_object('durum', 'tamam', 'engelli', coalesce(p_engelle, true));
end;
$$;

-- Eşleşmede kaçınılacak kimlikler: benim engellediklerim + beni engelleyenler.
-- Yön bilgisi verilmez (kim seni engellemiş öğrenilemez).
create or replace function public.engel_kimlikleri()
returns setof uuid language sql stable security definer set search_path = public as $$
  select e.engellenen from public.engeller e where e.engelleyen = auth.uid()
  union
  select e.engelleyen from public.engeller e where e.engellenen = auth.uid();
$$;

-- Ayarlar'daki "Engellediklerin" listesi (engeli kaldırmak için).
create or replace function public.engellediklerim()
returns table(oyuncu uuid, takma_ad text, olusturuldu timestamptz)
language sql stable security definer set search_path = public as $$
  select e.engellenen, coalesce(d.takma_ad, 'Oyuncu'), e.olusturuldu
  from public.engeller e left join public.derece d on d.oyuncu = e.engellenen
  where e.engelleyen = auth.uid()
  order by e.olusturuldu desc
  limit 500;
$$;

-- ---------------------------------------------------------------- liderlik2
-- liderlik() ile aynı sıralama + oyuncu kimliği + engel bilgisi.
create or replace function public.liderlik2(p_tur text default 'tum', p_limit int default 50)
returns table(sira int, oyuncu uuid, takma_ad text, puan int, mac int, deger int, ben boolean, engelli boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_ben uuid := auth.uid();
begin
  return query
    select l.sira, l.oyuncu,
      case when l.engelli then 'Engellenen oyuncu' else l.takma_ad end,
      l.puan, l.mac, l.deger, l.ben, l.engelli
    from (
      select x.*, exists (select 1 from public.engeller e where e.engelleyen = v_ben and e.engellenen = x.oyuncu) as engelli
      from (
        select * from (
          select (row_number() over (order by k.kazanc desc, d.puan desc))::int as sira, d.oyuncu,
                 coalesce(d.takma_ad, 'Oyuncu') as takma_ad, d.puan, k.n as mac, k.kazanc as deger, d.oyuncu = v_ben as ben
          from (
            select y.oyuncu, sum(y.d)::int as kazanc, count(*)::int as n from (
              select dm.p1 as oyuncu, dm.p1_sonra - dm.p1_once as d from public.derece_mac dm where dm.durum = 'islendi' and dm.islendi > now() - interval '7 days'
              union all
              select dm.p2, dm.p2_sonra - dm.p2_once from public.derece_mac dm where dm.durum = 'islendi' and dm.islendi > now() - interval '7 days'
            ) y group by y.oyuncu
          ) k join public.derece d on d.oyuncu = k.oyuncu
          where p_tur = 'hafta'
          union all
          select (row_number() over (order by d.puan desc, d.mac desc))::int, d.oyuncu,
                 coalesce(d.takma_ad, 'Oyuncu'), d.puan, d.mac, d.puan, d.oyuncu = v_ben
          from public.derece d
          where p_tur <> 'hafta' and d.mac > 0
        ) z
        order by z.sira
        limit least(greatest(p_limit, 1), 100)
      ) x
    ) l
    order by l.sira;
end;
$$;

-- ---------------------------------------------------------------- yetkiler
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.oyuncu_bildir(uuid, text, text, text) from anon';
    execute 'revoke all on function public.oyuncu_engelle(uuid, boolean) from anon';
    execute 'revoke all on function public.engel_kimlikleri() from anon';
    execute 'revoke all on function public.engellediklerim() from anon';
    execute 'revoke all on function public.liderlik2(text, int) from anon';
  end if;
end $$;
