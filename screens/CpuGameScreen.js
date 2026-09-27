import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import ModKurulum, { KurulumBolum, SecimCipleri, ZorlukSecici, SureSecici, KapsamDugmesi } from "../components/ModKurulum";
import { useModVarsayilanlari, oyunBilgisiniYaz, ayarSatirlari, MOD_TANIMLARI } from "../lib/modAyarlari";
import { MODE_COLORS } from "../lib/theme";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { useAudioPlayer } from "expo-audio";
import { PLAYERS } from "../lib/players";
import { CLUB_INFO } from "../lib/clubs";
import { LEAGUE_PRESETS, DEFAULT_PRESET_ID, clubsForPreset } from "../lib/leaguePresets";
import { useAppSettings } from "../lib/SettingsContext";
import { generateRound, computeRoundPool, findMatchedPlayer, suggestPlayers, buildSuggestIndex, ANSWER_SECONDS, getCpuProfile, ROUND_TIME_OPTIONS, sesIpuclari } from "../lib/gameEngine";
import { playerWeight, recognitionScore } from "../lib/clubWeights";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { useVoiceInput } from "../lib/useVoiceInput";
import VoiceConfirm from "../components/VoiceConfirm";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import AnswerFeedback from "../components/AnswerFeedback";
import ReportModal from "../components/ReportModal";
import CountdownOverlay from "../components/CountdownOverlay";
import TeamBadge from "../components/TeamBadge";
import PlayerPhoto, { oncedenYukle } from "../components/PlayerPhoto";
import LeagueSelectModal from "../components/LeagueSelectModal";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import TimerBar from "../components/TimerBar";

import PoolEmpty from "../components/PoolEmpty";
import MatchSummary from "../components/MatchSummary";
const count3Source = require("../assets/sounds/count-3.mp3");
const count2Source = require("../assets/sounds/count-2.mp3");
const count1Source = require("../assets/sounds/count-1.mp3");

// 31 Ağustos 2026 (Kerem: "Galibiyet sınırı olmayan modlara galibiyet sınırı
// ekleyelim. Başta seçmeli olsun.") — kaç puana ulaşan kazanır, oyun
// başlamadan seçilebiliyor. Infinity = "Sınırsız" (eski sonsuz davranış).
const WIN_LIMIT_OPTIONS = [
  { label: "3", value: 3 },
  { label: "5", value: 5 },
  { label: "7", value: 7 },
  { label: "10", value: 10 },
  { label: "Sınırsız", value: Infinity },
];

export default function CpuGameScreen({ onExit, onExitSilent }) {
  const [difficulty, setDifficulty] = useState(5); // 1-10 (bkz. lib/modAyarlari.js)
  const [roundSeconds, setRoundSeconds] = useState(ROUND_TIME_OPTIONS[1]);
  const [targetScore, setTargetScore] = useState(5);
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
  const [inputMode, setInputMode] = useState("keyboard"); // "keyboard" | "voice"
  const [started, setStarted] = useState(false);
  const [usedPairs, setUsedPairs] = useState(new Set());
  const [round, setRound] = useState(null);
  const [phase, setPhase] = useState("countdown"); // countdown | racing | answering | result
  const [buzzedBy, setBuzzedBy] = useState(null); // 'p1' | 'cpu'
  const [lockedOut, setLockedOut] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(roundSeconds);
  const [answerTimeLeft, setAnswerTimeLeft] = useState(ANSWER_SECONDS);
  const [answerInput, setAnswerInput] = useState("");
  const [resultText, setResultText] = useState("");
  const [lastWinner, setLastWinner] = useState(null);
  const [winningPlayer, setWinningPlayer] = useState(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [lastPlayer, setLastPlayer] = useState(""); // "correct" | "wrong" | null
  const [showResultPanel, setShowResultPanel] = useState(true);
  const [heardText, setHeardText] = useState(null); // sesli girişte "anladığım" metni

  // Ses oynatıcıları BURADA, ekran monte olduğunda BİR KEZ yaratılıyor —
  // CountdownOverlay her turda yeniden monte olsa bile bu oynatıcılar
  // aynı kalıyor, her turda yeniden yaratılmıyor (önceki yavaşlığın kök
  // sebebi buydu).
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const countPlayer3 = useAudioPlayer(count3Source);
  const countPlayer2 = useAudioPlayer(count2Source);
  const countPlayer1 = useAudioPlayer(count1Source);

  // 26 Eylül 2026: Whisper ipuçları artık turun doğru cevapları DEĞİL, turdaki
  // kulüplerin tanınmış oyuncuları (karışık) — bkz. gameEngine sesIpuclari.
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceInput(
    () => sesIpuclari(PLAYERS, [round?.teamA, round?.teamB])
  );
  const [voiceError, setVoiceError] = useState(null);
  // 25 Eylul 2026 (Kerem: "sesli soyledigimde anladigini ekrana getirsin,
  // onaylayayim... kullanmak istemeyenler icin bu ayar kapatilabilsin")
  // Sesli cevap artik dogrudan gonderilmiyor; VoiceConfirm ile onaylatiliyor.
  // Onay bekleyen istek varken sayac DURUYOR (asagidaki isProcessing kosullari).
  const [sesOnayIstegi, setSesOnayIstegi] = useState(null);
  // 26 Eylül 2026 — DÜZELTME: bu ekran ayarları `settings: appSettings`
  // diye yeniden adlandırarak alıyor; burada `settings` yazmak
  // ReferenceError ile ekranı çökertiyordu (Ortak Kulüp açılmıyordu).
  const sesOnayiAcik = appSettings?.voiceConfirm !== false;
  function sesOnayla(ad) {
    const istek = sesOnayIstegi;
    setSesOnayIstegi(null);
    if (istek && istek.gonder) istek.gonder(ad);
  }
  async function sesTekrar() {
    setSesOnayIstegi(null);
    setVoiceError(null);
    try { await startRecording(); } catch (err) { setVoiceError(err.message || "Mikrofona erisilemedi"); }
  }
  function sesYaz(ad) {
    const istek = sesOnayIstegi;
    setSesOnayIstegi(null);
    if (istek && istek.yaz) istek.yaz(ad);
  }

  async function handleMicPress() {
    setVoiceError(null);
    if (isRecording) {
      try {
        // Geçerli oyuncu isimlerini Whisper'a ipucu olarak gönder —
        // "Olaitan" gibi nadir isimlerin tanınma oranı belirgin şekilde artıyor.
        const text = await stopRecording();
        if (text) {
          const gonder = (a) => { setAnswerInput(a); setHeardText(a); submitAnswer(a); };
          const yaz = (a) => { setAnswerInput(a); setInputMode("keyboard"); };
          // 26 Eylül 2026 (Kerem: "bu isim listede bulunamadı diyor... kopya veriyorsa
          // kaldırmamız lazım") — onay ekranı artık SADECE duyulanı gösteriyor.
          // Eskiden duyulan, turun doğru cevaplarıyla eşleştirilip eşleşen tam
          // ad yazılıyor ya da "listede bulunamadı" uyarısı çıkıyordu; ikisi de
          // cevabın doğru olup olmadığını göndermeden önce ele veriyordu.
          if (sesOnayiAcik) setSesOnayIstegi({ duyulan: text, ad: text, gonder, yaz });
          else { const matched = findMatchedPlayer(text, round.validAnswers); gonder(matched ? matched.name : text); }
        } else {
          setVoiceError("Sesi anlayamadım, tekrar dener misin?");
        }
      } catch (err) {
        setVoiceError(err.message || "Ses tanıma başarısız oldu");
      }
    } else {
      try {
        await startRecording();
      } catch (err) {
        setVoiceError(err.message || "Mikrofona erişilemedi");
      }
    }
  }
  const [scoreP1, setScoreP1] = useState(0);
  const [streakP1, setStreakP1] = useState(0);
  const [scoreCpu, setScoreCpu] = useState(0);

  const macBitti = started && (scoreP1 >= targetScore || scoreCpu >= targetScore);

  // 11 Eylül 2026 (Kerem: "3-1 oldu, kazandım. doğru cevapları göster butonuna
  // tıklayacaktım ama direkt kazandınız ekranına geçti") — son turda 3 saniye
  // sonra koşulsuz olarak gameOver'a geçiliyordu ve zamanlayıcı hiç
  // temizlenmiyordu. Artık: oyuncu "doğru cevapları göster"e bastıysa otomatik
  // geçiş İPTAL ediliyor, sonuca kendi hazır olduğunda geçiyor. Ayrıca süre
  // 3 -> 4,5 saniyeye çıkarıldı ve zamanlayıcı temizleniyor (ekrandan çıkılsa
  // bile artık ateşlenmiyor).
  useEffect(() => {
    if (!macBitti || phase !== "result" || showAnswers) return;
    const zamanlayici = setTimeout(() => {
      setPhase("gameOver");
      addXP(scoreP1 > scoreCpu ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI);
    }, 4500);
    return () => clearTimeout(zamanlayici);
  }, [macBitti, phase, showAnswers, scoreP1]);
  
  const cpuTimeoutRef = useRef(null);

  // Lig filtresi ve oyuncu havuzu SADECE preset değiştiğinde (oyun başında)
  // hesaplanır — her tur yeniden hesaplamak (binlerce oyuncuyu taramak)
  // gerçek cihazlarda donmaya yol açıyordu.
  const allowedClubs = useMemo(
    () => presetSelection.clubs ?? clubsForPreset(presetSelection.id, CLUB_INFO),
    [presetSelection]
  );
  const presetLabel = useMemo(() => {
    if (presetSelection.clubs) {
      const n = presetSelection.id.replace("custom:", "").split(",").length;
      return `Özel seçim (${n} lig)`;
    }
    return LEAGUE_PRESETS.find((p) => p.id === presetSelection.id)?.label || "Tümü";
  }, [presetSelection]);
  const pool = useMemo(() => computeRoundPool(PLAYERS, allowedClubs, difficulty), [allowedClubs, difficulty]);

  const startNewRound = useCallback(() => {
    setUsedPairs((prev) => {
      const r = generateRound(pool, PLAYERS, prev, allowedClubs);
      setRound(r);
      if (r && r.validAnswers) { oncedenYukle(r.validAnswers); }
      if (!r) return prev;
      const next = new Set(prev);
      next.add(r.key);
      return next;
    });
    setPhase("countdown");
    setBuzzedBy(null);
    setLockedOut(new Set());
    setTimeLeft(roundSeconds);
    setAnswerInput("");
    setResultText("");
    setFeedback(null); // önceki turdan sızan tepki animasyonu olmasın
    setShowResultPanel(true);
    setHeardText(null);
    setWinningPlayer(null);
  }, [roundSeconds, pool, allowedClubs]);

  function handleCountdownComplete() {
    setPhase("racing");
  }

  useEffect(() => {
    if (started) startNewRound();
  }, [started, startNewRound]);

  useEffect(() => {
    if (!started || phase !== "racing") return;
    if (isProcessing || sesOnayIstegi) return; // ⏸ Ses işlenirken sayacı dondur
    if (timeLeft <= 0) {
      endRound(null, "Süre doldu, kimse bilemedi.");
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [started, phase, timeLeft, isProcessing, sesOnayIstegi]);

  useEffect(() => {
    if (phase !== "answering" || buzzedBy === "cpu") return;
    if (isProcessing || sesOnayIstegi) return; // ⏸ Ses işlenirken sayacı dondur
    if (answerTimeLeft <= 0) {
      const matched = findMatchedPlayer(answerInput, round.validAnswers);
      if (matched) {
        endRound("p1", `Doğru! (${answerInput.trim()})`, matched);
      } else {
        resolveCpuInstant();
      }
      return;
    }
    const t = setTimeout(() => setAnswerTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answerTimeLeft, buzzedBy, isProcessing, sesOnayIstegi]);

  useEffect(() => {
    if (!started || phase !== "racing" || !round) return;
    const profile = getCpuProfile(difficulty);
    const delay = profile.minDelay + Math.random() * (profile.maxDelay - profile.minDelay);
    cpuTimeoutRef.current = setTimeout(() => {
      if (lockedOut.has("cpu")) return;
      const willBeCorrect = Math.random() < profile.correctChance;
      setBuzzedBy("cpu");
      setPhase("answering");
      setTimeout(() => {
        if (willBeCorrect && round.validAnswers.length > 0) {
          const pick = round.validAnswers[Math.floor(Math.random() * round.validAnswers.length)];
          endRound("cpu", `CPU doğru bildi: ${pick.name}`, pick);
        } else {
          registerWrong("cpu");
        }
      }, 900);
    }, delay);
    return () => clearTimeout(cpuTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, phase, round, difficulty]);

  function handleBuzz() {
    if (phase !== "racing" || lockedOut.has("p1") || !round) return;
    if (cpuTimeoutRef.current) clearTimeout(cpuTimeoutRef.current);
    setBuzzedBy("p1");
    setPhase("answering");
    setAnswerTimeLeft(ANSWER_SECONDS);
  }

  // Mikrofon modunda: buzz + kayıt başlatma TEK dokunuşta olsun diye —
  // önceden buzz'la, sonra ayrıca mikrofona bas gerekiyordu, gereksiz bir
  // ekstra adımdı.
  async function handleBuzzAndSpeak() {
    handleBuzz();
    setVoiceError(null);
    try {
      await startRecording();
    } catch (err) {
      setVoiceError(err.message || "Mikrofona erişilemedi");
    }
  }

  // CPU'nun bekleyen zamanlayıcısını iptal edip beklemeden anında
  // sonuçlandırıyoruz — hem "Bilemedim" hem de yazma süresi dolduğunda
  // (cevap yanlış/boşsa) kullanılıyor. "Boşuna beklemesin" isteği bu.
  function resolveCpuInstant() {
    if (cpuTimeoutRef.current) clearTimeout(cpuTimeoutRef.current);
    const profile = getCpuProfile(difficulty);
    const willBeCorrect = Math.random() < profile.correctChance;
    if (willBeCorrect && round.validAnswers.length > 0) {
      const pick = round.validAnswers[Math.floor(Math.random() * round.validAnswers.length)];
      endRound("cpu", `CPU doğru bildi: ${pick.name}`, pick);
    } else {
      endRound(null, "İkiniz de bilemediniz.");
    }
  }

  function handlePass() {
    if (phase !== "racing" || lockedOut.has("p1") || !round) return;
    resolveCpuInstant();
  }

  function submitAnswer(overrideText) {
    if (!round) return;
    const text = overrideText !== undefined ? overrideText : answerInput;
    const matched = findMatchedPlayer(text, round.validAnswers);
    if (matched) {
      endRound("p1", `Doğru! (${text.trim()})`, matched);
    } else {
      // Yanlış cevapta da CPU'yu beklemeden anında sonuçlandır — sadece süre
      // dolduğunda değil, elle yanlış gönderdiğinde de aynı davranış olmalı.
      setAnswerInput("");
      resolveCpuInstant();
    }
  }

  function handleSuggestionTap(name) {
    setAnswerInput(name);
    submitAnswer(name);
  }

  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const suggestions = useMemo(() => suggestPlayers(suggestIndex, answerInput), [suggestIndex, answerInput]);

  function registerWrong(who) {
    const nextLocked = new Set(lockedOut);
    nextLocked.add(who);
    setLockedOut(nextLocked);
    setAnswerInput("");
    const remaining = ["p1", "cpu"].filter((o) => !nextLocked.has(o));
    if (remaining.length === 0) {
      endRound(null, "İkiniz de bilemediniz.");
    } else {
      setBuzzedBy(null);
      setPhase("racing");
    }
  }

  function endRound(winner, text, player) {
    // 26 Eylül 2026 (Kerem: "cpu'nun söyledikleri hiçbir modda ansiklopediyi açmasın. kendi söylediklerimiz açsın.")
    // Eskiden `winner` hiç kontrol edilmiyordu: CPU doğru bildiğinde de
    // (endRound("cpu", ..., pick)) futbolcu kullanıcının koleksiyonuna ekleniyordu.
    if (player && winner === "p1") unlockPlayer(player.name);
    setResultText(text);
    setLastWinner(winner);
    setWinningPlayer(player || null);
    setShowAnswers(false);
    setPhase("result");
    if (winner === "p1" || winner === "cpu") recordRound("cpu", winner === "p1");
    if (winner === "p1") {
      setScoreP1((s) => s + 1);
      setStreakP1((s) => s + 1);
      playCorrect();
      setFeedback("correct");
      setShowResultPanel(false); // önce tepki animasyonu, sonuç paneli onu beklesin
    } else if (winner === "cpu") {
      setScoreCpu((s) => s + 1);
      setStreakP1(0); // reset streak
      playWrong();
      setFeedback("wrong");
      setShowResultPanel(false);
    } else {
      setStreakP1(0); // reset streak
      setShowResultPanel(true); // beraberlikte tepki yok, direkt sonucu göster
    }
  }

  // 27 Eylül 2026 — merkezî mod ayarları (lib/modAyarlari.js): varsayılanlar
  // Ayarlar'dan gelir, kurulumda değiştirilebilir, oyun içinde "?" ile görülür.
  const modVarsayilanKaydet = useModVarsayilanlari("cpu", { zorluk: setDifficulty, sure: setRoundSeconds, galibiyet: setTargetScore, yontem: setInputMode });
  useEffect(() => {
    oyunBilgisiniYaz("cpu", { satirlar: ayarSatirlari({ zorluk: difficulty, sure: roundSeconds, galibiyet: targetScore, lig: presetLabel, yontem: inputMode }) });
  }, [difficulty, roundSeconds, targetScore, presetLabel, inputMode]);

  if (!started) {
    // 27 Eylül 2026 (Kerem: "her mod için zorluk ayarı olmalı. süre ayarı
    // olmalı. her moddaki mimari dizayn aynı olmalı.") — kurulum ekranı artık
    // ortak ModKurulum parçalarıyla kuruluyor (bkz. components/ModKurulum.js).
    return (
      <ModKurulum
        baslik="Ortak Kulüp"
        aciklama="İki kulüp çıkar. İkisinde de oynamış bir futbolcuyu CPU'dan önce söyle."
        vurgu={MODE_COLORS.teamTeam}
        onGeri={onExitSilent || onExit}
        onVarsayilanKaydet={() => modVarsayilanKaydet({ zorluk: difficulty, sure: roundSeconds, galibiyet: targetScore, yontem: inputMode })}
        onBasla={() => setStarted(true)}
      >
        <KurulumBolum baslik="ZORLUK">
          <ZorlukSecici deger={difficulty} onDegis={setDifficulty} aciklama={(z) => (z <= 3 ? "Sadece efsaneler ve süper yıldızlar sorulur, CPU yavaş ve sık yanılır." : z <= 7 ? "Büyük liglerin bilinen oyuncuları sorulur, CPU dengeli." : "Az bilinen oyuncular da sorulur, CPU hızlı ve isabetli.")} />
        </KurulumBolum>
        <KurulumBolum baslik="TUR SÜRESİ">
          <SureSecici
            secenekler={MOD_TANIMLARI.cpu.sure.secenekler}
            deger={roundSeconds}
            onDegis={setRoundSeconds}
            asgari={MOD_TANIMLARI.cpu.sure.asgari}
            azami={MOD_TANIMLARI.cpu.sure.azami}
            aciklama={MOD_TANIMLARI.cpu.sure.aciklama}
          />
        </KurulumBolum>
        <KurulumBolum baslik="GALİBİYET SINIRI">
          <SecimCipleri
            secenekler={WIN_LIMIT_OPTIONS.map((o) => ({ deger: o.value, etiket: o.label }))}
            secili={targetScore}
            onSec={setTargetScore}
          />
        </KurulumBolum>
        <KurulumBolum baslik="CEVAP YÖNTEMİ">
          <SecimCipleri
            secenekler={[
              { deger: "keyboard", etiket: "Klavye", ikon: "keypad" },
              { deger: "voice", etiket: "Mikrofon", ikon: "mic" },
            ]}
            secili={inputMode}
            onSec={setInputMode}
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
    // 12 Eylül 2026: burada yalnızca bir cümle vardı — buton yok, geri linki
    // yok. Kullanıcı tamamen sıkışıyordu.
    return (
      <GameBackground style={styles.container}>
        <PoolEmpty
          onReset={() => { setUsedPairs(new Set()); startNewRound(); }}
          onExit={onExitSilent || onExit}
        />
      </GameBackground>
    );
  }

  const p1Locked = lockedOut.has("p1");

  return (
    <GameBackground style={styles.container}>
      {/* GLOBAL TOP HEADER — 31 Ağustos 2026 (Kerem: "üstteki butonların
          konumlandırması çirkin"): artık absolute/top:40 ile içerikle
          çakışmıyor, normal akışta kendi satırını alıyor. */}
      <View style={{ width: "100%", paddingHorizontal: 16, paddingTop: 6, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable onPress={() => { if(typeof setShowReport === 'function') setShowReport(true); }} hitSlop={20}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,100,100,0.2)", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12 }}>
            <Ionicons name="flag" size={13} color="#FFB020" />
            <Text style={{ color: "#FFB020", fontSize: 12, fontWeight: "800" }}>BİLDİR</Text>
          </View>
        </Pressable>
        <Pressable onPress={onExit} hitSlop={20}>
          <View style={{ backgroundColor: "rgba(255,93,93,0.15)", borderRadius: 16, padding: 6 }}>
            <Ionicons name="close" size={22} color="#FF5D5D" />
          </View>
        </Pressable>
      </View>

      {phase === "countdown" && (
        <CountdownOverlay onComplete={handleCountdownComplete} countPlayers={[countPlayer3, countPlayer2, countPlayer1]} />
      )}
      {feedback && (
        <AnswerFeedback
          correct={feedback === "correct"}
          player={winningPlayer}
          onDone={() => {
            setFeedback(null);
            setShowResultPanel(true);
          }}
        />
      )}

      
      {showReport && (
        <ReportModal visible={showReport} onClose={() => setShowReport(false)} playerContext={lastPlayer || (winningPlayer ? winningPlayer.name : null)} />
      )}
      <View style={styles.scoreRow}>

        <Text style={[styles.scoreText, streakP1 >= 3 && { color: "#FFB020" }]}>
          Sen: {scoreP1} 
        </Text>
        <Text style={styles.scoreText}>CPU: {scoreCpu}</Text>

        

      </View>

      {/* 11 Eylül 2026 (Kerem: "cpu tarafından atanan ilk eşleştirme gelirken
          yarım saniye kadar eşleşme gözüktü, ardından 3-2-1 sayıldı") — bu
          kart `phase` kontrolüne HİÇ bağlı değildi. Geri sayım bir Modal ve
          Android'de mount olması bir-iki kare sürdüğü için, o kareler boyunca
          altındaki takım kartı görünüyordu. Oyunun bütün mantığı takımların
          sayım BİTİNCE görünmesine dayandığı için bu turu baştan bozuyordu.
          (Aynı hata CountryTeamCpuScreen'de de vardı, orada düzeltilmişti.) */}
      {phase !== "countdown" && (
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
      )}

      {phase === "racing" && (
        <>
          <TimerBar current={timeLeft} total={roundSeconds} />
          {inputMode === "voice" ? (
            <SoundPressable disabled={p1Locked} onPress={handleBuzzAndSpeak} style={[styles.buzzBtn, p1Locked && styles.buzzBtnDisabled]}>
              <Text style={[styles.buzzBtnText, p1Locked && styles.buzzBtnTextDisabled]}>BUZZ'LA VE KONUŞ</Text>
            </SoundPressable>
          ) : (
            <SoundPressable disabled={p1Locked} onPress={handleBuzz} style={[styles.buzzBtn, p1Locked && styles.buzzBtnDisabled]}>
              <Text style={[styles.buzzBtnText, p1Locked && styles.buzzBtnTextDisabled]}>BUZZ'LA</Text>
            </SoundPressable>
          )}
          <SoundPressable disabled={p1Locked} onPress={handlePass} style={styles.passBtn}>
            <Text style={styles.passBtnText}>{p1Locked ? "Bilemedin" : "Bilemedim"}</Text>
          </SoundPressable>
        </>
      )}

      {phase === "answering" && (
        // 12 Eylül 2026 — KLAVYE SORUNU. Denetimden: 360x640 ekranda header +
        // skor + takım kartı üstte olduğu için "Gönder" satırından aşağısı
        // klavyenin altında kalıyordu. Bu ekranların hiçbirinde
        // KeyboardAvoidingView yoktu (yalnızca WhoAmI'de vardı).
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ marginTop: 20 }}
        >
          {buzzedBy === "cpu" ? (
            <Text style={styles.answeringText}>CPU cevap veriyor...</Text>
          ) : inputMode === "voice" ? (
            <>
              <Text style={styles.answeringText}>{answerTimeLeft} sn içinde söyle</Text>
              {heardText && (
                <View style={styles.heardBanner}>
                  <Text style={styles.heardBannerText}>Anladığım: "{heardText}"</Text>
                </View>
              )}
              <SoundPressable
                style={[styles.micBtnBig, isRecording && styles.micBtnActive]}
                onPress={handleMicPress}
                disabled={isProcessing}
              >
                <Text style={styles.micBtnBigText}>{isProcessing ? "İşleniyor…" : isRecording ? "Durdur" : "Konuş"}</Text>
              </SoundPressable>
              {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
            <VoiceConfirm
              istek={sesOnayIstegi}
              onOnayla={sesOnayla}
              onTekrar={sesTekrar}
              onYaz={sesYaz}
              onIptal={() => setSesOnayIstegi(null)}
            />
              {isRecording && <Text style={styles.voiceHint}>Dinliyorum...</Text>}
              {isProcessing && <Text style={styles.voiceHint}>Yazıya çevriliyor...</Text>}
              <SoundPressable onPress={() => setInputMode("keyboard")} style={styles.switchModeLink}>
                <Text style={styles.switchModeLinkText}>Bunun yerine yazmak istiyorum</Text>
              </SoundPressable>
            </>
          ) : (
            <>
              <Text style={styles.answeringText}>{answerTimeLeft} sn içinde yaz</Text>
              <TextInput
                autoCorrect={false}
                autoCapitalize="words"
                spellCheck={false}
                autoFocus
                value={answerInput}
                onChangeText={setAnswerInput}
                onSubmitEditing={() => submitAnswer()}
                placeholder="Futbolcu adı..."
                placeholderTextColor="#56697A"
                style={styles.input}
              />
              {suggestions.length > 0 && (
                <View style={styles.suggestBox}>
                  {suggestions.map((name) => (
                    <Pressable key={name} onPress={() => handleSuggestionTap(name)} style={styles.suggestRow}>
                      <Text style={styles.suggestText}>{name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <SoundPressable style={[styles.primaryBtn, { flex: 1 }]} onPress={() => submitAnswer()}>
                  <Text style={styles.primaryBtnText}>Gönder</Text>
                </SoundPressable>
                <SoundPressable
                  style={[styles.micBtn, isRecording && styles.micBtnActive]}
                  onPress={handleMicPress}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Ionicons name="hourglass" size={20} color="#F3F7FA" /> : isRecording ? <Ionicons name="stop" size={20} color="#fff" /> : <Ionicons name="mic" size={20} color="#F3F7FA" />}
                </SoundPressable>
              </View>
              {heardText && (
                <View style={styles.heardBanner}>
                  <Text style={styles.heardBannerText}>Anladığım: "{heardText}"</Text>
                </View>
              )}
              {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
            <VoiceConfirm
              istek={sesOnayIstegi}
              onOnayla={sesOnayla}
              onTekrar={sesTekrar}
              onYaz={sesYaz}
              onIptal={() => setSesOnayIstegi(null)}
            />
              {isRecording && <Text style={styles.voiceHint}>Dinliyorum — durdurmak için dokun</Text>}
              {isProcessing && <Text style={styles.voiceHint}>Yazıya çevriliyor...</Text>}
              <SoundPressable onPress={() => setInputMode("voice")} style={styles.switchModeLink}>
                <Text style={styles.switchModeLinkText}>Bunun yerine sesle söylemek istiyorum</Text>
              </SoundPressable>
            </>
          )}
          {/* 27 Eylül 2026 (Kerem: "ülke-takım modunda bilemedim butonu yok")
              — zile bastıktan sonra da pes edilebilsin: yanlış cevapla aynı
              sonuç (CPU'ya anında son şans verilir, tur beklemeden biter). */}
          {buzzedBy === "p1" && (
            <SoundPressable onPress={() => { if (sesOnayIstegi) setSesOnayIstegi(null); resolveCpuInstant(); }} style={styles.passBtn}>
              <Text style={styles.passBtnText}>Bilemedim</Text>
            </SoundPressable>
          )}
        </KeyboardAvoidingView>
      )}

      {phase === "result" && showResultPanel && (
        <View style={{ marginTop: 20, alignItems: "center", width: "100%" }}>
          {winningPlayer && <PlayerPhoto name={winningPlayer.name} size={84} />}
          <Text style={[styles.resultText, winningPlayer && { marginTop: 12 }]}>{resultText}</Text>
          {!showAnswers && (
            <Pressable style={styles.showAnswersBtn} hitSlop={10} onPress={() => setShowAnswers(true)}>
              <Text style={styles.showAnswersBtnText}>
                {lastWinner === "p1" ? "Diğer doğru cevapları göster" : "Doğru cevapları göster"}
              </Text>
            </Pressable>
          )}
          {showAnswers && (
            <ScrollView style={styles.answersBox} contentContainerStyle={{ padding: 12 }}>
              {[...round.validAnswers]
                // 12 Eylül 2026 (Kerem: "doğru cevaplar listelenirken popülerliğe
                // göre sıralanmalı, şimdi en üstte saçma sapan adamlar çıkıyor")
                // — playerWeight "kulüp ünü × GÜNCELLIK" ölçüyor, yani alt ligde
                // hâlâ oynayan sıradan biri, emekli bir efsanenin üstüne
                // çıkabiliyordu. recognitionScore kariyerin EN ünlü kulübüne
                // bakıyor ve emekliliği cezalandırmıyor — "kim meşhur" sorusunun
                // doğru cevabı bu. (Aynı fonksiyon cevap eşleştirmesinde de
                // kullanılıyor, iki yer artık tutarlı.)
                .sort((a, b) => recognitionScore(b) - recognitionScore(a))
                .map((p) => (
                  <View key={p.name} style={styles.answersBoxRow}>
                    <PlayerPhoto name={p.name} size={32} />
                    <Text style={styles.answersBoxItem}>{p.name}</Text>
                  </View>
                ))}
            </ScrollView>
          )}
          {macBitti ? (
            <Pressable
              style={styles.primaryBtn}
              onPress={() => { setPhase("gameOver"); addXP(scoreP1 > scoreCpu ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI); }}
            >
              <Text style={styles.primaryBtnText}>Maç Sonucunu Gör</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primaryBtn} onPress={startNewRound}>
              <Text style={styles.primaryBtnText}>Sıradaki Tur</Text>
            </Pressable>
          )}
        </View>
      )}

      {phase === "gameOver" && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 }}>
          <Text style={[styles.title, { fontSize: 28, color: scoreP1 > scoreCpu ? "#7CFF5C" : "#FF5D5D" }]}>
            {scoreP1 > scoreCpu ? "KAZANDIN!" : "CPU KAZANDI"}
          </Text>
          <Text style={[styles.title, { fontSize: 16, marginTop: 12 }]}>Sen: {scoreP1}  —  CPU: {scoreCpu}</Text>
          <MatchSummary
            modeId="cpu"
            kazanildi={scoreP1 > scoreCpu}
            kazanilanXp={scoreP1 > scoreCpu ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI}
          />
          <Pressable
            style={[styles.primaryBtn, { marginTop: 32, width: "100%" }]}
            onPress={() => {
              setScoreP1(0);
              setScoreCpu(0);
              setStreakP1(0);
              startNewRound();
            }}
          >
            <Text style={styles.primaryBtnText}>Tekrar Oyna</Text>
          </Pressable>
          <Pressable onPress={onExitSilent || onExit} style={{ marginTop: 16 }}>
            <Text style={styles.backLink}>Menüye dön</Text>
          </Pressable>
        </View>
      )}

      {(!started || phase === "result") && (
        <Pressable onPress={onExit} style={{ marginTop: 24 }}>
          <Text style={styles.backLink}>Menüye dön</Text>
        </Pressable>
      )}
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1620", padding: 20, justifyContent: "center" },
  scrollContainer: { flex: 1, backgroundColor: "#0B1620", padding: 20 },
  title: { color: "#F3F7FA", fontSize: 20, fontWeight: "900", textAlign: "center" },
  center: { color: "#F3F7FA", textAlign: "center" },
  diffBtn: { borderColor: "#28394B", borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  diffBtnActive: { borderColor: "#7CFF5C", backgroundColor: "#16222E" },
  diffBtnText: { color: "#8CA0B3", fontWeight: "800", fontSize: 13 },
  diffBtnTextActive: { color: "#7CFF5C" },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  scoreText: { color: "#8CA0B3", fontWeight: "700", fontSize: 13 },
  teamsCard: { flexDirection: "row", backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 18, padding: 20, alignItems: "center", justifyContent: "center" },
  teamName: { color: "#F3F7FA", fontSize: 14, fontWeight: "900", textAlign: "center", marginTop: 8 },
  plus: { color: "#7CFF5C", fontWeight: "900", fontSize: 18, marginHorizontal: 8 },
  timerText: { color: "#8CA0B3", textAlign: "center", marginTop: 16, fontSize: 12 },
  buzzBtn: { marginTop: 16, borderColor: "#7CFF5C", borderWidth: 2, borderRadius: 20, paddingVertical: 40, alignItems: "center" },
  buzzBtnDisabled: { borderColor: "#28394B" },
  buzzBtnText: { color: "#7CFF5C", fontWeight: "900", fontSize: 16 },
  buzzBtnTextDisabled: { color: "#56697A" },
  passBtn: { 
    marginTop: 12, 
    paddingVertical: 14, 
    backgroundColor: "#16222E", 
    borderColor: "#28394B", 
    borderWidth: 1.5, 
    borderRadius: 16, 
    alignItems: "center" 
  },
  passBtnText: { color: "#F3F7FA", fontSize: 14, fontWeight: "800" },
  answeringText: { color: "#7CFF5C", textAlign: "center", fontWeight: "800", marginBottom: 12 },
  input: { backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 14, padding: 16, color: "#F3F7FA", fontSize: 16, marginBottom: 12 },
  suggestBox: { 
    marginTop: -8, 
    marginBottom: 12, 
    backgroundColor: "#0A141C", 
    borderColor: "#28394B", 
    borderWidth: 1, 
    borderRadius: 12, 
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    zIndex: 10,
  },
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
  suggestRow: { paddingVertical: 10, paddingHorizontal: 14, borderBottomColor: "#1B2A38", borderBottomWidth: 1 },
  suggestText: { color: "#7CFF5C", fontSize: 14, fontWeight: "600" },
  primaryBtn: { backgroundColor: "#7CFF5C", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  micBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#16222E",
    borderColor: "#28394B",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  micBtnActive: { backgroundColor: "#FF5D5D", borderColor: "#FF5D5D" },
  micBtnText: { fontSize: 22 },
  micBtnBig: {
    backgroundColor: "#7CFF5C",
    borderRadius: 20,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  micBtnBigText: { color: "#0B1620", fontWeight: "900", fontSize: 18 },
  heardBanner: { backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 4 },
  heardBannerText: { color: "#F3F7FA", fontSize: 14, fontStyle: "italic", textAlign: "center" },
  switchModeLink: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: "#16222E",
    borderColor: "#7CFF5C",
    borderWidth: 1.5,
    borderRadius: 16,
    alignItems: "center"
  },
  switchModeLinkText: { color: "#7CFF5C", fontSize: 14, fontWeight: "800" },
  voiceError: { color: "#FF5D5D", fontSize: 12, textAlign: "center", marginTop: 8 },
  voiceHint: { color: "#8CA0B3", fontSize: 12, textAlign: "center", marginTop: 8 },
  primaryBtnText: { color: "#0B1620", fontWeight: "900", textTransform: "uppercase", fontSize: 13 },
  resultText: { color: "#F3F7FA", fontWeight: "900", fontSize: 18, marginBottom: 8 },
  answersText: { color: "#8CA0B3", fontSize: 12, textAlign: "center", marginBottom: 12 },
  showAnswersBtn: { borderColor: "#7CFF5C", borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18, marginBottom: 12 },
  showAnswersBtnText: { color: "#7CFF5C", fontSize: 13, fontWeight: "700" },
  answersBox: { maxHeight: 160, width: "100%", backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 14, marginBottom: 12 },
  answersBoxItem: { color: "#F3F7FA", fontSize: 13, paddingVertical: 5 },
  answersBoxRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  backLink: { color: "#8CA0B3", textAlign: "center", fontSize: 12 },
});
