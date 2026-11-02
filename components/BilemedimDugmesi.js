import React from "react";
import { Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import { COLORS } from "../lib/theme";
import { _t } from "../lib/dil";
import { yeniYazildiMi } from "../lib/yazmaKilidi";

// ============================================================================
// "Bilemedim" — Paket 43 (29 Ekim 2026)
// Kerem: "bilmiyorum butonunun yeri sebebiyle el çarpabiliyor. hızlı yazmak
// isterken yanlışlıkla dokunuluyor. yerini değiştirelim."
//
// ESKİ: cevap kutusunun hemen ALTINDAYDI, yani klavyenin tam üstünde; hızlı
// yazan parmak ona çarpıyordu.
// YENİ: bütün yazılı modlarda cevap kutusunun ÜSTÜNDE, süre çubuğunun yanında
// küçük bir hap. Arada cevap kutusu var; klavyeden en az bir satır uzakta.
// Ayrıca son harften sonra 0,8 sn içinde gelen dokunuş yok sayılır
// (lib/yazmaKilidi.js).
// ============================================================================
export default function BilemedimDugmesi({ onPress, etiket, disabled, style, testID }) {
  const bas = () => {
    if (disabled) return;
    if (yeniYazildiMi()) return;
    onPress && onPress();
  };
  return (
    <SoundPressable
      onPress={bas}
      disabled={disabled}
      hitSlop={4}
      style={[s.hap, disabled && { opacity: 0.45 }, style]}
      accessibilityRole="button"
      accessibilityLabel={etiket || _t("Bilemedim")}
      testID={testID}
    >
      <Ionicons name="flag-outline" size={14} color={COLORS.textMuted} />
      <Text style={s.yazi} numberOfLines={1}>{etiket || _t("Bilemedim")}</Text>
    </SoundPressable>
  );
}

const s = StyleSheet.create({
  hap: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999,
    borderWidth: 1.5, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card,
  },
  yazi: { color: COLORS.text, fontWeight: "800", fontSize: 13 },
});
