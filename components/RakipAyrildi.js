import { _t } from "../lib/dil";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import DereceSonucu from "./DereceSonucu";
import { COLORS, RADIUS, SPACING } from "../lib/theme";

// ============================================================================
// DERECELİ MAÇTA RAKİP AYRILDI — Paket 23
// Rakip dereceli maç sürerken bağlantıdan düşerse üstte geri sayım çıkar;
// BEKLEME_SN içinde dönmezse maç bırakılmış sayılır: galibiyet sunucuya
// "rakip ayrıldı" olarak bildirilir (sunucu 90 sn içinde rakipten çelişen
// sonuç gelmezse işler). Dostluk maçında hiçbir şey yapmaz.
// Kopma zamanı modül düzeyinde tutulur: ekran tur sonu ↔ oyun arasında
// yeniden çizilse de sayaç sıfırlanmaz.
// ============================================================================
export const BEKLEME_SN = 45;
const kopmalar = new Map();   // "oda#mac" -> kopmanın başladığı an (ms)

export default function RakipAyrildi({ oda, benKimim, rakipVar, aktif, macNo = 1, onExit, simdi = () => Date.now() }) {
  const dereceli = !!(oda && oda.isRanked && oda.id);
  const anahtar = dereceli ? `${oda.id}#${macNo}` : null;
  const [, setTik] = useState(0);
  const [kapali, setKapali] = useState(false);

  const kopuk = dereceli && aktif && !rakipVar;
  if (anahtar && kopuk && !kopmalar.has(anahtar)) kopmalar.set(anahtar, simdi());
  if (anahtar && !kopuk && kopmalar.has(anahtar) && kopmalar.get(anahtar) !== "bitti") kopmalar.delete(anahtar);

  useEffect(() => {
    if (!kopuk) return;
    const t = setInterval(() => setTik((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [kopuk]);

  if (!anahtar) return null;
  const bas = kopmalar.get(anahtar);
  if (bas === undefined) return null;
  const bitti = bas === "bitti" || simdi() - bas >= BEKLEME_SN * 1000;
  if (bitti && bas !== "bitti") kopmalar.set(anahtar, "bitti");

  if (!bitti) {
    const kalan = Math.max(0, BEKLEME_SN - Math.floor((simdi() - bas) / 1000));
    return (
      <View style={st.serit} pointerEvents="none" accessibilityLabel={_t("Rakip bağlantıyı kaybetti, {0} saniye", [kalan])}>
        <Ionicons name="cloud-offline" size={16} color={COLORS.cta} />
        <Text style={st.seritYazi}>{_t("Rakip bağlantıyı kaybetti ·")}{" "}{kalan}{" "}{_t("sn içinde dönmezse galibiyet senin")}</Text>
      </View>
    );
  }

  return (
    <Modal visible={!kapali} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setKapali(true)}>
      <View style={st.arka}>
        <View style={st.kart}>
          <Ionicons name="flag" size={34} color={COLORS.accent} />
          <Text style={st.baslik}>{_t("RAKİP MAÇI BIRAKTI")}</Text>
          <Text style={st.yazi}>{_t("Dereceli maçtan ayrılan oyuncu yenilmiş sayılır. Galibiyet senin.")}</Text>
          <DereceSonucu oda={oda} kazananNo={benKimim} macNo={macNo} rakipAyrildi />
          <SoundPressable style={st.ana} onPress={onExit} accessibilityLabel={_t("Lobiye dön")}>
            <Text style={st.anaYazi}>{_t("Lobiye dön")}</Text>
          </SoundPressable>
          <SoundPressable style={st.ikincil} onPress={() => setKapali(true)} accessibilityLabel={_t("Burada kal")}>
            <Text style={st.ikincilYazi}>{_t("Burada kal")}</Text>
          </SoundPressable>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  serit: {
    position: "absolute", top: 8, left: 12, right: 12, zIndex: 50, elevation: 12,
    flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.cta,
  },
  seritYazi: { color: COLORS.text, fontSize: 13, fontWeight: "800", flex: 1 },
  arka: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: SPACING.xl },
  kart: { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.cardBorder, padding: SPACING.xl, alignItems: "center", gap: 6 },
  baslik: { color: COLORS.text, fontSize: 22, fontWeight: "900", letterSpacing: 1, marginTop: 4 },
  yazi: { color: COLORS.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  ana: { alignSelf: "stretch", marginTop: SPACING.lg, backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: "center" },
  anaYazi: { color: COLORS.accentDark, fontWeight: "900", fontSize: 15 },
  ikincil: { paddingVertical: 10 },
  ikincilYazi: { color: COLORS.textMuted, fontWeight: "800", fontSize: 13 },
});
