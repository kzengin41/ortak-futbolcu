import AsyncStorage from "@react-native-async-storage/async-storage";
import { PLAYERS } from "./players";
import { calculatePlayerPopularity } from "./clubWeights";
import { getProfile } from "./profile";

import { acilisBildir } from "./unlockBus";
import { gunlukAcilisKaydet } from "./dailyGoals";
// Koleksiyon hedefi: Sadece en popüler 2000 oyuncu
export const POKEDEX_LIMIT = 2000;

let cachedPool = null;
export function getPokedexPool() {
  if (!cachedPool) {
    cachedPool = [...PLAYERS]
      .sort((a, b) => calculatePlayerPopularity(b) - calculatePlayerPopularity(a))
      .slice(0, POKEDEX_LIMIT);
  }
  return cachedPool;
}

// --- Seviye bazlı açma hedefi (30 Ağustos 2026) ---
// Kerem'in isteği: "1. level-10 kişi 2.level-25 kişi vb. tüm futbolcuları
// bulma hedefi ... en popülerler ilk levelda olacak şekilde". Havuz zaten
// popülerliğe göre sıralı (index 0 = en popüler), o yüzden "seviye N'de
// açılabilecek en fazla kişi sayısı" = kümülatif bir hedef.
//
// Kademe: Lvl 1 -> 10, Lvl 2 -> 25, Lvl 3 -> 45, Lvl 4 -> 70, Lvl 5 -> 100 ...
// Formül: 10*L + 5*L*(L-1)/2 — her seviyede biraz daha büyüyen bir artış
// (ilk seviyeler hızlı doldurulsun, ileri seviyeler daha uzun sürsün).
export function getUnlockTargetForLevel(level) {
  const L = Math.max(1, Math.floor(level) || 1);
  const target = 10 * L + (5 * L * (L - 1)) / 2;
  return Math.min(POKEDEX_LIMIT, Math.round(target));
}

// Tersi: havuzda N. sırada olan (1-indexli) bir oyuncunun açılabilmesi için
// gereken minimum seviye — ekranda "🔒 Seviye 4'te açılır" gibi bir ipucu
// göstermek için (PlayerProfileScreen).
export function requiredLevelForRank(rank1Indexed) {
  let L = 1;
  while (getUnlockTargetForLevel(L) < rank1Indexed && L < 200) L++;
  return L;
}

const POKEDEX_KEY = "ortak-futbolcu-pokedex";

// Hafızadan açılmış oyuncu listesini al
export async function getUnlockedPlayers() {
  try {
    const data = await AsyncStorage.getItem(POKEDEX_KEY);
    if (data) {
      return JSON.parse(data); // ["Arda Turan", "Lionel Messi"]
    }
  } catch (e) {
    console.error("Pokedex okunurken hata:", e);
  }
  return [];
}

// Oyuncuyu veritabanına ekle — SADECE havuzdaysa (yani en popüler 2000
// kişiden biriyse; bkz. POKEDEX_LIMIT).
//
// 31 Ağustos 2026 (Kerem: "who am i modunda masuaku'yu buldum, ansiklopedi'de
// açılmadı" → çözüm tercihi: "direkt açılsın") — eskiden burada AYRICA
// mevcut hesap seviyesine göre bir "açma hedefi" kontrolü vardı: oyuncu
// havuzda olsa bile sırası mevcut seviyenin hedefinin dışındaysa (henüz o
// kadar popüler bir sırada değilse) açılmıyordu. Kerem bunun kafa
// karıştırıcı olduğunu belirtti (oyunda bulunan biri neden açılmasın?),
// bu yüzden o ek kontrol KALDIRILDI: havuzdaki (top 2000) HERHANGİ bir
// oyuncu bulunduğu anda direkt açılıyor. getUnlockTargetForLevel/
// requiredLevelForRank fonksiyonları hâlâ duruyor (Ansiklopedi'de "henüz
// hiç bulunmamış" oyuncular için ilerleme/motivasyon ipucu olarak
// kullanılabilir) ama artık gerçek bir kilit değiller.
export async function unlockPlayer(playerName) {
  try {
    const pool = getPokedexPool();
    const rank = pool.findIndex(p => p.name === playerName); // 0-indexli, -1 = havuzda değil
    if (rank === -1) return false;

    const unlocked = await getUnlockedPlayers();
    if (!unlocked.includes(playerName)) {
      unlocked.push(playerName);
      await AsyncStorage.setItem(POKEDEX_KEY, JSON.stringify(unlocked));

      // TODO: İleride Supabase'e senkronize et (Sunucu tabanlı Pokedex)
      // supabase.from('pokedex_unlocks').insert({ device_id, player_name: playerName })

      // 12 Eylül 2026 — yeni açılışı duyur (bkz. lib/unlockBus.js). Dönüş
      // değeri zaten vardı ama hiçbir ekran okumuyordu; artık bildirim tek
      // noktadan çıkıyor ve çağıran ekranların değişmesi gerekmiyor.
      acilisBildir(playerName);
      gunlukAcilisKaydet().catch(() => {});
      return true; // Yeni açıldı
    }
  } catch (e) {
    console.error("Pokedex yazılırken hata:", e);
  }
  return false;
}

// Faz 5 devamı (31 Ağustos 2026) — buluttan çekilen listeyi cihaz-local
// depoya AYNEN yazar (unlockPlayer'daki seviye/hedef kontrolünü ATLAR —
// bu, "hangi cihazda ilerleme fazlaysa o kazanır" senkronizasyonunda
// kaybeden cihazın listesini kazananınkiyle değiştirmek için kullanılıyor,
// bkz. lib/cloudProfile.js reconcileOnLogin).
export async function overwriteUnlockedPlayers(list) {
  try {
    await AsyncStorage.setItem(POKEDEX_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch (e) {
    console.error("Pokedex üzerine yazılırken hata:", e);
  }
}
