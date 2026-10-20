import { _t } from "../lib/dil";
import React, { useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PressScale from "./ui/PressScale";
import ModIkon from "./ModIkon";
import { useGunlukDurum, GunlukPenceresi } from "./GunlukSatiri";
import { gununModu } from "../lib/gununModu";
import { GOREV_ODULU } from "../lib/dailyGoals";
import { gunNumarasi } from "../lib/dailyPuzzle";
import { COLORS, RADIUS, SPACING, saydam, vurguZemini } from "../lib/theme";

// ============================================================================
// BUGÜN KARTI — Paket 34 (15 Ekim 2026)
// Kerem: "hem modlar ulaşılabilir olsun hem de … challenge'larla o modlara
// yönlendirsin" → "Günün modu · 2× XP" + "Görevler oynatsın".
// Tüm Modlar'da vitrinin altında TEK kart, üç satır — her satır bir oyuna götürür:
//   ⚡ GÜNÜN MODU · 2× XP   Futbolcu XOX                [OYNA]
//   ✓ Günün görevleri        1/3 · hepsine +250 XP      ▮▮▯ ›   (pencerede her görevin OYNA'sı)
//   ▦ Günlük meydan okumalar #34 · 2/5                  ›
// (Paket 31'deki tek "Günlük Meydan Okumalar" satırı bu kartın üçüncü satırı oldu.)
// ============================================================================
export default function BugunKarti({ onGununModu, onGorev, onGunlukOyun }) {
  const durum = useGunlukDurum();
  const [gunlukAcik, setGunlukAcik] = useState(false);
  const [gorevAcik, setGorevAcik] = useState(false);
  const mod = gununModu();
  const { oyunlar, biten, gorevler } = durum;
  const gorevBiten = gorevler.filter((g) => g.olan >= g.hedef).length;
  const gunlukAlt = !durum.hazir ? " " : biten === oyunlar.length ? _t("Bugünün hepsi bitti") : _t("#{0} · {1}/{2} bitti", [gunNumarasi(), biten, oyunlar.length]);

  return (
    <View style={s.kart}>
      {/* 1 — günün modu */}
      <PressScale style={[s.satir, s.cizgi]} onPress={() => onGununModu && onGununModu(mod)} accessibilityRole="button" accessibilityLabel={_t("Günün modu: {0}, iki kat XP, oyna", [mod.ad])}>
        <View style={[s.ikon, s.ikonVurgu]}><ModIkon ad={mod.ikon} boyut={24} renk={COLORS.accent} /></View>
        <View style={s.metin}>
          <Text style={s.ust}>{_t("GÜNÜN MODU · 2× XP")}</Text>
          <Text style={s.baslik} numberOfLines={1}>{mod.ad}</Text>
        </View>
        <View style={s.oyna}><Text style={s.oynaYazi}>{_t("OYNA")}</Text></View>
      </PressScale>

      {/* 2 — görevler */}
      <PressScale style={[s.satir, s.cizgi]} onPress={() => setGorevAcik(true)} accessibilityRole="button" accessibilityLabel={_t("Günün görevleri, {0} / {1}", [gorevBiten, gorevler.length])}>
        <View style={s.ikon}><Ionicons name="checkmark-done" size={22} color={COLORS.text} /></View>
        <View style={s.metin}>
          <Text style={s.baslik} numberOfLines={1}>{_t("Günün görevleri")}</Text>
          <Text style={s.alt} numberOfLines={1}>{gorevBiten === gorevler.length && gorevler.length ? _t("Hepsi bitti · +{0} XP alındı", [GOREV_ODULU]) : _t("{0}/{1} · hepsine +{2} XP", [gorevBiten, gorevler.length, GOREV_ODULU])}</Text>
        </View>
        <View style={s.cubuklar}>
          {gorevler.map((g) => <View key={g.id} style={[s.cubuk, g.olan >= g.hedef && s.cubukDolu]} />)}
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
      </PressScale>

      {/* 3 — günlük meydan okumalar */}
      <PressScale style={s.satir} onPress={() => setGunlukAcik(true)} accessibilityRole="button" accessibilityLabel={_t("Günlük Meydan Okumalar, {0}", [gunlukAlt])}>
        <View style={s.ikon}><Ionicons name="calendar" size={21} color={COLORS.text} /></View>
        <View style={s.metin}>
          <Text style={s.baslik} numberOfLines={1}>{_t("Günlük Meydan Okumalar")}</Text>
          <View style={s.altSatir}>
            <View style={s.noktalar}>{oyunlar.map((o) => <View key={o.id} style={[s.nokta, o.bitti && s.noktaDolu]} />)}</View>
            <Text style={s.alt} numberOfLines={1}>{gunlukAlt}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
      </PressScale>

      <GunlukPenceresi acik={gunlukAcik} durum={durum} gorevsiz onKapat={() => setGunlukAcik(false)} onOyun={(id) => { setGunlukAcik(false); onGunlukOyun && onGunlukOyun(id); }} />
      <GorevPenceresi
        acik={gorevAcik}
        gorevler={gorevler}
        mod={mod}
        onKapat={() => setGorevAcik(false)}
        onGorev={(g) => {
          setGorevAcik(false);
          if (g.git.gunluk) setGunlukAcik(true);
          else onGorev && onGorev(g, mod);
        }}
      />
    </View>
  );
}

// Görevler alt sayfası: her görevin ilerlemesi ve kendi OYNA düğmesi.
export function GorevPenceresi({ acik, gorevler, mod, onKapat, onGorev }) {
  const insets = useSafeAreaInsets();
  const biten = gorevler.filter((g) => g.olan >= g.hedef).length;
  return (
    <Modal visible={acik} transparent animationType="slide" onRequestClose={onKapat}>
      <Pressable style={s.perde} onPress={onKapat}>
        <Pressable style={[s.sayfa, { paddingBottom: SPACING.xl + (insets.bottom || 0) }]} onPress={() => {}}>
          <View style={s.tutamak} />
          <View style={s.sayfaUst}>
            <Text style={s.sayfaBaslik}>{_t("Günün görevleri")}</Text>
            <Text style={s.sayfaSayac}>{biten}/{gorevler.length}</Text>
          </View>
          <Text style={s.sayfaAlt}>{_t("Üçü de bitince +")}{GOREV_ODULU}{" "}{_t("XP ve günlük serin korunur.")}</Text>
          {gorevler.map((g) => {
            const bitti = g.olan >= g.hedef;
            const hedefAd = g.git.gunun ? `${mod.ad} · 2× XP` : null;
            return (
              <View key={g.id} style={[s.gorev, bitti && { opacity: 0.6 }]}>
                <Ionicons name={bitti ? "checkmark-circle" : "ellipse-outline"} size={22} color={bitti ? COLORS.accent : COLORS.textFaint} />
                <View style={s.metin}>
                  <Text style={[s.gorevYazi, bitti && { textDecorationLine: "line-through" }]} numberOfLines={2}>{g.metin}</Text>
                  <View style={s.ilerleme}>
                    <View style={[s.ilerlemeDolu, { width: `${Math.round((Math.min(g.olan, g.hedef) / g.hedef) * 100)}%` }]} />
                  </View>
                  <Text style={s.gorevAlt}>{Math.min(g.olan, g.hedef)}/{g.hedef}{hedefAd ? _t(" · önerilen: {0}", [hedefAd]) : ""}</Text>
                </View>
                {!bitti ? (
                  <PressScale style={s.gorevOyna} onPress={() => onGorev(g)} accessibilityRole="button" accessibilityLabel={_t("Görev: {0}, oyna", [g.metin])}>
                    <Text style={s.gorevOynaYazi}>{_t("OYNA")}</Text>
                  </PressScale>
                ) : null}
              </View>
            );
          })}
          <Pressable style={s.kapat} onPress={onKapat} hitSlop={8}><Text style={s.kapatYazi}>{_t("Kapat")}</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  kart: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.lg, borderRadius: 22, overflow: "hidden",
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: saydam(COLORS.text, 0.07),
  },
  satir: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: 12, paddingHorizontal: SPACING.md },
  cizgi: { borderBottomWidth: 1, borderBottomColor: saydam(COLORS.text, 0.07) },
  ikon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: saydam(COLORS.text, 0.07) },
  ikonVurgu: { backgroundColor: vurguZemini(0.16) },
  metin: { flex: 1, minWidth: 0 },
  ust: { color: COLORS.accent, fontSize: 10.5, fontWeight: "900", letterSpacing: 1.2 },
  baslik: { color: COLORS.text, fontSize: 15.5, fontWeight: "900", marginTop: 1 },
  alt: { color: COLORS.textMuted, fontSize: 12.5, fontWeight: "600", marginTop: 2, flexShrink: 1 },
  altSatir: { flexDirection: "row", alignItems: "center", gap: 8 },
  noktalar: { flexDirection: "row", gap: 4, marginTop: 2 },
  nokta: { width: 7, height: 7, borderRadius: 4, backgroundColor: saydam(COLORS.text, 0.18) },
  noktaDolu: { backgroundColor: COLORS.accent },
  // vitrindeki OYNA birincil kalsın: bu düğme yumuşak (çerçeve + vurgu yazı)
  oyna: { backgroundColor: vurguZemini(0.16), borderWidth: 1, borderColor: COLORS.accent, borderRadius: RADIUS.pill, paddingVertical: 7, paddingHorizontal: 15 },
  oynaYazi: { color: COLORS.accent, fontSize: 13, fontWeight: "900", letterSpacing: 0.8 },
  cubuklar: { flexDirection: "row", gap: 3 },
  cubuk: { width: 14, height: 6, borderRadius: 3, backgroundColor: saydam(COLORS.text, 0.18) },
  cubukDolu: { backgroundColor: COLORS.accent },

  perde: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sayfa: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderBottomWidth: 0, borderColor: COLORS.cardBorder, paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm,
  },
  tutamak: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.cardBorder, marginBottom: SPACING.lg },
  sayfaUst: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sayfaBaslik: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  sayfaSayac: { color: COLORS.textMuted, fontSize: 15, fontWeight: "900" },
  sayfaAlt: { color: COLORS.textMuted, fontSize: 13, fontWeight: "600", marginTop: 4, marginBottom: SPACING.md },
  gorev: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: saydam(COLORS.text, 0.07) },
  gorevYazi: { color: COLORS.text, fontSize: 14.5, fontWeight: "800" },
  gorevAlt: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600", marginTop: 4 },
  ilerleme: { height: 5, borderRadius: 3, backgroundColor: saydam(COLORS.text, 0.1), marginTop: 6, overflow: "hidden" },
  ilerlemeDolu: { height: 5, borderRadius: 3, backgroundColor: COLORS.accent },
  gorevOyna: { backgroundColor: vurguZemini(0.16), borderWidth: 1, borderColor: COLORS.accent, borderRadius: RADIUS.pill, paddingVertical: 8, paddingHorizontal: 14 },
  gorevOynaYazi: { color: COLORS.accent, fontSize: 12.5, fontWeight: "900", letterSpacing: 0.6 },
  kapat: { alignSelf: "center", marginTop: SPACING.md },
  kapatYazi: { color: COLORS.textMuted, fontWeight: "700", fontSize: 14 },
});
