import React from "react";
import { View, Text, StyleSheet, Dimensions, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressScale from "./ui/PressScale";
import { COLORS, MODE_COLORS, RADIUS, SPACING, TYPE, SHADOW } from "../lib/theme";

// ============================================================================
// MOD KARTI + SEÇİM PENCERESİ — Paket 16, 5 Ekim 2026 (Kerem: "Online
// alanındaki tasarımı da tıpkı Tüm Modlar alanındaki gibi yapalım").
// Tüm Modlar'daki (OynaScreen) renkli ızgara kartı ve "Kiminle oynuyorsun?"
// penceresi buraya taşındı; Online lobi de aynı iki bileşeni kullanıyor, böylece
// iki sayfa birebir aynı görünüyor ve biri değişince öteki de değişiyor.
//
//   <ModKarti mod={{ title, desc, icon, colorKey }} onPress />
//   <ModBolumu baslik ikon>{kartlar}</ModBolumu>
//   <ModSecimPenceresi mod soru secenekler onClose>{özel içerik}</ModSecimPenceresi>
//     secenekler: [{ anahtar, grup?, ikon, label, alt?, kapali?, onPress }]
//     grup: üstte gösterilen küçük başlık (ardışık aynı grup bir kez yazılır)
// ============================================================================
const { width } = Dimensions.get("window");
export const KART_GENISLIK = (width - SPACING.xl * 2 - SPACING.md) / 2;

export function ModKarti({ mod, onPress, rozet, accessibilityLabel }) {
  const c = MODE_COLORS[mod.colorKey] || MODE_COLORS.online;
  return (
    <PressScale
      style={[s.gridCard, { borderColor: c.main, backgroundColor: c.dark }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || mod.title}
    >
      <View style={s.ustSatir}>
        <View style={[s.gridIconWrap, { backgroundColor: c.main }]}>
          <Ionicons name={mod.icon} size={22} color={COLORS.accentDark} />
        </View>
        {rozet ? (
          <View style={[s.rozet, { borderColor: c.main }]}><Text style={[s.rozetYazi, { color: c.main }]}>{rozet}</Text></View>
        ) : null}
      </View>
      <Text style={s.cardTitle}>{mod.title}</Text>
      <Text style={s.cardDesc} numberOfLines={2}>{mod.desc}</Text>
    </PressScale>
  );
}

export function ModBolumu({ baslik, ikon, children, style }) {
  return (
    <View style={[s.section, style]}>
      <View style={s.sectionTitleRow}>
        <Ionicons name={ikon} size={16} color={COLORS.accent} />
        <Text style={s.sectionTitle}>{baslik}</Text>
      </View>
      <View style={s.grid}>{children}</View>
    </View>
  );
}

export function ModSecimPenceresi({ mod, soru = "Kiminle oynuyorsun?", secenekler = [], onClose, children, altYazi }) {
  const c = mod ? MODE_COLORS[mod.colorKey] || MODE_COLORS.online : null;
  return (
    <Modal visible={!!mod} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={s.modalCard} onPress={() => {}}>
          {mod && (
            <>
              <View style={[s.modalIconWrap, { backgroundColor: c.main }]}>
                <Ionicons name={mod.icon} size={26} color={COLORS.accentDark} />
              </View>
              <Text style={s.modalTitle}>{mod.title}</Text>
              <Text style={s.modalDesc}>{mod.desc}</Text>
              {children || (
                <>
                  {soru ? <Text style={s.kiminle}>{soru}</Text> : null}
                  <View style={s.modalOptions}>
                    {secenekler.map((opt, i) => {
                      const baslikGoster = opt.grup && (i === 0 || secenekler[i - 1].grup !== opt.grup);
                      return (
                        <View key={opt.anahtar || `${opt.label}-${i}`}>
                          {baslikGoster ? <Text style={s.rakipBaslik}>{opt.grup}</Text> : null}
                          <PressScale
                            style={[s.modalOptionBtn, opt.kapali && s.modalOptionKapali]}
                            disabled={!!opt.kapali}
                            accessibilityLabel={opt.label}
                            onPress={() => { if (!opt.kapali) opt.onPress && opt.onPress(); }}
                          >
                            <Ionicons name={opt.ikon || "play"} size={20} color={opt.kapali ? COLORS.textMuted : COLORS.accentDark} />
                            <View style={{ flex: 1 }}>
                              <Text style={[s.modalOptionText, opt.kapali && { color: COLORS.textMuted }]}>{opt.label}</Text>
                              {opt.alt ? <Text style={[s.modalOptionAlt, opt.kapali && { color: COLORS.textMuted }]}>{opt.alt}</Text> : null}
                            </View>
                            {!opt.kapali ? <Ionicons name="chevron-forward" size={18} color={COLORS.accentDark} /> : null}
                          </PressScale>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
              {altYazi ? <Text style={s.altYazi}>{altYazi}</Text> : null}
              <Pressable style={s.modalCancel} onPress={onClose}>
                <Text style={s.modalCancelText}>Vazgeç</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const modStilleri = StyleSheet.create({
  // Pencere içinde özel içerik (kod girişi gibi) yazan ekranlar için.
  modalOptions: { width: "100%", gap: SPACING.sm },
  kiminle: { ...TYPE.h3, alignSelf: "flex-start", marginBottom: 2 },
  modalOptionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 14, paddingHorizontal: SPACING.lg,
  },
  modalOptionText: { color: COLORS.accentDark, fontWeight: "900", fontSize: 14 },
});

const s = StyleSheet.create({
  section: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.md, marginLeft: 4 },
  sectionTitle: { ...TYPE.h2 },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: SPACING.md },
  gridCard: {
    width: KART_GENISLIK,
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  ustSatir: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  gridIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },
  rozet: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2 },
  rozetYazi: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },

  cardTitle: { ...TYPE.h3, marginBottom: SPACING.xs },
  cardDesc: { fontSize: 12, fontWeight: "500", color: COLORS.text, opacity: 0.85, lineHeight: 16 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: SPACING.xl },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: "center",
  },
  modalIconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },
  modalTitle: { ...TYPE.h2, marginBottom: 4, textAlign: "center" },
  modalDesc: { ...TYPE.bodyMuted, textAlign: "center", marginBottom: SPACING.lg },
  modalOptions: { width: "100%", gap: SPACING.sm },
  modalOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
  },
  modalOptionText: { color: COLORS.accentDark, fontWeight: "900", fontSize: 14 },
  modalOptionAlt: { color: COLORS.accentDark, fontWeight: "600", fontSize: 12, opacity: 0.8, marginTop: 2 },
  modalOptionKapali: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  kiminle: { ...TYPE.h3, alignSelf: "flex-start", marginBottom: 2 },
  rakipBaslik: { color: COLORS.textMuted, fontWeight: "900", fontSize: 11, letterSpacing: 1.5, marginTop: 6, marginBottom: 6 },
  altYazi: { ...TYPE.caption, fontSize: 12, textAlign: "center", marginTop: SPACING.md },
  modalCancel: { marginTop: SPACING.lg },
  modalCancelText: { color: COLORS.textMuted, fontWeight: "700", fontSize: 13 },
});
