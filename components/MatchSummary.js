import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getStats } from "../lib/stats";
import { COLORS, SPACING, RADIUS, TYPE } from "../lib/theme";

// ============================================================================
// MAÇ SONU ÖZETİ — 12 Eylül 2026
//
// Denetimden: "gameOver panelinde yalnızca 'Tekrar Oyna' var: en iyi skor,
// rekor, seri rekoru, doğruluk yüzdesi — hiçbiri yok. lib/stats.js veriyi
// topluyor ama oyun sonu ekranlarının hiçbiri bu veriyi okumuyor."
//
// Bu bileşen o veriyi okuyup üç şey gösteriyor: kazanılan XP, bu moddaki
// doğruluk oranı ve en iyi seri. Rekor kırıldıysa vurguluyor — "bir tur daha"
// hissini üreten şey bu.
//
// Ortak bileşen; her oyun ekranının gameOver bloğuna tek satırla giriyor.
// ============================================================================
export default function MatchSummary({ modeId, kazanildi, kazanilanXp }) {
  const [veri, setVeri] = useState(null);

  React.useEffect(() => {
    let iptal = false;
    getStats().then((s) => { if (!iptal) setVeri(s); }).catch(() => {});
    return () => { iptal = true; };
  }, []);

  const mod = veri?.modes?.[modeId];
  const dogru = mod?.wins || 0;
  const yanlis = mod?.losses || 0;
  const toplam = dogru + yanlis;
  const oran = toplam ? Math.round((dogru / toplam) * 100) : 0;
  const enIyiSeri = veri?.bestStreak || 0;
  const suAnkiSeri = veri?.currentStreak || 0;
  const rekorKirildi = suAnkiSeri > 0 && suAnkiSeri === enIyiSeri && enIyiSeri >= 3;

  return (
    <View style={styles.kart}>
      <View style={styles.satir}>
        <Ionicons name="trending-up" size={16} color={COLORS.accent} />
        <Text style={styles.etiket}>Kazanılan XP</Text>
        <Text style={styles.deger}>+{kazanilanXp}</Text>
      </View>

      {toplam > 0 && (
        <View style={styles.satir}>
          <Ionicons name="stats-chart" size={16} color={COLORS.textMuted} />
          <Text style={styles.etiket}>Bu moddaki isabetin</Text>
          <Text style={styles.deger}>%{oran}</Text>
        </View>
      )}

      <View style={styles.satir}>
        <Ionicons name="flame" size={16} color={rekorKirildi ? COLORS.cta : COLORS.textMuted} />
        <Text style={styles.etiket}>En iyi doğru serisi</Text>
        <Text style={[styles.deger, rekorKirildi && { color: COLORS.cta }]}>{enIyiSeri}</Text>
      </View>

      {rekorKirildi && <Text style={styles.rekor}>YENİ REKOR</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  kart: {
    alignSelf: "stretch",
    backgroundColor: COLORS.card,
    borderColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  satir: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  etiket: { ...TYPE.bodyMuted, flex: 1, fontSize: 13 },
  deger: { ...TYPE.h3, fontSize: 15, fontVariant: ["tabular-nums"] },
  rekor: {
    color: COLORS.cta, fontSize: 10, fontWeight: "900", letterSpacing: 1.5,
    textAlign: "center", marginTop: 2,
  },
});
