const fs = require("fs");
const path = require("path");
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
const DESKTOP_PHOTOS_DIR = "C:\\Users\\Monster\\Desktop\\custom-photos";
const PHOTOS_JS_PATH = path.join(__dirname, "..", "lib", "playerPhotos.js");

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("HATA: SUPABASE_SERVICE_ROLE_KEY ortam değişkeni bulunamadı. Lütfen .env dosyanıza ekleyip tekrar deneyin.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function readExportedModule(filePath) {
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

async function main() {
  console.log("Depo (bucket) kontrol ediliyor...");
  const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (bucketErr && !String(bucketErr.message).toLowerCase().includes("already exists")) {
    console.error("Depo oluşturulamadı:", bucketErr.message);
    process.exit(1);
  }

  const { PLAYER_PHOTO_FILENAME } = readExportedModule(PHOTOS_JS_PATH);
  const updatedPhotos = { ...PLAYER_PHOTO_FILENAME };

  if (!fs.existsSync(DESKTOP_PHOTOS_DIR)) {
      console.log(`Klasör bulunamadı: ${DESKTOP_PHOTOS_DIR}`);
      return;
  }

  const files = fs.readdirSync(DESKTOP_PHOTOS_DIR).filter(f => f.toLowerCase().endsWith(".jpg") || f.toLowerCase().endsWith(".png"));
  
  if (files.length === 0) {
    console.log("Masaüstünde yüklenecek fotoğraf bulunamadı.");
    return;
  }

  console.log(`${files.length} fotoğraf yükleniyor...`);
  
  let successCount = 0;
  for (const file of files) {
    const name = file.replace(/\.(jpg|png)$/i, "");
    const filePath = path.join(DESKTOP_PHOTOS_DIR, file);
    const buffer = fs.readFileSync(filePath);
    const crypto = require("crypto");
    const safeFilename = crypto.createHash('md5').update(file).digest('hex') + (file.toLowerCase().endsWith(".png") ? ".png" : ".jpg");
    const storagePath = `custom/${safeFilename}`; // Use md5 hash for valid storage key
    
    console.log(`Yükleniyor: ${file} -> ${storagePath}`);
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg", upsert: true });

    if (upErr) {
      console.error(`  Hata: ${upErr.message}`);
      continue;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    updatedPhotos[name] = urlData.publicUrl;
    successCount++;
  }

  // Write back to playerPhotos.js
  fs.writeFileSync(
    PHOTOS_JS_PATH,
    `// Her oyuncunun KENDİ Supabase deponuzdaki fotoğraf adresi.\n` +
      `export const PLAYER_PHOTO_FILENAME = ${JSON.stringify(updatedPhotos, null, 2)};\n`
  );

  console.log(`\nBİTTİ: ${successCount} fotoğraf yüklendi ve lib/playerPhotos.js güncellendi.`);
}

main().catch((err) => {
  console.error("Beklenmeyen Hata:", err.message);
  process.exit(1);
});
