# -*- coding: utf-8 -*-
"""
TheSportsDB'den eksik futbolcu fotoğraflarını çeker.

NEDEN BU SCRIPT SENDE ÇALIŞIYOR: Claude'un çalıştığı bulut ortamının internet
erişimi kısıtlı (thesportsdb.com engelli). Sen kendi bilgisayarında
çalıştırınca sorun yok.

NE YAPAR
--------
1. `fotografi_eksik_populariteye_gore.csv` dosyasını okur (popülerlik sırası:
   en ünlü eksikler en üstte) ve sırayla TheSportsDB'de arar.
2. Bulduğu her oyuncu için EŞLEŞME DOĞRULAMASI yapar:
     - isim birebir (aksan/büyük-küçük farkı normalize edilerek) tutmalı,
     - spor "Soccer" olmalı,
     - ve şu üç kanıttan EN AZ BİRİ tutmalı: takım örtüşmesi, doğum yılının
       birebir aynı olması, ya da uyruk/milli takım eşleşmesi. Tutarsa
       "yüksek güven", tutmazsa "düşük güven" olarak işaretlenir.
   (Wikipedia eşleştirmelerinde yaşadığımız "yanlış kişi" problemini
    tekrarlamamak için bu kontrol şart — bir futbolcunun fotoğrafı yerine
    başka birinin fotoğrafı gelmesin.)
3. YÜKSEK GÜVENLİ bulguları doğrudan `lib/playerPhotos.json`'a yazar
   (mevcut kayıtları EZMEZ, sadece boş/şüpheli olanları doldurur).
4. DÜŞÜK GÜVENLİ bulguları `sportsdb_dusuk_guven.csv` dosyasına yazar —
   sen göz gezdirip istersen elle onaylarsın.
5. Kaldığı yeri `sportsdb_ilerleme.json`'a kaydeder; script'i durdurup tekrar
   çalıştırırsan kaldığı yerden devam eder.

KULLANIM
--------
    python scripts/sportsdb_foto_cek.py                 # ilk 500 oyuncu
    python scripts/sportsdb_foto_cek.py --limit 2000    # daha fazlası
    python scripts/sportsdb_foto_cek.py --limit 0       # tamamı (uzun sürer)
    python scripts/sportsdb_foto_cek.py --key ABC123    # ücretli/kişisel API anahtarın varsa

NOTLAR
------
* Varsayılan API anahtarı "3" (TheSportsDB'nin herkese açık test anahtarı).
  Dakikada istek sınırı var, o yüzden istekler arasında bekleme koydum.
  Kendi (ücretsiz üyelik) anahtarınla çok daha hızlı çalışır: --key ile ver.
* Fotoğrafları İNDİRMİYOR, sadece URL'lerini kaydediyor — uygulama boyutu
  şişmesin diye. (İndirmek istersen --indir bayrağını kullan; dosyalar
  assets/player_photos_custom/ içine iner ama o klasördekiler uygulamaya
  GÖMÜLDÜĞÜ için binlerce dosya eklemek APK boyutunu çok büyütür, dikkat.)
* Sadece "fotoğrafı yok" ve "şüpheli" olarak işaretlenmiş oyuncular aranır;
  zaten güvenilir fotoğrafı olanlara dokunulmaz.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import unicodedata
from urllib.parse import quote

try:
    import requests
except ImportError:
    print("Bu script `requests` paketine ihtiyaç duyuyor:  pip install requests")
    sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_YOLU = os.path.join(KOK, "fotografi_eksik_populariteye_gore.csv")
PLAYERS_YOLU = os.path.join(KOK, "lib", "players.json")
BIRTH_YOLU = os.path.join(KOK, "lib", "playerBirthPosition.json")
NATIONAL_YOLU = os.path.join(KOK, "lib", "playerNationalTeams.json")
PHOTOS_YOLU = os.path.join(KOK, "lib", "playerPhotos.json")
ILERLEME_YOLU = os.path.join(KOK, "sportsdb_ilerleme.json")
DUSUK_GUVEN_YOLU = os.path.join(KOK, "sportsdb_dusuk_guven.csv")
INDIRME_KLASORU = os.path.join(KOK, "assets", "player_photos_custom")


def normalize(s):
    """Aksanları, noktalama ve büyük/küçük harf farkını yok sayan karşılaştırma."""
    if not s:
        return ""
    s = s.replace("İ", "i").replace("ı", "i").replace("I", "i")
    s = s.lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9\s]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def json_oku(yol, varsayilan):
    if not os.path.exists(yol):
        return varsayilan
    with open(yol, "r", encoding="utf-8") as f:
        return json.load(f)


def json_yaz(yol, veri):
    gecici = yol + ".tmp"
    with open(gecici, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False)
    os.replace(gecici, yol)  # yarım yazma riskine karşı atomik değiştirme


def sportsdb_ara(isim, anahtar, oturum, deneme=3):
    url = "https://www.thesportsdb.com/api/v1/json/%s/searchplayers.php?p=%s" % (anahtar, quote(isim))
    for i in range(deneme):
        try:
            r = oturum.get(url, timeout=20)
            if r.status_code == 429:          # istek sınırı
                time.sleep(8 * (i + 1))
                continue
            if r.status_code != 200:
                return None
            return r.json().get("player") or []
        except Exception:
            time.sleep(2 * (i + 1))
    return None


def foto_url_sec(kayit):
    """Tercih sırası: cutout (arka planı silinmiş) > thumb > render."""
    for alan in ("strCutout", "strThumb", "strRender"):
        v = kayit.get(alan)
        if v and v.startswith("http"):
            return v, alan
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=500, help="Kaç oyuncu denensin (0 = hepsi)")
    ap.add_argument("--key", default="3", help="TheSportsDB API anahtarı (varsayılan: herkese açık test anahtarı '3')")
    ap.add_argument("--bekleme", type=float, default=1.6, help="İstekler arası bekleme (saniye)")
    ap.add_argument("--indir", action="store_true", help="URL kaydetmek yerine dosyaları da indir (APK boyutunu büyütür)")
    a = ap.parse_args()

    if not os.path.exists(CSV_YOLU):
        print("CSV bulunamadı: %s" % CSV_YOLU)
        sys.exit(1)

    players = json_oku(PLAYERS_YOLU, [])
    kulupler = {p["name"]: set(p.get("clubs") or []) for p in players}
    kulupler_norm = {ad: set(normalize(c) for c in kl) for ad, kl in kulupler.items()}

    # 7 Eylül 2026 — İLK ÇALIŞTIRMADA 20 oyuncunun 16'sı "düşük güven" çıktı.
    # Sebep: tek doğrulama ölçütü "TheSportsDB'nin verdiği GÜNCEL takım bizim
    # kulüp listemizde var mı" idi; veri setimiz 2026 yaz transferlerini
    # kaçırdığı için oyuncunun yeni kulübü bizde yok ve doğrulama düşüyordu.
    # Artık üç bağımsız kanıttan HERHANGİ BİRİ yeterli sayılıyor:
    #   (1) takım örtüşmesi, (2) doğum yılı birebir, (3) uyruk/milli takım.
    # Üçü de tutmuyorsa kayıt yine "düşük güven" listesine gidiyor —
    # yanlış kişi riskine karşı koruma sürüyor.
    birth = json_oku(BIRTH_YOLU, {})
    national = json_oku(NATIONAL_YOLU, {})
    photos = json_oku(PHOTOS_YOLU, {})
    ilerleme = json_oku(ILERLEME_YOLU, {"islenen": [], "bulunan": 0, "dusuk_guven": 0})
    islenen = set(ilerleme.get("islenen", []))

    adaylar = []
    with open(CSV_YOLU, "r", encoding="utf-8-sig") as f:
        for satir in csv.DictReader(f):
            isim = satir.get("isim")
            if isim and isim not in islenen:
                adaylar.append(isim)

    if a.limit > 0:
        adaylar = adaylar[: a.limit]

    print("Denenecek oyuncu: %d  (daha önce işlenen: %d)" % (len(adaylar), len(islenen)))
    if not adaylar:
        print("Yapılacak bir şey yok — CSV'deki herkes daha önce denenmiş.")
        return

    oturum = requests.Session()
    oturum.headers.update({"User-Agent": "ortak-futbolcu/1.0"})

    dusuk_guven_yeni = []
    bulunan = 0
    if a.indir:
        os.makedirs(INDIRME_KLASORU, exist_ok=True)

    try:
        for i, isim in enumerate(adaylar, 1):
            sonuc = sportsdb_ara(isim, a.key, oturum)
            islenen.add(isim)

            if sonuc:
                hedef = normalize(isim)
                for kayit in sonuc:
                    if normalize(kayit.get("strPlayer")) != hedef:
                        continue
                    if (kayit.get("strSport") or "").lower() != "soccer":
                        continue

                    url, alan = foto_url_sec(kayit)
                    if not url:
                        continue

                    takim = normalize(kayit.get("strTeam") or "")
                    bizim = kulupler_norm.get(isim, set())
                    takim_uydu = bool(takim) and takim in bizim

                    # Doğum yılı: "1990-10-24" -> 1990
                    dogum_uydu = False
                    bizim_dogum = (birth.get(isim) or {}).get("birthYear")
                    sdb_dogum = (kayit.get("dateBorn") or "")[:4]
                    if bizim_dogum and sdb_dogum.isdigit():
                        dogum_uydu = int(sdb_dogum) == int(bizim_dogum)

                    # Uyruk / milli takım
                    uyruk_uydu = False
                    sdb_uyruk = normalize(kayit.get("strNationality") or "")
                    bizim_uyruklar = set(normalize(x) for x in (national.get(isim) or []))
                    if sdb_uyruk and bizim_uyruklar:
                        uyruk_uydu = sdb_uyruk in bizim_uyruklar

                    guvenli = takim_uydu or dogum_uydu or uyruk_uydu
                    kanit = ",".join([k for k, v in
                                      (("takim", takim_uydu), ("dogum", dogum_uydu), ("uyruk", uyruk_uydu)) if v]) or "-"

                    if guvenli:
                        photos[isim] = url
                        bulunan += 1
                        if a.indir:
                            try:
                                ic = oturum.get(url, timeout=25)
                                if ic.status_code == 200:
                                    uzanti = ".png" if url.lower().endswith(".png") else ".jpg"
                                    with open(os.path.join(INDIRME_KLASORU, isim + uzanti), "wb") as g:
                                        g.write(ic.content)
                            except Exception:
                                pass
                    else:
                        dusuk_guven_yeni.append([
                            isim, kayit.get("strPlayer") or "", kayit.get("strTeam") or "",
                            kayit.get("strNationality") or "", (kayit.get("dateBorn") or "")[:4],
                            alan or "", url,
                        ])
                    break

            if i % 20 == 0 or i == len(adaylar):
                print("  %d/%d denendi | yüksek güvenli bulunan: %d | gözden geçirilecek: %d"
                      % (i, len(adaylar), bulunan, len(dusuk_guven_yeni)))
                # Ara kayıt: script yarıda kesilse bile ilerleme kaybolmasın.
                json_yaz(PHOTOS_YOLU, photos)
                json_yaz(ILERLEME_YOLU, {"islenen": sorted(islenen),
                                         "bulunan": ilerleme.get("bulunan", 0) + bulunan,
                                         "dusuk_guven": ilerleme.get("dusuk_guven", 0) + len(dusuk_guven_yeni)})

            time.sleep(a.bekleme)
    except KeyboardInterrupt:
        print("\nDurduruldu — bulunanlar kaydediliyor...")

    json_yaz(PHOTOS_YOLU, photos)
    json_yaz(ILERLEME_YOLU, {"islenen": sorted(islenen),
                             "bulunan": ilerleme.get("bulunan", 0) + bulunan,
                             "dusuk_guven": ilerleme.get("dusuk_guven", 0) + len(dusuk_guven_yeni)})

    if dusuk_guven_yeni:
        yeni_dosya = not os.path.exists(DUSUK_GUVEN_YOLU)
        with open(DUSUK_GUVEN_YOLU, "a", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            if yeni_dosya:
                w.writerow(["bizdeki_isim", "sportsdb_isim", "sportsdb_takim", "uyruk", "dogum_yili", "foto_tipi", "foto_url"])
            w.writerows(dusuk_guven_yeni)

    print("\nBİTTİ.")
    print("  lib/playerPhotos.json'a eklenen (yüksek güvenli): %d" % bulunan)
    print("  sportsdb_dusuk_guven.csv'ye yazılan (senin onayını bekleyen): %d" % len(dusuk_guven_yeni))
    print("  Devam etmek için script'i tekrar çalıştırman yeterli, kaldığı yerden devam eder.")


if __name__ == "__main__":
    main()
