import { _t, yerel } from "../lib/dil";
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import SoundPressable from "./SoundPressable";
import { COLORS, MODE_COLORS, RADIUS, SPACING, SHADOW, yumusakKaro } from "../lib/theme";
import { gunlukDurumOku, BES_KULUP_HAK, IZGARA_HAK } from "../lib/gunlukKayit";

// Tüm Modlar'daki "Günlük 5 Kulüp" + "Günlük Izgara" girişleri (4 Ekim 2026).
// Bulmacaların KENDİSİ burada üretilmiyor; sadece bugünün kaydına bakılıyor.
export default function GunlukOyunlarKarti({ onBesKulup, onIzgara, onKadro, onKimBu }) {
  const [bes, setBes] = useState(null);
  const [izg, setIzg] = useState(null);
  const [kdr, setKdr] = useState(null);
  const [kb, setKb] = useState(null);

  const yukle = useCallback(() => {
    let iptal = false;
    gunlukDurumOku("5kulup").then((d) => { if (!iptal) setBes(d || {}); }).catch(() => {});
    gunlukDurumOku("izgara").then((d) => { if (!iptal) setIzg(d || {}); }).catch(() => {});
    gunlukDurumOku("kadro").then((d) => { if (!iptal) setKdr(d || {}); }).catch(() => {});
    gunlukDurumOku("kimBu").then((d) => { if (!iptal) setKb(d || {}); }).catch(() => {});
    return () => { iptal = true; };
  }, []);
  useEffect(yukle, [yukle]);
  useFocusEffect(yukle);

  const besT = bes?.tahminler || [];
  const besBitti = besT.length >= BES_KULUP_HAK;
  const besAlt = !bes ? "…" : besBitti ? _t("Bugün {0} / 15 ✓", [besT.reduce((t, x) => t + x.puan, 0)]) : besT.length ? _t("{0} hak kaldı", [BES_KULUP_HAK - besT.length]) : _t("3 hak · seriyi korur 🔥");

  const izgK = izg?.kareler || [];
  const izgDolu = izgK.filter(Boolean).length;
  const izgBitti = (izg?.kullanilan || 0) >= IZGARA_HAK || izgDolu === 9;
  const izgAlt = !izg ? "…" : izgBitti ? _t("Bugün {0} / 9 ✓", [izgDolu]) : izg?.kullanilan ? _t("{0} hak kaldı", [IZGARA_HAK - izg.kullanilan]) : _t("9 hak · seriyi korur 🔥");

  const kdrB = (kdr?.bulunan || []).length;
  const kdrAlt = !kdr ? "…" : kdr.bitti ? _t("Bugün {0}/11 ✓", [kdrB]) : kdrB ? _t("{0}/11 · devam et", [kdrB]) : _t("Efsane maçın ilk 11'i · seriyi korur 🔥");

  // Paket 13 — Günlük Kim Bu (5 tahmin hakkı)
  const kbT = (kb?.tahminler || []).length;
  const kbAlt = !kb ? "…" : kb.bitti ? (kb.dogru ? _t("Bugün {0} puan ✓", [Math.round(kb.puan || 0).toLocaleString(yerel())]) : _t("Bugün bilemedin ✓")) : kbT ? _t("{0} hak kaldı", [5 - kbT]) : _t("5 tahmin · seriyi korur 🔥");

  return (
    <View style={{ gap: SPACING.sm }}>
      {onKadro || onKimBu ? (
        <View style={[s.satir]}>
          {onKadro ? <Kutu baslik={_t("Günün Kadrosu")} alt={kdrAlt} ikon="shirt" renk={MODE_COLORS.teamTeam.main} bitti={!!kdr?.bitti} onPress={onKadro} /> : null}
          {onKimBu ? <Kutu baslik={_t("Günlük Kim Bu")} alt={kbAlt} ikon="help-circle" renk={MODE_COLORS.whoAmI.main} bitti={!!kb?.bitti} onPress={onKimBu} /> : null}
        </View>
      ) : null}
      <View style={s.satir}>
        <Kutu baslik={_t("Günlük 5 Kulüp")} alt={besAlt} ikon="podium" renk={MODE_COLORS.fiveClubs.main} bitti={besBitti} onPress={onBesKulup} />
        <Kutu baslik={_t("Günlük Izgara")} alt={izgAlt} ikon="grid" renk={MODE_COLORS.xox.main} bitti={izgBitti} onPress={onIzgara} />
      </View>
    </View>
  );
}

function Kutu({ baslik, alt, ikon, renk, bitti, onPress }) {
  return (
    <SoundPressable style={[s.kutu, { borderColor: renk }]} onPress={onPress} accessibilityLabel={`${baslik}, ${alt}`}>
      <View style={[s.ikon, yumusakKaro(bitti ? COLORS.accent : renk)]}>
        <Ionicons name={bitti ? "checkmark" : ikon} size={18} color={bitti ? COLORS.accent : renk} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.baslik} numberOfLines={1}>{baslik}</Text>
        <Text style={s.alt} numberOfLines={1}>{alt}</Text>
      </View>
    </SoundPressable>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: "row", gap: SPACING.sm, marginHorizontal: SPACING.xl },
  kutu: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.card, borderWidth: 1, borderRadius: RADIUS.md, padding: 10, ...SHADOW.card },
  ikon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  baslik: { fontSize: 13, fontWeight: "900", color: COLORS.text },
  alt: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted, marginTop: 2 },
});
