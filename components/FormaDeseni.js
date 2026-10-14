import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect, Circle, Path, ClipPath, G } from "react-native-svg";
import { COLORS, saydam, parlaklikOrani } from "../lib/theme";

// ============================================================================
// FORMA DESENİ — Paket 30 (14 Ekim 2026), "Forma" tema sistemi
// Kerem: "gs temasının gs ile alakası yok gibi" → karar: "Forma gibi".
// Temanın KİMLİK katmanı (COLORS.marka / marka2 / desen) burada çizilir:
//   <Forma boyut />          kulübün forması: GS parçalı (sarı | kırmızı),
//                            FB/BJK/TS çubuklu, Saha düz yeşil, diğerleri düz
//   <ArkaplanDeseni w h />   ekran arkaplanı: üstte kulüp renginde stadyum ışığı,
//                            forma motifi (yukarıda belirgin, aşağı söner),
//                            çok ince saha çizgileri
// Renkler her çizimde COLORS'tan okunur (tema değişince yeniden açılışta oturur).
// ============================================================================

const isikRengi = () => (parlaklikOrani(COLORS.marka, "#000000") < 1.25 ? COLORS.marka2 : COLORS.marka);
const karanlikMarka = () => parlaklikOrani(COLORS.marka, "#000000") < 1.25;

// Forma silüeti (100 × 100 kutu): yakalı, kısa kollu.
const FORMA_YOLU = "M30 8 L40 4 Q50 12 60 4 L70 8 L94 22 L84 42 L74 37 L74 96 Q50 100 26 96 L26 37 L16 42 L6 22 Z";
const YAKA_YOLU = "M40 4 Q50 16 60 4";

export function Forma({ boyut = 120, desen, style }) {
  const d = desen || COLORS.desen || "isik";
  const a = COLORS.marka, b = COLORS.marka2;
  let govde;
  if (d === "parcali") {
    // Galatasaray "parçalı": yarısı sarı, yarısı kırmızı
    govde = (
      <>
        <Rect x={0} y={0} width={50} height={100} fill={b} />
        <Rect x={50} y={0} width={50} height={100} fill={a} />
      </>
    );
  } else if (d === "cubuklu") {
    // çubuklu: 7 dikey şerit (FB lacivert-sarı, BJK siyah-beyaz, TS bordo-mavi)
    const n = 7, gw = 100 / n;
    govde = (
      <>
        <Rect x={0} y={0} width={100} height={100} fill={a} />
        {Array.from({ length: n }).map((_, i) => (i % 2 === 1 ? <Rect key={i} x={i * gw} y={0} width={gw} height={100} fill={b} /> : null))}
      </>
    );
  } else if (d === "cim") {
    // Saha: yeşil forma, biçilmiş çim gibi yatay ton farkı
    govde = (
      <>
        <Rect x={0} y={0} width={100} height={100} fill={a} />
        {[0, 2, 4, 6].map((i) => <Rect key={i} x={0} y={i * 14 + 8} width={100} height={14} fill="#FFFFFF" fillOpacity={0.08} />)}
      </>
    );
  } else {
    govde = <Rect x={0} y={0} width={100} height={100} fill={a} />;
  }
  // Yaka/kol bandı: forma renklerinden zemine en çok ayrışanı
  const bant = d === "parcali" ? "#FFFFFF" : d === "cubuklu" ? a : b;
  return (
    <View style={[{ width: boyut, height: boyut }, style]} pointerEvents="none">
      <Svg width={boyut} height={boyut} viewBox="0 0 100 100">
        <Defs>
          <ClipPath id="forma"><Path d={FORMA_YOLU} /></ClipPath>
          <LinearGradient id="golge" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.14} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.22} />
          </LinearGradient>
        </Defs>
        <G clipPath="url(#forma)">
          {govde}
          <Rect x={0} y={0} width={100} height={100} fill="url(#golge)" />
        </G>
        <Path d={YAKA_YOLU} stroke={bant} strokeWidth={4} fill="none" strokeLinecap="round" />
        <Path d="M84 42 L94 22" stroke={bant} strokeWidth={3} fill="none" />
        <Path d="M16 42 L6 22" stroke={bant} strokeWidth={3} fill="none" />
        <Path d={FORMA_YOLU} stroke="#000000" strokeOpacity={0.35} strokeWidth={1.2} fill="none" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

// Ekran arkaplanı. w/h: kabın gerçek boyutu.
export function ArkaplanDeseni({ genislik: w, yukseklik: h, cizgiKalinligi = 1.4 }) {
  const d = COLORS.desen || "isik";
  const isik = isikRengi();
  const koyu = karanlikMarka();
  const cizgi = saydam(COLORS.text, 0.06);
  const ustH = h * 0.5;                      // motifin söndüğü yer
  const serit = Math.max(6, Math.round(w / 52));
  const sw = w / serit;
  const merkezR = w * 0.27;
  const kutuUst = h - h * 0.15, kx1 = w * 0.18, kx2 = w * 0.82;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="isik1" cx={d === "parcali" ? w * 0.82 : w / 2} cy={-h * 0.04} r={Math.max(w, h) * 0.62} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={isik} stopOpacity={koyu ? 0.16 : 0.62} />
          <Stop offset="0.55" stopColor={isik} stopOpacity={koyu ? 0.04 : 0.16} />
          <Stop offset="1" stopColor={isik} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="isik2" cx={w * 0.12} cy={-h * 0.03} r={Math.max(w, h) * 0.42} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={COLORS.marka2} stopOpacity={0.26} />
          <Stop offset="1" stopColor={COLORS.marka2} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="motif" x1="0" y1="0" x2="0" y2={ustH} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={COLORS.marka2} stopOpacity={koyu ? 0.07 : 0.06} />
          <Stop offset="1" stopColor={COLORS.marka2} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill={COLORS.bg} />
      {d === "cim" ? Array.from({ length: 10 }).map((_, i) => (i % 2 === 0 ? (
        <Rect key={i} x={0} y={(i * h) / 10} width={w} height={h / 10} fill={COLORS.text} fillOpacity={0.025} />
      ) : null)) : null}
      <Rect x={0} y={0} width={w} height={h} fill="url(#isik1)" />
      {d === "parcali" ? <Rect x={0} y={0} width={w} height={h} fill="url(#isik2)" /> : null}
      {d === "cubuklu" ? Array.from({ length: serit }).map((_, i) => (i % 2 === 1 ? (
        <Rect key={i} x={i * sw} y={0} width={sw} height={ustH} fill="url(#motif)" />
      ) : null)) : null}
      <Circle cx={w / 2} cy={0} r={merkezR} stroke={cizgi} strokeWidth={cizgiKalinligi} fill="none" />
      <Path d={`M${kx1} ${h + 2} V${kutuUst} H${kx2} V${h + 2}`} stroke={cizgi} strokeWidth={cizgiKalinligi} fill="none" />
      <Path d={`M${w * 0.36} ${h + 2} V${h - h * 0.055} H${w * 0.64} V${h + 2}`} stroke={cizgi} strokeWidth={cizgiKalinligi} fill="none" />
    </Svg>
  );
}
