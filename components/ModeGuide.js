import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MODE_GUIDES } from "../lib/modeGuides";
import { useOyunBilgisi, useKurulumDestegi, kurulumIste } from "../lib/modAyarlari";
import { COLORS, SPACING, RADIUS, TYPE, SHADOW } from "../lib/theme";

// ============================================================================
// 11 Eylül 2026 (Kerem: "her bir modun ilk defa oynandığında rehber gibi
// nereye tıklanacak, nasıl cevap verilecek gösteren bir şey açılmalı. atla
// butonu olmalı. 1 kez oynandıktan sonra kaybolmalı ama eğer (i) butonu gibi
// bir info butonuna tıklanırsa tekrar bakılabilmeli.")
//
// TASARIM KARARLARI
//  - Rehber App.js'teki withExit() sarmalayıcısında merkezî olarak gösteriliyor,
//    her oyun ekranına ayrı ayrı eklenmiyor. 12 ekranı tek tek değiştirmek
//    yerine tek yerde durması, yeni mod eklendiğinde unutulmasını da önlüyor.
//  - "Görüldü" bilgisi MOD BAŞINA AsyncStorage'da. Bir modu oynamış olmak
//    diğerinin rehberini kapatmıyor.
//  - (i) butonu ekranın SOL ALTINDA duruyor: ekranların sağ üstü zaten
//    bildir/kapat butonlarıyla, ortası ve altı da asıl oyun butonlarıyla dolu.
// ============================================================================

const ANAHTAR = (mod) => `rehber_goruldu_${mod}`;

export function useModeGuide(mod) {
  const [gorunur, setGorunur] = useState(false);
  const [hazir, setHazir] = useState(false);
  const varMi = Boolean(mod && MODE_GUIDES[mod]);

  useEffect(() => {
    let iptal = false;
    if (!varMi) {
      setHazir(true);
      return;
    }
    AsyncStorage.getItem(ANAHTAR(mod))
      .then((deger) => {
        if (iptal) return;
        if (!deger) setGorunur(true);
        setHazir(true);
      })
      .catch(() => {
        // Depolama okunamadıysa rehberi AÇMA — her açılışta tekrar tekrar
        // göstermek, hiç göstermemekten daha rahatsız edici olur.
        if (!iptal) setHazir(true);
      });
    return () => {
      iptal = true;
    };
  }, [mod, varMi]);

  const kapat = useCallback(() => {
    setGorunur(false);
    if (varMi) AsyncStorage.setItem(ANAHTAR(mod), "1").catch(() => {});
  }, [mod, varMi]);

  const ac = useCallback(() => {
    if (varMi) setGorunur(true);
  }, [varMi]);

  return { gorunur, ac, kapat, hazir, varMi };
}

export function ModeGuideButton({ onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={16} style={styles.infoBtn}>
      <Ionicons name="information-circle-outline" size={20} color={COLORS.textMuted} />
    </Pressable>
  );
}

// 4 Ekim 2026 — kurulumsuz başlangıç: modlar ayarsız başlıyor, kurulum bu ⚙
// düğmesinin arkasında (bkz. lib/modAyarlari.js useKurulumKapisi).
export function KurulumButonu({ mod }) {
  const var_ = useKurulumDestegi(mod);
  if (!var_) return null;
  return (
    <Pressable onPress={() => kurulumIste(mod)} hitSlop={16} style={[styles.infoBtn, { left: SPACING.lg + 42 }]} accessibilityLabel="Bu modun ayarları">
      <Ionicons name="settings-outline" size={18} color={COLORS.textMuted} />
    </Pressable>
  );
}

export default function ModeGuide({ mod, gorunur, onClose }) {
  // 27 Eylül 2026 (Kerem: "bilemedim/pes et butonları, süre kısıtları, lig
  // kısıtları her yerden bakılabilsin") — ekranlar güncel ayarlarını
  // lib/modAyarlari.js'e yazıyor; bu pencere her modda aynı yerden gösteriyor.
  const bilgi = useOyunBilgisi(mod === "fiveClubsCpu" ? "fiveClubs" : mod);
  const kurulumVar = useKurulumDestegi(mod);
  const rehber = MODE_GUIDES[mod];
  if (!rehber) return null;

  return (
    <Modal visible={gorunur} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.perde}>
        <View style={styles.kart}>
          <View style={styles.baslikSatiri}>
            <Ionicons name={rehber.icon || "help-circle"} size={22} color={COLORS.accent} />
            <Text style={styles.baslik}>{rehber.title}</Text>
          </View>
          <Text style={styles.altBaslik}>Nasıl oynanır</Text>

          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {bilgi && bilgi.satirlar && bilgi.satirlar.length ? (
              <View style={styles.ayarKutu}>
                <Text style={styles.ayarBaslik}>BU MAÇIN AYARLARI</Text>
                {bilgi.satirlar.map(([ad, deger]) => (
                  <View key={ad} style={styles.ayarSatir}>
                    <Text style={styles.ayarAd}>{ad}</Text>
                    <Text style={styles.ayarDeger} numberOfLines={2}>{deger}</Text>
                  </View>
                ))}
                {kurulumVar ? (
                  <Pressable onPress={() => { onClose(); kurulumIste(mod); }} style={styles.ayarDugme}>
                    <Ionicons name="settings-outline" size={15} color={COLORS.accent} />
                    <Text style={styles.ayarDugmeYazi}>Ayarları değiştir (yeni maç başlar)</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.ayarNot}>Varsayılanları Ayarlar &gt; Mod Varsayılanları'ndan değiştirebilirsin.</Text>
                )}
              </View>
            ) : null}
            {rehber.points.map((madde, i) => (
              <View key={i} style={styles.maddeSatiri}>
                <View style={styles.nokta}>
                  <Text style={styles.noktaYazi}>{i + 1}</Text>
                </View>
                <Text style={styles.madde}>{madde}</Text>
              </View>
            ))}
          </ScrollView>

          <Pressable style={styles.anaBtn} onPress={onClose}>
            <Text style={styles.anaBtnYazi}>TAMAM</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.atla}>Atla</Text>
          </Pressable>
          <Text style={styles.dipnot}>
            Bu rehberi istediğin zaman sol alttaki (i) düğmesinden tekrar açabilirsin.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  perde: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  kart: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    ...SHADOW.card,
  },
  ayarKutu: {
    backgroundColor: COLORS.bg, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg,
  },
  ayarBaslik: { ...TYPE.eyebrow, fontSize: 12, marginBottom: SPACING.sm },
  ayarSatir: { flexDirection: "row", justifyContent: "space-between", gap: SPACING.md, paddingVertical: 3 },
  ayarAd: { ...TYPE.caption },
  ayarDeger: { ...TYPE.caption, color: COLORS.text, fontWeight: "800", flexShrink: 1, textAlign: "right" },
  ayarNot: { ...TYPE.caption, fontSize: 12, color: COLORS.textMuted, marginTop: SPACING.sm },
  baslikSatiri: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  baslik: { ...TYPE.h2, flexShrink: 1 },
  altBaslik: { ...TYPE.caption, marginTop: SPACING.xs, marginBottom: SPACING.lg },
  maddeSatiri: { flexDirection: "row", gap: SPACING.md, marginBottom: SPACING.lg },
  nokta: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  noktaYazi: { color: COLORS.accentDark, fontSize: 12, fontWeight: "900" },
  madde: { ...TYPE.body, flex: 1, fontSize: 14, lineHeight: 20 },
  anaBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  anaBtnYazi: { ...TYPE.button, color: COLORS.accentDark },
  atla: {
    ...TYPE.caption,
    textAlign: "center",
    marginTop: SPACING.md,
    textDecorationLine: "underline",
  },
  dipnot: {
    ...TYPE.caption,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.md,
    fontSize: 12,
  },
  ayarDugme: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.sm, paddingVertical: 8 },
  ayarDugmeYazi: { fontSize: 14, fontWeight: "800", color: COLORS.accent },
  infoBtn: {
    position: "absolute",
    left: SPACING.lg,
    bottom: SPACING.lg,
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(22,34,46,0.85)",
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
});
