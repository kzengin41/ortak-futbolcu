import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import { ZorlukSecici, SureSecici, SecimCipleri, KurulumBolum } from "./ModKurulum";
import { useAppSettings } from "../lib/SettingsContext";
import {
  MOD_TANIMLARI, modVarsayilani, zorlukEtiketi, GALIBIYET_SECENEKLERI, YONTEM_SECENEKLERI,
} from "../lib/modAyarlari";
import { COLORS, RADIUS, SPACING, TYPE, MODE_COLORS } from "../lib/theme";

// ============================================================================
// AYARLAR > MOD VARSAYILANLARI — 27 Eylül 2026
// Kerem: "zorluk seviyesi her bir mod için ayarlardan ayarlansın ... default
// ayarlarda belirlensin ama modu oynayacakken de sorsun. süre kısıtı da aynı."
// Burada seçilen değerler modun kurulum ekranına HAZIR gelir; kurulumda
// değiştirilebilir (ve oradan da "varsayılan yap" denebilir).
// Seçenekler ve sınırlar lib/modAyarlari.js'teki tek tablodan okunuyor.
// ============================================================================
export default function ModVarsayilanlariPaneli() {
  const { settings, setSetting } = useAppSettings();
  const [acik, setAcik] = useState(null);

  function yaz(modId, alan, deger) {
    const hepsi = { ...(settings.modVarsayilanlari || {}) };
    hepsi[modId] = { ...(hepsi[modId] || {}), [alan]: deger };
    setSetting("modVarsayilanlari", hepsi);
  }

  return (
    <View style={styles.liste}>
      {Object.entries(MOD_TANIMLARI).map(([modId, tanim]) => {
        const v = modVarsayilani(settings, modId);
        const acikMi = acik === modId;
        const renk = (MODE_COLORS[tanim.renk] || {}).main || COLORS.accent;
        const ozet = [
          `Zorluk ${v.zorluk}/10`,
          tanim.sure ? (v.sure == null ? "Süresiz" : `${v.sure} sn`) : null,
          tanim.galibiyet != null ? (v.galibiyet === 0 ? "Sınırsız" : `${v.galibiyet} galibiyet`) : null,
          tanim.yontem ? (v.yontem === "voice" ? "Mikrofon" : "Klavye") : null,
        ].filter(Boolean).join(" · ");
        return (
          <View key={modId} style={[styles.kart, acikMi && { borderColor: renk }]}>
            <SoundPressable style={styles.baslikSatir} onPress={() => setAcik(acikMi ? null : modId)}>
              <View style={[styles.renkNokta, { backgroundColor: renk }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ad}>{tanim.ad}</Text>
                <Text style={styles.ozet} numberOfLines={1}>{ozet}</Text>
              </View>
              <Ionicons name={acikMi ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textMuted} />
            </SoundPressable>
            {acikMi ? (
              <View style={styles.icerik}>
                <KurulumBolum baslik="ZORLUK">
                  <ZorlukSecici
                    deger={v.zorluk}
                    onDegis={(z) => yaz(modId, "zorluk", z)}
                    aciklama={() => tanim.zorlukNe}
                  />
                </KurulumBolum>
                {tanim.sure ? (
                  <KurulumBolum baslik={tanim.sure.etiket}>
                    <SureSecici
                      key={modId + "-sure"}
                      secenekler={tanim.sure.secenekler}
                      deger={v.sure}
                      onDegis={(d) => yaz(modId, "sure", d)}
                      asgari={tanim.sure.asgari}
                      azami={tanim.sure.azami}
                      suresizVar={!!tanim.sure.suresizVar}
                      aciklama={tanim.sure.aciklama}
                    />
                  </KurulumBolum>
                ) : null}
                {tanim.galibiyet != null ? (
                  <KurulumBolum baslik="GALİBİYET SINIRI">
                    <SecimCipleri
                      secenekler={GALIBIYET_SECENEKLERI}
                      secili={v.galibiyet}
                      onSec={(g) => yaz(modId, "galibiyet", g)}
                    />
                  </KurulumBolum>
                ) : null}
                {tanim.yontem ? (
                  <KurulumBolum baslik="CEVAP YÖNTEMİ">
                    <SecimCipleri
                      secenekler={YONTEM_SECENEKLERI}
                      secili={v.yontem}
                      onSec={(y) => yaz(modId, "yontem", y)}
                    />
                  </KurulumBolum>
                ) : null}
                <Text style={styles.not}>
                  {zorlukEtiketi(v.zorluk)} seviyede başlar. Oynamadan önce kurulum ekranında yine değiştirebilirsin.
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  liste: { gap: SPACING.sm, marginBottom: 26 },
  kart: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, overflow: "hidden",
  },
  baslikSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md, minHeight: 56 },
  renkNokta: { width: 10, height: 10, borderRadius: 5 },
  ad: { ...TYPE.body, fontWeight: "800" },
  ozet: { ...TYPE.caption, marginTop: 2 },
  icerik: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  not: { ...TYPE.caption, color: COLORS.textFaint, marginTop: SPACING.md },
});
