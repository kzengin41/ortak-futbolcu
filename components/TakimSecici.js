import React, { useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import TeamBadge from "./TeamBadge";
import { canonicalClub } from "../lib/clubAliases";
import { weightForClubs } from "../lib/clubWeights";
import { SUPER_LIG_CLUBS } from "../lib/clubTiers";
import { COLORS, RADIUS, SPACING, TYPE } from "../lib/theme";

// ============================================================================
// TUTTUĞUN TAKIM SEÇİCİ — 28 Eylül 2026
// Açılış sorusu, Ayarlar ve Eşleşme Profili penceresi aynı bileşeni kullanır.
// Arama kutusu boşken Süper Lig kulüpleri + dünya devleri; yazınca bütün
// kulüplerde arar (en tanınmışlar önce).
// ============================================================================
const DUNYA_DEVLERI = [
  "Real Madrid", "Barcelona", "Manchester United", "Liverpool", "Bayern Munich", "Juventus",
  "AC Milan", "Inter Milan", "Arsenal", "Chelsea", "Manchester City", "Paris Saint-Germain",
  "Borussia Dortmund", "Atlético Madrid", "Napoli", "Ajax",
];

function sade(s) {
  return String(s || "").replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
}

let _kulupler = null;
function kulupListesi() {
  if (_kulupler) return _kulupler;
  const say = new Map();
  try {
    const P = require("../lib/players.json");
    for (const p of P) for (const c of p.clubs) {
      const k = canonicalClub(c);
      say.set(k, (say.get(k) || 0) + 1);
    }
  } catch (e) {}
  _kulupler = [...say.entries()]
    .filter(([c]) => !/\b(II|B|U\d\d|Reserves|Youth|Primavera|Castilla|Jong)\b/.test(c))
    .map(([c, n]) => ({ ad: c, sade: sade(c), puan: weightForClubs([c]) * 1000 + n }))
    .sort((a, b) => b.puan - a.puan);
  return _kulupler;
}

export default function TakimSecici({ secili, onSec, kompakt }) {
  const [ara, setAra] = useState("");
  const liste = useMemo(() => {
    const q = sade(ara.trim());
    if (!q) {
      const tr = SUPER_LIG_CLUBS.map(canonicalClub);
      return [...new Set([...tr, ...DUNYA_DEVLERI.map(canonicalClub)])];
    }
    return kulupListesi().filter((k) => k.sade.includes(q)).slice(0, 24).map((k) => k.ad);
  }, [ara]);

  return (
    <View>
      <View style={styles.aramaKutu}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.arama}
          value={ara}
          onChangeText={setAra}
          placeholder="Takım ara (ör. Göztepe, Celtic)"
          placeholderTextColor={COLORS.textFaint}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
        />
        {ara ? (
          <SoundPressable onPress={() => setAra("")} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </SoundPressable>
        ) : null}
      </View>
      <View style={[styles.izgara, kompakt && { maxHeight: 320 }]}>
        {liste.map((ad) => {
          const aktif = secili && canonicalClub(secili) === ad;
          return (
            <SoundPressable key={ad} style={[styles.kutu, aktif && styles.kutuAktif]} onPress={() => onSec(aktif ? null : ad)}>
              <TeamBadge name={ad} size={34} />
              <Text style={[styles.ad, aktif && styles.adAktif]} numberOfLines={2}>{ad}</Text>
              {aktif ? <Ionicons name="checkmark-circle" size={16} color={COLORS.accent} style={styles.tik} /> : null}
            </SoundPressable>
          );
        })}
        {!liste.length ? <Text style={styles.bos}>Bu adla bir kulüp bulunamadı.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  aramaKutu: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, minHeight: 48, marginBottom: SPACING.md,
  },
  arama: { flex: 1, color: COLORS.text, fontSize: 15, paddingVertical: 10 },
  izgara: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, overflow: "hidden" },
  kutu: {
    width: "31%", flexGrow: 1, minHeight: 86, alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.md, padding: SPACING.sm,
  },
  kutuAktif: { borderColor: COLORS.accent },
  ad: { ...TYPE.caption, color: COLORS.text, textAlign: "center", fontWeight: "800" },
  adAktif: { color: COLORS.accent },
  tik: { position: "absolute", top: 6, right: 6 },
  bos: { ...TYPE.caption, padding: SPACING.md },
});
