import { _t } from "../lib/dil";
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PressScale from "./ui/PressScale";
import ModIkon from "./ModIkon";
import { COLORS, RADIUS, SPACING, saydam, vurguZemini } from "../lib/theme";

// ============================================================================
// OYUN BAŞLAT PENCERESİ — Paket 31 (14 Ekim 2026)
// Kerem: "açılınca mod seçme menüsü halen çok karmaşık. orayı güzelleştirmek lazım."
// ESKİ: ortada bir kart; "Kiminle oynuyorsun?" altında CPU / YANIMDAKİLERLE /
// ONLINE başlıkları ve 6 uzun satır (her biri başlık + açıklama) alt alta —
// bir oyuna girmek için 6 cümle okumak gerekiyordu.
// YENİ (iki küçük soru + tek düğme, alttan açılan sayfa):
//   1. KİMİNLE?  yan yana 2–4 büyük karo (CPU · Yanımdaki · Online · Tek başına)
//   2. NASIL?    yalnız o rakiple birden çok tür varsa, tek satırlık çipler;
//                seçili türün açıklaması altında tek satır
//   3. BAŞLA     tek ana düğme. Son seçim (bu oturumda) hatırlanır.
// options biçimi OynaScreen MODES ile aynı: { id, rakip, label, alt, sekme, params }
// Paket 32: rakip "online" seçiliyken BAŞLA yerine iki düğme — RASTGELE RAKİP
// (dereceli) ve ODA KUR (arkadaşınla) — ve "Kodla katıl" bağlantısı:
// onBasla(secenek, "rastgele" | "oda" | "katil"). Tek rakip türü varsa
// (Online lobisi) KİMİNLE? satırı hiç çizilmez. `mesgul`: düğmeler pasif.
// ============================================================================

const RAKIPLER = {
  cpu: { ad: _t("CPU"), ikon: "hardware-chip-outline" },
  yanimdaki: { ad: _t("Yanımdaki"), ikon: "people-outline" },
  online: { ad: _t("Online"), ikon: "globe-outline" },
  tek: { ad: _t("Tek başına"), ikon: "person-outline" },
};
const SIRA = ["cpu", "yanimdaki", "online", "tek"];
const sonSecim = new Map();   // modKey -> { rakip, i }

export default function OyunBaslatPenceresi({ mod, onClose, onBasla, mesgul, hata }) {
  const insets = useSafeAreaInsets();
  const secenekler = (mod && mod.options) || [];
  const rakipler = useMemo(() => SIRA.filter((r) => secenekler.some((o) => o.rakip === r)), [mod]);
  const [rakip, setRakip] = useState(null);
  const [tur, setTur] = useState(0);

  useEffect(() => {
    if (!mod) return;
    const son = sonSecim.get(mod.key);
    const r = son && rakipler.includes(son.rakip) ? son.rakip : rakipler[0];
    setRakip(r);
    // mod.secili: açılışta seçili gelecek tür (Online lobisinde dokunulan kart)
    setTur(Number.isInteger(mod.secili) ? mod.secili : son && son.rakip === r ? son.i : 0);
  }, [mod]);

  if (!mod) return null;
  const turler = secenekler.filter((o) => o.rakip === rakip);
  const secili = turler[Math.min(tur, turler.length - 1)] || turler[0];

  const basla = (eylem) => {
    if (!secili || mesgul) return;
    sonSecim.set(mod.key, { rakip, i: turler.indexOf(secili) });
    onBasla && onBasla(secili, eylem);
  };
  const online = !!secili && secili.rakip === "online";

  return (
    <Modal visible={!!mod} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.perde} onPress={onClose}>
        <Pressable style={[s.sayfa, { paddingBottom: SPACING.xl + (insets.bottom || 0) }]} onPress={() => {}}>
          <View style={s.tutamak} />
          <View style={s.baslikSatir}>
            <View style={s.ikon}>
              {mod.ikon ? <ModIkon ad={mod.ikon} boyut={24} renk={COLORS.accent} /> : <Ionicons name={mod.icon || "play"} size={22} color={COLORS.accent} />}
            </View>
            <Text style={s.baslik} numberOfLines={2}>{mod.vitrinAdi || mod.title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={_t("Kapat")} style={s.kapat}>
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
            </Pressable>
          </View>

          {rakipler.length > 1 ? <Text style={s.soru}>{_t("KİMİNLE?")}</Text> : null}
          {rakipler.length > 1 ? <View style={s.karolar}>
            {rakipler.map((r) => {
              const akt = r === rakip;
              return (
                <View key={r} style={{ flex: 1 }}>
                  <PressScale
                    style={[s.karo, akt && s.karoAktif]}
                    onPress={() => { setRakip(r); setTur(0); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: akt }}
                    accessibilityLabel={_t("Rakip: {0}", [RAKIPLER[r].ad])}
                  >
                    <Ionicons name={akt ? RAKIPLER[r].ikon.replace("-outline", "") : RAKIPLER[r].ikon} size={24} color={akt ? COLORS.accent : COLORS.textMuted} />
                    <Text style={[s.karoYazi, akt && { color: COLORS.text }]}>{RAKIPLER[r].ad}</Text>
                  </PressScale>
                </View>
              );
            })}
          </View> : null}

          {turler.length > 1 ? (
            <>
              <Text style={s.soru}>{_t("NASIL?")}</Text>
              <View style={s.cipler}>
                {turler.map((o, i) => {
                  const akt = o === secili;
                  return (
                    <PressScale key={`${o.id}-${i}`} style={[s.cip, akt && s.cipAktif]} onPress={() => setTur(i)} accessibilityRole="button" accessibilityState={{ selected: akt }} accessibilityLabel={_t("Tür: {0}", [o.kisaLabel || o.label])}>
                      <Text style={[s.cipYazi, akt && { color: COLORS.text }]} numberOfLines={1}>{o.kisaLabel || o.label}</Text>
                    </PressScale>
                  );
                })}
              </View>
            </>
          ) : null}
          {secili && secili.alt ? <Text style={s.aciklama} numberOfLines={2}>{secili.alt}</Text> : <View style={{ height: SPACING.sm }} />}

          {hata ? <Text style={s.hata}>{hata}</Text> : null}
          {online ? (
            <>
              <PressScale style={[s.basla, mesgul && s.pasif]} onPress={() => basla("rastgele")} accessibilityRole="button" accessibilityLabel={_t("Rastgele rakip bul")}>
                <Ionicons name="flash" size={20} color={COLORS.accentDark} />
                <Text style={s.baslaYazi}>{_t("RASTGELE RAKİP")}</Text>
              </PressScale>
              <Text style={s.dugmeNot}>{_t("Dereceli · puanına yakın biriyle eşleşirsin")}</Text>
              <PressScale style={[s.ikincil, mesgul && s.pasif]} onPress={() => basla("oda")} accessibilityRole="button" accessibilityLabel={_t("Arkadaşınla oda kur")}>
                <Ionicons name="people" size={18} color={COLORS.text} />
                <Text style={s.ikincilYazi}>{_t("ARKADAŞINLA OYNA")}</Text>
              </PressScale>
              <Pressable onPress={() => basla("katil")} hitSlop={10} style={s.bag} accessibilityRole="button" accessibilityLabel={_t("Kodla katıl")}>
                <Text style={s.bagYazi}>{_t("Arkadaşın oda kurduysa")}{" "}<Text style={s.bagVurgu}>{_t("kodla katıl")}</Text></Text>
              </Pressable>
            </>
          ) : (
            <PressScale style={s.basla} onPress={() => basla()} accessibilityRole="button" accessibilityLabel={_t("Başla")}>
              <Ionicons name="play" size={20} color={COLORS.accentDark} />
              <Text style={s.baslaYazi}>{_t("BAŞLA")}</Text>
            </PressScale>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sayfa: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderBottomWidth: 0, borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm,
  },
  tutamak: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.cardBorder, marginBottom: SPACING.lg },
  baslikSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.lg },
  ikon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: vurguZemini(0.14) },
  baslik: { flex: 1, color: COLORS.text, fontSize: 19, fontWeight: "900", lineHeight: 23 },
  kapat: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: saydam(COLORS.text, 0.06) },

  soru: { color: COLORS.textMuted, fontSize: 12, fontWeight: "900", letterSpacing: 1.5, marginBottom: SPACING.sm },
  karolar: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  karo: {
    alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: "transparent", backgroundColor: saydam(COLORS.text, 0.06),
  },
  karoAktif: { borderColor: COLORS.accent, backgroundColor: vurguZemini(0.12) },
  karoYazi: { color: COLORS.textMuted, fontSize: 13, fontWeight: "800" },

  cipler: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.sm },
  // Paket 32: seçili çip yumuşak vurgu (dolu sarı yalnız BAŞLA'da) — kurulum ekranıyla aynı.
  cip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: "transparent", backgroundColor: saydam(COLORS.text, 0.06) },
  cipAktif: { backgroundColor: vurguZemini(0.14), borderColor: COLORS.accent },
  cipYazi: { color: COLORS.textMuted, fontSize: 14, fontWeight: "800" },
  aciklama: { color: COLORS.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 18, minHeight: 18, marginBottom: SPACING.lg },

  basla: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.accent, borderRadius: RADIUS.pill, paddingVertical: 15,
  },
  baslaYazi: { color: COLORS.accentDark, fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  pasif: { opacity: 0.5 },
  dugmeNot: { color: COLORS.textFaint, fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: 6, marginBottom: SPACING.md },
  ikincil: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: saydam(COLORS.text, 0.08), borderRadius: RADIUS.pill, paddingVertical: 14,
  },
  ikincilYazi: { color: COLORS.text, fontSize: 15, fontWeight: "900", letterSpacing: 0.8 },
  bag: { alignSelf: "center", marginTop: SPACING.md, paddingVertical: 4 },
  bagYazi: { color: COLORS.textMuted, fontSize: 13, fontWeight: "600" },
  bagVurgu: { color: COLORS.text, fontWeight: "800", textDecorationLine: "underline" },
  hata: { color: COLORS.danger, fontSize: 13, fontWeight: "700", textAlign: "center", marginBottom: SPACING.sm },
});
