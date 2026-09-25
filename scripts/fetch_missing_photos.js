const fs = require('fs');
const path = require('path');

const PLAYERS_FILE = path.join(__dirname, '../lib/players.json');
const PHOTOS_FILE = path.join(__dirname, '../lib/playerPhotos.json');

function cleanAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function fetchTheSportsDB(playerName) {
  try {
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(playerName)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.player && data.player.length > 0) {
      return data.player[0].strCutout || data.player[0].strThumb || data.player[0].strRender || null;
    }
  } catch(e) {}
  
  const noAccents = cleanAccents(playerName);
  if (noAccents !== playerName) {
    try {
      const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(noAccents)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.player && data.player.length > 0) {
        return data.player[0].strCutout || data.player[0].strThumb || data.player[0].strRender || null;
      }
    } catch(e) {}
  }
  return null;
}

async function fetchWikiPhoto(playerName) {
  const title = encodeURIComponent(playerName.replace(/ /g, '_'));
  try {
    let res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { headers: { 'User-Agent': 'OrtakFutbolcuBot/3.0' } });
    if (res.status === 429) {
       await new Promise(r => setTimeout(r, 10000));
       res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { headers: { 'User-Agent': 'OrtakFutbolcuBot/3.0' } });
    }
    if (res.ok) {
      let data = await res.json();
      if (data.thumbnail && data.thumbnail.source) return data.thumbnail.source;
    }
    
    let res2 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}_(footballer)`, { headers: { 'User-Agent': 'OrtakFutbolcuBot/3.0' } });
    if (res2.status === 429) {
       await new Promise(r => setTimeout(r, 10000));
       res2 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}_(footballer)`, { headers: { 'User-Agent': 'OrtakFutbolcuBot/3.0' } });
    }
    if (res2.ok) {
      let data2 = await res2.json();
      if (data2.thumbnail && data2.thumbnail.source) return data2.thumbnail.source;
    }
    
    let res3 = await fetch(`https://tr.wikipedia.org/api/rest_v1/page/summary/${title}`, { headers: { 'User-Agent': 'OrtakFutbolcuBot/3.0' } });
    if (res3.ok) {
      let data3 = await res3.json();
      if (data3.thumbnail && data3.thumbnail.source) return data3.thumbnail.source;
    }
    
    return null;
  } catch(e) {
    return null;
  }
}

async function main() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  let photos = {};
  if (fs.existsSync(PHOTOS_FILE)) {
    photos = JSON.parse(fs.readFileSync(PHOTOS_FILE, 'utf8'));
  }
  
  const missing = players.filter(p => !photos[p.name]);
  console.log(`Found ${missing.length} players missing photos.`);
  console.log(`Starting HIBRID Fetch (TheSportsDB + Wikipedia)...`);
  
  let newlyFound = 0;
  for (let i = 0; i < missing.length; i++) {
    const p = missing[i];
    if (photos[p.name]) continue;
    
    let url = await fetchTheSportsDB(p.name);
    let source = 'TheSportsDB';
    
    if (!url) {
      url = await fetchWikiPhoto(p.name);
      source = 'Wikipedia';
    }
    
    if (url) {
      photos[p.name] = url;
      newlyFound++;
      console.log(`[${i+1}/${missing.length}] [+] (${source}) Fotoğraf bulundu: ${p.name}`);
    } else {
      console.log(`[${i+1}/${missing.length}] [-] Yok: ${p.name}`);
    }
    
    if ((i+1) % 50 === 0) {
      fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos, null, 2), 'utf8');
      console.log(`--- Kaydedildi ---`);
    }
    
    await new Promise(r => setTimeout(r, 700));
  }
  
  fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos, null, 2), 'utf8');
  console.log(`Bitti! Toplam ${newlyFound} yeni fotoğraf bulundu.`);
}

main();
