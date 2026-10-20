// ============================================================================
// TABLET DÜZENİ — Paket 40 (20 Ekim 2026)
// Kerem: "tablet desteği kapalı mı? ekleseydik ya tablet desteği."
//
// Bütün ekranlar telefon için tasarlandı (kartlar, XOX ızgarası, alt menü).
// Tablette (iPad, Android tablet) uygulama ortada en fazla AZAMI_GENISLIK
// genişliğinde bir sütunda çizilir; iki yan tema zemini. Telefonlarda (genişlik
// ≤ AZAMI_GENISLIK) HİÇBİR ŞEY değişmez.
//
// Ekran genişliğine göre boyut hesaplayan bileşenler useWindowDimensions yerine
// useEkran kullanır: genişlik sütunun genişliğidir (ızgara, sekme kaydırma…).
// Tam ekran Modal'lar (geri sayım gibi) gerçek ekran boyunu kullanmaya devam eder.
// ============================================================================
import { useWindowDimensions, Dimensions } from "react-native";

export const AZAMI_GENISLIK = 640;

export function sutunGenisligi(w) {
  return Math.min(Number(w) || 0, AZAMI_GENISLIK);
}

export function tabletMi(w, h) {
  return Math.min(Number(w) || 0, Number(h) || 0) >= 600;
}

export function useEkran() {
  const d = useWindowDimensions();
  return { ...d, width: sutunGenisligi(d.width), gercekGenislik: d.width, tablet: tabletMi(d.width, d.height) };
}

export function ekranGenisligi() {
  return sutunGenisligi(Dimensions.get("window").width);
}
