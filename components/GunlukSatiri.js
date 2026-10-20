import { _t, yerel } from "../lib/dil";
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import PressScale from "./ui/PressScale";
import { COLORS, RADIUS, SPACING, TYPE, saydam, vurguZemini } from "../lib/theme";
import { gunlukDurumOku, BES_KULUP_HAK, IZGARA_HAK } from "../lib/gunlukKayit";
import { getBulmacaDurumu } from "../lib/dailyPuzzleStore";
import { DENEME_HAKKI, gunNumarasi } from "../lib/dailyPuzzle";
import { getGunlukGorevler, gorevListesi, GOREV_ODULU } from "../lib/dailyGoals";

// ============================================================================
// GÜNLÜK SATIRI — Paket 30 (14 Ekim 2026)
// Kerem: "üstteki günlük şeyler falan aşırı kalabalık mesela, onlar kesin
// kalksın" + "tüm modlar içinde tek satır olarak durması lazım. anasayfa'da
// durmasın." Eskiden Tüm Modlar'ın en üstünde 1 büyük + 4 küçük günlük kutu +
// açık duran görev kartı vardı (ekranın ilk yarısı). Artık TEK satır: kaç
// günlük oyunun bittiği (5 nokta) — dokununca hepsi bir pencerede, görevler de.
// Durumlar eskiden GunlukOyunlarKarti / DailyPuzzleCard / DailyGoalsCard'daydı.
// ============================================================================

export function useGunlukDurum() {
  const [d, setD] = useState({});
  const yukle = useCallback(() => {
    let iptal = false;
    Promise.all([
      getBulmacaDurumu().catch(() => null),
      gunlukDurumOku("kadro").catch(() => null),
      gunlukDurumOku("kimBu").catch(() => null),
      gunlukDurumOku("5kulup").catch(() => null),
      gunlukDurumOku("izgara").catch(() => null),
      getGunlukGorevler().catch(() => null),
    ]).then(([bulmaca, kadro, kimBu, bes, izgara, gorev]) => {
      if (!iptal) setD({ bulmaca, kadro, kimBu, bes, izgara, gorev, hazir: true });
    });
    return () => { iptal = true; };
  }, []);
  useEffect(yukle, [yukle]);
  useFocusEffect(yukle);

  const { bulmaca, kadro, kimBu, bes, izgara } = d;
  const besT = bes?.tahminler || [];
  const izgDolu = (izgara?.kareler || []).filter(Boolean).length;
  const kdrB = (kadro?.bulunan || []).length;
  const kbT = (kimBu?.tahminler || []).length;
  const bulD = bulmaca?.denemeler?.length || 0;
  const oyunlar = [
    {
      id: "dailyPuzzle", ad: _t("Günün Bulmacası"), ikon: "calendar",
      bitti: !!bulmaca?.bitti,
      alt: bulmaca?.bitti ? (bulmaca.bilindi ? _t("{0} denemede bildin", [bulD]) : _t("Bugün bilemedin")) : bulD ? _t("{0} deneme hakkın kaldı", [DENEME_HAKKI - bulD]) : _t("Herkese aynı soru · {0} hak", [DENEME_HAKKI]),
    },
    {
      id: "gunlukKadro", ad: _t("Günün Kadrosu"), ikon: "shirt",
      bitti: !!kadro?.bitti,
      alt: kadro?.bitti ? _t("{0}/11 buldun", [kdrB]) : kdrB ? _t("{0}/11 · devam et", [kdrB]) : _t("Efsane bir maçın ilk 11'i"),
    },
    {
      id: "gunlukKimBu", ad: _t("Günlük Kim Bu"), ikon: "help-circle",
      bitti: !!kimBu?.bitti,
      alt: kimBu?.bitti ? (kimBu.dogru ? _t("{0} puan", [Math.round(kimBu.puan || 0).toLocaleString(yerel())]) : _t("Bugün bilemedin")) : kbT ? _t("{0} tahmin hakkın kaldı", [5 - kbT]) : _t("5 tahminde gizli futbolcu"),
    },
    {
      id: "gunluk5", ad: _t("Günlük 5 Kulüp"), ikon: "podium",
      bitti: besT.length >= BES_KULUP_HAK,
      alt: besT.length >= BES_KULUP_HAK ? _t("{0} / 15 puan", [besT.reduce((t, x) => t + x.puan, 0)]) : besT.length ? _t("{0} hak kaldı", [BES_KULUP_HAK - besT.length]) : _t("{0} hak", [BES_KULUP_HAK]),
    },
    {
      id: "gunlukIzgara", ad: _t("Günlük Izgara"), ikon: "grid",
      bitti: (izgara?.kullanilan || 0) >= IZGARA_HAK || izgDolu === 9,
      alt: (izgara?.kullanilan || 0) >= IZGARA_HAK || izgDolu === 9 ? _t("{0} / 9 kare", [izgDolu]) : izgara?.kullanilan ? _t("{0} hak kaldı", [IZGARA_HAK - izgara.kullanilan]) : _t("{0} hak", [IZGARA_HAK]),
    },
  ];
  const gorevler = gorevListesi(d.gorev);
  return { hazir: !!d.hazir, oyunlar, biten: oyunlar.filter((o) => o.bitti).length, gorevler };
}

export default function GunlukSatiri({ onOyun }) {
  const durum = useGunlukDurum();
  const [acik, setAcik] = useState(false);
  const { oyunlar, biten } = durum;
  const alt = !durum.hazir ? " " : biten === oyunlar.length ? _t("Bugünün hepsi bitti — yarın yenileri") : biten ? _t("{0} oyundan {1}'i bitti", [oyunlar.length, biten]) : _t("#{0} · {1} oyun, seriyi korur", [gunNumarasi(), oyunlar.length]);
  return (
    <>
      <PressScale style={s.satir} onPress={() => setAcik(true)} accessibilityRole="button" accessibilityLabel={_t("Günlük Meydan Okumalar, {0}", [alt])}>
        <View style={s.ikon}>
          <Ionicons name="calendar" size={20} color={COLORS.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.baslik} numberOfLines={1}>{_t("Günlük Meydan Okumalar")}</Text>
          <View style={s.altSatir}>
            <View style={s.noktalar}>
              {oyunlar.map((o) => <View key={o.id} style={[s.nokta, o.bitti && s.noktaDolu]} />)}
            </View>
            <Text style={s.alt} numberOfLines={1}>{alt}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      </PressScale>
      <GunlukPenceresi acik={acik} durum={durum} onKapat={() => setAcik(false)} onOyun={(id) => { setAcik(false); onOyun && onOyun(id); }} />
    </>
  );
}

// ============================================================================
// ANA SAYFA ÖNERİ SATIRI — Paket 32 (15 Ekim 2026)
// Kerem: "ana sayfada bir satır da günlük bulmacalardan birine yönlendirme
// olabilir. efsane maç kadrosuna mesela." Tek satır, tek günlük oyun: önce
// Günün Kadrosu (efsane maçın ilk 11'i); o bittiyse sıradaki bitmemiş günlük.
// Hepsi bittiyse sakin "yarın yenileri" satırı.
// ============================================================================
const ONERI_SIRASI = ["gunlukKadro", "gunlukKimBu", "dailyPuzzle", "gunluk5", "gunlukIzgara"];
export function gunlukOneriSec(oyunlar) {
  const sirali = ONERI_SIRASI.map((id) => oyunlar.find((o) => o.id === id)).filter(Boolean);
  const acik = sirali.find((o) => !o.bitti);
  return acik ? { oyun: acik, hepsiBitti: false } : { oyun: sirali[0] || null, hepsiBitti: sirali.length > 0 };
}

export function GunlukOneriSatiri({ onOyun, style }) {
  const durum = useGunlukDurum();
  if (!durum.hazir) return <View style={[s.oneri, style, { opacity: 0 }]} />;
  const { oyun, hepsiBitti } = gunlukOneriSec(durum.oyunlar);
  if (!oyun) return null;
  return (
    <PressScale
      style={[s.oneri, style]}
      onPress={() => onOyun && onOyun(oyun.id)}
      accessibilityRole="button"
      accessibilityLabel={_t(
        "Günlük: {0}, {1}",
        [oyun.ad, hepsiBitti ? _t("bugünün hepsi bitti") : oyun.alt]
      )}
    >
      <View style={[s.oneriIkon, hepsiBitti && { backgroundColor: saydam(COLORS.text, 0.07) }]}>
        <Ionicons name={hepsiBitti ? "checkmark" : oyun.ikon} size={20} color={hepsiBitti ? COLORS.textMuted : COLORS.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.oneriUst} numberOfLines={1}>{_t("GÜNLÜK · #")}{gunNumarasi()}</Text>
        <Text style={s.oneriBaslik} numberOfLines={1}>{oyun.ad}</Text>
        <Text style={s.oneriAlt} numberOfLines={1}>{hepsiBitti ? _t("Bugünün hepsi bitti — yarın yenileri") : oyun.alt}</Text>
      </View>
      {!hepsiBitti ? (
        <View style={s.oneriOyna}><Text style={s.oneriOynaYazi}>{_t("OYNA")}</Text></View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
      )}
    </PressScale>
  );
}

export function GunlukPenceresi({ acik, durum, onKapat, onOyun, gorevsiz }) {
  const { oyunlar, gorevler } = durum;
  const gorevBiten = gorevler.filter((g) => g.olan >= g.hedef).length;
  return (
    <Modal visible={acik} transparent animationType="fade" onRequestClose={onKapat}>
      <Pressable style={s.perde} onPress={onKapat}>
        <Pressable style={s.pencere} onPress={() => {}}>
          <View style={s.pencereUst}>
            <Text style={s.pencereBaslik}>{_t("Günlük Meydan Okumalar")}</Text>
            <Text style={s.pencereNo}>#{gunNumarasi()}</Text>
          </View>
          <Text style={s.pencereAlt}>{_t("Herkese aynı sorular, günde bir kez. Birini oynamak serini korur.")}</Text>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: SPACING.sm }}>
            {oyunlar.map((o) => (
              <PressScale key={o.id} style={[s.oyun, o.bitti && s.oyunBitti]} onPress={() => onOyun(o.id)} accessibilityLabel={`${o.ad}, ${o.alt}`}>
                <View style={[s.oyunIkon, o.bitti && { backgroundColor: COLORS.accent }]}>
                  <Ionicons name={o.bitti ? "checkmark" : o.ikon} size={18} color={o.bitti ? COLORS.accentDark : COLORS.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.oyunAd}>{o.ad}</Text>
                  <Text style={s.oyunAlt} numberOfLines={1}>{o.alt}</Text>
                </View>
                {!o.bitti ? <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} /> : null}
              </PressScale>
            ))}
            {gorevsiz ? null : <View style={s.gorev}>
              <View style={s.gorevUst}>
                <Text style={s.gorevBaslik}>{_t("GÖREVLER")}</Text>
                <Text style={s.gorevSayac}>{gorevBiten}/{gorevler.length}· +{GOREV_ODULU}{" "}{_t("XP")}</Text>
              </View>
              {gorevler.map((g) => {
                const bitti = g.olan >= g.hedef;
                return (
                  <View key={g.id} style={s.gorevSatir}>
                    <Ionicons name={bitti ? "checkmark-circle" : "ellipse-outline"} size={16} color={bitti ? COLORS.accent : COLORS.textFaint} />
                    <Text style={[s.gorevYazi, bitti && { color: COLORS.textMuted, textDecorationLine: "line-through" }]} numberOfLines={1}>{g.metin}</Text>
                    <Text style={s.gorevSayi}>{Math.min(g.olan, g.hedef)}/{g.hedef}</Text>
                  </View>
                );
              })}
            </View>}
          </ScrollView>
          <Pressable style={s.kapat} onPress={onKapat} hitSlop={8}>
            <Text style={s.kapatYazi}>{_t("Kapat")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  satir: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.lg, paddingVertical: 12, paddingHorizontal: SPACING.md,
  },
  ikon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: vurguZemini(0.14) },
  baslik: { ...TYPE.h3 },
  altSatir: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  alt: { flex: 1, fontSize: 12.5, fontWeight: "600", color: COLORS.textMuted },
  noktalar: { flexDirection: "row", gap: 4 },
  nokta: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.cardBorder },
  noktaDolu: { backgroundColor: COLORS.accent },

  oneri: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: 76,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: saydam(COLORS.text, 0.06),
    borderRadius: 20, paddingVertical: 12, paddingHorizontal: SPACING.md,
  },
  oneriIkon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: vurguZemini(0.14) },
  oneriUst: { color: COLORS.accent, fontSize: 10.5, fontWeight: "900", letterSpacing: 1.2 },
  oneriBaslik: { color: COLORS.text, fontSize: 16, fontWeight: "900", marginTop: 1 },
  oneriAlt: { color: COLORS.textMuted, fontSize: 12.5, fontWeight: "600", marginTop: 1 },
  oneriOyna: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: vurguZemini(0.16) },
  oneriOynaYazi: { color: COLORS.accent, fontSize: 12.5, fontWeight: "900", letterSpacing: 0.8 },

  perde: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: SPACING.xl },
  pencere: { backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.xl },
  pencereUst: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  pencereBaslik: { ...TYPE.h2 },
  pencereNo: { color: COLORS.textMuted, fontWeight: "800", fontSize: 14 },
  pencereAlt: { ...TYPE.bodyMuted, marginTop: 4, marginBottom: SPACING.lg },
  oyun: { flexDirection: "row", alignItems: "center", gap: SPACING.md, borderRadius: RADIUS.md, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: saydam(COLORS.text, 0.04), borderWidth: 1, borderColor: COLORS.cardBorder },
  oyunBitti: { opacity: 0.7 },
  oyunIkon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: vurguZemini(0.14) },
  oyunAd: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  oyunAlt: { color: COLORS.textMuted, fontWeight: "600", fontSize: 12, marginTop: 1 },
  gorev: { marginTop: SPACING.sm, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, gap: 8 },
  gorevUst: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gorevBaslik: { color: COLORS.textMuted, fontWeight: "900", fontSize: 11, letterSpacing: 1.5 },
  gorevSayac: { color: COLORS.textMuted, fontWeight: "800", fontSize: 12 },
  gorevSatir: { flexDirection: "row", alignItems: "center", gap: 8 },
  gorevYazi: { flex: 1, color: COLORS.text, fontSize: 13.5, fontWeight: "600" },
  gorevSayi: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800" },
  kapat: { alignSelf: "center", marginTop: SPACING.lg },
  kapatYazi: { color: COLORS.textMuted, fontWeight: "700", fontSize: 14 },
});
