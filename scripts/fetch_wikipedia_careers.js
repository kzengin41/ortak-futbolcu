// ============================================================================
// İKİ FARKLI ÜCRETSIZ KAYNAK, İKİ FARKLI İŞ İÇİN:
//   1) Wikidata: SADECE "kim futbolcu + İngilizce Wikipedia sayfası hangisi"
//      diye küçük/hızlı bir keşif için kullanılıyor (bunu zaten kanıtladık,
//      çalışıyor).
//   2) Wikipedia: ASIL kariyer verisi buradan — her oyuncunun makalesindeki
//      "Senior career" infobox kutusundan gerçek kulüp listesini okuyoruz.
//      Bu, Wikidata'nın yapılandırılmış P54 alanından ÇOK daha güvenilir
//      çıktı (Burak Yılmaz örneğinde Wikipedia'nın infobox'ı eksiksizdi,
//      Wikidata'nın P54'ü eksikti — ikisi aynı kaynağa dayanıyor ama
//      Wikipedia'nın kendisi daha iyi bakımlı).
//   Kredi kartı yok, günlük istek kotası yok (sadece nazik bir hız sınırı
//   uyguluyoruz), tamamen ücretsiz.
//
// ÖNEMLİ — DÜRÜST OLMAM GEREKEN NOKTA: Wikipedia infobox metnini (wikitext)
// ayrıştırma mantığı, şablonun standart yapısına dayanarak yazıldı ama
// benim ortamımda canlı bir wikitext çekip TEST EDEMEDİM (ağ erişimim yok).
// Bu yüzden script TEST_MODE ile başlıyor — sadece ~15 oyuncuyla dene,
// çıktıyı bana getir, gerçekten doğru kulüpler çıkıyorsa TEST_MODE'u
// kapatıp tam listeye geçeriz. Bazı makalelerin infobox formatı standarttan
// sapabilir (nadiren) — script böyle satırları sessizce atlar, hiçbir
// oyuncuyu 0 kulüple bırakmaz (0 kulüplü olan zaten filtrelenir).
//
// Çalıştırma:  node scripts/fetch_wikipedia_careers.js
// ============================================================================

const fs = require("fs");
const path = require("path");

const TEST_MODE = false; // test geçti, tam listeye geçiyoruz
const MIN_SITELINKS = 8; // 20'den düşürdük — ülke kapsamı zaten obskür ülkeleri eledi
const MAX_PLAYERS = TEST_MODE ? 15 : 6000;
const CHECKPOINT_PATH = path.join(__dirname, ".wikipedia_careers_checkpoint.json");

const WD_HEADERS = {
  Accept: "application/sparql-results+json",
  "User-Agent": "ortak-futbolcu-oyunu/0.1 (kisisel proje; iletisim yok)",
};
const WP_HEADERS = {
  "User-Agent": "ortak-futbolcu-oyunu/0.1 (kisisel proje; iletisim yok)",
};

async function fetchWithRetry(url, headers, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    const res = await fetch(url, { headers });
    if (res.ok) return res.json();
    const isTransient = [429, 502, 503, 504].includes(res.status);
    if (!isTransient || i === attempts) throw new Error(`${res.status} ${res.statusText}`);
    await new Promise((r) => setTimeout(r, 8000));
  }
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { discovered: null, careers: {} };
  return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8"));
}
function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp));
}

// ---------------------------------------------------------------------------
// AŞAMA 1: Wikidata'dan oyuncu keşfi (kim futbolcu + wikipedia sayfası)
// Türkiye + 5 büyük lig ülkeleri (İngiltere için hem Q21 hem Q145 — Wikidata'da
// kulüpler bazen "England" bazen "United Kingdom" olarak işaretlenmiş).
// ---------------------------------------------------------------------------
const COUNTRIES = [
  { qid: "Q43", name: "Türkiye" },
  { qid: "Q21", name: "İngiltere" },
  { qid: "Q145", name: "Birleşik Krallık" },
  { qid: "Q29", name: "İspanya" },
  { qid: "Q38", name: "İtalya" },
  { qid: "Q183", name: "Almanya" },
  { qid: "Q142", name: "Fransa" },
];

async function getQualifyingQids(countryQid, limit) {
  // Etiket servisi YOK, wikipedia join YOK — sadece ID listesi, mümkün
  // olduğunca ucuz bir sorgu.
  const query = `
    SELECT ?player WHERE {
      ?player wdt:P106 wd:Q937857.
      ?player wdt:P54 ?club.
      ?club wdt:P17 wd:${countryQid}.
      ?player wikibase:sitelinks ?sitelinks.
      FILTER(?sitelinks >= ${MIN_SITELINKS})
    }
    LIMIT ${limit}
  `;
  const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(query) + "&format=json";
  const data = await fetchWithRetry(url, WD_HEADERS);
  return data.results.bindings.map((row) => row.player.value.split("/").pop());
}

async function enrichBatch(qids) {
  const values = qids.map((q) => `wd:${q}`).join(" ");
  const query = `
    SELECT ?player ?playerLabel ?articleTitle WHERE {
      VALUES ?player { ${values} }
      OPTIONAL {
        ?article schema:about ?player;
                 schema:isPartOf <https://en.wikipedia.org/>;
                 schema:name ?articleTitle.
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;
  const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(query) + "&format=json";
  const data = await fetchWithRetry(url, WD_HEADERS);
  return data.results.bindings;
}

async function discoverPlayers() {
  const perCountryLimit = TEST_MODE ? MAX_PLAYERS : Math.ceil((MAX_PLAYERS / COUNTRIES.length) * 1.3);
  const allQids = new Set();
  for (const c of COUNTRIES) {
    console.log(`  ${c.name}: ID listesi çekiliyor...`);
    try {
      const qids = await getQualifyingQids(c.qid, perCountryLimit);
      qids.forEach((q) => allQids.add(q));
      console.log(`    toplam ${allQids.size} benzersiz ID (birikimli)`);
    } catch (err) {
      console.log(`  ${c.name} başarısız: ${err.message} — atlanıp devam ediliyor`);
    }
    if (TEST_MODE && allQids.size >= MAX_PLAYERS) break;
  }

  const qidList = [...allQids].slice(0, MAX_PLAYERS);
  const totalBatches = Math.ceil(qidList.length / 50);
  console.log(`\n${qidList.length} ID bulundu. İsim + Wikipedia sayfası eşleniyor (${totalBatches} grup)...`);

  const results = [];
  for (let i = 0; i < qidList.length; i += 50) {
    const batch = qidList.slice(i, i + 50);
    const batchNum = i / 50 + 1;
    try {
      const rows = await enrichBatch(batch);
      for (const row of rows) {
        const qid = row.player.value.split("/").pop();
        const name = row.playerLabel?.value;
        const wikiTitle = row.articleTitle?.value;
        if (!name || !wikiTitle || /^Q\d+$/.test(name)) continue; // İngilizce wikipedia sayfası olmayan (nadiren) atlanır
        results.push({ qid, name, wikiTitle });
      }
      console.log(`  grup ${batchNum}/${totalBatches} tamam`);
    } catch (err) {
      console.log(`  grup ${batchNum}/${totalBatches} başarısız: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}

// ---------------------------------------------------------------------------
// AŞAMA 2: Her oyuncunun Wikipedia makalesinden "Senior career" infobox'ını
// ayrıştırıp gerçek kulüp listesini çıkar.
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

function extractFieldValue(line) {
  // "clubs1 = " sonrası kalan ham satır. Wikilink içindeki | ile gerçek
  // parametre ayracı olan | birbirine karışmasın diye [[ ]] derinliğini
  // takip ederek doğru yerde duruyoruz.
  let depth = 0;
  let out = "";
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
    if (line[i] === "|" && depth === 0) break; // gerçek parametre ayracı (örn. | caps1 = ...)
    out += line[i];
  }
  return out.trim();
}

function extractClubsFromInfobox(infobox) {
  const clubs = new Set();
  const re = /\bclubs\d+\s*=\s*(.*)$/gim;
  let m;
  while ((m = re.exec(infobox))) {
    const val = cleanWikiValue(extractFieldValue(m[1]));
    if (val && val.length > 1 && !/^\d+$/.test(val)) clubs.add(val);
  }
  return [...clubs];
}

const WP_BATCH_SIZE = 40; // MediaWiki API'nin titles= sınırı 50, güvenlik payı bıraktık

function normalizeTitle(t) {
  return (t || "").trim().replace(/_/g, " ").replace(/\s+/g, " ");
}

async function fetchCareerClubsBatch(wikiTitles) {
  // titles= parametresi | ile ayrılmış birden fazla sayfa kabul ediyor —
  // tek istekte 40 sayfa çekmek, 40 ayrı istek atmaktan HEM çok daha hızlı
  // HEM rate limit riskini ciddi şekilde azaltıyor (istek SAYISI önemli).
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&formatversion=2&format=json&titles=" +
    wikiTitles.map(encodeURIComponent).join("|");
  const data = await fetchWithRetry(url, WP_HEADERS);
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
async function main() {
  const cp = loadCheckpoint();

  if (!cp.discovered) {
    console.log("Aşama 1: Wikidata'dan oyuncu + Wikipedia sayfası listesi çekiliyor...");
    cp.discovered = await discoverPlayers();
    saveCheckpoint(cp);
    console.log(`${cp.discovered.length} oyuncu bulundu.`);
  } else {
    console.log(`Aşama 1 zaten tamam: ${cp.discovered.length} oyuncu.`);
  }

  const todo = cp.discovered.filter((p) => !cp.careers[p.qid]);
  const totalBatches = Math.ceil(todo.length / WP_BATCH_SIZE);
  console.log(`Aşama 2: ${todo.length} oyuncunun Wikipedia kariyer kutusu okunacak, ${totalBatches} grup halinde (${Object.keys(cp.careers).length} zaten tamam)...`);

  for (let i = 0; i < todo.length; i += WP_BATCH_SIZE) {
    const batch = todo.slice(i, i + WP_BATCH_SIZE);
    const batchNum = i / WP_BATCH_SIZE + 1;
    try {
      const byTitle = await fetchCareerClubsBatch(batch.map((p) => p.wikiTitle));
      for (const p of batch) {
        const clubs = byTitle[normalizeTitle(p.wikiTitle)] || [];
        cp.careers[p.qid] = { name: p.name, wikiTitle: p.wikiTitle, clubs };
      }
      console.log(`  grup ${batchNum}/${totalBatches} tamam (${batch.length} oyuncu)`);
    } catch (err) {
      console.log(`  grup ${batchNum}/${totalBatches} başarısız: ${err.message} — bu gruptaki oyuncular sonraki çalıştırmada tekrar denenir`);
    }
    saveCheckpoint(cp);
    await new Promise((r) => setTimeout(r, 500)); // Wikipedia'ya nazik davranalım
  }

  const finalPlayers = Object.values(cp.careers)
    .filter((p) => p.clubs.length >= 2)
    .map((p) => ({ name: p.name, clubs: p.clubs }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  console.log(`\n${finalPlayers.length} oyuncu (en az 2 kulüplü) kullanılabilir.`);

  if (TEST_MODE) {
    console.log("\nTEST_MODE çıktısı (ilk 15 oyuncu, kontrol için):");
    for (const p of finalPlayers) console.log(`  ${p.name}: ${p.clubs.join(", ")}`);
    console.log("\nBu liste doğru/tanıdık görünüyorsa, script'in başındaki TEST_MODE'u false yap ve tekrar çalıştır.");
    return; // TEST_MODE'da dosya YAZMIYORUZ, önce sen kontrol et
  }

  const libDir = path.join(__dirname, "..", "lib");

  // ---- lib/corrections.js'teki elle düzeltmeleri uygula ----
  let correctedPlayers = finalPlayers;
  try {
    const correctionsSrc = fs.readFileSync(path.join(libDir, "corrections.js"), "utf8");
    const cMatch = correctionsSrc.match(/CORRECTIONS = ([\s\S]*);\s*$/);
    const corrections = cMatch ? JSON.parse(cMatch[1].replace(/,(\s*[\]}])/g, "$1")) : {};
    let addedCount = 0;
    correctedPlayers = finalPlayers.map((p) => {
      const extra = corrections[p.name];
      if (!extra) return p;
      const set = new Set(p.clubs);
      extra.forEach((c) => {
        if (!set.has(c)) addedCount++;
        set.add(c);
      });
      return { ...p, clubs: [...set] };
    });
    if (addedCount > 0) console.log(`lib/corrections.js'ten ${addedCount} ek ilişki uygulandı.`);
  } catch {
    console.log("lib/corrections.js okunamadı, düzeltmeler atlandı.");
  }

  // ---- Mevcut lib/players.js ile BİRLEŞTİR — üzerine YAZMIYORUZ ----
  // (Node'un kendi require() mekanizmasıyla okuyoruz, elle ayrıştırma değil —
  // önceki bir çalıştırmada bu adım eksikti ve veri kaybına yol açmıştı.)
  let mergedPlayers = [...correctedPlayers];
  try {
    const readExportedModule = (filePath) => {
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
    };
    const existing = readExportedModule(path.join(libDir, "players.js")).PLAYERS || [];
    const byName = new Map(existing.map((p) => [p.name, { ...p, clubs: new Set(p.clubs) }]));
    let newCount = 0;
    for (const p of correctedPlayers) {
      if (byName.has(p.name)) {
        p.clubs.forEach((c) => byName.get(p.name).clubs.add(c));
      } else {
        byName.set(p.name, { name: p.name, clubs: new Set(p.clubs) });
        newCount++;
      }
    }
    mergedPlayers = [...byName.values()].map((p) => ({ name: p.name, clubs: [...p.clubs] }));
    console.log(`Mevcut lib/players.js ile birleştirildi: ${existing.length} mevcut + ${newCount} yeni = ${mergedPlayers.length} toplam.`);
  } catch {
    console.log("Mevcut lib/players.js yok/okunamadı, sıfırdan yazılıyor.");
  }
  correctedPlayers = mergedPlayers.sort((a, b) => a.name.localeCompare(b.name, "tr"));

  // ---- kulüp ülke/lig metadata: eski (Wikidata tabanlı) lib/clubs.js'i temel alıyoruz ----
  let clubInfo = {};
  try {
    const clubsSrc = fs.readFileSync(path.join(libDir, "clubs.js"), "utf8");
    const clMatch = clubsSrc.match(/CLUB_INFO = ([\s\S]*);\s*$/);
    if (clMatch) clubInfo = JSON.parse(clMatch[1]);
  } catch {
    console.log("Eski lib/clubs.js bulunamadı, ülke/lig bilgisi olmadan devam ediliyor.");
  }

  const clubSet = [...new Set(correctedPlayers.flatMap((p) => p.clubs))].sort();
  for (const c of clubSet) {
    if (!clubInfo[c]) clubInfo[c] = { country: null, league: null };
  }
  fs.writeFileSync(
    path.join(libDir, "clubs.js"),
    `// Wikipedia + eski Wikidata ülke/lig metadata birleşimi — scripts/fetch_wikipedia_careers.js\n` +
      `export const CLUB_INFO = ${JSON.stringify(clubInfo, null, 2)};\n`
  );

  // ---- lib/players.js'i (birleştirilmiş haliyle) yaz ----
  fs.writeFileSync(
    path.join(libDir, "players.js"),
    `// Wikipedia infobox'ları + elle düzeltmeler + önceki veriyle birleştirilmiş — scripts/fetch_wikipedia_careers.js\n` +
      `export const PLAYERS = ${JSON.stringify(correctedPlayers, null, 2)};\n`
  );

  // ---- supabase/seed.sql ----
  function esc(s) {
    return s.replace(/'/g, "''");
  }
  function sqlStr(v) {
    return v ? `'${esc(v)}'` : "null";
  }
  const clubIndex = new Map(clubSet.map((c, i) => [c, i + 1]));

  let sql = "-- otomatik üretildi: scripts/fetch_wikipedia_careers.js\n\n";
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
    correctedPlayers.map((p, i) => `  (${i + 1}, '${esc(p.name)}')`).join(",\n") +
    "\non conflict (id) do nothing;\n\n";

  const relRows = [];
  correctedPlayers.forEach((p, pi) => {
    p.clubs.forEach((c) => relRows.push(`  (${pi + 1}, ${clubIndex.get(c)})`));
  });
  sql += "insert into player_clubs (player_id, club_id) values\n" + relRows.join(",\n") + "\non conflict do nothing;\n";
  fs.writeFileSync(path.join(__dirname, "..", "supabase", "seed.sql"), sql);

  console.log(`\nHEPSİ TAMAM: lib/players.js, lib/clubs.js, supabase/seed.sql yazıldı.`);
  console.log(`${correctedPlayers.length} oyuncu, ${clubSet.length} kulüp, ${relRows.length} ilişki.`);
  console.log("Tek kalan adım: yeni seed.sql'i Supabase SQL Editor'da çalıştır.");

  const missing = cp.discovered.length - Object.keys(cp.careers).length;
  if (missing > 0) {
    console.log(
      `\nUYARI: ${missing} oyuncu hâlâ eksik (muhtemelen bir grup geçici olarak başarısız oldu). ` +
        `Script'i BİR KEZ DAHA çalıştır — sadece bu eksikleri tamamlayacak, hızlı olur.`
    );
  }
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
