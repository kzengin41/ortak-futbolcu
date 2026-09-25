import React from "react";
import { Pressable } from "react-native";
import * as Haptics from "expo-haptics";

// Pressable'ın birebir yerine geçer, tek farkı: her basışta hafif titreşim
// (haptic) verir.
//
// 11 Eylül 2026: SES ARTIK BURADA ÇALINMIYOR. Dokunma sesi App.js'teki global
// katmana taşındı (ekranın HER yerinde çalsın diye). Burada da çalmaya devam
// etseydi butonlarda ses ÇİFT duyulurdu. Bu bileşen yine de duruyor: titreşim
// sadece gerçek butonlarda olmalı, boş bir yere dokununca değil.
export default function SoundPressable({ onPress, style, ...rest }) {
  return (
    <Pressable
      {...rest}
      // 12 Eylül 2026 — denetimden: projede TEK BİR basılı-durum geri bildirimi
      // yoktu; hiçbir butonun basıldığı görsel olarak anlaşılmıyordu. Burada
      // çözülünce SoundPressable kullanan bütün ekranlar tek seferde kazandı.
      // `style` fonksiyon olarak da gelebildiği için ikisi de destekleniyor.
      style={({ pressed }) => [
        typeof style === "function" ? style({ pressed }) : style,
        pressed && { opacity: 0.72 },
      ]}
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress && onPress(e);
      }}
    />
  );
}
