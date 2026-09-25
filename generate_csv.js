const fs = require('fs');
const path = require('path');

const players = require('./lib/players.json');
let views = {};
try { views = require('./lib/playerPopularity.json'); } catch(e){}
let photos = {};
try { photos = require('./lib/playerPhotos.json'); } catch(e){}
let years = {};
try { years = require('./lib/playerYears.json'); } catch(e){}

const MEGA = ["Galatasaray", "Fenerbahçe", "Beşiktaş", "Real Madrid", "Barcelona", "Bayern Munich", "Manchester United", "Manchester City", "Liverpool", "Paris Saint-Germain"];
const BIG = ["Trabzonspor", "Chelsea", "Arsenal", "Juventus", "AC Milan", "Inter Milan", "Internazionale", "Atletico Madrid", "Borussia Dortmund", "Napoli"];

function normalizeClubName(n) {
  return n.replace(/ı/g, "i").replace(/İ/g, "i").toLowerCase().replace(/\s+(j\.?\s?k\.?|s\.?\s?k\.?|f\.?\s?k\.?|a\.?\s?ş\.?|gsk|f\.?\s?c\.?|c\.?\s?f\.?|a\.?\s?f\.?\s?c\.?)\.?$/i, "").trim();
}

const MEGA_SET = new Set(MEGA.map(normalizeClubName));
const BIG_SET = new Set(BIG.map(normalizeClubName));
// We won't perfectly match WEIGHT_KNOWN since we don't import big5ClubTiers, but we can do a good approximation
// Or we just give 20 to everything that's not MEGA/BIG.

const CURRENT_YEAR = new Date().getFullYear();

const enrichedPlayers = [];

for (const p of players) {
  let score = 0;
  let source = '';
  
  const v = views[p.name] || 0;
  
  if (v > 0) {
    score = Math.max(0, Math.min(100, (Math.log10(v) - 3) * 25));
    source = 'Wikipedia (' + v + ' views)';
  } else {
    source = 'Fallback';
    let maxClubW = 5;
    for (const c of p.clubs) {
      const norm = normalizeClubName(c);
      if (MEGA_SET.has(norm)) { maxClubW = 50; break; }
      if (BIG_SET.has(norm) && maxClubW < 35) { maxClubW = 35; }
    }
    score += maxClubW;
    
    if (photos[p.name]) score += 30;
    
    const lastActive = years[p.name];
    if (lastActive) {
      const age = CURRENT_YEAR - lastActive;
      if (age <= 5) score += 20;
      else if (age <= 10) score += 10;
      else if (age <= 15) score += 5;
    }
  }
  
  enrichedPlayers.push({
    name: p.name,
    score: Math.floor(score),
    views: v,
    source: source,
    photo: photos[p.name] ? 'Var' : 'Yok',
    clubs: p.clubs.join(' | ')
  });
}

enrichedPlayers.sort((a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  return b.views - a.views;
});

let csv = '\uFEFF'; // BOM for UTF-8 Excel compatibility
csv += 'Sıra,Oyuncu,Zorluk/Popülerlik Skoru (0-100),Veri Kaynağı,Fotoğraf Durumu,Kulüpler\n';

for (let i = 0; i < enrichedPlayers.length; i++) {
  const p = enrichedPlayers[i];
  // Escape quotes in clubs
  const clubsEscaped = '"' + p.clubs.replace(/"/g, '""') + '"';
  const sourceEscaped = '"' + p.source.replace(/"/g, '""') + '"';
  
  csv += `${i+1},"${p.name}",${p.score},${sourceEscaped},${p.photo},${clubsEscaped}\n`;
}

fs.writeFileSync('tum_futbolcular_sirali.csv', csv, 'utf8');
console.log('CSV created: tum_futbolcular_sirali.csv');
