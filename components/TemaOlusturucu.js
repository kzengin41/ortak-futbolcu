import React, { useEffect, useMemo, useState } from "react";
import { Modal, View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import SoundPressable from "./SoundPressable";
import { COLORS, SPACING, RADIUS } from "../lib/theme";
import {
  ZEMINLER, VURGU_KUTULARI, IKINCIL_KUTULARI, VARSAYILAN_SECIM,
  paletUret, uyarilar, tondanVurgu, tondanIkincil, hexTon,
} from "../lib/temaOlusturucu";

// ============================================================================
// TEMA OLUŞTURUCU — 4 Ekim 2026
// Kerem: "temalarda kişi kendi renkler seçip tema oluşturabilsin. oluşacak
// tema önizlenebilsin."
// Üstte CANLI ÖNİZLEME (uygulamanın küçük bir kopyası — ana sayfa kartı,
// OYNA düğmesi, günlük satırı, mod kartı), altında üç seçim: zemin, ana
// vurgu, ikincil renk. Renk kutularından ya da "kendi tonun" kaydırıcısından.
// Önizleme renkleri doğrudan seçimden okunuyor (StyleSheet'teki COLORS
// değil), yani kaydırıcı oynadıkça anında değişiyor. Kaydet → tema "Özel"
// olur ve uygulama kendini yeniler (lib/temaYenile.js).
// ============================================================================
export default function TemaOlusturucu({ visible, baslangic, onKaydet, onKapat }) {
  const [secim, setSecim] = useState(VARSAYILAN_SECIM);
  useEffect(() => {
    if (visible) setSecim({ ...VARSAYILAN_SECIM, ...(baslangic || {}) });
  }, [visible]);

  const p = useMemo(() => paletUret(secim), [secim]);
  const uyari = useMemo(() => uyarilar(p), [p]);
  const sec = (alan, deger) => setSecim((s) => ({ ...s, [alan]: deger }));

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onKapat}>
      <View style={[s.kap, { backgroundColor: COLORS.bg }]}>
        <View style={s.ust}>
          <SoundPressable onPress={onKapat} hitSlop={12} accessibilityLabel="Kapat">
            <Ionicons name="close" size={26} color={COLORS.text} />
          </SoundPressable>
          <Text style={s.baslik}>Temanı oluştur</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={s.icerik} showsVerticalScrollIndicator={false}>
          {/* ---------------- CANLI ÖNİZLEME ---------------- */}
          <View style={[s.telefon, { backgroundColor: p.bg, borderColor: p.cardBorder }]}>
            <View style={s.onUst}>
              <View style={[s.halka, { borderColor: p.accent }]}>
                <Text style={[s.halkaYazi, { color: p.text }]}>7</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.onBaslik, { color: p.text }]}>Seviye 7</Text>
                <Text style={[s.onAlt, { color: p.textMuted }]}>320 / 500 XP</Text>
              </View>
              <View style={[s.hap, { backgroundColor: p.card, borderColor: p.cardBorder }]}>
                <Ionicons name="flame" size={13} color={p.cta} />
                <Text style={[s.hapYazi, { color: p.text }]}>4 gün</Text>
              </View>
            </View>

            <View style={[s.kahraman, { backgroundColor: p.card, borderColor: p.cardBorder }]}>
              <Text style={[s.kahramanUst, { color: p.accent }]}>SIRADAKİ MAÇIN HAZIR</Text>
              <Text style={[s.kahramanAd, { color: p.text }]}>G······ ✕ R···</Text>
              <Text style={[s.onAlt, { color: p.textMuted, textAlign: "center" }]}>İki kulüp, bir ortak futbolcu</Text>
              <View style={[s.oyna, { backgroundColor: p.accent }]}>
                <Ionicons name="play" size={16} color={p.accentDark} />
                <Text style={[s.oynaYazi, { color: p.accentDark }]}>OYNA</Text>
              </View>
            </View>

            <View style={[s.satir, { backgroundColor: p.card, borderColor: p.cta }]}>
              <Ionicons name="calendar" size={18} color={p.cta} />
              <View style={{ flex: 1 }}>
                <Text style={[s.satirBaslik, { color: p.text }]}>Günün Bulmacası</Text>
                <Text style={[s.onAlt, { color: p.textMuted }]}>3 deneme hakkın var</Text>
              </View>
              <View style={[s.mini, { backgroundColor: p.cta }]}>
                <Text style={[s.miniYazi, { color: p.ctaDark }]}>OYNA</Text>
              </View>
            </View>

            <View style={s.ikiKart}>
              {["Kim Bu?", "5 Kulüp"].map((ad, i) => (
                <View key={ad} style={[s.modKart, { backgroundColor: p.card, borderColor: p.cardBorder }]}>
                  <Ionicons name={i ? "grid" : "help"} size={16} color={i ? p.cta : p.accent} />
                  <Text style={[s.satirBaslik, { color: p.text }]}>{ad}</Text>
                  <Text style={[s.onAlt, { color: p.textFaint }]}>CPU'ya karşı</Text>
                </View>
              ))}
            </View>
          </View>

          {uyari.length ? (
            <View style={s.uyariKutu}>
              <Ionicons name="warning" size={16} color={COLORS.cta} />
              <Text style={s.uyariYazi}>{uyari.join(" ")}</Text>
            </View>
          ) : null}

          {/* ---------------- ZEMİN ---------------- */}
          <Text style={s.bolum}>ZEMİN</Text>
          <View style={s.izgara}>
            {ZEMINLER.map((z) => {
              const aktif = secim.zemin === z.id;
              return (
                <SoundPressable
                  key={z.id}
                  onPress={() => sec("zemin", z.id)}
                  style={[s.zemin, { backgroundColor: z.renkler.card, borderColor: aktif ? COLORS.text : z.renkler.cardBorder }, aktif && s.zeminAktif]}
                >
                  <View style={[s.zeminNokta, { backgroundColor: z.renkler.bg, borderColor: z.renkler.cardBorder }]} />
                  <Text style={[s.zeminAd, { color: z.renkler.text }]} numberOfLines={1}>{z.ad}</Text>
                </SoundPressable>
              );
            })}
          </View>

          {/* ---------------- ANA VURGU ---------------- */}
          <Text style={s.bolum}>ANA VURGU</Text>
          <Text style={s.bolumAlt}>Butonlar, aktif durumlar, ikonlar</Text>
          <RenkSecici
            kutular={VURGU_KUTULARI}
            deger={secim.accent}
            onDegis={(r) => sec("accent", r)}
            tondan={tondanVurgu}
          />

          {/* ---------------- İKİNCİL ---------------- */}
          <Text style={s.bolum}>İKİNCİL RENK</Text>
          <Text style={s.bolumAlt}>Günlük görevler, ödüller, öne çıkan satırlar</Text>
          <RenkSecici
            kutular={IKINCIL_KUTULARI}
            deger={secim.cta}
            onDegis={(r) => sec("cta", r)}
            tondan={tondanIkincil}
          />

          <SoundPressable style={s.sifirla} onPress={() => setSecim(VARSAYILAN_SECIM)}>
            <Ionicons name="refresh" size={16} color={COLORS.textMuted} />
            <Text style={s.sifirlaYazi}>Varsayılan renklere dön</Text>
          </SoundPressable>
        </ScrollView>

        <View style={[s.alt, { borderTopColor: COLORS.cardBorder }]}>
          <SoundPressable style={[s.kaydet, { backgroundColor: p.accent }]} onPress={() => onKaydet?.(secim, p)}>
            <Text style={[s.kaydetYazi, { color: p.accentDark }]}>TEMAYI UYGULA</Text>
          </SoundPressable>
          <Text style={s.not}>Uygulama kendini bir saniyede yeniler; ilerlemen korunur.</Text>
        </View>
      </View>
    </Modal>
  );
}

function RenkSecici({ kutular, deger, onDegis, tondan }) {
  const kutuda = kutular.includes(deger);
  // Kaydırıcının değeri sürüklerken GÜNCELLENMİYOR (kontrollü kaydırıcı
  // Android'de parmağın altında zıplıyor); yalnızca kutu seçilince taşınıyor.
  const [kaydiriciTon, setKaydiriciTon] = useState(hexTon(deger));
  useEffect(() => {
    if (kutuda) setKaydiriciTon(hexTon(deger));
  }, [deger, kutuda]);
  return (
    <>
      <View style={s.izgara}>
        {kutular.map((r) => (
          <SoundPressable
            key={r}
            onPress={() => onDegis(r)}
            style={[s.kutu, { backgroundColor: r }, deger === r && s.kutuAktif]}
            accessibilityLabel={`Renk ${r}`}
          >
            {deger === r ? <Ionicons name="checkmark" size={16} color={r === "#FFFFFF" ? "#000" : "#0B1620"} /> : null}
          </SoundPressable>
        ))}
      </View>
      <View style={s.tonSatir}>
        <View style={[s.tonOrnek, { backgroundColor: deger }, !kutuda && s.kutuAktif]} />
        <View style={{ flex: 1 }}>
          <Text style={s.tonEtiket}>Kendi tonun</Text>
          <Slider
            minimumValue={0}
            maximumValue={359}
            step={1}
            value={kaydiriciTon}
            onValueChange={(t) => onDegis(tondan(t))}
            minimumTrackTintColor={deger}
            maximumTrackTintColor={COLORS.cardBorder}
            thumbTintColor={deger}
          />
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, paddingTop: 44 },
  ust: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  baslik: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  icerik: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },

  telefon: { borderRadius: 24, borderWidth: 1, padding: SPACING.md, gap: SPACING.sm },
  onUst: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  halka: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  halkaYazi: { fontSize: 14, fontWeight: "900" },
  onBaslik: { fontSize: 14, fontWeight: "900" },
  onAlt: { fontSize: 12, fontWeight: "600" },
  hap: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  hapYazi: { fontSize: 12, fontWeight: "800" },
  kahraman: { borderRadius: 18, borderWidth: 1, padding: SPACING.md, alignItems: "center", gap: 6 },
  kahramanUst: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  kahramanAd: { fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  oyna: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "stretch", height: 44, borderRadius: 14, marginTop: 4 },
  oynaYazi: { fontSize: 17, fontWeight: "900", letterSpacing: 1.5 },
  satir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, borderRadius: 16, borderWidth: 1 },
  satirBaslik: { fontSize: 14, fontWeight: "900" },
  mini: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  miniYazi: { fontSize: 12, fontWeight: "900" },
  ikiKart: { flexDirection: "row", gap: SPACING.sm },
  modKart: { flex: 1, borderRadius: 16, borderWidth: 1, padding: SPACING.md, gap: 4 },

  uyariKutu: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cta },
  uyariYazi: { flex: 1, fontSize: 13, fontWeight: "600", color: COLORS.text, lineHeight: 18 },

  bolum: { marginTop: SPACING.xl, fontSize: 13, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textMuted },
  bolumAlt: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, marginTop: 2 },
  izgara: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: SPACING.sm },
  zemin: { width: "23%", flexGrow: 1, minWidth: 72, height: 58, borderRadius: 12, borderWidth: 1.5, padding: 8, justifyContent: "space-between" },
  zeminAktif: { borderWidth: 2.5 },
  zeminNokta: { width: 18, height: 18, borderRadius: 9, borderWidth: 1 },
  zeminAd: { fontSize: 12, fontWeight: "800" },
  kutu: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  kutuAktif: { borderColor: COLORS.text },
  tonSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginTop: SPACING.md },
  tonOrnek: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: "transparent" },
  tonEtiket: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted, marginLeft: 12 },
  sifirla: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 6, marginTop: SPACING.xl, padding: SPACING.sm },
  sifirlaYazi: { fontSize: 14, fontWeight: "700", color: COLORS.textMuted },

  alt: { padding: SPACING.lg, paddingBottom: SPACING.xl, borderTopWidth: 1 },
  kaydet: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  kaydetYazi: { fontSize: 17, fontWeight: "900", letterSpacing: 1.2 },
  not: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, textAlign: "center", marginTop: 8 },
});
