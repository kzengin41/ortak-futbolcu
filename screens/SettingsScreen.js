import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch } from "react-native";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import BackButton from "../components/BackButton";
import ModVarsayilanlariPaneli from "../components/ModVarsayilanlariPaneli";
import { useAppSettings } from "../lib/SettingsContext";
import { LEAGUE_PRESETS } from "../lib/leaguePresets";
import {
  bildirimDesteginVarMi, hatirlatmaKuruluMu, hatirlatmayiKur, hatirlatmayiKaldir,
  HATIRLATMA_SAATI, expoGodaMiyiz,
} from "../lib/notifications";

import { COLORS, PALETLER, OZEL_VURGULAR, OZEL_IKINCILLER } from "../lib/theme";
import { uygulamayiYenile } from "../lib/temaYenile";
const ITEMS = [
  { key: "background", label: "Arka Plan Sesi", desc: "Durmadan çalan tribün uğultusu" },
  { key: "correctWrong", label: "Doğru / Yanlış Sesi", desc: "Cevap verince çalan tepki sesi" },
  { key: "click", label: "Tıklama Sesi", desc: "Butonlara basınca çıkan kısa tık" },
  { key: "whistle", label: "Açılış Düdüğü", desc: "Uygulama açıldığında bir kez çalar" },
];

export default function SettingsScreen({ onBack }) {
  const { settings, setSetting } = useAppSettings();

  // 26 Eylül 2026 — tema seçilince uygulamayı kendisi yeniden yüklüyor,
  // kullanıcıdan "kapat aç" beklemiyoruz. Yazma BİTMEDEN yeniden yüklemek
  // seçimi kaybettireceği için `await setSetting(...)` şart (bkz.
  // lib/SettingsContext.js ve lib/temaYenile.js).
  const [temaYenileniyor, setTemaYenileniyor] = useState(false);

  async function temaSec(id) {
    if (temaYenileniyor) return;
    setTemaYenileniyor(true);
    try {
      await setSetting("themeId", id);
      const oldu = await uygulamayiYenile();
      // oldu === false: expo-updates yok (ya da Expo Go) — ayar kaydedildi,
      // bir sonraki açılışta görünecek. Aşağıdaki not bunu söylüyor.
      if (!oldu) setTemaYenileniyor(false);
      // oldu === true ise uygulama zaten yeniden yükleniyor, state'i bırakıyoruz.
    } catch (e) {
      setTemaYenileniyor(false);
    }
  }

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

        <Text style={styles.sectionTitle}>Mod Varsayılanları</Text>
        <Text style={styles.sectionDesc}>
          Her modun zorluğu (10 üzerinden), süresi ve diğer ayarları. Mod açılınca bunlar hazır gelir; oynamadan önce istersen değiştirirsin.
        </Text>
        <ModVarsayilanlariPaneli />

        <Text style={styles.sectionTitle}>Hatırlatma</Text>
        <Text style={styles.sectionDesc}>
          {bildirimVar
            ? `Günün bulmacasını ve görevlerini kaçırmamak için akşam ${HATIRLATMA_SAATI}:00'de tek bir hatırlatma.`
            : expoGodaMiyiz()
              ? "Bildirimler Expo Go'da denenemiyor. Uygulamanın derlenmiş sürümünde (APK) çalışır."
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

        <Text style={styles.sectionTitle}>Tema</Text>
        <Text style={styles.sectionDesc}>
          Tema seçtiğinde uygulama kendini bir saniyede yeniler ve yeni renklerle
          açılır. Oyun ilerlemen, istatistiklerin ve ayarların korunur.
        </Text>

        <View style={styles.temaIzgara}>
          {PALETLER.map((p) => {
            const secili = (settings.themeId || "cim") === p.id;
            return (
              <SoundPressable
                key={p.id}
                onPress={() => temaSec(p.id)}
                style={[styles.temaKart, secili && styles.temaKartAktif]}
              >
                {/* Örnek renkler paletin KENDİ değerlerinden geliyor, aktif
                    temadan değil — böylece her kart gerçek rengini gösteriyor. */}
                <View style={styles.temaSeritler}>
                  {/* 26 Eylül 2026 — eşit üç şerit ÖNİZLEMENİN KENDİSİNİ bayrak
                      gibi gösteriyordu (GS = Belçika, FB = Ukrayna). Artık ilk
                      renk (zemin) geniş, vurgular dar: bayrak değil, gerçek
                      arayüzdeki oran — geniş bir yüzey üstünde iki vurgu. */}
                  {p.onizleme.map((renk, i) => (
                    <View key={i} style={[styles.temaSerit, { backgroundColor: renk, flex: i === 0 ? 3 : 1 }]} />
                  ))}
                </View>
                <Text style={[styles.temaAd, secili && styles.temaAdAktif]} numberOfLines={1}>{p.ad}</Text>
                <Text style={styles.temaAciklama} numberOfLines={2}>{p.aciklama}</Text>
                {secili ? (
                  <View style={styles.temaTik}>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                  </View>
                ) : null}
              </SoundPressable>
            );
          })}
        </View>

        {(settings.themeId === "ozel") && (
          <View style={styles.ozelKap}>
            <Text style={styles.rowLabel}>Ana vurgu rengi</Text>
            <Text style={styles.rowDesc}>Butonlar, aktif durumlar, ikonlar</Text>
            <View style={styles.renkIzgara}>
              {OZEL_VURGULAR.map((r) => (
                <SoundPressable
                  key={r.renk}
                  onPress={() => {
                    setSetting("customAccent", r.renk);
                    setSetting("customAccentDark", r.koyu);
                  }}
                  style={[
                    styles.renkKutu,
                    { backgroundColor: r.renk },
                    settings.customAccent === r.renk && styles.renkKutuAktif,
                  ]}
                >
                  {settings.customAccent === r.renk ? (
                    <Ionicons name="checkmark" size={16} color={r.koyu} />
                  ) : null}
                </SoundPressable>
              ))}
            </View>

            <Text style={[styles.rowLabel, { marginTop: 16 }]}>İkincil renk</Text>
            <Text style={styles.rowDesc}>Öne çıkan butonlar, kupa/ödül vurguları</Text>
            <View style={styles.renkIzgara}>
              {OZEL_IKINCILLER.map((r) => (
                <SoundPressable
                  key={r.renk}
                  onPress={() => {
                    setSetting("customCta", r.renk);
                    setSetting("customCtaDark", r.koyu);
                  }}
                  style={[
                    styles.renkKutu,
                    { backgroundColor: r.renk },
                    settings.customCta === r.renk && styles.renkKutuAktif,
                  ]}
                >
                  {settings.customCta === r.renk ? (
                    <Ionicons name="checkmark" size={16} color={r.koyu} />
                  ) : null}
                </SoundPressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.temaNot}>
          <Ionicons
            name={temaYenileniyor ? "sync-outline" : "information-circle-outline"}
            size={16}
            color={temaYenileniyor ? COLORS.accent : COLORS.textMuted}
          />
          <Text style={styles.temaNotYazi}>
            {temaYenileniyor
              ? "Tema uygulanıyor…"
              : "Tema seçince uygulama kendini yeniler. Yenilenmezse kapatıp açtığında geçerli olur."}
          </Text>
        </View>

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

  // --- tema secici ---
  temaIzgara: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  temaKart: {
    width: "48%", backgroundColor: COLORS.card, borderWidth: 1,
    borderColor: COLORS.cardBorder, borderRadius: 12, padding: 10,
  },
  temaKartAktif: { borderColor: COLORS.accent, borderWidth: 2 },
  temaSeritler: { flexDirection: "row", height: 26, borderRadius: 6, overflow: "hidden", marginBottom: 8 },
  temaSerit: { flex: 1 },
  temaAd: { color: COLORS.text, fontWeight: "800", fontSize: 13 },
  temaAdAktif: { color: COLORS.accent },
  temaAciklama: { color: COLORS.textMuted, fontSize: 11, marginTop: 2, lineHeight: 15 },
  temaTik: { position: "absolute", top: 6, right: 6 },
  ozelKap: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  renkIzgara: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  renkKutu: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center",
    justifyContent: "center", borderWidth: 2, borderColor: "transparent",
  },
  renkKutuAktif: { borderColor: COLORS.text },
  temaNot: { flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 26 },
  temaNotYazi: { color: COLORS.textMuted, fontSize: 12, flex: 1 },
});
