# -*- coding: utf-8 -*-
"""
KADRO VERİSİ — Günün Kadrosu + Ansiklopedi "Takımlar" sekmesi (4 Ekim 2026)

Benchmark kararları:
  .29452 "Günün Kadrosu: efsane maç havuzu, her gün rastgele, tekrarsız"
  .29833 "Takımlar sekmesi: 4 büyük 26 sezon, Avrupa devleri 15 sezon, efsane
          kadrolar (GS 1999–00, Galacticos…); her kadro saha görünümünde
          ilk 11 + 7 yedek (Kerem, 4 Ekim)"

İKİ KAYNAK (ikisi de İngilizce Wikipedia, sadece `requests` gerekir):
  1) MAÇLAR  — final makalelerindeki kadro tabloları (gerçek ilk 11 + yedekler,
               pozisyon ve forma numarasıyla). Liste: scripts/kadro_listesi.json
               → "maclar". Günün Kadrosu bunlardan beslenir.
  2) SEZONLAR — "2012–13 Galatasaray S.K. season" gibi sezon makalelerindeki
               kadro ({{Fs player}}) ve varsa forma/maç sayısı tablosu.
               Liste: scripts/kadro_listesi.json → "sezonlar".

KULLANIM (PowerShell, proje klasöründe):
    python scripts/kadro_cek.py                 # hepsi (~400 sayfa, 15-25 dk)
    python scripts/kadro_cek.py --sadece maclar # sadece maçlar (~3 dk)
    python scripts/kadro_cek.py --sadece sezonlar

Durursa aynı komutu tekrar çalıştır: indirilen sayfalar veri/kadro_cache/
klasöründe saklanır, ikinci çalıştırma hızlıdır.

ÇIKTI (uygulamaya giden dosyayı Claude üretecek):
    veri/kadro_ham.json    — ham kadrolar
    veri/kadro_rapor.txt   — bulunamayan sayfalar, boş çıkan kadrolar
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time

try:
    import requests
except ImportError:
    print("Bu script `requests` paketine ihtiyaç duyuyor:  pip install requests")
    sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LISTE_YOLU = os.path.join(KOK, "scripts", "kadro_listesi.json")
VERI = os.path.join(KOK, "veri")
CACHE = os.path.join(VERI, "kadro_cache")
CIKTI = os.path.join(VERI, "kadro_ham.json")
RAPOR = os.path.join(VERI, "kadro_rapor.txt")
API = "https://en.wikipedia.org/w/api.php"

SON_HATA = {"mesaj": ""}


def api_iste(oturum, params, bekleme=1.0, deneme=4):
    """429/5xx'te artan bekleme ile 4 deneme (kadro_guncelle.py ile aynı desen)."""
    for i in range(deneme):
        try:
            r = oturum.get(API, params=params, timeout=30)
            if r.status_code in (429, 503):
                yeniden = r.headers.get("Retry-After")
                sure = float(yeniden) if (yeniden or "").isdigit() else (5 * (i + 1))
                SON_HATA["mesaj"] = "istek sinirlandi (%s), %.0f sn bekleniyor" % (r.status_code, sure)
                time.sleep(sure)
                continue
            if r.status_code != 200:
                SON_HATA["mesaj"] = "HTTP %s" % r.status_code
                time.sleep(bekleme)
                continue
            time.sleep(bekleme)
            return r.json()
        except Exception as e:
            SON_HATA["mesaj"] = "baglanti hatasi: %s" % str(e)[:60]
            time.sleep(2 * (i + 1))
    return None


def wikitext_getir(oturum, baslik):
    """Önbellekli. Dönüş: (gerçek başlık, wikitext) ya da (None, None)."""
    os.makedirs(CACHE, exist_ok=True)
    anahtar = hashlib.md5(baslik.encode("utf-8")).hexdigest()
    yol = os.path.join(CACHE, anahtar + ".json")
    if os.path.exists(yol):
        with open(yol, "r", encoding="utf-8") as f:
            d = json.load(f)
        return d.get("baslik"), d.get("metin")
    d = api_iste(oturum, {"action": "parse", "page": baslik, "prop": "wikitext",
                          "format": "json", "redirects": 1, "formatversion": 2})
    if d is None:
        return None, None  # ağ hatası: önbelleğe YAZMA, sonra tekrar denensin
    if "error" in d:
        SON_HATA["mesaj"] = "sayfa yok"
        sonuc = {"baslik": None, "metin": None}
    else:
        p = d.get("parse", {})
        sonuc = {"baslik": p.get("title"), "metin": p.get("wikitext")}
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(sonuc, f, ensure_ascii=False)
    return sonuc["baslik"], sonuc["metin"]


def arama_ile_bul(oturum, sorgu, icermeli):
    d = api_iste(oturum, {"action": "query", "list": "search", "srsearch": sorgu,
                          "format": "json", "formatversion": 2, "srlimit": 5})
    for s in (d or {}).get("query", {}).get("search", []):
        if all(p.lower() in s["title"].lower() for p in icermeli):
            return s["title"]
    return None


# ---------------------------------------------------------------- temizlik
def link_hedefi(metin):
    """'[[Claudio Taffarel|Taffarel]]' → ('Claudio Taffarel', 'Taffarel')."""
    m = re.search(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", metin or "")
    if not m:
        return None, None
    hedef = m.group(1).strip()
    gorunen = (m.group(2) or m.group(1)).strip()
    return hedef, gorunen


def duz_metin(metin):
    s = metin or ""
    s = re.sub(r"<ref[^>]*/>", "", s)
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"<[^>]+>", "", s)
    for _ in range(3):
        s = re.sub(r"\{\{(?:fb|fbw|fb-rt|fbw-rt|fbaicon|fbicon|flagicon|flagcountry|flag|nft)\|([^{}|]+)[^{}]*\}\}", r"\1", s, flags=re.I)
        s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^\]|]+\|)?([^\]]+)\]\]", r"\1", s)
    s = s.replace("'''", "").replace("''", "")
    return re.sub(r"\s+", " ", s).strip()


def ad_temizle(hedef):
    return re.sub(r"\s*\((?:footballer|soccer|association football)[^)]*\)\s*$", "", hedef or "", flags=re.I).strip()


# ---------------------------------------------------------------- maç kadrosu
POZ = r"(GK|RB|CB|LB|SW|RWB|LWB|DF|DM|CM|RM|LM|AM|MF|RW|LW|CF|ST|SS|FW|RCB|LCB|RCM|LCM|RDM|LDM|RAM|LAM|RF|LF)"
SATIR = re.compile(r"^\|\s*" + POZ + r"\s*\|\|(.*)$", re.M)


def mac_kadrolari(wikitext):
    """Final makalelerindeki standart kadro tabloları:
        |GK ||'''1''' ||{{flagicon|BRA}} [[Cláudio Taffarel]]
        |colspan=3|'''Substitutes:'''
        |colspan=3|'''Manager:'''
    Her 'Manager/Head coach' satırı bir takımın bitişi. Dönüş: [takım1, takım2]."""
    takimlar = []
    gecerli = {"ilk11": [], "yedek": []}
    yedekte = False
    for satir in (wikitext or "").splitlines():
        s = satir.strip()
        if re.search(r"Substitut", s, re.I) and s.startswith("|"):
            yedekte = True
            continue
        if re.search(r"'''\s*(Manager|Head coach|Coach)\s*:?\s*'''", s, re.I):
            if gecerli["ilk11"]:
                takimlar.append(gecerli)
            gecerli = {"ilk11": [], "yedek": []}
            yedekte = False
            continue
        m = SATIR.match(s)
        if not m:
            continue
        poz, kalan = m.group(1), m.group(2)
        hucreler = [h.strip() for h in kalan.split("||")]
        no = None
        oyuncu = None
        for h in hucreler:
            sayi = re.sub(r"[^0-9]", "", duz_metin(h))
            if no is None and sayi and len(sayi) <= 2 and "[[" not in h:
                no = int(sayi)
                continue
            hedef, gorunen = link_hedefi(h)
            if hedef and not re.match(r"(File|Image|Dosya):", hedef, re.I):
                oyuncu = {"ad": ad_temizle(hedef), "gorunen": gorunen}
                break
        if not oyuncu:
            continue
        kayit = {"poz": poz, "no": no, **oyuncu}
        (gecerli["yedek"] if yedekte else gecerli["ilk11"]).append(kayit)
    if gecerli["ilk11"]:
        takimlar.append(gecerli)
    # Yalnız gerçek 11'li kadrolar (bazı makalelerde ek tablolar olabiliyor)
    return [t for t in takimlar if len(t["ilk11"]) == 11][:2]


def kutu_alani(wikitext, alan):
    """{{Football box}} alanı: |team1 = ..., |score = ..., |date = ..."""
    m = re.search(r"^\s*\|\s*" + alan + r"\s*=\s*(.+)$", wikitext or "", re.M | re.I)
    if not m:
        return None
    ham = m.group(1)
    # {{Start date|2000|5|17}} → 2000-05-17
    t = re.search(r"\{\{\s*start\s*date\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})", ham, re.I)
    if t:
        return "%s-%02d-%02d" % (t.group(1), int(t.group(2)), int(t.group(3)))
    # Bayrak şablonları takım adına karışmasın ({{flagicon|TUR}} → "")
    ham = re.sub(r"\{\{\s*(flagicon|flag icon|fbaicon|flagdeco)[^{}]*\}\}", "", ham, flags=re.I)
    return duz_metin(ham) or None


def mac_isle(oturum, giris):
    baslik = giris["baslik"] if isinstance(giris, dict) else giris
    gercek, metin = wikitext_getir(oturum, baslik)
    if not metin:
        return None, "sayfa bulunamadı (%s)" % SON_HATA["mesaj"]
    takimlar = mac_kadrolari(metin)
    if len(takimlar) != 2:
        return None, "kadro tablosu okunamadı (%d takım)" % len(takimlar)
    ad1 = kutu_alani(metin, "team1") or kutu_alani(metin, "home")
    ad2 = kutu_alani(metin, "team2") or kutu_alani(metin, "away")
    kayit = {
        "baslik": gercek,
        "tarih": kutu_alani(metin, "date"),
        "skor": kutu_alani(metin, "score"),
        "penalti": kutu_alani(metin, "penaltyscore"),
        "stadyum": kutu_alani(metin, "stadium"),
        "takimlar": [dict(ad=ad1, **takimlar[0]), dict(ad=ad2, **takimlar[1])],
    }
    if isinstance(giris, dict):
        kayit.update({k: v for k, v in giris.items() if k != "baslik"})
    return kayit, None


# ---------------------------------------------------------------- sezon kadrosu
def sablon_parcalari(metin, adlar):
    """İç içe süslü parantezleri sayarak {{Fs player ...}} gibi şablonları çıkarır."""
    sonuc = []
    desen = re.compile(r"\{\{\s*(" + "|".join(adlar) + r")\b", re.I)
    for m in desen.finditer(metin):
        i, derin = m.start(), 0
        while i < len(metin):
            if metin.startswith("{{", i):
                derin += 1
                i += 2
                continue
            if metin.startswith("}}", i):
                derin -= 1
                i += 2
                if derin == 0:
                    break
                continue
            i += 1
        sonuc.append((m.start(), metin[m.start():i]))
    return sonuc


def sablon_parametreleri(sablon):
    ic = sablon[2:-2]
    parcalar, derin, bas = [], 0, 0
    i = 0
    while i < len(ic):
        if ic.startswith("{{", i) or ic.startswith("[[", i):
            derin += 1; i += 2; continue
        if ic.startswith("}}", i) or ic.startswith("]]", i):
            derin -= 1; i += 2; continue
        if ic[i] == "|" and derin == 0:
            parcalar.append(ic[bas:i]); bas = i + 1
        i += 1
    parcalar.append(ic[bas:])
    p = {}
    for x in parcalar[1:]:
        if "=" in x:
            k, v = x.split("=", 1)
            p[k.strip().lower()] = v.strip()
    return p


KESME = re.compile(r"==+\s*(Out on loan|Players out on loan|Loaned out|Reserve|Academy|Youth|Former|Transfers|Left club|Players out|Departures)[^=]*==+", re.I)


def sezon_kadrosu(wikitext):
    metin = wikitext or ""
    sablonlar = sablon_parcalari(metin, [r"fs\s*player", r"football\s+squad\s+player", r"fs\s*player2"])
    if not sablonlar:
        return []
    ilk = sablonlar[0][0]
    kesme = KESME.search(metin, ilk)
    sinir = kesme.start() if kesme else len(metin)
    oyuncular, gorulen = [], set()
    for bas, s in sablonlar:
        if bas >= sinir:
            break
        p = sablon_parametreleri(s)
        hedef, gorunen = link_hedefi(p.get("name", ""))
        ad = ad_temizle(hedef or duz_metin(p.get("name", "")))
        if not ad or ad in gorulen:
            continue
        gorulen.add(ad)
        no = re.sub(r"[^0-9]", "", duz_metin(p.get("no", "")))
        oyuncular.append({"ad": ad, "gorunen": gorunen or ad, "poz": duz_metin(p.get("pos", "")).upper()[:3],
                          "no": int(no) if no and len(no) <= 2 else None, "uyruk": duz_metin(p.get("nat", ""))})
    return oyuncular


# Maç/gol tablosu: "|1||GK||{{flagicon|URU}}||[[Fernando Muslera]]||38||0||..." — ilk sayı = toplam maç
APPS_SATIR = re.compile(r"^\|\s*(\d{1,2})?\s*\|\|\s*" + POZ + r"\s*\|\|(.*)$", re.M)


def mac_sayilari(wikitext):
    sayilar = {}
    for m in APPS_SATIR.finditer(wikitext or ""):
        kalan = m.group(3)
        hedef, _ = link_hedefi(kalan)
        if not hedef:
            continue
        sonra = kalan[kalan.find("]]") + 2:] if "]]" in kalan else ""
        for h in sonra.split("||"):
            d = duz_metin(h)
            # "38" ya da "30+8" (ilk 11 + yedekten) biçimleri
            mm = re.match(r"^(\d{1,3})(?:\s*\(?\+?\s*(\d{1,3})\)?)?$", d)
            if mm:
                toplam = int(mm.group(1)) + int(mm.group(2) or 0)
                ad = ad_temizle(hedef)
                sayilar[ad] = max(sayilar.get(ad, 0), toplam)
                break
    return sayilar


# ---------------------------------------------------------------- sezon v2 (4 Ekim 2026)
# İLK ÇALIŞTIRMADA 337 sezonun ancak 128'i okunabildi: çoğu sezon makalesi
# {{Fs player}} kullanmıyor. Gerçekte kullanılan biçimler:
#   {{Efs player|no=1|name=[[X]]|pos=GK|nat=ITA|30|0|1|0|...}}       (maç, gol, maç, gol...)
#   {{fb ss player 3|p=[[X|Y]]|n=1|pos=GK|c1a=11|c2a=31|...}}         (cNa = maç)
#   {{fb si player|p=[[X]]|n=4|pos=MF|...}}                           (kadro bilgisi, sezon maçı yok)
#   wikitable: |1||GK||{{flagicon|ESP}} [[David de Gea]] / |28||0||...||41||0   (Total = en büyük)
# Hepsi okunup isimle birleştiriliyor; sezon maç sayısı varsa ilk 11 ona göre seçilir.
def _ap(deger):
    # '30' / '7+1' / '24(1)' / '20 (22)' / kalın '37' -> toplam maç (int) ya da None
    d = duz_metin(deger).replace("'", "").strip()
    m = re.match(r"^(\d{1,3})\s*(?:\(\s*\+?\s*(\d{1,3})\s*\)|\+\s*(\d{1,3}))?$", d)
    if not m:
        return None
    return int(m.group(1)) + int(m.group(2) or m.group(3) or 0)


def _sortname(h):
    m = re.search(r"\{\{\s*sortname\s*\|([^|}]*)\|([^|}]*)(?:\|([^|}]*))?", h, re.I)
    if not m:
        return None, None
    gorunen = (m.group(1).strip() + " " + m.group(2).strip()).strip()
    hedef = (m.group(3) or "").strip()
    if not hedef or "=" in hedef:
        hedef = gorunen
    return hedef, gorunen


def _ad_al(h):
    hedef, gorunen = _sortname(h or "")
    if not hedef:
        hedef, gorunen = link_hedefi(h or "")
    if hedef and re.match(r"(File|Image|Dosya|Category):", hedef, re.I):
        return None, None
    return (ad_temizle(hedef), gorunen) if hedef else (None, None)


def _ekle(havuz, ad, gorunen=None, poz=None, no=None, mac=None):
    if not ad:
        return
    o = havuz.setdefault(ad, {"ad": ad, "gorunen": gorunen or ad, "poz": "", "no": None})
    if poz and not o["poz"]:
        o["poz"] = poz
    if no is not None and o["no"] is None:
        o["no"] = no
    if mac is not None:
        o["mac"] = max(o.get("mac", 0), mac)


def _no(v):
    n = re.sub(r"[^0-9]", "", duz_metin(v or ""))
    return int(n) if n and len(n) <= 2 else None


def _konumsal(t):
    ic = t[2:-2]
    parcalar, derin, bas, i = [], 0, 0, 0
    while i < len(ic):
        if ic.startswith("{{", i) or ic.startswith("[[", i):
            derin += 1; i += 2; continue
        if ic.startswith("}}", i) or ic.startswith("]]", i):
            derin -= 1; i += 2; continue
        if ic[i] == "|" and derin == 0:
            parcalar.append(ic[bas:i]); bas = i + 1
        i += 1
    parcalar.append(ic[bas:])
    return [x for x in parcalar[1:] if not re.match(r"^\s*[A-Za-z_][\w ]*=", x)]


def sezon_kadrosu_v2(wikitext):
    metin = wikitext or ""
    havuz = {}
    # A) Efs player
    for _, t in sablon_parcalari(metin, [r"efs\s*player"]):
        p = sablon_parametreleri(t)
        maclar = [_ap(x) for x in _konumsal(t)[0::2]]
        toplam = sum(x for x in maclar if x) if any(x is not None for x in maclar) else None
        ad, gorunen = _ad_al(p.get("name", ""))
        _ekle(havuz, ad, gorunen, duz_metin(p.get("pos", "")).upper()[:3], _no(p.get("no")), toplam)
    # B) fb ss player
    for _, t in sablon_parcalari(metin, [r"fb\s*ss\s*player(?:\s*\d)?"]):
        p = sablon_parametreleri(t)
        mac = [_ap(v) for k, v in p.items() if re.match(r"^c\d+a$", k)]
        toplam = sum(x for x in mac if x) if any(x is not None for x in mac) else None
        ad, gorunen = _ad_al(p.get("p", ""))
        _ekle(havuz, ad, gorunen, duz_metin(p.get("pos", "")).upper()[:3], _no(p.get("n")), toplam)
    # C) wikitable istatistik satırları
    for bolum in re.finditer(r"==+\s*(Squad statistics|Statistics|Player statistics|Appearances(?: and goals)?|Squad stats)\s*==+", metin, re.I):
        son = re.search(r"\n==[^=]", metin[bolum.end():])
        govde = metin[bolum.end(): bolum.end() + (son.start() if son else len(metin))]
        for satir_blok in re.split(r"\n\|-[^\n]*", govde):
            hucreler = []
            for line in satir_blok.split("\n"):
                line = line.strip()
                if not line.startswith("|") or line.startswith("|}") or line.startswith("{|"):
                    continue
                for h in re.split(r"\|\|", line[1:]):
                    if re.match(r'^\s*(align|style|class|rowspan|colspan|bgcolor|data-sort-value)\s*=\s*[^|\[{]*\|', h):
                        h = h.split("|", 1)[1]
                    hucreler.append(h.strip())
            if len(hucreler) < 4:
                continue
            poz_i = next((i for i, h in enumerate(hucreler[:5]) if re.fullmatch(POZ, duz_metin(h).upper())), None)
            if poz_i is None:
                continue
            ad_i = next((i for i in range(poz_i + 1, min(len(hucreler), poz_i + 4)) if _ad_al(hucreler[i])[0]), None)
            if ad_i is None:
                continue
            ad, gorunen = _ad_al(hucreler[ad_i])
            # 75'ten büyük sayılar dakika/yaş sütunudur (bir sezonda en çok ~65 maç).
            maclar = [x for x in (_ap(h) for h in hucreler[ad_i + 1:]) if x is not None and x <= 75]
            no = _no(hucreler[poz_i - 1]) if poz_i > 0 else None
            _ekle(havuz, ad, gorunen, duz_metin(hucreler[poz_i]).upper(), no, max(maclar) if maclar else None)
    # D) fb si player (kadro bilgisi; 'a' kariyer maçı olduğu için kullanılmıyor)
    for _, t in sablon_parcalari(metin, [r"fb\s*si\s*player"]):
        p = sablon_parametreleri(t)
        ad, gorunen = _ad_al(p.get("p", ""))
        _ekle(havuz, ad, gorunen, duz_metin(p.get("pos", "")).upper()[:3], _no(p.get("n")))
    # E) Fs player (eski yöntem)
    for o in sezon_kadrosu(metin):
        _ekle(havuz, o["ad"], o["gorunen"], o["poz"], o["no"])
    return list(havuz.values())


def sezon_basligi(kulup_kalibi, sezon):
    return kulup_kalibi.replace("{sezon}", sezon)


def sezon_isle(oturum, kulup, kalip, sezon):
    baslik = sezon_basligi(kalip, sezon)
    gercek, metin = wikitext_getir(oturum, baslik)
    if not metin:
        bulunan = arama_ile_bul(oturum, "%s %s season" % (sezon, kulup), [sezon[:4], "season", kulup])
        if bulunan:
            gercek, metin = wikitext_getir(oturum, bulunan)
    if not metin:
        return None, "sayfa bulunamadı: %s" % baslik
    kadro = sezon_kadrosu_v2(metin)
    if len(kadro) < 14:
        return None, "kadro okunamadı (%d oyuncu): %s" % (len(kadro), gercek or baslik)
    return {"kulup": kulup, "sezon": sezon, "baslik": gercek, "oyuncular": kadro,
            "macSayisiVar": sum(1 for o in kadro if o.get("mac")) >= 11}, None


# ---------------------------------------------------------------- ana akış
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sadece", choices=["maclar", "sezonlar"])
    ap.add_argument("--bekleme", type=float, default=0.8)
    a = ap.parse_args()

    with open(LISTE_YOLU, "r", encoding="utf-8") as f:
        liste = json.load(f)
    os.makedirs(VERI, exist_ok=True)
    oturum = requests.Session()
    oturum.headers.update({"User-Agent": "OrtakFutbolcuBot/1.0 (kisisel mobil oyun projesi; kadro verisi) python-requests"})

    onceki = {}
    if os.path.exists(CIKTI):
        with open(CIKTI, "r", encoding="utf-8") as f:
            onceki = json.load(f)
    cikti = {"maclar": onceki.get("maclar", []), "sezonlar": onceki.get("sezonlar", []), "uretildi": time.strftime("%Y-%m-%d %H:%M")}
    rapor = []

    if a.sadece in (None, "maclar"):
        cikti["maclar"] = []
        maclar = liste["maclar"]
        for i, g in enumerate(maclar, 1):
            kayit, hata = mac_isle(oturum, g)
            ad = g["baslik"] if isinstance(g, dict) else g
            if kayit:
                cikti["maclar"].append(kayit)
                print("[maç %d/%d] %s  ✓" % (i, len(maclar), ad))
            else:
                rapor.append("MAÇ  %s — %s" % (ad, hata))
                print("[maç %d/%d] %s  ✗ %s" % (i, len(maclar), ad, hata))

    if a.sadece in (None, "sezonlar"):
        cikti["sezonlar"] = []
        isler = []
        for grup in liste["sezonlar"]:
            for sezon in grup["sezonlar"]:
                isler.append((grup["kulup"], grup["kalip"], sezon))
        for i, (kulup, kalip, sezon) in enumerate(isler, 1):
            kayit, hata = sezon_isle(oturum, kulup, kalip, sezon)
            if kayit:
                cikti["sezonlar"].append(kayit)
                print("[sezon %d/%d] %s %s  ✓ %d oyuncu%s" % (i, len(isler), kulup, sezon, len(kayit["oyuncular"]),
                                                             " (maç sayılı)" if kayit["macSayisiVar"] else ""))
            else:
                rapor.append("SEZON %s %s — %s" % (kulup, sezon, hata))
                print("[sezon %d/%d] %s %s  ✗ %s" % (i, len(isler), kulup, sezon, hata))

    gecici = CIKTI + ".tmp"
    with open(gecici, "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False)
    os.replace(gecici, CIKTI)
    with open(RAPOR, "w", encoding="utf-8") as f:
        f.write("\n".join(rapor) + "\n")
    print("\nBİTTİ: %d maç, %d sezon kadrosu → %s" % (len(cikti["maclar"]), len(cikti["sezonlar"]), CIKTI))
    print("Sorunlu sayfalar (%d): %s" % (len(rapor), RAPOR))


if __name__ == "__main__":
    main()
