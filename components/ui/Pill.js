import React from "react";
import { Text, StyleSheet } from "react-native";
import SoundPressable from "../SoundPressable";
import { COLORS, RADIUS, SPACING, TYPE } from "../../lib/theme";

// Küçük, ikincil aksiyon butonu — mod kartları içindeki "CPU seç / Sen seç" gibi
// alt seçenekler için kullanılır. Tek bir yerde tanımlı olsun diye buraya alındı.
export default function Pill({ label, active, onPress, tone = "accent" }) {
  const toneColor = tone === "accent" ? COLORS.accent : COLORS.cta;
  return (
    <SoundPressable
      onPress={onPress}
      style={[
        styles.pill,
        { borderColor: toneColor },
        active && { backgroundColor: toneColor },
      ]}
    >
      <Text style={[styles.label, active && { color: COLORS.accentDark }]}>{label}</Text>
    </SoundPressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1.5,
    borderRadius: RADIUS.pill,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { ...TYPE.caption, color: COLORS.text, fontWeight: "800" },
});
