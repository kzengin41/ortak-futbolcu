import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Very basic club weighting just for ranking inside this script
function getPop(clubs) {
  let score = 0;
  for (const c of clubs) {
    if (["Real Madrid", "Barcelona", "Bayern Munich", "Manchester United", "Juventus", "Galatasaray", "Fenerbahçe", "Beşiktaş", "Paris Saint-Germain", "Milan", "Inter Milan"].includes(c)) score += 100;
    else if (["Chelsea", "Arsenal", "Liverpool", "Manchester City", "Atlético Madrid", "Borussia Dortmund"].includes(c)) score += 80;
    else score += 10;
  }
  return score;
}

async function run() {
  const wikiFile = path.join(__dirname, '.wikipedia_careers_checkpoint.json');
  const wikiData = JSON.parse(fs.readFileSync(wikiFile, 'utf8'));
  const careers = wikiData.careers || {};

  let list = [];
  for (const [qId, data] of Object.entries(careers)) {
    const pop = getPop(data.clubs || []);
    list.push({ qId, name: data.name, pop });
  }

  // Sort and take top 1000
  list.sort((a,b) => b.pop - a.pop);
  const top1000 = list.slice(0, 1000);
  console.log(`fetching for top ${top1000.length} players...`);

  const BATCH_SIZE = 50;
  let achievementsMap = {};

  for (let i = 0; i < top1000.length; i += BATCH_SIZE) {
    const batch = top1000.slice(i, i + BATCH_SIZE);
    const qIds = batch.map(x => `wd:${x.qId}`).join(' ');
    
    console.log(`Processing batch ${i / BATCH_SIZE + 1} / ${Math.ceil(top1000.length / BATCH_SIZE)}...`);

    const query = `
      SELECT ?person ?personLabel ?awardLabel WHERE {
        VALUES ?person { ${qIds} }
        { ?person wdt:P166 ?award . }
        UNION
        { ?person wdt:P1346 ?award . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en". }
      }
    `;

    const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(query) + "&format=json";
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'OrtakFutbolcu/1.0 (Contact: myemail@example.com)' } });
      if (!res.ok) {
        console.log(`Error ${res.status}`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      const data = await res.json();
      
      for (const item of data.results.bindings) {
        const qId = item.person.value.split('/').pop();
        const award = item.awardLabel.value;
        
        const playerObj = batch.find(x => x.qId === qId);
        if (!playerObj) continue;
        const name = playerObj.name;
        
        if (!achievementsMap[name]) achievementsMap[name] = new Set();
        achievementsMap[name].add(award);
      }
    } catch (err) {
      console.log('Fetch error:', err.message);
    }
    
    // Sleep to respect rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  const finalMap = {};
  for (const [name, awardsSet] of Object.entries(achievementsMap)) {
    const cleanAwards = Array.from(awardsSet).filter(a => {
      const lower = a.toLowerCase();
      if (lower.includes('order of') || lower.includes('badge') || lower.match(/^q[0-9]+$/)) return false;
      return true;
    });
    if (cleanAwards.length > 0) {
      finalMap[name] = cleanAwards;
    }
  }

  console.log(`Fetched achievements for ${Object.keys(finalMap).length} players.`);
  
  const outFile = path.join(__dirname, '../lib/playerAchievements.json');
  fs.writeFileSync(outFile, JSON.stringify(finalMap, null, 2), 'utf8');
  
  const jsOutFile = path.join(__dirname, '../lib/playerAchievements.js');
  fs.writeFileSync(jsOutFile, `export const PLAYER_ACHIEVEMENTS = require('./playerAchievements.json');`, 'utf8');
  
  console.log('Done!');
}

run();
