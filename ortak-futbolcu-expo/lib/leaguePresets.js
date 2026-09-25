// Hazır lig/ülke ön ayarları. CLUB_INFO'daki country/league alanlarına göre
// filtreleniyor — Wikidata'da bu alanlar boş kalan kulüpler ("Tümü" hariç)
// hiçbir ön ayarda görünmez, sadece Tümü'nde çıkar.

export const LEAGUE_PRESETS = [
  { id: "turkey", label: "Türkiye", match: (info) => info.country === "Turkey" || info.country === "Türkiye" },
  {
    id: "top5",
    label: "5 Büyük Lig",
    match: (info) => ["England", "Spain", "Italy", "Germany", "France"].includes(info.country),
  },
  { id: "premier", label: "Premier League", match: (info) => info.league === "Premier League" },
  { id: "all", label: "Tümü", match: () => true },
];

// preset id -> izin verilen kulüp isimleri Set'i (null = filtre yok, hepsi serbest)
export function clubsForPreset(presetId, clubInfo) {
  const preset = LEAGUE_PRESETS.find((p) => p.id === presetId) || LEAGUE_PRESETS[LEAGUE_PRESETS.length - 1];
  if (preset.id === "all") return null;
  const allowed = new Set();
  for (const [name, info] of Object.entries(clubInfo)) {
    if (preset.match(info)) allowed.add(name);
  }
  return allowed;
}

// Online mod için: Supabase'den gelen {id, name, country, league} satırlarından
// izin verilen kulüp ID'leri (generate_round RPC'sine p_allowed_club_ids olarak
// geçiriliyor). null = filtre yok.
export function clubIdsForPreset(presetId, clubRows) {
  const preset = LEAGUE_PRESETS.find((p) => p.id === presetId) || LEAGUE_PRESETS[LEAGUE_PRESETS.length - 1];
  if (preset.id === "all") return null;
  return clubRows.filter((c) => preset.match(c)).map((c) => c.id);
}

// "Detaylı" seçim için: veri setinde fiilen bulunan tüm ligleri döner
export function allLeagues(clubInfo) {
  return [...new Set(Object.values(clubInfo).map((i) => i.league).filter(Boolean))].sort();
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
