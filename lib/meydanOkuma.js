// ============================================================================
// ASENKRON MEYDAN OKUMA — 5 Ekim 2026 (benchmark .29648)
//
// "Asenkron meydan okuma bağlantısı": arkadaşın o an çevrimiçi olmasa da
// oynanabilen düello. SUNUCU YOK: meydan okumanın tamamı 6 haneli bir kodda.
//   kod = soru seti tohumu (10 bit) + doğru sayısı (4 bit) + süre (8 bit)
//         + 8 bit sağlama → 30 bit → 6 harf (32'lik alfabe, oda koduyla aynı)
// Sorular lib/gunlukTakvim.json'daki SABİT ve elle seçilmiş 730 kulüp
// ikilisinden geliyor; veri dosyası güncellense de aynı kod iki telefonda
// aynı 10 soruyu verir (uygulama sürümünden bağımsız).
//
// Akış: oyna → kodu paylaş → arkadaşın Online → Meydan Okuma'ya kodu yazar,
// aynı 10 soruyu çözer ve sonucu karşılaştırır. Geçmiş cihazda saklanır.
// ============================================================================
import AsyncStorage from "@react-native-async-storage/async-storage";
import TAKVIM from "./gunlukTakvim.json";
import { uretec } from "./tohum";

export const SORU_SAYISI = 10;
export const SORU_SURESI_SN = 20;
export const AZAMI_SURE_SN = 255;
const ALFABE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // 32 harf (karışan 0/O, 1/I yok)
const ANAHTAR = "meydan-okumalar-v1";

export function setSayisi() {
  const liste = (TAKVIM && TAKVIM.bulmaca) || [];
  return Math.min(1024, liste.length);
}

// Tohumdan 10 farklı kulüp ikilisi (deterministik).
export function sorular(tohum) {
  const liste = (TAKVIM && TAKVIM.bulmaca) || [];
  if (!liste.length) return [];
  const rnd = uretec(0x5eed + tohum * 7919);
  const secilen = [];
  const gorulen = new Set();
  let koruma = 0;
  while (secilen.length < Math.min(SORU_SAYISI, liste.length) && koruma++ < 500) {
    const i = Math.floor(rnd() * liste.length);
    if (gorulen.has(i)) continue;
    gorulen.add(i);
    secilen.push(liste[i]);
  }
  return secilen;
}

function saglama(veri) {
  let h = 0x9e3779b1 ^ veri;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  h ^= h >>> 15;
  return h & 0xff;
}

export function kodla({ tohum, dogru, sure }) {
  const t = Math.max(0, Math.min(1023, tohum | 0));
  const d = Math.max(0, Math.min(15, dogru | 0));
  const s = Math.max(0, Math.min(AZAMI_SURE_SN, Math.round(sure || 0)));
  const veri = (t << 12) | (d << 8) | s;                 // 22 bit
  let sayi = veri * 256 + saglama(veri);                 // 30 bit (Number ile güvenli)
  let kod = "";
  for (let i = 0; i < 6; i++) { kod = ALFABE[sayi % 32] + kod; sayi = Math.floor(sayi / 32); }
  return kod;
}

// Geçersizse null. Boşluk, tire ve küçük harf tolere edilir.
export function coz(kodHam) {
  const kod = String(kodHam || "").toLocaleUpperCase("en").replace(/[\s-]/g, "");
  if (kod.length !== 6) return null;
  let sayi = 0;
  for (const h of kod) {
    const i = ALFABE.indexOf(h);
    if (i < 0) return null;
    sayi = sayi * 32 + i;
  }
  const veri = Math.floor(sayi / 256);
  if ((sayi % 256) !== saglama(veri)) return null;
  const tohum = veri >> 12, dogru = (veri >> 8) & 0xf, sure = veri & 0xff;
  if (tohum >= setSayisi() || dogru > SORU_SAYISI) return null;
  return { tohum, dogru, sure };
}

export function yeniTohum(rnd = Math.random) {
  return Math.floor(rnd() * setSayisi());
}

// "sen" | "rakip" | "berabere" — önce doğru sayısı, eşitse süre (az olan).
export function karsilastir(ben, rakip) {
  if (ben.dogru !== rakip.dogru) return ben.dogru > rakip.dogru ? "sen" : "rakip";
  if (Math.abs((ben.sure || 0) - (rakip.sure || 0)) < 1) return "berabere";
  return ben.sure < rakip.sure ? "sen" : "rakip";
}

export function sureYaz(sn) {
  const s = Math.max(0, Math.round(sn || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function kodGoster(kod) {
  return kod ? `${kod.slice(0, 3)}-${kod.slice(3)}` : "";
}

export function paylasimMetni({ kod, dogru, sure, rakip }) {
  const satirlar = ["⚽ 3-2-1: Bitir İşi — Meydan Okuma"];
  if (rakip) {
    const sonuc = karsilastir({ dogru, sure }, rakip);
    satirlar.push(
      sonuc === "sen" ? `Meydan okumanı kabul ettim ve kazandım: ${dogru}-${rakip.dogru}!`
      : sonuc === "rakip" ? `Meydan okumanı kabul ettim, ${dogru}-${rakip.dogru} kaybettim. Bir dahakine!`
      : `Meydan okuman berabere bitti: ${dogru}-${rakip.dogru}.`
    );
  } else {
    satirlar.push(`${SORU_SAYISI} ortak futbolcu sorusunda ${dogru} bildim (${sureYaz(sure)}). Geçebilir misin?`);
    satirlar.push(`Uygulamada Online → Meydan Okuma'ya bu kodu yaz: ${kodGoster(kod)}`);
  }
  return satirlar.join("\n");
}

// --- Cihazdaki geçmiş ------------------------------------------------------
export async function gecmis() {
  try { return JSON.parse((await AsyncStorage.getItem(ANAHTAR)) || "[]"); } catch (e) { return []; }
}

// kayit: { kod, tohum, ben:{dogru,sure}, rakip:{dogru,sure}|null }
export async function gecmiseEkle(kayit) {
  const liste = await gecmis();
  const yeni = [{ ...kayit, tarih: Date.now() }, ...liste.filter((k) => !(k.kod === kayit.kod && !!k.rakip === !!kayit.rakip))].slice(0, 20);
  try { await AsyncStorage.setItem(ANAHTAR, JSON.stringify(yeni)); } catch (e) {}
  return yeni;
}
