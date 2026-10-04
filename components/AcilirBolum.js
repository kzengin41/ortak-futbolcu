import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, LayoutAnimation } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SoundPressable from "./SoundPressable";
import { COLORS, SPACING, TYPE } from "../lib/theme";

// ============================================================================
// AÇILIR BÖLÜM — 5 Ekim 2026 (Kerem: "profilim sayfasında istatistikler de
// kapanıp açılabilir olsun. tüm başlıklar açılıp kapanabilir olsun.")
// Başlığa dokununca içerik açılır/kapanır; tercih cihazda hatırlanır
// (anahtar: `kimlik`). `ozet`: kapalıyken başlığın sağında görünen kısa bilgi.
// ============================================================================
const ANAHTAR = "acilir-bolumler-v1";
let _bellek = null;
async function durumlar() {
  if (_bellek) return _bellek;
  try { _bellek = JSON.parse((await AsyncStorage.getItem(ANAHTAR)) || "{}"); } catch (e) { _bellek = {}; }
  return _bellek;
}
function kaydet(kimlik, acik) {
  durumlar().then((d) => {
    d[kimlik] = acik;
    AsyncStorage.setItem(ANAHTAR, JSON.stringify(d)).catch(() => {});
  });
}

export default function AcilirBolum({ kimlik, baslik, ikon, ozet, varsayilanAcik = true, children, style }) {
  const [acik, setAcik] = useState(varsayilanAcik);
  useEffect(() => {
    let iptal = false;
    durumlar().then((d) => { if (!iptal && typeof d[kimlik] === "boolean") setAcik(d[kimlik]); });
    return () => { iptal = true; };
  }, [kimlik]);

  function degistir() {
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch (e) {}
    setAcik((a) => { kaydet(kimlik, !a); return !a; });
  }

  return (
    <View style={[s.kap, style]}>
      <SoundPressable
        style={s.baslikSatir}
        onPress={degistir}
        accessibilityRole="button"
        accessibilityState={{ expanded: acik }}
        accessibilityLabel={`${baslik}, ${acik ? "kapat" : "aç"}`}
      >
        {ikon ? <Ionicons name={ikon} size={18} color={COLORS.accent} /> : null}
        <Text style={s.baslik}>{baslik}</Text>
        <View style={{ flex: 1 }} />
        {!acik && ozet ? <Text style={s.ozet} numberOfLines={1}>{ozet}</Text> : null}
        <Ionicons name={acik ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textMuted} />
      </SoundPressable>
      {acik ? <View>{children}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { marginBottom: SPACING.sm },
  baslikSatir: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, marginBottom: 2 },
  baslik: { ...TYPE.h3 },
  ozet: { ...TYPE.caption, maxWidth: "45%", fontWeight: "800" },
});
