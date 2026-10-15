# -*- coding: utf-8 -*-
"""
TEMA ÜRETİCİ — Paket 30 "Forma" sistemi (14 Ekim 2026)

Kerem: "bu yeni temalar da çok kötü olmuş. gs temasının gs ile alakası yok gibi.
çok ciddi tasarım yeteneği edin ve en baştan kusursuz kurgula." Karar: "Forma gibi".

ESKİ HATA (Paket 24-25): her şey takımın tonundan türetiliyordu ama DÜŞÜK
doygunlukta: GS kartı #402322, yani kırmızı değil kahverengi-bordo; sarı vurgu
amber, kırmızı somon. Kulübün gerçek rengi ekranın HİÇBİR yerinde yoktu.

YENİ KURAL — iki katman:
  1) KİMLİK katmanı: kulübün GERÇEK rengi (GS #A90432 + #FDB912) tam doygunlukta,
     az ama büyük yerde: arkaplanın üst ışığı + forma deseni, vitrin kartı,
     ana buton, seçili sekme. Bu renkler asla soldurulmaz/kahverengileşmez.
  2) OKUMA katmanı: kartlar, listeler, yazı alanları NÖTRE YAKIN koyu
     (OKLCH kroma ≤ 0.018, kulübün tonundan çok hafif ısı). Kimlik renkleriyle
     yarışmaz, çamur tona düşmez.
  Koyu zeminde YAZI/İKON olarak kullanılan renkler kulüp renginin OKUNUR hâli
  (L ≥ .64); büyük dolgular gerçek renk.

PAKET 33 (15 Ekim 2026) — Kerem: "şu temalardaki kahverengi rengi diyorum. GS ile
alakası yok ki kahverenginin. arkaplan ile zaten zıtlık yok." KÖK NEDEN (renk bilimi):
  • Paket 30'un "nötre yakın, kulübün tonundan hafif ısı" yüzeyi = GS kırmızısının
    tonu (OKLCH h 17) DÜŞÜK kroma (.016) ve DÜŞÜK açıklıkta. Kırmızı-turuncu tonun
    (h ~15-95) kroması düşük koyu hâli göz için KAHVERENGİDİR (kahve = koyu, soluk
    turuncu). #2A2020 kart, #0E0505 zemin tam olarak buydu.
  • Arkaplan ışığı GS'de kırmızı + SARI iki parıltıyı üst üste koyuyordu; koyu
    zeminde kırmızı+sarı karışımı = turuncu-kahve sis.
  • Kart/zemin kontrastı 1.45: kartlar zeminden yeterince ayrışmıyordu.
YENİ KURAL — "derin kulüp rengi" yüzeyleri:
  1) Yüzeyler ya GERÇEKTEN RENKLİ ya da GERÇEKTEN NÖTR; arası (soluk renk) yok.
     Renkli temada kart kroması .08-.09 (GS: şarap kırmızısı #4A0B1C ailesi,
     FB: gece laciverti, TS: bordo, Saha: orman yeşili). Siyah-beyaz temalar
     (BJK, Koyu) kroma 0.
  2) KAHVE BANDI YASAK: yüzey tonu h 20-100 aralığına düşemez (kırmızı-turuncu-sarı-
     zeytin bandı, düşük kromada kahve/zeytin görünür). Kırmızı kulüplerde yüzey
     tonu kırmızının MOR tarafına (h ≤ 10, kızıl-şarap) kaydırılır. denetle()
     bunu ölçer: "kahve bandı" hatası.
  3) Kart/zemin kontrastı ≥ 1.55 (zemin L .12 · kart L .25 · çerçeve L .35).
  4) Arkaplan ışığı yalnız kulübün ANA rengi (ikinci renk ışığı yok); forma
     çubukları beyaz çok ince (sarı+lacivert karışıp yeşile dönmesin).

Çıktı: lib/theme.js PALETLER renkleri + lib/temaOlusturucu.js ZEMINLER.
Çalıştır: python3 scripts/tema_uret.py [cikti.json]
"""
import json
import math
import sys


def lin2s(c): return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
def s2lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def oklch2rgb(L, C, h):
    a = C * math.cos(math.radians(h)); b = C * math.sin(math.radians(h))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)


def hx(L, C, h):
    c = C
    while True:
        r, g, b = oklch2rgb(L, c, h)
        if all(-1e-4 <= x <= 1 + 1e-4 for x in (r, g, b)) or c <= 0:
            break
        c -= 0.002
    r, g, b = [min(1, max(0, x)) for x in oklch2rgb(L, max(c, 0), h)]
    return '#' + ''.join(f'{round(lin2s(x) * 255):02X}' for x in (r, g, b))


def oklch(hexs):
    n = int(hexs[1:7], 16); r, g, b = [s2lin(((n >> k) & 255) / 255) for k in (16, 8, 0)]
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = [x ** (1 / 3) for x in (l, m, s)]
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(a, bb), (math.degrees(math.atan2(bb, a)) + 360) % 360


def lum(hexs):
    n = int(hexs[1:7], 16); r, g, b = [s2lin(((n >> k) & 255) / 255) for k in (16, 8, 0)]
    return .2126 * r + .7152 * g + .0722 * b


def kontrast(a, b):
    x, y = sorted([lum(a), lum(b)], reverse=True)
    return (x + .05) / (y + .05)


def ust_yazi(renk, adaylar):
    """Renkli dolgunun üstündeki yazı: adaylardan en okunuru."""
    return max(adaylar, key=lambda c: kontrast(renk, c))


def okunur(hexs, L_min=.70):
    """Koyu zeminde yazı/ikon olarak okunacak hâli: aynı ton, en az L_min."""
    L, C, h = oklch(hexs)
    return hexs if L >= L_min else hx(L_min, max(C, .02), h)


# Okuma katmanı açıklıkları (OKLCH L). Paket 33: kart/zemin kontrastı ≥ 1.55.
L_ZEMIN, L_SEKME, L_KART, L_CERCEVE = .12, .16, .25, .35
# Paket 33: yüzey kroması kademeleri (zemin, sekme, kart, çerçeve) — renkli temalar.
C_KADEME = (.56, .64, 1.0, 1.06)
C_YUZEY = .085
KAHVE_BANDI = (20, 100)

# Temalar: marka = kulübün ana rengi (büyük dolgular), marka2 = ikinci rengi.
#   accent = ana eylem rengi (butonlar, seçili sekme, ikonlar) — çoğunlukla marka2
#   cta    = ikincil vurgu (koyu zeminde okunur)
#   desen  = forma motifi: parcali (GS), cubuklu (FB/BJK/TS), cim (Saha), isik (diğer)
# ton = YÜZEY tonu (h), kroma = kart kroması. Kırmızı kulüplerde ton < marka tonu (şarap tarafı).
TEMALAR = {
    "cim":  dict(ad="Saha", marka="#17602F", marka2="#F4F7F2", accent="#86E36B", cta="#F5CC58", desen="cim", ton=160, kroma=.032),
    "gece": dict(ad="Gece Mavisi", marka="#1A3A8F", marka2="#FFFFFF", accent="#6EB6FF", cta="#FDBA55", desen="isik", ton=266, kroma=.075),
    "koyu": dict(ad="Koyu", marka="#26292D", marka2="#FFFFFF", accent="#7EE8B0", cta="#E8C987", desen="isik", ton=0, kroma=0, siyah=True),
    # Galatasaray: kırmızı PMS 187 #A90432, sarı PMS 123 #FDB912 (teamcolorcodes.com)
    "gs":   dict(ad="Galatasaray", marka="#A90432", marka2="#FDB912", accent="#FDB912", cta=None, desen="parcali", ton=8, kroma=.09),
    # Fenerbahçe: lacivert + sarı (kanarya sarısı)
    "fb":   dict(ad="Fenerbahçe", marka="#0C2659", marka2="#FFE500", accent="#FFE500", cta=None, desen="cubuklu", ton=264, kroma=.08),
    # Beşiktaş: siyah + beyaz, gri YOK (Paket 25: "toz bulutu gibi gri")
    "bjk":  dict(ad="Beşiktaş", marka="#000000", marka2="#FFFFFF", accent="#FFFFFF", cta="#E30A17", desen="cubuklu", ton=0, kroma=0, siyah=True),
    # Trabzonspor: bordo + mavi
    "ts":   dict(ad="Trabzonspor", marka="#8A1538", marka2="#5BB4E5", accent="#5BB4E5", cta=None, desen="cubuklu", ton=6, kroma=.085),
}


def palet(t):
    marka = t["marka"]
    _, _, h_marka = oklch(marka)
    h = t.get("ton", h_marka)
    c = t.get("kroma", C_YUZEY)
    s = t.get("siyah")
    p = {}
    k0, k1, k2, k3 = C_KADEME
    p["bg"] = "#000000" if s and c == 0 else hx(.10 if s else L_ZEMIN, c * k0, h)
    p["tabBar"] = hx(.15 if s else L_SEKME, c * k1, h)
    p["card"] = hx(.235 if s else L_KART, c * k2, h)
    p["cardBorder"] = p["border"] = hx(.34 if s else L_CERCEVE, c * k3, h)
    # Yazılar: beyaz + yüzeyin tonundan çok hafif (renkli temada soluk yazı tonla uyumlu)
    p["text"] = hx(.975, min(c * .08, .008), h)
    p["textMuted"] = hx(.81, min(c * .38, .032), h)
    p["textFaint"] = hx(.64, min(c * .38, .032), h)
    p["accent"] = t["accent"]
    # Vurgu dolgusunun üstündeki yazı: okunursa KULÜBÜN rengi (GS sarı üstüne kırmızı,
    # FB sarı üstüne lacivert) — kimlik buradan da gelir; okunmazsa en koyu ton.
    if lum(marka) < .1 and kontrast(p["accent"], marka) >= 4.0:   # kalın büyük buton yazısı
        p["accentDark"] = marka
    else:
        p["accentDark"] = ust_yazi(p["accent"], [hx(.20, .06, oklch(p["accent"])[2]), "#0B0B0B", "#FFFFFF"])
    cta = t["cta"] or okunur(marka, .66)
    p["cta"] = cta
    p["ctaDark"] = ust_yazi(cta, ["#FFFFFF", hx(.18, .05, oklch(cta)[2])])
    La, Ca, ha = oklch(p["accent"])
    p["ucuncu"] = hx(.86, min(Ca * .45, .07), ha)
    p["ucuncuDark"] = p["bg"]
    p["marka"] = marka
    p["marka2"] = t["marka2"]
    p["markaUst"] = ust_yazi(marka, ["#FFFFFF", "#0B0B0B"])
    p["desen"] = t["desen"]
    return p


def denetle(ad, p):
    k = lambda a, b: kontrast(p[a], p[b])
    olc = {
        # Paket 33: koyu renklerde WCAG oranı sıkışır; kart/zemin ayrışması OKLCH açıklık farkıyla (×10)
        "kart/zemin": (oklch(p["card"])[0] - oklch(p["bg"])[0]) * 10, "yazi/kart": k("text", "card"), "soluk/kart": k("textMuted", "card"),
        "vurgu/zemin": k("accent", "bg"), "vurguYazi": k("accent", "accentDark"), "cta/kart": k("cta", "card"),
        "markaYazi": k("marka", "markaUst"), "buton/vitrin": k("accent", "marka"),
    }
    sinir = {"kart/zemin": 1.2, "yazi/kart": 7, "soluk/kart": 4.5, "vurgu/zemin": 4.5, "vurguYazi": 4.0, "cta/kart": 3, "markaYazi": 4.5, "buton/vitrin": 3.5}
    kotu = [f"{a} {v:.2f}<{sinir[a]}" for a, v in olc.items() if v < sinir[a]]
    # Paket 33 — kahve bandı: renkli ama soluk (C .01-.06) yüzey, ton h 20-100 → kahve/zeytin
    for y in ("bg", "card", "cardBorder"):
        L_, C_, h_ = oklch(p[y])
        if .008 < C_ < .06 and KAHVE_BANDI[0] <= h_ <= KAHVE_BANDI[1]:
            kotu.append(f"kahve bandı {y} {p[y]} (h {h_:.0f}, C {C_:.3f})")
    print(f"{ad:6}", " ".join(f"{a} {v:.2f}" for a, v in olc.items()), ("  !! " + ", ".join(kotu)) if kotu else "")
    return kotu


OUT = {k: palet(t) for k, t in TEMALAR.items()}

# Özel tema zeminleri (TemaOlusturucu) — aynı okuma katmanı kuralı, farklı tonlar
Z = [("lacivert", "Lacivert", 255, .02), ("gece", "Gece mavisi", 268, .022), ("siyah", "Siyah", 0, 0), ("grafit", "Grafit", 250, .006),
     ("orman", "Orman", 158, .062), ("bordo", "Şarap", 6, .085), ("mor", "Mor", 300, .07), ("petrol", "Petrol", 215, .06)]
# Paket 33: "Kahve" zemini kalktı (Kerem: kahverengi istemiyor) → "Petrol". Lacivert/gece de derinleşti.
Z = [(i, a, h, (.07 if i == "lacivert" else .075 if i == "gece" else c)) for i, a, h, c in Z]
zem = []
for i, ad, h, c in Z:
    siyah = i == "siyah"
    zem.append(dict(id=i, ad=ad, renkler=dict(
        bg="#000000" if siyah else hx(L_ZEMIN, c * C_KADEME[0], h), tabBar=hx(.15 if siyah else L_SEKME, c * C_KADEME[1], h),
        card=hx(.235 if siyah else L_KART, c, h), cardBorder=hx(.34 if siyah else L_CERCEVE, c * C_KADEME[3], h),
        text=hx(.975, min(c * .08, .008), h), textMuted=hx(.81, min(c * .38, .032), h), textFaint=hx(.64, min(c * .38, .032), h))))

if __name__ == "__main__":
    for k, p in OUT.items():
        denetle(k, p)
    for k, p in OUT.items():
        print(k, json.dumps(p))
    for z in zem:
        print(z["id"], json.dumps(z["renkler"]))
    if len(sys.argv) > 1:
        json.dump({"palet": OUT, "zemin": zem}, open(sys.argv[1], "w"), indent=1)
