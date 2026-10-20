# App Store Connect — 3-2-1: Bitir İşi (iOS 1.0.0)

Kopyala-yapıştır için hazır alanlar. Sıra, App Store Connect'teki ekranların sırasıdır.

---

## 1. Yeni uygulama oluştur (Uygulamalarım → + → Yeni Uygulama)

| Alan | Değer |
|---|---|
| Platform | iOS |
| Ad | `3-2-1: Bitir İşi` |
| Birincil dil | Türkçe |
| Paket kimliği (Bundle ID) | `com.kerem.ortakfutbolcu` (listede yoksa ilk `eas build` sonrası çıkar) |
| SKU | `ortakfutbolcu-ios` |
| Kullanıcı erişimi | Tam Erişim |

> Ad başkası tarafından alınmışsa yedek: `3-2-1: Bitir İşi – Futbol`

---

## 2. Uygulama bilgileri (App Information)

| Alan | Değer |
|---|---|
| Alt başlık (30) | `Ortak futbolcuyu ilk sen bul` |
| Birincil kategori | Oyunlar → alt kategoriler: **Bilgi Yarışması (Trivia)** + **Spor** |
| İkincil kategori | Spor |
| İçerik hakları | "Üçüncü taraf içeriği içeriyor mu?" → **Evet** (futbolcu isimleri/fotoğrafları, kulüp adları/armaları) |
| Yaş derecelendirmesi | Aşağıdaki 6. bölüme bak |

---

## 3. Fiyat ve bulunabilirlik

- Fiyat: **Ücretsiz**
- Ülkeler: **Türkiye** (uygulama tamamen Türkçe). İstersen Azerbaycan, Almanya, Hollanda, Belçika, KKTC/Kıbrıs da eklenebilir.

---

## 4. Sürüm sayfası (1.0 Gönderime Hazırlanıyor)

**Tanıtım metni (170):**
```
İki takım, tek ortak futbolcu! Kim Bu, XOX, 5 Kulüp ve online düellolarla futbol bilgini test et. Her gün yeni bulmaca, reklamsız.
```

**Açıklama:** Play Store'daki uzun açıklamanın aynısı (aşağıda).

**Anahtar kelimeler (100 — virgülden sonra boşluk yok, kulüp adı kullanma: Apple marka adlarını reddediyor):**
```
futbol,futbolcu,bilgi yarışması,quiz,trivia,süper lig,xox,kim bu,ortak,kulüp,maç,soru,tahmin
```

| Alan | Değer |
|---|---|
| Destek URL'si | `https://kzengin41.github.io/ortak-futbolcu/` |
| Pazarlama URL'si | `https://kzengin41.github.io/ortak-futbolcu/` |
| Gizlilik politikası URL'si | `https://kzengin41.github.io/ortak-futbolcu/` |
| Telif hakkı | `2026 Kerem Zengin` |
| Sürüm | `1.0.0` |
| Ekran görüntüleri | **6,9 inç iPhone** bölümüne 8 görsel (1_ortak → 8_profil). Diğer boyutlar otomatik ölçeklenir. iPad yok (tablet desteği kapalı). |
| Build | `eas submit` sonrası "Build" bölümünden seçilir |

**Uzun açıklama:**
```
İki takım gelir. İkisinde de forma giymiş futbolcuyu ilk söyleyen turu alır.
Kural bu kadar basit — zor olan, doğru ismi hafızandan zamanında çıkarmak.

3-2-1: Bitir İşi, 46.000'den fazla futbolcunun kariyerini içeren bir futbol bilgi oyunu. Tek başına, yanındaki arkadaşınla aynı telefonda ya da online rakiple oynayabilirsin.

▸ OYUN MODLARI
• Ortak Kulüp — İki kulüpte de oynamış futbolcuyu bul. Kulüp × Ülke ve "takımı sen seç" türleriyle.
• 5 Kulüp — Beş kulüp gelir; en çoğunda oynamış futbolcuyu söyleyen kazanır.
• Futbolcu XOX — 3×3 ızgarada satır ve sütunun ortak futbolcusunu söyle, kareyi kap. Kulüp, ülke ve kupa ızgaraları.
• Kim Bu Futbolcu? — İpucu kartlarını aç, gizli futbolcuyu bul; erken bilen çok puan alır.
• İlk Harf ve Harf Zinciri — Harfle başlayan futbolcuyu bul, zinciri koparma.
• Kadro Avı — Efsane bir kadronun gizli oyuncularını bul.
• Sunucu modu — 2–6 kişi aynı odada: sen okursun, onlar yarışır.

▸ ONLINE
Hızlı Eşleş ile saniyeler içinde rakip bul, puanlı maçlarda online puanını ve ligini yükselt. İstersen kodla arkadaşını odana çağır. Ortak Kulüp, 5 Kulüp, XOX, Kim Bu ve İlk Harf online oynanabilir.

▸ HER GÜN YENİ
Günün Bulmacası, Günün Kadrosu, Günlük Kim Bu, Günlük 5 Kulüp ve Günlük Izgara herkese aynı soruyu sorar. Sonucunu cevabı ele vermeden paylaş, serini bozma.

▸ SESLİ CEVAP
Yazmak yerine söyle. Konuşma tanıma futbolcu isimlerinin Türkçe okunuşunu da anlar.

▸ İLERLEME VE KOLEKSİYON
Bildiğin her futbolcu ansiklopedine eklenir. Seviye atla, rozet topla, günlük görevleri tamamla. Her gün bir mod "Günün modu" olur ve 2 kat XP verir.

▸ SANA GÖRE AYARLANIR
Kısa bir seviye testiyle zorluk sana göre başlar. Sadece Süper Lig mi, Şampiyonlar Ligi mi, tüm dünya mı — kapsamı sen seç; tuttuğun takım daha sık çıksın. Takımının renklerinde tema da var.

Hesap açmak zorunlu değil. Reklam yok. Oyun içi satın alma yok.

Futbol bilginle övünüyorsan, bu oyun onu ölçmek için var.
```

---

## 5. App Review bilgileri (incelemeciye not)

- Oturum açma gerekli mi: **Hayır** (demo hesap alanını boş bırak, "Oturum açma gerekli" kutusunu kaldır)
- İletişim: Kerem Zengin · telefonun · `KontStudioApps@gmail.com`

**Notlar (İngilizce — incelemeciler İngilizce okur):**
```
3-2-1: Bitir İşi is a Turkish football trivia game. No account is needed: all modes can be played immediately as a guest (an anonymous session is created automatically). An optional email account only syncs progress across devices; it can be deleted in-app from Profilim > Hesabım > "Hesabımı kalıcı olarak sil".

How to test quickly: open the app, finish the short intro, tap "OYNA" on the home screen to play "Ortak Kulüp" against the CPU. Two clubs are shown; type a player who played for both (e.g. Fenerbahçe × Galatasaray → "Burak Yılmaz").

Microphone: used only when the player taps the mic button to say a player's name instead of typing. Audio is sent to our server function for speech-to-text and is not stored.

Online modes match two real players. Players appear only as "Rakip" (opponent) during matches; the optional nickname shown in the league table is checked against a profanity filter on the server.

There are no ads, no in-app purchases and no tracking.
```

---

## 6. Yaş derecelendirmesi (App Store anketi)

Hepsine **Yok / Hayır** — yalnızca şunlar farklı:

| Soru | Cevap |
|---|---|
| Kullanıcı tarafından oluşturulan içerik | **Evet** (online takma ad) |
| Mesajlaşma / sohbet | Hayır |
| Reklam | Hayır |
| Kumar / şans oyunu, ödüllü yarışma | Hayır |
| Sınırsız web erişimi | Hayır |
| Yaş doğrulama / ebeveyn denetimi | Hayır |

Beklenen sonuç: düşük yaş sınırı (4+ / 9+ civarı; UGC nedeniyle Apple daha yüksek bir yaş da önerebilir — sorun değil).

---

## 7. Uygulama gizliliği (App Privacy — "veri etiketleri")

- Gizlilik politikası URL'si: yukarıdaki adres
- **İzleme (Tracking): Hayır** — hiçbir veri izleme için kullanılmıyor.

| Veri türü | Toplanıyor mu | Kullanıcıya bağlı mı | Amaç |
|---|---|---|---|
| İletişim bilgileri → **E-posta adresi** | Evet (yalnız hesap açarsa) | Evet | Uygulama işlevi |
| Kullanıcı içeriği → **Fotoğraflar** | Evet (yalnız profil fotoğrafı yüklerse) | Evet | Uygulama işlevi |
| Kullanıcı içeriği → **Ses verileri** | Evet (mikrofon cevabı, saklanmaz) | Hayır | Uygulama işlevi |
| Kullanıcı içeriği → **Diğer kullanıcı içeriği** | Evet (takma ad) | Evet | Uygulama işlevi |
| Tanımlayıcılar → **Kullanıcı kimliği** | Evet | Evet | Uygulama işlevi |
| Kullanım verileri → **Ürün etkileşimi** | Evet | Evet | Analiz, Uygulama işlevi |
| Teşhis → **Kilitlenme verileri** | Evet | Hayır | Uygulama işlevi |
| Teşhis → **Performans verileri** | Evet | Hayır | Uygulama işlevi |
| Teşhis → **Diğer teşhis verileri** | Evet | Hayır | Uygulama işlevi |

Diğer tüm türler (konum, kişiler, sağlık, finans, tarama geçmişi, arama geçmişi, hassas bilgiler, reklam verileri, cihaz kimliği vb.): **Toplanmıyor**.

---

## 8. Şifreleme (Export Compliance)

`app.json` içinde `ITSAppUsesNonExemptEncryption: false` var → App Store Connect soru sormaz. Sorarsa: "Standart şifreleme dışında şifreleme kullanmıyor" → **Hayır**.

---

## 9. Komutlar (Apple hesabı onaylanınca, proje klasöründe)

```
eas build --platform ios --profile production
eas submit --platform ios --latest
```

- `eas build` Apple ID ve şifreni sorar → 2 adımlı doğrulama kodu SMS ile gelir.
- "Generate a new Apple Distribution Certificate?" → **Y**
- "Generate a new Apple Provisioning Profile?" → **Y**
- Push bildirimleri anahtarı sorarsa → **Y** (EAS kendisi oluşturur).
- `eas submit` App Store Connect API anahtarı oluşturmayı önerir → **Y**.
- Build App Store Connect'e düştükten ~10–30 dk sonra TestFlight'ta görünür.

### OTA (sonraki JS düzeltmeleri)
`eas update --channel production` hem Android hem iOS testçilerine gider.

---

## 10. Sürüm 1.1.0 (Paket 38 + 39 + 40) — iPad + İngilizce

**Yeni build** gerekiyor (iPad desteği ve iOS izin metinlerinin İngilizcesi native ayar):
```
eas build --platform all --profile production
eas submit --platform ios --latest
eas submit --platform android --latest
```
Not: `runtimeVersion` artık sabit `"1.0.0"` — 1.0.0 kurulu telefonlar da 1.1.0 kurulu telefonlar da AYNI `eas update`'leri alır. İleride yeni bir native paket eklenirse bu değer elle artırılır (o zaman söylerim).

**App Store Connect → + Version → 1.1.0**
- iPad ekran görüntüleri: **iPad 13" Display** bölümüne `store/ios/ipad` klasöründeki 5 görsel (2064×2752).
- iPhone görüntüleri 1.0'dan kopyalanır (dokunma).

**Bu sürümdeki yenilikler (What's New) — Türkçe:**
```
• İngilizce dil desteği (Ayarlar → Dil · Language)
• iPad desteği
• Oyuncuları bildirme ve engelleme
• Kim Bu kartlarında ve kulüp adlarında düzeltmeler
```
**What's New — English (İngilizce sayfa açıksa):**
```
• English language support (Settings → Dil · Language)
• iPad support
• Report and block players
• Fixes to Mystery Player cards and club names
```

**Play Console → Üretim/Kapalı test → yeni sürüm** — sürüm notu aynı Türkçe metin (`<tr-TR>` etiketiyle) + `<en-US>` İngilizce metin.

**App Review notu (eklenecek cümle):**
```
Version 1.1 adds Report / Block: tap any player in the online leaderboard, or "Report / block opponent" at the end of an online match. Blocked players are never matched again; nicknames reported by 3 different users are removed automatically, and reports are reviewed within 24 hours.
```
