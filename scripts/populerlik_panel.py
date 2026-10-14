"""
POPÜLERLİK PANELİ — Paket 29 (14 Ekim 2026)
Kerem: "popülerlikle de istediğim gibi oynayabileceğim bir panel olsun."

Bilgisayarında küçük bir web sayfası açar (yalnız bu bilgisayardan:
http://127.0.0.1:8766). Tanınırlık hesabı scripts/populerlik.py'dedir; panel
onun ağırlıklarını ve elle ayarlarını değiştirip sonucu ANINDA gösterir:

  • Ayar sürgüleri   Türkiye ağırlığı, transfer dalgası törpüsü, kariyer
                     ağırlığı, hoca törpüsü… Değiştirince sıralama yenilenir.
  • Sıralama         46 bin oyuncu, sıra/tanınırlık/değişim; arama ve bölge
                     süzgeci. Her satırda: ▲ / ▼ (bir kademe = sıra yarıya
                     iner/ikiye katlanır), "Sıraya koy" (ör. 150.), "Çıkar"
                     (oyunda soru/tur olarak hiç çıkmaz), "Sıfırla".
  • Zorluk önizlemesi  Seçtiğin eşleşme profili ve zorlukta (1–10) havuza
                     hangi oyuncuların girdiği, bölge bölge (oyundaki bölgeli
                     taban kuralının yaklaşığı).
  • Önce / sonra     Kaydedilmiş hâle göre kim kaç sıra çıktı/düştü.
  • KAYDET           scripts/populerlik_ayar.json + lib/playerFame.json yazılır,
                     lib/paket yeniden üretilir.

Supabase anahtarı GEREKMEZ (internete hiç çıkmaz). Girdi: veri/ozgecmis_ham.json.

ÇALIŞTIRMA (proje klasöründe):
    python scripts\\populerlik_panel.py
BİTİNCE:
    git add scripts/populerlik_ayar.json lib/playerFame.json lib/paket
    git commit -m "Populerlik ayarlari"  &&  git push
    eas update --channel preview --message "Populerlik ayarlari"
"""
import argparse
import json
import math
import os
import re
import sys
import threading
import time
import unicodedata
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import populerlik as P  # noqa: E402

KOK = P.KOK
KILIT = threading.Lock()
D = {}   # durum: v, agirlik, oyuncu_ayar, sonuc, sira_liste, kayitli_sira, kayitli_agirlik, kayitli_oyuncu, bolge, paketleniyor


# ------------------------------------------------------------ oyundan sabitler
def js_sabitleri():
    """Bölge/zorluk kurallarını oyunun kendi dosyalarından okur (elle kopya tutulmasın)."""
    sab = {
        "oran": [0.0004, 0.001, 0.0025, 0.006, 0.015, 0.035, 0.09, 0.22, 0.5, 1.0],
        "asgari": [40, 60, 90, 130, 200, 300, 500, 900, 1800, None],
        "avrupa": set(), "ulke_karo": {"Turkey": "tr", "United Kingdom": "eng", "England": "eng", "Spain": "esp",
                                       "Italy": "ita", "Germany": "ger", "West Germany": "ger", "France": "fra"},
        "profiller": {"dengeli": ("Dengeli", [2, 1, 1, 1, 1, 1, 1, 0]), "turkiye": ("Türkiye", [2, 1, 0, 0, 0, 0, 0, 0]),
                      "superLig": ("Süper Lig", [1, 0, 0, 0, 0, 0, 0, 0]), "big5": ("5 Büyük Lig", [0, 1, 1, 1, 1, 1, 0, 0]),
                      "dunya": ("Dünya Futbolu", [1, 1, 1, 1, 1, 1, 1, 1])},
    }
    try:
        g = open(os.path.join(KOK, "lib", "gameEngine.js"), encoding="utf-8").read()
        m = re.search(r"DIFFICULTY_FRACTION = \[(.*?)\];", g, re.S)
        if m:
            sab["oran"] = [float(x) for x in re.findall(r"\d+\.\d+", m.group(1))][:10]
        m = re.search(r"HAVUZ_ASGARI = \[(.*?)\]", g)
        if m:
            sab["asgari"] = [None if x.strip() == "Infinity" else int(x) for x in m.group(1).split(",")]
    except OSError:
        pass
    try:
        e = open(os.path.join(KOK, "lib", "eslesmeProfili.js"), encoding="utf-8").read()
        m = re.search(r"const AVRUPA = new Set\(\[(.*?)\]\)", e, re.S)
        if m:
            sab["avrupa"] = set(re.findall(r'"([^"]+)"', m.group(1)))
        for m in re.finditer(r'\{ id: "(\w+)", ad: "([^"]+)".*?karolar: K\(([\d, ]+)\)', e, re.S):
            sab["profiller"][m.group(1)] = (m.group(2), [int(x) for x in m.group(3).split(",")])
    except OSError:
        pass
    return sab


KAROLAR = ["tr", "eng", "esp", "ita", "ger", "fra", "avr", "dunya"]
KARO_AD = {"tr": "Türkiye", "eng": "İngiltere", "esp": "İspanya", "ita": "İtalya", "ger": "Almanya",
           "fra": "Fransa", "avr": "Diğer Avrupa", "dunya": "Dünya"}


def kulup_kademeleri():
    """Oyunun kulüp ağırlıkları (lib/clubWeights.js): dev 9, büyük 5, bilinen 2,5, diğer 1."""
    def adlar(dosya, desen=None):
        try:
            s = open(os.path.join(KOK, "lib", dosya), encoding="utf-8").read()
        except OSError:
            return []
        if desen:
            m = re.search(desen, s, re.S)
            s = m.group(1) if m else ""
        return re.findall(r'"([^"]+)"', s)
    norm = lambda c: re.sub(r"\s+(jk|sk|fk|aş|gsk|fc|cf|afc)\.?$", "", c.replace("İ", "i").replace("I", "ı").lower().strip())
    w = {}
    for c in adlar("big5ClubTiers.js") + adlar("clubTiers.js") + adlar("clubWeights.js", r"CHAMPIONS_LEAGUE_CLUBS = kanonikTekil\(\[(.*?)\]"):
        w[norm(c)] = 2.5
    for c in adlar("clubWeights.js", r"export const BIG = kanonikTekil\(\[(.*?)\]"):
        w[norm(c)] = 5
    for c in adlar("clubWeights.js", r"export const MEGA = kanonikTekil\(\[(.*?)\]"):
        w[norm(c)] = 9
    return lambda c: w.get(norm(c), 1)


def bolgeleri_hesapla(v, sab):
    """Oyuncunun ana bölgesi = en ağırlıklı kulübünün ülkesi; eşitlikte kariyerdeki ilk kulüp
    (oyundaki oyuncuBolgesi ile aynı kural; profil kapsamı hesaba katılmadığı için yaklaşık)."""
    ulke = P.oku(os.path.join(KOK, "lib", "clubCountries.json"), {})
    agirlik = kulup_kademeleri()
    bolge = {}
    for a in v.adlar:
        en, enw = None, -1.0
        for c in v.kulupler[a][0]:
            w = agirlik(c)
            if w > enw:
                en, enw = c, w
        u = ulke.get(en) if en else None
        k = sab["ulke_karo"].get(u) if u else None
        if not k:
            k = "avr" if u in sab["avrupa"] else "dunya"
        bolge[a] = k
    return bolge


# ------------------------------------------------------------ hesap
def yeniden_hesapla():
    D["sonuc"] = P.hesapla(D["v"], D["agirlik"], D["oyuncu_ayar"])
    D["sira_liste"] = sorted(D["sonuc"], key=lambda a: D["sonuc"][a]["sira"])


def kayitli_oku():
    f = P.oku(P.CIKTI, {})
    sirali = sorted(f, key=lambda a: -(f[a][0] if f[a] else 0))
    D["kayitli_sira"] = {a: i + 1 for i, a in enumerate(sirali)}
    D["kayitli_agirlik"], D["kayitli_oyuncu"] = P.ayar_oku()


def degisiklik_sayisi():
    n = sum(1 for k in P.VARSAYILAN if abs(D["agirlik"][k] - D["kayitli_agirlik"][k]) > 1e-9)
    tum = set(D["oyuncu_ayar"]) | set(D["kayitli_oyuncu"])
    n += sum(1 for a in tum if D["oyuncu_ayar"].get(a) != D["kayitli_oyuncu"].get(a))
    return n


def sade(s):
    s = unicodedata.normalize("NFKD", s.lower().replace("ı", "i"))
    return "".join(c for c in s if not unicodedata.combining(c))


def satir(a):
    s = D["sonuc"][a]
    v = D["v"]
    eski = D["kayitli_sira"].get(a)
    rozet = []
    if a in v.hoca:
        rozet.append("hoca")
    if not s["olculen"]:
        rozet.append("verisiz")
    elif v.tr_bag.get(a, 0) >= 1:
        rozet.append("TR")
    ay = D["oyuncu_ayar"].get(a)
    return {"ad": a, "sira": s["sira"], "T": round(s["T"], 2), "eski": eski,
            "fark": (eski - s["sira"]) if eski else None, "bolge": KARO_AD.get(D["bolge"].get(a), ""),
            "kulupler": ", ".join(v.kulupler[a][0][-4:]), "rozet": rozet, "ayar": ay,
            "adas": len(v.kulupler[a]) > 1}


def liste(q, bolge, elle, sayfa, adet=100):
    sl = D["sira_liste"]
    if elle:
        sl = [a for a in sl if a in D["oyuncu_ayar"]]
    if bolge:
        sl = [a for a in sl if D["bolge"].get(a) == bolge]
    if q:
        qq = sade(q.strip())
        sl = [a for a in sl if qq in sade(a)]
    return {"toplam": len(sl), "sayfa": sayfa, "adet": adet,
            "satirlar": [satir(a) for a in sl[sayfa * adet:(sayfa + 1) * adet]]}


def zorluk(profil, d, bolge):
    sab = D["sab"]
    ad, karolar = sab["profiller"].get(profil, sab["profiller"]["dengeli"])
    pay_ham = {k: [0, 1, 3][karolar[i]] for i, k in enumerate(KAROLAR)}
    T = sum(pay_ham.values()) or 1
    pay = {k: x / T for k, x in pay_ham.items() if x}
    oran = sab["oran"][d - 1]
    asg = sab["asgari"][d - 1]
    v = D["v"]
    gruplar = {}
    for a in D["sira_liste"]:
        b = D["bolge"][a]
        if b not in pay or D["sonuc"][a]["cikar"]:
            continue
        if max(len(c) for c in v.kulupler[a]) < 2:
            continue
        gruplar.setdefault(b, []).append(a)
    ozet, secilen = [], {}
    for b in KAROLAR:
        if b not in gruplar:
            continue
        liste_ = gruplar[b]
        if d >= 10 or asg is None:
            n = len(liste_)
        else:
            n = min(len(liste_), max(math.ceil(len(liste_) * oran), math.ceil(asg * pay[b]), 8))
        secilen[b] = liste_[:n]
        ozet.append({"bolge": b, "ad": KARO_AD[b], "n": n, "toplam": len(liste_), "pay": round(100 * pay[b])})
    goster = secilen.get(bolge) if bolge else sorted((a for x in secilen.values() for a in x), key=lambda a: D["sonuc"][a]["sira"])
    goster = goster or []
    return {"profil": ad, "d": d, "ozet": ozet, "toplam": sum(o["n"] for o in ozet), "adet": len(goster),
            "satirlar": [satir(a) for a in goster[:400]]}


def fark():
    sk = D["kayitli_sira"]
    s = D["sonuc"]
    yeni300 = set(D["sira_liste"][:300])
    eski300 = {a for a, r in sk.items() if r <= 300}
    adaylar = [a for a in s if a in sk and (s[a]["sira"] <= 3000 or sk[a] <= 3000)]
    # log oranına göre: 2000→1000 ile 20→10 aynı ağırlıkta
    hareket = sorted(adaylar, key=lambda a: math.log(sk[a] / s[a]["sira"]))
    return {"ortak300": len(yeni300 & eski300),
            "girenler": [satir(a) for a in sorted(yeni300 - eski300, key=lambda a: s[a]["sira"])][:60],
            "cikanlar": [satir(a) for a in sorted(eski300 - yeni300, key=lambda a: sk[a])][:60],
            "yukselen": [satir(a) for a in reversed(hareket[-50:])],
            "dusen": [satir(a) for a in hareket[:50]]}


def durum():
    return {"agirlik": D["agirlik"], "varsayilan": P.VARSAYILAN, "aciklama": P.AYAR_ACIKLAMA,
            "oyuncu_ayar": D["oyuncu_ayar"], "degisiklik": degisiklik_sayisi(),
            "paketleniyor": D.get("paketleniyor", False), "toplam": len(D["sira_liste"]),
            "profiller": {k: x[0] for k, x in D["sab"]["profiller"].items()}, "karolar": KARO_AD}


def kaydet():
    P.ayar_yaz(D["agirlik"], D["oyuncu_ayar"])
    P.cikti_yaz(D["sonuc"])
    kayitli_oku()

    def _paket():
        D["paketleniyor"] = True
        try:
            P.paketle()
        finally:
            D["paketleniyor"] = False
    threading.Thread(target=_paket, daemon=True).start()
    return durum()


SAYFA = r"""<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Popülerlik Paneli</title>
<style>
:root{--bg:#0f1316;--kart:#1d2328;--kart2:#232b31;--cizgi:#36414a;--yazi:#eef3f1;--soluk:#9aa7ad;--vurgu:#8be15b;--tehlike:#ff6b6b;--sari:#ffd166;--mavi:#7cc4ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--yazi);font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:14px}
header{position:sticky;top:0;z-index:5;background:#0f1316f0;backdrop-filter:blur(6px);padding:10px 16px;border-bottom:1px solid var(--cizgi);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
h1{font-size:17px;margin:0 8px 0 0}button{font:inherit;cursor:pointer}
.btn{padding:8px 14px;border-radius:10px;border:1px solid var(--cizgi);background:transparent;color:var(--yazi);font-weight:700}
.btn.ana{background:var(--vurgu);border-color:var(--vurgu);color:#08150e}.btn:disabled{opacity:.4;cursor:default}
#durum{color:var(--soluk);font-size:13px}.uyari{color:var(--sari)}
.duzen{display:grid;grid-template-columns:330px 1fr;gap:16px;padding:14px 16px 40px;align-items:start}
@media(max-width:900px){.duzen{grid-template-columns:1fr}aside{position:static;max-height:none}header{position:static}td.is button{padding:6px 9px}}
aside{position:sticky;top:64px;background:var(--kart);border:1px solid var(--cizgi);border-radius:14px;padding:14px;max-height:calc(100vh - 80px);overflow:auto}
aside h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--soluk);margin:4px 0 10px}
.ayar{margin-bottom:14px}.ayar .ust{display:flex;justify-content:space-between;font-weight:700}.ayar .ust span{color:var(--vurgu);font-variant-numeric:tabular-nums}
.ayar input{width:100%;accent-color:var(--vurgu)}.ayar p{margin:2px 0 0;color:var(--soluk);font-size:12px;line-height:1.35}
.ayar .vars{font-size:11px;color:var(--soluk)}
.elle{display:flex;flex-wrap:wrap;gap:6px}.cip{background:var(--kart2);border:1px solid var(--cizgi);border-radius:999px;padding:4px 8px 4px 10px;font-size:12px}
.cip button{background:none;border:0;color:var(--tehlike);font-weight:800;margin-left:4px}
.sekmeler{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}.sek{padding:8px 12px;border-radius:999px;border:1px solid var(--cizgi);background:transparent;color:var(--yazi);font-weight:700;font-size:13px}
.sek.aktif{background:var(--yazi);color:var(--bg)}
.arac{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
.arac input[type=search],.arac select{padding:8px 10px;border-radius:10px;border:1px solid var(--cizgi);background:var(--kart);color:var(--yazi);font:inherit}
.arac input[type=search]{flex:1;min-width:180px}.arac label{color:var(--soluk);font-size:13px}
.tw{overflow-x:auto;border-radius:14px}main{min-width:0}html,body{overflow-x:hidden}
table{width:100%;border-collapse:collapse;background:var(--kart);border:1px solid var(--cizgi);border-radius:14px;overflow:hidden}
th,td{padding:7px 10px;border-bottom:1px solid var(--cizgi);text-align:left;vertical-align:top}th{font-size:12px;color:var(--soluk);font-weight:700;background:var(--kart2)}
td.s{font-variant-numeric:tabular-nums;white-space:nowrap}.ad{font-weight:700;cursor:pointer}.ad:hover{text-decoration:underline}
.alt{color:var(--soluk);font-size:12px}.up{color:var(--vurgu)}.down{color:var(--tehlike)}
.rz{display:inline-block;font-size:10.5px;font-weight:800;padding:1px 6px;border-radius:6px;margin-left:4px;background:#2b3640;color:var(--mavi)}
.rz.ayar{background:#3a2f12;color:var(--sari)}.rz.cik{background:#3d1b1b;color:var(--tehlike)}
.is button{padding:4px 7px;border-radius:7px;border:1px solid var(--cizgi);background:transparent;color:var(--yazi);font-size:12px;margin:1px}
.is button.k{color:var(--tehlike)}
.ozet{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.ozet button{padding:8px 10px;border-radius:10px;border:1px solid var(--cizgi);background:var(--kart);color:var(--yazi);text-align:left}
.ozet button.aktif{border-color:var(--vurgu)}.ozet b{display:block;font-size:18px}
.iki{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:1100px){.iki{grid-template-columns:1fr}}
h3{margin:6px 0 8px;font-size:14px}
nav{display:flex;gap:8px;justify-content:center;padding:12px}nav button{padding:8px 14px;border-radius:10px;border:1px solid var(--cizgi);background:var(--kart);color:var(--yazi)}
#detay{position:fixed;right:16px;bottom:16px;width:min(420px,calc(100vw - 32px));background:var(--kart2);border:1px solid var(--cizgi);border-radius:14px;padding:14px;display:none;z-index:9;box-shadow:0 10px 40px #0008}
#detay table{background:transparent;border:0}#detay td{border:0;padding:3px 6px}
.ipucu{color:var(--soluk);font-size:12px;margin:6px 0 10px;line-height:1.4}
</style></head><body>
<header><h1>Popülerlik Paneli</h1>
<button class="btn ana" id="kaydet" disabled>KAYDET</button>
<button class="btn" id="varsayilan">Ağırlıkları varsayılana döndür</button>
<span id="durum"></span></header>
<div class="duzen">
<aside><h2>Ağırlıklar</h2><div id="ayarlar"></div><h2>Elle ayarlar</h2><div class="elle" id="elle"></div>
<p class="ipucu">▲ ▼: bir kademe = sıra yarıya iner / ikiye katlanır (800. → 400.). Sıraya koy: tam o sıraya. Çıkar: oyunda soru/tur olarak hiç çıkmaz (cevap olarak yine geçer).</p></aside>
<main>
<div class="sekmeler"><button class="sek aktif" data-s="sira">Sıralama</button><button class="sek" data-s="zorluk">Zorluk önizlemesi</button><button class="sek" data-s="fark">Önce / sonra</button></div>
<section id="s-sira">
<div class="arac"><input type="search" id="q" placeholder="Oyuncu ara (ör. tanju, guler)…">
<select id="bolge"><option value="">Bütün bölgeler</option></select>
<label><input type="checkbox" id="yalnizElle"> yalnız elle ayarlananlar</label></div>
<div id="bilgi" class="alt"></div><div id="tablo"></div><nav><button id="onceki">‹ Önceki</button><button id="sonraki">Sonraki ›</button></nav></section>
<section id="s-zorluk" hidden>
<div class="arac"><select id="profil"></select><label>Zorluk <input type="range" id="zd" min="1" max="10" value="3"> <b id="zdy">3</b></label></div>
<p class="ipucu">Bu profilde, bu zorlukta turun kurulduğu oyuncu havuzu. Her bölge kendi içinde en tanınanlardan başlar (oyundaki bölgeli taban kuralı); bölge, oyuncunun en prestijli kulübünden yaklaşık bulunur.</p>
<div class="ozet" id="zozet"></div><div id="ztablo"></div></section>
<section id="s-fark" hidden><p class="ipucu">Kaydedilmiş hâle (uygulamadaki dosyaya) göre. Değişiklik yapmadıysan liste boştur.</p><div id="farkic"></div></section>
</main></div>
<div id="detay"></div>
<script>
const $=s=>document.querySelector(s);let D=null,sayfa=0,sekme="sira",zBolge="",zaman=null;
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
async function api(yol,govde){const r=await fetch(yol,govde?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(govde)}:{});const d=await r.json();if(!r.ok)throw new Error(d.hata||r.status);return d}
function durumCiz(){
  $("#kaydet").disabled=!D.degisiklik;
  $("#durum").innerHTML=(D.degisiklik?`<span class="uyari">${D.degisiklik} kaydedilmemiş değişiklik</span>`:"kaydedildi")+(D.paketleniyor?" · lib/paket yazılıyor…":"")+` · ${D.toplam.toLocaleString("tr")} oyuncu`;
  $("#ayarlar").innerHTML=Object.keys(D.varsayilan).map(k=>{const [ad,ac]=D.aciklama[k];const tav=k==="verisiz_tavan";const v=D.agirlik[k];
    return `<div class="ayar"><div class="ust">${esc(ad)} <span>${tav?v.toFixed(0):v.toFixed(2)}</span></div>
    <input type="range" data-k="${k}" min="${tav?50:0}" max="${tav?99:1}" step="${tav?1:0.05}" value="${v}">
    <p>${esc(ac)}</p><div class="vars">varsayılan ${tav?D.varsayilan[k]:D.varsayilan[k].toFixed(2)}</div></div>`}).join("");
  document.querySelectorAll("#ayarlar input").forEach(i=>{i.oninput=()=>{i.closest(".ayar").querySelector(".ust span").textContent=i.dataset.k==="verisiz_tavan"?(+i.value).toFixed(0):(+i.value).toFixed(2)};
    i.onchange=async()=>{const a={...D.agirlik,[i.dataset.k]:+i.value};D=await api("/api/agirlik",{agirlik:a});durumCiz();yenile()}});
  const e=Object.entries(D.oyuncu_ayar);
  $("#elle").innerHTML=e.length?e.map(([a,x])=>`<span class="cip">${esc(a)} · ${esc(ayarYazi(x))}<button data-ad="${esc(a)}" title="kaldır">×</button></span>`).join(""):'<span class="alt">Henüz yok — listede ▲ ▼ ile başla.</span>';
  document.querySelectorAll("#elle button").forEach(b=>b.onclick=()=>oyuncuAyar(b.dataset.ad,null));
}
function ayarYazi(x){if(!x)return"";if(x.cikar)return"oyunda çıkmasın";if(x.sira)return x.sira+". sıraya";return (x.kademe>0?"▲":"▼")+Math.abs(x.kademe)+" kademe"}
function fark(f){if(f==null)return'<span class="alt">yeni</span>';if(f===0)return'<span class="alt">—</span>';return f>0?`<span class="up">▲${f.toLocaleString("tr")}</span>`:`<span class="down">▼${(-f).toLocaleString("tr")}</span>`}
function tablo(satirlar,islem=true){
  if(!satirlar.length)return'<p class="alt">Liste boş.</p>';
  return `<div class="tw"><table><tr><th>Sıra</th><th>Değişim</th><th>Oyuncu</th><th>Tanınırlık</th>${islem?"<th>Ayar</th>":""}</tr>`+satirlar.map(s=>{
    const rz=s.rozet.map(r=>`<span class="rz">${r}</span>`).join("")+(s.adas?'<span class="rz" title="Aynı adla birden çok oyuncu; puan en tanınanına gider">adaş</span>':"")+(s.ayar?`<span class="rz ${s.ayar.cikar?"cik":"ayar"}">${esc(ayarYazi(s.ayar))}</span>`:"");
    return `<tr><td class="s">${s.sira.toLocaleString("tr")}.</td><td class="s">${fark(s.fark)}</td>
    <td><span class="ad" data-ad="${esc(s.ad)}">${esc(s.ad)}</span>${rz}<div class="alt">${esc(s.bolge)} · ${esc(s.kulupler)}</div></td>
    <td class="s">${s.T.toFixed(2)}</td>${islem?`<td class="is" data-ad="${esc(s.ad)}"><button data-i="yukari" title="Bir kademe yukarı">▲</button><button data-i="asagi" title="Bir kademe aşağı">▼</button><button data-i="sira">Sıraya koy</button>${s.ayar&&s.ayar.cikar?"":'<button class="k" data-i="cikar">Çıkar</button>'}${s.ayar?'<button data-i="sifirla">Sıfırla</button>':""}</td>`:""}</tr>`}).join("")+"</table></div>";
}
function bagla(kok){
  kok.querySelectorAll(".ad").forEach(x=>x.onclick=()=>detay(x.dataset.ad));
  kok.querySelectorAll("td.is button").forEach(b=>b.onclick=()=>{const ad=b.closest("td").dataset.ad,mevcut=D.oyuncu_ayar[ad]||{};const i=b.dataset.i;
    if(i==="yukari"||i==="asagi"){const k=(mevcut.kademe||0)+(i==="yukari"?1:-1);oyuncuAyar(ad,k?{kademe:k}:null)}
    if(i==="sira"){const r=prompt(ad+" kaçıncı sırada olsun?");if(r&&+r>0)oyuncuAyar(ad,{sira:Math.round(+r)})}
    if(i==="cikar")oyuncuAyar(ad,{cikar:true});if(i==="sifirla")oyuncuAyar(ad,null)});
}
async function oyuncuAyar(ad,ayar){D=await api("/api/oyuncu",{ad,ayar});durumCiz();yenile()}
async function liste(){const q=encodeURIComponent($("#q").value);const d=await api(`/api/liste?q=${q}&bolge=${$("#bolge").value}&elle=${$("#yalnizElle").checked?1:0}&sayfa=${sayfa}`);
  $("#bilgi").textContent=`${d.toplam.toLocaleString("tr")} oyuncu · sayfa ${sayfa+1}/${Math.max(1,Math.ceil(d.toplam/d.adet))}`;
  $("#tablo").innerHTML=tablo(d.satirlar);bagla($("#tablo"));$("#onceki").disabled=sayfa===0;$("#sonraki").disabled=(sayfa+1)*d.adet>=d.toplam}
async function zorluk(){const d=await api(`/api/zorluk?profil=${$("#profil").value}&d=${$("#zd").value}&bolge=${zBolge}`);
  $("#zozet").innerHTML=`<button data-b="" class="${zBolge?"":"aktif"}"><span class="alt">Toplam havuz</span><b>${d.toplam.toLocaleString("tr")}</b></button>`+d.ozet.map(o=>`<button data-b="${o.bolge}" class="${zBolge===o.bolge?"aktif":""}"><span class="alt">${esc(o.ad)} · pay %${o.pay}</span><b>${o.n.toLocaleString("tr")}</b><span class="alt">/ ${o.toplam.toLocaleString("tr")}</span></button>`).join("");
  $("#zozet").querySelectorAll("button").forEach(b=>b.onclick=()=>{zBolge=b.dataset.b;zorluk()});
  $("#ztablo").innerHTML=(d.adet>400?`<p class="alt">İlk 400'ü gösteriliyor (${d.adet.toLocaleString("tr")} oyuncu).</p>`:"")+tablo(d.satirlar);bagla($("#ztablo"))}
async function farkCiz(){const d=await api("/api/fark");const b=(t,x)=>`<div><h3>${t}</h3>${tablo(x,false)}</div>`;
  $("#farkic").innerHTML=`<p>İlk 300'ün <b>${d.ortak300}</b> oyuncusu aynı.</p><div class="iki">${b("En çok yükselenler",d.yukselen)}${b("En çok düşenler",d.dusen)}${b("İlk 300'e girenler",d.girenler)}${b("İlk 300'den çıkanlar",d.cikanlar)}</div>`;
  document.querySelectorAll("#farkic .ad").forEach(x=>x.onclick=()=>detay(x.dataset.ad))}
async function detay(ad){const d=await api("/api/oyuncu?ad="+encodeURIComponent(ad));const n=d.neden;const r=(k,v)=>`<tr><td class="alt">${k}</td><td>${v}</td></tr>`;
  let ic=r("Sıra",`${d.sira.toLocaleString("tr")}. (kayıtlı: ${d.eski?d.eski.toLocaleString("tr")+".":"—"})`)+r("Tanınırlık",d.T.toFixed(2))+r("Güncel ilgi / kalıcı ün",`${d.G.toFixed(1)} / ${d.E.toFixed(1)}`);
  if(n.olculen){ic+=r("Vikipedi dil sayısı",`${n.dil} <span class="alt">(üst %${(100-n.p_dil).toFixed(1)})</span>`)+r("İngilizce görüntülenme (12 ay)",`${(n.en||0).toLocaleString("tr")} <span class="alt">(üst %${(100-n.p_en).toFixed(1)})</span>`)+r("Türkçe görüntülenme (12 ay)",`${(n.tr||0).toLocaleString("tr")} <span class="alt">(üst %${(100-n.p_tr).toFixed(1)})</span>`)+r("Kariyer (maç × kulüp, kupa, milli)",`üst %${(100-n.p_kariyer).toFixed(1)}`)+r("Türkiye bağı",n.tr_bag>=1?"var":n.tr_bag>0?"kısmen":"yok")+(n.hoca?r("Hoca","evet — hocalık ünü törpülenir"):"")+r("Açıklama",esc(n.aciklama||"—"))}
  else ic+=r("Vikipedi","bulunamadı — kulüplerinden tahmin")+(n.yildiz_listesi?r("Yıldız listesi",n.yildiz_listesi):"");
  ic+=d.kulupler.map((k,i)=>r(d.kulupler.length>1?`${i+1}. kişi kulüpleri`:"Kulüpler",esc(k))).join("");
  $("#detay").innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><b>${esc(ad)}</b><button class="btn" onclick="this.closest('#detay').style.display='none'">Kapat</button></div><table>${ic}</table>`;$("#detay").style.display="block"}
function yenile(){if(sekme==="sira")liste();if(sekme==="zorluk")zorluk();if(sekme==="fark")farkCiz()}
document.querySelectorAll(".sek").forEach(b=>b.onclick=()=>{document.querySelectorAll(".sek").forEach(x=>x.classList.toggle("aktif",x===b));sekme=b.dataset.s;["sira","zorluk","fark"].forEach(s=>$("#s-"+s).hidden=s!==sekme);yenile()});
$("#q").oninput=()=>{clearTimeout(zaman);zaman=setTimeout(()=>{sayfa=0;liste()},250)};
$("#bolge").onchange=$("#yalnizElle").onchange=()=>{sayfa=0;liste()};
$("#onceki").onclick=()=>{sayfa--;liste();scrollTo(0,0)};$("#sonraki").onclick=()=>{sayfa++;liste();scrollTo(0,0)};
$("#zd").oninput=()=>{$("#zdy").textContent=$("#zd").value};$("#zd").onchange=$("#profil").onchange=()=>zorluk();
$("#kaydet").onclick=async()=>{$("#kaydet").disabled=true;D=await api("/api/kaydet",{});durumCiz();yenile();setTimeout(async()=>{D=await api("/api/durum");durumCiz()},8000)};
$("#varsayilan").onclick=async()=>{D=await api("/api/agirlik",{agirlik:D.varsayilan});durumCiz();yenile()};
(async()=>{D=await api("/api/durum");
  $("#bolge").innerHTML+=Object.entries(D.karolar).map(([k,a])=>`<option value="${k}">${esc(a)}</option>`).join("");
  $("#profil").innerHTML=Object.entries(D.profiller).map(([k,a])=>`<option value="${k}">${esc(a)}</option>`).join("");
  durumCiz();liste()})();
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

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        p = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        try:
            if u.path == "/":
                b = SAYFA.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(b)))
                self.end_headers()
                self.wfile.write(b)
            elif u.path == "/api/durum":
                self._json(durum())
            elif u.path == "/api/liste":
                with KILIT:
                    self._json(liste(p.get("q", ""), p.get("bolge", ""), p.get("elle") == "1", int(p.get("sayfa") or 0)))
            elif u.path == "/api/zorluk":
                with KILIT:
                    d = min(10, max(1, int(p.get("d") or 3)))
                    self._json(zorluk(p.get("profil") or "dengeli", d, p.get("bolge") or ""))
            elif u.path == "/api/fark":
                with KILIT:
                    self._json(fark())
            elif u.path == "/api/oyuncu":
                ad = p.get("ad", "")
                if ad not in D["sonuc"]:
                    return self._json({"hata": "oyuncu yok"}, 404)
                s = D["sonuc"][ad]
                self._json({"ad": ad, "sira": s["sira"], "T": s["T"], "G": s["G"], "E": s["E"],
                            "eski": D["kayitli_sira"].get(ad), "neden": P.neden(D["v"], ad, D["agirlik"]),
                            "kulupler": [", ".join(k) for k in D["v"].kulupler[ad]]})
            else:
                self._json({"hata": "yok"}, 404)
        except Exception as e:  # noqa: BLE001
            self._json({"hata": str(e)}, 400)

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        kaynak = self.headers.get("Origin") or ""
        if kaynak and not kaynak.startswith(("http://127.0.0.1", "http://localhost")):
            return self._json({"hata": "izin yok"}, 403)
        n = int(self.headers.get("Content-Length") or 0)
        if n > 1024 * 1024:
            return self._json({"hata": "çok büyük"}, 400)
        try:
            g = json.loads(self.rfile.read(n).decode("utf-8") or "{}") if n else {}
            with KILIT:
                if u.path == "/api/agirlik":
                    a = dict(D["agirlik"])
                    for k, x in (g.get("agirlik") or {}).items():
                        if k in P.VARSAYILAN:
                            x = float(x)
                            a[k] = min(99.0, max(50.0, x)) if k == "verisiz_tavan" else min(1.0, max(0.0, x))
                    D["agirlik"] = a
                    yeniden_hesapla()
                    return self._json(durum())
                if u.path == "/api/oyuncu":
                    ad, ayar = g.get("ad"), g.get("ayar")
                    if ad not in D["sonuc"]:
                        raise ValueError("oyuncu yok")
                    temiz = None
                    if isinstance(ayar, dict):
                        if ayar.get("cikar"):
                            temiz = {"cikar": True}
                        elif ayar.get("sira"):
                            temiz = {"sira": max(1, int(ayar["sira"]))}
                        elif ayar.get("kademe"):
                            temiz = {"kademe": max(-8, min(8, int(ayar["kademe"])))}
                    if temiz:
                        D["oyuncu_ayar"][ad] = temiz
                    else:
                        D["oyuncu_ayar"].pop(ad, None)
                    yeniden_hesapla()
                    return self._json(durum())
                if u.path == "/api/kaydet":
                    return self._json(kaydet())
            self._json({"hata": "yok"}, 404)
        except Exception as e:  # noqa: BLE001
            self._json({"hata": str(e)}, 400)


def hazirla():
    print("Veri okunuyor (veri/ozgecmis_ham.json)…")
    D["v"] = P.Veri()
    D["sab"] = js_sabitleri()
    D["bolge"] = bolgeleri_hesapla(D["v"], D["sab"])
    kayitli_oku()
    D["agirlik"] = dict(D["kayitli_agirlik"])
    D["oyuncu_ayar"] = dict(D["kayitli_oyuncu"])
    yeniden_hesapla()


def ana():
    ap = argparse.ArgumentParser(description="Popülerlik paneli")
    ap.add_argument("--port", type=int, default=8766)
    ap.add_argument("--tarayici-acma", action="store_true")
    a = ap.parse_args()
    t = time.time()
    hazirla()
    sunucu = ThreadingHTTPServer(("127.0.0.1", a.port), Isleyici)
    adres = "http://127.0.0.1:%d" % a.port
    print("Popülerlik paneli açık: %s   (%d oyuncu, %.1f sn)" % (adres, len(D["sira_liste"]), time.time() - t))
    print("KAYDET'e basınca scripts/populerlik_ayar.json + lib/playerFame.json yazılır, lib/paket yenilenir.")
    print("Kapatmak için Ctrl+C. Bitince: git add scripts/populerlik_ayar.json lib/playerFame.json lib/paket → commit → push → eas update")
    if not a.tarayici_acma:
        try:
            webbrowser.open(adres)
        except Exception:
            pass
    try:
        sunucu.serve_forever()
    except KeyboardInterrupt:
        print("\nKapatıldı.")


if __name__ == "__main__":
    ana()
