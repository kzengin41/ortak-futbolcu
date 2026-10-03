import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MacSonuKarti from "./MacSonuKarti";
import { rovansHali } from "../lib/onlineRoom";
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
}) {
  const hal = halDisaridan || rovansHali(durum, benKimim, rakipVar);
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
      rakip={{ ad: "Rakip", avatar: "🌐", renk: COLORS.cta }}
      rovansEtiketi={hal.etiket}
      rovansPasif={hal.pasif}
      onRovans={onRovans || (() => gonder && gonder({ tip: "rovans" }))}
      onMenu={onExit}
      menuEtiketi="Lobiye dön"
      ekSatir={
        <>
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
