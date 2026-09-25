// ============================================================================
// custom-photos/ klasörüne koyduğun (kendi bulduğun/kırptığın) fotoğrafları
// Supabase Storage'a yükler — o oyuncu için otomatik çekilmiş (varsa) eski
// fotoğrafın YERİNE geçer (aynı depolama yolunu kullanıyoruz).
//
// Kullanım:
//   1) custom-photos/ klasörüne, dosya adı OYUNCUNUN TAM ADI olacak şekilde
//      resimler koy (players.js'teki isimle BİREBİR aynı olmalı, uzantı
//      önemli değil — .jpg/.png/.webp hepsi olur). Örnek: "Cenk Tosun.jpg"
//   2) set SUPABASE_URL=... ve set SUPABASE_SERVICE_ROLE_KEY=... (aynı
//      upload_photos_to_storage.js'teki gibi)
//
// Çalıştırma:  node scripts/upload_custom_photos.js
// ============================================================================

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const CUSTOM_DIR = path.join(__dirname, "..", "custom-photos");
const BUCKET = "player-photos";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri ayarlı değil.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// --- Aynı MD5 (diğer script'lerle birebir aynı, aynı depolama yoluna
// yazmak için — böylece otomatik çekilenin YERİNE geçiyor, yanına değil) ---
function utf8Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.codePointAt(i);
    if (code > 0xffff) i++;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return bytes;
}
function md5(str) {
  function rotl(n, c) { return (n << c) | (n >>> (32 - c)); }
  const K = new Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32);
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  let msg = utf8Bytes(str);
  const origLenBits = msg.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 0; i < 8; i++) msg.push((origLenBits / Math.pow(2, 8 * i)) & 0xff);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let chunkStart = 0; chunkStart < msg.length; chunkStart += 64) {
    const M = new Array(16);
    for (let i = 0; i < 16; i++) M[i] = msg[chunkStart+i*4] | (msg[chunkStart+i*4+1]<<8) | (msg[chunkStart+i*4+2]<<16) | (msg[chunkStart+i*4+3]<<24);
    let [A,B,C,D] = [a0,b0,c0,d0];
    for (let i = 0; i < 64; i++) {
      let F,g;
      if (i<16){F=(B&C)|(~B&D);g=i;} else if(i<32){F=(D&B)|(~D&C);g=(5*i+1)%16;} else if(i<48){F=B^C^D;g=(3*i+5)%16;} else {F=C^(B|~D);g=(7*i)%16;}
      F=(F+A+K[i]+M[g])|0; A=D;D=C;C=B; B=(B+rotl(F,S[i]))|0;
    }
    a0=(a0+A)|0;b0=(b0+B)|0;c0=(c0+C)|0;d0=(d0+D)|0;
  }
  function toHex(n){const bytes=[n&0xff,(n>>>8)&0xff,(n>>>16)&0xff,(n>>>24)&0xff];return bytes.map(b=>b.toString(16).padStart(2,"0")).join("");}
  return toHex(a0)+toHex(b0)+toHex(c0)+toHex(d0);
}

function readExportedModule(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const names = [];
  const transformed = src.replace(/export\s+const\s+(\w+)\s*=/g, (_, name) => { names.push(name); return `const ${name} =`; });
  const withExports = `${transformed}\nmodule.exports = { ${names.join(", ")} };\n`;
  const tmpPath = filePath + ".tmp_custom.js";
  fs.writeFileSync(tmpPath, withExports);
  try {
    delete require.cache[require.resolve(tmpPath)];
    return require(tmpPath);
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

const EXT_TO_CONTENT_TYPE = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

async function main() {
  if (!fs.existsSync(CUSTOM_DIR)) {
    console.error(`custom-photos/ klasörü bulunamadı: ${CUSTOM_DIR}`);
    process.exit(1);
  }

  const libDir = path.join(__dirname, "..", "lib");
  const { PLAYERS } = readExportedModule(path.join(libDir, "players.js"));
  const { PLAYER_PHOTO_FILENAME } = readExportedModule(path.join(libDir, "playerPhotos.js"));

  // Hızlı eşleştirme için: küçük harfe çevrilmiş, boşlukları sadeleştirilmiş
  // isimden GERÇEK players.js adına bir harita kuruyoruz.
  const nameIndex = new Map();
  for (const p of PLAYERS) nameIndex.set(p.name.trim().toLowerCase(), p.name);

  const files = fs.readdirSync(CUSTOM_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return EXT_TO_CONTENT_TYPE[ext];
  });

  if (files.length === 0) {
    console.log("custom-photos/ klasöründe (OKU_BENI.txt dışında) resim dosyası bulunamadı.");
    return;
  }
  console.log(`${files.length} dosya bulundu, işleniyor...`);

  let matched = 0;
  let unmatched = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const rawName = path.basename(file, ext).trim();
    const realName = nameIndex.get(rawName.toLowerCase());

    if (!realName) {
      unmatched.push(file);
      console.log(`  "${file}" -> EŞLEŞMEDİ (players.js'te "${rawName}" adında oyuncu yok, dosya adını kontrol et)`);
      continue;
    }

    const buffer = fs.readFileSync(path.join(CUSTOM_DIR, file));
    const storagePath = `${md5(realName)}.jpg`; // aynı yol -> otomatik çekilenin YERİNE geçer

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: EXT_TO_CONTENT_TYPE[ext], upsert: true });
    if (upErr) {
      console.log(`  "${realName}" yüklenemedi: ${upErr.message}`);
      continue;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    PLAYER_PHOTO_FILENAME[realName] = urlData.publicUrl;
    matched++;
    console.log(`  "${realName}" -> yüklendi ✓`);
  }

  fs.writeFileSync(
    path.join(libDir, "playerPhotos.js"),
    `// Her oyuncunun KENDİ Supabase deponuzdaki fotoğraf adresi —\n` +
      `// scripts/upload_photos_to_storage.js + upload_custom_photos.js.\n` +
      `export const PLAYER_PHOTO_FILENAME = ${JSON.stringify(PLAYER_PHOTO_FILENAME)};\n`
  );

  console.log(`\nBİTTİ: ${matched} özel fotoğraf yüklendi, lib/playerPhotos.js güncellendi.`);
  if (unmatched.length > 0) {
    console.log(`${unmatched.length} dosya eşleşmedi: ${unmatched.join(", ")}`);
  }
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
