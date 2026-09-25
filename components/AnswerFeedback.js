import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import PlayerPhoto from "./PlayerPhoto";
import { LinearGradient } from "expo-linear-gradient";

// 12 Eylül 2026 — UX DENETİMİ BULGUSU: dört ekran (WhoAmICpuScreen,
// LetterCpuScreen, OnlineLetterScreen, CountryClubArcadeScreen) bu bileşeni
// `type` ve `message` prop'larıyla çağırıyordu; imza ise `correct` bekliyordu.
// Sonuç: `correct` her zaman undefined (falsy) olduğu için DOĞRU CEVAPTA BİLE
// kırmızı ✗ ve hata titreşimi çıkıyordu, `message` ise hiç render edilmiyordu
// — "Bu oyuncu daha önce söylendi", "İsim X ile başlamalı" gibi özenle
// yazılmış bütün uyarılar kullanıcıya hiç ulaşmıyordu.
//
// Çözüm: her iki API'yi de kabul et. `correct` verilmişse o geçerli; yoksa
// `type === "correct"` kullanılıyor. `message` artık işaretin altında
// gösteriliyor. Böylece dört çağrı yerini tek tek değiştirmeye gerek kalmadan
// hepsi doğru çalışıyor, ileride yanlış prop geçilse de kırılmıyor.
export default function AnswerFeedback({ correct, type, message, onDone, player }) {
  const dogru = correct !== undefined ? Boolean(correct) : type === "correct";
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (dogru) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }

    const entranceAnim = Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 140 }),
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]);

    let sequence = [];
    if (!dogru) {
      const shake = Animated.sequence([
        Animated.timing(translateX, { toValue: 12, duration: 50, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -12, duration: 50, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 12, duration: 50, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]);
      sequence = [Animated.parallel([entranceAnim, shake]), Animated.delay(600)];
    } else {
      // If a player card is shown, give it more time so the user can enjoy it!
      sequence = [entranceAnim, Animated.delay(player ? 1400 : 600)];
    }

    Animated.sequence([
      ...sequence,
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onDone && onDone());
  }, []);

  const color = dogru ? "#7CFF5C" : "#FF5D5D";
  const colorDark = dogru ? "#0B1620" : "#450000";

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View style={[{ transform: [{ scale }, { translateX }], opacity }]}>
        {dogru && player ? (
          <LinearGradient colors={["#FFE000", "#FF8C00"]} style={styles.card}>
            <View style={styles.cardInner}>
              <PlayerPhoto name={player.name} size={180} />
              <Text style={styles.cardName} numberOfLines={2}>{player.name}</Text>
              <Text style={styles.cardSubtitle}>DOĞRU CEVAP!</Text>
            </View>
          </LinearGradient>
        ) : (
          <View style={[styles.circle, { backgroundColor: color }]}>
            <Text style={[styles.mark, { color: colorDark }]}>{dogru ? "✓" : "✗"}</Text>
          </View>
        )}
        {message ? (
          <Text style={[styles.mesaj, { color }]} numberOfLines={3}>
            {message}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  circle: { width: 140, height: 140, borderRadius: 70, alignItems: "center", justifyContent: "center", elevation: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 12 },
  mark: { fontSize: 76, fontWeight: "900" },
  mesaj: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 16,
    maxWidth: 300,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowRadius: 6,
  },
  card: {
    width: 260,
    borderRadius: 24,
    padding: 6,
    elevation: 20,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  cardInner: {
    backgroundColor: "#0B1620",
    borderRadius: 18,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  cardName: {
    color: "#F3F7FA",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 4,
  },
  cardSubtitle: {
    color: "#7CFF5C",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  }
});
