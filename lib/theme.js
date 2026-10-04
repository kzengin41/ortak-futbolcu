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


// Paket 18 (5 Ekim 2026, Kerem: "default arkaplan yeşil saha olduğu için
// default tema buna uygun olmalı" + "mod tahtalarının kendine has renkleri
// aşırı göz yoruyor") — varsayılan palet "Saha": yüzeyler lacivert değil koyu
// yeşil-gri (zemindeki çimle aynı aile, ama doygunluğu düşük: 31 Ağustos'taki
// "her yer yeşil" hatasına dönmemek için yeşil yalnız ZEMİNDE ve VURGUDA).
// Üçüncü ton (ucuncu) eklendi: mod renkleri artık 11 ayrı renk değil, 3 ton.
export const COLORS = {
  bg: "#0B1712",
  card: "#13221B",
  cardBorder: "#24382D",
  border: "#24382D",
  text: "#EEF5F0",
  textMuted: "#93AA9C",
  textFaint: "#5B7065",
  accent: "#8BE15B", // ana vurgu — çim yeşili
  accentDark: "#08150E", // vurgu üzerindeki metin
  cta: "#E9C46A", // ikincil vurgu / harekete geçirici butonlar
  ctaDark: "#2A2006",
  ucuncu: "#A9C7B6", // üçüncü ton (arkadaşla / günlük modlar)
  ucuncuDark: "#0B1712",
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

// Paket 18 — mod renkleri temadan TÜRETİLİYOR (temayiUygula): her mod üç
// gruptan birine ait, grubun tonu = temanın accent / cta / ucuncu rengi.
//   main: ikon karosu, çerçeve, vurgu   ·   dark: hafif tonlu kart dolgusu
//   ust:  main'in üstündeki ikon/yazı rengi
// Yukarıdaki sabit değerler yalnızca modül ilk yüklenirken geçerli; index.js
// açılışta temayiUygula'yı çağırıp hepsini bu kurala göre yeniden yazıyor.
export const MOD_GRUBU = {
  online: "accent", teamTeam: "accent", teamCountry: "accent", fiveClubs: "accent", xox: "accent",
  letters: "cta", whoAmI: "cta", training: "cta", encyclopedia: "cta",
  hotSeat: "ucuncu", dailyPuzzle: "ucuncu",
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

// İki rengi karıştırır (oran 0 → a, 1 → b). Mod kartlarının hafif tonlu
// dolgusu ve özel temada üçüncü ton için.
export function renkKaristir(a, b, oran) {
  const h = (x) => { const n = parseInt(String(x).slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const [r1, g1, b1] = h(a), [r2, g2, b2] = h(b);
  const k = (x, y) => Math.round(x + (y - x) * oran).toString(16).padStart(2, "0");
  return `#${k(r1, r2)}${k(g1, g2)}${k(b1, b2)}`;
}

// Paket 18 — saydam renk (arkaplan gradyanları için).
export function saydam(hex, alfa) {
  const n = parseInt(String(hex).slice(1, 7), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alfa})`;
}

export const PALETLER = [
  {
    id: "cim",
    ad: "Saha",
    aciklama: "Varsayılan — yeşil saha",
    renkler: {},                       // VARSAYILAN_PALET aynen
    onizleme: ["#13221B", "#8BE15B", "#E9C46A"],
    arka: "saha",
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
      ucuncu: "#B7C3EA", ucuncuDark: "#0A1028",
    },
    onizleme: ["#141B3A", "#5EA8FF", "#FFB020"],
    arka: "notr",
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
      ucuncu: "#A8A8A8", ucuncuDark: "#000000",
    },
    onizleme: ["#0E0E0E", "#8BE9A0", "#E0C070"],
    arka: "notr",
  },
  {
    id: "gs",
    ad: "Galatasaray",
    aciklama: "Sarı–kırmızı",
    // 26 Eylül 2026 (Kerem: "galatasaray belçika gibi") — kulüp kimliği
    // vurgudan değil ZEMİNDEN gelir: yüzeyler koyu Galatasaray kırmızısı.
    renkler: {
      bg: "#1F050D", card: "#33091A", cardBorder: "#5E1427", border: "#5E1427",
      text: "#FFF5E6", textMuted: "#E2B6AB", textFaint: "#A67A72",
      accent: "#FDB913", accentDark: "#2A0510",
      cta: "#F06A5E", ctaDark: "#2A0510",
      ucuncu: "#F3D9A4", ucuncuDark: "#2A0510",
      danger: "#FF8A8A",
    },
    onizleme: ["#33091A", "#FDB913", "#F06A5E"],
    arka: "gs",
  },
  {
    id: "fb",
    ad: "Fenerbahçe",
    aciklama: "Sarı–lacivert",
    // 26 Eylül 2026 (Kerem: "fenerbahçe ukrayna gibi") — açık mavi YOK, lacivert.
    renkler: {
      bg: "#04112B", card: "#0A1D45", cardBorder: "#1B3870", border: "#1B3870",
      text: "#F5F8FF", textMuted: "#AAB9DA", textFaint: "#6B7CA3",
      accent: "#FFE11A", accentDark: "#04112B",
      cta: "#FFFFFF", ctaDark: "#04112B",
      ucuncu: "#9FB4E0", ucuncuDark: "#04112B",
    },
    onizleme: ["#0A1D45", "#FFE11A", "#FFFFFF"],
    arka: "fb",
  },
  {
    id: "bjk",
    ad: "Beşiktaş",
    aciklama: "Siyah–beyaz",
    renkler: {
      bg: "#080808", card: "#151515", cardBorder: "#2E2E2E", border: "#2E2E2E",
      text: "#FFFFFF", textMuted: "#A6A6A6", textFaint: "#6A6A6A",
      accent: "#FFFFFF", accentDark: "#000000",
      cta: "#BDBDBD", ctaDark: "#000000",
      ucuncu: "#7E7E7E", ucuncuDark: "#000000",
    },
    onizleme: ["#151515", "#FFFFFF", "#BDBDBD"],
    arka: "bjk",
  },
  {
    id: "ts",
    ad: "Trabzonspor",
    aciklama: "Bordo–mavi",
    renkler: {
      bg: "#1A0611", card: "#2C0B1C", cardBorder: "#561934", border: "#561934",
      text: "#FFF3F8", textMuted: "#D5A9BB", textFaint: "#9A6E80",
      accent: "#6CC4EE", accentDark: "#14050D",
      cta: "#E07A9B", ctaDark: "#14050D",
      ucuncu: "#E8B7C8", ucuncuDark: "#14050D",
    },
    onizleme: ["#2C0B1C", "#6CC4EE", "#E07A9B"],
    arka: "ts",
  },
  {
    id: "ozel",
    ad: "Özel",
    aciklama: "Vurgu renklerini kendin seç",
    renkler: {},                       // ozelRenkler ile doldurulur
    onizleme: ["#13221B", "#8BE15B", "#E9C46A"],
    arka: "notr",
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
    // 4 Ekim 2026 — tema oluşturucu (components/TemaOlusturucu.js) tam palet
    // kaydediyor: zemin ailesi + vurgu + ikincil + buton üstü yazı renkleri.
    if (ozel.palet && typeof ozel.palet === "object") Object.assign(renkler, ozel.palet);
    if (ozel.accent) renkler.accent = ozel.accent;
    if (ozel.accentDark) renkler.accentDark = ozel.accentDark;
    if (ozel.cta) renkler.cta = ozel.cta;
    if (ozel.ctaDark) renkler.ctaDark = ozel.ctaDark;
  }

  // Özel temada üçüncü ton verilmemişse: soluk yazı rengi ile vurgunun karışımı.
  if (!(palet.renkler || {}).ucuncu && !(ozel && ozel.palet && ozel.palet.ucuncu) && id !== "cim") {
    renkler.ucuncu = renkKaristir(renkler.textMuted, renkler.accent, 0.25);
    renkler.ucuncuDark = renkler.bg;
  }
  Object.assign(COLORS, renkler);

  // Mod renkleri (Paket 18): her girdi YERİNDE güncelleniyor (nesne kimliği
  // korunur — bazı ekranlar `const VURGU = MODE_COLORS.letters` diye tutuyor).
  for (const [anahtar, hedef] of Object.entries(MODE_COLORS)) {
    const grup = MOD_GRUBU[anahtar] || "accent";
    hedef.main = COLORS[grup];
    hedef.ust = COLORS[grup + "Dark"];
    hedef.dark = renkKaristir(COLORS.card, COLORS[grup], 0.14);
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

// Paket 18 — modül yüklenirken de mod renkleri 3 ton kuralına otursun
// (index.js kayıtlı temayı birazdan yeniden uygular; testler ve ilk kare için).
temayiUygula("cim");
