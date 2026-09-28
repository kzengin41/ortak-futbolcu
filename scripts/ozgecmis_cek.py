# -*- coding: utf-8 -*-
"""
FUTBOLCU OZGECMISI VERISI (gece calisacak toplu cekme) — 27 Eylul 2026

Kerem: "futbolcularin resmine tiklaninca acilan ozgecmisi icin basarilarin
cekilmesi gerekecek. aktifse hangi takimda oynadigi, pasifse hangi takimda
biraktigi, olduyse hangi yil oldugu vb. ... xox'te basari/takim, ulke/takim,
karma modlari vb gelecek. ornegin real'de oynamis ballon d'or sahipleri gibi."

UC ASAMA (hepsi tek komutla, sirayla; kaldigi yerden devam eder):
  1) ESLESTIRME  — players.json'daki her isim icin Wikipedia sayfasi ve
                   Wikidata kimligi (QID). Ad belirsizse "(footballer)" ve
                   "(footballer, born YYYY)" denenir. 50'ser isim/istek.
  2) WIKIDATA    — dogum/olum tarihi, uyruk, mevki, boy, kulup gecmisi
                   (baslangic-bitis yillariyla; aktifse guncel kulup, biraktiysa
                   son kulup), milli takim, BIREYSEL ODULLER (Ballon d'Or,
                   Altin Ayak...). 50'ser oyuncu/istek.
  3) KUPALAR     — takim kupalari Wikidata'da duzgun tutulmuyor; en populer
                   N oyuncunun Wikipedia makalesindeki "Honours" bolumu okunur
                   (Super Lig 2011-12, Champions League 2016-17...).

KULLANIM (PowerShell, proje klasorunde):
    python scripts/ozgecmis_cek.py                  # hepsi (gece boyu)
    python scripts/ozgecmis_cek.py --kupa-limit 3000 # kupa asamasini kisalt
    python scripts/ozgecmis_cek.py --asama 2         # sadece bir asamayi calistir

Pencereyi kapatma; bilgisayar uyku moduna gecmesin. Durursa ayni komutu
tekrar calistir — kaldigi yerden devam eder (veri/ozgecmis_ilerleme.json).
CIKTI: veri/ozgecmis_ham.json  (uygulamaya giden dosyalari Claude uretecek)
Gunluk: veri/ozgecmis_gunluk.txt
"""
import argparse
import collections
import json
import os
import re
import sys
import time
import traceback

try:
    import requests
except ImportError:
    print("Bu script requests paketine ihtiyac duyuyor:  pip install requests")
    sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYERS_YOLU = os.path.join(KOK, "lib", "players.json")
BIRTH_YOLU = os.path.join(KOK, "lib", "playerBirthPosition.json")
POP_YOLU = os.path.join(KOK, "lib", "playerPopularity.json")
YILLAR_YOLU = os.path.join(KOK, "lib", "playerYears.json")
VERI = os.path.join(KOK, "veri")
ILERLEME = os.path.join(VERI, "ozgecmis_ilerleme.json")
CIKTI = os.path.join(VERI, "ozgecmis_ham.json")
GUNLUK = os.path.join(VERI, "ozgecmis_gunluk.txt")

WP = "https://en.wikipedia.org/w/api.php"
WD = "https://www.wikidata.org/w/api.php"
UA = "OrtakFutbolcuBot/1.0 (kisisel mobil futbol bilgi oyunu; KontStudioApps@gmail.com) python-requests"

FUTBOLCU_QID = "Q937857"      # association football player
BEKLEME = 0.35                 # istekler arasi (saniye) — nazik olalim

# ---------------------------------------------------------------- yardimcilar
def log(msg):
    satir = time.strftime("%H:%M:%S") + "  " + msg
    try:
        print(satir)
    except UnicodeEncodeError:
        print(satir.encode("ascii", "replace").decode("ascii"))
    try:
        with open(GUNLUK, "a", encoding="utf-8") as f:
            f.write(satir + "\n")
    except Exception:
        pass


def json_oku(yol, varsayilan):
    if not os.path.exists(yol):
        return varsayilan
    try:
        with open(yol, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return varsayilan


def json_yaz(yol, veri):
    gecici = yol + ".tmp"
    with open(gecici, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False)
    os.replace(gecici, yol)


class Istemci:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({"User-Agent": UA, "Accept-Encoding": "gzip"})
        self.son = 0.0

    def get(self, url, params, deneme=8):
        params = dict(params)
        params.setdefault("format", "json")
        params.setdefault("formatversion", 2)
        if "wikidata" in url:
            params.setdefault("maxlag", 5)
        bekle = 2.0
        for i in range(deneme):
            gecen = time.time() - self.son
            if gecen < BEKLEME:
                time.sleep(BEKLEME - gecen)
            self.son = time.time()
            try:
                r = self.s.get(url, params=params, timeout=60)
            except requests.RequestException as h:
                log("   ag hatasi (%s) — %d sn sonra tekrar" % (type(h).__name__, bekle))
                time.sleep(bekle); bekle = min(bekle * 2, 120); continue
            if r.status_code in (429, 500, 502, 503, 504):
                sonra = r.headers.get("Retry-After")
                t = int(sonra) if sonra and sonra.isdigit() else bekle
                log("   sunucu %d — %d sn bekleniyor" % (r.status_code, t))
                time.sleep(t); bekle = min(bekle * 2, 180); continue
            try:
                d = r.json()
            except ValueError:
                time.sleep(bekle); bekle = min(bekle * 2, 120); continue
            if isinstance(d, dict) and d.get("error", {}).get("code") == "maxlag":
                time.sleep(max(5, bekle)); bekle = min(bekle * 2, 120); continue
            return d
        log("   VAZGECILDI: %s %s" % (url, str(params)[:120]))
        return None


def parcala(liste, n):
    for i in range(0, len(liste), n):
        yield liste[i:i + n]


def yil(zaman):
    # Wikidata zaman degeri: "+1987-06-24T00:00:00Z"
    if not zaman:
        return None
    m = re.match(r"^([+-])(\d{1,4})-", zaman)
    if not m:
        return None
    y = int(m.group(2))
    return -y if m.group(1) == "-" else y


def iddeger(snak):
    try:
        return snak["datavalue"]["value"]["id"]
    except (KeyError, TypeError):
        return None


def zamandeger(snak):
    try:
        return snak["datavalue"]["value"]["time"]
    except (KeyError, TypeError):
        return None


def nicelikdeger(snak):
    try:
        return float(snak["datavalue"]["value"]["amount"])
    except (KeyError, TypeError, ValueError):
        return None


# ============================================================ ASAMA 1 — QID
def sayfa_bilgisi(ist, basliklar):
    """50'ye kadar baslik -> {istenen_baslik: {"baslik":..., "qid":..., "belirsiz":bool}}"""
    d = ist.get(WP, {
        "action": "query", "titles": "|".join(basliklar), "redirects": 1,
        "prop": "pageprops", "ppprop": "wikibase_item|disambiguation",
    })
    sonuc = {}
    if not d or "query" not in d:
        return sonuc
    q = d["query"]
    esle = {b: b for b in basliklar}
    for n in q.get("normalized", []) or []:
        for k, v in list(esle.items()):
            if v == n["from"]:
                esle[k] = n["to"]
    yon = {r["from"]: r["to"] for r in (q.get("redirects", []) or [])}
    sayfalar = {p.get("title"): p for p in q.get("pages", []) or []}
    for istenen, norm in esle.items():
        hedef = yon.get(norm, norm)
        p = sayfalar.get(hedef)
        if not p or p.get("missing"):
            sonuc[istenen] = None
            continue
        pp = p.get("pageprops", {}) or {}
        sonuc[istenen] = {
            "baslik": hedef,
            "qid": pp.get("wikibase_item"),
            "belirsiz": "disambiguation" in pp,
        }
    return sonuc


def futbolcu_mu(ist, qidler):
    """QID listesi -> {qid: True/False} (P106 meslek = futbolcu mu)"""
    sonuc = {}
    for grup in parcala(list(qidler), 50):
        d = ist.get(WD, {"action": "wbgetentities", "ids": "|".join(grup), "props": "claims"})
        if not d:
            continue
        for qid, e in (d.get("entities") or {}).items():
            meslek = [iddeger(c.get("mainsnak", {})) for c in (e.get("claims", {}) or {}).get("P106", [])]
            poz = (e.get("claims", {}) or {}).get("P413")
            sonuc[qid] = FUTBOLCU_QID in meslek or bool(poz)
    return sonuc


def asama1(ist, durum, oyuncular, dogum):
    esles = durum.setdefault("qid", {})       # ad -> {"baslik","qid"} ya da None
    denenen = durum.setdefault("qid_denenen", {})  # ad -> son denenen aday no
    adlar = [p["name"] for p in oyuncular]
    kalan = [a for a in adlar if a not in esles]
    log("ASAMA 1: %d oyuncunun %d tanesi eslestirilecek" % (len(adlar), len(kalan)))

    def adaylar(ad):
        y = (dogum.get(ad) or {}).get("birthYear")
        if not ad or re.search(r"[#<>\[\]{}|]", ad) or len(ad) > 200:
            return []   # Wikipedia başlığında olamayacak karakterler
        c = [ad, ad + " (footballer)"]
        if y:
            c.append("%s (footballer, born %s)" % (ad, y))
        c.append(ad + " (soccer)")
        return c

    tur = 0
    while True:
        # her oyuncu icin siradaki aday baslik
        is_listesi = []
        for ad in adlar:
            if ad in esles:
                continue
            i = denenen.get(ad, 0)
            aday = adaylar(ad)
            if i >= len(aday):
                esles[ad] = None
                continue
            is_listesi.append((ad, aday[i]))
        if not is_listesi:
            break
        tur += 1
        log("  tur %d: %d baslik deneniyor" % (tur, len(is_listesi)))
        for n, grup in enumerate(parcala(is_listesi, 50)):
            bilgi = sayfa_bilgisi(ist, [b for _, b in grup])
            qidler = {v["qid"] for v in bilgi.values() if v and v.get("qid") and not v.get("belirsiz")}
            futbolcu = futbolcu_mu(ist, qidler) if qidler else {}
            for ad, baslik in grup:
                v = bilgi.get(baslik)
                if v and v.get("qid") and not v.get("belirsiz") and futbolcu.get(v["qid"]):
                    esles[ad] = {"baslik": v["baslik"], "qid": v["qid"]}
                else:
                    denenen[ad] = denenen.get(ad, 0) + 1
            if n % 20 == 0:
                bulunan = sum(1 for x in esles.values() if x)
                log("    %d/%d grup — su ana kadar bulunan: %d" % (n + 1, (len(is_listesi) + 49) // 50, bulunan))
                json_yaz(ILERLEME, durum)
        json_yaz(ILERLEME, durum)
    bulunan = sum(1 for x in esles.values() if x)
    log("ASAMA 1 BITTI: %d / %d oyuncu eslesti" % (bulunan, len(adlar)))


# ============================================================ ASAMA 2 — WIKIDATA
def ozellik_cikar(e):
    c = e.get("claims", {}) or {}

    def ilk_zaman(p):
        for s in c.get(p, []):
            t = zamandeger(s.get("mainsnak", {}))
            if t:
                return t[1:11] if t.startswith("+") else t
        return None

    takimlar = []
    for s in c.get("P54", []):
        takim = iddeger(s.get("mainsnak", {}))
        if not takim:
            continue
        nit = s.get("qualifiers", {}) or {}
        bas = next((yil(zamandeger(q)) for q in nit.get("P580", []) if zamandeger(q)), None)
        son = next((yil(zamandeger(q)) for q in nit.get("P582", []) if zamandeger(q)), None)
        mac = next((nicelikdeger(q) for q in nit.get("P1350", [])), None)
        gol = next((nicelikdeger(q) for q in nit.get("P1351", [])), None)
        kiralik = any(iddeger(q) == "Q2914547" for q in nit.get("P1642", []))  # acquisition: loan
        takimlar.append({"q": takim, "b": bas, "s": son, "m": mac, "g": gol, "k": kiralik or None})

    oduller = []
    for s in c.get("P166", []):
        od = iddeger(s.get("mainsnak", {}))
        if not od:
            continue
        nit = s.get("qualifiers", {}) or {}
        y = next((yil(zamandeger(q)) for q in nit.get("P585", []) if zamandeger(q)), None)
        oduller.append({"q": od, "y": y})

    boy = None
    for s in c.get("P2048", []):
        v = nicelikdeger(s.get("mainsnak", {}))
        if v:
            boy = v if v > 3 else v * 100  # metre ise cm'ye
            break

    return {
        "dogum": ilk_zaman("P569"),
        "olum": ilk_zaman("P570"),
        "uyruk": [iddeger(s.get("mainsnak", {})) for s in c.get("P27", []) if iddeger(s.get("mainsnak", {}))],
        "mevki": [iddeger(s.get("mainsnak", {})) for s in c.get("P413", []) if iddeger(s.get("mainsnak", {}))],
        "ayak": next((iddeger(s.get("mainsnak", {})) for s in c.get("P552", [])), None),
        "boy": boy,
        "takimlar": takimlar,
        "oduller": oduller,
        "etiket_tr": ((e.get("labels") or {}).get("tr") or {}).get("value"),
        "aciklama_tr": ((e.get("descriptions") or {}).get("tr") or {}).get("value"),
        "trwiki": ((e.get("sitelinks") or {}).get("trwiki") or {}).get("title"),
    }


def asama2(ist, durum):
    esles = durum.get("qid", {})
    kayit = durum.setdefault("wd", {})   # qid -> ozellikler
    qidler = sorted({v["qid"] for v in esles.values() if v and v.get("qid")} - set(kayit))
    log("ASAMA 2: %d oyuncunun Wikidata kaydi okunacak" % len(qidler))
    for n, grup in enumerate(parcala(qidler, 50)):
        d = ist.get(WD, {"action": "wbgetentities", "ids": "|".join(grup),
                         "props": "claims|labels|descriptions|sitelinks", "languages": "tr|en",
                         "sitefilter": "trwiki"})
        if not d:
            continue
        for qid, e in (d.get("entities") or {}).items():
            if e.get("missing") is not None and "claims" not in e:
                kayit[qid] = None
                continue
            try:
                kayit[qid] = ozellik_cikar(e)
            except Exception:
                kayit[qid] = None
                log("   ozellik cikarilamadi: %s\n%s" % (qid, traceback.format_exc()[-300:]))
        if n % 20 == 0:
            log("    %d/%d grup" % (n + 1, (len(qidler) + 49) // 50))
            json_yaz(ILERLEME, durum)
    json_yaz(ILERLEME, durum)

    # Takim / odul / ulke / mevki etiketleri
    etiket = durum.setdefault("etiket", {})
    lazim = set()
    for v in kayit.values():
        if not v:
            continue
        lazim.update(t["q"] for t in v["takimlar"])
        lazim.update(o["q"] for o in v["oduller"])
        lazim.update(v["uyruk"]); lazim.update(v["mevki"])
        if v.get("ayak"):
            lazim.add(v["ayak"])
    lazim = sorted(q for q in lazim if q and q not in etiket)
    log("ASAMA 2b: %d takim/odul/ulke adi okunacak" % len(lazim))
    for n, grup in enumerate(parcala(lazim, 50)):
        d = ist.get(WD, {"action": "wbgetentities", "ids": "|".join(grup),
                         "props": "labels|claims", "languages": "en|tr"})
        if not d:
            continue
        for qid, e in (d.get("entities") or {}).items():
            lab = e.get("labels") or {}
            c = e.get("claims") or {}
            tur = [iddeger(s.get("mainsnak", {})) for s in c.get("P31", [])]
            ulke = next((iddeger(s.get("mainsnak", {})) for s in c.get("P17", [])), None)
            etiket[qid] = {
                "en": (lab.get("en") or {}).get("value"),
                "tr": (lab.get("tr") or {}).get("value"),
                "tur": [t for t in tur if t][:4],
                "ulke": ulke,
            }
        if n % 20 == 0:
            log("    %d/%d grup" % (n + 1, (len(lazim) + 49) // 50))
            json_yaz(ILERLEME, durum)
    json_yaz(ILERLEME, durum)
    log("ASAMA 2 BITTI")


# ============================================================ ASAMA 3 — KUPALAR
BOLUM_ADLARI = ("honours", "honors", "titles", "achievements", "honours and achievements")


def wikilink_temizle(metin):
    metin = re.sub(r"<ref[^>]*/>", "", metin)
    metin = re.sub(r"<ref[^>]*>.*?</ref>", "", metin, flags=re.S)
    metin = re.sub(r"\{\{[^{}]*\}\}", "", metin)
    metin = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", metin)
    metin = re.sub(r"'{2,}", "", metin)
    metin = re.sub(r"<[^>]+>", "", metin)
    return re.sub(r"\s+", " ", metin).strip()


YONETICI_RE = re.compile(r"manag|coach|teknik", re.I)
OYUNCU_RE = re.compile(r"\bplay(er|ing)\b", re.I)


def kupa_bolumu_ayristir(wt):
    """Honours bolumu wikitext'i -> [{"grup": "Galatasaray", "kupa": "Super Lig", "yillar": [...] }]
    "Manager"/"Coach" basliklarinin altindakiler teknik direktorluk kupasidir: "yonetici": true."""
    sonuc = []
    durum = {"grup": None, "yonetici": 0}   # yonetici: "Manager" basliginin seviyesi (0 = degil)

    def baslik(metin, seviye):
        m = wikilink_temizle(metin).rstrip(":").strip()
        if durum["yonetici"] and seviye <= durum["yonetici"]:
            durum["yonetici"] = 0            # ayni/ust seviyede yeni bolum: yoneticilik bitti
        if YONETICI_RE.search(m):
            durum["yonetici"] = seviye
        elif OYUNCU_RE.search(m):
            durum["yonetici"] = 0
        durum["grup"] = m

    for satir in wt.splitlines():
        s = satir.strip()
        if not s:
            continue
        m = re.match(r"^(={2,5})\s*(.+?)\s*={2,5}$", s)
        if m:
            baslik(m.group(2), len(m.group(1))); continue
        if s.startswith(";"):
            baslik(s[1:], 9); continue
        m = re.match(r"^'''(.+?)'''\s*:?\s*$", s)
        if m:
            baslik(m.group(1), 9); continue
        if s.startswith("*"):
            govde = s.lstrip("*").strip()
            temiz = wikilink_temizle(govde)
            if ":" in temiz:
                kupa, yillar = temiz.split(":", 1)
            else:
                m2 = re.match(r"^(.*?)\s*((?:\d{4}(?:[–\-/]\d{2,4})?[,;\s]*)+)$", temiz)
                if not m2:
                    continue
                kupa, yillar = m2.group(1), m2.group(2)
            kupa = kupa.strip(" -–")
            yil_listesi = re.findall(r"\d{4}(?:[–\-/]\d{2,4})?", yillar)
            if kupa and len(kupa) < 90:
                kayit = {"grup": durum["grup"], "kupa": kupa, "yillar": yil_listesi,
                         "not": yillar.strip()[:80] if not yil_listesi else None}
                if durum["yonetici"]:
                    kayit["yonetici"] = True
                sonuc.append(kayit)
    return sonuc


SENYOR_MILLI = re.compile(r"national (association )?football team", re.I)


def onem_puani(durum, pop):
    """Kupa bolumu once okunacak oyuncular: Turkce Wikipedia sayfasi olanlar,
    A milli takimda oynamis olanlar, Wikidata'da odulu olanlar. (playerPopularity
    verisi eksik: Messi/Ronaldo gibi isimlerde 0, tek basina kullanilamiyor.)"""
    esles = durum.get("qid", {})
    wd = durum.get("wd", {})
    etiket = durum.get("etiket", {})

    def puan(ad):
        e = esles.get(ad)
        k = wd.get(e["qid"]) if e else None
        if not k:
            return 0
        p = 0
        if k.get("trwiki"):
            p += 4
        for t in k.get("takimlar") or []:
            en = (etiket.get(t["q"]) or {}).get("en") or ""
            if SENYOR_MILLI.search(en) and not re.search(r"under|u-?\d\d|women|olympic|b team", en, re.I):
                p += 2
                break
        if k.get("oduller"):
            p += 1
        return p + min((pop.get(ad) or 0), 1000000) / 1000000.0
    return puan


def asama3(ist, durum, oyuncular, pop, limit):
    esles = durum.get("qid", {})
    kupa = durum.setdefault("kupa", {})   # ad -> liste | None
    puan = onem_puani(durum, pop)
    sirali = sorted((p["name"] for p in oyuncular if esles.get(p["name"])), key=lambda a: -puan(a))
    if limit:
        sirali = sirali[:limit]
    kalan = [a for a in sirali if a not in kupa]
    log("ASAMA 3: %d oyuncunun kupa bolumu okunacak (kalan %d)" % (len(sirali), len(kalan)))
    for n, ad in enumerate(kalan):
        baslik = esles[ad]["baslik"]
        d = ist.get(WP, {"action": "parse", "page": baslik, "prop": "sections", "redirects": 1})
        bolum = None
        for sec in ((d or {}).get("parse", {}) or {}).get("sections", []) or []:
            if (sec.get("line") or "").strip().lower() in BOLUM_ADLARI and sec.get("toclevel") == 1:
                bolum = sec.get("index"); break
        if not bolum:
            kupa[ad] = []
        else:
            d2 = ist.get(WP, {"action": "parse", "page": baslik, "prop": "wikitext", "section": bolum, "redirects": 1})
            wt = ((d2 or {}).get("parse", {}) or {}).get("wikitext", "")
            if isinstance(wt, dict):
                wt = wt.get("*", "")
            try:
                kupa[ad] = kupa_bolumu_ayristir(wt or "")
            except Exception:
                kupa[ad] = []
        if n % 100 == 0:
            log("    %d/%d oyuncu" % (n + 1, len(kalan)))
            json_yaz(ILERLEME, durum)
    json_yaz(ILERLEME, durum)
    log("ASAMA 3 BITTI")


# ============================================================ ASAMA 4 — GUNCEL KULUP
# Wikidata'da sozlesme bitisleri cogu zaman islenmiyor (or. Icardi: Galatasaray
# kaydi acik duruyor ama oyuncu serbest). Wikipedia bilgi kutusundaki
# "current_club" alani ise transferlerden hemen sonra guncelleniyor. Sadece
# aktif oyuncular (playerYears >= gecen yil) icin makalenin giris bolumu okunur.
SERBEST_RE = re.compile(r"free agent|unattached|without (a )?club|serbest|kul[uü]ps[uü]z|no club|\bnone\b", re.I)
EMEKLI_RE = re.compile(r"retired|emekli", re.I)


def guncel_kulup_ayristir(wt):
    """Bilgi kutusu wikitext'i -> {"durum": "kulup"|"serbest"|"emekli"|"bos", "kulup": str|None, "kiralik": bool}"""
    m = re.search(r"^\s*\|\s*current[_ ]?club\s*=\s*(.*)$", wt or "", re.I | re.M)
    if not m:
        return {"durum": "bos", "kulup": None}
    ham = m.group(1)
    # ayni satirdaki bir sonraki alan (| clubnumber = ...) varsa kes
    ham = re.split(r"\s\|\s*[a-z_]+\s*=", ham)[0]
    temiz = wikilink_temizle(ham).strip(" '\"")
    if not temiz:
        # {{free agent}} gibi sablonlar temizlikte silinir — ham metne de bak
        if SERBEST_RE.search(ham):
            return {"durum": "serbest", "kulup": None}
        return {"durum": "bos", "kulup": None}
    if SERBEST_RE.search(temiz):
        return {"durum": "serbest", "kulup": None}
    if EMEKLI_RE.search(temiz):
        return {"durum": "emekli", "kulup": None}
    kiralik = bool(re.search(r"on loan|loan from|kiral", temiz, re.I))
    kulup = re.split(r"\s*\(|\s*,\s*on loan", temiz)[0].strip()
    return {"durum": "kulup", "kulup": kulup or None, "kiralik": kiralik or None}


def asama4(ist, durum, oyuncular, yillar):
    esles = durum.get("qid", {})
    ib = durum.setdefault("infobox", {})
    son = max([v for v in yillar.values() if isinstance(v, int) and v < 3000] + [2026])
    aktifler = [p["name"] for p in oyuncular
                if esles.get(p["name"]) and (yillar.get(p["name"]) or 0) >= son - 1]
    kalan = [a for a in dict.fromkeys(aktifler) if a not in ib]
    log("ASAMA 4: %d aktif oyuncunun guncel kulubu okunacak (kalan %d)" % (len(aktifler), len(kalan)))

    def oku(grup):
        """grup icin {ad: wikitext|None}; istek basarisizsa None."""
        basliklar = {esles[a]["baslik"]: a for a in grup}
        d = ist.get(WP, {"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main",
                         "rvsection": 0, "titles": "|".join(basliklar), "redirects": 1})
        if not d or "error" in d:
            return None
        q = d.get("query", {}) or {}
        norm = {x["from"]: x["to"] for x in q.get("normalized", []) or []}
        yon = {x["from"]: x["to"] for x in q.get("redirects", []) or []}
        sayfalar = {}
        for p in q.get("pages", []) or []:
            try:
                sayfalar[p.get("title")] = p["revisions"][0]["slots"]["main"]["content"]
            except (KeyError, IndexError, TypeError):
                pass
        sonuc = {}
        for baslik, ad in basliklar.items():
            h = norm.get(baslik, baslik)
            sonuc[ad] = sayfalar.get(yon.get(h, h))
        return sonuc

    tekler = []
    for n, grup in enumerate(parcala(kalan, 20)):
        r = oku(grup)
        if r is None:
            tekler.extend(grup)
            continue
        for ad, wt in r.items():
            if wt is None:
                tekler.append(ad)
            else:
                ib[ad] = guncel_kulup_ayristir(wt)
        if n % 25 == 0:
            say = collections.Counter(v["durum"] for v in ib.values())
            log("    %d/%d oyuncu — %s" % (len(ib), len(aktifler), dict(say)))
            json_yaz(ILERLEME, durum)
    if tekler:
        log("   %d oyuncu tek tek okunacak" % len(tekler))
    for n, ad in enumerate(tekler):
        r = oku([ad]) or {}
        ib[ad] = guncel_kulup_ayristir(r.get(ad)) if r.get(ad) else {"durum": "bos", "kulup": None}
        if n % 100 == 0:
            json_yaz(ILERLEME, durum)
    json_yaz(ILERLEME, durum)
    say = collections.Counter(v["durum"] for v in ib.values())
    log("ASAMA 4 BITTI — %s" % dict(say))


# ============================================================ ASAMA 5 — TANINIRLIK
# playerPopularity.json guvenilmez (Messi = 0). Gercek tanininirlik icin iki olcu:
#   * sitelinks: oyuncunun kac dilde Wikipedia makalesi var (tum zamanlar unu)
#   * sayfa goruntulenme: son 12 ay, Ingilizce + Turkce Wikipedia (guncel ilgi;
#     Turkce olan Turk oyuncu kitlesinin ilgisini olcuyor)
PV_URL = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/%s/all-access/user/%s/monthly/%s/%s"
DIGER_WIKI = {"commonswiki", "specieswiki", "metawiki", "wikidatawiki", "mediawikiwiki", "sourceswiki",
              "wikimaniawiki", "outreachwiki", "incubatorwiki", "foundationwiki"}


def _pv_aralik():
    t = time.gmtime()
    bit_y, bit_a = t.tm_year, t.tm_mon - 1          # gecen ay sonu
    if bit_a == 0:
        bit_y, bit_a = bit_y - 1, 12
    bas_y, bas_a = bit_y - 1, bit_a + 1              # 12 ay once
    if bas_a == 13:
        bas_y, bas_a = bas_y + 1, 1
    import calendar
    son_gun = calendar.monthrange(bit_y, bit_a)[1]
    return "%04d%02d0100" % (bas_y, bas_a), "%04d%02d%02d00" % (bit_y, bit_a, son_gun)


def asama5(ist, durum, oyuncular):
    import threading
    from concurrent.futures import ThreadPoolExecutor
    from urllib.parse import quote

    esles = durum.get("qid", {})
    wd = durum.get("wd", {})
    tn = durum.setdefault("tanin", {})     # ad -> {"sl": int, "en": int, "tr": int}
    adlar = [a for a in dict.fromkeys(p["name"] for p in oyuncular) if esles.get(a)]

    # --- 5a: sitelinks (Wikidata, 50'serli) ---
    qid_ad = {}
    for a in adlar:
        if "sl" not in tn.get(a, {}):
            qid_ad.setdefault(esles[a]["qid"], []).append(a)
    log("ASAMA 5a: %d oyuncunun dil sayisi okunacak" % len(qid_ad))
    for n, grup in enumerate(parcala(list(qid_ad), 50)):
        d = ist.get(WD, {"action": "wbgetentities", "ids": "|".join(grup), "props": "sitelinks"})
        for qid, e in ((d or {}).get("entities") or {}).items():
            sl = [k for k in (e.get("sitelinks") or {}) if k.endswith("wiki") and k not in DIGER_WIKI]
            for a in qid_ad.get(qid, []):
                tn.setdefault(a, {})["sl"] = len(sl)
        if n % 50 == 0:
            log("    %d/%d grup" % (n + 1, (len(qid_ad) + 49) // 50))
            json_yaz(ILERLEME, durum)
    json_yaz(ILERLEME, durum)

    # --- 5b: goruntulenme (REST, paralel ama nazik: 6 is parcacigi) ---
    bas, bit = _pv_aralik()
    isler = []
    for a in adlar:
        k = tn.setdefault(a, {})
        if "en" not in k:
            isler.append((a, "en", "en.wikipedia", esles[a]["baslik"]))
        trw = (wd.get(esles[a]["qid"]) or {}).get("trwiki")
        if "tr" not in k:
            if trw:
                isler.append((a, "tr", "tr.wikipedia", trw))
            else:
                k["tr"] = 0
    log("ASAMA 5b: %d goruntulenme sorgusu (%s - %s)" % (len(isler), bas, bit))
    yerel = threading.local()
    kilit = threading.Lock()
    sayac = {"n": 0}

    def oturum():
        s = getattr(yerel, "s", None)
        if s is None:
            s = requests.Session()
            s.headers.update({"User-Agent": UA})
            yerel.s = s
        return s

    def is_yap(it):
        a, dil, proje, baslik = it
        url = PV_URL % (proje, quote(baslik.replace(" ", "_"), safe=""), bas, bit)
        bekle = 2
        toplam = 0
        for _ in range(6):
            try:
                r = oturum().get(url, timeout=30)
            except requests.RequestException:
                time.sleep(bekle); bekle = min(bekle * 2, 60); continue
            if r.status_code == 404:
                toplam = 0; break
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(bekle); bekle = min(bekle * 2, 60); continue
            try:
                toplam = sum(int(x.get("views", 0)) for x in r.json().get("items", []))
            except ValueError:
                toplam = 0
            break
        time.sleep(0.15)
        with kilit:
            tn.setdefault(a, {})[dil] = toplam
            sayac["n"] += 1
            if sayac["n"] % 2000 == 0:
                log("    %d/%d sorgu" % (sayac["n"], len(isler)))
                json_yaz(ILERLEME, durum)

    with ThreadPoolExecutor(max_workers=6) as havuz:
        list(havuz.map(is_yap, isler))
    json_yaz(ILERLEME, durum)
    log("ASAMA 5 BITTI")


# ============================================================ CIKTI
def cikti_yaz(durum, oyuncular):
    esles = durum.get("qid", {})
    wd = durum.get("wd", {})
    kupa = durum.get("kupa", {})
    oyuncu = {}
    for p in oyuncular:
        ad = p["name"]
        e = esles.get(ad)
        if not e:
            continue
        kayit = {"qid": e["qid"], "wp": e["baslik"]}
        if wd.get(e["qid"]):
            kayit.update(wd[e["qid"]])
        if ad in kupa:
            kayit["kupalar"] = kupa[ad]
        if ad in durum.get("infobox", {}):
            kayit["guncel"] = durum["infobox"][ad]
        if ad in durum.get("tanin", {}):
            kayit["tanin"] = durum["tanin"][ad]
        oyuncu[ad] = kayit
    json_yaz(CIKTI, {
        "surum": 1,
        "tarih": time.strftime("%Y-%m-%d %H:%M"),
        "oyuncu": oyuncu,
        "etiket": durum.get("etiket", {}),
    })
    log("CIKTI YAZILDI: %s (%d oyuncu)" % (CIKTI, len(oyuncu)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--asama", type=int, default=0, help="sadece bu asama (1-5); 0 = hepsi")
    ap.add_argument("--kupa-limit", type=int, default=20000, help="kupa bolumu okunacak en populer oyuncu sayisi (0 = hepsi)")
    a = ap.parse_args()

    os.makedirs(VERI, exist_ok=True)
    oyuncular = json_oku(PLAYERS_YOLU, [])
    if not oyuncular:
        print("lib/players.json okunamadi"); return 1
    dogum = json_oku(BIRTH_YOLU, {})
    pop = json_oku(POP_YOLU, {})
    durum = json_oku(ILERLEME, {})
    ist = Istemci()
    basla = time.time()
    log("=== BASLADI: %d oyuncu ===" % len(oyuncular))
    try:
        if a.asama in (0, 1):
            asama1(ist, durum, oyuncular, dogum)
        if a.asama in (0, 2):
            asama2(ist, durum)
        cikti_yaz(durum, oyuncular)
        if a.asama in (0, 3):
            asama3(ist, durum, oyuncular, pop, a.kupa_limit)
            cikti_yaz(durum, oyuncular)
        if a.asama in (0, 4):
            asama4(ist, durum, oyuncular, json_oku(YILLAR_YOLU, {}))
        if a.asama in (0, 5):
            asama5(ist, durum, oyuncular)
        cikti_yaz(durum, oyuncular)
    except KeyboardInterrupt:
        log("Durduruldu — ilerleme kaydediliyor. Ayni komutla devam edebilirsin.")
        json_yaz(ILERLEME, durum)
        cikti_yaz(durum, oyuncular)
        return 1
    except Exception:
        log("BEKLENMEYEN HATA — ilerleme kaydedildi. Ayni komutu tekrar calistir.\n" + traceback.format_exc())
        json_yaz(ILERLEME, durum)
        return 1
    log("=== HEPSI BITTI (%.0f dk) ===" % ((time.time() - basla) / 60))
    return 0


if __name__ == "__main__":
    sys.exit(main())
