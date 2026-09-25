// ============================================================================
// Wikidata'dan (ücretsiz, API key gerekmez, CC0 lisanslı) Türkiye'de oynamış
// VE gerçekten tanınan futbolcuların TÜM kulüp geçmişini çeker.
//
// İKİ AŞAMA halinde çalışır (tek dev sorgu Wikidata'nın 60sn süre sınırına
// takılıp 502/504 hatası verdiği için):
//   1) Küçük, hızlı bir sorguyla sadece tanınan oyuncuların ID listesini al
//   2) Bu listenin kulüp geçmişini 50'şerli küçük gruplar halinde çek
//      (her grup ayrı, hızlı bir istek — biri patlarsa hepsi patlamaz)
//
// NOT: Bu script benim (Claude) ortamımda internet erişimim Wikidata'ya
// kapalı olduğu için canlı test edilmeden yazıldı. Bir grup hata verirse
// script diğer gruplarla devam eder ve sonunda hangi gruplarda sorun
// olduğunu raporlar — o çıktıyı bana getir, birlikte bakarız.
//
// Çalıştırma:  node scripts/fetch_wikidata_players.js
// ============================================================================

const fs = require("fs");
const path = require("path");

// Kaç dilde Wikipedia sayfası olduğu — gerçek tanınırlığın göstergesi.
// Çok obskür isimler çıkıyorsa yükselt, havuz çok küçük/tekrarlı geliyorsa düşür.
const MIN_SITELINKS = 20;
const BATCH_SIZE = 50; // her istekte kaç oyuncunun kulüp geçmişi çekilecek
const MAX_PLAYERS = 3000;

const ENDPOINT_BASE = "https://query.wikidata.org/sparql";
const HEADERS = {
  Accept: "application/sparql-results+json",
  "User-Agent": "ortak-futbolcu-oyunu/0.1 (kisisel proje; iletisim yok)",
};

async function fetchWithRetry(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res.json();
    const isTransient = [429, 502, 503, 504].includes(res.status);
    if (!isTransient || i === attempts) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
}

async function sparql(query) {
  const url = ENDPOINT_BASE + "?query=" + encodeURIComponent(query) + "&format=json";
  const data = await fetchWithRetry(url);
  return data.results.bindings;
}

function qidFromUri(uri) {
  return uri.split("/").pop();
}

async function main() {
  // ---- Aşama 1: tanınan oyuncu listesi (küçük, hızlı) ----
  console.log("Aşama 1/2: tanınan oyuncu listesi çekiliyor...");
  const playerListQuery = `
    SELECT DISTINCT ?player ?playerLabel WHERE {
      ?player wdt:P106 wd:Q937857.
      ?player wdt:P54 ?turkishClub.
      ?turkishClub wdt:P17 wd:Q43.
      ?player wikibase:sitelinks ?sitelinks.
      FILTER(?sitelinks >= ${MIN_SITELINKS})
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr". }
    }
    LIMIT ${MAX_PLAYERS}
  `;
  const playerRows = await sparql(playerListQuery);
  console.log(`${playerRows.length} oyuncu bulundu.`);

  const players = new Map(); // qid -> { name, clubs: Set }
  for (const row of playerRows) {
    const name = row.playerLabel?.value;
    if (!name || /^Q\d+$/.test(name)) continue; // etiket çevrilmemiş, ham QID dönmüş
    players.set(qidFromUri(row.player.value), { name, clubs: new Set() });
  }
  const qids = [...players.keys()];

  // ---- Aşama 2: kulüp geçmişi + her kulübün ülke/lig bilgisi, küçük gruplar halinde ----
  const totalBatches = Math.ceil(qids.length / BATCH_SIZE);
  console.log(`Aşama 2/2: kulüp geçmişleri ${totalBatches} grup halinde çekiliyor...`);

  const clubInfo = new Map(); // clubName -> { country, league }
  const failedBatches = [];
  for (let i = 0; i < qids.length; i += BATCH_SIZE) {
    const batch = qids.slice(i, i + BATCH_SIZE);
    const batchNum = i / BATCH_SIZE + 1;
    const values = batch.map((q) => `wd:${q}`).join(" ");
    const clubsQuery = `
      SELECT ?player ?club ?clubLabel ?countryLabel ?leagueLabel WHERE {
        VALUES ?player { ${values} }
        ?player wdt:P54 ?club.
        OPTIONAL { ?club wdt:P17 ?country. }
        OPTIONAL { ?club wdt:P118 ?league. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr". }
      }
    `;
    try {
      const rows = await sparql(clubsQuery);
      for (const row of rows) {
        const qid = qidFromUri(row.player.value);
        const clubName = row.clubLabel?.value;
        if (!clubName || /^Q\d+$/.test(clubName)) continue;
        players.get(qid)?.clubs.add(clubName);

        if (!clubInfo.has(clubName)) {
          const country = row.countryLabel?.value;
          const league = row.leagueLabel?.value;
          clubInfo.set(clubName, {
            country: country && !/^Q\d+$/.test(country) ? country : null,
            league: league && !/^Q\d+$/.test(league) ? league : null,
          });
        }
      }
      console.log(`  grup ${batchNum}/${totalBatches} tamam`);
    } catch (err) {
      console.log(`  grup ${batchNum}/${totalBatches} BAŞARISIZ: ${err.message}`);
      failedBatches.push(batchNum);
    }
    await new Promise((r) => setTimeout(r, 300)); // Wikidata'ya nazik davranalım
  }

  if (failedBatches.length > 0) {
    console.log(`\nUyarı: ${failedBatches.length} grup başarısız oldu (${failedBatches.join(", ")}). Devam ediyorum, script'i tekrar çalıştırırsan hepsi yeniden denenir.`);
  }

  const finalPlayers = [...players.values()]
    .filter((p) => p.clubs.size >= 2)
    .map((p) => ({ name: p.name, clubs: [...p.clubs] }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  console.log(`\n${finalPlayers.length} oyuncu (en az 2 kulüplü) kullanılabilir durumda.`);

  // ---- lib/corrections.js'teki elle düzeltmeleri uygula ----
  let correctionsAdded = 0;
  try {
    const correctionsSrc = fs.readFileSync(path.join(__dirname, "..", "lib", "corrections.js"), "utf8");
    const cMatch = correctionsSrc.match(/CORRECTIONS = ([\s\S]*);\s*$/);
    const corrections = cMatch ? JSON.parse(cMatch[1]) : {};
    for (const p of finalPlayers) {
      const extra = corrections[p.name];
      if (!extra) continue;
      const set = new Set(p.clubs);
      extra.forEach((c) => {
        if (!set.has(c)) correctionsAdded++;
        set.add(c);
      });
      p.clubs = [...set];
    }
    if (correctionsAdded > 0) console.log(`lib/corrections.js'ten ${correctionsAdded} ek kulüp-oyuncu ilişkisi uygulandı.`);
  } catch {
    console.log("lib/corrections.js okunamadı, düzeltmeler atlandı.");
  }

  // ---- lib/players.js ----
  const playersJs =
    `// Wikidata'dan otomatik üretildi — scripts/fetch_wikidata_players.js\n` +
    `// Kaynak: CC0, https://query.wikidata.org — yeniden üretmek için scripti tekrar çalıştır.\n` +
    `export const PLAYERS = ${JSON.stringify(finalPlayers, null, 2)};\n`;
  fs.writeFileSync(path.join(__dirname, "..", "lib", "players.js"), playersJs);

  // ---- lib/clubs.js (ülke/lig metadata — filtreleme için) ----
  const clubSet = [...new Set(finalPlayers.flatMap((p) => p.clubs))].sort();
  const clubInfoObj = {};
  for (const name of clubSet) {
    const info = clubInfo.get(name) || { country: null, league: null };
    clubInfoObj[name] = info;
  }
  const clubsJs =
    `// Wikidata'dan otomatik üretildi — scripts/fetch_wikidata_players.js\n` +
    `// Her kulübün ülke ve lig bilgisi (P17/P118) — lig filtreleri bunu kullanıyor.\n` +
    `// Bazı kulüplerde country/league null olabilir (Wikidata'da o alan boşsa).\n` +
    `export const CLUB_INFO = ${JSON.stringify(clubInfoObj, null, 2)};\n`;
  fs.writeFileSync(path.join(__dirname, "..", "lib", "clubs.js"), clubsJs);

  // ---- supabase/seed.sql ----
  function esc(s) {
    return s.replace(/'/g, "''");
  }
  function sqlStr(v) {
    return v ? `'${esc(v)}'` : "null";
  }
  const clubIndex = new Map(clubSet.map((c, i) => [c, i + 1]));

  let sql = "-- otomatik üretildi: scripts/fetch_wikidata_players.js (Wikidata, CC0)\n\n";
  sql += "alter table clubs add column if not exists country text;\n";
  sql += "alter table clubs add column if not exists league text;\n\n";
  sql += "truncate table player_clubs, players, clubs restart identity cascade;\n\n";
  sql +=
    "insert into clubs (id, name, country, league) values\n" +
    clubSet
      .map((c, i) => {
        const info = clubInfoObj[c];
        return `  (${i + 1}, ${sqlStr(c)}, ${sqlStr(info.country)}, ${sqlStr(info.league)})`;
      })
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

  console.log(`Bitti: ${clubSet.length} kulüp, ${finalPlayers.length} oyuncu, ${relRows.length} ilişki satırı.`);
  console.log("lib/players.js ve supabase/seed.sql güncellendi.");
  console.log("Sıradaki adım: Supabase SQL Editor'da yeni seed.sql'i çalıştır.");
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
