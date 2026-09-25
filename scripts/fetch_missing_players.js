const fs = require('fs');
const path = require('path');

const PLAYERS_FILE = path.join(__dirname, '../lib/players.json');

const CLUBS = [
  { id: 'Q172073', name: 'Galatasaray' },
  { id: 'Q190224', name: 'Fenerbahçe' },
  { id: 'Q172567', name: 'Beşiktaş' },
  { id: 'Q128367', name: 'Trabzonspor' },
  { id: 'Q8682', name: 'Real Madrid' },
  { id: 'Q7156', name: 'Barcelona' },
  { id: 'Q15789', name: 'Bayern Munich' },
  { id: 'Q18656', name: 'Manchester United' },
  { id: 'Q50602', name: 'Manchester City' },
  { id: 'Q1130843', name: 'Liverpool' },
  { id: 'Q483020', name: 'Paris Saint-Germain' },
  { id: 'Q1422', name: 'Juventus' },
  { id: 'Q1543', name: 'AC Milan' },
  { id: 'Q13365', name: 'Inter Milan' }
];

async function fetchClubPlayers(club) {
  console.log(`\nFetching ALL players for ${club.name}...`);
  // Modified query to get player ID as well
  const query = `
    SELECT ?player ?playerLabel
    WHERE {
      ?player wdt:P106/wdt:P279* wd:Q937857 .
      ?player wdt:P54 wd:${club.id} .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr". }
    }
  `;
  
  const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(query) + '&format=json';
  let retries = 3;
  while (retries > 0) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'OrtakFutbolcuBot/2.0', 'Accept': 'application/json' } });
      if (!res.ok) {
        console.log(`Failed to fetch ${club.name}. Status: ${res.status}. Retrying...`);
        retries--;
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      const data = await res.json();
      return data.results.bindings.map(b => ({
        id: b.player.value.split('/').pop(),
        name: b.playerLabel.value
      }));
    } catch(e) {
      console.error(`Error fetching ${club.name}:`, e.message);
      retries--;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  return [];
}

async function fetchClubsForPlayers(playerIds) {
  // Batch query to get all clubs for a list of player IDs
  const values = playerIds.map(id => `wd:${id}`).join(' ');
  const query = `
    SELECT ?player ?clubLabel
    WHERE {
      VALUES ?player { ${values} }
      ?player wdt:P54 ?club .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr". }
    }
  `;
  
  const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(query) + '&format=json';
  
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'OrtakFutbolcuBot/2.0', 'Accept': 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results.bindings.map(b => ({
      playerId: b.player.value.split('/').pop(),
      clubName: b.clubLabel.value
    }));
  } catch(e) {
    return [];
  }
}

async function main() {
  const existingPlayers = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  const existingNames = new Set(existingPlayers.map(p => p.name.toLowerCase()));
  
  let newlyAdded = [];
  
  for (const club of CLUBS) {
    const players = await fetchClubPlayers(club);
    
    // Filter missing
    const missingPlayers = players.filter(p => {
      if (p.name.startsWith('Q') && !isNaN(p.name.slice(1))) return false;
      return !existingNames.has(p.name.toLowerCase());
    });
    
    console.log(`${club.name} için eksik oyuncu sayısı: ${missingPlayers.length}. Verileri çekiliyor...`);
    
    // Batch fetch their clubs (50 at a time)
    const BATCH_SIZE = 50;
    for (let i = 0; i < missingPlayers.length; i += BATCH_SIZE) {
      const batch = missingPlayers.slice(i, i + BATCH_SIZE);
      const batchIds = batch.map(p => p.id);
      
      const clubData = await fetchClubsForPlayers(batchIds);
      
      // Group clubs by player ID
      const playerClubs = {};
      for (const row of clubData) {
        if (!playerClubs[row.playerId]) playerClubs[row.playerId] = new Set();
        // Remove standard suffixes to match our database format
        let cleanClub = row.clubName.replace(/ F\.C\.| S\.K\.| J\.K\.| A\.S\.| FC| CF/g, '').trim();
        playerClubs[row.playerId].add(cleanClub);
      }
      
      // Add to newlyAdded array
      for (const p of batch) {
        const clubs = Array.from(playerClubs[p.id] || [club.name]); // Fallback to at least the searched club
        const newPlayer = { name: p.name, clubs: clubs };
        newlyAdded.push(newPlayer);
        existingNames.add(p.name.toLowerCase()); // Avoid adding same player again from another club
        console.log(`+ Eklendi: ${p.name} (${clubs.length} kulüp)`);
      }
      
      await new Promise(r => setTimeout(r, 2000)); // Respect limits
    }
  }
  
  if (newlyAdded.length > 0) {
    const combined = [...existingPlayers, ...newlyAdded];
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(combined, null, 2), 'utf8');
    console.log(`\nHarika! Toplam ${newlyAdded.length} YENİ futbolcu başarıyla veritabanına eklendi!`);
  } else {
    console.log(`\nEklenecek yeni futbolcu bulunamadı.`);
  }
}

main();
