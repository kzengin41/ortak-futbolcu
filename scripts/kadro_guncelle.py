# -*- coding: utf-8 -*-
"""
GÜNCEL KADROLARI WIKIPEDIA'DAN ÇEKİP players.json'u TAZELER.

NEDEN GEREKLİ (7 Eylül 2026, Kerem: "en güncel transferlerin yansımamış
olabileceğine dair şüphelerim var, Leao - Galatasaray var mı mesela"):
Veri setimiz bir Wikipedia dökümünden geliyor ve döküm 2026 yaz transfer
dönemi KAPANMADAN önce alınmış. Doğrulandı: Rafael Leão 30 Ağustos 2026'da
AC Milan'dan Galatasaray'a geçti ama bizim kaydında hâlâ son kulübü AC Milan
görünüyor. Aynı durumda yüzlerce transfer olabilir.

NE YAPAR
--------
1. `scripts/kadro_kulupleri.json` içindeki kulüpler (5 Kulüp havuzu + Süper Lig
   + 5 büyük lig — 140 kulüp) için Wikipedia'daki GÜNCEL KADRO bölümünü okur.
2. Kadrodaki her oyuncuyu bizim `lib/players.json` kaydımızla eşleştirir
   (aksan/büyük-küçük farkı normalize edilerek).
3. Oyuncunun kulüpleri arasında o kulüp YOKSA ekler (mevcut hiçbir şeyi
   silmez, sadece ekler) ve `playerYears.json`'daki "son aktif yıl"ını da
   bu yıla çeker ki popülerlik hesabı güncel olsun.
4. Veri setinde HİÇ olmayan oyuncuları (yeni/genç transferler) ayrı bir
   rapora yazar — onları eklemek ayrı bir karar.
5. Tüm değişiklikleri `kadro_guncelleme_raporu.csv`'ye döker.

KULLANIM
--------
    python scripts/kadro_guncelle.py                 # tüm kulüpler
    python scripts/kadro_guncelle.py --sadece "Galatasaray,Fenerbahçe,AC Milan"
    python scripts/kadro_guncelle.py --deneme        # HİÇBİR ŞEY YAZMAZ, sadece ne olacağını gösterir
    python scripts/kadro_guncelle.py --yeni-ekle     # veri setinde olmayan oyuncuları da EKLER (Deniz Gül gibi)

Önce `--deneme` ile çalıştırıp raporu gözden geçirmen önerilir.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import unicodedata

try:
    import requests
except ImportError:
    print("Bu script `requests` paketine ihtiyaç duyuyor:  pip install requests")
    sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KULUP_LISTESI = os.path.join(KOK, "scripts", "kadro_kulupleri.json")
PLAYERS_YOLU = os.path.join(KOK, "lib", "players.json")
YEARS_YOLU = os.path.join(KOK, "lib", "playerYears.json")
BIRTH_YOLU = os.path.join(KOK, "lib", "playerBirthPosition.json")
RAPOR_YOLU = os.path.join(KOK, "kadro_guncelleme_raporu.csv")
API = "https://en.wikipedia.org/w/api.php"
BU_YIL = time.localtime().tm_year

# Wikipedia'da adı bizim kullandığımızdan farklı olan kulüpler. Arama
# fonksiyonu çoğunu kendi bulur ama bunlar kritik/yanlış eşleşmeye açık.
BASLIK_ESLEME = {
    "Galatasaray": "Galatasaray S.K. (football)",
    "Fenerbahçe": "Fenerbahçe S.K. (football)",
    "Beşiktaş": "Beşiktaş J.K. (football)",
    "Trabzonspor": "Trabzonspor",
    "İstanbul Başakşehir": "İstanbul Başakşehir F.K.",
    "Inter Milan": "Inter Milan",
    "Internazionale": "Inter Milan",
    "AC Milan": "AC Milan",
    "Roma": "AS Roma",
    "AS Roma": "AS Roma",
    "Barcelona": "FC Barcelona",
    "Real Madrid": "Real Madrid CF",
    "Bayern Munich": "FC Bayern Munich",
    "Atlético Madrid": "Atlético Madrid",
    "Paris Saint-Germain": "Paris Saint-Germain F.C.",
    "Marseille": "Olympique de Marseille",
    "Lyon": "Olympique Lyonnais",
    "Monaco": "AS Monaco FC",
    "PSV": "PSV Eindhoven",
    "Ajax": "AFC Ajax",
    "Porto": "FC Porto",
    "Benfica": "S.L. Benfica",
    "Sporting CP": "Sporting CP",
    "Celtic": "Celtic F.C.",
    "Sevilla": "Sevilla FC",
    "Valencia": "Valencia CF",
    "Villarreal": "Villarreal CF",
    "Athletic Bilbao": "Athletic Bilbao",
    "Real Sociedad": "Real Sociedad",
    "Napoli": "S.S.C. Napoli",
    "Lazio": "S.S. Lazio",
    "Fiorentina": "ACF Fiorentina",
    "Atalanta": "Atalanta B.C.",
    "Juventus": "Juventus FC",
    "Schalke 04": "FC Schalke 04",
    "Bayer Leverkusen": "Bayer 04 Leverkusen",
    "Borussia Dortmund": "Borussia Dortmund",
    "RB Leipzig": "RB Leipzig",
    "Boca Juniors": "Boca Juniors",
    "River Plate": "Club Atlético River Plate",
    "Flamengo": "CR Flamengo",
    "Corinthians": "Sport Club Corinthians Paulista",
    "Santos": "Santos FC",
    "Feyenoord": "Feyenoord",
    # 7 Eylül 2026 — doğrudan ad denemesi ŞEHİR/İLÇE makalesine düşen kulüpler:
    "Genoa": "Genoa CFC",
    "Angers": "Angers SCO",
    "Auxerre": "AJ Auxerre",
    "Brest": "Stade Brestois 29",
    "Elche": "Elche CF",
    "Göztepe": "Göztepe S.K.",
    "Gaziantep": "Gaziantep F.K.",
    "Başakşehir": "İstanbul Başakşehir F.K.",
    "Erzurumspor": "Erzurumspor FK",
    "Bournemouth": "AFC Bournemouth",
    "Ajax": "AFC Ajax",
    "Nice": "OGC Nice",
    "Lens": "RC Lens",
    "Lille": "Lille OSC",
    "Reims": "Stade de Reims",
    "Rennes": "Stade Rennais F.C.",
    "Nantes": "FC Nantes",
    "Toulouse": "Toulouse FC",
    "Montpellier": "Montpellier HSC",
    "Strasbourg": "RC Strasbourg Alsace",
    "Le Havre": "Le Havre AC",
    "Levante": "Levante UD",
    "Osasuna": "CA Osasuna",
    "Mallorca": "RCD Mallorca",
    "Las Palmas": "UD Las Palmas",
    "Getafe": "Getafe CF",
    "Girona": "Girona FC",
    "Espanyol": "RCD Espanyol",
    "Celta Vigo": "RC Celta de Vigo",
    "Real Betis": "Real Betis",
    "Rayo Vallecano": "Rayo Vallecano",
    "Torino": "Torino FC",
    "Udinese": "Udinese Calcio",
    "Venezia": "Venezia FC",
    "Monza": "AC Monza",
    "Lecce": "US Lecce",
    "Sassuolo": "US Sassuolo Calcio",
    "Como": "Como 1907",
    "Empoli": "Empoli FC",
    "Cagliari": "Cagliari Calcio",
    "Parma": "Parma Calcio 1913",
    "Pisa": "Pisa SC",
    "Bologna": "Bologna FC 1909",
    "Hellas Verona": "Hellas Verona FC",
    "Union Berlin": "1. FC Union Berlin",
    "Werder Bremen": "SV Werder Bremen",
    "VfL Bochum": "VfL Bochum",
    "VfL Wolfsburg": "VfL Wolfsburg",
    "VfB Stuttgart": "VfB Stuttgart",
    "TSG Hoffenheim": "TSG 1899 Hoffenheim",
    "SC Freiburg": "SC Freiburg",
    "Mainz 05": "1. FSV Mainz 05",
    "Holstein Kiel": "Holstein Kiel",
    "Shakhtar Donetsk": "FC Shakhtar Donetsk",
    "Rizespor": "Çaykur Rizespor",
    "Çaykur Rizespor": "Çaykur Rizespor",
    "Samsunspor": "Samsunspor",
    "Kocaelispor": "Kocaelispor",
    "Sivasspor": "Sivasspor",
    "Kasımpaşa": "Kasımpaşa S.K.",
    "Konyaspor": "Konyaspor",
    "Kayserispor": "Kayserispor",
    "Bodrumspor": "Bodrum F.K.",
    "Amedspor": "Amed S.F.K.",
}


def normalize(s):
    if not s:
        return ""
    s = s.replace("İ", "i").replace("ı", "i").replace("I", "i").lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9\s]", "", s)
    return re.sub(r"\s+", " ", s).strip()


# 26 Eylül 2026 — "Başakşehir" + "İstanbul Başakşehir" iki ayrı takım gibi
# görünüyordu: bu script kadroyu çekerken kulübü kendi listesindeki yazımla
# ekliyordu, oyuncunun kariyerinde ise başka yazım vardı. Artık her yazımdan
# önce lib/clubAliases.js'teki KANONİK ada çevriliyor ve aynı kulüp iki kez
# eklenmiyor.
def _takma_ad_haritasi():
    yol = os.path.join(KOK, "lib", "clubAliases.js")
    harita = {}
    try:
        with open(yol, "r", encoding="utf-8") as f:
            metin = f.read()
        bas = metin.index("CLUB_ALIAS_GROUPS = {")
        son = metin.index("\n};", bas)
        for satir in metin[bas:son].splitlines()[1:]:
            satir = satir.strip().rstrip(",")
            if not satir or satir.startswith("//") or ":" not in satir:
                continue
            kanonik, varyantlar = json.loads("{" + satir + "}").popitem()
            for v in varyantlar:
                harita[v] = kanonik
    except Exception as hata:
        print("UYARI: clubAliases.js okunamadı (%s) — kulüp adları birleştirilmeyecek" % hata)
    return harita


TAKMA_AD = None


def kanonik(kulup):
    global TAKMA_AD
    if TAKMA_AD is None:
        TAKMA_AD = _takma_ad_haritasi()
    return TAKMA_AD.get(kulup, kulup)


MILLI_TAKIM = re.compile(r"national .*team|olympic .*team|\bnational team\b|rugby union team", re.I)


def kulupleri_tekille(liste):
    """Kanonik ada çevirir; aynı kulüp iki kez geçiyorsa SONUNCUSU kalır
    (son kulüp = güncel kulüp bilgisi korunur)."""
    # 28 Eylül 2026: milli takımlar kulüp listesine girmesin (787 oyuncuda vardı, temizlendi)
    yeni = [kanonik(k) for k in liste if not MILLI_TAKIM.search(k)]
    son = {k: i for i, k in enumerate(yeni)}
    return [k for i, k in enumerate(yeni) if son[k] == i]


def json_oku(yol, varsayilan):
    if not os.path.exists(yol):
        return varsayilan
    with open(yol, "r", encoding="utf-8") as f:
        return json.load(f)


def json_yaz(yol, veri):
    gecici = yol + ".tmp"
    with open(gecici, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False)
    os.replace(gecici, yol)


# 7 Eylül 2026 — İLK ÇALIŞTIRMADA 140 kulübün 93'ü "sayfa bulunamadı", geri
# kalanların çoğu da "kadro: 0" verdi. Sebep AYRIŞTIRMA DEĞİLDİ (AC Milan
# makalesinde kadro bölümü fazlasıyla var): istekler arka arkaya çok hızlı
# gidince Wikipedia bir süre 429 (çok fazla istek) döndürüyor, bizim kod da
# tek denemede pes edip sessizce "bulunamadı" diyordu. Üstelik BAŞARISIZ
# turlarda `continue` ile döngü başına dönüldüğü için bekleme de atlanıyordu
# — yani hata arttıkça istek hızı ARTIYORDU (çığ etkisi).
#
# ÇÖZÜM: tek bir istek fonksiyonu; 429/5xx durumunda artan bekleme ile 4 kez
# deneme, Retry-After başlığına saygı, HER istekten sonra nefes payı, ve
# hatanın SEBEBİNİ ekrana yazma (artık "bulunamadı" ile "engellendi" ayrı).
SON_HATA = {"mesaj": ""}


def api_iste(oturum, params, bekleme, deneme=4):
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


def wikitext_getir(oturum, baslik, bekleme=1.0):
    d = api_iste(oturum, {"action": "parse", "page": baslik, "prop": "wikitext",
                          "format": "json", "redirects": 1, "formatversion": 2}, bekleme)
    if not d or "error" in d:
        if d and "error" in d:
            SON_HATA["mesaj"] = "sayfa yok: %s" % d["error"].get("code", "")
        return None
    return d.get("parse", {}).get("wikitext")


def baslik_bul(oturum, kulup, bekleme=1.0):
    """Önce elle eşleme, sonra doğrudan başlık denemeleri, en son arama.

    Doğrudan deneme neden önce: arama uç noktası daha pahalı ve daha sık
    sınırlanıyor; "Arsenal F.C." gibi başlıklar zaten tahmin edilebilir.
    """
    if kulup in BASLIK_ESLEME:
        return BASLIK_ESLEME[kulup]

    adaylar = ["%s F.C." % kulup, "%s FC" % kulup, kulup, "%s (football club)" % kulup]
    d = api_iste(oturum, {"action": "query", "titles": "|".join(adaylar[:4]),
                          "format": "json", "formatversion": 2, "redirects": 1}, bekleme)
    if d:
        sayfalar = d.get("query", {}).get("pages", [])
        var_olanlar = [p["title"] for p in sayfalar if not p.get("missing")]
        # Aday sırasına sadık kal (F.C. > FC > düz ad)
        yonlendirme = {r["from"]: r["to"] for r in d.get("query", {}).get("redirects", [])}
        for aday in adaylar:
            hedef = yonlendirme.get(aday, aday)
            if hedef in var_olanlar:
                return hedef

    d = api_iste(oturum, {"action": "query", "list": "search",
                          "srsearch": "%s football club" % kulup,
                          "format": "json", "formatversion": 2, "srlimit": 3}, bekleme)
    if d:
        sonuc = d.get("query", {}).get("search", [])
        if sonuc:
            return sonuc[0]["title"]
    return None


# {{fs player |no=10 |nat=POR |name=[[Rafael Leão]] |pos=FW}}
# Bazı makaleler `{{fs player}}`, bazıları `{{Football squad player}}` kullanıyor;
# `name=` alanı da düz metin ya da [[link]] olabiliyor — üçünü de karşılıyoruz.
# DİKKAT: `[^}]*?` KULLANMA. Bazı makaleler `|nat={{NED}}` / `{{flagicon|GER}}`
# gibi ŞABLON içeren parametreler yazıyor; "süslü parantez görünce dur" diyen
# bir kalıp bu satırlarda `name=` alanına HİÇ ULAŞAMIYOR ve kadro boş çıkıyor
# (AFC Ajax'ta tam olarak bu oldu: sayfada kadro var ama script 0 buldu).
# Bunun yerine sınırlı uzunlukta serbest eşleşme kullanıyoruz.
FS_PLAYER = re.compile(
    r"\{\{\s*(?:fs\s*player|football\s+squad\s+player)\b.{0,400}?\|\s*name\s*=\s*(\[\[)?([^\]|}\n]+)",
    re.IGNORECASE | re.DOTALL)


def kadro_isimleri(wikitext):
    """Sadece BİRİNCİ kadro: 'Out on loan' / 'Reserve' başlıklarından sonrasını atar."""
    if not wikitext:
        return []
    # Kesme noktasını İLK kadro satırından SONRA arıyoruz: bazı makalelerde
    # "Out on loan" başlığı kadronun ÜSTÜNDE geçebiliyor ve baştan kesince
    # kadronun tamamı uçuyordu.
    ilk = FS_PLAYER.search(wikitext)
    basla = ilk.start() if ilk else 0
    kesme = re.search(r"==+\s*(Out on loan|Players out on loan|Reserve team|Academy|Former players)\s*==+",
                      wikitext[basla:], re.IGNORECASE)
    govde = wikitext[: basla + kesme.start()] if kesme else wikitext
    isimler = []
    for m in FS_PLAYER.finditer(govde):
        ad = m.group(2).strip()
        # [[Ad|Görünen]] biçiminde link hedefi alınıyor; parantezli ayraçları temizle
        ad = re.sub(r"\s*\(footballer.*?\)\s*$", "", ad, flags=re.IGNORECASE).strip()
        if ad:
            isimler.append(ad)
    return isimler


# 7 Eylül 2026 (Kerem: "Deniz Gül Porto'dan Galatasaray'a geldi, o yazmıyor,
# veri setinde yok dedi") — kadroda olup veri setimizde HİÇ bulunmayan
# oyuncular artık istenirse Wikipedia makalelerinden KARİYERİYLE BİRLİKTE
# eklenebiliyor. Bunun için oyuncu sayfasındaki
# {{Infobox football biography}} kutusundaki clubs1/clubs2... alanları
# sırayla okunuyor (kiralık dönemler "→ X (loan)" biçiminde geçiyor, temizleniyor).
INFOBOX_POS = re.compile(r"^\s*\|\s*position\s*=\s*(.*)$", re.IGNORECASE | re.MULTILINE)
INFOBOX_BIRTH = re.compile(r"birth[_ ]date[^\n]*?(\d{4})", re.IGNORECASE)


def _alan_degerleri(wikitext, alan_adi):
    """Infobox'taki `| clubs1 = ...` gibi alanları sıra numarasıyla döndürür.

    DİKKAT: değer içinde `[[FC Porto|Porto]]` gibi BORU İŞARETİ olabilir —
    bu yüzden satırı düz `|` ile bölmek YANLIŞ olur (ilk denemede "[[FC Porto"
    gibi yarım isimler çıkmıştı). Aşağıdaki tarayıcı köşeli parantez ve süslü
    parantez derinliğini sayarak sadece EN DIŞ seviyedeki `|` işaretinde
    değeri bitiriyor.
    """
    sonuc = {}
    kalip = re.compile(r"\|\s*%s(\d+)\s*=" % alan_adi, re.IGNORECASE)
    for m in kalip.finditer(wikitext):
        i = m.end()
        derinlik_k = derinlik_s = 0
        parcalar = []
        while i < len(wikitext):
            c = wikitext[i]
            if wikitext.startswith("[[", i):
                derinlik_k += 1; parcalar.append("[["); i += 2; continue
            if wikitext.startswith("]]", i):
                derinlik_k -= 1; parcalar.append("]]"); i += 2; continue
            if wikitext.startswith("{{", i):
                derinlik_s += 1; parcalar.append("{{"); i += 2; continue
            if wikitext.startswith("}}", i):
                if derinlik_s == 0:
                    break
                derinlik_s -= 1; parcalar.append("}}"); i += 2; continue
            if c == "\n" and derinlik_k <= 0 and derinlik_s <= 0:
                break
            if c == "|" and derinlik_k <= 0 and derinlik_s <= 0:
                break
            parcalar.append(c); i += 1
        sonuc[int(m.group(1))] = "".join(parcalar).strip()
    return sonuc


def _kulup_adaylari(ham):
    """`→ [[FC Porto|Porto]] (loan)` -> ("Porto", "FC Porto") gibi aday isimler."""
    ad = ham.replace("→", " ")
    ad = re.sub(r"\(loan\)", "", ad, flags=re.IGNORECASE)
    ad = re.sub(r"\{\{[^}]*\}\}", "", ad)
    ad = re.sub(r"<[^>]+>", "", ad)
    ad = re.sub(r"''+", "", ad)
    link = re.search(r"\[\[([^\]]+)\]\]", ad)
    adaylar = []
    if link:
        ic = link.group(1)
        if "|" in ic:
            hedef, etiket = ic.split("|", 1)
            adaylar += [etiket.strip(), hedef.strip()]
        else:
            adaylar.append(ic.strip())
    else:
        adaylar.append(re.sub(r"[\[\]]", "", ad).strip())
    temiz = []
    for x in adaylar:
        x = re.sub(r"\s*\(footballer.*?\)\s*$", "", x, flags=re.IGNORECASE).strip(" \t,;")
        if x and not re.match(r"^(total|career total)$", x, re.IGNORECASE):
            temiz.append(x)
    return temiz


def oyuncu_kariyeri(oturum, isim, bilinen_kulupler=None, bekleme=1.0):
    """Wikipedia makalesinden (kulüpler, doğum yılı, pozisyon, son yıl) çıkarır.

    `bilinen_kulupler` verilirse, `[[FC Porto|Porto]]` gibi iki adaylı
    durumlarda BİZİM veri setimizde geçen yazım tercih edilir — böylece yeni
    oyuncunun kulüpleri mevcut kayıtlarla aynı isimle eşleşir.
    """
    wt = wikitext_getir(oturum, isim, bekleme)
    if not wt:
        return None
    if "infobox football biography" not in wt.lower():
        return None

    kulupler_ham = _alan_degerleri(wt, "clubs")
    yillar = _alan_degerleri(wt, "years")
    if not kulupler_ham:
        return None

    sirali = []
    for k in sorted(kulupler_ham):
        adaylar = _kulup_adaylari(kulupler_ham[k])
        if not adaylar:
            continue
        secim = adaylar[0]
        if bilinen_kulupler:
            for aday in adaylar:
                if aday in bilinen_kulupler:
                    secim = aday
                    break
        secim = kanonik(secim)
        if secim not in sirali:
            sirali.append(secim)
    if not sirali:
        return None

    tum_yillar = [int(y) for y in re.findall(r"(19\d{2}|20\d{2})", " ".join(yillar.values()))]
    son_yil = max(tum_yillar) if tum_yillar else None
    if yillar:
        son_alan = yillar[max(yillar)]
        if re.search(r"(–|—|-)\s*$", son_alan):
            son_yil = BU_YIL   # "2026–" açık uçlu: hâlâ oynuyor

    pos = INFOBOX_POS.search(wt)
    pozisyon = None
    if pos:
        pa = _kulup_adaylari(pos.group(1))
        pozisyon = pa[0] if pa else None
    dogum = INFOBOX_BIRTH.search(wt)
    return {
        "clubs": sirali,
        "position": pozisyon,
        "birthYear": int(dogum.group(1)) if dogum else None,
        "lastYear": son_yil,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sadece", default="", help="Sadece bu kulüpler (virgülle ayır)")
    ap.add_argument("--bekleme", type=float, default=1.2, help="İstekler arası bekleme (saniye)")
    ap.add_argument("--deneme", action="store_true", help="Hiçbir dosyayı DEĞİŞTİRME, sadece raporla")
    ap.add_argument("--yeni-ekle", dest="yeni_ekle", action="store_true",
                    help="Veri setinde HİÇ olmayan kadro oyuncularını Wikipedia'dan kariyeriyle birlikte EKLE")
    a = ap.parse_args()

    kulupler = list(dict.fromkeys(kanonik(k) for k in json_oku(KULUP_LISTESI, [])))
    if a.sadece:
        istenen = {k.strip() for k in a.sadece.split(",") if k.strip()}
        kulupler = [k for k in kulupler if k in istenen] or list(istenen)
    if not kulupler:
        print("Kulüp listesi boş: %s" % KULUP_LISTESI)
        sys.exit(1)

    players = json_oku(PLAYERS_YOLU, [])
    years = json_oku(YEARS_YOLU, {})
    birth = json_oku(BIRTH_YOLU, {})
    ad_index = {}
    for p in players:
        ad_index.setdefault(normalize(p["name"]), p)

    # Veri setinde GEÇEN tüm kulüp adları — yeni oyuncunun kulüplerini
    # mevcut yazımlarla hizalamak için.
    bilinen_kulupler = set()
    for p in players:
        bilinen_kulupler.update(p.get("clubs") or [])

    oturum = requests.Session()
    oturum.headers.update({"User-Agent": "OrtakFutbolcuBot/1.0 (kisisel mobil oyun projesi; kadro guncelleme) python-requests",
                           "Accept-Encoding": "gzip"})

    eklenen, bulunamayan, kulupsuz, yeni_oyuncular = [], [], [], []
    for i, kulup in enumerate(kulupler, 1):
        baslik = baslik_bul(oturum, kulup, a.bekleme)
        if not baslik:
            kulupsuz.append(kulup)
            print("  [%d/%d] %-28s -> sayfa bulunamadı (%s)"
                  % (i, len(kulupler), kulup, SON_HATA["mesaj"] or "arama sonuç vermedi"))
            continue

        wt = wikitext_getir(oturum, baslik, a.bekleme)
        # Doğrudan başlık tahmini bazen ŞEHRE/İLÇEYE götürüyor ("Brest",
        # "Genoa", "Göztepe", "Gaziantep"...). Kulüp makalesi değilse aramayla
        # tekrar dene.
        if wt is not None and "infobox football club" not in wt.lower():
            d = api_iste(oturum, {"action": "query", "list": "search",
                                  "srsearch": "%s football club squad" % kulup,
                                  "format": "json", "formatversion": 2, "srlimit": 3}, a.bekleme)
            for aday in (d or {}).get("query", {}).get("search", []):
                alt = wikitext_getir(oturum, aday["title"], a.bekleme)
                if alt and "infobox football club" in alt.lower():
                    baslik, wt = aday["title"], alt
                    break
        if wt is None:
            kulupsuz.append(kulup)
            print("  [%d/%d] %-28s -> sayfa OKUNAMADI (%s) | başlık: %s"
                  % (i, len(kulupler), kulup, SON_HATA["mesaj"] or "bilinmeyen", baslik))
            continue
        isimler = kadro_isimleri(wt)
        if not isimler:
            print("  [%d/%d] %-28s -> sayfa okundu ama KADRO ŞABLONU YOK (%s)"
                  % (i, len(kulupler), kulup, baslik))
        yeni = 0
        yeni_kayit = 0
        for isim in isimler:
            p = ad_index.get(normalize(isim))
            if not p:
                if not a.yeni_ekle:
                    bulunamayan.append([kulup, isim])
                    continue
                bilgi = oyuncu_kariyeri(oturum, isim, bilinen_kulupler, a.bekleme)
                if not bilgi:
                    bulunamayan.append([kulup, isim])
                    continue
                kl = list(bilgi["clubs"])
                if kulup not in kl:
                    kl.append(kulup)
                p = {"name": isim, "clubs": kl}
                players.append(p)
                ad_index[normalize(isim)] = p
                if bilgi.get("lastYear"):
                    years[isim] = bilgi["lastYear"]
                if bilgi.get("birthYear") or bilgi.get("position"):
                    birth[isim] = {k: v for k, v in
                                   (("birthYear", bilgi.get("birthYear")), ("position", bilgi.get("position")))
                                   if v}
                yeni_oyuncular.append([isim, kulup, " | ".join(kl)])
                yeni_kayit += 1
                continue
            if kulup not in {kanonik(c) for c in p["clubs"]}:
                p["clubs"].append(kulup)
                # Kadroda olduğuna göre bu sezon aktif:
                if years.get(p["name"], 0) < BU_YIL:
                    years[p["name"]] = BU_YIL
                eklenen.append([p["name"], kulup, " | ".join(p["clubs"])])
                yeni += 1
        if isimler:
            print("  [%d/%d] %-28s kadro:%3d  kulüp eklendi:%2d  yeni oyuncu:%2d  (sayfa: %s)"
                  % (i, len(kulupler), kulup, len(isimler), yeni, yeni_kayit, baslik))

        # Uzun süren çalışmalarda (özellikle --yeni-ekle ile) yarıda kesilirse
        # emek boşa gitmesin diye her 10 kulüpte bir ara kayıt.
        if not a.deneme and i % 10 == 0:
            for _p in players:
                _p["clubs"] = kulupleri_tekille(_p.get("clubs") or [])
            json_yaz(PLAYERS_YOLU, players)
            json_yaz(YEARS_YOLU, years)
            json_yaz(BIRTH_YOLU, birth)

    print("\nÖZET")
    print("  players.json'a eklenen kulüp kaydı : %d" % len(eklenen))
    print("  YENİ eklenen oyuncu                : %d" % len(yeni_oyuncular))
    print("  veri setinde HİÇ olmayan oyuncu    : %d%s" % (len(bulunamayan),
          "  (--yeni-ekle ile eklenebilir)" if not a.yeni_ekle else "  (Wikipedia'da kariyeri okunamadı)"))
    print("  sayfası bulunamayan kulüp          : %d" % len(kulupsuz))

    with open(RAPOR_YOLU, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["tip", "oyuncu", "kulup", "detay"])
        for ad, kulup, hepsi in eklenen:
            w.writerow(["kulup eklendi", ad, kulup, hepsi])
        for ad, kulup, hepsi in yeni_oyuncular:
            w.writerow(["YENI OYUNCU", ad, kulup, hepsi])
        for kulup, isim in bulunamayan:
            w.writerow(["veri setinde yok", isim, kulup, ""])
        for kulup in kulupsuz:
            w.writerow(["sayfa bulunamadi", "", kulup, ""])
    print("  rapor: %s" % RAPOR_YOLU)

    if a.deneme:
        print("\n--deneme modu: hiçbir dosya değiştirilmedi.")
        return

    for _p in players:
        _p["clubs"] = kulupleri_tekille(_p.get("clubs") or [])
    json_yaz(PLAYERS_YOLU, players)
    json_yaz(YEARS_YOLU, years)
    json_yaz(BIRTH_YOLU, birth)
    print("\nplayers.json, playerYears.json ve playerBirthPosition.json güncellendi.")


if __name__ == "__main__":
    main()
