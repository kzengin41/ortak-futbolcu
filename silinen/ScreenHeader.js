import React from "react";
import { View, Text, StyleSheet } from "react-native";
import BackButton from "../BackButton";
import { COLORS, SPACING, TYPE } from "../../lib/theme";

// Tüm oyun ekranlarında aynı üst başlık düzenini garanti eder:
// geri butonu + başlık + (opsiyonel) sağ taraf (skor, süre vb.)
export default function ScreenHeader({ title, onBack, confirmExit = true, right = null }) {
  return (
    <View>
      <View style={styles.row}>
        <BackButton onPress={onBack} confirm={confirmExit} style={{ marginBottom: 0, marginTop: 0 }} />
        {right}
      </View>
      {!!title && <Text style={styles.title}>{title}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  title: { ...TYPE.h1, marginBottom: SPACING.lg },
});
