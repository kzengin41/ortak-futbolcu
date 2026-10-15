import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, saydam, vurguZemini } from "../lib/theme";

// ============================================================================
// ALT SEKME ÇUBUĞU — Paket 31 (14 Ekim 2026)
// Kerem: "şu alttaki renk paletleri iyi değil halen. güncellenmeli" (alt sekme
// çubuğu). ESKİ: react-navigation'ın düz çubuğu — bütün ikonlar dolu, seçili
// sekme yalnız renkle ayrılıyordu (GS'de sarı ikon + sarı yazı, öbürleri gri);
// çubuk kart renginde, ekranın geri kalanından kopuk.
// YENİ (Material 3 gezinme çubuğu mantığı):
//   • seçili sekme: ikon dolu, temanın eylem renginde, arkasında yumuşak bir
//     "hap" (renginin %16'sı); yazı beyaz ve kalın
//   • diğerleri: ince çizgili (outline) ikon, soluk yazı
//   • çubuk zeminle kart arasında kendi tonunda (COLORS.tabBar), üstte ince çizgi
// react-navigation `tabBar` olarak da, düz bileşen olarak da (önizleme) çalışır.
// ============================================================================
export const SEKME_IKONLARI = {
  oyna: "home",
  tumModlar: "grid",
  online: "flame",
  ansiklopedi: "book",
  profilim: "person-circle",
};

export function SekmeCubugu({ sekmeler, aktif, onSec, altBosluk = 0 }) {
  return (
    <View style={[s.cubuk, { paddingBottom: 8 + altBosluk }]}>
      {sekmeler.map((t) => {
        const akt = t.ad === aktif;
        const ikon = SEKME_IKONLARI[t.ad] || "ellipse";
        return (
          <Pressable
            key={t.ad}
            onPress={() => onSec && onSec(t)}
            style={s.sekme}
            accessibilityRole="tab"
            accessibilityState={{ selected: akt }}
            accessibilityLabel={t.baslik}
            hitSlop={4}
          >
            <View style={[s.hap, akt && s.hapAktif]}>
              <Ionicons name={akt ? ikon : `${ikon}-outline`} size={22} color={akt ? COLORS.accent : COLORS.textMuted} />
            </View>
            <Text style={[s.yazi, akt && s.yaziAktif]} numberOfLines={1}>{t.baslik}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// react-navigation bottom-tabs için
export default function AltSekmeCubugu({ state, descriptors, navigation, insets }) {
  const sekmeler = state.routes.map((r) => ({ ad: r.name, key: r.key, baslik: descriptors[r.key]?.options?.title || r.name }));
  return (
    <SekmeCubugu
      sekmeler={sekmeler}
      aktif={state.routes[state.index]?.name}
      altBosluk={insets?.bottom || 0}
      onSec={(t) => {
        const olay = navigation.emit({ type: "tabPress", target: t.key, canPreventDefault: true });
        if (!olay.defaultPrevented && state.routes[state.index]?.name !== t.ad) navigation.navigate(t.ad);
      }}
    />
  );
}

const s = StyleSheet.create({
  cubuk: {
    flexDirection: "row", backgroundColor: COLORS.tabBar || COLORS.card,
    borderTopWidth: 1, borderTopColor: saydam(COLORS.text, 0.08), paddingTop: 8,
  },
  sekme: { flex: 1, alignItems: "center", gap: 3 },
  hap: { width: 56, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  hapAktif: { backgroundColor: vurguZemini(0.16) },
  yazi: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  yaziAktif: { color: COLORS.text, fontWeight: "800" },
});
