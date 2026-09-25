import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import PressScale from "../components/ui/PressScale";
import SoundPressable from "../components/SoundPressable";
import { COLORS, SPACING, RADIUS, TYPE } from "../lib/theme";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "shield-checkmark",
    title: "3-2-1: Bitir İşi",
    body: "İki takım söylenir. Amacın, ikisinde de oynamış bir futbolcunun adını rakibinden önce söylemek.",
  },
  {
    icon: "flash",
    title: "Buzz'la, hızlı ol",
    body: "Cevabı biliyorsan buzz'la ve süre içinde yaz (ya da söyle). Bilmiyorsan \"Bilemedim\" de, beklemene gerek yok.",
  },
  {
    icon: "people",
    title: "Kendi tarzında oyna",
    body: "Tek telefonda arkadaşınla, CPU'ya karşı pratik yaparak ya da online 1v1 düellolarla — lig ve kapsamı da sen seçersin.",
  },
];

export default function OnboardingScreen({ onDone }) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef(null);

  function goTo(i) {
    setIndex(i);
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
  }

  function next() {
    if (index < SLIDES.length - 1) goTo(index + 1);
    else onDone();
  }

  return (
    <GameBackground style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(i);
        }}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={styles.iconWrap}>
              <Ionicons name={s.icon} size={40} color={COLORS.accentDark} />
            </View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.buttonRow}>
          <SoundPressable onPress={onDone} hitSlop={12}>
            <Text style={styles.skipText}>Geç</Text>
          </SoundPressable>
          <PressScale onPress={next} style={styles.nextBtn}>
            <Text style={styles.nextBtnText}>{index === SLIDES.length - 1 ? "Başla" : "İleri"}</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.accentDark} />
          </PressScale>
        </View>
      </View>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xl,
  },
  title: { ...TYPE.h1, textAlign: "center", marginBottom: SPACING.md },
  body: { ...TYPE.body, textAlign: "center", color: COLORS.text, lineHeight: 24 },
  footer: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxl, paddingTop: SPACING.sm },
  dots: { flexDirection: "row", justifyContent: "center", gap: SPACING.sm, marginBottom: SPACING.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.cardBorder },
  dotActive: { backgroundColor: COLORS.accent, width: 20 },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  skipText: { color: COLORS.textMuted, fontSize: 14, fontWeight: "600" },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  nextBtnText: { color: COLORS.accentDark, fontWeight: "900", textTransform: "uppercase", fontSize: 13 },
});
