import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import ModKurulum, { KurulumBolum, SecimCipleri, ZorlukSecici, SureSecici, KapsamDugmesi } from "../components/ModKurulum";
import { useModVarsayilanlari, oyunBilgisiniYaz, ayarSatirlari, MOD_TANIMLARI } from "../lib/modAyarlari";
import { MODE_COLORS } from "../lib/theme";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
// 12 Eylül 2026 — CountryClubArcadeScreen importu KALDIRILDI. Bu bileşen
// dosyanın hiçbir yerinde render EDİLMİYORDU ama import edildiği için
// App.js'teki getComponent/lazy-require stratejisini boşa çıkarıyordu: bu
// ekran açıldığında Arcade ekranının tüm modül ağacı da yükleniyordu.
import GameBackground from "../components/GameBackground";
import { useAudioPlayer } from "expo-audio";
import { PLAYERS } from "../lib/players";
import { CLUB_INFO } from "../lib/clubs";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import { useAppSettings } from "../lib/SettingsContext";
import {
  generateCountryTeamRound, computeCountryTeamPool, findMatchedPlayer, suggestPlayers, buildSuggestIndex,
  ANSWER_SECONDS, getCpuProfile, ROUND_TIME_OPTIONS,
  playersForCountryClub, findMatchedTeam, findMatchedCountry, buildCountrySuggestIndex, suggestCountries,
  generateCountryTeamRoundFromCountry, generateCountryTeamRoundFromClub, buildClubSuggestIndex, suggestClubs, sesIpuclari } from "../lib/gameEngine";
import COUNTRIES from "../lib/countries.json";
import { countryTr } from "../lib/countryNamesTr";
import { playerWeight, recognitionScore } from "../lib/clubWeights";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
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
import { flagForCountry } from "../lib/countryFlags";

import PoolEmpty from "../components/PoolEmpty";
import MatchSummary from "../components/MatchSummary";
const count3Source = require("../assets/sounds/count-3.mp3");
const count2Source = require("../assets/sounds/count-2.mp3");
const count1Source = require("../assets/sounds/count-1.mp3");

// 31 Ağustos 2026 (Kerem: "Galibiyet sınırı olmayan modlara galibiyet sınırı
// ekleyelim. Başta seçmeli olsun.") — bu ekranda hiç galibiyet sınırı yoktu,
// oyun skor sonsuza kadar artacak şekilde sürüyordu. Infinity = "Sınırsız".
const WIN_LIMIT_OPTIONS = [
  { label: "3", value: 3 },
  { label: "5", value: 5 },
  { label: "7", value: 7 },
  { label: "10", value: 10 },
  { label: "Sınırsız", value: Infinity },
];

export default function CountryTeamCpuScreen({ onExit, onExitSilent }) {
  // "cpu": mevcut davranış — ülke/kulüp rastgele atanır.
  // "manual": Takım-Takım/draft moduyla birebir aynı mantık — oyuncu SADECE
  // tek tarafı (ülke YA DA kulüp) seçer, rakip (CPU) diğer tarafı seçer.
  // Kim hangi tarafı seçiyor, her turda değişir (manualTurn).
  const [pickMode, setPickMode] = useState("cpu");
  const [manualTurn, setManualTurn] = useState(null); // "country" | "club" — bu turda OYUNCUNUN seçtiği taraf
  const [draftCountry, setDraftCountry] = useState(null);
  const [draftClub, setDraftClub] = useState(null);
  const [countryInput, setCountryInput] = useState("");
  const [clubInput, setClubInput] = useState("");
  const [draftError, setDraftError] = useState("");
  const [difficulty, setDifficulty] = useState(5); // 1-10 (bkz. lib/modAyarlari.js)
  const [roundSeconds, setRoundSeconds] = useState(ROUND_TIME_OPTIONS[1]);
  const [targetScore, setTargetScore] = useState(5);
  // 28 Eylül 2026 — lig/kapsam yerine Eşleşme Profili (bkz. lib/eslesmeProfili.js)
  const eslesme = useEslesmeProfili();
  const { settings: appSettings, loaded: appSettingsLoaded } = useAppSettings();
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
    () => sesIpuclari(PLAYERS, [round?.club])
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
  const [scoreCpu, setScoreCpu] = useState(0);
  const cpuTimeoutRef = useRef(null);

  // Lig filtresi ve oyuncu havuzu SADECE preset değiştiğinde (oyun başında)
  // hesaplanır — her tur yeniden hesaplamak (binlerce oyuncuyu taramak)
  // gerçek cihazlarda donmaya yol açıyordu.
  const allowedClubs = eslesme.derlenmis.kapsam;
  const presetLabel = eslesme.derlenmis.etiket;
  // 11 Eylül 2026 (Kerem: "en kolay seçmeme rağmen zor sorular geldi sanki")
  // — HATA BURADAYDI: computeCountryTeamPool'un üçüncü parametresi difficulty
  // (varsayılan 5) ama hiç geçilmiyordu, yani zorluk kaydırağı bu modda
  // TAMAMEN ETKİSİZDİ; her zaman orta seviye havuz üretiliyordu. Diğer üç
  // ekran (CpuGame, LocalGame, QuickGame) difficulty'yi doğru geçiyor.
  // Bağımlılık dizisine de eklendi, yoksa kaydırak değişince havuz yeniden
  // hesaplanmazdı.
  const pool = useMemo(
    () => computeCountryTeamPool(PLAYERS, eslesme.derlenmis, difficulty),
    [eslesme.derlenmis, difficulty]
  );
  // 11 Eylül 2026: dataset veriliyor ki öneriler POPÜLERLİĞE göre sıralansın.
  const countrySuggestIndex = useMemo(() => buildCountrySuggestIndex(COUNTRIES, PLAYERS), []);
  const countrySuggestions = useMemo(
    () => (countryInput ? suggestCountries(countrySuggestIndex, countryInput) : []),
    [countrySuggestIndex, countryInput]
  );
  // 11 Eylül 2026 (Kerem: "takımlar da popülaritesine göre tavsiye edilmeli")
  // — eskiden kulüp önerileri CLUB_INFO'nun sırasına göre (yani rastgele/
  // alfabetik) geliyordu, "Man" yazınca Manchester United yerine bilinmeyen
  // kulüpler çıkabiliyordu. Artık her kulübün veri setindeki oyuncu sayısı
  // bir kez hesaplanıyor ve öneriler buna göre sıralanıyor; ayrıca adın
  // BAŞINDAN eşleşenler, içinde geçenlerin önüne alınıyor.
  const clubPopularity = useMemo(() => {
    const m = {};
    for (const p of PLAYERS) for (const c of p.clubs) m[c] = (m[c] || 0) + 1;
    return m;
  }, []);
  // 12 Eylül 2026 — kulüp önerileri artık ortak motoru kullanıyor
  // (lib/gameEngine.js buildClubSuggestIndex/suggestClubs): rezerv ve altyapı
  // takımları eleniyor, sıralama oyuncu sayısına göre yapılıyor ve adın
  // başından eşleşenler öne alınıyor. Draft ekranıyla aynı davranış.
  const clubIndex = useMemo(() => buildClubSuggestIndex(Object.keys(CLUB_INFO), PLAYERS), []);
  const clubSuggestions = useMemo(
    () => suggestClubs(clubIndex, clubInput, 5),
    [clubInput, clubIndex]
  );

  function resetRoundState() {
    setBuzzedBy(null);
    setLockedOut(new Set());
    setAnswerInput("");
    setResultText("");
    setFeedback(null); // önceki turdan sızan tepki animasyonu olmasın
    setShowResultPanel(true);
    setHeardText(null);
    setWinningPlayer(null);
  }

  const startNewRound = useCallback(() => {
    if (pickMode === "manual") {
      // Sen-seç modunda oyuncu SADECE tek tarafı seçer, CPU diğerini seçer —
      // Takım-Takım/draft moduyla aynı mantık. Kim hangi tarafı seçiyor,
      // her turda değişir (manualTurn null ise ilk tur "country" olur).
      const nextTurn = manualTurn === "country" ? "club" : "country";
      setManualTurn(nextTurn);
      setRound(null);
      setDraftCountry(null);
      setDraftClub(null);
      setCountryInput("");
      setClubInput("");
      setDraftError("");
      setPhase(nextTurn === "country" ? "drafting_country" : "drafting_club");
      resetRoundState();
      return;
    }
    setUsedPairs((prev) => {
      const r = generateCountryTeamRound(pool, PLAYERS, prev, allowedClubs);
      setRound(r);
      if (r && r.validAnswers) { oncedenYukle(r.validAnswers); }
      if (!r) return prev;
      const next = new Set(prev);
      next.add(r.key);
      return next;
    });
    setPhase("countdown");
    setTimeLeft(roundSeconds);
    resetRoundState();
  }, [pickMode, manualTurn, roundSeconds, pool, allowedClubs]);

  // Oyuncunun turu "country": ülkeyi kendisi yazar, CPU uygun bir kulüp bulur.
  function handleCountrySubmit(overrideText) {
    const text = overrideText !== undefined ? overrideText : countryInput;
    const matched = findMatchedCountry(text, COUNTRIES);
    if (!matched) {
      setDraftError("Bu ülke bulunamadı, tekrar dene.");
      return;
    }
    setDraftCountry(matched);
    setCountryInput("");
    setDraftError("");
    setPhase("drafting_cpu_pick");
    setTimeout(() => {
      const r = generateCountryTeamRoundFromCountry(matched, PLAYERS, usedPairs, allowedClubs, difficulty);
      if (!r) {
        setDraftError(`${matched} ülkesiyle eşleşen uygun bir kulüp bulunamadı, farklı bir ülke dene.`);
        setPhase("drafting_country");
        return;
      }
      setDraftClub(r.club);
      setRound(r);
      oncedenYukle(r.validAnswers);
      setUsedPairs((prev) => new Set(prev).add(r.key));
      setTimeLeft(roundSeconds);
      setPhase("countdown");
    }, 900);
  }

  // Oyuncunun turu "club": kulübü kendisi yazar, CPU uygun bir ülke bulur.
  function handleClubSubmit(overrideText) {
    const text = overrideText !== undefined ? overrideText : clubInput;
    const matched = findMatchedTeam(text, Object.keys(CLUB_INFO));
    if (!matched) {
      setDraftError("Bu kulüp bulunamadı, tekrar dene.");
      return;
    }
    setDraftClub(matched);
    setClubInput("");
    setDraftError("");
    setPhase("drafting_cpu_pick");
    setTimeout(() => {
      const r = generateCountryTeamRoundFromClub(matched, PLAYERS, usedPairs, allowedClubs, difficulty);
      if (!r) {
        setDraftError(`${matched} ile eşleşen uygun bir ülke bulunamadı, farklı bir kulüp dene.`);
        setPhase("drafting_club");
        return;
      }
      setDraftCountry(r.country);
      setRound(r);
      oncedenYukle(r.validAnswers);
      setUsedPairs((prev) => new Set(prev).add(r.key));
      setTimeLeft(roundSeconds);
      setPhase("countdown");
    }, 900);
  }

  // "Sen Seç" ülke/kulüp yazma ekranlarında da sesli giriş kullanılabilsin diye.
  async function handleDraftMicPress(target) {
    setVoiceError(null);
    if (isRecording) {
      try {
        // 26 Eylül 2026: eskiden 24 bin kulüp adının ALFABETİK ilk 30'u
        // ("'t Gooi", "(wartime)"...) ipucu gidiyordu — işe yaramaz gürültü.
        const text = await stopRecording([]);
        if (text) {
          const gonder = (a) => { if (target === "country") handleCountrySubmit(a); else handleClubSubmit(a); };
          const yaz = (a) => { setAnswerInput(a); setInputMode("keyboard"); };
          if (sesOnayiAcik) setSesOnayIstegi({ duyulan: text, ad: text, gonder, yaz });
          else gonder(text);
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

  function handleCountdownComplete() {
    setPhase("racing");
  }

  useEffect(() => {
    // NOT: startNewRound artık manualTurn'e bağımlı ve onu her çağrıldığında
    // değiştiriyor (dönüşümlü tur mantığı için) — startNewRound'u buradaki
    // dependency listesine koymak, referansı her değiştiğinde bu effect'i
    // yeniden tetikleyip startNewRound'u TEKRAR çağırıyordu; bu da
    // manualTurn'ü tekrar değiştirip effect'i tekrar tetikleyen sonsuz bir
    // döngüye yol açıyordu ("Bir Ülke Seç"/"Bir Kulüp Seç" arasında hızlı
    // yanıp sönme). Sadece `started` değiştiğinde bir kez çalışsın istiyoruz.
    if (started) startNewRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

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
    if (winner === "p1" || winner === "cpu") recordRound("countryTeamCpu", winner === "p1");
    if (winner === "p1") {
      setScoreP1((s) => {
        const next = s + 1;
        if (next >= targetScore) setTimeout(() => { setPhase("gameOver"); addXP(XP_MAC_GALIBIYETI); }, 3000);
        return next;
      });
      playCorrect();
      setFeedback("correct");
      setShowResultPanel(false); // önce tepki animasyonu, sonuç paneli onu beklesin
    } else if (winner === "cpu") {
      setScoreCpu((s) => {
        const next = s + 1;
        if (next >= targetScore) setTimeout(() => setPhase("gameOver"), 3000);
        return next;
      });
      playWrong();
      setFeedback("wrong");
      setShowResultPanel(false);
    } else {
      setShowResultPanel(true); // beraberlikte tepki yok, direkt sonucu göster
    }
  }

  // 27 Eylül 2026 — merkezî mod ayarları (lib/modAyarlari.js): varsayılanlar
  // Ayarlar'dan gelir, kurulumda değiştirilebilir, oyun içinde "?" ile görülür.
  const modVarsayilanKaydet = useModVarsayilanlari("countryTeamCpu", { zorluk: setDifficulty, sure: setRoundSeconds, galibiyet: setTargetScore, yontem: setInputMode });
  useEffect(() => {
    oyunBilgisiniYaz("countryTeamCpu", { satirlar: ayarSatirlari({ zorluk: difficulty, sure: roundSeconds, galibiyet: targetScore, lig: presetLabel, yontem: inputMode }) });
  }, [difficulty, roundSeconds, targetScore, presetLabel, inputMode]);

  if (!started) {
    // 27 Eylül 2026 (Kerem: "her mod için zorluk ayarı olmalı. süre ayarı
    // olmalı. her moddaki mimari dizayn aynı olmalı.") — kurulum ekranı artık
    // ortak ModKurulum parçalarıyla kuruluyor (bkz. components/ModKurulum.js).
    return (
      <ModKurulum
        baslik="Kulüp & Ülke"
        aciklama="Bir ülke ve bir kulüp çıkar. O ülkeden olup o kulüpte oynamış futbolcuyu bul."
        vurgu={MODE_COLORS.teamCountry}
        onGeri={onExitSilent || onExit}
        onVarsayilanKaydet={() => modVarsayilanKaydet({ zorluk: difficulty, sure: roundSeconds, galibiyet: targetScore, yontem: inputMode })}
        onBasla={() => setStarted(true)}
      >
        <KurulumBolum
          baslik="KİM SEÇSİN?"
          not={pickMode === "manual" ? "Her turda sırayla: bir tur sen ülkeyi seçersin rakip kulübü bulur, sonraki tur tam tersi." : null}
        >
          <SecimCipleri
            secenekler={[
              { deger: "cpu", etiket: "CPU Rastgele Atar", ikon: "shuffle" },
              { deger: "manual", etiket: "Sen Seç", ikon: "hand-left" },
            ]}
            secili={pickMode}
            onSec={setPickMode}
          />
        </KurulumBolum>
        <KurulumBolum baslik="ZORLUK">
          <ZorlukSecici deger={difficulty} onDegis={setDifficulty} aciklama={(z) => (z <= 3 ? "Sadece efsaneler ve süper yıldızlar sorulur, CPU yavaş ve sık yanılır." : z <= 7 ? "Büyük liglerin bilinen oyuncuları sorulur, CPU dengeli." : "Az bilinen oyuncular da sorulur, CPU hızlı ve isabetli.")} />
        </KurulumBolum>
        <KurulumBolum baslik="TUR SÜRESİ">
          <SureSecici
            secenekler={MOD_TANIMLARI.countryTeamCpu.sure.secenekler}
            deger={roundSeconds}
            onDegis={setRoundSeconds}
            asgari={MOD_TANIMLARI.countryTeamCpu.sure.asgari}
            azami={MOD_TANIMLARI.countryTeamCpu.sure.azami}
            aciklama={MOD_TANIMLARI.countryTeamCpu.sure.aciklama}
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
        {pickMode === "cpu" && (
          <>
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
          </>
        )}
      </ModKurulum>
    );
  }

  if (!round && phase !== "drafting_country" && phase !== "drafting_club" && phase !== "drafting_cpu_pick") {
    return (
      <View style={styles.container}>
        <PoolEmpty
          onReset={() => { setUsedPairs(new Set()); startNewRound(); }}
          onExit={onExitSilent || onExit}
        />
      </View>
    );
  }

  const p1Locked = lockedOut.has("p1");

  return (
    <GameBackground style={styles.container}>
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

      {phase === "drafting_country" && (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={styles.title}>Bir Ülke Seç</Text>
          <Text style={[styles.answersText, { marginBottom: 12 }]}>Rakip senin seçtiğin ülkeye uygun bir kulüp bulacak</Text>
          <TextInput
            autoCorrect={false}
            autoCapitalize="words"
            spellCheck={false}
            autoFocus
            value={countryInput}
            onChangeText={setCountryInput}
            onSubmitEditing={() => handleCountrySubmit()}
            placeholder="Örn: Türkiye"
            placeholderTextColor="#56697A"
            style={[styles.input, { width: "100%", marginTop: 20 }]}
          />
          {countrySuggestions.length > 0 && (
            <View style={[styles.suggestBox, { width: "100%" }]}>
              {countrySuggestions.map((c) => (
                <Pressable key={c.canonical} onPress={() => handleCountrySubmit(c.canonical)} style={styles.suggestRow}>
                  <Text style={styles.suggestText}>{flagForCountry(c.canonical)} {c.display}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SoundPressable style={[styles.primaryBtn, { flex: 1 }]} onPress={() => handleCountrySubmit()}>
              <Text style={styles.primaryBtnText}>Onayla</Text>
            </SoundPressable>
            <SoundPressable style={[styles.micBtn, isRecording && styles.micBtnActive]} onPress={() => handleDraftMicPress("country")} disabled={isProcessing}>
              {isProcessing ? <Ionicons name="hourglass" size={20} color="#F3F7FA" /> : isRecording ? <Ionicons name="stop" size={20} color="#fff" /> : <Ionicons name="mic" size={20} color="#F3F7FA" />}
            </SoundPressable>
          </View>
          {isRecording && <Text style={styles.voiceHint}>Dinliyorum — durdurmak için dokun</Text>}
          {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
            <VoiceConfirm
              istek={sesOnayIstegi}
              onOnayla={sesOnayla}
              onTekrar={sesTekrar}
              onYaz={sesYaz}
              onIptal={() => setSesOnayIstegi(null)}
            />
          {draftError ? <Text style={{ color: "#FFB020", marginTop: 16, textAlign: "center", fontSize: 14 }}>{draftError}</Text> : null}
        </View>
      )}

      {phase === "drafting_club" && (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={styles.title}>Bir Kulüp Seç</Text>
          <Text style={[styles.answersText, { marginBottom: 12 }]}>Rakip senin seçtiğin kulübe uygun bir ülke bulacak</Text>
          <TextInput
            autoCorrect={false}
            autoCapitalize="words"
            spellCheck={false}
            autoFocus
            value={clubInput}
            onChangeText={setClubInput}
            onSubmitEditing={() => handleClubSubmit()}
            placeholder="Örn: Galatasaray"
            placeholderTextColor="#56697A"
            style={[styles.input, { width: "100%", marginTop: 20 }]}
          />
          {clubSuggestions.length > 0 && (
            <View style={[styles.suggestBox, { width: "100%" }]}>
              {clubSuggestions.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => handleClubSubmit(name)}
                  style={[styles.suggestRow, { flexDirection: "row", alignItems: "center", gap: 10 }]}
                >
                  <TeamBadge name={name} size={26} />
                  <Text style={[styles.suggestText, { flex: 1 }]} numberOfLines={1}>{name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SoundPressable style={[styles.primaryBtn, { flex: 1 }]} onPress={() => handleClubSubmit()}>
              <Text style={styles.primaryBtnText}>Onayla</Text>
            </SoundPressable>
            <SoundPressable style={[styles.micBtn, isRecording && styles.micBtnActive]} onPress={() => handleDraftMicPress("club")} disabled={isProcessing}>
              {isProcessing ? <Ionicons name="hourglass" size={20} color="#F3F7FA" /> : isRecording ? <Ionicons name="stop" size={20} color="#fff" /> : <Ionicons name="mic" size={20} color="#F3F7FA" />}
            </SoundPressable>
          </View>
          {isRecording && <Text style={styles.voiceHint}>Dinliyorum — durdurmak için dokun</Text>}
          {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
            <VoiceConfirm
              istek={sesOnayIstegi}
              onOnayla={sesOnayla}
              onTekrar={sesTekrar}
              onYaz={sesYaz}
              onIptal={() => setSesOnayIstegi(null)}
            />
          {draftError ? <Text style={{ color: "#FFB020", marginTop: 16, textAlign: "center", fontSize: 14 }}>{draftError}</Text> : null}
        </View>
      )}

      {phase === "drafting_cpu_pick" && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          {manualTurn === "country" ? (
            <>
              <Text style={styles.flagText}>{flagForCountry(draftCountry)}</Text>
              <Text style={[styles.title, { marginTop: 12 }]}>{countryTr(draftCountry)}</Text>
            </>
          ) : (
            <Text style={[styles.title, { marginTop: 12 }]}>{draftClub}</Text>
          )}
          <Text style={[styles.title, { marginTop: 20, color: "#7CFF5C", fontSize: 16 }]}>
            Rakip {manualTurn === "country" ? "kulüp" : "ülke"} seçiyor...
          </Text>
        </View>
      )}

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

      <View style={styles.scoreRow}>
        <Text style={styles.scoreText}>Sen: {scoreP1}</Text>
        <Text style={styles.scoreText}>CPU: {scoreCpu}</Text>
      </View>

      {/* 7 Eylül 2026 (Kerem: "3-2-1 sayıldıktan SONRA takımlar gözükmeli,
          oyunun mantığı bu") — geri sayım sürerken ülke/kulüp kartı artık
          hiç render EDİLMİYOR (sadece üstünü örtmekle yetinmiyoruz). */}
      {round && phase !== "countdown" && (
        <View style={styles.teamsCard}>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.flagText}>{flagForCountry(round.country)}</Text>
            <Text style={styles.teamName}>{countryTr(round.country)}</Text>
          </View>
          <Text style={styles.plus}>+</Text>
          <View style={{ flex: 1, alignItems: "center" }}>
            <TeamBadge name={round.club} />
            <Text style={styles.teamName}>{round.club}</Text>
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
          <Pressable style={styles.primaryBtn} onPress={startNewRound}>
            <Text style={styles.primaryBtnText}>Sıradaki Tur</Text>
          </Pressable>
        </View>
      )}

      {phase === "gameOver" && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 }}>
          <Text style={[styles.title, { fontSize: 28, color: scoreP1 > scoreCpu ? "#7CFF5C" : "#FF5D5D" }]}>
            {scoreP1 > scoreCpu ? "KAZANDIN!" : "CPU KAZANDI"}
          </Text>
          <Text style={[styles.title, { fontSize: 16, marginTop: 12 }]}>Sen: {scoreP1}  —  CPU: {scoreCpu}</Text>
          <MatchSummary
            modeId="countryTeamCpu"
            kazanildi={scoreP1 > scoreCpu}
            kazanilanXp={scoreP1 > scoreCpu ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI}
          />
          <Pressable
            style={[styles.primaryBtn, { marginTop: 32, width: "100%" }]}
            onPress={() => {
              setScoreP1(0);
              setScoreCpu(0);
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
  flagText: { fontSize: 56 },
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
