// Günün bulmacasının o güne ait durumu (denemeler, bilindi mi) — cihazda.
// Saf üretim mantığı lib/dailyPuzzle.js'te; bu dosya sadece kalıcılık.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { gunAnahtari, DENEME_HAKKI } from "./dailyPuzzle";

const ANAHTAR = "gunun_bulmacasi_v1";

function bosGun(tarih) {
  return { tarih, denemeler: [], bilindi: false, bitti: false, cevap: null };
}

export async function getBulmacaDurumu() {
  const tarih = gunAnahtari();
  try {
    const ham = await AsyncStorage.getItem(ANAHTAR);
    if (ham) {
      const d = JSON.parse(ham);
      // Gün değiştiyse sıfırdan başlıyoruz — "günün" bulmacası tam da bu.
      if (d && d.tarih === tarih) return d;
    }
  } catch (e) {}
  return bosGun(tarih);
}

async function yaz(durum) {
  try {
    await AsyncStorage.setItem(ANAHTAR, JSON.stringify(durum));
  } catch (e) {}
  return durum;
}

// Bir tahmin kaydeder ve yeni durumu döndürür.
// `dogru` çağıran tarafça belirleniyor (findMatchedPlayer ile).
export async function tahminKaydet(metin, dogru, cevapAdi) {
  const d = await getBulmacaDurumu();
  if (d.bitti) return d;
  const denemeler = [...d.denemeler, { metin, dogru }];
  const bilindi = Boolean(dogru);
  const bitti = bilindi || denemeler.length >= DENEME_HAKKI;
  return yaz({
    ...d,
    denemeler,
    bilindi,
    bitti,
    cevap: bilindi ? cevapAdi : d.cevap,
  });
}

// Bulmaca bilinemeden bitti; ekran cevabı gösterirken kaydediyor.
export async function cevabiKaydet(cevapAdi) {
  const d = await getBulmacaDurumu();
  if (d.cevap) return d;
  return yaz({ ...d, cevap: cevapAdi });
}

export async function bugunOynandiMi() {
  const d = await getBulmacaDurumu();
  return d.bitti;
}
