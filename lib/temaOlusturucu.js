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
// Paket 24 — zemin, kart ve çerçeve AYNI renk tonundan, farklı açıklıkta
// (OKLCH L .15 / .295 / .41): kart zemine erimez ama ondan kopuk da durmaz
// (bkz. lib/theme.js COLORS notu, scripts/tema_uret.py).
export const ZEMINLER = [
  { id: "lacivert", ad: "Lacivert", renkler: { bg: "#000C1B", card: "#1E2E3D", cardBorder: "#3D4C5B", text: "#F1F6FA", textMuted: "#A6B6C7", textFaint: "#6A7989" } },
  { id: "gece", ad: "Gece mavisi", renkler: { bg: "#040821", card: "#242C41", cardBorder: "#424A5E", text: "#F3F5FB", textMuted: "#ACB4C8", textFaint: "#70778A" } },
  { id: "siyah", ad: "Siyah", renkler: { bg: "#000000", card: "#282828", cardBorder: "#454545", text: "#F5F5F5", textMuted: "#B4B4B4", textFaint: "#777777" } },
  { id: "grafit", ad: "Grafit", renkler: { bg: "#060C12", card: "#282D32", cardBorder: "#464B50", text: "#F1F6FA", textMuted: "#AFB5BC", textFaint: "#72787E" } },
  { id: "orman", ad: "Orman", renkler: { bg: "#001004", card: "#1F3224", cardBorder: "#3E5042", text: "#F1F7F2", textMuted: "#A7BAAB", textFaint: "#6B7D6F" } },
  { id: "bordo", ad: "Bordo", renkler: { bg: "#1F0003", card: "#402324", cardBorder: "#5F4242", text: "#FAF3F3", textMuted: "#C7ADAD", textFaint: "#887171" } },
  { id: "mor", ad: "Mor", renkler: { bg: "#0F051E", card: "#30283E", cardBorder: "#4D465B", text: "#F6F4FA", textMuted: "#B7B0C5", textFaint: "#7A7487" } },
  { id: "kahve", ad: "Kahve", renkler: { bg: "#160700", card: "#38291D", cardBorder: "#56473C", text: "#F9F4F0", textMuted: "#C3B0A2", textFaint: "#857466" } },
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
