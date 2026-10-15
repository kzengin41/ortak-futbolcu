# -*- coding: utf-8 -*-
"""
KULÜP RENKLERİ — Paket 32 (15 Ekim 2026)
Kerem: "kartların renk tasarımları halen iyi değil" → oyun içi arma kartı.
Eşleşme kartında her kulübün yarısı KENDİ renginde parlar (TV skor grafiği gibi).
1127 kulübün rengini elle girmek yerine armadan (assets/club_logos/<id>.webp)
çıkarıyoruz: opak piksellerin doygun olanları 24 ton kutusuna dağıtılır;
en kalabalık kutu = ana renk, en az 50° uzaktaki ikinci kutu = ikinci renk.
Doygun piksel azsa (Juventus, Beşiktaş gibi siyah-beyaz armalar) ana renk
nötr kabul edilir (null) ve kart nötr kalır.
Çıktı: lib/kulupRenkleri.js  (logo id -> [ana, ikinci|null])
Kullanım:  python scripts/kulup_renkleri.py
"""
import os, json, colorsys
from PIL import Image

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KLASOR = os.path.join(KOK, "assets", "club_logos")
CIKTI = os.path.join(KOK, "lib", "kulupRenkleri.js")
KUTU = 24

def renkler(yol):
    im = Image.open(yol).convert("RGBA").resize((48, 48))
    kutular = [[0, 0, 0, 0] for _ in range(KUTU)]   # adet, r, g, b
    opak = 0
    for r, g, b, a in im.getdata():
        if a < 200:
            continue
        opak += 1
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if s < 0.38 or v < 0.22:
            continue
        k = int(h * KUTU) % KUTU
        kutular[k][0] += 1; kutular[k][1] += r; kutular[k][2] += g; kutular[k][3] += b
    if not opak:
        return None
    # komşu kutuları birleştirerek tepe bul
    puan = [kutular[i][0] + 0.5 * (kutular[i - 1][0] + kutular[(i + 1) % KUTU][0]) for i in range(KUTU)]
    sira = sorted(range(KUTU), key=lambda i: -puan[i])
    def ort(i):
        idx = [i - 1, i, (i + 1) % KUTU]
        n = sum(kutular[j][0] for j in idx)
        r = sum(kutular[j][1] for j in idx) / n; g = sum(kutular[j][2] for j in idx) / n; b = sum(kutular[j][3] for j in idx) / n
        return "#%02X%02X%02X" % (round(r), round(g), round(b))
    ana = sira[0]
    if kutular[ana][0] + kutular[ana - 1][0] + kutular[(ana + 1) % KUTU][0] < opak * 0.12:
        return None
    ikinci = None
    for i in sira[1:]:
        fark = min(abs(i - ana), KUTU - abs(i - ana)) * (360 / KUTU)
        if fark >= 50 and kutular[i][0] + kutular[i - 1][0] + kutular[(i + 1) % KUTU][0] >= opak * 0.08:
            ikinci = ort(i); break
    return [ort(ana), ikinci]

def main():
    sonuc = {}
    for ad in sorted(os.listdir(KLASOR)):
        if not ad.endswith(".webp"):
            continue
        r = renkler(os.path.join(KLASOR, ad))
        if r:
            sonuc[ad[:-5]] = r if r[1] else [r[0]]
    with open(CIKTI, "w", encoding="utf-8") as f:
        f.write("// OTOMATIK URETILDI - elle duzenleme. Kaynak: scripts/kulup_renkleri.py\n")
        f.write("// Armadan cikarilan kulup renkleri: logo id -> [ana, ikinci?]. Renksiz (siyah-beyaz) armalar yok.\n")
        f.write("export const LOGO_RENK = " + json.dumps(sonuc, separators=(",", ":")) + ";\n")
    print(len(sonuc), "kulüp rengi yazıldı ->", CIKTI)

if __name__ == "__main__":
    main()
