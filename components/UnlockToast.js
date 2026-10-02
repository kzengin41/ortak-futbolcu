import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PlayerPhoto from "./PlayerPhoto";
import { acilisDinle } from "../lib/unlockBus";
import { COLORS, SPACING, RADIUS, TYPE, SHADOW } from "../lib/theme";

// ============================================================================
// "ANSİKLOPEDİNE EKLENDİ" BİLDİRİMİ — 12 Eylül 2026
//
// Oyunun koleksiyon mekaniği vardı ama görünmezdi: doğru bilinen her yeni
// futbolcu sessizce ansiklopediye ekleniyordu. Bu bileşen o anı görünür
// kılıyor — küçük, kendiliğinden kaybolan, oyunu kesmeyen bir şerit.
//
// App.js'te BİR KEZ monte ediliyor ve lib/unlockBus üzerinden dinliyor, yani
// hiçbir oyun ekranının bundan haberi olmasına gerek yok.
//
// Arka arkaya birden çok açılış olursa (bir turda iki oyuncu da doğru bilirse)
// kuyruğa alınıp sırayla gösteriliyor — üst üste binip birbirini yemesin.
// ============================================================================

const GORUNME_SURESI = 2600;

export default function UnlockToast() {
  const [kuyruk, setKuyruk] = useState([]);
  const [aktif, setAktif] = useState(null);
  const kaydir = useRef(new Animated.Value(-120)).current;
  const zamanlayici = useRef(null);

  useEffect(() => acilisDinle((ad) => setKuyruk((k) => (k.includes(ad) ? k : [...k, ad]))), []);

  // Kuyrukta bir şey varsa ve ekranda gösterilen yoksa sıradakini al.
  useEffect(() => {
    if (aktif || kuyruk.length === 0) return;
    setAktif(kuyruk[0]);
    setKuyruk((k) => k.slice(1));
  }, [kuyruk, aktif]);

  useEffect(() => {
    if (!aktif) return;
    kaydir.setValue(-120);
    Animated.timing(kaydir, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    zamanlayici.current = setTimeout(() => {
      Animated.timing(kaydir, {
        toValue: -120,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setAktif(null));
    }, GORUNME_SURESI);

    return () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
    };
  }, [aktif, kaydir]);

  if (!aktif) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.serit, { transform: [{ translateY: kaydir }] }]}
    >
      <PlayerPhoto name={aktif} size={38} showProfileOnPress={false} />
      <View style={{ flex: 1 }}>
        <View style={styles.baslikSatiri}>
          <Ionicons name="sparkles" size={12} color={COLORS.cta} />
          <Text style={styles.baslik}>ANSİKLOPEDİNE EKLENDİ</Text>
        </View>
        <Text style={styles.ad} numberOfLines={1}>{aktif}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  serit: {
    position: "absolute",
    top: 8,
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 1000,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cta,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    ...SHADOW.card,
  },
  baslikSatiri: { flexDirection: "row", alignItems: "center", gap: 5 },
  baslik: { color: COLORS.cta, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  ad: { ...TYPE.h3, fontSize: 15, marginTop: 1 },
});
