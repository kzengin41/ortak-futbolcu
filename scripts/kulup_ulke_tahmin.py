# -*- coding: utf-8 -*-
"""
KULÜP ÜLKESİ TAHMİNİ — Paket 27 (12 Ekim 2026)

NİYE: lib/clubCountries.json (Wikidata) kulüp kayıtlarının ~%15'inde ülke yoktu:
Bologna, Espanyol, Ajax, PSV, Rennes, Flamengo… Eşleşme Profili "İtalya açık /
kapalı" derken bu kulüpleri hiçbir ülkeye koyamıyordu.

NASIL: Ülkesi bilinmeyen bir kulüp için iki tür oy toplanır:
  1) o kulüpte oynamış oyuncuların UYRUĞU (lib/playerNationality.js),
  2) oyuncuların kariyerinde o kulübün HEMEN ÖNCESİ/SONRASI kulüplerin ülkesi.
En az 4 oy ve %55 çoğunluk varsa ülke atanır. 3 tur döner (yeni bulunanlar da oy
verir). Ülkesi bilinen 1.500 kulüp gizlenip tahmin edildiğinde doğruluk %97,4.
Hollanda/Belçika/Danimarka gibi veri setinde hiç ülkesi olmayan ligler için
birkaç büyük kulüp elle tohumlandı (TOHUM).

KULLANIM:  python scripts/kulup_ulke_tahmin.py [--dogrula]
Yalnız EKLER (var olan ülkeye dokunmaz). Sonra: python scripts/veri_paketle.py gerekmez
(clubCountries.json paketlenmiyor).
"""
import collections, json, os, random, sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(KOK, "lib")
UK = {"England", "Scotland", "Wales", "Northern Ireland"}
TOHUM = {**{k: "Netherlands" for k in ["Ajax", "PSV", "Feyenoord", "Twente", "Vitesse", "AZ", "Heerenveen", "Utrecht", "ADO Den Haag",
            "Willem II", "NAC Breda", "NEC", "Sparta Rotterdam", "Groningen", "Fortuna Sittard", "Excelsior", "Roda JC", "De Graafschap",
            "Go Ahead Eagles", "VVV-Venlo", "PEC Zwolle", "RKC Waalwijk", "Heracles Almelo", "Jong Ajax", "Jong PSV"]},
         **{k: "Belgium" for k in ["Charleroi", "Sint-Truiden", "Mouscron", "OH Leuven", "Antwerp", "Lokeren", "Union SG"]},
         **{k: "Denmark" for k in ["Copenhagen", "Brøndby", "AGF", "Nordsjælland", "Midtjylland", "OB"]},
         **{k: "Brazil" for k in ["Flamengo", "Palmeiras"]}, "Red Star Belgrade": "Serbia", "Aris": "Greece", "OFI": "Greece",
         "AEL": "Greece", "Grasshoppers": "Switzerland", "Ferencváros": "Hungary", "Belenenses": "Portugal",
         "Vitória Setúbal": "Portugal", "Académica": "Portugal", "HJK": "Finland"}

def oku():
    cc = json.load(open(os.path.join(LIB, "clubCountries.json"), encoding="utf-8"))
    pl = json.load(open(os.path.join(LIB, "players.json"), encoding="utf-8"))
    s = open(os.path.join(LIB, "playerNationality.js"), encoding="utf-8").read()
    nat = json.loads(s[s.index("{"):s.rindex("}") + 1])
    return cc, pl, nat

def nu(n):
    return "United Kingdom" if n in UK else "Ireland" if n == "Republic of Ireland" else n

def tahmin(pl, nat, bilinen, hedefler, tur=3, esik=0.55):
    sonuc = {}
    for _ in range(tur):
        bil = {**bilinen, **sonuc}
        oy = collections.defaultdict(collections.Counter)
        for x in pl:
            n = nat.get(x["name"]); u = nu(n[0]) if n else None
            cl = x["clubs"]
            for i, c in enumerate(cl):
                if c not in hedefler: continue
                if u: oy[c][u] += 1
                for j in (i - 1, i + 1):
                    if 0 <= j < len(cl) and cl[j] in bil: oy[c][bil[cl[j]]] += 1
        for c, cn in oy.items():
            top, n = cn.most_common(1)[0]; t = sum(cn.values())
            if t >= 4 and n / t >= esik: sonuc[c] = top
    return sonuc

def main():
    cc, pl, nat = oku()
    say = collections.Counter(k for x in pl for k in x["clubs"])
    if "--dogrula" in sys.argv:
        ornek = [k for k in cc if say[k] >= 10]; random.seed(1); random.shuffle(ornek); test = set(ornek[:1500])
        t = tahmin(pl, nat, {k: v for k, v in cc.items() if k not in test}, test)
        d = sum(1 for k in t if t[k] == cc[k]); print(f"doğruluk: {d}/{len(t)} = {d / max(1, len(t)):.3f}")
        return
    hed = {k for k in say if k not in cc}
    tohum = {k: v for k, v in TOHUM.items() if k in hed}
    t = tahmin(pl, nat, {**cc, **tohum}, hed - set(tohum)); t.update(tohum)
    print(f"ülkesiz kulüp: {len(hed)} · bulunan: {len(t)} · kayıt: {sum(say[k] for k in t)}/{sum(say[k] for k in hed)}")
    cc.update(t)
    with open(os.path.join(LIB, "clubCountries.json"), "w", encoding="utf-8") as f:
        json.dump(dict(sorted(cc.items())), f, ensure_ascii=False, separators=(",", ":"))

if __name__ == "__main__":
    main()
