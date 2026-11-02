import { _t } from "../lib/dil";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import PlayerPhoto from "./PlayerPhoto";
import { COLORS, RADIUS } from "../lib/theme";
import { gunlukOdulAl } from "../lib/gunlukOdul";
import { nadirlik, paketSirasi } from "../lib/nadirlik";
import KartPaketi from "./KartPaketi";
import SoundPressable from "./SoundPressable";
import { Ionicons } from "@expo/vector-icons";

// ============================================================================
// GÜNLÜK ÖDÜL KARTI — Paket 44. Günlük oyunun sonuç ekranına konur; oyun
// bittiğinde (hazir) ödülü bir kez alır (lib/gunlukOdul.js) ve gösterir:
// kademe madalyası, XP ve koleksiyona eklenen futbolcular.
// Paket 46 — futbolcular KART PAKETİ olarak gelir (components/KartPaketi.js):
// ödül ilk kez alındığında paket kendiliğinden açılır; kartlarda nadirlik
// (sıradan / nadir / efsane) çerçevesi var. Sonradan "Paketi tekrar aç".
// ============================================================================
function OyuncuSatiri({ adlar }) {
  if (!adlar || !adlar.length) return null;
  return (
    <View style={s.oyuncular}>
      {paketSirasi(adlar).reverse().map((ad) => (
        <View key={ad} style={s.oyuncu}>
          <View style={[s.cerceve, { borderColor: nadirlik(ad).renk }]}><PlayerPhoto name={ad} size={46} /></View>
          <Text style={s.oyuncuAd} numberOfLines={2}>{ad}</Text>
          <Text style={[s.nadirlik, { color: nadirlik(ad).renk }]}>{nadirlik(ad).ad}</Text>
        </View>
      ))}
    </View>
  );
}

export default function GunlukOdulKarti({ oyun, oran, hazir = true }) {
  const [odul, setOdul] = useState(null);
  const [paketAcik, setPaketAcik] = useState(false);
  useEffect(() => {
    if (!hazir) return;
    let iptal = false;
    gunlukOdulAl(oyun, oran).then((o) => {
      if (iptal) return;
      setOdul(o);
      // İlk kez kazanıldıysa paket kendiliğinden açılır (sonuç ekranı otursun diye kısa gecikme).
      if (o && o.yeni && [...(o.oyuncular || []), ...((o.hepsi && o.hepsi.oyuncular) || [])].length) setTimeout(() => { if (!iptal) setPaketAcik(true); }, 900);
    }).catch(() => {});
    return () => { iptal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hazir, oyun]);
  if (!hazir || !odul) return null;
  const k = odul.kademe;
  const paketteki = [...(odul.oyuncular || []), ...((odul.hepsi && odul.hepsi.oyuncular) || [])];
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
      {paketteki.length ? (
        <SoundPressable style={s.paketDugme} onPress={() => setPaketAcik(true)} accessibilityLabel={_t("Kart paketini aç")}>
          <Ionicons name="gift" size={16} color={COLORS.ctaDark} />
          <Text style={s.paketDugmeYazi}>{odul.yeni ? _t("KART PAKETİ · {0} KART", [paketteki.length]) : _t("Paketi tekrar aç")}</Text>
        </SoundPressable>
      ) : null}
      <KartPaketi
        gorunur={paketAcik}
        oyuncular={paketteki}
        baslik={odul.hepsi ? _t("{0} {1} PAKETİ + GÜNÜN HEPSİ", [k.ikon, k.ad.toLocaleUpperCase("tr")]) : _t("{0} {1} PAKETİ", [k.ikon, k.ad.toLocaleUpperCase("tr")])}
        onKapat={() => setPaketAcik(false)}
      />
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
  cerceve: { borderWidth: 2, borderRadius: 27, padding: 2 },
  nadirlik: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  paketDugme: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 42, borderRadius: 12, backgroundColor: COLORS.cta },
  paketDugmeYazi: { fontSize: 13, fontWeight: "900", letterSpacing: 1, color: COLORS.ctaDark },
  oyuncuAd: { fontSize: 11, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  hepsi: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, gap: 8 },
  hepsiBaslik: { fontSize: 14, fontWeight: "900", color: COLORS.text, textAlign: "center" },
});
