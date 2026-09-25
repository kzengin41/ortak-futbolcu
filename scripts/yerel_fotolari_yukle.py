# -*- coding: utf-8 -*-
"""
YERELDEKİ FUTBOLCU FOTOĞRAFLARINI SUPABASE'E YÜKLER.

NİYE (11 Eylül 2026, Kerem: "yerelde bir ton fotoğraf koydum ya, onların
hepsini Supabase'de depolamak ve oradan sunmak istiyorum"):
Şu an senin topladığın fotoğraflar UYGULAMANIN İÇİNE GÖMÜLÜ
(`lib/localPlayerPhotos.js` + `assets/player_photos_custom/`). Bunun iki
maliyeti var:
  1. Her fotoğraf APK boyutuna ekleniyor (~290 dosya ≈ 15-20 MB).
  2. Yeni fotoğraf eklemek için uygulamayı yeniden derleyip yayınlaman
     gerekiyor — Supabase'de olsa sadece dosyayı yüklemen yeterli.

BU SCRIPT
1. Yerel fotoğraf klasörlerini tarar (varsayılan: assets/player_photos_custom,
   bulunanlar, custom-photos).
2. Dosya adını (`Yunus Musah.png`) `lib/players.json`'daki oyuncu adıyla
   eşleştirir; eşleşmeyenleri raporlar (yanlış isimli dosya yüklenmesin).
3. Supabase Storage'a yükler:  player-photos/custom/<isim md5>.png
   (mevcut 15 binden fazla kaydınla BİREBİR aynı düzen).
4. `lib/playerPhotos.json`'a Supabase adresini yazar.
5. `--yerel-temizle` verirsen `lib/localPlayerPhotos.js`'i boşaltır — artık
   fotoğraflar Supabase'den geldiği için gömülü kopyalara gerek kalmaz ve
   APK küçülür. (Dosyayı SİLMİYOR, içini boşaltıyor; kod aynen çalışmaya
   devam ediyor.)

GEREKEN
    Supabase **service_role** anahtarı (Dashboard > Project Settings > API).
    Uygulamaya gömülmez, sadece bu script'te kullanılır.

KULLANIM
    python scripts/yerel_fotolari_yukle.py --deneme
    python scripts/yerel_fotolari_yukle.py --key eyJ...GERÇEK_ANAHTAR
    python scripts/yerel_fotolari_yukle.py --key ... --yerel-temizle

Kaldığı yerden devam eder; aynı dosyayı iki kez yüklemez.
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
import unicodedata

try:
    import requests
except ImportError:
    print("Bu script `requests` paketine ihtiyaç duyuyor:  pip install requests")
    sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYERS_YOLU = os.path.join(KOK, "lib", "players.json")
PHOTOS_YOLU = os.path.join(KOK, "lib", "playerPhotos.json")
LOCAL_JS = os.path.join(KOK, "lib", "localPlayerPhotos.js")
ENV_YOLU = os.path.join(KOK, ".env")
RAPOR = os.path.join(KOK, "yerel_foto_yukleme_raporu.csv")
BUCKET = "player-photos"
KLASOR = "custom"
VARSAYILAN_KLASORLER = [
    os.path.join("assets", "player_photos_custom"),
    "bulunanlar",
    "custom-photos",
]
UZANTILAR = (".png", ".jpg", ".jpeg", ".webp")


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


def normalize(s):
    s = s.replace("İ", "i").replace("ı", "i").replace("I", "i").lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def hedef_yol(isim):
    return "%s/%s.png" % (KLASOR, hashlib.md5(isim.encode("utf-8")).hexdigest())


def icerik_tipi(dosya):
    d = dosya.lower()
    if d.endswith(".png"):
        return "image/png"
    if d.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default=os.environ.get("SUPABASE_SERVICE_KEY", ""),
                    help="Supabase service_role anahtarı")
    ap.add_argument("--url", default="", help="https://xxx.supabase.co (boşsa .env'den okunur)")
    ap.add_argument("--klasor", action="append", default=[],
                    help="Taranacak klasör (birden fazla verilebilir). Boşsa varsayılanlar.")
    ap.add_argument("--deneme", action="store_true", help="Yükleme yapma, sadece ne olacağını göster")
    ap.add_argument("--yerel-temizle", dest="yerel_temizle", action="store_true",
                    help="Yükleme bitince lib/localPlayerPhotos.js'i boşalt (APK küçülür)")
    ap.add_argument("--bekleme", type=float, default=0.15)
    a = ap.parse_args()

    proje = (a.url or env_oku("EXPO_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    if not proje:
        # --deneme sadece klasörleri tarar, ağa çıkmaz: adres olmadan da çalışsın.
        if not a.deneme:
            print("Supabase proje adresi bulunamadı. --url ile ver ya da .env içine EXPO_PUBLIC_SUPABASE_URL koy.")
            sys.exit(1)
        print("(uyarı: Supabase adresi bulunamadı — deneme modunda sadece tarama yapılıyor)")
        proje = "https://ORNEK.supabase.co"

    klasorler = [os.path.join(KOK, k) if not os.path.isabs(k) else k
                 for k in (a.klasor or VARSAYILAN_KLASORLER)]
    klasorler = [k for k in klasorler if os.path.isdir(k)]
    if not klasorler:
        print("Taranacak klasör bulunamadı.")
        sys.exit(1)

    players = json_oku(PLAYERS_YOLU, [])
    ad_index = {}
    for p in players:
        ad_index.setdefault(normalize(p["name"]), p["name"])

    photos = json_oku(PHOTOS_YOLU, {})

    # Dosyaları topla (aynı oyuncu birden çok klasörde varsa bir kez)
    dosyalar = {}
    for klasor in klasorler:
        for ad in sorted(os.listdir(klasor)):
            if not ad.lower().endswith(UZANTILAR):
                continue
            taban = os.path.splitext(ad)[0]
            # "David Norman Jr..png" -> "David Norman Jr." (sondaki nokta isme ait)
            if taban.endswith("."):
                taban_aday = [taban, taban[:-1]]
            else:
                taban_aday = [taban]
            eslesen = None
            for aday in taban_aday:
                eslesen = ad_index.get(normalize(aday))
                if eslesen:
                    break
            dosyalar.setdefault(taban, {"yol": os.path.join(klasor, ad), "oyuncu": eslesen, "dosya": taban})

    eslesen = {k: v for k, v in dosyalar.items() if v["oyuncu"]}
    eslesmeyen = {k: v for k, v in dosyalar.items() if not v["oyuncu"]}
    zaten = {k: v for k, v in eslesen.items()
             if (photos.get(v["oyuncu"]) or "").startswith(proje)}
    yapilacak = {k: v for k, v in eslesen.items() if k not in zaten}

    print("Bulunan dosya            : %d  (%d klasörden)" % (len(dosyalar), len(klasorler)))
    print("Oyuncuyla eşleşen        : %d" % len(eslesen))
    print("Adı veri setinde YOK     : %d" % len(eslesmeyen))
    print("Zaten Supabase'de        : %d" % len(zaten))
    print("Yüklenecek               : %d" % len(yapilacak))
    if eslesmeyen:
        print("  (eşleşmeyen ilk 8: %s)" % ", ".join(list(eslesmeyen)[:8]))

    if a.deneme:
        for k, v in list(yapilacak.items())[:10]:
            print("   %-30s -> %s" % (k[:30], hedef_yol(v["oyuncu"])))
        print("\n--deneme modu: hiçbir şey yüklenmedi.")
        return

    anahtar = (a.key or "").strip().strip('"').strip("'")
    if anahtar.endswith("...") or len(anahtar) < 40:
        print("\nHATA: Anahtar eksik görünüyor (%d karakter). Supabase panelinden" % len(anahtar))
        print("      service_role anahtarının TAMAMINI kopyala.")
        sys.exit(1)

    basliklar = {"Authorization": "Bearer %s" % anahtar, "apikey": anahtar}
    oturum = requests.Session()
    oturum.headers.update({"User-Agent": "OrtakFutbolcuBot/1.0 (yerel foto yukleme)"})
    t = oturum.get("%s/storage/v1/bucket/%s" % (proje, BUCKET), headers=basliklar, timeout=20)
    if t.status_code in (401, 403):
        print("HATA: Anahtar reddedildi (%s). service_role anahtarı olmalı." % t.status_code)
        sys.exit(1)
    if t.status_code == 404:
        print("HATA: '%s' bucket'ı yok. Supabase > Storage'dan public olarak oluştur." % BUCKET)
        sys.exit(1)
    print("\nAnahtar doğrulandı, yükleme başlıyor...\n")

    basarili = basarisiz = 0
    hatalar = []
    try:
        for i, (taban, v) in enumerate(sorted(yapilacak.items()), 1):
            isim = v["oyuncu"]
            try:
                with open(v["yol"], "rb") as f:
                    veri = f.read()
                if len(veri) < 500:
                    hatalar.append([isim, v["yol"], "dosya bos/cok kucuk"])
                    basarisiz += 1
                    continue
                yol = hedef_yol(isim)
                h = dict(basliklar)
                h["Content-Type"] = icerik_tipi(v["yol"])
                h["x-upsert"] = "true"
                h["Cache-Control"] = "public, max-age=31536000"
                u = oturum.post("%s/storage/v1/object/%s/%s" % (proje, BUCKET, yol),
                                data=veri, headers=h, timeout=60)
                if u.status_code not in (200, 201):
                    if basarisiz == 0:
                        print("  YÜKLEME HATASI (%s): %s" % (u.status_code, u.text[:160]))
                    hatalar.append([isim, v["yol"], "HTTP %s" % u.status_code])
                    basarisiz += 1
                    continue
                photos[isim] = "%s/storage/v1/object/public/%s/%s" % (proje, BUCKET, yol)
                basarili += 1
            except Exception as e:
                hatalar.append([isim, v["yol"], str(e)[:80]])
                basarisiz += 1

            if i % 25 == 0 or i == len(yapilacak):
                print("  %d/%d | yüklenen: %d | başarısız: %d" % (i, len(yapilacak), basarili, basarisiz))
                json_yaz(PHOTOS_YOLU, photos)
            time.sleep(a.bekleme)
    except KeyboardInterrupt:
        print("\nDurduruldu — yüklenenler kaydediliyor...")

    json_yaz(PHOTOS_YOLU, photos)

    import csv as _c
    with open(RAPOR, "w", encoding="utf-8-sig", newline="") as f:
        w = _c.writer(f)
        w.writerow(["durum", "oyuncu_veya_dosya", "detay"])
        for isim, yol, hata in hatalar:
            w.writerow(["yuklenemedi", isim, "%s | %s" % (yol, hata)])
        for k in eslesmeyen:
            w.writerow(["veri setinde yok", k, "dosya adi hicbir oyuncuyla eslesmedi"])
    print("\nBİTTİ. Supabase'e yüklenen: %d | başarısız: %d" % (basarili, basarisiz))
    print("Rapor: %s" % RAPOR)

    if a.yerel_temizle:
        stub = (
            "// 11 Eylül 2026 — Fotoğrafların TAMAMI artık Supabase'de\n"
            "// (scripts/yerel_fotolari_yukle.py ile yüklendi) ve uygulama onları\n"
            "// lib/playerPhotos.json üzerinden adresle çekiyor. Bu dosya eskiden\n"
            "// her fotoğrafı APK'ya GÖMÜYORDU (~290 dosya, 15-20 MB); artık\n"
            "// bilinçli olarak BOŞ. İleride yine gömülü fotoğraf istenirse\n"
            "// aynı yapıya require(...) satırları eklemek yeterli — kod aynen\n"
            "// çalışmaya devam eder.\n"
            "export const LOCAL_PLAYER_PHOTO_MODULES = {};\n\n"
            "export const LOCAL_PLAYER_PHOTOS = {};\n"
        )
        with open(LOCAL_JS, "w", encoding="utf-8") as f:
            f.write(stub)
        print("lib/localPlayerPhotos.js boşaltıldı — fotoğraflar artık Supabase'den geliyor.")
        print("NOT: assets/player_photos_custom/ klasörünü de silersen APK iyice küçülür")
        print("     (dosyaların yedeği artık Supabase'de).")


if __name__ == "__main__":
    main()
