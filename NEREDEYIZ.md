# Neredeyiz? (15 Ekim 2026)

**Sürüm:** v5 (Android versionCode 5, yalnız arm64/armeabi) + OTA güncellemeleri.
Bildirimler, ilk açılış, sesli cevap, günlük oyunlar ve EAS Update (OTA) çalışıyor.
Yayın öncesi tam liste: [`store/MAGAZA_PAKETI.md`](store/MAGAZA_PAKETI.md) → bölüm 6.

---

## Uygulamada neler var

| Bölüm | İçerik |
|---|---|
| Ana sayfa | Hemen Oyna, tek satır günlük öneri (önce Günün Kadrosu), Tüm modlar, seri, seviye |
| Tüm Modlar | Ortak Kulüp (kulüp×kulüp / kulüp×ülke / sen seç / çoktan seçmeli), 5 Kulüp, Futbolcu XOX, İlk Harften Bul, Harf Zinciri, Kim Bu Futbolcu? (Seri, Kadro Avı), Sunucu Modu (2–6 kişi) |
| Günlük | Günün Bulmacası, Günün Kadrosu, Günlük Kim Bu, Günlük 5 Kulüp, Günlük Izgara |
| Online | 8 mod (Ortak Kulüp: Kulüp × Kulüp / Kulüp × Ülke / Takımı Sen Seç, 5 Kulüp, Futbolcu XOX, Kim Bu, İlk Harften Bul, Harfi Sen Seç). **Hızlı Eşleş**, rastgele rakip = **dereceli** (online puan / ELO, lig rozetleri, liderlik tablosu), arkadaş odası = dostluk, meydan okuma (çevrimdışı) |
| Ansiklopedi | ~46.000 futbolcu, takımlar ve sezon kadroları (307 sezonun ilk 11'i) |
| Profilim | Seri, seviye, son açılanlar, istatistikler (açılır-kapanır, varsayılan kapalı), hesap |
| Ayarlar | Ses, tema, eşleşme profili, sesli cevap, mod varsayılanları (üstte kısayollar) |

## Sırada ne var

**Kerem'in yapacakları**

1. Supabase → Authentication → **Allow anonymous sign-ins** aç, sonra SQL Editor'da `supabase/paket23_derece.sql` çalıştır, hemen ardından `eas update`.
1b. SQL Editor'da **`supabase/paket36_online.sql`** (Paket 36: düelloda süre bitince donma düzeltmesi, Hızlı Eşleş turu 30 sn, tek tur kaydı). İki kez çalıştırmak zarar vermez.
1c. SQL Editor'da **`supabase/paket37_online.sql`** (Paket 37: arkadaş odasında da tur 30 sn). paket36'dan sonra.
2. Online'ı iki telefonda dene: [`store/ONLINE_TEST_LISTESI.md`](store/ONLINE_TEST_LISTESI.md).
3. `supabase functions deploy transcribe`; Sentry → **Prevent Storing of IP Addresses**; Supabase depolama kontrolü (aşağıda).
4. Play Console formları (Veri Güvenliği satırları Paket 23'le değişti — MAGAZA_PAKETI bölüm 4), 8 ekran görüntüsü, production `.aab`, **kapalı test** (15–18 kişi, 14 gün).

**Benim tarafımda açık kalanlar**

- Kapalı testten gelecek hatalar (OTA ile).
- Ölçüm verisinden haftalık özet (`supabase/olcum_sorgulari.sql`).

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
