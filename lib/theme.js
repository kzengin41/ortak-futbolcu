// Tek kaynak: tüm ekranlar renk/boşluk/tipografi değerlerini buradan almalı.
// Yeni bir renk/boyut eklemeden önce burayı kontrol et — elle hex kodu yazma.
//
// 31 Ağustos 2026 (Kerem: "UI aşırı yeşil, her item açık ya da koyu yeşil,
// mide bulandırıcı") — PALET BAŞTAN TASARLANDI. Eskiden hem arkaplan (bg)
// hem kart (card) hem de vurgu (accent) hepsi farklı tonda YEŞİLDİ — bu
// yüzden ekranın her katmanı (dış zemin, kart, buton) aynı renk ailesinden
// görünüyordu. Yeni yaklaşım: "gece stadyumu" kimliği — SADECE arkaplan
// görseli (GameBackground) gerçek çim/saha imajını koruyor, ama üstündeki
// TÜM YÜZEYLER (kart, buton, panel) artık lacivert/çelik-gri bir zemine
// (bg/card/border) oturuyor. Yeşil (accent) artık SADECE vurgu için var:
// CTA butonları, aktif durumlar, ikonlar — asla büyük bir yüzeyin dolgu
// rengi değil. İkincil vurgu olarak altın/amber (cta) eklendi (kupa/futbol
// ödül teması), bu da tek renkli monotonluğu kırıyor.


export const COLORS = {
  bg: "#0B1620",
  card: "#16222E",
  cardBorder: "#28394B",
  border: "#28394B",
  text: "#F3F7FA",
  textMuted: "#8CA0B3",
  textFaint: "#56697A",
  accent: "#7CFF5C", // ana vurgu — çim yeşili
  accentDark: "#0B1620", // vurgu üzerindeki metin
  cta: "#FFB020", // ikincil vurgu / harekete geçirici butonlar
  ctaDark: "#3D2600",
  success: "#FFD93D",
  successDark: "#3D2E00",
  danger: "#FF5D5D",
  dangerDark: "#450000",
  overlay: "rgba(0,0,0,0.8)",
};

// Mod kategorilerine göre vurgu renkleri — HomeScreen ve mod kartlarında tekrar kullanılır.
export const MODE_COLORS = {
  online: { main: "#FFB020", dark: "#3D2600" },
  // 12 Eylül 2026: bu `dark` değeri COLORS.bg ile BİREBİR AYNIYDI. OynaScreen
  // kart dolgusunu buradan aldığı için "Ortak Kulüp" — oyunun ana modu —
  // ızgaradaki tek dolgusuz kart olarak, boş bir çerçeve gibi duruyordu.
  teamTeam: { main: "#7CFF5C", dark: "#0E2A18" },
  teamCountry: { main: "#7DD3FC", dark: "#0C3A52" },
  letters: { main: "#A78BFA", dark: "#4C1D95" },
  whoAmI: { main: "#C084FC", dark: "#3B0764" },
  training: { main: "#FF5D5D", dark: "#450000" },
  hotSeat: { main: "#FFD93D", dark: "#3D2E00" },
  fiveClubs: { main: "#FF8FA3", dark: "#4A0E1E" },
  encyclopedia: { main: "#60A5FA", dark: "#1E3A8A" },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 999,
};

export const TYPE = {
  display: { fontSize: 44, fontWeight: "900", letterSpacing: -1.5, color: COLORS.text },
  h1: { fontSize: 26, fontWeight: "900", color: COLORS.text },
  h2: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  h3: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  eyebrow: { fontSize: 13, fontWeight: "800", letterSpacing: 2, color: COLORS.accent, textTransform: "uppercase" },
  body: { fontSize: 15, fontWeight: "500", color: COLORS.text, lineHeight: 22 },
  bodyMuted: { fontSize: 13, fontWeight: "500", color: COLORS.textMuted, lineHeight: 19 },
  caption: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
  button: { fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
};

export const SHADOW = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
};
