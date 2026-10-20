import { _t } from "../lib/dil";
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import { kulupRenkleri } from "./EslesmeKarti";
import { useAppSettings } from "../lib/SettingsContext";
import { takimTemasi, zatenTakimTemasi, takimTemasiniUygula } from "../lib/takimTemasi";
import { uygulamayiYenile } from "../lib/temaYenile";
import { COLORS, RADIUS, SPACING, TYPE } from "../lib/theme";

// ============================================================================
// "TEMA TAKIMINA ÖZEL DEĞİŞTİRİLSİN Mİ?" — Paket 36 (bkz. lib/takimTemasi.js)
// Takım seçildikten hemen sonra, aynı pencerenin içinde gösterilir.
// soruGerekliMi(takim, settings): sorulacak bir tema var mı (yoksa doğrudan geç).
// ============================================================================
export function takimTemasiBul(takim) {
  return takimTemasi(takim, kulupRenkleri);
}
export function soruGerekliMi(takim, settings) {
  const t = takimTemasiBul(takim);
  return !!t && !zatenTakimTemasi(t, settings);
}

export default function TakimTemaSorusu({ takim, onBitti }) {
  const { settings, setSetting } = useAppSettings();
  const tema = useMemo(() => takimTemasiBul(takim), [takim]);
  const [mesgul, setMesgul] = useState(false);
  const [not, setNot] = useState(null);
  if (!tema) return null;

  async function evet() {
    if (mesgul) return;
    setMesgul(true);
    try {
      await takimTemasiniUygula(tema, setSetting);
      const oldu = await uygulamayiYenile();
      if (!oldu) {
        setMesgul(false);
        setNot(_t("Tema kaydedildi — uygulamayı kapatıp açınca görünecek."));
        setTimeout(() => onBitti && onBitti(true), 1400);
      }
    } catch (e) {
      setMesgul(false);
      onBitti && onBitti(false);
    }
  }

  return (
    <View style={s.kap}>
      <View style={s.onizleme} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {tema.onizleme.map((r, i) => (
          <View key={i} style={[s.serit, { backgroundColor: r, flex: i === 0 ? 3 : 1 }]} />
        ))}
      </View>
      <Text style={s.baslik}>{_t("Tema")}{" "}{takim}{" "}{_t("renklerine geçsin mi?")}</Text>
      <Text style={s.aciklama}>
        {tema.tur === "hazir"
          ? _t(
          "Uygulama {0} temasıyla açılır (kartlar, düğmeler, forma deseni). Ayarlar → Tema'dan istediğin zaman geri alırsın.",
          [tema.ad]
        )
          : _t(
          "Kulübünün renklerinden bir tema hazırladık. Ayarlar → Tema'dan istediğin zaman geri alırsın."
        )}
        {tema.tur === "ozel" && settings.customPalet ? _t(" (Kayıtlı \"Kendi temam\"ın yerine geçer.)") : ""}
      </Text>
      {not ? <Text style={s.not}>{not}</Text> : null}
      <SoundPressable style={s.evet} onPress={evet} disabled={mesgul} accessibilityLabel={_t("Evet, temayı değiştir")}>
        {mesgul ? <ActivityIndicator color={COLORS.accentDark} /> : (
          <>
            <Ionicons name="color-palette" size={18} color={COLORS.accentDark} />
            <Text style={s.evetYazi}>{_t("EVET, DEĞİŞTİR")}</Text>
          </>
        )}
      </SoundPressable>
      <SoundPressable style={s.hayir} onPress={() => onBitti && onBitti(false)} disabled={mesgul} accessibilityLabel={_t("Hayır, temam kalsın")}>
        <Text style={s.hayirYazi}>{_t("Hayır, temam kalsın")}</Text>
      </SoundPressable>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { paddingVertical: SPACING.sm },
  onizleme: { flexDirection: "row", height: 54, borderRadius: RADIUS.md, overflow: "hidden", borderWidth: 1, borderColor: COLORS.cardBorder },
  serit: { height: "100%" },
  baslik: { ...TYPE.h2, marginTop: SPACING.lg },
  aciklama: { ...TYPE.bodyMuted, marginTop: 6 },
  not: { ...TYPE.caption, color: COLORS.accent, marginTop: SPACING.sm, fontWeight: "800" },
  evet: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 14, marginTop: SPACING.lg,
  },
  evetYazi: { color: COLORS.accentDark, fontWeight: "900", fontSize: 16, letterSpacing: 0.8 },
  hayir: { alignItems: "center", paddingVertical: SPACING.md },
  hayirYazi: { ...TYPE.body, color: COLORS.textMuted, fontWeight: "800" },
});
