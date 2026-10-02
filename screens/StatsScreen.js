import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import BackButton from "../components/BackButton";
import { getStats, MODE_LABELS } from "../lib/stats";
import { getUnlockedPlayers, getPokedexPool } from "../lib/pokedex";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW } from "../lib/theme";

// Faz 2 (31 Ağustos 2026) — Kerem'in isteği: Profilim'de seviyeye tıklayınca
// VE ayrı bir "İstatistikler" butonuyla açılan, TÜM oyun istatistiklerini
// gösteren ekran (mod bazlı galibiyet/mağlubiyet, en iyi seri, toplam
// doğru/yanlış, ansiklopedi ilerlemesi).
export default function StatsScreen({ onBack }) {
  const [stats, setStats] = useState(null);
  const [pokedex, setPokedex] = useState({ unlocked: 0, total: 0 });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getStats().then((s) => active && setStats(s));
      Promise.all([getUnlockedPlayers(), Promise.resolve(getPokedexPool())]).then(
        ([unlocked, pool]) => active && setPokedex({ unlocked: unlocked.length, total: pool.length })
      );
      return () => { active = false; };
    }, [])
  );

  const modeEntries = stats ? Object.entries(stats.modes || {}) : [];
  const totalGames = modeEntries.reduce((sum, [, m]) => sum + m.wins + m.losses, 0);

  return (
    <GameBackground style={styles.container}>
      <BackButton onPress={onBack} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>İstatistikler</Text>

        {!stats ? (
          <Text style={styles.bodyMuted}>Yükleniyor...</Text>
        ) : totalGames === 0 && pokedex.unlocked === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="stats-chart-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Henüz hiç oyun oynamadın. İlk turunu oynadığında burada istatistiklerin görünecek.</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <SummaryCard icon="checkmark-circle" color={COLORS.accent} label="Toplam Doğru" value={stats.totalCorrect} />
              <SummaryCard icon="close-circle" color={COLORS.danger} label="Toplam Yanlış" value={stats.totalWrong} />
              <SummaryCard icon="flame" color={COLORS.cta} label="En İyi Seri" value={stats.bestStreak} />
            </View>

            <Text style={styles.sectionTitle}>Ansiklopedi İlerlemesi</Text>
            <View style={styles.card}>
              <View style={styles.pokedexRow}>
                <Ionicons name="book" size={20} color={COLORS.accent} />
                <Text style={styles.pokedexText}>{pokedex.unlocked} / {pokedex.total} futbolcu açıldı</Text>
              </View>
              <View style={styles.xpTrack}>
                <View style={[styles.xpFill, { width: `${pokedex.total ? (pokedex.unlocked / pokedex.total) * 100 : 0}%` }]} />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Mod Bazlı Sonuçlar</Text>
            {modeEntries.length === 0 ? (
              <Text style={styles.bodyMuted}>Henüz bir mod oynanmadı.</Text>
            ) : (
              modeEntries
                .sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses))
                .map(([modeId, m]) => {
                  const played = m.wins + m.losses;
                  const rate = played ? Math.round((m.wins / played) * 100) : 0;
                  return (
                    <View key={modeId} style={styles.card}>
                      <View style={styles.modeHeaderRow}>
                        <Text style={styles.modeTitle}>{MODE_LABELS[modeId] || modeId}</Text>
                        <Text style={styles.modeRate}>%{rate}</Text>
                      </View>
                      <View style={styles.modeStatsRow}>
                        <Text style={styles.modeStat}>
                          <Text style={{ color: COLORS.accent, fontWeight: "900" }}>{m.wins}</Text> galibiyet
                        </Text>
                        <Text style={styles.modeStat}>
                          <Text style={{ color: COLORS.danger, fontWeight: "900" }}>{m.losses}</Text> mağlubiyet
                        </Text>
                        <Text style={styles.modeStat}>
                          <Text style={{ color: COLORS.cta, fontWeight: "900" }}>{m.bestStreak}</Text> en iyi seri
                        </Text>
                      </View>
                    </View>
                  );
                })
            )}
          </>
        )}
      </ScrollView>
    </GameBackground>
  );
}

function SummaryCard({ icon, color, label, value }) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 50, paddingHorizontal: SPACING.xl },
  title: { ...TYPE.h1, marginBottom: SPACING.lg },
  bodyMuted: { ...TYPE.bodyMuted },

  emptyCard: {
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.xxl,
    marginTop: SPACING.xl,
  },
  emptyText: { ...TYPE.bodyMuted, textAlign: "center" },

  summaryRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.xl },
  summaryCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    ...SHADOW.card,
  },
  summaryValue: { ...TYPE.h2, fontSize: 20 },
  summaryLabel: { ...TYPE.caption, fontSize: 12, textAlign: "center" },

  sectionTitle: { ...TYPE.h3, marginBottom: SPACING.sm, marginTop: SPACING.sm },
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOW.card,
  },

  pokedexRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  pokedexText: { ...TYPE.body, fontWeight: "700" },
  xpTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.bg, overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: 4, backgroundColor: COLORS.accent },

  modeHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  modeTitle: { ...TYPE.h3 },
  modeRate: { ...TYPE.h3, color: COLORS.accent },
  modeStatsRow: { flexDirection: "row", gap: SPACING.lg, flexWrap: "wrap" },
  modeStat: { ...TYPE.bodyMuted },
});
