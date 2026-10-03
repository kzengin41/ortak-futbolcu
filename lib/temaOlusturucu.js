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
export const ZEMINLER = [
  { id: "lacivert", ad: "Lacivert", renkler: { bg: "#0B1620", card: "#16222E", cardBorder: "#28394B", text: "#F3F7FA", textMuted: "#8CA0B3", textFaint: "#56697A" } },
  { id: "gece", ad: "Gece mavisi", renkler: { bg: "#0A1028", card: "#141B3A", cardBorder: "#2A3465", text: "#EEF2FF", textMuted: "#9AA6D2", textFaint: "#5E6A9B" } },
  { id: "siyah", ad: "Siyah", renkler: { bg: "#000000", card: "#0E0E0E", cardBorder: "#262626", text: "#F5F5F5", textMuted: "#9A9A9A", textFaint: "#5C5C5C" } },
  { id: "grafit", ad: "Grafit", renkler: { bg: "#121417", card: "#1D2126", cardBorder: "#363C44", text: "#F2F4F7", textMuted: "#A3ABB6", textFaint: "#68707B" } },
  { id: "orman", ad: "Orman", renkler: { bg: "#07160F", card: "#10261B", cardBorder: "#234A35", text: "#F1FAF4", textMuted: "#9DC2AC", textFaint: "#5E8270" } },
  { id: "bordo", ad: "Bordo", renkler: { bg: "#1F050D", card: "#360A18", cardBorder: "#6B1629", text: "#FFF5E6", textMuted: "#E8B9AE", textFaint: "#A67A72" } },
  { id: "mor", ad: "Mor", renkler: { bg: "#140A24", card: "#22123A", cardBorder: "#3E2766", text: "#F7F2FF", textMuted: "#B7A6D6", textFaint: "#74639A" } },
  { id: "kahve", ad: "Kahve", renkler: { bg: "#17110B", card: "#261C13", cardBorder: "#4A3826", text: "#FFF8EE", textMuted: "#CDB9A0", textFaint: "#8C7660" } },
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
