// Fotoğraf kapsamını gözle görülür şekilde kontrol etmek için.
// Çalıştırma: node scripts/check_photos.js
const fs = require("fs");
const path = require("path");

function readEsModule(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const names = [];
  const transformed = src.replace(/export\s+const\s+(\w+)\s*=/g, (_, name) => {
    names.push(name);
    return `const ${name} =`;
  });
  const withExports = `${transformed}\nmodule.exports = { ${names.join(", ")} };\n`;
  const tmpPath = filePath + ".tmp_check.js";
  fs.writeFileSync(tmpPath, withExports);
  try {
    delete require.cache[require.resolve(tmpPath)];
    return require(tmpPath);
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

const libDir = path.join(__dirname, "..", "lib");
const { PLAYERS } = readEsModule(path.join(libDir, "players.js"));
const { PLAYER_PHOTO_FILENAME } = readEsModule(path.join(libDir, "playerPhotos.js"));

const wellKnown = [
  "Lionel Messi", "Cristiano Ronaldo", "Arda Turan", "Hakan Çalhanoğlu",
  "Burak Yılmaz", "Emre Belözoğlu", "Robin van Persie", "Wesley Sneijder",
  "Didier Drogba", "Radamel Falcao",
];
console.log("=== Bilinen isimler kontrolü ===");
wellKnown.forEach((name) => {
  const player = PLAYERS.find((p) => p.name === name);
  if (!player) {
    console.log(`${name}: veri setinde YOK`);
    return;
  }
  const hasPhoto = PLAYER_PHOTO_FILENAME[name];
  console.log(`${name}: veri setinde VAR, fotoğraf ${hasPhoto ? "VAR (" + hasPhoto + ")" : "YOK"}`);
});

const withPhoto = PLAYERS.filter((p) => PLAYER_PHOTO_FILENAME[p.name]).map((p) => p.name);
const withoutPhoto = PLAYERS.filter((p) => !PLAYER_PHOTO_FILENAME[p.name]).map((p) => p.name);

function sample(arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

console.log(`\n=== Genel durum: ${withPhoto.length}/${PLAYERS.length} fotoğraflı ===`);
console.log("\n=== Fotoğrafı OLAN 15 rastgele isim ===");
sample(withPhoto, 15).forEach((n) => console.log("  " + n));
console.log("\n=== Fotoğrafı OLMAYAN 15 rastgele isim ===");
sample(withoutPhoto, 15).forEach((n) => console.log("  " + n));
