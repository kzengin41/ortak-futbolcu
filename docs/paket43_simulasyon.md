# Paket 43 — Bütün modların simülasyonu (29 Ekim 2026)

Kerem: *"online-offline tüm modları simüle et ve simülasyon analizini bana gönder. eşleştirme profilleri doğru çalışıyor mu? çeşitlilik az mı? nasıl daha iyi olabilir?"*

**Nasıl ölçüldü:** Her mod, uygulamadaki üretici fonksiyonlarla çalıştırıldı. Ölçülen 7 hazır profil ve "Dengeli + tuttuğun takım Galatasaray (Sık)" oldu. Her satır 300 turun ölçümüdür; 10 tur bir oyun sayıldı. Online Ortak Kulüp için sunucudaki çift havuzu (1.120 çift) ve sunucunun seçme kuralı kopyalandı. Ham tablolar `docs/paket43_simulasyon_ham.md` dosyasında (önce/sonra). Betik test düzeneğinde: `t42/sim43.mjs`.

---

## 1. Kısa cevap

| Soru | Cevap |
|---|---|
| Eşleşme profili çalışıyor mu? | **Ortak Kulüp ve XOX'ta evet.** 5 Kulüp ve Kim Bu'da büyük ölçüde **çalışmıyordu**; düzeltildi. Online'da yalnız kulüp süzgeci olarak çalışıyor; tuttuğun takım ve dönem online'a hiç geçmiyor (§4). |
| Çeşitlilik az mı? | Geniş profillerde (Dengeli, Dünya, 5 Büyük Lig) **yeterli**. Dar profillerde (Süper Lig, Türkiye) ve **Günün Izgarası**'nda azdı. Günün Izgarası en kötüsüydü: Man City günlerin üçte birinde. |
| Hata var mıydı? | Evet, 5 gerçek hata bulundu ve düzeltildi (§2). |

---

## 2. Bulunan hatalar ve düzeltmeler

### 2.1 5 Kulüp — profil uygulanmıyordu
- **Süper Lig profili:** Zorluk havuzunda yalnız 4 Türk kulübü vardı. Kod 8'in altındaki süzülmüş havuzu yok sayıyordu, yani **profil hiç uygulanmıyordu**: Türk kulübü payı %24'te kalıyordu.
- **Türkiye profili:** "En fazla 2 Türk kulübü" sınırı yüzünden her turda 3 İngiliz kulübü geliyordu. Yalnız 16 kulüp dönüyordu, art arda turlarda %34 tekrar vardı (Trabzonspor %63, Everton %39).
- **Düzeltme:**
  - Dar ya da Türkiye ağırlıklı profilde havuz geniş listeden tamamlanıyor; 18 ek Türk kulübü geldi (Gençlerbirliği, Gaziantep FK, Ankaragücü…).
  - Türk kulübü sınırı profile göre değişiyor: Dengeli 2, Türkiye 4, Süper Lig 5.

| 5 Kulüp | Türk kulübü payı | Farklı kulüp | Art arda tekrar |
|---|---|---|---|
| Süper Lig — önce | %24 | 53 | %5 |
| Süper Lig — **sonra** | **%100** | 22 | %5 |
| Türkiye — önce | %22 | 16 | %34 |
| Türkiye — **sonra** | **%71** | **38** | **%0** |

### 2.2 İskoç kulüpleri "İngiltere" sayılıyordu
- `clubCountries.json` Rangers, Celtic, Aberdeen gibi kulüpleri "United Kingdom" diye tutuyor, bu yüzden İngiltere karosuna giriyorlardı.
- Türkiye profilinde (Türkiye + İngiltere) XOX ızgaralarının **%24'ünde Rangers, %23'ünde Celtic** vardı.
- **Düzeltme:** İskoç, Kuzey İrlanda ve Galler ligi kulüpleri "Diğer Avrupa" karosuna taşındı. Bu düzeltme bütün modları etkiliyor.

### 2.3 XOX'ta alt lig kulüpleri öne çıkıyordu
- İskoç düzeltmesinden sonra Türkiye profilinde en sık kulüpler **Milton Keynes Dons (%25) ve Swansea City (%21)** oldu. Bu kulüpler çok kiralık oyuncu aldıkları için "tanınmış oyuncu" eşiğini geçiyorlar.
- **Düzeltme:** Profil varken Türk olmayan ve "büyük" sayılmayan kulüplerin ağırlığı ×0,25. "Büyük", güncel üst lig, Şampiyonlar Ligi ya da tanınan kulüp demek. "Dünya" profilinde bu ceza yok.

| XOX (zorluk 4) | Türk kulübü payı | Farklı kulüp | En sık |
|---|---|---|---|
| Türkiye — önce | %52 | 80 | Rangers %24, Celtic %23, Eyüpspor %22 |
| Türkiye — **sonra** | **%64** | 76 | Alanyaspor %26, Karagümrük %25, GS %25 |
| Dengeli — önce | %26 | 209 | Trabzonspor %13, Fenerbahçe %13, GS %12 |
| Dengeli — **sonra** | **%36** | 192 | Fenerbahçe %17, Trabzonspor %15, Beşiktaş %14 |

### 2.4 Kim Bu — profil yalnız süzgeçti, dönem hiç işlemiyordu
- **Profil:** Profildeki herhangi bir kulüpte oynamış olmak yetiyordu. Türkiye profilinde soruların yalnız %36'sı Türk kulübünde oynamış futbolculardı (Dengeli %26). Tuttuğun takım hiç öne çıkmıyordu.
- **Dönem:** Nostalji profilinin dönem seçimi Kim Bu'ya hiç geçmiyordu. 2010 öncesi futbolcu oranı Nostalji'de %21, Dengeli'de %13'tü.
- **Tekrar:** Başlangıç seviyesinde aynı isimler sık tekrarlıyordu (Suárez 300 soruda 10 kez).
- **Düzeltme:**
  - Seviyenin tanınırlık aralığı aynen korunuyor. 4 Ekim kuralı geçerli: profil kimseyi sıralamada yukarı taşımaz.
  - Aralığın *içinden* seçim profil ağırlıklı: Türk kulübü ağırlıklıysa ~2,3 kat, tuttuğun takım ~3 kat.
  - Profilin dönemi uygulanıyor.
  - Son 60 sorulan futbolcu ×0,2 ile cezalı; bu geçmiş oyunlar arasında da sürüyor.

| Kim Bu (seviye 3) | Türk kulübünde oynamış | 2010 öncesi |
|---|---|---|
| Dengeli — önce → **sonra** | %26 → **%37** | %13 → %15 |
| Türkiye — önce → **sonra** | %36 → **%47** | %8 → %9 |
| Dengeli + GS Sık — önce → **sonra** | %23 → **%36** | — |
| Nostalji — önce → **sonra** | %28 → %28 | %21 → **%58** |

### 2.5 Günün Izgarası — eski üreticiyle kurulmuş takvim
- Günlük ızgara, 12 Eylül'de 730 gün için önceden üretilen sabit takvimden geliyor. Bu takvim Paket 42'den **önceki** üreticiyle kurulmuştu.
- 365 günde yalnız **55 farklı kulüp** vardı. Man City 123 gün, Liverpool 113, Man United 112 gün çıkıyordu. Kerem'in "hep aynı takımlar" şikayeti günlük ızgarada da geçerliydi.
- **Düzeltme:** Takvim **#56. günden (6 Kasım 2026)** itibaren yeni üreticiyle yeniden kuruldu. Geçmiş günler aynen duruyor; herkes aynı gün aynı ızgarayı görür kuralı korunuyor.

| Günün Izgarası (365 gün) | Farklı ızgara | Farklı kulüp/koşul | En sık |
|---|---|---|---|
| Önce | 221 | 55 | Man City 123, Liverpool 113, Man United 111 |
| **Sonra** | **361** | **180** | GS 105, Fenerbahçe 102, Beşiktaş 80, Chelsea 63 |

### 2.6 Ortak Kulüp / Kulüp × Ülke — oyunlar arası tekrar
- Kullanılan çiftler yalnız *oyun içinde* tutuluyordu; bir sonraki oyunda aynı çiftler gelebiliyordu.
- **Düzeltme:** Uygulama açık kaldıkça son 40 çift, ilk denemelerde atlanıyor.

| Ortak Kulüp (zorluk 5) — 300 turda farklı çift | Önce | Sonra |
|---|---|---|
| Dengeli | 211 | **223** |
| Türkiye | 137 | **160** |
| Süper Lig | 112 | **127** |

---

## 3. Mod mod durum (düzeltmelerden sonra)

| Mod | Profil çalışıyor mu? | Çeşitlilik | Not |
|---|---|---|---|
| Ortak Kulüp · Kulüp × Kulüp | ✅ Türkiye %71 Türk kulübü, 5 Büyük Lig %0, GS Sık → GS turların %35'inde | ✅ geniş profilde 220+/300 | Süper Lig dar: 28 kulüp |
| Ortak Kulüp · Kulüp × Ülke | ✅ | ⚠️ Süper Lig: 300 turda 42 farklı tur, 13 kulüp | Yapısal (bkz. §4.3) |
| 5 Kulüp | ✅ (düzeltildi) | ✅ art arda tekrar %0–5 | |
| Futbolcu XOX | ✅ | ✅ 300'de 260+ farklı ızgara | Süper Lig profilinde Alanyaspor %57 (bkz. §4.2) |
| Kim Bu (CPU) | ✅ (düzeltildi) | ✅ | |
| İlk Harf / Harfi Sen Seç | ✅ (cevap havuzunu süzer) | — harf rastgele | Ölçülecek bir çeşitlilik sorunu yok |
| Online Ortak Kulüp | ⚠️ yalnız kulüp süzgeci | ✅ dereceli 261/300, 107 kulüp | Tuttuğun takım / dönem online'a geçmiyor |
| Online XOX | ✅ (Paket 42) | ✅ | |
| Online 5 Kulüp | ✅ | ✅ | |
| Online Kim Bu | ❌ profil hiç yok (arkadaş odasında da) | ✅ 300'de 215+ farklı | Bilerek böyle (en tanınmış 500) |
| Online Kulüp × Ülke | ✅ | ⚠️ 300'de 144 | |
| Günün Izgarası | sabit Dengeli | ✅ (düzeltildi) | |
| Günün Kadrosu | — | ⚠️ 141 günlük döngü | ~4,5 ayda bir başa dönüyor |
| Günün 5 Kulübü | — | ⚠️ 53 kulüp, Barcelona 365 günde 85 kez | Eski üretici, ama kabul edilebilir |

---

## 4. Senin kararın gereken öneriler

**4.1 Online Ortak Kulüp'te tuttuğun takım ve dönem**
- Sunucu çifti, izin verilen kulüpler içinden **düz rastgele** seçiyor. Arkadaş odasında "GS Sık" seçsen de GS %5'te kalıyor; Nostalji ile Dengeli aynı 961 çifte bakıyor.
- **Çözüm:** `generate_round` fonksiyonuna kulüp ağırlıkları parametresi eklenir. Bir SQL değişikliği ve bir istemci değişikliği gerekir; istemci tarafı OTA ile gider, yeni build gerekmez.
- Dereceli maçı etkilemez.

**4.2 XOX "Süper Lig" profili**
- Alanyaspor %57, Eyüpspor %55, Karagümrük %45; GS yalnız %18.
- **Sebep yapısal:** Zorluk 4'te her karede en az 4 *tanınmış* ortak futbolcu gerekiyor. GS'nin bu kurala uyan Türk komşusu 6, Alanyaspor'un 20. Kariyerinin sonunda Alanyaspor / Eyüpspor / Karagümrük'e uğrayan yıldızlar bu kulüpleri "merkez" yapıyor.
- **Seçenek A:** Yalnız Türk kulüplü profilde tanınmışlık eşiği 95 → 90. Büyükler daha sık gelir, kareler biraz zorlaşır.
- **Seçenek B:** Olduğu gibi kalsın.

**4.3 Kulüp × Ülke "Süper Lig"**
- 13 kulüp ve 300 turda 42 farklı tur var. Zorluk 5'te yeterli cevabı olan "Türk kulübü × ülke" ikilisi az.
- **Öneri:** Dar profilde zorluk eşiğini bir kademe gevşetmek.

**4.4 Dereceli maçın "standart profili" dile bağlı**
- Odayı kuran Türkçe ise Dengeli, İngilizce ise Şampiyonlar Ligi oluyor (Paket 39'daki İngilizce varsayılan).
- Aynı maçta iki taraf zaten aynı soruyu görüyor; adaletsizlik yok, yalnız tutarsızlık var.
- **Öneri:** Dereceli her zaman Dengeli olsun mu, karar senin.

**4.5 Günün Kadrosu**
- Takvimde 141 efsane maç var; ~4,5 ayda bir başa dönüyor (365 günde 133 farklı kadro). Kadro havuzunda 465 kadro var ama yalnız efsane maçlar kullanılıyor.
- **Öneri:** Yeni efsane maçlar eklemek ya da sezon kadrolarını da günlük sıraya katmak.

**4.6 Online Kim Bu arkadaş odası**
- Arkadaş odasında da profil yok; hep en tanınmış 500 futbolcu.
- **Öneri:** Arkadaş odasında kuranın profilini uygulamak, dereceli aynen kalsın.

**4.7 Başka liglerin şampiyonlukları**
- Uğurcan Çakır sorunu Süper Lig'e özgü değil. Özgeçmiş verisindeki ödüller genel olarak eksik.
- Süper Lig için kariyer verisinden çıkarım yapıldı: 420 → 663 şampiyon.
- **Öneri:** Aynı yöntemle Premier Lig, La Liga, Serie A, Bundesliga ve Ligue 1 de doldurulabilir.
