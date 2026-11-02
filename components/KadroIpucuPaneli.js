import { _t } from "../lib/dil";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import { COLORS, RADIUS } from "../lib/theme";
import { HAT_ETIKET } from "../lib/kadrolar";
import { flagForCountry } from "../lib/countryFlags";
import { countryTr } from "../lib/countryNamesTr";
import { ipucuVerisi, maskele, acikHarf, harfSirasi, tamamenAcikMi } from "../lib/kadroIpucu";

// ============================================================================
// KADRO İPUCU PANELİ — Paket 44 (2 Kasım 2026)
// Sahada kapalı bir oyuncuya dokununca açılır: "#1 KL — bu oyuncu kim?",
// adın harf maskesi ve ipucu düğmeleri (Uyruk · Yaş · Boy · Baş harfler ·
// Harf al). Ödül potu yok, ipuçları sınırsız; yalnız sonuçta/paylaşımda
// kaç ipucu alındığı yazar. Kurallar lib/kadroIpucu.js.
// ============================================================================
const HAT_AD = { GK: "Kaleci", DF: "Defans", MF: "Orta saha", FW: "Forvet" };

export function MaskeliAd({ ad, acikSayisi, boyut = 20 }) {
  const parcalar = maskele(ad, acikSayisi);
  return (
    <View style={s.maske} accessibilityLabel={_t("Ad: {0} harf açık", [acikSayisi])}>
      {parcalar.map((p, i) => (
        p.ch === " " ? <View key={i} style={{ width: boyut * 0.55 }} /> :
        p.harf ? (
          <View key={i} style={[s.kutu, { width: boyut * 0.82, height: boyut * 1.3 }, p.acik && s.kutuAcik]}>
            <Text style={[s.kutuYazi, { fontSize: boyut * 0.78 }]}>{p.acik ? p.ch.toLocaleUpperCase("tr") : ""}</Text>
          </View>
        ) : (
          <Text key={i} style={[s.kutuYazi, { fontSize: boyut * 0.78, color: COLORS.textMuted }]}>{p.ch}</Text>
        )
      ))}
    </View>
  );
}

function IpucuDugmesi({ ikon, etiket, deger, acik, pasif, onPress }) {
  if (acik) {
    return (
      <View style={[s.dugme, s.dugmeAcik]}>
        <Text style={s.dugmeEtiket}>{etiket}</Text>
        <Text style={s.dugmeDeger} numberOfLines={1}>{deger}</Text>
      </View>
    );
  }
  return (
    <SoundPressable style={[s.dugme, pasif && { opacity: 0.4 }]} onPress={onPress} disabled={pasif} accessibilityLabel={_t("İpucu: {0}", [etiket])}>
      <Ionicons name={ikon} size={16} color={COLORS.cta} />
      <Text style={s.dugmeEtiket}>{etiket}</Text>
      {pasif ? <Text style={s.dugmeYok}>{_t("veri yok")}</Text> : null}
    </SoundPressable>
  );
}

// o: kadro oyuncusu { a, p, n }; mac: { tarih, yil } (yaş için); durum: { k, h }
export default function KadroIpucuPaneli({ o, mac, durum, onIpucu, onHarf, onKapat }) {
  if (!o) return null;
  const veri = ipucuVerisi(o.a, mac);
  const acik = new Set((durum && durum.k) || []);
  const harfAcik = acikHarf(o.a, durum);
  const toplamHarf = harfSirasi(o.a).harfSayisi;
  const bitti = tamamenAcikMi(o.a, durum);
  const yasMetni = veri.yas ? (veri.yas.yaklasik ? `~${veri.yas.yas}` : String(veri.yas.yas)) : "";
  const milliMetni = veri.milli ? `${flagForCountry(veri.milli) || ""} ${countryTr(veri.milli) || veri.milli}`.trim() : "";
  const boyMetni = veri.boy ? `${(veri.boy / 100).toFixed(2).replace(".", ",")} m` : "";

  return (
    <View style={s.kap}>
      <View style={s.ust}>
        <View style={s.no}><Text style={s.noYazi}>{o.n != null ? o.n : "?"}</Text></View>
        <Text style={s.baslik} numberOfLines={1}>{_t(HAT_AD[o.p] || HAT_ETIKET[o.p] || o.p)}{" "}{_t("— bu oyuncu kim?")}</Text>
        <SoundPressable onPress={onKapat} hitSlop={10} accessibilityLabel={_t("Seçimi kaldır")}>
          <Ionicons name="close-circle" size={22} color={COLORS.textMuted} />
        </SoundPressable>
      </View>

      <MaskeliAd ad={o.a} acikSayisi={harfAcik} />

      <View style={s.dugmeler}>
        <IpucuDugmesi ikon="flag-outline" etiket={_t("Uyruk")} deger={milliMetni} acik={acik.has("milli")} pasif={!veri.milli} onPress={() => onIpucu("milli")} />
        <IpucuDugmesi ikon="hourglass-outline" etiket={_t("Maçtaki yaşı")} deger={yasMetni} acik={acik.has("yas")} pasif={!veri.yas} onPress={() => onIpucu("yas")} />
        <IpucuDugmesi ikon="resize-outline" etiket={_t("Boy")} deger={boyMetni} acik={acik.has("boy")} pasif={!veri.boy} onPress={() => onIpucu("boy")} />
        <IpucuDugmesi ikon="text-outline" etiket={_t("Baş harfler")} deger={_t("açıldı")} acik={acik.has("bas")} onPress={() => onIpucu("bas")} />
      </View>

      <SoundPressable style={[s.harfAl, bitti && { opacity: 0.45 }]} onPress={onHarf} disabled={bitti} accessibilityLabel={_t("Bir harf al")}>
        <Ionicons name="add-circle" size={18} color={COLORS.ctaDark} />
        <Text style={s.harfAlYazi}>{bitti ? _t("Bütün harfler açık") : _t("HARF AL")}</Text>
        <Text style={s.harfAlSayi}>{harfAcik}/{toplamHarf}</Text>
      </SoundPressable>
      <Text style={s.not}>{_t("İpuçları sınırsız — sonuçta kaç ipucu aldığın yazar.")}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.cta, gap: 10 },
  ust: { flexDirection: "row", alignItems: "center", gap: 10 },
  no: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.cta },
  noYazi: { fontSize: 13, fontWeight: "900", color: COLORS.ctaDark },
  baslik: { flex: 1, fontSize: 14, fontWeight: "800", color: COLORS.text },
  maske: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 3, rowGap: 6 },
  kutu: { borderRadius: 5, borderBottomWidth: 2, borderColor: COLORS.textFaint, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  kutuAcik: { borderColor: COLORS.cta },
  kutuYazi: { fontWeight: "900", color: COLORS.text },
  dugmeler: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dugme: { flexGrow: 1, flexBasis: "46%", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.bg },
  dugmeAcik: { borderColor: COLORS.cta, backgroundColor: "rgba(245,204,88,0.10)", justifyContent: "space-between" },
  dugmeEtiket: { fontSize: 12, fontWeight: "800", color: COLORS.textMuted },
  dugmeDeger: { flexShrink: 1, fontSize: 13, fontWeight: "900", color: COLORS.text },
  dugmeYok: { fontSize: 11, fontWeight: "600", color: COLORS.textFaint },
  harfAl: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 44, borderRadius: 12, backgroundColor: COLORS.cta },
  harfAlYazi: { fontSize: 14, fontWeight: "900", letterSpacing: 1, color: COLORS.ctaDark },
  harfAlSayi: { fontSize: 12, fontWeight: "800", color: COLORS.ctaDark, opacity: 0.7 },
  not: { fontSize: 11, fontWeight: "600", color: COLORS.textFaint, textAlign: "center" },
});
