-- ============================================================================
-- ÖLÇÜM SORGULARI — Paket 23 (11 Ekim 2026)
-- Supabase → SQL Editor'da tek tek çalıştır (hepsi yalnız OKUR).
-- Veri: public.olaylar (uygulama: lib/olcum.js), public.derece / derece_mac.
-- ============================================================================

-- 1) Günlük aktif oyuncu (son 14 gün)
select date_trunc('day', zaman)::date as gun, count(distinct oyuncu) as oyuncu
from public.olaylar where zaman > now() - interval '14 days'
group by 1 order by 1;

-- 2) Geri gelme: ilk açılıştan sonraki 1. ve 7. günde tekrar açanların oranı
with ilk as (
  select oyuncu, min(zaman)::date as ilk_gun from public.olaylar where olay = 'acilis' group by oyuncu
), gunler as (
  select distinct oyuncu, zaman::date as gun from public.olaylar where olay = 'acilis'
)
select i.ilk_gun,
       count(*) as yeni,
       round(100.0 * count(*) filter (where exists (select 1 from gunler g where g.oyuncu = i.oyuncu and g.gun = i.ilk_gun + 1)) / count(*), 1) as gun1_yuzde,
       round(100.0 * count(*) filter (where exists (select 1 from gunler g where g.oyuncu = i.oyuncu and g.gun = i.ilk_gun + 7)) / count(*), 1) as gun7_yuzde
from ilk i group by 1 order by 1 desc;

-- 3) En çok oynanan modlar (son 7 gün, maç sonu sayısı ve oyuncu)
select mod, count(*) as mac, count(distinct oyuncu) as oyuncu
from public.olaylar where olay = 'mac_sonu' and zaman > now() - interval '7 days'
group by 1 order by 2 desc;

-- 4) Online eşleşme süresi (saniye) ve vazgeçme
select date_trunc('day', zaman)::date as gun,
       count(*) filter (where olay = 'online_eslesme') as eslesme,
       count(*) filter (where olay = 'online_iptal') as vazgecme,
       percentile_cont(0.5) within group (order by (veri->>'sn')::int) filter (where olay = 'online_eslesme') as medyan_sn
from public.olaylar where olay in ('online_eslesme', 'online_iptal') and zaman > now() - interval '14 days'
group by 1 order by 1;

-- 5) Dereceli maçlar: işlenen / iptal / sayılmayan (son 7 gün)
select durum, sebep, count(*) from public.derece_mac
where olusturuldu > now() - interval '7 days' group by 1, 2 order by 3 desc;

-- 6) Puan dağılımı (lig başına oyuncu)
select case when puan >= 1600 then 'Şampiyonlar Ligi' when puan >= 1400 then 'Süper Lig' when puan >= 1250 then '1. Lig'
            when puan >= 1100 then '2. Lig' when puan >= 900 then '3. Lig' else 'Amatör' end as lig,
       count(*) as oyuncu
from public.derece where mac > 0 group by 1 order by min(puan) desc;

-- 7) Hangi sürümler kullanılıyor (son 3 gün)
select surum, count(distinct oyuncu) from public.olaylar where zaman > now() - interval '3 days' group by 1 order by 2 desc;
