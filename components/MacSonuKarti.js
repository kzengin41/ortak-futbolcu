import React from "react";
import { View, Text, StyleSheet, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import PlayerPhoto from "./PlayerPhoto";
import MatchSummary from "./MatchSummary";
import { COLORS, SPACING, RADIUS } from "../lib/theme";

// ============================================================================
// MAÇ SONU KARTI — 4 Ekim 2026
// Benchmark kararı: "Maç sonu kartı (skor, en iyi cevap, Paylaş) bütün
// modlarda." Tek bileşen; her mod skoru, rakibi, turların özetini ve
// (varsa) en nadir doğru cevabı veriyor.
//
//   turlar: ["sen" | "rakip" | "yok", ...]  → paylaşım karelerinde 🟩🟥⬜
//   enIyi:  { ad, alt }  → "En nadir cevabın" kutusu (tanınırlığı en düşük doğru cevap)
//   rakip:  { ad, avatar, tepki } (CPU karakteri) ya da { ad } (2. oyuncu)
// ============================================================================
export default function MacSonuKarti({
  modAdi, modeId, skorSen, skorRakip, rakip, turlar = [], enIyi, kazanilanXp,
  onRovans, onMenu, ekSatir, solo, rovansEtiketi = "RÖVANŞ", kazanan, kareSatir, skorEtiketi,
}) {
  // kazanan: "sen" | "rakip" | "berabere" — skordan çıkmayan sonuçlar için (XOX: üçlü sıra).
  // kareSatir: kareleri satırlara böl (XOX tahtası 3×3).
  // solo: { puan, rekor, yeniRekor, satirlar: [[etiket, değer], ...] } — tek
  // kişilik modlar (Çoktan seçmeli, İlk Harf zinciri) skor yerine puan + rekor gösterir.
  const kazandin = kazanan ? kazanan === "sen" : skorSen > skorRakip;
  const berabere = kazanan ? kazanan === "berabere" : skorSen === skorRakip;
  const baslik = solo ? (solo.yeniRekor ? "YENİ REKOR!" : "SÜRE DOLDU") : berabere ? "BERABERE" : kazandin ? "KAZANDIN!" : `${(rakip?.ad || "RAKİP").toLocaleUpperCase("tr")} KAZANDI`;
  const kareDizi = turlar.map((t) => (t === "sen" ? "🟩" : t === "rakip" ? "🟥" : "⬜"));
  const kareler = kareSatir
    ? Array.from({ length: Math.ceil(kareDizi.length / kareSatir) }, (_, i) => kareDizi.slice(i * kareSatir, (i + 1) * kareSatir).join("")).join("\n")
    : kareDizi.join("");

  async function paylas() {
    const satirlar = solo ? [
      `⚽ 3-2-1: Bitir İşi — ${modAdi}`,
      `${solo.puan} puan${solo.yeniRekor ? " — yeni rekorum!" : ""}`,
      kareler,
      ...(solo.satirlar || []).map(([a, b]) => `${a}: ${b}`),
      "Sen kaç yaparsın?",
    ] : [
      `⚽ 3-2-1: Bitir İşi — ${modAdi}`,
      kazandin
        ? `${rakip?.ad || "Rakibimi"} ${skorSen}-${skorRakip} yendim!`
        : berabere
        ? `${rakip?.ad || "Rakibimle"} ${skorSen}-${skorRakip} berabere kaldık.`
        : `${rakip?.ad || "Rakibime"} ${skorSen}-${skorRakip} kaybettim, rövanş var!`,
      kareler,
      enIyi ? `En nadir cevabım: ${enIyi.ad}` : null,
      "Sen kaç yaparsın?",
    ].filter(Boolean);
    try { await Share.share({ message: satirlar.join("\n") }); } catch (e) {}
  }

  return (
    <View style={s.kap}>
      <Text style={[s.baslik, { color: solo ? (solo.yeniRekor ? COLORS.cta : COLORS.text) : berabere ? COLORS.text : kazandin ? COLORS.accent : COLORS.danger }]}>{baslik}</Text>

      {solo ? (
        <View style={s.soloKutu}>
          <Text style={s.soloPuan}>{solo.puan}</Text>
          <Text style={s.soloEtiket}>PUAN · rekor {Math.max(solo.rekor || 0, solo.puan)}</Text>
          {(solo.satirlar || []).map(([a, b]) => (
            <View key={a} style={s.soloSatir}>
              <Text style={s.soloSatirAd}>{a}</Text>
              <Text style={s.soloSatirDeger}>{b}</Text>
            </View>
          ))}
        </View>
      ) : (
      <View style={s.skorSatir}>
        <View style={s.taraf}>
          <View style={[s.avatar, { borderColor: COLORS.accent }]}><Ionicons name="person" size={24} color={COLORS.text} /></View>
          <Text style={s.tarafAd}>Sen</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={s.skor}>{skorSen} – {skorRakip}</Text>
          {skorEtiketi ? <Text style={s.skorEtiketi}>{skorEtiketi}</Text> : null}
        </View>
        <View style={s.taraf}>
          <View style={[s.avatar, { borderColor: rakip?.renk || COLORS.cardBorder }]}>
            {rakip?.avatar ? <Text style={s.avatarEmoji}>{rakip.avatar}</Text> : <Ionicons name="person" size={24} color={COLORS.text} />}
          </View>
          <Text style={s.tarafAd} numberOfLines={1}>{rakip?.ad || "Rakip"}</Text>
        </View>
      </View>
      )}

      {kareler ? <Text style={s.kareler}>{kareler}</Text> : null}
      {rakip?.tepki ? <Text style={s.tepki}>{rakip.ad}: “{rakip.tepki}”</Text> : null}

      {enIyi ? (
        <View style={s.enIyi}>
          <PlayerPhoto name={enIyi.ad} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={s.enIyiEtiket}>EN NADİR CEVABIN</Text>
            <Text style={s.enIyiAd} numberOfLines={1}>{enIyi.ad}</Text>
            {enIyi.alt ? <Text style={s.enIyiAlt} numberOfLines={1}>{enIyi.alt}</Text> : null}
          </View>
        </View>
      ) : null}

      {ekSatir}

      {modeId ? <MatchSummary modeId={modeId} kazanildi={kazandin} kazanilanXp={kazanilanXp} /> : null}

      <View style={s.dugmeler}>
        <SoundPressable style={s.rovans} onPress={onRovans}>
          <Ionicons name="refresh" size={18} color={COLORS.accentDark} />
          <Text style={s.rovansYazi}>{rovansEtiketi}</Text>
        </SoundPressable>
        <SoundPressable style={s.paylas} onPress={paylas} accessibilityLabel="Sonucu paylaş">
          <Ionicons name="share-social" size={18} color={COLORS.text} />
          <Text style={s.paylasYazi}>Paylaş</Text>
        </SoundPressable>
      </View>
      <SoundPressable onPress={onMenu} style={s.menu}>
        <Text style={s.menuYazi}>Menüye dön</Text>
      </SoundPressable>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { width: "100%", alignItems: "center", paddingVertical: SPACING.lg },
  baslik: { fontSize: 28, fontWeight: "900", letterSpacing: 1.5, textAlign: "center" },
  skorSatir: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch", marginTop: SPACING.lg },
  taraf: { width: 92, alignItems: "center", gap: 6 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.card },
  avatarEmoji: { fontSize: 26 },
  tarafAd: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  skor: { fontSize: 48, fontWeight: "900", color: COLORS.text },
  soloKutu: { alignItems: "center", alignSelf: "stretch", marginTop: SPACING.md },
  soloPuan: { fontSize: 64, fontWeight: "900", color: COLORS.text, lineHeight: 70 },
  soloEtiket: { fontSize: 13, fontWeight: "800", letterSpacing: 1.2, color: COLORS.textMuted },
  soloSatir: { flexDirection: "row", justifyContent: "space-between", alignSelf: "stretch", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  soloSatirAd: { fontSize: 14, fontWeight: "600", color: COLORS.textMuted },
  soloSatirDeger: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  skorEtiketi: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted, marginTop: -4 },
  kareler: { fontSize: 20, letterSpacing: 2, marginTop: SPACING.md, textAlign: "center", lineHeight: 26 },
  tepki: { fontSize: 14, fontWeight: "600", fontStyle: "italic", color: COLORS.textMuted, marginTop: SPACING.sm, textAlign: "center" },
  enIyi: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md, alignSelf: "stretch", marginTop: SPACING.lg,
    padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: "#2A1F06", borderWidth: 1, borderColor: "#5A430E",
  },
  enIyiEtiket: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, color: "#FFD98A" },
  enIyiAd: { fontSize: 16, fontWeight: "900", color: COLORS.text, marginTop: 2 },
  enIyiAlt: { fontSize: 12, fontWeight: "600", color: "#C9D4DF" },
  dugmeler: { flexDirection: "row", gap: SPACING.sm, alignSelf: "stretch", marginTop: SPACING.xl },
  rovans: { flex: 1.4, height: 54, borderRadius: 16, backgroundColor: COLORS.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  rovansYazi: { fontSize: 17, fontWeight: "900", letterSpacing: 1, color: COLORS.accentDark },
  paylas: { flex: 1, height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  paylasYazi: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  menu: { marginTop: SPACING.md, padding: SPACING.sm },
  menuYazi: { fontSize: 14, fontWeight: "700", color: COLORS.textMuted, textDecorationLine: "underline" },
});
