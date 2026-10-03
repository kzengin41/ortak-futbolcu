import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ModKurulum, { KurulumBolum, SecimCipleri, ZorlukSecici, SureSecici, KapsamDugmesi } from "../components/ModKurulum";
import { useModVarsayilanlari, useKurulumKapisi, oyunBilgisiniYaz, ayarSatirlari, MOD_TANIMLARI } from "../lib/modAyarlari";
import { MODE_COLORS } from "../lib/theme";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { useAudioPlayer } from "expo-audio";
import { PLAYERS } from "../lib/players";
import { CLUB_INFO } from "../lib/clubs";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import { useAppSettings } from "../lib/SettingsContext";
import { generateRound, computeRoundPool, findMatchedPlayer, suggestPlayers, buildSuggestIndex, ANSWER_SECONDS, ROUND_TIME_OPTIONS, sesIpuclari } from "../lib/gameEngine";
import { playerWeight, recognitionScore } from "../lib/clubWeights";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { useVoiceInput } from "../lib/useVoiceInput";
import VoiceConfirm from "../components/VoiceConfirm";
import ReportModal from "../components/ReportModal";
import AnswerFeedback from "../components/AnswerFeedback";
import CountdownOverlay from "../components/CountdownOverlay";
import TeamBadge from "../components/TeamBadge";
import PlayerPhoto, { oncedenYukle } from "../components/PlayerPhoto";
import EslesmeProfiliPenceresi from "../components/EslesmeProfiliPenceresi";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import TimerBar from "../components/TimerBar";
import { useOyuncuAdlari, OyuncuAdlariBolumu, IsimliSkorTablosu } from "../components/OyuncuAdlari";

const count3Source = require("../assets/sounds/count-3.mp3");
const count2Source = require("../assets/sounds/count-2.mp3");
const count1Source = require("../assets/sounds/count-1.mp3");

// 31 Ağustos 2026 (Kerem: "Galibiyet sınırı olmayan modlara galibiyet sınırı
// ekleyelim. Başta seçmeli olsun.") — targetScore state zaten vardı ama
// hiçbir yerde kullanılmıyordu (oyun sonsuza dek sürüyordu). Infinity =
// "Sınırsız".
const WIN_LIMIT_OPTIONS = [
  { label: "3", value: 3 },
  { label: "5", value: 5 },
  { label: "7", value: 7 },
  { label: "10", value: 10 },
  { label: "Sınırsız", value: Infinity },
];

export default function LocalGameScreen({ onExit, onExitSilent }) {
  // 4 Ekim 2026 (.28810) — oyuncu adları (Ayarlar'da saklanır), isimli skor + rövanş.
  const { adlar } = useOyuncuAdlari(2);
  const adi = (w) => (w === "p1" ? adlar[0] : adlar[1]);
  const [started, setStarted] = useState(false);
  const [roundSeconds, setRoundSeconds] = useState(ROUND_TIME_OPTIONS[1]);
  const [targetScore, setTargetScore] = useState(5);
  // 28 Eylül 2026 — lig/kapsam yerine Eşleşme Profili (bkz. lib/eslesmeProfili.js)
  const eslesme = useEslesmeProfili();
  const { settings: appSettings, loaded: appSettingsLoaded } = useAppSettings();
  const [leagueModalOpen, setLeagueModalOpen] = useState(false);
  const [inputMode, setInputMode] = useState("voice"); // "keyboard" | "voice"
  const [viewMode, setViewMode] = useState("side"); // "side" | "mirror"
  const [usedPairs, setUsedPairs] = useState(new Set());
  const [round, setRound] = useState(null);
  const [phase, setPhase] = useState("countdown"); // countdown | racing | answering | result
  const [buzzedBy, setBuzzedBy] = useState(null); // 'p1' | 'p2'
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
  const [lastPlayer, setLastPlayer] = useState("");
  const [showResultPanel, setShowResultPanel] = useState(true);
  const [heardText, setHeardText] = useState(null);

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
  const [scoreP2, setScoreP2] = useState(0);

  // Eşleşme profili (lib/eslesmeProfili.js) kapsamı: izin verilen kulüpler
  // onu kullan, yoksa standart ön ayarı isme göre çöz.
  const allowedClubs = eslesme.derlenmis.kapsam;
  const [difficulty, setDifficulty] = useState(5); // 1-10 (bkz. lib/modAyarlari.js)
  const presetLabel = eslesme.derlenmis.etiket;
  const pool = useMemo(() => computeRoundPool(PLAYERS, eslesme.derlenmis, difficulty), [eslesme.derlenmis, difficulty]);

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
    setFeedback(null);
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
    if (phase !== "racing") return;
    if (isProcessing || sesOnayIstegi) return;
    if (timeLeft <= 0) {
      endRound(null, "Süre doldu, kimse bilemedi.");
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, isProcessing, sesOnayIstegi]);

  useEffect(() => {
    if (phase !== "answering") return;
    if (isProcessing || sesOnayIstegi) return;
    if (answerTimeLeft <= 0) {
      submitAnswer();
      return;
    }
    const t = setTimeout(() => setAnswerTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answerTimeLeft, isProcessing, sesOnayIstegi]);

  function handleBuzz(who) {
    if (phase !== "racing" || lockedOut.has(who) || !round) return;
    setBuzzedBy(who);
    setPhase("answering");
    setAnswerTimeLeft(ANSWER_SECONDS);
  }

  // Mikrofon modunda: buzz + kayıt başlatma TEK dokunuşta.
  async function handleBuzzAndSpeak(who) {
    handleBuzz(who);
    setVoiceError(null);
    try {
      await startRecording();
    } catch (err) {
      setVoiceError(err.message || "Mikrofona erişilemedi");
    }
  }

  function lockPlayer(who) {
    const nextLocked = new Set(lockedOut);
    nextLocked.add(who);
    setLockedOut(nextLocked);
    const remaining = ["p1", "p2"].filter((o) => !nextLocked.has(o));
    if (remaining.length === 0) {
      endRound(null, "İkisi de bilemedi.");
    } else if (phase !== "racing") {
      setBuzzedBy(null);
      setPhase("racing");
    }
  }

  function handlePass(who) {
    if (phase !== "racing" || lockedOut.has(who) || !round) return;
    lockPlayer(who);
  }

  function submitAnswer(overrideText) {
    if (!round) return;
    const text = overrideText !== undefined ? overrideText : answerInput;
    const matched = findMatchedPlayer(text, round.validAnswers);
    if (matched) {
      endRound(buzzedBy, `Doğru! (${text.trim()})`, matched);
    } else {
      setAnswerInput("");
      lockPlayer(buzzedBy);
    }
  }

  function handleSuggestionTap(name) {
    setAnswerInput(name);
    submitAnswer(name);
  }

  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const suggestions = useMemo(() => suggestPlayers(suggestIndex, answerInput), [suggestIndex, answerInput]);

  function endRound(winner, text, player) {
    if (player) unlockPlayer(player.name); // Ansiklopedi: oyun içinde ismi geçen herkes açılmaya aday
    setResultText(text);
    setLastWinner(winner);
    setWinningPlayer(player || null);
    setShowAnswers(false);
    setPhase("result");
    // Sıcak Koltuk 2 oyunculu, cihaz sahibi p1 kabul edilip istatistikler ona göre kaydediliyor.
    if (winner === "p1" || winner === "p2") recordRound("local", winner === "p1");
    if (winner === "p1") {
      setScoreP1((s) => {
        const next = s + 1;
        if (next >= targetScore) setTimeout(() => setPhase("gameOver"), 3000);
        return next;
      });
      playCorrect();
      setFeedback("correct");
      setShowResultPanel(false);
    } else if (winner === "p2") {
      setScoreP2((s) => {
        const next = s + 1;
        if (next >= targetScore) setTimeout(() => setPhase("gameOver"), 3000);
        return next;
      });
      playCorrect();
      setFeedback("correct");
      setShowResultPanel(false);
    } else {
      setShowResultPanel(true);
    }
  }

  // 27 Eylül 2026 — merkezî mod ayarları (lib/modAyarlari.js): varsayılanlar
  // Ayarlar'dan gelir, kurulumda değiştirilebilir, oyun içinde "?" ile görülür.
  const modVarsayilanKaydet = useModVarsayilanlari("local", { zorluk: setDifficulty, sure: setRoundSeconds, galibiyet: setTargetScore, yontem: setInputMode });
  // 4 Ekim 2026 — kurulumsuz başlangıç (.27319): mod son ayarlarla hemen başlar;
  // kurulum sol alttaki ⚙ ya da mod rehberindeki "Ayarları değiştir" ile açılır.
  useKurulumKapisi("local", {
    kurulumda: !started,
    baslat: () => setStarted(true),
    kurulumaDon: () => { setStarted(false); setScoreP1(0); setScoreP2(0); },
  });
  useEffect(() => {
    oyunBilgisiniYaz("local", { satirlar: ayarSatirlari({ zorluk: difficulty, sure: roundSeconds, galibiyet: targetScore, lig: presetLabel, yontem: inputMode }) });
  }, [difficulty, roundSeconds, targetScore, presetLabel, inputMode]);

  if (!started) {
    // 27 Eylül 2026 (Kerem: "her mod için zorluk ayarı olmalı. süre ayarı
    // olmalı. her moddaki mimari dizayn aynı olmalı.") — kurulum ekranı artık
    // ortak ModKurulum parçalarıyla kuruluyor (bkz. components/ModKurulum.js).
    return (
      <ModKurulum
        baslik="Ortak Kulüp — Yanımdaki"
        aciklama="İki kulüp çıkar. İkisinde de oynamış futbolcuyu ilk söyleyen turu alır."
        vurgu={MODE_COLORS.hotSeat}
        onGeri={onExitSilent || onExit}
        onVarsayilanKaydet={() => modVarsayilanKaydet({ zorluk: difficulty, sure: roundSeconds, galibiyet: targetScore, yontem: inputMode })}
        onBasla={() => setStarted(true)}
      >
        <KurulumBolum baslik="ZORLUK">
          <ZorlukSecici deger={difficulty} onDegis={setDifficulty} aciklama={(z) => (z <= 3 ? "Sadece efsaneler ve süper yıldızlar sorulur." : z <= 7 ? "Büyük liglerin bilinen oyuncuları sorulur." : "Az bilinen oyuncular da sorulur.")} />
        </KurulumBolum>
        <KurulumBolum baslik="TUR SÜRESİ">
          <SureSecici
            secenekler={MOD_TANIMLARI.local.sure.secenekler}
            deger={roundSeconds}
            onDegis={setRoundSeconds}
            asgari={MOD_TANIMLARI.local.sure.asgari}
            azami={MOD_TANIMLARI.local.sure.azami}
            aciklama={MOD_TANIMLARI.local.sure.aciklama}
          />
        </KurulumBolum>
        <KurulumBolum baslik="GALİBİYET SINIRI">
          <SecimCipleri
            secenekler={WIN_LIMIT_OPTIONS.map((o) => ({ deger: o.value, etiket: o.label }))}
            secili={targetScore}
            onSec={setTargetScore}
          />
        </KurulumBolum>
        <OyuncuAdlariBolumu adet={2} />
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
        <KurulumBolum baslik="EŞLEŞME PROFİLİ">
          <KapsamDugmesi etiket={presetLabel} onPress={() => setLeagueModalOpen(true)} />
        </KurulumBolum>
        <EslesmeProfiliPenceresi
          visible={leagueModalOpen}
          profil={eslesme.profil}
          onUygula={(p) => { eslesme.setMacProfili(p); setLeagueModalOpen(false); }}
          onVarsayilanYap={(p) => { eslesme.genelKaydet(p); setLeagueModalOpen(false); }}
          onClose={() => setLeagueModalOpen(false)}
        />
      </ModKurulum>
    );
  }

  if (!round) {
    return (
      <GameBackground style={styles.container}>
        <Text style={styles.center}>Bu veri setiyle yeni eşleşme kalmadı.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => { setUsedPairs(new Set()); startNewRound(); }}>
          <Text style={styles.primaryBtnText}>Sıfırla</Text>
        </Pressable>
      </GameBackground>
    );
  }

  const p1Locked = lockedOut.has("p1");
  const p2Locked = lockedOut.has("p2");

  function renderPlayerButtons(who) {
    const locked = who === "p1" ? p1Locked : p2Locked;
    const label = adi(who);
    return (
      <>
        <SoundPressable
          disabled={locked}
          onPress={() => (inputMode === "voice" ? handleBuzzAndSpeak(who) : handleBuzz(who))}
          style={[styles.buzzBtn, locked && styles.buzzBtnDisabled]}
        >
          {/* 4 Ekim 2026 (benchmark: "iki kişilikte buzz yerine anlaşılır bir ad
              ve hareket") — düğme ne yaptığını söylüyor: BİLİYORUM! */}
          <Text style={[styles.buzzBtnText, locked && styles.buzzBtnTextDisabled]}>
            {locked ? `${label} · kilitli` : "BİLİYORUM!"}
          </Text>
          {!locked ? <Text style={styles.buzzBtnAlt}>{label}</Text> : null}
        </SoundPressable>
        <SoundPressable disabled={locked} onPress={() => handlePass(who)} style={styles.passBtn}>
          <Text style={styles.passBtnText}>{locked ? "Bilemedi" : "Bilemedim"}</Text>
        </SoundPressable>
      </>
    );
  }

  function renderAnsweringUI(who) {
    if (buzzedBy !== who) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={styles.answeringText}>
            Rakip cevaplıyor... {answerTimeLeft} sn
          </Text>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={styles.answeringText}>
          {adi(buzzedBy)} biliyor — {answerTimeLeft} sn
        </Text>
        {inputMode === "voice" ? (
          <>
            {heardText && (
              <View style={styles.heardBanner}>
                <Text style={styles.heardBannerText}>Anladığım: "{heardText}"</Text>
              </View>
            )}
            <SoundPressable
              style={[styles.micBtnBig, isRecording && styles.micBtnActive, { paddingVertical: 12 }]}
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
          </>
        ) : (
          <>
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
              style={[styles.input, { padding: 8, marginBottom: 4 }]}
            />
            {suggestions.length > 0 && (
              <View style={[styles.suggestBox, { marginBottom: 4 }]}>
                {suggestions.slice(0,2).map((name) => (
                  <Pressable key={name} onPress={() => handleSuggestionTap(name)} style={[styles.suggestRow, { padding: 8 }]}>
                    <Text style={styles.suggestText}>{name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <SoundPressable style={[styles.primaryBtn, { flex: 1, paddingVertical: 10 }]} onPress={() => submitAnswer()}>
                <Text style={styles.primaryBtnText}>Gönder</Text>
              </SoundPressable>
            </View>
          </>
        )}
      </View>
    );
  }


  return (
    <GameBackground style={styles.container} klavye="kaydir">
      {/* 28 Eylül 2026 — klavye cevap kutusunu kapatıyordu (denetim bulgusu #1). */}
      <View style={{ flex: 1, width: "100%", justifyContent: "center" }}>
      {showReport && <ReportModal visible={showReport} onClose={() => setShowReport(false)} playerContext={lastPlayer || (typeof winningPlayer !== 'undefined' && winningPlayer ? winningPlayer.name : "Bilinmiyor")} />}

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
        <CountdownOverlay onComplete={handleCountdownComplete} countPlayers={[countPlayer3, countPlayer2, countPlayer1]} isMirrored={viewMode === "mirror"} />
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

      {viewMode === "side" && (
        <>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreText}>{adlar[0]}: {scoreP1}</Text>
            <Text style={styles.scoreText}>{adlar[1]}: {scoreP2}</Text>
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

          {phase === "racing" && (
            <>
              <TimerBar current={timeLeft} total={roundSeconds} />
              <View style={styles.buzzRow}>
                <View style={{ flex: 1 }}>{renderPlayerButtons("p1")}</View>
                <View style={{ flex: 1 }}>{renderPlayerButtons("p2")}</View>
              </View>
            </>
          )}
        </>
      )}

      {viewMode === "mirror" && (phase === "racing" || phase === "answering") && (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, transform: [{ rotate: "180deg" }] }}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreText}>Rakip: {scoreP2}</Text>
              <Text style={styles.scoreText}>Ben: {scoreP1}</Text>
            </View>
            <View style={[styles.teamsCard, { paddingVertical: 12 }]}>
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
            <TimerBar current={timeLeft} total={roundSeconds} />
            <View style={{ flex: 1, justifyContent: "center" }}>
              {/* 12 Eylül 2026 — AYNA MODU OYNANAMIYORDU. renderAnsweringUI
                  yazılmış ama hiçbir yerden çağrılmıyordu; normal cevap bloğu
                  ise aşağıda `viewMode !== "mirror"` ile kapatılmış. Sonuç:
                  ayna modunda biri buzz'ladığında ekranda hiçbir giriş alanı
                  çıkmıyor, 12 saniye boşa akıyor ve oyuncu kilitleniyordu.
                  renderAnsweringUI zaten bu kompakt yerleşim için yazılmıştı. */}
              {phase === "answering" ? renderAnsweringUI("p1") : renderPlayerButtons("p1")}
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreText}>Ben: {scoreP2}</Text>
              <Text style={styles.scoreText}>Rakip: {scoreP1}</Text>
            </View>
            <View style={[styles.teamsCard, { paddingVertical: 12 }]}>
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
            <TimerBar current={timeLeft} total={roundSeconds} />
            <View style={{ flex: 1, justifyContent: "center" }}>
              {phase === "answering" ? renderAnsweringUI("p2") : renderPlayerButtons("p2")}
            </View>
          </View>
        </View>
      )}

      {phase === "answering" && viewMode !== "mirror" && (
        <View style={[{ marginTop: 20, flex: 1, justifyContent: "center" }, viewMode === "mirror" && buzzedBy === "p1" && { transform: [{ rotate: "180deg" }] }]}>
          <Text style={styles.answeringText}>
            {adi(buzzedBy)} biliyor — {answerTimeLeft} sn
          </Text>
          {inputMode === "voice" ? (
            <>
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
              <SoundPressable onPress={() => setInputMode("keyboard")} style={{ marginTop: 14, alignItems: "center" }}>
                <Text style={styles.switchModeLink}>Bunun yerine yazmak istiyorum</Text>
              </SoundPressable>
            </>
          ) : (
            <>
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
              <SoundPressable onPress={() => setInputMode("voice")} style={{ marginTop: 10, alignItems: "center" }}>
                <Text style={styles.switchModeLink}>Bunun yerine konuşmak istiyorum</Text>
              </SoundPressable>
            </>
          )}
        </View>
      )}

      {phase === "result" && showResultPanel && (
        <View style={{ marginTop: 20, alignItems: "center", width: "100%" }}>
          {winningPlayer && <PlayerPhoto name={winningPlayer.name} size={84} />}
          <Text style={[styles.resultText, winningPlayer && { marginTop: 12 }]}>{resultText}</Text>
          {!showAnswers && (
            <Pressable style={styles.showAnswersBtn} hitSlop={10} onPress={() => setShowAnswers(true)}>
              <Text style={styles.showAnswersBtnText}>
                {lastWinner ? "Diğer doğru cevapları göster" : "Doğru cevapları göster"}
              </Text>
            </Pressable>
          )}
          {showAnswers && (
            <ScrollView style={styles.answersBox} contentContainerStyle={{ padding: 12 }} nestedScrollEnabled>
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
          <Pressable style={styles.primaryBtn} onPress={startNewRound}>
            <Text style={styles.primaryBtnText}>Sıradaki Tur</Text>
          </Pressable>
        </View>
      )}

      {phase === "gameOver" && (
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 4 }}>
          <IsimliSkorTablosu
            modAdi="Ortak Kulüp — Yanımdaki"
            oyuncular={[{ ad: adlar[0], puan: scoreP1 }, { ad: adlar[1], puan: scoreP2 }]}
            onRovans={() => {
              setScoreP1(0);
              setScoreP2(0);
              setUsedPairs(new Set());
              startNewRound();
            }}
            onMenu={onExitSilent || onExit}
          />
        </View>
      )}

      {(!started || phase === "result") && (
        <Pressable onPress={onExit} style={{ marginTop: 24 }}>
          <Text style={styles.backLink}>Menüye dön</Text>
        </Pressable>
      )}
      </View>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1620", padding: 20, justifyContent: "center" },
  scrollContainer: { flex: 1, backgroundColor: "#0B1620", padding: 20 },
  title: { color: "#F3F7FA", fontSize: 20, fontWeight: "900", textAlign: "center" },
  diffBtn: { borderColor: "#28394B", borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  diffBtnActive: { borderColor: "#7CFF5C", backgroundColor: "#16222E" },
  diffBtnText: { color: "#8CA0B3", fontWeight: "800", fontSize: 13 },
  diffBtnTextActive: { color: "#7CFF5C" },
  center: { color: "#F3F7FA", textAlign: "center", marginBottom: 16 },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  scoreText: { color: "#8CA0B3", fontWeight: "700", fontSize: 13 },
  teamsCard: { flexDirection: "row", backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 18, padding: 20, alignItems: "center", justifyContent: "center" },
  teamName: { color: "#F3F7FA", fontSize: 14, fontWeight: "900", textAlign: "center", marginTop: 8 },
  plus: { color: "#7CFF5C", fontWeight: "900", fontSize: 18, marginHorizontal: 8 },
  timerText: { color: "#8CA0B3", textAlign: "center", marginTop: 16, fontSize: 12 },
  buzzRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  buzzBtn: { flex: 1, borderColor: "#7CFF5C", borderWidth: 2, borderRadius: 18, paddingVertical: 36, alignItems: "center" },
  buzzBtnDisabled: { borderColor: "#28394B" },
  buzzBtnText: { color: "#7CFF5C", fontWeight: "900", fontSize: 16, letterSpacing: 0.5 },
  buzzBtnAlt: { color: "#8CA0B3", fontWeight: "700", fontSize: 12, marginTop: 4 },
  buzzBtnTextDisabled: { color: "#8CA0B3" },
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
  suggestBox: { marginTop: -6, marginBottom: 12, backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 12, overflow: "hidden" },
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
  primaryBtn: { backgroundColor: "#7CFF5C", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  micBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#16222E",
    borderColor: "#28394B",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  micBtnActive: { backgroundColor: "#FF5D5D", borderColor: "#FF5D5D" },
  micBtnText: { fontSize: 22 },
  micBtnBig: {
    backgroundColor: "#7CFF5C",
    borderRadius: 20,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  micBtnBigText: { color: "#0B1620", fontWeight: "900", fontSize: 18 },
  heardBanner: { backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 4 },
  heardBannerText: { color: "#F3F7FA", fontSize: 14, fontStyle: "italic", textAlign: "center" },
  switchModeLink: { color: "#7CFF5C", fontSize: 12, fontWeight: "700" },
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
