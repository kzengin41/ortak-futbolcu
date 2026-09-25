# -*- coding: utf-8 -*-
"""Kulup logolarini 128px WebP'e cevirip uygulamaya gomer.

Kullanim (proje kokunden):
    python scripts/logo_uret.py

Girdi : C:\\Users\\Monster\\Desktop\\clubs\\<id>.png
        scripts/logo_haritasi.json   (kulup adi -> FM id)
Cikti : assets/club_logos/<id>.webp
        lib/clubLogos.js
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

var = sorted(set(harita.values()) - {h[0] for h in hata})
satir_req = "\n".join(f'  "{cid}": require("../assets/club_logos/{cid}.webp"),' for cid in var)
satir_map = "\n".join(f'  {json.dumps(ad, ensure_ascii=False)}: "{cid}",'
                      for ad, cid in sorted(harita.items()) if cid in set(var))

js = f"""// OTOMATIK URETILDI - elle duzenleme. Kaynak: scripts/logo_uret.py
// {len(var)} logo, {len(harita)} kulup adi.
import {{ canonicalClub }} from "./clubAliases";

const GORSELLER = {{
{satir_req}
}};

const KULUP_LOGO = {{
{satir_map}
}};

// Bir kulup adi icin logo dondurur; yoksa null.
export function clubLogo(club) {{
  if (!club) return null;
  const id = KULUP_LOGO[club] || KULUP_LOGO[canonicalClub(club)];
  return id ? GORSELLER[id] : null;
}}

export function hasClubLogo(club) {{
  return clubLogo(club) != null;
}}
"""
open(JS, "w", encoding="utf-8").write(js)
print(f"Yazildi      : {os.path.relpath(JS, KOK)}  ({len(var)} logo / {len(harita)} kulup adi)")
