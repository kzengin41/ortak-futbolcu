import { _t } from "../lib/dil";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, ScrollView, ActivityIndicator, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SoundPressable from "./SoundPressable";
import AdSecPenceresi from "./AdSecPenceresi";
import OyuncuIslemleri, { EngellenenlerPenceresi } from "./OyuncuIslemleri";
import { useDerece, ligBul, liderlik, YERLESTIRME_MAC } from "../lib/derece";
import { COLORS, RADIUS, SPACING } from "../lib/theme";

// ============================================================================
// ONLINE PUAN + LİDERLİK TABLOSU — Paket 23
// Üstte kendi kartın (lig, puan, ilerleme, G-B-M, seri, en yüksek, sıra),
// altta "Tüm zamanlar" (puana göre) / "Bu hafta" (son 7 günde kazanılan puan).
// ============================================================================
export function DereceRozeti({ kart, onPress, kucuk }) {
  const puan = kart && Number.isFinite(kart.puan) ? kart.puan : null;
  const { lig } = ligBul(puan == null ? undefined : puan);
  return (
    <SoundPressable onPress={onPress} style={[st.rozet, { borderColor: lig.renk }]} accessibilityLabel={_t("Online puan {0}, {1}. Liderlik tablosu", [puan ?? "yükleniyor", lig.ad])}>
      <Ionicons name={lig.ikon} size={kucuk ? 14 : 16} color={lig.renk} />
      <Text style={[st.rozetYazi, { color: lig.renk }]} numberOfLines={1}>{puan ?? "—"}</Text>
      {!kucuk ? <Text style={st.rozetLig} numberOfLines={1}>{lig.ad}</Text> : null}
    </SoundPressable>
  );
}

export default function LiderlikPenceresi({ visible, onKapat }) {
  const { kart, tazele } = useDerece({ otomatik: false });
  const [tur, setTur] = useState("tum");
  const [satirlar, setSatirlar] = useState(null);
  const [hata, setHata] = useState(false);
  const [adPenceresi, setAdPenceresi] = useState(false);
  // Paket 38 — satıra dokununca bildir/engelle; altta "Engellediklerin".
  const [secili, setSecili] = useState(null);
  const [engelListesi, setEngelListesi] = useState(false);
  const [yenile, setYenile] = useState(0);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets() || { top: 0, bottom: 0 };

  useEffect(() => {
    if (!visible) return;
    let canli = true;
    setSatirlar(null);
    setHata(false);
    tazele();
    liderlik(tur, 50).then((r) => { if (canli) { setSatirlar(r.satirlar); setHata(r.hata); } });
    return () => { canli = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tur, yenile]);

  const puan = kart && Number.isFinite(kart.puan) ? kart.puan : 1000;
  const { lig, sonraki, kalan, ilerleme } = ligBul(puan);
  const yerlesme = kart ? Math.min(kart.mac || 0, YERLESTIRME_MAC) : 0;

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onKapat}>
      <View style={[st.arka, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={[st.kap, { maxHeight: height - insets.top - insets.bottom - 24 }]}>
          <View style={st.ust}>
            <Text style={st.baslik}>{_t("Online Puan")}</Text>
            <SoundPressable onPress={onKapat} hitSlop={14} accessibilityLabel={_t("Kapat")}><Ionicons name="close" size={24} color={COLORS.textMuted} /></SoundPressable>
          </View>

          <View style={[st.benimKart, { borderColor: lig.renk }]}>
            <View style={st.benimUst}>
              <View style={[st.ligIkon, { backgroundColor: lig.renk }]}><Ionicons name={lig.ikon} size={26} color={COLORS.bg} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.benimAd} numberOfLines={1}>{(kart && kart.takma_ad) || _t("Takma ad yok")}</Text>
                <Text style={[st.benimLig, { color: lig.renk }]}>{lig.ad}{kart && kart.sira ? _t(" · {0}. sırada", [kart.sira]) : ""}</Text>
              </View>
              <Text style={st.benimPuan}>{puan}</Text>
            </View>
            <View style={st.cubuk}><View style={[st.dolu, { width: `${Math.round(ilerleme * 100)}%`, backgroundColor: lig.renk }]} /></View>
            <Text style={st.ilerlemeYazi}>
              {kart && kart.mac < YERLESTIRME_MAC ? _t("Yerleştirme maçları {0}/{1} · ", [yerlesme, YERLESTIRME_MAC]) : ""}
              {sonraki ? _t("{0} {1} puan", [sonraki.yonelme, kalan]) : _t("En üst ligdesin")}
            </Text>
            <View style={st.istatSatir}>
              <Istat etiket={_t("Maç")} deger={kart ? kart.mac : 0} />
              <Istat etiket={_t("G-B-M")} deger={kart ? `${kart.galibiyet}-${kart.beraberlik}-${kart.maglubiyet}` : "0-0-0"} />
              <Istat etiket={_t("Seri")} deger={kart && kart.seri ? (kart.seri > 0 ? `${kart.seri}G` : `${-kart.seri}M`) : "—"} />
              <Istat etiket={_t("En yüksek")} deger={kart ? kart.en_yuksek : 1000} />
            </View>
            <SoundPressable onPress={() => setAdPenceresi(true)} style={st.adDugme} accessibilityLabel={_t("Takma adı değiştir")}>
              <Ionicons name="create-outline" size={14} color={COLORS.textMuted} />
              <Text style={st.adDugmeYazi}>{kart && kart.takma_ad ? _t("Takma adı değiştir") : _t("Takma ad seç")}</Text>
            </SoundPressable>
          </View>

          <View style={st.sekmeler}>
            {[["tum", _t("Tüm zamanlar")], ["hafta", _t("Bu hafta")]].map(([id, ad]) => (
              <SoundPressable key={id} onPress={() => setTur(id)} style={[st.sekme, tur === id && st.sekmeAktif]} accessibilityLabel={ad}>
                <Text style={[st.sekmeYazi, tur === id && { color: COLORS.accentDark }]}>{ad}</Text>
              </SoundPressable>
            ))}
          </View>

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: SPACING.md }} nestedScrollEnabled>
            {satirlar === null ? <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.lg }} /> : null}
            {satirlar && !satirlar.length ? (
              <Text style={st.bos}>{hata ? _t("Liste yüklenemedi; internetini kontrol et.") : tur === "hafta" ? _t("Bu hafta henüz dereceli maç oynanmadı.") : _t("Henüz dereceli maç oynanmadı. İlk sen ol!")}</Text>
            ) : null}
            {(satirlar || []).map((x) => {
              const l = ligBul(x.puan).lig;
              const dokunulur = !!x.oyuncu && !x.ben;
              const Kap = dokunulur ? SoundPressable : View;
              return (
                <Kap
                  key={`${x.sira}-${x.oyuncu || x.takma_ad}`}
                  style={[st.satir, x.ben && st.satirBen]}
                  {...(dokunulur ? { onPress: () => setSecili({ id: x.oyuncu, ad: x.takma_ad, engelli: !!x.engelli }), accessibilityLabel: _t("{0}: bildir ya da engelle", [x.takma_ad]) } : {})}
                >
                  <Text style={[st.sira, x.sira <= 3 && { color: COLORS.cta }]}>{x.sira}</Text>
                  <Ionicons name={l.ikon} size={16} color={l.renk} />
                  <Text style={[st.ad, x.ben && { color: COLORS.accent }, x.engelli && { color: COLORS.textFaint }]} numberOfLines={1}>{x.takma_ad === "Oyuncu" || x.takma_ad === "Engellenen oyuncu" ? _t(x.takma_ad) : x.takma_ad}{x.ben ? _t(" (sen)") : ""}</Text>
                  <Text style={st.deger}>{tur === "hafta" ? `${x.deger > 0 ? "+" : ""}${x.deger}` : x.puan}</Text>
                  {dokunulur ? <Ionicons name="ellipsis-vertical" size={14} color={COLORS.textFaint} /> : null}
                </Kap>
              );
            })}
          </ScrollView>
          <SoundPressable onPress={() => setEngelListesi(true)} style={st.engelBaglanti} accessibilityLabel={_t("Engellediklerin")}>
            <Ionicons name="ban-outline" size={14} color={COLORS.textFaint} />
            <Text style={st.engelBaglantiYazi}>{_t("Engellediklerin")}</Text>
          </SoundPressable>
        </View>
      </View>
      <OyuncuIslemleri
        visible={!!secili}
        oyuncu={secili}
        engelli={!!(secili && secili.engelli)}
        baglam={`liderlik:${tur}`}
        onKapat={() => setSecili(null)}
        onDegisti={() => setYenile((n) => n + 1)}
      />
      <EngellenenlerPenceresi visible={engelListesi} onKapat={() => { setEngelListesi(false); setYenile((n) => n + 1); }} />
      <AdSecPenceresi
        visible={adPenceresi}
        oneri={kart && kart.takma_ad}
        baslik={kart && kart.takma_ad ? _t("Takma adını değiştir") : _t("Takma adını seç")}
        onKaydet={() => setAdPenceresi(false)}
        onKapat={() => setAdPenceresi(false)}
      />
    </Modal>
  );
}

function Istat({ etiket, deger }) {
  return (
    <View style={st.istat}>
      <Text style={st.istatDeger}>{deger}</Text>
      <Text style={st.istatEtiket}>{etiket}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  engelBaglanti: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: SPACING.sm },
  engelBaglantiYazi: { color: COLORS.textFaint, fontSize: 13, fontWeight: "700" },
  rozet: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: RADIUS.pill, paddingVertical: 9, paddingHorizontal: SPACING.md, backgroundColor: COLORS.card, borderWidth: 1.5 },
  rozetYazi: { fontSize: 15, fontWeight: "900" },
  rozetLig: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800" },
  arka: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end", paddingHorizontal: SPACING.md },
  kap: { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.cardBorder, padding: SPACING.lg },
  ust: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.md },
  baslik: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  benimKart: { borderWidth: 1.5, borderRadius: RADIUS.lg, padding: SPACING.md, backgroundColor: COLORS.bg, gap: 8 },
  benimUst: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  ligIkon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  benimAd: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
  benimLig: { fontSize: 13, fontWeight: "900", marginTop: 2 },
  benimPuan: { color: COLORS.text, fontSize: 30, fontWeight: "900" },
  cubuk: { height: 6, borderRadius: 3, backgroundColor: COLORS.card, overflow: "hidden" },
  dolu: { height: 6, borderRadius: 3 },
  ilerlemeYazi: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  istatSatir: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  istat: { alignItems: "center", flex: 1 },
  istatDeger: { color: COLORS.text, fontSize: 15, fontWeight: "900" },
  istatEtiket: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700", marginTop: 1 },
  adDugme: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "center", paddingVertical: 4 },
  adDugmeYazi: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800" },
  sekmeler: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md, marginBottom: SPACING.sm },
  sekme: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.cardBorder },
  sekmeAktif: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  sekmeYazi: { color: COLORS.text, fontWeight: "900", fontSize: 13 },
  bos: { color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.lg, fontSize: 13 },
  satir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: 10, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md },
  satirBen: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.accent },
  sira: { width: 28, color: COLORS.textMuted, fontWeight: "900", fontSize: 14, textAlign: "center" },
  ad: { flex: 1, color: COLORS.text, fontWeight: "800", fontSize: 14 },
  deger: { color: COLORS.text, fontWeight: "900", fontSize: 15, fontVariant: ["tabular-nums"] },
});
