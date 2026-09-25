# -*- coding: utf-8 -*-
"""
KADRO GÜNCELLEMESİNDEN SONRA VERİ TEMİZLİĞİ.

NİYE GEREKLİ (7 Eylül 2026): Kadro güncellemesi kulüpleri BİZİM listemizdeki
adla ekliyor ("Auxerre", "Başakşehir"), ama aynı oyuncunun kaydında Wikipedia
kaynaklı FARKLI bir yazım zaten olabiliyor ("AJ Auxerre", "İstanbul
Başakşehir"). Sonuç: tek bir kulüp, aynı oyuncuda İKİ AYRI kulüp gibi
görünüyor — "5 Kulüp" modunda yanlış puanlamaya yol açar.
(Rapordan gerçek örnekler: Wei Xiangxin -> "AJ Auxerre" + "Auxerre",
 Volkan Babacan -> "İstanbul Başakşehir" + "Başakşehir".)

Ayrıca eski Wikipedia dökümünden kalma birkaç bozuk kulüp adı var
("[[Guangdong Hongyuan F.C.|Guang" gibi yarım linkler, "Total" satırları).

BU SCRIPT NE YAPAR
1. Bozuk kulüp adlarını onarır ([[X|Y]] -> Y, yarım kalanları toparlar,
   "Total"/"Career total" gibi tablo artıklarını siler).
2. AYNI OYUNCUDA aynı kulübün iki yazımını tespit eder. Ölçüt: biri
   diğerinin kelime alt kümesiyse ("auxerre" ⊂ "aj auxerre"). İkisinden
   VERİ SETİNDE DAHA YAYGIN olanı tutar, diğerini siler.
3. B takımı / altyapı / kadın takımı gibi GERÇEKTEN ayrı takımları
   birleştirmez ("Porto" ile "Porto B" ayrı kalır).

KULLANIM
    python scripts/temizlik.py --deneme    # sadece ne yapacağını göster
    python scripts/temizlik.py             # uygula
Çıktı raporu: temizlik_raporu.csv
"""

import argparse
import collections
import csv
import json
import os
import re
import unicodedata

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYERS_YOLU = os.path.join(KOK, "lib", "players.json")
RAPOR = os.path.join(KOK, "temizlik_raporu.csv")

# 11 Eylül 2026 — İLK --deneme RAPORUNU İNCELEDİM, KURAL FAZLA CESURDU.
# "Bir ad diğerinin kelime alt kümesiyse aynı kulüptür" varsayımı şu yanlış
# birleştirmeleri üretiyordu:
#   "Strømsgodset 2"  -> "Strømsgodset"   (2 = REZERV TAKIM, ayrı takım!)
#   "Hurst Albion"    -> "Hurst"          (farklı kulüpler olabilir)
# Bu yüzden mantık TERSİNE çevrildi: artık varsayılan BİRLEŞTİRMEMEK.
# Sadece FAZLADAN olan kelimelerin HEPSİ "kulüp adı gürültüsü" listesindeyse
# birleştiriliyor (FC/AC/SC/CF/Kulübü/Calcio/kuruluş yılı/şehir öneki gibi).
# "united", "city", "albion", "2", "B", "II" gibi AYIRT EDİCİ kelimeler bu
# listede YOK — o çiftler olduğu gibi bırakılıyor ve raporda ayrı bir
# "birleştirilmedi (şüpheli)" satırı olarak listeleniyor ki gözden geçirebil.
GURULTU_KELIMELER = {
    # kurumsal/hukuki kısaltmalar
    "fc", "afc", "cf", "cfc", "sc", "ac", "as", "ss", "ssc", "sk", "jk", "fk", "sfk",
    "rc", "rcd", "cd", "ud", "ca", "cr", "sl", "bc", "sv", "vfb", "vfl", "tsg", "psv",
    "club", "clube", "calcio", "futebol", "futbol", "football", "kulubu", "kulübü",
    "spor", "sportif", "sportive", "associacao", "associação", "asociacion",
    "olympique", "olimpique", "real", "de", "del", "della", "di", "da", "do",
    "des", "la", "le", "el", "los", "las", "ve", "and", "the",
    # şehir önekleri ve kalan kulüp kısaltmaları — bunlar olmadan asıl
    # hedefimiz olan çiftler ("İstanbul Başakşehir" / "Başakşehir",
    # "AJ Auxerre" / "Auxerre") şüpheli listesinde kalıyordu.
    "aj", "ogc", "us", "acf", "asd", "ssd", "fsv", "stade", "istanbul",
    "sd", "ad", "cs", "ec", "se", "gd", "cp", "rs", "rsc", "kv", "kaa", "kvc",
}
# BİLEREK LİSTEDE YOK (ikinci --deneme turunda yakaladığım yanlış eşleşmeler):
#   "atletico"/"athletic" -> "Sevilla Atlético" Sevilla'nın B TAKIMI, ayrı takım
#   "deportivo"           -> "Xerez Deportivo" ile "Xerez" FARKLI kulüpler
#   "1"                   -> "Dnipro-1" ile "Dnipro" FARKLI kulüpler
#   "sporting"/"sociedad" -> ayırt edici olabiliyor, riske girmiyoruz
YIL = __import__("re").compile(r"^(18|19|20)\d{2}$")


def _birlesebilir(fark_kelimeler):
    """Fazladan kelimelerin HEPSİ gürültüyse True."""
    if not fark_kelimeler:
        return False
    for k in fark_kelimeler:
        if k in GURULTU_KELIMELER or YIL.match(k):
            continue
        return False
    return True


def normalize(s):
    s = s.replace("İ", "i").replace("ı", "i").replace("I", "i").lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def kulup_onar(ad):
    """Bozuk wikitext artıklarını temizler; onarılamıyorsa None döner."""
    if not ad or not ad.strip():
        return None
    t = ad.strip()
    if re.match(r"^(total|career total)$", t, re.IGNORECASE):
        return None
    m = re.search(r"\[\[([^\]|]+)\|([^\]]*)\]\]", t)          # [[Hedef|Etiket]]
    if m:
        t = (m.group(2) or m.group(1)).strip()
    elif "[[" in t:                                            # yarım kalmış link
        ic = t.split("[[", 1)[1]
        ic = ic.split("]]", 1)[0]
        parcalar = ic.split("|")
        # Etiket yarım kalmış olabilir ("[[Guangdong Hongyuan F.C.|Guang");
        # bu durumda TAM olan hedef adı daha güvenli.
        t = parcalar[0].strip()
    t = re.sub(r"\{\{[^}]*\}?\}?", "", t)
    t = t.replace("[[", "").replace("]]", "").strip(" \t|,;")
    return t or None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--deneme", action="store_true", help="Hiçbir şey yazma, sadece raporla")
    a = ap.parse_args()

    with open(PLAYERS_YOLU, encoding="utf-8") as f:
        players = json.load(f)

    # Hangi yazım daha yaygın? Bütün veri setinde say.
    sayac = collections.Counter()
    for p in players:
        for c in p.get("clubs") or []:
            sayac[c] += 1

    onarim, birlesme, supheli = [], [], []
    for p in players:
        eski = list(p.get("clubs") or [])

        # 1) onarım + birebir tekrar temizliği
        yeni = []
        for c in eski:
            d = kulup_onar(c)
            if d is None:
                onarim.append([p["name"], c, "(silindi)"])
                continue
            if d != c:
                onarim.append([p["name"], c, d])
            if d not in yeni:
                yeni.append(d)

        # 2) aynı kulübün iki farklı yazımı
        silinecek = set()
        for i in range(len(yeni)):
            for j in range(i + 1, len(yeni)):
                a1, a2 = yeni[i], yeni[j]
                if a1 in silinecek or a2 in silinecek:
                    continue
                n1, n2 = normalize(a1), normalize(a2)
                if not n1 or not n2 or n1 == n2:
                    continue
                k1, k2 = set(n1.split()), set(n2.split())
                kucuk, buyuk = (k1, k2) if len(k1) < len(k2) else (k2, k1)
                if not kucuk or not kucuk.issubset(buyuk):
                    continue
                fark = buyuk - kucuk
                if not _birlesebilir(fark):
                    # Şüpheli: aynı kulüp olabilir ama emin değiliz (rezerv takım,
                    # "Albion"/"United" gibi ayırt edici ek...). DOKUNMUYORUZ.
                    supheli.append([p["name"], a1, a2])
                    continue
                tutulan, atilan = (a1, a2) if sayac[a1] >= sayac[a2] else (a2, a1)
                silinecek.add(atilan)
                birlesme.append([p["name"], atilan, tutulan])

        yeni = [c for c in yeni if c not in silinecek]
        if not a.deneme:
            p["clubs"] = yeni

    print("Onarılan/silinen bozuk kulüp adı : %d" % len(onarim))
    print("Birleştirilen çift yazım         : %d" % len(birlesme))
    print("Şüpheli, DOKUNULMADI              : %d  (raporda listeli)" % len(supheli))
    for satir in birlesme[:10]:
        print("   %-24s %s  ->  %s" % (satir[0][:24], satir[1], satir[2]))

    with open(RAPOR, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["tip", "oyuncu", "eski", "yeni"])
        for s in onarim:
            w.writerow(["bozuk ad onarildi"] + s)
        for s in birlesme:
            w.writerow(["cift yazim birlestirildi"] + s)
        for s in supheli:
            w.writerow(["supheli - dokunulmadi"] + s)
    print("Rapor: %s" % RAPOR)

    if a.deneme:
        print("\n--deneme modu: players.json DEĞİŞTİRİLMEDİ.")
        return

    gecici = PLAYERS_YOLU + ".tmp"
    with open(gecici, "w", encoding="utf-8") as f:
        json.dump(players, f, ensure_ascii=False)
    os.replace(gecici, PLAYERS_YOLU)
    print("players.json güncellendi.")


if __name__ == "__main__":
    main()
