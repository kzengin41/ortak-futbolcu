import { _t } from "../lib/dil";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, Animated, Pressable, useWindowDimensions, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import PlayerPhoto from "./PlayerPhoto";
import SoundPressable from "./SoundPressable";
import Konfeti from "./Konfeti";
import { COLORS, RADIUS } from "../lib/theme";
import { nadirlik, paketSirasi } from "../lib/nadirlik";
import { usePaketSound, useZaferSound, useSeriSound, useTikSound } from "../lib/useGameSounds";

// ============================================================================
// KART PAKETİ — Paket 46 (Kerem: "aşırı zevkli yapmak lazım" → "Kart paketi ve
// koleksiyon"). Günlük ödülde kazanılan futbolcular kuru bir liste olarak değil,
// açılan bir paket olarak gelir:
//   1. Paket nabız atar: "DOKUN, AÇ".
//   2. Dokununca sallanır, patlar (paket sesi + titreşim), kartlar ters düşer.
//   3. Kartlar sırayla çevrilir (dokunarak da çevrilebilir); sıradanlar önce,
//      EFSANE en sona saklanır. Efsane: konfeti + zafer sesi; nadir: seri sesi.
// Nadirlik lib/nadirlik.js. Futbolcular paket açılmadan önce zaten koleksiyona
// eklenmiş olur (pencere kapansa da kayıp yok).
// ============================================================================
const CEVIRME_ARALIK = 650;

function Kart({ ad, genislik, cevrik, onCevir, gecikme }) {
  const n = nadirlik(ad);
  const giris = useRef(new Animated.Value(0)).current;
  const donus = useRef(new Animated.Value(cevrik ? 1 : 0)).current;
  const parilti = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(giris, { toValue: 1, duration: 320, delay: gecikme, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cevrik) return;
    Animated.timing(donus, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
    if (n.id !== "siradan") {
      Animated.loop(Animated.sequence([
        Animated.timing(parilti, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(parilti, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cevrik]);
  const yukseklik = Math.round(genislik * 1.42);
  const arkaX = donus.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const onX = donus.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const ust = giris.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
  return (
    <Pressable onPress={cevrik ? undefined : onCevir} accessibilityRole="button" accessibilityLabel={cevrik ? `${ad} · ${n.ad}` : _t("Kartı çevir")}>
      <Animated.View style={{ width: genislik, height: yukseklik, opacity: giris, transform: [{ translateY: ust }] }}>
        {/* arka yüz */}
        <Animated.View style={[s.yuz, s.arka, { transform: [{ scaleX: arkaX }] }]}>
          <Text style={s.arkaLogo}>3-2-1</Text>
          <Text style={s.arkaAlt}>{_t("DOKUN")}</Text>
        </Animated.View>
        {/* ön yüz */}
        <Animated.View style={[s.yuz, { backgroundColor: n.zemin, borderColor: n.renk, transform: [{ scaleX: onX }] }]}>
          {n.id !== "siradan" ? (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 12, backgroundColor: n.renk, opacity: parilti.interpolate({ inputRange: [0, 1], outputRange: [0.04, 0.2] }) }]} />
          ) : null}
          <PlayerPhoto name={ad} size={Math.round(genislik * 0.6)} showProfileOnPress={false} />
          <Text style={s.ad} numberOfLines={2}>{ad}</Text>
          <View style={[s.etiket, { backgroundColor: n.renk }]}>
            <Text style={s.etiketYazi}>{n.ad}</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default function KartPaketi({ gorunur, oyuncular, baslik, onKapat }) {
  const { width } = useWindowDimensions();
  const sirali = useMemo(() => paketSirasi(oyuncular), [oyuncular]);
  const [asama, setAsama] = useState("paket"); // paket | acik
  const [cevrilen, setCevrilen] = useState(() => new Set());
  const [konfeti, setKonfeti] = useState(0);
  const nabiz = useRef(new Animated.Value(1)).current;
  const salla = useRef(new Animated.Value(0)).current;
  const patla = useRef(new Animated.Value(0)).current;
  const paketSes = usePaketSound();
  const zaferSes = useZaferSound();
  const seriSes = useSeriSound();
  const tikSes = useTikSound();
  const zamanlayicilar = useRef([]);
  const cevrilenRef = useRef(new Set());

  useEffect(() => {
    if (!gorunur) return;
    setAsama("paket");
    setCevrilen(new Set());
    cevrilenRef.current = new Set();
    nabiz.setValue(1); salla.setValue(0); patla.setValue(0);
    const d = Animated.loop(Animated.sequence([
      Animated.timing(nabiz, { toValue: 1.05, duration: 650, useNativeDriver: true }),
      Animated.timing(nabiz, { toValue: 1, duration: 650, useNativeDriver: true }),
    ]));
    d.start();
    return () => { d.stop(); zamanlayicilar.current.forEach(clearTimeout); zamanlayicilar.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gorunur]);

  function cevir(ad) {
    if (cevrilenRef.current.has(ad)) return;
    cevrilenRef.current.add(ad);
    setCevrilen(new Set(cevrilenRef.current));
    const n = nadirlik(ad).id;
    if (n === "efsane") {
      zaferSes(); setKonfeti((k) => k + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (n === "nadir") {
      seriSes(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    } else {
      tikSes(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }

  function ac() {
    if (asama !== "paket") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.sequence([
      Animated.timing(salla, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(salla, { toValue: -1, duration: 90, useNativeDriver: true }),
      Animated.timing(salla, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(salla, { toValue: 0, duration: 70, useNativeDriver: true }),
      Animated.timing(patla, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start(() => {
      paketSes();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setAsama("acik");
      sirali.forEach((ad, i) => {
        zamanlayicilar.current.push(setTimeout(() => cevir(ad), 700 + i * CEVIRME_ARALIK));
      });
    });
  }

  if (!gorunur) return null;
  const bitti = asama === "acik" && cevrilen.size >= sirali.length;
  const sutun = sirali.length <= 3 ? sirali.length : 3;
  const kartGenislik = Math.min(112, Math.floor((Math.min(width, 520) - 48 - (sutun - 1) * 10) / Math.max(1, sutun)));
  const enIyi = sirali.length ? nadirlik(sirali[sirali.length - 1]) : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onKapat}>
      <View style={s.zemin}>
        {konfeti ? <Konfeti key={konfeti} adet={56} kaynak="orta" sure={2200} /> : null}
        <Text style={s.baslik}>{baslik || _t("KART PAKETİ")}</Text>

        {asama === "paket" ? (
          <>
            <Pressable onPress={ac} accessibilityRole="button" accessibilityLabel={_t("Paketi aç")}>
              <Animated.View style={[s.paket, {
                opacity: patla.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [
                  { scale: Animated.multiply(nabiz, patla.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] })) },
                  { rotate: salla.interpolate({ inputRange: [-1, 1], outputRange: ["-7deg", "7deg"] }) },
                ],
              }]}>
                <LinearGradient colors={["#FFD45A", "#F5A623", "#7CFF5C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
                <View style={s.paketBant} />
                <Text style={s.paketLogo}>3-2-1</Text>
                <Text style={s.paketYazi}>{_t("{0} KART", [sirali.length])}</Text>
              </Animated.View>
            </Pressable>
            <Text style={s.ipucu}>{_t("Dokun, aç!")}</Text>
          </>
        ) : (
          <>
            <View style={[s.kartlar, { maxWidth: sutun * (kartGenislik + 10) }]}>
              {sirali.map((ad, i) => (
                <Kart key={ad} ad={ad} genislik={kartGenislik} gecikme={i * 90} cevrik={cevrilen.has(ad)} onCevir={() => cevir(ad)} />
              ))}
            </View>
            {bitti ? (
              <>
                <Text style={s.eklendi}>
                  {enIyi && enIyi.id === "efsane" ? _t("Efsane çıktı! ") : ""}{_t("Hepsi koleksiyonuna eklendi.")}
                </Text>
                <SoundPressable style={s.tamam} onPress={onKapat} accessibilityLabel={_t("Tamam")}>
                  <Text style={s.tamamYazi}>{_t("TAMAM")}</Text>
                </SoundPressable>
              </>
            ) : (
              <Pressable onPress={() => sirali.forEach((ad) => cevir(ad))} hitSlop={10}>
                <Text style={s.ipucu}>{_t("Kartlara dokun ya da bekle…")}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  zemin: { flex: 1, backgroundColor: "rgba(3,10,6,0.94)", alignItems: "center", justifyContent: "center", padding: 24, gap: 18 },
  baslik: { fontSize: 15, fontWeight: "900", letterSpacing: 2, color: COLORS.cta, textAlign: "center" },
  paket: { width: 190, height: 260, borderRadius: 22, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 2, borderColor: "rgba(255,255,255,0.55)" },
  paketBant: { position: "absolute", top: 0, bottom: 0, width: 34, backgroundColor: "rgba(255,255,255,0.22)", transform: [{ rotate: "18deg" }], left: 60 },
  paketLogo: { fontSize: 50, fontWeight: "900", color: "#0B1A10", letterSpacing: -1 },
  paketYazi: { fontSize: 14, fontWeight: "900", letterSpacing: 2, color: "#0B1A10", marginTop: 4 },
  ipucu: { fontSize: 14, fontWeight: "700", color: COLORS.textMuted, textAlign: "center" },
  kartlar: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  yuz: { ...StyleSheet.absoluteFillObject, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center", padding: 6, gap: 5, backfaceVisibility: "hidden", overflow: "hidden" },
  arka: { backgroundColor: "#13261A", borderColor: COLORS.cta },
  arkaLogo: { fontSize: 22, fontWeight: "900", color: COLORS.cta, letterSpacing: -0.5 },
  arkaAlt: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textMuted },
  ad: { fontSize: 12, fontWeight: "900", color: COLORS.text, textAlign: "center", lineHeight: 15 },
  etiket: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.pill || 999 },
  etiketYazi: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: "#0B1A10" },
  eklendi: { fontSize: 15, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  tamam: { height: 52, minWidth: 200, paddingHorizontal: 28, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },
  tamamYazi: { fontSize: 16, fontWeight: "900", letterSpacing: 1, color: COLORS.accentDark },
});
