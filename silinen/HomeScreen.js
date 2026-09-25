import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import PressScale from "../components/ui/PressScale";
import Pill from "../components/ui/Pill";
import { getProfile, xpProgress } from "../lib/profile";
import { getStreak } from "../lib/streak";
import { COLORS, MODE_COLORS, RADIUS, SPACING, TYPE, SHADOW } from "../lib/theme";

// Ana menü, oyuncunun zihnindeki gerçek 6 moda göre kurgulanmıştır (bkz. yol haritası).
// "Takım-Takım" tek kart içinde iki seçenek (Sen Seç / CPU Rastgele) olarak gösterilir,
// çünkü ikisi de aynı oyunun varyasyonu — ayrı kategorilere bölünmemeli.

const MODES = [
  {
    key: "teamTeam",
    title: "Takım-Takım",
    desc: "İki takımda da oynamış ortak futbolcuyu bul",
    icon: "shield-checkmark",
    colorKey: "teamTeam",
    options: [
      { id: "draftCpu", label: "Takımı Sen Seç" },
      { id: "cpu", label: "CPU Rastgele Atar" },
    ],
  },
  {
    key: "teamCountry",
    title: "Takım-Ülke",
    desc: "Milli takım ve kulübü eşleştir",
    icon: "earth",
    colorKey: "teamCountry",
    id: "countryTeamCpu",
  },
  {
    key: "letters",
    title: "Baş Harflerden Oyuncu",
    desc: "Verilen baş harflerle başlayan futbolcuyu bul",
    icon: "text",
    colorKey: "letters",
    id: "letterCpu",
  },
  {
    key: "whoAmI",
    title: "Kim Bu?",
    desc: "İpuçlarıyla gizli futbolcuyu tahmin et",
    icon: "help-circle",
    colorKey: "whoAmI",
    id: "whoAmICpu",
  },
  {
    key: "training",
    title: "Antrenman",
    desc: "4 şıklı, seri cevaplamaca (sadece offline)",
    icon: "flash",
    colorKey: "training",
    id: "quickCpu",
  },
  {
    key: "hotSeat",
    title: "Tek Telefon, 2 Oyuncu",
    desc: "Ekran ikiye bölünür, ilk buzz'layan kazanır",
    icon: "phone-portrait",
    colorKey: "hotSeat",
    id: "local",
  },
];

const ONLINE_MODE = {
  id: "onlineLobby",
  title: "Online Lobi",
  desc: "Arkadaşınla veya rastgele kişilerle kapış",
  icon: "flame",
  colorKey: "online",
};

const ENCYCLOPEDIA_MODE = {
  id: "playerProfile",
  title: "Kariyer İncele",
  desc: "43.000 oyuncunun kariyeri ve popülerliği",
  icon: "book",
  colorKey: "encyclopedia",
};

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - SPACING.xl * 2 - SPACING.md) / 2;

export default function HomeScreen({ onSelect, onSettings, onHelp }) {
  const [profile, setProfile] = useState({ xp: 0, level: 1, name: "Gizemli Forvet" });
  const [streak, setStreak] = useState({ count: 0, lastPlayedDate: null });

  // Ekran her odaklandığında (bir oyundan ana menüye dönünce de) tazelenir —
  // XP/seri bir turdan hemen sonra güncel görünsün diye sadece mount'ta değil.
  useFocusEffect(
    useCallback(() => {
      getProfile().then(setProfile);
      getStreak().then(setStreak);
    }, [])
  );

  async function handleSelect(modeId) {
    onSelect(modeId);
    try {
      const { bumpStreak } = require("../lib/streak");
      bumpStreak();
    } catch (err) {}
    try {
      const { supabase, getDeviceId } = require("../lib/supabaseClient");
      const deviceId = await getDeviceId();
      await supabase.from("game_stats").insert([{ mode_id: modeId, device_id: deviceId }]);
    } catch (err) {
      console.log("Analytics error:", err);
    }
  }

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  const progress = xpProgress(profile);

  return (
    <GameBackground style={styles.container}>
      <View style={styles.topBar}>
        <SoundPressable onPress={onHelp} style={styles.topBtn} hitSlop={20}>
          <Ionicons name="help-circle-outline" size={15} color={COLORS.accent} />
          <Text style={styles.topBtnText}>Nasıl Oynanır?</Text>
        </SoundPressable>
        <SoundPressable onPress={onSettings} style={styles.topBtn} hitSlop={20}>
          <Ionicons name="settings-outline" size={15} color={COLORS.accent} />
          <Text style={styles.topBtnText}>Ayarlar</Text>
        </SoundPressable>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        <View style={styles.headerArea}>
          <Text style={styles.title}>3-2-1</Text>
          <Text style={styles.eyebrow}>ORTAK FUTBOLCU</Text>
        </View>

        {/* Oyuncu kartı: seviye + XP çubuğu + günlük seri. Bu veri zaten
            hesaplanıyordu (addXP/getProfile) ama hiçbir ekranda gösterilmiyordu —
            görünür bir ilerleme, geri gelmek için en güçlü sebeplerden biridir. */}
        <View style={styles.playerCard}>
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
        </View>

        {/* Öne çıkan: online mod, tek başlı büyük banner */}
        <View style={styles.section}>
          <FullCard mode={ONLINE_MODE} onPress={() => handleSelect(ONLINE_MODE.id)} />
        </View>

        {/* Ana oyun modları — kullanıcının zihin modeline birebir karşılık gelen 6 mod */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="game-controller" size={16} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Oyun Modları</Text>
          </View>
          <View style={styles.grid}>
            {MODES.map((m) =>
              m.options ? (
                <DualCard key={m.key} mode={m} onPress={handleSelect} />
              ) : (
                <GridCard key={m.key} mode={m} onPress={() => handleSelect(m.id)} />
              )
            )}
          </View>
        </View>

        {/* Ansiklopedi — oyun değil, keşif/referans amaçlı, ayrı bölümde */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="library" size={16} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Keşfet</Text>
          </View>
          <FullCard mode={ENCYCLOPEDIA_MODE} onPress={() => handleSelect(ENCYCLOPEDIA_MODE.id)} />
        </View>
      </Animated.ScrollView>
    </GameBackground>
  );
}

function FullCard({ mode, onPress }) {
  const c = MODE_COLORS[mode.colorKey];
  return (
    <PressScale style={[styles.fullCard, { borderColor: c.main, backgroundColor: c.dark }]} onPress={onPress}>
      <View style={[styles.fullCardIconWrap, { backgroundColor: c.main }]}>
        <Ionicons name={mode.icon} size={28} color={COLORS.accentDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{mode.title}</Text>
        <Text style={styles.cardDesc}>{mode.desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </PressScale>
  );
}

function GridCard({ mode, onPress }) {
  const c = MODE_COLORS[mode.colorKey];
  return (
    <PressScale style={[styles.gridCard, { borderColor: c.main, backgroundColor: c.dark }]} onPress={onPress}>
      <View style={[styles.gridIconWrap, { backgroundColor: c.main }]}>
        <Ionicons name={mode.icon} size={22} color={COLORS.accentDark} />
      </View>
      <Text style={styles.cardTitle}>{mode.title}</Text>
      <Text style={styles.cardDesc} numberOfLines={2}>{mode.desc}</Text>
    </PressScale>
  );
}

// Takım-Takım gibi "kim seçer" alt-seçeneği olan modlar için: aynı kart, iki pill.
function DualCard({ mode, onPress }) {
  const c = MODE_COLORS[mode.colorKey];
  return (
    <View style={[styles.gridCard, styles.dualCard, { borderColor: c.main, backgroundColor: c.dark }]}>
      <View style={[styles.gridIconWrap, { backgroundColor: c.main }]}>
        <Ionicons name={mode.icon} size={22} color={COLORS.accentDark} />
      </View>
      <Text style={styles.cardTitle}>{mode.title}</Text>
      <Text style={styles.cardDesc} numberOfLines={2}>{mode.desc}</Text>
      <View style={styles.dualPillRow}>
        {mode.options.map((opt) => (
          <Pill key={opt.id} label={opt.label} onPress={() => onPress(opt.id)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 50 },
  topBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: SPACING.xl, marginBottom: SPACING.sm },
  topBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.pill,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
  },
  topBtnText: { color: COLORS.accent, fontSize: 13, fontWeight: "800" },

  headerArea: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg, alignItems: "center" },
  title: { ...TYPE.display, fontSize: 52 },
  eyebrow: { ...TYPE.eyebrow },

  playerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginHorizontal: SPACING.xl,
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
  playerXpLabel: { ...TYPE.caption, fontSize: 11 },
  xpTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.bg, overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: 3, backgroundColor: COLORS.accent },
  streakWrap: { alignItems: "center", justifyContent: "center", minWidth: 28 },
  streakText: { ...TYPE.caption, fontWeight: "900", color: COLORS.textFaint, marginTop: 1 },

  section: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.xxl },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.md, marginLeft: 4 },
  sectionTitle: { ...TYPE.h2 },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: SPACING.md },
  gridCard: {
    width: CARD_WIDTH,
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  dualCard: { width: "100%" },
  dualPillRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md },
  gridIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },

  fullCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  fullCardIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginRight: SPACING.lg },

  cardTitle: { ...TYPE.h3, marginBottom: SPACING.xs },
  cardDesc: { fontSize: 12, fontWeight: "500", color: COLORS.text, opacity: 0.85, lineHeight: 16 },
});
