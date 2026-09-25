import React from "react";
import { Text, StyleSheet, Alert, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS, TYPE } from "../lib/theme";
import SoundPressable from "./SoundPressable";

// NOT: confirm varsayılanı artık false — onay sorumluluğu App.js'te ekranın
// kendisine (route wrapper'daki onExit'e) taşındı, böylece BackButton, "✕ Bitir"
// gibi düz butonlar ve donanım geri tuşu HEP AYNI tek onayı kullanıyor,
// çifte alert çıkmıyor. Sadece onExit'e bağlı olmayan, gerçekten tek başına
// kullanılan bir yerde confirm={true} geçmek istersen hâlâ mümkün.
// 12 Eylül 2026 — iki düzeltme:
//   1. Varsayılan metin "Menüye Dön"dü ama Ayarlar/İstatistikler/Yardım/Hesabım
//      ekranlarında bu buton menüye DEĞİL, Profilim sekmesine dönüyordu. Artık
//      varsayılan sadece "Geri"; menüye dönen yerler metni kendisi veriyor.
//   2. Emoji ok (⬅) yerine Ionicons — uygulamanın geri kalanı zaten Ionicons
//      kullanıyor, tek emoji ikon buradaydı.
export default function BackButton({ onPress, text = "Geri", style, confirm = false }) {
  const handlePress = () => {
    if (confirm) {
      Alert.alert(
        "Çıkış",
        "Ana menüye dönmek istediğinize emin misiniz?",
        [
          { text: "Hayır", style: "cancel" },
          { text: "Evet", style: "destructive", onPress: onPress }
        ]
      );
    } else {
      onPress();
    }
  };

  return (
    <SoundPressable onPress={handlePress} style={[styles.btn, style]} hitSlop={15}>
      <View style={styles.icerik}>
        <Ionicons name="chevron-back" size={15} color={COLORS.text} />
        <Text style={styles.text}>{text}</Text>
      </View>
    </SoundPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    alignSelf: "flex-start",
    // Eski değerler korundu — bu buton 8 ekranda kullanılıyor, boşlukları
    // değiştirmek hepsinin yerleşimini kaydırırdı.
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  icerik: { flexDirection: "row", alignItems: "center", gap: 4 },
  text: { ...TYPE.caption, color: COLORS.text, fontWeight: "800" },
});
