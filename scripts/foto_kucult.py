# -*- coding: utf-8 -*-
"""
FOTOĞRAFLARI KÜÇÜLTÜR (PNG -> WebP).

NEDEN: Supabase 13 Eylül 2026'da kota uyarısı gönderdi — depolama 1,42 GB,
ücretsiz planın sınırı 1 GB ve 14 Ekim'de Fair Use devreye giriyor. Sebep
fotoğraf SAYISI değil FORMATI: 27.825 kaydın hepsi PNG, ve PNG fotoğraf için
yanlış format. Örnek dosyalar üzerinde ölçtük: 320px WebP'ye çevirince
ortalama %88 küçülüyor (527 KB -> 63 KB). Uygulama fotoğrafları zaten en fazla
110 pikselde gösteriyor, yani kaybedilen çözünürlük hiç ekrana ulaşmıyordu.

Beklenen sonuç: ~1,42 GB -> ~170 MB. Bu hem kotayı çözüyor hem de uygulamanın
fotoğraf yüklemesini 8-10 kat hızlandırıyor (yayın sonrası trafik kotası için
de asıl önemli olan bu).

GÜVENLİK — BU SCRIPT NEDEN BU KADAR TEMKİNLİ:
Bu fotoğrafların BAŞKA KOPYASI YOK. Orijinaller Supabase'de duruyor, yerelde
sadece eski bir partiden kalma ~250 dosya var. O yüzden akış üç ayrı adıma
bölündü ve silme işlemi ayrı bir komut:

  1) python scripts/foto_kucult.py --deneme 50      -> 50 dosyalık deneme
  2) python scripts/foto_kucult.py                  -> tamamını dönüştür + yükle
  3) (telefonda kontrol et)
  4) python scripts/foto_kucult.py --yaz            -> playerPhotos.json'u güncelle
  5) (uygulamayı çalıştır, fotoğraflar geliyor mu bak)
  6) python scripts/foto_kucult.py --sil            -> ESKİ PNG'leri sil

Dönüştürülen her dosya AYNI ZAMANDA `foto_webp/` klasörüne yazılıyor. Yani
6. adıma gelene kadar elinde tam bir yerel kopya oluyor; bir terslik olursa
oradan geri yükleyebilirsin. `--sil` sadece hem yüklenmiş hem de yerelde
mevcut olan dosyaları siler.

ÖNEMLİ: 6. adımı atlarsan depolama AZALMAZ, ARTAR — yeni WebP'ler eskilerin
yanına eklenmiş olur (1,42 GB + 170 MB).

ANAHTAR: service_role anahtarı uygulamaya GÖMÜLMEZ. Sadece --key ile ya da
SUPABASE_SERVICE_KEY ortam değişkeniyle verilir.
  PowerShell:  $env:SUPABASE_SERVICE_KEY="eyJ..."
"""
import argparse
import concurrent.futures as cf
import io
import json
import os
import sys
import threading
import time

try:
    import requests
except ImportError:
    print("requests kurulu degil:  pip install requests")
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("Pillow kurulu degil:  pip install Pillow")
    sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS_YOLU = os.path.join(KOK, "lib", "playerPhotos.json")
ILERLEME_YOLU = os.path.join(KOK, "foto_kucultme_ilerleme.json")
WEBP_KLASOR = os.path.join(KOK, "foto_webp")
RAPOR_YOLU = os.path.join(KOK, "foto_kucultme_raporu.csv")

BUCKET = "player-photos"
MAX_KENAR = 320        # uygulama en fazla 110px gosteriyor; 320 yuksek DPI icin fazlasiyla yeterli
KALITE = 82
UA = {"User-Agent": "Mozilla/5.0 (OrtakFutbolcu foto kucultme)"}


def env_oku(anahtar):
    for ad in (".env", ".env.local"):
        yol = os.path.join(KOK, ad)
        if not os.path.exists(yol):
            continue
        try:
            with io.open(yol, encoding="utf-8") as f:
                for satir in f:
                    satir = satir.strip()
                    if satir.startswith(anahtar + "="):
                        return satir.split("=", 1)[1].strip().strip('"').strip("'")
        except Exception:
            pass
    return ""


def json_oku(yol, varsayilan):
    if not os.path.exists(yol):
        return varsayilan
    try:
        with io.open(yol, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return varsayilan


def json_yaz(yol, veri):
    gecici = yol + ".tmp"
    with io.open(gecici, "w", encoding="utf-8") as f:
        f.write(json.dumps(veri, ensure_ascii=False, indent=1))
    os.replace(gecici, yol)          # yarim yazilmis dosya birakmaz


def depo_yolu(url, proje):
    """Tam public URL -> bucket icindeki yol.  .../public/player-photos/custom/x.png -> custom/x.png"""
    onek = "%s/storage/v1/object/public/%s/" % (proje, BUCKET)
    if url.startswith(onek):
        return url[len(onek):]
    return None


def webp_yolu(png_yolu):
    return os.path.splitext(png_yolu)[0] + ".webp"


def cevir(veri):
    """PNG baytlari -> WebP baytlari.  (bayt, genislik, yukseklik) ya da hata mesaji."""
    im = Image.open(io.BytesIO(veri))
    # Saydamligi olan fotograflarda beyaz zemin: WebP saydamligi destekliyor ama
    # uygulama fotograflari daire icinde gosteriyor, saydam kose bir ise yaramiyor
    # ve RGB'ye cevirmek dosyayi kucultuyor.
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        zemin = Image.new("RGB", im.size, (255, 255, 255))
        zemin.paste(im, mask=im.split()[-1])
        im = zemin
    else:
        im = im.convert("RGB")
    im.thumbnail((MAX_KENAR, MAX_KENAR), Image.LANCZOS)
    cikti = io.BytesIO()
    im.save(cikti, "WEBP", quality=KALITE, method=6)
    return cikti.getvalue(), im.size[0], im.size[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default=os.environ.get("SUPABASE_SERVICE_KEY", ""))
    ap.add_argument("--url", default="")
    ap.add_argument("--deneme", type=int, default=0,
                    help="Sadece bu kadar dosya isle (deneme turu icin)")
    ap.add_argument("--is", dest="isci", type=int, default=8,
                    help="Es zamanli indirme/yukleme sayisi")
    ap.add_argument("--yaz", action="store_true",
                    help="lib/playerPhotos.json'u yeni WebP adresleriyle gunceller")
    ap.add_argument("--sil", action="store_true",
                    help="ESKI PNG dosyalarini Supabase'den siler (geri alinamaz)")
    ap.add_argument("--durum", action="store_true",
                    help="Sadece durumu yazdirir, hicbir sey degistirmez")
    a = ap.parse_args()

    proje = (a.url or env_oku("EXPO_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    if not proje:
        print("Supabase adresi yok. --url ile ver ya da .env icine EXPO_PUBLIC_SUPABASE_URL koy.")
        sys.exit(1)

    photos = json_oku(PHOTOS_YOLU, {})
    ilerleme = json_oku(ILERLEME_YOLU, {})

    # --- Islenecek kayitlari cikar -----------------------------------------
    isler, atlanan_http, atlanan_ciplak = [], [], []
    for isim, deger in photos.items():
        s = str(deger)
        if not s.startswith("http"):
            atlanan_ciplak.append(isim)         # eski CloudFront dosya adlari (o host olu)
            continue
        yol = depo_yolu(s, proje)
        if yol is None:
            atlanan_http.append(isim)           # baska bir host (TheSportsDB vb.) - dokunmuyoruz
            continue
        if not yol.lower().endswith(".png"):
            continue                            # zaten donusturulmus ya da farkli format
        isler.append((isim, yol))

    bitmis = [i for i in isler if ilerleme.get(i[0], {}).get("durum") == "tamam"]
    kalan = [i for i in isler if ilerleme.get(i[0], {}).get("durum") != "tamam"]

    print("Supabase projesi : %s" % proje)
    print("Toplam kayit     : %d" % len(photos))
    print("  Supabase PNG   : %d  (islenecek)" % len(isler))
    print("    - bitmis     : %d" % len(bitmis))
    print("    - kalan      : %d" % len(kalan))
    print("  baska host     : %d  (dokunulmuyor)" % len(atlanan_http))
    print("  ciplak dosya adi: %d  (olu CloudFront kaydi, --yaz bunlari temizler)"
          % len(atlanan_ciplak))
    print()

    if a.durum:
        eski = sum(v.get("eski", 0) for v in ilerleme.values())
        yeni = sum(v.get("yeni", 0) for v in ilerleme.values())
        if eski:
            print("Donusturulenler: %.1f MB -> %.1f MB  (%%%d kazanc)"
                  % (eski / 1048576.0, yeni / 1048576.0, 100 - round(yeni * 100.0 / eski)))
        return

    # ---------------------------------------------------------------- --yaz
    if a.yaz:
        yeni_photos, degisen, silinen = {}, 0, 0
        for isim, deger in photos.items():
            kayit = ilerleme.get(isim)
            if kayit and kayit.get("durum") == "tamam":
                yeni_photos[isim] = "%s/storage/v1/object/public/%s/%s" % (
                    proje, BUCKET, kayit["yeni_yol"])
                degisen += 1
            elif str(deger).startswith("http"):
                yeni_photos[isim] = deger          # baska host: oldugu gibi kalsin
            else:
                silinen += 1                        # olu CloudFront kaydi: dusuyor
        yedek = PHOTOS_YOLU + ".png_yedek"
        if not os.path.exists(yedek):
            json_yaz(yedek, photos)
            print("Eski hali yedeklendi: %s" % yedek)
        json_yaz(PHOTOS_YOLU, yeni_photos)
        print("playerPhotos.json guncellendi: %d kayit WebP'ye tasindi, %d olu kayit dusuruldu."
              % (degisen, silinen))
        print("Toplam kayit: %d -> %d" % (len(photos), len(yeni_photos)))
        print()
        print("Simdi uygulamayi calistir ve fotograflarin geldigini gor.")
        print("Sonra eskileri silmek icin:  python scripts/foto_kucult.py --sil")
        return

    # --- ANAHTAR gerektiren isler ------------------------------------------
    if not a.key or len(a.key) < 40:
        print("HATA: service_role anahtari gerekli.")
        print("      PowerShell'de:  $env:SUPABASE_SERVICE_KEY=\"eyJ...\"")
        print("      ya da:          python scripts/foto_kucult.py --key eyJ...")
        sys.exit(1)

    basliklar = {"Authorization": "Bearer %s" % a.key, "apikey": a.key}
    kilit = threading.Lock()
    yerel = threading.local()

    def oturum():
        if not hasattr(yerel, "s"):
            yerel.s = requests.Session()
            yerel.s.headers.update(UA)
        return yerel.s

    # ---------------------------------------------------------------- --sil
    if a.sil:
        silinecek = []
        for isim, kayit in ilerleme.items():
            if kayit.get("durum") != "tamam":
                continue
            # GUVENLIK: yerel kopyasi olmayan hicbir sey silinmez.
            yerel_dosya = os.path.join(WEBP_KLASOR, kayit["yeni_yol"].replace("/", os.sep))
            if not os.path.exists(yerel_dosya):
                continue
            silinecek.append((isim, kayit["eski_yol"]))

        print("Silinecek eski PNG: %d" % len(silinecek))
        print("(yerel kopyasi olmayan hicbir dosya silinmiyor)")
        if not silinecek:
            print("Silinecek bir sey yok.")
            return
        print()
        print("BU ISLEM GERI ALINAMAZ. Devam etmek icin 'SIL' yazip Enter'a bas:")
        if input("> ").strip() != "SIL":
            print("Iptal edildi.")
            return

        sayac = {"ok": 0, "hata": 0}

        def sil(kayit):
            isim, yol = kayit
            try:
                r = oturum().delete("%s/storage/v1/object/%s/%s" % (proje, BUCKET, yol),
                                    headers=basliklar, timeout=30)
                with kilit:
                    if r.status_code in (200, 204, 404):   # 404 = zaten yok, sorun degil
                        sayac["ok"] += 1
                    else:
                        sayac["hata"] += 1
                    n = sayac["ok"] + sayac["hata"]
                    if n % 500 == 0:
                        print("  ... %d/%d silindi" % (n, len(silinecek)))
            except Exception:
                with kilit:
                    sayac["hata"] += 1

        with cf.ThreadPoolExecutor(max_workers=a.isci) as ex:
            list(ex.map(sil, silinecek))
        print()
        print("Silindi: %d, hata: %d" % (sayac["ok"], sayac["hata"]))
        print("Supabase panelindeki depolama rakami birkac dakika icinde dusecek.")
        return

    # ------------------------------------------------------- donustur + yukle
    if a.deneme:
        kalan = kalan[:a.deneme]
        print(">>> DENEME TURU: %d dosya\n" % len(kalan))
    if not kalan:
        print("Donusturulecek dosya kalmadi.")
        print("Sirada: python scripts/foto_kucult.py --yaz")
        return

    os.makedirs(WEBP_KLASOR, exist_ok=True)
    sayac = {"ok": 0, "hata": 0, "eski": 0, "yeni": 0}
    basladi = time.time()

    def isle(is_kaydi):
        isim, eski_yol = is_kaydi
        s = oturum()
        try:
            r = s.get("%s/storage/v1/object/public/%s/%s" % (proje, BUCKET, eski_yol),
                      timeout=60)
            if r.status_code != 200:
                raise RuntimeError("indirilemedi (%s)" % r.status_code)
            ham = r.content
            webp, w, h = cevir(ham)

            yeni_yol = webp_yolu(eski_yol)

            # Once YERELE yaz — yukleme basarisiz olsa bile kopya elimizde kalsin.
            hedef = os.path.join(WEBP_KLASOR, yeni_yol.replace("/", os.sep))
            os.makedirs(os.path.dirname(hedef), exist_ok=True)
            with open(hedef, "wb") as f:
                f.write(webp)

            u = s.post("%s/storage/v1/object/%s/%s" % (proje, BUCKET, yeni_yol),
                       data=webp,
                       headers=dict(basliklar, **{"Content-Type": "image/webp",
                                                  "x-upsert": "true"}),
                       timeout=60)
            if u.status_code not in (200, 201):
                raise RuntimeError("yuklenemedi (%s)" % u.status_code)

            with kilit:
                ilerleme[isim] = {"durum": "tamam", "eski_yol": eski_yol,
                                  "yeni_yol": yeni_yol, "eski": len(ham),
                                  "yeni": len(webp), "boyut": "%dx%d" % (w, h)}
                sayac["ok"] += 1
                sayac["eski"] += len(ham)
                sayac["yeni"] += len(webp)
        except Exception as e:
            with kilit:
                ilerleme[isim] = {"durum": "hata", "eski_yol": eski_yol, "hata": str(e)[:120]}
                sayac["hata"] += 1

        with kilit:
            n = sayac["ok"] + sayac["hata"]
            if n % 100 == 0:
                gecen = time.time() - basladi
                hiz = n / gecen if gecen else 0
                kalan_sn = (len(kalan) - n) / hiz if hiz else 0
                print("  ... %d/%d  (hata %d)  ~%d dk kaldi"
                      % (n, len(kalan), sayac["hata"], kalan_sn / 60))
            if n % 250 == 0:
                json_yaz(ILERLEME_YOLU, ilerleme)    # cokme/kesinti olursa kaldigi yerden devam

    try:
        with cf.ThreadPoolExecutor(max_workers=a.isci) as ex:
            list(ex.map(isle, kalan))
    except KeyboardInterrupt:
        print("\nDurduruldu — ilerleme kaydediliyor, tekrar calistirinca kaldigi yerden devam eder.")
    finally:
        json_yaz(ILERLEME_YOLU, ilerleme)

    # --- rapor --------------------------------------------------------------
    with io.open(RAPOR_YOLU, "w", encoding="utf-8-sig", newline="") as f:
        f.write("isim,eski_bayt,yeni_bayt,kazanc_yuzde,boyut,durum,hata\n")
        for isim, k in sorted(ilerleme.items()):
            if k.get("durum") == "tamam":
                kz = 100 - round(k["yeni"] * 100.0 / k["eski"]) if k["eski"] else 0
                f.write('"%s",%d,%d,%d,%s,tamam,\n'
                        % (isim.replace('"', "'"), k["eski"], k["yeni"], kz, k.get("boyut", "")))
            else:
                f.write('"%s",,,,,hata,"%s"\n'
                        % (isim.replace('"', "'"), str(k.get("hata", "")).replace('"', "'")))

    print()
    print("Donusturuldu: %d, hata: %d" % (sayac["ok"], sayac["hata"]))
    if sayac["eski"]:
        print("Boyut: %.1f MB -> %.1f MB  (%%%d kazanc)"
              % (sayac["eski"] / 1048576.0, sayac["yeni"] / 1048576.0,
                 100 - round(sayac["yeni"] * 100.0 / sayac["eski"])))
        if a.deneme:
            oran = sayac["yeni"] / float(sayac["eski"])
            print("Bu orana gore 27.825 dosyanin tamami ~%.0f MB olur (su an ~1420 MB)."
                  % (1420 * oran))
    print("Yerel kopyalar   : %s" % WEBP_KLASOR)
    print("Rapor            : %s" % RAPOR_YOLU)
    print()
    if a.deneme:
        print("Deneme bitti. foto_webp/ icindeki birkac dosyayi acip kaliteyi kontrol et.")
        print("Iyiyse tamamini calistir:  python scripts/foto_kucult.py")
    else:
        print("Sirada: python scripts/foto_kucult.py --yaz")


if __name__ == "__main__":
    main()
