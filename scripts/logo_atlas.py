# -*- coding: utf-8 -*-
"""
KULÜP LOGOLARI → ATLAS (Paket 17, 5 Ekim 2026)

NEDEN: `eas update` "Each update is limited to a maximum of 1000 assets
(attempted to publish 1171)" diyerek reddetti. 1127'si kulüp logosuydu: her
logo ayrı bir require() → ayrı bir asset. Logolar artık 10×10'luk atlaslarda
(12 dosya); toplam asset ~60'a iniyor, OTA güncellemeleri yeniden çalışıyor.

Atlas düzeni: her hücre 132 px = 2 px saydam pay + 128 px logo alanı + 2 px pay
(pay, küçültülürken komşu logonun kenara "taşmasını" engelliyor). Logo hücrede
ortalanır (= contentFit "contain"). En tanınmış kulüpler (MEGA/BIG + veri
setinde en çok futbolcusu olanlar) ilk atlaslara konur; böylece bir ekran
genelde 1–2 atlası belleğe açıyor.

Girdi : assets/club_logos/<id>.webp   (scripts/logo_uret.py üretir)
        scripts/logo_haritasi.json    (kulüp adı -> logo id)
        lib/players.json              (sıralama için kulüp başına futbolcu sayısı)
Çıktı : assets/club_atlas/atlas_NN.webp
        lib/clubLogos.js              (OTOMATİK — elle düzenleme)

Kullanım (proje kökünde):  python scripts/logo_atlas.py
Logolar değişirse önce logo_uret.py, sonra bu script çalıştırılır.
"""
import json
import os
import re
from PIL import Image

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_DIR = os.path.join(KOK, "assets", "club_logos")
ATLAS_DIR = os.path.join(KOK, "assets", "club_atlas")
HARITA = os.path.join(KOK, "scripts", "logo_haritasi.json")
OYUNCULAR = os.path.join(KOK, "lib", "players.json")
JS = os.path.join(KOK, "lib", "clubLogos.js")

HUCRE = 128      # logo alanı (px)
PAY = 2          # her kenarda saydam pay
ADIM = HUCRE + 2 * PAY
SUTUN = 10       # atlas başına 10×10 = 100 logo
SATIR = 10
KALITE = 90

ONCELIKLI = [  # lib/clubWeights.js MEGA + BIG (her zaman ilk atlasta)
    "Galatasaray", "Fenerbahçe", "Beşiktaş", "Real Madrid", "Barcelona", "Bayern Munich",
    "Manchester United", "Manchester City", "Liverpool", "Paris Saint-Germain",
    "Trabzonspor", "Chelsea", "Arsenal", "Juventus", "AC Milan", "Inter Milan",
    "Internazionale", "Atlético Madrid", "Borussia Dortmund", "Napoli",
]


def main():
    harita = json.load(open(HARITA, encoding="utf-8"))
    idler = sorted({cid for cid in harita.values() if os.path.exists(os.path.join(LOGO_DIR, f"{cid}.webp"))})
    eksik = sorted(set(harita.values()) - set(idler))

    # Sıralama: öncelikli kulüpler, sonra veri setinde kaç futbolcunun o kulüpte oynadığı.
    sayac = {}
    try:
        for p in json.load(open(OYUNCULAR, encoding="utf-8")):
            for c in set(p.get("clubs") or []):
                cid = harita.get(c)
                if cid:
                    sayac[cid] = sayac.get(cid, 0) + 1
    except Exception as e:  # sıralama sadece bir iyileştirme
        print("Uyarı: players.json okunamadı, sıralama id'ye göre:", e)
    oncelik = {harita[a]: i for i, a in reversed(list(enumerate(ONCELIKLI))) if a in harita}
    idler.sort(key=lambda cid: (oncelik.get(cid, 10_000), -sayac.get(cid, 0), cid))

    os.makedirs(ATLAS_DIR, exist_ok=True)
    for f in os.listdir(ATLAS_DIR):
        if f.startswith("atlas_") and f.endswith(".webp"):
            os.remove(os.path.join(ATLAS_DIR, f))

    adet = SUTUN * SATIR
    atlas_sayisi = (len(idler) + adet - 1) // adet
    W, H = SUTUN * ADIM, SATIR * ADIM
    toplam = 0
    for a in range(atlas_sayisi):
        tuval = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for k, cid in enumerate(idler[a * adet:(a + 1) * adet]):
            im = Image.open(os.path.join(LOGO_DIR, f"{cid}.webp")).convert("RGBA")
            im.thumbnail((HUCRE, HUCRE), Image.LANCZOS)
            x = (k % SUTUN) * ADIM + PAY + (HUCRE - im.width) // 2
            y = (k // SUTUN) * ADIM + PAY + (HUCRE - im.height) // 2
            tuval.paste(im, (x, y), im)
        yol = os.path.join(ATLAS_DIR, f"atlas_{a:02d}.webp")
        tuval.save(yol, "WEBP", quality=KALITE, method=6)
        toplam += os.path.getsize(yol)

    req = "\n".join(f'  require("../assets/club_atlas/atlas_{a:02d}.webp"),' for a in range(atlas_sayisi))
    sira = ",".join(f'"{cid}":{i}' for i, cid in enumerate(idler))
    var = set(idler)
    harita_js = "\n".join(f"  {json.dumps(ad, ensure_ascii=False)}: \"{cid}\","
                          for ad, cid in sorted(harita.items()) if cid in var)

    js = f"""// OTOMATIK URETILDI - elle duzenleme. Kaynak: scripts/logo_atlas.py
// {len(idler)} logo, {len(harita)} kulup adi, {atlas_sayisi} atlas ({SUTUN}x{SATIR}).
//
// Paket 17 (5 Ekim 2026) — logolar tek tek require() edilince 1127 ayri asset
// oluyordu ve `eas update` 1000 asset sinirina takiliyordu. Artik her logo bir
// atlasin icindeki bir hucre; components/TeamBadge.js hucreyi kirparak ciziyor.
import {{ kulupGrubu }} from "./clubAliases";

export const ATLAS_HUCRE = {HUCRE};   // logo alani (px)
const PAY = {PAY};
const ADIM = {ADIM};
const SUTUN = {SUTUN};
const ADET = {adet};
export const ATLAS_GENISLIK = {W};
export const ATLAS_YUKSEKLIK = {H};

const ATLASLAR = [
{req}
];

// logo id -> atlaslardaki sira (tanınmış kulupler once)
const SIRA = {{{sira}}};

const KULUP_LOGO = {{
{harita_js}
}};

const _onbellek = {{}};
function parca(id) {{
  if (_onbellek[id]) return _onbellek[id];
  const i = SIRA[id];
  if (i === undefined) return null;
  const k = i % ADET;
  return (_onbellek[id] = {{
    kaynak: ATLASLAR[Math.floor(i / ADET)],
    x: (k % SUTUN) * ADIM + PAY,     // logo alaninin atlastaki sol ust kosesi (px)
    y: Math.floor(k / SUTUN) * ADIM + PAY,
  }});
}}

// Bir kulup adi icin logo parcasi dondurur ({{ kaynak, x, y }}); yoksa null.
// 26 Eylul 2026: kanonik ad + butun eski yazimlar denenir ("Basaksehir"
// logosu "Istanbul Basaksehir" / "Istanbul BB" icin de gelir).
export function clubLogo(club) {{
  if (!club) return null;
  let id = KULUP_LOGO[club];
  if (!id) for (const ad of kulupGrubu(club)) {{ id = KULUP_LOGO[ad]; if (id) break; }}
  return id ? parca(id) : null;
}}

export function hasClubLogo(club) {{
  return clubLogo(club) != null;
}}
"""
    open(JS, "w", encoding="utf-8", newline="\n").write(js)
    print(f"Atlas        : {atlas_sayisi} dosya, {toplam / 1048576:.2f} MB  ({W}x{H} px)")
    print(f"Logo         : {len(idler)}  (kulup adi: {len(harita)})")
    if eksik:
        print(f"Dosyasi yok  : {len(eksik)} id (atlanadi) -> {eksik[:10]}")
    print(f"Yazildi      : {os.path.relpath(JS, KOK)}")


if __name__ == "__main__":
    main()
