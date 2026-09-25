# Neredeyiz? (7 Eylül 2026)

## Tek yapman gereken

```
python scripts/CALISTIR.py
```

Bu komut her şeyi doğru sırayla yapar: önce yedek alır, sonra kadroları
günceller, sonra fotoğrafları çeker, sonra kontrol sayfasını üretir.
Ctrl+C ile istediğin an durdurabilirsin — hepsi kaldığı yerden devam eder.

Fotoğrafları kendi Supabase'ine taşımak istersen (isteğe bağlı, sona bırak):

```
python scripts/CALISTIR.py --adim 4 --key <service_role anahtarının TAMAMI>
```

---

## Uygulamada BİTEN işler (test etmen yeterli)

| Konu | Durum |
|---|---|
| 5 Kulüp: hangi takımı kimin bulduğu (1/2 rozetleri) | bitti, test bekliyor |
| Geri sayım artık tam ekran; takımlar 3-2-1'den SONRA görünüyor | bitti, test bekliyor |
| Geri sayım sesi (İngilizce okuma yerine temiz bip tonları) | bitti, test bekliyor |
| Oyuncu fotoğrafına dokununca mini profil kartı | bitti, test bekliyor |
| İsim eşleştirme ("sosa" → José Sosa, artık en popüler eşleşme kazanıyor) | bitti, test bekliyor |
| Kulüp takma adları (Inter Milan = Internazionale, Barcelona = FC Barcelona) | bitti, test bekliyor |
| 27 klon oyuncunun birleştirilmesi (Gökhan İnler/Inler) | bitti |
| crypto.getRandomValues hatası | bitti |
| Arkaplan/butonların ekran kenarına değmemesi | bitti, doğrulandı |
| Cevap kutusunun kaydırılamaması | bitti, doğrulandı |

## AÇIK kalan tek uygulama sorunu

**Mikrofon.** Dört farklı yaklaşım denendi, sonuncusu (XMLHttpRequest) henüz
test edilmedi. Eğer o da olmazsa sıradaki adım kör deneme değil, Supabase'deki
`functions/v1/transcribe` fonksiyonunun kodunu birlikte incelemek.

## Bekleyen kararlar (acele yok)

- `sportsdb_dusuk_guven.csv` — emin olunamayan foto eşleşmeleri, senin onayın
- `resmi_olmayan_isimler.csv` — garip görünen oyuncu isimleri
- "5 Kulüp" modunun online sürümü — henüz yok
- Yayın öncesi cilalama listesi (gizlilik politikası, e-posta onayı vb.)

---

## Script'ler ne işe yarıyor (merak edersen)

| Dosya | İşi |
|---|---|
| `CALISTIR.py` | **Bunu çalıştır.** Aşağıdakileri sırayla yönetir. |
| `kadro_guncelle.py` | Wikipedia'dan güncel kadrolar → eksik transferler ve yeni oyuncular |
| `sportsdb_foto_cek.py` | TheSportsDB'den eksik fotoğraflar (kimlik doğrulamalı) |
| `foto_kontrol_sayfasi.py` | `foto_kontrol.html` — fotoğrafları gözle kontrol ızgarası |
| `supabase_foto_tasi.py` | Dış adreslerdeki fotoğrafları kendi Supabase'ine taşır |
