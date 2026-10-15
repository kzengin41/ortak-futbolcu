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
// Paket 22 (5 Ekim 2026, Kerem: "temalarda arkaplan ile neredeyse birebir aynı
// renk paleti olduğu için yine çok çirkin olmuş. tüm temaların elden geçmesi
// gerekiyor") — KÖK NEDEN: kart rengi zeminin rengiyle aynı aileden ve ondan
// yalnız %3-4 açıktı (#0B1712 → #13221B); zemin de arkaplanı %50-97 örtüyordu.
// Ekranın her katmanı tek renge eriyordu. YENİ KURAL (bütün temalar):
//   • ZEMİN (bg)   = takımın/temanın rengi, koyu. Arkaplan görseline bindirilir.
//   • YÜZEY (card) = NÖTR grafit (renk tonu çok az), zeminden belirgin AÇIK.
//                    Kart, takım renkli zeminin üstünde ayrı bir katman gibi durur.
//   • ÇERÇEVE      = yüzeyden bir kademe açık; vurgu renkleri yalnız ikon,
//                    buton ve çizgilerde.
//   • Arkaplan örtüsü hafifledi: sahanın kendisi daha çok görünüyor.
// Paket 30 (14 Ekim 2026, Kerem: "bu yeni temalar da çok kötü olmuş. gs temasının
// gs ile alakası yok gibi") — "FORMA" SİSTEMİ, bkz. scripts/tema_uret.py.
// Paket 24'ün kökten hatası: yüzeyler kulübün tonunda ama DÜŞÜK doygunluktaydı;
// GS kartı #402322 = kırmızı değil kahverengi. Kulübün gerçek rengi ekranda yoktu.
// YENİ: iki katman.
//   • KİMLİK (marka, marka2, desen): kulübün GERÇEK renkleri tam doygunlukta, az
//     ama büyük yerde — arkaplan ışığı + forma deseni, vitrin kartı, ana buton,
//     seçili sekme. Soldurulmaz.
//   • OKUMA (bg, card, cardBorder, text…): nötre yakın koyu (OKLCH kroma ≤ .016),
//     kulübün tonundan çok hafif ısı. Kimliğe rakip olmaz, çamura dönmez.
// Paket 33 (15 Ekim 2026, Kerem: "temalardaki kahverengi… GS ile alakası yok, arkaplanla
// zıtlık yok") — Paket 30'un "nötre yakın ama kulüp tonundan hafif ısı" yüzeyi kırmızı
// kulüplerde KAHVERENGİYDİ (soluk + koyu + kırmızı-turuncu ton = kahve). YENİ: yüzeyler
// ya gerçekten renkli (GS şarap kırmızısı, FB gece laciverti, TS bordo, Saha orman)
// ya gerçekten nötr (BJK, Koyu); kahve bandı (h 20–110, düşük kroma) üretici ve
// vurguZemini() tarafından engelleniyor. Kart/zemin açıklık farkı .13. Ayrıntı:
// scripts/tema_uret.py başı.
// Aşağıdaki Paket 24 notu tarih için duruyor.
// Paket 24 (12 Ekim 2026, Kerem: "temalar hala çok güzel değil. uyum yok.")
// KÖK NEDEN: Paket 22'de kartlar her temada NÖTR GRAFİT yapılmıştı. Grafit
// mavimsi gri (ton 240°) — yeşil sahada, kırmızı GS zemininde, bordo TS
// zemininde hep "başka bir temadan gelmiş" gibi duruyordu; üstüne vurgu,
// ikincil ve üçüncü renkler de birbirinden bağımsız seçilmişti (Saha'da
// yeşil + altın + açık mavi + mavi-gri kart = dört ayrı renk ailesi).
// YENİ KURAL (OKLCH ile hesaplandı, bkz. scripts/tema_uret.py):
//   • Yüzeyler TEK TONDAN: zemin, kart, çerçeve, yazılar aynı renk tonunun
//     farklı açıklıkları (Paket 25: zemin L .15 · kart L .295 · çerçeve L .41 — kart/zemin kontrastı 1.26 → 1.42). Kart
//     zeminden belirgin açık (Paket 22'deki "kart zemine eriyor" sorunu yok)
//     ama aynı aileden — uyum buradan geliyor.
//   • Vurgular aynı parlaklık bandında (L .8-.9): takımın iki rengi + bunlara
//     komşu, yumuşak bir üçüncü ton. Buton üstü yazı = vurgunun en koyu tonu.
export const COLORS = {
  // Paket 30 — "Forma" sistemi (scripts/tema_uret.py). OKUMA katmanı: nötre yakın koyu.
  bg: "#020704",
  tabBar: "#06100A",       // alt sekme çubuğu
  card: "#13261C",
  cardBorder: "#2B4034",
  border: "#2B4034",
  text: "#F5F7F6",
  textMuted: "#BBC3BE",
  textFaint: "#868F8A",
  accent: "#86E36B", // ana eylem rengi — butonlar, seçili sekme, ikonlar
  accentDark: "#17602F", // vurgu üzerindeki metin
  cta: "#F5CC58", // ikincil vurgu
  ctaDark: "#181100",
  ucuncu: "#BADDB1", // üçüncü ton — sakin
  ucuncuDark: "#020704",
  // KİMLİK katmanı (Paket 30): kulübün/temanın GERÇEK rengi — büyük dolgular
  // (vitrin kartı, arkaplan ışığı, forma deseni). Yazı/ikon rengi olarak kullanma.
  marka: "#17602F",
  marka2: "#F4F7F2",       // ikinci renk (forma deseninin öbür rengi)
  markaUst: "#FFFFFF",   // marka dolgusu üstündeki yazı
  desen: "cim",         // forma motifi: cim | parcali | cubuklu | isik
  success: "#FFD93D",
  successDark: "#3D2E00",
  danger: "#FF5D5D",
  dangerDark: "#450000",
  overlay: "rgba(0,0,0,0.8)",
  acik: false,           // Paket 34: açık (gündüz) tema mı — StatusBar, gölge, rozet tonları
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

// WCAG bağıl parlaklık oranı (1 = aynı, 21 = siyah/beyaz).
export function parlaklikOrani(a, b) {
  const L = (x) => {
    const n = parseInt(String(x).slice(1, 7), 16);
    const k = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
  };
  const [p, q] = [L(a), L(b)].sort((x, y) => y - x);
  return (p + 0.05) / (q + 0.05);
}

// Paket 24 — "sade ikon karosu": renk yalnız ikonda ve ince çerçevede, karo
// dolgusu rengin %16'sı. Ekranda tek dolu parlak alan ana buton kalır; mod
// kartlarındaki 6-8 parlak kare göz yormaz, tema renkleri birbiriyle yarışmaz.
export function yumusakKaro(renk) {
  return { backgroundColor: vurguZemini(0.16, renk), borderWidth: 1.5, borderColor: saydam(renk, 0.45) };
}

// ---------------------------------------------------------------------------
// Paket 33 (15 Ekim 2026, Kerem: "temalardaki kahverengi… GS ile alakası yok")
// KAHVE BEKÇİSİ. Koyu bir yüzeyin üstüne saydam SARI (GS/FB vurgusu) bindirince
// karışım koyu-soluk turuncu/zeytin = kahverengi oluyordu (ikon karoları, "OYNA"
// hapı, seçili sekme hapı, seçili çip). Kural: bir vurgu tonu yüzeyle karışınca
// kahve bandına (OKLCH h 20–110, düşük kroma, koyu) düşüyorsa, yumuşak zemin
// vurgunun değil BEYAZIN saydamı olur; renk ikon/yazı/çerçevede kalır.
export function _oklch(hex) {
  const n = parseInt(String(hex).slice(1, 7), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s2 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2;
  return [L, Math.hypot(a, bb), (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360];
}
export function kahveMi(hex) {
  const [L, C, h] = _oklch(hex);
  return L < 0.6 && C > 0.008 && C < 0.13 && h >= 20 && h <= 110;
}
// Çamur: iki zıt renk (lacivert + sarı) karışınca kroma çöker → kirli gri.
function camurMu(karisim, zemin) {
  const cz = _oklch(zemin)[1];
  return cz > 0.03 && _oklch(karisim)[1] < cz * 0.6;
}
// Vurgu renginin "yumuşak zemin" hâli (seçili çip, ikon karosu, rozet zemini).
export function vurguZemini(alfa = 0.14, renk = COLORS.accent) {
  const karisim = renkKaristir(COLORS.card, renk, alfa);
  return kahveMi(karisim) || camurMu(karisim, COLORS.card) ? saydam(COLORS.text, Math.min(0.13, alfa * 0.6 + 0.03)) : saydam(renk, alfa);
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
    onizleme: ["#13261C", "#17602F", "#86E36B"],
    arka: "desen",
  },
  {
    id: "gece",
    ad: "Gece Mavisi",
    aciklama: "Daha serin, mavi vurgulu alternatif",
    renkler: {
      bg: "#020515", tabBar: "#050B22", card: "#101F45", cardBorder: "#273864", border: "#273864",
      text: "#F5F7FB", textMuted: "#B8C1D4", textFaint: "#848C9E",
      accent: "#6EB6FF", accentDark: "#1A3A8F", cta: "#FDBA55", ctaDark: "#1B0F00",
      ucuncu: "#B5D5F6", ucuncuDark: "#020515",
      marka: "#1A3A8F", marka2: "#FFFFFF", markaUst: "#FFFFFF", desen: "isik",
    },
    onizleme: ["#101F45", "#1A3A8F", "#6EB6FF"],
    arka: "desen",
  },
  {
    id: "koyu",
    ad: "Koyu",
    aciklama: "Siyah zemin — OLED ekranlarda pil dostu",
    renkler: {
      bg: "#000000", tabBar: "#0B0B0B", card: "#1E1E1E", cardBorder: "#383838", border: "#383838",
      text: "#F7F7F7", textMuted: "#C1C1C1", textFaint: "#8C8C8C",
      accent: "#7EE8B0", accentDark: "#26292D", cta: "#E8C987", ctaDark: "#191000",
      ucuncu: "#B2DDC4", ucuncuDark: "#000000",
      marka: "#26292D", marka2: "#FFFFFF", markaUst: "#FFFFFF", desen: "isik",
    },
    onizleme: ["#1E1E1E", "#26292D", "#7EE8B0"],
    arka: "desen",
  },
  {
    // Paket 34 (15 Ekim 2026, Kerem: "bir de açık (gündüz) tema ekle") — GÜNDÜZ.
    // Elle tasarlandı, WCAG ölçüldü (t49): yazı/kart 18.5, soluk 7.6, en soluk 4.7,
    // vurgu/kart 5.4, beyaz/vurgu 5.4, sarı "3-2-1"/vitrin 4.7. Zemin serin açık gri
    // (sıcak bej → kahveye kaçar), kartlar beyaz, kimlik saha yeşili.
    id: "gunduz",
    ad: "Gündüz",
    aciklama: "Açık tema — güneşte okunur",
    renkler: {
      bg: "#EEF1F5", tabBar: "#FFFFFF", card: "#FFFFFF", cardBorder: "#D9DFE7", border: "#D9DFE7",
      text: "#0F141A", textMuted: "#4B5563", textFaint: "#6B7480",
      accent: "#0E7A3A", accentDark: "#FFFFFF", cta: "#C2410C", ctaDark: "#FFFFFF",
      ucuncu: "#0369A1", ucuncuDark: "#FFFFFF",
      marka: "#0E6B34", marka2: "#FFD54A", markaUst: "#FFFFFF", desen: "cim",
      success: "#B7791F", successDark: "#FFFFFF", danger: "#C62828", dangerDark: "#FFFFFF",
      overlay: "rgba(15,20,26,0.55)", acik: true,
    },
    onizleme: ["#FFFFFF", "#0E6B34", "#0E7A3A"],
    arka: "desen",
  },
  {
    id: "gs",
    ad: "Galatasaray",
    aciklama: "Sarı–kırmızı",
    // Paket 30: GS kırmızısı PMS 187 #A90432 + sarı PMS 123 #FDB912, GERÇEK değerleriyle.
    // Ana buton sarı, üstündeki yazı GS kırmızısı; vitrin kartı kırmızı + parçalı forma.
    renkler: {
      bg: "#140003", tabBar: "#200209", card: "#420619", cardBorder: "#622031", border: "#622031",
      text: "#FBF5F6", textMuted: "#D4B9BD", textFaint: "#9E8488",
      accent: "#FDB912", accentDark: "#A90432", cta: "#ED5768", ctaDark: "#230609",
      ucuncu: "#E9CD9D", ucuncuDark: "#140003",
      marka: "#A90432", marka2: "#FDB912", markaUst: "#FFFFFF", desen: "parcali",
      danger: "#FF8A8A",
    },
    onizleme: ["#420619", "#A90432", "#FDB912"],
    arka: "desen",
  },
  {
    id: "fb",
    ad: "Fenerbahçe",
    aciklama: "Sarı–lacivert",
    // 26 Eylül 2026 (Kerem: "fenerbahçe ukrayna gibi") — açık mavi YOK, lacivert.
    // Paket 30: sarı buton üstünde lacivert yazı; vitrin kartı lacivert + çubuklu forma.
    renkler: {
      bg: "#010417", tabBar: "#030B23", card: "#0D1F47", cardBorder: "#233866", border: "#233866",
      text: "#F4F7FB", textMuted: "#B7C1D5", textFaint: "#838C9F",
      accent: "#FFE500", accentDark: "#0C2659", cta: "#7192CE", ctaDark: "#051027",
      ucuncu: "#DAD39E", ucuncuDark: "#010417",
      marka: "#0C2659", marka2: "#FFE500", markaUst: "#FFFFFF", desen: "cubuklu",
    },
    onizleme: ["#0D1F47", "#0C2659", "#FFE500"],
    arka: "desen",
  },
  {
    id: "bjk",
    ad: "Beşiktaş",
    aciklama: "Siyah–beyaz",
    // Paket 30: gri ara ton yok (Paket 25: "toz bulutu"); siyah-beyaz çubuklu forma.
    renkler: {
      bg: "#000000", tabBar: "#0B0B0B", card: "#1E1E1E", cardBorder: "#383838", border: "#383838",
      text: "#F7F7F7", textMuted: "#C1C1C1", textFaint: "#8C8C8C",
      accent: "#FFFFFF", accentDark: "#000000", cta: "#E30A17", ctaDark: "#FFFFFF",
      ucuncu: "#D1D1D1", ucuncuDark: "#000000",
      marka: "#000000", marka2: "#FFFFFF", markaUst: "#FFFFFF", desen: "cubuklu",
    },
    onizleme: ["#1E1E1E", "#000000", "#FFFFFF"],
    arka: "desen",
  },
  {
    id: "ts",
    ad: "Trabzonspor",
    aciklama: "Bordo–mavi",
    renkler: {
      bg: "#130004", tabBar: "#1F020A", card: "#40091B", cardBorder: "#5F2333", border: "#5F2333",
      text: "#FBF5F6", textMuted: "#D4B9BE", textFaint: "#9E8489",
      accent: "#5BB4E5", accentDark: "#8A1538", cta: "#DD667C", ctaDark: "#23060C",
      ucuncu: "#B2D7EE", ucuncuDark: "#130004",
      marka: "#8A1538", marka2: "#5BB4E5", markaUst: "#FFFFFF", desen: "cubuklu",
      danger: "#FF8A8A",
    },
    onizleme: ["#40091B", "#8A1538", "#5BB4E5"],
    arka: "desen",
  },
  {
    id: "ozel",
    ad: "Özel",
    aciklama: "Vurgu renklerini kendin seç",
    renkler: {},                       // ozelRenkler ile doldurulur
    onizleme: ["#223125", "#88E764", "#F5CC58"],
    arka: "desen",
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

  // Paket 30 — kimlik katmanı verilmemişse (özel tema, eski kayıtlar) türet:
  // marka = vurgunun koyu ve doygun hâli, desen = ışık, sekme çubuğu = zemin/kart arası.
  if (!(palet.renkler || {}).marka && id !== "cim") {
    renkler.marka = renkKaristir(renkler.accent, "#000000", 0.5);
    renkler.marka2 = renkler.cta || renkler.accent;
    renkler.markaUst = "#FFFFFF";
    renkler.desen = "isik";
  }
  if (!(palet.renkler || {}).tabBar && !(ozel && ozel.palet && ozel.palet.tabBar) && id !== "cim") {
    renkler.tabBar = renkKaristir(renkler.bg, renkler.card, 0.4);
  }
  // Özel temada üçüncü ton verilmemişse: soluk yazı rengi ile vurgunun karışımı.
  if (!(palet.renkler || {}).ucuncu && !(ozel && ozel.palet && ozel.palet.ucuncu) && id !== "cim") {
    renkler.ucuncu = renkKaristir(renkler.textMuted, renkler.accent, 0.25);
    renkler.ucuncuDark = renkler.bg;
  }
  // Paket 22 — güvenlik: kart zemine fazla yakınsa (eski kayıtlı özel temalar)
  // grafite doğru açılır; kart her temada zeminden ayrı bir katman olarak görünsün.
  if (!renkler.acik && parlaklikOrani(renkler.card, renkler.bg) < 1.16) {   // açık temada beyaz kart doğru
    renkler.card = renkKaristir(renkler.card, "#2A2F35", 0.7);
    renkler.cardBorder = renkler.border = renkKaristir(renkler.card, "#FFFFFF", 0.14);
  }
  Object.assign(COLORS, renkler);
  // Paket 34 — kulüp rengindeki büyük kartın (vitrin, ana sayfa kahramanı, Hızlı Eşleş)
  // üstündeki düğme: vurgu rengi kartla yeterince ayrışmıyorsa (Gündüz: yeşil üstüne
  // yeşil) beyaz düğme + kulüp rengi yazı.
  const ayrisir = parlaklikOrani(COLORS.accent, COLORS.marka) >= 2.2;
  COLORS.markaDugme = ayrisir ? COLORS.accent : COLORS.markaUst;
  COLORS.markaDugmeYazi = ayrisir ? COLORS.accentDark : COLORS.marka;

  // Mod renkleri (Paket 18): her girdi YERİNDE güncelleniyor (nesne kimliği
  // korunur — bazı ekranlar `const VURGU = MODE_COLORS.letters` diye tutuyor).
  for (const [anahtar, hedef] of Object.entries(MODE_COLORS)) {
    const grup = MOD_GRUBU[anahtar] || "accent";
    hedef.main = COLORS[grup];
    hedef.ust = COLORS[grup + "Dark"];
    const koyuTon = renkKaristir(COLORS.card, COLORS[grup], 0.14);
    hedef.dark = kahveMi(koyuTon) || camurMu(koyuTon, COLORS.card) ? renkKaristir(COLORS.card, COLORS.text, 0.06) : koyuTon;   // Paket 33: kahve/çamur bekçisi
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
