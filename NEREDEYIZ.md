# Neredeyiz? (5 Ekim 2026)

**Sürüm:** v3 (Android versionCode 3) — preview APK cihazda test edildi.
Bildirimler, ilk açılış, sesli cevap, günlük oyunlar ve EAS Update (OTA) çalışıyor.
Yayın öncesi tam liste: [`store/MAGAZA_PAKETI.md`](store/MAGAZA_PAKETI.md) → bölüm 6.

---

## Uygulamada neler var

| Bölüm | İçerik |
|---|---|
| Ana sayfa | Hemen Oyna, günlük oyunlar, seri, seviye |
| Tüm Modlar | Ortak Kulüp (kulüp×kulüp / kulüp×ülke / sen seç / çoktan seçmeli), 5 Kulüp, Futbolcu XOX, İlk Harften Bul, Harf Zinciri, Kim Bu Futbolcu? (Seri, Kadro Avı), Sunucu Modu (2–6 kişi) |
| Günlük | Günün Bulmacası, Günün Kadrosu, Günlük Kim Bu, Günlük 5 Kulüp, Günlük Izgara |
| Online | 7 mod: Ortak Kulüp, Takımı Sen Seç, **5 Kulüp (yeni)**, Futbolcu XOX, Kim Bu, İlk Harften Bul, Harfi Sen Seç — rastgele rakip / arkadaşla oda kodu / meydan okuma (çevrimdışı) |
| Ansiklopedi | ~46.000 futbolcu, takımlar ve sezon kadroları (307 sezonun ilk 11'i) |
| Profilim | Seri, seviye, son açılanlar, istatistikler (açılır-kapanır), hesap |
| Ayarlar | Ses, tema, eşleşme profili, sesli cevap, mod varsayılanları (üstte kısayollar) |

## Sırada ne var

**Kerem'in yapacakları**

1. Online'ı iki cihazda dene (özellikle yeni 5 Kulüp ve yeni lobi düzeni).
2. Sesli cevap fonksiyonunun boyut sınırını yükle: `supabase functions deploy transcribe`
3. Sentry → Project Settings → Security & Privacy → **Prevent Storing of IP Addresses** aç.
4. 9–10 Ekim: Supabase → Usage'da depolama 1 GB'ın altına indi mi bak (ayrıntı aşağıda).
5. Kapalı test kullanıcılarını topla; Play Console mağaza formlarını doldur (MAGAZA_PAKETI bölüm 6).
6. İlk 11'lerde hata görürsen kulüp + sezon yaz.

**Benim tarafımda açık kalanlar**

- Cihaz testinden gelecek geri bildirimler (online, kadrolar).
- Mağaza ekran görüntüleri için ekran listesi (istenirse).

## Supabase depolama notu

Panelde görünen "Storage Size" o fatura döneminin **ortalaması** (GB-saat). Eylül
sonunda silinen eski PNG'ler (~2,3 GB) bu dönemin ortalamasını şişirdi; gerçek
kullanım ~270 MB. Kontrol için SQL Editor'da:

```sql
select bucket_id, (sum((metadata->>'size')::int)/1048576.0)::numeric(10,2) as mb
from storage.objects group by bucket_id order by mb desc;
```

Toplam 1 GB'ın altındaysa yeni dönemde (9 Ekim) uyarı kendiliğinden kalkar; Pro gerekmez.

## Gizli bilgiler — kurallar

- Supabase **service_role** anahtarı uygulamaya ASLA gömülmez; scriptlere yalnızca
  `--key` ya da `SUPABASE_SERVICE_KEY` ortam değişkeniyle verilir.
- OpenAI anahtarı yalnızca `supabase secrets` içinde; `.env`'e konmaz
  (`EXPO_PUBLIC_` ile başlayan her şey APK'ya gömülür).
- `.env` ve `veri/` depoya girmez (.gitignore). `SENTRY_AUTH_TOKEN` sadece expo.dev'de.

## Script'ler

| Dosya | İşi |
|---|---|
| `scripts/repo_toparla.py` | Depodaki eski yedek/rapor dosyalarını depo dışındaki arşive taşır (önce listeler, `--uygula` ile taşır) |
| `scripts/CALISTIR.py` | Eylül'deki fotoğraf/kadro hattı (yedek → kadro → foto → kontrol sayfası). Hat tamamlandı; yeniden gerekirse kullanılır |
| `scripts/kadro_guncelle.py` | Wikipedia'dan güncel kadrolar |
| `scripts/kadro_cek.py` | Sezon kadroları (Günün Kadrosu / Ansiklopedi → Takımlar) |
