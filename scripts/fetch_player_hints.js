const fs = require('fs');
const path = require('path');

const PLAYERS_FILE = path.join(__dirname, '../lib/players.json');
let POPULARITY_FILE = path.join(__dirname, '../lib/playerPopularity.json');
const HINTS_FILE = path.join(__dirname, '../lib/playerHints.json');

async function fetchWikiSummary(playerName) {
  const title = encodeURIComponent(playerName.replace(/ /g, '_'));
  
  try {
    let res = await fetch(`https://tr.wikipedia.org/api/rest_v1/page/summary/${title}`, { headers: { 'User-Agent': 'OrtakFutbolcuBot/7.0' } });
    if (res.status === 429) {
      console.log('Wikipedia TR Rate Limit! Bekleniyor (60 saniye)...');
      await new Promise(r => setTimeout(r, 60000));
      res = await fetch(`https://tr.wikipedia.org/api/rest_v1/page/summary/${title}`, { headers: { 'User-Agent': 'OrtakFutbolcuBot/7.0' } });
    }
    
    if (res.ok) {
      let data = await res.json();
      if (data.extract) return data.extract;
    }
    
    // Fallback: (futbolcu)
    let res2 = await fetch(`https://tr.wikipedia.org/api/rest_v1/page/summary/${title}_(futbolcu)`, { headers: { 'User-Agent': 'OrtakFutbolcuBot/7.0' } });
    if (res2.status === 429) {
      await new Promise(r => setTimeout(r, 60000));
      res2 = await fetch(`https://tr.wikipedia.org/api/rest_v1/page/summary/${title}_(futbolcu)`, { headers: { 'User-Agent': 'OrtakFutbolcuBot/7.0' } });
    }
    if (res2.ok) {
      let data2 = await res2.json();
      if (data2.extract) return data2.extract;
    }
    
    return null;
  } catch(e) {
    return null;
  }
}

function censorName(text, playerName) {
  // Futbolcunun ismini ve soyismini metin içinden gizler.
  // Örn: "Arda Turan, Galatasaray'da oynadı" -> "Bu oyuncu, Galatasaray'da oynadı"
  const parts = playerName.split(' ');
  let censored = text;
  
  // Tam ismi gizle
  const fullRegex = new RegExp(playerName, 'gi');
  censored = censored.replace(fullRegex, 'Bu oyuncu');
  
  // Soyismi (veya diğer parçaları) gizle
  for (const part of parts) {
    if (part.length > 2) {
      const partRegex = new RegExp(part, 'gi');
      censored = censored.replace(partRegex, '***');
    }
  }
  
  return censored;
}

async function main() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  
  let popularity = {};
  if (fs.existsSync(POPULARITY_FILE)) {
    popularity = JSON.parse(fs.readFileSync(POPULARITY_FILE, 'utf8'));
  }
  
  let hints = {};
  if (fs.existsSync(HINTS_FILE)) {
    hints = JSON.parse(fs.readFileSync(HINTS_FILE, 'utf8'));
  }
  
  // Popülerliğe göre sırala (Önce en ünlü 1000 oyuncunun ipuçlarını bulalım)
  const sortedPlayers = players.map(p => ({
    name: p.name,
    views: popularity[p.name] || 0
  })).sort((a, b) => b.views - a.views);
  
  // Sadece en popüler 2000 oyuncu için ipucu arayacağız (Kim Bu modunda genelde bunlar çıkar)
  const targetPlayers = sortedPlayers.slice(0, 2000);
  
  const missing = targetPlayers.filter(p => !hints[p.name]);
  console.log(`Top 2000 oyuncudan ${missing.length} tanesinin ipucu (hikayesi) eksik. Wikipedia'dan çekiliyor...`);
  
  let newlyFound = 0;
  for (let i = 0; i < missing.length; i++) {
    const p = missing[i];
    
    const summary = await fetchWikiSummary(p.name);
    
    if (summary) {
      const censored = censorName(summary, p.name);
      hints[p.name] = censored;
      newlyFound++;
      console.log(`[${i+1}/${missing.length}] [+] İpucu bulundu: ${p.name}`);
    } else {
      console.log(`[${i+1}/${missing.length}] [-] TR Wikipedia'da sayfası yok: ${p.name}`);
      hints[p.name] = "YOK"; // Tekrar aramaması için işaretle
    }
    
    if ((i+1) % 25 === 0) {
      fs.writeFileSync(HINTS_FILE, JSON.stringify(hints, null, 2), 'utf8');
      console.log(`--- İlerlemeler Kaydedildi ---`);
    }
    
    // Wikipedia API'sini yormamak için her istek arası 1 saniye bekle
    await new Promise(r => setTimeout(r, 1000));
  }
  
  fs.writeFileSync(HINTS_FILE, JSON.stringify(hints, null, 2), 'utf8');
  console.log(`Bitti! Toplam ${newlyFound} yeni hikaye ipucu bulundu.`);
}

main();
