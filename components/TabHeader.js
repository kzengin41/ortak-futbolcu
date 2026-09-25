import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { TYPE, SPACING } from "../lib/theme";

// 31 Ağustos 2026: Kerem'in isteği — "3-2-1 / Ortak Futbolcu" yazısı yerine
// "3-2-1 / Bitir İşi" gelsin ve bu HER sekmede üstte görünsün. Tek yerden
// yönetilsin diye ortak bir bileşene çıkarıldı (4 ayrı ekranda kopya metin
// olmasın, ileride tekrar değişirse tek dosya yeter).
export default function TabHeader({ compact = false }) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.big, compact && styles.bigCompact]}>3-2-1</Text>
      <Text style={styles.sub}>BİTİR İŞİ</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginBottom: SPACING.lg },
  wrapCompact: { marginBottom: SPACING.sm },
  big: { ...TYPE.display, fontSize: 40 },
  bigCompact: { fontSize: 24 },
  sub: { ...TYPE.eyebrow },
});
