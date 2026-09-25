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

export function flagForCountry(country) {
  const iso = COUNTRIES[country]?.iso;
  if (!iso) return "🏳️";
  return iso
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + (c.charCodeAt(0) - 65)))
    .join("");
}
