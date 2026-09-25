// ============================================================================
// "Kulüp & Ülke" modu için gerçek UYRUK verisi (milli takım kaydı DEĞİL).
//
// Kerem'in isteği: "hangi ülkeliyse o olsun mesela sacha boey-fransa, hiç
// milli takımda oynamamış olsa bile ismail çipe-türkiye gibi." Yani milli
// takımda hiç forma giymemiş oyuncular da (Wikipedia'nın nationalteamN
// alanı bunlarda BOŞ olur) kendi uyruklarıyla eşleşmeli.
//
// Kaynak: her Wikipedia futbolcu makalesinin en altındaki
// "[[Category:X footballers]]" / "[[Category:X expatriate footballers...]]"
// kategorisi — bu, oyuncunun MİLLİ TAKIM GEÇMİŞİNDEN BAĞIMSIZ, gerçek
// uyruğunu (Wikipedia'nın sınıflandırdığı haliyle) verir. Yaş grubu/altyapı
// ayrımı yok çünkü bu veri zaten caps'e değil, uyruğa dayanıyor.
//
// scripts/backfill_national_teams.js ile AYNI iskelet (checkpoint, batch,
// retry) kullanılıyor ama farklı bir alanı (kategori) okuyor ve sonucu
// AYRI bir dosyaya (lib/playerNationality.js) yazıyor — mevcut
// lib/playerNationalTeams.js'e DOKUNMUYOR (o veri başka yerlerde, örn.
// WhoAmI ipucunda hâlâ kullanılabilir).
//
// Çalıştırma:  node scripts/backfill_nationality.js
// ============================================================================

const fs = require("fs");
const path = require("path");

const WP_HEADERS = { "User-Agent": "ortak-futbolcu-oyunu/0.1 (kisisel proje; iletisim yok)" };
const CHECKPOINT_PATH = path.join(__dirname, ".nationality_checkpoint.json");
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

function normalizeTitle(t) {
  return (t || "").trim().replace(/_/g, " ").replace(/\s+/g, " ");
}
function titleToPlayerName(title) {
  return normalizeTitle(title).replace(/\s*\(footballer.*?\)\s*/gi, "").trim();
}

// Kategori metninden demonym'i çıkarır: "French footballers" -> "French",
// "German expatriate footballers in Turkey" -> "German",
// "20th-century Turkish footballers" -> "Turkish".
function extractDemonyms(wikitext) {
  const re = /\[\[Category:\s*(?:\d{2}(?:st|nd|rd|th)-century\s+)?([A-Za-z][A-Za-z\s]*?)\s+(?:expatriate\s+)?footballers\b/gi;
  const found = new Set();
  let m;
  while ((m = re.exec(wikitext))) {
    found.add(m[1].trim());
  }
  return [...found];
}

// Demonym -> lib/countries.json'daki kanonik ülke adı. Çoğu ülke standart
// "-ish/-an/-ese/-i" ekleriyle türetiliyor ama düzensiz olanlar (İngilizce
// demonym listesi) elle eşlenmesi gerekiyor — GÜNCEL FUTBOL ÜLKELERİNİN
// NEREDEYSE TAMAMI burada. Eksik bir tane çıkarsa DISCARDED listesine düşer,
// script sonunda raporlanır — o zaman buraya eklenir.
const DEMONYM_TO_COUNTRY = {
  Turkish: "Turkey", English: "England", German: "Germany", French: "France",
  Spanish: "Spain", Italian: "Italy", Portuguese: "Portugal", Dutch: "Netherlands",
  Belgian: "Belgium", Brazilian: "Brazil", Argentine: "Argentina", Argentinian: "Argentina",
  Uruguayan: "Uruguay", Croatian: "Croatia", Serbian: "Serbia", Polish: "Poland",
  Czech: "Czech Republic", Austrian: "Austria", Swiss: "Switzerland", Danish: "Denmark",
  Swedish: "Sweden", Norwegian: "Norway", Ukrainian: "Ukraine", Russian: "Russia",
  Soviet: "Russia", Greek: "Greece", Welsh: "Wales", Scottish: "Scotland",
  "Northern Irish": "Northern Ireland", Irish: "Republic of Ireland", Romanian: "Romania",
  Hungarian: "Hungary", Slovak: "Slovakia", Slovenian: "Slovenia",
  Bosnian: "Bosnia and Herzegovina", Herzegovinian: "Bosnia and Herzegovina",
  Montenegrin: "Montenegro", Macedonian: "North Macedonia", Albanian: "Albania",
  Bulgarian: "Bulgaria", Finnish: "Finland", Icelandic: "Iceland", Georgian: "Georgia",
  Armenian: "Armenia", Azerbaijani: "Azerbaijan", Israeli: "Israel", Kosovan: "Kosovo",
  Kosovar: "Kosovo", Cypriot: "Cyprus", Maltese: "Malta", Luxembourgish: "Luxembourg",
  Luxembourgian: "Luxembourg", Estonian: "Estonia", Latvian: "Latvia", Lithuanian: "Lithuania",
  Moldovan: "Moldova", Belarusian: "Belarus", Moroccan: "Morocco", Algerian: "Algeria",
  Tunisian: "Tunisia", Egyptian: "Egypt", Senegalese: "Senegal", Nigerian: "Nigeria",
  Ghanaian: "Ghana", Ivorian: "Ivory Coast", Cameroonian: "Cameroon", Malian: "Mali",
  "South African": "South Africa", Congolese: "DR Congo", Zambian: "Zambia",
  Guinean: "Guinea", "Burkinabé": "Burkina Faso", Burkinabe: "Burkina Faso",
  Gabonese: "Gabon", "Cape Verdean": "Cape Verde", Angolan: "Angola", Tanzanian: "Tanzania",
  Kenyan: "Kenya", Ugandan: "Uganda", "Equatorial Guinean": "Equatorial Guinea",
  Togolese: "Togo", Beninese: "Benin", Mauritanian: "Mauritania", Libyan: "Libya",
  Sudanese: "Sudan", Zimbabwean: "Zimbabwe", Mozambican: "Mozambique", Namibian: "Namibia",
  Motswana: "Botswana", Batswana: "Botswana", Comorian: "Comoros", Gambian: "Gambia",
  "Sierra Leonean": "Sierra Leone", Rwandan: "Rwanda", Nigerien: "Niger", Chadian: "Chad",
  Ethiopian: "Ethiopia", Liberian: "Liberia", Swazi: "Eswatini", Basotho: "Lesotho",
  Burundian: "Burundi", Malagasy: "Madagascar", Malawian: "Malawi", Mexican: "Mexico",
  American: "United States", Canadian: "Canada", Colombian: "Colombia", Chilean: "Chile",
  Peruvian: "Peru", Ecuadorian: "Ecuador", Ecuadorean: "Ecuador", Paraguayan: "Paraguay",
  Bolivian: "Bolivia", Venezuelan: "Venezuela", "Costa Rican": "Costa Rica",
  Jamaican: "Jamaica", Panamanian: "Panama", Honduran: "Honduras",
  Salvadoran: "El Salvador", Guatemalan: "Guatemala",
  "Trinidad and Tobago": "Trinidad and Tobago", Trinidadian: "Trinidad and Tobago",
  Haitian: "Haiti", "Curaçaoan": "Curaçao", Curacaoan: "Curaçao", Japanese: "Japan",
  "South Korean": "South Korea", Korean: "South Korea", Australian: "Australia",
  Saudi: "Saudi Arabia", "Saudi Arabian": "Saudi Arabia", Iranian: "Iran", Iraqi: "Iraq",
  Qatari: "Qatar", Emirati: "United Arab Emirates", Jordanian: "Jordan", Chinese: "China",
  Indian: "India", Kazakhstani: "Kazakhstan", Uzbekistani: "Uzbekistan", Uzbek: "Uzbekistan",
  "New Zealand": "New Zealand", Lebanese: "Lebanon", Syrian: "Syria", Kuwaiti: "Kuwait",
  Bahraini: "Bahrain", Omani: "Oman", Palestinian: "Palestine", Vietnamese: "Vietnam",
  Thai: "Thailand", Indonesian: "Indonesia", Malaysian: "Malaysia", "North Korean": "North Korea",
  Andorran: "Andorra", "Sammarinese": "San Marino", Liechtensteiner: "Liechtenstein",
  Gibraltarian: "Gibraltar", Faroese: "Faroe Islands", "Monégasque": "Monaco",
  Monegasque: "Monaco", Bahamian: "Bahamas", Barbadian: "Barbados", Cuban: "Cuba",
  Dominican: "Dominican Republic", "Puerto Rican": "Puerto Rico", Bermudian: "Bermuda",
  Bermudan: "Bermuda", Guyanese: "Guyana", Surinamese: "Suriname", Belizean: "Belize",
  Nicaraguan: "Nicaragua", Grenadian: "Grenada", "Saint Lucian": "Saint Lucia",
  Aruban: "Aruba", Caymanian: "Cayman Islands", "Antiguan": "Antigua and Barbuda",
  Fijian: "Fiji", "Papua New Guinean": "Papua New Guinea", Solomon: "Solomon Islands",
  "Ni-Vanuatu": "Vanuatu", Vanuatuan: "Vanuatu", Tahitian: "Tahiti",
  "New Caledonian": "New Caledonia", Samoan: "Samoa", Tongan: "Tonga",
  "American Samoan": "American Samoa", Guamanian: "Guam", Kyrgyzstani: "Kyrgyzstan",
  Kyrgyz: "Kyrgyzstan", Tajikistani: "Tajikistan", Turkmen: "Turkmenistan",
  Afghan: "Afghanistan", Mongolian: "Mongolia", Nepali: "Nepal", Nepalese: "Nepal",
  Bangladeshi: "Bangladesh", Pakistani: "Pakistan", "Sri Lankan": "Sri Lanka",
  Burmese: "Myanmar", Cambodian: "Cambodia", Laotian: "Laos", Bruneian: "Brunei",
  Filipino: "Philippines", Singaporean: "Singapore", Maldivian: "Maldives",
  Bhutanese: "Bhutan", "East Timorese": "East Timor", "Hong Kong": "Hong Kong",
  Taiwanese: "Chinese Taipei", Macanese: "Macau", Yemeni: "Yemen", Somali: "Somalia",
  Djiboutian: "Djibouti", Eritrean: "Eritrea", "South Sudanese": "South Sudan",
  "Central African": "Central African Republic", "Sao Tomean": "São Tomé and Príncipe",
  "São Toméan": "São Tomé and Príncipe", Seychellois: "Seychelles", Mauritian: "Mauritius",
  "Guinea-Bissauan": "Guinea-Bissau", Bissau: "Guinea-Bissau", Martiniquais: "Martinique",
  Guadeloupean: "Guadeloupe", "East German": "East Germany",
  "West German": "Germany", Yugoslav: "Serbia",
};

async function fetchBatch(wikiTitles) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&formatversion=2&format=json&titles=" +
    wikiTitles.map(encodeURIComponent).join("|");
  const data = await fetchWithRetry(url);
  const pages = data?.query?.pages || [];
  const byTitle = {};
  for (const page of pages) {
    const wikitext = page?.revisions?.[0]?.slots?.main?.content;
    byTitle[normalizeTitle(page.title)] = wikitext ? extractDemonyms(wikitext) : [];
  }
  return byTitle;
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { titles: null, demonyms: {} };
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
    // Aynı oyuncu başlık listesini backfill_national_teams.js'in kullandığı
    // checkpoint'lerden alıyoruz — tekrar keşif yapmaya gerek yok.
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
  console.log(`Toplam ${cp.titles.length} oyuncu için uyruk bilgisi çekilecek.`);

  const todo = cp.titles.filter((t) => !(normalizeTitle(t) in cp.demonyms));
  const totalBatches = Math.ceil(todo.length / WP_BATCH_SIZE);
  console.log(`${todo.length} oyuncu kaldı, ${totalBatches} grup halinde (${Object.keys(cp.demonyms).length} zaten tamam)...`);

  for (let i = 0; i < todo.length; i += WP_BATCH_SIZE) {
    const batch = todo.slice(i, i + WP_BATCH_SIZE);
    const batchNum = i / WP_BATCH_SIZE + 1;
    try {
      const byTitle = await fetchBatch(batch);
      for (const t of batch) {
        const key = normalizeTitle(t);
        cp.demonyms[key] = byTitle[key] || [];
      }
      console.log(`  grup ${batchNum}/${totalBatches} tamam`);
    } catch (err) {
      console.log(`  grup ${batchNum}/${totalBatches} başarısız: ${err.message} — tekrar çalıştırınca yeniden denenir`);
    }
    saveCheckpoint(cp);
    await new Promise((r) => setTimeout(r, 500));
  }

  // ---- Demonym -> kanonik ülke, sadece countries.json'da GERÇEK olanlar ----
  const countriesPath = path.join(__dirname, "..", "lib", "countries.json");
  const COUNTRIES = JSON.parse(fs.readFileSync(countriesPath, "utf8"));
  const VALID_COUNTRIES = new Set(Object.keys(COUNTRIES));

  const nationalityByName = {};
  let matched = 0;
  let discardedUnknown = 0;
  const discardedCounts = {};

  for (const [title, demonyms] of Object.entries(cp.demonyms)) {
    if (!demonyms || demonyms.length === 0) continue;
    // Bir oyuncunun genelde tek bir uyruğu olur — birden fazla demonym
    // çıkarsa (nadiren, ör. çifte vatandaşlık kategorisi) hepsini tutuyoruz,
    // ekranda ilk eşleşen kullanılacak.
    const canonicalList = [];
    for (const d of demonyms) {
      const canonical = DEMONYM_TO_COUNTRY[d];
      if (canonical && VALID_COUNTRIES.has(canonical)) {
        if (!canonicalList.includes(canonical)) canonicalList.push(canonical);
      } else {
        discardedUnknown++;
        discardedCounts[d] = (discardedCounts[d] || 0) + 1;
      }
    }
    if (canonicalList.length === 0) continue;
    const name = titleToPlayerName(title);
    if (!nationalityByName[name]) {
      nationalityByName[name] = canonicalList;
      matched++;
    }
  }

  const libDir = path.join(__dirname, "..", "lib");
  fs.writeFileSync(
    path.join(libDir, "playerNationality.js"),
    `// Her oyuncunun GERÇEK UYRUĞU (milli takım kaydından BAĞIMSIZ) —\n` +
      `// Wikipedia'nın "[[Category:X footballers]]" sınıflandırmasından çıkarıldı.\n` +
      `// scripts/backfill_nationality.js. Milli takım geçmişi (caps) için\n` +
      `// hâlâ lib/playerNationalTeams.js kullanılıyor — bu, o değil, sadece uyruk.\n` +
      `export const PLAYER_NATIONALITY = ${JSON.stringify(nationalityByName)};\n`
  );

  console.log(`\nBİTTİ: ${matched} oyuncu için uyruk bilgisi lib/playerNationality.js'e yazıldı (toplam ${cp.titles.length} oyuncudan).`);
  if (discardedUnknown > 0) {
    console.log(`(${discardedUnknown} tanınmayan demonym atıldı — en sık geçen 30 tanesi, DEMONYM_TO_COUNTRY'ye eklenmesi gerekebilir:)`);
    const top = Object.entries(discardedCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
    for (const [val, count] of top) console.log(`   ${count}x  "${val}"`);
  }
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
