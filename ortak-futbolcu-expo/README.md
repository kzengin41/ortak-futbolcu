# Ortak Futbolcu — MVP

3 mod: Tek telefon (pas-at), CPU'ya karşı, Online 1v1.

## Kurulum

```bash
npm install
cp .env.example .env
# .env içine kendi Supabase URL + anon key'ini yaz
npx expo start
```

Yerel ve CPU modları backend gerektirmez, doğrudan çalışır. Online mod için
önce Supabase tarafını kurman gerekiyor:

## Supabase kurulumu (online mod için)

1. [supabase.com](https://supabase.com) üzerinde yeni proje aç.
2. SQL Editor'da sırayla çalıştır:
   - `supabase/schema.sql` (tablolar)
   - `supabase/functions.sql` (buzz/cevap hakemliği + realtime yayını)
   - `supabase/seed.sql` (web prototipiyle aynı 47 oyunculuk veri seti)
3. Proje ayarlarından `Project URL` ve `anon public key`'i `.env`'e kopyala.

## Mimari — neden böyle kurdum

**Yerel & CPU modları:** `lib/gameEngine.js` içindeki saf fonksiyonlar
(`normalize`, `isCorrectAnswer`, `generateRound`) hem web prototipiyle hem de
bu ekranlarla birebir aynı. Backend yok, hile derdi yok — cihazda oynanıyor.

**Online mod:** Buradaki tek kritik kural — **hakemlik ve cevap doğrulama
her zaman sunucuda olur**, istemci hiçbir zaman turun geçerli cevap listesini
görmez (round çözülene kadar). İki sebebi var:

1. Adalet: "ilk buzz'layan kazanır" yarışını istemci saatine göre çözersen,
   iki telefonun saat/gecikme farkı haksız sonuç doğurur.
   `buzz_round()` fonksiyonundaki `WHERE buzzed_by is null` koşulu Postgres'in
   satır kilidiyle atomik bir "ilk gelen kazanır" hakemliği yapıyor.
2. Hile: cevap listesi istemciye önceden gönderilseydi, biri geliştirici
   araçlarını açıp anında doğru cevabı görebilirdi.

İki telefon da aynı `rounds` satırını Supabase Realtime üzerinden dinliyor —
"gerçek" (source of truth) her zaman veritabanında, ekranlar sadece o satırı
yansıtıyor.

## "Project is incompatible with this version of Expo Go" hatası çıkarsa

Telefonundaki Expo Go uygulaması otomatik güncellendiği için her zaman en
yeni SDK'yı destekler; bu projedeki `expo` paketi ise sabit bir SDK'ya
pinlenmiş. Expo Go daha yeni bir SDK istiyorsa:

```bash
npx expo install expo@^<Expo Go'nun istediği SDK numarası>.0.0
npx expo install --fix
npx expo start -c
```

`--fix` komutu react, react-native ve diğer tüm expo-* paketlerini o SDK'yla
uyumlu versiyonlara otomatik çeker, elle versiyon takip etmene gerek kalmaz.

## Gerçek bir veritabanına geçmek (Wikidata)

`lib/players.js`'teki elle küratörlenmiş ~48 kişilik liste yerine, Türkiye'de
oynamış her profesyonel futbolcunun **tüm** kariyerini Wikidata'dan çekebilirsin
— ücretsiz, API key gerekmez, CC0 lisanslı (telif sorunu yok):

```bash
node scripts/fetch_wikidata_players.js
```

Bu script `lib/players.js`'i ve `supabase/seed.sql`'i baştan üretir (binlerce
oyuncu beklenir). Sonra Supabase SQL Editor'da yeni `seed.sql`'i çalıştır —
içinde artık bir `truncate` var, eski veriyle çakışmadan güvenle üzerine yazar.

**Not:** Bu script benim tarafımda (Claude) test edilmeden yazıldı çünkü
sandbox ortamımın Wikidata'ya ağ erişimi yok. İlk çalıştırmada bir hata ya da
zaman aşımı alırsan çıktıyı bana getir, birlikte düzeltiriz. Ayrıca: aynı
isimli iki farklı oyuncu Wikidata'da nadiren birbirine karışabilir (QID ile
grupluyoruz ama etiket kalitesi Wikidata'nın kendi veri kalitesine bağlı) —
büyük ölçekte %100 temiz veri beklemiyoruz, ama mevcut 48 kişilik listeden
kıyaslanamayacak kadar geniş ve gerçek olacak.

## Sonraki geliştirme fikirleri

- **Skor sistemi:** Şu an her doğru cevap 1 puan. Zor eşleşmeler (az sayıda
  geçerli cevabı olan turlar) daha çok puan verebilir.
- **İpucu modu:** Kilitlenmeden önce "kaç geçerli cevap var" gibi bir ipucu
  gösterilebilir (zorluğu ayarlanabilir kılar).
- **Yazarken öneri/otomatik tamamlama:** Oyuncu isim yazarken dataset'ten
  canlı öneri listesi çıkması hem hızlandırır hem yazım hatalarını azaltır.
- **Günlük meydan okuma:** Herkese aynı gün aynı takım çifti — sonucu
  paylaşılabilir bir skor kartıyla (Wordle tarzı).
- **Kulüp logoları:** Takım isimlerinin yanına küçük logo eklemek görsel
  kaliteyi belirgin şekilde artırır (logoların kendi telif durumuna dikkat
  etmek gerekir — bkz. ilk konuşmadaki telif notları).
- **Liderlik tablosu (online mod için):** `rooms` tablosundaki skorları
  toplayan basit bir genel sıralama.

## Bilinen MVP basitleştirmeleri (sonraki adımlar)

- **Eşleştirme:** Şu an gerçek bir matchmaking kuyruğu yok — davet kodu ile
  oda kurup arkadaşını davet ediyorsun. Rastgele rakip eşleştirme ayrı bir iş.
- **Sıradaki tur:** Çakışan çift insert olmasın diye şimdilik sadece odayı
  kuran oyuncu (`playerNumber === 1`) "Sıradaki Tur"a basabiliyor.
- **Auth:** Gerçek kullanıcı hesabı yok, cihaza kalıcı anonim id atanıyor
  (`getDeviceId`). RLS politikaları da MVP için gevşek — prod'a çıkmadan
  önce daraltılmalı.
- **Veri seti:** `lib/players.js` ve `supabase/seed.sql` elle küratörlenmiş
  47 oyunculuk bir örnek. Gerçek kapsamlı bir veri kaynağına (lisanslı API ya
  da kendi derlediğin liste) geçmek lazım.
- **Sesli mod (1v1 sesli online) ve sesli cevap girişi:** Bu sürümde yok.
  Web prototipindeki tarayıcı Speech Recognition API'si RN'de çalışmıyor —
  native bir modül (`expo-speech-recognition` gibi) ile ayrıca kurulmalı.
