import React, { useState } from "react";
import { Modal, View, Text, ScrollView, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import TakimSecici from "./TakimSecici";
import { useAppSettings } from "../lib/SettingsContext";
import { ayarlardanProfil } from "../lib/eslesmeProfili";
import { bildirimDesteginVarMi, hatirlatmayiKur, HATIRLATMA_SAATI } from "../lib/notifications";
import { COLORS, RADIUS, SPACING, TYPE } from "../lib/theme";

// ============================================================================
// AÇILIŞTA "TUTTUĞUN TAKIM?" — 28 Eylül 2026
// Kerem: "açılışta da sorsun ayarlarda da olsun. açılışta sorduğunda
// geçebilsin, uğraştırmasın illa." Bir kez sorulur (settings.takimSoruldu);
// "Geç" de cevap sayılır. Ana ekranda (Oyna) duruyor, böylece hem yeni
// kullanıcı onboarding'den sonra hem de mevcut kullanıcı bir sonraki
// açılışta görür.
// ============================================================================
export default function TakimSorusuPenceresi() {
  const { settings, setSetting, loaded } = useAppSettings();
  // Akşam hatırlatması da burada, tek dokunuşla (denetim bulgusu #9: varsayılan
  // kapalıydı ve Ayarlar'da 3 dokunuş derindeydi). İşaretli gelir; kaldırılabilir.
  const [hatirlat, setHatirlat] = useState(true);
  if (!loaded || settings.takimSoruldu) return null;
  const bildirimVar = bildirimDesteginVarMi();
  const profil = ayarlardanProfil(settings);

  function bitir(takim) {
    if (takim) setSetting("eslesmeProfili", { ...profil, takim, takimOrani: profil.takimOrani || "az" });
    setSetting("takimSoruldu", true);
    if (bildirimVar && hatirlat) hatirlatmayiKur().catch(() => {});
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => bitir(null)}>
      <View style={styles.perde}>
        <View style={styles.kart}>
          <View style={styles.ust}>
            <View style={{ flex: 1 }}>
              <Text style={styles.baslik}>Tuttuğun takım hangisi?</Text>
              <Text style={styles.aciklama}>
                Turlarda takımın biraz daha sık çıksın. İstediğin zaman Ayarlar'dan değiştirirsin.
              </Text>
            </View>
            <SoundPressable onPress={() => bitir(null)} hitSlop={12}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </SoundPressable>
          </View>
          <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
            <TakimSecici secili={null} onSec={(t) => t && bitir(t)} />
          </ScrollView>
          {bildirimVar ? (
            <View style={styles.hatirlat}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hatirlatBaslik}>Akşam hatırlatması</Text>
                <Text style={styles.hatirlatYazi}>Günün bulmacası için her akşam {HATIRLATMA_SAATI}:00'de tek bildirim</Text>
              </View>
              <Switch value={hatirlat} onValueChange={setHatirlat} trackColor={{ true: COLORS.accent }} />
            </View>
          ) : null}
          <SoundPressable style={styles.gec} onPress={() => bitir(null)}>
            <Text style={styles.gecYazi}>Şimdilik geç</Text>
          </SoundPressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  perde: { flex: 1, backgroundColor: "rgba(6,12,20,0.78)", justifyContent: "flex-end" },
  kart: {
    backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.lg, paddingBottom: SPACING.xl, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  ust: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.md, marginBottom: SPACING.md },
  baslik: { ...TYPE.h2 },
  aciklama: { ...TYPE.bodyMuted, marginTop: 4 },
  hatirlat: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md, marginTop: SPACING.md,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  hatirlatBaslik: { ...TYPE.body, fontWeight: "800" },
  hatirlatYazi: { ...TYPE.caption, marginTop: 2 },
  gec: { alignSelf: "center", paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, marginTop: SPACING.sm },
  gecYazi: { ...TYPE.body, color: COLORS.textMuted, fontWeight: "800" },
});
