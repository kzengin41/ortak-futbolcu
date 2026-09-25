// ============================================================================
// API-Football'dan (profesyonel, ücretli/ücretsiz katmanlı, doğrulanmış spor
// verisi — dashboard.api-football.com) hedef liglerdeki oyuncuların GERÇEK
// transfer geçmişini çeker. Wikidata'nın aksine bu bir spor verisi şirketi,
// kurumsal olarak bakımı yapılıyor.
//
// KESİNTİ-DAYANIKLI: İlerleme scripts/.api_football_checkpoint.json'a
// kaydediliyor. Günlük istek kotan dolarsa (ücretsiz planda 100/gün) script
// kendini düzgünce durdurur, ertesi gün tekrar çalıştırdığında KALDIĞI
// YERDEN devam eder — hiçbir şeyi tekrar çekmez.
//
// ÖNEMLİ: Bu script benim (Claude) ortamımda API-Football'a ağ erişimim
// olmadığı ve senin API key'in olmadığı için CANLI TEST EDİLMEDEN yazıldı.
// Lig ID'leri (Süper Lig=203, Premier League=39, La Liga=140, Serie A=135,
// Bundesliga=78, Ligue 1=61, Şampiyonlar Ligi=2) API-Football'ın genel
// bilinen ID'leri — %100 garanti değil. İLK ÇALIŞTIRMADA önce
// TEST_MODE=true ile (aşağıda) SADECE 1 lig/1 sezonla dene, çıktıyı bana
// göster, ID'ler doğruysa TEST_MODE=false yapıp tam çekime geç.
//
// Kurulum:
//   1) dashboard.api-football.com/register — ücretsiz hesap aç (kart istemiyor)
//   2) Account → My Access'ten API key'ini kopyala
//   3) Terminalde: set API_FOOTBALL_KEY=senin-keyin   (Windows cmd)
//      ya da:      $env:API_FOOTBALL_KEY="senin-keyin" (PowerShell)
//   4) node scripts/fetch_api_football.js
//
// Ücretsiz plandaysan DAILY_BUDGET'i 90 civarında bırak (100 sınırının
// altında, güvenlik payı). Pro plana geçersen 7000 gibi bir değere çıkar.
// ============================================================================

const fs = require("fs");
const path = require("path");

const TEST_MODE = true; // İlk çalıştırmada true bırak — sadece Süper Lig, 1 sezon çeker
const DAILY_BUDGET = Number(process.env.API_FOOTBALL_DAILY_BUDGET || 90);
const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

if (!API_KEY) {
  console.error("API_FOOTBALL_KEY ortam değişkeni ayarlı değil. Yukarıdaki kurulum adımlarına bak.");
  process.exit(1);
}

const ALL_LEAGUES = [
  { id: 203, name: "Süper Lig" },
  { id: 39, name: "Premier League" },
  { id: 140, name: "La Liga" },
  { id: 135, name: "Serie A" },
  { id: 78, name: "Bundesliga" },
  { id: 61, name: "Ligue 1" },
  { id: 2, name: "Şampiyonlar Ligi" },
];

const ALL_SEASONS = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];

const LEAGUES = TEST_MODE ? [ALL_LEAGUES[0]] : ALL_LEAGUES;
const SEASONS = TEST_MODE ? [ALL_SEASONS[0]] : ALL_SEASONS;

const CHECKPOINT_PATH = path.join(__dirname, ".api_football_checkpoint.json");

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) {
    return { donePlayerLists: [], players: {}, doneTransfers: [] };
  }
  return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8"));
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp));
}

let requestsUsed = 0;
function budgetLeft() {
  return DAILY_BUDGET - requestsUsed;
}

async function apiGet(endpoint, params) {
  if (budgetLeft() <= 0) return null; // günlük kota bitti, çağıran taraf bunu kontrol eder
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${endpoint}?${qs}`;
  const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  requestsUsed++;
  if (!res.ok) throw new Error(`API-Football ${res.status} ${res.statusText} — ${endpoint}`);
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football hata döndü: ${JSON.stringify(data.errors)}`);
  }
  // Küçük bir bekleme — API-Football dakikada da istek sınırlıyor
  await new Promise((r) => setTimeout(r, 600));
  return data;
}

async function main() {
  const cp = loadCheckpoint();
  console.log(`Checkpoint yüklendi: ${Object.keys(cp.players).length} oyuncu, ${cp.doneTransfers.length} transfer geçmişi tamamlanmış.`);
  console.log(`Bu çalıştırmada bütçe: ${DAILY_BUDGET} istek.${TEST_MODE ? " (TEST_MODE açık — sadece " + LEAGUES[0].name + " " + SEASONS[0] + ")" : ""}`);

  // ---- Aşama 1: hedef lig/sezonlardaki oyuncu listeleri ----
  for (const league of LEAGUES) {
    for (const season of SEASONS) {
      const key = `${league.id}-${season}`;
      if (cp.donePlayerLists.includes(key)) continue;
      if (budgetLeft() <= 0) {
        console.log("Günlük bütçe bitti (oyuncu listesi aşamasında). Yarın tekrar çalıştır, kaldığı yerden devam eder.");
        saveCheckpoint(cp);
        return;
      }
      console.log(`${league.name} ${season} oyuncu listesi çekiliyor...`);
      let page = 1;
      let totalPages = 1;
      do {
        if (budgetLeft() <= 0) break;
        const data = await apiGet("/players", { league: league.id, season, page });
        if (!data) break;
        totalPages = data.paging?.total || 1;
        for (const item of data.response || []) {
          const p = item.player;
          if (!p?.id || !p?.name) continue;
          if (!cp.players[p.id]) cp.players[p.id] = { name: p.name, clubs: [] };
        }
        console.log(`  sayfa ${page}/${totalPages}`);
        page++;
      } while (page <= totalPages);

      if (page > totalPages) {
        cp.donePlayerLists.push(key);
        saveCheckpoint(cp);
      }
    }
  }

  if (budgetLeft() <= 0) {
    console.log("Günlük bütçe bitti. Yarın tekrar çalıştır.");
    return;
  }

  // ---- Aşama 2: her oyuncunun GERÇEK transfer geçmişi ----
  const playerIds = Object.keys(cp.players);
  console.log(`\nAşama 2: ${playerIds.length} oyuncunun transfer geçmişi çekilecek (${cp.doneTransfers.length} zaten tamam).`);

  for (const id of playerIds) {
    if (cp.doneTransfers.includes(id)) continue;
    if (budgetLeft() <= 0) {
      console.log("Günlük bütçe bitti (transfer aşamasında). Yarın tekrar çalıştır, kaldığı yerden devam eder.");
      saveCheckpoint(cp);
      printSummary(cp);
      return;
    }
    try {
      const data = await apiGet("/transfers", { player: id });
      const transfers = data?.response?.[0]?.transfers || [];
      const clubs = new Set(cp.players[id].clubs);
      for (const t of transfers) {
        if (t.teams?.in?.name) clubs.add(t.teams.in.name);
        if (t.teams?.out?.name) clubs.add(t.teams.out.name);
      }
      cp.players[id].clubs = [...clubs];
      cp.doneTransfers.push(id);
      if (cp.doneTransfers.length % 25 === 0) {
        saveCheckpoint(cp);
        console.log(`  ${cp.doneTransfers.length}/${playerIds.length} oyuncu tamamlandı`);
      }
    } catch (err) {
      console.log(`  ${cp.players[id].name} (id ${id}) başarısız: ${err.message} — atlanıyor, sonraki çalıştırmada tekrar denenir`);
    }
  }

  saveCheckpoint(cp);
  printSummary(cp);
  writeOutput(cp);
}

function printSummary(cp) {
  const withMultipleClubs = Object.values(cp.players).filter((p) => p.clubs.length >= 2).length;
  console.log(`\nDurum: ${Object.keys(cp.players).length} oyuncu, ${cp.doneTransfers.length} transfer geçmişi çekilmiş, ${withMultipleClubs} tanesi 2+ kulüplü.`);
}

function writeOutput(cp) {
  const finalPlayers = Object.values(cp.players)
    .filter((p) => p.clubs.length >= 2)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  if (finalPlayers.length === 0) {
    console.log("Henüz 2+ kulüplü oyuncu yok, lib/players.js YAZILMADI (aşama 2 tamamlanmadan anlamlı değil).");
    return;
  }

  const libDir = path.join(__dirname, "..", "lib");
  fs.writeFileSync(
    path.join(libDir, "players.js"),
    `// API-Football'dan otomatik üretildi — scripts/fetch_api_football.js\n` +
      `export const PLAYERS = ${JSON.stringify(finalPlayers, null, 2)};\n`
  );
  console.log(`\nlib/players.js yazıldı: ${finalPlayers.length} oyuncu.`);
  console.log("NOT: lig/ülke metadata (lib/clubs.js) ve seed.sql henüz bu script'te yok —");
  console.log("aşama 2 tamamen bitip test ettiğinde birlikte ekleyeceğiz.");
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
