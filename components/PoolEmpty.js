import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS, TYPE } from "../lib/theme";

// ============================================================================
// 12 Eylül 2026 — ÇIKIŞI OLMAYAN EKRANLAR.
//
// UX denetimi, havuz tükendiğinde dört ekranın da kullanıcıyı KİLİTLEDİĞİNİ
// buldu: CpuGameScreen, DraftGameCpuScreen, CountryTeamCpuScreen ve
// WhoAmICpuScreen yalnızca tek bir cümle basıyordu — buton yok, geri linki
// yok. iOS'ta donanım geri tuşu da olmadığı için kullanıcının uygulamayı
// kapatmaktan başka çaresi kalmıyordu.
//
// Bu bileşen o durumun tek ve ortak karşılığı: ne olduğunu açıklar, havuzu
// sıfırlayıp devam etme seçeneği verir, ve her hâlükârda menüye dönüş sunar.
// Arka planı KENDİ ÇİZMİYOR — çağıran ekranın kendi sarmalayıcısının
// (GameBackground ya da düz View) içine yerleşiyor, böylece dört ekranın
// mevcut yerleşimini bozmuyor.
// ============================================================================
export default function PoolEmpty({
  baslik = "Yeni eşleşme kalmadı",
  aciklama = "Bu lig seçimiyle sorulabilecek bütün eşleşmeleri gördün. Havuzu sıfırlayıp baştan oynayabilir ya da menüden başka bir kapsam seçebilirsin.",
  onReset,
  onExit,
  resetEtiketi = "Baştan Başla",
}) {
  return (
    <View style={styles.kutu}>
      <Ionicons name="albums-outline" size={44} color={COLORS.textFaint} />
      <Text style={styles.baslik}>{baslik}</Text>
      <Text style={styles.aciklama}>{aciklama}</Text>

      {onReset ? (
        <Pressable onPress={onReset} style={styles.anaBtn} hitSlop={8}>
          <Text style={styles.anaBtnYazi}>{resetEtiketi}</Text>
        </Pressable>
      ) : null}

      {onExit ? (
        <Pressable onPress={onExit} hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}>
          <Text style={styles.link}>Menüye dön</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kutu: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  baslik: { ...TYPE.h2, textAlign: "center", marginTop: SPACING.xs },
  aciklama: {
    ...TYPE.bodyMuted,
    textAlign: "center",
    maxWidth: 320,
  },
  anaBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: SPACING.sm,
  },
  anaBtnYazi: { ...TYPE.button, color: COLORS.accentDark },
  link: { ...TYPE.caption, textDecorationLine: "underline", marginTop: SPACING.xs },
});
