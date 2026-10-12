# -*- coding: utf-8 -*-
"""
ÇİFT KAYIT + KULÜP ADI TEMİZLİĞİ — Paket 26 (12 Ekim 2026)
Kerem: "guardiola çift kayıtlı."

KÖK NEDEN: players.json'un son ~3.300 kaydı (sıra ~43.000 sonrası) ayrı bir
kaynaktan (Wikidata tam adları) eklenmiş. Bu partide:
  1) Ana veri setinde ZATEN olan oyuncular TAM ADLA ikinci kez var
     ("Pep Guardiola" + "Josep Guardiola", "Bata" + "Agustín Sauto Arana" …).
     Tespit: aynı doğum tarihi + kariyer satırlarının (başlangıç, bitiş, maç)
     en az %60'ı aynı.
  2) Kulüp adları normalize edilmemiş ("Brescia Calcio", "RCD Espanyol de
     Barcelona", "US Livorno 1915") → bu oyuncular oyunda "Brescia" turunda
     hiç eşleşmiyor.
  3) Kadın futbolcular da gelmiş ("Paris Saint-Germain Féminine", "… Ladies").

NE YAPAR
  1. Kadın takımlarında oynamış oyuncuları çıkarır.
  2. Çift kayıtları birleştirir: ana setteki kayıt kalır (yoksa daha popüler
     olan); öbür yazım lib/playerAliases.json'a takma ad olarak eklenir
     (yazınca/söyleyince yine tanınır). Eksik veriler (foto, profil, uyruk…)
     kalan kayda taşınır. kadrolar.json / gunlukTakvim.json'daki adlar da
     kalan ada çevrilir.
  3. Son partideki kulüp adlarını ana setteki yazıma çevirir (anahtar: küçük
     harf, aksansız, "FC/Calcio/Club/1909…" atılmış; B/altyapı takımları
     ana takımla ASLA birleştirilmez).
KULLANIM:  python scripts/veri_birlestir.py [--deneme]   → rapor: veri/birlestirme_raporu.txt
Sonra:     python scripts/veri_paketle.py
"""
import argparse, collections, json, os, re, sys, unicodedata

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(KOK, "lib")
SINIR = 43000            # bu sıradan sonrası "son parti"
AD_DOSYALARI = ["playerPhotos", "playerYears", "playerBirthPosition", "playerNationalTeams", "playerFame",
                "playerPopularity", "playerAchievements", "playerAwards", "playerProfiles"]
# Aynı doğum günü + benzer kariyer ama FARKLI kişi (elle doğrulandı)
AYRI = {frozenset(p) for p in [
    ("Cormac Burke", "Sean McGinty"), ("Danny Francis", "Robert Hughes"), ("Joaquín Correa", "Steven Moreira"),
    ("Martin Hongla", "Terrence Tisdell"), ("Jack McKay", "Paul McKay"), ("Lorenzo Rosseti", "Valerio Rosseti"),
    ("Armando Diena", "Ferruccio Diena"),
]}
KADIN = re.compile(r"(f[ée]minine|\bw\.f\.c\b|\bwfc\b|\bwomen|femenin|femen[íi]\b|femminile|\bfrauen\b|\bladies\b|feminil|\bffc\b|lyonnes|vrouwen|women's soccer)", re.I)
GENC = {"b", "c", "ii", "iii", "castilla", "atletic", "atletico madrid b", "mestalla", "promesas", "juvenil", "primavera",
        "youth", "reserves", "reserve", "academy", "jong", "u17", "u18", "u19", "u20", "u21", "u23", "sub", "amateure", "2"}
DUR = set("fc cf cd rcd ssc us as ac afc sc sd ud ca club de del la el do da dos das di futbol football fussball calcio balompie "
          "asd usd ssd fbc sv vfb vfl tsv cp ec se sk fk nk ss associazione sportiva societa unione deportiva sociedade esportiva "
          "clube regatas sport sports spa srl centre d esports futebol and of the 1".split())

# Tek başına kulüp adı olamayacak kadar genel kelimeler (yalnız tam eşleşmede kullanılır)
ZAYIF = set("atletico atletica racing sporting real deportivo union nacional internacional america city united town "
            "athletic olympic olimpia juventud libertad independiente central san santa sant estrela".split())
# Belirsiz kalanlardan elle doğrulananlar
ELLE = {"RCD Espanyol de Barcelona": "Espanyol", "RCD Español": "Espanyol", "GenoaC": "Genoa"}
# Alt küme eşlemesi otomatik UYGULANMAZ ("Alma Juventus Fano" ⊃ "Juventus" gibi yanlışlar çıkıyor);
# raporda "ALT KÜME ÖNERİSİ" olarak listelenir. Aşağıdakiler gözle doğrulandı (≥2 kayıt):
ONAYLI_ALTKUME = set(['RC Celta de Vigo', 'Unión Deportiva Almería', 'Club Atlético Osasuna', 'Club Deportivo Numancia de Soria', 'Botafogo F.R.', 'Club Atlético Peñarol', 'Sociedad Deportiva Huesca', 'Associação Portuguesa de Desportos', 'Società Ginnastica Andrea Doria', 'Club Social y Deportivo Colo Colo', 'UFM Monfalcone', 'Unión Popular de Langreo', 'UE Olot', 'Sociedad Deportiva Ponferradina', 'Sociedad Deportiva Aucas', 'SSV Ulm 1846 Fußball', 'RSD Alcalá', 'Grêmio FBPA', 'Club Deportivo Lugo', 'Club Deportivo Badajoz', 'Club Atlético Tigre', 'Club Atlético Rosario Central', 'Club Atlético Colón', 'Atlético Irapuato', 'Atletico Piombino', 'Associação Desportiva São Caetano', 'A.S.D. Vittorio Falmec San Martino Colle', 'A.C. Cantù G.S. San Paolo', 'U.S. Città di Pontedera S.S.D.', 'São José Esporte Clube', 'HNK Hajduk Split', 'F.B. Brindisi 1912', 'Deportivo Independiente Medellín', 'Club Social y Deportivo Macará', 'Club Atlético Platense', 'Club Atletico All Boys', 'Ceará Sporting Club', 'CE Premià', 'Bassano Virtus 55 S.T.', 'Associazione Sportiva Dilettantistica Saviglianese Calcio', 'Associazione Sportiva Dilettantistica Abbiategrasso', 'Associazione Calcistica Dilettantistica Rapallo Ruentes 1914', 'ASD Soccer Trani', 'A.S.D.C. Magenta', 'Unione Sportiva Dilettantistica Juventus Domo', 'San Frediano Rondinella S.S.', 'Marília Atlético Clube', 'Ionikos Nikaia', "G.S. Iraklis Thessalonikis (men's association football)", 'G.A.S. Veria', 'Feyenoord Rotterdam', 'F.S. Sestrese Calcio 1919', 'F.C.D. Pro Vasto', 'Esporte Clube Juventude', 'ESOF Vendée La Roche-sur-Yon', 'Club Deportivo Móstoles', 'Club Atlético Douglas Haig', 'Camaiore CalcioD.', 'C.S. Trevigliese', 'Bangu Atlético Clube', 'Audax São Paulo Esporte Clube', 'Associazione Sportiva Dilettantistica Liberty Bari 1909', 'A.P.S. Panthrakikos'])

# Her dosya kendi eski biçimiyle yazılır (git farkı yalnız gerçek değişiklik olsun)
BICIM = {"playerPhotos": {"indent": 1}, "playerAliases": {"indent": 1}, "playerAchievements": {"indent": 2},
         "players": {}, "playerYears": {}, "playerBirthPosition": {}}
def yaz_json(ad, veri):
    b = BICIM.get(ad, {"separators": (",", ":")})
    with open(os.path.join(LIB, ad + ".json"), "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, **b)

def oku(ad):
    with open(os.path.join(LIB, ad + ".json"), encoding="utf-8") as f:
        return json.load(f)

def sade(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().replace(".", "")
    return re.findall(r"[a-z0-9]+", s)

def anahtar(s):
    return [t for t in sade(s) if t not in DUR and not re.fullmatch(r"(18|19|20)\d\d", t)]

def genc(t):
    return {x for x in t if x in GENC}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--deneme", action="store_true"); a = ap.parse_args()
    pl = oku("players"); dosya = {ad: oku(ad) for ad in AD_DOSYALARI}
    takma = oku("playerAliases")
    pr = dosya["playerProfiles"]; pop = dosya["playerPopularity"]
    rapor = []
    sira = {x["name"]: i for i, x in enumerate(pl)}

    # ---- 1. kadın futbolcular
    kadinlar = {x["name"] for x in pl if any(KADIN.search(k) for k in x["clubs"])}
    rapor.append(f"KADIN FUTBOLCU ÇIKARILDI: {len(kadinlar)}")
    rapor += ["  " + n for n in sorted(kadinlar)]

    # ---- 2. çift kayıtlar
    def ks(p): return {tuple(-1 if v is None else v for v in x[1:4]) for x in p.get("k", []) if len(x) >= 3}
    gun = collections.defaultdict(list)
    for n in sira:
        p = pr.get(n)
        if n not in kadinlar and p and p.get("d") and p.get("k"): gun[p["d"]].append(n)
    ciftler = []
    for d, ns in gun.items():
        for i in range(len(ns)):
            for j in range(i + 1, len(ns)):
                x, y = ns[i], ns[j]
                if frozenset((x, y)) in AYRI: continue
                kx, ky = ks(pr[x]), ks(pr[y]); o = len(kx & ky)
                if o >= 2 and o >= 0.6 * min(len(kx), len(ky)): ciftler.append((x, y))
    silinen = {}   # silinen ad -> kalan ad
    for x, y in ciftler:
        while x in silinen: x = silinen[x]
        while y in silinen: y = silinen[y]
        if x == y: continue
        # ana setteki kalır; ikisi de aynı partideyse daha popüler olan
        if (sira[x] < SINIR) != (sira[y] < SINIR): kal, git = (x, y) if sira[x] < SINIR else (y, x)
        else: kal, git = (x, y) if pop.get(x, 0) >= pop.get(y, 0) else (y, x)
        silinen[git] = kal
    rapor.append(f"\nÇİFT KAYIT BİRLEŞTİ: {len(silinen)}  (kalan  <=  silinen)")
    rapor += [f"  {k}  <=  {g}" for g, k in sorted(silinen.items(), key=lambda t: t[1])]

    # ---- 3. kulüp adları (son parti)
    erkenC = collections.Counter(k for x in pl[:SINIR] for k in x["clubs"])
    erkenA = collections.defaultdict(list)
    for k in erkenC: erkenA[" ".join(anahtar(k))].append(k)
    erkenT = [(set(anahtar(k)), k) for k in erkenC if erkenC[k] >= 3 and len(" ".join(anahtar(k))) >= 4]
    harita = {}; belirsiz = []; altkume = []
    say_tum = collections.Counter(k for x in pl[SINIR:] for k in x["clubs"])
    for k in {k for x in pl[SINIR:] for k in x["clubs"]}:
        if k in erkenC or KADIN.search(k): continue
        t = anahtar(k)
        if not t: continue
        g = genc(t)
        aday = erkenA.get(" ".join(t))
        ts = set(t)
        if aday:
            e = max(aday, key=lambda e: erkenC[e])
            # nadir bir yazıma (ör. 1 kez "Corinthians Paulista") değil, yaygın olana ("Corinthians", 169)
            yaygin = [(erkenC[e2], e2) for et, e2 in erkenT if et < ts and not et <= ZAYIF and genc(et) == genc(t)]
            if erkenC[e] < 5 and yaygin and max(yaygin)[0] >= 10 * erkenC[e]: e = max(yaygin)[1]
            harita[k] = e; continue
        uy = [(len(et), erkenC[e], e, et) for et, e in erkenT if et and et <= ts and genc(et) == g and not et <= ZAYIF]
        if not uy: continue
        en = max(u[0] for u in uy)
        tepe = [u for u in uy if u[0] == en]
        # "RCD Espanyol de Barcelona": hem Espanyol hem Barcelona alt küme → belirsiz, eşleme yok (elle)
        if len({frozenset(u[3]) for u in tepe}) > 1 and k not in ELLE:
            belirsiz.append(k); continue
        if k not in ELLE and k not in ONAYLI_ALTKUME: altkume.append((say_tum[k], k, max(tepe)[2])); continue
        harita[k] = max(tepe)[2]
    for k, v in ELLE.items():
        if k in say_tum and v in erkenC: harita[k] = v
    rapor.append(f"\nKULÜP ADI DÜZELTİLDİ: {len(harita)}")
    say = collections.Counter(k for x in pl[SINIR:] for k in x["clubs"])
    rapor += [f"  {say[k]:4}  {k}  ->  {v}" for k, v in sorted(harita.items(), key=lambda t: -say[t[0]])]
    rapor.append(f"\nALT KÜME ÖNERİSİ (otomatik uygulanmadı, elle bakılmalı): {len(altkume)}")
    rapor += [f"  {n:4}  {k}  ?->  {v}" for n, k, v in sorted(altkume, reverse=True)]
    rapor.append(f"\nBELİRSİZ (dokunulmadı): {len(belirsiz)}")
    rapor += [f"  {say[k]:4}  {k}" for k in sorted(belirsiz, key=lambda k: -say[k])]

    # ---- uygula
    yeni = []
    for x in pl:
        n = x["name"]
        if n in kadinlar or n in silinen: continue
        if sira[n] >= SINIR:
            kl = []
            for k in x["clubs"]:
                k = harita.get(k, k)
                if k not in kl: kl.append(k)
            x = {**x, "clubs": kl}
        yeni.append(x)
    for git, kal in silinen.items():
        for ad, d in dosya.items():
            if git in d:
                if kal not in d: d[kal] = d[git]
                del d[git]
        l = takma.setdefault(kal, [])
        for t in [git] + takma.pop(git, []):
            if t not in l and t != kal: l.append(t)
    for n in kadinlar:
        for d in dosya.values(): d.pop(n, None)
        takma.pop(n, None)
    # kadrolar / günlük takvim: silinen adları kalan ada çevir (metin düzeyinde, tam ad)
    metin_degisim = 0
    for ad in ["kadrolar", "gunlukTakvim"]:
        yol = os.path.join(LIB, ad + ".json")
        s = open(yol, encoding="utf-8").read(); s0 = s
        for git, kal in silinen.items():
            s = s.replace(json.dumps(git, ensure_ascii=False), json.dumps(kal, ensure_ascii=False))
        metin_degisim += s != s0
        if not a.deneme and s != s0: open(yol, "w", encoding="utf-8").write(s)
    rapor.insert(0, f"oyuncu: {len(pl)} -> {len(yeni)}")
    os.makedirs(os.path.join(KOK, "veri"), exist_ok=True)
    open(os.path.join(KOK, "veri", "birlestirme_raporu.txt"), "w", encoding="utf-8").write("\n".join(rapor))
    print("\n".join(rapor[:3]), f"\n… rapor: veri/birlestirme_raporu.txt  (kadro/takvim dosyası değişti: {metin_degisim})")
    if a.deneme: return
    yaz_json("players", yeni)
    for ad, d in dosya.items(): yaz_json(ad, d)
    yaz_json("playerAliases", dict(sorted(takma.items())))

if __name__ == "__main__":
    main()
