"""
FOTOĞRAF KONTROL PANELİ — Paket 22 (5 Ekim 2026)
Kerem: "bir resim kontrol paneli kur, gözle kontrol edeyim, beğenmediğimi
upload ederek değiştirebileyim. ama boyutu artmasın"

NE YAPAR
  Bilgisayarında küçük bir web sayfası açar (yalnız bu bilgisayardan erişilir:
  http://127.0.0.1:8765). Futbolcu fotoğraflarını uygulamanın gösterdiği
  adresten yükleyip ızgarada gösterir. Her kartta:
    • Değiştir  — bilgisayarından bir resim seç (ya da karta sürükle-bırak)
    • URL'den   — internetteki bir resmin adresini yapıştır
    • Kaldır    — yanlış fotoğrafı sil (uygulama baş harf rozetine düşer)
    • Geri al   — bu oyuncudaki son değişikliği geri al
  Yüklenen resim otomatik küçültülür (en uzun kenar 400 px, WebP) ve
  Supabase Storage'a (player-photos/custom/) gider. Uygulamaya GÖMÜLMEZ:
  uygulama boyutu bir bayt bile artmaz; yalnız lib/playerPhotos.json'daki
  adres değişir. Her değişiklikten sonra lib/paket/ de yeniden üretilir.

ÇALIŞTIRMA (proje klasöründe):
    python scripts\\foto_panel.py --key <SUPABASE_SERVICE_ROLE_KEY>
  ya da anahtarı ortam değişkeniyle ver:
    set SUPABASE_SERVICE_KEY=...      (PowerShell: $env:SUPABASE_SERVICE_KEY="...")
    python scripts\\foto_panel.py
  Anahtar GİZLİDİR: yalnız bu script kullanır, tarayıcıya hiç gönderilmez,
  hiçbir dosyaya yazılmaz. Anahtar verilmezse panel "salt okunur" açılır
  (bakabilirsin, değiştiremezsin).

BİTİNCE: değişiklikleri uygulamaya göndermek için
    git add lib/playerPhotos.json lib/paket
    git commit -m "Foto duzeltmeleri"
    git push  &&  eas update --channel preview --message "Foto duzeltmeleri"
Değişiklik günlüğü: veri/foto_panel_gunluk.jsonl (veri/ git'e girmez).
"""
import argparse
import hashlib
import io
import json
import os
import subprocess
import sys
import threading
import time
import unicodedata
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    from PIL import Image, ImageOps
except ImportError:
    print("Pillow gerekli:  pip install pillow")
    sys.exit(1)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOTOLAR = os.path.join(KOK, "lib", "playerPhotos.json")
TANIN = os.path.join(KOK, "lib", "playerFame.json")
OYUNCULAR = os.path.join(KOK, "lib", "players.json")
GUNLUK = os.path.join(KOK, "veri", "foto_panel_gunluk.jsonl")
SUPABASE_URL = "https://fleqohcxmgghvjbepchj.supabase.co"
KOVA = "player-photos"
ONEK = SUPABASE_URL + "/storage/v1/object/public/" + KOVA + "/"
CLOUDFRONT = "https://d138rdl3z47cng.cloudfront.net/"
EN_UZUN_KENAR = 400
KALITE = 82

# Kerem'in 5 Ekim'de "yanlış ya da değiştirmek istiyorum" dediği oyuncular
KONTROL_LISTESI = [
    "Bruno Fernandes", "Archie Brown", "Bernardo Silva", "Rafa Silva", "Tanju Çolak",
    "Volkan Demirel", "Pedro", "Emmanuel Eboué", "Simão", "Simão Sabrosa", "Jesús Navas",
    "Oktay Derelioğlu", "Hwang Ui-jo", "Olcan Adın", "Mehmet Sedef",
]

KILIT = threading.Lock()
DURUM = {"anahtar": None, "fotolar": {}, "tanin": {}, "adlar": [], "paketleniyor": False}


def oku_json(yol, varsayilan):
    try:
        with open(yol, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return varsayilan


def fotolari_yaz():
    # Asıl sıra korunur (git farkı yalnız değişen satırlar olsun); yeni adlar sona.
    sira = DURUM["sira"]
    sirali = {k: DURUM["fotolar"][k] for k in sorted(DURUM["fotolar"], key=lambda k: sira.get(k, len(sira)))}
    gecici = FOTOLAR + ".tmp"
    with open(gecici, "w", encoding="utf-8", newline="\n") as f:
        json.dump(sirali, f, ensure_ascii=False, indent=1)
    os.replace(gecici, FOTOLAR)


def gunluge_yaz(kayit):
    os.makedirs(os.path.dirname(GUNLUK), exist_ok=True)
    kayit["zaman"] = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(GUNLUK, "a", encoding="utf-8") as f:
        f.write(json.dumps(kayit, ensure_ascii=False) + "\n")


PAKET_ISTEK = threading.Event()


def _paketleyici():
    """Tek bir arka plan işçisi: istek gelince lib/paket'i yeniden üretir.
    Üretim sürerken yeni değişiklik gelirse bir tur daha döner (aynı anda iki
    üretim dosyaları yarım yazmasın)."""
    while True:
        PAKET_ISTEK.wait()
        PAKET_ISTEK.clear()
        DURUM["paketleniyor"] = True
        try:
            subprocess.run([sys.executable, os.path.join(KOK, "scripts", "veri_paketle.py")], cwd=KOK, check=False)
        finally:
            DURUM["paketleniyor"] = PAKET_ISTEK.is_set()


def paketle_arkada():
    """lib/paket/ yeniden üretilsin (uygulama fotoğrafları oradan okuyor)."""
    PAKET_ISTEK.set()


def adres(ad):
    """Uygulamadaki resolvePlayerPhotoUrl ile aynı kural."""
    v = DURUM["fotolar"].get(ad)
    if not v:
        return None
    if v.lower().startswith(("http://", "https://")):
        return v
    return CLOUDFRONT + urllib.parse.quote(v)


def sade(s):
    s = unicodedata.normalize("NFKD", s.lower().replace("ı", "i"))
    return "".join(c for c in s if not unicodedata.combining(c))


def taninirlik(ad):
    t = DURUM["tanin"].get(ad)
    return max(t) if t else 0


def kucult(veri):
    im = Image.open(io.BytesIO(veri))
    im = ImageOps.exif_transpose(im)
    alfa = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if alfa else "RGB")
    im.thumbnail((EN_UZUN_KENAR, EN_UZUN_KENAR), Image.LANCZOS)
    cikti = io.BytesIO()
    im.save(cikti, "WEBP", quality=KALITE, method=6)
    return cikti.getvalue(), im.size


def supabase_yukle(icerik):
    ad = "custom/" + hashlib.md5(icerik).hexdigest() + ".webp"
    istek = urllib.request.Request(
        SUPABASE_URL + "/storage/v1/object/" + KOVA + "/" + ad, data=icerik, method="POST",
        headers={"Authorization": "Bearer " + DURUM["anahtar"], "apikey": DURUM["anahtar"],
                 "Content-Type": "image/webp", "x-upsert": "true", "Cache-Control": "max-age=31536000"})
    with urllib.request.urlopen(istek, timeout=60) as y:
        y.read()
    return ONEK + ad


def resim_indir(url):
    istek = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (foto_panel)"})
    with urllib.request.urlopen(istek, timeout=30) as y:
        return y.read(12 * 1024 * 1024)


def degistir(ad, ham):
    if not DURUM["anahtar"]:
        raise ValueError("Salt okunur: --key ya da SUPABASE_SERVICE_KEY ile başlat.")
    icerik, boyut = kucult(ham)
    yeni = supabase_yukle(icerik)
    with KILIT:
        eski = DURUM["fotolar"].get(ad)
        DURUM["fotolar"][ad] = yeni
        fotolari_yaz()
        gunluge_yaz({"ad": ad, "eski": eski, "yeni": yeni, "islem": "degistir", "kb": round(len(icerik) / 1024, 1)})
    paketle_arkada()
    return {"ad": ad, "url": yeni, "kb": round(len(icerik) / 1024, 1), "boyut": boyut}


def kaldir(ad):
    with KILIT:
        eski = DURUM["fotolar"].pop(ad, None)
        fotolari_yaz()
        gunluge_yaz({"ad": ad, "eski": eski, "yeni": None, "islem": "kaldir"})
    paketle_arkada()
    return {"ad": ad, "url": None}


def geri_al(ad):
    son = None
    if os.path.exists(GUNLUK):
        for satir in open(GUNLUK, encoding="utf-8"):
            try:
                k = json.loads(satir)
            except ValueError:
                continue
            if k.get("ad") == ad and k.get("islem") in ("degistir", "kaldir"):
                son = k
            elif k.get("ad") == ad and k.get("islem") == "geri":
                son = None   # son değişiklik zaten geri alınmış
    if not son:
        raise ValueError("Bu oyuncu için geri alınacak değişiklik yok.")
    with KILIT:
        if son.get("eski"):
            DURUM["fotolar"][ad] = son["eski"]
        else:
            DURUM["fotolar"].pop(ad, None)
        fotolari_yaz()
        gunluge_yaz({"ad": ad, "eski": son.get("yeni"), "yeni": son.get("eski"), "islem": "geri"})
    paketle_arkada()
    return {"ad": ad, "url": adres(ad)}


def liste(tur, q, sayfa, adet=60):
    q = sade(q.strip()) if q else ""
    if q:
        adaylar = [a for a in DURUM["adlar"] if q in sade(a)]
        adaylar.sort(key=lambda a: (not sade(a).startswith(q), -taninirlik(a)))
    elif tur == "kontrol":
        adaylar = [a for a in KONTROL_LISTESI if a in DURUM["fotolar"] or a in DURUM["tanin"] or a in DURUM["adlar_set"]]
    elif tur == "fotosuz":
        adaylar = sorted((a for a in DURUM["tanin"] if a not in DURUM["fotolar"]), key=lambda a: -taninirlik(a))
    elif tur == "cloudfront":
        adaylar = sorted((a for a, v in DURUM["fotolar"].items() if not v.startswith("http") or "cloudfront" in v), key=lambda a: -taninirlik(a))
    else:   # tanınmışlar: en tanınmıştan başlayarak
        adaylar = sorted(DURUM["fotolar"], key=lambda a: -taninirlik(a))
    toplam = len(adaylar)
    parca = adaylar[sayfa * adet:(sayfa + 1) * adet]
    return {"toplam": toplam, "sayfa": sayfa, "adet": adet, "salt_okunur": not DURUM["anahtar"],
            "oyuncular": [{"ad": a, "url": adres(a), "tanin": round(taninirlik(a))} for a in parca]}


SAYFA = r"""<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Foto Paneli</title>
<style>
:root{--bg:#0f1316;--kart:#1d2328;--cizgi:#36414a;--yazi:#eef3f1;--soluk:#9aa7ad;--vurgu:#8be15b;--tehlike:#ff6b6b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--yazi);font-family:system-ui,Segoe UI,Roboto,sans-serif}
header{position:sticky;top:0;z-index:5;background:#0f1316ee;backdrop-filter:blur(6px);padding:12px 16px;border-bottom:1px solid var(--cizgi);display:flex;flex-wrap:wrap;gap:8px;align-items:center}
h1{font-size:17px;margin:0 12px 0 0}input[type=search]{flex:1;min-width:180px;padding:9px 12px;border-radius:10px;border:1px solid var(--cizgi);background:var(--kart);color:var(--yazi);font-size:15px}
.sek{padding:8px 12px;border-radius:999px;border:1px solid var(--cizgi);background:transparent;color:var(--yazi);cursor:pointer;font-weight:700;font-size:13px}
.sek.aktif{background:var(--vurgu);color:#08150e;border-color:var(--vurgu)}
#bilgi{color:var(--soluk);font-size:13px;padding:8px 16px}.uyari{color:#ffd166}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;padding:8px 16px 40px}
.k{background:var(--kart);border:1px solid var(--cizgi);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.k.surukle{outline:3px dashed var(--vurgu)}
.foto{aspect-ratio:5/6;background:#0b0e10;display:flex;align-items:center;justify-content:center;color:var(--soluk);font-size:13px}
.foto img{width:100%;height:100%;object-fit:cover;display:block}
.ad{font-weight:800;font-size:14px;padding:8px 10px 2px}.alt{font-size:11px;color:var(--soluk);padding:0 10px 6px}
.dug{display:flex;flex-wrap:wrap;gap:6px;padding:0 10px 10px}
.dug button,.dug label{font-size:12px;font-weight:700;padding:6px 8px;border-radius:8px;border:1px solid var(--cizgi);background:transparent;color:var(--yazi);cursor:pointer}
.dug .ana{background:var(--vurgu);color:#08150e;border-color:var(--vurgu)}.dug .sil{color:var(--tehlike)}
.dug input{display:none}.mesaj{font-size:11px;padding:0 10px 8px;color:var(--vurgu)}.mesaj.hata{color:var(--tehlike)}
nav{display:flex;gap:8px;justify-content:center;padding:0 16px 30px}nav button{padding:8px 14px;border-radius:10px;border:1px solid var(--cizgi);background:var(--kart);color:var(--yazi);cursor:pointer}
</style></head><body>
<header><h1>Foto Paneli</h1>
<button class="sek aktif" data-tur="kontrol">Kontrol listesi</button>
<button class="sek" data-tur="taninmis">Tanınmışlar</button>
<button class="sek" data-tur="fotosuz">Fotoğrafsız tanınmışlar</button>
<button class="sek" data-tur="cloudfront">Eski (CloudFront) fotolar</button>
<input type="search" id="q" placeholder="Futbolcu ara (ör. tanju, navas)…"></header>
<div id="bilgi"></div><main id="izgara"></main><nav><button id="geri">‹ Önceki</button><button id="ileri">Sonraki ›</button></nav>
<script>
let tur="kontrol",sayfa=0,q="",zamanlayici=null,saltOkunur=false;
const $=s=>document.querySelector(s);
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
async function yukle(){
  const r=await fetch(`/api/liste?tur=${tur}&q=${encodeURIComponent(q)}&sayfa=${sayfa}`);const d=await r.json();saltOkunur=d.salt_okunur;
  $("#bilgi").innerHTML=`${d.toplam} oyuncu · sayfa ${d.sayfa+1}/${Math.max(1,Math.ceil(d.toplam/d.adet))}`+(saltOkunur?` · <span class="uyari">SALT OKUNUR: değiştirmek için paneli --key ile başlat</span>`:"");
  $("#izgara").innerHTML=d.oyuncular.map(o=>kart(o)).join("");
  document.querySelectorAll(".k").forEach(baglan);
  $("#geri").disabled=sayfa===0;$("#ileri").disabled=(sayfa+1)*d.adet>=d.toplam;
}
function kart(o){
  const foto=o.url?`<img loading="lazy" src="${esc(o.url)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'açılmadı'}))">`:"fotoğraf yok";
  return `<div class="k" data-ad="${esc(o.ad)}"><div class="foto">${foto}</div><div class="ad">${esc(o.ad)}</div>
  <div class="alt">tanınırlık ${o.tanin}</div><div class="dug">
  <label class="ana">Değiştir<input type="file" accept="image/*"></label><button data-is="url">URL'den</button>
  ${o.url?'<button class="sil" data-is="kaldir">Kaldır</button>':""}<button data-is="geri">Geri al</button></div><div class="mesaj"></div></div>`;
}
function mesaj(k,m,hata){const e=k.querySelector(".mesaj");e.textContent=m;e.classList.toggle("hata",!!hata)}
function guncelle(k,url){const f=k.querySelector(".foto");f.innerHTML=url?`<img src="${url}">`:"fotoğraf yok"}
async function gonder(k,yol,govde,tip){
  mesaj(k,"yükleniyor…");
  try{const r=await fetch(yol,{method:"POST",body:govde,headers:tip?{"Content-Type":tip}:{}});const d=await r.json();
    if(!r.ok)throw new Error(d.hata||r.status);guncelle(k,d.url);mesaj(k,d.kb?`✓ kaydedildi (${d.kb} KB)`:"✓ kaydedildi")}
  catch(e){mesaj(k,"✗ "+e.message,true)}
}
function baglan(k){
  const ad=k.dataset.ad,a=encodeURIComponent(ad);
  k.querySelector("input[type=file]").onchange=e=>{const f=e.target.files[0];if(f)gonder(k,`/api/yukle?ad=${a}`,f,"application/octet-stream")};
  k.querySelectorAll("button[data-is]").forEach(b=>b.onclick=()=>{
    const is=b.dataset.is;
    if(is==="url"){const u=prompt(ad+" için resim adresi (https://…):");if(u)gonder(k,`/api/yukle?ad=${a}`,JSON.stringify({url:u}),"application/json")}
    if(is==="kaldir"&&confirm(ad+" fotoğrafı kaldırılsın mı?"))gonder(k,`/api/kaldir?ad=${a}`,"{}","application/json");
    if(is==="geri")gonder(k,`/api/geri?ad=${a}`,"{}","application/json");
  });
  k.ondragover=e=>{e.preventDefault();k.classList.add("surukle")};k.ondragleave=()=>k.classList.remove("surukle");
  k.ondrop=e=>{e.preventDefault();k.classList.remove("surukle");const f=e.dataTransfer.files[0];if(f)gonder(k,`/api/yukle?ad=${a}`,f,"application/octet-stream")};
}
document.querySelectorAll(".sek").forEach(b=>b.onclick=()=>{document.querySelectorAll(".sek").forEach(x=>x.classList.remove("aktif"));b.classList.add("aktif");tur=b.dataset.tur;sayfa=0;q="";$("#q").value="";yukle()});
$("#q").oninput=e=>{clearTimeout(zamanlayici);zamanlayici=setTimeout(()=>{q=e.target.value;sayfa=0;yukle()},250)};
$("#geri").onclick=()=>{sayfa--;yukle();scrollTo(0,0)};$("#ileri").onclick=()=>{sayfa++;yukle();scrollTo(0,0)};
yukle();
</script></body></html>"""


class Isleyici(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, veri, kod=200):
        b = json.dumps(veri, ensure_ascii=False).encode("utf-8")
        self.send_response(kod)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _parametre(self):
        u = urllib.parse.urlparse(self.path)
        return u.path, {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}

    def do_GET(self):
        yol, p = self._parametre()
        if yol == "/":
            b = SAYFA.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)
        elif yol == "/api/liste":
            self._json(liste(p.get("tur", "kontrol"), p.get("q", ""), int(p.get("sayfa", "0") or 0)))
        else:
            self._json({"hata": "yok"}, 404)

    def do_POST(self):
        yol, p = self._parametre()
        ad = p.get("ad", "")
        # Yalnız bu bilgisayardaki sayfadan gelen istekler (başka sitelerin
        # tarayıcı üzerinden buraya istek atmasını engeller).
        kaynak = self.headers.get("Origin") or ""
        if kaynak and not kaynak.startswith(("http://127.0.0.1", "http://localhost")):
            return self._json({"hata": "izin yok"}, 403)
        if not ad:
            return self._json({"hata": "oyuncu adı yok"}, 400)
        uzunluk = int(self.headers.get("Content-Length") or 0)
        if uzunluk > 15 * 1024 * 1024:
            return self._json({"hata": "dosya çok büyük (15 MB üstü)"}, 400)
        govde = self.rfile.read(uzunluk) if uzunluk else b""
        try:
            if yol == "/api/yukle":
                if (self.headers.get("Content-Type") or "").startswith("application/json"):
                    url = json.loads(govde.decode("utf-8")).get("url", "").strip()
                    if not url.lower().startswith(("http://", "https://")):
                        raise ValueError("geçerli bir resim adresi değil")
                    govde = resim_indir(url)
                self._json(degistir(ad, govde))
            elif yol == "/api/kaldir":
                self._json(kaldir(ad))
            elif yol == "/api/geri":
                self._json(geri_al(ad))
            else:
                self._json({"hata": "yok"}, 404)
        except urllib.error.HTTPError as e:
            self._json({"hata": "sunucu %s: %s" % (e.code, e.read()[:200].decode("utf-8", "replace"))}, 502)
        except Exception as e:  # noqa: BLE001 — panelde mesaj olarak gösterilir
            self._json({"hata": str(e)}, 400)


def ana():
    ap = argparse.ArgumentParser(description="Futbolcu fotoğraf kontrol paneli")
    ap.add_argument("--key", help="Supabase service_role anahtarı (ya da SUPABASE_SERVICE_KEY)")
    ap.add_argument("--port", type=int, default=8765)
    a = ap.parse_args()
    DURUM["anahtar"] = a.key or os.environ.get("SUPABASE_SERVICE_KEY") or None
    DURUM["fotolar"] = oku_json(FOTOLAR, {})
    DURUM["sira"] = {k: i for i, k in enumerate(DURUM["fotolar"])}
    threading.Thread(target=_paketleyici, daemon=True).start()
    DURUM["tanin"] = oku_json(TANIN, {})
    adlar = []
    gor = set()
    for o in oku_json(OYUNCULAR, []):
        if o["name"] not in gor:
            gor.add(o["name"]); adlar.append(o["name"])
    for k in DURUM["fotolar"]:
        if k not in gor:
            gor.add(k); adlar.append(k)
    DURUM["adlar"], DURUM["adlar_set"] = adlar, gor
    sunucu = ThreadingHTTPServer(("127.0.0.1", a.port), Isleyici)
    adres_ = "http://127.0.0.1:%d" % a.port
    print("Foto paneli açık: %s   (%d fotoğraf, %s)" % (adres_, len(DURUM["fotolar"]),
          "değiştirme AÇIK" if DURUM["anahtar"] else "SALT OKUNUR — anahtar verilmedi"))
    print("Not: her değişiklikten sonra lib/paket birkaç saniyede kendiliğinden yenilenir; kapatmadan önce 'lib/paket yazıldı' satırını bekle.")
    print("Kapatmak için Ctrl+C. Bitince: git add lib/playerPhotos.json lib/paket  →  commit  →  push  →  eas update")
    try:
        webbrowser.open(adres_)
    except Exception:
        pass
    try:
        sunucu.serve_forever()
    except KeyboardInterrupt:
        print("\nKapatıldı.")


if __name__ == "__main__":
    ana()
