import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import TabHeader from "../components/TabHeader";
import SoundPressable from "../components/SoundPressable";
import PlayerPhoto from "../components/PlayerPhoto";
import { getProfile, xpProgress } from "../lib/profile";
import { getStreak, seriDurumu } from "../lib/streak";
import { getStats, MODE_LABELS } from "../lib/stats";
import { getUnlockedPlayers } from "../lib/pokedex";
import { tamamlananlar } from "../lib/kadroKoleksiyon";
import { getCurrentUser } from "../lib/auth";
import { pushFullProgressToCloud } from "../lib/cloudProfile";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW } from "../lib/theme";

// ============================================================================
// PROFİLİM — 4 Ekim 2026 yeniden düzenlendi (benchmark .29937 + .30026)
// "Profilin tepesinde tek büyük sayı + son açılan 5 oyuncu" ve "Profil +
// İstatistik tek ekran, Hesap ayrı kalsın." Duolingo deseni: en üstte tek
// büyük sayı (günlük seri), altında seviye, koleksiyon ve istatistikler;
// ayarlar en altta. Eski İstatistikler ekranı (StatsScreen) rotada duruyor
// ama buradan artık açılmıyor — içeriği bu sayfada.
// ============================================================================
const kisaAd = (ad) => {
  const p = String(ad).split(" ");
  return p.length > 1 ? p[p.length - 1] : ad;
};

export default function ProfilimScreen({ onSettings, onHelp, onAccount }) {
  const [profile, setProfile] = useState({ xp: 0, level: 1, name: "Gizemli Forvet" });
  const [streak, setStreak] = useState({ count: 0, lastPlayedDate: null });
  const [stats, setStats] = useState(null);
  const [acilanlar, setAcilanlar] = useState([]);
  const [tumModlar, setTumModlar] = useState(false);
  const [kadroSayi, setKadroSayi] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let aktif = true;
      getProfile().then((p) => aktif && setProfile(p));
      getStreak().then((s) => aktif && setStreak(s));
      getStats().then((s) => aktif && setStats(s));
      getUnlockedPlayers().then((l) => aktif && setAcilanlar(Array.isArray(l) ? l : []));
      tamamlananlar().then((t) => aktif && setKadroSayi(t.size)).catch(() => {});
      // Hesabı olan kullanıcı için sessiz arka plan yedeklemesi.
      getCurrentUser().then((u) => { if (u) pushFullProgressToCloud(u.id); });
      return () => { aktif = false; };
    }, [])
  );

  const progress = xpProgress(profile);
  // 4 Ekim 2026 (.29585) — tek seri kuralı + haftalık dondurma.
  const sd = seriDurumu(streak);
  const seri = sd.gosterilen;
  const sonBes = acilanlar.slice(-5).reverse();
  const modlar = stats ? Object.entries(stats.modes || {}).sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses)) : [];
  const gorunenModlar = tumModlar ? modlar : modlar.slice(0, 3);

  return (
    <GameBackground style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={styles.headerArea}>
          <TabHeader compact />
          <Text style={styles.title}>Profilim</Text>
        </View>

        {/* --- TEK BÜYÜK SAYI: günlük seri --- */}
        <View style={styles.buyukKart}>
          <Ionicons name="flame" size={30} color={seri > 0 ? COLORS.cta : COLORS.textFaint} />
          <Text style={[styles.buyukSayi, seri > 0 && { color: COLORS.cta }]} accessibilityLabel={`${seri} günlük seri`}>{seri}</Text>
          <Text style={styles.buyukEtiket}>GÜNLÜK SERİ</Text>
          <Text style={styles.buyukAlt}>{sd.mesaj}</Text>
          <View style={styles.seriBilgi}>
            <Text style={styles.seriBilgiYazi}>❄️ Dondurma {sd.dondurmaHakki}/1 bu hafta</Text>
            <Text style={styles.seriBilgiYazi}>🏆 En iyi {sd.enIyi} gün</Text>
          </View>
          <Text style={styles.seriKural}>Seri, günlük oyunlardan birini bitirince sürer: Günün Bulmacası, Günlük 5 Kulüp, Günlük Izgara ya da günlük görevlerin üçü. Haftada kaçırdığın bir gün kendiliğinden dondurulur.</Text>
        </View>

        {/* --- seviye --- */}
        <View style={styles.playerCard}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>{progress.level}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.playerRow}>
              <Text style={styles.playerName} numberOfLines={1}>{profile.name}</Text>
              <Text style={styles.playerXpLabel}>{progress.level + 1}. seviyeye {progress.kalan} futbolcu</Text>
            </View>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${progress.fraction * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* --- son açılan 5 futbolcu + koleksiyon --- */}
        <Text style={styles.sectionTitle}>Son açılan futbolcular</Text>
        <View style={styles.card}>
          {sonBes.length ? (
            <View style={styles.sonBes}>
              {sonBes.map((ad) => (
                <View key={ad} style={styles.sonBesKutu}>
                  <PlayerPhoto name={ad} size={52} />
                  <Text style={styles.sonBesAd} numberOfLines={1}>{kisaAd(ad)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.bodyMuted}>Henüz futbolcu açmadın. Oyunlarda doğru bildiğin her tanınmış isim ansiklopedine eklenir.</Text>
          )}
          <View style={styles.koleksiyonSatir}>
            <Ionicons name="book" size={16} color={COLORS.accent} />
            <Text style={styles.koleksiyonYazi}>Ansiklopedi: {acilanlar.length} futbolcu</Text>
            <Text style={[styles.koleksiyonYazi, { marginLeft: "auto" }]}>🏅 {kadroSayi} kadro tamam</Text>
          </View>
        </View>

        {/* --- istatistikler (eski İstatistikler ekranı) --- */}
        <Text style={styles.sectionTitle}>İstatistikler</Text>
        {!stats ? (
          <Text style={styles.bodyMuted}>Yükleniyor...</Text>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <OzetKutu icon="checkmark-circle" color={COLORS.accent} label="Doğru" value={stats.totalCorrect || 0} />
              <OzetKutu icon="close-circle" color={COLORS.danger} label="Yanlış" value={stats.totalWrong || 0} />
              <OzetKutu icon="trending-up" color={COLORS.cta} label="Doğru serisi" value={stats.bestStreak || 0} />
            </View>
            {modlar.length === 0 ? (
              <Text style={styles.bodyMuted}>Henüz bir mod oynanmadı.</Text>
            ) : (
              <View style={styles.card}>
                {gorunenModlar.map(([modeId, m], i) => {
                  const oynanan = m.wins + m.losses;
                  const oran = oynanan ? Math.round((m.wins / oynanan) * 100) : 0;
                  return (
                    <View key={modeId} style={[styles.modSatir, i > 0 && styles.modAyrac]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modAd} numberOfLines={1}>{MODE_LABELS[modeId] || modeId}</Text>
                        <Text style={styles.modAlt}>{m.wins} doğru/galibiyet · {m.losses} yanlış · en iyi seri {m.bestStreak}</Text>
                      </View>
                      <Text style={styles.modOran}>%{oran}</Text>
                    </View>
                  );
                })}
                {modlar.length > 3 ? (
                  <SoundPressable onPress={() => setTumModlar((a) => !a)} style={styles.tumunuGor}>
                    <Text style={styles.tumunuGorYazi}>{tumModlar ? "Daha az göster" : `Tüm modlar (${modlar.length})`}</Text>
                    <Ionicons name={tumModlar ? "chevron-up" : "chevron-down"} size={16} color={COLORS.accent} />
                  </SoundPressable>
                ) : null}
              </View>
            )}
          </>
        )}

        {/* --- menü --- */}
        <View style={styles.menuList}>
          <MenuSatiri ikon="person-circle-outline" yazi="Hesabım" onPress={onAccount} />
          <MenuSatiri ikon="settings-outline" yazi="Ayarlar" onPress={onSettings} />
          <MenuSatiri ikon="help-circle-outline" yazi="Nasıl Oynanır?" onPress={onHelp} />
        </View>
      </ScrollView>
    </GameBackground>
  );
}

function OzetKutu({ icon, color, label, value }) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function MenuSatiri({ ikon, yazi, onPress }) {
  return (
    <SoundPressable style={styles.menuRow} onPress={onPress} hitSlop={6}>
      <Ionicons name={ikon} size={20} color={COLORS.accent} />
      <Text style={styles.menuRowText}>{yazi}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </SoundPressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 50, paddingHorizontal: SPACING.xl },
  headerArea: { marginBottom: SPACING.md, alignItems: "center" },
  title: { ...TYPE.h1 },
  bodyMuted: { ...TYPE.bodyMuted },

  buyukKart: {
    alignItems: "center", paddingVertical: SPACING.lg, marginBottom: SPACING.md,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.lg, ...SHADOW.card,
  },
  buyukSayi: { fontSize: 72, lineHeight: 80, fontWeight: "900", color: COLORS.text },
  buyukEtiket: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: COLORS.textMuted },
  seriBilgi: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.sm },
  seriBilgiYazi: { ...TYPE.caption, fontWeight: "800", color: COLORS.text },
  seriKural: { ...TYPE.caption, fontSize: 11, textAlign: "center", marginTop: SPACING.sm, paddingHorizontal: SPACING.md, lineHeight: 16 },
  buyukAlt: { ...TYPE.caption, marginTop: 6, textAlign: "center", paddingHorizontal: SPACING.md },

  playerCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.lg,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOW.card,
  },
  levelBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  levelBadgeText: { color: COLORS.accentDark, fontWeight: "900", fontSize: 16 },
  playerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 },
  playerName: { ...TYPE.h3, flexShrink: 1, marginRight: SPACING.sm },
  playerXpLabel: { ...TYPE.caption, fontSize: 12 },
  xpTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.bg, overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: 3, backgroundColor: COLORS.accent },

  sectionTitle: { ...TYPE.h3, marginBottom: SPACING.sm },
  card: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.lg, ...SHADOW.card,
  },
  sonBes: { flexDirection: "row", justifyContent: "space-between", marginBottom: SPACING.md },
  sonBesKutu: { width: "19%", alignItems: "center", gap: 4 },
  sonBesAd: { ...TYPE.caption, fontSize: 11, fontWeight: "800", color: COLORS.text },
  koleksiyonSatir: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  koleksiyonYazi: { ...TYPE.caption, fontWeight: "800", color: COLORS.text },

  summaryRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
  summaryCard: {
    flex: 1, alignItems: "center", gap: 2, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.md,
  },
  summaryValue: { ...TYPE.h2, fontSize: 20 },
  summaryLabel: { ...TYPE.caption, fontSize: 12 },
  modSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: 8 },
  modAyrac: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  modAd: { ...TYPE.body, fontWeight: "800" },
  modAlt: { ...TYPE.caption, fontSize: 12, marginTop: 2 },
  modOran: { ...TYPE.h3, color: COLORS.accent },
  tumunuGor: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 10 },
  tumunuGorYazi: { ...TYPE.caption, fontWeight: "800", color: COLORS.accent },

  menuList: { gap: SPACING.sm },
  menuRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg,
  },
  menuRowText: { ...TYPE.h3, flex: 1 },
});
