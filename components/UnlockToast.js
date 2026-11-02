import { _t } from "../lib/dil";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PlayerPhoto from "./PlayerPhoto";
import { nadirlik } from "../lib/nadirlik";
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

  // 4 Ekim 2026: kuyrukta { ad, seviye } — seviye atlandıysa şerit "SEVİYE N!" der.
  // Paket 46: ek.ozel = { ikon, baslik, metin } — futbolcusuz genel bildirim (zorluk değişti vb.).
  useEffect(() => acilisDinle((ad, ek) => setKuyruk((k) => (k.some((x) => x.ad === ad) ? k : [...k, { ad, seviye: ek?.seviye || null, ozel: ek?.ozel || null }]))), []);

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
      {aktif.ozel ? (
        <View style={styles.ozelIkon}><Ionicons name={aktif.ozel.ikon || "sparkles"} size={20} color={COLORS.ctaDark} /></View>
      ) : <PlayerPhoto name={aktif.ad} size={38} showProfileOnPress={false} />}
      {aktif.ozel ? (
        <View style={{ flex: 1 }}>
          <Text style={styles.baslik}>{aktif.ozel.baslik}</Text>
          <Text style={styles.ad} numberOfLines={2}>{aktif.ozel.metin}</Text>
        </View>
      ) : (
      <View style={{ flex: 1 }}>
        <View style={styles.baslikSatiri}>
          <Ionicons name={aktif.seviye ? "trending-up" : "sparkles"} size={12} color={COLORS.cta} />
          <Text style={styles.baslik}>{aktif.seviye ? _t("SEVİYE {0}! · ANSİKLOPEDİYE EKLENDİ", [aktif.seviye]) : _t("ANSİKLOPEDİNE EKLENDİ")}</Text>
        </View>
        <View style={styles.baslikSatiri}>
          <Text style={[styles.ad, { flexShrink: 1 }]} numberOfLines={1}>{aktif.ad}</Text>
          {/* Paket 46 — nadir / efsane kart rozeti (lib/nadirlik.js) */}
          {(() => { const n = nadirlik(aktif.ad); return n.id !== "siradan" ? <View style={[styles.nadirlik, { backgroundColor: n.renk }]}><Text style={styles.nadirlikYazi}>{n.ad}</Text></View> : null; })()}
        </View>
      </View>
      )}
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
  nadirlik: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  nadirlikYazi: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: "#0B1A10" },
  ozelIkon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.cta },
  baslik: { color: COLORS.cta, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  ad: { ...TYPE.h3, fontSize: 15, marginTop: 1 },
});
