// ============================================================================
// Wikipedia'nın "Category:Süper Lig clubs" (doğrulanmış, 66 üye) ve TFF 1. Lig
// eşdeğeri kategorisinden BUGÜNE KADAR o liglerde oynamış tüm kulüplerin
// listesini çeker — sadece bu sezonki değil, tarihsel. Bu liste
// lib/leaguePresets.js'teki "Türkiye (Üst 2 Lig)" ön ayarının kapsamını
// belirliyor.
//
// TFF 1. Lig kategorisinin TAM adını doğrulayamadım (birkaç olası ad
// deniyorum, hangisi tutarsa onu kullanıyorum) — script çalışınca sonucu
// göreceğiz, 0 kulüp bulunursa bana haber ver, birlikte doğru adı buluruz.
//
// Çalıştırma:  node scripts/fetch_club_tiers.js
// ============================================================================

const fs = require("fs");
const path = require("path");

const WP_HEADERS = { "User-Agent": "ortak-futbolcu-oyunu/0.1 (kisisel proje; iletisim yok)" };

const TIER2_CATEGORY_CANDIDATES = [
  "TFF First League clubs",
  "TFF 1. Lig clubs",
  "Turkish Football Federation First League clubs",
  "TFF First League football clubs",
];

async function fetchCategoryMembers(categoryTitle) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=" +
    encodeURIComponent("Category:" + categoryTitle) +
    "&cmlimit=500&format=json";
  const res = await fetch(url, { headers: WP_HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  return (data.query?.categorymembers || []).map((m) => m.title);
}

function normalizeClubName(title) {
  return title
    .replace(/\s*\(football\)\s*/gi, "")
    .replace(/\s*\((men's|women's) football\)\s*/gi, "")
    .replace(/\s+(S\.K\.|F\.K\.|A\.Ş\.|J\.K\.|SK|FK|GSK)\.?$/i, "")
    .trim();
}

async function main() {
  console.log("Süper Lig kulüpleri kategorisi çekiliyor...");
  const tier1Raw = await fetchCategoryMembers("Süper Lig clubs");
  console.log(`${tier1Raw.length} kulüp bulundu (Süper Lig, tüm zamanlar).`);

  let tier2Raw = [];
  for (const candidate of TIER2_CATEGORY_CANDIDATES) {
    try {
      const result = await fetchCategoryMembers(candidate);
      if (result.length > 0) {
        console.log(`TFF 1. Lig kategorisi bulundu: "${candidate}" — ${result.length} kulüp.`);
        tier2Raw = result;
        break;
      }
    } catch {
      // sıradaki adayı dene
    }
  }
  if (tier2Raw.length === 0) {
    console.log(
      "UYARI: TFF 1. Lig kategorisi bulunamadı (denenen adların hiçbiri tutmadı). " +
        "Sadece Süper Lig ile devam ediyorum. Bunu bana söyle, doğru kategori adını birlikte buluruz."
    );
  }

  const superLig = [...new Set(tier1Raw.map(normalizeClubName))].sort();
  const top2 = [...new Set([...tier1Raw, ...tier2Raw].map(normalizeClubName))].sort();

  console.log("\nÖrnek (ilk 15, kontrol için):");
  superLig.slice(0, 15).forEach((c) => console.log(`  ${c}`));

  const content =
    `// Wikipedia kategorilerinden otomatik üretildi — scripts/fetch_club_tiers.js\n` +
    `export const SUPER_LIG_CLUBS = ${JSON.stringify(superLig, null, 2)};\n` +
    `export const TOP2_TIER_CLUBS = ${JSON.stringify(top2, null, 2)};\n`;
  fs.writeFileSync(path.join(__dirname, "..", "lib", "clubTiers.js"), content);

  console.log(`\nlib/clubTiers.js yazıldı: ${superLig.length} Süper Lig, ${top2.length} toplam (üst 2 lig) kulüp.`);
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
