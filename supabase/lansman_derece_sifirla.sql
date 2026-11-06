-- ============================================================================
-- LANSMAN — DERECE (ELO) SIFIRLAMA · 6 Kasım 2026
-- iOS 1.1.0 onaylandı; Android yayına çıkıyor. Test sırasında oynanan dereceli
-- maçlar (Kerem, test arkadaşı, Apple inceleme hesabı) liderlik tablosunda
-- görünmesin diye herkes 1000 puana döner ve maç geçmişi silinir.
--
-- Silinmeyen: hesaplar, takma adlar, profiller, XP/koleksiyon (cihazdaki ve
-- buluttaki ilerleme), şikâyet/engel kayıtları.
-- liderlik() yalnız mac > 0 olanları gösterdiği için tablo sıfırlandıktan
-- sonra boş görünür; ilk dereceli maçla dolmaya başlar.
--
-- Supabase → SQL Editor'da BİR KEZ çalıştır. Tekrar çalıştırmak zararsızdır
-- (yine sıfırlar), ama yayından SONRA çalıştırma: gerçek oyuncuların puanı gider.
-- ============================================================================
begin;

delete from public.derece_mac;

update public.derece
set puan = 1000,
    mac = 0,
    galibiyet = 0,
    beraberlik = 0,
    maglubiyet = 0,
    en_yuksek = 1000,
    seri = 0,
    guncellendi = now();

commit;

-- Kontrol: ikisi de 0 dönmeli.
select
  (select count(*) from public.derece_mac) as kalan_mac,
  (select count(*) from public.derece where mac > 0 or puan <> 1000) as sifirlanmamis;
