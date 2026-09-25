// ============================================================================
// Supabase Postgres veritabanına DOĞRUDAN bağlanıp lib/players.js +
// lib/corrections.js + lib/clubs.js'teki veriyi otomatik, parça parça
// (rate limit'e takılmadan) yükler. Web SQL Editor'a onlarca dosya
// yapıştırmak yerine TEK KOMUT.
//
// Kurulum (bir kereliğine):
//   1) Supabase panelinde: Project Settings → Database → Connection String
//      → "URI" sekmesi. "Connection pooling" değil, DİREKT (Session mode)
//      bağlantı adresini kopyala (postgresql://postgres:...@...supabase.co:5432/postgres
//      gibi görünür).
//   2) Terminalde:
//        set SUPABASE_DB_URL=kopyaladigin-adres   (Windows cmd)
//      ya da PowerShell'de:
//        $env:SUPABASE_DB_URL="kopyaladigin-adres"
//
// Çalıştırma:  node scripts/seed_database.js
// ============================================================================

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const CONNECTION_STRING = process.env.SUPABASE_DB_URL;
if (!CONNECTION_STRING) {
  console.error("SUPABASE_DB_URL ortam değişkeni ayarlı değil. Dosyanın başındaki kurulum notuna bak.");
  process.exit(1);
}

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

async function insertBatch(client, table, columns, rows, batchSize, onConflict) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const valuesSql = [];
    const params = [];
    batch.forEach((row, idx) => {
      const placeholders = row.map((_, colIdx) => `$${idx * row.length + colIdx + 1}`);
      valuesSql.push(`(${placeholders.join(",")})`);
      params.push(...row);
    });
    const sql = `insert into ${table} (${columns}) values ${valuesSql.join(",")} ${onConflict}`;
    await client.query(sql, params);
    console.log(`  ${table}: ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
  }
}

async function main() {
  const libDir = path.join(__dirname, "..", "lib");
  const players = readExportedModule(path.join(libDir, "players.js")).PLAYERS;
  const corrections = readExportedModule(path.join(libDir, "corrections.js")).CORRECTIONS;
  let clubInfo = {};
  try {
    clubInfo = readExportedModule(path.join(libDir, "clubs.js")).CLUB_INFO;
  } catch {
    console.log("lib/clubs.js okunamadı, ülke/lig bilgisi olmadan devam ediliyor.");
  }

  let addedCount = 0;
  const finalPlayers = players.map((p) => {
    const extra = corrections[p.name];
    if (!extra) return p;
    const set = new Set(p.clubs);
    extra.forEach((c) => {
      if (!set.has(c)) addedCount++;
      set.add(c);
    });
    return { ...p, clubs: [...set] };
  });
  if (addedCount > 0) console.log(`corrections.js'ten ${addedCount} ek ilişki uygulandı.`);

  const clubSet = [...new Set(finalPlayers.flatMap((p) => p.clubs))].sort();
  const clubIndex = new Map(clubSet.map((c, i) => [c, i + 1]));

  console.log(`Toplam: ${finalPlayers.length} oyuncu, ${clubSet.length} kulüp.`);
  console.log("Veritabanına bağlanılıyor...");

  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    console.log("Şema hazırlanıyor...");
    await client.query("alter table clubs add column if not exists country text");
    await client.query("alter table clubs add column if not exists league text");
    await client.query("truncate table player_clubs, players, clubs restart identity cascade");

    console.log("Kulüpler yükleniyor...");
    const clubRows = clubSet.map((c, i) => [i + 1, c, clubInfo[c]?.country || null, clubInfo[c]?.league || null]);
    await insertBatch(client, "clubs", "id, name, country, league", clubRows, 1000, "on conflict (id) do nothing");

    console.log("Oyuncular yükleniyor...");
    const playerRows = finalPlayers.map((p, i) => [i + 1, p.name]);
    await insertBatch(client, "players", "id, name", playerRows, 2000, "on conflict (id) do nothing");

    console.log("İlişkiler yükleniyor (en uzun süren kısım)...");
    const relRows = [];
    finalPlayers.forEach((p, pi) => {
      p.clubs.forEach((c) => relRows.push([pi + 1, clubIndex.get(c)]));
    });
    await insertBatch(client, "player_clubs", "player_id, club_id", relRows, 5000, "on conflict do nothing");

    console.log(`\nBİTTİ: ${clubSet.length} kulüp, ${finalPlayers.length} oyuncu, ${relRows.length} ilişki veritabanına yüklendi.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
