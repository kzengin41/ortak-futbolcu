const fs = require('fs');
const path = require('path');

const PLAYERS_FILE = path.join(__dirname, '../lib/players.json');
const POPULARITY_FILE = path.join(__dirname, '../lib/playerPopularity.json');

const now = new Date();
const end = now.toISOString().slice(0, 10).replace(/-/g, '') + '00';
now.setFullYear(now.getFullYear() - 1);
const start = now.toISOString().slice(0, 10).replace(/-/g, '') + '00';

async function fetchViews(project, title) {
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${project}/all-access/all-agents/${encodeURIComponent(title)}/monthly/${start}/${end}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'OrtakFutbolcu/1.0' } });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.items ? data.items.reduce((sum, item) => sum + item.views, 0) : 0;
  } catch (e) { return 0; }
}

async function updatePopularity() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  let popularity = {};
  if (fs.existsSync(POPULARITY_FILE)) popularity = JSON.parse(fs.readFileSync(POPULARITY_FILE, 'utf8'));
  console.log(`Starting popularity update for ${players.length} players...`);
  let processed = 0;
  let i = 0;
  
  async function worker() {
    while (i < players.length) {
      const p = players[i++];
      if (popularity[p.name] && popularity[p.name] > 0) {
        processed++; continue;
      }
      const title = p.name.replace(/ /g, '_');
      let views = await fetchViews('en.wikipedia.org', title) + await fetchViews('tr.wikipedia.org', title);
      if (views === 0) {
        views = await fetchViews('en.wikipedia.org', title + '_(footballer)');
      }
      popularity[p.name] = views;
      processed++;
      if (processed % 100 === 0) {
        console.log(`Processed ${processed} / ${players.length}`);
        fs.writeFileSync(POPULARITY_FILE, JSON.stringify(popularity, null, 2), 'utf8');
      }
    }
  }
  
  const workers = [];
  for (let w = 0; w < 10; w++) workers.push(worker());
  await Promise.all(workers);
  fs.writeFileSync(POPULARITY_FILE, JSON.stringify(popularity, null, 2), 'utf8');
  console.log('Update complete!');
}
updatePopularity();
