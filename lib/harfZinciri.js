// ============================================================================
// HARF ZİNCİRİ — tek kişilik hayatta kalma (4 Ekim 2026, benchmark .28548)
//
// "İlk Harf zinciri → tek kişilik hayatta kalma + rekor." Rastgele bir harfle
// başlar; her futbolcu bir öncekinin SON harfiyle başlamalı. 3 can var:
//   • yanlış harf ya da daha önce söylenmiş futbolcu → −1 can
//   • süre dolarsa → −1 can ve yeni rastgele harf
//   • tanınmayan isim (yazım hatası) → ceza yok, sadece uyarı
// Süre zincir uzadıkça kısalır: 20 sn'den başlar, her 3 doğruda −1, en az 8 sn.
// Harf eşdeğerliği İlk Harf moduyla aynı (Ç=C, Ş=S, İ=I, É=E…).
// ============================================================================
import { findMatchedPlayer } from "./gameEngine";
import { taninirlik } from "./taninirlik";

export const CAN = 3;
export const ILK_SURE = 20;
export const EN_AZ_SURE = 8;
export const sureHesapla = (zincirUzunlugu) => Math.max(EN_AZ_SURE, ILK_SURE - Math.floor(zincirUzunlugu / 3));

const charMap = { "Ø": "O", "Þ": "T", "Đ": "D", "Ł": "L", "Α": "A", "ß": "S" };
export function harfiSadelestir(c) {
  if (!c) return "";
  const u = c.toLocaleUpperCase("tr");
  if (charMap[u]) return charMap[u];
  const sade = u.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return charMap[sade] || sade[0] || "";
}
// Ad sonundaki nokta, rakam, parantez gibi işaretler sayılmaz ("Pepe (1983)").
export const ilkHarf = (ad) => harfiSadelestir(String(ad || "").replace(/^[^\p{L}]+/u, "")[0]);
export const sonHarf = (ad) => harfiSadelestir(String(ad || "").replace(/\s*\(.*\)\s*$/, "").replace(/[^\p{L}]+$/u, "").slice(-1));

let _dizin = null;
export function harfDizini(veriSeti) {
  if (_dizin && _dizin.veri === veriSeti) return _dizin.harita;
  const harita = new Map();
  for (const p of veriSeti) {
    const h = ilkHarf(p.name);
    if (!h) continue;
    if (!harita.has(h)) harita.set(h, []);
    harita.get(h).push(p);
  }
  _dizin = { veri: veriSeti, harita };
  return harita;
}

// Başlangıç / süre-doldu harfi: en az 15 tanınmış (tanınırlık ≥ 60) futbolcusu olan harfler.
export function rastgeleHarf(veriSeti, rnd = Math.random, haric = null) {
  const harita = harfDizini(veriSeti);
  const uygun = [...harita.entries()]
    .filter(([h, l]) => /^[A-Z]$/.test(h) && h !== haric && l.filter((p) => taninirlik(p) >= 60).length >= 15)
    .map(([h]) => h)
    .sort();
  return uygun[Math.floor(rnd() * uygun.length)] || "M";
}

// Tahmin değerlendirme. kullanilan: Set(ad).
//   { tip: "dogru", oyuncu, sonrakiHarf } | { tip: "tekrar", oyuncu } |
//   { tip: "yanlisHarf", oyuncu } | { tip: "bilinmiyor" }
export function tahminDegerlendir(metin, harf, kullanilan, veriSeti) {
  const t = String(metin || "").trim();
  if (!t) return { tip: "bilinmiyor" };
  const harfli = harfDizini(veriSeti).get(harf) || [];
  // Önce bu harfle başlayan ve henüz söylenmemiş oyuncularda ara ("Silva" → S'li Silva).
  const taze = findMatchedPlayer(t, harfli.filter((p) => !kullanilan.has(p.name)));
  if (taze) return { tip: "dogru", oyuncu: taze, sonrakiHarf: sonHarf(taze.name) };
  const tekrar = findMatchedPlayer(t, harfli);
  if (tekrar) return { tip: "tekrar", oyuncu: tekrar };
  const baska = findMatchedPlayer(t, veriSeti);
  if (baska) return { tip: "yanlisHarf", oyuncu: baska };
  return { tip: "bilinmiyor" };
}
