// ============================================================================
// lib/playerPhotos.js'teki her oyuncu fotoğrafını Wikimedia'dan BİR KEZ
// indirip kendi Supabase Storage deponuza yükler. Bundan sonra uygulama
// Wikimedia'ya hiç canlı istek atmıyor — hem 403/redirect sorunlarını
// tamamen ortadan kaldırıyor hem de daha hızlı oluyor.
//
// Kurulum:
//   1) Supabase panelinde: Project Settings → API → "service_role" anahtarını
//      kopyala (anon/publishable DEĞİL — bu farklı, daha yetkili bir anahtar,
//      SADECE bu script gibi sunucu tarafı işler için, uygulamaya HİÇ girmez).
//   2) set SUPABASE_URL=https://xxxxx.supabase.co
//      set SUPABASE_SERVICE_ROLE_KEY=eyJ...
//
// Çalıştırma:  node scripts/upload_photos_to_storage.js
// ============================================================================

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const WP_HEADERS = { "User-Agent": "ortak-futbolcu-oyunu/0.1 (kisisel proje; iletisim yok)" };
const CHECKPOINT_PATH = path.join(__dirname, ".photos_upload_checkpoint.json");
const BUCKET = "player-photos";
const THUMB_WIDTH = 200; // depolama boyutunu makul tutmak için sabit, küçük bir boyut

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri ayarlı değil. Dosyanın başındaki kurulum notuna bak.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// --- Aynı MD5 (PlayerPhoto.js ile birebir aynı, dosya yolu hesaplamak için) ---
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

async function fetchOnce(url, headers) {
  return fetch(url, { headers });
}

// Kendi hesapladığımız (hataya açık) URL yerine, Wikipedia'nın API'sinden
// DOĞRUDAN doğru thumbnail adresini istiyoruz — bu, hash/klasör yolu
// tahmininde yapılabilecek her türlü hatayı ortadan kaldırıyor.
async function getThumbUrl(filename, width) {
  const apiUrl =
    "https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=" +
    width +
    "&formatversion=2&format=json&titles=" +
    encodeURIComponent("File:" + filename);
  const res = await fetchOnce(apiUrl, WP_HEADERS);
  if (!res.ok) {
    const retryAfter = res.headers.get("retry-after");
    throw new Error(`API isteği başarısız: ${res.status}${retryAfter ? ` (Retry-After: ${retryAfter} sn)` : ""}`);
  }
  const data = await res.json();
  const page = data?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  return info?.thumburl || info?.url || null;
}

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

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { uploaded: {} };
  return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8"));
}
function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp));
}

async function main() {
  const libDir = path.join(__dirname, "..", "lib");
  const { PLAYER_PHOTO_FILENAME } = readExportedModule(path.join(libDir, "playerPhotos.js"));

  console.log("Depo (bucket) hazırlanıyor...");
  const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (bucketErr && !String(bucketErr.message).toLowerCase().includes("already exists")) {
    console.error("Depo oluşturulamadı:", bucketErr.message);
    process.exit(1);
  }

  const cp = loadCheckpoint();
  const entries = Object.entries(PLAYER_PHOTO_FILENAME);
  const todo = entries.filter(([name]) => !cp.uploaded[name]);
  console.log(`Toplam ${entries.length} fotoğraftan ${todo.length} tanesi yüklenecek (${entries.length - todo.length} zaten tamam).`);

  // Ctrl+C ile durdurursan bile o ana kadarki ilerleme kaybolmasın diye.
  process.on("SIGINT", () => {
    console.log("\nDurduruldu, ilerleme kaydedildi. Tekrar çalıştırınca kaldığın yerden devam eder.");
    saveCheckpoint(cp);
    process.exit(0);
  });

  let done = 0;
  let failedCount = 0;
  for (const [name, filename] of todo) {
    const storagePath = `${md5(name)}.jpg`;
    let retryAfterSec = null;
    try {
      const thumbUrl = await getThumbUrl(filename, THUMB_WIDTH);
      if (!thumbUrl) throw new Error("API'den geçerli bir resim adresi dönmedi");
      const res = await fetchOnce(thumbUrl, WP_HEADERS);
      if (!res.ok) {
        const retryAfter = res.headers.get("retry-after");
        throw new Error(`indirme başarısız: ${res.status}${retryAfter ? ` (Retry-After: ${retryAfter} sn)` : ""}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw new Error(`Supabase'e yükleme başarısız: ${upErr.message}`);

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      cp.uploaded[name] = urlData.publicUrl;
      done++;
      if (done % 10 === 0) {
        console.log(`  ${done}/${todo.length} tamam (${failedCount} rate limit'e takıldı, sonraki çalıştırmada tekrar denenecek)`);
        saveCheckpoint(cp);
      }
    } catch (err) {
      failedCount++;
      console.log(`  "${name}" atlandı: ${err.message}`);
      // Wikimedia'nın "Retry-After: X sn" dediği süreyi GERÇEKTEN bekliyoruz —
      // aksi halde her 1.5 saniyede bir aynı aktif pencereye çarpıp
      // duruyorduk. Bu, kısa süreli (~30-40 sn) bir pencere, saatler
      // süren bir yasak DEĞİL — Wikimedia'nın kendi söylediği süre kadar
      // bekleyip devam edersek ilerleme kaydedebiliriz.
      const match = err.message.match(/Retry-After: (\d+) sn/);
      if (match) retryAfterSec = parseInt(match[1], 10);
    }
    const waitMs = retryAfterSec ? (retryAfterSec + 1) * 1000 : 1500;
    if (retryAfterSec) console.log(`  (Wikimedia'nın istediği ${retryAfterSec} sn bekleniyor...)`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  saveCheckpoint(cp);

  fs.writeFileSync(
    path.join(libDir, "playerPhotos.js"),
    `// Her oyuncunun KENDİ Supabase deponuzdaki fotoğraf adresi —\n` +
      `// scripts/upload_photos_to_storage.js. Artık Wikimedia'ya canlı bağımlı değil.\n` +
      `export const PLAYER_PHOTO_FILENAME = ${JSON.stringify(cp.uploaded)};\n`
  );

  console.log(`\nBİTTİ: ${Object.keys(cp.uploaded).length} fotoğraf Supabase Storage'a yüklendi, lib/playerPhotos.js güncellendi.`);
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
