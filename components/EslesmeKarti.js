import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import TeamBadge, { KNOWN_COLORS } from "./TeamBadge";
import { clubLogo } from "../lib/clubLogos";
import { kulupGrubu } from "../lib/clubAliases";
import { LOGO_RENK } from "../lib/kulupRenkleri";
import COUNTRIES from "../lib/countries.json";
import { flagForCountry, canonicalCountryName } from "../lib/countryFlags";
import { countryTr } from "../lib/countryNamesTr";
import { COLORS, saydam, _oklch } from "../lib/theme";

// ============================================================================
// EŞLEŞME KARTI — Paket 32 (15 Ekim 2026)
// Kerem: "kartların renk tasarımları halen iyi değil" → seçtiği: "oyun içi
// arma kartları". ESKİ: her modda düz gri kutu, ortada sarı "×" / "+".
// Arma ne olursa olsun kart aynı griydi; iki takım birbirinden ayrışmıyordu.
// YENİ (TV maç grafiği gibi): kart iki yarı; her yarı KENDİ kulübünün renginde
// yukarıdan hafifçe parlar, en üstte o kulübün renklerinde ince bir atkı şeridi,
// ortada küçük nötr "×" madalyonu. Ülke yarısı milli takım renginde.
// Renk kaynağı (sırayla): TeamBadge KNOWN_COLORS (elle girilmiş forma renkleri)
// → lib/kulupRenkleri.js (armadan çıkarılmış, scripts/kulup_renkleri.py) → nötr.
// Siyah/beyaz (Beşiktaş, Juventus) parıltıda nötr kalır, atkıda görünür.
// Kullanım: <EslesmeKarti sol={{ tip: "kulup"|"ulke", ad }} sag={…} kompakt? ayirac? />
// ============================================================================

// Milli takım ana renkleri (ISO kodu → [ana, ikinci]).
const ULKE_RENK = {
  TR: ["#E30A17", "#FFFFFF"], BR: ["#FEDF00", "#009C3B"], AR: ["#75AADB", "#FFFFFF"], DE: ["#FFFFFF", "#000000"],
  FR: ["#002395", "#ED2939"], ES: ["#C60B1E", "#FFC400"], IT: ["#0066CC", "#FFFFFF"], PT: ["#C8102E", "#006600"],
  NL: ["#FF6600", "#FFFFFF"], BE: ["#E30613", "#000000"], GB: ["#FFFFFF", "#CF142B"], EN: ["#FFFFFF", "#CF142B"],
  HR: ["#FF0000", "#FFFFFF"], RS: ["#C6363C", "#0C4076"], UY: ["#5CBFEB", "#FFFFFF"], CO: ["#FCD116", "#003893"],
  MX: ["#006847", "#CE1126"], US: ["#FFFFFF", "#002868"], CM: ["#007A5E", "#CE1126"], NG: ["#008751", "#FFFFFF"],
  SN: ["#00853F", "#FDEF42"], CI: ["#F77F00", "#009E60"], GH: ["#FCD116", "#006B3F"], MA: ["#C1272D", "#006233"],
  DZ: ["#006233", "#FFFFFF"], EG: ["#CE1126", "#FFFFFF"], TN: ["#E70013", "#FFFFFF"], JP: ["#000555", "#FFFFFF"],
  KR: ["#C60C30", "#003478"], AU: ["#FFCD00", "#00843D"], CH: ["#D52B1E", "#FFFFFF"], AT: ["#ED2939", "#FFFFFF"],
  PL: ["#FFFFFF", "#DC143C"], CZ: ["#D7141A", "#11457E"], SK: ["#0B4EA2", "#EE1C25"], HU: ["#CE2939", "#477050"],
  RO: ["#FCD116", "#002B7F"], BG: ["#FFFFFF", "#00966E"], GR: ["#0D5EAF", "#FFFFFF"], RU: ["#FFFFFF", "#D52B1E"],
  UA: ["#FFD500", "#005BBB"], SE: ["#FECC00", "#006AA7"], NO: ["#BA0C2F", "#00205B"], DK: ["#C8102E", "#FFFFFF"],
  FI: ["#FFFFFF", "#002F6C"], IE: ["#169B62", "#FFFFFF"], SC: ["#005EB8", "#FFFFFF"], WL: ["#C8102E", "#00B140"],
  BA: ["#002395", "#FECB00"], SI: ["#FFFFFF", "#005DA4"], MK: ["#D20000", "#FFE600"], AL: ["#E41E20", "#000000"],
  GE: ["#FFFFFF", "#FF0000"], AZ: ["#00B5E2", "#EF3340"], IR: ["#FFFFFF", "#DA0000"], CL: ["#D52B1E", "#0039A6"],
  PY: ["#D52B1E", "#FFFFFF"], PE: ["#FFFFFF", "#D91023"], EC: ["#FFD100", "#034EA2"], VE: ["#7B1F2E", "#FFCC00"],
  CR: ["#CE1126", "#002B7F"], IS: ["#02529C", "#FFFFFF"], CY: ["#FFFFFF", "#D57800"], IL: ["#FFFFFF", "#0038B8"],
};

// nötr sahne (kulüp renkleri bunun üstünde doğru görünür); Gündüz temasında açık sahne
export const SAHNE = COLORS.acik ? "#F3F5F8" : "#141518";

function hexRgb(h) {
  const x = String(h || "").replace("#", "");
  if (x.length !== 6) return null;
  return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
}
// Parıltıya uygun mu? (çok koyu/çok açık/gri renkler nötr sayılır)
function renkliMi(h) {
  const c = hexRgb(h);
  if (!c) return false;
  const mx = Math.max(...c), mn = Math.min(...c);
  return mx - mn >= 48 && mx >= 70;
}

function sariMi(h) {
  // OKLCH ton 40–115 = turuncu-sarı-altın: koyu sahnede ışık olarak kahve/zeytin olur
  if (!hexRgb(h)) return false;
  const [, C, t] = _oklch(h);
  return C > 0.08 && t >= 40 && t <= 115;
}

function aydinlik(h) {
  const c = hexRgb(h);
  if (!c) return 0;
  const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function kulupRenkleri(ad) {
  if (!ad) return null;
  let known = KNOWN_COLORS[ad];
  if (!known) for (const a of kulupGrubu(ad)) { known = KNOWN_COLORS[a]; if (known) break; }
  if (known) return known;
  const logo = clubLogo(ad);
  return (logo && logo.id && LOGO_RENK[logo.id]) || null;
}

export function ulkeRenkleri(ad) {
  const kanonik = canonicalCountryName(ad) || ad;
  const iso = COUNTRIES[kanonik] && COUNTRIES[kanonik].iso;
  return (iso && ULKE_RENK[iso]) || null;
}

// Bir yarının renkleri: { parilti: parıltı rengi | null, atki: [renk, renk?] }
export function yariRenkleri(x) {
  const r = (x && (x.tip === "ulke" ? ulkeRenkleri(x.ad) : kulupRenkleri(x.ad))) || null;
  if (!r) return { parilti: null, atki: null };
  // Açık renkler (sarı, altın) koyu zeminde bulanık yeşile kayıyor: ikinci renk
  // de renkliyse ve daha koyuysa parıltıda o kullanılır (GS kırmızı, FB lacivert).
  // Paket 33: sarı/altın (ton 60–115) koyu sahnede ışık olarak zeytin-kahveye döner →
  // ışık olarak kullanılmaz (Dortmund, Villarreal); sarı yalnız atkıda görünür.
  const renkli = r.filter((x) => renkliMi(x) && !sariMi(x));
  const parilti = renkli.length > 1 && aydinlik(renkli[0]) > 0.45 && aydinlik(renkli[1]) < aydinlik(renkli[0]) ? renkli[1] : renkli[0] || null;
  return { parilti, atki: r.filter(Boolean).slice(0, 2) };
}

function Yari({ x, kompakt, arma }) {
  const { parilti, atki } = yariRenkleri(x);
  const ulke = x.tip === "ulke";
  return (
    <View style={s.yari}>
      {parilti ? (
        <LinearGradient
          colors={[saydam(parilti, COLORS.acik ? 0.3 : 0.42), saydam(parilti, COLORS.acik ? 0.08 : 0.12), saydam(parilti, 0)]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: saydam(COLORS.text, 0.035) }]} pointerEvents="none" />
      )}
      <View style={s.atki}>
        {(atki || [saydam(COLORS.text, 0.14)]).map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}
      </View>
      <View style={[s.icerik, kompakt && s.icerikKompakt]}>
        {ulke ? (
          <Text style={[s.bayrak, kompakt && { fontSize: 40, lineHeight: 48 }]}>{flagForCountry(x.ad)}</Text>
        ) : (
          <TeamBadge name={x.ad} size={arma || (kompakt ? 44 : 64)} />
        )}
        <Text style={[s.ad, kompakt && s.adKompakt]} numberOfLines={2}>{ulke ? countryTr(x.ad) : x.ad}</Text>
        {x.alt ? <Text style={s.alt} numberOfLines={1}>{x.alt}</Text> : null}
      </View>
    </View>
  );
}

export default function EslesmeKarti({ sol, sag, kompakt, ayirac = "×", arma, style }) {
  if (!sol || !sag) return null;
  return (
    <View style={[s.kart, style]}>
      <Yari x={sol} kompakt={kompakt} arma={arma} />
      <View style={s.cizgi} />
      <Yari x={sag} kompakt={kompakt} arma={arma} />
      <View style={s.madalyonKap} pointerEvents="none">
        <View style={[s.madalyon, kompakt && s.madalyonKompakt]}>
          <Text style={[s.madalyonYazi, kompakt && { fontSize: 13 }]}>{ayirac}</Text>
        </View>
      </View>
    </View>
  );
}

// Bir hücrenin arkasına kulüp parıltısı + atkı (5 Kulüp ızgarası). Hücre
// `overflow: "hidden"` olmalı; içerik bunun üstüne çizilir.
export function KulupParlakligi({ ad, tip = "kulup", guc = 0.3 }) {
  const { parilti, atki } = yariRenkleri({ tip, ad });
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: SAHNE }]} pointerEvents="none">
      {parilti ? (
        <LinearGradient colors={[saydam(parilti, guc), saydam(parilti, 0)]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: saydam(COLORS.text, 0.035) }]} />
      )}
      <View style={[s.atki, { height: 3 }]}>
        {(atki || [saydam(COLORS.text, 0.14)]).map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}
      </View>
    </View>
  );
}

// Yalnız tek bir takım/ülke (ör. Takımı Sen Seç'te seçilen takım) için aynı dil.
export function TekTakimKarti({ x, kompakt, style }) {
  if (!x) return null;
  return (
    <View style={[s.kart, style]}>
      <Yari x={x} kompakt={kompakt} />
    </View>
  );
}

const s = StyleSheet.create({
  // Paket 33: kartın zemini NÖTR "sahne" — kulüp renkleri tema yüzeyinin (GS şarap,
  // FB lacivert) üstüne binince karışıp kahveye/çamura dönüyordu (turuncu Shakhtar
  // ışığı şarap kart üstünde kahve). TV maç grafiği gibi: nötr koyu sahne, renk kulüpten.
  kart: {
    flexDirection: "row", borderRadius: 20, overflow: "hidden",
    backgroundColor: SAHNE, borderWidth: 1, borderColor: COLORS.acik ? COLORS.cardBorder : saydam("#FFFFFF", 0.09),
  },
  yari: { flex: 1, minWidth: 0 },
  atki: { flexDirection: "row", height: 4 },
  icerik: { alignItems: "center", paddingTop: 18, paddingBottom: 16, paddingHorizontal: 10, gap: 8 },
  icerikKompakt: { paddingTop: 12, paddingBottom: 10, gap: 4 },
  bayrak: { fontSize: 52, lineHeight: 64 },
  ad: { color: COLORS.text, fontSize: 15, fontWeight: "900", textAlign: "center" },
  adKompakt: { fontSize: 13 },
  alt: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700" },
  cizgi: { width: 1, backgroundColor: saydam(COLORS.text, 0.08) },
  madalyonKap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  madalyon: {
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.acik ? "#FFFFFF" : "#0B0B0D", borderWidth: 1, borderColor: COLORS.acik ? "#D9DFE7" : saydam("#FFFFFF", 0.16),
  },
  madalyonKompakt: { width: 26, height: 26, borderRadius: 13 },
  madalyonYazi: { color: COLORS.textMuted, fontSize: 15, fontWeight: "900", marginTop: -1 },
});
