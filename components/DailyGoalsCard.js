import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, LayoutAnimation } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getGunlukGorevler, gorevListesi, GOREV_ODULU } from "../lib/dailyGoals";
import { COLORS, SPACING, RADIUS, TYPE } from "../lib/theme";

// ============================================================================
// GÜNLÜK GÖREV KARTI — 12 Eylül 2026
//
// Oyna sekmesinin en üstünde, mod ızgarasının hemen üzerinde. Üç küçük hedef
// ve hepsi tamamlanınca tek seferlik XP ödülü. Amaç "bugün de bir uğrayayım"
// hissini üretmek; sayaçlar zaten oynanan turlardan besleniyor, oyuncunun
// fazladan bir şey yapmasına gerek yok (bkz. lib/dailyGoals.js).
//
// Kartın çerçevesi temanın amber (cta) rengini kullanıyor — o renk palette
// tanımlıydı ama hiçbir ana yüzeyde kullanılmıyordu; ekrandaki tek amber öğe
// olması kartı yeşil mod kartlarından ayırıyor.
// ============================================================================
// 12 Eylül 2026 (Kerem: "ana ekrandaki görev kısmı açılır kapanır olsa daha
// iyi gibi") — kart artık katlanabiliyor. Kapalıyken tek satır: başlık +
// ilerleme sayacı. Tercih cihazda saklanıyor, her açılışta hatırlanıyor.
const ACIK_ANAHTARI = "gunluk_gorev_acik";

export default function DailyGoalsCard() {
  const [kayit, setKayit] = useState(null);
  const [acik, setAcik] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let iptal = false;
      getGunlukGorevler().then((k) => !iptal && setKayit(k)).catch(() => {});
      AsyncStorage.getItem(ACIK_ANAHTARI)
        .then((v) => { if (!iptal && v === "0") setAcik(false); })
        .catch(() => {});
      return () => { iptal = true; };
    }, [])
  );

  function katla() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAcik((onceki) => {
      const yeni = !onceki;
      AsyncStorage.setItem(ACIK_ANAHTARI, yeni ? "1" : "0").catch(() => {});
      return yeni;
    });
  }

  const gorevler = gorevListesi(kayit);
  const biten = gorevler.filter((g) => g.olan >= g.hedef).length;
  const hepsiBitti = biten === gorevler.length;

  return (
    <View style={[styles.kart, hepsiBitti && styles.kartBitti]}>
      <Pressable onPress={katla} style={styles.baslikSatiri} hitSlop={10}>
        <Ionicons
          name={hepsiBitti ? "checkmark-circle" : "today-outline"}
          size={15}
          color={hepsiBitti ? COLORS.accent : COLORS.cta}
        />
        <Text style={[styles.baslik, hepsiBitti && { color: COLORS.accent }]}>GÜNLÜK GÖREV</Text>
        <Text style={styles.sayac}>{biten}/{gorevler.length}</Text>
        <Ionicons
          name={acik ? "chevron-up" : "chevron-down"}
          size={16}
          color={COLORS.textMuted}
        />
      </Pressable>

      {acik && (
      <View style={styles.gorevler}>
        {gorevler.map((g) => {
          const bitti = g.olan >= g.hedef;
          return (
            <View key={g.id} style={styles.gorevSatiri}>
              <Ionicons
                name={bitti ? "checkmark-circle" : "ellipse-outline"}
                size={15}
                color={bitti ? COLORS.accent : COLORS.textFaint}
              />
              <Text style={[styles.gorevMetin, bitti && styles.gorevMetinBitti]}>{g.metin}</Text>
              <Text style={[styles.gorevSayi, bitti && { color: COLORS.accent }]}>
                {g.olan}/{g.hedef}
              </Text>
            </View>
          );
        })}
      </View>
      )}

      {acik && (
      <Text style={styles.odul}>
        {hepsiBitti
          ? kayit?.odulAlindi
            ? `Tamamlandı — +${GOREV_ODULU} XP aldın`
            : `Tamamlandı! +${GOREV_ODULU} XP`
          : `Üçünü de bitir: +${GOREV_ODULU} XP`}
      </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kart: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cta,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  kartBitti: { borderColor: COLORS.accent },
  baslikSatiri: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  baslik: { color: COLORS.cta, fontSize: 12, fontWeight: "900", letterSpacing: 1.4, flex: 1 },
  sayac: { ...TYPE.caption, fontWeight: "900", fontVariant: ["tabular-nums"] },
  gorevler: { gap: SPACING.sm },
  gorevSatiri: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  gorevMetin: { ...TYPE.bodyMuted, flex: 1, fontSize: 13.5 },
  gorevMetinBitti: { textDecorationLine: "line-through", color: COLORS.textMuted },
  gorevSayi: { ...TYPE.caption, color: COLORS.textMuted, fontVariant: ["tabular-nums"] },
  odul: { ...TYPE.caption, color: COLORS.textMuted, fontSize: 12 },
});
