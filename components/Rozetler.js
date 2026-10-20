import { _t } from "../lib/dil";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import ModIkon from "./ModIkon";
import { KADEMELER, yeniRozetleriAl } from "../lib/rozetler";
import { xpCarpani } from "../lib/gununModu";
import { COLORS, RADIUS, SPACING, saydam } from "../lib/theme";

// ============================================================================
// ROZET GÖRÜNÜMLERİ — Paket 34 (bkz. lib/rozetler.js)
//   <RozetMadalyonu r />   kademe renginde halka + ilerleme yayı + mod ikonu
//   <RozetIzgarasi durum /> Profilim'deki koleksiyon (3 sütun)
//   <MacSonuOdulleri />    maç sonunda: "Günün modu · 2× XP" ve yeni rozet(ler)
// ============================================================================
export function RozetMadalyonu({ r, boyut = 64 }) {
  const k = r.kademe > 0 ? KADEMELER[r.kademe - 1] : null;
  const renk = k ? k.renk : saydam(COLORS.text, 0.22);
  const yaricap = boyut / 2 - 3;
  const cevre = 2 * Math.PI * yaricap;
  return (
    <View style={{ width: boyut, height: boyut, alignItems: "center", justifyContent: "center" }}>
      <Svg width={boyut} height={boyut} style={StyleSheet.absoluteFill}>
        <Circle cx={boyut / 2} cy={boyut / 2} r={yaricap} stroke={saydam(COLORS.text, 0.1)} strokeWidth={4} fill={k ? saydam(k.renk, 0.14) : "transparent"} />
        {r.sonraki ? (
          <Circle
            cx={boyut / 2} cy={boyut / 2} r={yaricap}
            stroke={k ? k.renk : COLORS.textFaint} strokeWidth={4} fill="none" strokeLinecap="round"
            strokeDasharray={`${cevre * r.ilerleme} ${cevre}`}
            transform={`rotate(-90 ${boyut / 2} ${boyut / 2})`}
          />
        ) : (
          <Circle cx={boyut / 2} cy={boyut / 2} r={yaricap} stroke={renk} strokeWidth={4} fill="none" />
        )}
      </Svg>
      {r.ikon && r.ikon !== "hemenOyna" ? (
        <ModIkon ad={r.ikon} boyut={boyut * 0.42} renk={k ? k.renk : COLORS.textFaint} />
      ) : (
        <Ionicons name="flash" size={boyut * 0.4} color={k ? k.renk : COLORS.textFaint} />
      )}
    </View>
  );
}

export function RozetIzgarasi({ durum }) {
  return (
    <View style={s.izgara}>
      {durum.map((r) => {
        const k = r.kademe > 0 ? KADEMELER[r.kademe - 1] : null;
        return (
          <View key={r.id} style={s.hucre} accessible accessibilityLabel={`${r.ad}: ${k ? k.ad : _t("henüz yok")}, ${r.deger} ${r.birim}${r.sonraki ? _t(", sonraki kademe {0}", [r.sonraki]) : ""}`}>
            <RozetMadalyonu r={r} />
            <Text style={s.ad} numberOfLines={2}>{r.ad}</Text>
            <Text style={[s.kademe, k && { color: k.renk }]}>{k ? k.ad.toLocaleUpperCase("tr") : _t("KİLİTLİ")}</Text>
            <Text style={s.ilerleme}>{r.sonraki ? `${r.deger}/${r.sonraki}` : _t("tamamlandı")}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function MacSonuOdulleri() {
  const [yeni, setYeni] = useState([]);
  const carpan = xpCarpani();
  useEffect(() => {
    let canli = true;
    // istatistik kaydı turun sonunda yazılıyor; kısa bir bekleme ile en son hâli oku
    const t = setTimeout(() => { yeniRozetleriAl().then((y) => { if (canli) setYeni(y); }).catch(() => {}); }, 700);
    return () => { canli = false; clearTimeout(t); };
  }, []);
  if (carpan <= 1 && !yeni.length) return null;
  return (
    <View style={s.oduller}>
      {carpan > 1 ? (
        <View style={s.xp}>
          <Ionicons name="flash" size={14} color={COLORS.accentDark} />
          <Text style={s.xpYazi}>{_t("Günün modu ·")}{" "}{carpan}{_t("× XP")}</Text>
        </View>
      ) : null}
      {yeni.map((r) => {
        const k = KADEMELER[r.kademe - 1];
        return (
          <View key={r.id} style={[s.yeni, { borderColor: k.renk }]}>
            <RozetMadalyonu r={r} boyut={44} />
            <View style={{ flex: 1 }}>
              <Text style={[s.yeniUst, { color: k.renk }]}>{_t("YENİ ROZET ·")}{" "}{k.ad.toLocaleUpperCase("tr")}</Text>
              <Text style={s.yeniAd} numberOfLines={1}>{r.ad}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  izgara: { flexDirection: "row", flexWrap: "wrap", backgroundColor: COLORS.card, borderRadius: 18, borderWidth: 1, borderColor: saydam(COLORS.text, 0.06), paddingVertical: SPACING.md },
  hucre: { width: "33.33%", alignItems: "center", paddingHorizontal: 4, paddingVertical: SPACING.sm },
  ad: { color: COLORS.text, fontSize: 12, fontWeight: "800", textAlign: "center", marginTop: 6, minHeight: 30 },
  kademe: { color: COLORS.textFaint, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  ilerleme: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700", marginTop: 1 },
  oduller: { gap: SPACING.sm, marginTop: SPACING.md },
  xp: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.accent, borderRadius: RADIUS.pill, paddingVertical: 6, paddingHorizontal: 12 },
  xpYazi: { color: COLORS.accentDark, fontWeight: "900", fontSize: 13 },
  yeni: { flexDirection: "row", alignItems: "center", gap: SPACING.md, borderWidth: 1.5, borderRadius: 16, padding: SPACING.sm, backgroundColor: saydam(COLORS.text, 0.04) },
  yeniUst: { fontSize: 10.5, fontWeight: "900", letterSpacing: 1.2 },
  yeniAd: { color: COLORS.text, fontSize: 15, fontWeight: "900", marginTop: 1 },
});
