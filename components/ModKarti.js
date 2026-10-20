import { _t } from "../lib/dil";
import React, { createContext, useContext } from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressScale from "./ui/PressScale";
import ModIkon from "./ModIkon";
import { COLORS, MODE_COLORS, RADIUS, SPACING, TYPE, SHADOW, yumusakKaro, saydam, vurguZemini } from "../lib/theme";

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
//
// Paket 18 (Kerem: "3 madde kare şeklinde değil de yatayda uzun dikdörtgen
// halinde olsun. buradaki tüm modlar o şekilde olsun") — kart artık tam
// genişlikte yatay satır: solda ikon karosu, ortada ad + açıklama, sağda ok.
// Renk yalnız ikon karosunda (mod grubunun tonu, bkz. lib/theme.js MOD_GRUBU);
// kart yüzeyi tüm modlarda aynı — göz yormasın.
// `mod.ikon`: components/ModIkon.js'teki özel ikon; yoksa Ionicons `mod.icon`.
//
// Paket 30 (14 Ekim 2026, Kerem: "tüm modlar sayfası halen çok karmaşık
// görünüyor, oyun basitliği yok") — benchmark: NYT Games (tek dikey liste,
// her oyun eşit ve sade), Chess.com (tek dokunuşla oyna, sonra "kiminle"),
// iOS Ayarlar tipi gruplu liste. ModBolumu artık TEK bir yüzey: içindeki
// kartlar ayrı ayrı kutu değil, ince çizgiyle ayrılmış satırlar. Başlık küçük
// gri büyük harf (her bölüm başlığı ikonlu, kocaman h2 değil). İkon karoları
// tek renk (temanın eylem rengi): renk yarışı yok, ekranın tek renkli büyük
// alanı vitrin kartı. Açıklama tek satır.
// ============================================================================
const GrupBaglami = createContext(false);
export function ModIkonu({ mod, boyut = 26, renk }) {
  return mod.ikon ? <ModIkon ad={mod.ikon} boyut={boyut} renk={renk} /> : <Ionicons name={mod.icon} size={boyut - 2} color={renk} />;
}

export function ModKarti({ mod, onPress, rozet, accessibilityLabel, son }) {
  const grupta = useContext(GrupBaglami);
  const c = { main: COLORS.accent };
  // Paket 31 — "sade" bölüm: kutusuz, ikon karosuz, soluk; vitrinle yarışmaz.
  if (grupta === "sade") {
    return (
      <PressScale style={[s.sadeSatir, !son && s.sadeCizgi]} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel || mod.title}>
        <View style={s.sadeIkon}><ModIkonu mod={mod} boyut={22} renk={COLORS.textMuted} /></View>
        <View style={s.metin}>
          <Text style={s.sadeBaslik} numberOfLines={1}>{mod.title}</Text>
          <Text style={s.sadeAlt} numberOfLines={1}>{mod.kisa || mod.desc}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.textFaint} />
      </PressScale>
    );
  }
  return (
    <PressScale
      style={grupta ? [s.satir, !son && s.satirCizgi] : s.kart}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || mod.title}
    >
      {/* Paket 32 (Kerem: liste kartlarının renkleri) — ikon karosu nötr: sarı
          çerçeveli kareler her satırda aynı vurguyu tekrarlayıp listeyi bağırtıyordu.
          Vurgu rengi artık yalnız birincil eylemde. */}
      <View style={grupta ? s.ikonNotr : [s.ikonKaro, yumusakKaro(c.main)]}>
        <ModIkonu mod={mod} boyut={grupta ? 22 : 26} renk={grupta ? COLORS.text : c.main} />
      </View>
      <View style={s.metin}>
        <View style={s.baslikSatir}>
          <Text style={s.cardTitle} numberOfLines={1}>{mod.title}</Text>
          {rozet ? (
            <View style={s.rozet}><Text style={s.rozetYazi}>{rozet}</Text></View>
          ) : null}
        </View>
        <Text style={s.cardDesc} numberOfLines={1}>{mod.kisa || mod.desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
    </PressScale>
  );
}

export function ModBolumu({ baslik, children, style, sade }) {
  const dizi = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[s.section, style]}>
      {baslik ? <Text style={s.sectionTitle}>{baslik}</Text> : null}
      <GrupBaglami.Provider value={sade ? "sade" : true}>
        <View style={sade ? null : s.grup}>
          {dizi.map((c, i) => (React.isValidElement(c) ? React.cloneElement(c, { son: i === dizi.length - 1 }) : c))}
        </View>
      </GrupBaglami.Provider>
    </View>
  );
}

export function ModSecimPenceresi({ mod, soru = _t("Kiminle oynuyorsun?"), secenekler = [], onClose, children, altYazi }) {
  const c = mod ? { main: COLORS.accent } : null;
  return (
    <Modal visible={!!mod} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={s.modalCard} onPress={() => {}}>
          {mod && (
            <>
              <View style={[s.modalIconWrap, yumusakKaro(c.main)]}>
                <ModIkonu mod={mod} boyut={28} renk={c.main} />
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
                            <Ionicons name={opt.ikon || "play"} size={20} color={opt.kapali ? COLORS.textMuted : COLORS.accent} />
                            <View style={{ flex: 1 }}>
                              <Text style={[s.modalOptionText, opt.kapali && { color: COLORS.textMuted }]}>{opt.label}</Text>
                              {opt.alt ? <Text style={[s.modalOptionAlt, opt.kapali && { color: COLORS.textMuted }]}>{opt.alt}</Text> : null}
                            </View>
                            {!opt.kapali ? <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} /> : null}
                          </PressScale>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
              {altYazi ? <Text style={s.altYazi}>{altYazi}</Text> : null}
              <Pressable style={s.modalCancel} onPress={onClose}>
                <Text style={s.modalCancelText}>{_t("Vazgeç")}</Text>
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
  sectionTitle: { color: COLORS.textMuted, fontWeight: "900", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: SPACING.sm, marginLeft: 4 },
  // Paket 32 — liste kartı dili (Online, Profilim, Ayarlar aynı): kart = tek yüzey,
  // kenarlık yerine çok ince ışık çizgisi, satır araları kısık ayırıcı.
  grup: { backgroundColor: COLORS.card, borderColor: saydam(COLORS.text, 0.06), borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  satir: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: 12, paddingHorizontal: SPACING.md },
  satirCizgi: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: saydam(COLORS.text, 0.07) },
  ikonNotr: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: saydam(COLORS.text, 0.07) },
  sadeSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: 11, paddingHorizontal: 4 },
  sadeCizgi: { borderBottomWidth: 1, borderBottomColor: saydam(COLORS.text, 0.07) },
  sadeIkon: { width: 32, alignItems: "center" },
  sadeBaslik: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  sadeAlt: { color: COLORS.textFaint, fontSize: 12, fontWeight: "600", marginTop: 1 },
  kart: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
    ...SHADOW.card,
  },
  ikonKaro: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  metin: { flex: 1, minWidth: 0 },
  baslikSatir: { flexDirection: "row", alignItems: "center", gap: 6 },
  rozet: { borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: vurguZemini(0.16) },
  rozetYazi: { fontSize: 9.5, fontWeight: "900", letterSpacing: 0.5, color: COLORS.accent },

  cardTitle: { ...TYPE.h3, flexShrink: 1 },
  cardDesc: { fontSize: 12.5, fontWeight: "600", color: COLORS.textMuted, lineHeight: 17, marginTop: 1 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: SPACING.xl },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: "center",
  },
  modalIconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },
  modalTitle: { ...TYPE.h2, marginBottom: 4, textAlign: "center" },
  modalDesc: { ...TYPE.bodyMuted, textAlign: "center", marginBottom: SPACING.lg },
  modalOptions: { width: "100%", gap: SPACING.sm },
  // Paket 30 — seçenekler sakin satır: 6 tane dolu renkli buton üst üste göz yoruyordu.
  modalOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: saydam(COLORS.text, 0.04),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
  },
  modalOptionText: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  modalOptionAlt: { color: COLORS.textMuted, fontWeight: "600", fontSize: 12, marginTop: 2 },
  modalOptionKapali: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  kiminle: { ...TYPE.h3, alignSelf: "flex-start", marginBottom: 2 },
  rakipBaslik: { color: COLORS.textMuted, fontWeight: "900", fontSize: 11, letterSpacing: 1.5, marginTop: 6, marginBottom: 6 },
  altYazi: { ...TYPE.caption, fontSize: 12, textAlign: "center", marginTop: SPACING.md },
  modalCancel: { marginTop: SPACING.lg },
  modalCancelText: { color: COLORS.textMuted, fontWeight: "700", fontSize: 13 },
});
