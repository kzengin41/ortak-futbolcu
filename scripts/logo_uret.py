# -*- coding: utf-8 -*-
"""Kulup logolarini 128px WebP'e cevirip uygulamaya gomer.

Kullanim (proje kokunden):
    python scripts/logo_uret.py

Girdi : C:\\Users\\Monster\\Desktop\\clubs\\<id>.png
        scripts/logo_haritasi.json   (kulup adi -> FM id)
Cikti : assets/club_logos/<id>.webp
        assets/club_atlas/atlas_NN.webp + lib/clubLogos.js  (scripts/logo_atlas.py)
"""
import json, os, sys, io, re
from PIL import Image

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAYNAK = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Monster\Desktop\clubs"
HARITA = os.path.join(KOK, "scripts", "logo_haritasi.json")
HEDEF = os.path.join(KOK, "assets", "club_logos")
JS = os.path.join(KOK, "lib", "clubLogos.js")

BOYUT = 128
KALITE = 88

harita = json.load(open(HARITA, encoding="utf-8"))
os.makedirs(HEDEF, exist_ok=True)

idler = sorted(set(harita.values()))
yazilan, atlanan, hata = 0, 0, []
for cid in idler:
    kaynak = os.path.join(KAYNAK, f"{cid}.png")
    cikti = os.path.join(HEDEF, f"{cid}.webp")
    if not os.path.exists(kaynak):
        hata.append((cid, "kaynak yok")); continue
    try:
        im = Image.open(kaynak).convert("RGBA")
        im.thumbnail((BOYUT, BOYUT), Image.LANCZOS)
        im.save(cikti, "WEBP", quality=KALITE, method=6)   # saydamlik korunur
        yazilan += 1
    except Exception as e:
        hata.append((cid, str(e)))

toplam = sum(os.path.getsize(os.path.join(HEDEF, f)) for f in os.listdir(HEDEF))
print(f"WebP yazildi : {yazilan} / {len(idler)}")
print(f"Toplam boyut : {toplam/1024/1024:.2f} MB")
if hata:
    print(f"Hata         : {len(hata)}")
    for h in hata[:10]: print("   ", h)

# Paket 17 (5 Ekim 2026): lib/clubLogos.js artik tek tek require() uretmiyor
# (1127 asset `eas update` 1000 sinirini asiyordu). Logolar atlasa paketlenir.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import logo_atlas
logo_atlas.main()
