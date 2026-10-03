import AsyncStorage from "@react-native-async-storage/async-storage";
import { PLAYERS } from "./players";
import { calculatePlayerPopularity } from "./clubWeights";
import { getProfile, seviyeKaydet } from "./profile";
import { seviyeHesapla } from "./seviye";

import { acilisBildir } from "./unlockBus";
import { gunlukAcilisKaydet } from "./dailyGoals";
import { bulunanEkle } from "./kadroKoleksiyon";
// Koleksiyon hedefi: Sadece en popüler 2000 oyuncu
// 26 Eylül 2026 (Kerem: "Ansiklopedi'de 2000 futbolcu az oldu gibi. Kesin
// olması gereken bazı isimler yok sanki.") — ÖLÇÜLDÜ. 115 tartışmasız ünlü
// isimden ilk 2000'de sadece 77'si vardı (%67). Asıl sebep limit değil
// puanlamaydı (bkz. lib/clubWeights.js'teki 26 Eylül notları); onlar
// düzeltildikten sonra kapsam şöyle ölçüldü:
//     2000 -> %99   (sadece Federico Valverde eksik)
//     3000 -> %100
// 3000 seçildi: %100 kapsamı veren en küçük değer. Daha büyük bir sayı
// koleksiyon hissini sulandırırdı — Ansiklopedi bir "hepsini topla" özelliği,
// ulaşılamaz bir hedef değil.
// 4 Ekim 2026 (Kerem: "söylenen oyuncular açılan oyunculara gelsin, sırası kaç
// olursa olsun. 3000 limit koymayalım.") — LİMİT KALKTI. Veri setindeki her
// futbolcu açılabilir; havuz artık bütün veri seti (popülerliğe göre sıralı,
// sıra numarası "#1234" göstermek için). Seviye = açılan sayısı (lib/seviye.js).
export const POKEDEX_LIMIT = Infinity;

let cachedPool = null;
export function getPokedexPool() {
  if (!cachedPool) {
    cachedPool = [...PLAYERS].sort((a, b) => calculatePlayerPopularity(b) - calculatePlayerPopularity(a));
  }
  return cachedPool;
}
let _adlar = null;
const veriSetindeMi = (ad) => {
  if (!_adlar) _adlar = new Set(PLAYERS.map((p) => p.name));
  return _adlar.has(ad);
};

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
  // 4 Ekim 2026 — kadro koleksiyonu: havuzda olmasa da doğru söylenen her isim kaydedilir.
  bulunanEkle(playerName).catch(() => {});
  try {
    if (!veriSetindeMi(playerName)) return false;

    const unlocked = await getUnlockedPlayers();
    if (!unlocked.includes(playerName)) {
      const onceki = seviyeHesapla(unlocked.length).level;
      unlocked.push(playerName);
      await AsyncStorage.setItem(POKEDEX_KEY, JSON.stringify(unlocked));
      const yeni = seviyeHesapla(unlocked.length).level;
      if (yeni > onceki) {
        seviyeKaydet(yeni).catch(() => {});
        acilisBildir(playerName, { seviye: yeni });
      } else {
        acilisBildir(playerName);
      }

      // TODO: İleride Supabase'e senkronize et (Sunucu tabanlı Pokedex)
      // supabase.from('pokedex_unlocks').insert({ device_id, player_name: playerName })

      // 12 Eylül 2026 — yeni açılışı duyur (bkz. lib/unlockBus.js). Dönüş
      // değeri zaten vardı ama hiçbir ekran okumuyordu; artık bildirim tek
      // noktadan çıkıyor ve çağıran ekranların değişmesi gerekmiyor.
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
