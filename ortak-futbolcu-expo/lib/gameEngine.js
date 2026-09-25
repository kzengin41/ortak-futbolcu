// Yerel (pas-at) ve CPU modları için paylaşılan saf fonksiyonlar.
// NOT: Online modda bu dosya KULLANILMAZ — orada hakemlik ve doğrulama
// sunucuda (supabase/functions.sql) yapılır, istemci hile yapamaz.

export function normalize(str) {
  return str
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function playersForPair(dataset, teamA, teamB) {
  return dataset.filter((p) => p.clubs.includes(teamA) && p.clubs.includes(teamB));
}

export function generateRound(dataset, usedPairs, allowedClubs) {
  // allowedClubs: null/undefined = filtre yok (her kulüp serbest), ya da bir
  // kulüp isimleri Set'i — sadece bunlardan round üretilir. Filtre varken
  // uygun oyuncu bulmak daha zor olabileceği için deneme sayısını artırdık.
  const MAX_ATTEMPTS = allowedClubs ? 200 : 50;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const player = dataset[Math.floor(Math.random() * dataset.length)];
    let candidateClubs = player.clubs;
    if (allowedClubs) candidateClubs = candidateClubs.filter((c) => allowedClubs.has(c));
    if (candidateClubs.length < 2) continue;
    const shuffled = [...candidateClubs].sort(() => Math.random() - 0.5);
    const [teamA, teamB] = shuffled;
    const key = [teamA, teamB].sort().join("|");
    if (usedPairs.has(key)) continue;
    const validAnswers = playersForPair(dataset, teamA, teamB); // filtre uygulanmaz — çifte oynayan herkes geçerli cevap
    if (validAnswers.length === 0) continue;
    return { teamA, teamB, validAnswers, key };
  }
  return null;
}

const MIN_PREFIX_LEN = 3;

export function isCorrectAnswer(input, validAnswers) {
  const n = normalize(input);
  if (!n) return false;
  return validAnswers.some((p) => {
    const full = normalize(p.name);
    const tokens = full.split(" ");
    if (n === full) return true;
    if (tokens.includes(n)) return true; // "cenk" -> "cenk tosun"
    if (n.length >= MIN_PREFIX_LEN && tokens.some((t) => t.startsWith(n))) return true; // "kvara" -> "kvaratskhelia"
    return false;
  });
}

export const ROUND_SECONDS = 10; // varsayılan, artık ekrandan seçilebiliyor
export const ANSWER_SECONDS = 12;
export const ROUND_TIME_OPTIONS = [8, 10, 15];

export const CPU_PROFILES = {
  kolay: { minDelay: 4000, maxDelay: 9000, correctChance: 0.55 },
  orta: { minDelay: 2200, maxDelay: 5500, correctChance: 0.75 },
  zor: { minDelay: 700, maxDelay: 2800, correctChance: 0.9 },
};
