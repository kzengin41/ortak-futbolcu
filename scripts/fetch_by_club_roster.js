// ============================================================================
// KÖK ÇÖZÜM: Önceki script'ler "yeterince ünlü mü" (dil sayısı eşiği) diye
// filtreliyordu — bu yüzden Gökdeniz Bayrakdar gibi gerçek, güncel Süper Lig
// oyuncuları (Wikipedia sayfası olduğu halde) sürekli eksik çıkıyordu.
//
// Bu script farklı çalışıyor: ünlülüğe hiç bakmıyor. Onaylı her kulübün
// (lib/clubTiers.js'teki Süper Lig + TFF 1. Lig listesi) Wikipedia'nın kendi
// "Category:X footballers/players" kategorisinden TÜM kadro geçmişini
// çekiyor — kulüp zaten bizim güvendiğimiz bir liste olduğu için, o kulüpte
// oynamış HERKES otomatik olarak "yeterince ilgili" sayılıyor.
//
// Mevcut lib/players.js'in üzerine YAZMIYOR — bulduğu yeni oyuncuları
// EKLİYOR (zaten olanları atlıyor). Yani mevcut kapsamı kaybetmeden
// büyütüyoruz.
//
// Çalıştırma:  node scripts/fetch_by_club_roster.js
// ============================================================================

const fs = require("fs");
const path = require("path");

const WP_HEADERS = { "User-Agent": "ortak-futbolcu-oyunu/0.1 (kisisel proje; iletisim yok)" };
const CHECKPOINT_PATH = path.join(__dirname, ".club_roster_checkpoint.json");
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

// Önceki sürüm elle köşeli parantez sayarak JSON ayrıştırıyordu — bir isimde
// beklenmedik bir karakter olursa kırılabiliyordu. Bunun yerine Node'un
// KENDİ gerçek JS ayrıştırıcısını kullanıyoruz: dosyayı geçici bir
// CommonJS modülüne çevirip require() ediyoruz. Trailing comma, string
// içeriği, hepsini doğru şekilde Node'un kendisi hallediyor.
function readExportedModule(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const names = [];
  // "export const X =" -> "const X =" (export'u kaldırıyoruz ama X'i normal
  // bir yerel değişken olarak bırakıyoruz — böylece dosya içinde biri
  // diğerine referans veriyorsa (TOP2_TIER_CLUBS, SUPER_LIG_CLUBS'a atıfta
  // bulunduğu gibi) o referans kırılmıyor). Sona toplu bir module.exports
  // ekleyip hepsini birden dışa veriyoruz.
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

// ---------------------------------------------------------------------------
// AŞAMA 1: Her kulüp için Wikipedia makale başlığını bul, sonra kadro
// kategorisini dene ("footballers" / "players" adaylarıyla)
// ---------------------------------------------------------------------------
async function findWikipediaTitle(clubName) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
    encodeURIComponent(clubName + " football club") +
    "&srnamespace=0&srlimit=1&format=json";
  const data = await fetchWithRetry(url);
  const hit = data?.query?.search?.[0];
  return hit ? hit.title : null;
}

async function fetchCategoryMembers(categoryTitle) {
  let members = [];
  let cont = null;
  // 500 sınırında kesmek yerine cmcontinue token'ıyla devam ediyoruz —
  // yoksa Arsenal gibi büyük kulüplerde alfabetik ilk 500'de kalıp
  // geri kalan (belki daha tanıdık) oyuncuları hiç görmüyorduk.
  for (let page = 0; page < 20; page++) {
    let url =
      "https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=" +
      encodeURIComponent("Category:" + categoryTitle) +
      "&cmlimit=500&cmtype=page&format=json";
    if (cont) url += "&cmcontinue=" + encodeURIComponent(cont);
    const data = await fetchWithRetry(url);
    members = members.concat((data.query?.categorymembers || []).map((m) => m.title));
    cont = data.continue?.cmcontinue;
    if (!cont) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  return members;
}

async function findClubRoster(clubName) {
  const wikiTitle = await findWikipediaTitle(clubName);
  if (!wikiTitle) return { wikiTitle: null, players: [] };

  // "Fenerbahçe S.K. (football)" gibi ayraçlı başlıklarda, kadro kategorisi
  // genelde ayraç OLMADAN yazılır ("Fenerbahçe S.K. footballers") — hem ayraçlı
  // hem ayraçsız hâli deniyoruz.
  const baseTitle = wikiTitle.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const titleVariants = [...new Set([wikiTitle, baseTitle])];
  const candidates = [];
  for (const t of titleVariants) {
    candidates.push(`${t} footballers`, `${t} players`, `${t} F.K. footballers`, `${t} F.C. footballers`);
  }

  // ÖNEMLİ: hatayı burada YUTMUYORUZ, yukarı fırlatıyoruz — yoksa rate limit
  // yüzünden başarısız olan bir deneme "kategori yok" ile karışıp yanlışlıkla
  // kalıcı olarak cache'lenebilir (tam da Rizespor'da olan buydu).
  for (const candidate of candidates) {
    const members = await fetchCategoryMembers(candidate);
    if (members.length > 0) return { wikiTitle, category: candidate, players: members };
    await new Promise((r) => setTimeout(r, 500)); // adaylar arasında da nazik ol
  }
  return { wikiTitle, category: null, players: [] };
}

// ---------------------------------------------------------------------------
// AŞAMA 2: Her oyuncunun infobox'ından kariyer verisi (önceki script'le
// birebir aynı ayrıştırma mantığı — zaten test edilmiş, kanıtlanmış)
// ---------------------------------------------------------------------------
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
  v = v.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_, a, __, b) => (b || a));
  v = v.replace(/'''?/g, "");
  v = v.replace(/→/g, "").replace(/\(loan\)/gi, "").replace(/\(on loan\)/gi, "");
  v = v.replace(/\{\{[^{}]*\}\}/g, "");
  return v.trim();
}

function extractClubsFromInfobox(infobox) {
  const clubs = new Set();
  const re = /\bclubs\d+\s*=\s*(.*)$/gim;
  let m;
  while ((m = re.exec(infobox))) {
    let depth = 0;
    let out = "";
    const line = m[1];
    for (let i = 0; i < line.length; i++) {
      if (line.startsWith("[[", i)) {
        depth++;
        out += "[[";
        i++;
        continue;
      }
      if (line.startsWith("]]", i)) {
        depth--;
        out += "]]";
        i++;
        continue;
      }
      if (line[i] === "|" && depth === 0) break;
      out += line[i];
    }
    const val = cleanWikiValue(out);
    if (val && val.length > 1 && !/^\d+$/.test(val)) clubs.add(val);
  }
  return [...clubs];
}

function normalizeTitle(t) {
  return (t || "").trim().replace(/_/g, " ").replace(/\s+/g, " ");
}

async function fetchCareerBatch(wikiTitles) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&formatversion=2&format=json&titles=" +
    wikiTitles.map(encodeURIComponent).join("|");
  const data = await fetchWithRetry(url);
  const pages = data?.query?.pages || [];
  const byTitle = {};
  for (const page of pages) {
    const wikitext = page?.revisions?.[0]?.slots?.main?.content;
    const infobox = wikitext ? extractInfobox(wikitext) : null;
    byTitle[normalizeTitle(page.title)] = infobox ? extractClubsFromInfobox(infobox) : [];
  }
  return byTitle;
}

// ---------------------------------------------------------------------------
function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { rosters: {}, playerTitles: [], careers: {} };
  return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8"));
}
function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp));
}

async function main() {
  const libDir = path.join(__dirname, "..", "lib");
  const superLig = readExportedJson(path.join(libDir, "clubTiers.js"), "SUPER_LIG_CLUBS");
  const tff1Lig = readExportedJson(path.join(libDir, "clubTiers.js"), "TFF1_LIG_CLUBS");
  let big5 = [];
  try {
    big5 = readExportedJson(path.join(libDir, "big5ClubTiers.js"), "BIG5_CLUBS");
  } catch {
    console.log("lib/big5ClubTiers.js okunamadı, sadece Türkiye kulüpleri taranacak.");
  }
  const targetClubs = [...new Set([...superLig, ...tff1Lig, ...big5])];
  console.log(`${targetClubs.length} onaylı kulüp için kadro taranacak.`);

  const cp = loadCheckpoint();

  // Aşama 1: her kulübün kadro listesi (oyuncu adı listesi, kariyer detayı yok)
  // NOT: sadece gerçekten kategori BULUNAN kulüpleri "tamam" say. "Kategori
  // yok" sonucu genelde rate limit yüzünden yarım kalmış bir deneme oluyor
  // (Rizespor'da gördüğümüz gibi) — bu yüzden her çalıştırmada otomatik
  // tekrar denenir, elle checkpoint temizlemene gerek kalmaz.
  for (const club of targetClubs) {
    if (cp.rosters[club] && cp.rosters[club].category) continue;
    console.log(`  ${club} kadrosu aranıyor...`);
    try {
      const { wikiTitle, category, players } = await findClubRoster(club);
      cp.rosters[club] = { wikiTitle, category, players };
      console.log(`    ${wikiTitle || "bulunamadı"} -> ${category || "kategori yok"} -> ${players.length} oyuncu`);
    } catch (err) {
      console.log(`    başarısız: ${err.message} — atlanıp devam ediliyor, tekrar çalıştırınca yeniden denenir`);
    }
    saveCheckpoint(cp);
    await new Promise((r) => setTimeout(r, 700));
  }

  // Tüm kulüplerden gelen oyuncu isimlerini birleştir (dedupe)
  const allTitles = new Set(cp.playerTitles);
  for (const club of targetClubs) {
    (cp.rosters[club]?.players || []).forEach((t) => allTitles.add(t));
  }
  cp.playerTitles = [...allTitles];
  saveCheckpoint(cp);
  console.log(`\nToplam ${cp.playerTitles.length} benzersiz oyuncu bulundu (tüm onaylı kulüplerden).`);

  // Aşama 2: her oyuncunun kariyer verisi, gruplar halinde
  const todo = cp.playerTitles.filter((t) => !cp.careers[normalizeTitle(t)]);
  const totalBatches = Math.ceil(todo.length / WP_BATCH_SIZE);
  console.log(`Aşama 2: ${todo.length} oyuncunun kariyeri çekilecek, ${totalBatches} grup halinde...`);

  for (let i = 0; i < todo.length; i += WP_BATCH_SIZE) {
    const batch = todo.slice(i, i + WP_BATCH_SIZE);
    const batchNum = i / WP_BATCH_SIZE + 1;
    try {
      const byTitle = await fetchCareerBatch(batch);
      for (const t of batch) {
        const key = normalizeTitle(t);
        cp.careers[key] = { wikiTitle: t, clubs: byTitle[key] || [] };
      }
      console.log(`  grup ${batchNum}/${totalBatches} tamam`);
    } catch (err) {
      console.log(`  grup ${batchNum}/${totalBatches} başarısız: ${err.message} — tekrar çalıştırınca yeniden denenir`);
    }
    saveCheckpoint(cp);
    await new Promise((r) => setTimeout(r, 800));
  }

  // ---- Mevcut lib/players.js ile birleştir ----
  let existingPlayers = [];
  try {
    existingPlayers = readExportedJson(path.join(libDir, "players.js"), "PLAYERS");
  } catch {
    console.log("Mevcut lib/players.js okunamadı, sıfırdan yazılacak.");
  }
  const existingNames = new Set(existingPlayers.map((p) => p.name));

  // Wikipedia makale başlığından "gerçek isim" çıkarmak için basitçe alt
  // çizgiyi boşluğa çeviriyoruz — infobox'taki isim daha doğru olurdu ama
  // makale başlığı da genelde temiz.
  let addedCount = 0;
  const newPlayers = [];
  for (const [key, data] of Object.entries(cp.careers)) {
    if (data.clubs.length < 2) continue;
    const name = normalizeTitle(data.wikiTitle).replace(/\s*\(footballer.*?\)\s*/gi, "").trim();
    if (existingNames.has(name)) continue;
    newPlayers.push({ name, clubs: data.clubs });
    existingNames.add(name);
    addedCount++;
  }

  const finalPlayers = [...existingPlayers, ...newPlayers].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  console.log(`\n${addedCount} YENİ oyuncu eklendi. Toplam: ${finalPlayers.length} oyuncu (önceki: ${existingPlayers.length}).`);

  fs.writeFileSync(
    path.join(libDir, "players.js"),
    `// Kulüp kadrosu bazlı kök keşif + önceki veri — scripts/fetch_by_club_roster.js\n` +
      `export const PLAYERS = ${JSON.stringify(finalPlayers, null, 2)};\n`
  );

  // ---- clubs metadata ve seed.sql'i de güncelle (apply_corrections.js ile aynı mantık) ----
  let clubInfo = {};
  try {
    clubInfo = readExportedJson(path.join(libDir, "clubs.js"), "CLUB_INFO");
  } catch {
    console.log("lib/clubs.js okunamadı, ülke/lig bilgisi olmadan devam ediliyor.");
  }
  const clubSet = [...new Set(finalPlayers.flatMap((p) => p.clubs))].sort();
  for (const c of clubSet) if (!clubInfo[c]) clubInfo[c] = { country: null, league: null };
  fs.writeFileSync(
    path.join(libDir, "clubs.js"),
    `// Kulüp kadrosu bazlı kök keşif + önceki veri — scripts/fetch_by_club_roster.js\n` +
      `export const CLUB_INFO = ${JSON.stringify(clubInfo, null, 2)};\n`
  );

  function esc(s) {
    return s.replace(/'/g, "''");
  }
  function sqlStr(v) {
    return v ? `'${esc(v)}'` : "null";
  }
  const clubIndex = new Map(clubSet.map((c, i) => [c, i + 1]));
  let sql = "-- otomatik üretildi: scripts/fetch_by_club_roster.js\n\n";
  sql += "alter table clubs add column if not exists country text;\n";
  sql += "alter table clubs add column if not exists league text;\n\n";
  sql += "truncate table player_clubs, players, clubs restart identity cascade;\n\n";
  sql +=
    "insert into clubs (id, name, country, league) values\n" +
    clubSet.map((c, i) => `  (${i + 1}, ${sqlStr(c)}, ${sqlStr(clubInfo[c]?.country)}, ${sqlStr(clubInfo[c]?.league)})`).join(",\n") +
    "\non conflict (id) do nothing;\n\n";
  sql +=
    "insert into players (id, name) values\n" +
    finalPlayers.map((p, i) => `  (${i + 1}, '${esc(p.name)}')`).join(",\n") +
    "\non conflict (id) do nothing;\n\n";
  const relRows = [];
  finalPlayers.forEach((p, pi) => p.clubs.forEach((c) => relRows.push(`  (${pi + 1}, ${clubIndex.get(c)})`)));
  sql += "insert into player_clubs (player_id, club_id) values\n" + relRows.join(",\n") + "\non conflict do nothing;\n";
  fs.writeFileSync(path.join(__dirname, "..", "supabase", "seed.sql"), sql);

  console.log("\nHEPSİ TAMAM: lib/players.js, lib/clubs.js, supabase/seed.sql yazıldı.");
  console.log("Tek kalan adım: yeni seed.sql'i Supabase SQL Editor'da çalıştır.");
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
