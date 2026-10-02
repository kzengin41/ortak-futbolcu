# -*- coding: utf-8 -*-
"""veri/ozgecmis_ham.json -> lib/playerProfiles.json + lib/playerAwards.json + rapor
(bulutta çalışır; Kerem'in bilgisayarındaki ham veri stage edilip buradan işlenir)"""
import json, re, sys, unicodedata, collections, os

if len(sys.argv) >= 6:
    HAM, PLAYERS, CLUBALIAS, YILLAR, CIKTI_DIR = sys.argv[1:6]
else:  # argümansız: proje kökünden (python scripts/ozgecmis_isle.py)
    _k = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    HAM = os.path.join(_k, "veri", "ozgecmis_ham.json")
    PLAYERS = os.path.join(_k, "lib", "players.json")
    CLUBALIAS = os.path.join(_k, "lib", "clubAliases.js")
    YILLAR = os.path.join(_k, "lib", "playerYears.json")
    CIKTI_DIR = os.path.join(_k, "lib")
BU_YIL = 2026

ham = json.load(open(HAM, encoding="utf-8"))
oyuncular = json.load(open(PLAYERS, encoding="utf-8"))
etiket = ham.get("etiket", {})

# kanonik kulüp eşlemesi (clubAliases.js'ten)
al = open(CLUBALIAS, encoding="utf-8").read()
blok = al[al.index("CLUB_ALIAS_GROUPS = {"):al.index("\n};", al.index("CLUB_ALIAS_GROUPS = {"))]
V2K = {}
for satir in blok.splitlines()[1:]:
    satir = satir.strip().rstrip(",")
    if ":" not in satir or satir.startswith("//"):
        continue
    k, vs = json.loads("{" + satir + "}").popitem()
    for v in vs:
        V2K[v] = k

def sade(s):
    s = (s or "").replace("İ", "i").replace("I", "ı").lower()
    s = s.translate(str.maketrans("ışğüöçâîû", "isguocaiu"))
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

GURULTU = {"fc", "cf", "sk", "fk", "jk", "ac", "as", "sc", "afc", "ssc", "cd", "ud", "sd", "sad", "de", "club",
           "futbol", "kulubu", "calcio", "spor", "football", "futebol", "clube", "sv", "vfb", "vfl", "1", "s", "a"}
def cekirdek(s):
    return {t for t in sade(s).split() if t not in GURULTU and len(t) > 1}

MILLI_RE = re.compile(r"national .*team|olympic .*team|national team|milli tak", re.I)
def milli_mi(q):
    e = etiket.get(q) or {}
    return bool(MILLI_RE.search(e.get("en") or "") or MILLI_RE.search(e.get("tr") or ""))

YEDEK = {"ii", "iii", "b", "c", "u17", "u18", "u19", "u20", "u21", "u23", "reserves", "reserve", "youth",
         "juniors", "primavera", "atletic", "castilla", "jong", "academy", "akademi", "a2"}
def yedek_mi(s):
    return bool(set(sade(s).split()) & YEDEK)

def eslesme_puani(wd_ad, app_ad):
    ck, cc = cekirdek(wd_ad), cekirdek(app_ad)
    if not ck or not cc:
        return 0.0
    ortak = len(ck & cc)
    if not ortak:
        return 0.0
    p = ortak / len(ck | cc)
    if yedek_mi(wd_ad) != yedek_mi(app_ad):
        p -= 0.5
    if sade(wd_ad) == sade(app_ad):
        p += 0.2
    # "FC Barcelona Atlètic" / "Real Madrid Castilla" = B takımı
    if set(sade(wd_ad).split()) & {"atletic", "castilla", "b"} and sade(app_ad).endswith(" b"):
        p += 0.1
    return p

def takim_adi_uygulamada(q, uygulama_kulupleri):
    """Wikidata takımını oyuncunun uygulamadaki kulüp yazımına çevir (en iyi örtüşme)."""
    e = etiket.get(q) or {}
    en_iyi, puan = None, 0.0
    for wd_ad in {e.get("en") or "", e.get("tr") or ""} - {""}:
        for c in uygulama_kulupleri:
            p = eslesme_puani(wd_ad, c)
            if p > puan:
                en_iyi, puan = c, p
    if en_iyi and puan >= 0.5:
        return V2K.get(en_iyi, en_iyi)
    return None

SONEK = re.compile(r"\s+(F\.?C\.?|C\.?F\.?|S\.?K\.?|J\.?K\.?|A\.?F\.?C\.?|S\.?C\.?)$")
def takim_etiketi(q):
    e = etiket.get(q) or {}
    ad = e.get("tr") or e.get("en")
    return SONEK.sub("", ad).strip() if ad else None

# ---------------------------------------------------------------- başarı kodları
RED = re.compile(r"runner|runners|second|third|finalist|bronze|silver|u-?\d\d|under-?\d\d|youth|olympic|player|team of|of the (year|season|month|tournament)|best|golden (ball|boot|glove)|top scorer|scorer|nominee|squad|all-star|dream team|hall of fame", re.I)
def kupa_kodu(kupa, grup):
    k = (kupa or "").strip()
    if RED.search(k):
        return None
    k = re.sub(r"\s+(champions?|winners?|title|titles)$", "", k, flags=re.I)   # "Serie A champion"
    kl = k.lower()
    if re.fullmatch(r"(fifa )?world cup", kl): return "dunyaKupasi"
    if re.fullmatch(r"(uefa )?(european championship|euro( \d{4})?)", kl): return "avrupaSampiyonasi"
    if re.fullmatch(r"copa am[ée]rica", kl): return "copaAmerica"
    if re.fullmatch(r"(africa cup of nations|african cup of nations|africa cup)", kl): return "afrikaKupasi"
    if re.fullmatch(r"(uefa )?(champions league|european cup)", kl): return "sampiyonlarLigi"
    if re.fullmatch(r"(uefa )?(europa league|uefa cup)", kl): return "avrupaLigi"
    if kl in ("süper lig", "super lig", "turkish super league", "turkish süper lig", "1.lig", "turkish first football league"): return "superLig"
    if kl in ("premier league", "fa premier league"): return "premierLig"
    if kl in ("la liga", "spanish la liga"): return "laLiga"
    if kl in ("serie a",) and "bra" not in (grup or "").lower(): return "serieA"
    if kl in ("bundesliga", "german bundesliga"): return "bundesliga"
    if kl in ("ligue 1", "french division 1"): return "ligue1"
    return None

GOLKRALI = re.compile(r"(süper lig|premier league|la liga|serie a|bundesliga|ligue 1).*(top scorer|golden boot|gol kral)|pichichi|capocannoniere|torj[äa]gerkanone", re.I)

# Lig şampiyonluklarında karışıklık olmasın (Avusturya "Bundesliga"sı, Ekvador
# "Serie A"sı...): kupanın başlığındaki kulüp oyuncunun Wikidata takımlarından
# birine uyuyorsa, o takımın ülkesi ligin ülkesiyle aynı olmalı.
LIG_ULKE = {
    "superLig": {"Q43"}, "premierLig": {"Q145", "Q21", "Q25"}, "laLiga": {"Q29"}, "serieA": {"Q38", "Q238"},
    "bundesliga": {"Q183"}, "ligue1": {"Q142", "Q235"},
}
def grup_ulkesi(grup, kayit):
    if not grup:
        return None
    en_iyi, puan = None, 0.0
    for t in kayit.get("takimlar") or []:
        e = etiket.get(t["q"]) or {}
        p = eslesme_puani(e.get("en") or "", grup)
        if p > puan:
            en_iyi, puan = e.get("ulke"), p
    return en_iyi if puan >= 0.5 else None

KULUP_KUPALARI = {"superLig", "premierLig", "laLiga", "serieA", "bundesliga", "ligue1", "sampiyonlarLigi", "avrupaLigi"}
GENEL_GRUP = {"individual", "club", "clubs", "player", "international", "honours", "honors", "records", "orders",
              "national team", "as a player", "player honours", "other", "youth"}
try:
    _ulkeler = {sade(u) for u in json.load(open(os.path.join(os.path.dirname(PLAYERS), "countries.json"), encoding="utf-8")).keys()}
except Exception:
    _ulkeler = set()

def grup_oynadigi_kulup_mu(grup, kayit, ad):
    """Kupa başlığı bir kulüp adıysa, oyuncu o kulüpte OYNAMIŞ olmalı. Teknik
    direktörlük kupaları (ör. Abdullah Avcı - Trabzonspor) böyle elenir.
    Başlık kulüp değilse (Bireysel, ülke adı, boş) None döner = karar verilemez."""
    if not grup:
        return None
    gs = sade(grup)
    if gs in GENEL_GRUP or gs in _ulkeler or "national" in gs or "milli" in gs:
        return None
    for t in kayit.get("takimlar") or []:
        if eslesme_puani((etiket.get(t["q"]) or {}).get("en") or "", grup) >= 0.5:
            return True
    for c in uyg.get(ad) or []:
        if eslesme_puani(c, grup) >= 0.5:
            return True
    return False

def odul_kodlari(kayit, ad=None):
    """-> {kod: kaç kez}. Wikidata ödülleri ve Wikipedia kupa listesi ayrı sayılır,
    büyük olan alınır (Ballon d'Or ikisinde de geçer, iki kez sayılmasın)."""
    od, ku = collections.Counter(), collections.Counter()
    for o in kayit.get("oduller") or []:
        en = ((etiket.get(o["q"]) or {}).get("en") or "").lower()
        if en == "ballon d'or":
            od["ballonDor"] += 1
        elif "european golden shoe" in en or en == "golden shoe":
            od["altinAyak"] += 1
    for x in kayit.get("kupalar") or []:
        kupa = x.get("kupa") or ""
        if not x.get("yillar") or x.get("yonetici"):
            continue
        n = len(x["yillar"])
        if kupa.lower() == "ballon d'or":
            ku["ballonDor"] += n; continue
        if GOLKRALI.search(kupa):
            ku["golKrali"] += n; continue
        k = kupa_kodu(kupa, x.get("grup"))
        if k in KULUP_KUPALARI and grup_oynadigi_kulup_mu(x.get("grup"), kayit, ad) is False:
            sayac["oynamadigi_kulup_red"] += 1
            continue
        if k in LIG_ULKE:
            u = grup_ulkesi(x.get("grup"), kayit)
            if u and u not in LIG_ULKE[k]:
                sayac["lig_ulke_red"] += 1
                continue
        if k:
            ku[k] += n
    # Wikidata'da bir ödül çoğu zaman TEK kayıt + birden çok tarih olarak duruyor
    # (Messi'nin 8 Ballon d'Or'u tek satır) ve biz ilk tarihi aldık; bu yüzden
    # sayıyı sadece Wikipedia kupa listesinden veriyoruz. 0 = "var, sayısı bilinmiyor".
    return {k: ku[k] for k in set(od) | set(ku)}


# ---------------------------------------------------------------- Türkçe gösterim
KUPA_TR = {
    "fifa world cup": "Dünya Kupası", "world cup": "Dünya Kupası",
    "uefa european championship": "Avrupa Şampiyonası", "european championship": "Avrupa Şampiyonası",
    "uefa euro": "Avrupa Şampiyonası", "uefa nations league": "UEFA Uluslar Ligi",
    "copa américa": "Copa América", "africa cup of nations": "Afrika Uluslar Kupası",
    "fifa confederations cup": "Konfederasyonlar Kupası", "olympic gold medal": "Olimpiyat Altın Madalyası",
    "uefa champions league": "Şampiyonlar Ligi", "european cup": "Avrupa Şampiyon Kulüpler Kupası",
    "uefa europa league": "UEFA Avrupa Ligi", "uefa cup": "UEFA Kupası",
    "uefa europa conference league": "UEFA Konferans Ligi", "uefa conference league": "UEFA Konferans Ligi",
    "uefa super cup": "UEFA Süper Kupası", "fifa club world cup": "FIFA Kulüpler Dünya Kupası",
    "intercontinental cup": "Kıtalararası Kupa", "uefa cup winners' cup": "Kupa Galipleri Kupası",
    "european cup winners' cup": "Kupa Galipleri Kupası", "copa libertadores": "Copa Libertadores",
    "süper lig": "Süper Lig", "super lig": "Süper Lig", "1.lig": "Süper Lig (1. Lig)",
    "turkish cup": "Türkiye Kupası", "turkish super cup": "Türkiye Süper Kupası",
    "tff super cup": "Türkiye Süper Kupası", "presidential cup": "Cumhurbaşkanlığı Kupası",
    "premier league": "Premier Lig", "fa cup": "FA Cup", "efl cup": "Lig Kupası",
    "football league cup": "Lig Kupası", "fa community shield": "Community Shield",
    "la liga": "La Liga", "copa del rey": "Kral Kupası", "supercopa de españa": "İspanya Süper Kupası",
    "serie a": "Serie A", "coppa italia": "İtalya Kupası", "supercoppa italiana": "İtalya Süper Kupası",
    "bundesliga": "Bundesliga", "dfb-pokal": "Almanya Kupası", "dfl-supercup": "Almanya Süper Kupası",
    "ligue 1": "Ligue 1", "coupe de france": "Fransa Kupası", "coupe de la ligue": "Fransa Lig Kupası",
    "trophée des champions": "Fransa Süper Kupası", "eredivisie": "Eredivisie", "primeira liga": "Portekiz Ligi",
    "ballon d'or": "Ballon d'Or", "fifa world player of the year": "FIFA Yılın Oyuncusu",
    "the best fifa men's player": "FIFA The Best", "european golden shoe": "Avrupa Altın Ayakkabı",
    "golden boy": "Golden Boy", "fifa world cup golden ball": "Dünya Kupası Altın Top",
    "fifa world cup golden boot": "Dünya Kupası Gol Kralı", "uefa champions league top scorer": "Şampiyonlar Ligi Gol Kralı",
    "süper lig top scorer": "Süper Lig Gol Kralı", "premier league golden boot": "Premier Lig Gol Kralı",
    "pichichi trophy": "La Liga Gol Kralı (Pichichi)", "capocannoniere": "Serie A Gol Kralı",
}
GRUP_TR = {"individual": "Bireysel", "club": "Kulüp", "international": "Milli Takım", "orders": "Nişanlar",
           "records": "Rekorlar", "national team": "Milli Takım"}
def kupa_tr(k):
    return KUPA_TR.get((k or "").strip().lower(), k)
MILLI_GRUP = re.compile(r"^(.*?)\s+(?:men's\s+|women's\s+)?(?:national|olympic)\b(.*)$", re.I)
def grup_tr(g):
    g = (g or "").strip()
    m = MILLI_GRUP.match(g)
    if m and re.search(r"team", m.group(2), re.I):
        yas = re.search(r"under-?(\d\d)", m.group(2), re.I)
        olimpik = "olympic" in g.lower()
        return m.group(1) + (" U" + yas.group(1) if yas else " Olimpik" if olimpik else "")
    return GRUP_TR.get(g.lower(), g)

# ---------------------------------------------------------------- işleme
profiller, oduller = {}, {}
sayac = collections.Counter()
supheli = []
# Aynı adlı birden fazla oyuncu varsa (ör. 3 ayrı "Luis Suárez") uygulama
# profil kartında İLKİNİ gösteriyor; profil de sadece o kişiyle eşleşirse yazılır.
uyg, uyg_tam = {}, {}
for _p in oyuncular:
    if _p["name"] not in uyg:
        uyg[_p["name"]] = [c for c in _p["clubs"] if not MILLI_RE.search(c)]
        uyg_tam[_p["name"]] = _p["clubs"]   # profil kartının gösterdiği liste (kariyer satırları buna sıra no ile bağlanır)
yillar = json.load(open(YILLAR, encoding="utf-8"))
try:
    dogumlar = json.load(open(os.path.join(os.path.dirname(PLAYERS), "playerBirthPosition.json"), encoding="utf-8"))
except Exception:
    dogumlar = {}

# Birleştirilen çift kayıtlar (lib/playerAliases.json: tutulan ad -> silinen adlar):
# ham veride sadece silinen yazımla kayıt varsa tutulan ada taşı.
try:
    _takma = json.load(open(os.path.join(os.path.dirname(PLAYERS), "playerAliases.json"), encoding="utf-8"))
except Exception:
    _takma = {}
_hamo = ham.get("oyuncu") or {}
for _tut, _siller in _takma.items():
    if _tut in _hamo:
        continue
    for _sil in _siller:
        if _sil in _hamo:
            _hamo[_tut] = _hamo[_sil]; sayac["takma_ad_tasindi"] += 1
            break

# 1 Ekim 2026: Wikidata'da adı eşleşen ama futbolcu OLMAYAN kişiler (basketbolcu,
# şarkıcı, aktör...). Açıklamada "futbolcu" geçiyorsa (ör. "futbolcu ve basketbolcu")
# dokunulmaz. Bunların ne profili ne tanınırlığı kullanılır.
BASKA_ALAN = re.compile(r"basketbol|beyzbol|amerikan futbol|buz hokeyi|ragbi|rugby|kriket|şarkıcı|"
                        r"aktör|aktris|bisikletçi|tenisçi|voleybolcu|boksör", re.I)
def baska_alan_mi(k):
    acik = k.get("aciklama_tr") or ""
    return bool(BASKA_ALAN.search(acik)) and "futbolcu" not in acik.lower()

for ad, k in (ham.get("oyuncu") or {}).items():
    if ad not in uyg:
        continue
    if baska_alan_mi(k):
        sayac["baska_alan"] += 1
        continue
    sayac["kayit"] += 1
    kulup_takimlari = [t for t in (k.get("takimlar") or []) if not milli_mi(t["q"])]
    # Doğrulama — yanlış kişiyi (aynı adlı başka futbolcu / beyzbolcu vb.) elemek için:
    #  1) Doğum yılı iki kaynakta da varsa en fazla 1 fark olabilir.
    #  2) Wikidata kulüplerinden hiçbiri uygulamadakilerle eşleşmiyorsa:
    #     3+ kulüp varsa başka biri say; 1-2 kulüp varsa (Wikidata eksik) doğum yılı
    #     birebir tutuyorsa kabul et ama kulüp bilgilerini Wikidata'dan ALMA.
    app_dy = (dogumlar.get(ad) or {}).get("birthYear")
    wd_dy = int(k["dogum"][:4]) if (k.get("dogum") or "")[:4].isdigit() else None
    eslesen = [t for t in kulup_takimlari if takim_adi_uygulamada(t["q"], uyg[ad])]
    esq = {t["q"] for t in eslesen}
    guclu = len(esq) >= 2 or (esq and len(esq) * 2 >= len({t["q"] for t in kulup_takimlari}))
    dogum_celiskili = bool(app_dy and wd_dy and abs(app_dy - wd_dy) > 1)
    if dogum_celiskili and not guclu:
        supheli.append(ad); sayac["supheli_dogum"] += 1
        continue
    kulup_guvenilir = bool(eslesen)
    if kulup_takimlari and not eslesen and len(uyg[ad]) >= 2:
        if len(kulup_takimlari) >= 3 or not (app_dy and wd_dy and app_dy == wd_dy):
            supheli.append(ad); sayac["supheli_kulup"] += 1
            continue
        sayac["kulupsuz_kabul"] += 1
    if not kulup_guvenilir:
        kulup_takimlari = []
    if dogum_celiskili:
        # Kulüpler tutuyor ama doğum yılı çelişiyor: hangisi doğru bilinmez,
        # tarih bilgilerini (doğum/vefat) hiç yazma.
        sayac["dogum_celiskili_kabul"] += 1
        k = dict(k, dogum=None, olum=None)
    p = {}
    if k.get("dogum"): p["d"] = k["dogum"]
    if k.get("olum"): p["o"] = k["olum"]
    if k.get("boy"): p["b"] = int(round(k["boy"]))
    ayak = (etiket.get(k.get("ayak")) or {}).get("en") if k.get("ayak") else None
    if ayak:
        p["a"] = {"left-footedness": "Sol", "right-footedness": "Sağ", "ambidexterity": "İki ayak"}.get(ayak.lower(), None)
        if not p["a"]: p.pop("a")
    # Güncel / son kulüp. Aktiflik uygulamanın kendi verisinden (playerYears:
    # son aktif yıl) — Wikidata'da bitiş yılı çoğu zaman eksik olduğu için.
    olu = bool(k.get("olum"))
    son_aktif = yillar.get(ad)
    aktif = (not olu) and son_aktif is not None and son_aktif >= BU_YIL - 1
    kiralik_degil = [t for t in kulup_takimlari if not t.get("k")] or kulup_takimlari
    # Wikidata'da kulüp listesi sık sık yarım kalıyor (son transferler eksik).
    # Bu yüzden Wikidata'nın söylediği kulübü ancak EN GÜNCEL bilgiyse kullanıyoruz;
    # değilse uygulamanın kendi kulüp listesinin sonuncusu (kronolojik) geçerli.
    en_son_bas = max([t.get("b") or 0 for t in kulup_takimlari] + [0])
    # Wikipedia bilgi kutusu (4. aşama, "current_club") en güncel kaynak:
    # serbest / emekli / yeni kulüp bilgisi Wikidata'dan önce gelir.
    ib = dict(k.get("guncel") or {})
    # Eski çekimdeki ayrıştırma hatası: boş "current_club" alanında bir sonraki
    # satır ("| clubnumber =") kulüp adı sanılmıştı. Bunlar "alan boş" demek.
    # Yarım kalmış wiki bağlantısı: "[[FC Dinamo Batumi|" → "FC Dinamo Batumi"
    if ib.get("kulup") and ib["kulup"].lstrip().startswith("[["):
        ib["kulup"] = re.split(r"\||\]\]", ib["kulup"].strip()[2:])[0].strip()
    if ib.get("durum") == "kulup" and (not ib.get("kulup") or ib["kulup"].lstrip().startswith("|") or "=" in ib["kulup"]):
        ib = {"durum": "bos_alan", "kulup": None}
    if ib.get("durum") == "bos_alan":
        ib = {"durum": "serbest", "kulup": None}
    if aktif and ib.get("durum") == "emekli":
        aktif = False
    if aktif and ib.get("durum") == "serbest":
        p["sb"] = 1
        sayac["serbest"] += 1
        aktif = False   # aşağıda "son kulübü" olarak yazılır
    if aktif and ib.get("durum") == "kulup" and ib.get("kulup"):
        esl = max(((eslesme_puani(ib["kulup"], c), c) for c in uyg[ad]), default=(0, None))
        p["g"] = V2K.get(esl[1], esl[1]) if esl[0] >= 0.5 else ib["kulup"]
        if ib.get("kiralik"):
            p["gk"] = 1
        sayac["guncel_infobox"] += 1
    elif aktif:
        acik = [t for t in kiralik_degil if t.get("s") is None and t.get("b")]
        aday = max(acik, key=lambda t: t["b"]) if acik else None
        ad_uyg = takim_adi_uygulamada(aday["q"], uyg[ad]) if aday and aday["b"] >= en_son_bas else None
        p["g"] = ad_uyg or uyg[ad][-1]
        sayac["guncel"] += 1
    elif kiralik_degil or uyg[ad]:
        s = max(kiralik_degil, key=lambda t: (t.get("s") or t.get("b") or 0, t.get("b") or 0)) if kiralik_degil else None
        wd_son = (s.get("s") or s.get("b")) if s else None
        ad_uyg = None
        if s and wd_son and (not son_aktif or wd_son >= son_aktif - 1):
            ad_uyg = takim_adi_uygulamada(s["q"], uyg[ad]) or takim_etiketi(s["q"])
        p["s"] = ad_uyg or (uyg[ad][-1] if uyg[ad] else None)
        if not p["s"]:
            p.pop("s")
        sy = son_aktif or wd_son
        if sy and sy != son_aktif: p["sy"] = sy   # eşitse uygulama playerYears'tan okur
        sayac["son"] += 1
    # Kulüp kariyeri (yıllarla, maç/gol varsa)
    kar = []
    for t in sorted(kulup_takimlari, key=lambda t: (t.get("b") or 9999)):
        ad_uyg = takim_adi_uygulamada(t["q"], uyg[ad])
        if not ad_uyg:
            continue
        if not t.get("b"):
            continue   # yılı olmayan satır uygulamadaki kulüp listesinden fazlasını söylemiyor
        tam = uyg_tam[ad]
        sira = next((i for i, c in enumerate(tam) if V2K.get(c, c) == ad_uyg), None)
        if sira is None:
            continue
        # [kulüp sıra no (players.json'daki listede), başlangıç, bitiş, maç, gol]
        satir = [sira, t.get("b"), t.get("s"), int(t["m"]) if t.get("m") else None, int(t["g"]) if t.get("g") is not None else None]
        while len(satir) > 2 and satir[-1] is None:
            satir.pop()
        kar.append(satir)
    if kar:
        p["k"] = kar
    # Kupalar (kısaltılmış): grup -> ["Süper Lig (4)", ...]
    kup = collections.OrderedDict()
    for x in k.get("kupalar") or []:
        if not x.get("yillar") or RED.search(x.get("kupa") or "") and "runner" in (x.get("kupa") or "").lower():
            continue
        if x.get("yonetici") or grup_oynadigi_kulup_mu(x.get("grup"), k, ad) is False:
            continue   # teknik direktörken kazandığı kupa
        g = grup_tr(x.get("grup") or "Diğer")
        kup.setdefault(g, []).append([kupa_tr(x["kupa"]), len(x["yillar"]), x["yillar"][:12]])
    if kup:
        p["ku"] = [[g, v] for g, v in kup.items()][:8]
    # Bireysel ödüller (Wikidata) — tr etiketi varsa o
    od = []
    for o in k.get("oduller") or []:
        e = etiket.get(o["q"]) or {}
        lab = e.get("tr") or kupa_tr(e.get("en"))
        if lab:
            od.append([lab, o.get("y")])
    if od:
        p["od"] = od[:15]
    sayilar = odul_kodlari(k, ad)
    if sayilar:
        oduller[ad] = sorted(sayilar)
        p["bs"] = {kod: n for kod, n in sayilar.items()}   # profil kartı: "Şampiyonlar Ligi ×2"
        sayac["odullu"] += 1
    if p:
        profiller[ad] = p

# ---------------------------------------------------------------- tanınırlık (5. aşama)
# lib/playerFame.json: ad -> [güncel popülerlik, tüm zamanlar tanınırlığı], ikisi de
# 0-100 YÜZDELİK (100 = en tanınan). Oyun zorluğu sıralamaya baktığı için ölçek
# değil sıra önemli. Aynı adı taşıyan oyunculardan uygulamada puanı sadece bu
# kişiyle doğrulanmış olan alır (clubWeights'teki adaş koruması).
# Wikipedia'da futbolcu sayfası yerine ünlü birinin sayfasına bağlanmış ya da
# şöhretini futbol dışında kazanmış kayıtlar (28 Eylül ölçümü: Jason Statham,
# Julio Iglesias ilk 20'ye giriyordu). Ayrıca doğrulanmış kariyeri (k) olmayan
# ve uygulamada tek kulübü olan kayıtlara tanınırlık puanı verilmez.
TANIN_HARIC = {"Jason Statham", "Julio Iglesias"}
tanin = {ad: k.get("tanin") for ad, k in (ham.get("oyuncu") or {}).items()
         if ad in profiller and isinstance(k.get("tanin"), dict)
         and ad not in TANIN_HARIC
         and (profiller[ad].get("k") or len(uyg.get(ad) or []) >= 2)}
def _yuzdelik(degerler):
    sirali = sorted(degerler.items(), key=lambda x: x[1])
    n = len(sirali); out = {}; i = 0
    while i < n:                      # eşit değerler aynı yüzdeliği alır
        j = i
        while j + 1 < n and sirali[j + 1][1] == sirali[i][1]:
            j += 1
        p = ((i + j) / 2.0) / max(n - 1, 1)
        for a, _ in sirali[i:j + 1]:
            out[a] = p
        i = j + 1
    return out
unler = {}
if len(tanin) >= 1000:
    import math
    p_sl = _yuzdelik({a: t.get("sl") or 0 for a, t in tanin.items()})
    p_en = _yuzdelik({a: math.log10(1 + (t.get("en") or 0)) for a, t in tanin.items()})
    p_tr = _yuzdelik({a: math.log10(1 + (t.get("tr") or 0)) for a, t in tanin.items()})
    # 1 Ekim 2026 (Kerem: "Uğurcan Çakır ilk 3000'de yok, ilk 200'de olmalı"):
    # oyuncular Türk. Genel karışım (en/tr/dil sayısı) dünya yıldızlarını doğru
    # sıralıyor ama Türkiye'de herkesin bildiği oyuncuları geride bırakıyordu.
    # Güncel puan = max(genel, %85 Türkçe görüntülenme + %15 genel): dünya
    # yıldızları yerinde kalır, Türkiye'de çok aranan oyuncular öne çıkar.
    # 3 Ekim 2026: 0,6 → 0,85. 0,6'da Uğurcan 488., Barış Alper 400.; 0,85'te
    # 191. ve 154. (Kerem: "ilk 200'de olmalı"); Benzema 40., De Bruyne 69.,
    # Pedri 151. ile dünya yıldızları yerinde kalıyor.
    TR_AGIRLIGI = 0.85
    def _genel(a):
        return 0.35 * p_en[a] + 0.35 * p_tr[a] + 0.30 * p_sl[a]
    guncel = _yuzdelik({a: max(_genel(a), TR_AGIRLIGI * p_tr[a] + (1 - TR_AGIRLIGI) * _genel(a)) for a in tanin})
    tum = _yuzdelik({a: 0.55 * p_sl[a] + 0.30 * p_en[a] + 0.15 * p_tr[a] for a in tanin})
    unler = {a: [round(guncel[a] * 100, 3), round(tum[a] * 100, 3)] for a in tanin}
    sayac["tanin"] = len(unler)

# ---------------------------------------------------------------- kulüp ülkeleri
# lib/clubCountries.json: uygulamadaki kulüp adı -> ülke (Wikidata takım ülkesi,
# oyuncu kariyerlerinden oylamayla). Eşleşme Profili'nin bölge ağırlıkları kullanıyor.
_oy = collections.defaultdict(collections.Counter)
for _ad, _k in (ham.get("oyuncu") or {}).items():
    if _ad not in uyg:
        continue
    for _t in _k.get("takimlar") or []:
        _e = etiket.get(_t["q"]) or {}
        if not _e.get("ulke") or MILLI_RE.search(_e.get("en") or ""):
            continue
        _en, _ep = None, 0.0
        for _c in uyg[_ad]:
            _p = eslesme_puani(_e.get("en") or "", _c)
            if _p > _ep:
                _en, _ep = _c, _p
        if _en and _ep >= 0.5:
            _oy[_en][_e["ulke"]] += 1
kulup_ulke = {}
for _c, _cnt in _oy.items():
    _q, _n = _cnt.most_common(1)[0]
    _lab = (etiket.get(_q) or {}).get("en")
    if _lab and _n * 2 >= sum(_cnt.values()):
        kulup_ulke[_c] = _lab
sayac["kulup_ulkesi"] = len(kulup_ulke)

os.makedirs(CIKTI_DIR, exist_ok=True)
if kulup_ulke:
    json.dump(kulup_ulke, open(os.path.join(CIKTI_DIR, "clubCountries.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"), sort_keys=True)
if unler:
    json.dump(unler, open(os.path.join(CIKTI_DIR, "playerFame.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump(profiller, open(os.path.join(CIKTI_DIR, "playerProfiles.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump(oduller, open(os.path.join(CIKTI_DIR, "playerAwards.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
kod_say = collections.Counter(c for v in oduller.values() for c in v)
rapor = {"sayac": sayac, "odul_kodlari": kod_say, "supheli_ornek": supheli[:40]}
json.dump(rapor, open(os.path.join(os.path.dirname(HAM), "ozgecmis_rapor.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=dict)
print(json.dumps(rapor, ensure_ascii=False, default=dict)[:1500])
