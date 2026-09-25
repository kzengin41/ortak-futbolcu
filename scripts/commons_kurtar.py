# -*- coding: utf-8 -*-
"""
ÖLÜ CLOUDFRONT KAYITLARINI WIKIMEDIA COMMONS'TAN KURTARIR.

FİKİR (11 Eylül 2026): playerPhotos.json'daki 9.137 "çıplak dosya adı"
kaydı aslında WIKIPEDIA COMMONS DOSYA ADLARI. CloudFront sadece aynaydı ve
kapandı; asıl dosyalar Commons'ta duruyor. Commons'un URL'i dosya adından
hesaplanabiliyor:  .../commons/<h0>/<h0h1>/<ad>   (h = md5(ad))
--dene 30 testi %100 isabet verdi, yani teori doğru.

ÜÇ ÖNEMLİ DERS (hepsi bu dosyada uygulandı)
  1. TAM ÇÖZÜNÜRLÜK ÇEKME. Orijinaller 3-8 MB; hem yavaş hem Supabase'i
     şişiriyor hem de telefonda gereksiz. Commons'un hazır thumb adresi
     (.../thumb/<h0>/<h0h1>/<ad>/500px-<ad>) ~50-80 KB.
  2. 429 YİYİNCE DAHA ÇOK İSTEK ATMA. Önceki sürüm hız limitine girince her
     kayıt için 4 adresi 3'er kez deniyordu -> tam tıkanma. Artık 429
     görüldüğü an BÜTÜN İŞ İPLİKLERİ ortak bir "soğuma" saatine kadar
     bekliyor ve o kayıt için başka adres denenmiyor.
  3. HIZ LİMİTİ = "BULUNAMADI" DEĞİL. 429 yüzünden alınamayan kayıt ölü
     sayılmaz, --olu-temizle onlara dokunmaz; tekrar çalıştırınca denenir.

Her 250 kayıtta bir playerPhotos.json'a ara kayıt yapılır ve Ctrl+C'de de
kaydedilir. Kurtarılanlar http:// ile başladığı için sonraki tur onları
atlar — yani script kaldığı yerden devam eder.

KULLANIM
    python scripts/commons_kurtar.py --dene 30                 # test
    python scripts/commons_kurtar.py --key <anahtar> --olu-temizle
    python scripts/commons_kurtar.py --key <anahtar> --is 2     # daha nazik
"""

import argparse
import concurrent.futures as cf
import csv
import hashlib
import json
import os
import re
import sys
import threading
import time
from urllib.parse import quote

try:
    import requests
except ImportError:
    print("requests kurulu degil:  pip install requests")
    sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS_YOLU = os.path.join(KOK, "lib", "playerPhotos.json")
POP_YOLU = os.path.join(KOK, "lib", "playerPopularity.json")
YEDEK_KLASOR = os.path.join(KOK, "yedek")
RAPOR = os.path.join(KOK, "commons_kurtarma_raporu.csv")

BUCKET = "player-photos"
MAX_BOYUT = 8 * 1024 * 1024
GENISLIK = 500
UA = {"User-Agent": "OrtakFutbolcuBot/1.0 (oyun ici oyuncu fotograflari; iletisim: kzengin41@gmail.com)"}


def env_oku(anahtar):
    for ad in (".env", ".env.local"):
        yol = os.path.join(KOK, ad)
        if not os.path.exists(yol):
            continue
        for satir in open(yol, encoding="utf-8", errors="ignore"):
            satir = satir.strip()
            if satir.startswith(anahtar + "="):
                return satir.split("=", 1)[1].strip().strip('"').strip("'")
    return os.environ.get(anahtar, "")


def json_oku(yol, varsayilan):
    try:
        with open(yol, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return varsayilan


def commons_adaylari(dosya):
    """Once kucuk boy (thumb), olmazsa orijinal."""
    ad = str(dosya).replace(" ", "_").lstrip("_")
    if not ad:
        return []
    ad = ad[0].upper() + ad[1:]
    h = hashlib.md5(ad.encode("utf-8")).hexdigest()
    k = quote(ad, safe="")
    return [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/%s/%s/%s/%dpx-%s" % (h[0], h[:2], k, GENISLIK, k),
        "https://upload.wikimedia.org/wikipedia/commons/%s/%s/%s" % (h[0], h[:2], k),
        "https://upload.wikimedia.org/wikipedia/en/thumb/%s/%s/%s/%dpx-%s" % (h[0], h[:2], k, GENISLIK, k),
        "https://upload.wikimedia.org/wikipedia/en/%s/%s/%s" % (h[0], h[:2], k),
    ]


def hedef_ad(isim):
    return "custom/%s.png" % hashlib.md5(isim.encode("utf-8")).hexdigest()


def yaz(*parcalar):
    print(*parcalar)
    sys.stdout.flush()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default=os.environ.get("SUPABASE_SERVICE_KEY", ""))
    ap.add_argument("--url", default="")
    ap.add_argument("--dene", type=int, default=0, help="Sadece su kadar kaydi TEST et")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--is", dest="isci", type=int, default=4)
    ap.add_argument("--ara", type=float, default=0.15, help="Istekler arasi en az sure (sn)")
    ap.add_argument("--olu-temizle", dest="olu_temizle", action="store_true")
    a = ap.parse_args()

    test_modu = a.dene > 0
    proje = (a.url or env_oku("EXPO_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    if not proje and not test_modu:
        yaz("Supabase adresi yok. --url ile ver ya da .env icine EXPO_PUBLIC_SUPABASE_URL koy.")
        sys.exit(1)

    photos = json_oku(PHOTOS_YOLU, {})
    pop = json_oku(POP_YOLU, {})
    isler = [(i, str(d)) for i, d in photos.items()
             if d and not re.match(r"^https?://", str(d), re.I)]
    isler.sort(key=lambda x: -float(pop.get(x[0], 0) or 0))
    if test_modu:
        isler = isler[: a.dene]
    elif a.limit:
        isler = isler[: a.limit]

    yaz("Kurtarilacak (olu) kayit : %d" % len(isler))
    if not isler:
        yaz("Yapacak is yok.")
        return

    basliklar = None
    if not test_modu:
        anahtar = (a.key or "").strip().strip('"').strip("'")
        if len(anahtar) < 40 or anahtar.count(".") != 2:
            yaz("\nHATA: Anahtar gecersiz gorunuyor (%d karakter)." % len(anahtar))
            yaz('      PowerShell:  $env:SUPABASE_SERVICE_KEY="eyJ..."')
            sys.exit(1)
        basliklar = {"Authorization": "Bearer %s" % anahtar, "apikey": anahtar}
        t = requests.get("%s/storage/v1/bucket/%s" % (proje, BUCKET), headers=basliklar, timeout=20)
        if t.status_code in (401, 403):
            yaz("HATA: Anahtar reddedildi (%s)." % t.status_code)
            sys.exit(1)
        os.makedirs(YEDEK_KLASOR, exist_ok=True)
        yedek = os.path.join(YEDEK_KLASOR, "playerPhotos_%s.json" % time.strftime("%Y%m%d_%H%M%S"))
        with open(yedek, "w", encoding="utf-8") as f:
            json.dump(photos, f, ensure_ascii=False)
        yaz("Yedek: %s" % yedek)
    yaz("")

    kilit = threading.Lock()
    hiz_kilit = threading.Lock()
    son_istek = [0.0]
    soguma_kadar = [0.0]          # 429 gorulunce BUTUN iplikler buraya kadar bekler
    soguma_sayisi = [0]
    dur = threading.Event()
    baslangic = time.time()
    sayac = {"bulundu": 0, "yok": 0, "yuklendi": 0, "hata": 0, "limit": 0, "islenen": 0}
    satirlar, guncellemeler, kurtarilamayan = [], {}, []
    yerel = threading.local()

    def oturum():
        if not hasattr(yerel, "s"):
            yerel.s = requests.Session()
            yerel.s.headers.update(UA)
        return yerel.s

    def bekle():
        """Hem istekler arasi minimum arayi hem de ortak sogumayi uygular."""
        while True:
            with hiz_kilit:
                simdi = time.time()
                kalan = max(son_istek[0] + a.ara - simdi, soguma_kadar[0] - simdi)
                if kalan <= 0:
                    son_istek[0] = simdi
                    return
            time.sleep(min(kalan, 2.0))
            if dur.is_set():
                return

    def sogut(saniye):
        with hiz_kilit:
            hedef = time.time() + saniye
            if hedef > soguma_kadar[0]:
                soguma_kadar[0] = hedef
                soguma_sayisi[0] += 1
                yaz("  [hiz limiti] Wikimedia yavaslamamizi istedi, %d sn bekleniyor..." % saniye)

    def indir(url):
        """(veri, hata, limit_mi) dondurur."""
        s = oturum()
        for deneme in range(3):
            if dur.is_set():
                return None, "durduruldu", False
            try:
                bekle()
                r = s.get(url, timeout=30, stream=True)
                if r.status_code in (429, 503):
                    sogut(10 * (deneme + 1))
                    continue
                if r.status_code != 200:
                    return None, "HTTP %s" % r.status_code, False
                if "image" not in (r.headers.get("Content-Type") or "").lower():
                    return None, "resim degil", False
                veri = r.raw.read(MAX_BOYUT + 1, decode_content=True)
                if len(veri) > MAX_BOYUT:
                    return None, "cok buyuk", False
                if len(veri) < 500:
                    return None, "cok kucuk", False
                return veri, "", False
            except Exception as e:
                if deneme == 2:
                    return None, type(e).__name__, False
                time.sleep(1.5)
        return None, "hiz limiti (429)", True

    def ara_kayit():
        with kilit:
            if not guncellemeler:
                return
            kopya = dict(guncellemeler)
        taze = json_oku(PHOTOS_YOLU, {})
        taze.update(kopya)
        gecici = PHOTOS_YOLU + ".tmp"
        with open(gecici, "w", encoding="utf-8") as f:
            json.dump(taze, f, ensure_ascii=False)
        os.replace(gecici, PHOTOS_YOLU)

    def isle(kayit):
        if dur.is_set():
            return
        isim, dosya = kayit
        veri, hata, limit_mi, kullanilan = None, "", False, ""
        for aday in commons_adaylari(dosya):
            veri, hata, limit_mi = indir(aday)
            if veri:
                kullanilan = aday
                break
            if limit_mi:
                break          # DERS 2: limit yiyince baska adres deneme
        p = round(float(pop.get(isim, 0) or 0), 2)

        with kilit:
            sayac["islenen"] += 1
            n = sayac["islenen"]
            if veri:
                sayac["bulundu"] += 1
            elif limit_mi:
                sayac["limit"] += 1
                satirlar.append([isim, p, dosya, "HIZ LIMITI", "tekrar denenecek"])
            else:
                sayac["yok"] += 1
                kurtarilamayan.append(isim)
                satirlar.append([isim, p, dosya, "BULUNAMADI", hata])
        if n % 100 == 0:
            gecen = time.time() - baslangic
            kalan = (len(isler) - n) * gecen / n
            yaz("  ... %d/%d  (bulundu %d, yok %d, limit %d, yuklendi %d)  ~%d dk kaldi"
                % (n, len(isler), sayac["bulundu"], sayac["yok"],
                   sayac["limit"], sayac["yuklendi"], kalan / 60))
        if not test_modu and n % 250 == 0:
            ara_kayit()
        if not veri:
            return
        if test_modu:
            with kilit:
                satirlar.append([isim, p, dosya, "BULUNDU", kullanilan])
            return

        yol = hedef_ad(isim)
        try:
            u = oturum().post("%s/storage/v1/object/%s/%s" % (proje, BUCKET, yol),
                              data=veri,
                              headers=dict(basliklar, **{"Content-Type": "image/png",
                                                         "x-upsert": "true"}),
                              timeout=60)
            if u.status_code in (200, 201):
                with kilit:
                    sayac["yuklendi"] += 1
                    guncellemeler[isim] = "%s/storage/v1/object/public/%s/%s" % (proje, BUCKET, yol)
                    satirlar.append([isim, p, dosya, "KURTARILDI", kullanilan])
            else:
                with kilit:
                    sayac["hata"] += 1
                    satirlar.append([isim, p, dosya, "YUKLEME HATASI", "HTTP %s" % u.status_code])
        except Exception as e:
            with kilit:
                sayac["hata"] += 1
                satirlar.append([isim, p, dosya, "YUKLEME HATASI", type(e).__name__])

    yaz("Basliyor (%d paralel, istek arasi %.2f sn)..." % (a.isci, a.ara))
    try:
        with cf.ThreadPoolExecutor(max_workers=max(1, a.isci)) as havuz:
            list(havuz.map(isle, isler))
    except KeyboardInterrupt:
        dur.set()
        yaz("\n\nDurduruluyor, simdiye kadarki kurtarmalar kaydediliyor...")
        if not test_modu:
            ara_kayit()
            yaz("Kaydedildi (%d kurtarma). Ayni komutu tekrar calistirirsan kaldigi"
                % len(guncellemeler))
            yaz("yerden devam eder.")
        sys.exit(0)

    oran = 100.0 * sayac["bulundu"] / max(1, len(isler))
    yaz("\n" + "=" * 58)
    yaz("Commons'ta BULUNDU   : %d  (%%%.1f)" % (sayac["bulundu"], oran))
    yaz("Bulunamadi           : %d" % sayac["yok"])
    if sayac["limit"]:
        yaz("Hiz limiti yedi      : %d  (tekrar calistirinca denenecek)" % sayac["limit"])
    if not test_modu:
        yaz("Supabase'e yuklendi  : %d" % sayac["yuklendi"])
        yaz("Yukleme hatasi       : %d" % sayac["hata"])
    yaz("Sure                 : %d dk" % ((time.time() - baslangic) / 60))

    satirlar.sort(key=lambda r: -r[1])
    with open(RAPOR, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["oyuncu", "populerlik", "dosya_adi", "durum", "not"])
        w.writerows(satirlar)
    yaz("Rapor: %s" % RAPOR)

    if test_modu:
        yaz("\n--dene modu: hicbir sey yuklenmedi.")
        yaz("SONUC: %s" % ("Teori TUTUYOR." if oran >= 40 else "Isabet dusuk."))
        return

    if guncellemeler or (a.olu_temizle and kurtarilamayan):
        taze = json_oku(PHOTOS_YOLU, {})
        taze.update(guncellemeler)
        silinen = 0
        if a.olu_temizle:
            for isim in kurtarilamayan:      # DERS 3: limit yiyenler burada YOK
                if isim in taze and not re.match(r"^https?://", str(taze[isim]), re.I):
                    del taze[isim]
                    silinen += 1
            yaz("Olu kayit silindi    : %d" % silinen)
        gecici = PHOTOS_YOLU + ".tmp"
        with open(gecici, "w", encoding="utf-8") as f:
            json.dump(taze, f, ensure_ascii=False)
        os.replace(gecici, PHOTOS_YOLU)
        yaz("lib/playerPhotos.json guncellendi (%d kurtarma)." % len(guncellemeler))


if __name__ == "__main__":
    main()
