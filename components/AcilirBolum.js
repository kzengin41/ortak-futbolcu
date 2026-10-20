import { _t } from "../lib/dil";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, LayoutAnimation } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SoundPressable from "./SoundPressable";
import { COLORS, SPACING, TYPE, saydam } from "../lib/theme";

// ============================================================================
// AÇILIR BÖLÜM — 5 Ekim 2026 (Kerem: "profilim sayfasında istatistikler de
// kapanıp açılabilir olsun. tüm başlıklar açılıp kapanabilir olsun.")
// Başlığa dokununca içerik açılır/kapanır; tercih cihazda hatırlanır
// (anahtar: `kimlik`). `ozet`: kapalıyken başlığın sağında görünen kısa bilgi.
// ============================================================================
// Paket 32 (Kerem: "profilim sayfasında tüm her şey default olarak kapalı gelmeli"):
// varsayılan KAPALI; anahtar v2 — eski kayıtlar (hepsi açıktı) bir kez sıfırlanır.
const ANAHTAR = "acilir-bolumler-v2";
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

export default function AcilirBolum({ kimlik, baslik, ikon, ozet, varsayilanAcik = false, children, style }) {
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
        accessibilityLabel={`${baslik}, ${acik ? _t("kapat") : _t("aç")}`}
      >
        {ikon ? <View style={s.ikon}><Ionicons name={ikon} size={18} color={COLORS.text} /></View> : null}
        <Text style={s.baslik} numberOfLines={1}>{baslik}</Text>
        <View style={{ flex: 1 }} />
        {!acik && ozet ? <Text style={s.ozet} numberOfLines={1}>{ozet}</Text> : null}
        <Ionicons name={acik ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textFaint} />
      </SoundPressable>
      {acik ? <View style={s.icerik}>{children}</View> : null}
    </View>
  );
}

// Paket 32 — liste kartı dili (ModKarti grup satırıyla aynı): kapalı başlık bir
// kart satırı; nötr ikon karosu, sağda kısa özet. Açılınca içerik altında.
const s = StyleSheet.create({
  kap: { marginBottom: SPACING.sm },
  baslikSatir: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: 12, paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.card, borderRadius: 18, borderWidth: 1, borderColor: saydam(COLORS.text, 0.06),
  },
  ikon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: saydam(COLORS.text, 0.07) },
  baslik: { ...TYPE.h3, fontSize: 16, flexShrink: 1 },
  ozet: { ...TYPE.caption, maxWidth: "45%", fontWeight: "800" },
  icerik: { marginTop: SPACING.sm },
});
