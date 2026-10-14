// ============================================================================
// TEMA OLUŞTURUCU — renk hesapları (4 Ekim 2026)
//
// Kerem: "temalarda kişi kendi renkler seçip tema oluşturabilsin. oluşacak
// tema önizlenebilsin." Kullanıcı üç şey seçiyor: ZEMİN (yüzey ailesi), ANA
// VURGU ve İKİNCİL renk. Hazır kutulardan ya da ton kaydırıcısından. Buradaki
// saf fonksiyonlar seçimden tam bir palet üretiyor; buton üstü yazı rengi ve
// okunabilirlik uyarısı kontrast oranından hesaplanıyor (WCAG formülü).
// ============================================================================

// Bütün zeminler KOYU (açık tema 31 dosyada kontrast denetimi ister — ayrı iş).
// Paket 30 — "Forma" sistemi okuma katmanı: zemin, kart, çerçeve aynı tondan ama
// NÖTRE YAKIN (OKLCH kroma ≤ .02; L .13 / .255 / .355). Renk vurgudan gelir
// (bkz. lib/theme.js, scripts/tema_uret.py).
export const ZEMINLER = [
  { id: "lacivert", ad: "Lacivert", renkler: { bg: "#030711", tabBar: "#0A1119", card: "#1C232C", cardBorder: "#353C46", text: "#F4F7FB", textMuted: "#B2B8C0", textFaint: "#757B83" } },
  { id: "gece", ad: "Gece mavisi", renkler: { bg: "#040712", tabBar: "#0C101A", card: "#1E232E", cardBorder: "#373C48", text: "#F5F7FB", textMuted: "#B3B7C1", textFaint: "#777A83" } },
  { id: "siyah", ad: "Siyah", renkler: { bg: "#000000", tabBar: "#0B0B0B", card: "#1C1C1C", cardBorder: "#353535", text: "#F7F7F7", textMuted: "#B7B7B7", textFaint: "#7A7A7A" } },
  { id: "grafit", ad: "Grafit", renkler: { bg: "#06080A", tabBar: "#0F1113", card: "#212326", cardBorder: "#393C3F", text: "#F4F7FB", textMuted: "#B4B8BB", textFaint: "#787B7E" } },
  { id: "orman", ad: "Orman", renkler: { bg: "#030A04", tabBar: "#0A130D", card: "#1C251F", cardBorder: "#353F37", text: "#F4F8F5", textMuted: "#B1BAB3", textFaint: "#747D76" } },
  { id: "bordo", ad: "Bordo", renkler: { bg: "#0F0405", tabBar: "#180D0E", card: "#2C1F20", cardBorder: "#463839", text: "#FBF5F6", textMuted: "#C0B4B5", textFaint: "#827778" } },
  { id: "mor", ad: "Mor", renkler: { bg: "#09050F", tabBar: "#120F18", card: "#24212B", cardBorder: "#3D3A45", text: "#F7F6FA", textMuted: "#B8B5BF", textFaint: "#7B7982" } },
  { id: "kahve", ad: "Kahve", renkler: { bg: "#0C0603", tabBar: "#150F0A", card: "#28211C", cardBorder: "#423A35", text: "#FAF6F3", textMuted: "#BEB5AF", textFaint: "#817972" } },
];

export const VURGU_KUTULARI = [
  "#7CFF5C", "#A3E635", "#2DD4BF", "#38BDF8", "#5EA8FF", "#818CF8",
  "#C084FC", "#FF8FA3", "#FF6B6B", "#F97316", "#FDB913", "#FDE047", "#FFFFFF",
];
export const IKINCIL_KUTULARI = [
  "#FFB020", "#FDE047", "#E01E37", "#FF6B6B", "#4A90D9", "#38BDF8",
  "#22C55E", "#A855F7", "#F472B6", "#9E9E9E", "#FFFFFF",
];

// --------------------------------------------------------------- renk matematiği
export function hexRgb(hex) {
  const h = String(hex || "").replace("#", "");
  const t = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(t.slice(i, i + 2), 16) || 0);
}
export function rgbHex([r, g, b]) {
  return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("").toUpperCase();
}
export function hslHex(h, s, l) {
  const S = s / 100, L = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}
export function hexTon(hex) {
  const [r, g, b] = hexRgb(hex).map((x) => x / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 0;
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}
export function parlaklik(hex) {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const [r, g, b] = hexRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function kontrast(a, b) {
  const [x, y] = [parlaklik(a), parlaklik(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
// Renkli bir butonun üstündeki yazı: zemin rengi mi beyaz mı daha okunaklı?
export function ustYaziRengi(renk, zeminBg) {
  return kontrast(renk, zeminBg) >= kontrast(renk, "#FFFFFF") ? zeminBg : "#FFFFFF";
}

// Ton kaydırıcısı (0–360) → canlı ama koyu zeminde okunur bir renk.
export const tondanVurgu = (ton) => hslHex(ton, 85, 62);
export const tondanIkincil = (ton) => hslHex(ton, 90, 55);

// --------------------------------------------------------------- palet
export const VARSAYILAN_SECIM = { zemin: "lacivert", accent: "#7CFF5C", cta: "#FFB020" };

export function paletUret(secim) {
  const s = { ...VARSAYILAN_SECIM, ...(secim || {}) };
  const z = (ZEMINLER.find((x) => x.id === s.zemin) || ZEMINLER[0]).renkler;
  return {
    ...z,
    border: z.cardBorder,
    accent: s.accent,
    accentDark: ustYaziRengi(s.accent, z.bg),
    cta: s.cta,
    ctaDark: ustYaziRengi(s.cta, z.bg),
  };
}

// Okunabilirlik uyarıları (önizlemenin altında gösterilir).
export function uyarilar(palet) {
  const u = [];
  if (kontrast(palet.accent, palet.bg) < 3) u.push("Ana vurgu zemine çok yakın — butonlar ve ikonlar zor seçilir.");
  if (kontrast(palet.cta, palet.bg) < 3) u.push("İkincil renk zemine çok yakın.");
  if (kontrast(palet.accent, palet.cta) < 1.25) u.push("Ana vurgu ile ikincil renk neredeyse aynı — ikisi ayırt edilemez.");
  return u;
}
