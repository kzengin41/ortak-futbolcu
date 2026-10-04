import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCanliSes } from "../lib/sesCanli";
import { COLORS, RADIUS } from "../lib/theme";

// Paket 18 — konuşurken telefonun duyduğu yazı ekranın üstünde canlı görünür
// (bkz. lib/sesCanli.js). Dokunmaları engellemez (pointerEvents="none").
// App.js'te üst güvenli alanın İÇİNDE monte edildiği için ek boşluk gerekmez.
export default function CanliSesBalonu() {
  const { aktif, metin, isleniyor } = useCanliSes();
  const nabiz = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!aktif) return;
    const d = Animated.loop(Animated.sequence([
      Animated.timing(nabiz, { toValue: 0.35, duration: 520, useNativeDriver: true }),
      Animated.timing(nabiz, { toValue: 1, duration: 520, useNativeDriver: true }),
    ]));
    d.start();
    return () => d.stop();
  }, [aktif, nabiz]);

  if (!aktif && !isleniyor) return null;
  return (
    <View pointerEvents="none" style={s.kap}>
      <View style={s.balon} accessibilityLiveRegion="polite">
        <Animated.View style={[s.nokta, { opacity: aktif ? nabiz : 1, backgroundColor: aktif ? COLORS.danger : COLORS.cta }]} />
        <Ionicons name={isleniyor ? "hourglass" : "mic"} size={16} color={COLORS.text} />
        <Text style={[s.yazi, !metin && s.bos]} numberOfLines={2}>
          {metin || (isleniyor ? "Kontrol ediliyor…" : "Dinliyorum…")}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { position: "absolute", top: 8, left: 16, right: 16, alignItems: "center", zIndex: 999, elevation: 20 },
  balon: {
    flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%",
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.accent,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  nokta: { width: 8, height: 8, borderRadius: 4 },
  yazi: { color: COLORS.text, fontSize: 16, fontWeight: "800", flexShrink: 1 },
  bos: { color: COLORS.textMuted, fontWeight: "700" },
});
