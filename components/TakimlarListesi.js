import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import SoundPressable from "./SoundPressable";
import TeamBadge from "./TeamBadge";
import { MACLAR, kulupGruplari, kadroGetir, tamamlanma } from "../lib/kadrolar";
import { getBulunanlar } from "../lib/kadroKoleksiyon";
import { getUnlockedPlayers } from "../lib/pokedex";
import { flagForCountry } from "../lib/countryFlags";
import { countryTr } from "../lib/countryNamesTr";
import { COLORS, RADIUS, SPACING } from "../lib/theme";

// ============================================================================
// ANSİKLOPEDİ → TAKIMLAR (4 Ekim 2026, benchmark .29833)
// "Kulüp × sezon kadroları ve efsane kadrolar = tamamlanabilir setler. Bir
// kadroyu tamamlayınca rozet." Kulübe dokun → sezonlar; sezona dokun → saha.
// Bulunan = ansiklopedide açılmış ya da oyunlarda doğru söylenmiş isim.
// ============================================================================
const GRUP_BASLIK = { turkiye: "TÜRKİYE'NİN 4 BÜYÜĞÜ", avrupa: "AVRUPA DEVLERİ" };

export async function bulunanKumesi() {
  const [b, u] = await Promise.all([getBulunanlar(), getUnlockedPlayers()]);
  return new Set([...b, ...u]);
}

export default function TakimlarListesi({ onKadro }) {
  const [bulunan, setBulunan] = useState(new Set());
  const [acikKulup, setAcikKulup] = useState(null);
  const [finallerAcik, setFinallerAcik] = useState(false);
  const gruplar = useMemo(() => kulupGruplari(), []);

  useFocusEffect(useCallback(() => {
    let iptal = false;
    bulunanKumesi().then((s) => !iptal && setBulunan(s)).catch(() => {});
    return () => { iptal = true; };
  }, []));

  const durum = useMemo(() => {
    const d = new Map();
    for (const g of gruplar) for (const id of g.sezonlar) d.set(id, tamamlanma(kadroGetir(id), bulunan));
    for (const m of MACLAR) for (const t of [0, 1]) { const id = `${m.id}#${t}`; const k = kadroGetir(id); if (k) d.set(id, tamamlanma(k, bulunan)); }
    return d;
  }, [gruplar, bulunan]);
  const tamamSayi = [...durum.values()].filter((x) => x.tamam).length;

  if (!gruplar.length && !MACLAR.length) {
    return (
      <View style={s.bos}>
        <Ionicons name="shirt-outline" size={28} color={COLORS.textMuted} />
        <Text style={s.bosYazi}>Kadro verisi henüz yüklenmedi.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      <View style={s.ozet}>
        <Ionicons name="ribbon" size={18} color={COLORS.cta} />
        <Text style={s.ozetYazi}>Tamamlanan kadro: <Text style={{ color: COLORS.accent }}>{tamamSayi}</Text> / {durum.size}</Text>
      </View>
      <Text style={s.ipucu}>Bir kadroyu açmak için oyunlarda o futbolcuları bul ya da kadronun içinden tahmin et.</Text>

      {["turkiye", "avrupa"].map((grup) => {
        const kulupler = gruplar.filter((g) => g.grup === grup);
        if (!kulupler.length) return null;
        return (
          <View key={grup} style={{ marginTop: SPACING.lg }}>
            <Text style={s.grupBaslik}>{GRUP_BASLIK[grup]}</Text>
            {kulupler.map((g) => {
              const tamam = g.sezonlar.filter((id) => durum.get(id)?.tamam).length;
              const acik = acikKulup === g.kulup;
              return (
                <View key={g.kulup} style={s.kulupKutu}>
                  <SoundPressable style={s.kulupSatir} onPress={() => setAcikKulup(acik ? null : g.kulup)} accessibilityLabel={`${g.kulup}, ${g.sezonlar.length} sezon`}>
                    <TeamBadge name={g.kulup} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.kulupAd}>{g.kulup}</Text>
                      <Text style={s.kulupAlt}>{g.sezonlar.length} sezon · {tamam} tamam</Text>
                    </View>
                    <Ionicons name={acik ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textMuted} />
                  </SoundPressable>
                  {acik ? (
                    <View style={s.sezonlar}>
                      {g.sezonlar.map((id) => {
                        const d = durum.get(id);
                        const sezon = id.split("|")[1];
                        return (
                          <SoundPressable key={id} style={[s.sezon, d?.tamam && s.sezonTamam]} onPress={() => onKadro(id)} accessibilityLabel={`${g.kulup} ${sezon}`}>
                            <Text style={[s.sezonAd, d?.tamam && { color: COLORS.accentDark }]}>{sezon}</Text>
                            <Text style={[s.sezonSayi, d?.tamam && { color: COLORS.accentDark }]}>{d?.tamam ? "🏅" : `${d?.bulunan || 0}/${d?.toplam || 0}`}</Text>
                          </SoundPressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}

      {MACLAR.length ? (
        <View style={{ marginTop: SPACING.lg }}>
          <SoundPressable style={s.grupSatir} onPress={() => setFinallerAcik((a) => !a)}>
            <Text style={s.grupBaslik}>EFSANE FİNALLER ({MACLAR.length})</Text>
            <Ionicons name={finallerAcik ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textMuted} />
          </SoundPressable>
          {finallerAcik ? [...MACLAR].sort((a, b) => (b.yil || 0) - (a.yil || 0)).map((m) => (
            <View key={m.id} style={s.macKutu}>
              <Text style={s.macBaslik}>{m.tur}{m.yil ? ` · ${m.yil}` : ""} · {m.skor}{m.penalti ? ` (pen. ${m.penalti})` : ""}</Text>
              <View style={s.macTakimlar}>
                {m.takimlar.map((t, i) => {
                  const id = `${m.id}#${i}`;
                  const d = durum.get(id);
                  return (
                    <SoundPressable key={id} style={[s.macTakim, d?.tamam && s.sezonTamam]} onPress={() => onKadro(id)}>
                      {t.tip === "ulke" ? <Text style={{ fontSize: 18 }}>{flagForCountry(t.ad)}</Text> : <TeamBadge name={t.ad} size={22} />}
                      <Text style={[s.macTakimAd, d?.tamam && { color: COLORS.accentDark }]} numberOfLines={1}>{t.tip === "ulke" ? countryTr(t.ad) || t.ad : t.ad}</Text>
                      <Text style={[s.sezonSayi, d?.tamam && { color: COLORS.accentDark }]}>{d?.tamam ? "🏅" : `${d?.bulunan || 0}/${d?.toplam || 0}`}</Text>
                    </SoundPressable>
                  );
                })}
              </View>
            </View>
          )) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  bos: { alignItems: "center", gap: 10, paddingVertical: 40 },
  bosYazi: { color: COLORS.textMuted, fontSize: 13, textAlign: "center" },
  ozet: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  ozetYazi: { color: COLORS.text, fontSize: 14, fontWeight: "900" },
  ipucu: { color: COLORS.textMuted, fontSize: 12, marginTop: 6, textAlign: "center" },
  grupSatir: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  grupBaslik: { color: COLORS.textMuted, fontSize: 12, fontWeight: "900", letterSpacing: 1.5, marginBottom: 8 },
  kulupKutu: { marginBottom: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: "hidden" },
  kulupSatir: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  kulupAd: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  kulupAlt: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  sezonlar: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 10, paddingTop: 0 },
  sezon: { width: "31.5%", paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.cardBorder },
  sezonTamam: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  sezonAd: { color: COLORS.text, fontSize: 13, fontWeight: "900" },
  sezonSayi: { color: COLORS.textMuted, fontSize: 11, fontWeight: "800", marginTop: 2 },
  macKutu: { marginBottom: 8, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  macBaslik: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800", marginBottom: 6 },
  macTakimlar: { flexDirection: "row", gap: 6 },
  macTakim: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 10, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.cardBorder },
  macTakimAd: { flex: 1, color: COLORS.text, fontSize: 13, fontWeight: "800" },
});
