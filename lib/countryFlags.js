// Ülke adından (Wikipedia'nın nationalteam alanındaki temiz metin) bayrak
// emoji'si üretir + geçerli bir ülke olup olmadığını doğrular. Tek doğruluk
// kaynağı lib/countries.json — "fact table" (hem uygulama hem
// scripts/backfill_national_teams.js buradan okuyor, ikisi de senkron kalır).
import COUNTRIES from "./countries.json";

// Alias -> kanonik ad ters eşleştirmesi (bir kez, modül yüklenince kuruluyor)
const ALIAS_TO_CANONICAL = {};
for (const [canonical, info] of Object.entries(COUNTRIES)) {
  ALIAS_TO_CANONICAL[canonical] = canonical;
  for (const alias of info.aliases || []) ALIAS_TO_CANONICAL[alias] = canonical;
}

// Wikipedia'dan gelen ham metni (varyasyonlu olabilir) kanonik ülke adına
// çevirir — listede yoksa null döner (geçersiz/tanınmayan "ülke" atılır).
export function canonicalCountryName(raw) {
  if (!raw) return null;
  return ALIAS_TO_CANONICAL[raw.trim()] || null;
}

// Paket 22b — efsane maçlardaki tarihî takımlar (1986 Batı Almanya, EURO 88
// Sovyetler Birliği): takma adla kanonik ülkeye düşer; SSCB'ye Rusya bayrağı değil.
const TARIHI_BAYRAK = { "Soviet Union": "\u{1F6A9}" };

export function flagForCountry(country) {
  if (TARIHI_BAYRAK[country]) return TARIHI_BAYRAK[country];
  const iso = (COUNTRIES[country] || COUNTRIES[ALIAS_TO_CANONICAL[country]])?.iso;
  if (!iso) return "🏳️";
  return iso
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + (c.charCodeAt(0) - 65)))
    .join("");
}
