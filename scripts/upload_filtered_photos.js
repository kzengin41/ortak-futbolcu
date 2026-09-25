const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

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
const CSV_PATH = "C:\\Users\\Monster\\Desktop\\players.csv";
const FACES_DIR = "C:\\Users\\Monster\\Desktop\\isimli_yuzler";
const PHOTOS_JS_PATH = path.join(__dirname, "..", "lib", "playerPhotos.js");
const CHECKPOINT_PATH = path.join(__dirname, ".faces_upload_checkpoint.json");

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("HATA: SUPABASE_SERVICE_ROLE_KEY ortam değişkeni bulunamadı.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const CONCURRENCY = 15; // Upload 15 files at a time

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { uploaded: {} };
  return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8"));
}
function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp));
}

function readExportedModule(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const src = fs.readFileSync(filePath, "utf8");
  const names = [];
  const transformed = src.replace(/export\s+const\s+(\w+)\s*=/g, (_, name) => { names.push(name); return `const ${name} =`; });
  const withExports = `${transformed}\nmodule.exports = { ${names.join(", ")} };\n`;
  const tmpPath = filePath + ".tmp_upload.js";
  fs.writeFileSync(tmpPath, withExports);
  try {
    delete require.cache[require.resolve(tmpPath)];
    return require(tmpPath);
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

async function uploadFile(name, filePath, cp, updatedPhotos) {
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === ".png" ? "image/png" : "image/jpeg";
    const safeFilename = crypto.createHash('md5').update(name).digest('hex') + ext;
    const storagePath = `custom/${safeFilename}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;
    
    cp.uploaded[name] = publicUrl;
    updatedPhotos[name] = publicUrl;
    return true;
  } catch (err) {
    console.error(`  Hata (${name}): ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("Depo (bucket) kontrol ediliyor...");
  const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (bucketErr && !String(bucketErr.message).toLowerCase().includes("already exists")) {
    console.error("Depo oluşturulamadı:", bucketErr.message);
    process.exit(1);
  }

  const cp = loadCheckpoint();
  const exportedModule = readExportedModule(PHOTOS_JS_PATH);
  const updatedPhotos = { ...(exportedModule.PLAYER_PHOTO_FILENAME || {}) };

  const csvData = fs.readFileSync(CSV_PATH, "utf8");
  const names = csvData.split(/\r?\n/).slice(1).map(n => n.trim()).filter(n => n.length > 0);
  
  const existingFiles = new Set(fs.readdirSync(FACES_DIR));
  
  const tasks = [];
  for (const name of names) {
    if (cp.uploaded[name]) continue; // Already uploaded in a previous run

    let fileName = null;
    if (existingFiles.has(name + ".png")) fileName = name + ".png";
    else if (existingFiles.has(name + ".jpg")) fileName = name + ".jpg";

    if (fileName) {
      tasks.push({ name, filePath: path.join(FACES_DIR, fileName) });
    }
  }

  console.log(`Bulunan toplam eşleşme: ${tasks.length} (Zaten yüklenenler hariç)`);
  if (tasks.length === 0) {
    console.log("Yüklenecek yeni dosya yok!");
    return;
  }

  let doneCount = 0;
  
  process.on("SIGINT", () => {
    console.log("\nDurduruldu, ilerleme kaydedildi.");
    saveCheckpoint(cp);
    process.exit(0);
  });

  // Concurrent execution
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const chunk = tasks.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (task) => {
      const success = await uploadFile(task.name, task.filePath, cp, updatedPhotos);
      if (success) {
        doneCount++;
      }
    }));
    
    // Save checkpoint and update JS file periodically
    if (i > 0 && i % 150 === 0) {
      saveCheckpoint(cp);
      fs.writeFileSync(
        PHOTOS_JS_PATH,
        `// Her oyuncunun KENDİ Supabase deponuzdaki fotoğraf adresi.\n` +
          `export const PLAYER_PHOTO_FILENAME = ${JSON.stringify(updatedPhotos, null, 2)};\n`
      );
      console.log(`İlerleme: ${doneCount}/${tasks.length} yüklendi...`);
    }
  }

  saveCheckpoint(cp);
  fs.writeFileSync(
    PHOTOS_JS_PATH,
    `// Her oyuncunun KENDİ Supabase deponuzdaki fotoğraf adresi.\n` +
      `export const PLAYER_PHOTO_FILENAME = ${JSON.stringify(updatedPhotos, null, 2)};\n`
  );

  console.log(`\nBİTTİ: Toplam ${doneCount} yeni fotoğraf yüklendi ve lib/playerPhotos.js güncellendi.`);
}

main().catch((err) => {
  console.error("Beklenmeyen Hata:", err.message);
  process.exit(1);
});
