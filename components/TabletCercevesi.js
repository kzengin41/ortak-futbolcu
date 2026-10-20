import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { AZAMI_GENISLIK } from "../lib/ekran";
import { COLORS } from "../lib/theme";

// Paket 40 — geniş ekranda (tablet) uygulamayı ortada telefon genişliğinde bir
// sütunda çizer. Telefonda çocukları olduğu gibi döndürür (fazladan View yok).
export default function TabletCercevesi({ children }) {
  const { width } = useWindowDimensions();
  if (width <= AZAMI_GENISLIK) return children;
  return (
    <View style={s.dis}>
      <View style={[s.sutun, { width: AZAMI_GENISLIK }]}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  dis: { flex: 1, flexDirection: "row", justifyContent: "center", backgroundColor: COLORS.tabBar || COLORS.bg },
  sutun: { flexGrow: 0, flexShrink: 0, alignSelf: "stretch", backgroundColor: COLORS.bg, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: COLORS.cardBorder, overflow: "hidden" },
});
