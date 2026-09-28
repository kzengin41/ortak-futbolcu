// ============================================================================
// BAŞARILAR — tek tanım (28 Eylül 2026)
// XOX'un "Kulüp + Başarı / Karma" ızgarası ve oyuncu mini profili aynı listeyi
// kullanıyor. Veri: lib/playerAwards.json (ad -> kod listesi), gece scripti
// (scripts/ozgecmis_isle.py) üretir. Dosya büyük olmadığı halde yine de tembel
// (ilk ihtiyaçta) yükleniyor; bu modülü import etmek hiçbir veri yüklemez.
// ============================================================================
// Başarılar: lib/playerAwards.json (özgeçmiş verisinden üretilir; ad -> kod listesi).
export const BASARILAR = {
  ballonDor: { etiket: "Ballon d'Or", ikon: "trophy" },
  dunyaKupasi: { etiket: "Dünya Kupası şampiyonu", ikon: "earth" },
  avrupaSampiyonasi: { etiket: "Avrupa şampiyonu (milli)", ikon: "flag" },
  copaAmerica: { etiket: "Copa América şampiyonu", ikon: "flag" },
  afrikaKupasi: { etiket: "Afrika Kupası şampiyonu", ikon: "flag" },
  sampiyonlarLigi: { etiket: "Şampiyonlar Ligi şampiyonu", ikon: "star" },
  avrupaLigi: { etiket: "UEFA Avrupa Ligi şampiyonu", ikon: "star-half" },
  superLig: { etiket: "Süper Lig şampiyonu", ikon: "ribbon" },
  premierLig: { etiket: "Premier League şampiyonu", ikon: "ribbon" },
  laLiga: { etiket: "La Liga şampiyonu", ikon: "ribbon" },
  serieA: { etiket: "Serie A şampiyonu", ikon: "ribbon" },
  bundesliga: { etiket: "Bundesliga şampiyonu", ikon: "ribbon" },
  ligue1: { etiket: "Ligue 1 şampiyonu", ikon: "ribbon" },
  golKrali: { etiket: "Gol kralı (lig)", ikon: "football" },
  altinAyak: { etiket: "Avrupa Altın Ayak", ikon: "football" },
};
let _oduller = null;
export function oduller() {
  if (_oduller) return _oduller;
  try { _oduller = require("./playerAwards.json") || {}; } catch (e) { _oduller = {}; }
  if (_oduller && _oduller.default && typeof _oduller.default === "object") _oduller = _oduller.default;
  return _oduller;
}
export function basariVerisiVarMi() {
  return Object.keys(oduller()).length > 0;
}

// Oyuncunun başarı kodları, BASARILAR sırasıyla.
export function oyuncuBasarilari(ad) {
  const liste = oduller()[ad];
  if (!Array.isArray(liste) || !liste.length) return [];
  const sira = Object.keys(BASARILAR);
  return liste.filter((k) => BASARILAR[k]).sort((x, y) => sira.indexOf(x) - sira.indexOf(y));
}
