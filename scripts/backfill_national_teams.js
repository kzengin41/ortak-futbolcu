// ============================================================================
// Her oyuncunun Wikipedia kariyer kutusundaki "nationalteamN" alanını çekip
// lib/playerNationalTeams.js'e yazar. Yaş grubu takımları (U17, U21, B
// takımı, olimpik vb.) eleniyor — sadece A milli takımı kalıyor.
//
// Ülke-Takım modu için gerekli: "bu ülke + bu kulüpte oynamış futbolcuyu
// bil" oyununu mümkün kılan veri budur.
//
// Çalıştırma:  node scripts/backfill_national_teams.js
// ============================================================================

const fs = require("fs");
const path = require("path");

const WP_HEADERS = { "User-Agent": "ortak-futbolcu-oyunu/0.1 (kisisel proje; iletisim yok)" };
const CHECKPOINT_PATH = path.join(__dirname, ".national_teams_checkpoint.json");
const WP_BATCH_SIZE = 40;

async function fetchWithRetry(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    const res = await fetch(url, { headers: WP_HEADERS });
    if (res.ok) return res.json();
    const isTransient = [429, 502, 503, 504].includes(res.status);
    if (!isTransient || i === attempts) throw new Error(`${res.status} ${res.statusText}`);
    await new Promise((r) => setTimeout(r, 8000));
  }
}

function extractInfobox(wikitext) {
  const startMatch = wikitext.match(/\{\{\s*Infobox football biography/i);
  if (!startMatch) return null;
  let depth = 0;
  let i = startMatch.index;
  const start = i;
  while (i < wikitext.length) {
    if (wikitext.startsWith("{{", i)) {
      depth++;
      i += 2;
      continue;
    }
    if (wikitext.startsWith("}}", i)) {
      depth--;
      i += 2;
      if (depth === 0) break;
      continue;
    }
    i++;
  }
  return wikitext.slice(start, i);
}

function cleanWikiValue(v) {
  if (!v) return "";
  v = v.replace(/<!--[\s\S]*?-->/g, "");
  v = v.replace(/<ref[^>]*\/?>[\s\S]*?(<\/ref>)?/gi, "");
  v = v.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_, a, __, b) => (b || a));
  v = v.replace(/'''?/g, "");
  return v.trim();
}

// yaş grubu (U17, U21...), B takımı, olimpik/genç takımlarını eler —
// sadece A milli takımı kalır.
function extractNationalTeams(infobox) {
  const re = /\bnationalteam\d+\s*=\s*(.*)$/gim;
  let m;
  const teams = new Set();
  while ((m = re.exec(infobox))) {
    let raw = m[1];
    // Bazı makalelerde boş alanlar aynı satırda art arda geliyor
    // ("|nationalteam1 = |nationalcaps1 = " gibi) — ilk "|" karakterinden
    // sonrasını keserek bu sızıntıyı temizliyoruz (gerçek bir ülke adında
    // "|" karakteri geçmez).
    const pipeIdx = raw.indexOf("|");
    if (pipeIdx !== -1) raw = raw.slice(0, pipeIdx);
    const val = cleanWikiValue(raw);
    if (!val) continue;
    if (/\bU-?\d{1,2}\b|\bB\b$|olympic|youth/i.test(val)) continue;
    teams.add(val);
  }
  return [...teams];
}

function normalizeTitle(t) {
  return (t || "").trim().replace(/_/g, " ").replace(/\s+/g, " ");
}
function titleToPlayerName(title) {
  return normalizeTitle(title).replace(/\s*\(footballer.*?\)\s*/gi, "").trim();
}

async function fetchBatch(wikiTitles) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&formatversion=2&format=json&titles=" +
    wikiTitles.map(encodeURIComponent).join("|");
  const data = await fetchWithRetry(url);
  const pages = data?.query?.pages || [];
  const byTitle = {};
  for (const page of pages) {
    const wikitext = page?.revisions?.[0]?.slots?.main?.content;
    const infobox = wikitext ? extractInfobox(wikitext) : null;
    byTitle[normalizeTitle(page.title)] = infobox ? extractNationalTeams(infobox) : [];
  }
  return byTitle;
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { titles: null, teams: {} };
  return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8"));
}
function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp));
}
function readJsonCheckpoint(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const cp = loadCheckpoint();

  if (!cp.titles) {
    const titleSet = new Set();
    const rosterCp = readJsonCheckpoint(path.join(__dirname, ".club_roster_checkpoint.json"));
    if (rosterCp?.playerTitles) rosterCp.playerTitles.forEach((t) => titleSet.add(normalizeTitle(t)));
    const careersCp = readJsonCheckpoint(path.join(__dirname, ".wikipedia_careers_checkpoint.json"));
    if (careersCp?.discovered) {
      careersCp.discovered.forEach((p) => {
        if (p.wikiTitle) titleSet.add(normalizeTitle(p.wikiTitle));
      });
    }
    if (titleSet.size === 0) {
      console.error("Hiçbir checkpoint dosyası bulunamadı.");
      process.exit(1);
    }
    cp.titles = [...titleSet];
    saveCheckpoint(cp);
  }
  console.log(`Toplam ${cp.titles.length} oyuncu için milli takım bilgisi çekilecek.`);

  const todo = cp.titles.filter((t) => !(normalizeTitle(t) in cp.teams));
  const totalBatches = Math.ceil(todo.length / WP_BATCH_SIZE);
  console.log(`${todo.length} oyuncu kaldı, ${totalBatches} grup halinde (${Object.keys(cp.teams).length} zaten tamam)...`);

  for (let i = 0; i < todo.length; i += WP_BATCH_SIZE) {
    const batch = todo.slice(i, i + WP_BATCH_SIZE);
    const batchNum = i / WP_BATCH_SIZE + 1;
    try {
      const byTitle = await fetchBatch(batch);
      for (const t of batch) {
        const key = normalizeTitle(t);
        cp.teams[key] = byTitle[key] || [];
      }
      console.log(`  grup ${batchNum}/${totalBatches} tamam`);
    } catch (err) {
      console.log(`  grup ${batchNum}/${totalBatches} başarısız: ${err.message} — tekrar çalıştırınca yeniden denenir`);
    }
    saveCheckpoint(cp);
    await new Promise((r) => setTimeout(r, 500));
  }

  // ---- Referans tabloya (lib/countries.json) göre süz/normalize et ----
  // Wikipedia'dan gelen ham metin varyasyonlu olabilir (bazen "Serbia",
  // bazen "Yugoslavia" gibi eski adlar, bazen tanımadığımız bir şey). Bu
  // adım, sadece GERÇEK bir ülkeyle eşleşenleri tutuyor ve hepsini kanonik
  // isme çeviriyor — böylece "Senegal" yazıp Kamerunlu bir oyuncu gibi
  // yanlış eşleşmeler artık olmuyor.
  const countriesPath = path.join(__dirname, "..", "lib", "countries.json");
  const COUNTRIES = JSON.parse(fs.readFileSync(countriesPath, "utf8"));
  const ALIAS_TO_CANONICAL = {};
  for (const [canonical, info] of Object.entries(COUNTRIES)) {
    ALIAS_TO_CANONICAL[canonical] = canonical;
    for (const alias of info.aliases || []) ALIAS_TO_CANONICAL[alias] = canonical;
  }

  const libDir = path.join(__dirname, "..", "lib");
  const teamsByName = {};
  let matched = 0;
  let discardedUnknown = 0;
  const discardedCounts = {};
  for (const [title, teams] of Object.entries(cp.teams)) {
    if (!teams || teams.length === 0) continue;
    const canonicalTeams = [];
    for (const rawT of teams) {
      // Önbellekteki bozuk veriyi de burada temizliyoruz (ilk çekimde
      // extractNationalTeams içinde düzeltmiştim ama önbellekte olan
      // veri zaten çekilmiş sayıldığı için yeniden çekilmiyordu — bu
      // yüzden düzeltme hiç uygulanmamış gibi görünüyordu). Aynı temizliği
      // burada, yeniden çekim gerektirmeden uyguluyoruz.
      let t = rawT;
      const pipeIdx = t.indexOf("|");
      if (pipeIdx !== -1) t = t.slice(0, pipeIdx);
      t = t.trim();
      if (!t) continue;
      const canonical = ALIAS_TO_CANONICAL[t];
      if (canonical) {
        if (!canonicalTeams.includes(canonical)) canonicalTeams.push(canonical);
      } else {
        discardedUnknown++;
        discardedCounts[t] = (discardedCounts[t] || 0) + 1;
      }
    }
    if (canonicalTeams.length === 0) continue;
    const name = titleToPlayerName(title);
    if (!teamsByName[name]) {
      teamsByName[name] = canonicalTeams;
      matched++;
    }
  }

  fs.writeFileSync(
    path.join(libDir, "playerNationalTeams.js"),
    `// Her oyuncunun A milli takımı — sadece lib/countries.json'daki GERÇEK\n` +
      `// ülkelerle eşleşenler (kanonik isme çevrilmiş). scripts/backfill_national_teams.js.\n` +
      `// lib/players.js'e dokunmuyor.\n` +
      `export const PLAYER_NATIONAL_TEAMS = ${JSON.stringify(teamsByName)};\n`
  );

  console.log(`\nBİTTİ: ${matched} oyuncu için milli takım bilgisi lib/playerNationalTeams.js'e yazıldı (toplam ${cp.titles.length} oyuncudan).`);
  if (discardedUnknown > 0) {
    console.log(`(${discardedUnknown} tanınmayan/referans tabloda olmayan "ülke" değeri atıldı — en sık geçen 25 tanesi:)`);
    const top = Object.entries(discardedCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25);
    for (const [val, count] of top) console.log(`   ${count}x  "${val}"`);
  }
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
