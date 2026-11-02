import React, { useEffect, useMemo, useRef } from "react";
import { View, Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";
import { COLORS } from "../lib/theme";

// ============================================================================
// KONFETİ — Paket 46 (Kerem: "oyun zevkini artıracak değişiklikler… aşırı
// zevkli yapmak lazım"). Saf Animated (yerel sürücü, ek paket yok): parçalar
// ortadan (ya da üstten) saçılır, döner, yerçekimiyle düşer, söner.
//   adet   — parça sayısı (doğru cevap ~26, maç kazanma ~60)
//   kaynak — "orta" (patlama) | "ust" (yağmur)
// Dokunmaları engellemez (pointerEvents="none").
// ============================================================================
const RENKLER = () => [COLORS.accent, COLORS.cta, "#FFFFFF", "#FF5D8F", "#5DC8FF", "#B57BFF"];

function Parca({ p, ilerleme }) {
  const x = ilerleme.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
  // Yukarı fırla, sonra düş: iki parçalı eğri.
  const y = ilerleme.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, p.dy, p.dy + p.dus] });
  const don = ilerleme.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.don}deg`] });
  const op = ilerleme.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });
  return (
    <Animated.View
      style={{
        position: "absolute", left: p.x0, top: p.y0, width: p.w, height: p.h, borderRadius: p.yuvarlak ? p.w / 2 : 2,
        backgroundColor: p.renk, opacity: op, transform: [{ translateX: x }, { translateY: y }, { rotate: don }],
      }}
    />
  );
}

export default function Konfeti({ adet = 26, kaynak = "orta", sure = 1500, genislik: g0, yukseklik: y0 }) {
  const ekran = useWindowDimensions();
  const genislik = g0 || Math.min(ekran.width, 640);
  const yukseklik = y0 || ekran.height;
  const ilerleme = useRef(new Animated.Value(0)).current;
  const parcalar = useMemo(() => {
    const r = RENKLER();
    return Array.from({ length: adet }, (_, i) => {
      const aci = (Math.PI * 2 * i) / adet + Math.random() * 0.6;
      const hiz = 90 + Math.random() * 170;
      const ust = kaynak === "ust";
      return {
        x0: ust ? Math.random() * genislik : genislik / 2,
        y0: ust ? -20 : yukseklik * 0.42,
        dx: ust ? (Math.random() - 0.5) * 80 : Math.cos(aci) * hiz,
        dy: ust ? yukseklik * 0.35 : Math.sin(aci) * hiz - 110,
        dus: ust ? yukseklik * 0.6 : 220 + Math.random() * 160,
        don: (Math.random() - 0.5) * 900,
        w: 6 + Math.random() * 6, h: 10 + Math.random() * 8,
        yuvarlak: Math.random() < 0.25,
        renk: r[i % r.length],
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const a = Animated.timing(ilerleme, { toValue: 1, duration: sure, easing: Easing.out(Easing.quad), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, []);
  return (
    <View style={s.kat} pointerEvents="none">
      {parcalar.map((p, i) => <Parca key={i} p={p} ilerleme={ilerleme} />)}
    </View>
  );
}

const s = StyleSheet.create({
  kat: { ...StyleSheet.absoluteFillObject, overflow: "hidden", zIndex: 1000 },
});
