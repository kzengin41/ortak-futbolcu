import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressScale from "./ui/PressScale";
import ModIkon from "./ModIkon";
import { COLORS, RADIUS, SPACING, saydam } from "../lib/theme";

// ============================================================================
// MOD KAROSU — Paket 34 (15 Ekim 2026)
// Kerem: "oyunun oyun olduğu belli olsun. bir sürü menüyle, kalabalıkla falan
// insanların canını sıkmasın. oynamaya yönlendirsin." Mod düzeni sorusuna
// "bilemedim" dedi; karar: OYUN KAROLARI (konsol menüsü hissi).
// ESKİ: alt alta liste satırları (ikon + başlık + açıklama + ›) — ayarlar
// menüsüyle aynı görünüyordu; "oyun" değil "menü" hissi buradan geliyordu.
// YENİ: 2 sütunlu kareler — büyük mod ikonu, kısa ad, tek satır ne olduğu.
// Günün modunda "2× XP" rozeti ve vurgu çerçevesi. Tüm Modlar ve Online aynı
// karoyu kullanır (iki sekme aynı dili konuşur).
// ============================================================================
export function ModKaro({ ikon, icon, baslik, alt, onPress, rozet, gunun, accessibilityLabel, style }) {
  return (
    <PressScale
      style={[s.karo, gunun && s.karoGunun, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || baslik}
      accessibilityHint={gunun ? "Günün modu: bu modda XP iki kat" : undefined}
    >
      <View style={s.ust}>
        <View style={[s.ikon, gunun && s.ikonGunun]}>
          {ikon ? <ModIkon ad={ikon} boyut={28} renk={gunun ? COLORS.accent : COLORS.text} /> : <Ionicons name={icon || "play"} size={26} color={gunun ? COLORS.accent : COLORS.text} />}
        </View>
        {gunun ? (
          <View style={s.xp}><Text style={s.xpYazi}>2× XP</Text></View>
        ) : rozet ? (
          <View style={s.rozet}><Text style={s.rozetYazi}>{rozet}</Text></View>
        ) : null}
      </View>
      <View style={s.metin}>
        <Text style={s.baslik} numberOfLines={1}>{baslik}</Text>
        {alt ? <Text style={s.alt} numberOfLines={2}>{alt}</Text> : null}
      </View>
    </PressScale>
  );
}

// 2 sütunlu ızgara (tek sayıda öğede son karo tam genişlik olmaz, yarım kalır).
export function ModIzgarasi({ children, style }) {
  const dizi = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[s.izgara, style]}>
      {dizi.map((c, i) => (
        <View key={i} style={s.hucre}>{c}</View>
      ))}
    </View>
  );
}

export function BolumBasligi({ children, sag }) {
  return (
    <View style={s.bolum}>
      <Text style={s.bolumYazi}>{children}</Text>
      {sag || null}
    </View>
  );
}

const s = StyleSheet.create({
  izgara: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: SPACING.xl - 6 },
  hucre: { width: "50%", padding: 6 },
  karo: {
    minHeight: 148, borderRadius: 22, padding: SPACING.md + 2, justifyContent: "space-between",
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: saydam(COLORS.text, 0.07),
  },
  karoGunun: { borderColor: COLORS.accent, borderWidth: 1.5 },
  ust: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  ikon: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: saydam(COLORS.text, 0.07) },
  ikonGunun: { backgroundColor: saydam(COLORS.text, 0.1) },
  metin: { marginTop: SPACING.md },
  baslik: { color: COLORS.text, fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
  alt: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600", lineHeight: 16, marginTop: 3 },
  xp: { backgroundColor: COLORS.accent, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  xpYazi: { color: COLORS.accentDark, fontSize: 11, fontWeight: "900", letterSpacing: 0.4 },
  rozet: { backgroundColor: saydam(COLORS.text, 0.1), borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  rozetYazi: { color: COLORS.text, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  bolum: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: SPACING.xl + 4, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  bolumYazi: { color: COLORS.textMuted, fontWeight: "900", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" },
});
