# -*- coding: utf-8 -*-
"""
FOTOĞRAFLARI TEK KAYNAĞA (SUPABASE) TOPLAR.

NİYE (11 Eylül 2026 — Kerem: "uygulamadaki çalışan tüm resimleri supabase'de
depolayıp çalışmayanları düzeltmek"): Şu an fotoğraflar DÖRT ayrı yerden
geliyor ve hangisinin sağ hangisinin ölü olduğu belli değil:
  1) Supabase           -> zaten istediğimiz yer, dokunulmaz
  2) çıplak dosya adı   -> CloudFront'a çevriliyor (d138rdl3z47cng...)
  3) thesportsdb / wikimedia URL'leri
  4) lib/localPlayerPhotos.js -> APK'ya gömülü yerel dosyalar

BU SCRIPT NE YAPAR
  ADIM 1 (kontrol): Supabase'de OLMAYAN her kaydı tek tek indirmeyi dener.
                    Sonuç: kaç tanesi sağ, kaç tanesi ölü.
  ADIM 2 (taşıma) : Sağ olanları indirip Supabase'e yükler ve
                    lib/playerPhotos.json'daki adresi Supabase adresiyle
                    değiştirir. Gömülü yerel dosyaları da yükler.
  ADIM 3 (rapor)  : Ölü/eksik olanları POPÜLARİTEYE GÖRE sıralı CSV'ye yazar
                    -> foto_eksikler.csv  (elle doldurulacak liste)

HİÇBİR ZAMAN: service_role anahtarı dosyaya yazılmaz, uygulamaya gömülmez.
Sadece --key ile ya da SUPABASE_SERVICE_KEY ortam değişkeniyle verilir.

KULLANIM
    # 1) Sadece bak, hiçbir şey değiştirme (anahtar gerekmez):
    python scripts/foto_tek_kaynak.py --kontrol

    # 2) Taşı:
    python scripts/foto_tek_kaynak.py --key <service_role_anahtari>

    # Test için küçük parça:
    python scripts/foto_tek_kaynak.py --key <anahtar> --limit 50
"""

import argparse
import collections
import concurrent.futures as cf
import csv
import hashlib
import json
import os
import re
import sys
import threading
import time

try:
    import requests
except ImportError:
    print("requests kurulu degil:  pip install requests")
    sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS_YOLU = os.path.join(KOK, "lib", "playerPhotos.json")
LOKAL_JS = os.path.join(KOK, "lib", "localPlayerPhotos.js")
POP_YOLU = os.path.join(KOK, "lib", "playerPopularity.json")
PLAYERS_YOLU = os.path.join(KOK, "lib", "players.json")
YEDEK_KLASOR = os.path.join(KOK, "yedek")
RAPOR_EKSIK = os.path.join(KOK, "foto_eksikler.csv")
RAPOR_DURUM = os.path.join(KOK, "foto_durum.csv")

BUCKET = "player-photos"
CLOUDFRONT = "https://d138rdl3z47cng.cloudfront.net/"
UA = {"User-Agent": "Mozilla/5.0 (OrtakFutbolcu foto toplama)"}
MAX_BOYUT = 8 * 1024 * 1024


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


def hedef_ad(isim):
    return "custom/%s.png" % hashlib.md5(isim.encode("utf-8")).hexdigest()


def lokal_fotolar():
    """localPlayerPhotos.js icindeki require('...') yollarini cikarir."""
    if not os.path.exists(LOKAL_JS):
        return {}
    s = open(LOKAL_JS, encoding="utf-8").read()
    sonuc = {}
    for m in re.finditer(r'"((?:[^"\\]|\\.)*)"\s*:\s*require\(\s*"([^"]+)"\s*\)', s):
        isim = m.group(1).encode().decode("unicode_escape") if "\\u" in m.group(1) else m.group(1)
        goreli = m.group(2).lstrip("./")
        sonuc[isim] = os.path.normpath(os.path.join(os.path.dirname(LOKAL_JS), m.group(2)))
        if not os.path.exists(sonuc[isim]):
            alt = os.path.join(KOK, goreli)
            sonuc[isim] = alt
    return sonuc


def cozumle(deger):
    """playerPhotos.json degerini gercek indirilebilir URL'e cevirir."""
    if not deger:
        return None
    d = str(deger)
    if re.match(r"^https?://", d, re.I):
        return d
    try:
        from urllib.parse import quote
    except ImportError:
        from urllib import quote
    return CLOUDFRONT + quote(d, safe="")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default=os.environ.get("SUPABASE_SERVICE_KEY", ""))
    ap.add_argument("--url", default="")
    ap.add_argument("--kontrol", action="store_true",
                    help="Sadece hangisi sag hangisi olu diye bak, hicbir sey degistirme")
    ap.add_argument("--limit", type=int, default=0, help="En fazla su kadar kayit isle (test icin)")
    ap.add_argument("--is", dest="isci", type=int, default=12, help="Es zamanli indirme sayisi")
    ap.add_argument("--olu-temizle", dest="olu_temizle", action="store_true",
                    help="Erisilemeyen kayitlari playerPhotos.json'dan SIL "
                         "(uygulama bosuna olu adrese gitmesin)")
    a = ap.parse_args()

    proje = (a.url or env_oku("EXPO_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    if not proje and not a.kontrol:
        print("Supabase adresi yok. --url ile ver ya da .env icine EXPO_PUBLIC_SUPABASE_URL koy.")
        sys.exit(1)

    photos = json_oku(PHOTOS_YOLU, {})
    if not photos:
        print("lib/playerPhotos.json okunamadi.")
        sys.exit(1)
    pop = json_oku(POP_YOLU, {})
    lokal = lokal_fotolar()

    # --- ISLENECEK LISTEYI CIKAR -------------------------------------------
    zaten, isler = 0, []
    for isim, deger in photos.items():
        if proje and str(deger).startswith(proje):
            zaten += 1
            continue
        if isim in lokal:
            isler.append((isim, "yerel", lokal[isim]))
        else:
            url = cozumle(deger)
            if url:
                isler.append((isim, "uzak", url))
    # playerPhotos'ta hic kaydi olmayan ama yerelde duran dosyalar
    for isim, yol in lokal.items():
        if isim not in photos:
            isler.append((isim, "yerel", yol))

    isler.sort(key=lambda x: -float(pop.get(x[0], 0) or 0))
    if a.limit:
        isler = isler[: a.limit]

    print("Toplam foto kaydi        : %d" % len(photos))
    print("Zaten Supabase'de        : %d  (dokunulmayacak)" % zaten)
    print("Islenecek                : %d  (%d yerel, %d uzak)"
          % (len(isler),
             sum(1 for i in isler if i[1] == "yerel"),
             sum(1 for i in isler if i[1] == "uzak")))
    if not isler:
        print("Yapacak is yok.")
        return

    # --- ANAHTAR / BUCKET KONTROLU -----------------------------------------
    basliklar = None
    if not a.kontrol:
        anahtar = (a.key or "").strip().strip('"').strip("'")
        if len(anahtar) < 40 or anahtar.count(".") != 2:
            print("\nHATA: Anahtar gecersiz gorunuyor (%d karakter)." % len(anahtar))
            print("      PowerShell'de:  $env:SUPABASE_SERVICE_KEY=\"eyJ...\"")
            print("      ya da dogrudan: --key eyJ...")
            sys.exit(1)
        basliklar = {"Authorization": "Bearer %s" % anahtar, "apikey": anahtar}
        t = requests.get("%s/storage/v1/bucket/%s" % (proje, BUCKET),
                         headers=basliklar, timeout=20)
        if t.status_code in (401, 403):
            print("HATA: Anahtar reddedildi (%s). service_role anahtari olmali." % t.status_code)
            sys.exit(1)
        if t.status_code == 404:
            print("HATA: '%s' adinda bucket yok. Supabase > Storage'dan olustur (public)." % BUCKET)
            sys.exit(1)
        print("Supabase baglantisi OK.\n")
        os.makedirs(YEDEK_KLASOR, exist_ok=True)
        yedek = os.path.join(YEDEK_KLASOR, "playerPhotos_%s.json" % time.strftime("%Y%m%d_%H%M%S"))
        with open(yedek, "w", encoding="utf-8") as f:
            json.dump(photos, f, ensure_ascii=False)
        print("Yedek: %s\n" % yedek)

    # --- IS ----------------------------------------------------------------
    kilit = threading.Lock()
    sayac = {"sag": 0, "olu": 0, "yuklendi": 0, "hata": 0, "islenen": 0}
    olular, durumlar, guncellemeler = [], [], {}

    yerel_oturum = threading.local()

    # 11 Eylul 2026 — ILK --kontrol TURUNUN DERSI: wikimedia'dan gelen 338
    # "olu" kaydin HEPSI aslinda HTTP 429'du, yani resim SAG, biz cok hizli
    # istek attik. Wikipedia paralel/hizli istegi sevmiyor. Bu yuzden host
    # basina EN AZ ARALIK koyuyoruz ve 429'da bekleyip tekrar deniyoruz.
    HOST_ARALIK = {"upload.wikimedia.org": 0.35, "thumb.wikimedia.org": 0.35}
    _son = {}
    _host_kilit = threading.Lock()

    # 11 Eylul 2026 — IKINCI DERS: --kontrol turu CloudFront'un 9137 kaydinin
    # HEPSININ ConnectionError verdigini kanitladi; host komple kapanmis. Buna
    # ragmen her kaydi 4 kez deneyip aralarda bekliyorduk (kayit basina ~9 sn,
    # toplamda ~2 saat bos bekleme). Artik CloudFront hic denenmiyor; ayrica
    # herhangi bir host art arda 30 baglanti hatasi verip hic basari
    # uretmezse otomatik "kapali" sayiliyor.
    OLU_HOSTLAR = {"d138rdl3z47cng.cloudfront.net"}
    _host_hata = collections.Counter()
    _host_basari = collections.Counter()

    def host_al(url):
        parca = url.split("/")
        return parca[2] if len(parca) > 2 else ""

    def host_olu_mu(host):
        if host in OLU_HOSTLAR:
            return True
        with _host_kilit:
            return _host_hata[host] >= 30 and _host_basari[host] == 0

    def indir(url):
        """(veri, hata) dondurur. Olu hostta hic aga cikmaz."""
        host = host_al(url)
        if host_olu_mu(host):
            return None, "host kapali (%s)" % host
        s = oturum_al()
        hata = ""
        for deneme in range(4):
            try:
                hiz_bekle(url)
                r = s.get(url, timeout=25, stream=True)
                if r.status_code in (429, 503):
                    hata = "HTTP %s" % r.status_code
                    time.sleep(2 * (deneme + 1) ** 2)   # 2, 8, 18 sn
                    continue
                if r.status_code != 200:
                    return None, "HTTP %s" % r.status_code
                tur = (r.headers.get("Content-Type") or "").lower()
                if "image" not in tur:
                    return None, "resim degil (%s)" % tur[:30]
                veri = r.raw.read(MAX_BOYUT + 1, decode_content=True)
                if len(veri) > MAX_BOYUT:
                    return None, "cok buyuk"
                if len(veri) < 500:
                    return None, "cok kucuk / bos"
                with _host_kilit:
                    _host_basari[host] += 1
                return veri, ""
            except Exception as e:
                hata = type(e).__name__
                with _host_kilit:
                    _host_hata[host] += 1
                if deneme == 3 or host_olu_mu(host):
                    break
                time.sleep(1.5 * (deneme + 1))
        return None, hata

    def hiz_bekle(url):
        try:
            host = url.split("/")[2]
        except IndexError:
            return
        aralik = HOST_ARALIK.get(host)
        if not aralik:
            return
        with _host_kilit:
            simdi = time.time()
            bekle = _son.get(host, 0) + aralik - simdi
            if bekle > 0:
                time.sleep(bekle)
                simdi = time.time()
            _son[host] = simdi

    def oturum_al():
        if not hasattr(yerel_oturum, "s"):
            yerel_oturum.s = requests.Session()
            yerel_oturum.s.headers.update(UA)
        return yerel_oturum.s

    def isle(kayit):
        isim, tip, kaynak = kayit
        s = oturum_al()
        veri, hata = None, ""
        if tip == "yerel":
            try:
                with open(kaynak, "rb") as f:
                    veri = f.read()
            except Exception as e:
                hata = "dosya okunamadi: %s" % e
        else:
            veri, hata = indir(kaynak)

        with kilit:
            sayac["islenen"] += 1
            if sayac["islenen"] % 200 == 0:
                print("  ... %d/%d  (sag %d, olu %d, yuklendi %d)"
                      % (sayac["islenen"], len(isler), sayac["sag"],
                         sayac["olu"], sayac["yuklendi"]))

        if veri is None:
            with kilit:
                sayac["olu"] += 1
                olular.append([isim, round(float(pop.get(isim, 0) or 0), 2), tip, kaynak, hata])
                durumlar.append([isim, tip, "OLU", hata])
            return
        with kilit:
            sayac["sag"] += 1
        if a.kontrol:
            with kilit:
                durumlar.append([isim, tip, "SAG", ""])
            return

        yol = hedef_ad(isim)
        try:
            u = s.post("%s/storage/v1/object/%s/%s" % (proje, BUCKET, yol),
                       data=veri,
                       headers=dict(basliklar, **{"Content-Type": "image/png",
                                                  "x-upsert": "true"}),
                       timeout=60)
            if u.status_code in (200, 201):
                with kilit:
                    sayac["yuklendi"] += 1
                    guncellemeler[isim] = "%s/storage/v1/object/public/%s/%s" % (proje, BUCKET, yol)
                    durumlar.append([isim, tip, "YUKLENDI", ""])
            else:
                with kilit:
                    sayac["hata"] += 1
                    durumlar.append([isim, tip, "YUKLEME HATASI", "HTTP %s %s" % (u.status_code, u.text[:120])])
        except Exception as e:
            with kilit:
                sayac["hata"] += 1
                durumlar.append([isim, tip, "YUKLEME HATASI", type(e).__name__])

    with cf.ThreadPoolExecutor(max_workers=max(1, a.isci)) as havuz:
        list(havuz.map(isle, isler))

    # --- SONUC -------------------------------------------------------------
    print("\n" + "=" * 58)
    print("Erisilebilen (sag)   : %d" % sayac["sag"])
    print("Olu / eksik          : %d" % sayac["olu"])
    if not a.kontrol:
        print("Supabase'e yuklendi  : %d" % sayac["yuklendi"])
        print("Yukleme hatasi       : %d" % sayac["hata"])

    with open(RAPOR_DURUM, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["oyuncu", "kaynak_tipi", "durum", "not"])
        w.writerows(durumlar)
    olular.sort(key=lambda r: -r[1])
    with open(RAPOR_EKSIK, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["oyuncu", "populerlik", "kaynak_tipi", "kaynak", "sebep"])
        w.writerows(olular)
    print("\nRaporlar:\n  %s\n  %s" % (RAPOR_DURUM, RAPOR_EKSIK))
    if olular:
        print("\nEn populer ilk 10 eksik:")
        for r in olular[:10]:
            print("  %-28s pop %-8s %s" % (r[0][:28], r[1], r[4]))

    if a.kontrol:
        print("\n--kontrol modu: hicbir sey degistirilmedi.")
        return

    if guncellemeler or (a.olu_temizle and olular):
        taze = json_oku(PHOTOS_YOLU, {})
        taze.update(guncellemeler)
        silinen = 0
        if a.olu_temizle:
            for r in olular:
                # Sadece GERCEKTEN erisilemeyenleri sil; hiz limiti (429)
                # yuzunden dusenler sag, onlara dokunma.
                if "429" in r[4] or "503" in r[4]:
                    continue
                if r[0] in taze:
                    del taze[r[0]]
                    silinen += 1
            print("Olu kayit silindi    : %d" % silinen)
        gecici = PHOTOS_YOLU + ".tmp"
        with open(gecici, "w", encoding="utf-8") as f:
            json.dump(taze, f, ensure_ascii=False)
        os.replace(gecici, PHOTOS_YOLU)
        print("\nlib/playerPhotos.json guncellendi (%d kayit Supabase'e tasindi)."
              % len(guncellemeler))


if __name__ == "__main__":
    main()
