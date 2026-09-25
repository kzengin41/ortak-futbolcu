# -*- coding: utf-8 -*-
"""
OYUNCU ÖNCELİK SIRASI — script'lerin ORTAK yardımcı modülü.

NİYE VAR (11 Eylül 2026): Bütün veri script'leri "popülerlik sırasıyla
işle" diyordu ve lib/playerPopularity.json'a bakıyordu. O dosya ÇÖP:
46.390 oyuncunun sadece 77'si için puan içeriyor (Del Piero dahil herkes 0).
Sonuç: script'ler aslında RASTGELE sırada ilerliyordu — uyruk backfill'i
15.707 oyuncu işledi ama Sacha Boey, Osimhen, Kerem Aktürkoğlu'nu atladı.

Bu modül oyunun KENDİ mantığını (lib/clubWeights.js -> playerWeight)
Python'da yeniden üretiyor: kulüp şöhreti × güncellik. Wikipedia
görüntülenmesine hiç bakmıyor.

    from oncelik import oncelik_sirala
    for ad in oncelik_sirala(players):   # en "akla gelen"den başlayarak
        ...
"""

import datetime
import json
import os
import re

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLUBWEIGHTS_JS = os.path.join(KOK, "lib", "clubWeights.js")
YEARS_JSON = os.path.join(KOK, "lib", "playerYears.json")

AGIRLIK_MEGA, AGIRLIK_BUYUK, AGIRLIK_BILINEN, AGIRLIK_VARSAYILAN = 9.0, 5.0, 2.5, 1.0
BU_YIL = datetime.date.today().year


def _dizi_oku(js, ad):
    """clubWeights.js icindeki `export const AD = [...]` dizisini okur."""
    m = re.search(r"(?:export\s+)?const\s+%s\s*=\s*\[(.*?)\]" % re.escape(ad), js, re.S)
    if not m:
        return []
    return re.findall(r'"([^"]*)"', m.group(1))


def _normalize_kulup(n):
    n = n.replace("İ", "i").replace("I", "ı").lower()
    n = re.sub(r"\s+(j\.?\s?k\.?|s\.?\s?k\.?|f\.?\s?k\.?|a\.?\s?ş\.?|gsk|f\.?\s?c\.?|c\.?\s?f\.?|a\.?\s?f\.?\s?c\.?)\.?$", "", n)
    return n.strip()


def kulup_agirliklari():
    try:
        js = open(CLUBWEIGHTS_JS, encoding="utf-8").read()
    except Exception:
        return {}
    a = {}
    for c in _dizi_oku(js, "MEGA"):
        a[_normalize_kulup(c)] = AGIRLIK_MEGA
    for c in _dizi_oku(js, "BIG"):
        a.setdefault(_normalize_kulup(c), AGIRLIK_BUYUK)
    for dizi in ("BIG5_CLUBS", "PREMIER_LEAGUE_CLUBS", "CHAMPIONS_LEAGUE_CLUBS",
                 "TOP2_TIER_CLUBS", "WELL_KNOWN_EXTRA"):
        for c in _dizi_oku(js, dizi):
            a.setdefault(_normalize_kulup(c), AGIRLIK_BILINEN)
    return a


def _guncellik(yil):
    if not yil:
        return 1.0
    yas = BU_YIL - int(yil)
    if yas <= 5:
        return 4.0
    if yas <= 10:
        return 2.2
    if yas <= 15:
        return 1.4
    if yas <= 20:
        return 1.0
    return max(0.02, 0.45 ** ((yas - 20) / 5.0))


def puanlayici():
    """Bir oyuncu sozlugu alip oncelik puani donduren fonksiyon uretir."""
    agirlik = kulup_agirliklari()
    try:
        with open(YEARS_JSON, encoding="utf-8") as f:
            yillar = json.load(f)
    except Exception:
        yillar = {}

    def puan(p):
        en_yuksek = AGIRLIK_VARSAYILAN
        # Son kulup (kronolojik son) ayrica onemli: oyunun kendi puanlamasi da
        # kariyerin EN UNLU kulubune degil GUNCEL kulube agirlik veriyor.
        kulupler = p.get("clubs") or []
        for c in kulupler:
            w = agirlik.get(_normalize_kulup(c), AGIRLIK_VARSAYILAN)
            if w > en_yuksek:
                en_yuksek = w
        if kulupler:
            son = agirlik.get(_normalize_kulup(kulupler[-1]), AGIRLIK_VARSAYILAN)
            en_yuksek = max(en_yuksek, son * 1.5)
        return en_yuksek * _guncellik(yillar.get(p["name"]))

    return puan


def oncelik_sirala(players):
    """players.json listesini oncelik sirasina gore ISIM listesi olarak dondurur."""
    puan = puanlayici()
    return [p["name"] for p in sorted(players, key=lambda p: -puan(p))]
