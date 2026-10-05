import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import { useGuncellemeHazir, yenidenBaslat } from "../lib/guncelleme";
import { useAltBosluk } from "../lib/altBosluk";
import { COLORS, RADIUS } from "../lib/theme";

// Yeni sürüm indirildiğinde ekranın altında çıkan bant (bkz. lib/guncelleme.js).
// "Yenile" uygulamayı bir saniyede yeni sürümle açar; "Sonra" bandı kapatır,
// yeni sürüm bir sonraki açılışta kendiliğinden gelir.
export default function GuncellemeBandi() {
  const hazir = useGuncellemeHazir();
  const [kapali, setKapali] = useState(false);
  const alt = useAltBosluk();
  if (!hazir || kapali) return null;
  return (
    <View style={[s.kap, { bottom: 72 + alt }]} pointerEvents="box-none">
      <View style={s.bant}>
        <Ionicons name="cloud-download" size={18} color={COLORS.accent} />
        <Text style={s.yazi}>Yeni sürüm hazır</Text>
        <SoundPressable onPress={() => setKapali(true)} style={s.sonra} accessibilityLabel="Sonra">
          <Text style={s.sonraYazi}>Sonra</Text>
        </SoundPressable>
        <SoundPressable onPress={yenidenBaslat} style={s.yenile} accessibilityLabel="Yenile">
          <Text style={s.yenileYazi}>Yenile</Text>
        </SoundPressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 998, elevation: 19 },
  bant: {
    flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch",
    paddingVertical: 10, paddingLeft: 14, paddingRight: 8, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.accent,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  yazi: { flex: 1, color: COLORS.text, fontSize: 15, fontWeight: "800" },
  sonra: { paddingVertical: 8, paddingHorizontal: 10 },
  sonraYazi: { color: COLORS.textMuted, fontSize: 13, fontWeight: "700" },
  yenile: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 14 },
  yenileYazi: { color: COLORS.accentDark, fontSize: 14, fontWeight: "900" },
});
