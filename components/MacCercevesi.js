import { _t } from "../lib/dil";
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SPACING, saydam } from "../lib/theme";
import { kisaAd } from "../lib/cpuKarakterleri";

// ============================================================================
// MAÇ ÇERÇEVESİ — Paket 31 (14 Ekim 2026)
// Kerem: "modlarda belli bir standart olması lazım" + "bazı modlarda hala
// kahveci kenan konuşuyor falan. standart olmamış o kısım" → karar: CPU rakibi
// "her modda aynı".
// ESKİ: her mod üstünü kendi çiziyordu — Ortak Kulüp "BİLDİR + kırmızı X +
// SEN 0 / 0 ☕ KENAN", 5 Kulüp "Tur 1/3 · Sen: 0 · ☕ Kahveci Kenan: 0",
// İlk Harf "‹ Geri · Harf Eşleşmesi · Sen: 0 Hedef: 3 ☕ Kahveci Kenan: 0",
// XOX "‹ Geri · X Sıra sende O", Kim Bu "‹ Menü · ♥♥♥ · SEVİYE 3 · SERİ".
// Çıkış dört farklı yerde/biçimde, rakibin adı üç farklı yazımla.
// YENİ: her mod aynı üç parçayı kullanır:
//   <OyunUstCubugu baslik alt onCikis onBildir sag />   ✕ · mod adı / alt · ⚑
//   <SkorSeridi sol sag orta />                          SEN 2 · 3'te biter · 1 ☕ KENAN
//   <RakipTepkisi karakter metin />                      ☕ Kenan: Çayımı alayım…
// Rakibin adı her yerde kısa ad (Kenan), avatarı her yerde aynı daire içinde.
// ============================================================================

function Dugme({ ikon, onPress, etiket }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={etiket} style={({ pressed }) => [s.dugme, pressed && { opacity: 0.6 }]}>
      <Ionicons name={ikon} size={20} color={COLORS.text} />
    </Pressable>
  );
}

export function OyunUstCubugu({ baslik, alt, onCikis, onBildir, sag, style }) {
  return (
    <View style={[s.ust, style]}>
      {onCikis ? <Dugme ikon="close" onPress={onCikis} etiket={_t("Oyundan çık")} /> : <View style={s.bosDugme} />}
      <View style={s.ustOrta}>
        {baslik ? <Text style={s.baslik} numberOfLines={1}>{baslik}</Text> : null}
        {alt ? <Text style={s.alt} numberOfLines={1}>{alt}</Text> : null}
      </View>
      {sag !== undefined ? <View style={s.sagKutu}>{sag}</View> : onBildir ? <Dugme ikon="flag-outline" onPress={onBildir} etiket={_t("Hatalı soru bildir")} /> : <View style={s.bosDugme} />}
    </View>
  );
}

export function RakipAvatari({ karakter, boyut = 26 }) {
  if (!karakter) return null;
  return (
    <View style={[s.avatar, { width: boyut, height: boyut, borderRadius: boyut / 2, backgroundColor: saydam(karakter.renk || COLORS.cta, 0.22), borderColor: saydam(karakter.renk || COLORS.cta, 0.6) }]}>
      <Text style={{ fontSize: boyut * 0.55 }}>{karakter.avatar}</Text>
    </View>
  );
}

// sol / sag: { etiket, puan, karakter?, aktif?, renk? }   orta: kısa metin (hedef, tur…)
export function SkorSeridi({ sol, sag, orta, style }) {
  const Taraf = ({ t, ters }) => (
    <View style={[s.taraf, ters && { flexDirection: "row-reverse" }]}>
      <View style={{ alignItems: ters ? "flex-end" : "flex-start", minWidth: 0, flexShrink: 1 }}>
        <View style={[s.etiketSatir, ters && { flexDirection: "row-reverse" }]}>
          {t.karakter ? <RakipAvatari karakter={t.karakter} boyut={20} /> : null}
          <Text style={[s.etiket, t.renk && { color: t.renk }, t.aktif && { color: COLORS.accent }]} numberOfLines={1}>{t.etiket}</Text>
        </View>
        {t.puan !== undefined && t.puan !== null ? <Text style={s.puan}>{t.puan}</Text> : null}
      </View>
    </View>
  );
  return (
    <View style={[s.serit, style]}>
      <Taraf t={sol} />
      {orta ? <Text style={s.orta} numberOfLines={2}>{orta}</Text> : <View style={{ flex: 1 }} />}
      <Taraf t={sag} ters />
    </View>
  );
}

export function RakipTepkisi({ karakter, metin, style }) {
  if (!karakter || !metin) return null;
  return (
    <View style={[s.tepki, style]}>
      <RakipAvatari karakter={karakter} boyut={22} />
      <Text style={s.tepkiYazi} numberOfLines={2}>
        <Text style={s.tepkiAd}>{kisaAd(karakter)}: </Text>
        {metin}
      </Text>
    </View>
  );
}

// Skor şeridindeki rakip etiketi (büyük harf kısa ad)
export const rakipEtiketi = (karakter) => kisaAd(karakter).toLocaleUpperCase("tr");

const s = StyleSheet.create({
  ust: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: 48, marginBottom: SPACING.sm, width: "100%" },
  dugme: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: saydam(COLORS.text, 0.08) },
  bosDugme: { width: 40, height: 40 },
  sagKutu: { minWidth: 40, alignItems: "flex-end" },
  ustOrta: { flex: 1, alignItems: "center", minWidth: 0 },
  baslik: { color: COLORS.text, fontSize: 15, fontWeight: "900" },
  alt: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", marginTop: 1 },

  serit: {
    flexDirection: "row", alignItems: "center", width: "100%",
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.md,
    paddingVertical: 8, paddingHorizontal: SPACING.md, marginBottom: SPACING.md,
  },
  taraf: { flexDirection: "row", alignItems: "center", flex: 1.3, minWidth: 0 },
  etiketSatir: { flexDirection: "row", alignItems: "center", gap: 6 },
  etiket: { color: COLORS.textMuted, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  puan: { color: COLORS.text, fontSize: 26, fontWeight: "900", lineHeight: 30 },
  orta: { flex: 1, textAlign: "center", color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  avatar: { alignItems: "center", justifyContent: "center", borderWidth: 1 },

  tepki: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", maxWidth: "100%", marginTop: SPACING.sm },
  tepkiYazi: { flexShrink: 1, color: COLORS.textMuted, fontSize: 13, fontWeight: "600", fontStyle: "italic" },
  tepkiAd: { color: COLORS.text, fontStyle: "normal", fontWeight: "800" },
});
