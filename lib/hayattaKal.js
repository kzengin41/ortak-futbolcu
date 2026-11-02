// ============================================================================
// HAYATTA KAL — Paket 46 (Kerem: "oyun zevkini artıracak değişiklikler…
// rekabet: seri modu + meydan okuma")
//
// Tek kişilik, sonsuz Ortak Kulüp: iki kulüp gelir, ikisinde de oynamış bir
// futbolcu yaz. 3 can. Süre biter ya da "Bilemedim" dersen bir can gider.
// Yanlış isim can götürmez ama 2 saniye yer. Turlar ilerledikçe çiftler
// zorlaşır ve süre kısalır. Rekor = canlar bitene kadar bilinen tur sayısı.
//
// MEYDAN OKUMA: her oyun bir tohumla oynanır; aynı tohum herkese AYNI turları
// verir (zorluk tur numarasına bağlı, cevaba değil). Oyun sonunda "HK-XXXXXXX"
// kodu paylaşılır: içinde tohum + skor var. Arkadaşın kodu girince aynı turları
// oynar ve hedefi görür ("Kerem 17 yaptı, geç bakalım").
// Profil herkes için sabit Dengeli (eşit şartlar). Saf modül; Node'da test edilir (t64).
// ============================================================================
import AsyncStorage from "@react-native-async-storage/async-storage";
import { computeRoundPool, generateRound, ciftGecmisiniSifirla } from "./gameEngine";
import { profilDerle, hazirdanProfil } from "./eslesmeProfili";
import { uretec } from "./tohum";

export const CAN = 3;
export const YANLIS_CEZA_SN = 2;
export const REKOR_ANAHTARI = "hayatta-kal-rekor";

// Tur numarası (0'dan) → zorluk: 2'den başlar, her 4 turda +1, en fazla 8.
export function turZorlugu(turNo) {
  return Math.min(8, 2 + Math.floor(Math.max(0, turNo) / 4));
}
// Tur süresi: 25 sn'den başlar, her 5 turda 1 sn kısalır, en az 12.
export function turSuresi(turNo) {
  return Math.max(12, 25 - Math.floor(Math.max(0, turNo) / 5));
}
// Hızlı cevap puanı: tur puanı = 1 + kalan sürenin 1/5'i (yuvarlak aşağı) — sıralama için.
export function turPuani(kalanSn) {
  return 1 + Math.floor(Math.max(0, kalanSn) / 5);
}

let _profil = null;
function profil() {
  if (!_profil) _profil = profilDerle(hazirdanProfil("dengeli"));
  return _profil;
}
const _havuzlar = new Map();
function havuz(veri, z) {
  let h = _havuzlar.get(z);
  if (!h || h.veri !== veri) { h = { veri, havuz: computeRoundPool(veri, profil(), z) }; _havuzlar.set(z, h); }
  return h.havuz;
}

// Sıradaki turun havuzunu önceden hazırla (zorluk 4 turda bir değişir; telefonda
// havuz kurmak birkaç yüz ms sürer — animasyon sırasında yapılsın, tur başında takılmasın).
export function havuzIsit(veri, turNo) {
  havuz(veri, turZorlugu(turNo));
}

// Tohum + tur no → aynı çift (herkeste). kullanilan: bu oyunda çıkmış anahtarlar.
export function turUret(veri, tohumNo, turNo, kullanilan) {
  const z = turZorlugu(turNo);
  const h = havuz(veri, z);
  const eski = Math.random;
  Math.random = uretec(((tohumNo >>> 0) * 7919 + turNo * 104729) >>> 0);
  try {
    ciftGecmisiniSifirla(); // oyunlar arası çift geçmişi tohumlu sırayı bozmasın
    const g = generateRound(h, veri, kullanilan || new Set(), profil().kapsam, z);
    return g ? { ...g, zorluk: z, sure: turSuresi(turNo) } : null;
  } finally {
    Math.random = eski;
  }
}

export function yeniTohum(rastgele = Math.random) {
  return Math.floor(rastgele() * 0xfffff); // 20 bit
}

// ---------------------------------------------------------------- kod
const ALFABE = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 karakter, karışan harfler yok
function saglama(n) {
  let h = 0x2f;
  for (let i = 0; i < 5; i++) { h = (h * 31 + ((n >>> (i * 6)) & 63)) & 63; }
  return h;
}
// { tohum (0–1048575), skor (0–255) } → "HK-XXXXXXX"
export function kodla({ tohum, skor }) {
  const t = Math.max(0, Math.min(0xfffff, tohum | 0));
  const s = Math.max(0, Math.min(255, skor | 0));
  const veri = t * 256 + s;                          // 28 bit
  let sayi = veri * 64 + saglama(veri);              // 34 bit (Number ile güvenli)
  let kod = "";
  for (let i = 0; i < 7; i++) { kod = ALFABE[sayi % 32] + kod; sayi = Math.floor(sayi / 32); }
  return `HK-${kod}`;
}
export function coz(ham) {
  const kod = String(ham || "").toLocaleUpperCase("en").replace(/^HK/, "").replace(/[\s-]/g, "");
  if (kod.length !== 7) return null;
  let sayi = 0;
  for (const h of kod) {
    const i = ALFABE.indexOf(h);
    if (i < 0) return null;
    sayi = sayi * 32 + i;
  }
  const veri = Math.floor(sayi / 64);
  if (sayi % 64 !== saglama(veri)) return null;
  return { tohum: Math.floor(veri / 256), skor: veri % 256 };
}

export function paylasimMetni({ skor, puan, kod, hedef }) {
  const satirlar = [
    `⚽ 3-2-1: Bitir İşi — Hayatta Kal`,
    `🔥 ${skor} tur · ${puan} puan`,
    hedef != null ? (skor > hedef ? `Hedef ${hedef} idi — geçtim! 😎` : `Hedef ${hedef} idi — geçemedim 😤`) : null,
    `Aynı soruları sen de dene, beni geç: ${kod}`,
  ].filter(Boolean);
  return satirlar.join("\n");
}

// ---------------------------------------------------------------- rekor
export async function rekorOku() {
  try { const h = await AsyncStorage.getItem(REKOR_ANAHTARI); const v = h ? JSON.parse(h) : null; return v && typeof v === "object" ? v : { skor: 0, puan: 0 }; } catch (e) { return { skor: 0, puan: 0 }; }
}
export async function rekorYaz(skor, puan) {
  const r = await rekorOku();
  const yeni = skor > (r.skor || 0) || (skor === (r.skor || 0) && puan > (r.puan || 0));
  if (yeni) { try { await AsyncStorage.setItem(REKOR_ANAHTARI, JSON.stringify({ skor, puan, tarih: Date.now() })); } catch (e) {} }
  return { onceki: r, yeni };
}
