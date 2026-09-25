// ============================================================================
// lib/corrections.js'teki elle düzeltmeleri, Wikidata'ya TEKRAR BAĞLANMADAN,
// zaten çekilmiş lib/players.js + lib/clubs.js üzerine uygular ve
// lib/players.js, lib/clubs.js, supabase/seed.sql'i yeniden üretir.
//
// Yeni bir düzeltme eklediğinde (lib/corrections.js'e bir satır daha
// yazdığında) tekrar Wikidata sorgusu çalıştırmana gerek yok — bu script
// saniyeler içinde biter.
//
// Çalıştırma:  node scripts/apply_corrections.js
// ============================================================================

const fs = require("fs");
const path = require("path");

function readExportedJson(filePath, varName) {
  const src = fs.readFileSync(filePath, "utf8");
  const re = new RegExp(`${varName} = ([\\s\\S]*);\\s*$`);
  const match = src.match(re);
  if (!match) throw new Error(`${filePath} içinde ${varName} bulunamadı.`);
  return JSON.parse(match[1]);
}

function main() {
  const libDir = path.join(__dirname, "..", "lib");
  const players = readExportedJson(path.join(libDir, "players.js"), "PLAYERS");
  const corrections = readExportedJson(path.join(libDir, "corrections.js"), "CORRECTIONS");
  let clubInfo = {};
  try {
    clubInfo = readExportedJson(path.join(libDir, "clubs.js"), "CLUB_INFO");
  } catch {
    console.log("lib/clubs.js bulunamadı/okunamadı, ülke/lig bilgisi olmadan devam ediliyor.");
  }

  let addedCount = 0;
  const finalPlayers = players.map((p) => {
    const extra = corrections[p.name];
    if (!extra) return p;
    const clubs = new Set(p.clubs);
    extra.forEach((c) => {
      if (!clubs.has(c)) addedCount++;
      clubs.add(c);
      if (!clubInfo[c]) clubInfo[c] = { country: null, league: null };
    });
    return { ...p, clubs: [...clubs] };
  });

  console.log(`${Object.keys(corrections).length} oyuncu için düzeltme tanımlı, ${addedCount} yeni kulüp-oyuncu ilişkisi eklendi.`);

  // ---- lib/players.js, lib/clubs.js ----
  fs.writeFileSync(
    path.join(libDir, "players.js"),
    `// Wikidata + elle düzeltmeler (lib/corrections.js) — scripts/apply_corrections.js\n` +
      `export const PLAYERS = ${JSON.stringify(finalPlayers, null, 2)};\n`
  );
  fs.writeFileSync(
    path.join(libDir, "clubs.js"),
    `// Wikidata + elle düzeltmeler (lib/corrections.js) — scripts/apply_corrections.js\n` +
      `export const CLUB_INFO = ${JSON.stringify(clubInfo, null, 2)};\n`
  );

  // ---- supabase/seed.sql (fetch_wikidata_players.js ile aynı mantık) ----
  function esc(s) {
    return s.replace(/'/g, "''");
  }
  function sqlStr(v) {
    return v ? `'${esc(v)}'` : "null";
  }
  const clubSet = [...new Set(finalPlayers.flatMap((p) => p.clubs))].sort();
  const clubIndex = new Map(clubSet.map((c, i) => [c, i + 1]));

  let sql = "-- otomatik üretildi: scripts/apply_corrections.js (Wikidata + elle düzeltmeler)\n\n";
  sql += "alter table clubs add column if not exists country text;\n";
  sql += "alter table clubs add column if not exists league text;\n\n";
  sql += "truncate table player_clubs, players, clubs restart identity cascade;\n\n";
  sql +=
    "insert into clubs (id, name, country, league) values\n" +
    clubSet
      .map((c, i) => `  (${i + 1}, ${sqlStr(c)}, ${sqlStr(clubInfo[c]?.country)}, ${sqlStr(clubInfo[c]?.league)})`)
      .join(",\n") +
    "\non conflict (id) do nothing;\n\n";
  sql +=
    "insert into players (id, name) values\n" +
    finalPlayers.map((p, i) => `  (${i + 1}, '${esc(p.name)}')`).join(",\n") +
    "\non conflict (id) do nothing;\n\n";

  const relRows = [];
  finalPlayers.forEach((p, pi) => {
    p.clubs.forEach((c) => relRows.push(`  (${pi + 1}, ${clubIndex.get(c)})`));
  });
  sql += "insert into player_clubs (player_id, club_id) values\n" + relRows.join(",\n") + "\non conflict do nothing;\n";
  fs.writeFileSync(path.join(__dirname, "..", "supabase", "seed.sql"), sql);

  console.log("lib/players.js, lib/clubs.js ve supabase/seed.sql güncellendi.");
  console.log("Sıradaki adım: Supabase SQL Editor'da yeni seed.sql'i çalıştır.");
}

main();
