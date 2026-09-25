# -*- coding: utf-8 -*-
"""
FOTOĞRAFLARI GÖZLE KONTROL SAYFASI ÜRETİR.

NEDEN (7 Eylül 2026, Kerem: "sportsdb_foto_cek.py ile gelen resimleri nereden
görebilirim? düzeldi mi bakmak için falan"):
Script'in bulduğu fotoğraflar `lib/playerPhotos.json`'a yazılıyor ama JSON'a
bakarak "bu gerçekten doğru futbolcu mu, resim açılıyor mu" anlaşılmıyor.
Bu script tek bir HTML sayfası üretiyor; çift tıklayıp tarayıcıda açıyorsun,
bütün fotoğraflar isimleriyle birlikte ızgara hâlinde geliyor. Yüklenemeyen
resimlerin çerçevesi KIRMIZI oluyor, böylece kırık kayıtlar hemen göze
çarpıyor. Üstteki düğmelerle "sadece kırıklar" / "sadece TheSportsDB" gibi
süzme yapabiliyorsun.

KULLANIM
--------
    python scripts/foto_kontrol_sayfasi.py                 # ilk 600 (popülerlik sırasıyla)
    python scripts/foto_kontrol_sayfasi.py --limit 0       # hepsi (çok ağır olabilir)
    python scripts/foto_kontrol_sayfasi.py --kaynak sportsdb   # sadece yeni çekilenler
    python scripts/foto_kontrol_sayfasi.py --kaynak supabase   # sadece kendi depondakiler

Çıktı: foto_kontrol.html  (proje kökünde)
"""

import argparse
import csv
import html
import json
import os

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS_YOLU = os.path.join(KOK, "lib", "playerPhotos.json")
PLAYERS_YOLU = os.path.join(KOK, "lib", "players.json")
CSV_YOLU = os.path.join(KOK, "fotografi_eksik_populariteye_gore.csv")
CIKTI = os.path.join(KOK, "foto_kontrol.html")
CLOUDFRONT = "https://d138rdl3z47cng.cloudfront.net/"


def kaynak_adi(url):
    if not url:
        return "yok"
    if not url.startswith("http"):
        return "cloudfront"
    if "supabase.co" in url:
        return "supabase"
    if "thesportsdb" in url:
        return "sportsdb"
    if "wikimedia" in url or "wikipedia" in url:
        return "wikipedia"
    if "cloudfront" in url:
        return "cloudfront"
    return "diger"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=600, help="Kaç oyuncu gösterilsin (0 = hepsi)")
    ap.add_argument("--kaynak", default="", help="sportsdb | supabase | wikipedia | cloudfront | diger")
    a = ap.parse_args()

    photos = json.load(open(PHOTOS_YOLU, encoding="utf-8"))
    players = json.load(open(PLAYERS_YOLU, encoding="utf-8"))
    kulup = {p["name"]: (p["clubs"][-1] if p.get("clubs") else "") for p in players}

    sira = {}
    if os.path.exists(CSV_YOLU):
        with open(CSV_YOLU, encoding="utf-8-sig") as f:
            for i, r in enumerate(csv.DictReader(f)):
                sira.setdefault(r.get("isim"), i)

    kayitlar = []
    for isim, deger in photos.items():
        k = kaynak_adi(deger)
        if a.kaynak and k != a.kaynak:
            continue
        url = deger if (deger or "").startswith("http") else CLOUDFRONT + (deger or "")
        kayitlar.append((sira.get(isim, 10 ** 9), isim, url, k))
    kayitlar.sort()
    if a.limit > 0:
        kayitlar = kayitlar[: a.limit]

    kartlar = []
    for _, isim, url, k in kayitlar:
        kartlar.append(
            '<figure class="kart" data-kaynak="%s"><img loading="lazy" src="%s" '
            'onerror="this.closest(\'.kart\').classList.add(\'kirik\')" '
            'onload="this.closest(\'.kart\').classList.add(\'tamam\')">'
            '<figcaption><b>%s</b><span>%s</span><em>%s</em></figcaption></figure>'
            % (k, html.escape(url, quote=True), html.escape(isim),
               html.escape(kulup.get(isim, "")), k)
        )

    sayfa = """<!doctype html><html lang="tr"><meta charset="utf-8">
<title>Futbolcu Fotoğraf Kontrolü</title>
<style>
 body{background:#0B1620;color:#F3F7FA;font-family:system-ui,Segoe UI,Arial;margin:0;padding:20px}
 h1{font-size:20px;margin:0 0 6px} p.alt{color:#8CA0B3;margin:0 0 16px;font-size:13px}
 .bar{position:sticky;top:0;background:#0B1620;padding:10px 0;border-bottom:1px solid #28394B;margin-bottom:16px;z-index:2}
 button{background:#16222E;color:#F3F7FA;border:1px solid #28394B;border-radius:10px;padding:8px 14px;margin-right:8px;cursor:pointer;font-weight:700}
 button.aktif{background:#7CFF5C;color:#0B1620;border-color:#7CFF5C}
 #sayac{color:#8CA0B3;font-size:13px;margin-left:8px}
 .izgara{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px}
 .kart{margin:0;background:#16222E;border:2px solid #28394B;border-radius:14px;padding:10px;text-align:center}
 .kart.kirik{border-color:#FF5D5D;opacity:.75}
 .kart.tamam{border-color:#7CFF5C}
 .kart img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;background:#0B1620}
 figcaption{margin-top:8px;font-size:12px;line-height:1.35}
 figcaption b{display:block}
 figcaption span{display:block;color:#8CA0B3}
 figcaption em{display:block;color:#FFB020;font-style:normal;font-size:10px;text-transform:uppercase;letter-spacing:.4px;margin-top:2px}
 .gizli{display:none}
</style>
<h1>Futbolcu Fotoğraf Kontrolü</h1>
<p class="alt">Yeşil çerçeve: resim yüklendi. Kırmızı çerçeve: resim açılmadı (kayıt kırık).
Popülerliğe göre sıralı — en ünlüler başta.</p>
<div class="bar">
 <button class="aktif" data-f="hepsi">Hepsi</button>
 <button data-f="kirik">Sadece kırıklar</button>
 <button data-f="sportsdb">TheSportsDB</button>
 <button data-f="supabase">Kendi depom</button>
 <button data-f="cloudfront">Eski CloudFront</button>
 <button data-f="wikipedia">Wikipedia</button>
 <span id="sayac"></span>
</div>
<div class="izgara">__KARTLAR__</div>
<script>
 const kartlar=[...document.querySelectorAll('.kart')];
 function say(){
   const gorunen=kartlar.filter(k=>!k.classList.contains('gizli'));
   const kirik=kartlar.filter(k=>k.classList.contains('kirik')).length;
   document.getElementById('sayac').textContent=
     gorunen.length+' gösteriliyor · '+kirik+' kırık (toplam '+kartlar.length+')';
 }
 document.querySelectorAll('.bar button').forEach(b=>b.onclick=()=>{
   document.querySelectorAll('.bar button').forEach(x=>x.classList.remove('aktif'));
   b.classList.add('aktif');
   const f=b.dataset.f;
   kartlar.forEach(k=>{
     const goster = f==='hepsi' ? true : (f==='kirik' ? k.classList.contains('kirik') : k.dataset.kaynak===f);
     k.classList.toggle('gizli', !goster);
   });
   say();
 });
 setInterval(say, 1500); say();
</script>
</html>"""
    sayfa = sayfa.replace("__KARTLAR__", "\n".join(kartlar))
    with open(CIKTI, "w", encoding="utf-8") as f:
        f.write(sayfa)

    dagilim = {}
    for _, _, _, k in kayitlar:
        dagilim[k] = dagilim.get(k, 0) + 1
    print("Sayfa hazır: %s" % CIKTI)
    print("  gösterilen kayıt: %d" % len(kayitlar))
    print("  kaynak dağılımı : %s" % ", ".join("%s=%d" % kv for kv in sorted(dagilim.items())))
    print("\nDosyaya çift tıklayıp tarayıcıda aç. Kırmızı çerçeveliler açılmayan (kırık) fotoğraflar.")


if __name__ == "__main__":
    main()
