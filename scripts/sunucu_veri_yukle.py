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
import argparse, io, json, os, sys, time

try:
    import requests
except ImportError:
    print("requests kurulu degil:  pip install requests"); sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYERS_YOLU = os.path.join(KOK, "lib", "players.json")
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


def veri_hazirla():
    with io.open(PLAYERS_YOLU, encoding="utf-8") as f:
        oyuncular = json.load(f)
    kulup_adlari = sorted({c for p in oyuncular for c in (p.get("clubs") or [])})
    kulup_id = {ad: i + 1 for i, ad in enumerate(kulup_adlari)}
    clubs = [{"id": kulup_id[ad], "name": ad} for ad in kulup_adlari]
    players, player_clubs = [], []
    for i, p in enumerate(oyuncular, 1):
        players.append({"id": i, "name": p["name"]})
        for c in sorted(set(p.get("clubs") or [])):
            player_clubs.append({"player_id": i, "club_id": kulup_id[c]})
    return clubs, players, player_clubs


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

    clubs, players, player_clubs = veri_hazirla()
    print("Yuklenecek: %d kulup, %d oyuncu, %d oyuncu-kulup baglantisi"
          % (len(clubs), len(players), len(player_clubs)))
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

    print("1/4 Eski veri siliniyor...")
    r = istek(oturum, "POST", proje + "/rest/v1/rpc/veri_sifirla", data="{}")
    if r.status_code >= 300:
        print("   HATA (%s): %s" % (r.status_code, r.text[:400]))
        print("   Once supabase/online_onarim.sql dosyasini SQL Editor'de calistirdin mi?")
        return 1

    for sira, (tablo, satirlar) in enumerate(
            [("clubs", clubs), ("players", players), ("player_clubs", player_clubs)], 2):
        print("%d/4 %s yukleniyor (%d satir)..." % (sira, tablo, len(satirlar)))
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

    print("\nTAMAM. Online modlar artik uygulamadaki guncel veriyi kullaniyor.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
