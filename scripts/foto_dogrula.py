# -*- coding: utf-8 -*-
"""
GÖMÜLÜ GÖRSELLERİ DOĞRULAR — uzantısı ile gerçek formatı uyuşuyor mu?

NİYE (25 Eylül 2026): İlk üretim derlemesi şu hatayla patladı:
    ERROR: .../assets_player_photos_custom_renatonhaga.png:
           AAPT: error: file failed to compile.
Sebep: `Renato Nhaga.png` aslında bir JPEG'di, `Suat Kaya.png` aslında WebP.
Metro/JS bunu sorun etmiyor, geliştirme sürümünde resimler sorunsuz görünüyor.
Ama `require()` edilen her görsel Android'de bir DRAWABLE kaynağına dönüşüyor
ve AAPT2 formatı UZANTIDAN belirliyor — .png uzantılı JPEG'i derleyemiyor.
Yani bu hata SADECE üretim derlemesinde ortaya çıkıyor ve bir build (~14 dk)
harcıyor. Bu script o 14 dakikayı saniyeler içinde kurtarıyor.

KULLANIM (proje kökünden)
    python scripts/foto_dogrula.py              # sadece kontrol et, rapor ver
    python scripts/foto_dogrula.py --duzelt     # uyuşmayanları yeniden kodla

DERLEMEDEN ÖNCE ÇALIŞTIR. Yeni görsel eklediğin her seferde.
"""
import argparse, os, shutil, sys

try:
    from PIL import Image
except ImportError:
    print("Pillow kurulu degil:  pip install Pillow")
    sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARANAN = [
    os.path.join(KOK, "assets"),          # alt klasorleriyle birlikte
]
BOZUK_KLASOR = os.path.join(KOK, "assets_bozuk")   # assets/ DISINDA: derlemeye girmez

# uzanti -> PIL format adi
BEKLENEN = {".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG", ".webp": "WEBP", ".gif": "GIF"}
# uzantinin kaydedilecegi format
KAYDET = {".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG", ".webp": "WEBP"}


def gorseller():
    for kok in TARANAN:
        if not os.path.isdir(kok):
            continue
        for dizin, _, dosyalar in os.walk(kok):
            for d in dosyalar:
                uz = os.path.splitext(d)[1].lower()
                if uz in BEKLENEN:
                    yield os.path.join(dizin, d)


def yeniden_kodla(yol, hedef_format):
    im = Image.open(yol)
    if hedef_format == "JPEG":
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            zemin = Image.new("RGB", im.size, (255, 255, 255))
            zemin.paste(im, mask=im.split()[-1])
            im = zemin
        else:
            im = im.convert("RGB")
        im.save(yol, "JPEG", quality=92)
    elif hedef_format == "WEBP":
        im.save(yol, "WEBP", quality=88, method=6)
    else:
        im.save(yol, "PNG", optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--duzelt", action="store_true",
                    help="uzantisiyla uyusmayan dosyalari yeniden kodlar")
    a = ap.parse_args()

    toplam = 0
    uyusmaz = []     # (yol, gercek_format, beklenen_format)
    acilmaz = []     # (yol, hata)

    for yol in gorseller():
        toplam += 1
        uz = os.path.splitext(yol)[1].lower()
        try:
            with Image.open(yol) as im:
                gercek = im.format
            with Image.open(yol) as im:
                im.load()          # bozuk/yarim dosyayi burada yakalar
        except Exception as e:
            acilmaz.append((yol, "%s: %s" % (type(e).__name__, e)))
            continue
        if gercek != BEKLENEN[uz]:
            uyusmaz.append((yol, gercek, BEKLENEN[uz]))

    print("Taranan gorsel      : %d" % toplam)
    print("Uzanti uyusmazligi  : %d" % len(uyusmaz))
    print("Hic acilamayan      : %d" % len(acilmaz))

    for yol, gercek, beklenen in uyusmaz:
        print("   %-58s %s ama uzantisi %s" % (os.path.relpath(yol, KOK), gercek, beklenen))
    for yol, hata in acilmaz:
        print("   %-58s %s" % (os.path.relpath(yol, KOK), hata))

    if not uyusmaz and not acilmaz:
        print("\nHepsi temiz. Derleme bu yuzden patlamaz.")
        return 0

    if not a.duzelt:
        print("\nDuzeltmek icin:  python scripts/foto_dogrula.py --duzelt")
        return 1

    print("\n--- DUZELTILIYOR ---")
    duzeltildi, tasindi = 0, 0
    for yol, gercek, beklenen in uyusmaz:
        try:
            yeniden_kodla(yol, KAYDET[os.path.splitext(yol)[1].lower()])
            duzeltildi += 1
            print("   yeniden kodlandi: %s" % os.path.relpath(yol, KOK))
        except Exception as e:
            acilmaz.append((yol, "yeniden kodlanamadi: %s" % e))

    for yol, hata in acilmaz:
        if not os.path.exists(yol):
            continue
        os.makedirs(BOZUK_KLASOR, exist_ok=True)
        hedef = os.path.join(BOZUK_KLASOR, os.path.basename(yol))
        n = 1
        while os.path.exists(hedef):
            kok_ad, uz = os.path.splitext(os.path.basename(yol))
            hedef = os.path.join(BOZUK_KLASOR, "%s_%d%s" % (kok_ad, n, uz)); n += 1
        shutil.move(yol, hedef)
        tasindi += 1
        print("   BOZUK, tasindi  : %s -> assets_bozuk/" % os.path.relpath(yol, KOK))

    print("\nYeniden kodlanan: %d | bozuk diye tasinan: %d" % (duzeltildi, tasindi))
    if tasindi:
        print("\nDIKKAT: tasinan dosyalari require() eden satirlari da kaldirmalisin")
        print("(lib/localPlayerPhotos.js veya lib/clubLogos.js), yoksa Metro")
        print("'Unable to resolve module' hatasi verir.")
    print("\nTekrar kontrol:  python scripts/foto_dogrula.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
