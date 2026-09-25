import AsyncStorage from "@react-native-async-storage/async-storage";
import { addXP } from "./profile";

// ============================================================================
// GÜNLÜK GÖREVLER — 12 Eylül 2026
//
// UX denetiminin "en yüksek etki/maliyet oranı" olarak işaretlediği iş.
// Uygulamayı açan kullanıcının ilk gördüğü ekran (Oyna) bugüne kadar
// ilerlemeye dair TEK BİR PİKSEL göstermiyordu — ne seri, ne seviye, ne bir
// hedef. Bu dosya günde bir sıfırlanan üç küçük hedef tutuyor.
//
// Yeni altyapı gerekmedi: sayaçlar zaten var olan iki noktadan besleniyor —
// lib/stats.js (recordRound: tur ve doğru cevap) ve lib/pokedex.js
// (unlockPlayer: yeni futbolcu). Yani her mod, bugün var olanlar ve sonra
// eklenecekler, otomatik kapsanıyor.
// ============================================================================

const ANAHTAR = "gunluk_gorev_v1";

export const HEDEFLER = { tur: 5, dogru: 3, acilis: 2 };
export const GOREV_ODULU = 250; // üçü de tamamlanınca

export const GOREV_METINLERI = {
  tur: (h) => `${h} tur oyna`,
  dogru: (h) => `${h} doğru cevap ver`,
  acilis: (h) => `${h} yeni futbolcu aç`,
};

function bugun() {
  const d = new Date();
  const a = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${a}-${g}`;
}

function bosGun() {
  return { tarih: bugun(), tur: 0, dogru: 0, acilis: 0, odulAlindi: false };
}

export async function getGunlukGorevler() {
  try {
    const ham = await AsyncStorage.getItem(ANAHTAR);
    if (ham) {
      const kayit = JSON.parse(ham);
      // Gün değiştiyse sıfırdan başla.
      if (kayit.tarih === bugun()) return kayit;
    }
  } catch (e) {}
  return bosGun();
}

async function yaz(kayit) {
  try {
    await AsyncStorage.setItem(ANAHTAR, JSON.stringify(kayit));
  } catch (e) {}
  return kayit;
}

// Üçü de tamamlandıysa ödülü BİR KEZ verir.
async function odulKontrol(kayit) {
  if (kayit.odulAlindi) return kayit;
  if (
    kayit.tur >= HEDEFLER.tur &&
    kayit.dogru >= HEDEFLER.dogru &&
    kayit.acilis >= HEDEFLER.acilis
  ) {
    kayit.odulAlindi = true;
    addXP(GOREV_ODULU).catch(() => {});
  }
  return kayit;
}

export async function gunlukTurKaydet(kazandi) {
  const k = await getGunlukGorevler();
  k.tur += 1;
  if (kazandi) k.dogru += 1;
  return yaz(await odulKontrol(k));
}

export async function gunlukAcilisKaydet() {
  const k = await getGunlukGorevler();
  k.acilis += 1;
  return yaz(await odulKontrol(k));
}

// Ekranların tek tek hesaplamaması için hazır liste.
export function gorevListesi(kayit) {
  const k = kayit || bosGun();
  return [
    { id: "tur", metin: GOREV_METINLERI.tur(HEDEFLER.tur), olan: Math.min(k.tur, HEDEFLER.tur), hedef: HEDEFLER.tur },
    { id: "dogru", metin: GOREV_METINLERI.dogru(HEDEFLER.dogru), olan: Math.min(k.dogru, HEDEFLER.dogru), hedef: HEDEFLER.dogru },
    { id: "acilis", metin: GOREV_METINLERI.acilis(HEDEFLER.acilis), olan: Math.min(k.acilis, HEDEFLER.acilis), hedef: HEDEFLER.acilis },
  ];
}
