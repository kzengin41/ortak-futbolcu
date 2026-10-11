import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MacSonuKarti from "./MacSonuKarti";
import DereceSonucu from "./DereceSonucu";
import { rovansHali, macSirasi as macSirasiBul } from "../lib/onlineRoom";
import { rakipKarti } from "../lib/derece";
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
      rakip={{ ad: rakipAd || "Rakip", avatar: "🌐", renk: COLORS.cta }}
      rovansEtiketi={hal.etiket}
      rovansPasif={hal.pasif}
      onRovans={onRovans || (() => gonder && gonder({ tip: "rovans" }))}
      onMenu={onExit}
      menuEtiketi="Lobiye dön"
      ekSatir={
        <>
          {oda && benKimim ? <DereceSonucu oda={oda} kazananNo={kazananNo} macNo={macSirasi} /> : null}
          {ekSatir}
          {hal.rakipIstiyor ? (
            <View style={s.istek}>
              <Ionicons name="flash" size={16} color={COLORS.cta} />
              <Text style={s.istekYazi}>Rakip rövanş istiyor!</Text>
            </View>
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
});
