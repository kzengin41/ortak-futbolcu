import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS } from "../lib/theme";
import { useTikSound } from "../lib/useGameSounds";

// Paket 46 — SON 3 SANİYE GERİLİMİ: süre 3, 2, 1'e inince çubuk kırmızı nabız
// atar, her saniye hafif titreşim ve "tik" sesi (dokunma sesi ayarıyla). Kısa
// sayaçlarda (toplam < 5 sn) ya da gerilim={false} verilince kapalı.
export default function TimerBar({ current, total, gerilim = true }) {
  const widthAnim = useRef(new Animated.Value(Math.max(0, current / total))).current;
  const nabiz = useRef(new Animated.Value(1)).current;
  const tik = useTikSound();
  const sonGerilim = gerilim && total >= 5 && current > 0 && current <= 3;

  useEffect(() => {
    // Smooth width transition
    Animated.timing(widthAnim, {
      toValue: Math.max(0, current / total),
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [current, total]);

  useEffect(() => {
    if (!sonGerilim) return;
    tik();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    nabiz.setValue(1);
    Animated.sequence([
      Animated.timing(nabiz, { toValue: 1.9, duration: 120, useNativeDriver: true }),
      Animated.timing(nabiz, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, sonGerilim]);

  const color = widthAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ["#FF5D5D", "#FFB020", COLORS.accent]
  });

  return (
    <Animated.View style={[styles.container, sonGerilim && styles.gerilim, { transform: [{ scaleY: nabiz }] }]}>
      <Animated.View style={[styles.bar, {
        width: widthAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ["0%", "100%"]
        }),
        backgroundColor: sonGerilim ? "#FF3B3B" : color
      }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 6,
    overflow: "hidden",
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.card,
  },
  gerilim: { borderColor: "#FF3B3B" },
  bar: {
    height: "100%",
  }
});
