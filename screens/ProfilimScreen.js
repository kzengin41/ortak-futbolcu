import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import TabHeader from "../components/TabHeader";
import SoundPressable from "../components/SoundPressable";
import { getProfile, xpProgress } from "../lib/profile";
import { getStreak } from "../lib/streak";
import { getCurrentUser } from "../lib/auth";
import { pushFullProgressToCloud } from "../lib/cloudProfile";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW } from "../lib/theme";

// "Profilim" sekmesi — 30 Ağustos 2026'da alt menüye geçişle birlikte
// eklendi (Kerem: "profilim sekmesi yok"). Eskiden HomeScreen'in üstünde
// duran oyuncu kartı (seviye/XP/seri) ve Ayarlar/Nasıl Oynanır butonları
// buraya taşındı — artık kendi başına bir yeri var.
//
// NOT: "Başarılar" (rozet/madalya sistemi) henüz veri tabanında/kodda YOK —
// burada icat etmedim, gerçek bir sistem tasarlanmadan sahte bir liste
// koymak yanıltıcı olurdu. Kerem isterse ayrı bir turda buna karar veririz.
export default function ProfilimScreen({ onSettings, onHelp, onStats, onAccount }) {
  const [profile, setProfile] = useState({ xp: 0, level: 1, name: "Gizemli Forvet" });
  const [streak, setStreak] = useState({ count: 0, lastPlayedDate: null });

  useFocusEffect(
    useCallback(() => {
      getProfile().then(setProfile);
      getStreak().then(setStreak);
      // Faz 5 devamı: hesabı olan kullanıcı için sessiz arka plan
      // yedeklemesi — bir tur bitip Profilim'e her dönüşte ilerleme
      // buluta yazılır. Giriş yoksa getCurrentUser null döner, hiçbir şey
      // yapılmaz.
      getCurrentUser().then((u) => { if (u) pushFullProgressToCloud(u.id); });
    }, [])
  );

  const progress = xpProgress(profile);

  return (
    <GameBackground style={styles.container}>
      <View style={styles.headerArea}>
        <TabHeader compact />
        <Text style={styles.title}>Profilim</Text>
      </View>

      <SoundPressable style={styles.playerCard} onPress={onStats} hitSlop={4}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>{progress.level}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.playerRow}>
            <Text style={styles.playerName} numberOfLines={1}>{profile.name}</Text>
            <Text style={styles.playerXpLabel}>{progress.into} / {progress.needed} XP</Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${progress.fraction * 100}%` }]} />
          </View>
        </View>
        <View style={styles.streakWrap}>
          <Ionicons name="flame" size={18} color={streak.count > 0 ? COLORS.cta : COLORS.textFaint} />
          <Text style={[styles.streakText, streak.count > 0 && { color: COLORS.cta }]}>{streak.count}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
      </SoundPressable>

      <View style={styles.menuList}>
        <SoundPressable style={styles.menuRow} onPress={onAccount} hitSlop={10}>
          <Ionicons name="person-circle-outline" size={20} color={COLORS.accent} />
          <Text style={styles.menuRowText}>Hesabım</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </SoundPressable>
        <SoundPressable style={styles.menuRow} onPress={onStats} hitSlop={10}>
          <Ionicons name="stats-chart-outline" size={20} color={COLORS.accent} />
          <Text style={styles.menuRowText}>İstatistikler</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </SoundPressable>
        <SoundPressable style={styles.menuRow} onPress={onHelp} hitSlop={10}>
          <Ionicons name="help-circle-outline" size={20} color={COLORS.accent} />
          <Text style={styles.menuRowText}>Nasıl Oynanır?</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </SoundPressable>
        <SoundPressable style={styles.menuRow} onPress={onSettings} hitSlop={10}>
          <Ionicons name="settings-outline" size={20} color={COLORS.accent} />
          <Text style={styles.menuRowText}>Ayarlar</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </SoundPressable>
      </View>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 50, paddingHorizontal: SPACING.xl },
  headerArea: { marginBottom: SPACING.lg, alignItems: "center" },
  title: { ...TYPE.h1 },

  playerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  levelBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  levelBadgeText: { color: COLORS.accentDark, fontWeight: "900", fontSize: 16 },
  playerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 },
  playerName: { ...TYPE.h3, flexShrink: 1, marginRight: SPACING.sm },
  playerXpLabel: { ...TYPE.caption, fontSize: 12 },
  xpTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.bg, overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: 3, backgroundColor: COLORS.accent },
  streakWrap: { alignItems: "center", justifyContent: "center", minWidth: 28 },
  streakText: { ...TYPE.caption, fontWeight: "900", color: COLORS.textMuted, marginTop: 1 },

  menuList: { gap: SPACING.md },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  menuRowText: { ...TYPE.h3, flex: 1 },
});
