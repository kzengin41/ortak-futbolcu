# -*- coding: utf-8 -*-
"""
BİR FUTBOLCUNUN FOTOĞRAFINI DEĞİŞTİR / KALDIR.

25 Eylül 2026 (Kerem: "talisca resmi hatalı. resim güncelleme için kolay bir
yol lazım.") — yanlış bir fotoğrafı düzeltmek için tek komut.

NASIL ÇALIŞIYOR
Uygulamadaki fotoğraf adresi futbolcunun adının md5'i:
    player-photos/custom/<md5(isim)>.webp
Adres SABİT olduğu için dosyanın içeriğini değiştirmek yeterli — uygulamada
kod değişikliği gerekmiyor. Yine de lib/playerPhotos.json'a bir sürüm
damgası (?v=...) yazıyoruz, çünkü telefonlar eski resmi önbellekte tutuyor;
damga değişince yeni resmi indiriyorlar.

KULLANIM
  # tek futbolcu, yerel dosyadan
  python scripts/foto_degistir.py "Talisca" C:\\Users\\Monster\\Desktop\\talisca.jpg

  # tek futbolcu, internetten
  python scripts/foto_degistir.py "Talisca" https://ornek.com/talisca.jpg

  # klasördeki bütün resimler (dosya adı = futbolcu adı)
  python scripts/foto_degistir.py --klasor C:\\Users\\Monster\\Desktop\\yeni_fotolar

  # fotoğrafı tamamen kaldır (baş harf rozetine düşer)
  python scripts/foto_degistir.py --kaldir "Talisca"

  # şu an hangi resim duruyor? indirip masaüstüne koyar
  python scripts/foto_degistir.py --bak "Talisca"

ANAHTAR: service_role anahtarı uygulamaya GÖMÜLMEZ. Sadece --key ile ya da
SUPABASE_SERVICE_KEY ortam değişkeniyle verilir.
  PowerShell:  $env:SUPABASE_SERVICE_KEY="eyJ..."
"""
import argparse, difflib, hashlib, io, json, os, re, sys, time

try:
    import requests
except ImportError:
    print("requests kurulu degil:  pip install requests"); sys.exit(1)
try:
    from PIL import Image
except ImportError:
    print("Pillow kurulu degil:  pip install Pillow"); sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS_YOLU = os.path.join(KOK, "lib", "playerPhotos.json")
PLAYERS_YOLU = os.path.join(KOK, "lib", "players.json")
WEBP_KLASOR = os.path.join(KOK, "foto_webp")
BUCKET = "player-photos"
MAX_KENAR = 320
KALITE = 82
UA = {"User-Agent": "Mozilla/5.0 (OrtakFutbolcu foto degistirme)"}
RESIM_UZANTI = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif")


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
    with io.open(yol, encoding="utf-8") as f:
        return json.load(f)


def json_yaz(yol, veri):
    gecici = yol + ".tmp"
    with io.open(gecici, "w", encoding="utf-8") as f:
        f.write(json.dumps(veri, ensure_ascii=False, indent=1))
    os.replace(gecici, yol)


def isim_coz(aranan, isimler):
    """Tam ad bul. Bulamazsa yakın adayları döndür. -> (ad, adaylar)"""
    if aranan in isimler:
        return aranan, []
    kucuk = {n.lower(): n for n in isimler}
    if aranan.lower() in kucuk:
        return kucuk[aranan.lower()], []
    adaylar = difflib.get_close_matches(aranan, isimler, n=6, cutoff=0.7)
    if not adaylar:
        # soyad / parça araması
        p = aranan.lower()
        adaylar = [n for n in isimler if p in n.lower()][:6]
    if len(adaylar) == 1:
        return adaylar[0], []
    return None, adaylar


def resmi_al(kaynak):
    """Yerel dosya ya da URL -> ham bayt"""
    if re.match(r"^https?://", kaynak, re.I):
        r = requests.get(kaynak, headers=UA, timeout=45)
        r.raise_for_status()
        return r.content
    if not os.path.exists(kaynak):
        raise IOError("dosya yok: %s" % kaynak)
    with open(kaynak, "rb") as f:
        return f.read()


def webp_cevir(veri):
    im = Image.open(io.BytesIO(veri))
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
    return cikti.getvalue(), im.size


def depo_yolu_uret(isim):
    return "custom/%s.webp" % hashlib.md5(isim.encode("utf-8")).hexdigest()


def adres_temizle(url):
    return url.split("?", 1)[0] if url else url


def yukle(oturum, proje, yol, veri):
    r = oturum.post(
        "%s/storage/v1/object/%s/%s" % (proje, BUCKET, yol),
        data=veri,
        headers={"Content-Type": "image/webp", "x-upsert": "true"},
        timeout=90,
    )
    if r.status_code >= 300:
        raise IOError("yukleme hatasi %s: %s" % (r.status_code, r.text[:200]))


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("isim", nargs="?", help="futbolcu adi")
    ap.add_argument("resim", nargs="?", help="yerel dosya yolu ya da URL")
    ap.add_argument("--klasor", help="icindeki her resim dosya adiyla eslestirilir")
    ap.add_argument("--kaldir", metavar="ISIM", help="fotografi kayittan dusur")
    ap.add_argument("--bak", metavar="ISIM", help="mevcut fotografi indirip masaustune koy")
    ap.add_argument("--key", help="service_role anahtari")
    ap.add_argument("--url", help="Supabase proje adresi")
    a = ap.parse_args()

    proje = (a.url or env_oku("EXPO_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    if not proje:
        print("Supabase adresi yok. --url ile ver ya da .env icine EXPO_PUBLIC_SUPABASE_URL koy.")
        return 1

    photos = json_oku(PHOTOS_YOLU, {})
    players = json_oku(PLAYERS_YOLU, [])
    isimler = [p["name"] for p in players]

    # ---- sadece bak ----
    if a.bak:
        ad, adaylar = isim_coz(a.bak, isimler)
        if not ad:
            print("Bulunamadi. Yakin adlar:", ", ".join(adaylar) if adaylar else "(yok)")
            return 1
        url = photos.get(ad)
        if not url:
            print('"%s" icin kayitli fotograf yok (uygulamada bas harf rozeti cikiyor).' % ad)
            return 0
        print("%s\n  %s" % (ad, url))
        try:
            veri = requests.get(url, headers=UA, timeout=45).content
            masa = os.path.join(os.path.expanduser("~"), "Desktop", "%s_mevcut.webp" % ad)
            with open(masa, "wb") as f:
                f.write(veri)
            print("  Indirildi: %s  (%.0f KB)" % (masa, len(veri) / 1024.0))
        except Exception as e:
            print("  Indirilemedi:", e)
        return 0

    # ---- kaldir ----
    if a.kaldir:
        ad, adaylar = isim_coz(a.kaldir, isimler)
        if not ad:
            print("Bulunamadi. Yakin adlar:", ", ".join(adaylar) if adaylar else "(yok)")
            return 1
        if ad not in photos:
            print('"%s" icin kayit yok, yapilacak bir sey kalmadi.' % ad)
            return 0
        del photos[ad]
        json_yaz(PHOTOS_YOLU, photos)
        print('"%s" kayittan dusuruldu. Artik bas harf rozeti cikacak.' % ad)
        print("Depodaki dosya SILINMEDI (geri almak isterse duruyor).")
        return 0

    # ---- degistirme: is listesi kur ----
    isler = []
    if a.klasor:
        if not os.path.isdir(a.klasor):
            print("Klasor yok:", a.klasor); return 1
        for dosya in sorted(os.listdir(a.klasor)):
            kok, uz = os.path.splitext(dosya)
            if uz.lower() not in RESIM_UZANTI:
                continue
            isler.append((kok.strip(), os.path.join(a.klasor, dosya)))
        if not isler:
            print("Klasorde resim yok."); return 1
    elif a.isim and a.resim:
        isler.append((a.isim, a.resim))
    else:
        ap.print_help()
        return 1

    anahtar = a.key or os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not anahtar:
        print("HATA: service_role anahtari gerekli.")
        print('  $env:SUPABASE_SERVICE_KEY="eyJ..."   ya da   --key eyJ...')
        return 1

    oturum = requests.Session()
    oturum.headers.update({"Authorization": "Bearer " + anahtar, "apikey": anahtar})
    oturum.headers.update(UA)
    os.makedirs(WEBP_KLASOR, exist_ok=True)

    damga = int(time.time())
    basarili, atlanan = [], []
    for aranan, kaynak in isler:
        ad, adaylar = isim_coz(aranan, isimler)
        if not ad:
            atlanan.append((aranan, "isim eslesmedi" + (" — yakin: " + ", ".join(adaylar[:4]) if adaylar else "")))
            continue
        try:
            ham = resmi_al(kaynak)
            veri, boyut = webp_cevir(ham)
        except Exception as e:
            atlanan.append((aranan, "resim okunamadi: %s" % e)); continue

        mevcut = adres_temizle(photos.get(ad, ""))
        onek = "%s/storage/v1/object/public/%s/" % (proje, BUCKET)
        if mevcut.startswith(onek) and mevcut.endswith(".webp"):
            yol = mevcut[len(onek):]
        else:
            yol = depo_yolu_uret(ad)

        try:
            yukle(oturum, proje, yol, veri)
        except Exception as e:
            atlanan.append((aranan, str(e))); continue

        with open(os.path.join(WEBP_KLASOR, os.path.basename(yol)), "wb") as f:
            f.write(veri)
        photos[ad] = "%s%s?v=%d" % (onek, yol, damga)
        basarili.append((ad, boyut, len(veri)))
        print("  %-28s %dx%d  %.0f KB" % (ad, boyut[0], boyut[1], len(veri) / 1024.0))

    if basarili:
        json_yaz(PHOTOS_YOLU, photos)

    print("\nDegistirildi: %d" % len(basarili))
    if atlanan:
        print("Atlanan: %d" % len(atlanan))
        for ad, neden in atlanan[:15]:
            print("   %-28s %s" % (ad, neden))
    if basarili:
        print("\nSIRADAKI ADIM")
        print("  Uygulamayi   npx expo start -c   ile ac.")
        print("  Telefonda eski resmi goruyorsan uygulama verisini temizle;")
        print("  yayindaki kullanicilar bir sonraki guncellemede yeni resmi alir.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
