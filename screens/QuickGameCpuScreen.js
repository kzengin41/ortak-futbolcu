import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import ModKurulum, { KurulumBolum, SecimCipleri, ZorlukSecici, SureSecici, KapsamDugmesi, zorlukMotoru, VARSAYILAN_ZORLUK_ID } from "../components/ModKurulum";
import { MODE_COLORS } from "../lib/theme";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { useAudioPlayer } from "expo-audio";
import { PLAYERS } from "../lib/players";
import { CLUB_INFO } from "../lib/clubs";
import { LEAGUE_PRESETS, DEFAULT_PRESET_ID, clubsForPreset } from "../lib/leaguePresets";
import { useAppSettings } from "../lib/SettingsContext";
import { generateQuickRound, computeRoundPool } from "../lib/gameEngine";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import ReportModal from "../components/ReportModal";
import AnswerFeedback from "../components/AnswerFeedback";
import CountdownOverlay from "../components/CountdownOverlay";
import TeamBadge from "../components/TeamBadge";
import PlayerPhoto, { prefetchPlayerPhoto } from "../components/PlayerPhoto";
import LeagueSelectModal from "../components/LeagueSelectModal";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import TimerBar from "../components/TimerBar";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";

const count3Source = require("../assets/sounds/count-3.mp3");
const count2Source = require("../assets/sounds/count-2.mp3");
const count1Source = require("../assets/sounds/count-1.mp3");

const CHOICE_SECONDS = 6;

export default function QuickGameCpuScreen({ onExit, onExitSilent }) {
  const [zorlukId, setZorlukId] = useState(VARSAYILAN_ZORLUK_ID);
  const difficulty = zorlukMotoru(zorlukId); // 1-10 motor ölçeği (tur havuzu + CPU)
  const [presetSelection, setPresetSelection] = useState({ id: DEFAULT_PRESET_ID });
  const { settings: appSettings, loaded: appSettingsLoaded } = useAppSettings();
  const appliedDefaultPresetRef = useRef(false);
  useEffect(() => {
    if (appSettingsLoaded && !appliedDefaultPresetRef.current) {
      appliedDefaultPresetRef.current = true;
      if (appSettings.defaultLeaguePresetId) setPresetSelection({ id: appSettings.defaultLeaguePresetId });
    }
  }, [appSettingsLoaded, appSettings.defaultLeaguePresetId]);
  const [leagueModalOpen, setLeagueModalOpen] = useState(false);
  const [started, setStarted] = useState(false);

  const [usedPairs, setUsedPairs] = useState(new Set());
  const [round, setRound] = useState(null);
  const [phase, setPhase] = useState("countdown"); // countdown | choosing | feedback
  const [secimSuresi, setSecimSuresi] = useState(CHOICE_SECONDS);
  const [choiceTimeLeft, setChoiceTimeLeft] = useState(CHOICE_SECONDS);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [lastPlayer, setLastPlayer] = useState(""); // "correct" | "wrong" | null
  const [scoreP1, setScoreP1] = useState(0);
  const [roundCount, setRoundCount] = useState(0);

  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const countPlayer3 = useAudioPlayer(count3Source);
  const countPlayer2 = useAudioPlayer(count2Source);
  const countPlayer1 = useAudioPlayer(count1Source);

  const allowedClubs = useMemo(
    () =>
      presetSelection.clubs ?? clubsForPreset(presetSelection.id, CLUB_INFO),
    [presetSelection]
  );
  const presetLabel = useMemo(() => {
    if (presetSelection.clubs) {
      const n = presetSelection.id.replace("custom:", "").split(",").length;
      return `Özel seçim (${n} lig)`;
    }
    return LEAGUE_PRESETS.find((p) => p.id === presetSelection.id)?.label || "Tümü";
  }, [presetSelection]);

  const pool = useMemo(
    () => computeRoundPool(PLAYERS, allowedClubs, difficulty),
    [allowedClubs, difficulty]
  );

  const startNewRound = useCallback(() => {
    setUsedPairs((prev) => {
      const r = generateQuickRound(pool, PLAYERS, prev, allowedClubs);
      setRound(r);
      if (r && r.correctPlayer) { prefetchPlayerPhoto(r.correctPlayer.name); }
      if (!r) return prev;
      const next = new Set(prev);
      next.add(r.key);
      return next;
    });
    setPhase("countdown");
    setSelected(null);
    setFeedback(null);
    setChoiceTimeLeft(secimSuresi);
    setRoundCount((c) => c + 1);
  }, [pool, allowedClubs, secimSuresi]);

  useEffect(() => {
    if (started) startNewRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  function handleCountdownComplete() {
    setPhase("choosing");
  }

  useEffect(() => {
    if (phase !== "choosing") return;
    if (choiceTimeLeft <= 0) {
      resolveChoice(null);
      return;
    }
    const t = setTimeout(() => setChoiceTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, choiceTimeLeft]);

  function resolveChoice(option) {
    if (phase !== "choosing" || !round) return;
    setSelected(option);
    const isCorrect = option && option.name === round.correctPlayer.name;
    setScoreP1((s) => s + (isCorrect ? 1 : -1));

    recordRound("quickCpu", !!isCorrect);
    if (isCorrect) {
      unlockPlayer(round.correctPlayer.name); // Ansiklopedi: oyun içinde ismi geçen herkes açılmaya aday
      playCorrect();
      setFeedback("correct");
    } else {
      playWrong();
      setFeedback("wrong");
    }
    setPhase("feedback");
    setTimeout(() => startNewRound(), 1400);
  }

  if (!started) {
    // 27 Eylül 2026 (Kerem: "her mod için zorluk ayarı olmalı. süre ayarı
    // olmalı. her moddaki mimari dizayn aynı olmalı.") — kurulum ekranı artık
    // ortak ModKurulum parçalarıyla kuruluyor (bkz. components/ModKurulum.js).
    return (
      <ModKurulum
        baslik="Hızlı Antrenman"
        aciklama="3-2-1 sonrası 4 seçenek çıkar. Doğru +1, yanlış -1. Cevap verince hemen sıradaki tur başlar."
        vurgu={MODE_COLORS.training}
        onGeri={onExitSilent || onExit}
        onBasla={() => setStarted(true)}
      >
        <KurulumBolum baslik="ZORLUK">
          <ZorlukSecici secili={zorlukId} onSec={setZorlukId} />
        </KurulumBolum>
        <KurulumBolum baslik="CEVAP SÜRESİ">
          <SureSecici
            secenekler={[4, 6, 8, 10]}
            deger={secimSuresi}
            onDegis={setSecimSuresi}
            asgari={3}
            azami={30}
            aciklama="Seçenekler göründükten sonra karar vermek için süre."
          />
        </KurulumBolum>
        <KurulumBolum baslik="LİG / KAPSAM">
          <KapsamDugmesi etiket={presetLabel} onPress={() => setLeagueModalOpen(true)} />
        </KurulumBolum>
        <LeagueSelectModal
          visible={leagueModalOpen}
          currentPreset={presetSelection.clubs ? null : presetSelection.id}
          onSelect={(sel) => {
            setPresetSelection(sel);
            setLeagueModalOpen(false);
          }}
          onClose={() => setLeagueModalOpen(false)}
        />
      </ModKurulum>
    );
  }

  if (!round) {
    return (
      <View style={styles.container}>
        <BackButton text="Menüye Dön" onPress={onExit} />
        <Text style={styles.title}>Bu seçimle yeni eşleşme kalmadı.</Text>
        <Text style={styles.hint}>Popülerlik seviyesini "Normal"e almayı ya da lig kapsamını genişletmeyi dene.</Text>
        <SoundPressable
          style={styles.primaryBtn}
          onPress={() => {
            setUsedPairs(new Set());
            startNewRound();
          }}
        >
          <Text style={styles.primaryBtnText}>Baştan Başla</Text>
        </SoundPressable>
      </View>
    );
  }

  return (
    <GameBackground style={styles.container}>
      {showReport && <ReportModal visible={showReport} onClose={() => setShowReport(false)} playerContext={lastPlayer || "Bilinmiyor"} />}
      {/* GLOBAL TOP HEADER — 31 Ağustos 2026 (Kerem: "üstteki butonların
          konumlandırması çirkin"): artık absolute/top:40 ile içerikle
          çakışmıyor, normal akışta kendi satırını alıyor. */}
      <View style={{ width: "100%", paddingHorizontal: 16, paddingTop: 6, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <SoundPressable onPress={() => setShowReport(true)} hitSlop={20}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,100,100,0.2)", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12 }}>
            <Ionicons name="flag" size={13} color="#FFB020" />
            <Text style={{ color: "#FFB020", fontSize: 12, fontWeight: "800" }}>BİLDİR</Text>
          </View>
        </SoundPressable>
        <SoundPressable onPress={onExit} hitSlop={20}>
          <View style={{ backgroundColor: "rgba(255,93,93,0.15)", borderRadius: 16, padding: 6 }}>
            <Ionicons name="close" size={22} color="#FF5D5D" />
          </View>
        </SoundPressable>
      </View>

      {phase === "countdown" && (
        <CountdownOverlay onComplete={handleCountdownComplete} countPlayers={[countPlayer3, countPlayer2, countPlayer1]} />
      )}
      {feedback && (
        <AnswerFeedback 
          correct={feedback === "correct"} 
          player={feedback === "correct" ? round.correctPlayer : null} 
          onDone={() => {}} 
        />
      )}

      
      {!round ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#F3F7FA", fontSize: 20, textAlign: "center" }}>Uygun soru kalmadı!</Text>
          <Text style={{ color: "#F3F7FA", fontSize: 24, fontWeight: "bold", marginTop: 20 }}>Skor: {scoreP1}</Text>
          <SoundPressable onPress={onExit} style={[styles.primaryBtn, { marginTop: 40 }]}>
            <Text style={styles.primaryBtnText}>Menüye Dön</Text>
          </SoundPressable>
        </View>
      ) : (
        <>
      <View style={styles.topRow}>
        <SoundPressable onPress={onExit} style={[styles.exitBtn, { flexDirection: "row", alignItems: "center", gap: 4 }]}>
          <Ionicons name="close" size={14} color="#FF5D5D" />
          <Text style={styles.exitBtnText}>Bitir</Text>
        </SoundPressable>
        <Text style={styles.roundCounter}>Tur {roundCount}</Text>
      </View>

      <View style={styles.scoreRow}>
        <Text style={styles.scoreText}>Skor: {scoreP1}</Text>
      </View>

      <View style={styles.teamsCard}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <TeamBadge name={round.teamA} />
          <Text style={styles.teamName}>{round.teamA}</Text>
        </View>
        <Text style={styles.plus}>+</Text>
        <View style={{ flex: 1, alignItems: "center" }}>
          <TeamBadge name={round.teamB} />
          <Text style={styles.teamName}>{round.teamB}</Text>
        </View>
      </View>

      {phase === "choosing" && (
        <View style={{ marginTop: 14 }}>
          <TimerBar current={choiceTimeLeft} total={secimSuresi} />
        </View>
      )}

      <View style={styles.optionsGrid}>
        {round.options.map((opt) => {
          const isSelected = selected && selected.name === opt.name;
          const isCorrectOpt = phase === "feedback" && opt.name === round.correctPlayer.name;
          const isWrongSelected = phase === "feedback" && isSelected && !isCorrectOpt;
          return (
            <SoundPressable
              key={opt.name}
              disabled={phase !== "choosing"}
              onPress={() => resolveChoice(opt)}
              style={[
                styles.optionBtn,
                isCorrectOpt && styles.optionBtnCorrect,
                isWrongSelected && styles.optionBtnWrong,
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <PlayerPhoto name={opt.name} size={32} showProfileOnPress={false} />
                <Text style={styles.optionBtnText} numberOfLines={2}>{opt.name}</Text>
              </View>
            </SoundPressable>
          );
        })}
      </View>
            </>
      )
      }
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1620", padding: 20, paddingBottom: 40 },
  scrollContainer: { flex: 1, backgroundColor: "#0B1620", paddingHorizontal: 20 },
  title: { color: "#F3F7FA", fontSize: 22, fontWeight: "900" },
  subtitle: { color: "#8CA0B3", fontSize: 13, marginTop: 8, lineHeight: 19 },
  hint: { color: "#56697A", fontSize: 12, marginTop: 4 },
  popRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderColor: "#28394B",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  popRowActive: { borderColor: "#7CFF5C", backgroundColor: "#16222E" },
  popRowTitle: { color: "#F3F7FA", fontWeight: "800", fontSize: 14 },
  popRowTitleActive: { color: "#7CFF5C" },
  popRowDesc: { color: "#8CA0B3", fontSize: 11, marginTop: 2 },
  checkmark: { color: "#7CFF5C", fontSize: 16, fontWeight: "900" },
  leagueSelectBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#16222E",
    borderColor: "#28394B",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  leagueSelectText: { color: "#F3F7FA", fontSize: 14, fontWeight: "700" },
  leagueSelectChevron: { color: "#7CFF5C", fontSize: 12, fontWeight: "700" },
  primaryBtn: { backgroundColor: "#7CFF5C", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 28, marginBottom: 24 },
  primaryBtnText: { color: "#0B1620", fontWeight: "900", textTransform: "uppercase", fontSize: 13 },
  backLink: { color: "#8CA0B3", fontSize: 13 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  exitBtn: { borderColor: "#FF5D5D", borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  exitBtnText: { color: "#FF5D5D", fontSize: 12, fontWeight: "800" },
  scoreRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 16, marginTop: 12 },
  scoreText: { color: "#F3F7FA", fontWeight: "800", fontSize: 14 },
  roundCounter: { color: "#8CA0B3", fontSize: 12 },
  teamsCard: {
    flexDirection: "row",
    backgroundColor: "#16222E",
    borderColor: "#28394B",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  teamName: { color: "#F3F7FA", fontSize: 13, fontWeight: "900", textAlign: "center", marginTop: 6 },
  plus: { color: "#7CFF5C", fontSize: 20, fontWeight: "900", marginHorizontal: 12 },
  timerText: { color: "#7CFF5C", fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 14 },
  // 12 Eylül 2026 (Kerem: "hızlı antrenman modunda şıklar çok büyük, kötü
  // görünüyor") — dört şık flex:1 ile boş alanı paylaşıp devasa kutulara
  // dönüşüyordu. Artık içerik kadar yer kaplıyorlar.
  optionsGrid: { marginTop: 16, gap: 10 },
  optionBtn: {
    backgroundColor: "#16222E",
    borderColor: "#28394B",
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  optionBtnCorrect: { borderColor: "#7CFF5C", backgroundColor: "#1F5C36" },
  optionBtnWrong: { borderColor: "#FF5D5D", backgroundColor: "#4A2323" },
  optionBtnText: { color: "#F3F7FA", fontSize: 15, fontWeight: "800", textAlign: "center", flexShrink: 1 },
});
