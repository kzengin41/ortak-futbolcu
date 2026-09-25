// Hazır lig/ülke ön ayarları. CLUB_INFO'daki country/league alanlarına göre
// filtreleniyor — Wikidata'da bu alanlar boş kalan kulüpler ("Tümü" hariç)
// hiçbir ön ayarda görünmez, sadece Tümü'nde çıkar.
//
// SUPER_LIG_CLUBS / TOP2_TIER_CLUBS: Wikipedia kategorilerinden çekilen
// (scripts/fetch_club_tiers.js) kulüp seviyesi verisi — "çok küçük takımlar
// geliyor" şikayetini çözmek için varsayılan kapsamı daraltıyor.
import { SUPER_LIG_CLUBS, TOP2_TIER_CLUBS } from "./clubTiers";
import { BIG5_CLUBS, PREMIER_LEAGUE_CLUBS } from "./big5ClubTiers";

// Wikipedia'daki oyuncu makaleleri aynı kulübü bazen "Beşiktaş", bazen
// "Beşiktaş J.K." diye linkleyebiliyor — bu ek farkları tolere edip iki
// tarafı da aynı köke indirgiyoruz.
// ÖNEMLİ: toLocaleLowerCase("tr-TR") KULLANMIYORUZ — clubWeights.js'teki
// aynı sorunun ikizi, 26 binin üzerinde kulüp için çağrıldığında donmaya
// katkı sağlıyordu. Elle İ/I çevirisi + sade toLowerCase() çok daha hızlı.
function normalizeClubName(n) {
  return n
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .replace(/\s+(j\.?\s?k\.?|s\.?\s?k\.?|f\.?\s?k\.?|a\.?\s?ş\.?|gsk|f\.?\s?c\.?|c\.?\s?f\.?|a\.?\s?f\.?\s?c\.?)\.?$/i, "")
    .trim();
}

const SUPER_LIG_SET = new Set(SUPER_LIG_CLUBS.map(normalizeClubName));
const TOP2_SET = new Set(TOP2_TIER_CLUBS.map(normalizeClubName));
const BIG5_SET = new Set(BIG5_CLUBS.map(normalizeClubName));
const PREMIER_SET = new Set(PREMIER_LEAGUE_CLUBS.map(normalizeClubName));

// NOT: bu, gerçek sezon-sezon Şampiyonlar Ligi katılım verisi DEĞİL (öyle bir
// veri kaynağımız yok) — sürekli Şampiyonlar Ligi'nde görülen, "herkesin
// tanıdığı" büyük Avrupa kulüplerinin elle küratörlenmiş bir listesi.
// Tüm Zamanlar Şampiyonlar Ligi takımları (Efsaneler, büyükler, sık katılanlar)
const CHAMPIONS_LEAGUE_ALL_TIME = new Set(
  [
    "Real Madrid", "Barcelona", "Bayern Munich", "Manchester City", "Manchester United",
    "Liverpool", "Chelsea", "Arsenal", "Paris Saint-Germain", "Juventus", "AC Milan",
    "Inter Milan", "Internazionale", "Atletico Madrid", "Borussia Dortmund", "Ajax",
    "Porto", "Benfica", "Napoli", "Sevilla", "RB Leipzig", "Villarreal", "Galatasaray",
    "Fenerbahçe", "Beşiktaş", "Shakhtar Donetsk", "Celtic", "Olympique Lyonnais",
    "Olympique de Marseille", "Bayer Leverkusen", "Roma", "Lazio", "Valencia"
  ].map(normalizeClubName)
);

// Güncel (24/25 Sezonu) Şampiyonlar Ligi (36 Takım)
const CHAMPIONS_LEAGUE_CURRENT = new Set(
  [
    "Real Madrid", "Barcelona", "Bayern Munich", "Manchester City", "Paris Saint-Germain", 
    "Liverpool", "Inter Milan", "Internazionale", "Borussia Dortmund", "RB Leipzig", 
    "Bayer Leverkusen", "Atletico Madrid", "Atalanta", "Juventus", "Benfica", "Arsenal", 
    "Club Brugge", "Shakhtar Donetsk", "AC Milan", "Feyenoord", "Sporting CP", 
    "PSV", "Dinamo Zagreb", "Red Bull Salzburg", "Lille", "Red Star Belgrade", 
    "Young Boys", "Celtic", "Slovan Bratislava", "Monaco", "Sparta Prague", 
    "Aston Villa", "Bologna", "Girona", "VfB Stuttgart", "Sturm Graz", "Brest"
  ].map(normalizeClubName)
);

// 31 Ağustos 2026 (Kerem: "ayarlar ekranının çirkinliğine bak, kapsamda
// bayraklar yok") — her ön ayara, listede satırın başında gösterilecek bir
// emoji ("flag") eklendi. Gerçek ülke bayrakları sadece tek-ülke kapsamları
// için anlamlı (Türkiye, Premier League/İngiltere); çok-ülkeli kapsamlar
// (5 Büyük Lig, Şampiyonlar Ligi, Tümü) için temsili bir ikon kullanıldı.
export const LEAGUE_PRESETS = [
  {
    id: "turkey_top2",
    label: "Süper Lig + 1. Lig",
    flag: "🇹🇷",
    match: (info, name) => TOP2_SET.has(normalizeClubName(name)),
  },
  {
    id: "turkey_super",
    label: "Sadece Süper Lig",
    flag: "🇹🇷",
    match: (info, name) => SUPER_LIG_SET.has(normalizeClubName(name)),
  },
  {
    id: "turkey_all",
    label: "Türkiye (Tüm Ligler)",
    flag: "🇹🇷",
    match: (info, name) =>
      info.country === "Turkey" || info.country === "Türkiye" || TOP2_SET.has(normalizeClubName(name)),
  },
  {
    id: "top5",
    label: "5 Büyük Lig",
    flag: "🌍",
    match: (info, name) => BIG5_SET.has(normalizeClubName(name)),
  },
  {
    id: "champions_current",
    label: "Şampiyonlar Ligi (Güncel)",
    flag: "🏆",
    match: (info, name) => CHAMPIONS_LEAGUE_CURRENT.has(normalizeClubName(name)),
  },
  {
    id: "champions_all_time",
    label: "Şampiyonlar Ligi (Tüm Zamanlar)",
    flag: "🏆",
    match: (info, name) => CHAMPIONS_LEAGUE_ALL_TIME.has(normalizeClubName(name)),
  },
  { id: "premier", label: "Sadece Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", match: (info, name) => PREMIER_SET.has(normalizeClubName(name)) },
  { id: "all", label: "Tümü", flag: "🌐", match: () => true },
];

// Varsayılan ön ayar — "çok küçük takımlar geliyor" şikayeti buradan çözülüyor.
export const DEFAULT_PRESET_ID = "turkey_top2";

function findPreset(presetId) {
  return LEAGUE_PRESETS.find((p) => p.id === presetId) || LEAGUE_PRESETS[LEAGUE_PRESETS.length - 1];
}

// preset id -> izin verilen kulüp isimleri Set'i (null = filtre yok, hepsi serbest)
export function clubsForPreset(presetId, clubInfo) {
  const preset = findPreset(presetId);
  if (preset.id === "all") return null;
  const allowed = new Set();
  for (const [name, info] of Object.entries(clubInfo)) {
    if (preset.match(info, name)) allowed.add(name);
  }
  return allowed;
}

// Online mod için: Supabase'den gelen {id, name, country, league} satırlarından
// izin verilen kulüp ID'leri (generate_round RPC'sine p_allowed_club_ids olarak
// geçiriliyor). null = filtre yok.
export function clubIdsForPreset(presetId, clubRows) {
  const preset = findPreset(presetId);
  if (preset.id === "all") return null;
  return clubRows.filter((c) => preset.match(c, c.name)).map((c) => c.id);
}

// "Detaylı" seçim için: veri setinde fiilen bulunan tüm ligleri döner
export function allLeagues(clubInfo) {
  return [...new Set(Object.values(clubInfo).map((i) => i.league).filter(Boolean))].sort();
}

// Bayrak göstermek için: her ligin hangi ülkeyle ilişkili olduğunu bulur
export function countryForLeague(league, clubInfo) {
  for (const info of Object.values(clubInfo)) {
    if (info.league === league && info.country) return info.country;
  }
  return null;
}

export function clubsForLeagues(selectedLeagues, clubInfo) {
  if (!selectedLeagues || selectedLeagues.length === 0) return null;
  const set = new Set(selectedLeagues);
  const allowed = new Set();
  for (const [name, info] of Object.entries(clubInfo)) {
    if (info.league && set.has(info.league)) allowed.add(name);
  }
  return allowed;
}
