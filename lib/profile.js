import AsyncStorage from "@react-native-async-storage/async-storage";
import { seviyeHesapla } from "./seviye";

// 4 Ekim 2026 — seviye artık XP'den değil AÇILAN FUTBOLCU sayısından (lib/seviye.js).
// Ansiklopedi listesi lib/pokedex.js ile aynı anahtarda; döngüsel içe aktarma olmasın diye burada doğrudan okunuyor.
const POKEDEX_KEY = "ortak-futbolcu-pokedex";
async function acilanSayisi() {
  try { const h = await AsyncStorage.getItem(POKEDEX_KEY); return h ? JSON.parse(h).length : 0; } catch (e) { return 0; }
}

const PROFILE_KEY = "ortak-futbolcu-profile";

export async function getProfile() {
  const defaultProfile = { xp: 0, level: 1, name: "Gizemli Forvet" };
  try {
    const data = await AsyncStorage.getItem(PROFILE_KEY);
    const profil = data ? JSON.parse(data) : defaultProfile;
    const acilan = await acilanSayisi();
    return { ...profil, acilan, level: seviyeHesapla(acilan).level };
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
    // 4 Ekim 2026: XP artık seviyeyi belirlemiyor (puan olarak duruyor);
    // seviye = açılan futbolcu sayısı (getProfile içinde hesaplanır).
    const { acilan, ...kayit } = profile;
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(kayit));
    return profile;
  } catch (e) {}
}

// Faz 5 devamı (31 Ağustos 2026) — buluttan çekilen xp/level'ı cihaz-local
// depoya AYNEN yazar (addXP'nin seviye hesaplamasını ATLAR, çünkü bulut zaten
// hesaplanmış bir xp/level çifti tutuyor). Sadece reconcileOnLogin'de bulut
// kazanınca kullanılır — bkz. lib/cloudProfile.js.
export async function overwriteXpLevel(xp, level) {
  try {
    const { acilan: _a1, ...profile } = await getProfile();
    profile.xp = xp || 0;
    profile.level = level || 1;
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  } catch (e) {}
}

export async function updateProfileName(name) {
  try {
    const { acilan: _a2, ...profile } = await getProfile();
    profile.name = name;
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {}
}

// addXP'nin kullandığı seviye formülünün (level = floor(sqrt(xp/100))+1) tersi:
// bir profildeki xp'nin mevcut seviye içinde ne kadarını tamamladığını verir.
// HomeScreen'de görünür bir ilerleme çubuğu için — sistem zaten hesaplanıyordu,
// sadece hiçbir ekranda gösterilmiyordu.
// 4 Ekim 2026: adı tarihî — artık XP değil, AÇILAN FUTBOLCU ilerlemesi döndürür
// (into/needed = bu seviyede açılan / sonraki seviye için gereken futbolcu).
export function xpProgress(profile) {
  const s = seviyeHesapla(profile?.acilan || 0);
  return { ...s, xp: profile?.xp || 0, thresholdNext: s.sonrakiEsik };
}

// Seviye atlanınca kayda da yazılır (bulut yedeği level alanını okuyor).
export async function seviyeKaydet(level) {
  try {
    const data = await AsyncStorage.getItem(PROFILE_KEY);
    const profil = data ? JSON.parse(data) : { xp: 0, name: "Gizemli Forvet" };
    profil.level = level;
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profil));
  } catch (e) {}
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
