// ============================================================================
// FUTBOL BİLGİSİ TESTİ — 4 Ekim 2026
//
// Kerem (3 Ekim): "Kullanıcının futbol bilgisini başlangıçta ölçüp sonrasında
// ona göre otomatik bir eşleşme profili verelim." Onaylanan kurgu: takım
// sorusundan sonra 8 soruluk, geçilebilir, UYARLAMALI bir test.
//
//  • Her soru 4 şıklı. İki tür:
//      ortak  -> "Hem A hem B formasını giymiş futbolcu hangisi?"
//      kulup  -> "X hangi kulüpte oynadı?"
//  • Sorular iki eksende dengeli dağıtılır: Türkiye / Avrupa ve
//    güncel (2018+) / nostalji (2012 ve öncesi). Böylece sonuçtan hem
//    seviye hem de profil (bölge, dönem) çıkar.
//  • Uyarlamalı: 5. seviyeden başlar; doğru cevap seviyeyi artırır, yanlış
//    düşürür (ilk 4 soruda ±2, sonra ±1). Seviye, sorunun tanınırlık
//    sıralamasında hangi aralıktan seçileceğini belirler.
//  • Sonuç: seviye (1–10) = son 4 cevaptan sonraki seviyelerin ortalaması.
//
// Saf modül: React yok, rastgelelik dışarıdan verilebilir (Node testleri).
// ============================================================================
import { PLAYERS } from "./players";
import { weightForClubs } from "./clubWeights";
import { canonicalClub } from "./clubAliases";
import { kulupKategorisi } from "./eslesmeProfili";
import { PLAYER_LAST_ACTIVE_YEAR } from "./playerYears";

let TANIN = {};
try { TANIN = require("./playerFame.json"); } catch (e) {}
if (TANIN && TANIN.default && typeof TANIN.default === "object") TANIN = TANIN.default;

export const SORU_SAYISI = 8;
const BASLANGIC = 5;
const TANINMIS_KULUP = 2.5; // clubWeights: bilinen kulüp ağırlığı ve üstü

// Seviye -> bölgenin tanınırlık sıralamasında hangi aralıktan soru gelir.
const ARALIK = {
  1: [0, 25], 2: [10, 50], 3: [30, 90], 4: [60, 150], 5: [100, 250],
  6: [180, 400], 7: [300, 650], 8: [500, 1000], 9: [800, 1600], 10: [1200, 2500],
};

// 8 sorunun ekseni ve türü — her bölge/dönem birleşimi iki kez.
export const PLAN = [
  { bolge: "tr", donem: "guncel", tur: "ortak" },
  { bolge: "avr", donem: "guncel", tur: "kulup" },
  { bolge: "tr", donem: "nostalji", tur: "kulup" },
  { bolge: "avr", donem: "nostalji", tur: "ortak" },
  { bolge: "avr", donem: "guncel", tur: "ortak" },
  { bolge: "tr", donem: "guncel", tur: "kulup" },
  { bolge: "avr", donem: "nostalji", tur: "kulup" },
  { bolge: "tr", donem: "nostalji", tur: "ortak" },
];

const taninirlik = (ad) => {
  const t = TANIN[ad];
  return t ? Math.max(t[0] || 0, t[1] || 0) : 0;
};

function kulupBolgesi(c) {
  if (weightForClubs([c]) < TANINMIS_KULUP) return null;
  const b = kulupKategorisi(c).bolge;
  if (b === "tr") return "tr";
  if (b === "b5" || b === "avr") return "avr";
  return null;
}

function donemi(ad) {
  const son = PLAYER_LAST_ACTIVE_YEAR[ad];
  if (!Number.isFinite(son)) return null;
  if (son >= 2018) return "guncel";
  if (son <= 2012 && son >= 1985) return "nostalji";
  return null;
}

// Havuzlar: { "tr|guncel": [{ ad, kulupler: [...tanınmış, o bölgedeki, tekil] }...] (tanınırlığa göre sıralı) }
let _havuz = null;
let _kulupOyunculari = null; // kanonik kulüp -> Set(ad)
let _bolgeKulupleri = null;  // bölge -> [kulüp adı] (ağırlığa göre)
let _kulupBilgi = null;       // anahtar -> { ad, bolge, w }
let _gorunen = null;         // kanonik -> en sık yazılışı ("Manchester city" değil "Manchester City")
function hazirla() {
  if (_havuz) return;
  _havuz = {};
  _kulupOyunculari = new Map();
  const kulupAgirlik = (_kulupBilgi = new Map());
  const yazilis = new Map();
  for (const p of PLAYERS) {
    if (!p || !Array.isArray(p.clubs)) continue;
    const tekil = new Map(); // kanonik -> görünen ad
    for (const c of p.clubs) {
      const k = kulupAnahtari(c);
      if (!tekil.has(k)) tekil.set(k, c);
      if (!yazilis.has(k)) yazilis.set(k, new Map());
      yazilis.get(k).set(c, (yazilis.get(k).get(c) || 0) + 1);
      if (!_kulupOyunculari.has(k)) _kulupOyunculari.set(k, new Set());
      _kulupOyunculari.get(k).add(p.name);
    }
    const d = donemi(p.name);
    const t = taninirlik(p.name);
    for (const [k, c] of tekil) {
      const b = kulupBolgesi(c);
      if (b && !kulupAgirlik.has(k)) kulupAgirlik.set(k, { ad: k, bolge: b, w: weightForClubs([c]) });
    }
    if (!d || t <= 0) continue;
    for (const b of ["tr", "avr"]) {
      const kulupler = [...tekil.keys()].filter((k) => kulupAgirlik.get(k)?.bolge === b);
      if (kulupler.length < 2) continue;
      const anahtar = `${b}|${d}`;
      (_havuz[anahtar] = _havuz[anahtar] || []).push({ ad: p.name, kulupler, t });
    }
  }
  for (const k of Object.keys(_havuz)) _havuz[k].sort((a, b) => b.t - a.t);
  _gorunen = new Map();
  for (const [k, m] of yazilis) {
    const enSik = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    // Tamamı küçük harfli bir yazılışı seçme (veride "Manchester city" gibi kayıtlar var)
    const adaylar = [...m.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    _gorunen.set(k, adaylar.find((x) => !/\s[a-zçğıöşü]/.test(x)) || enSik);
  }
  _bolgeKulupleri = { tr: [], avr: [] };
  for (const v of kulupAgirlik.values()) _bolgeKulupleri[v.bolge].push(v);
  for (const b of Object.keys(_bolgeKulupleri)) _bolgeKulupleri[b].sort((x, y) => y.w - x.w);
}

export function havuzBoyutlari() {
  hazirla();
  return Object.fromEntries(Object.entries(_havuz).map(([k, v]) => [k, v.length]));
}

const karistir = (dizi, rnd) => {
  const a = [...dizi];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function aralikta(liste, seviye) {
  const [a, b] = ARALIK[seviye] || ARALIK[5];
  const son = Math.min(b, liste.length);
  const bas = Math.min(a, Math.max(0, son - 20));
  return liste.slice(bas, son);
}

function oynadiMi(oyuncu, kulup) {
  const s = _kulupOyunculari.get(kulup);
  return !!(s && s.has(oyuncu));
}
const ad = (kulup) => (_gorunen && _gorunen.get(kulup)) || kulup;
// Veride aynı kulüp farklı büyük/küçük harfle de geçiyor ("Manchester city").
const kulupAnahtari = (c) => canonicalClub(c).toLowerCase();
const kw = (k) => (_kulupBilgi && _kulupBilgi.get(k)?.w) || 0;

// Bir soru üretir. kullanilan: Set(ad) — aynı futbolcu iki kez sorulmasın.
export function soruUret(plan, seviye, kullanilan = new Set(), rnd = Math.random) {
  hazirla();
  const liste = _havuz[`${plan.bolge}|${plan.donem}`] || [];
  const adaylar = karistir(aralikta(liste, seviye), rnd).filter((x) => !kullanilan.has(x.ad));
  for (const hedef of adaylar) {
    const s = plan.tur === "ortak" ? ortakSorusu(hedef, liste, rnd) : kulupSorusu(hedef, plan.bolge, rnd);
    if (s) return { ...s, ...plan, seviye, hedef: hedef.ad };
  }
  return null;
}

function ortakSorusu(hedef, liste, rnd) {
  // Hedefin en tanınmış iki kulübü (aynı bölgede)
  const kulupler = [...hedef.kulupler].sort((a, b) => kw(b) - kw(a));
  const [A, B] = kulupler.slice(0, 2).sort(() => rnd() - 0.5);
  if (!A || !B) return null;
  // Çeldiriciler: A ya da B'den BİRİNDE oynamış, ikisinde birden oynamamış, hedefe yakın tanınırlıkta
  const yakin = liste
    .filter((x) => x.ad !== hedef.ad && (oynadiMi(x.ad, A) !== oynadiMi(x.ad, B)))
    .sort((x, y) => Math.abs(x.t - hedef.t) - Math.abs(y.t - hedef.t))
    .slice(0, 12);
  if (yakin.length < 3) return null;
  const celdirici = karistir(yakin, rnd).slice(0, 3).map((x) => x.ad);
  return {
    metin: `Hem ${ad(A)} hem ${ad(B)} formasını giymiş futbolcu hangisi?`,
    siklar: karistir([hedef.ad, ...celdirici], rnd),
    dogru: hedef.ad,
  };
}

function kulupSorusu(hedef, bolge, rnd) {
  hazirla();
  const dogru = [...hedef.kulupler].sort((a, b) => kw(b) - kw(a))[0];
  if (!dogru) return null;
  // Çeldiriciler: aynı bölgenin en tanınmış kulüplerinden, hedefin hiç oynamadıkları
  const aday = _bolgeKulupleri[bolge].slice(0, 30).map((x) => x.ad).filter((k) => !oynadiMi(hedef.ad, k) && k !== dogru);
  if (aday.length < 3) return null;
  return {
    metin: `${hedef.ad} hangi kulüpte oynadı?`,
    siklar: karistir([dogru, ...karistir(aday, rnd).slice(0, 3)], rnd).map(ad),
    dogru: ad(dogru),
  };
}

// ------------------------------------------------------------ uyarlama / sonuç
export function sonrakiSeviye(seviye, dogru, soruNo) {
  const adim = soruNo < 4 ? 2 : 1;
  return Math.max(1, Math.min(10, seviye + (dogru ? adim : -adim)));
}
export const ILK_SEVIYE = BASLANGIC;

// cevaplar: [{ bolge, donem, seviye (sorulduğu), dogru, sonra (cevaptan sonraki seviye) }]
export function sonucHesapla(cevaplar) {
  const son4 = cevaplar.slice(-4).map((c) => c.sonra);
  const seviye = son4.length ? Math.round(son4.reduce((a, b) => a + b, 0) / son4.length) : BASLANGIC;
  const oran = (f) => {
    const l = cevaplar.filter(f);
    return l.length ? l.filter((c) => c.dogru).length / l.length : null;
  };
  const tr = oran((c) => c.bolge === "tr");
  const avr = oran((c) => c.bolge === "avr");
  const guncel = oran((c) => c.donem === "guncel");
  const nostalji = oran((c) => c.donem === "nostalji");

  // Profil önerisi: belirgin fark (en az 2/4) varsa o tarafa yasla.
  let temel = "dengeli";
  let bolge = null;
  if (tr != null && avr != null) {
    if (tr - avr >= 0.5) temel = "turkiye";
    else if (avr - tr >= 0.5) bolge = 3; // Avrupa ağırlıklı
  }
  let donem = null;
  if (guncel != null && nostalji != null) {
    if (nostalji - guncel >= 0.5) donem = "nostalji";
    else if (guncel - nostalji >= 0.5) donem = "guncel";
  }
  const dogruSayisi = cevaplar.filter((c) => c.dogru).length;
  return { seviye: Math.max(1, Math.min(10, seviye)), dogruSayisi, oranlar: { tr, avr, guncel, nostalji }, oneri: { temel, bolge, donem } };
}

// Etiketler, öneriyi uygulama, oyunda ince ayar ve mod zorluğu: lib/bilgiSeviyesi.js
// (hafif modül — ana sayfa ve ayarlar players.json yüklemeden kullanabilsin).
