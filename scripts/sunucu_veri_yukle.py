# -*- coding: utf-8 -*-
"""
ONLINE MODLARIN OYUNCU/KULÜP VERİSİNİ GÜNCELLE (Supabase)

27 Eylül 2026 — online "klasik" düello, tur üretimini ve cevap kontrolünü
SUNUCUDA yapıyor (hile olmasın diye). Sunucudaki clubs / players /
player_clubs tabloları Ağustos'ta bir kez doldurulmuştu; o günden beri
uygulamadaki veri çok değişti (kulüp birleştirmeleri: Başakşehir, Gaziantep
FK, Erzurumspor..., yeni oyuncular). Bu script sunucuyu uygulamadaki
lib/players.json ile BİREBİR aynı hale getirir.

ÖNCE (bir kez): supabase/online_onarim.sql dosyasını Supabase SQL Editor'de
çalıştır. Bu script onun eklediği veri_sifirla() fonksiyonunu kullanıyor.

KULLANIM (PowerShell, proje klasöründe):
  $env:SUPABASE_SERVICE_KEY="eyJ..."
  python scripts/sunucu_veri_yukle.py

  # sadece ne yükleneceğini say, hiçbir şeyi değiştirme:
  python scripts/sunucu_veri_yukle.py --deneme

ANAHTAR: service_role anahtarı uygulamaya GÖMÜLMEZ. Sadece --key ile ya da
SUPABASE_SERVICE_KEY ortam değişkeniyle verilir.
"""
import argparse, io, json, os, re, sys, time

try:
    import requests
except ImportError:
    print("requests kurulu degil:  pip install requests"); sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYERS_YOLU = os.path.join(KOK, "lib", "players.json")
ALIAS_YOLU = os.path.join(KOK, "lib", "clubAliases.js")
CIFT_YOLU = os.path.join(KOK, "scripts", "cift_havuzu.json")
PARCA = 5000  # tek istekte gönderilen satır sayısı


def env_oku(anahtar):
    for ad in (".env", ".env.local"):
        yol = os.path.join(KOK, ad)
        if not os.path.exists(yol):
            continue
        try:
            with io.open(yol, encoding="utf-8") as f:
                for satir in f:
                    satir = satir.strip()
                    if satir.startswith(anahtar + "="):
                        return satir.split("=", 1)[1].strip().strip('"').strip("'")
        except Exception:
            pass
    return ""


def kanonik_harita():
    """Paket 28: lib/clubAliases.js'teki CLUB_ALIAS_GROUPS -> {varyant: kanonik}.
    Uygulama "Celta" ile "Celta Vigo"yu aynı kulüp sayıyor; sunucu da saysın diye
    her oyuncu kulübünün KANONİK adıyla da eşleştirilir."""
    harita = {}
    if not os.path.exists(ALIAS_YOLU):
        return harita
    with io.open(ALIAS_YOLU, encoding="utf-8") as f:
        metin = f.read()
    i = metin.find("export const CLUB_ALIAS_GROUPS = {")
    if i < 0:
        return harita
    blok = metin[i:metin.find("\n};", i)]
    for m in re.finditer(r'^\s*"([^"]+)":\s*\[([^\]]*)\]', blok, re.M):
        for v in re.findall(r'"([^"]+)"', m.group(2)):
            harita[v] = m.group(1)
    return harita


def veri_hazirla():
    with io.open(PLAYERS_YOLU, encoding="utf-8") as f:
        oyuncular = json.load(f)
    kanon = kanonik_harita()
    kulup_adlari = sorted({x for p in oyuncular for c in (p.get("clubs") or []) for x in (c, kanon.get(c, c))})
    kulup_id = {ad: i + 1 for i, ad in enumerate(kulup_adlari)}
    clubs = [{"id": kulup_id[ad], "name": ad} for ad in kulup_adlari]
    players, player_clubs = [], []
    for i, p in enumerate(oyuncular, 1):
        players.append({"id": i, "name": p["name"]})
        for c in sorted({x for c in (p.get("clubs") or []) for x in (c, kanon.get(c, c))}):
            player_clubs.append({"player_id": i, "club_id": kulup_id[c]})
    return clubs, players, player_clubs, takma_adlar(players), cift_havuzu(kulup_id)


def cift_havuzu(kulup_id):
    """Paket 28: scripts/cift_havuzu.json -> club_pairs satırları (bkz. supabase/paket28_cift_havuzu.sql)."""
    if not os.path.exists(CIFT_YOLU):
        return []
    with io.open(CIFT_YOLU, encoding="utf-8") as f:
        veri = json.load(f)
    satirlar = []
    for a, b, n, z in veri.get("ciftler", []):
        if a in kulup_id and b in kulup_id and a != b:
            satirlar.append({"club_a_id": kulup_id[a], "club_b_id": kulup_id[b], "cevap": n, "zorluk": z})
    return satirlar


def takma_adlar(players):
    """28 Eylul 2026: lib/playerAliases.json (birlesen cift kayitlar) + gameEngine.js'teki
    TEK_ISIM_TAKMA_ADLARI -> [{player_id, alias}]. Sunucu cevap kontrolu bunlari da kabul eder."""
    idler = {}
    for p in players:
        idler.setdefault(p["name"], []).append(p["id"])
    kaynak = {}
    yol = os.path.join(os.path.dirname(PLAYERS_YOLU), "playerAliases.json")
    if os.path.exists(yol):
        with io.open(yol, encoding="utf-8") as f:
            for ad, liste in json.load(f).items():
                kaynak.setdefault(ad, set()).update(liste)
    yol = os.path.join(os.path.dirname(PLAYERS_YOLU), "gameEngine.js")
    if os.path.exists(yol):
        with io.open(yol, encoding="utf-8") as f:
            metin = f.read()
        i = metin.find("export const TEK_ISIM_TAKMA_ADLARI = {")
        if i >= 0:
            blok = metin[i:metin.find("};", i)]
            for m in re.finditer(r'"([^"]+)":\s*\[([^\]]*)\]', blok):
                kaynak.setdefault(m.group(1), set()).update(re.findall(r'"([^"]+)"', m.group(2)))
    satirlar = []
    for ad, liste in kaynak.items():
        for pid in idler.get(ad, []):
            for t in sorted(liste):
                satirlar.append({"player_id": pid, "alias": t})
    return satirlar


def istek(oturum, yontem, url, **kw):
    for deneme in range(4):
        try:
            r = oturum.request(yontem, url, timeout=120, **kw)
        except requests.RequestException as hata:
            if deneme == 3:
                raise
            print("   ag hatasi (%s), tekrar deneniyor..." % hata)
            time.sleep(2 * (deneme + 1))
            continue
        if r.status_code >= 500 and deneme < 3:
            time.sleep(2 * (deneme + 1))
            continue
        return r
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", help="service_role anahtari")
    ap.add_argument("--url", help="Supabase proje adresi")
    ap.add_argument("--deneme", action="store_true", help="hicbir seyi degistirme, sadece say")
    a = ap.parse_args()

    clubs, players, player_clubs, takmalar, ciftler = veri_hazirla()
    print("Yuklenecek: %d kulup, %d oyuncu, %d oyuncu-kulup baglantisi, %d takma ad, %d kulup cifti"
          % (len(clubs), len(players), len(player_clubs), len(takmalar), len(ciftler)))
    if a.deneme:
        print("--deneme: sunucuya dokunulmadi.")
        return 0

    proje = (a.url or env_oku("EXPO_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    anahtar = a.key or os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not proje:
        print("Supabase adresi yok. --url ile ver ya da .env icine EXPO_PUBLIC_SUPABASE_URL koy."); return 1
    if not anahtar:
        print("service_role anahtari yok. PowerShell'de once sunu yaz:")
        print('  $env:SUPABASE_SERVICE_KEY="eyJ..."   ya da   --key eyJ...'); return 1

    oturum = requests.Session()
    oturum.headers.update({
        "apikey": anahtar,
        "Authorization": "Bearer " + anahtar,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    })

    print("1/6 Eski veri siliniyor...")
    r = istek(oturum, "POST", proje + "/rest/v1/rpc/veri_sifirla", data="{}")
    if r.status_code >= 300:
        print("   HATA (%s): %s" % (r.status_code, r.text[:400]))
        print("   Once supabase/online_onarim.sql dosyasini SQL Editor'de calistirdin mi?")
        return 1

    for sira, (tablo, satirlar) in enumerate(
            [("clubs", clubs), ("players", players), ("player_clubs", player_clubs)], 2):
        print("%d/6 %s yukleniyor (%d satir)..." % (sira, tablo, len(satirlar)))
        for bas in range(0, len(satirlar), PARCA):
            parca = satirlar[bas:bas + PARCA]
            r = istek(oturum, "POST", proje + "/rest/v1/" + tablo,
                      data=json.dumps(parca, ensure_ascii=False).encode("utf-8"))
            if r.status_code >= 300:
                print("   HATA (%s) %s satir %d: %s" % (r.status_code, tablo, bas, r.text[:400]))
                print("   Script'i tekrar calistirabilirsin; her seferinde bastan temiz yukler.")
                return 1
            print("   %d / %d" % (min(bas + PARCA, len(satirlar)), len(satirlar)), end="\r")
        print()

    # Takma adlar: tablo yoksa (supabase/takma_adlar.sql calismamissa) atlanir.
    print("5/6 takma adlar yukleniyor (%d satir)..." % len(takmalar))
    for bas in range(0, len(takmalar), PARCA):
        r = istek(oturum, "POST", proje + "/rest/v1/player_aliases",
                  data=json.dumps(takmalar[bas:bas + PARCA], ensure_ascii=False).encode("utf-8"))
        if r.status_code >= 300:
            print("   UYARI: takma adlar yuklenemedi (%s). supabase/takma_adlar.sql dosyasini"
                  " SQL Editor'de calistirip bu scripti tekrar calistir." % r.status_code)
            break

    # Paket 28: kulup cifti havuzu (tablo yoksa supabase/paket28_cift_havuzu.sql calismamistir).
    print("6/6 kulup cifti havuzu yukleniyor (%d satir)..." % len(ciftler))
    for bas in range(0, len(ciftler), PARCA):
        r = istek(oturum, "POST", proje + "/rest/v1/club_pairs",
                  data=json.dumps(ciftler[bas:bas + PARCA], ensure_ascii=False).encode("utf-8"))
        if r.status_code >= 300:
            print("   UYARI: cift havuzu yuklenemedi (%s): %s" % (r.status_code, r.text[:200]))
            print("   supabase/paket28_cift_havuzu.sql dosyasini SQL Editor'de calistirip bu scripti tekrar calistir.")
            break

    print("\nTAMAM. Online modlar artik uygulamadaki guncel veriyi kullaniyor.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
