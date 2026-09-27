import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MODE_COLORS } from "../lib/theme";
import ModKurulum, { KurulumBolum, SecimCipleri, ZorlukSecici, SureSecici } from "../components/ModKurulum";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { useAudioPlayer } from "expo-audio";
import { PLAYERS } from "../lib/players";
import {
  findMatchedPlayer,
  suggestPlayers,
  buildSuggestIndex,
  generateFiveClubRound,
  scoreFiveClubAnswer,
  bestFiveClubAnswersGrouped,
  FIVE_CLUB_TIME_OPTIONS,
  FIVE_CLUB_MIN_OVERLAP,
  FIVE_CLUB_TOTAL_ROUNDS,
  FIVE_CLUB_DIFFICULTIES,
  FIVE_CLUB_DEFAULT_DIFFICULTY,
  ANSWER_SECONDS,
} from "../lib/gameEngine";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { useCorrectSound, useWrongSound, useCpuCorrectSound } from "../lib/useGameSounds";
import { useVoiceInput } from "../lib/useVoiceInput";
import VoiceConfirm from "../components/VoiceConfirm";
import { useAppSettings } from "../lib/SettingsContext";
import ReportModal from "../components/ReportModal";
import AnswerFeedback from "../components/AnswerFeedback";
import CountdownOverlay from "../components/CountdownOverlay";
import TeamBadge from "../components/TeamBadge";
import PlayerPhoto from "../components/PlayerPhoto";
import SoundPressable from "../components/SoundPressable";
import TimerBar from "../components/TimerBar";

const count3Source = require("../assets/sounds/count-3.mp3");
const count2Source = require("../assets/sounds/count-2.mp3");
const count1Source = require("../assets/sounds/count-1.mp3");

const PLAYER_LABEL = { p1: "Oyuncu 1", p2: "Oyuncu 2" };
const OTHER = { p1: "p2", p2: "p1" };

// 4 Eylül 2026 (Kerem'in yeni mod isteği, + aynı gün geri bildirimlerine göre
// güncellendi) — "5 Kulüp" modu.
// Kural: 5 (büyükçe/tanıdık) kulüp gösterilir. HER TUR HER İKİ OYUNCU DA
// sırayla (buzz ile kimin önce gideceği belirlenir, ama İKİSİ DE cevap
// verir — buzzlayan ilk cevaplar, sonra sıra otomatik diğerine geçer)
// birer futbolcu söyler; söyledikleri futbolcu 5 kulübün kaçında oynadıysa o
// kadar puan kazanırlar (en az 2 kulüpte oynamış olmalı, yoksa 0 puan/geçersiz
// sayılır). 3 tur oynanır, her turda kulüpler değişir; 3 tur sonunda en çok
// puan toplayan kazanır.
// V1 kapsamı: Tek Telefon 2 Kişi (buzz + sözlü/klavye). Online versiyon henüz
// YOK — Supabase tarafında ayrı bir oda/hakemlik mantığı gerektiriyor.
// 12 Eylül 2026 (Kerem: "5 kulüp modu aslında cpu'ya karşı da oynanabilmeli")
// — `vsCpu` true iken ikinci oyuncunun yerini CPU alıyor. Tur akışı, puanlama
// ve sonuç paneli DEĞİŞMİYOR: CPU da tıpkı ikinci oyuncu gibi sırası gelince
// bir futbolcu "söylüyor" ve aynı recordTurnResult'tan geçiyor. Böylece iki
// oyun modu tek bir ekran ve tek bir kural setiyle yaşıyor.
export default function FiveClubsScreen({ onExit, onExitSilent, vsCpu = false }) {
  const oyuncuEtiketi = vsCpu ? { p1: "Sen", p2: "CPU" } : PLAYER_LABEL;
  const [started, setStarted] = useState(false);
  const [roundSeconds, setRoundSeconds] = useState(FIVE_CLUB_TIME_OPTIONS[1]);
  const [inputMode, setInputMode] = useState("voice"); // "keyboard" | "voice"
  const [difficulty, setDifficulty] = useState(FIVE_CLUB_DEFAULT_DIFFICULTY); // "normal" | "zor" | "cokZor"

  const [usedClubKeys, setUsedClubKeys] = useState(new Set());
  const [roundNumber, setRoundNumber] = useState(1);
  const [round, setRound] = useState(null); // { clubs, key }
  const [phase, setPhase] = useState("countdown"); // countdown | racing | answering | result | gameOver
  const [buzzedBy, setBuzzedBy] = useState(null); // 'p1' | 'p2' — bu anda cevaplayan kişi
  const [answered, setAnswered] = useState(new Set()); // bu turda TURUNU TAMAMLAMIŞ oyuncular
  const [timeLeft, setTimeLeft] = useState(roundSeconds);
  const [answerTimeLeft, setAnswerTimeLeft] = useState(ANSWER_SECONDS);
  const [answerInput, setAnswerInput] = useState("");
  // roundResults: { p1: {gained, player, matchedClubs} | null, p2: {...} | null }
  const [roundResults, setRoundResults] = useState({ p1: null, p2: null });
  const [feedback, setFeedback] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [answersRevealed, setAnswersRevealed] = useState(false); // isimler açık mı (kova sayıları her zaman görünür)
  const [showAnswersPanel, setShowAnswersPanel] = useState(false);
  const [heardText, setHeardText] = useState(null);
  const [cpuDusunuyor, setCpuDusunuyor] = useState(false);
  const cpuZamanlayiciRef = useRef(null);

  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);

  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const playCpuCorrect = useCpuCorrectSound();
  const countPlayer3 = useAudioPlayer(count3Source);
  const countPlayer2 = useAudioPlayer(count2Source);
  const countPlayer1 = useAudioPlayer(count1Source);

  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceInput();
  const [voiceError, setVoiceError] = useState(null);
  const { settings } = useAppSettings();
  // 25 Eylul 2026 (Kerem: "sesli soyledigimde anladigini ekrana getirsin,
  // onaylayayim... kullanmak istemeyenler icin bu ayar kapatilabilsin")
  // Sesli cevap artik dogrudan gonderilmiyor; VoiceConfirm ile onaylatiliyor.
  // Onay bekleyen istek varken sayac DURUYOR (asagidaki isProcessing kosullari).
  const [sesOnayIstegi, setSesOnayIstegi] = useState(null);
  const sesOnayiAcik = settings?.voiceConfirm !== false;
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

  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const suggestions = useMemo(() => suggestPlayers(suggestIndex, answerInput), [suggestIndex, answerInput]);

  const startNewRound = useCallback(() => {
    const clubPool = FIVE_CLUB_DIFFICULTIES[difficulty].pool;
    setUsedClubKeys((prev) => {
      const r = generateFiveClubRound(PLAYERS, clubPool, prev);
      setRound(r);
      if (!r) return prev;
      const next = new Set(prev);
      next.add(r.key);
      return next;
    });
    setPhase("countdown");
    setBuzzedBy(null);
    setAnswered(new Set());
    setTimeLeft(roundSeconds);
    setAnswerInput("");
    setRoundResults({ p1: null, p2: null });
    setFeedback(null);
    setAnswersRevealed(false);
    setShowAnswersPanel(false);
    setHeardText(null);
  }, [roundSeconds, difficulty]);

  useEffect(() => {
    if (started) startNewRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  function handleCountdownComplete() {
    setPhase("racing");
  }

  // Tur süresi (timeLeft) — İKİ oyuncunun turları ARASINDA da akmaya devam
  // eder (racing fazındayken). Süre biterse cevap vermemiş olan(lar)
  // otomatik 0 puanla geçilmiş sayılır.
  useEffect(() => {
    if (phase !== "racing") return;
    if (timeLeft <= 0) {
      finishRoundIfNeeded(answered, true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

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

  // CPU'nun becerisi zorluk ayarına bağlı: hangi "kova"dan (kaç kulüpte
  // oynamış oyuncu) cevap seçeceğini belirliyor. Normal'de çoğunlukla 2
  // kulüplük sıradan bir cevap, çok zorda 3-4 kulüplük iyi bir cevap veriyor.
  // Bazen de hiç bulamıyor (0 puan) — yenilmez olmasın.
  const cpuCevabiSec = useCallback(() => {
    if (!round) return null;
    const kovalar = bestFiveClubAnswersGrouped(PLAYERS, round.clubs, 12);
    const sansliMi = Math.random();
    let tercih;
    if (difficulty === "cokZor") tercih = [5, 4, 3, 2];
    else if (difficulty === "zor") tercih = [4, 3, 2];
    else tercih = [3, 2];

    // Normal zorlukta CPU'nun %25, zorda %15, çok zorda %8 ihtimalle
    // bulamaması oyunu nefes aldırıyor.
    const pasEsigi = difficulty === "cokZor" ? 0.08 : difficulty === "zor" ? 0.15 : 0.25;
    if (sansliMi < pasEsigi) return null;

    // İnsanın bu turda söylediği ismi CPU tekrar söylemesin — hem kuralın
    // kendisi bunu yasaklıyor hem de tuhaf görünürdü.
    const soylenmis = roundResults.p1?.player?.name || null;

    for (const n of tercih) {
      const aday = (kovalar[n] || []).filter((a) => a.player.name !== soylenmis);
      if (aday.length) {
        return aday[Math.floor(Math.random() * aday.length)];
      }
    }
    return null;
  }, [round, difficulty, roundResults]);

  // CPU sırası: insan turunu bitirdikten sonra (ya da hiç buzz'lamadıysa
  // rastgele bir anda) devreye giriyor.
  useEffect(() => {
    if (!vsCpu || !started) return;
    if (phase !== "racing" || !round) return;
    if (answered.has("p2")) return;
    if (cpuZamanlayiciRef.current) clearTimeout(cpuZamanlayiciRef.current);

    // İnsan hâlâ cevaplamadıysa CPU biraz daha bekliyor ki oyuncu buzz'lama
    // fırsatı bulsun.
    const gecikme = answered.has("p1") ? 900 + Math.random() * 1200 : 3500 + Math.random() * 3000;
    setCpuDusunuyor(true);
    cpuZamanlayiciRef.current = setTimeout(() => {
      setCpuDusunuyor(false);
      const secim = cpuCevabiSec();
      if (secim) recordTurnResult("p2", secim.count, secim.player, secim.matchedClubs);
      else recordTurnResult("p2", 0, null, []);
    }, gecikme);

    return () => {
      if (cpuZamanlayiciRef.current) clearTimeout(cpuZamanlayiciRef.current);
      setCpuDusunuyor(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vsCpu, started, phase, round, answered, cpuCevabiSec]);

  // Ekrandan çıkılırsa CPU zamanlayıcısı boşa ateşlenmesin.
  useEffect(() => () => {
    if (cpuZamanlayiciRef.current) clearTimeout(cpuZamanlayiciRef.current);
  }, []);

  function handleBuzz(who) {
    if (vsCpu && who === "p2") return; // CPU'nun buzz'ı yok
    if (phase !== "racing" || answered.has(who) || !round) return;
    setBuzzedBy(who);
    setPhase("answering");
    setAnswerTimeLeft(ANSWER_SECONDS);
  }

  async function handleBuzzAndSpeak(who) {
    handleBuzz(who);
    setVoiceError(null);
    try {
      await startRecording();
    } catch (err) {
      setVoiceError(err.message || "Mikrofona erişilemedi");
    }
  }

  async function handleMicPress() {
    setVoiceError(null);
    if (isRecording) {
      try {
        const text = await stopRecording([]);
        if (text) {
          const gonder = (a) => { setAnswerInput(a); setHeardText(a); submitAnswer(a); };
          const yaz = (a) => { setAnswerInput(a); setInputMode("keyboard"); };
          // 26 Eylül 2026 (Kerem: "bu isim listede bulunamadı diyor... kopya veriyorsa
          // kaldırmamız lazım") — onay ekranı artık SADECE duyulanı gösteriyor.
          // Eskiden duyulan, turun doğru cevaplarıyla eşleştirilip eşleşen tam
          // ad yazılıyor ya da "listede bulunamadı" uyarısı çıkıyordu; ikisi de
          // cevabın doğru olup olmadığını göndermeden önce ele veriyordu.
          if (sesOnayiAcik) setSesOnayIstegi({ duyulan: text, ad: text, gonder, yaz });
          else { const matched = findMatchedPlayer(text, PLAYERS); gonder(matched ? matched.name : text); }
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

  // 4 Eylül 2026 (Kerem: "buzzlandıktan sonra diğer taraf da cevap
  // verebilmeli, her tur iki kişi de cevap vermeli") — bir oyuncunun turu
  // bittiğinde (doğru/yanlış/pas fark etmez) round SONA ERMEZ, sadece o
  // oyuncu "answered" setine eklenir. İkisi de tamamlayınca (ya da süre
  // dolunca) sonuç paneli gösterilir.
  function recordTurnResult(who, gained, player, matchedClubs) {
    setRoundResults((prev) => ({ ...prev, [who]: { gained, player: player || null, matchedClubs: matchedClubs || [] } }));
    if (who === "p1") setScoreP1((s) => s + gained);
    else setScoreP2((s) => s + gained);
    if (gained > 0) {
      // 26 Eylül 2026 (Kerem: "cpu'nun söyledikleri hiçbir modda ansiklopediyi açmasın. kendi söylediklerimiz açsın.")
      // CPU'ya karşı oyunda CPU "p2" olarak oynuyor. Eskiden CPU'nun bulduğu
      // futbolcu koleksiyona ekleniyor VE CPU'nun başarısı kullanıcının
      // istatistiğine GALİBİYET olarak yazılıyordu. İkisi de düzeltildi.
      // (Aynı telefonda iki kişi oynarken ikisi de gerçek insan, ikisi de sayılır.)
      const cpuHamlesi = vsCpu && who === "p2";
      if (player && !cpuHamlesi) unlockPlayer(player.name);
      if (!cpuHamlesi) recordRound(vsCpu ? "fiveClubsCpu" : "fiveClubs", true);
      if (cpuHamlesi) playCpuCorrect(); else playCorrect();
      setFeedback({ correct: true, player });
    } else {
      recordRound(vsCpu ? "fiveClubsCpu" : "fiveClubs", false);
    }

    setAnswered((prevAnswered) => {
      const next = new Set(prevAnswered);
      next.add(who);
      finishRoundIfNeeded(next, false);
      return next;
    });
    setBuzzedBy(null);
    setAnswerInput("");
    setHeardText(null);
  }

  // Her iki oyuncu da turunu tamamladıysa (ya da süre dolduğunda kalanları
  // otomatik 0 puanla geçip) sonuç panelini aç. `fromTimeout=true` iken süre
  // bittiği için hâlâ cevaplamamış oyuncu(lar) da 0 puanla işaretlenir.
  function finishRoundIfNeeded(currentAnswered, fromTimeout) {
    const remaining = ["p1", "p2"].filter((w) => !currentAnswered.has(w));
    if (remaining.length === 0) {
      setPhase("result");
      if (!(roundResults.p1?.gained > 0) && !(roundResults.p2?.gained > 0)) playWrong();
      return;
    }
    if (fromTimeout) {
      // Süre doldu, hâlâ cevaplamayan(lar) 0 puanla geçilir.
      setRoundResults((prev) => {
        const next = { ...prev };
        remaining.forEach((w) => { next[w] = next[w] || { gained: 0, player: null, matchedClubs: [] }; });
        return next;
      });
      setPhase("result");
      playWrong();
    }
    // fromTimeout değilse ve hâlâ cevaplamayan biri varsa: racing fazında
    // kal, sıradaki oyuncunun buzz'lamasını bekle (state zaten racing).
    else if (phase !== "racing") {
      setPhase("racing");
    }
  }

  function submitAnswer(overrideText) {
    if (!round || !buzzedBy) return;
    const who = buzzedBy;
    const text = overrideText !== undefined ? overrideText : answerInput;
    // 5 Kulüp modunda cevap TÜM veri setine göre (bir çift değil) aranıyor.
    const matched = findMatchedPlayer(text, PLAYERS);
    if (!matched) {
      recordTurnResult(who, 0, null, []);
      return;
    }
    // 12 Eylül 2026 (Kerem: "birisi aynı tur içinde bir futbolcuyu söyledi
    // diyelim ki, diğer kişi de aynı futbolcuyu söyleyip puan alabiliyor") —
    // aynı turda aynı ismi tekrar söylemek puan kazandırmamalı; ikinci oyuncu
    // rakibinin cevabını duyduğu için bu bedava puandı.
    const digeri = OTHER[who];
    const rakipCevabi = roundResults[digeri]?.player;
    if (rakipCevabi && rakipCevabi.name === matched.name) {
      setVoiceError(null);
      setFeedback({ correct: false, message: "Bu futbolcu bu turda zaten söylendi" });
      recordTurnResult(who, 0, matched, []);
      return;
    }

    const { count, matchedClubs } = scoreFiveClubAnswer(matched, round.clubs);
    if (count < FIVE_CLUB_MIN_OVERLAP) {
      recordTurnResult(who, 0, matched, matchedClubs);
      return;
    }
    recordTurnResult(who, count, matched, matchedClubs);
  }

  function handlePass() {
    if (phase !== "answering" || !buzzedBy) return;
    recordTurnResult(buzzedBy, 0, null, []);
  }

  function handleSuggestionTap(name) {
    setAnswerInput(name);
    submitAnswer(name);
  }

  function goToNextRound() {
    if (roundNumber >= FIVE_CLUB_TOTAL_ROUNDS) {
      setPhase("gameOver");
    } else {
      setRoundNumber((n) => n + 1);
      startNewRound();
    }
  }

  function restartGame() {
    setScoreP1(0);
    setScoreP2(0);
    setRoundNumber(1);
    setUsedClubKeys(new Set());
    startNewRound();
  }

  if (!started) {
    // 27 Eylül 2026 — ortak kurulum ekranı (bkz. components/ModKurulum.js).
    // Bu modun zorluğu kulüp HAVUZU (Normal / Zor / Çok Zor) olduğu için
    // kendi 3 kademesi kullanılıyor; görünüm diğer modlarla aynı.
    return (
      <ModKurulum
        baslik={vsCpu ? "5 Kulüp — CPU'ya Karşı" : "5 Kulüp — 2 Kişi"}
        aciklama={vsCpu
          ? "Ekranda 5 büyük kulüp çıkar. Sen ve CPU sırayla birer futbolcu söylersiniz; futbolcu bu kulüplerin kaçında oynadıysa o kadar puan (en az 2). 3 tur, en çok puan kazanır."
          : "Ekranda 5 büyük kulüp çıkar. Sırayla birer futbolcu söylersiniz; futbolcu bu kulüplerin kaçında oynadıysa o kadar puan (en az 2). 3 tur, en çok puan kazanır."}
        vurgu={MODE_COLORS.fiveClubs}
        onGeri={onExitSilent || onExit}
        onBasla={() => setStarted(true)}
      >
        <KurulumBolum baslik="ZORLUK">
          <ZorlukSecici
            seviyeler={[
              { id: "normal", etiket: "Normal", aciklama: "Sadece en büyük kulüpler" + (vsCpu ? " · CPU sık pas geçer" : "") },
              { id: "zor", etiket: "Zor", aciklama: "Şampiyonlar Ligi klasikleri de girer" + (vsCpu ? " · CPU daha isabetli" : "") },
              { id: "cokZor", etiket: "Çok Zor", aciklama: "54 kulüplük tam havuz" + (vsCpu ? " · CPU en iyi cevabı arar" : "") },
            ]}
            secili={difficulty}
            onSec={setDifficulty}
          />
        </KurulumBolum>
        <KurulumBolum baslik="CEVAP SÜRESİ">
          <SureSecici
            secenekler={FIVE_CLUB_TIME_OPTIONS}
            deger={roundSeconds}
            onDegis={setRoundSeconds}
            asgari={15}
            azami={180}
            aciklama="Her oyuncunun kendi cevabı için süresi."
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
      </ModKurulum>
    );
  }

  if (!round) {
    return (
      <GameBackground style={styles.container}>
        <Text style={styles.center}>Şu an çözülebilir bir kulüp seti bulunamadı.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => { setUsedClubKeys(new Set()); startNewRound(); }}>
          <Text style={styles.primaryBtnText}>Tekrar Dene</Text>
        </Pressable>
      </GameBackground>
    );
  }

  const p1Answered = answered.has("p1");
  const p2Answered = answered.has("p2");
  // 7 Eylül 2026 (Kerem: "tiklenen takımların oyuncu 1 tarafından mı oyuncu 2
  // tarafından mı söylendiği anlaşılmıyor, 1 ve 2 şeklinde iki ayrı gösterge
  // olmalı; ikisi de aynı takımı bulduysa hem 1 hem 2 gözükmeli") — eskiden
  // iki oyuncunun bulduğu kulüpler TEK bir listede birleştirilip hepsine aynı
  // yeşil tik konuyordu. Artık her oyuncunun bulduğu kulüpler AYRI tutuluyor
  // ve rozet olarak kimin bulduğu yazıyor.
  const p1Clubs = new Set(roundResults.p1?.matchedClubs || []);
  const p2Clubs = new Set(roundResults.p2?.matchedClubs || []);

  function renderPlayerButtons(who) {
    const done = answered.has(who);
    const label = oyuncuEtiketi[who];
    const result = roundResults[who];
    if (done) {
      return (
        <View style={[styles.buzzBtn, styles.buzzBtnDone]}>
          <Text style={styles.buzzBtnDoneLabel}>{label}</Text>
          <Text style={styles.buzzBtnDoneScore}>
            {result?.player ? `${result.player.name} (+${result.gained})` : "Pas / bilemedi (0)"}
          </Text>
        </View>
      );
    }
    // CPU'ya karşı oynarken ikinci "oyuncu" bir buton değil, durum göstergesi.
    if (vsCpu && who === "p2") {
      return (
        <View style={[styles.buzzBtn, styles.buzzBtnCpu]}>
          <Text style={styles.buzzBtnText}>{label}</Text>
          <Text style={styles.buzzBtnSub}>
            {cpuDusunuyor ? "düşünüyor…" : "sırasını bekliyor"}
          </Text>
        </View>
      );
    }
    return (
      <SoundPressable
        onPress={() => (inputMode === "voice" ? handleBuzzAndSpeak(who) : handleBuzz(who))}
        style={styles.buzzBtn}
      >
        <Text style={styles.buzzBtnText}>{label}</Text>
        <Text style={styles.buzzBtnSub}>Buzz'la</Text>
      </SoundPressable>
    );
  }

  function renderAnsweringUI() {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={styles.answeringText}>
          {oyuncuEtiketi[buzzedBy]} cevaplıyor — {answerTimeLeft} sn
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
            <SoundPressable style={styles.primaryBtn} onPress={() => submitAnswer()}>
              <Text style={styles.primaryBtnText}>Gönder</Text>
            </SoundPressable>
            <SoundPressable onPress={() => setInputMode("voice")} style={{ marginTop: 10, alignItems: "center" }}>
              <Text style={styles.switchModeLink}>Bunun yerine konuşmak istiyorum</Text>
            </SoundPressable>
          </>
        )}
        <SoundPressable onPress={handlePass} style={{ marginTop: 14, alignItems: "center" }}>
          <Text style={styles.passLink}>Bilemiyorum, pas geç</Text>
        </SoundPressable>
      </View>
    );
  }

  function renderAnswersPanel() {
    const grouped = bestFiveClubAnswersGrouped(PLAYERS, round.clubs, 5);
    const bucketOrder = [5, 4, 3, 2];
    return (
      <View style={{ width: "100%", marginTop: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={styles.answersPanelTitle}>Olası Doğru Cevaplar</Text>
          <SoundPressable onPress={() => setAnswersRevealed((v) => !v)} style={styles.revealToggleBtn}>
            <Ionicons name={answersRevealed ? "eye-off" : "eye"} size={14} color="#0B1620" />
            <Text style={styles.revealToggleText}>{answersRevealed ? "Gizle" : "Görünür Yap"}</Text>
          </SoundPressable>
        </View>
        <ScrollView
          style={styles.answersBox}
          contentContainerStyle={{ padding: 12 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {bucketOrder.map((n) => {
            const list = grouped[n] || [];
            if (list.length === 0) return null;
            return (
              <View key={n} style={{ marginBottom: 10 }}>
                <Text style={styles.bucketHeader}>{n} Takım ({list.length})</Text>
                {list.map((s) => (
                  <View key={s.player.name} style={styles.answersBoxRow}>
                    {answersRevealed ? (
                      <>
                        <PlayerPhoto name={s.player.name} size={28} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.answersBoxItem} numberOfLines={1}>{s.player.name}</Text>
                          <Text style={styles.answersBoxSub} numberOfLines={1}>{s.matchedClubs.join(", ")}</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.maskedAvatar} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.maskedLineWide} />
                          <View style={styles.maskedLineNarrow} />
                        </View>
                      </>
                    )}
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <GameBackground style={styles.container}>
      {showReport && (
        <ReportModal
          visible={showReport}
          onClose={() => setShowReport(false)}
          playerContext={feedback?.player ? feedback.player.name : "Bilinmiyor"}
        />
      )}

      <View style={{ width: "100%", marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable onPress={() => setShowReport(true)} hitSlop={20}>
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
          correct={feedback.correct}
          player={feedback.player}
          onDone={() => setFeedback(null)}
        />
      )}

      {phase !== "gameOver" && (
        <ScrollView
          style={{ flex: 1, width: "100%" }}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          <View style={styles.topInfoRow}>
            <Text style={styles.roundBadge}>Tur {roundNumber} / {FIVE_CLUB_TOTAL_ROUNDS}</Text>
            <View style={styles.scoreRow}>
              {/* Renk kodu, kulüp rozetlerindeki 1/2 göstergeleriyle AYNI:
                  Oyuncu 1 yeşil, Oyuncu 2 altın — kimin neyi bulduğu tek
                  bakışta anlaşılsın diye. */}
              <Text style={[styles.scoreText, { color: "#7CFF5C" }]}>Oyuncu 1: {scoreP1}</Text>
              <Text style={[styles.scoreText, { color: "#FFB020" }]}>Oyuncu 2: {scoreP2}</Text>
            </View>
          </View>

          <View style={styles.clubsGrid}>
            {round.clubs.map((c) => {
              // 11 Eylül 2026 (Kerem: "1. oyuncu söyledi ve cevabı açıldı, o
              // zaman gözükmesi lazım; şu an tur tamamlanınca çıkıyor") —
              // rozetler artık `phase === "result"` beklemiyor. `roundResults`
              // her oyuncunun turu biter bitmez doluyor, dolayısıyla ilk
              // oyuncunun bulduğu kulüpler ikinci oyuncu daha cevaplarken
              // ekranda işaretli duruyor.
              const byP1 = p1Clubs.has(c);
              const byP2 = p2Clubs.has(c);
              const isMatched = byP1 || byP2;
              return (
                <View key={c} style={[styles.clubCell, isMatched && styles.clubCellMatched]}>
                  <View style={styles.clubBadgeWrap}>
                    <TeamBadge name={c} size={40} />
                  </View>
                  <Text allowFontScaling={false} style={styles.clubName} numberOfLines={2}>{c}</Text>
                  {isMatched && (
                    <View style={styles.clubCheck}>
                      {byP1 && (
                        <View style={[styles.finderBadge, styles.finderBadgeP1]}>
                          <Text allowFontScaling={false} style={styles.finderBadgeText}>1</Text>
                        </View>
                      )}
                      {byP2 && (
                        <View style={[styles.finderBadge, styles.finderBadgeP2]}>
                          <Text allowFontScaling={false} style={styles.finderBadgeText}>2</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {phase === "racing" && (
            <>
              <TimerBar current={timeLeft} total={roundSeconds} />
              <Text style={styles.hintText}>
                {p1Answered || p2Answered ? "Sırada diğer oyuncu var — buzz'lasın!" : "En az 2 kulüpte oynamış bir futbolcu söyle!"}
              </Text>
              <View style={styles.buzzRow}>
                <View style={{ flex: 1 }}>{renderPlayerButtons("p1")}</View>
                <View style={{ flex: 1 }}>{renderPlayerButtons("p2")}</View>
              </View>
            </>
          )}

          {phase === "answering" && renderAnsweringUI()}

          {phase === "result" && (
            <View style={{ marginTop: 16, alignItems: "center", width: "100%" }}>
              <View style={styles.resultRow}>
                {["p1", "p2"].map((who) => {
                  const r = roundResults[who];
                  return (
                    <View key={who} style={styles.resultCard}>
                      <Text style={styles.resultCardLabel}>{oyuncuEtiketi[who]}</Text>
                      {r?.player ? (
                        <>
                          <PlayerPhoto name={r.player.name} size={52} />
                          <Text style={styles.resultCardName} numberOfLines={1}>{r.player.name}</Text>
                        </>
                      ) : (
                        <Text style={styles.resultCardName}>Bilemedi</Text>
                      )}
                      <Text style={styles.resultCardGain}>+{r?.gained || 0} puan</Text>
                    </View>
                  );
                })}
              </View>

              {!showAnswersPanel && (
                <Pressable style={styles.showAnswersBtn} hitSlop={10} onPress={() => setShowAnswersPanel(true)}>
                  <Text style={styles.showAnswersBtnText}>Doğru cevapları göster</Text>
                </Pressable>
              )}
              {showAnswersPanel && renderAnswersPanel()}

              <Pressable style={styles.primaryBtn} onPress={goToNextRound}>
                <Text style={styles.primaryBtnText}>
                  {roundNumber >= FIVE_CLUB_TOTAL_ROUNDS ? "Sonuçları Gör" : "Sıradaki Tur"}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {phase === "gameOver" && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 }}>
          <Ionicons name="trophy" size={48} color="#FFB020" style={{ marginBottom: 12 }} />
          <Text style={[styles.title, { fontSize: 26, color: "#7CFF5C" }]}>
            {scoreP1 === scoreP2 ? "Berabere!" : scoreP1 > scoreP2 ? "Oyuncu 1 Kazandı!" : "Oyuncu 2 Kazandı!"}
          </Text>
          <Text style={[styles.title, { fontSize: 16, marginTop: 12 }]}>Oyuncu 1: {scoreP1}  —  Oyuncu 2: {scoreP2}</Text>
          <Pressable style={[styles.primaryBtn, { marginTop: 32, width: "100%" }]} onPress={restartGame}>
            <Text style={styles.primaryBtnText}>Tekrar Oyna</Text>
          </Pressable>
          <Pressable onPress={onExitSilent || onExit} style={{ marginTop: 16 }}>
            <Text style={styles.backLink}>Menüye dön</Text>
          </Pressable>
        </View>
      )}
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1620", padding: 20, paddingBottom: 40 },
  scrollContainer: { flex: 1, backgroundColor: "#0B1620", paddingHorizontal: 20 },
  title: { color: "#F3F7FA", fontSize: 22, fontWeight: "900", textAlign: "center" },
  subtitle: { color: "#8CA0B3", fontSize: 13, marginTop: 8, lineHeight: 19, textAlign: "center" },
  center: { color: "#F3F7FA", textAlign: "center", marginBottom: 16 },

  diffBtn: { borderColor: "#28394B", borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  diffBtnActive: { borderColor: "#7CFF5C", backgroundColor: "#16222E" },
  diffBtnText: { color: "#8CA0B3", fontWeight: "800", fontSize: 13 },
  diffBtnTextActive: { color: "#7CFF5C" },

  topInfoRow: { alignItems: "center", marginBottom: 12 },
  roundBadge: { color: "#FFB020", fontWeight: "900", fontSize: 13, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  scoreRow: { flexDirection: "row", gap: 20 },
  scoreText: { color: "#8CA0B3", fontWeight: "700", fontSize: 13 },

  // 4 Eylül 2026 (Kerem: "logo altındaki kısaltma takım adıyla üst üste
  // biniyor") — badge'e sabit yükseklikli bir sarmalayıcı (clubBadgeWrap) +
  // isme daha fazla üst boşluk verildi, TeamBadge.js'teki overflow fix'iyle
  // birlikte artık taşma/örtüşme olmuyor.
  clubsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 18, padding: 14 },
  clubCell: { width: "30%", alignItems: "center", paddingVertical: 10, borderRadius: 12, position: "relative", minHeight: 92 },
  clubCellMatched: { backgroundColor: "rgba(124,255,92,0.12)" },
  clubBadgeWrap: { height: 40, width: 40, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  clubName: { color: "#F3F7FA", fontSize: 11, fontWeight: "800", textAlign: "center", lineHeight: 14 },
  clubCheck: { position: "absolute", top: 2, right: 4, flexDirection: "row", gap: 3 },
  finderBadge: { width: 17, height: 17, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  finderBadgeP1: { backgroundColor: "#7CFF5C" },   // Oyuncu 1 — yeşil
  finderBadgeP2: { backgroundColor: "#FFB020" },   // Oyuncu 2 — altın/amber
  finderBadgeText: { color: "#0B1620", fontSize: 11, fontWeight: "900" },

  hintText: { color: "#8CA0B3", fontSize: 12, textAlign: "center", marginTop: 10, fontStyle: "italic" },
  buzzRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  buzzBtn: { flex: 1, borderColor: "#7CFF5C", borderWidth: 2, borderRadius: 18, paddingVertical: 24, alignItems: "center", justifyContent: "center", minHeight: 96 },
  buzzBtnText: { color: "#7CFF5C", fontWeight: "900", fontSize: 14 },
  buzzBtnSub: { color: "#8CA0B3", fontWeight: "700", fontSize: 11, marginTop: 4 },
  buzzBtnCpu: { opacity: 0.75, borderStyle: "dashed" },
  buzzBtnDone: { borderColor: "#28394B", backgroundColor: "#16222E", paddingHorizontal: 8 },
  buzzBtnDoneLabel: { color: "#56697A", fontWeight: "900", fontSize: 12 },
  buzzBtnDoneScore: { color: "#7CFF5C", fontWeight: "800", fontSize: 12, marginTop: 6, textAlign: "center" },
  passLink: { color: "#8CA0B3", fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },

  answeringText: { color: "#7CFF5C", textAlign: "center", fontWeight: "800", marginBottom: 12 },
  input: { backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 14, padding: 16, color: "#F3F7FA", fontSize: 16, marginBottom: 12 },
  suggestBox: { marginTop: -6, marginBottom: 12, backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  suggestRow: { paddingVertical: 10, paddingHorizontal: 14, borderBottomColor: "#1B2A38", borderBottomWidth: 1 },
  suggestText: { color: "#7CFF5C", fontSize: 14, fontWeight: "600" },

  primaryBtn: { backgroundColor: "#7CFF5C", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: "#0B1620", fontWeight: "900", textTransform: "uppercase", fontSize: 13 },
  backLink: { color: "#8CA0B3", textAlign: "center", fontSize: 12 },

  micBtnBig: { backgroundColor: "#7CFF5C", borderRadius: 20, paddingVertical: 28, alignItems: "center", justifyContent: "center", marginTop: 12 },
  micBtnActive: { backgroundColor: "#FF5D5D" },
  micBtnBigText: { color: "#0B1620", fontWeight: "900", fontSize: 18 },
  heardBanner: { backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 4 },
  heardBannerText: { color: "#F3F7FA", fontSize: 14, fontStyle: "italic", textAlign: "center" },
  switchModeLink: { color: "#7CFF5C", fontSize: 12, fontWeight: "700" },
  voiceError: { color: "#FF5D5D", fontSize: 12, textAlign: "center", marginTop: 8 },
  voiceHint: { color: "#8CA0B3", fontSize: 12, textAlign: "center", marginTop: 8 },

  resultRow: { flexDirection: "row", gap: 12, width: "100%" },
  resultCard: { flex: 1, backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 16, padding: 14, alignItems: "center" },
  resultCardLabel: { color: "#8CA0B3", fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  resultCardName: { color: "#F3F7FA", fontWeight: "800", fontSize: 13, marginTop: 6, textAlign: "center" },
  resultCardGain: { color: "#FFB020", fontWeight: "900", fontSize: 14, marginTop: 6 },

  showAnswersBtn: { borderColor: "#7CFF5C", borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18, marginBottom: 12, marginTop: 16 },
  showAnswersBtnText: { color: "#7CFF5C", fontSize: 13, fontWeight: "700" },
  answersPanelTitle: { color: "#F3F7FA", fontWeight: "900", fontSize: 14 },
  revealToggleBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#7CFF5C", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  revealToggleText: { color: "#0B1620", fontWeight: "900", fontSize: 11 },
  bucketHeader: { color: "#FFB020", fontWeight: "900", fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  // 4 Eylül 2026 (Kerem: "doğru cevap içindeki kutucuklar sabit boyutta
  // olmalı, liste içinde kaydırılabilmeli") — KÖK NEDEN: gizli/açık satırlar
  // farklı içerik yüksekliğine sahipti (maskeli satır sadece tek satır metin,
  // açık satır foto+iki satır metin) — "Görünür Yap"a basınca liste boyu
  // ZIPLIYORDU. ÇÖZÜM: her satıra sabit `height` verildi (hem maskeli hem
  // açık halde AYNI yükseklik), kutu (answersBox) SABİT bir yüksekliğe
  // (maxHeight yerine height) kilitlendi ve içi HER ZAMAN scrollView ile
  // kaydırılabilir.
  answersBox: { height: 220, width: "100%", backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 14, marginBottom: 12 },
  answersBoxItem: { color: "#F3F7FA", fontSize: 13, fontWeight: "700" },
  answersBoxSub: { color: "#8CA0B3", fontSize: 11, marginTop: 2 },
  answersBoxRow: { flexDirection: "row", alignItems: "center", gap: 10, height: 44 },
  maskedAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#28394B" },
  maskedLineWide: { width: "55%", height: 10, borderRadius: 5, backgroundColor: "#28394B" },
  maskedLineNarrow: { width: "35%", height: 8, borderRadius: 4, backgroundColor: "#28394B", marginTop: 6 },
});
