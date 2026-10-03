import React from "react";
import { View, Text, TextInput, StyleSheet, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import { KurulumBolum } from "./ModKurulum";
import { useAppSettings } from "../lib/SettingsContext";
import { COLORS, RADIUS, SPACING } from "../lib/theme";

// ============================================================================
// OYUNCU ADLARI + İSİMLİ SKOR TABLOSU — 4 Ekim 2026
// Benchmark kararları: ".28709 sunucu modu (2–6 oyuncu, isimli)" ve ".28810
// maç sonu isimli skor tablosu + rövanş". Adlar bir kez girilir, Ayarlar'da
// (settings.oyuncuAdlari) saklanır; aynı telefonda oynanan bütün modlar
// (Tek telefon Ortak Kulüp, 5 Kulüp 2 kişi, XOX 2 kişi, Sunucu modu) kullanır.
// ============================================================================
export const EN_FAZLA_OYUNCU = 6;
export const varsayilanAd = (i) => `Oyuncu ${i + 1}`;

export function useOyuncuAdlari(adet = 2) {
  const { settings, setSetting } = useAppSettings();
  const kayitli = Array.isArray(settings.oyuncuAdlari) ? settings.oyuncuAdlari : [];
  const adlar = Array.from({ length: adet }, (_, i) => (kayitli[i] || "").trim() || varsayilanAd(i));
  function adDegistir(i, ad) {
    const yeni = [...kayitli];
    while (yeni.length <= i) yeni.push("");
    yeni[i] = String(ad || "").slice(0, 16);
    setSetting("oyuncuAdlari", yeni);
  }
  // Ham (boş olabilir) değerler — TextInput'lar için.
  const ham = Array.from({ length: Math.max(adet, kayitli.length) }, (_, i) => kayitli[i] || "");
  return { adlar, ham, adDegistir };
}

// 2 kişilik modların kurulumuna eklenen bölüm.
export function OyuncuAdlariBolumu({ adet = 2, vurgu }) {
  const { ham, adDegistir } = useOyuncuAdlari(adet);
  return (
    <KurulumBolum baslik="OYUNCU ADLARI" vurgu={vurgu} not="Skor tablosunda ve sıra yazılarında bu adlar görünür.">
      <View style={{ gap: 8 }}>
        {Array.from({ length: adet }, (_, i) => (
          <View key={i} style={s.adSatir}>
            <Text style={s.adNo}>{i + 1}</Text>
            <TextInput
              style={s.adGirdi}
              value={ham[i] || ""}
              onChangeText={(t) => adDegistir(i, t)}
              placeholder={varsayilanAd(i)}
              placeholderTextColor={COLORS.textFaint}
              maxLength={16}
              autoCorrect={false}
              autoCapitalize="words"
              accessibilityLabel={`${i + 1}. oyuncunun adı`}
            />
          </View>
        ))}
      </View>
    </KurulumBolum>
  );
}

// Maç sonu: isimli skor tablosu + RÖVANŞ (aynı oyuncular, skorlar sıfır).
// oyuncular: [{ ad, puan }]; birden fazla lider varsa berabere.
// kazanan (isteğe bağlı): oyuncu indeksi ya da "berabere" — skordan çıkmayan
// sonuçlar için (XOX'ta üçlü sıra yapan, kare sayısı az olsa da kazanır).
export function IsimliSkorTablosu({ modAdi, oyuncular, skorEtiketi = "puan", onRovans, onMenu, rovansEtiketi = "RÖVANŞ", altYazi, kazanan }) {
  const zorunlu = typeof kazanan === "number" ? kazanan : null;
  const sirali = [...oyuncular].map((o, i) => ({ ...o, i }))
    .sort((a, b) => (b.i === zorunlu) - (a.i === zorunlu) || b.puan - a.puan || a.i - b.i);
  const enYuksek = sirali.length ? sirali[0].puan : 0;
  const berabere = kazanan === "berabere" || (zorunlu === null && sirali.filter((o) => o.puan === enYuksek).length > 1);
  const liderMi = (o) => (zorunlu !== null ? o.i === zorunlu : o.puan === enYuksek);
  const baslik = berabere ? "BERABERE" : `${sirali[0].ad.toLocaleUpperCase("tr")} KAZANDI!`;

  async function paylas() {
    const satirlar = [
      `⚽ 3-2-1: Bitir İşi — ${modAdi}`,
      ...sirali.map((o, n) => `${n === 0 && !berabere ? "🏆" : `${n + 1}.`} ${o.ad}: ${o.puan} ${skorEtiketi}`),
      "Sen de gel, rövanş var!",
    ];
    try { await Share.share({ message: satirlar.join("\n") }); } catch (e) {}
  }

  return (
    <View style={s.kap}>
      <Ionicons name="trophy" size={44} color={COLORS.cta} />
      <Text style={s.baslik}>{baslik}</Text>
      {altYazi ? <Text style={s.altYazi}>{altYazi}</Text> : null}
      <View style={s.tablo}>
        {sirali.map((o, n) => {
          const lider = liderMi(o);
          return (
            <View key={o.i} style={[s.satir, lider && s.satirLider]}>
              <Text style={[s.sira, lider && { color: COLORS.accentDark }]}>{n + 1}</Text>
              {lider ? <Ionicons name="star" size={16} color={COLORS.accentDark} /> : null}
              <Text style={[s.ad, lider && { color: COLORS.accentDark }]} numberOfLines={1}>{o.ad}</Text>
              <Text style={[s.puan, lider && { color: COLORS.accentDark }]}>{o.puan}</Text>
              <Text style={[s.etiket, lider && { color: COLORS.accentDark }]}>{skorEtiketi}</Text>
            </View>
          );
        })}
      </View>
      <SoundPressable style={s.rovans} onPress={onRovans} accessibilityLabel={rovansEtiketi}>
        <Ionicons name="refresh" size={20} color={COLORS.accentDark} />
        <Text style={s.rovansYazi}>{rovansEtiketi}</Text>
      </SoundPressable>
      <View style={s.altSatir}>
        <SoundPressable style={s.ikincil} onPress={paylas}>
          <Ionicons name="share-social" size={18} color={COLORS.text} />
          <Text style={s.ikincilYazi}>Paylaş</Text>
        </SoundPressable>
        <SoundPressable style={s.ikincil} onPress={onMenu}>
          <Ionicons name="home" size={18} color={COLORS.text} />
          <Text style={s.ikincilYazi}>Menü</Text>
        </SoundPressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  adSatir: { flexDirection: "row", alignItems: "center", gap: 10 },
  adNo: { width: 22, fontSize: 15, fontWeight: "900", color: COLORS.textMuted, textAlign: "center" },
  adGirdi: { flex: 1, height: 46, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card, color: COLORS.text, fontSize: 16, fontWeight: "700", paddingHorizontal: 12 },

  kap: { alignItems: "center", paddingVertical: SPACING.lg, width: "100%" },
  baslik: { fontSize: 26, fontWeight: "900", color: COLORS.text, textAlign: "center", marginTop: 8 },
  altYazi: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted, textAlign: "center", marginTop: 4 },
  tablo: { alignSelf: "stretch", gap: 6, marginTop: SPACING.lg },
  satir: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  satirLider: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  sira: { width: 20, fontSize: 15, fontWeight: "900", color: COLORS.textMuted },
  ad: { flex: 1, fontSize: 17, fontWeight: "900", color: COLORS.text },
  puan: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  etiket: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted, width: 34 },
  rovans: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", alignSelf: "stretch", height: 56, borderRadius: 16, backgroundColor: COLORS.accent, marginTop: SPACING.lg },
  rovansYazi: { fontSize: 18, fontWeight: "900", letterSpacing: 1, color: COLORS.accentDark },
  altSatir: { flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 10 },
  ikincil: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", height: 48, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  ikincilYazi: { fontSize: 15, fontWeight: "800", color: COLORS.text },
});
