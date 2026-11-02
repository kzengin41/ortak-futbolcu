import { _t } from "../lib/dil";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import PlayerPhoto from "./PlayerPhoto";
import { COLORS, RADIUS } from "../lib/theme";
import { gunlukOdulAl } from "../lib/gunlukOdul";

// ============================================================================
// GÜNLÜK ÖDÜL KARTI — Paket 44. Günlük oyunun sonuç ekranına konur; oyun
// bittiğinde (hazir) ödülü bir kez alır (lib/gunlukOdul.js) ve gösterir:
// kademe madalyası, XP ve koleksiyona eklenen futbolcular.
// ============================================================================
function OyuncuSatiri({ adlar }) {
  if (!adlar || !adlar.length) return null;
  return (
    <View style={s.oyuncular}>
      {adlar.map((ad) => (
        <View key={ad} style={s.oyuncu}>
          <PlayerPhoto name={ad} size={46} />
          <Text style={s.oyuncuAd} numberOfLines={2}>{ad}</Text>
        </View>
      ))}
    </View>
  );
}

export default function GunlukOdulKarti({ oyun, oran, hazir = true }) {
  const [odul, setOdul] = useState(null);
  useEffect(() => {
    if (!hazir) return;
    let iptal = false;
    gunlukOdulAl(oyun, oran).then((o) => { if (!iptal) setOdul(o); }).catch(() => {});
    return () => { iptal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hazir, oyun]);
  if (!hazir || !odul) return null;
  const k = odul.kademe;
  return (
    <View style={s.kap} accessibilityLabel={_t("Günlük ödül: {0}, {1} XP", [k.ad, odul.xp])}>
      <View style={s.ust}>
        <Text style={s.madalya}>{k.ikon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.baslik}>{_t("GÜNLÜK ÖDÜL · {0}", [k.ad.toLocaleUpperCase("tr")])}</Text>
          <Text style={s.xp}>+{odul.xp} XP{odul.oyuncular.length ? ` · ${_t("{0} yeni futbolcu", [odul.oyuncular.length])}` : ""}</Text>
        </View>
      </View>
      {odul.oyuncular.length ? <Text style={s.alt}>{_t("Ansiklopedine eklendi:")}</Text> : <Text style={s.alt}>{_t("Bir doğru cevap bile bronz ve yeni bir futbolcu getirir.")}</Text>}
      <OyuncuSatiri adlar={odul.oyuncular} />
      {odul.hepsi ? (
        <View style={s.hepsi}>
          <Text style={s.hepsiBaslik}>{_t("🎁 Günün hepsini bitirdin! +{0} XP", [odul.hepsi.xp])}</Text>
          <OyuncuSatiri adlar={odul.hepsi.oyuncular} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { alignSelf: "stretch", marginTop: 14, padding: 12, borderRadius: RADIUS.lg, backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.cta, gap: 8 },
  ust: { flexDirection: "row", alignItems: "center", gap: 10 },
  madalya: { fontSize: 34 },
  baslik: { fontSize: 13, fontWeight: "900", letterSpacing: 1, color: COLORS.cta },
  xp: { fontSize: 16, fontWeight: "900", color: COLORS.text, marginTop: 2 },
  alt: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted },
  oyuncular: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  oyuncu: { width: 76, alignItems: "center", gap: 4 },
  oyuncuAd: { fontSize: 11, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  hepsi: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, gap: 8 },
  hepsiBaslik: { fontSize: 14, fontWeight: "900", color: COLORS.text, textAlign: "center" },
});
