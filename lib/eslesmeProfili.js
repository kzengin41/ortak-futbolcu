// ============================================================================
// EŞLEŞME PROFİLİ — 28 Eylül 2026
//
// Kerem: "eşleşme seçeneklerini uğraşmak istemeyen, orta uğraş ile halletmek
// isteyen, detaylı uğraşabilen kullanıcılara göre detaylandırmak istiyorum ...
// her şeye hükmeden bir ayarlar yapımız olsun istiyorum. adam tek tek uğraşmak
// istemezse oradan halletsin."
//
// TEK VERİ MODELİ, ÜÇ EDİTÖR:
//   Hızlı    -> `temel` (hazır profil kartı) + tuttuğu takım
//   Ayarla   -> bölge dengesi, dönem, küçük kulüpler, takımın ne sıklıkla çıksın
//   Detaylı  -> lig/ülke bazında ağırlık, kulüp bazında dahil/hariç/öne çıkar,
//               yıl aralığı
// Ayarlar'daki profil HER MODUN varsayılanı; mod kurulumunda sadece o maç için
// değiştirilebilir (components/EslesmeProfiliPenceresi.js).
//
// Motor (profilDerle) profili üç şeye çevirir:
//   kapsam          -> izin verilen kulüpler (Set) ya da null (hepsi serbest).
//                      Eski `allowedClubs` ile birebir aynı şekil, yani eski
//                      kodun tamamı değişmeden çalışır.
//   kulupCarpani(c) -> bir kulübün çıkma ağırlığı (bölge, lig, küçük kulüp, öne çıkar)
//   oyuncuCarpani(p)-> bir oyuncunun seçilme ağırlığı (kulüpleri, dönemi, takım)
// Zorluk (1-10) AYRI kalır: profilin havuzu içinde ne kadar tanınan oyuncu
// çıkacağını belirler.
// ============================================================================
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
// Güncel üst lig listeleri elle derlenmiş (clubTiers / big5ClubTiers).
export const LIGLER = [
  { id: "superLig", ad: "Süper Lig", bayrak: "🇹🇷", ulke: "Turkey", kulupler: kume(SUPER_LIG_CLUBS) },
  { id: "tff1", ad: "TFF 1. Lig", bayrak: "🇹🇷", ulke: "Turkey", kulupler: kume(TFF1_LIG_CLUBS) },
  { id: "premier", ad: "Premier League", bayrak: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", ulke: "United Kingdom", kulupler: kume(PREMIER_LEAGUE_CLUBS) },
  { id: "laliga", ad: "La Liga", bayrak: "🇪🇸", ulke: "Spain", kulupler: kume(LA_LIGA_CLUBS) },
  { id: "seriea", ad: "Serie A", bayrak: "🇮🇹", ulke: "Italy", kulupler: kume(SERIE_A_CLUBS) },
  { id: "bundesliga", ad: "Bundesliga", bayrak: "🇩🇪", ulke: "Germany", kulupler: kume(BUNDESLIGA_CLUBS) },
  { id: "ligue1", ad: "Ligue 1", bayrak: "🇫🇷", ulke: "France", kulupler: kume(LIGUE_1_CLUBS) },
];
const LIG_ID = Object.fromEntries(LIGLER.map((l) => [l.id, l]));
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
]);

// Kulüp -> ülke (scripts/ozgecmis_isle.py üretir; Wikidata'daki takım ülkesi).
let _ulke = null;
function kulupUlkeleri() {
  if (_ulke) return _ulke;
  try { _ulke = require("./clubCountries.json") || {}; } catch (e) { _ulke = {}; }
  if (_ulke && _ulke.default && typeof _ulke.default === "object") _ulke = _ulke.default;
  return _ulke;
}

// Bir kulübün kategorileri: hangi güncel ligde, hangi ülkede, hangi bölgede.
const _katOnbellek = new Map();
export function kulupKategorisi(kulup) {
  let k = _katOnbellek.get(kulup);
  if (k) return k;
  const a = anahtar(kulup);
  const lig = LIGLER.find((l) => l.kulupler.has(a)) || null;
  const ulke = kulupUlkeleri()[kulup] || kulupUlkeleri()[canonicalClub(kulup)] || (lig ? lig.ulke : null);
  const bolge =
    ulke === "Turkey" ? "tr" :
    ulke && BUYUK5_ULKE.has(ulke) ? "b5" :
    ulke && AVRUPA.has(ulke) ? "avr" :
    ulke ? "dunya" : null;
  k = { lig: lig ? lig.id : null, ulke, bolge, sl: SL_KULUPLERI.has(a) };
  _katOnbellek.set(kulup, k);
  return k;
}

// ---------------------------------------------------------------- seçenekler
// Bölge dengesi: 0 = Türkiye çok ağırlıklı ... 4 = Avrupa çok ağırlıklı.
export const BOLGE_KADEMELERI = [
  { deger: 0, etiket: "Hep Türkiye", carpan: { tr: 5.0, b5: 0.7, avr: 0.35, dunya: 0.25, yok: 0.4 } },
  { deger: 1, etiket: "Türkiye ağırlıklı", carpan: { tr: 3.0, b5: 1.0, avr: 0.6, dunya: 0.4, yok: 0.5 } },
  { deger: 2, etiket: "Dengeli", carpan: { tr: 2.0, b5: 1.2, avr: 0.8, dunya: 0.5, yok: 0.6 } },
  { deger: 3, etiket: "Avrupa ağırlıklı", carpan: { tr: 0.8, b5: 2.0, avr: 1.0, dunya: 0.5, yok: 0.6 } },
  { deger: 4, etiket: "Hep Avrupa", carpan: { tr: 0.4, b5: 3.0, avr: 1.3, dunya: 0.6, yok: 0.6 } },
];
export const DONEMLER = [
  { deger: "guncel", etiket: "Güncel", aciklama: "Son yıllarda oynayanlar öne çıkar" },
  { deger: "karisik", etiket: "Karışık", aciklama: "Her dönemden, güncel biraz daha sık" },
  { deger: "nostalji", etiket: "Nostalji", aciklama: "90'lar ve 2000'lerin oyuncuları öne çıkar" },
];
export const KUCUK_KULUP = [
  { deger: "haric", etiket: "Hariç" },
  { deger: "az", etiket: "Az" },
  { deger: "normal", etiket: "Normal" },
];
export const TAKIM_ORANI = [
  { deger: "yok", etiket: "Özel ilgi yok", oran: 0 },
  { deger: "az", etiket: "Ara sıra", oran: 0.15 },
  { deger: "cok", etiket: "Sık sık", oran: 0.35 },
];
// Detaylı: lig / ülke ağırlıkları (yüzde). 0 = hiç çıkmasın.
export const AGIRLIK_SECENEKLERI = [0, 50, 100, 200];

// ---------------------------------------------------------------- hazır profiller
// Her hazır profil = Ayarla kademesinin değerleri + (varsa) kesin kapsam.
export const HAZIR_PROFILLER = [
  { id: "dengeli", ad: "Dengeli", ikon: "⚖️", aciklama: "Türkiye ve Avrupa dengeli, her dönemden",
    ayar: { bolge: 2, donem: "karisik", kucukKulup: "az" } },
  { id: "turkiye", ad: "Türkiye Ağırlıklı", ikon: "🇹🇷", aciklama: "Çoğunlukla Türk kulüpleri, arada dünya yıldızları",
    ayar: { bolge: 0, donem: "karisik", kucukKulup: "az" } },
  { id: "superLig", ad: "Sadece Süper Lig", ikon: "🏟️", aciklama: "Sadece güncel Süper Lig kulüpleri",
    ayar: { bolge: 0, donem: "karisik", kucukKulup: "normal" }, kapsam: { ligler: ["superLig"] } },
  { id: "big5", ad: "5 Büyük Lig", ikon: "🌍", aciklama: "Premier League, La Liga, Serie A, Bundesliga, Ligue 1",
    ayar: { bolge: 4, donem: "karisik", kucukKulup: "normal" },
    kapsam: { ligler: ["premier", "laliga", "seriea", "bundesliga", "ligue1"] } },
  { id: "sampiyonlar", ad: "Şampiyonlar Ligi", ikon: "🏆", aciklama: "Avrupa'nın devleri, Türk büyükleri dahil",
    ayar: { bolge: 2, donem: "karisik", kucukKulup: "normal" }, kapsam: { sl: true } },
  { id: "nostalji", ad: "Nostalji", ikon: "📼", aciklama: "90'lar ve 2000'lerin oyuncuları",
    ayar: { bolge: 1, donem: "nostalji", kucukKulup: "haric" } },
  { id: "dunya", ad: "Dünya Futbolu", ikon: "🌐", aciklama: "Her ülkeden, her ligden — en geniş havuz",
    ayar: { bolge: 3, donem: "karisik", kucukKulup: "normal" } },
];
const HAZIR = Object.fromEntries(HAZIR_PROFILLER.map((h) => [h.id, h]));

export const VARSAYILAN_PROFIL = {
  surum: 1,
  temel: "dengeli",
  // Ayarla kademesi — null = temel profilin değeri
  bolge: null, donem: null, kucukKulup: null,
  // Tuttuğu takım (kanonik ad) + ne sıklıkla çıksın
  takim: null, takimOrani: "az",
  // Detaylı kademe
  ligAgirlik: {},     // { superLig: 200, premier: 0, "ulke:Brazil": 50, digerleri: 100 }
  kulupAyar: {},      // { "Galatasaray": "one" | "haric" | "dahil" }
  yilAraligi: null,   // [1990, 2026]
};

// Eski "Lig / Kapsam" ön ayarlarından (leaguePresets.js) geçiş.
const ESKI_PRESET = {
  turkey_top2: { temel: "superLig", ligAgirlik: { tff1: 100 } },
  turkey_super: { temel: "superLig" },
  turkey_all: { temel: "turkiye" },
  top5: { temel: "big5" },
  champions_current: { temel: "sampiyonlar" },
  champions_all_time: { temel: "sampiyonlar" },
  premier: { temel: "big5", ligAgirlik: { laliga: 0, seriea: 0, bundesliga: 0, ligue1: 0 } },
  all: { temel: "dunya" },
};
export function eskiPresettenProfil(presetId) {
  return { ...VARSAYILAN_PROFIL, ...(ESKI_PRESET[presetId] || {}) };
}

// Ayarlar'dan profili okur (yoksa eski ön ayardan türetir).
export function ayarlardanProfil(settings) {
  const p = settings && settings.eslesmeProfili;
  if (p && typeof p === "object") return { ...VARSAYILAN_PROFIL, ...p };
  // Eski ön ayar sadece kullanıcı onu BİLEREK değiştirdiyse taşınır; eski
  // varsayılan ("Süper Lig + 1. Lig") yeni varsayılan "Dengeli"ye döner.
  if (settings && settings.defaultLeaguePresetId && settings.defaultLeaguePresetId !== "turkey_top2") {
    return eskiPresettenProfil(settings.defaultLeaguePresetId);
  }
  return { ...VARSAYILAN_PROFIL };
}

// Profilin "Ayarla" değerleri (null olanlar temel profilden gelir).
export function etkinAyar(profil) {
  const t = (HAZIR[profil.temel] || HAZIR.dengeli).ayar;
  return {
    bolge: profil.bolge ?? t.bolge,
    donem: profil.donem ?? t.donem,
    kucukKulup: profil.kucukKulup ?? t.kucukKulup,
  };
}

// Kullanıcı hazır profilden bir şey değiştirdi mi? (etikette "· özel" yazar)
export function ozellestirilmisMi(profil) {
  return (
    profil.bolge != null || profil.donem != null || profil.kucukKulup != null ||
    Object.keys(profil.ligAgirlik || {}).length > 0 ||
    Object.keys(profil.kulupAyar || {}).length > 0 || !!profil.yilAraligi
  );
}

export function profilEtiketi(profil) {
  if (!profil) return "Dengeli";
  const t = HAZIR[profil.temel] || HAZIR.dengeli;
  let e = t.ad;
  if (ozellestirilmisMi(profil)) e += " · özel";
  if (profil.takim && profil.takimOrani !== "yok") e += ` · ${profil.takim}`;
  return e;
}

// ---------------------------------------------------------------- derleme
let _tumKulupler = null;
function tumKulupler() {
  if (_tumKulupler) return _tumKulupler;
  const s = new Set();
  try {
    const P = require("./players.json");
    for (const p of P) for (const c of p.clubs) s.add(c);
  } catch (e) {}
  _tumKulupler = [...s];
  return _tumKulupler;
}

const KUCUK_CARPAN = { haric: 0, az: 0.3, normal: 1 };
const _derlemeOnbellek = new Map();

export function profilDerle(profil) {
  const p = { ...VARSAYILAN_PROFIL, ...(profil || {}) };
  const key = JSON.stringify(p);
  const hazir = _derlemeOnbellek.get(key);
  if (hazir) return hazir;

  const temel = HAZIR[p.temel] || HAZIR.dengeli;
  const ayar = etkinAyar(p);
  const bolgeC = (BOLGE_KADEMELERI[ayar.bolge] || BOLGE_KADEMELERI[2]).carpan;
  const kucukC = KUCUK_CARPAN[ayar.kucukKulup] ?? 0.3;
  const lA = p.ligAgirlik || {};
  const kA = p.kulupAyar || {};
  const takim = p.takim ? canonicalClub(p.takim) : null;

  // Kesin kapsam: temel profilin ligleri/ŞL listesi + Detaylı'da 0 verilenler çıkar.
  const temelLigler = temel.kapsam && temel.kapsam.ligler ? new Set(temel.kapsam.ligler) : null;
  // Detaylı'da bir lige ağırlık verilirse (0 değil) temel kapsama EKLENİR.
  const ekLigler = Object.keys(lA).filter((k) => LIG_ID[k] && lA[k] > 0);

  function ligUygun(kat) {
    if (temel.kapsam && temel.kapsam.sl) return kat.sl || (kat.lig && ekLigler.includes(kat.lig));
    if (temelLigler) return (kat.lig && (temelLigler.has(kat.lig) || ekLigler.includes(kat.lig)));
    return true;
  }

  function kulupCarpaniHam(kulup) {
    const ayarK = kA[kulup] || kA[canonicalClub(kulup)];
    if (ayarK === "haric") return 0;
    const kat = kulupKategorisi(kulup);
    if (ayarK !== "dahil" && !ligUygun(kat)) return 0;
    // Detaylı: lig > ülke > diğerleri
    let yuzde = 100;
    if (kat.lig && lA[kat.lig] != null) yuzde = lA[kat.lig];
    else if (kat.ulke && lA["ulke:" + kat.ulke] != null) yuzde = lA["ulke:" + kat.ulke];
    else if (lA.digerleri != null && !kat.lig) yuzde = lA.digerleri;
    if (yuzde === 0 && ayarK !== "dahil") return 0;
    let c = (bolgeC[kat.bolge || "yok"] ?? 0.6) * (yuzde / 100);
    // Küçük kulüp: kulüp ağırlık sistemi (clubWeights) onu tanımıyorsa
    if (weightForClubs([kulup]) <= 1 && ayarK !== "dahil" && ayarK !== "one") {
      if (kucukC === 0) return 0;
      c *= kucukC;
    }
    if (ayarK === "one") c *= 3;
    if (takim && canonicalClub(kulup) === takim) c = Math.max(c, 1) * 1.5;
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
  if (hepsi) kapsam = null;   // filtre yok = eski "Tümü"

  const kulupCarpani = (c) => {
    const w = carpanlar.get(c);
    return w === undefined ? kulupCarpaniHam(c) : w;
  };

  const donem = ayar.donem;
  const yil = p.yilAraligi;
  function donemCarpani(oyuncu) {
    const son = PLAYER_LAST_ACTIVE_YEAR[oyuncu.name];
    if (!son) return 1;
    if (yil && (son < yil[0])) return 0;   // aralıktan önce bırakmış
    const buYil = new Date().getFullYear();
    const yas = buYil - son;
    if (donem === "guncel") return yas <= 5 ? 1.6 : yas <= 12 ? 0.8 : 0.3;
    if (donem === "nostalji") {
      // playerWeight'in güncellik çarpanını (son 5 yıl x4) dengeler, 1990-2012 arasını öne çıkarır
      if (son >= 1992 && son <= 2014) return 6;
      if (son > 2014 && son <= 2019) return 2;
      if (son > 2019) return 0.35;
      return 1.5;
    }
    return 1;
  }

  function oyuncuCarpani(oyuncu) {
    const cs = oyuncu.clubs;
    let en1 = 0, en2 = 0;
    for (const c of cs) {
      const w = kulupCarpani(c);
      if (w > en1) { en2 = en1; en1 = w; } else if (w > en2) en2 = w;
    }
    if (en2 === 0) return 0;              // en az iki uygun kulübü olmalı
    return ((en1 + en2) / 2) * donemCarpani(oyuncu);
  }

  // Online odalar: sunucu sadece "izin verilen kulüpler" listesini anlıyor,
  // ağırlık uygulayamıyor. Kapsam "hepsi" ise tanınmayan kulüpleri dışarıda
  // bırakıp profilin öne çıkardıklarını tutuyoruz (yoksa online tur 46 bin
  // oyuncudan eşit olasılıkla seçerdi).
  let _online = null;
  function onlineKapsam() {
    if (_online) return _online;
    if (kapsam) { _online = kapsam; return _online; }
    const s = new Set();
    for (const [c, w] of carpanlar) {
      if (w >= 0.5 && weightForClubs([c]) > 1) s.add(c);
    }
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
    onlineKapsam,
    takim: takim && oran > 0 ? takim : null,
    takimOrani: oran,
    yilAraligi: yil || null,
  };
  _derlemeOnbellek.set(key, sonuc);
  return sonuc;
}

// Derlenmiş profil mi, yoksa eski usul allowedClubs (Set/null) mı?
export function derlenmisMi(x) {
  return !!(x && typeof x === "object" && typeof x.oyuncuCarpani === "function");
}
