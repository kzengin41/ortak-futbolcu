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
  // 26 Eylül 2026 — DENETİM BULGUSU: "Futbolcu XOX" kartı colorKey olarak
  // "hotSeat" kullanıyordu, yani "Tek Telefon 2 Kişi" ile BİREBİR aynı renkte
  // görünüyordu. Ana menüde 8 kartı birbirinden ayıran tek güçlü ipucu renk
  // olduğu için bu, iki farklı modu görsel olarak aynı yapıyordu.
  xox: { main: "#34D399", dark: "#06342A" },
  dailyPuzzle: { main: "#F472B6", dark: "#4A0E2E" },
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

// ---------------------------------------------------------------------------
// TEMALAR — 26 Eylül 2026 (Kerem: "temalar eklemek istiyorum ayarlara.
// default yeşil tema, alternatif bir tema daha, koyu tema, GS-FB-BJK-TS-özel
// temaları olsun")
//
// NASIL ÇALIŞIYOR — ve NİYE BÖYLE:
// Ekranlar renkleri `StyleSheet.create({ ... COLORS.accent ... })` içinde
// kullanıyor. StyleSheet.create DEĞERİ O ANDA KOPYALAR — yani modül
// yüklendiğinde renk taşa kazınır. Bu yüzden tema değişimi için iki yol var:
//   (a) 597 kullanımı tek tek render-zamanı okumaya çevirmek (31 dosya),
//   (b) COLORS nesnesini ekranlar yüklenmeden ÖNCE değiştirmek.
// (b) seçildi: index.js (uygulamanın giriş noktası) önce kayıtlı temayı
// okuyup temayiUygula() çağırıyor, App.js'i ANCAK ONDAN SONRA require
// ediyor. Böylece tek satır ekran kodu değişmeden bütün uygulama temalanıyor.
// BEDELİ: tema değişikliği anında değil, uygulama yeniden AÇILDIĞINDA
// görünür. Ayarlar ekranı bunu açıkça yazıyor. (expo-updates kurulu olsaydı
// reloadAsync() ile otomatik yeniden başlatılabilirdi; projede yok.)
//
// TASARIM KURALI: bütün temalar KOYU yüzey üzerine kurulu. Takım temalarında
// değişen şey vurgu renkleri ve yüzeylerin hafif renk tonu — açık (light)
// tema yapmak 31 dosyada kontrast denetimi gerektirirdi, bu ayrı bir iş.
// Her paletin accent/accentDark çifti buton üstü yazının okunması için
// bilerek zıt seçildi.

const VARSAYILAN_PALET = { ...COLORS };

// Mod kartı renkleri de temaya uyuyor (26 Eylül 2026 — Kerem: "moddaki
// renkler çok saçma olmuş"). Takım temasında kartlar gökkuşağı gibi kalınca
// takım zemininin üstünde yabancı duruyordu. Kural: `main` AÇIK ton (çerçeve,
// ikon dairesi, başlık rengi), `dark` takımın KOYU tonu (kart dolgusu).
// Böylece ikon (accentDark) her zaman açık bir daire üstünde okunuyor.
const VARSAYILAN_MOD_RENKLERI = Object.fromEntries(
  Object.entries(MODE_COLORS).map(([k, v]) => [k, { ...v }])
);

export const PALETLER = [
  {
    id: "cim",
    ad: "Çim Yeşili",
    aciklama: "Varsayılan — gece stadyumu",
    renkler: {},                       // VARSAYILAN_PALET aynen
    onizleme: ["#0B1620", "#7CFF5C", "#FFB020"],
  },
  {
    id: "gece",
    ad: "Gece Mavisi",
    aciklama: "Daha serin, mavi vurgulu alternatif",
    renkler: {
      bg: "#0A1028", card: "#141B3A", cardBorder: "#2A3465", border: "#2A3465",
      text: "#EEF2FF", textMuted: "#9AA6D2", textFaint: "#5E6A9B",
      accent: "#5EA8FF", accentDark: "#06122B",
      cta: "#FFB020", ctaDark: "#3D2600",
    },
    onizleme: ["#0A1028", "#5EA8FF", "#FFB020"],
  },
  {
    id: "koyu",
    ad: "Koyu",
    aciklama: "Siyah zemin — OLED ekranlarda pil dostu",
    renkler: {
      bg: "#000000", card: "#0E0E0E", cardBorder: "#262626", border: "#262626",
      text: "#F5F5F5", textMuted: "#9A9A9A", textFaint: "#5C5C5C",
      accent: "#8BE9A0", accentDark: "#04120A",
      cta: "#E0C070", ctaDark: "#241B08",
    },
    onizleme: ["#000000", "#8BE9A0", "#E0C070"],
  },
  {
    id: "gs",
    ad: "Galatasaray",
    aciklama: "Sarı–kırmızı",
    // 26 Eylül 2026 (Kerem: "galatasaray belçika gibi") — ilk sürümde zemin
    // SİYAHTI (#150A0C): siyah + sarı + kırmızı üç düz renk = Belçika bayrağı.
    // Kulüp kimliği vurgudan değil ZEMİNDEN gelir. Artık yüzeyler koyu
    // Galatasaray kırmızısı, vurgular sarı.
    renkler: {
      bg: "#1F050D", card: "#360A18", cardBorder: "#6B1629", border: "#6B1629",
      text: "#FFF5E6", textMuted: "#E8B9AE", textFaint: "#A67A72",
      accent: "#FDB913", accentDark: "#2A0510",
      cta: "#E30A17", ctaDark: "#FFF5E6",
      danger: "#FF8A8A",
    },
    onizleme: ["#360A18", "#FDB913", "#E30A17"],
    modRenkleri: {
      online:       { main: "#FDB913", dark: "#5A0B1B" },
      teamTeam:     { main: "#FFD25A", dark: "#7A0F24" },
      teamCountry:  { main: "#FF8A7A", dark: "#4E0816" },
      letters:      { main: "#FFC940", dark: "#6A1420" },
      whoAmI:       { main: "#FFA38F", dark: "#5C0A1C" },
      training:     { main: "#F7B32B", dark: "#7F1127" },
      hotSeat:      { main: "#FFE08A", dark: "#4A0714" },
      fiveClubs:    { main: "#FF9C7A", dark: "#6E1122" },
      encyclopedia: { main: "#FDB913", dark: "#3F0610" },
      xox:          { main: "#FFB870", dark: "#641020" },
      dailyPuzzle:  { main: "#FFD700", dark: "#560A1A" },
    },
  },
  {
    id: "fb",
    ad: "Fenerbahçe",
    aciklama: "Sarı–lacivert",
    // 26 Eylül 2026 (Kerem: "fenerbahçe ukrayna gibi") — ilk sürümde ikincil
    // renk AÇIK MAVİ (#4A90D9) seçilmişti: sarı + açık mavi = Ukrayna bayrağı.
    // Fenerbahçe'nin rengi LACİVERT (koyu), açık mavi değil. Artık yüzeyler
    // lacivert, vurgu sarı, ikincil renk armadaki beyaz. Açık mavi hiçbir
    // yerde yok.
    renkler: {
      bg: "#04112B", card: "#0A1E47", cardBorder: "#1D3B75", border: "#1D3B75",
      text: "#F5F8FF", textMuted: "#AAB9DA", textFaint: "#6B7CA3",
      accent: "#FFED00", accentDark: "#04112B",
      cta: "#FFFFFF", ctaDark: "#04112B",
    },
    onizleme: ["#0A1E47", "#FFED00", "#FFFFFF"],
    modRenkleri: {
      online:       { main: "#FFED00", dark: "#0B2150" },
      teamTeam:     { main: "#FFFFFF", dark: "#10285E" },
      teamCountry:  { main: "#FFD400", dark: "#0A1C44" },
      letters:      { main: "#E8EEFA", dark: "#13306B" },
      whoAmI:       { main: "#FFE34D", dark: "#0D2556" },
      training:     { main: "#FFF4A3", dark: "#0E2A62" },
      hotSeat:      { main: "#FFFFFF", dark: "#09193D" },
      fiveClubs:    { main: "#FFC700", dark: "#122C66" },
      encyclopedia: { main: "#F2F5FC", dark: "#0B1F4A" },
      xox:          { main: "#FFDF1A", dark: "#102B63" },
      dailyPuzzle:  { main: "#FFF27A", dark: "#0A1B42" },
    },
  },
  {
    id: "bjk",
    ad: "Beşiktaş",
    aciklama: "Siyah–beyaz",
    renkler: {
      bg: "#070707", card: "#141414", cardBorder: "#303030", border: "#303030",
      text: "#FFFFFF", textMuted: "#A8A8A8", textFaint: "#6A6A6A",
      accent: "#FFFFFF", accentDark: "#000000",
      cta: "#9E9E9E", ctaDark: "#0A0A0A",
    },
    onizleme: ["#070707", "#FFFFFF", "#9E9E9E"],
    modRenkleri: {
      online:       { main: "#FFFFFF", dark: "#1E1E1E" },
      teamTeam:     { main: "#E0E0E0", dark: "#2A2A2A" },
      teamCountry:  { main: "#FFFFFF", dark: "#333333" },
      letters:      { main: "#CFCFCF", dark: "#1A1A1A" },
      whoAmI:       { main: "#F5F5F5", dark: "#262626" },
      training:     { main: "#D6D6D6", dark: "#2E2E2E" },
      hotSeat:      { main: "#FFFFFF", dark: "#222222" },
      fiveClubs:    { main: "#E8E8E8", dark: "#363636" },
      encyclopedia: { main: "#C7C7C7", dark: "#1C1C1C" },
      xox:          { main: "#FFFFFF", dark: "#2C2C2C" },
      dailyPuzzle:  { main: "#EDEDED", dark: "#242424" },
    },
  },
  {
    id: "ts",
    ad: "Trabzonspor",
    aciklama: "Bordo–mavi",
    // 26 Eylül 2026 — GS/FB ile aynı ders: zemin artık bordo, vurgu mavi.
    renkler: {
      bg: "#1A0611", card: "#2E0B1D", cardBorder: "#5E1A37", border: "#5E1A37",
      text: "#FFF3F8", textMuted: "#D9AABD", textFaint: "#9A6E80",
      accent: "#5BC2F0", accentDark: "#1A0611",
      cta: "#B8234F", ctaDark: "#FFF3F8",
    },
    onizleme: ["#2E0B1D", "#5BC2F0", "#B8234F"],
    modRenkleri: {
      online:       { main: "#7FD0F5", dark: "#4A1027" },
      teamTeam:     { main: "#F4A6C0", dark: "#0A3550" },
      teamCountry:  { main: "#9BDBF7", dark: "#5A1430" },
      letters:      { main: "#F7B8CC", dark: "#0C3A57" },
      whoAmI:       { main: "#6CC7F2", dark: "#4F1229" },
      training:     { main: "#F29CB8", dark: "#0B3048" },
      hotSeat:      { main: "#B3E4F9", dark: "#561330" },
      fiveClubs:    { main: "#EE8FAE", dark: "#0E3B58" },
      encyclopedia: { main: "#86D3F5", dark: "#461026" },
      xox:          { main: "#F5ADC4", dark: "#0A3350" },
      dailyPuzzle:  { main: "#5BC2F0", dark: "#5C1532" },
    },
  },
  {
    id: "ozel",
    ad: "Özel",
    aciklama: "Vurgu renklerini kendin seç",
    renkler: {},                       // ozelRenkler ile doldurulur
    onizleme: ["#0B1620", "#7CFF5C", "#FFB020"],
  },
];

// "Özel" temada seçilebilen renkler. Hazır bir renk seçici kütüphane
// EKLENMEDİ (yeni bağımlılık = yeni derleme riski); bunun yerine kontrastı
// önceden denetlenmiş bir ızgara sunuluyor. Her rengin yanındaki "koyu"
// değeri, o rengin üstüne yazılacak metnin rengi.
export const OZEL_VURGULAR = [
  { renk: "#7CFF5C", koyu: "#0B1620", ad: "Çim" },
  { renk: "#5EA8FF", koyu: "#06122B", ad: "Mavi" },
  { renk: "#FDB913", koyu: "#2B0A00", ad: "Sarı" },
  { renk: "#FF6B6B", koyu: "#2A0000", ad: "Kırmızı" },
  { renk: "#C084FC", koyu: "#1E0630", ad: "Mor" },
  { renk: "#FF8FA3", koyu: "#3A0713", ad: "Pembe" },
  { renk: "#2DD4BF", koyu: "#04201D", ad: "Turkuaz" },
  { renk: "#FFFFFF", koyu: "#000000", ad: "Beyaz" },
  { renk: "#F97316", koyu: "#2A1000", ad: "Turuncu" },
  { renk: "#A3E635", koyu: "#121E02", ad: "Fıstık" },
  { renk: "#38BDF8", koyu: "#04202E", ad: "Gök" },
  { renk: "#FDE047", koyu: "#241E00", ad: "Limon" },
];

export const OZEL_IKINCILLER = [
  { renk: "#FFB020", koyu: "#3D2600", ad: "Altın" },
  { renk: "#E01E37", koyu: "#FFF1F1", ad: "Kırmızı" },
  { renk: "#4A90D9", koyu: "#04101F", ad: "Mavi" },
  { renk: "#22C55E", koyu: "#032012", ad: "Yeşil" },
  { renk: "#A855F7", koyu: "#1B0530", ad: "Mor" },
  { renk: "#9E9E9E", koyu: "#0A0A0A", ad: "Gri" },
];

export function paletBul(id) {
  return PALETLER.find((p) => p.id === id) || PALETLER[0];
}

// COLORS ve TYPE'ı YERİNDE değiştirir. Nesne kimliği korunur — bu ŞART,
// çünkü bütün dosyalar aynı nesneyi import ediyor; yenisiyle değiştirmek
// eski referansları eskide bırakırdı.
export function temayiUygula(id, ozel) {
  const palet = paletBul(id);
  let renkler = { ...VARSAYILAN_PALET, ...(palet.renkler || {}) };

  if (id === "ozel" && ozel) {
    if (ozel.accent) renkler.accent = ozel.accent;
    if (ozel.accentDark) renkler.accentDark = ozel.accentDark;
    if (ozel.cta) renkler.cta = ozel.cta;
    if (ozel.ctaDark) renkler.ctaDark = ozel.ctaDark;
  }

  Object.assign(COLORS, renkler);

  // Mod renkleri: her girdi YERİNDE güncelleniyor (nesne kimliği korunur).
  // Bazı ekranlar `const VURGU = MODE_COLORS.letters` diye girdinin kendisini
  // tutuyor — girdiyi yeni bir nesneyle değiştirmek o referansı eskide bırakırdı.
  const modlar = palet.modRenkleri || {};
  for (const [anahtar, varsayilan] of Object.entries(VARSAYILAN_MOD_RENKLERI)) {
    const hedef = MODE_COLORS[anahtar];
    if (!hedef) continue;
    const yeni = modlar[anahtar] || varsayilan;
    hedef.main = yeni.main;
    hedef.dark = yeni.dark;
  }

  // TYPE renkleri de modül yüklenirken kopyalanmıştı — tazelenmesi şart,
  // yoksa başlıklar eski temanın metin rengiyle kalır.
  TYPE.display.color = COLORS.text;
  TYPE.h1.color = COLORS.text;
  TYPE.h2.color = COLORS.text;
  TYPE.h3.color = COLORS.text;
  TYPE.body.color = COLORS.text;
  TYPE.bodyMuted.color = COLORS.textMuted;
  TYPE.caption.color = COLORS.textMuted;
  TYPE.eyebrow.color = COLORS.accent;

  return COLORS;
}
