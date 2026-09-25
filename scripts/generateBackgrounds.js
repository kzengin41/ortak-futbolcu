const fs = require('fs');
const path = require('path');
const bgDir = path.join(__dirname, '../assets/backgrounds');
const outFile = path.join(bgDir, 'index.js');
if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });
const files = fs.readdirSync(bgDir).filter(f => /\.(png|jpe?g|gif|webp)$/i.test(f));
let content = '// OTOMATIK OLUŞTURULDU\nconst backgrounds = [\n' + files.map(f => '  require("./' + f + '")').join(',\n') + '\n];\nexport default backgrounds;';
fs.writeFileSync(outFile, content, 'utf8');
