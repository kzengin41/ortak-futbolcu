// ============================================================================
// ÇOKTAN SEÇMELİ — soru üretimi (4 Ekim 2026)
//
// Benchmark kararı (.28218): "60 sn varsayılan (değiştirilebilir), doğru
// +2 sn, seri çarpanı ×2/×3, soru çeşitleri, tek çıkış butonu, tema renkleri,
// kurulumsuz başlangıç, kendiliğinden ayarlanan zorluk."
//
// Dört soru türü (hepsi 4 şık, tek doğru):
//   ortak  — "Hem A hem B'de oynayan hangisi?"           (şıklar: oyuncu)
//   ulke   — "Ülke X'ten olup Y'de oynayan hangisi?"     (şıklar: oyuncu)
//   kulup  — "Z hangi kulüpte oynadı?"                    (şıklar: kulüp)
//   hic    — "Hangisi A'da HİÇ oynamadı?"                 (şıklar: oyuncu)
// Doğru cevap ve çeldiriciler AYNI tanınırlık bandından seçiliyor (kolay
// soruda dört ünlü isim, zor soruda dört az bilinen isim) — çeldirici "kesin
// bu değil" diye elenemesin. Seviye 1–10: lib/taninirlik.js cpuEsigi'yle aynı
// ölçek ("seviye L'deki bir CPU bu oyuncuyu tanır mı").
// ============================================================================
import { PLAYERS } from "./players";
import { canonicalClub } from "./clubAliases";
import { weightForClubs } from "./clubWeights";
import { PLAYER_PHOTO_FILENAME } from "./playerPhotos";
import {
  generateRound, generateCountryTeamRound, computeRoundPool, computeCountryTeamPool,
  rezervTakimMi, FIVE_CLUB_DIFFICULTIES,
} from "./gameEngine";
import { taninirlik, cpuEsigi, cpuCevabiSec } from "./taninirlik";

export const TURLER = ["ortak", "ortak", "ortak", "ulke", "kulup", "kulup", "hic"];
export const BASLANGIC_SURESI = 60;
export const DOGRU_BONUSU = 2; // sn
export const carpan = (seri) => (seri >= 6 ? 3 : seri >= 3 ? 2 : 1);

const fotoVar = (p) => !!PLAYER_PHOTO_FILENAME[p.name];
const kk = (c) => canonicalClub(c);
// Veride aynı kulüp farklı büyük/küçük harfle de geçiyor ("Manchester city").
const kucuk = (c) => canonicalClub(c).toLowerCase();

let _kulupOyuncu = null; // kanonik kulüp -> [oyuncu]
function kulupDizini() {
  if (_kulupOyuncu) return _kulupOyuncu;
  _kulupOyuncu = new Map();
  for (const p of PLAYERS) {
    for (const c of new Set((p.clubs || []).map(kucuk))) {
      if (!_kulupOyuncu.has(c)) _kulupOyuncu.set(c, []);
      _kulupOyuncu.get(c).push(p);
    }
  }
  return _kulupOyuncu;
}
const oynadi = (p, kulup) => (p.clubs || []).some((c) => kucuk(c) === kucuk(kulup));

const karistir = (a, rnd) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};

// Hedefe tanınırlıkça en yakın adaylardan 3 çeldirici.
function yakinlardan(adaylar, hedefT, rnd, adet = 3) {
  const s = [...adaylar].sort((a, b) => Math.abs(taninirlik(a) - hedefT) - Math.abs(taninirlik(b) - hedefT)).slice(0, 14);
  return karistir(s, rnd).slice(0, adet);
}

// Seviyeye uygun doğru cevap: o seviyedeki CPU'nun tanıyacağı biri; yoksa en tanınmışı.
function dogruSec(adaylar, seviye, rnd) {
  const fotolu = adaylar.filter(fotoVar);
  if (!fotolu.length) return null;
  return cpuCevabiSec(fotolu, seviye, rnd) || [...fotolu].sort((a, b) => taninirlik(b) - taninirlik(a))[0];
}

// Havuzlar seviye başına önbellekte (profil değişince yeni önbellek).
export function havuzOnbellegi(profil) {
  const k = new Map(), u = new Map();
  return {
    kulup: (sev) => { if (!k.has(sev)) k.set(sev, computeRoundPool(PLAYERS, profil, sev)); return k.get(sev); },
    ulke: (sev) => { if (!u.has(sev)) u.set(sev, computeCountryTeamPool(PLAYERS, profil, sev)); return u.get(sev); },
    profil,
  };
}

function havuzdanOyuncu(havuz, rnd) {
  if (!havuz || !havuz.entries.length) return null;
  const r = rnd() * havuz.total;
  for (const e of havuz.entries) if (r <= e.cumulative) return e.player;
  return havuz.entries[havuz.entries.length - 1].player;
}

// ------------------------------------------------------------------ türler
function ortakSorusu(h, seviye, kullanilan, rnd) {
  const g = generateRound(h.kulup(seviye), PLAYERS, kullanilan, h.profil, seviye);
  if (!g) return null;
  const dogru = dogruSec(g.validAnswers, seviye, rnd);
  if (!dogru) return null;
  const gecerli = new Set(g.validAnswers.map((p) => p.name));
  const aday = [...(kulupDizini().get(kucuk(g.teamA)) || []), ...(kulupDizini().get(kucuk(g.teamB)) || [])]
    .filter((p) => !gecerli.has(p.name) && fotoVar(p));
  const celdirici = yakinlardan(aday, taninirlik(dogru), rnd);
  if (celdirici.length < 3) return null;
  return {
    tur: "ortak", key: g.key, ust: { a: { tip: "kulup", ad: g.teamA }, b: { tip: "kulup", ad: g.teamB } },
    soru: "İkisinde de oynamış futbolcu hangisi?",
    siklar: karistir([dogru, ...celdirici], rnd).map((p) => ({ tip: "oyuncu", ad: p.name })),
    dogru: dogru.name, acilacak: dogru.name,
  };
}

function ulkeSorusu(h, seviye, kullanilan, rnd) {
  const g = generateCountryTeamRound(h.ulke(seviye), PLAYERS, kullanilan, h.profil, seviye);
  if (!g) return null;
  const dogru = dogruSec(g.validAnswers, seviye, rnd);
  if (!dogru) return null;
  const gecerli = new Set(g.validAnswers.map((p) => p.name));
  const aday = (kulupDizini().get(kucuk(g.club)) || []).filter((p) => !gecerli.has(p.name) && fotoVar(p));
  const celdirici = yakinlardan(aday, taninirlik(dogru), rnd);
  if (celdirici.length < 3) return null;
  return {
    tur: "ulke", key: g.key, ust: { a: { tip: "ulke", ad: g.country }, b: { tip: "kulup", ad: g.club } },
    soru: "Bu ülkeden olup bu kulüpte oynamış futbolcu hangisi?",
    siklar: karistir([dogru, ...celdirici], rnd).map((p) => ({ tip: "oyuncu", ad: p.name })),
    dogru: dogru.name, acilacak: dogru.name,
  };
}

// "Z hangi kulüpte oynadı?" — doğru kulüp Z'nin en tanınmış kulübü; şıklar
// elle seçilmiş tanınmış kulüp listesinden (5 Kulüp'ün "çok zor" havuzu, 88
// kulüp) — veri setindeki "Manchester city" / "Liverpool FC" gibi yazım
// kopyaları şıklara hiç girmesin.
function kulupSorusu(h, seviye, kullanilan, rnd) {
  const liste = FIVE_CLUB_DIFFICULTIES.cokZor.pool;
  for (let i = 0; i < 40; i++) {
    const p = havuzdanOyuncu(h.kulup(seviye), rnd);
    if (!p || !fotoVar(p) || kullanilan.has("k:" + p.name)) continue;
    if (taninirlik(p) < cpuEsigi(seviye) - 3) continue;
    const oynadigi = new Set(p.clubs.map(kucuk));
    const dogru = liste.filter((c) => oynadigi.has(kucuk(c))).sort((a, b) => weightForClubs([b]) - weightForClubs([a]))[0];
    if (!dogru) continue;
    const w = weightForClubs([dogru]);
    const aday = liste.filter((c) => !oynadigi.has(kucuk(c)) && Math.abs(weightForClubs([c]) - w) <= 4);
    if (aday.length < 3) continue;
    return {
      tur: "kulup", key: "k:" + p.name, ust: { oyuncu: p.name },
      soru: `${p.name} hangi kulüpte oynadı?`,
      siklar: karistir([dogru, ...karistir(aday, rnd).slice(0, 3)], rnd).map((c) => ({ tip: "kulup", ad: c })),
      dogru, acilacak: p.name,
    };
  }
  return null;
}

// "Hangisi A'da HİÇ oynamadı?" — üç A oyuncusu + A'nın şehir/lig rakibinde oynamış biri.
function hicSorusu(h, seviye, kullanilan, rnd) {
  for (let i = 0; i < 30; i++) {
    const p = havuzdanOyuncu(h.kulup(seviye), rnd);
    if (!p) continue;
    const liste = FIVE_CLUB_DIFFICULTIES.cokZor.pool;
    const oynadigi = new Set(p.clubs.map(kucuk));
    const kulupler = liste.filter((c) => oynadigi.has(kucuk(c)));
    if (!kulupler.length) continue;
    const A = kulupler[Math.floor(rnd() * kulupler.length)];
    if (kullanilan.has("h:" + A)) continue;
    const esik = cpuEsigi(seviye) - 2;
    const oynayan = (kulupDizini().get(kucuk(A)) || []).filter((x) => fotoVar(x) && taninirlik(x) >= esik);
    if (oynayan.length < 3) continue;
    const uc = yakinlardan(oynayan, taninirlik(p), rnd);
    // Oynamayan: A ile aynı bilinirlikteki başka bir kulübün oyuncusu (A'da hiç oynamamış).
    const komsuKulup = karistir(kulupler.length > 1 ? kulupler.filter((c) => c !== A) : liste.filter((c) => c !== A), rnd)[0];
    const aday = (kulupDizini().get(kucuk(komsuKulup)) || []).filter((x) => fotoVar(x) && !oynadi(x, A) && taninirlik(x) >= esik);
    if (!aday.length || uc.length < 3) continue;
    const dogru = yakinlardan(aday, taninirlik(p), rnd, 1)[0];
    return {
      tur: "hic", key: "h:" + A, ust: { kulup: A },
      soru: "Hangisi bu kulüpte HİÇ oynamadı?",
      siklar: karistir([dogru, ...uc], rnd).map((x) => ({ tip: "oyuncu", ad: x.name })),
      dogru: dogru.name, acilacak: dogru.name,
    };
  }
  return null;
}

const URETICI = { ortak: ortakSorusu, ulke: ulkeSorusu, kulup: kulupSorusu, hic: hicSorusu };

export function soruUret(havuz, seviye, kullanilan, rnd = Math.random) {
  const sirali = karistir(TURLER, rnd);
  for (const tur of [...new Set(sirali)]) {
    for (let d = 0; d < 3; d++) {
      const s = URETICI[tur](havuz, Math.max(1, seviye - d), kullanilan, rnd);
      if (s) return { ...s, seviye };
    }
  }
  return null;
}

// Kendiliğinden ayarlanan zorluk: art arda 3 doğru → +1, art arda 2 yanlış → −1.
export function seviyeGuncelle(seviye, dogruSerisi, yanlisSerisi) {
  if (dogruSerisi > 0 && dogruSerisi % 3 === 0) return Math.min(10, seviye + 1);
  if (yanlisSerisi >= 2) return Math.max(1, seviye - 1);
  return seviye;
}
