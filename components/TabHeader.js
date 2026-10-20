import { _t } from "../lib/dil";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, TYPE, SPACING } from "../lib/theme";

// 31 Ağustos 2026: Kerem'in isteği — "3-2-1 / Bitir İşi" HER sekmede üstte görünsün.
// Paket 34 (15 Ekim 2026, Kerem: "tüm modlar, online vb sekmeler içinde hala
// hoşuma gitmeyen bir durum var") — KÖK NEDENLERDEN BİRİ: her sekmenin başı
// başkaydı. Tüm Modlar solda büyük başlık, Online ortada logo + solda başlık,
// Profilim ortada logo + ortada başlık, Ansiklopedi ortada logo + sekmeler.
// Göz her sekmede başka yere bakıyordu. YENİ STANDART (bütün sekmeler):
//   [3-2-1 BİTİR İŞİ]                 [sağ: rozet / düğme]
//   Büyük sola dayalı başlık
// `baslik` verilmezse (bekleme ekranları) yalnız marka satırı ortada.
export default function TabHeader({ baslik, sag, compact = false, style }) {
  if (!baslik) {
    return (
      <View style={[styles.ortaWrap, compact && { marginBottom: SPACING.sm }, style]}>
        <Marka />
      </View>
    );
  }
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.ustSatir}>
        <Marka />
        {sag ? <View style={styles.sag}>{sag}</View> : null}
      </View>
      <Text style={styles.baslik} numberOfLines={1} accessibilityRole="header">{baslik}</Text>
    </View>
  );
}

function Marka() {
  return (
    <Text style={styles.marka} accessibilityLabel={_t("3-2-1 Bitir İşi")}>
      <Text style={{ color: COLORS.accent }}>3-2-1</Text>{" "}{_t("BİTİR İŞİ")}</Text>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: SPACING.lg },
  ortaWrap: { alignItems: "center", marginBottom: SPACING.lg },
  ustSatir: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36 },
  sag: { flexShrink: 0, marginLeft: SPACING.md },
  marka: { color: COLORS.textMuted, fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  baslik: { ...TYPE.h1, fontSize: 32, lineHeight: 38, letterSpacing: -0.5, marginTop: 2 },
});
