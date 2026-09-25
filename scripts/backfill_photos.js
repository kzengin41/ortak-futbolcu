// ============================================================================
// Her oyuncunun Wikipedia kariyer kutusundaki "image" alanını (Wikimedia
// Commons dosya adı) çekip lib/playerPhotos.js'e yazar. Bu SADECE Commons'a
// yüklenmiş, ücretsiz lisanslı fotoğrafları kapsıyor — Wikipedia'nın kendi
// kuralı, yaşayan kişilerin biyografilerinde telifli/"fair use" fotoğrafa
// izin vermiyor, o yüzden bu alan neredeyse hep gerçekten serbest bir
// görsele işaret ediyor.
//
// Görüntüleme: Wikimedia'nın resmi "hotlink" yöntemi Special:FilePath —
// https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/technical
//
// Her iki checkpoint dosyasından (kadro-bazlı + eski Wikidata-bazlı) bilinen
// TÜM oyuncu başlıklarını kullanıyor (backfill_years.js ile aynı desen) —
// ayrı bir tam veri çekimi gerektiriyor.
//
// Çalıştırma:  node scripts/backfill_photos.js
// ============================================================================

const fs = require("fs");
const path = require("path");

const WP_HEADERS = { "User-Agent": "ortak-futbolcu-oyunu/0.1 (kisisel proje; iletisim yok)" };
const CHECKPOINT_PATH = path.join(__dirname, ".photos_checkpoint.json");
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

// "image = Player Name 2023.jpg" -> "Player Name 2023.jpg"
// "image = File:Player Name.jpg" -> "Player Name.jpg" (File: önekini kaldırıyoruz, Special:FilePath ikisini de kabul ediyor ama tutarlı olsun diye)
function extractImageFilename(infobox) {
  const m = infobox.match(/\bimage\s*=\s*(.*)$/im);
  if (!m) return null;
  let val = cleanWikiValue(m[1]);
  val = val.replace(/^File:/i, "").trim();
  if (!val || val.length < 5) return null;
  // Bazı satırlar "image = " boş bırakılmış olabilir ya da sadece boşluk/yorum kalmış olabilir
  if (!/\.(jpe?g|png|gif|svg|webp)$/i.test(val)) return null;
  return val;
}

function normalizeTitle(t) {
  return (t || "").trim().replace(/_/g, " ").replace(/\s+/g, " ");
}

function titleToPlayerName(title) {
  return normalizeTitle(title).replace(/\s*\(footballer.*?\)\s*/gi, "").trim();
}

async function fetchPhotosBatch(wikiTitles) {
  // İKİ AYRI istek — pageimages'ı (hafif) ve revisions/content'i (ağır) BİRLEŞTİRMİYORUZ.
  // Sebebi: 40 başlık için ikisini aynı anda istediğimizde Wikipedia'nın
  // API'si karmaşık/büyük yanıtlarda pageimages kısmını sessizce eksik
  // bırakabiliyor — bu da her seferinde yedek (infobox) yöntemine düşüp
  // kapsamı gereksiz yere düşürüyordu.
  const piUrl =
    "https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=name&pilimit=max&formatversion=2&format=json&titles=" +
    wikiTitles.map(encodeURIComponent).join("|");
  const piData = await fetchWithRetry(piUrl);
  const piPages = piData?.query?.pages || [];

  const byTitle = {};
  const stillMissing = [];
  for (const page of piPages) {
    const key = normalizeTitle(page.title);
    if (page.pageimage) {
      byTitle[key] = page.pageimage;
    } else {
      byTitle[key] = null;
      stillMissing.push(page.title);
    }
  }

  // Sadece pageimages'ın bulamadığı başlıklar için (genelde çok daha küçük
  // bir alt küme) infobox yedeğine bakıyoruz — ayrı, daha küçük bir istekte.
  if (stillMissing.length > 0) {
    const rvUrl =
      "https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&formatversion=2&format=json&titles=" +
      stillMissing.map(encodeURIComponent).join("|");
    const rvData = await fetchWithRetry(rvUrl);
    const rvPages = rvData?.query?.pages || [];
    for (const page of rvPages) {
      const key = normalizeTitle(page.title);
      const wikitext = page?.revisions?.[0]?.slots?.main?.content;
      const infobox = wikitext ? extractInfobox(wikitext) : null;
      byTitle[key] = infobox ? extractImageFilename(infobox) : null;
    }
  }
  return byTitle;
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { titles: null, photos: {} };
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
      console.error("Hiçbir checkpoint dosyası bulunamadı — önce fetch_by_club_roster.js ve/veya fetch_wikipedia_careers.js çalıştırılmış olmalı.");
      process.exit(1);
    }
    cp.titles = [...titleSet];
    saveCheckpoint(cp);
  }
  console.log(`Toplam ${cp.titles.length} oyuncu için fotoğraf bilgisi çekilecek.`);

  // Daha önce "fotoğraf yok" (null) diye işaretlenmiş olanları da YENİDEN
  // dene — bu sefer daha kapsamlı pageimages yöntemiyle bulabiliriz. Zaten
  // fotoğrafı bulunanları tekrar çekmiyoruz (hızlı olsun diye).
  const todo = cp.titles.filter((t) => {
    const key = normalizeTitle(t);
    return !(key in cp.photos) || cp.photos[key] === null;
  });
  const totalBatches = Math.ceil(todo.length / WP_BATCH_SIZE);
  console.log(`${todo.length} oyuncu kaldı, ${totalBatches} grup halinde (${Object.keys(cp.photos).length} zaten tamam)...`);

  for (let i = 0; i < todo.length; i += WP_BATCH_SIZE) {
    const batch = todo.slice(i, i + WP_BATCH_SIZE);
    const batchNum = i / WP_BATCH_SIZE + 1;
    try {
      const byTitle = await fetchPhotosBatch(batch);
      for (const t of batch) {
        const key = normalizeTitle(t);
        cp.photos[key] = byTitle[key] !== undefined ? byTitle[key] : null;
      }
      console.log(`  grup ${batchNum}/${totalBatches} tamam`);
    } catch (err) {
      console.log(`  grup ${batchNum}/${totalBatches} başarısız: ${err.message} — tekrar çalıştırınca yeniden denenir`);
    }
    saveCheckpoint(cp);
    await new Promise((r) => setTimeout(r, 500));
  }

  const libDir = path.join(__dirname, "..", "lib");
  const photosByName = {};
  let matched = 0;
  for (const [title, filename] of Object.entries(cp.photos)) {
    if (!filename) continue;
    const name = titleToPlayerName(title);
    if (!photosByName[name]) {
      photosByName[name] = filename;
      matched++;
    }
  }

  fs.writeFileSync(
    path.join(libDir, "playerPhotos.js"),
    `// Her oyuncunun Wikimedia Commons dosya adı — scripts/backfill_photos.js.\n` +
      `// SADECE Commons'a yüklenmiş, ücretsiz lisanslı fotoğraflar (Wikipedia'nın\n` +
      `// kendi kuralı: yaşayan kişilerde telifli/fair-use fotoğrafa izin vermiyor).\n` +
      `// lib/players.js'e dokunmuyor, ayrı bir dosya.\n` +
      `export const PLAYER_PHOTO_FILENAME = ${JSON.stringify(photosByName)};\n`
  );

  console.log(`\nBİTTİ: ${matched} oyuncu için fotoğraf bulundu, lib/playerPhotos.js'e yazıldı (toplam ${cp.titles.length} oyuncudan).`);
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
