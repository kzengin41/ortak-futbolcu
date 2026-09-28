# -*- coding: utf-8 -*-
"""
VERİ SETİNDE OLMAYAN FUTBOLCUYU EKLER (Wikipedia + Wikidata'dan).

28 Eylül 2026 — denetimde bulunan eksik ünlüler (Totti, Metin Oktay, Bülent
Korkmaz, Theo Hernández, Abdullah Ercan) için yazıldı ama genel araç:

    python scripts/oyuncu_ekle.py "Francesco Totti" "Metin Oktay" "Bülent Korkmaz"
    python scripts/oyuncu_ekle.py --dene "Theo Hernández"     (sadece gösterir, yazmaz)

Ne yapar:
  1) İngilizce Wikipedia'da adı bulur (gerekirse "(footballer)" ekiyle), Wikidata
     kaydını açar, gerçekten futbolcu mu diye bakar.
  2) Kulüplerini (P54) başlangıç yılına göre sıralar; milli takımları ayırır.
     Kulüp adlarını uygulamadaki mevcut yazıma çevirir ("Galatasaray S.K." ->
     "Galatasaray"), eşleşmeyeni sade haliyle ekler.
  3) lib/players.json, playerYears.json, playerBirthPosition.json,
     playerNationalTeams.json ve playerNationality.js'e yazar. Adı zaten varsa
     DOKUNMAZ (aynı adlı başka oyuncu olabilir — o zaman --ad ile farklı yaz).

Sonra: python scripts/ozgecmis_isle.py gerekmez (profil verisi bir sonraki gece
çekiminde gelir); sunucu için python scripts/sunucu_veri_yukle.py.
"""
import argparse
import json
import os
import re
import sys
import time
import unicodedata

try:
    import requests
except ImportError:
    print("requests kurulu degil:  pip install requests")
    sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(KOK, "lib")
WP = "https://en.wikipedia.org/w/api.php"
WD = "https://www.wikidata.org/w/api.php"
UA = {"User-Agent": "OrtakFutbolcuBot/1.0 (kisisel mobil futbol bilgi oyunu; KontStudioApps@gmail.com)"}
BU_YIL = time.gmtime().tm_year
MILLI = re.compile(r"national .*team|olympic .*team|national team", re.I)


def sade(s):
    s = (s or "").replace("İ", "i").replace("I", "ı").lower()
    s = s.translate(str.maketrans("ışğüöçâîû", "isguocaiu"))
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


GURULTU = {"fc", "cf", "sk", "fk", "jk", "ac", "as", "sc", "afc", "ssc", "cd", "ud", "sd", "sad", "de",
           "club", "futbol", "kulubu", "calcio", "spor", "football", "futebol", "clube", "sv", "1", "s", "a"}


def cekirdek(s):
    return {t for t in sade(s).split() if t not in GURULTU and len(t) > 1}


SONEK = re.compile(r"\s+(F\.?C\.?|C\.?F\.?|S\.?K\.?|J\.?K\.?|A\.?F\.?C\.?|S\.?C\.?|A\.?Ş\.?)$")


def get(url, params):
    p = dict(params, format="json", formatversion=2)
    for i in range(5):
        try:
            r = requests.get(url, params=p, headers=UA, timeout=30)
            if r.status_code == 200:
                return r.json()
        except requests.RequestException:
            pass
        time.sleep(2 * (i + 1))
    return None


def qid_bul(ad):
    for baslik in (ad, ad + " (footballer)", ad + " (soccer)"):
        d = get(WP, {"action": "query", "titles": baslik, "redirects": 1, "prop": "pageprops",
                     "ppprop": "wikibase_item|disambiguation"})
        for p in ((d or {}).get("query", {}) or {}).get("pages", []) or []:
            pp = p.get("pageprops") or {}
            if p.get("missing") or "disambiguation" in pp or not pp.get("wikibase_item"):
                continue
            q = pp["wikibase_item"]
            e = varlik([q]).get(q) or {}
            c = e.get("claims") or {}
            meslek = [iddeger(s) for s in c.get("P106", [])]
            if "Q937857" in meslek or c.get("P413"):
                return q, p.get("title")
    return None, None


def iddeger(s):
    try:
        return s["mainsnak"]["datavalue"]["value"]["id"]
    except (KeyError, TypeError):
        return None


def yil(s):
    try:
        t = s["datavalue"]["value"]["time"]
        return int(t[1:5])
    except (KeyError, TypeError, ValueError):
        return None


def varlik(qidler, props="claims|labels", dil="en|tr"):
    sonuc = {}
    for i in range(0, len(qidler), 50):
        d = get(WD, {"action": "wbgetentities", "ids": "|".join(qidler[i:i + 50]), "props": props, "languages": dil})
        sonuc.update((d or {}).get("entities") or {})
    return sonuc


def etiket(e):
    lab = e.get("labels") or {}
    return (lab.get("en") or lab.get("tr") or {}).get("value")


def mevki(lab):
    l = (lab or "").lower()
    if "goalkeeper" in l: return "Goalkeeper"
    if "centre-back" in l or "center back" in l or "centre back" in l: return "Centre-back"
    if "full-back" in l or "fullback" in l: return "Defender"
    if "back" in l or "defender" in l: return "Defender"
    if "defensive midfielder" in l: return "Defensive midfielder"
    if "attacking midfielder" in l: return "Attacking midfielder"
    if "midfielder" in l: return "Midfielder"
    if "winger" in l: return "Winger"
    if "striker" in l or "centre-forward" in l or "center forward" in l: return "Striker"
    if "forward" in l: return "Forward"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("adlar", nargs="+", help="Eklenecek futbolcu adları")
    ap.add_argument("--dene", action="store_true", help="Sadece göster, dosyalara yazma")
    a = ap.parse_args()

    P = json.load(open(os.path.join(LIB, "players.json"), encoding="utf-8"))
    mevcut = {p["name"] for p in P}
    kulup_say = {}
    for p in P:
        for c in p["clubs"]:
            kulup_say[c] = kulup_say.get(c, 0) + 1
    kulupler = sorted(kulup_say, key=lambda c: -kulup_say[c])
    sade_kulup = {}
    for c in kulupler:
        sade_kulup.setdefault(sade(c), c)

    YEDEK = {"b", "c", "ii", "iii", "u17", "u18", "u19", "u20", "u21", "u23", "reserves", "youth",
             "castilla", "atletic", "primavera", "jong", "academy"}

    def yedek_mi(ad):
        return bool(set(sade(ad).split()) & YEDEK)

    def uygulama_adi(lab):
        """Wikidata takım adı -> uygulamadaki yazım. 28 Eylül düzeltmesi: ilk
        sürüm "Fenerbahçe Istanbul", "Deportivo Alavés", "Al Hilal SFC" gibi
        uzun resmi adları eşleyemiyordu. Artık adayların içinden (çekirdek
        kelimeleri etiketin içinde kalan ya da çok benzeyen) EN ÇOK KULLANILAN
        yazım seçiliyor; B takımı/altyapı işaretleri iki tarafta da aynı olmalı."""
        if not lab:
            return None
        ck = cekirdek(SONEK.sub("", lab)) or cekirdek(lab)
        adaylar = []
        if ck:
            for c in kulupler[:8000]:
                cc = cekirdek(c)
                if not cc or yedek_mi(c) != yedek_mi(lab):
                    continue
                o = len(ck & cc)
                if not o:
                    continue
                if cc <= ck or o / len(ck | cc) >= 0.6:
                    adaylar.append(c)
        if adaylar:
            return max(adaylar, key=lambda c: kulup_say[c])
        s2 = sade(lab)
        if s2 in sade_kulup:
            return sade_kulup[s2]
        return SONEK.sub("", lab).strip()

    yeni = []
    for ad in a.adlar:
        if ad in mevcut:
            print("ATLANDI  %s — bu ad veri setinde zaten var." % ad)
            continue
        q, baslik = qid_bul(ad)
        if not q:
            print("BULUNAMADI  %s — Wikipedia'da futbolcu sayfası bulunamadı." % ad)
            continue
        e = varlik([q]).get(q) or {}
        c = e.get("claims") or {}
        takimlar = []
        for s in c.get("P54", []):
            t = iddeger(s)
            if not t:
                continue
            nit = s.get("qualifiers") or {}
            bas = next((yil(x) for x in nit.get("P580", []) if yil(x)), None)
            bit = next((yil(x) for x in nit.get("P582", []) if yil(x)), None)
            takimlar.append((t, bas, bit))
        adlar = varlik(sorted({t for t, _, _ in takimlar} | {iddeger(s) for s in c.get("P413", []) if iddeger(s)}
                              | {iddeger(s) for s in c.get("P1532", []) + c.get("P27", []) if iddeger(s)}),
                       props="labels")
        kulupler_sira, milli = [], []
        for t, bas, bit in sorted(takimlar, key=lambda x: (x[1] or 9999)):
            lab = etiket(adlar.get(t) or {})
            if not lab:
                continue
            if MILLI.search(lab):
                if not re.search(r"under|u-?\d\d|olympic|women|amateur|\bB\b", lab, re.I):
                    ulke = re.split(r"\s+(men's\s+)?national", lab)[0]
                    if ulke and ulke not in milli:
                        milli.append(ulke)
                continue
            u = uygulama_adi(lab)
            if u and u not in kulupler_sira:
                kulupler_sira.append(u)
        if not kulupler_sira:
            print("ATLANDI  %s — Wikidata'da kulüp bilgisi yok." % ad)
            continue
        dogum = next((yil(s["mainsnak"]) for s in c.get("P569", []) if yil(s.get("mainsnak") or {})), None)
        olum = next((yil(s["mainsnak"]) for s in c.get("P570", []) if yil(s.get("mainsnak") or {})), None)
        son = max([b for _, _, b in takimlar if b] + [0]) or None
        acik = any(b is None and s for _, s, b in takimlar)
        if acik and not olum and (not son or son >= BU_YIL - 3):
            son = BU_YIL
        poz = next((mevki(etiket(adlar.get(iddeger(s)) or {})) for s in c.get("P413", []) if iddeger(s)), None)
        uyruk = []
        for s in c.get("P1532", []) + c.get("P27", []):
            lab = etiket(adlar.get(iddeger(s)) or {})
            if lab and lab not in uyruk:
                uyruk.append(lab)
        kayit = {"ad": ad, "wp": baslik, "kulupler": kulupler_sira, "son": son, "dogum": dogum,
                 "mevki": poz, "milli": milli, "uyruk": uyruk[:2]}
        yeni.append(kayit)
        print("BULUNDU  %s (%s)" % (ad, baslik))
        print("    kulüpler : %s" % ", ".join(kulupler_sira))
        print("    doğum %s · son yıl %s · %s · milli: %s" % (dogum, son, poz, ", ".join(milli) or "-"))

    if not yeni or a.dene:
        if a.dene:
            print("\n--dene: hiçbir dosyaya yazılmadı.")
        return

    for k in yeni:
        P.append({"name": k["ad"], "clubs": k["kulupler"]})
    open(os.path.join(LIB, "players.json"), "w", encoding="utf-8").write(json.dumps(P, ensure_ascii=False))

    yol = os.path.join(LIB, "playerYears.json")
    Y = json.load(open(yol, encoding="utf-8"))
    for k in yeni:
        if k["son"]:
            Y[k["ad"]] = k["son"]
    open(yol, "w", encoding="utf-8").write(json.dumps(Y, ensure_ascii=False))

    yol = os.path.join(LIB, "playerBirthPosition.json")
    B = json.load(open(yol, encoding="utf-8"))
    for k in yeni:
        B[k["ad"]] = {"birthYear": k["dogum"], "position": k["mevki"]}
    open(yol, "w", encoding="utf-8").write(json.dumps(B, ensure_ascii=False))

    yol = os.path.join(LIB, "playerNationalTeams.json")
    N = json.load(open(yol, encoding="utf-8"))
    for k in yeni:
        if k["milli"]:
            N[k["ad"]] = k["milli"]
    open(yol, "w", encoding="utf-8").write(json.dumps(N, ensure_ascii=False, separators=(",", ":")))

    yol = os.path.join(LIB, "playerNationality.js")
    t = open(yol, encoding="utf-8").read()
    bas = "export const PLAYER_NATIONALITY = "
    i = t.index(bas) + len(bas)
    j = t.rindex("}") + 1
    U = json.loads(t[i:j])
    for k in yeni:
        if k["uyruk"]:
            U[k["ad"]] = [("Turkey" if x in ("Türkiye",) else x) for x in k["uyruk"]]
    open(yol, "w", encoding="utf-8").write(t[:i] + json.dumps(U, ensure_ascii=False) + t[j:])

    print("\n%d futbolcu eklendi. Sunucu için:  python scripts/sunucu_veri_yukle.py" % len(yeni))


if __name__ == "__main__":
    main()
