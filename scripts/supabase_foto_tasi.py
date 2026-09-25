# -*- coding: utf-8 -*-
"""
DIŞ KAYNAKLI FUTBOLCU FOTOĞRAFLARINI KENDİ SUPABASE DEPOMUZA TAŞIR.

NEDEN (7 Eylül 2026, Kerem: "bu futbolcu resimlerini benim supabase'de tutup
oradan indirtsek daha iyi değil mi? url'ye gitmesi bence kötü"):
`lib/playerPhotos.json` şu an karışık: bir kısmı senin Supabase'inde, bir
kısmı TheSportsDB / CloudFront / Wikipedia gibi DIŞ adreslerde. Dış adresler
her an değişebilir, silinebilir, yavaş olabilir ya da erişim engeli koyabilir.
Bu script dış adresteki her fotoğrafı indirip SENİN Supabase Storage'ına
yükler ve `playerPhotos.json`'daki adresi kendi adresinle değiştirir.

Dosya yolu mevcut düzenle BİREBİR aynı tutuluyor:
    player-photos/custom/<oyuncu adının md5'i>.png
(Bu, hâlihazırdaki 15 binden fazla kaydın kullandığı düzen — doğrulandı.)

GEREKENLER
----------
* Supabase **service_role** anahtarı (Dashboard → Project Settings → API).
  Bu anahtar gizlidir, uygulamaya GÖMÜLMEZ; sadece bu script'i çalıştırırken
  kullanılır. Ortam değişkeni ya da parametre olarak verilebilir:
      set SUPABASE_SERVICE_KEY=eyJ...        (Windows)
      python scripts/supabase_foto_tasi.py
  ya da:
      python scripts/supabase_foto_tasi.py --key eyJ...
* Proje adresi `.env` dosyasındaki EXPO_PUBLIC_SUPABASE_URL'den okunur
  (bulunamazsa --url ile verilir).

KULLANIM
--------
    python scripts/supabase_foto_tasi.py --deneme       # sadece ne olacağını göster
    python scripts/supabase_foto_tasi.py --limit 200    # ilk 200 fotoğrafı taşı
    python scripts/supabase_foto_tasi.py --limit 0      # hepsi

Popülerliğe göre sıralı gider (en ünlü oyuncular önce). İstediğin zaman
durdurabilirsin, kaldığı yerden devam eder — zaten taşınmış olanlara
dokunmaz.
"""

import argparse
import collections
import hashlib
import json
import os
import re
import sys
import time
from urllib.parse import quote

try:
    import requests
except ImportError:
    print("Bu script `requests` paketine ihtiyaç duyuyor:  pip install requests")
    sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS_YOLU = os.path.join(KOK, "lib", "playerPhotos.json")
CSV_YOLU = os.path.join(KOK, "fotografi_eksik_populariteye_gore.csv")
ENV_YOLU = os.path.join(KOK, ".env")
BUCKET = "player-photos"
KLASOR = "custom"
CLOUDFRONT = "https://d138rdl3z47cng.cloudfront.net/"


def json_oku(yol, varsayilan):
    if not os.path.exists(yol):
        return varsayilan
    with open(yol, "r", encoding="utf-8") as f:
        return json.load(f)


def json_yaz(yol, veri):
    gecici = yol + ".tmp"
    with open(gecici, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False)
    os.replace(gecici, yol)


def env_oku(anahtar):
    if not os.path.exists(ENV_YOLU):
        return None
    with open(ENV_YOLU, "r", encoding="utf-8") as f:
        for satir in f:
            m = re.match(r"\s*%s\s*=\s*(.+)\s*$" % re.escape(anahtar), satir)
            if m:
                return m.group(1).strip().strip('"').strip("'")
    return None


def hedef_yol(isim):
    return "%s/%s.png" % (KLASOR, hashlib.md5(isim.encode("utf-8")).hexdigest())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default=os.environ.get("SUPABASE_SERVICE_KEY", ""),
                    help="Supabase service_role anahtarı (ya da SUPABASE_SERVICE_KEY ortam değişkeni)")
    ap.add_argument("--url", default="", help="https://xxxx.supabase.co (boşsa .env'den okunur)")
    ap.add_argument("--limit", type=int, default=200, help="Kaç fotoğraf taşınsın (0 = hepsi)")
    ap.add_argument("--deneme", action="store_true", help="Hiçbir şey yükleme/yazma, sadece raporla")
    ap.add_argument("--bekleme", type=float, default=0.2)
    ap.add_argument("--kaynak", default="", help="sadece bu kaynak taşınsın: sportsdb | wikipedia | cloudfront | diger")
    a = ap.parse_args()

    proje = a.url or env_oku("EXPO_PUBLIC_SUPABASE_URL")
    if not proje:
        print("Supabase proje adresi bulunamadı. --url ile ver ya da .env içine EXPO_PUBLIC_SUPABASE_URL koy.")
        sys.exit(1)
    proje = proje.rstrip("/")
    if not a.key and not a.deneme:
        print("service_role anahtarı gerekli: --key ile ver ya da SUPABASE_SERVICE_KEY ortam değişkenini ayarla.")
        print("(Sadece ne olacağını görmek için --deneme ile çalıştırabilirsin.)")
        sys.exit(1)

    # 7 Eylül 2026 — İLK GERÇEK ÇALIŞTIRMADA Supabase her yüklemeye
    # 400 {"statusCode":"403","message":"Invalid Compact JWS"} döndürdü.
    # "Invalid Compact JWS" = gönderilen anahtar GEÇERLİ BİR JWT DEĞİL.
    # En sık sebebi: örnekteki "eyJ..." yer tutucusunun olduğu gibi
    # yapıştırılması, ya da anahtarın kopyalanırken kırpılması.
    # Artık işe başlamadan ÖNCE anahtarı denetliyoruz ki 1500 dosyayı
    # boşuna denemeyelim.
    if not a.deneme:
        anahtar = (a.key or "").strip().strip('"').strip("'")
        if anahtar.endswith("...") or len(anahtar) < 40:
            print("HATA: verdiğin anahtar eksik görünüyor (%d karakter)." % len(anahtar))
            print("      Örnekteki 'eyJ...' YER TUTUCU idi — Supabase panelinden")
            print("      Project Settings > API > service_role anahtarının TAMAMINI kopyala.")
            sys.exit(1)
        a.key = anahtar
        # Anahtarı gerçekten dene: bucket bilgisini oku.
        deneme_h = {"Authorization": "Bearer %s" % a.key, "apikey": a.key}
        try:
            t = requests.get("%s/storage/v1/bucket/%s" % (proje, BUCKET), headers=deneme_h, timeout=20)
        except Exception as e:
            print("HATA: Supabase'e ulaşılamadı: %s" % e)
            sys.exit(1)
        if t.status_code == 200:
            print("Anahtar doğrulandı, '%s' bucket'ı erişilebilir." % BUCKET)
        elif t.status_code in (401, 403):
            print("HATA: Anahtar reddedildi (%s): %s" % (t.status_code, t.text[:200]))
            print("      service_role anahtarı olduğundan emin ol (anon anahtar yazma yetkisi vermez).")
            sys.exit(1)
        elif t.status_code == 404:
            print("HATA: '%s' adında bir bucket bulunamadı." % BUCKET)
            print("      Supabase > Storage bölümünden bu isimde bir bucket oluştur (public olmalı).")
            sys.exit(1)
        else:
            print("UYARI: bucket kontrolü beklenmedik yanıt verdi (%s), yine de devam ediliyor." % t.status_code)

    photos = json_oku(PHOTOS_YOLU, {})

    # Popülerlik sırası: CSV'deki sıra. CSV'de olmayanlar sona.
    sira = {}
    if os.path.exists(CSV_YOLU):
        import csv as _csv
        with open(CSV_YOLU, "r", encoding="utf-8-sig") as f:
            for i, r in enumerate(_csv.DictReader(f)):
                sira.setdefault(r.get("isim"), i)

    def kaynak_adi(d):
        if not d:
            return "yok"
        if not d.startswith("http"):
            return "cloudfront"
        if "thesportsdb" in d:
            return "sportsdb"
        if "wikimedia" in d or "wikipedia" in d:
            return "wikipedia"
        if "cloudfront" in d:
            return "cloudfront"
        return "diger"

    disaridakiler = []
    for isim, deger in photos.items():
        if not deger:
            continue
        if proje in deger:            # zaten bizim depoda
            continue
        # Çıplak dosya adı = eski CloudFront kaydı; tam adresi kurup öyle indireceğiz.
        # 7 Eylül 2026 — İLK DENEMEDE 200/200 BAŞARISIZ oldu. Sebep: bu dosya
        # adları boşluk ve parantez içeriyor ("Emre in national team (11.08...jpg")
        # ve ben adresi ENCODE ETMEDEN kurmuştum, dolayısıyla istek daha
        # sunucuya bile düzgün gitmiyordu. Uygulamanın kendi çözücüsü
        # (lib/playerPhotos.js) tam olarak `encodeURIComponent` kullanıyor;
        # Python'daki karşılığı `quote(..., safe="")`. Artık birebir aynı.
        kaynak = deger if deger.startswith("http") else CLOUDFRONT + quote(deger, safe="")
        if a.kaynak and kaynak_adi(deger) != a.kaynak:
            continue
        disaridakiler.append((sira.get(isim, 10 ** 9), isim, kaynak))
    disaridakiler.sort()

    if a.limit > 0:
        disaridakiler = disaridakiler[: a.limit]

    print("Kendi depona taşınacak fotoğraf: %d" % len(disaridakiler))
    if a.deneme:
        for _, isim, kaynak in disaridakiler[:15]:
            print("  %-28s <- %s" % (isim[:28], kaynak[:70]))
        print("... (--deneme modu: hiçbir şey yüklenmedi)")
        return

    oturum = requests.Session()
    oturum.headers.update({"User-Agent": "OrtakFutbolcuBot/1.0 (foto tasima) python-requests"})
    basarili = basarisiz = 0
    # Hatanın SEBEBİNİ sayıyoruz: 404 gerçekten kırık kayıt demek, ama 403 /
    # zaman aşımı bambaşka bir sorundur ve "hepsi kırıkmış" diye yanlış sonuca
    # varmamak için ayırmak şart.
    sebepler = collections.Counter()
    basarisiz_liste = []
    try:
        for i, (_, isim, kaynak) in enumerate(disaridakiler, 1):
            try:
                r = oturum.get(kaynak, timeout=25)
                # Kırık kayıtlar (eski CloudFront "hayalet" dosyaları) burada elenir:
                if r.status_code != 200:
                    sebepler["indirme HTTP %s" % r.status_code] += 1
                    basarisiz_liste.append([isim, kaynak, "HTTP %s" % r.status_code])
                    basarisiz += 1
                    continue
                if len(r.content) < 800:
                    sebepler["dosya boş/çok küçük"] += 1
                    basarisiz_liste.append([isim, kaynak, "bos dosya (%d bayt)" % len(r.content)])
                    basarisiz += 1
                    continue
                yol = hedef_yol(isim)
                yukle = "%s/storage/v1/object/%s/%s" % (proje, BUCKET, yol)
                h = {
                    "Authorization": "Bearer %s" % a.key,
                    "apikey": a.key,
                    "Content-Type": r.headers.get("Content-Type", "image/png"),
                    "x-upsert": "true",       # aynı isim tekrar yüklenirse üzerine yaz
                    "Cache-Control": "public, max-age=31536000",
                }
                u = oturum.post(yukle, data=r.content, headers=h, timeout=40)
                if u.status_code not in (200, 201):
                    if sebepler["yükleme HTTP %s" % u.status_code] == 0:
                        print("  YÜKLEME HATASI (%s): %s" % (u.status_code, u.text[:160]))
                    sebepler["yükleme HTTP %s" % u.status_code] += 1
                    basarisiz_liste.append([isim, kaynak, "yukleme HTTP %s" % u.status_code])
                    basarisiz += 1
                    continue
                photos[isim] = "%s/storage/v1/object/public/%s/%s" % (proje, BUCKET, yol)
                basarili += 1
            except Exception as e:
                sebepler["baglanti hatasi"] += 1
                basarisiz_liste.append([isim, kaynak, "baglanti: %s" % str(e)[:80]])
                basarisiz += 1

            if i % 25 == 0 or i == len(disaridakiler):
                print("  %d/%d | taşınan: %d | indirilemeyen/başarısız: %d" % (i, len(disaridakiler), basarili, basarisiz))
                json_yaz(PHOTOS_YOLU, photos)
            time.sleep(a.bekleme)
    except KeyboardInterrupt:
        print("\nDurduruldu — taşınanlar kaydediliyor...")

    json_yaz(PHOTOS_YOLU, photos)
    print("\nBİTTİ. Kendi depona taşınan: %d | başarısız: %d" % (basarili, basarisiz))
    if sebepler:
        print("Başarısızlık sebepleri:")
        for sebep, adet in sebepler.most_common():
            print("   %-24s %d" % (sebep, adet))
        print("  (404 = kayıt gerçekten kırık. 403/401 = yetki sorunu — service_role anahtarını")
        print("   ve bucket'ın var olduğunu kontrol et. Bağlantı hatası = ağ/zaman aşımı.)")
    if basarisiz_liste:
        import csv as _c
        yol = os.path.join(KOK, "supabase_tasima_hatalari.csv")
        with open(yol, "w", encoding="utf-8-sig", newline="") as f:
            w = _c.writer(f); w.writerow(["isim", "kaynak_url", "hata"]); w.writerows(basarisiz_liste)
        print("  ayrıntılı hata listesi: %s" % yol)


if __name__ == "__main__":
    main()
