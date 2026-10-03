import AsyncStorage from "@react-native-async-storage/async-storage";

import { addXP, XP_DOGRU_CEVAP } from "./profile";
import { gunlukTurKaydet } from "./dailyGoals";
import { turuIsle } from "./bilgiSeviyesi";
// Faz 2 (31 Ağustos 2026) — Kerem: "kişinin tüm oyun istatistikleri çıkmalı"
// (mod bazlı galibiyet/mağlubiyet, en iyi seri, toplam doğru/yanlış,
// ansiklopedi ilerlemesi). Bu dosya AsyncStorage tabanlı, basit bir
// istatistik kaydı tutuyor — sunucuya (Supabase) taşıma Faz 5'te olacak.

const STATS_KEY = "ortak-futbolcu-stats";

// Ekranlarda kullanılan gerçek route id'leri (bkz. OynaScreen.js MODES) —
// istatistikler bu id'lere göre gruplanıyor.
export const MODE_LABELS = {
  draftCpu: "Ortak Kulüp (Sen Seç)",
  cpu: "Ortak Kulüp (CPU)",
  countryTeamCpu: "Kulüp & Ülke",
  letterCpu: "İlk Harften Bul",
  whoAmICpu: "Kim Bu Futbolcu?",
  quickCpu: "Çoktan Seçmeli",
  local: "Ortak Kulüp (Yanımdaki)",
  // 12 Eylül 2026 (Kerem: "İstatistikler bölümünde oyun adı fiveClubs olarak
  // kalmış") — mod eklenirken bu tabloya yazılmamıştı, ekran ham route id'sini
  // gösteriyordu.
  fiveClubs: "5 Kulüp (2 Kişi)",
  fiveClubsCpu: "5 Kulüp (CPU)",
  // 12 Eylül 2026 — online modların HİÇBİRİ bu tabloda yoktu; İstatistikler
  // ekranı onlar için ham route id'sini ("onlineDuel") gösteriyordu.
  onlineDuel: "Online — Ortak Kulüp",
  onlineDraft: "Online — Ortak Kulüp (Sen Seç)",
  onlineWhoAmI: "Online — Kim Bu Futbolcu?",
  onlineLetter: "Online — İlk Harften Bul",
  onlineXox: "Online — Futbolcu XOX",
  meydanOkuma: "Meydan Okuma",
  dailyPuzzle: "Günün Bulmacası",
  xox: "Futbolcu XOX (2 Kişi)",
  xoxCpu: "Futbolcu XOX (CPU)",
  gunluk5: "Günlük 5 Kulüp",
  gunlukIzgara: "Günlük Izgara",
  letterZincir: "Harf Zinciri",
  sunucu: "Sunucu Modu",
  gunlukKadro: "Günün Kadrosu",
};

function emptyStats() {
  return { modes: {}, currentStreak: 0, bestStreak: 0, totalCorrect: 0, totalWrong: 0 };
}

function emptyModeStats() {
  return { wins: 0, losses: 0, bestStreak: 0 };
}

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    cache = raw ? JSON.parse(raw) : emptyStats();
  } catch (e) {
    console.error("İstatistikler okunurken hata:", e);
    cache = emptyStats();
  }
  if (!cache.modes) cache.modes = {};
  if (typeof cache.currentStreak !== "number") cache.currentStreak = 0;
  if (typeof cache.bestStreak !== "number") cache.bestStreak = 0;
  if (typeof cache.totalCorrect !== "number") cache.totalCorrect = 0;
  if (typeof cache.totalWrong !== "number") cache.totalWrong = 0;
  return cache;
}

async function persist() {
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error("İstatistikler yazılırken hata:", e);
  }
}

export async function getStats() {
  return load();
}

// Bir mod içindeki tek bir turun/elin sonucunu kaydeder.
// modeId: OynaScreen.js'teki route id'lerden biri (bkz. MODE_LABELS).
// won: true -> oyuncu (p1) doğru bildi / o eli kazandı, false -> yanlış/kaybetti.
// Beraberlik/CPU'nun bulamayıp turun iptal olduğu gibi nötr durumlar için
// bu fonksiyon hiç çağrılmamalı (ekranlarda sadece net p1 sonucu olduğunda çağrılıyor).
export async function recordRound(modeId, won) {
  const s = await load();
  if (!s.modes[modeId]) s.modes[modeId] = emptyModeStats();
  const m = s.modes[modeId];

  if (won) {
    m.wins += 1;
    s.totalCorrect += 1;
    s.currentStreak += 1;
    if (s.currentStreak > s.bestStreak) s.bestStreak = s.currentStreak;
    if (s.currentStreak > m.bestStreak) m.bestStreak = s.currentStreak;
  } else {
    m.losses += 1;
    s.totalWrong += 1;
    s.currentStreak = 0;
  }

  await persist();

  // 12 Eylül 2026 — İKİ ŞEY BURAYA TAŞINDI:
  //
  // 1) GÜNLÜK SERİ. bumpStreak eskiden OynaScreen'de, kullanıcı mod kartına
  //    DOKUNDUĞU anda çağrılıyordu — modu açıp 2 saniye sonra çıkan biri bile
  //    "bugün oynadım" sayılıyordu, üstelik online oynayanın serisi hiç
  //    artmıyordu. Artık seri ancak gerçekten bir tur tamamlanınca artıyor ve
  //    her mod otomatik kapsanıyor.
  //
  // 2) DOĞRU CEVAP XP'si. Modların üçü hiç XP vermiyor, verenler de birbirini
  //    tutmayan ölçeklerde veriyordu (bkz. lib/profile.js). Buradan verilince
  //    her mod eşit ve yeni modlar bedava kapsanıyor.
  // 4 Ekim 2026 (.29585) — GÜNLÜK SERİ artık burada ARTMIYOR: tek seri kuralı,
  // günlük içeriklerden birini bitirmek (bkz. lib/streak.js gunlukIcerikBitti).
  if (won) addXP(XP_DOGRU_CEVAP).catch(() => {});
  gunlukTurKaydet(won, modeId).catch(() => {});
  // 4 Ekim 2026 — futbol bilgisi seviyesinin oyunda ince ayarı.
  turuIsle(modeId, won).catch(() => {});

  return s;
}

// Test/geliştirme amaçlı — istatistikleri sıfırlar (şu an hiçbir ekrandan çağrılmıyor).
export async function resetStats() {
  cache = emptyStats();
  await persist();
  return cache;
}

// Faz 5 devamı (31 Ağustos 2026) — buluttan çekilen istatistik objesini
// cihaz-local depoya AYNEN yazar (bkz. lib/pokedex.js overwriteUnlockedPlayers
// ile aynı mantık — reconcileOnLogin'de kaybeden cihazın verisini
// kazananınkiyle değiştirmek için).
export async function overwriteStats(statsObj) {
  cache = statsObj && typeof statsObj === "object" ? statsObj : emptyStats();
  if (!cache.modes) cache.modes = {};
  if (typeof cache.currentStreak !== "number") cache.currentStreak = 0;
  if (typeof cache.bestStreak !== "number") cache.bestStreak = 0;
  if (typeof cache.totalCorrect !== "number") cache.totalCorrect = 0;
  if (typeof cache.totalWrong !== "number") cache.totalWrong = 0;
  await persist();
  return cache;
}

// Toplam oynanan tur sayısı — reconcileOnLogin'de "hangi cihazda daha çok
// ilerleme var" karşılaştırması için kullanılıyor.
export function totalRoundsPlayed(statsObj) {
  if (!statsObj?.modes) return 0;
  return Object.values(statsObj.modes).reduce((sum, m) => sum + (m.wins || 0) + (m.losses || 0), 0);
}
