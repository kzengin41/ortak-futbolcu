// ============================================================================
// TAKIMA ÖZEL TEMA — Paket 36 (15 Ekim 2026)
// Kerem: "takımını seçince tema takımına özel değiştirilsin mi diye sorsun."
//
// Takım seçilince (açılıştaki "Tuttuğun takım?" penceresi ve Ayarlar) kısa bir
// soru çıkar. Evet denirse:
//   • Galatasaray / Fenerbahçe / Beşiktaş / Trabzonspor → elle hazırlanmış
//     kulüp teması (lib/theme.js PALETLER: gs, fb, bjk, ts; forma deseni dahil)
//   • diğer kulüpler → kulübün forma/logo renklerinden "Kendi temam" (ozel)
//     paleti üretilir (zemin kulübün ana renginin koyu tonu, vurgu ana renk,
//     ikincil renk ikinci renk). Kahverengi/çamur ve okunmayan vurgu korumalı.
// Kulüp rengi bilinmiyorsa soru hiç sorulmaz.
// ============================================================================
import { PALETLER, kahveMi } from "./theme";
import { paletUret, hexRgb, hexTon, hslHex, kontrast } from "./temaOlusturucu";

const sade = (s) => String(s || "")
  .toLocaleLowerCase("tr")
  .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();

// Hazır kulüp temaları (lib/theme.js PALETLER kimlikleri).
const HAZIR = [
  { id: "gs", anahtar: ["galatasaray"] },
  { id: "fb", anahtar: ["fenerbahce"] },
  { id: "bjk", anahtar: ["besiktas"] },
  { id: "ts", anahtar: ["trabzonspor"] },
];

function doygunluk(hex) {
  const [r, g, b] = hexRgb(hex).map((x) => x / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return 0;
  return (mx - mn) / (1 - Math.abs(2 * l - 1));
}

// Kulüp renginin tonuna göre koyu zemin (lib/temaOlusturucu ZEMINLER).
export function zeminSec(hex) {
  if (doygunluk(hex) < 0.18) return "siyah";            // siyah-beyaz kulüpler
  const h = hexTon(hex);
  if (h < 18 || h >= 330) return "bordo";
  if (h < 70) return "grafit";                           // sarı/turuncu: nötr koyu zemin
  if (h < 165) return "orman";
  if (h < 195) return "petrol";
  if (h < 255) return "lacivert";
  return "mor";
}

// Koyu zeminde okunur, canlı hâl (tonu korur).
function canlandir(hex, kart) {
  if (doygunluk(hex) < 0.18) return "#FFFFFF";
  const h = hexTon(hex);
  let l = 60;
  let c = hslHex(h, 85, l);
  while (kontrast(c, kart) < 4 && l < 82) { l += 4; c = hslHex(h, 85, l); }
  return c;
}

const ALTIN = "#FDB913";

export function takimTemasi(takim, kulupRenkleri) {
  if (!takim) return null;
  const s = sade(takim);
  const hazir = HAZIR.find((x) => x.anahtar.some((a) => s === a || s.startsWith(a + " ")));
  if (hazir) {
    const p = PALETLER.find((x) => x.id === hazir.id);
    if (p) return { tur: "hazir", id: p.id, ad: p.ad, onizleme: p.onizleme };
  }
  const renkler = (kulupRenkleri && kulupRenkleri(takim)) || null;
  if (!renkler || !renkler.length) return null;
  const ana = renkler[0];
  const ikinci = renkler[1] || null;
  const zemin = zeminSec(ana);
  const taban = paletUret({ zemin });
  const kart = taban.card;
  let accent = canlandir(ana, kart);
  // Kırmızı kulüpte zemin zaten bordo: vurgu ikinci renk (Roma sarısı gibi) ya da beyaz.
  if (zemin === "bordo") accent = ikinci && doygunluk(ikinci) >= 0.18 ? canlandir(ikinci, kart) : "#FFFFFF";
  if (kahveMi(accent)) accent = ALTIN;
  let cta = ikinci ? canlandir(ikinci, kart) : ALTIN;
  const benzer = (x, y) => x === y || (doygunluk(x) >= 0.18 && doygunluk(y) >= 0.18 && Math.min(Math.abs(hexTon(x) - hexTon(y)), 360 - Math.abs(hexTon(x) - hexTon(y))) < 25);
  if (kahveMi(cta) || benzer(cta, accent)) cta = accent === "#FFFFFF" ? ALTIN : "#FFFFFF";
  const secim = { zemin, accent, cta };
  const palet = paletUret(secim);
  return { tur: "ozel", id: "ozel", ad: takim, secim, palet, onizleme: [palet.card, palet.accent, palet.cta] };
}

// Şu anki tema zaten bu takımın teması mı? (O zaman sormaya gerek yok.)
export function zatenTakimTemasi(tema, settings) {
  if (!tema || !settings) return false;
  if (tema.tur === "hazir") return (settings.themeId || "cim") === tema.id;
  const p = settings.customPalet;
  return settings.themeId === "ozel" && !!p && p.accent === tema.palet.accent && p.cta === tema.palet.cta && p.card === tema.palet.card;
}

// Ayarlara yazar (yeniden yükleme çağıran tarafta: lib/temaYenile).
export async function takimTemasiniUygula(tema, setSetting) {
  if (!tema) return;
  if (tema.tur === "ozel") {
    await setSetting("customTemaSecimi", tema.secim);
    await setSetting("customPalet", tema.palet);
    await setSetting("customAccent", tema.palet.accent);
    await setSetting("customAccentDark", tema.palet.accentDark);
    await setSetting("customCta", tema.palet.cta);
    await setSetting("customCtaDark", tema.palet.ctaDark);
  }
  await setSetting("themeId", tema.id);
}
