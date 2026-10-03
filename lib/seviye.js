// ============================================================================
// SEVİYE = AÇILAN FUTBOLCU SAYISI — 4 Ekim 2026
// Kerem: "söylenen oyuncular açılan oyunculara gelsin, sırası kaç olursa olsun.
// 3000 limit koymayalım. Level atlasın açtıkça: 1 levelsin, 2 level olmak için
// 15 oyuncu açmalısın."
// Basamaklar her seviyede 5 artar: 2. seviye 15, 3. seviye 35 (+20), 4. seviye
// 60 (+25), 5. seviye 90 (+30) … 10. seviye 315, 20. seviye 1140 futbolcu.
// ============================================================================
export const ILK_ADIM = 15;
export const ADIM_ARTISI = 5;

// L. seviyeye ulaşmak için gereken toplam açılan futbolcu.
export function seviyeEsigi(L) {
  const n = Math.max(0, Math.floor(L) - 1);
  return ILK_ADIM * n + (ADIM_ARTISI * n * (n - 1)) / 2;
}

export function seviyeHesapla(acilan) {
  const a = Math.max(0, Math.floor(acilan || 0));
  let L = 1;
  while (seviyeEsigi(L + 1) <= a && L < 500) L++;
  const bas = seviyeEsigi(L);
  const son = seviyeEsigi(L + 1);
  const into = a - bas;
  const needed = son - bas;
  return { level: L, acilan: a, into, needed, kalan: son - a, fraction: needed ? into / needed : 0, sonrakiEsik: son };
}
