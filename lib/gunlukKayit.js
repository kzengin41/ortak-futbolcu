// Günlük oyunların (5 Kulüp, Izgara) bugünkü kaydı — 4 Ekim 2026.
// Ayrı ve hafif: Tüm Modlar'daki kart yalnızca bunu yükler, veri setini değil.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { gunAnahtari } from "./dailyPuzzle";

export const BES_KULUP_HAK = 3;
export const IZGARA_HAK = 9;

const ANAHTAR = (oyun) => `gunluk-oyun-${oyun}`;
export async function gunlukDurumOku(oyun, tarih = gunAnahtari()) {
  try {
    const ham = await AsyncStorage.getItem(ANAHTAR(oyun));
    const v = ham ? JSON.parse(ham) : null;
    return v && v.tarih === tarih ? v : null;
  } catch (e) {
    return null;
  }
}
export async function gunlukDurumYaz(oyun, veri, tarih = gunAnahtari()) {
  try { await AsyncStorage.setItem(ANAHTAR(oyun), JSON.stringify({ ...veri, tarih })); } catch (e) {}
}
