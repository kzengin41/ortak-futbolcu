// ============================================================================
// TANINIRLIK + CPU EŞİĞİ — 4 Ekim 2026
//
// Kerem (2 Ekim kararları): "İlk harf: CPU threshold — diğer modlarda da."
// CPU'lar eskiden turun geçerli cevaplarından RASTGELE birini söylüyordu; bu
// yüzden "CPU doğru bildi: <kimsenin duymadığı bir isim>" çıkıyordu. Artık
// CPU yalnızca zorluğuna göre TANIYABİLECEĞİ oyuncuları biliyor:
//
//   tanınırlık = playerFame.json'daki [güncel, tüm zamanlar] yüzdeliğinin büyüğü
//   CPU eşiği  = zorluk 1 -> 99,3 (yaklaşık ilk 300 oyuncu)
//                zorluk 5 -> ~93  (ilk ~3.000)
//                zorluk 10 -> 85  (ilk ~6.500)
//
// Turun cevaplarının hiçbiri eşiğin üstünde değilse CPU o turu bilemez —
// gerçek bir rakip gibi. Bildiklerinden tanınırlığa göre ağırlıklı seçer.
// ============================================================================
let TANIN = {};
try { TANIN = require("./playerFame.json"); } catch (e) {}
if (TANIN && TANIN.default && typeof TANIN.default === "object") TANIN = TANIN.default;

const ad = (x) => (typeof x === "string" ? x : x && x.name);

export function taninirlik(oyuncu) {
  const t = TANIN[ad(oyuncu)];
  return t ? Math.max(t[0] || 0, t[1] || 0) : 0;
}

// "Tanınmış" oyuncu sınırı (İlk Harf'te harf çiftinin en az 3 tanınmış cevabı olmalı).
export const TANINMIS_ESIK = 95;
export const taninmisMi = (oyuncu) => taninirlik(oyuncu) >= TANINMIS_ESIK;

export function cpuEsigi(zorluk) {
  const z = Math.min(10, Math.max(1, Number(zorluk) || 5));
  return 99.3 - ((z - 1) / 9) * (99.3 - 85);
}

export function cpuBilirMi(oyuncu, zorluk) {
  return taninirlik(oyuncu) >= cpuEsigi(zorluk);
}

// adaylar: oyuncu nesneleri ya da adlar. Bildiği yoksa null.
export function cpuCevabiSec(adaylar, zorluk, rastgele = Math.random) {
  const esik = cpuEsigi(zorluk);
  const bilinen = [];
  let toplam = 0;
  for (const a of adaylar || []) {
    const t = taninirlik(a);
    if (t < esik) continue;
    const w = (t - esik + 1) ** 2; // tanınmışlar belirgin şekilde öne çıksın
    bilinen.push([a, w]);
    toplam += w;
  }
  if (!bilinen.length) return null;
  let r = rastgele() * toplam;
  for (const [a, w] of bilinen) {
    r -= w;
    if (r <= 0) return a;
  }
  return bilinen[bilinen.length - 1][0];
}
