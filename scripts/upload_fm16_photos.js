const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

// Read .env manually
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf8");
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

const BUCKET = "player-photos";
const CSV_PATH = "C:\\Users\\Monster\\Desktop\\fm16.csv";
const PHOTOS_DIR = "C:\\Users\\Monster\\Desktop\\DF11 Megapack FM2016\\DF11 Megapack FM2016";
const PHOTOS_JSON_PATH = path.join(__dirname, "..", "lib", "playerPhotos.json");
const PLAYERS_JSON_PATH = path.join(__dirname, "..", "lib", "players.json");

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("HATA: SUPABASE_SERVICE_ROLE_KEY ortam değişkeni bulunamadı.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function getMd5(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

async function main() {
  console.log("Dosyalar okunuyor...");
  const players = JSON.parse(fs.readFileSync(PLAYERS_JSON_PATH, "utf8"));
  let playerPhotos = {};
  if (fs.existsSync(PHOTOS_JSON_PATH)) {
    playerPhotos = JSON.parse(fs.readFileSync(PHOTOS_JSON_PATH, "utf8"));
  }

  const playerMap = new Map();
  for (const p of players) {
    playerMap.set(p.name.toLowerCase(), p.name);
    const noAccent = p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!playerMap.has(noAccent)) playerMap.set(noAccent, p.name);
  }

  const text = fs.readFileSync(CSV_PATH, "latin1");
  const lines = text.split(/\r?\n/);
  
  let matchCount = 0;
  let uploadCount = 0;
  const toUpload = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(";");
    if (parts.length < 3) continue;
    
    const name = parts[0].trim();
    const surname = parts[1].trim();
    const id = parts[2].trim();
    
    let fullName = name ? name + " " + surname : surname;
    
    let match = playerMap.get(fullName.toLowerCase());
    if (!match) {
        const noAccent = fullName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        match = playerMap.get(noAccent);
    }
    
    if (match) {
      matchCount++;
      if (!playerPhotos[match]) {
        const filePath = path.join(PHOTOS_DIR, id + ".png");
        if (fs.existsSync(filePath)) {
          toUpload.push({ name: match, id, file: filePath });
        }
      }
    }
  }

  console.log(`CSV'de ${matchCount} eşleşme bulundu.`);
  console.log(`Bunlardan ${toUpload.length} tanesinin fotoğrafı eksik ve .png dosyası mevcut.`);
  console.log(`Yükleme başlıyor...`);

  const batchSize = 10;
  for (let i = 0; i < toUpload.length; i += batchSize) {
    const batch = toUpload.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (item) => {
      const { name, file } = item;
      const fileBuffer = fs.readFileSync(file);
      const hash = getMd5(name);
      const fileName = `${hash}.png`;
      
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, fileBuffer, {
          contentType: "image/png",
          upsert: true
        });
        
      if (error) {
        console.error(`[X] ${name} (${fileName}) - Hata:`, error.message);
      } else {
        const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
        playerPhotos[name] = publicUrlData.publicUrl;
        console.log(`[OK] ${name} -> Yüklendi.`);
        uploadCount++;
      }
    }));
    
    fs.writeFileSync(PHOTOS_JSON_PATH, JSON.stringify(playerPhotos, null, 2));
  }
  
  console.log(`Toplam ${uploadCount} yeni fotoğraf yüklendi ve lib/playerPhotos.json güncellendi.`);
}

main().catch(console.error);
