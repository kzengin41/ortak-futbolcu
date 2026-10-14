"""
TANINIRLIK 2 — futbolcu popülerliğinin TEK hesabı (Paket 29, 14 Ekim 2026)

Kerem: "sen popülerlik işini baştan bir kurgula. iyice iyileştir."
Kararlar (14 Ekim): kitle = Türk futbolsever (tek sezonluk transfer dalgası
törpülensin), 90'lar Türk efsaneleri şimdiki sıralarında kalsın, teknik
direktörler futbolculukları kadar tanınsın.

ESKİDEN: Tanınırlık dört ayrı yerde dört ayrı formülle hesaplanıyordu
(playerFame yüzdeliği, clubWeights'teki kulüp sezgisi, starPlayers elle
listesi, recognitionScore). Türkçe Vikipedi ilgisi %85 ağırlıkla "ya o ya bu"
(max) giriyordu: Fenerbahçe'ye yeni gelen Guendouzi Vinícius'un, söylentisi
çıkan Greenwood De Bruyne'ün önüne geçiyordu. Guardiola, Klopp, Ancelotti
hocalık ünüyle futbolcu olarak ilk 50'deydi. Vikipedi verisi olmayan 3.300
oyuncu ayrı bir sezgiye düşüyordu.

ŞİMDİ: Bu dosya tek hesap. Girdi: veri/ozgecmis_ham.json (Vikipedi/Wikidata:
dil sayısı, son 12 ay İngilizce + Türkçe görüntülenme, kulüp kulüp maç
sayısı, milli maç) + lib/playerProfiles.json (kupalar). Çıktı:
lib/playerFame.json   ad -> [tanınırlık, güncel ilgi, kalıcı ün] (+ 1 = oyunda çıkmasın)
hepsi 0-100 yüzdelik (100 = en tanınan). Oyun her yerde İLK sayıyı kullanır.

  1) DÜNYA ÜNÜ   G = dil·p(dil sayısı) + (1-dil)·p(İngilizce görüntülenme)
  2) TÜRKİYE     Türkçe görüntülenmenin G'yi AŞAN kısmı, tr_agirlik oranında
                 eklenir. Bu artış Türkiye bağıyla (Türk vatandaşı, Türk
                 kulübünde maç) desteklenmiyorsa dalga_torpu kadar kırpılır:
                 söylenti/transfer dalgası tek başına yıldız yapmaz.
  3) KARİYER     K = Σ maç × kulüp prestiji + milli maç + kupalar (ŞL, Dünya
                 Kupası, Avrupa, lig şampiyonlukları, Ballon d'Or…) — kalıcı,
                 haberlerden etkilenmeyen ölçü; kariyer_agirlik oranında katılır.
  4) HOCALAR     Açıklaması "teknik direktör / antrenör" olanlarda hoca_torpu
                 oranında yalnız futbolculuk kariyeri (K) sayılır.
  5) VERİSİZLER  Vikipedi'de bulunamayan oyuncular kulüplerinin prestijinden
                 tahmin edilir, en fazla verisiz_tavan yüzdeliğine çıkar.
  6) ELLE AYAR   scripts/populerlik_ayar.json → "oyuncular": {ad: {...}}
                   {"kademe": +2}   sırasını 2 kademe yükselt (her kademe sırayı
                                    yarıya indirir: 800. → 400. → 200.)
                   {"sira": 150}    tam 150. sıraya koy
                   {"cikar": true}  oyunda hiç çıkmasın
Ayarlar ve ağırlıklar scripts/populerlik_panel.py ile görsel olarak değişir.

KULLANIM
    python scripts/populerlik.py            # hesapla + lib/playerFame.json yaz + paketle
    python scripts/populerlik.py --rapor    # sadece ölç, yazma
"""
import bisect
import json
import math
import os
import re
import subprocess
import sys
import unicodedata

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAM = os.path.join(KOK, "veri", "ozgecmis_ham.json")
OYUNCULAR = os.path.join(KOK, "lib", "players.json")
PROFILLER = os.path.join(KOK, "lib", "playerProfiles.json")
CIKTI = os.path.join(KOK, "lib", "playerFame.json")
AYAR = os.path.join(KOK, "scripts", "populerlik_ayar.json")
STARS = os.path.join(KOK, "lib", "starPlayers.js")

VARSAYILAN = {
    "dil": 0.5,               # dünya ününde dil sayısının (kalıcı) payı; kalanı İngilizce görüntülenme (güncel)
    "tr_agirlik": 0.8,        # Türkçe ilginin dünya ününü aşan kısmının ne kadarı eklensin
    "dalga_torpu": 0.5,       # Türkiye bağı olmayan oyuncuda bu artış ne kadar kırpılsın
    "kariyer_agirlik": 0.1,   # kalıcı kariyer puanının karışımdaki payı
    "hoca_torpu": 0.75,       # hocalarda futbolculuk kariyerinin payı
    "verisiz_tavan": 93.0,    # Vikipedi verisi olmayanlar en fazla bu yüzdelik
}
AYAR_ACIKLAMA = {
    "dil": ("Dil sayısı ↔ İngilizce ilgi", "Dünya ününde kaç dilde Vikipedi sayfası olduğu (kalıcı) ile son 12 ayın İngilizce görüntülenmesi (güncel) arasındaki denge. 1 = yalnız dil sayısı."),
    "tr_agirlik": ("Türkiye ağırlığı", "Türkçe Vikipedi ilgisi dünya ününü aşıyorsa farkın ne kadarı eklensin. 0 = dünya geneli, 1 = tamamen Türk futbolsever."),
    "dalga_torpu": ("Transfer dalgası törpüsü", "Türk kulübünde hiç oynamamış, Türk olmayan oyuncunun Türkiye ilgisi (söylenti, transfer haberi) ne kadar kırpılsın."),
    "kariyer_agirlik": ("Kariyer ağırlığı", "Maç × kulüp prestiji + milli maç + kupalardan gelen kalıcı puanın payı. Yükseldikçe efsaneler çıkar, haber dalgası etkisi azalır."),
    "hoca_torpu": ("Hoca törpüsü", "Teknik direktörlerde ünün ne kadarı futbolculuk kariyerinden sayılsın (Klopp, Ancelotti)."),
    "verisiz_tavan": ("Verisizlerin tavanı", "Vikipedi'de bulunamayan oyuncuların çıkabileceği en yüksek yüzdelik."),
}

# Kupa puanları "prestijli maç" biriminde (bir dev kulüpte ~bir sezon ≈ 100).
KUPA_PUANI = {"ballonDor": 600, "dunyaKupasi": 250, "sampiyonlarLigi": 150, "avrupaSampiyonasi": 150,
              "copaAmerica": 90, "afrikaKupasi": 50, "altinAyak": 60, "golKrali": 40, "avrupaLigi": 40,
              "premierLig": 40, "laLiga": 40, "serieA": 40, "bundesliga": 35, "ligue1": 25, "superLig": 40}
TR_ARTIS_TAVAN = 1.8   # Türkiye ilgisi bir oyuncuyu en fazla ~60 kat öne taşır (log-sıra birimi)
TR_KUCUK_DESTEK = 0.7
HOCA_PAYI = 0.5        # hocanın ünü kariyerinin ~3 katı sıraya kadar dokunulmaz
EMEKLI_PAYI = 1.0      # açıklamasında hoca yazmayan emeklilerde daha geniş pay (efsaneler kaybetmesin)
EMEKLI_YIL = 2021      # bu yıl ve önce bırakmış sayılır
TANIN_HARIC = {"Jason Statham", "Julio Iglesias"}
# starPlayers.js'te olup players.json'daki aynı adlı kaydı BAŞKA biri olanlar (14 Ekim ölçümü):
# "Pelé" kaydı Salgueiros/Porto'lu Portekizli, "Marcelo" kaydı Santos/Wisła/PSV'li.
YANLIS_YILDIZ = {"Pelé", "Marcelo"}
HOCA_RE = re.compile(r"teknik direktör|antrenör|menajer|çalıştırıcı", re.I)
MILLI_RE = re.compile(r"national (association )?football team|national soccer team", re.I)
GENC_RE = re.compile(r"under|u-?\d\d|olympic|women|youth|amateur|\bb team|futsal|beach", re.I)


def oku(yol, varsayilan=None):
    try:
        with open(yol, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        if varsayilan is None:
            raise
        return varsayilan


def yuzdelik(degerler):
    """ad -> değer  ==>  ad -> 0..1 (eşitler aynı yüzdeliği alır)."""
    sirali = sorted(degerler.items(), key=lambda x: x[1])
    n = len(sirali)
    out = {}
    i = 0
    while i < n:
        j = i
        while j + 1 < n and sirali[j + 1][1] == sirali[i][1]:
            j += 1
        p = ((i + j) / 2.0) / max(n - 1, 1)
        for a, _ in sirali[i:j + 1]:
            out[a] = p
        i = j + 1
    return out


def yildiz_listesi():
    """lib/starPlayers.js (elle tutulan yıldız listesi) — yalnız verisiz oyunculara taban."""
    try:
        s = open(STARS, encoding="utf-8").read()
    except FileNotFoundError:
        return {}
    return {a: int(v) for a, v in re.findall(r'"([^"]+)"\s*:\s*(\d+)', s) if a not in YANLIS_YILDIZ}


class Veri:
    """Ağırlıktan bağımsız, bir kez okunan/hesaplanan her şey (panel bunu bellekte tutar)."""

    def __init__(self, kok=KOK):
        ham = oku(os.path.join(kok, "veri", "ozgecmis_ham.json"))
        oyuncular = oku(os.path.join(kok, "lib", "players.json"))
        profiller = oku(os.path.join(kok, "lib", "playerProfiles.json"), {})
        self.etiket = ham.get("etiket") or {}
        self.kulupler = {}
        for p in oyuncular:
            self.kulupler.setdefault(p["name"], []).append(p.get("clubs") or [])
        self.adlar = list(self.kulupler)
        self.profiller = profiller
        hamo = ham.get("oyuncu") or {}

        # Vikipedi verisi olan ("ölçülen") oyuncular — ozgecmis_isle.py'nin eski süzgeciyle aynı:
        # doğrulanmış kariyeri (k) ya da uygulamada en az 2 kulübü olmalı.
        self.ham = {}
        for ad in self.adlar:
            k = hamo.get(ad)
            if not k or ad in TANIN_HARIC or not isinstance(k.get("tanin"), dict):
                continue
            # Profil yoksa Vikipedi kaydı bu oyuncuyla DOĞRULANAMAMIŞ demektir (ör. players.json'daki
            # "Pelé" Portekizli bir adaş, Vikipedi kaydı Brezilyalı Pelé'nin) — ölçülmüş sayılmaz.
            pr = profiller.get(ad)
            if pr is None or not (pr.get("k") or max(len(c) for c in self.kulupler[ad]) >= 2):
                continue
            self.ham[ad] = k
        olc = self.ham
        self.p_sl = yuzdelik({a: k["tanin"].get("sl") or 0 for a, k in olc.items()})
        self.p_en = yuzdelik({a: math.log10(1 + (k["tanin"].get("en") or 0)) for a, k in olc.items()})
        self.p_tr = yuzdelik({a: math.log10(1 + (k["tanin"].get("tr") or 0)) for a, k in olc.items()})
        self.hoca = {a for a, k in olc.items() if HOCA_RE.search(k.get("aciklama_tr") or "")}
        # Bugünkü ilgisi oyunculuğundan gelmiyor olabilecekler: bıraktığı yıl eski, kulübü yok,
        # Türkiye bağı yok (Rob Edwards, Gary O'Neil gibi Türkçe açıklaması olmayan hocalar,
        # yorumcular). Türk efsanelerine dokunulmaz — onları Türk futbolsever zaten tanır.
        yillar = oku(os.path.join(kok, "lib", "playerYears.json"), {})
        self.emekli = {a for a, k in olc.items()
                       if a not in self.hoca and (yillar.get(a) or 9999) <= EMEKLI_YIL
                       and not ((k.get("guncel") or {}).get("durum") == "kulup")}

        # Türkiye bağı: Türk vatandaşı ya da Türk kulübünde/millî takımında maç
        self.tr_bag = {}
        for a, k in olc.items():
            turk = "Q43" in (k.get("uyruk") or [])
            mac = 0.0
            for t in k.get("takimlar") or []:
                e = self.etiket.get(t["q"]) or {}
                if e.get("ulke") == "Q43":
                    mac += t.get("m") if t.get("m") is not None else 15
            self.tr_bag[a] = 1.0 if turk else min(1.0, mac / 80.0)

        # Kulüp prestiji (Wikidata kaydıyla): o kulüpte en az 10 maç oynamış en ünlü 8
        # oyuncunun DÜNYA ünü ortalaması. Ün yüzdelik olduğu için uç sıkışık; prestij
        # ağırlığı -ln(1 - P) ile açılır: Barcelona ~6,5, orta Bundesliga ~4, alt lig ~1.
        G0 = {a: 0.5 * self.p_sl[a] + 0.5 * self.p_en[a] for a in olc}
        uyeler = {}
        for a, k in olc.items():
            for t in k.get("takimlar") or []:
                m = t.get("m")
                if m is not None and m < 10:
                    continue
                uyeler.setdefault(t["q"], set()).add(a)
        self.kulup_w = {}
        for q, s in uyeler.items():
            ust = sorted((G0[a] for a in s), reverse=True)[:8]
            ust += [0.3] * (8 - len(ust))          # az kişilik kulüp şişmesin
            P = sum(ust) / 8
            self.kulup_w[q] = max(0.0, -math.log(1.0005 - P) - 0.5)
        # Uygulamadaki kulüp ADIYLA prestij (verisiz oyuncular için): o adı taşıyan
        # ölçülen oyuncuların en ünlü 8'i.
        ada = {}
        for a in olc:
            for liste in self.kulupler[a][:1]:
                for c in liste:
                    ada.setdefault(c, []).append(G0[a])
        self.kulup_ad_w = {}
        for c, gs in ada.items():
            ust = sorted(gs, reverse=True)[:8]
            ust += [0.3] * (8 - len(ust))
            self.kulup_ad_w[c] = max(0.0, -math.log(1.0005 - sum(ust) / 8) - 0.5)

        # Kariyer puanı (ham)
        kar = {}
        for a, k in olc.items():
            K = 0.0
            for t in k.get("takimlar") or []:
                e = self.etiket.get(t["q"]) or {}
                en = e.get("en") or ""
                m = t.get("m")
                m = 15.0 if m is None else min(float(m), 450.0)
                if MILLI_RE.search(en):
                    if not GENC_RE.search(en):
                        K += m * 6.0              # A milli maç: dev kulüp maçı kadar değerli
                    continue
                # Türk futbolsever bakışı: Türk kulübündeki maç 1,5 kat sayılır
                # (Fenerbahçe'nin 90'lar forveti, Mainz'ın 90'lar orta sahasından tanıdıktır).
                K += m * self.kulup_w.get(t["q"], 0.0) * (1.5 if e.get("ulke") == "Q43" else 1.0)
            for kod, n in ((profiller.get(a) or {}).get("bs") or {}).items():
                K += KUPA_PUANI.get(kod, 20) * n
            kar[a] = math.log10(1 + K)
        self.p_kar = yuzdelik(kar)
        self.kar_ham = kar
        eps = 1.0 / max(len(olc), 1)
        self.L = {ad_: {a: -math.log10(1 - p + eps) for a, p in kaynak.items()}
                  for ad_, kaynak in (("sl", self.p_sl), ("en", self.p_en), ("tr", self.p_tr), ("kar", self.p_kar))}

        # Verisiz oyuncular: kulüp adlarının prestijinden kaba kariyer tahmini
        self.verisiz = [a for a in self.adlar if a not in olc]
        tah = {}
        for a in self.verisiz:
            en_iyi = 0.0
            for liste in self.kulupler[a]:
                ws = sorted((self.kulup_ad_w.get(c, 0.0) for c in liste), reverse=True)
                en_iyi = max(en_iyi, (ws[0] if ws else 0) + 0.5 * (ws[1] if len(ws) > 1 else 0) + 0.1 * len(liste))
            tah[a] = en_iyi
        self.verisiz_ham = tah
        # Ölçülenlerde aynı kaba tahmin → ölçülen tanınırlıkla eşlemek için (kantil eşleme)
        olc_tah = {}
        for a in olc:
            liste = self.kulupler[a][0]
            ws = sorted((self.kulup_ad_w.get(c, 0.0) for c in liste), reverse=True)
            olc_tah[a] = (ws[0] if ws else 0) + 0.5 * (ws[1] if len(ws) > 1 else 0) + 0.1 * len(liste)
        self.olc_tah = olc_tah
        self.yildiz = yildiz_listesi()


def hesapla(v, agirlik=None, oyuncu_ayar=None):
    """Döner: {ad: {"T": tanınırlık 0-100, "G": güncel, "E": kalıcı, "sira": n, "cikar": bool, "neden": [...] }}"""
    w = dict(VARSAYILAN)
    w.update(agirlik or {})
    oyuncu_ayar = oyuncu_ayar or {}
    d, trw, dalga, kw, hw = w["dil"], w["tr_agirlik"], w["dalga_torpu"], w["kariyer_agirlik"], w["hoca_torpu"]

    # Yüzdelikler LOG-SIRA ölçeğine çevrilerek karıştırılır: L = -log10(1 - p).
    # L = 1 → ilk %10, 2 → ilk %1, 3 → ilk %0,1 (~43. sıra), 4,6 → 1.
    # Düz yüzdelik karıştırmak tepede işe yaramıyordu (ilk 500 oyuncunun hepsi
    # 99,x'te sıkışık; bir sinyaldeki küçük düşüş ötekindeki büyük farkı yutuyordu).
    L = v.L
    F, guncel, kalici = {}, {}, {}
    for a in v.ham:
        G = d * L["sl"][a] + (1 - d) * L["en"][a]
        artis = min(TR_ARTIS_TAVAN, max(0.0, L["tr"][a] - G))
        # Destek: Türkiye bağı yoksa (söylenti/transfer haberi) dalga_torpu kadar kırp; dünyada
        # hiç bilinmeyenin Türkiye ilgisi de biraz kırpılır (eski efsaneler yerinde kalsın,
        # 14 Ekim kararı — 16 referans oyuncuyla ayarlandı).
        destek = (1.0 - dalga * (1.0 - v.tr_bag[a])) * (TR_KUCUK_DESTEK + (1 - TR_KUCUK_DESTEK) * min(1.0, G / 2.0))
        f = G + trw * artis * destek
        f = (1 - kw) * f + kw * L["kar"][a]
        if a in v.hoca:
            # Hocalık ünü: futbolculuk kariyerinin söylediğini (kariyer + HOCA_PAYI) aşan kısım
            # hoca_torpu oranında silinir. Kariyeri büyük olan (Guardiola, Beckenbauer) kaybetmez.
            f -= hw * max(0.0, f - (L["kar"][a] + HOCA_PAYI))
        elif a in v.emekli and v.tr_bag[a] < 1:
            f -= hw * max(0.0, f - (L["kar"][a] + EMEKLI_PAYI))
        F[a] = f
        guncel[a] = 0.5 * L["en"][a] + 0.5 * max(L["en"][a], L["tr"][a])
        kalici[a] = 0.6 * L["sl"][a] + 0.4 * L["kar"][a]

    # Verisizler: kaba tahmini ölçülenlerin aynı tahmine göre dağılımıyla eşle, tavanla
    olc_sira = sorted(v.olc_tah.items(), key=lambda x: x[1])
    tahminler = [t for _, t in olc_sira]
    Fler = sorted(F.values())
    tavan_f = Fler[int((len(Fler) - 1) * min(1.0, w["verisiz_tavan"] / 100.0))] if Fler else 0
    # tahmin değeri -> o tahmine sahip ölçülenlerin F medyanı (kantil yerine kaba kova)
    kova = {}
    for a, t in olc_sira:
        kova.setdefault(round(t, 1), []).append(F[a])
    kova_med = {k: sorted(x)[len(x) // 2] for k, x in kova.items()}
    kova_anahtar = sorted(kova_med)
    for a in v.verisiz:
        t = round(v.verisiz_ham[a], 1)
        i = bisect.bisect_left(kova_anahtar, t)
        i = min(i, len(kova_anahtar) - 1)
        f = kova_med[kova_anahtar[i]] * 0.92 if kova_anahtar else 0
        F[a] = min(f, tavan_f)
    # Elle tutulan yıldız listesi (starPlayers.js) yalnız VERİSİZLERE taban: puan 100 → 1. sıra,
    # 92 → ~10., 84 → ~100., 76 → ~1000. (Ronaldo, Luis Suárez gibi Vikipedi'de adaş yüzünden
    # eşleşemeyen yıldızlar.)
    yildizlar = sorted(F.values(), reverse=True)
    for a, puan in v.yildiz.items():
        if a in v.verisiz and a in F:
            hedef_sira = int(10 ** max(0.0, (100 - puan) / 8.0))
            F[a] = max(F[a], yildizlar[min(len(yildizlar) - 1, hedef_sira)] + 1e-6)

    sira = sorted(F, key=lambda a: -F[a])
    # Elle ayarlar sıra üzerinde uygulanır
    sira_no = {a: i for i, a in enumerate(sira)}
    yeni = {}
    for a, ay in oyuncu_ayar.items():
        if a not in sira_no:
            continue
        if ay.get("cikar"):
            yeni[a] = float("inf")                    # en sona; tanınırlığı 0 olur
            continue
        if ay.get("sira"):
            yeni[a] = max(1, int(ay["sira"])) - 1.5      # tam bu sıraya (eşitlikte önde)
        elif ay.get("kademe"):
            yeni[a] = (sira_no[a] + 1) / (2.0 ** float(ay["kademe"])) - 1.5
    if yeni:
        konum = {a: float(i) for a, i in sira_no.items()}
        konum.update(yeni)
        sira = sorted(F, key=lambda a: konum[a])
    n = len(sira)
    sonuc = {}
    for i, a in enumerate(sira):
        ay = oyuncu_ayar.get(a) or {}
        T = 0.0 if ay.get("cikar") else 100.0 * (1 - i / max(n - 1, 1))
        sonuc[a] = {"T": T, "sira": i + 1, "cikar": bool(ay.get("cikar")),
                    "G": guncel.get(a), "E": kalici.get(a), "olculen": a in v.ham}
    # G ve E de yüzdelik (verisizler için T'den türetilir)
    for anahtar, kaynak in (("G", guncel), ("E", kalici)):
        p = yuzdelik(kaynak)
        for a, s in sonuc.items():
            s[anahtar] = 100.0 * p[a] if a in p else s["T"] * 0.9
    return sonuc


def neden(v, a, w=None):
    """Panel için: oyuncunun puanının parçaları (okunur)."""
    w = dict(VARSAYILAN, **(w or {}))
    if a not in v.ham:
        return {"olculen": False, "kulup_tahmini": round(v.verisiz_ham.get(a, 0), 2),
                "yildiz_listesi": v.yildiz.get(a)}
    t = v.ham[a]["tanin"]
    return {"olculen": True, "dil": t.get("sl"), "en": t.get("en"), "tr": t.get("tr"),
            "p_dil": round(100 * v.p_sl[a], 1), "p_en": round(100 * v.p_en[a], 1),
            "p_tr": round(100 * v.p_tr[a], 1), "p_kariyer": round(100 * v.p_kar[a], 1),
            "tr_bag": round(v.tr_bag[a], 2), "hoca": a in v.hoca,
            "emekli": a in v.emekli and v.tr_bag[a] < 1,
            "aciklama": v.ham[a].get("aciklama_tr")}


def ayar_oku():
    a = oku(AYAR, {})
    return dict(VARSAYILAN, **(a.get("agirliklar") or {})), a.get("oyuncular") or {}


def ayar_yaz(agirlik, oyuncular):
    gecici = AYAR + ".tmp"
    with open(gecici, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"agirliklar": {k: agirlik[k] for k in VARSAYILAN},
                   "oyuncular": dict(sorted(oyuncular.items()))}, f, ensure_ascii=False, indent=1)
    os.replace(gecici, AYAR)


def cikti_yaz(sonuc, yol=CIKTI):
    """lib/playerFame.json: ad -> [tanınırlık, güncel, kalıcı] (+1 = oyunda çıkmasın)."""
    out = {}
    for a, s in sonuc.items():
        x = [round(s["T"], 3), round(s["G"], 3), round(s["E"], 3)]
        if s["cikar"]:
            x.append(1)
        out[a] = x
    gecici = yol + ".tmp"
    with open(gecici, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(gecici, yol)
    return len(out)


def paketle():
    subprocess.run([sys.executable, os.path.join(KOK, "scripts", "veri_paketle.py")], cwd=KOK, check=False)


def ana():
    import argparse
    ap = argparse.ArgumentParser(description="Tanınırlık 2 — lib/playerFame.json üretir")
    ap.add_argument("--rapor", action="store_true", help="yalnız ölç, dosya yazma")
    a = ap.parse_args()
    v = Veri()
    agirlik, oyuncular = ayar_oku()
    s = hesapla(v, agirlik, oyuncular)
    ilk = sorted(s, key=lambda x: s[x]["sira"])
    print("Ölçülen %d, verisiz %d, hoca %d" % (len(v.ham), len(v.verisiz), len(v.hoca)))
    print("İlk 40:", ", ".join(ilk[:40]))
    if a.rapor:
        return
    n = cikti_yaz(s)
    print("lib/playerFame.json yazıldı (%d oyuncu). Paketleniyor…" % n)
    paketle()


if __name__ == "__main__":
    ana()
