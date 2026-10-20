// ============================================================================
// EŞLEŞME PROFİLİ — 2. sürüm (Paket 27, 12 Ekim 2026)
//
// Kerem: "eşleştirme profillerini baştan çalışmamız lazım. ayrıca bu eşleştirme
// profilleri ekranı da karmaşık duruyor. müthiş bir sistem çalışmalısın orada."
//
// 1. sürümün sorunları (ölçüldü: test/sim_profil.mjs):
//   • Profiller birbirinin aynısıydı. Zorluk 3'te "Dengeli", "Türkiye Ağırlıklı"
//     ve "Dünya Futbolu"nun havuzu AYNI 113 oyuncuydu: zorluk tabanı bütün veri
//     setinin en tanınan %0,25'ini alıyor, profil ancak bu küçük havuzun İÇİNDE
//     ağırlık değiştirebiliyordu. "Türkiye Ağırlıklı"da Türk kulübü oranı %36'ydı.
//   • Dar profiller çöküyordu: zorluk 3'te "Sadece Süper Lig" 8 oyuncu,
//     "Şampiyonlar Ligi" 8 oyuncu; 14 turda soru bitiyordu.
//   • 3 sekme, 9 kavram (temel, bölge kademesi, dönem, küçük kulüp, lig ağırlığı,
//     ülke ağırlığı, kulüp ayarı, yıl sınırı, takım). Hangisinin hangisini
//     ezdiği belirsizdi; "küçük kulüpler" ile mod zorluğu aynı işi yapıyordu.
//   • Kulüplerin %15'inin ülkesi bilinmiyordu (Ajax, PSV, Bologna, Espanyol…).
//
// 2. SÜRÜM — dört soru:
//   NEREDEN   8 karo: Türkiye, İngiltere, İspanya, İtalya, Almanya, Fransa,
//             Diğer Avrupa, Dünya. Her biri 0 kapalı · 1 açık · 2 ağırlıklı.
//             Türkiye = Süper Lig + 1. Lig (+ tanınan Türk kulüpleri).
//   KULÜPLER  hepsi · büyük kulüpler (güncel üst ligler + tanınanlar) · Şampiyonlar Ligi
//   NE ZAMAN  on yıllar (90'lar ve önce, 2000'ler, 2010'lar, bugün), çoklu
//   TAKIMIN   tuttuğun takım + ne sıklıkla
// (+ Gelişmiş: kulüp bazında "öne çıkar" / "hiç çıkmasın")
// Hazır profiller bu dört sorunun hazır cevapları; bir şey değişince "Özel".
//
// MOTOR — eskisiyle aynı arayüz (kapsam, kulupCarpani, oyuncuCarpani,
// onlineKapsam, takim, takimOrani), ek olarak:
//   oyuncuBolgesi(p) + bolgeHedefi: havuz kurulurken (lib/gameEngine.js) zorluk
//   tabanı HER BÖLGENİN KENDİ İÇİNDE uygulanır ve bölgelerin turlardaki payı
//   karolardaki seçime göre AYARLANIR (açık = 1 pay, ağırlıklı = 3 pay).
//   Böylece "Türkiye ağırlıklı" gerçekten Türk ağırlıklı, "Sadece Süper Lig"
//   kolayda bile yeterince oyuncuyla çalışır.
// ============================================================================
import { _t, ingilizceMi } from "./dil";
import { canonicalClub } from "./clubAliases";
import { SUPER_LIG_CLUBS, TFF1_LIG_CLUBS } from "./clubTiers";
import {
  PREMIER_LEAGUE_CLUBS, LA_LIGA_CLUBS, SERIE_A_CLUBS, BUNDESLIGA_CLUBS, LIGUE_1_CLUBS,
} from "./big5ClubTiers";
import { CHAMPIONS_LEAGUE_ALL_TIME_LIST } from "./leaguePresets";
import { weightForClubs } from "./clubWeights";
import { PLAYER_LAST_ACTIVE_YEAR } from "./playerYears";

// ---------------------------------------------------------------- yardımcılar
function sade(s) {
  return String(s || "")
    .replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/\s+(j\.?\s?k\.?|s\.?\s?k\.?|f\.?\s?k\.?|a\.?\s?s\.?|gsk|f\.?\s?c\.?|c\.?\s?f\.?|a\.?\s?f\.?\s?c\.?)\.?$/i, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
const kume = (liste) => new Set(liste.map((c) => sade(canonicalClub(c))));
const anahtar = (c) => sade(canonicalClub(c));

// ---------------------------------------------------------------- ligler
export const LIGLER = [
  { id: "superLig", ad: _t("Süper Lig"), bayrak: "🇹🇷", ulke: "Turkey", kulupler: kume(SUPER_LIG_CLUBS) },
  { id: "tff1", ad: _t("TFF 1. Lig"), bayrak: "🇹🇷", ulke: "Turkey", kulupler: kume(TFF1_LIG_CLUBS) },
  { id: "premier", ad: _t("Premier League"), bayrak: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", ulke: "United Kingdom", kulupler: kume(PREMIER_LEAGUE_CLUBS) },
  { id: "laliga", ad: _t("La Liga"), bayrak: "🇪🇸", ulke: "Spain", kulupler: kume(LA_LIGA_CLUBS) },
  { id: "seriea", ad: _t("Serie A"), bayrak: "🇮🇹", ulke: "Italy", kulupler: kume(SERIE_A_CLUBS) },
  { id: "bundesliga", ad: _t("Bundesliga"), bayrak: "🇩🇪", ulke: "Germany", kulupler: kume(BUNDESLIGA_CLUBS) },
  { id: "ligue1", ad: _t("Ligue 1"), bayrak: "🇫🇷", ulke: "France", kulupler: kume(LIGUE_1_CLUBS) },
];
const SL_KULUPLERI = kume(CHAMPIONS_LEAGUE_ALL_TIME_LIST);
const BUYUK5_ULKE = new Set(["United Kingdom", "Spain", "Italy", "Germany", "France"]);
const AVRUPA = new Set([
  "Portugal", "Netherlands", "Belgium", "Scotland", "Switzerland", "Austria", "Greece", "Russia",
  "Ukraine", "Croatia", "Serbia", "Czech Republic", "Poland", "Denmark", "Sweden", "Norway",
  "Romania", "Hungary", "Bulgaria", "Slovakia", "Slovenia", "Bosnia and Herzegovina", "Cyprus",
  "Israel", "Azerbaijan", "Kazakhstan", "Finland", "Iceland", "Ireland", "Republic of Ireland",
  "Albania", "North Macedonia", "Montenegro", "Belarus", "Georgia", "Armenia", "Moldova",
  "Lithuania", "Latvia", "Estonia", "Luxembourg", "Malta", "Andorra", "Liechtenstein",
  "San Marino", "Faroe Islands", "Kosovo", "Monaco", "Gibraltar", "Wales", "Northern Ireland",
  "Yugoslavia", "Czechoslovakia", "Soviet Union", "West Germany", "East Germany", "German Reich",
]);

// ---------------------------------------------------------------- karolar
export const KAROLAR = [
  { id: "tr", ad: _t("Türkiye"), bayrak: "🇹🇷", ulke: "Turkey", aciklama: _t("Süper Lig ve 1. Lig") },
  { id: "eng", ad: _t("İngiltere"), bayrak: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", ulke: "United Kingdom" },
  { id: "esp", ad: _t("İspanya"), bayrak: "🇪🇸", ulke: "Spain" },
  { id: "ita", ad: _t("İtalya"), bayrak: "🇮🇹", ulke: "Italy" },
  { id: "ger", ad: _t("Almanya"), bayrak: "🇩🇪", ulke: "Germany" },
  { id: "fra", ad: _t("Fransa"), bayrak: "🇫🇷", ulke: "France" },
  { id: "avr", ad: _t("Diğer Avrupa"), bayrak: "🇵🇹", aciklama: _t("Portekiz, Hollanda, İskoçya, Yunanistan…") },
  { id: "dunya", ad: _t("Dünya"), bayrak: "🌎", aciklama: _t("Güney Amerika, MLS, Asya, Afrika…") },
];
export const KARO_IDLERI = KAROLAR.map((k) => k.id);
const ULKE_KARO = { Turkey: "tr", "United Kingdom": "eng", England: "eng", Spain: "esp", Italy: "ita", Germany: "ger", "West Germany": "ger", "German Reich": "ger", France: "fra" };
export const KARO_DURUMLARI = ["kapalı", "açık", "ağırlıklı"];
const KARO_PAY = [0, 1, 3];   // turlardaki pay: açık 1, ağırlıklı 3

export const KULUP_SEVIYELERI = [
  { deger: "hepsi", etiket: _t("Hepsi"), aciklama: _t("Seçili ülkelerin bütün kulüpleri (az tanınanları zorluk eler)") },
  { deger: "buyuk", etiket: _t("Büyük kulüpler"), aciklama: _t("Güncel üst ligler ve Avrupa'da tanınan kulüpler") },
  { deger: "sl", etiket: _t("Şampiyonlar Ligi"), aciklama: _t("Şampiyonlar Ligi'nde oynamış kulüpler") },
];

export const DONEMLER = [
  { deger: "90", etiket: _t("90'lar ve önce"), bas: 0, bit: 1999 },
  { deger: "2000", etiket: _t("2000'ler"), bas: 2000, bit: 2009 },
  { deger: "2010", etiket: _t("2010'lar"), bas: 2010, bit: 2019 },
  { deger: "bugun", etiket: _t("Bugün"), bas: 2020, bit: 9999 },
];
const TUM_DONEMLER = DONEMLER.map((d) => d.deger);

export const TAKIM_ORANI = [
  { deger: "yok", etiket: _t("Özel ilgi yok"), oran: 0 },
  { deger: "az", etiket: _t("Normal"), oran: 0.15 },
  { deger: "cok", etiket: _t("Sık"), oran: 0.35 },
];

// Kulüp -> ülke (scripts/ozgecmis_isle.py + Paket 27 scripts/kulup_ulke_tahmin.py).
let _ulke = null;
function kulupUlkeleri() {
  if (_ulke) return _ulke;
  try { _ulke = require("./clubCountries.json") || {}; } catch (e) { _ulke = {}; }
  if (_ulke && _ulke.default && typeof _ulke.default === "object") _ulke = _ulke.default;
  return _ulke;
}

const REZERV = /\b(b|c|ii|iii|u\d\d|youth|reserves?|juvenil|primavera|castilla|atletic|jong)\b/i;

// Bir kulübün kategorileri (bir kez hesaplanır, önbellekte kalır).
//   lig: güncel üst lig kimliği · ulke · bolge (tr/b5/avr/dunya; bilgiTesti kullanır)
//   karo: tr/eng/esp/ita/ger/fra/avr/dunya ya da null (bilinmiyor)
//   buyuk: güncel üst lig, ŞL kulübü ya da tanınan kulüp · sl: ŞL kulübü
const _katOnbellek = new Map();
export function kulupKategorisi(kulup) {
  let k = _katOnbellek.get(kulup);
  if (k) return k;
  const a = anahtar(kulup);
  const lig = LIGLER.find((l) => l.kulupler.has(a)) || null;
  const U = kulupUlkeleri();
  const ulke = U[kulup] || U[canonicalClub(kulup)] || (lig ? lig.ulke : null);
  const bolge =
    ulke === "Turkey" ? "tr" :
    ulke && BUYUK5_ULKE.has(ulke) ? "b5" :
    ulke && AVRUPA.has(ulke) ? "avr" :
    ulke ? "dunya" : null;
  const w = weightForClubs([kulup]);
  const sl = SL_KULUPLERI.has(a);
  let karo = ulke ? (ULKE_KARO[ulke] || (AVRUPA.has(ulke) ? "avr" : "dunya")) : null;
  // Türkiye karosu: Süper Lig + 1. Lig (+ ağırlık sistemi tanıyorsa). Alt ligler hiçbir karoya girmez.
  if (karo === "tr" && !(lig && (lig.id === "superLig" || lig.id === "tff1")) && w < 2.5) karo = "trAlt";
  k = { lig: lig ? lig.id : null, ulke, bolge, karo, sl, buyuk: !!lig || sl || w >= 2.5, rezerv: REZERV.test(String(kulup)) };
  _katOnbellek.set(kulup, k);
  return k;
}

// ---------------------------------------------------------------- hazır profiller
const K = (tr, eng, esp, ita, ger, fra, avr, dunya) => ({ tr, eng, esp, ita, ger, fra, avr, dunya });
export const HAZIR_PROFILLER = [
  { id: "dengeli", ad: _t("Dengeli"), ikon: "⚖️", aciklama: _t("Türkiye ve Avrupa'nın büyük ligleri, her dönemden"),
    karolar: K(2, 1, 1, 1, 1, 1, 1, 0), kulupler: "hepsi", donemler: TUM_DONEMLER },
  { id: "turkiye", ad: _t("Türkiye"), ikon: "🇹🇷", aciklama: _t("Çoğunlukla Türk kulüpleri, arada Avrupa"),
    karolar: K(2, 1, 0, 0, 0, 0, 0, 0), kulupler: "hepsi", donemler: TUM_DONEMLER },
  { id: "superLig", ad: _t("Süper Lig"), ikon: "🏟️", aciklama: _t("Yalnız Türk kulüpleri"),
    karolar: K(1, 0, 0, 0, 0, 0, 0, 0), kulupler: "hepsi", donemler: TUM_DONEMLER },
  { id: "big5", ad: _t("5 Büyük Lig"), ikon: "🌍", aciklama: _t("İngiltere, İspanya, İtalya, Almanya, Fransa"),
    karolar: K(0, 1, 1, 1, 1, 1, 0, 0), kulupler: "buyuk", donemler: TUM_DONEMLER },
  { id: "sampiyonlar", ad: _t("Şampiyonlar Ligi"), ikon: "🏆", aciklama: _t("Avrupa'nın devleri, Türk büyükleri dahil"),
    karolar: K(1, 1, 1, 1, 1, 1, 1, 0), kulupler: "sl", donemler: TUM_DONEMLER },
  { id: "nostalji", ad: _t("Nostalji"), ikon: "📼", aciklama: _t("90'lar ve 2000'ler"),
    karolar: K(2, 1, 1, 1, 1, 1, 1, 0), kulupler: "hepsi", donemler: ["90", "2000"] },
  { id: "dunya", ad: _t("Dünya Futbolu"), ikon: "🌐", aciklama: _t("Her ülkeden, her ligden — en geniş havuz"),
    karolar: K(1, 1, 1, 1, 1, 1, 1, 1), kulupler: "hepsi", donemler: TUM_DONEMLER },
];
const HAZIR = Object.fromEntries(HAZIR_PROFILLER.map((h) => [h.id, h]));

// Paket 39: İngilizce kullanıcının varsayılanı Türkiye ağırlıklı değil, Avrupa'nın devleri
// (Türk büyükleri dahil). GÜNLÜK oyunlar herkese aynı olsun diye sabit "dengeli" ile kurulur.
const VARSAYILAN_TEMEL = ingilizceMi() ? "sampiyonlar" : "dengeli";
export const GUNLUK_PROFIL = {
  surum: 2, temel: "dengeli", karolar: { ...HAZIR.dengeli.karolar }, kulupler: "hepsi",
  donemler: [...TUM_DONEMLER], takim: null, takimOrani: "az", kulupAyar: {},
};
export const VARSAYILAN_PROFIL = {
  surum: 2,
  temel: VARSAYILAN_TEMEL,       // seçili hazır profil; elle değişince "ozel"
  karolar: { ...HAZIR[VARSAYILAN_TEMEL].karolar },
  kulupler: HAZIR[VARSAYILAN_TEMEL].kulupler,
  donemler: [...TUM_DONEMLER],
  takim: null, takimOrani: "az",
  kulupAyar: {},                 // { "Galatasaray": "one" | "haric" }
};

export function hazirdanProfil(id, eski = {}) {
  const h = HAZIR[id] || HAZIR.dengeli;
  return {
    ...VARSAYILAN_PROFIL,
    temel: h.id, karolar: { ...h.karolar }, kulupler: h.kulupler, donemler: [...h.donemler],
    takim: eski.takim ?? null, takimOrani: eski.takimOrani || "az", kulupAyar: { ...(eski.kulupAyar || {}) },
  };
}

// Seçimler bir hazır profille birebir aynı mı? (aynıysa onun adı gösterilir)
export function hazirEslesmesi(p) {
  for (const h of HAZIR_PROFILLER) {
    if (h.kulupler !== p.kulupler) continue;
    if (KARO_IDLERI.some((k) => (h.karolar[k] || 0) !== ((p.karolar || {})[k] || 0))) continue;
    const a = [...(p.donemler || [])].sort().join(), b = [...h.donemler].sort().join();
    if (a !== b) continue;
    return h.id;
  }
  return "ozel";
}

// ---------------------------------------------------------------- 1. sürümden geçiş
const ESKI_PRESET = {
  turkey_top2: "superLig", turkey_super: "superLig", turkey_all: "turkiye", top5: "big5",
  champions_current: "sampiyonlar", champions_all_time: "sampiyonlar", premier: "big5", all: "dunya",
};
export function eskiPresettenProfil(presetId) {
  return hazirdanProfil(ESKI_PRESET[presetId] || "dengeli");
}

// 1. sürüm profilini (temel/bolge/donem/kucukKulup/ligAgirlik/yilAraligi) 2. sürüme çevirir.
function surum1den(p) {
  const yeni = hazirdanProfil(HAZIR[p.temel] ? p.temel : "dengeli", p);
  const karolar = yeni.karolar;
  if (p.bolge != null) {
    if (p.bolge <= 0) Object.assign(karolar, { tr: 2, eng: karolar.eng && 1, esp: karolar.esp && 1, ita: karolar.ita && 1, ger: karolar.ger && 1, fra: karolar.fra && 1, avr: 0, dunya: 0 });
    else if (p.bolge === 1) karolar.tr = 2;
    else if (p.bolge === 3) { karolar.tr = karolar.tr ? 1 : 0; for (const k of ["eng", "esp", "ita", "ger", "fra"]) if (karolar[k]) karolar[k] = 2; }
    else if (p.bolge >= 4) { karolar.tr = 0; for (const k of ["eng", "esp", "ita", "ger", "fra"]) karolar[k] = 2; }
  }
  if (p.donem === "guncel") yeni.donemler = ["2010", "bugun"];
  else if (p.donem === "nostalji") yeni.donemler = ["90", "2000"];
  if (p.kucukKulup === "haric" && yeni.kulupler === "hepsi") yeni.kulupler = "buyuk";
  if (Array.isArray(p.yilAraligi) && p.yilAraligi[0]) yeni.donemler = yeni.donemler.filter((d) => (DONEMLER.find((x) => x.deger === d) || {}).bit >= p.yilAraligi[0]);
  if (!yeni.donemler.length) yeni.donemler = ["bugun"];
  const ligKaro = { superLig: "tr", tff1: "tr", premier: "eng", laliga: "esp", seriea: "ita", bundesliga: "ger", ligue1: "fra" };
  for (const [lig, v] of Object.entries(p.ligAgirlik || {})) {
    const k = ligKaro[lig];
    if (k) karolar[k] = v === 0 ? 0 : v >= 200 ? 2 : Math.max(1, karolar[k]);
  }
  const kA = {};
  for (const [ad, d] of Object.entries(p.kulupAyar || {})) if (d === "one" || d === "haric") kA[ad] = d;
  yeni.kulupAyar = kA;
  yeni.temel = hazirEslesmesi(yeni);
  return yeni;
}

export function profiliDuzenle(p) {
  if (!p || typeof p !== "object") return { ...VARSAYILAN_PROFIL };
  if (p.surum !== 2) return surum1den({ ...p });
  const n = { ...VARSAYILAN_PROFIL, ...p };
  n.karolar = { ...VARSAYILAN_PROFIL.karolar, ...(p.karolar || {}) };
  n.donemler = Array.isArray(p.donemler) && p.donemler.length ? p.donemler.filter((d) => TUM_DONEMLER.includes(d)) : [...TUM_DONEMLER];
  if (!n.donemler.length) n.donemler = [...TUM_DONEMLER];
  if (!KULUP_SEVIYELERI.some((s) => s.deger === n.kulupler)) n.kulupler = "hepsi";
  return n;
}

// Ayarlar'dan profili okur (yoksa eski ön ayardan türetir).
export function ayarlardanProfil(settings) {
  const p = settings && settings.eslesmeProfili;
  if (p && typeof p === "object") return profiliDuzenle(p);
  if (settings && settings.defaultLeaguePresetId && settings.defaultLeaguePresetId !== "turkey_top2") {
    return eskiPresettenProfil(settings.defaultLeaguePresetId);
  }
  return { ...VARSAYILAN_PROFIL };
}

// Eski ekranlar için (ana sayfa vitrini): bölge kademesi 0 (hep Türkiye) … 4 (hep Avrupa).
export function etkinAyar(profil) {
  const p = profiliDuzenle(profil);
  const k = p.karolar;
  const avrupa = ["eng", "esp", "ita", "ger", "fra", "avr", "dunya"].map((x) => k[x] || 0);
  const avrMax = Math.max(...avrupa);
  let bolge = 2;
  if (!k.tr) bolge = 4;
  else if (avrMax === 0) bolge = 0;
  else if (k.tr === 2 && avrMax <= 1 && avrupa.filter((x) => x > 0).length <= 2) bolge = 1;
  else if (k.tr === 1 && avrMax === 2) bolge = 3;
  const d = p.donemler;
  const donem = d.length === TUM_DONEMLER.length ? "karisik" : d.every((x) => x === "90" || x === "2000") ? "nostalji" : d.every((x) => x === "2010" || x === "bugun") ? "guncel" : "karisik";
  return { bolge, donem, kucukKulup: p.kulupler === "hepsi" ? "normal" : "haric" };
}

export function ozellestirilmisMi(profil) {
  const p = profiliDuzenle(profil);
  return hazirEslesmesi(p) === "ozel" || Object.keys(p.kulupAyar || {}).length > 0;
}

export function profilEtiketi(profil) {
  if (!profil) return _t("Dengeli");
  const p = profiliDuzenle(profil);
  const h = hazirEslesmesi(p);
  let e = h === "ozel" ? _t("Özel") : _t(HAZIR[h].ad);
  if (Object.keys(p.kulupAyar || {}).length) e += _t(" · özel");
  if (p.takim && p.takimOrani !== "yok") e += ` · ${p.takim}`;
  return e;
}

// Bilgi testi önerisini profile uygular (takım ve kulüp ayarları korunur).
export function oneriyiProfileUygula(profil, oneri) {
  const eski = profiliDuzenle(profil);
  return surum1den({ temel: oneri?.temel || "dengeli", bolge: oneri?.bolge ?? null, donem: oneri?.donem ?? null, takim: eski.takim, takimOrani: eski.takimOrani, kulupAyar: eski.kulupAyar });
}

// ---------------------------------------------------------------- derleme
let _tumKulupler = null;
function tumKulupler() {
  if (_tumKulupler) return _tumKulupler;
  const s = new Set();
  try {
    const P = require("./paket/players");
    for (const p of P) for (const c of p.clubs) s.add(c);
  } catch (e) {}
  _tumKulupler = [...s];
  return _tumKulupler;
}

// Oyuncunun yaklaşık aktif dönemi: [son yıl - 8, son yıl].
function donemleri(son) {
  if (!son) return null;
  const bas = son - 8;
  return DONEMLER.filter((d) => bas <= d.bit && son >= d.bas).map((d) => d.deger);
}

const _derlemeOnbellek = new Map();

export function profilDerle(profil) {
  const p = profiliDuzenle(profil);
  const key = JSON.stringify(p);
  const hazir = _derlemeOnbellek.get(key);
  if (hazir) return hazir;

  const karolar = p.karolar;
  const kA = p.kulupAyar || {};
  const takim = p.takim ? canonicalClub(p.takim) : null;
  const seviye = p.kulupler;
  // Ülkesi bilinmeyen kulüpler (çoğu az tanınan yabancı kulüp) yalnız "Dünya" açıksa girer.
  const bilinmeyenDurum = karolar.dunya ? 1 : 0;

  function kulupCarpaniHam(kulup) {
    const ayarK = kA[kulup] || kA[canonicalClub(kulup)];
    if (ayarK === "haric") return 0;
    const kat = kulupKategorisi(kulup);
    if (takim && canonicalClub(kulup) === takim) return 4.5;   // tuttuğun takım hep içeride
    const durum = kat.karo == null ? bilinmeyenDurum : kat.karo === "trAlt" ? 0 : (karolar[kat.karo] || 0);
    if (!durum && ayarK !== "one") return 0;
    if (ayarK !== "one") {
      if (seviye === "buyuk" && !kat.buyuk) return 0;
      if (seviye === "sl" && !kat.sl) return 0;
    }
    let c = KARO_PAY[Math.max(durum, 1)];
    if (ayarK === "one") c *= 3;
    return c;
  }

  const carpanlar = new Map();
  let kapsam = new Set();
  let hepsi = true;
  for (const c of tumKulupler()) {
    const w = kulupCarpaniHam(c);
    carpanlar.set(c, w);
    if (w > 0) kapsam.add(c); else hepsi = false;
  }
  if (hepsi) kapsam = null;

  const kulupCarpani = (c) => {
    const w = carpanlar.get(c);
    return w === undefined ? kulupCarpaniHam(c) : w;
  };

  const donemSet = new Set(p.donemler);
  const donemFiltresi = donemSet.size < TUM_DONEMLER.length;
  function donemUygun(oyuncu) {
    if (!donemFiltresi) return true;
    const d = donemleri(PLAYER_LAST_ACTIVE_YEAR[oyuncu.name]);
    if (!d) return true;
    return d.some((x) => donemSet.has(x));
  }

  // Oyuncunun iki "en güçlü" uygun kulübü yoksa havuza girmez.
  function oyuncuCarpani(oyuncu) {
    if (!donemUygun(oyuncu)) return 0;
    let en1 = 0, en2 = 0;
    for (const c of oyuncu.clubs) {
      const w = kulupCarpani(c);
      if (w > en1) { en2 = en1; en1 = w; } else if (w > en2) en2 = w;
    }
    if (en2 === 0) return 0;
    return (en1 + en2) / 2;
  }

  // Oyuncunun "ana bölgesi": uygun kulüpleri içinde en tanınanının karosu.
  function oyuncuBolgesi(oyuncu) {
    let en = null, enW = -1;
    for (const c of oyuncu.clubs) {
      if (!(kulupCarpani(c) > 0)) continue;
      const w = weightForClubs([c]);
      if (w > enW) { enW = w; en = c; }
    }
    if (!en) return "dunya";
    const kat = kulupKategorisi(en);
    return kat.karo && kat.karo !== "trAlt" ? kat.karo : "dunya";
  }

  // Bölgelerin hedef payı (havuz kurulurken uygulanır).
  const bolgeHedefi = {};
  let payT = 0;
  for (const k of KARO_IDLERI) { const pay = KARO_PAY[karolar[k] || 0]; if (pay) { bolgeHedefi[k] = pay; payT += pay; } }
  for (const k of Object.keys(bolgeHedefi)) bolgeHedefi[k] /= payT || 1;

  // Online odalar: sunucu yalnız "izin verilen kulüpler" listesini anlıyor.
  let _online = null;
  function onlineKapsam() {
    if (_online) return _online;
    const s = new Set();
    // Paket 28: sunucudaki çift havuzu kanonik adlarla; kanonik ad da listede olsun.
    for (const [c, w] of carpanlar) if (w > 0 && weightForClubs([c]) > 1) { s.add(c); s.add(canonicalClub(c)); }
    _online = s;
    return s;
  }

  const oran = (TAKIM_ORANI.find((t) => t.deger === p.takimOrani) || TAKIM_ORANI[1]).oran;
  const sonuc = {
    profil: p,
    anahtar: key,
    etiket: profilEtiketi(p),
    kapsam,
    kulupCarpani,
    oyuncuCarpani,
    oyuncuBolgesi,
    bolgeHedefi,
    onlineKapsam,
    takim: takim && oran > 0 ? takim : null,
    takimOrani: oran,
    yilAraligi: null,
  };
  _derlemeOnbellek.set(key, sonuc);
  return sonuc;
}

// Dereceli (rastgele) online maçlarda herkes aynı havuzla oynar.
export function standartProfil() {
  return profilDerle(VARSAYILAN_PROFIL);
}

// Derlenmiş profil mi, yoksa eski usul allowedClubs (Set/null) mı?
export function derlenmisMi(x) {
  return !!(x && typeof x === "object" && typeof x.oyuncuCarpani === "function");
}
