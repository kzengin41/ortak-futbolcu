import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch } from "react-native";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import BackButton from "../components/BackButton";
import { useAppSettings } from "../lib/SettingsContext";
import { LEAGUE_PRESETS } from "../lib/leaguePresets";
import {
  bildirimDesteginVarMi, hatirlatmaKuruluMu, hatirlatmayiKur, hatirlatmayiKaldir,
  HATIRLATMA_SAATI,
} from "../lib/notifications";

import { COLORS } from "../lib/theme";
const ITEMS = [
  { key: "background", label: "Arka Plan Sesi", desc: "Durmadan çalan tribün uğultusu" },
  { key: "correctWrong", label: "Doğru / Yanlış Sesi", desc: "Cevap verince çalan tepki sesi" },
  { key: "click", label: "Tıklama Sesi", desc: "Butonlara basınca çıkan kısa tık" },
  { key: "whistle", label: "Açılış Düdüğü", desc: "Uygulama açıldığında bir kez çalar" },
];

export default function SettingsScreen({ onBack }) {
  const { settings, setSetting } = useAppSettings();

  // 12 Eylül 2026 — akşam hatırlatması. Durumu ayarlardan değil İŞLETİM
  // SİSTEMİNDEN okuyoruz: kullanıcı bildirimleri sistem ayarlarından kapatmış
  // olabilir, o zaman burada "açık" göstermek yalan olurdu.
  const [bildirimAcik, setBildirimAcik] = useState(false);
  const [bildirimMesgul, setBildirimMesgul] = useState(false);
  const bildirimVar = bildirimDesteginVarMi();

  useEffect(() => {
    let iptal = false;
    if (!bildirimVar) return;
    hatirlatmaKuruluMu().then((v) => { if (!iptal) setBildirimAcik(v); }).catch(() => {});
    return () => { iptal = true; };
  }, [bildirimVar]);

  async function bildirimDegistir(deger) {
    setBildirimMesgul(true);
    try {
      const ok = deger ? await hatirlatmayiKur() : await hatirlatmayiKaldir();
      // Kurulum izin verilmediği için başarısız olduysa anahtar geri dönüyor —
      // kullanıcı açık sanıp bildirim beklemesin.
      setBildirimAcik(deger && ok);
    } finally {
      setBildirimMesgul(false);
    }
  }

  return (
    <GameBackground style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingVertical: 24 }}>
        <BackButton onPress={onBack} confirm={false} />
        <Text style={styles.title}>Ayarlar</Text>

        <Text style={styles.sectionTitle}>Varsayılan Kapsam</Text>
        <Text style={styles.sectionDesc}>
          Girdiğin oyun modlarında liste bu kapsamla başlar — istersen mod içinde değiştirebilirsin.
        </Text>
        <View style={styles.presetList}>
          {LEAGUE_PRESETS.map((p) => {
            const active = (settings.defaultLeaguePresetId || LEAGUE_PRESETS[0].id) === p.id;
            return (
              <SoundPressable
                key={p.id}
                style={[styles.presetRow, active && styles.presetRowActive]}
                onPress={() => setSetting("defaultLeaguePresetId", p.id)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
                  <Text style={styles.presetFlag}>{p.flag || "⚽"}</Text>
                  <Text style={[styles.presetLabel, active && styles.presetLabelActive]}>{p.label}</Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />}
              </SoundPressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Hatırlatma</Text>
        <Text style={styles.sectionDesc}>
          {bildirimVar
            ? `Günün bulmacasını ve görevlerini kaçırmamak için akşam ${HATIRLATMA_SAATI}:00'de tek bir hatırlatma.`
            : "Bildirim modülü bu sürümde kurulu değil."}
        </Text>
        {bildirimVar && (
          <View style={[styles.row, { marginBottom: 26 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Akşam Hatırlatması</Text>
              <Text style={styles.rowDesc}>Günde bir kez, sadece bu cihazda</Text>
            </View>
            <Switch
              value={bildirimAcik}
              disabled={bildirimMesgul}
              onValueChange={bildirimDegistir}
              trackColor={{ false: COLORS.cardBorder, true: COLORS.accent }}
              thumbColor={COLORS.text}
            />
          </View>
        )}

        <Text style={styles.sectionTitle}>Sesli Cevap</Text>
        <Text style={styles.sectionDesc}>
          Mikrofonla cevap verdiğinde anlaşılan ismi önce ekranda gösterip onayını
          ister. Kapatırsan cevap doğrudan gönderilir (eski davranış).
        </Text>
        <View style={[styles.row, { marginBottom: 26 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Göndermeden Önce Onayla</Text>
            <Text style={styles.rowDesc}>Yanlış anlaşılan cevap turu kaybettirmesin</Text>
          </View>
          <Switch
            value={settings.voiceConfirm !== false}
            onValueChange={(val) => setSetting("voiceConfirm", val)}
            trackColor={{ false: COLORS.cardBorder, true: COLORS.accent }}
            thumbColor={COLORS.text}
          />
        </View>

        <Text style={styles.sectionTitle}>Ses Ayarları</Text>
        {ITEMS.map((item) => (
          <View key={item.key} style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowPercent}>{Math.round((settings[item.key] || 0) * 100)}%</Text>
              </View>
              <Text style={styles.rowDesc}>{item.desc}</Text>
              
              <Slider
                style={{ width: '100%', height: 40, marginTop: 12 }}
                minimumValue={0}
                maximumValue={1}
                step={0.05}
                minimumTrackTintColor={COLORS.accent}
                maximumTrackTintColor={COLORS.cardBorder}
                thumbTintColor={COLORS.text}
                value={settings[item.key] || 0}
                onValueChange={(val) => setSetting(item.key, val)}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", paddingHorizontal: 20 },
  backLink: { color: COLORS.textMuted, fontSize: 13 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginBottom: 20 },
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: "900", marginBottom: 6, marginTop: 4 },
  sectionDesc: { color: COLORS.textMuted, fontSize: 12, marginBottom: 14, lineHeight: 17 },
  presetList: { marginBottom: 26, gap: 8 },
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  presetRowActive: { borderColor: COLORS.accent },
  presetFlag: { fontSize: 18 },
  presetLabel: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
  presetLabelActive: { color: COLORS.accent },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  rowLabel: { color: COLORS.text, fontWeight: "800", fontSize: 14 },
  rowPercent: { color: COLORS.accent, fontWeight: "800", fontSize: 14 },
  rowDesc: { color: COLORS.textMuted, fontSize: 12, marginTop: 3 },
});
