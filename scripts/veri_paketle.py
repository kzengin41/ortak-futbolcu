"""
VERİ PAKETLEYİCİ — Paket 22 (5 Ekim 2026, Kerem: "uygulama boyutu bayağı arttı")

NİYE: lib/*.json dosyaları Metro'da JS modülüne, Hermes'te BAYTKODA çevriliyor
ve React Native paketi (index.android.bundle) APK'nın içinde SIKIŞTIRILMADAN
duruyor (RN gradle eklentisi: noCompress "bundle"). Ölçüm (hermesc -O):
    playerProfiles.json  10.1 MB ham -> 11.5 MB baytkod
    playerPhotos.json     4.1 MB     ->  4.4 MB
    players.json          6.7 MB     ->  3.5 MB
    playerFame.json       1.4 MB     ->  2.4 MB
    playerBirthPosition   3.0 MB     ->  1.8 MB
    playerYears.json      1.1 MB     ->  1.3 MB
    playerNationalTeams   0.4 MB     ->  0.6 MB
Her OTA güncellemesi de bu paketin tamamını yeniden indiriyor.

NE YAPIYOR: Aynı veriyi çok daha küçük bir biçimde lib/paket/*.js olarak yazar:
  - Tekrar eden her yazı (kulüp, kupa, mevki adı...) bir SÖZLÜĞE bir kez girer;
    değerlerde yalnız sırası (sayı + 0.5) geçer.
  - Her veri setinin değerleri tek bir ASCII metinde, satır satır durur
    (satır sırası = lib/paket/adlar.js'teki oyuncu sırası). Hermes ASCII
    metni bayt başına 1 bayt saklar.
  - Uygulama tarafında lib/paket/coz.js bunları açar; bir oyuncunun değeri
    ancak İLK İSTENDİĞİNDE çözülür. Dışarıya verilen nesne eskisiyle aynı
    davranır: veri["Ad Soyad"] -> eskisiyle birebir aynı değer.

KAYNAK HÂLÂ lib/*.json: Diğer scriptler (ozgecmis_isle.py, taninirlik vb.)
JSON'u yazmaya devam eder. Bir JSON değişince BU SCRIPT'İ ÇALIŞTIR:
    python scripts\\veri_paketle.py
Script her paketin içine kaynağın özetini (sha1) yazar; `--denetle` ile
paketlerin kaynakla uyumlu olup olmadığına bakılır (eskiyse hata verir).
Her çalıştırmada çözülmüş veriyi kaynakla TEK TEK karşılaştırır.
"""
import hashlib
import json
import os
import sys
from collections import Counter

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(KOK, "lib")
CIKTI = os.path.join(LIB, "paket")

# Sözlüklü satır biçimindeki veri setleri (anahtar = oyuncu adı)
SATIRLI = ["playerProfiles", "playerFame", "playerYears", "playerBirthPosition",
           "playerNationalTeams"]
SUPABASE = "https://fleqohcxmgghvjbepchj.supabase.co/storage/v1/object/public/player-photos/"


def oku(ad):
    yol = os.path.join(LIB, ad + ".json")
    ham = open(yol, "rb").read()
    return json.loads(ham.decode("utf-8")), hashlib.sha1(ham).hexdigest()[:12]


def js_metin(s):
    # JSON metin sabiti JS'te de geçerlidir. U+2028/2029 JS'te sorun çıkarmasın diye kaçırılır.
    return json.dumps(s, ensure_ascii=False).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def ascii_metin(s):
    return json.dumps(s, ensure_ascii=True)


def b36(n):
    if n == 0:
        return "0"
    r = ""
    while n:
        n, k = divmod(n, 36)
        r = "0123456789abcdefghijklmnopqrstuvwxyz"[k] + r
    return r


def yaz(ad, govde):
    os.makedirs(CIKTI, exist_ok=True)
    yol = os.path.join(CIKTI, ad + ".js")
    with open(yol, "w", encoding="utf-8", newline="\n") as f:
        f.write("// OTOMATİK ÜRETİLDİ — scripts/veri_paketle.py. Elle düzenleme; kaynak lib/" + ad.replace("adlar", "players") + ".json\n")
        f.write(govde)
    return os.path.getsize(yol)


def satir_kodla(d, adlar):
    """{ad: değer} -> (sözlük, satırlar). Yalnız bir kez geçen ASCII yazılar yerinde kalır."""
    sayac = Counter()
    kesirler = set()

    def topla(x):
        if isinstance(x, str):
            sayac[x] += 1
        elif isinstance(x, list):
            for y in x:
                topla(y)
        elif isinstance(x, dict):
            for y in x.values():
                topla(y)
        elif isinstance(x, bool) or x is None:
            pass
        elif isinstance(x, (int, float)):
            if isinstance(x, float) and x != x:
                raise ValueError("NaN")
            if isinstance(x, float):
                kesirler.add(x % 1)
        else:
            raise ValueError("desteklenmeyen tür %r" % type(x))

    for v in d.values():
        topla(v)
    # Sözlük referansı = sıra + KESİR. Verideki hiçbir sayının kesir kısmı bu olamaz.
    # İkili tabanda tam gösterilen kesirler: JSON'a yazılıp okununca birebir aynı kalır.
    kesir = next(f for f in (0.5, 0.375, 0.0625, 0.03125, 0.015625) if f not in kesirler)
    sozluk = [s for s, n in sayac.most_common() if n > 1 or not s.isascii()]
    sira = {s: i for i, s in enumerate(sozluk)}
    # Uzun nesne anahtarları ("birthYear", "position"...) her satırda tekrar etmesin:
    # "~<sıra>" kısaltmasına çevrilir, çözücü geri adlandırır (sıra korunur).
    anahtar_sayac = Counter()

    def anahtar_topla(x):
        if isinstance(x, list):
            for y in x:
                anahtar_topla(y)
        elif isinstance(x, dict):
            for k, y in x.items():
                assert not k.startswith("~"), k
                if len(k) > 2:
                    anahtar_sayac[k] += 1
                anahtar_topla(y)

    for v in d.values():
        anahtar_topla(v)
    anahtarlar = [k for k, _ in anahtar_sayac.most_common()]
    asira = {k: "~" + b36(i) for i, k in enumerate(anahtarlar)}

    def kod(x):
        if isinstance(x, str):
            return sira[x] + kesir if x in sira else x
        if isinstance(x, list):
            return [kod(y) for y in x]
        if isinstance(x, dict):
            return {asira.get(k, k): kod(y) for k, y in x.items()}
        if isinstance(x, float) and x == int(x) and abs(x) < 2 ** 53:
            return int(x)   # 100.0 -> 100 (JS'te aynı sayı)
        return x

    satirlar = []
    for a in adlar:
        if a in d:
            s = json.dumps(kod(d[a]), separators=(",", ":"), ensure_ascii=True)
            assert "\n" not in s and s != ""
            satirlar.append(s)
        else:
            satirlar.append("")
    while satirlar and satirlar[-1] == "":
        satirlar.pop()
    return sozluk, satirlar, kesir, anahtarlar


def coz_py(sozluk, satir, kesir, anahtarlar):
    """coz.js'in Python eşi — doğrulama için."""
    def ac(x):
        if isinstance(x, float) and x % 1 == kesir:
            return sozluk[int(x - kesir)]
        if isinstance(x, list):
            return [ac(y) for y in x]
        if isinstance(x, dict):
            return {(anahtarlar[int(k[1:], 36)] if k.startswith("~") else k): ac(y) for k, y in x.items()}
        return x
    return ac(json.loads(satir))


def ana():
    denetle = "--denetle" in sys.argv
    oyuncular, oz_oyuncu = oku("players")
    adlar, gor = [], set()
    for p in oyuncular:
        if p["name"] not in gor:
            gor.add(p["name"]); adlar.append(p["name"])
    veriler = {ad: oku(ad) for ad in SATIRLI + ["playerPhotos"]}
    ekler = sorted({k for ad, (d, _) in veriler.items() for k in d} - gor)
    adlar += ekler
    ozet = hashlib.sha1("".join([oz_oyuncu] + [veriler[a][1] for a in sorted(veriler)]).encode()).hexdigest()[:12]

    if denetle:
        yol = os.path.join(CIKTI, "adlar.js")
        eski = open(yol, encoding="utf-8").read() if os.path.exists(yol) else ""
        if ("ozet: \"%s\"" % ozet) not in eski:
            print("ESKİ: lib/paket kaynak JSON'larla uyumsuz. Çalıştır: python scripts\\veri_paketle.py")
            sys.exit(1)
        print("lib/paket güncel (%s)" % ozet)
        return

    toplam = 0
    # 1) Ad listesi (diğer bütün paketlerin satır sırası)
    toplam += yaz("adlar", "module.exports = { ozet: \"%s\", adlar: %s };\n" % (ozet, js_metin(adlar)))

    # 2) players.json: [{name, clubs}] — sıra ve tekrarlar korunur
    kulupler = [k for k, _ in Counter(c for p in oyuncular for c in p["clubs"]).most_common()]
    ksira = {k: i for i, k in enumerate(kulupler)}
    asira = {a: i for i, a in enumerate(adlar)}
    satir = "\n".join(b36(asira[p["name"]]) + ":" + ",".join(b36(ksira[c]) for c in p["clubs"]) for p in oyuncular)
    toplam += yaz("players", "module.exports = require(\"./coz\").oyuncuListesi(%s, %s);\n" % (js_metin(kulupler), ascii_metin(satir)))
    # doğrulama
    geri = []
    for s in satir.split("\n"):
        a, c = s.split(":")
        geri.append({"name": adlar[int(a, 36)], "clubs": [kulupler[int(x, 36)] for x in c.split(",")] if c else []})
    assert geri == oyuncular, "players geri dönüşü tutmadı"

    # 3) Sözlüklü satır setleri
    for ad in SATIRLI:
        d, _ = veriler[ad]
        sozluk, satirlar, kesir, anahtarlar = satir_kodla(d, adlar)
        for i, a in enumerate(adlar):
            if a in d:
                assert coz_py(sozluk, satirlar[i], kesir, anahtarlar) == d[a], (ad, a)
                assert list(coz_py(sozluk, satirlar[i], kesir, anahtarlar)) == list(d[a]) if isinstance(d[a], dict) else True
            else:
                assert i >= len(satirlar) or satirlar[i] == "", (ad, a)
        toplam += yaz(ad, "module.exports = require(\"./coz\").tembelNesne(%s, %s, %r, %s);\n" % (js_metin(sozluk), ascii_metin("\n".join(satirlar)), kesir, js_metin(anahtarlar)))

    # 4) playerPhotos.json: {ad: url}. Supabase önekli değerler kısaltılır.
    d, _ = veriler["playerPhotos"]
    satirlar, ozel = [], {}
    for a in adlar:
        v = d.get(a)
        if v is None:
            satirlar.append("")
        elif not v.isascii():
            # ASCII olmayan tek bir harf bütün metni Hermes'te 2 bayta çıkarır: bunlar ayrı durur
            ozel[a] = v; satirlar.append("!")
        else:
            assert "\n" not in v and v != "" and not v.startswith("~")
            satirlar.append("~" + v[len(SUPABASE):] if v.startswith(SUPABASE) else v)
    while satirlar and satirlar[-1] == "":
        satirlar.pop()
    govde = "\n".join(satirlar)
    toplam += yaz("playerPhotos", "module.exports = require(\"./coz\").fotoNesnesi(%s, %s, %s);\n" % (js_metin(SUPABASE), ascii_metin(govde), js_metin(ozel)))
    for i, a in enumerate(adlar):
        if a in d:
            s = satirlar[i]
            if s == "!":
                assert ozel[a] == d[a]; continue
            assert (SUPABASE + s[1:] if s.startswith("~") else s) == d[a]

    print("lib/paket yazıldı: %d dosya, %.1f MB (özet %s, %d ad)" % (len(SATIRLI) + 3, toplam / 1e6, ozet, len(adlar)))


if __name__ == "__main__":
    ana()
