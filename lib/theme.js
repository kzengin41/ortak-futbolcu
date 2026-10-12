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
  bg: "#001003",
  card: "#223125",
  cardBorder: "#404F43",
  border: "#404F43",
  text: "#F1F7F2",
  textMuted: "#A7BAAA",
  textFaint: "#6B7D6E",
  accent: "#88E764", // ana vurgu — çim yeşili
  accentDark: "#061C01", // vurgu üzerindeki metin
  cta: "#F5CC58", // ikincil vurgu — altın
  ctaDark: "#1D1500",
  ucuncu: "#85DDD7", // üçüncü ton — su yeşili (arkadaşla / günlük modlar)
  ucuncuDark: "#031A19",
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
  return { backgroundColor: saydam(renk, 0.16), borderWidth: 1.5, borderColor: saydam(renk, 0.45) };
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
    onizleme: ["#223125", "#88E764", "#F5CC58"],
    arka: "desen",
  },
  {
    id: "gece",
    ad: "Gece Mavisi",
    aciklama: "Daha serin, mavi vurgulu alternatif",
    renkler: {
      bg: "#020A1F", card: "#232D3F", cardBorder: "#414B5C", border: "#414B5C",
      text: "#F2F5FB", textMuted: "#AAB5C8", textFaint: "#6E788A",
      accent: "#68B3FE", accentDark: "#03172B",
      cta: "#FEB858", ctaDark: "#221200",
      ucuncu: "#C7BAF3", ucuncuDark: "#171321",
    },
    onizleme: ["#232D3F", "#68B3FE", "#FEB858"],
    arka: "desen",
  },
  {
    id: "koyu",
    ad: "Koyu",
    aciklama: "Siyah zemin — OLED ekranlarda pil dostu",
    renkler: {
      bg: "#000000", card: "#282828", cardBorder: "#454545", border: "#454545",
      text: "#F5F5F5", textMuted: "#B4B4B4", textFaint: "#777777",
      accent: "#80EBB0", accentDark: "#011C0E",
      cta: "#E6C686", ctaDark: "#1D1505",
      ucuncu: "#A8C9E2", ucuncuDark: "#0F171D",
    },
    onizleme: ["#282828", "#80EBB0", "#E6C686"],
    arka: "desen",
  },
  {
    id: "gs",
    ad: "Galatasaray",
    aciklama: "Sarı–kırmızı",
    // 26 Eylül 2026 (Kerem: "galatasaray belçika gibi") — kulüp kimliği
    // ZEMİNDEN gelir (koyu GS kırmızısı); Paket 22: kartlar nötr grafit.
    renkler: {
      bg: "#1F0002", card: "#402322", cardBorder: "#5F4240", border: "#5F4240",
      text: "#FAF3F3", textMuted: "#C7ADAC", textFaint: "#88716F",
      accent: "#FFBE2C", accentDark: "#1F1400",
      cta: "#FB6254", ctaDark: "#2C0806",
      ucuncu: "#F0D7AE", ucuncuDark: "#1B150B",
      danger: "#FF8A8A",
    },
    onizleme: ["#402322", "#FFBE2C", "#FB6254"],
    arka: "desen",
  },
  {
    id: "fb",
    ad: "Fenerbahçe",
    aciklama: "Sarı–lacivert",
    // 26 Eylül 2026 (Kerem: "fenerbahçe ukrayna gibi") — açık mavi YOK, lacivert.
    renkler: {
      bg: "#010824", card: "#202C43", cardBorder: "#3E4B61", border: "#3E4B61",
      text: "#F2F5FB", textMuted: "#AAB5C8", textFaint: "#6E788A",
      accent: "#FEE32D", accentDark: "#1B1600",
      cta: "#83C0FF", ctaDark: "#071727",
      ucuncu: "#EADEB2", ucuncuDark: "#19160B",
    },
    onizleme: ["#202C43", "#FEE32D", "#83C0FF"],
    arka: "desen",
  },
  {
    id: "bjk",
    ad: "Beşiktaş",
    aciklama: "Siyah–beyaz",
    renkler: {
      bg: "#000000", card: "#282828", cardBorder: "#454545", border: "#454545",
      text: "#F5F5F5", textMuted: "#B4B4B4", textFaint: "#777777",
      accent: "#FFFFFF", accentDark: "#161616",
      cta: "#C4C4C4", ctaDark: "#161616",
      ucuncu: "#8C8C8C", ucuncuDark: "#161616",
    },
    onizleme: ["#282828", "#FFFFFF", "#C4C4C4"],
    arka: "desen",
  },
  {
    id: "ts",
    ad: "Trabzonspor",
    aciklama: "Bordo–mavi",
    renkler: {
      bg: "#1E0008", card: "#3F2329", cardBorder: "#5E4147", border: "#5E4147",
      text: "#FAF3F4", textMuted: "#C6ADB1", textFaint: "#887075",
      accent: "#65C8F2", accentDark: "#001924",
      cta: "#E15A7B", ctaDark: "#2B0711",
      ucuncu: "#F7CBCA", ucuncuDark: "#1D1313",
      danger: "#FF8A8A",
    },
    onizleme: ["#3F2329", "#65C8F2", "#E15A7B"],
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

  // Özel temada üçüncü ton verilmemişse: soluk yazı rengi ile vurgunun karışımı.
  if (!(palet.renkler || {}).ucuncu && !(ozel && ozel.palet && ozel.palet.ucuncu) && id !== "cim") {
    renkler.ucuncu = renkKaristir(renkler.textMuted, renkler.accent, 0.25);
    renkler.ucuncuDark = renkler.bg;
  }
  // Paket 22 — güvenlik: kart zemine fazla yakınsa (eski kayıtlı özel temalar)
  // grafite doğru açılır; kart her temada zeminden ayrı bir katman olarak görünsün.
  if (parlaklikOrani(renkler.card, renkler.bg) < 1.16) {
    renkler.card = renkKaristir(renkler.card, "#2A2F35", 0.7);
    renkler.cardBorder = renkler.border = renkKaristir(renkler.card, "#FFFFFF", 0.14);
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
