import { _t } from "../lib/dil";
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import { adSorunu, takmaAdAyarla } from "../lib/derece";
import { updateProfileName } from "../lib/profile";
import { COLORS, RADIUS, SPACING } from "../lib/theme";

// ============================================================================
// TAKMA AD SEÇ — Paket 23 (Kerem: "varsayılan adı olanlara ilk dereceli
// maçtan önce ad seçtirelim"). Liderlik tablosunda ve rakibin ekranında bu ad
// görünür. Kural sunucuda da denetleniyor (3–16 karakter, uygunsuz kelime yok).
// ============================================================================
const VARSAYILAN_ADLAR = ["Gizemli Forvet"];

export default function AdSecPenceresi({ visible, oneri, baslik = _t("Takma adını seç"), aciklama, onKaydet, onKapat }) {
  const [ad, setAd] = useState("");
  const [hata, setHata] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAd(oneri && !VARSAYILAN_ADLAR.includes(oneri) ? String(oneri).slice(0, 16) : "");
    setHata("");
    setCalisiyor(false);
  }, [visible, oneri]);

  async function kaydet() {
    const sorun = adSorunu(ad);
    if (sorun) { setHata(sorun); return; }
    setCalisiyor(true);
    const r = await takmaAdAyarla(ad);
    setCalisiyor(false);
    if (!r.tamam) { setHata(r.mesaj); return; }
    updateProfileName(r.ad, { dereceyeYaz: false });   // profildeki ad da aynı olsun
    onKaydet && onKaydet(r.ad);
  }

  if (!visible) return null;   // kapalıyken hiç çizilmesin (gizli TextInput odak çalmasın)
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onKapat}>
      <View style={st.arka}>
        <View style={st.kart}>
          <Ionicons name="person-circle" size={40} color={COLORS.accent} />
          <Text style={st.baslik}>{baslik}</Text>
          <Text style={st.aciklama}>{aciklama || _t("Dereceli maçlarda rakibin ve liderlik tablosu seni bu adla görür.")}</Text>
          <TextInput
            value={ad}
            onChangeText={(t) => { setAd(t); setHata(""); }}
            placeholder={_t("ör. Kerem10")}
            placeholderTextColor={COLORS.textFaint}
            maxLength={16}
            autoCorrect={false}
            autoFocus
            style={st.girdi}
            onSubmitEditing={kaydet}
            accessibilityLabel={_t("Takma ad")}
          />
          {hata ? <Text style={st.hata}>{hata}</Text> : <Text style={st.ipucu}>{_t("3–16 karakter · harf, rakam, boşluk, . _ -")}</Text>}
          <SoundPressable style={[st.ana, calisiyor && { opacity: 0.6 }]} onPress={kaydet} disabled={calisiyor} accessibilityLabel={_t("Adı kaydet")}>
            {calisiyor ? <ActivityIndicator color={COLORS.accentDark} /> : <Text style={st.anaYazi}>{_t("Kaydet")}</Text>}
          </SoundPressable>
          <SoundPressable style={st.ikincil} onPress={onKapat} accessibilityLabel={_t("Vazgeç")}>
            <Text style={st.ikincilYazi}>{_t("Vazgeç")}</Text>
          </SoundPressable>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  arka: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: SPACING.xl },
  kart: { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.cardBorder, padding: SPACING.xl, alignItems: "center", gap: 6 },
  baslik: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 4 },
  aciklama: { color: COLORS.textMuted, fontSize: 13, textAlign: "center", lineHeight: 19, marginBottom: SPACING.sm },
  girdi: {
    alignSelf: "stretch", backgroundColor: COLORS.bg, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 12, color: COLORS.text, fontSize: 18, fontWeight: "800", textAlign: "center",
  },
  ipucu: { color: COLORS.textFaint, fontSize: 12 },
  hata: { color: COLORS.danger, fontSize: 13, fontWeight: "700", textAlign: "center" },
  ana: { alignSelf: "stretch", marginTop: SPACING.md, backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: "center" },
  anaYazi: { color: COLORS.accentDark, fontWeight: "900", fontSize: 15 },
  ikincil: { paddingVertical: 10 },
  ikincilYazi: { color: COLORS.textMuted, fontWeight: "800", fontSize: 13 },
});
