import { _t } from "../lib/dil";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { sonucuBildirVeBekle, ligBul, YERLESTIRME_MAC, useDerece } from "../lib/derece";
import { COLORS, RADIUS, SPACING } from "../lib/theme";

// ============================================================================
// MAÇ SONU — DERECE SATIRI (Paket 23)
// Dereceli maçta sonucu sunucuya bildirir, rakibin bildirimini bekler ve puan
// değişimini gösterir: "+16  ·  1016 → 1032  ·  2. Lig". Dostluk maçında
// yalnız "puan değişmez" notu.
//   oda: odaNesnesi (id, isRanked)   kazananNo: 1 / 2 / 0   macNo: odadaki maç sırası
// ============================================================================
const SEBEP = {
  cok_kisa: _t("Maç çok kısa sürdü, dereceye sayılmadı."),
  gunluk_ikili_siniri: _t("Bu rakiple bugün 3 dereceli maç yaptın; bu maç puana sayılmadı."),
  celiski: _t("İki tarafın sonucu uyuşmadı; puan değişmedi."),
};

export default function DereceSonucu({ oda, kazananNo, macNo = 1, rakipAyrildi = false }) {
  const dereceli = !!(oda && oda.isRanked && oda.id);
  const [s, setS] = useState(dereceli ? { durum: "gonderiliyor" } : null);
  const { kart } = useDerece({ otomatik: false });

  useEffect(() => {
    if (!dereceli || kazananNo == null) return;
    const iptal = { iptal: false };
    sonucuBildirVeBekle({
      odaId: oda.id, macNo, kazanan: kazananNo, rakipAyrildi,
      iptal, ilerle: (ara) => !iptal.iptal && setS(ara),
    }).then((son) => !iptal.iptal && setS(son || { durum: "hata" }));
    return () => { iptal.iptal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dereceli, oda && oda.id, macNo, kazananNo]);

  if (!oda) return null;
  if (!dereceli) {
    return (
      <View style={st.not}>
        <Ionicons name="people-outline" size={14} color={COLORS.textMuted} />
        <Text style={st.notYazi}>{_t("Dostluk maçı · puan değişmez")}</Text>
      </View>
    );
  }

  if (!s || s.durum === "gonderiliyor" || s.durum === "bekliyor") {
    return (
      <View style={st.kutu} accessibilityLabel={_t("Puan işleniyor")}>
        <ActivityIndicator color={COLORS.accent} size="small" />
        <Text style={st.bekleYazi}>{s && s.durum === "bekliyor" ? _t("Rakibin sonucu bekleniyor…") : _t("Puan işleniyor…")}</Text>
      </View>
    );
  }

  if (s.durum === "islendi" && Number.isFinite(s.once) && Number.isFinite(s.sonra)) {
    const fark = s.sonra - s.once;
    const { lig, sonraki, kalan, ilerleme } = ligBul(s.sonra);
    const eskiLig = ligBul(s.once).lig;
    const yukseldi = lig.alt > eskiLig.alt;
    const dustu = lig.alt < eskiLig.alt;
    const renk = fark > 0 ? COLORS.accent : fark < 0 ? COLORS.danger : COLORS.textMuted;
    const yerlesme = kart && kart.mac <= YERLESTIRME_MAC ? _t(
      "Yerleştirme {0}/{1}",
      [Math.min(kart.mac, YERLESTIRME_MAC), YERLESTIRME_MAC]
    ) : null;
    return (
      <View style={[st.kutu, { borderColor: renk }]} accessibilityLabel={_t(
        "Online puan {0} {1}, yeni puan {2}",
        [fark >= 0 ? "artı" : "eksi", Math.abs(fark), s.sonra]
      )}>
        <View style={st.satir}>
          <Text style={[st.fark, { color: renk }]}>{fark > 0 ? `+${fark}` : `${fark}`}</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.puanYazi}>{s.once} → <Text style={{ color: COLORS.text, fontWeight: "900" }}>{s.sonra}</Text></Text>
            <View style={st.ligSatir}>
              <Ionicons name={lig.ikon} size={13} color={lig.renk} />
              <Text style={[st.ligYazi, { color: lig.renk }]}>{lig.ad}</Text>
              {yerlesme ? <Text style={st.yerlesme}>· {yerlesme}</Text> : null}
            </View>
          </View>
        </View>
        <View style={st.cubuk}><View style={[st.dolu, { width: `${Math.round(ilerleme * 100)}%`, backgroundColor: lig.renk }]} /></View>
        <Text style={st.altYazi}>
          {yukseldi ? _t("Tebrikler, {0} yükseldin!", [lig.yonelme]) : dustu ? _t("{0} düştün.", [lig.yonelme]) : sonraki ? _t("{0} {1} puan", [sonraki.yonelme, kalan]) : _t("En üst ligdesin!")}
        </Text>
      </View>
    );
  }

  return (
    <View style={st.not}>
      <Ionicons name="information-circle-outline" size={14} color={COLORS.textMuted} />
      <Text style={st.notYazi}>{SEBEP[s.sebep] || (s.durum === "hata" ? _t("Puan şu an işlenemedi; internet gelince Online sekmesinde güncellenir.") : _t("Bu maç dereceye sayılmadı."))}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  kutu: {
    alignSelf: "stretch", marginTop: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.cardBorder, gap: 8,
  },
  satir: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  fark: { fontSize: 30, fontWeight: "900", minWidth: 64, textAlign: "center" },
  puanYazi: { color: COLORS.textMuted, fontSize: 15, fontWeight: "700" },
  ligSatir: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ligYazi: { fontSize: 13, fontWeight: "900" },
  yerlesme: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  cubuk: { height: 6, borderRadius: 3, backgroundColor: COLORS.bg, overflow: "hidden" },
  dolu: { height: 6, borderRadius: 3 },
  altYazi: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", textAlign: "center" },
  bekleYazi: { color: COLORS.textMuted, fontSize: 13, fontWeight: "700", textAlign: "center" },
  not: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.md, paddingHorizontal: SPACING.sm, alignSelf: "center" },
  notYazi: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", flexShrink: 1, textAlign: "center" },
});
