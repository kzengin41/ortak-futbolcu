// Tarih tohumu ve tekrarlanabilir rastgele sayı üreteci — hafif, bağımlılıksız.
// (lib/dailyPuzzle.js'ten ayrıldı, 4 Ekim 2026: günlük görevler veri setini yüklemesin.)

// Metin -> 32-bit tohum. FNV-1a: kısa, hızlı, dağılımı yeterince iyi.
export function tohum(tarihMetni) {
  let h = 0x811c9dc5;
  for (let i = 0; i < tarihMetni.length; i++) {
    h ^= tarihMetni.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Tohumdan türeyen, tekrarlanabilir sayı üreteci (mulberry32).
export function uretec(cekirdek) {
  let a = cekirdek >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
