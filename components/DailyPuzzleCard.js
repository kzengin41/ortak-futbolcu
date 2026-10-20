import { _t } from "../lib/dil";
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import SoundPressable from "./SoundPressable";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, yumusakKaro } from "../lib/theme";
import { getBulmacaDurumu } from "../lib/dailyPuzzleStore";
import { DENEME_HAKKI, gunNumarasi } from "../lib/dailyPuzzle";

// Oyna sekmesindeki "Günün Bulmacası" girişi. Bulmacanın KENDİSİNİ burada
// üretmiyoruz — uygun ikili listesinin ilk kurulumu ~0.3 sn sürüyor ve bu
// maliyeti ana ekranın açılışına bindirmenin anlamı yok. Kart sadece bugün
// oynanıp oynanmadığına bakıyor (tek AsyncStorage okuması).
export default function DailyPuzzleCard({ onPress }) {
  const [durum, setDurum] = useState(null);

  const yukle = useCallback(() => {
    let iptal = false;
    getBulmacaDurumu().then((d) => { if (!iptal) setDurum(d); }).catch(() => {});
    return () => { iptal = true; };
  }, []);

  useEffect(yukle, [yukle]);
  // Bulmacadan dönünce kart güncel görünsün.
  useFocusEffect(yukle);

  const bitti = Boolean(durum?.bitti);
  const bilindi = Boolean(durum?.bilindi);
  const kalan = DENEME_HAKKI - (durum?.denemeler?.length || 0);

  return (
    <SoundPressable style={styles.kart} onPress={onPress}>
      <View style={[styles.ikonKutu, bitti && (bilindi ? styles.ikonBasarili : styles.ikonBasarisiz)]}>
        <Ionicons
          name={bitti ? (bilindi ? "checkmark-circle" : "close-circle") : "calendar"}
          size={22}
          color={bitti ? (bilindi ? COLORS.accent : COLORS.textMuted) : COLORS.cta}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.baslik}>{_t("Günün Bulmacası #")}{gunNumarasi()}</Text>
        <Text style={styles.altBaslik}>
          {!durum
            ? _t("Yükleniyor...")
            : bitti
            ? bilindi
              ? _t("Bugünü {0} denemede bildin", [durum.denemeler.length])
              : _t("Bugünü bilemedin — yarın yeni soru")
            : durum.denemeler.length
            ? _t("{0} deneme hakkın kaldı", [kalan])
            : _t("Herkese aynı soru, 3 hak · seriyi korur 🔥")}
        </Text>
      </View>
      {!bitti && <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />}
    </SoundPressable>
  );
}

const styles = StyleSheet.create({
  kart: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cta,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.xl,
    ...SHADOW.card,
  },
  ikonKutu: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center", ...yumusakKaro(COLORS.cta),
  },
  ikonBasarili: yumusakKaro(COLORS.accent),
  ikonBasarisiz: yumusakKaro(COLORS.textFaint),
  baslik: { ...TYPE.h3, fontSize: 14 },
  altBaslik: { ...TYPE.caption, marginTop: 2 },
});
