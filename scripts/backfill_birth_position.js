// ============================================================================
// Her oyuncunun Wikipedia kariyer kutusundan doğum yılını ve mevkiini çekip
// lib/playerBirthPosition.js'e yazar. Who am I? modunun ipucu havuzunu
// zenginleştirmek için.
//
// Çalıştırma:  node scripts/backfill_birth_position.js
// ============================================================================

const fs = require("fs");
const path = require("path");

const WP_HEADERS = { "User-Agent": "ortak-futbolcu-oyunu/0.1 (kisisel proje; iletisim yok)" };
const CHECKPOINT_PATH = path.join(__dirname, ".birth_position_checkpoint.json");
const WP_BATCH_SIZE = 40;
const CURRENT_YEAR = new Date().getFullYear();

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

function extractBirthYear(infobox) {
  const m = infobox.match(/\bbirth_date\s*=\s*(.*)$/im);
  if (!m) return null;
  const raw = m[1];
  const yearMatch = raw.match(/\|(\d{4})\|/) || raw.match(/(\d{4})/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);
  if (year < 1900 || year > CURRENT_YEAR) return null;
  return year;
}

function extractPosition(infobox) {
  const m = infobox.match(/\bposition\s*=\s*(.*)$/im);
  if (!m) return null;
  let raw = m[1];
  const pipeIdx = raw.indexOf("|");
  if (pipeIdx !== -1 && !raw.slice(0, pipeIdx).includes("[[")) raw = raw.slice(0, pipeIdx);
  const val = cleanWikiValue(raw);
  if (!val || val.length > 60) return null;
  return val;
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
    byTitle[normalizeTitle(page.title)] = infobox
      ? { birthYear: extractBirthYear(infobox), position: extractPosition(infobox) }
      : { birthYear: null, position: null };
  }
  return byTitle;
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { titles: null, data: {} };
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
  console.log(`Toplam ${cp.titles.length} oyuncu için doğum yılı/mevki bilgisi çekilecek.`);

  const todo = cp.titles.filter((t) => !(normalizeTitle(t) in cp.data));
  const totalBatches = Math.ceil(todo.length / WP_BATCH_SIZE);
  console.log(`${todo.length} oyuncu kaldı, ${totalBatches} grup halinde (${Object.keys(cp.data).length} zaten tamam)...`);

  for (let i = 0; i < todo.length; i += WP_BATCH_SIZE) {
    const batch = todo.slice(i, i + WP_BATCH_SIZE);
    const batchNum = i / WP_BATCH_SIZE + 1;
    try {
      const byTitle = await fetchBatch(batch);
      for (const t of batch) {
        const key = normalizeTitle(t);
        cp.data[key] = byTitle[key] || { birthYear: null, position: null };
      }
      console.log(`  grup ${batchNum}/${totalBatches} tamam`);
    } catch (err) {
      console.log(`  grup ${batchNum}/${totalBatches} başarısız: ${err.message} — tekrar çalıştırınca yeniden denenir`);
    }
    saveCheckpoint(cp);
    await new Promise((r) => setTimeout(r, 500));
  }

  const libDir = path.join(__dirname, "..", "lib");
  const byName = {};
  let matched = 0;
  for (const [title, info] of Object.entries(cp.data)) {
    if (!info.birthYear && !info.position) continue;
    const name = titleToPlayerName(title);
    if (!byName[name]) {
      byName[name] = info;
      matched++;
    }
  }

  fs.writeFileSync(
    path.join(libDir, "playerBirthPosition.js"),
    `// Her oyuncunun doğum yılı ve mevkii — scripts/backfill_birth_position.js.\n` +
      `// lib/players.js'e dokunmuyor.\n` +
      `export const PLAYER_BIRTH_POSITION = ${JSON.stringify(byName)};\n`
  );

  console.log(`\nBİTTİ: ${matched} oyuncu için doğum yılı/mevki bilgisi lib/playerBirthPosition.js'e yazıldı (toplam ${cp.titles.length} oyuncudan).`);
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
