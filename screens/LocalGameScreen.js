import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { _t } from "../lib/dil";
import ModKurulum, { KurulumBolum, SecimCipleri, ZorlukSecici, SureSecici, KapsamDugmesi } from "../components/ModKurulum";
import { useModVarsayilanlari, useKurulumKapisi, oyunBilgisiniYaz, ayarSatirlari, MOD_TANIMLARI } from "../lib/modAyarlari";
import { MODE_COLORS, COLORS, saydam } from "../lib/theme";
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
import EslesmeKarti from "../components/EslesmeKarti";
import PlayerPhoto, { oncedenYukle } from "../components/PlayerPhoto";
import EslesmeProfiliPenceresi from "../components/EslesmeProfiliPenceresi";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import TimerBar from "../components/TimerBar";
import { useOyuncuAdlari, OyuncuAdlariBolumu, IsimliSkorTablosu } from "../components/OyuncuAdlari";
import { OyunUstCubugu, SkorSeridi } from "../components/MacCercevesi";

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
  { label: _t("Sınırsız"), value: Infinity },
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
    try { await startRecording(); } catch (err) { setVoiceError(err.message || _t("Mikrofona erisilemedi")); }
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
          setVoiceError(_t("Sesi anlayamadım, tekrar dener misin?"));
        }
      } catch (err) {
        setVoiceError(err.message || _t("Ses tanıma başarısız oldu"));
      }
    } else {
      try {
        await startRecording();
      } catch (err) {
        setVoiceError(err.message || _t("Mikrofona erişilemedi"));
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
      endRound(null, _t("Süre doldu, kimse bilemedi."));
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
      setVoiceError(err.message || _t("Mikrofona erişilemedi"));
    }
  }

  function lockPlayer(who) {
    const nextLocked = new Set(lockedOut);
    nextLocked.add(who);
    setLockedOut(nextLocked);
    const remaining = ["p1", "p2"].filter((o) => !nextLocked.has(o));
    if (remaining.length === 0) {
      endRound(null, _t("İkisi de bilemedi."));
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
      endRound(buzzedBy, _t("Doğru! ({0})", [text.trim()]), matched);
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
        modId="local"
        baslik={_t("Ortak Kulüp — Yanımdaki")}
        aciklama={_t("İki kulüp çıkar. İkisinde de oynamış futbolcuyu ilk söyleyen turu alır.")}
        vurgu={MODE_COLORS.hotSeat}
        onGeri={onExitSilent || onExit}
        onVarsayilanKaydet={() => modVarsayilanKaydet({ zorluk: difficulty, sure: roundSeconds, galibiyet: targetScore, yontem: inputMode })}
        onBasla={() => setStarted(true)}
      >
        <KurulumBolum baslik={_t("ZORLUK")}>
          <ZorlukSecici deger={difficulty} onDegis={setDifficulty} aciklama={(z) => (z <= 3 ? _t("Sadece efsaneler ve süper yıldızlar sorulur.") : z <= 7 ? _t("Büyük liglerin bilinen oyuncuları sorulur.") : _t("Az bilinen oyuncular da sorulur."))} />
        </KurulumBolum>
        <KurulumBolum baslik={_t("TUR SÜRESİ")}>
          <SureSecici
            secenekler={MOD_TANIMLARI.local.sure.secenekler}
            deger={roundSeconds}
            onDegis={setRoundSeconds}
            asgari={MOD_TANIMLARI.local.sure.asgari}
            azami={MOD_TANIMLARI.local.sure.azami}
            aciklama={MOD_TANIMLARI.local.sure.aciklama}
          />
        </KurulumBolum>
        <KurulumBolum baslik={_t("GALİBİYET SINIRI")}>
          <SecimCipleri
            secenekler={WIN_LIMIT_OPTIONS.map((o) => ({ deger: o.value, etiket: o.label }))}
            secili={targetScore}
            onSec={setTargetScore}
          />
        </KurulumBolum>
        <OyuncuAdlariBolumu adet={2} />
        <KurulumBolum baslik={_t("CEVAP YÖNTEMİ")}>
          <SecimCipleri
            secenekler={[
              { deger: "keyboard", etiket: _t("Klavye"), ikon: "keypad" },
              { deger: "voice", etiket: _t("Mikrofon"), ikon: "mic" },
            ]}
            secili={inputMode}
            onSec={setInputMode}
          />
        </KurulumBolum>
        <KurulumBolum baslik={_t("EŞLEŞME PROFİLİ")}>
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
        <Text style={styles.center}>{_t("Bu veri setiyle yeni eşleşme kalmadı.")}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => { setUsedPairs(new Set()); startNewRound(); }}>
          <Text style={styles.primaryBtnText}>{_t("Sıfırla")}</Text>
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
            {locked ? _t("{0} · kilitli", [label]) : _t("BİLİYORUM!")}
          </Text>
          {!locked ? <Text style={styles.buzzBtnAlt}>{label}</Text> : null}
        </SoundPressable>
        <SoundPressable disabled={locked} onPress={() => handlePass(who)} style={styles.passBtn}>
          <Text style={styles.passBtnText}>{locked ? _t("Bilemedi") : _t("Bilemedim")}</Text>
        </SoundPressable>
      </>
    );
  }

  function renderAnsweringUI(who) {
    if (buzzedBy !== who) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={styles.answeringText}>{_t("Rakip cevaplıyor...")}{" "}{answerTimeLeft}{" "}{_t("sn")}</Text>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={styles.answeringText}>
          {adi(buzzedBy)}{" "}{_t("biliyor —")}{" "}{answerTimeLeft}{" "}{_t("sn")}</Text>
        {inputMode === "voice" ? (
          <>
            {heardText && (
              <View style={styles.heardBanner}>
                <Text style={styles.heardBannerText}>{_t("Anladığım: \"")}{heardText}"</Text>
              </View>
            )}
            <SoundPressable
              style={[styles.micBtnBig, isRecording && styles.micBtnActive, { paddingVertical: 12 }]}
              onPress={handleMicPress}
              disabled={isProcessing}
            >
              <Text style={styles.micBtnBigText}>{isProcessing ? _t("İşleniyor…") : isRecording ? _t("Durdur") : _t("Konuş")}</Text>
            </SoundPressable>
            {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
            <VoiceConfirm
              istek={sesOnayIstegi}
              onOnayla={sesOnayla}
              onTekrar={sesTekrar}
              onYaz={sesYaz}
              onIptal={() => setSesOnayIstegi(null)}
            />
            {isRecording && <Text style={styles.voiceHint}>{_t("Dinliyorum...")}</Text>}
            {isProcessing && <Text style={styles.voiceHint}>{_t("Yazıya çevriliyor...")}</Text>}
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
              placeholder={_t("Futbolcu adı...")}
              placeholderTextColor={COLORS.textFaint}
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
                <Text style={styles.primaryBtnText}>{_t("Gönder")}</Text>
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
      {showReport && <ReportModal visible={showReport} onClose={() => setShowReport(false)} playerContext={lastPlayer || (typeof winningPlayer !== 'undefined' && winningPlayer ? winningPlayer.name : _t("Bilinmiyor"))} />}

      {/* GLOBAL TOP HEADER — 31 Ağustos 2026 (Kerem: "üstteki butonların
          konumlandırması çirkin"): artık absolute/top:40 ile içerikle
          çakışmıyor, normal akışta kendi satırını alıyor. */}
      {/* Paket 31 — standart üst çubuk */}
      <OyunUstCubugu
        baslik={_t("Ortak Kulüp")}
        alt={_t("Yanımdaki · 2 kişi")}
        onCikis={onExit}
        onBildir={() => setShowReport(true)}
        style={{ paddingHorizontal: 16, marginTop: 6 }}
      />

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
          <SkorSeridi
            sol={{ etiket: String(adlar[0]).toLocaleUpperCase("tr"), puan: scoreP1, renk: COLORS.accent }}
            sag={{ etiket: String(adlar[1]).toLocaleUpperCase("tr"), puan: scoreP2, renk: COLORS.cta }}
            orta={_t("{0}'te biter", [targetScore || 5])}
          />

          <EslesmeKarti sol={{ tip: "kulup", ad: round.teamA }} sag={{ tip: "kulup", ad: round.teamB }} style={{ marginBottom: 12 }} />

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
              <Text style={styles.scoreText}>{_t("Rakip:")}{" "}{scoreP2}</Text>
              <Text style={styles.scoreText}>{_t("Ben:")}{" "}{scoreP1}</Text>
            </View>
            <EslesmeKarti kompakt sol={{ tip: "kulup", ad: round.teamA }} sag={{ tip: "kulup", ad: round.teamB }} style={{ marginBottom: 8 }} />
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
              <Text style={styles.scoreText}>{_t("Ben:")}{" "}{scoreP2}</Text>
              <Text style={styles.scoreText}>{_t("Rakip:")}{" "}{scoreP1}</Text>
            </View>
            <EslesmeKarti kompakt sol={{ tip: "kulup", ad: round.teamA }} sag={{ tip: "kulup", ad: round.teamB }} style={{ marginBottom: 8 }} />
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
            {adi(buzzedBy)}{" "}{_t("biliyor —")}{" "}{answerTimeLeft}{" "}{_t("sn")}</Text>
          {inputMode === "voice" ? (
            <>
              {heardText && (
                <View style={styles.heardBanner}>
                  <Text style={styles.heardBannerText}>{_t("Anladığım: \"")}{heardText}"</Text>
                </View>
              )}
              <SoundPressable
                style={[styles.micBtnBig, isRecording && styles.micBtnActive]}
                onPress={handleMicPress}
                disabled={isProcessing}
              >
                <Text style={styles.micBtnBigText}>{isProcessing ? _t("İşleniyor…") : isRecording ? _t("Durdur") : _t("Konuş")}</Text>
              </SoundPressable>
              {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
            <VoiceConfirm
              istek={sesOnayIstegi}
              onOnayla={sesOnayla}
              onTekrar={sesTekrar}
              onYaz={sesYaz}
              onIptal={() => setSesOnayIstegi(null)}
            />
              {isRecording && <Text style={styles.voiceHint}>{_t("Dinliyorum...")}</Text>}
              {isProcessing && <Text style={styles.voiceHint}>{_t("Yazıya çevriliyor...")}</Text>}
              <SoundPressable onPress={() => setInputMode("keyboard")} style={{ marginTop: 14, alignItems: "center" }}>
                <Text style={styles.switchModeLink}>{_t("Bunun yerine yazmak istiyorum")}</Text>
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
                placeholder={_t("Futbolcu adı...")}
                placeholderTextColor={COLORS.textFaint}
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
                  <Text style={styles.primaryBtnText}>{_t("Gönder")}</Text>
                </SoundPressable>
                <SoundPressable
                  style={[styles.micBtn, isRecording && styles.micBtnActive]}
                  onPress={handleMicPress}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Ionicons name="hourglass" size={20} color={COLORS.text} /> : isRecording ? <Ionicons name="stop" size={20} color="#fff" /> : <Ionicons name="mic" size={20} color={COLORS.text} />}
                </SoundPressable>
              </View>
              {heardText && (
                <View style={styles.heardBanner}>
                  <Text style={styles.heardBannerText}>{_t("Anladığım: \"")}{heardText}"</Text>
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
              {isRecording && <Text style={styles.voiceHint}>{_t("Dinliyorum — durdurmak için dokun")}</Text>}
              {isProcessing && <Text style={styles.voiceHint}>{_t("Yazıya çevriliyor...")}</Text>}
              <SoundPressable onPress={() => setInputMode("voice")} style={{ marginTop: 10, alignItems: "center" }}>
                <Text style={styles.switchModeLink}>{_t("Bunun yerine konuşmak istiyorum")}</Text>
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
                {lastWinner ? _t("Diğer doğru cevapları göster") : _t("Doğru cevapları göster")}
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
            <Text style={styles.primaryBtnText}>{_t("Sıradaki Tur")}</Text>
          </Pressable>
        </View>
      )}

      {phase === "gameOver" && (
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 4 }}>
          <IsimliSkorTablosu
            modAdi={_t("Ortak Kulüp — Yanımdaki")}
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
          <Text style={styles.backLink}>{_t("Menüye dön")}</Text>
        </Pressable>
      )}
      </View>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20, justifyContent: "center" },
  scrollContainer: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  diffBtn: { borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  diffBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.card },
  diffBtnText: { color: COLORS.textMuted, fontWeight: "800", fontSize: 13 },
  diffBtnTextActive: { color: COLORS.accent },
  center: { color: COLORS.text, textAlign: "center", marginBottom: 16 },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  scoreText: { color: COLORS.textMuted, fontWeight: "700", fontSize: 13 },
  teamsCard: { flexDirection: "row", backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 18, padding: 20, alignItems: "center", justifyContent: "center" },
  teamName: { color: COLORS.text, fontSize: 14, fontWeight: "900", textAlign: "center", marginTop: 8 },
  plus: { color: COLORS.accent, fontWeight: "900", fontSize: 18, marginHorizontal: 8 },
  timerText: { color: COLORS.textMuted, textAlign: "center", marginTop: 16, fontSize: 12 },
  buzzRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  buzzBtn: { flex: 1, borderColor: COLORS.accent, borderWidth: 2, borderRadius: 18, paddingVertical: 36, alignItems: "center" },
  buzzBtnDisabled: { borderColor: COLORS.cardBorder },
  buzzBtnText: { color: COLORS.accent, fontWeight: "900", fontSize: 16, letterSpacing: 0.5 },
  buzzBtnAlt: { color: COLORS.textMuted, fontWeight: "700", fontSize: 12, marginTop: 4 },
  buzzBtnTextDisabled: { color: COLORS.textMuted },
  passBtn: { 
    marginTop: 12, 
    paddingVertical: 14, 
    backgroundColor: COLORS.card, 
    borderColor: COLORS.cardBorder, 
    borderWidth: 1.5, 
    borderRadius: 16, 
    alignItems: "center" 
  },
  passBtnText: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  answeringText: { color: COLORS.accent, textAlign: "center", fontWeight: "800", marginBottom: 12 },
  input: { backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 14, padding: 16, color: COLORS.text, fontSize: 16, marginBottom: 12 },
  suggestBox: { marginTop: -6, marginBottom: 12, backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  leagueSelectBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  leagueSelectText: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  leagueSelectChevron: { color: COLORS.accent, fontSize: 12, fontWeight: "700" },
  suggestRow: { paddingVertical: 10, paddingHorizontal: 14, borderBottomColor: COLORS.card, borderBottomWidth: 1 },
  suggestText: { color: COLORS.accent, fontSize: 14, fontWeight: "600" },
  primaryBtn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  micBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  micBtnActive: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  micBtnText: { fontSize: 22 },
  micBtnBig: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  micBtnBigText: { color: COLORS.accentDark, fontWeight: "900", fontSize: 18 },
  heardBanner: { backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 4 },
  heardBannerText: { color: COLORS.text, fontSize: 14, fontStyle: "italic", textAlign: "center" },
  switchModeLink: { color: COLORS.accent, fontSize: 12, fontWeight: "700" },
  voiceError: { color: COLORS.danger, fontSize: 12, textAlign: "center", marginTop: 8 },
  voiceHint: { color: COLORS.textMuted, fontSize: 12, textAlign: "center", marginTop: 8 },
  primaryBtnText: { color: COLORS.accentDark, fontWeight: "900", textTransform: "uppercase", fontSize: 13 },
  resultText: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginBottom: 8 },
  answersText: { color: COLORS.textMuted, fontSize: 12, textAlign: "center", marginBottom: 12 },
  showAnswersBtn: { borderColor: COLORS.accent, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18, marginBottom: 12 },
  showAnswersBtnText: { color: COLORS.accent, fontSize: 13, fontWeight: "700" },
  answersBox: { maxHeight: 160, width: "100%", backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 14, marginBottom: 12 },
  answersBoxItem: { color: COLORS.text, fontSize: 13, paddingVertical: 5 },
  answersBoxRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  backLink: { color: COLORS.textMuted, textAlign: "center", fontSize: 12 },
});
