# -*- coding: utf-8 -*-
"""
Süper Lig şampiyonluğu eki — lib/odulEkleri.json üretir (Paket 43, 29 Ekim 2026).

Sorun: lib/playerAwards.json özgeçmiş verisinden geliyor ve Türk oyuncularda çok
eksik (ör. Uğurcan Çakır — Trabzonspor 2021-22 şampiyonu — hiç ödülü yoktu).
XOX'ta "Trabzonspor × Süper Lig şampiyonu" karesinde doğru cevap reddediliyordu.

Yöntem: playerProfiles.json'daki kariyer dönemleri ([kulüp sırası, başlangıç,
bitiş, maç, gol]) şampiyon tablosuyla karşılaştırılır. Oyuncu, şampiyon kulüpte
(Y-1)/Y sezonunu tam kapsayan bir dönem geçirdiyse (başlangıç <= Y-1 ve
bitiş >= Y) "superLig" eklenir. Bitişi bilinmeyen dönemlere güvenilmez; onlar
için ELLE listesi var. Uygulama bu eki playerAwards.json ile birleştirir
(lib/basarilar.js), yani gece scripti playerAwards'ı yeniden yazsa da ek kaybolmaz.

Çalıştırma (oyuncu listesi paket içinde şifreli olduğu için önce düz JSON'a dök):
  node -e "..."  -> oyuncular.json  ([{name, clubs}, ...])
  python scripts/sampiyon_cikar.py oyuncular.json
"""
import json, sys, os

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Sezon bitiş yılı -> şampiyon (1959 Millî Lig'den 2025-26'ya).
SL = {1959:"Fenerbahçe",1960:"Beşiktaş",1961:"Fenerbahçe",1962:"Galatasaray",1963:"Galatasaray",1964:"Fenerbahçe",1965:"Fenerbahçe",1966:"Beşiktaş",1967:"Beşiktaş",1968:"Fenerbahçe",1969:"Galatasaray",1970:"Fenerbahçe",1971:"Galatasaray",1972:"Galatasaray",1973:"Galatasaray",1974:"Fenerbahçe",1975:"Fenerbahçe",1976:"Trabzonspor",1977:"Trabzonspor",1978:"Fenerbahçe",1979:"Trabzonspor",1980:"Trabzonspor",1981:"Trabzonspor",1982:"Beşiktaş",1983:"Fenerbahçe",1984:"Trabzonspor",1985:"Fenerbahçe",1986:"Beşiktaş",1987:"Galatasaray",1988:"Galatasaray",1989:"Fenerbahçe",1990:"Beşiktaş",1991:"Beşiktaş",1992:"Beşiktaş",1993:"Galatasaray",1994:"Galatasaray",1995:"Beşiktaş",1996:"Fenerbahçe",1997:"Galatasaray",1998:"Galatasaray",1999:"Galatasaray",2000:"Galatasaray",2001:"Fenerbahçe",2002:"Galatasaray",2003:"Beşiktaş",2004:"Fenerbahçe",2005:"Fenerbahçe",2006:"Galatasaray",2007:"Fenerbahçe",2008:"Galatasaray",2009:"Beşiktaş",2010:"Bursaspor",2011:"Fenerbahçe",2012:"Galatasaray",2013:"Galatasaray",2014:"Fenerbahçe",2015:"Galatasaray",2016:"Beşiktaş",2017:"Beşiktaş",2018:"Galatasaray",2019:"Galatasaray",2020:"Başakşehir",2021:"Beşiktaş",2022:"Trabzonspor",2023:"Galatasaray",2024:"Galatasaray",2025:"Galatasaray",2026:"Galatasaray"}

# Kariyer verisi eksik olduğu için çıkarımın bulamadığı, kesin bilinen şampiyonlar.
ELLE = ["Uğurcan Çakır", "Metin Oktay", "Deniz Türüç", "Jimmy Durmaz", "Adem Büyük", "Tarık Çamdal", "Mahmut Tekdemir"]


def main(oyuncu_yolu):
    P = {p["name"]: p for p in json.load(open(oyuncu_yolu, encoding="utf-8"))}
    pr = json.load(open(os.path.join(KOK, "lib/playerProfiles.json"), encoding="utf-8"))
    aw = json.load(open(os.path.join(KOK, "lib/playerAwards.json"), encoding="utf-8"))
    ek = {}
    for ad, p in P.items():
        if "superLig" in (aw.get(ad) or []):
            continue
        for st in (pr.get(ad) or {}).get("k") or []:
            if len(st) < 3 or st[2] is None:
                continue
            kulup = p["clubs"][st[0]] if st[0] < len(p["clubs"]) else None
            if any(c == kulup and st[1] <= y - 1 and st[2] >= y for y, c in SL.items()):
                ek[ad] = ["superLig"]
                break
    for ad in ELLE:
        if ad in P:
            ek[ad] = ["superLig"]
    satirlar = [f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v)}" for k, v in sorted(ek.items())]
    open(os.path.join(KOK, "lib/odulEkleri.json"), "w", encoding="utf-8").write("{\n" + ",\n".join(satirlar) + "\n}\n")
    print(len(ek), "oyuncuya Süper Lig şampiyonluğu eklendi")


if __name__ == "__main__":
    main(sys.argv[1])
