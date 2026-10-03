import AsyncStorage from "@react-native-async-storage/async-storage";
import { addXP } from "./profile";
import { tohum, uretec } from "./tohum";
import { gunlukIcerikBitti } from "./streak";

// ============================================================================
// GÜNLÜK GÖREVLER — 12 Eylül 2026, 4 Ekim 2026'da çeşitlendi (benchmark .29623)
//
// "Görevleri çeşitlendir: 'Kim Bu'da ipucu almadan bil', 'Günün Kadrosu'nda 9+'."
// Her gün 3 görev: biri temel (tur / doğru / futbolcu aç), ikisi özel havuzdan.
// Seçim tarih tohumundan → herkese aynı gün aynı görevler, cihazdan bağımsız.
//
// Sayaçlar tek kapıdan besleniyor: gorevOlayi(olay, ek). Temel olayları
// lib/stats.js (recordRound: "tur", "dogru", farklı mod) ve lib/pokedex.js
// ("acilis") gönderiyor; özel olayları ilgili ekran gönderiyor.
// Üçü bitince tek seferlik XP ve GÜNLÜK SERİ ilerler (lib/streak.js).
// ============================================================================
const ANAHTAR = "gunluk_gorev_v2";
export const GOREV_ODULU = 250; // üçü de tamamlanınca

// olay: hangi gorevOlayi(...) bu görevi ilerletir.
export const GOREV_TANIMLARI = {
  // --- temel
  tur:       { metin: (h) => `${h} tur oyna`, hedef: 5, olay: "tur", temel: true },
  dogru:     { metin: (h) => `${h} doğru cevap ver`, hedef: 5, olay: "dogru", temel: true },
  acilis:    { metin: (h) => `${h} yeni futbolcu aç`, hedef: 2, olay: "acilis", temel: true },
  // --- özel
  gunluk:    { metin: () => "Bir günlük oyunu bitir (Kadro, Kim Bu, Bulmaca, 5 Kulüp ya da Izgara)", hedef: 1, olay: "gunluk" },
  farkliMod: { metin: (h) => `${h} farklı modda tur oyna`, hedef: 3, olay: "farkliMod" },
  macKazan:  { metin: () => "CPU'ya karşı bir maç kazan", hedef: 1, olay: "macKazan" },
  kimBu:     { metin: () => "Kim Bu'da kart çevirmeden bil", hedef: 1, olay: "kimBuIpucusuz" },
  besKulup4: { metin: () => "5 Kulüp'te tek isimle 4 kulüp tuttur", hedef: 1, olay: "besKulup4" },
  coktan6:   { metin: () => "Çoktan Seçmeli'de 6'lık seri yap", hedef: 1, olay: "coktanSeri6" },
  zincir8:   { metin: () => "Harf Zinciri'nde 8 halka kur", hedef: 1, olay: "zincir8" },
  xoxKazan:  { metin: () => "Futbolcu XOX'ta bir maç kazan", hedef: 1, olay: "xoxKazan" },
  kadro9:    { metin: () => "Günün Kadrosu'nda en az 9 isim bul", hedef: 1, olay: "kadro9" },
};
const TEMEL = Object.keys(GOREV_TANIMLARI).filter((k) => GOREV_TANIMLARI[k].temel);
const OZEL = Object.keys(GOREV_TANIMLARI).filter((k) => !GOREV_TANIMLARI[k].temel);

function bugun() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Tarihten günün 3 görevi (deterministik).
export function gununGorevleri(tarih = bugun()) {
  const rnd = uretec(tohum("gorev-" + tarih));
  const temel = TEMEL[Math.floor(rnd() * TEMEL.length)];
  const havuz = [...OZEL];
  const secilen = [];
  while (secilen.length < 2 && havuz.length) secilen.push(havuz.splice(Math.floor(rnd() * havuz.length), 1)[0]);
  return [temel, ...secilen];
}

function bosGun() {
  const tarih = bugun();
  return { tarih, gorevler: gununGorevleri(tarih), ilerleme: {}, modlar: [], odulAlindi: false };
}

export async function getGunlukGorevler() {
  try {
    const ham = await AsyncStorage.getItem(ANAHTAR);
    if (ham) {
      const kayit = JSON.parse(ham);
      if (kayit.tarih === bugun()) return kayit;
    }
  } catch (e) {}
  return bosGun();
}

async function yaz(kayit) {
  try { await AsyncStorage.setItem(ANAHTAR, JSON.stringify(kayit)); } catch (e) {}
  return kayit;
}

export function gorevListesi(kayit) {
  const k = kayit || bosGun();
  return k.gorevler.map((id) => {
    const t = GOREV_TANIMLARI[id] || { metin: () => id, hedef: 1 };
    return { id, metin: t.metin(t.hedef), olan: Math.min(k.ilerleme[id] || 0, t.hedef), hedef: t.hedef };
  });
}

// Olaylar sırayla işlensin (aynı anda gelen iki olay birbirinin yazdığını ezmesin).
let _kuyruk = Promise.resolve();
export function gorevOlayi(olay, ek = {}) {
  _kuyruk = _kuyruk.then(() => isle(olay, ek)).catch(() => {});
  return _kuyruk;
}

async function isle(olay, ek) {
  const k = await getGunlukGorevler();
  let degisti = false;
  if (olay === "tur" && ek.mod && !k.modlar.includes(ek.mod)) { k.modlar = [...k.modlar, ek.mod]; }
  for (const id of k.gorevler) {
    const t = GOREV_TANIMLARI[id];
    if (!t) continue;
    if (t.olay === olay) { k.ilerleme[id] = (k.ilerleme[id] || 0) + (ek.adet || 1); degisti = true; }
    if (t.olay === "farkliMod" && olay === "tur") { k.ilerleme[id] = k.modlar.length; degisti = true; }
  }
  if (!degisti) return k;
  const hepsi = gorevListesi(k).every((g) => g.olan >= g.hedef);
  if (hepsi && !k.odulAlindi) {
    k.odulAlindi = true;
    addXP(GOREV_ODULU).catch(() => {});
    await yaz(k);
    // Tek seri kuralı: görevlerin üçü de bir "günlük içerik".
    try { await gunlukIcerikBitti("gorevler"); } catch (e) {}
    return k;
  }
  return yaz(k);
}

// Eski çağrılar (stats.js / pokedex.js) için.
export function gunlukTurKaydet(kazandi, mod) {
  gorevOlayi("tur", { mod });
  if (kazandi) gorevOlayi("dogru");
  return _kuyruk;
}
export function gunlukAcilisKaydet() {
  return gorevOlayi("acilis");
}
