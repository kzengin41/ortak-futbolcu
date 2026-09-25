const fs = require('fs');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const playersPath = path.join(__dirname, '../lib/players.json');

let players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));

console.log("=== Ortak Futbolcu - Hızlı Oyuncu Ekleme Aracı ===");

rl.question('Futbolcunun Tam Adı (Örn: Arda Güler): ', (name) => {
  if (!name || name.trim() === '') {
    console.log("İsim boş olamaz!");
    rl.close();
    return;
  }
  
  rl.question('Oynadığı Kulüpler (Virgülle ayırın, Örn: Real Madrid, Fenerbahçe, Gençlerbirliği): ', (clubsInput) => {
    const clubs = clubsInput.split(',').map(c => c.trim()).filter(c => c !== '');
    if (clubs.length === 0) {
      console.log("En az 1 kulüp girmelisiniz!");
      rl.close();
      return;
    }

    // Add player to players.json
    const existing = players.find(p => p.name === name);
    if (existing) {
      console.log(`Uyarı: ${name} zaten veritabanında var. Kulüpleri güncelleniyor...`);
      existing.clubs = [...new Set([...existing.clubs, ...clubs])];
    } else {
      players.push({ name, clubs });
    }

    fs.writeFileSync(playersPath, JSON.stringify(players, null, 0), 'utf8');
    fs.writeFileSync(path.join(__dirname, '../lib/players.js'), "export const PLAYERS = require('./players.json');\n", 'utf8');
    
    console.log(`\n✅ ${name} veritabanına eklendi/güncellendi! (${clubs.join(', ')})`);
    console.log(`\n📸 Fotoğraf eklemek için:`);
    console.log(`1. İnternetten resmini indirin.`);
    console.log(`2. 'custom-photos/${name}.jpg' olarak kaydedin (ismin BİREBİR aynı yazıldığına dikkat edin).`);
    console.log(`3. Terminalde 'npm run custom-photos' komutunu çalıştırın.`);
    rl.close();
  });
});
