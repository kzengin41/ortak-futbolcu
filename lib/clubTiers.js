// Son güncel sezonlarda (2024-25, 2025-26, 2026-27) Süper Lig ve TFF 1. Lig'de
// yer almış takımlar. "Tüm zamanlar" kategorisi (Ankaraspor gibi yıllar önce
// düşmüş takımları da getiriyordu) yerine bilerek GÜNCEL bir liste kullanıyoruz.
// Kaynak: en.wikipedia.org/wiki/2025–26_Süper_Lig ve 2026–27_TFF_1._Lig sayfaları
// (kontrol tarihi: 20 Ağustos 2026).
//
// SÜPER LİG listesi tam (2025-26 sezonunun 18 takımı + 2024-25'ten düşüp
// henüz 1. Lig'de olan + 2026-27'ye yeni çıkanlar).
// TFF 1. LİG listesi KISMİ — Wikipedia'nın 2026-27 sayfası kesildiği için
// 20 takımın ~16'sını doğrulayabildim. Oynarken eksik bir 1. Lig takımına
// rastlarsan bana söyle, buraya ekleyelim (aynı corrections.js mantığı).
export const SUPER_LIG_CLUBS = [
  "Alanyaspor",
  "Antalyaspor",
  "Başakşehir",
  "İstanbul Başakşehir",
  "Beşiktaş",
  "Eyüpspor",
  "Fatih Karagümrük",
  "Fenerbahçe",
  "Galatasaray",
  "Gaziantep",
  "Gaziantep FK",
  "Gençlerbirliği",
  "Göztepe",
  "Kasımpaşa",
  "Kayserispor",
  "Kocaelispor",
  "Konyaspor",
  "Rizespor",
  "Çaykur Rizespor",
  "Samsunspor",
  "Trabzonspor",
  "Adana Demirspor",
  "Sivasspor",
  "Bodrum FK",
  "Bodrumspor",
  "Hatayspor",
  "Erzurumspor",
  "Erzurumspor FK",
  "Amedspor",
  "Amed Sportif Faaliyetler",
  "Çorum FK",
  "Çorum Futbol Kulübü"
];

export const TFF1_LIG_CLUBS = [
  "Antalyaspor",
  "Bandırmaspor",
  "Batman Petrolspor",
  "Bodrum",
  "Bodrum FK",
  "Boluspor",
  "Bursaspor",
  "Fatih Karagümrük",
  "Iğdır",
  "Iğdırspor",
  "Iğdır FK",
  "İstanbulspor",
  "Erzurumspor",
  "Amedspor",
  "Çorum FK",
  "Serikspor",
  "Serik Belediyespor",
  "Sakaryaspor",
  "Hatayspor",
  "Adana Demirspor"
];

export const TOP2_TIER_CLUBS = [...new Set([...SUPER_LIG_CLUBS, ...TFF1_LIG_CLUBS])];
