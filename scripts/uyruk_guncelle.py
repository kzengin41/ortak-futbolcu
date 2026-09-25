# -*- coding: utf-8 -*-
"""
OYUNCU UYRUKLARINI WIKIPEDIA KATEGORİLERİNDEN DOLDURUR.

NİYE GEREKLİ (11 Eylül 2026, Kerem: "Ülke-Takım modunda hâlâ yalnızca milli
takımda oynamış mı diye kontrol ediyor. Fransa-GS: Sacha Boey kabul edilmeli,
milli takım şartı yok."):
`lib/gameEngine.js` önce `PLAYER_NATIONALITY`'ye bakıyor, orası boşsa milli
takım kaydına düşüyor. Kontrol ettim: `lib/playerNationality.js` içinde
SADECE 9 kayıt var — yani eski backfill script'i günlerce çalışmış ama
neredeyse hiçbir şey yazamamış. Bu yüzden mod hâlâ "milli takımda oynadı mı"
diye soruyor ve Sacha Boey gibi milli takım kaydı olmayan oyuncular
reddediliyor.

BU SCRIPT NASIL ÇALIŞIYOR (ve neden hızlı)
Wikipedia API'si TEK İSTEKTE 50 sayfanın kategorilerini verebiliyor. Oyuncu
makalelerindeki "Category:Turkish men's footballers" / "Category:French
footballers" gibi kategorilerden uyruk çıkarılıyor. 46 bin oyuncu ≈ 930 istek
≈ yarım saat. (Eski yöntem oyuncu başına ayrı istek attığı için günlerce
sürüyordu.)

Milli takım verisi SİLİNMİYOR; uyruk sadece ONUN ÜSTÜNE, daha doğru bir
kaynak olarak yazılıyor.

KULLANIM
    python scripts/uyruk_guncelle.py                 # en popüler 5000 oyuncu
    python scripts/uyruk_guncelle.py --limit 0       # hepsi (~30-40 dk)
    python scripts/uyruk_guncelle.py --deneme        # hiçbir şey yazma

Kaldığı yerden devam eder (uyruk_ilerleme.json). Çıktı: lib/playerNationality.js
"""

import argparse
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
PLAYERS_YOLU = os.path.join(KOK, "lib", "players.json")
POP_YOLU = os.path.join(KOK, "lib", "playerPopularity.json")
COUNTRIES_YOLU = os.path.join(KOK, "lib", "countries.json")
CIKTI = os.path.join(KOK, "lib", "playerNationality.js")
ILERLEME = os.path.join(KOK, "uyruk_ilerleme.json")
API = "https://en.wikipedia.org/w/api.php"

# "Category:<Demonim> men's footballers" -> ülke adı (countries.json anahtarı)
DEMONIM = {
    "Turkish": "Turkey", "English": "England", "German": "Germany", "French": "France",
    "Spanish": "Spain", "Italian": "Italy", "Portuguese": "Portugal", "Dutch": "Netherlands",
    "Belgian": "Belgium", "Brazilian": "Brazil", "Argentine": "Argentina", "Argentinian": "Argentina",
    "Uruguayan": "Uruguay", "Croatian": "Croatia", "Serbian": "Serbia", "Polish": "Poland",
    "Czech": "Czech Republic", "Austrian": "Austria", "Swiss": "Switzerland", "Danish": "Denmark",
    "Swedish": "Sweden", "Norwegian": "Norway", "Ukrainian": "Ukraine", "Russian": "Russia",
    "Greek": "Greece", "Welsh": "Wales", "Scottish": "Scotland",
    "Northern Irish": "Northern Ireland", "Irish": "Republic of Ireland",
    "Romanian": "Romania", "Hungarian": "Hungary", "Slovak": "Slovakia", "Slovenian": "Slovenia",
    "Bosnian": "Bosnia and Herzegovina", "Bosnia and Herzegovina": "Bosnia and Herzegovina",
    "Montenegrin": "Montenegro", "Macedonian": "North Macedonia", "North Macedonian": "North Macedonia",
    "Albanian": "Albania", "Bulgarian": "Bulgaria", "Finnish": "Finland", "Icelandic": "Iceland",
    "Georgian": "Georgia", "Armenian": "Armenia", "Azerbaijani": "Azerbaijan", "Israeli": "Israel",
    "Kosovan": "Kosovo", "Kosovar": "Kosovo", "Cypriot": "Cyprus", "Maltese": "Malta",
    "Luxembourgian": "Luxembourg", "Luxembourgish": "Luxembourg", "Estonian": "Estonia",
    "Latvian": "Latvia", "Lithuanian": "Lithuania", "Moldovan": "Moldova", "Belarusian": "Belarus",
    "Moroccan": "Morocco", "Algerian": "Algeria", "Tunisian": "Tunisia", "Egyptian": "Egypt",
    "Senegalese": "Senegal", "Nigerian": "Nigeria", "Ghanaian": "Ghana",
    "Ivorian": "Ivory Coast", "Cameroonian": "Cameroon", "Malian": "Mali",
    "South African": "South Africa", "Congolese": "DR Congo",
    "Democratic Republic of the Congo": "DR Congo", "Zambian": "Zambia", "Guinean": "Guinea",
    "Burkinabé": "Burkina Faso", "Burkinabe": "Burkina Faso", "Gabonese": "Gabon",
    "Cape Verdean": "Cape Verde", "Angolan": "Angola", "Tanzanian": "Tanzania", "Kenyan": "Kenya",
    "Ugandan": "Uganda", "Equatoguinean": "Equatorial Guinea", "Togolese": "Togo",
    "Beninese": "Benin", "Mauritanian": "Mauritania", "Libyan": "Libya", "Sudanese": "Sudan",
    "Zimbabwean": "Zimbabwe", "Mozambican": "Mozambique", "Namibian": "Namibia",
    "Botswana": "Botswana", "Comorian": "Comoros", "Gambian": "Gambia",
    "Sierra Leonean": "Sierra Leone", "Rwandan": "Rwanda", "Nigerien": "Niger", "Chadian": "Chad",
    "Ethiopian": "Ethiopia", "Liberian": "Liberia", "Swazi": "Eswatini", "Basotho": "Lesotho",
    "Burundian": "Burundi", "Malagasy": "Madagascar", "Malawian": "Malawi",
    "Mexican": "Mexico", "American": "United States", "Canadian": "Canada",
    "Colombian": "Colombia", "Chilean": "Chile", "Peruvian": "Peru", "Ecuadorian": "Ecuador",
    "Paraguayan": "Paraguay", "Bolivian": "Bolivia", "Venezuelan": "Venezuela",
    "Costa Rican": "Costa Rica", "Jamaican": "Jamaica", "Panamanian": "Panama",
    "Honduran": "Honduras", "Salvadoran": "El Salvador", "Guatemalan": "Guatemala",
    "Trinidadian": "Trinidad and Tobago", "Haitian": "Haiti", "Curaçaoan": "Curaçao",
    "Japanese": "Japan", "South Korean": "South Korea", "Australian": "Australia",
    "Saudi Arabian": "Saudi Arabia", "Iranian": "Iran", "Iraqi": "Iraq", "Qatari": "Qatar",
    "Emirati": "United Arab Emirates", "Jordanian": "Jordan", "Chinese": "China",
    "Indian": "India", "Kazakhstani": "Kazakhstan", "Uzbekistani": "Uzbekistan",
    "New Zealand": "New Zealand", "Lebanese": "Lebanon", "Syrian": "Syria", "Kuwaiti": "Kuwait",
    "Bahraini": "Bahrain", "Omani": "Oman", "Palestinian": "Palestine", "Vietnamese": "Vietnam",
    "Thai": "Thailand", "Indonesian": "Indonesia", "Malaysian": "Malaysia",
    "North Korean": "North Korea", "Andorran": "Andorra", "Sammarinese": "San Marino",
    "Liechtenstein": "Liechtenstein", "Gibraltarian": "Gibraltar", "Faroese": "Faroe Islands",
    "Monégasque": "Monaco", "Monegasque": "Monaco", "Bahamian": "Bahamas",
    "Barbadian": "Barbados", "Cuban": "Cuba", "Dominican": "Dominican Republic",
    "Puerto Rican": "Puerto Rico", "Bermudian": "Bermuda", "Guyanese": "Guyana",
    "Surinamese": "Suriname", "Belizean": "Belize", "Nicaraguan": "Nicaragua",
    "Grenadian": "Grenada", "Saint Lucian": "Saint Lucia", "Aruban": "Aruba",
    "Fijian": "Fiji", "Papua New Guinean": "Papua New Guinea", "Vanuatuan": "Vanuatu",
    "Tahitian": "Tahiti", "New Caledonian": "New Caledonia", "Samoan": "Samoa",
    "Tongan": "Tonga", "Guamanian": "Guam", "Kyrgyzstani": "Kyrgyzstan",
    "Tajikistani": "Tajikistan", "Turkmenistani": "Turkmenistan", "Afghan": "Afghanistan",
    "Mongolian": "Mongolia", "Nepalese": "Nepal", "Bangladeshi": "Bangladesh",
    "Pakistani": "Pakistan", "Sri Lankan": "Sri Lanka", "Burmese": "Myanmar",
    "Cambodian": "Cambodia", "Laotian": "Laos", "Bruneian": "Brunei",
    "Filipino": "Philippines", "Singaporean": "Singapore", "Maldivian": "Maldives",
    "Bhutanese": "Bhutan", "East Timorese": "East Timor", "Hong Kong": "Hong Kong",
    "Taiwanese": "Chinese Taipei", "Macanese": "Macau", "Yemeni": "Yemen",
    "Somali": "Somalia", "Djiboutian": "Djibouti", "Eritrean": "Eritrea",
    "South Sudanese": "South Sudan", "Central African": "Central African Republic",
    "São Toméan": "São Tomé and Príncipe", "Seychellois": "Seychelles",
    "Mauritian": "Mauritius", "Bissau-Guinean": "Guinea-Bissau",
    "Martiniquais": "Martinique", "Guadeloupean": "Guadeloupe",
    "East German": "East Germany",
    # 11 Eylul 2026 — ikinci turun "eslestirilemeyen demonim" raporundan.
    # Bati Almanya oyuncusu bugun Alman'dir, guvenli eslesme.
    "West German": "Germany",
    # BILEREK EKLENMEDI: "Yugoslav" (317), "Serbia and Montenegro" (187),
    # "Soviet" ve "Czechoslovak". Bu devletler birden fazla bugunku ulkeye
    # bolundu; hepsini tek bir ulkeye yazmak oyunda YANLIS cevabi dogru
    # saydirir. Bilgisiz kalmak yanlis bilmekten iyi.
}

# "Turkish men's footballers", "Turkish footballers", "Turkish international footballers",
# "Turkish expatriate footballers" ... hepsinden demonimi çekiyoruz.
# 11 Eylul 2026 — --incele ciktisi iki kaybi gosterdi:
#   "Nigerian expatriate men's footballers" -> demonim "Nigerian expatriate"
#      cunku eski desen "men's"i MUTLAKA once bekliyordu; Wikipedia'da sira
#      degisebiliyor ("expatriate men's"). Artik butun niteleyiciler HERHANGI
#      BIR SIRADA ve tekrarli gelebilir.
#   "Nigeria men's international footballers" -> demonim "Nigeria", yani
#      ULKE ADININ KENDISI. DEMONIM'de karsiligi yok ama countries.json'da
#      gecerli bir ulke — bu yuzden asagida ikinci bir yol olarak kabul
#      ediliyor (milli takim kategorisi, uyruk icin saglam bir isaret).
KATEGORI = re.compile(
    r"^(?:Category:)?(.+?)\s+(?:(?:men's|women's|expatriate|international|association|youth|amateur|dual|under-\d+|B)\s+)*footballers$",
    re.IGNORECASE)


# Ayni klasordeki yardimci modul (oncelik.py) — script nereden calistirilirsa
# calistirilsin bulunsun diye yol ekleniyor.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from oncelik import oncelik_sirala  # noqa: E402


def json_oku(yol, varsayilan):
    if not os.path.exists(yol):
        return varsayilan
    with open(yol, "r", encoding="utf-8") as f:
        return json.load(f)


def _tek_istek(oturum, params, bekleme, deneme=4):
    for i in range(deneme):
        try:
            r = oturum.get(API, params=params, timeout=30)
            if r.status_code in (429, 503):
                time.sleep(5 * (i + 1))
                continue
            if r.status_code != 200:
                time.sleep(bekleme)
                continue
            time.sleep(bekleme)
            return r.json()
        except Exception:
            time.sleep(2 * (i + 1))
    return None


def kategori_iste(oturum, basliklar, bekleme, deneme=4):
    """50 baslik icin kategorileri, DEVAM (continue) jetonlarini da izleyerek
    eksiksiz toplar.

    11 Eylul 2026 — ASIL KOK NEDEN BUYDU. `cllimit=max` sayfa basina degil
    ISTEK BASINA 500 kategori demek. 50 baslik x ~30 kategori = 1500 istiyoruz;
    API ilk 500'u verip gerisini `continue` jetonuna birakiyordu ve bu kod o
    jetonu hic kullanmiyordu. Sonuc: her gruptan sadece ILK ~14 oyuncunun
    kategorileri geliyor, kalan 36'si "kategorisi yok" gibi gorunup uyruksuz
    isaretleniyordu. Ilk turun %34'te (15.707/46.291) takilmasinin sebebi bu.
    Tek basina --incele ile test edince (3 baslik, 500 limitin altinda) sorun
    hic gorunmuyordu.
    """
    temel = {
        "action": "query", "prop": "categories", "cllimit": "max",
        "titles": "|".join(basliklar), "format": "json", "formatversion": 2,
        "redirects": 1, "clshow": "!hidden",
    }
    birlesik, meta, ekler = {}, {"normalized": [], "redirects": []}, {}
    for _ in range(40):                      # guvenlik sinirI (sonsuz donguye karsi)
        params = dict(temel)
        params.update(ekler)
        d = _tek_istek(oturum, params, bekleme, deneme)
        if d is None:
            return None if not birlesik else {"query": dict(meta, pages=list(birlesik.values()))}
        q = d.get("query", {})
        for bolum in ("normalized", "redirects"):
            meta[bolum].extend(q.get(bolum, []) or [])
        for sayfa in q.get("pages", []) or []:
            t = sayfa.get("title")
            kayit = birlesik.setdefault(t, {"title": t, "categories": []})
            if sayfa.get("missing"):
                kayit["missing"] = True
            kayit["categories"].extend(sayfa.get("categories") or [])
        if d.get("continue"):
            ekler = d["continue"]
            continue
        break
    return {"query": dict(meta, pages=list(birlesik.values()))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=5000, help="Kaç oyuncu (0 = hepsi). Popülerlik sırasıyla.")
    ap.add_argument("--bekleme", type=float, default=1.0)
    ap.add_argument("--deneme", action="store_true")
    ap.add_argument("--bossuz-tekrar", dest="bossuz_tekrar", action="store_true",
                    help="Daha once sorgulanip UYRUGU BULUNAMAYANLARI yeniden dene")
    ap.add_argument("--incele", default="",
                    help="Virgulle ayrilmis isimler icin HAM kategori ciktisini yaz (teshis)")
    a = ap.parse_args()

    players = json_oku(PLAYERS_YOLU, [])
    pop = json_oku(POP_YOLU, {})
    gecerli_ulkeler = set(json_oku(COUNTRIES_YOLU, {}).keys())

    ilerleme = json_oku(ILERLEME, {"uyruk": {}, "islenen": []})
    uyruk = ilerleme.get("uyruk", {})
    islenen = set(ilerleme.get("islenen", []))

    # 11 Eylul 2026 — KOK NEDEN BULUNDU: burasi eskiden
    # lib/playerPopularity.json'a gore siraliyordu. O dosya 46.390 oyuncunun
    # sadece 77'si icin puan iceriyor (gerisi 0), yani sira aslinda RASTGELEYDI.
    # Sonuc: 15.707 oyuncu islenmesine ragmen Sacha Boey, Osimhen ve Kerem
    # Akturkoglu atlanmisti. Artik oyunun kendi mantigi (kulup sohreti x
    # guncellik, bkz. scripts/oncelik.py) kullaniliyor — o siralamada Boey
    # 239., Akturkoglu 150. sirada.
    sirali = oncelik_sirala(players)

    if a.incele:
        # TESHIS: Wikipedia'nin bu isimler icin TAM olarak ne dondurdugunu yaz.
        oturum = requests.Session()
        oturum.headers.update({"User-Agent": "OrtakFutbolcuBot/1.0 (uyruk teshis) python-requests"})
        adlar = [x.strip() for x in a.incele.split(",") if x.strip()]
        d = kategori_iste(oturum, adlar, a.bekleme)
        if not d:
            print("Wikipedia'dan yanit alinamadi.")
            return
        q = d.get("query", {})
        for bolum in ("normalized", "redirects"):
            for m in q.get(bolum, []) or []:
                print("[%s] %r -> %r" % (bolum, m.get("from"), m.get("to")))
        for sayfa in q.get("pages", []):
            print("\n=== %r ===" % sayfa.get("title"))
            if sayfa.get("missing"):
                print("   SAYFA YOK")
                continue
            kats = [k.get("title", "").replace("Category:", "") for k in (sayfa.get("categories") or [])]
            futbol = [k for k in kats if k.lower().endswith("footballers")]
            print("   toplam kategori: %d,  'footballers' ile biten: %d" % (len(kats), len(futbol)))
            for k in futbol:
                m = KATEGORI.match(k)
                if m:
                    dem = m.group(1).strip()
                    print("      %-52s -> demonim %r -> %r" % (k, dem, DEMONIM.get(dem, "(DEMONIM'DE YOK)")))
                else:
                    print("      %-52s -> REGEX ESLESMEDI" % k)
            if not futbol:
                print("      (ornek kategoriler: %s)" % "; ".join(kats[:6]))
        return

    # 11 Eylul 2026 — IKINCI TUR BULGUSU: 46.291 oyuncu "islendi" ama sadece
    # 15.707'sinin uyrugu bulunmus. Yani sorun siralama degil, CIKARMA. Bu
    # bayrak, sorgulanmis ama sonuc vermemis olanlari yeniden denemeyi saglar.
    if a.bossuz_tekrar:
        adaylar = [ad for ad in sirali if ad not in uyruk]
        print("Uyrugu OLMAYAN (yeniden denenecek): %d" % len(adaylar))
    else:
        adaylar = [ad for ad in sirali if ad not in islenen]
    if a.limit > 0:
        adaylar = adaylar[: a.limit]
    if adaylar:
        print("Ilk 5 sirada: %s" % ", ".join(adaylar[:5]))

    print("Sorgulanacak oyuncu: %d  (daha önce işlenen: %d)" % (len(adaylar), len(islenen)))
    if not adaylar:
        print("Yapacak bir şey yok.")
        return

    oturum = requests.Session()
    oturum.headers.update({"User-Agent": "OrtakFutbolcuBot/1.0 (uyruk backfill) python-requests"})

    bilinmeyen = {}
    bulunan = 0
    basarisiz = 0
    try:
        for i in range(0, len(adaylar), 50):
            grup = adaylar[i:i + 50]
            d = kategori_iste(oturum, grup, a.bekleme)
            if not d:
                # HATA 1 (11 Eylul 2026): eskiden islenen.update(grup) BURADAN
                # ONCE calisiyordu — yani istek 4 denemede de basarisiz olsa
                # 50 kisilik grup "islendi" sayilip BIR DAHA HIC denenmiyordu.
                # Uzun bir turda hiz limitine takilan her grup sessizce
                # kayboluyordu. Artik sadece yanit alinabilen gruplar
                # isaretleniyor.
                basarisiz += len(grup)
                continue
            islenen.update(grup)

            # HATA 2 (11 Eylul 2026): sonuc Wikipedia'nin KANONIK basligiyla
            # geliyor; redirect/normalizasyon varsa bu bizim veri setimizdeki
            # addan FARKLI olabilir ("Kerem Akturkoglu" -> "Kerem Aktürkoğlu"
            # gibi). Kayit o baslikla yazilinca uygulama onu HIC bulamiyordu,
            # cunku PLAYER_NATIONALITY[oyuncu adi] ile ariyor. Artik
            # normalized/redirects haritalari ters cevrilip ORIJINAL ada
            # geri yaziliyor.
            q = d.get("query", {})
            geri = {}
            for bolum in ("normalized", "redirects"):
                for m in q.get(bolum, []) or []:
                    if m.get("to") and m.get("from"):
                        geri[m["to"]] = geri.get(m["from"], m["from"])
            for sayfa in q.get("pages", []):
                baslik = sayfa.get("title")
                ad = geri.get(baslik, baslik)
                ulkeler = []
                for kat in sayfa.get("categories", []) or []:
                    m = KATEGORI.match(kat.get("title", "").replace("Category:", ""))
                    if not m:
                        continue
                    demonim = m.group(1).strip()
                    # Once demonim tablosu ("French" -> France); olmazsa
                    # demonimin kendisi bir ulke adi mi ("Nigeria men's
                    # international footballers" -> "Nigeria").
                    ulke = DEMONIM.get(demonim)
                    if not ulke and demonim in gecerli_ulkeler:
                        ulke = demonim
                    if ulke and ulke in gecerli_ulkeler:
                        if ulke not in ulkeler:
                            ulkeler.append(ulke)
                    elif not ulke:
                        bilinmeyen[demonim] = bilinmeyen.get(demonim, 0) + 1
                if ulkeler:
                    uyruk[ad] = ulkeler
                    bulunan += 1

            if (i // 50) % 10 == 0 or i + 50 >= len(adaylar):
                print("  %d/%d sorgulandı | uyruğu bulunan: %d" % (min(i + 50, len(adaylar)), len(adaylar), bulunan))
                if not a.deneme:
                    with open(ILERLEME, "w", encoding="utf-8") as f:
                        json.dump({"uyruk": uyruk, "islenen": sorted(islenen)}, f, ensure_ascii=False)
    except KeyboardInterrupt:
        print("\nDurduruldu — bulunanlar kaydediliyor...")

    print("\nToplam uyruk kaydı: %d" % len(uyruk))
    if basarisiz:
        print("Yanıt alınamayan oyuncu: %d  (tekrar çalıştırınca denenecek)" % basarisiz)
    if bilinmeyen:
        en_cok = sorted(bilinmeyen.items(), key=lambda kv: -kv[1])[:15]
        print("Eşleştirilemeyen demonimler (scripts/uyruk_guncelle.py içindeki DEMONIM'e eklenebilir):")
        for d, n in en_cok:
            print("   %-26s %d" % (d, n))

    if a.deneme:
        print("\n--deneme modu: dosya yazılmadı.")
        return

    with open(ILERLEME, "w", encoding="utf-8") as f:
        json.dump({"uyruk": uyruk, "islenen": sorted(islenen)}, f, ensure_ascii=False)

    govde = json.dumps(uyruk, ensure_ascii=False)
    icerik = (
        "// Her oyuncunun GERÇEK UYRUĞU (milli takım kaydından BAĞIMSIZ).\n"
        "// Wikipedia kategorilerinden çıkarıldı: scripts/uyruk_guncelle.py\n"
        "// Milli takım geçmişi (caps) için hâlâ lib/playerNationalTeams.js var —\n"
        "// bu o değil, sadece uyruk. Ülke-Takım modu önce BURAYA bakıyor.\n"
        "// Kayıt sayısı: %d\n"
        "export const PLAYER_NATIONALITY = %s;\n" % (len(uyruk), govde)
    )
    gecici = CIKTI + ".tmp"
    with open(gecici, "w", encoding="utf-8") as f:
        f.write(icerik)
    os.replace(gecici, CIKTI)
    print("lib/playerNationality.js yazıldı (%d oyuncu)." % len(uyruk))


if __name__ == "__main__":
    main()
