import { _t } from "../lib/dil";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal } from "react-native";
import SoundPressable from "./SoundPressable";
import { Ionicons } from "@expo/vector-icons";
import MacSonuKarti from "./MacSonuKarti";
import DereceSonucu from "./DereceSonucu";
import { rovansHali, macSirasi as macSirasiBul } from "../lib/onlineRoom";
import { rakipKarti } from "../lib/derece";
import { RakipBildirBaglantisi } from "./OyuncuIslemleri";
import { COLORS, RADIUS, SPACING } from "../lib/theme";

// ============================================================================
// ONLINE MAÇ SONU — 5 Ekim 2026 (benchmark .29750 / .29772)
// Dört online ekran maç sonunda kendi düz "MAÇI KAZANDIN + RÖVANŞ" kutusunu
// çiziyordu (rövanşı da yalnız ev sahibi başlatabiliyordu). Artık hepsi
// offline modlarla aynı MacSonuKarti'nı kullanıyor; rövanş iki taraftan da
// tek dokunuş (bkz. lib/onlineRoom.js rovansIstegi).
// ============================================================================
export default function OnlineMacSonu({
  modAdi, durum, benKimim, rakipVar, gonder, onExit,
  skorSen, skorRakip, skorEtiketi, kazanan, turlar, kareSatir, enIyi, ekSatir,
  // Düello (RPC) gibi kendi rövanş mekanizması olan ekranlar hâli doğrudan verir.
  hal: halDisaridan, onRovans,
  // Paket 23 — derece: oda (odaNesnesi) + odadaki maç sırası. Rakibin takma adı
  // sunucudan okunur; dereceli maçta puan değişimi kartın altında görünür.
  oda, macNo,
}) {
  const hal = halDisaridan || rovansHali(durum, benKimim, rakipVar);
  const [rakipAd, setRakipAd] = useState(null);
  // Paket 36 — rövanş daveti ayrı bir pencerede (kartın altındaki küçük yazı
  // gözden kaçıyordu). "Şimdi değil" pencereyi kapatır; düğme yine KABUL ET kalır.
  const [davetKapali, setDavetKapali] = useState(false);
  useEffect(() => { if (!hal.rakipIstiyor) setDavetKapali(false); }, [hal.rakipIstiyor]);
  useEffect(() => {
    let canli = true;
    if (oda && oda.rakipId) rakipKarti(oda.rakipId).then((k) => { if (canli && k && k.takma_ad) setRakipAd(k.takma_ad); });
    return () => { canli = false; };
  }, [oda && oda.rakipId]);
  const sonuc = kazanan || (skorSen > skorRakip ? "sen" : skorSen < skorRakip ? "rakip" : "berabere");
  const kazananNo = sonuc === "berabere" ? 0 : sonuc === "sen" ? benKimim : benKimim === 1 ? 2 : 1;
  const macSirasi = macNo || macSirasiBul(durum);
  return (
    <MacSonuKarti
      modAdi={modAdi}
      skorSen={skorSen}
      skorRakip={skorRakip}
      skorEtiketi={skorEtiketi}
      kazanan={kazanan}
      turlar={turlar}
      kareSatir={kareSatir}
      enIyi={enIyi}
      rakip={{ ad: rakipAd || _t("Rakip"), avatar: "🌐", renk: COLORS.cta }}
      rovansEtiketi={hal.etiket}
      rovansPasif={hal.pasif}
      onRovans={onRovans || (() => gonder && gonder({ tip: "rovans" }))}
      onMenu={onExit}
      menuEtiketi={_t("Lobiye dön")}
      ekSatir={
        <>
          {oda && benKimim ? <DereceSonucu oda={oda} kazananNo={kazananNo} macNo={macSirasi} /> : null}
          {ekSatir}
          {hal.rakipIstiyor ? (
            <View style={s.istek}>
              <Ionicons name="flash" size={16} color={COLORS.cta} />
              <Text style={s.istekYazi}>{rakipAd || _t("Rakip")}{" "}{_t("seni rövanşa davet ediyor!")}</Text>
            </View>
          ) : hal.davetGonderildi || /DAVET GÖNDERİLDİ|INVITE SENT/i.test(hal.etiket || "") ? (
            <Text style={s.davetBilgi}>{_t("Rövanş daveti gönderildi — rakibin kabul etmesi bekleniyor.")}</Text>
          ) : null}
          {oda && oda.rakipId ? <RakipBildirBaglantisi oyuncuId={oda.rakipId} ad={rakipAd} baglam={`mac_sonu:${modAdi || ""}`.slice(0, 60)} /> : null}
          {hal.rakipIstiyor && !davetKapali ? (
          <Modal visible transparent animationType="fade" onRequestClose={() => setDavetKapali(true)}>
            <View style={s.perde}>
              <View style={s.davet} accessibilityViewIsModal>
                <View style={s.davetIkon}><Ionicons name="refresh" size={28} color={COLORS.accentDark} /></View>
                <Text style={s.davetUst}>{_t("RÖVANŞ DAVETİ")}</Text>
                <Text style={s.davetBaslik}>{rakipAd || _t("Rakip")}{" "}{_t("seni rövanşa davet ediyor")}</Text>
                <Text style={s.davetAlt}>{_t("Kabul edersen yeni maç hemen başlar.")}</Text>
                <SoundPressable style={s.kabul} onPress={() => { setDavetKapali(true); (onRovans || (() => gonder && gonder({ tip: "rovans" })))(); }} accessibilityLabel={_t("Rövanşı kabul et")}>
                  <Text style={s.kabulYazi}>{_t("KABUL ET")}</Text>
                </SoundPressable>
                <SoundPressable style={s.reddet} onPress={() => setDavetKapali(true)} accessibilityLabel={_t("Şimdi değil")}>
                  <Text style={s.reddetYazi}>{_t("Şimdi değil")}</Text>
                </SoundPressable>
              </View>
            </View>
          </Modal>
          ) : null}
        </>
      }
    />
  );
}

const s = StyleSheet.create({
  istek: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "stretch", justifyContent: "center",
    marginTop: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
    backgroundColor: COLORS.ctaDark, borderWidth: 1, borderColor: COLORS.cta,
  },
  istekYazi: { color: COLORS.cta, fontSize: 14, fontWeight: "900" },
  davetBilgi: { color: COLORS.textMuted, fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: SPACING.md },
  perde: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  davet: {
    width: "100%", maxWidth: 360, backgroundColor: COLORS.card, borderRadius: 24, padding: SPACING.xl,
    alignItems: "center", borderWidth: 1.5, borderColor: COLORS.accent,
  },
  davetIkon: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  davetUst: { color: COLORS.accent, fontSize: 12, fontWeight: "900", letterSpacing: 1.5, marginTop: SPACING.md },
  davetBaslik: { color: COLORS.text, fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 6 },
  davetAlt: { color: COLORS.textMuted, fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: 6 },
  kabul: { alignSelf: "stretch", backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: "center", marginTop: SPACING.lg },
  kabulYazi: { color: COLORS.accentDark, fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  reddet: { paddingVertical: SPACING.md, alignItems: "center", alignSelf: "stretch" },
  reddetYazi: { color: COLORS.textMuted, fontSize: 14, fontWeight: "800" },
});
