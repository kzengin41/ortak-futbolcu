import React from "react";
import Svg, { Path, Circle, Rect } from "react-native-svg";

// ============================================================================
// MOD İKONLARI — Paket 18 (5 Ekim 2026, Kerem: "mod ikonlarını güncelle.
// mükemmel ikonlar tasarla"). Önizlemede onaylanan set (claude.ai tasarım
// önizlemesi): 24'lük ızgara, tek çizgi kalınlığı (1,9), yuvarlak uçlar. Her
// ikon modun kendi hareketini anlatıyor (iki arma üst üste = ortak kulüp,
// beş düğüm = 5 kulüp, zincirlenen harf kareleri = harf zinciri …).
// `dolu: true` olan parçalar çizgi değil dolgu (nokta gibi).
// ============================================================================
export const MOD_IKONLARI = {
  ortakKulup: [["path", { d: "M3 5.5 8 4l5 1.5V10c0 3.5-2.2 5.8-5 7-2.8-1.2-5-3.5-5-7z" }], ["path", { d: "M11 8.5 16 7l5 1.5V13c0 3.5-2.2 5.8-5 7-2.8-1.2-5-3.5-5-7z" }], ["circle", { cx: 12.0, cy: 11.5, r: 1.2, dolu: true }]],
  takimiSenSec: [["path", { d: "M4 5 10 3l6 2v5c0 4-2.5 6.5-6 8-3.5-1.5-6-4-6-8z" }], ["path", { d: "m13.5 21.5 7-7 1.8 1.8-7 7H13.5z" }]],
  besKulup: [["circle", { cx: 12.0, cy: 12.0, r: 2.4 }], ["circle", { cx: 12.0, cy: 3.8, r: 1.8 }], ["circle", { cx: 19.8, cy: 9.5, r: 1.8 }], ["circle", { cx: 16.8, cy: 18.6, r: 1.8 }], ["circle", { cx: 7.2, cy: 18.6, r: 1.8 }], ["circle", { cx: 4.2, cy: 9.5, r: 1.8 }], ["path", { d: "M12 9.6V5.6M14.3 11.3l3.7-1.2M13.4 13.9l2.3 3.1M10.6 13.9l-2.3 3.1M9.7 11.3 6 10.1" }]],
  xox: [["path", { d: "M9 3v18M15 3v18M3 9h18M3 15h18" }], ["path", { d: "m4.6 4.6 2.8 2.8M7.4 4.6 4.6 7.4" }], ["circle", { cx: 12.0, cy: 12.0, r: 1.6 }], ["path", { d: "m16.6 16.6 2.8 2.8M19.4 16.6l-2.8 2.8" }]],
  kimBu: [["circle", { cx: 9.5, cy: 7.5, r: 3.5 }], ["path", { d: "M3 20.5c.5-4.3 3.2-6.5 6.5-6.5 1.4 0 2.6.4 3.6 1.1" }], ["path", { d: "M16.2 11.3c0-1.6 1.3-2.6 2.7-2.6s2.6 1 2.6 2.3c0 1.9-2.5 2-2.5 4.2" }], ["circle", { cx: 19.0, cy: 18.6, r: 0.9, dolu: true }]],
  ilkHarf: [["rect", { x: 3.0, y: 3.0, width: 18.0, height: 18.0, rx: 4.5 }], ["path", { d: "M8 17 12 7l4 10M9.6 13.4h4.8" }]],
  harfZinciri: [["rect", { x: 2.5, y: 2.5, width: 9.0, height: 9.0, rx: 2.4 }], ["rect", { x: 12.5, y: 12.5, width: 9.0, height: 9.0, rx: 2.4 }], ["path", { d: "M11.5 7h3a2.5 2.5 0 0 1 2.5 2.5v1.8" }], ["path", { d: "m15.2 9.7 1.8 1.8 1.8-1.8" }], ["path", { d: "M5.4 9V5.2h2.8M15.4 15.3h3.2l-3.2 3.6h3.2" }]],
  harfiSenSec: [["rect", { x: 3.0, y: 3.0, width: 13.0, height: 13.0, rx: 3.5 }], ["path", { d: "M7 12.5 9.5 6.5l2.5 6M7.8 10.6h3.4" }], ["path", { d: "m14 14 7.2 2.6-3.1 1.4-1.4 3.1z" }]],
  sunucu: [["rect", { x: 9.0, y: 2.5, width: 6.0, height: 11.0, rx: 3.0 }], ["path", { d: "M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" }]],
  online: [["circle", { cx: 12.0, cy: 12.0, r: 9.0 }], ["path", { d: "M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" }]],
  meydanOkuma: [["path", { d: "M21 3 3 10.5l7 3 3 7.5z" }], ["path", { d: "M21 3 10 13.5" }]],
  kodlaKatil: [["circle", { cx: 8.0, cy: 15.5, r: 4.5 }], ["path", { d: "M11.3 12.3 20.5 3M17 6.5l2.5 2.5M14.5 9l2 2" }]],
  gunluk: [["rect", { x: 3.0, y: 4.5, width: 18.0, height: 16.5, rx: 3.5 }], ["path", { d: "M3 9.5h18M8 2.5v4M16 2.5v4" }], ["path", { d: "m8.8 15.2 2.2 2.2 4.2-4.2" }]],
  kadroAvi: [["path", { d: "M8 3 4.2 5.4 2.5 10l3.5 1.4V21h12v-9.6l3.5-1.4-1.7-4.6L16 3c-.9 1.8-2.3 2.6-4 2.6S8.9 4.8 8 3z" }], ["circle", { cx: 12.0, cy: 14.5, r: 2.6 }], ["path", { d: "M12 10.4v1.5M12 17.1v1.5M7.9 14.5h1.5M14.6 14.5h1.5" }]],
  ansiklopedi: [["path", { d: "M4 19.5v-15A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zm0 0A1.5 1.5 0 0 0 5.5 21H20" }], ["path", { d: "M8 7.5h8M8 11h5" }]],
  hemenOyna: [["circle", { cx: 12.0, cy: 12.0, r: 9.0 }], ["path", { d: "m12 8.2 3.6 2.6-1.4 4.2H9.8l-1.4-4.2z" }], ["path", { d: "M12 8.2V3.2M15.6 10.8l4.6-1.5M14.2 15l2.8 3.9M9.8 15 7 18.9M8.4 10.8 3.8 9.3" }]],
};

const PARCA = { path: Path, circle: Circle, rect: Rect };

export default function ModIkon({ ad, boyut = 24, renk = "#FFFFFF", kalinlik = 1.9 }) {
  const parcalar = MOD_IKONLARI[ad];
  if (!parcalar) return null;
  return (
    <Svg width={boyut} height={boyut} viewBox="0 0 24 24" fill="none">
      {parcalar.map(([tur, { dolu, ...p }], i) => {
        const Bilesen = PARCA[tur];
        return dolu ? (
          <Bilesen key={i} {...p} fill={renk} stroke="none" />
        ) : (
          <Bilesen key={i} {...p} fill="none" stroke={renk} strokeWidth={kalinlik} strokeLinecap="round" strokeLinejoin="round" />
        );
      })}
    </Svg>
  );
}
