import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PlayerPhoto from "./PlayerPhoto";
import SoundPressable from "./SoundPressable";
import { COLORS, RADIUS } from "../lib/theme";
import { HAT_ETIKET } from "../lib/kadrolar";

// ============================================================================
// SAHA — kadronun saha görünümü (4 Ekim 2026). Üstte forvetler, altta kaleci.
// satirlar: lib/kadrolar.js sahaSatirlari(...) çıktısı.
// bulundu(o): bu oyuncu açık mı?  acik: bilinmeyenleri de göster (kırmızı).
// ============================================================================
const SAHA_YESIL = "#1E6B3A";
const CIZGI = "rgba(255,255,255,0.35)";

const soyad = (ad) => {
  const p = String(ad).split(" ");
  return p.length > 1 ? p.slice(-1)[0] : ad;
};

export function OyuncuNoktasi({ o, acikMi, kirmizi, boyut = 46, onPress }) {
  const ic = acikMi && o.v ? (
    <PlayerPhoto name={o.a} size={boyut - 4} showProfileOnPress={false} />
  ) : acikMi ? (
    <Text style={[s.harf, { fontSize: boyut * 0.36 }]}>{String(o.a).slice(0, 1)}</Text>
  ) : (
    <Text style={[s.no, { fontSize: boyut * 0.36 }]}>{o.n != null ? o.n : "?"}</Text>
  );
  const govde = (
    <View style={s.nokta}>
      <View style={[s.daire, { width: boyut, height: boyut, borderRadius: boyut / 2 },
        acikMi && s.daireAcik, kirmizi && s.daireKirmizi]}>
        {ic}
      </View>
      <Text style={[s.ad, !acikMi && !kirmizi && s.adKapali]} numberOfLines={1}>
        {acikMi || kirmizi ? soyad(o.a) : HAT_ETIKET[o.p] || o.p}
      </Text>
    </View>
  );
  if (!onPress) return govde;
  return (
    <SoundPressable onPress={() => onPress(o)} accessibilityLabel={acikMi || kirmizi ? o.a : `${HAT_ETIKET[o.p]} ${o.n ?? ""}, bilinmiyor`}>
      {govde}
    </SoundPressable>
  );
}

export default function Saha({ satirlar, bulundu, acik = false, onPress, boyut = 46 }) {
  return (
    <View style={s.saha}>
      <View style={s.ortaCizgi} />
      <View style={s.ortaDaire} />
      <View style={[s.ceza, { top: -1 }]} />
      <View style={[s.ceza, { bottom: -1 }]} />
      {satirlar.map((satir, r) => (
        <View key={r} style={s.satir}>
          {satir.map((o) => {
            const b = bulundu(o);
            return <OyuncuNoktasi key={o.i ?? o.a} o={o} acikMi={b} kirmizi={acik && !b} boyut={boyut} onPress={onPress} />;
          })}
        </View>
      ))}
    </View>
  );
}

// Yedek kulübesi
export function Kulube({ yedek, bulundu, acik = false, onPress }) {
  if (!yedek || !yedek.length) return null;
  return (
    <View style={s.kulube}>
      <View style={s.kulubeBaslik}>
        <Ionicons name="people" size={14} color={COLORS.textMuted} />
        <Text style={s.kulubeYazi}>YEDEKLER</Text>
      </View>
      <View style={s.kulubeSatir}>
        {yedek.map((o, i) => {
          const b = bulundu(o);
          return <OyuncuNoktasi key={o.a + i} o={o} acikMi={b} kirmizi={acik && !b} boyut={38} onPress={onPress} />;
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  saha: { backgroundColor: SAHA_YESIL, borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 6, gap: 12, overflow: "hidden", borderWidth: 2, borderColor: CIZGI },
  ortaCizgi: { position: "absolute", left: 0, right: 0, top: "50%", height: 2, backgroundColor: CIZGI },
  ortaDaire: { position: "absolute", left: "50%", top: "50%", width: 70, height: 70, marginLeft: -35, marginTop: -35, borderRadius: 35, borderWidth: 2, borderColor: CIZGI },
  ceza: { position: "absolute", left: "25%", width: "50%", height: 34, borderWidth: 2, borderColor: CIZGI },
  satir: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "flex-start" },
  nokta: { alignItems: "center", width: 64 },
  daire: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)", borderWidth: 2, borderColor: "rgba(255,255,255,0.6)", overflow: "hidden" },
  daireAcik: { backgroundColor: "#FFFFFF", borderColor: COLORS.accent },
  daireKirmizi: { backgroundColor: "rgba(255,93,93,0.85)", borderColor: "#FF5D5D" },
  no: { color: "#FFFFFF", fontWeight: "900" },
  harf: { color: "#1E6B3A", fontWeight: "900" },
  ad: { marginTop: 3, fontSize: 11, fontWeight: "900", color: "#FFFFFF", textAlign: "center", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3 },
  adKapali: { color: "rgba(255,255,255,0.7)", fontWeight: "800" },
  kulube: { marginTop: 10, padding: 10, borderRadius: RADIUS.lg, backgroundColor: SAHA_YESIL, opacity: 0.95 },
  kulubeBaslik: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  kulubeYazi: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: "rgba(255,255,255,0.8)" },
  kulubeSatir: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", rowGap: 8 },
});
