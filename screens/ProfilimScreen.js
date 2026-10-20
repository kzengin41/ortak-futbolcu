import { _t } from "../lib/dil";
import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import TabHeader from "../components/TabHeader";
import SoundPressable from "../components/SoundPressable";
import PlayerPhoto from "../components/PlayerPhoto";
import AcilirBolum from "../components/AcilirBolum";
import { RozetIzgarasi } from "../components/Rozetler";
import { rozetDurumu, ozetCikar, toplamKademe } from "../lib/rozetler";
import { getProfile, xpProgress } from "../lib/profile";
import { getStreak, seriDurumu } from "../lib/streak";
import { getStats, MODE_LABELS } from "../lib/stats";
import { getUnlockedPlayers } from "../lib/pokedex";
import { tamamlananlar } from "../lib/kadroKoleksiyon";
import { getCurrentUser } from "../lib/auth";
import { pushFullProgressToCloud } from "../lib/cloudProfile";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, saydam } from "../lib/theme";

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
  // Paket 34 — rozet koleksiyonu (lib/rozetler.js): mevcut verilerden hesaplanır
  const rozetDurum = rozetDurumu(ozetCikar(stats, acilanlar.length, sd.enIyi || 0));
  const rozetKazanilan = rozetDurum.filter((r) => r.kademe > 0).length;
  const modlar = stats ? Object.entries(stats.modes || {}).sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses)) : [];
  const gorunenModlar = tumModlar ? modlar : modlar.slice(0, 3);

  return (
    <GameBackground style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={styles.headerArea}>
          <TabHeader baslik={_t("Profilim")} />
        </View>

        {/* 5 Ekim 2026 — bütün başlıklar açılıp kapanabilir (components/AcilirBolum.js) */}
        {/* --- TEK BÜYÜK SAYI: günlük seri --- */}
        <AcilirBolum kimlik="profil-seri" baslik={_t("Günlük Seri")} ikon="flame" ozet={_t("🔥 {0} gün", [seri])}>
        <View style={styles.buyukKart}>
          <Ionicons name="flame" size={30} color={seri > 0 ? COLORS.cta : COLORS.textFaint} />
          <Text style={[styles.buyukSayi, seri > 0 && { color: COLORS.cta }]} accessibilityLabel={_t("{0} günlük seri", [seri])}>{seri}</Text>
          <Text style={styles.buyukEtiket}>{_t("GÜNLÜK SERİ")}</Text>
          <Text style={styles.buyukAlt}>{sd.mesaj}</Text>
          <View style={styles.seriBilgi}>
            <Text style={styles.seriBilgiYazi}>{_t("❄️ Dondurma {0}/1 bu hafta", [sd.dondurmaHakki])}</Text>
            <Text style={styles.seriBilgiYazi}>{_t("🏆 En iyi")}{" "}{sd.enIyi}{" "}{_t("gün")}</Text>
          </View>
          <Text style={styles.seriKural}>{_t(
            "Seri, günlük oyunlardan birini bitirince sürer: Günün Kadrosu, Günlük Kim Bu, Günün Bulmacası, Günlük 5 Kulüp, Günlük Izgara ya da günlük görevlerin üçü. Haftada kaçırdığın bir gün kendiliğinden dondurulur."
          )}</Text>
        </View>
        </AcilirBolum>

        {/* --- seviye --- */}
        <AcilirBolum kimlik="profil-seviye" baslik={_t("Seviye")} ikon="trending-up" ozet={_t("{0}. seviye", [progress.level])}>
        <View style={styles.playerCard}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>{progress.level}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.playerRow}>
              <Text style={styles.playerName} numberOfLines={1}>{profile.name}</Text>
              <Text style={styles.playerXpLabel}>{_t("{0}. seviyeye {1} futbolcu", [progress.level + 1, progress.kalan])}</Text>
            </View>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${progress.fraction * 100}%` }]} />
            </View>
          </View>
        </View>

        </AcilirBolum>

        {/* --- son açılan 5 futbolcu + koleksiyon --- */}
        <AcilirBolum kimlik="profil-rozetler" baslik={_t("Rozetler")} ikon="ribbon" ozet={`${rozetKazanilan}/${rozetDurum.length} · ${toplamKademe(rozetDurum)}★`}>
          <RozetIzgarasi durum={rozetDurum} />
        </AcilirBolum>

        <AcilirBolum kimlik="profil-acilanlar" baslik={_t("Son açılanlar")} ikon="book" ozet={_t("{0} futbolcu", [acilanlar.length])}>
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
            <Text style={styles.bodyMuted}>{_t(
              "Henüz futbolcu açmadın. Oyunlarda doğru bildiğin her tanınmış isim ansiklopedine eklenir."
            )}</Text>
          )}
          <View style={styles.koleksiyonSatir}>
            <Ionicons name="book" size={16} color={COLORS.accent} />
            <Text style={styles.koleksiyonYazi}>{_t("Ansiklopedi:")}{" "}{acilanlar.length}{" "}{_t("futbolcu")}</Text>
            <Text style={[styles.koleksiyonYazi, { marginLeft: "auto" }]}>🏅 {kadroSayi}{" "}{_t("kadro tamam")}</Text>
          </View>
        </View>

        </AcilirBolum>

        {/* --- istatistikler (eski İstatistikler ekranı) --- */}
        <AcilirBolum kimlik="profil-istatistik" baslik={_t("İstatistikler")} ikon="stats-chart" ozet={stats ? _t("{0} doğru", [stats.totalCorrect || 0]) : null}>
        {!stats ? (
          <Text style={styles.bodyMuted}>{_t("Yükleniyor...")}</Text>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <OzetKutu icon="checkmark-circle" color={COLORS.accent} label={_t("Doğru")} value={stats.totalCorrect || 0} />
              <OzetKutu icon="close-circle" color={COLORS.danger} label={_t("Yanlış")} value={stats.totalWrong || 0} />
              <OzetKutu icon="trending-up" color={COLORS.cta} label={_t("Doğru serisi")} value={stats.bestStreak || 0} />
            </View>
            {modlar.length === 0 ? (
              <Text style={styles.bodyMuted}>{_t("Henüz bir mod oynanmadı.")}</Text>
            ) : (
              <View style={styles.card}>
                {gorunenModlar.map(([modeId, m], i) => {
                  const oynanan = m.wins + m.losses;
                  const oran = oynanan ? Math.round((m.wins / oynanan) * 100) : 0;
                  return (
                    <View key={modeId} style={[styles.modSatir, i > 0 && styles.modAyrac]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modAd} numberOfLines={1}>{MODE_LABELS[modeId] || modeId}</Text>
                        <Text style={styles.modAlt}>{m.wins}{" "}{_t("doğru/galibiyet ·")}{" "}{m.losses}{" "}{_t("yanlış · en iyi seri")}{" "}{m.bestStreak}</Text>
                      </View>
                      <Text style={styles.modOran}>%{oran}</Text>
                    </View>
                  );
                })}
                {modlar.length > 3 ? (
                  <SoundPressable onPress={() => setTumModlar((a) => !a)} style={styles.tumunuGor}>
                    <Text style={styles.tumunuGorYazi}>{tumModlar ? _t("Daha az göster") : _t("Tüm modlar ({0})", [modlar.length])}</Text>
                    <Ionicons name={tumModlar ? "chevron-up" : "chevron-down"} size={16} color={COLORS.accent} />
                  </SoundPressable>
                ) : null}
              </View>
            )}
          </>
        )}
        </AcilirBolum>

        {/* --- menü --- */}
        <View style={styles.menuList}>
          <MenuSatiri ikon="person-circle-outline" yazi={_t("Hesabım")} onPress={onAccount} />
          <MenuSatiri ikon="settings-outline" yazi={_t("Ayarlar")} onPress={onSettings} />
          <MenuSatiri ikon="help-circle-outline" yazi={_t("Nasıl Oynanır?")} onPress={onHelp} son />
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

// Paket 32 — menü tek liste kartı (üç ayrı kutu yerine), nötr ikon karoları.
function MenuSatiri({ ikon, yazi, onPress, son }) {
  return (
    <SoundPressable style={[styles.menuRow, !son && styles.menuCizgi]} onPress={onPress} hitSlop={6}>
      <View style={styles.menuIkon}><Ionicons name={ikon} size={19} color={COLORS.text} /></View>
      <Text style={styles.menuRowText}>{yazi}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
    </SoundPressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: SPACING.xxl, paddingHorizontal: SPACING.xl },
  headerArea: { marginBottom: SPACING.xs },
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

  menuList: {
    marginTop: SPACING.md, backgroundColor: COLORS.card, borderRadius: 18, overflow: "hidden",
    borderWidth: 1, borderColor: saydam(COLORS.text, 0.06),
  },
  menuRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: 12, paddingHorizontal: SPACING.md },
  menuCizgi: { borderBottomWidth: 1, borderBottomColor: saydam(COLORS.text, 0.07) },
  menuIkon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: saydam(COLORS.text, 0.07) },
  menuRowText: { ...TYPE.h3, fontSize: 16, flex: 1 },
});
