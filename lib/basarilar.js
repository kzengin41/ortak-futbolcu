import { _t } from "./dil";
// ============================================================================
// BAŞARILAR — tek tanım (28 Eylül 2026)
// XOX'un "Kulüp + Başarı / Karma" ızgarası ve oyuncu mini profili aynı listeyi
// kullanıyor. Veri: lib/playerAwards.json (ad -> kod listesi), gece scripti
// (scripts/ozgecmis_isle.py) üretir. Dosya büyük olmadığı halde yine de tembel
// (ilk ihtiyaçta) yükleniyor; bu modülü import etmek hiçbir veri yüklemez.
// ============================================================================
// Başarılar: lib/playerAwards.json (özgeçmiş verisinden üretilir; ad -> kod listesi).
export const BASARILAR = {
  ballonDor: { etiket: _t("Ballon d'Or"), ikon: "trophy" },
  dunyaKupasi: { etiket: _t("Dünya Kupası şampiyonu"), ikon: "earth" },
  avrupaSampiyonasi: { etiket: _t("Avrupa şampiyonu (milli)"), ikon: "flag" },
  copaAmerica: { etiket: _t("Copa América şampiyonu"), ikon: "flag" },
  afrikaKupasi: { etiket: _t("Afrika Kupası şampiyonu"), ikon: "flag" },
  sampiyonlarLigi: { etiket: _t("Şampiyonlar Ligi şampiyonu"), ikon: "star" },
  avrupaLigi: { etiket: _t("UEFA Avrupa Ligi şampiyonu"), ikon: "star-half" },
  superLig: { etiket: _t("Süper Lig şampiyonu"), ikon: "ribbon" },
  premierLig: { etiket: _t("Premier League şampiyonu"), ikon: "ribbon" },
  laLiga: { etiket: _t("La Liga şampiyonu"), ikon: "ribbon" },
  serieA: { etiket: _t("Serie A şampiyonu"), ikon: "ribbon" },
  bundesliga: { etiket: _t("Bundesliga şampiyonu"), ikon: "ribbon" },
  ligue1: { etiket: _t("Ligue 1 şampiyonu"), ikon: "ribbon" },
  golKrali: { etiket: _t("Gol kralı (lig)"), ikon: "football" },
  altinAyak: { etiket: _t("Avrupa Altın Ayak"), ikon: "football" },
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
