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

function readExportedModule(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const names = [];
  const transformed = src.replace(/export\s+const\s+(\w+)\s*=/g, (_, name) => {
    names.push(name);
    return `const ${name} =`;
  });
  const withExports = `${transformed}\nmodule.exports = { ${names.join(", ")} };\n`;
  const tmpPath = filePath + ".tmp_cjs.js";
  fs.writeFileSync(tmpPath, withExports);
  try {
    delete require.cache[require.resolve(tmpPath)];
    return require(tmpPath);
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

function readExportedJson(filePath, varName) {
  const mod = readExportedModule(filePath);
  if (!(varName in mod)) throw new Error(`${filePath} içinde ${varName} bulunamadı.`);
  return mod[varName];
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

  // ---- supabase/seed_parts/ — TEK dosya değil, ayrı ayrı çalıştırılacak
  // numaralı parça dosyaları. Sorun satır sayısından çok, SQL Editor'a tek
  // seferde yapıştırılan METİN BOYUTU — o yüzden aynı dosyada çok sayıda
  // INSERT olması yetmiyor, gerçekten ayrı dosyalar/yapıştırmalar gerekiyor. ----
  function esc(s) {
    return s.replace(/'/g, "''");
  }
  function sqlStr(v) {
    return v ? `'${esc(v)}'` : "null";
  }

  const partsDir = path.join(__dirname, "..", "supabase", "seed_parts");
  fs.rmSync(partsDir, { recursive: true, force: true });
  fs.mkdirSync(partsDir, { recursive: true });
  let fileIndex = 0;
  const fileList = [];
  function writePart(label, content) {
    fileIndex++;
    const name = `${String(fileIndex).padStart(3, "0")}_${label}.sql`;
    fs.writeFileSync(path.join(partsDir, name), content);
    fileList.push(name);
  }

  writePart(
    "schema",
    "alter table clubs add column if not exists country text;\n" +
      "alter table clubs add column if not exists league text;\n\n" +
      "truncate table player_clubs, players, clubs restart identity cascade;\n"
  );

  const clubSet = [...new Set(finalPlayers.flatMap((p) => p.clubs))].sort();
  const clubIndex = new Map(clubSet.map((c, i) => [c, i + 1]));
  const BATCH = 15000; // veri seti büyüdükçe (25k+ oyuncu) dosya sayısını makul tutmak için artırdık

  const clubRows = clubSet.map(
    (c, i) => `  (${i + 1}, ${sqlStr(c)}, ${sqlStr(clubInfo[c]?.country)}, ${sqlStr(clubInfo[c]?.league)})`
  );
  for (let i = 0; i < clubRows.length; i += BATCH) {
    const batch = clubRows.slice(i, i + BATCH);
    writePart(
      `clubs_${i}`,
      "insert into clubs (id, name, country, league) values\n" + batch.join(",\n") + "\non conflict (id) do nothing;\n"
    );
  }

  const playerRows = finalPlayers.map((p, i) => `  (${i + 1}, '${esc(p.name)}')`);
  for (let i = 0; i < playerRows.length; i += BATCH) {
    const batch = playerRows.slice(i, i + BATCH);
    writePart(
      `players_${i}`,
      "insert into players (id, name) values\n" + batch.join(",\n") + "\non conflict (id) do nothing;\n"
    );
  }

  const relRows = [];
  finalPlayers.forEach((p, pi) => {
    p.clubs.forEach((c) => relRows.push(`  (${pi + 1}, ${clubIndex.get(c)})`));
  });
  for (let i = 0; i < relRows.length; i += BATCH) {
    const batch = relRows.slice(i, i + BATCH);
    writePart(
      `player_clubs_${i}`,
      "insert into player_clubs (player_id, club_id) values\n" + batch.join(",\n") + "\non conflict do nothing;\n"
    );
  }

  fs.writeFileSync(
    path.join(partsDir, "README.txt"),
    `Bu ${fileList.length} dosyayı SIRAYLA, Supabase SQL Editor'da TEKER TEKER (biri bitip "Success" ` +
      `dedikten sonra bir sonrakini) çalıştır:\n\n${fileList.join("\n")}\n`
  );

  console.log(`lib/players.js, lib/clubs.js güncellendi. supabase/seed_parts/ altında ${fileList.length} parça dosyası üretildi.`);
  console.log("Sıradaki adım: supabase/seed_parts/README.txt'teki sırayla, dosyaları TEKER TEKER Supabase SQL Editor'da çalıştır.");
}

main();
