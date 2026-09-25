import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView, Share,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import TeamBadge from "../components/TeamBadge";
import PlayerPhoto from "../components/PlayerPhoto";
import AnswerFeedback from "../components/AnswerFeedback";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { buildSuggestIndex, suggestPlayers, findMatchedPlayer } from "../lib/gameEngine";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_DOGRU_CEVAP } from "../lib/profile";
import { gununBulmacasi, paylasimMetni, DENEME_HAKKI } from "../lib/dailyPuzzle";
import { getBulmacaDurumu, tahminKaydet, cevabiKaydet } from "../lib/dailyPuzzleStore";

// ============================================================================
// GÜNÜN BULMACASI EKRANI — 12 Eylül 2026
//
// Herkese aynı soru, günde bir kez, 3 deneme. Sunucu yok: soru tarihten
// deterministik olarak türüyor (bkz. lib/dailyPuzzle.js).
// ============================================================================

export default function DailyPuzzleScreen({ onExit }) {
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();

  const [bulmaca, setBulmaca] = useState(null);
  const [durum, setDurum] = useState(null);
  const [girdi, setGirdi] = useState("");
  const [geriBildirim, setGeriBildirim] = useState(null);
  const [hata, setHata] = useState(false);

  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(
    () => (girdi.trim().length < 3 ? [] : suggestPlayers(suggestIndex, girdi)),
    [suggestIndex, girdi]
  );

  // Uygun ikili listesinin ilk kurulumu birkaç yüz ms sürüyor; bir kare
  // beklet ki "Yükleniyor" göstergesi gerçekten çizilsin, ekran donuk
  // açılmasın.
  useEffect(() => {
    let iptal = false;
    const t = setTimeout(() => {
      try {
        const b = gununBulmacasi(PLAYERS);
        if (iptal) return;
        if (!b) { setHata(true); return; }
        setBulmaca(b);
      } catch (e) {
        if (!iptal) setHata(true);
      }
    }, 50);
    getBulmacaDurumu().then((d) => { if (!iptal) setDurum(d); }).catch(() => {});
    return () => { iptal = true; clearTimeout(t); };
  }, []);

  // Bilinemeden bittiyse cevabı kaydet (sonraki açılışlarda da görünsün).
  useEffect(() => {
    if (!bulmaca || !durum?.bitti || durum.bilindi || durum.cevap) return;
    const ornek = bulmaca.gecerliCevaplar[0]?.name;
    if (ornek) cevabiKaydet(ornek).then(setDurum).catch(() => {});
  }, [bulmaca, durum]);

  async function tahminEt(ad) {
    const metin = String(ad ?? girdi).trim();
    if (!metin || !bulmaca || !durum || durum.bitti) return;
    setGirdi("");

    const eslesen = findMatchedPlayer(metin, bulmaca.gecerliCevaplar);
    const yeni = await tahminKaydet(metin, Boolean(eslesen), eslesen?.name || null);
    setDurum(yeni);

    if (eslesen) {
      playCorrect();
      unlockPlayer(eslesen.name);
      recordRound("dailyPuzzle", true);
      addXP(XP_DOGRU_CEVAP);
      setGeriBildirim({ correct: true, message: eslesen.name });
    } else {
      playWrong();
      const kalan = DENEME_HAKKI - yeni.denemeler.length;
      if (yeni.bitti) recordRound("dailyPuzzle", false);
      setGeriBildirim({
        correct: false,
        message: kalan > 0 ? `Olmadı — ${kalan} hakkın kaldı` : "Hakkın bitti",
      });
    }
  }

  async function paylas() {
    if (!bulmaca || !durum) return;
    try {
      await Share.share({
        message: paylasimMetni({
          no: bulmaca.no,
          bilindi: durum.bilindi,
          denemeSayisi: durum.denemeler.length,
          teamA: bulmaca.teamA,
          teamB: bulmaca.teamB,
        }),
      });
    } catch (e) {}
  }

  if (hata) {
    return (
      <GameBackground style={styles.merkez}>
        <Text style={styles.bekleme}>Bugünün bulmacası hazırlanamadı.</Text>
        <SoundPressable onPress={onExit} style={styles.ikincilBtn}>
          <Text style={styles.ikincilBtnText}>Geri dön</Text>
        </SoundPressable>
      </GameBackground>
    );
  }

  if (!bulmaca || !durum) {
    return (
      <GameBackground style={styles.merkez}>
        <ActivityIndicator color={COLORS.cta} />
        <Text style={styles.bekleme}>Bugünün sorusu hazırlanıyor...</Text>
      </GameBackground>
    );
  }

  const kalanHak = DENEME_HAKKI - durum.denemeler.length;
  const cevapAdi = durum.cevap || bulmaca.gecerliCevaplar[0]?.name;

  return (
    <GameBackground style={styles.kap}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BackButton onPress={onExit} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: SPACING.xxl }}
          keyboardShouldPersistTaps="handled"
          // iOS'ta klavye açılınca içeriği kendiliğinden yukarı iter; panel
          // zaten üstte ama uzun ızgaralarda bu da işe yarıyor.
          automaticallyAdjustKeyboardInsets
        >
          <Text style={styles.ustBaslik}>GÜNÜN BULMACASI</Text>
          <Text style={styles.no}>#{bulmaca.no}</Text>
          <Text style={styles.aciklama}>Bugün herkese aynı soru soruluyor</Text>

          <View style={styles.takimKart}>
            <View style={styles.takimKutu}>
              <TeamBadge name={bulmaca.teamA} size={56} />
              <Text style={styles.takimAd}>{bulmaca.teamA}</Text>
            </View>
            <Text style={styles.arti}>+</Text>
            <View style={styles.takimKutu}>
              <TeamBadge name={bulmaca.teamB} size={56} />
              <Text style={styles.takimAd}>{bulmaca.teamB}</Text>
            </View>
          </View>

          {/* Deneme göstergesi */}
          <View style={styles.hakSatir}>
            {Array.from({ length: DENEME_HAKKI }).map((_, i) => {
              const deneme = durum.denemeler[i];
              const renk = !deneme ? COLORS.cardBorder : deneme.dogru ? COLORS.accent : COLORS.danger;
              return <View key={i} style={[styles.hakKutu, { backgroundColor: renk }]} />;
            })}
          </View>

          {/* --- CEVAP ALANI ---
              13 Eylül 2026 (Kerem: "cevap verme kısmı aşırı aşağıda kalıyor.
              klavye kapatıyor.") — girdi kutusu eskiden ekranın EN ALTINDA
              sabitti ve klavye açılınca üstüne biniyordu. Artık akışın içinde,
              takım kartının hemen altında: klavye alt yarıyı kaplasa bile
              kutu ekranın üst yarısında kalıyor. */}
          {!durum.bitti && (
            <View style={styles.cevapPaneli}>
              <View style={styles.girdiSatir}>
                <TextInput
                  style={styles.girdi}
                  placeholder="İki takımda da oynamış futbolcu..."
                  placeholderTextColor={COLORS.textFaint}
                  value={girdi}
                  onChangeText={setGirdi}
                  onSubmitEditing={() => tahminEt()}
                  returnKeyType="send"
                  autoCorrect={false}
                />
                <SoundPressable style={styles.gonderBtn} onPress={() => tahminEt()}>
                  <Ionicons name="send" size={18} color={COLORS.accentDark} />
                </SoundPressable>
              </View>
              {oneriler.length > 0 && (
                <ScrollView
                  horizontal
                  keyboardShouldPersistTaps="handled"
                  showsHorizontalScrollIndicator={false}
                  style={styles.oneriSerit}
                >
                  {oneriler.map((ad) => (
                    <SoundPressable key={ad} style={styles.oneriCip} onPress={() => tahminEt(ad)}>
                      <Text style={styles.oneriCipText}>{ad}</Text>
                    </SoundPressable>
                  ))}
                </ScrollView>
              )}
              <Text style={styles.hakText}>{kalanHak} deneme hakkın kaldı</Text>
            </View>
          )}

          {/* Yapılan tahminler */}
          {durum.denemeler.map((d, i) => (
            <View key={i} style={styles.denemeSatir}>
              <Ionicons
                name={d.dogru ? "checkmark-circle" : "close-circle"}
                size={16}
                color={d.dogru ? COLORS.accent : COLORS.danger}
              />
              <Text style={styles.denemeText}>{d.metin}</Text>
            </View>
          ))}

          {durum.bitti ? (
            <View style={styles.sonucKart}>
              <Text style={styles.sonucBaslik}>
                {durum.bilindi ? "Bildin!" : "Bugün olmadı"}
              </Text>
              <View style={{ marginVertical: SPACING.md }}>
                <PlayerPhoto name={cevapAdi} size={96} />
              </View>
              <Text style={styles.sonucAd}>{cevapAdi}</Text>
              <Text style={styles.sonucAlt}>
                Bu ikilide oynamış {bulmaca.toplamCevap} futbolcu var
              </Text>

              <SoundPressable style={styles.anaBtn} onPress={paylas}>
                <Ionicons name="share-social" size={16} color={COLORS.accentDark} />
                <Text style={styles.anaBtnText}>SONUCU PAYLAŞ</Text>
              </SoundPressable>
              <Text style={styles.yarinText}>Yarın yeni bir soru seni bekliyor</Text>
            </View>
          ) : null}
        </ScrollView>

        {geriBildirim && (
          <View style={styles.geriBildirimSarmal} pointerEvents="none">
            <AnswerFeedback
              correct={geriBildirim.correct}
              message={geriBildirim.message}
              onDone={() => setGeriBildirim(null)}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, padding: SPACING.lg, paddingTop: SPACING.xxl },
  merkez: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },

  ustBaslik: { ...TYPE.eyebrow, color: COLORS.cta, textAlign: "center", marginTop: SPACING.md },
  no: { ...TYPE.display, fontSize: 36, color: COLORS.text, textAlign: "center" },
  aciklama: { ...TYPE.caption, textAlign: "center", marginBottom: SPACING.lg },

  takimKart: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.lg, padding: SPACING.lg,
  },
  takimKutu: { flex: 1, alignItems: "center", gap: SPACING.xs },
  takimAd: { ...TYPE.h3, fontSize: 14, textAlign: "center" },
  arti: { ...TYPE.h2, color: COLORS.cta, marginHorizontal: SPACING.sm },

  hakSatir: { flexDirection: "row", gap: SPACING.sm, justifyContent: "center", marginTop: SPACING.lg },
  hakKutu: { width: 42, height: 8, borderRadius: 4 },

  denemeSatir: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginTop: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  denemeText: { ...TYPE.caption, color: COLORS.text },

  sonucKart: {
    backgroundColor: COLORS.card, borderColor: COLORS.cta, borderWidth: 2,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.lg, alignItems: "center",
  },
  sonucBaslik: { ...TYPE.h2, textAlign: "center" },
  sonucAd: { ...TYPE.h3, color: COLORS.cta, textAlign: "center" },
  sonucAlt: { ...TYPE.caption, textAlign: "center", marginTop: SPACING.xs },
  yarinText: { ...TYPE.caption, textAlign: "center", marginTop: SPACING.md },

  cevapPaneli: { marginTop: SPACING.lg },
  oneriSerit: { marginTop: SPACING.sm },
  oneriCip: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 6, marginRight: SPACING.sm,
  },
  oneriCipText: { ...TYPE.caption, color: COLORS.text, fontWeight: "700" },
  girdiSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  girdi: {
    flex: 1, backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    color: COLORS.text, fontSize: 15,
  },
  gonderBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, ...SHADOW.card,
  },
  hakText: { ...TYPE.caption, textAlign: "center", marginTop: SPACING.sm },
  // (altAlan kaldırıldı — panel artık akışın içinde)

  geriBildirimSarmal: { position: "absolute", left: 0, right: 0, top: "38%", alignItems: "center" },

  anaBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md, marginTop: SPACING.md, ...SHADOW.card,
  },
  anaBtnText: { ...TYPE.button, color: COLORS.accentDark },
  ikincilBtn: { marginTop: SPACING.lg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  ikincilBtnText: { ...TYPE.caption, textDecorationLine: "underline" },
  bekleme: { ...TYPE.caption, marginTop: SPACING.md, textAlign: "center" },
});
