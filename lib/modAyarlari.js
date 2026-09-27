// ============================================================================
// MOD AYARLARI — tek merkezden, parametrik (27 Eylül 2026)
//
// Kerem: "zorluk seviyesi her bir mod için ayarlardan ayarlansın. her mod için
// 10 üstünden. default ayarlarda belirlensin ama modu oynayacakken de sorsun.
// süre kısıtı da aynı şekilde. ... kısıtları parametrik yönetebiliyor
// olmamız lazım. zorunlu farklı olan özellikler dışında modlar belli bir
// standart ile birbirlerine eşit olmalı."
//
// Her modun hangi ayarları olduğu, seçenekleri, sınırları ve varsayılanları
// BURADA tanımlı. Kurulum ekranı (ModKurulum), Ayarlar > Mod Varsayılanları
// ve oyun içi "Bu maçın ayarları" penceresi hep bu tabloyu okuyor. Yeni bir
// mod eklemek ya da bir sınırı değiştirmek = bu dosyada bir satır.
// ============================================================================
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useAppSettings } from "./SettingsContext";

// Galibiyet sınırı seçenekleri — "Sınırsız" JSON'a yazılabilsin diye 0.
export const GALIBIYET_SECENEKLERI = [
  { deger: 3, etiket: "3" },
  { deger: 5, etiket: "5" },
  { deger: 7, etiket: "7" },
  { deger: 10, etiket: "10" },
  { deger: 0, etiket: "Sınırsız" },
];
export const galibiyetDegeri = (g) => (g === 0 || g == null ? Infinity : g);

export const YONTEM_SECENEKLERI = [
  { deger: "keyboard", etiket: "Klavye", ikon: "keypad" },
  { deger: "voice", etiket: "Mikrofon", ikon: "mic" },
];

const BUZZ_SURESI = {
  etiket: "TUR SÜRESİ",
  secenekler: [8, 10, 15, 20],
  asgari: 5,
  azami: 60,
  varsayilan: 10,
  aciklama: "Takımlar göründükten sonra zile basmak için süre. Zile basınca cevap için ayrıca 12 sn var.",
};

// zorluk: her zaman 1-10 (varsayılan 5). sure: null = o modda süre yok.
export const MOD_TANIMLARI = {
  cpu: {
    ad: "Ortak Kulüp — CPU", renk: "teamTeam",
    sure: BUZZ_SURESI, galibiyet: 5, yontem: "keyboard", lig: true,
    zorlukNe: "Hangi oyuncuların sorulacağını ve CPU'nun hızını/isabetini belirler.",
  },
  draftCpu: {
    ad: "Takımı Sen Seç", renk: "teamTeam",
    sure: BUZZ_SURESI, galibiyet: 5, yontem: "keyboard", lig: true,
    zorlukNe: "Hangi oyuncuların sorulacağını ve CPU'nun hızını/isabetini belirler.",
  },
  countryTeamCpu: {
    ad: "Kulüp & Ülke", renk: "teamCountry",
    sure: BUZZ_SURESI, galibiyet: 5, yontem: "keyboard", lig: true,
    zorlukNe: "Hangi oyuncuların sorulacağını ve CPU'nun hızını/isabetini belirler.",
  },
  local: {
    ad: "Tek Telefon 2 Kişi", renk: "hotSeat",
    sure: BUZZ_SURESI, galibiyet: 5, yontem: "voice", lig: true,
    zorlukNe: "Hangi oyuncuların sorulacağını belirler.",
  },
  quickCpu: {
    ad: "Hızlı Antrenman", renk: "training",
    sure: { etiket: "CEVAP SÜRESİ", secenekler: [4, 6, 8, 10], asgari: 3, azami: 30, varsayilan: 6,
      aciklama: "Seçenekler göründükten sonra karar vermek için süre." },
    galibiyet: null, yontem: null, lig: true,
    zorlukNe: "Hangi oyuncuların sorulacağını belirler.",
  },
  fiveClubs: {
    ad: "5 Kulüp", renk: "fiveClubs",
    sure: { etiket: "CEVAP SÜRESİ", secenekler: [20, 30, 45, 60], asgari: 15, azami: 180, varsayilan: 30,
      aciklama: "Her oyuncunun kendi cevabı için süresi." },
    galibiyet: null, yontem: "voice", lig: false,
    zorlukNe: "1-3: sadece en büyük kulüpler · 4-7: Şampiyonlar Ligi klasikleri de · 8-10: tam havuz. CPU'ya karşı oynarken CPU'nun gücü de artar.",
  },
  xox: {
    ad: "Futbolcu XOX", renk: "xox",
    sure: { etiket: "CEVAP SÜRESİ (HAMLE BAŞINA)", secenekler: [20, 30, 45, 60], asgari: 15, azami: 300, varsayilan: 30,
      aciklama: "Sıra sana geçtiğinde süre başlar. Dolarsa sıra rakibe geçer." },
    galibiyet: null, yontem: "keyboard", lig: false,
    zorlukNe: "Izgaradaki kulüplerin ne kadar tanınmış olduğunu ve CPU'nun gücünü belirler.",
  },
  letterCpu: {
    ad: "İlk Harften Bul", renk: "letters",
    sure: { etiket: "TUR SÜRESİ", secenekler: [10, 15, 20, 30], asgari: 5, azami: 90, varsayilan: 15,
      aciklama: "Harfler açıldıktan sonra cevap için süre." },
    galibiyet: null, yontem: "keyboard", lig: false,
    zorlukNe: "CPU'nun ne kadar hızlı ve isabetli olduğunu belirler.",
  },
  whoAmICpu: {
    ad: "Kim Bu Futbolcu?", renk: "whoAmI", zorlukVarsayilan: 3,
    sure: { etiket: "SORU SÜRESİ", secenekler: [30, 60, 90], asgari: 15, azami: 300, varsayilan: null, suresizVar: true,
      aciklama: "Süre dolarsa bir can gider." },
    galibiyet: null, yontem: "keyboard", lig: false,
    zorlukNe: "Oyuna hangi seviyeden başlayacağını belirler; her doğru cevapta seviye yine artar.",
  },
};

export const VARSAYILAN_ZORLUK = 5;

// 1-10 arası zorluğun genel adı (bütün modlarda aynı dil).
export function zorlukEtiketi(z) {
  if (z <= 2) return "Çok Kolay";
  if (z <= 4) return "Kolay";
  if (z <= 6) return "Orta";
  if (z <= 8) return "Zor";
  return "Çok Zor";
}

// Kayıtlı varsayılanları (Ayarlar > Mod Varsayılanları) tablo varsayılanlarıyla birleştirir.
export function modVarsayilani(settings, modId) {
  const tanim = MOD_TANIMLARI[modId] || {};
  const kayit = (settings && settings.modVarsayilanlari && settings.modVarsayilanlari[modId]) || {};
  const sureVar = !!tanim.sure;
  return {
    zorluk: clamp(kayit.zorluk ?? tanim.zorlukVarsayilan ?? VARSAYILAN_ZORLUK, 1, 10),
    sure: sureVar ? (kayit.sure !== undefined ? kayit.sure : tanim.sure.varsayilan) : null,
    galibiyet: tanim.galibiyet != null ? (kayit.galibiyet ?? tanim.galibiyet) : null,
    yontem: tanim.yontem ? (kayit.yontem ?? tanim.yontem) : null,
  };
}

function clamp(x, a, b) {
  const n = Number(x);
  if (!Number.isFinite(n)) return a;
  return Math.min(b, Math.max(a, Math.round(n)));
}

// Ayarlar yüklenince ekranın durumlarını BİR KEZ varsayılanlara çeker.
// ayarlayicilar: { zorluk: setX, sure: setY, galibiyet: setZ, yontem: setW }
// Dönüş: kurulum ekranındaki "varsayılan olarak kaydet" için bir fonksiyon.
export function useModVarsayilanlari(modId, ayarlayicilar) {
  const { settings, setSetting, loaded } = useAppSettings();
  const uygulandi = useRef(false);
  useEffect(() => {
    if (!loaded || uygulandi.current) return;
    uygulandi.current = true;
    const v = modVarsayilani(settings, modId);
    if (ayarlayicilar.zorluk) ayarlayicilar.zorluk(v.zorluk);
    if (ayarlayicilar.sure && v.sure !== undefined) ayarlayicilar.sure(v.sure);
    if (ayarlayicilar.galibiyet && v.galibiyet != null) ayarlayicilar.galibiyet(galibiyetDegeri(v.galibiyet));
    if (ayarlayicilar.yontem && v.yontem) ayarlayicilar.yontem(v.yontem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return function varsayilanOlarakKaydet(degerler) {
    const hepsi = { ...((settings && settings.modVarsayilanlari) || {}) };
    const temiz = { ...degerler };
    if (temiz.galibiyet === Infinity) temiz.galibiyet = 0;
    hepsi[modId] = { ...(hepsi[modId] || {}), ...temiz };
    return setSetting("modVarsayilanlari", hepsi);
  };
}

// ---------------------------------------------------------------------------
// OYUN İÇİ "BU MAÇIN AYARLARI" — ekranlar oynarken güncel ayarlarını buraya
// yazar; mod rehberi penceresi (App.js'teki ortak kapsayıcı) okur. Böylece
// her modda aynı yerden (sağ üstteki ? düğmesi) bakılabiliyor.
// ---------------------------------------------------------------------------
let _bilgi = {};
const _dinleyiciler = new Set();
export function oyunBilgisiniYaz(modId, bilgi) {
  _bilgi = { ..._bilgi, [modId]: bilgi };
  _dinleyiciler.forEach((f) => f());
}
function abone(f) { _dinleyiciler.add(f); return () => _dinleyiciler.delete(f); }
export function useOyunBilgisi(modId) {
  return useSyncExternalStore(abone, () => (modId ? _bilgi[modId] || null : null));
}

// Ekranın mevcut ayarlarını okunur satırlara çevirir.
export function ayarSatirlari({ zorluk, sure, galibiyet, lig, yontem, ekstra }) {
  const satirlar = [];
  if (zorluk != null) satirlar.push(["Zorluk", `${zorluk} / 10 — ${zorlukEtiketi(zorluk)}`]);
  if (sure !== undefined) satirlar.push(["Süre", sure == null ? "Süresiz" : `${sure} sn`]);
  if (galibiyet != null) satirlar.push(["Galibiyet sınırı", galibiyet === Infinity || galibiyet === 0 ? "Sınırsız" : String(galibiyet)]);
  if (lig) satirlar.push(["Lig / kapsam", lig]);
  if (yontem) satirlar.push(["Cevap yöntemi", yontem === "voice" ? "Mikrofon" : "Klavye"]);
  for (const e of ekstra || []) satirlar.push(e);
  return satirlar;
}
