// ============================================================================
// Mevcut ~43 bin oyuncunun her birinin Wikipedia kariyer kutusundan bu sefer
// YIL bilgisini de (yearsN alanı, clubsN ile eşleşen) çekip, her oyuncu için
// "en son hangi yıl aktifti" bilgisini hesaplar. Bunu ayrı bir dosyaya
// (lib/playerYears.js) yazar — mevcut lib/players.js'e HİÇ dokunmaz.
//
// Neden gerekli: kulüp ünlü olsa bile ("Manchester United" gibi), veri
// setimizde o kulübün 1960'lardan bugüne oynamış HERKESİ var — sadece
// güncel/tanıdık oyuncuları değil. Bu script, "son 10-15 yılda oynamış
// olanlar daha sık çıksın" önceliklendirmesini mümkün kılacak veriyi
// sağlıyor.
//
// Her iki checkpoint dosyasından (kadro-bazlı + eski Wikidata-bazlı) bilinen
// TÜM oyuncu başlıklarını toplayıp kariyerlerini yeniden çekiyor — bu,
// önceki tam veri çekimine benzer sürede sürebilir (rate limit'lere
// takılabilir, kesintiye uğrarsa aynı komutu tekrar çalıştır).
//
// Çalıştırma:  node scripts/backfill_years.js
// ============================================================================

const fs = require("fs");
const path = require("path");

const WP_HEADERS = { "User-Agent": "ortak-futbolcu-oyunu/0.1 (kisisel proje; iletisim yok)" };
const CHECKPOINT_PATH = path.join(__dirname, ".years_checkpoint.json");
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

// "2015–2019" -> 2019, "2019–" (hâlâ aktif) -> güncel yıl, "2015" -> 2015
function parseEndYear(yearsStr) {
  if (!yearsStr) return null;
  const cleaned = cleanWikiValue(yearsStr);
  const matches = cleaned.match(/\d{4}/g);
  if (!matches) return null;
  const openEnded = matches.length === 1 && /[-–—]\s*$/.test(cleaned);
  if (openEnded) return CURRENT_YEAR;
  return parseInt(matches[matches.length - 1], 10);
}

// Her oyuncunun kariyer kutusundan "en son aktif olduğu yıl"ı çıkarır —
// yearsN alanlarının HEPSİNE bakıp en büyüğünü alıyoruz (milli takım
// yıllarını değil, sadece kulüp yıllarını dikkate alıyoruz).
function extractLastActiveYear(infobox) {
  const re = /\byears\d+\s*=\s*(.*)$/gim;
  let m;
  let maxYear = null;
  while ((m = re.exec(infobox))) {
    const y = parseEndYear(m[1]);
    if (y && (maxYear === null || y > maxYear)) maxYear = y;
  }
  return maxYear;
}

function normalizeTitle(t) {
  return (t || "").trim().replace(/_/g, " ").replace(/\s+/g, " ");
}

// lib/players.js'teki isimler bu şekilde türetiliyordu (fetch_by_club_roster.js
// ile aynı mantık) — eşleştirme anahtarını buna göre kuruyoruz.
function titleToPlayerName(title) {
  return normalizeTitle(title).replace(/\s*\(footballer.*?\)\s*/gi, "").trim();
}

async function fetchYearsBatch(wikiTitles) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&formatversion=2&format=json&titles=" +
    wikiTitles.map(encodeURIComponent).join("|");
  const data = await fetchWithRetry(url);
  const pages = data?.query?.pages || [];
  const byTitle = {};
  for (const page of pages) {
    const wikitext = page?.revisions?.[0]?.slots?.main?.content;
    const infobox = wikitext ? extractInfobox(wikitext) : null;
    byTitle[normalizeTitle(page.title)] = infobox ? extractLastActiveYear(infobox) : null;
  }
  return byTitle;
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { titles: null, years: {} };
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
    // Her iki eski checkpoint'ten bilinen tüm oyuncu başlıklarını topla.
    const titleSet = new Set();

    const rosterCp = readJsonCheckpoint(path.join(__dirname, ".club_roster_checkpoint.json"));
    if (rosterCp?.playerTitles) {
      rosterCp.playerTitles.forEach((t) => titleSet.add(normalizeTitle(t)));
    }

    const careersCp = readJsonCheckpoint(path.join(__dirname, ".wikipedia_careers_checkpoint.json"));
    if (careersCp?.discovered) {
      careersCp.discovered.forEach((p) => {
        if (p.wikiTitle) titleSet.add(normalizeTitle(p.wikiTitle));
      });
    }

    if (titleSet.size === 0) {
      console.error("Hiçbir checkpoint dosyası bulunamadı — önce fetch_by_club_roster.js ve/veya fetch_wikipedia_careers.js çalıştırılmış olmalı.");
      process.exit(1);
    }

    cp.titles = [...titleSet];
    saveCheckpoint(cp);
  }
  console.log(`Toplam ${cp.titles.length} oyuncu için yıl bilgisi çekilecek.`);

  const todo = cp.titles.filter((t) => !(normalizeTitle(t) in cp.years));
  const totalBatches = Math.ceil(todo.length / WP_BATCH_SIZE);
  console.log(`${todo.length} oyuncu kaldı, ${totalBatches} grup halinde (${Object.keys(cp.years).length} zaten tamam)...`);

  for (let i = 0; i < todo.length; i += WP_BATCH_SIZE) {
    const batch = todo.slice(i, i + WP_BATCH_SIZE);
    const batchNum = i / WP_BATCH_SIZE + 1;
    try {
      const byTitle = await fetchYearsBatch(batch);
      for (const t of batch) {
        const key = normalizeTitle(t);
        cp.years[key] = byTitle[key] !== undefined ? byTitle[key] : null;
      }
      console.log(`  grup ${batchNum}/${totalBatches} tamam`);
    } catch (err) {
      console.log(`  grup ${batchNum}/${totalBatches} başarısız: ${err.message} — tekrar çalıştırınca yeniden denenir`);
    }
    saveCheckpoint(cp);
    await new Promise((r) => setTimeout(r, 500));
  }

  // ---- lib/playerYears.js'i yaz: { oyuncuAdı: sonAktifYıl } ----
  const libDir = path.join(__dirname, "..", "lib");
  const yearsByName = {};
  let matched = 0;
  for (const [title, year] of Object.entries(cp.years)) {
    if (year === null || year === undefined) continue;
    const name = titleToPlayerName(title);
    // Aynı isme birden fazla kaynak farklı yıl verirse (nadir), en büyüğünü tut.
    if (!yearsByName[name] || year > yearsByName[name]) {
      yearsByName[name] = year;
      matched++;
    }
  }

  fs.writeFileSync(
    path.join(libDir, "playerYears.js"),
    `// Her oyuncunun kariyer kutusundan çekilen "en son aktif olduğu yıl" —\n` +
      `// scripts/backfill_years.js. lib/players.js'e dokunmuyor, ayrı bir dosya.\n` +
      `export const PLAYER_LAST_ACTIVE_YEAR = ${JSON.stringify(yearsByName)};\n`
  );

  console.log(`\nBİTTİ: ${matched} oyuncu için yıl bilgisi lib/playerYears.js'e yazıldı.`);
  console.log("Tek kalan adım: node scripts/apply_corrections.js çalıştırıp Supabase'e tekrar yükle (isteğe bağlı, sadece yerel modlar için gerekli değil).");
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
