import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { getProfile, xpProgress } from "../lib/profile";
import { getStreak, seriDurumu } from "../lib/streak";
import { COLORS, SPACING, RADIUS, TYPE } from "../lib/theme";

// ============================================================================
// SEVİYE + XP + SERİ ŞERİDİ — 12 Eylül 2026
//
// Denetimden: "Uygulamayı açan kullanıcının ilk gördüğü ekran (Oyna)
// ilerlemeye dair TEK BİR PİKSEL göstermiyor." Seviye, XP ve günlük seri
// Profilim sekmesinin içine gömülüydü; oyuncu oraya gitmedikçe ilerlediğini
// hiç görmüyordu.
//
// Seri "risk altında" hâli bilinçli: bugün henüz oynanmadıysa alev soluklaşıp
// amber'a dönüyor ve "bugün oynamadın" diyor. Kaybedilebilir olduğunu
// göstermek, seriyi anlamlı kılan şeyin ta kendisi.
// ============================================================================

function bugunStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PlayerStatusBar() {
  const [profil, setProfil] = useState(null);
  const [seri, setSeri] = useState({ count: 0, lastPlayedDate: null });

  // Ekrana her dönüşte tazele — oyundan çıkıp geldiğinde yeni XP görünsün.
  useFocusEffect(
    useCallback(() => {
      let iptal = false;
      getProfile().then((p) => !iptal && setProfil(p)).catch(() => {});
      getStreak().then((s) => !iptal && setSeri(s)).catch(() => {});
      return () => { iptal = true; };
    }, [])
  );

  const ilerleme = xpProgress(profil);
  // 4 Ekim 2026 (.29585) — tek seri kuralı + dondurma.
  const sd = seriDurumu(seri);
  const seriSayi = sd.gosterilen;
  const seriRiskte = seriSayi > 0 && sd.durum !== "tamam";

  return (
    <View style={styles.serit}>
      <View style={styles.seviyeRozeti}>
        <Text style={styles.seviyeYazi}>{ilerleme.level}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.ustSatir}>
          <Text style={styles.etiket}>SEVİYE {ilerleme.level}</Text>
          <Text style={styles.xpYazi}>
            {ilerleme.into} / {ilerleme.needed} XP
          </Text>
        </View>
        <View style={styles.barZemin}>
          <View style={[styles.barDolgu, { width: `${Math.round(ilerleme.fraction * 100)}%` }]} />
        </View>
      </View>

      <View style={[styles.seriKutu, seriRiskte && styles.seriKutuRiskte]}>
        <Ionicons
          name="flame"
          size={16}
          color={seriSayi === 0 ? COLORS.textFaint : seriRiskte ? COLORS.cta : COLORS.accent}
        />
        <Text
          style={[
            styles.seriSayi,
            seriSayi === 0 && { color: COLORS.textMuted },
            seriRiskte && { color: COLORS.cta },
          ]}
        >
          {seriSayi}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  serit: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  seviyeRozeti: {
    width: 38, height: 38, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center",
  },
  seviyeYazi: { color: COLORS.accentDark, fontWeight: "900", fontSize: 16 },
  ustSatir: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  etiket: { ...TYPE.caption, fontSize: 12, letterSpacing: 1, fontWeight: "900" },
  xpYazi: { ...TYPE.caption, fontSize: 12, color: COLORS.textMuted, fontVariant: ["tabular-nums"] },
  barZemin: {
    height: 5, backgroundColor: COLORS.bg, borderRadius: RADIUS.pill,
    marginTop: 5, overflow: "hidden",
  },
  barDolgu: { height: "100%", backgroundColor: COLORS.accent, borderRadius: RADIUS.pill },
  seriKutu: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.bg, borderRadius: RADIUS.pill,
    paddingVertical: 6, paddingHorizontal: 10,
  },
  seriKutuRiskte: { borderColor: COLORS.cta, borderWidth: 1 },
  seriSayi: { color: COLORS.accent, fontWeight: "900", fontSize: 14, fontVariant: ["tabular-nums"] },
});
