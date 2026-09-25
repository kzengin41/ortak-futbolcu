import AsyncStorage from "@react-native-async-storage/async-storage";

const PROFILE_KEY = "ortak-futbolcu-profile";

export async function getProfile() {
  const defaultProfile = { xp: 0, level: 1, name: "Gizemli Forvet" };
  try {
    const data = await AsyncStorage.getItem(PROFILE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {}
  return defaultProfile;
}

export async function addXP(amount) {
  try {
    const profile = await getProfile();
    profile.xp += amount;

    // Level scaling:
    // Lvl 1: 0 XP
    // Lvl 2: 100 XP
    // Lvl 3: 400 XP
    // Lvl 4: 900 XP
    // Lvl 10: 8100 XP
    const newLevel = Math.floor(Math.sqrt(profile.xp / 100)) + 1;
    profile.level = newLevel;

    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  } catch (e) {}
}

// Faz 5 devamı (31 Ağustos 2026) — buluttan çekilen xp/level'ı cihaz-local
// depoya AYNEN yazar (addXP'nin seviye hesaplamasını ATLAR, çünkü bulut zaten
// hesaplanmış bir xp/level çifti tutuyor). Sadece reconcileOnLogin'de bulut
// kazanınca kullanılır — bkz. lib/cloudProfile.js.
export async function overwriteXpLevel(xp, level) {
  try {
    const profile = await getProfile();
    profile.xp = xp || 0;
    profile.level = level || 1;
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  } catch (e) {}
}

export async function updateProfileName(name) {
  try {
    const profile = await getProfile();
    profile.name = name;
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {}
}

// addXP'nin kullandığı seviye formülünün (level = floor(sqrt(xp/100))+1) tersi:
// bir profildeki xp'nin mevcut seviye içinde ne kadarını tamamladığını verir.
// HomeScreen'de görünür bir ilerleme çubuğu için — sistem zaten hesaplanıyordu,
// sadece hiçbir ekranda gösterilmiyordu.
export function xpProgress(profile) {
  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const thresholdCurrent = 100 * Math.pow(level - 1, 2);
  const thresholdNext = 100 * Math.pow(level, 2);
  const span = Math.max(1, thresholdNext - thresholdCurrent);
  const into = Math.max(0, xp - thresholdCurrent);
  const fraction = Math.max(0, Math.min(1, into / span));
  return { level, xp, into, needed: span, fraction, thresholdNext };
}


// ============================================================================
// TEK XP TABLOSU — 12 Eylül 2026
//
// Denetimden: XP ölçekleri modlar arasında birbirini tutmuyordu. Ortak Kulüp
// galibiyet başına skor×100, Harf modu sabit 300, Kim Bu Futbolcu ise HAM TUR
// SKORUNU (tur başına 10.000'e kadar) veriyordu — yani tek bir Kim Bu oyunu,
// diğer modlarda onlarca maçın XP'sini kazandırıyordu. Üç mod (Hızlı
// Antrenman, Tek Telefon, 5 Kulüp) ise HİÇ XP vermiyordu.
//
// Artık tek kaynak burası. Doğru cevap XP'si lib/stats.js'teki recordRound
// içinde otomatik veriliyor — yani hangi mod olursa olsun, yeni eklenen
// modlar dahil, her doğru cevap aynı değerde.
// ============================================================================
export const XP_DOGRU_CEVAP = 12;
export const XP_MAC_GALIBIYETI = 120;
export const XP_MAC_MAGLUBIYETI = 35;
