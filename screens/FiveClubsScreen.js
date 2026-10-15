import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MODE_COLORS, COLORS, saydam, vurguZemini } from "../lib/theme";
import { EslesmeProfiliBolumu } from "../components/EslesmeProfiliPenceresi";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import ModKurulum, { KurulumBolum, SecimCipleri, ZorlukSecici, SureSecici } from "../components/ModKurulum";
import { useModVarsayilanlari, useKurulumKapisi, oyunBilgisiniYaz, ayarSatirlari } from "../lib/modAyarlari";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { cpuBilirMi, taninirlik } from "../lib/taninirlik";
import { KlavyeAlani, KlavyeScroll } from "../components/Klavye";
import { useAudioPlayer } from "expo-audio";
import { PLAYERS } from "../lib/players";
import {
  findMatchedPlayer,
  suggestPlayers,
  buildSuggestIndex,
  generateFiveClubRound,
  scoreFiveClubAnswer,
  bestFiveClubAnswersGrouped,
  enIyiFiveClubCevabi,
  FIVE_CLUB_TIME_OPTIONS,
  FIVE_CLUB_MIN_OVERLAP,
  FIVE_CLUB_TOTAL_ROUNDS,
  FIVE_CLUB_DIFFICULTIES,
  FIVE_CLUB_DEFAULT_DIFFICULTY,
  ANSWER_SECONDS,
} from "../lib/gameEngine";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { gorevOlayi } from "../lib/dailyGoals";
import { useCorrectSound, useWrongSound, useCpuCorrectSound } from "../lib/useGameSounds";
import { useVoiceInput } from "../lib/useVoiceInput";
import VoiceConfirm from "../components/VoiceConfirm";
import { useAppSettings } from "../lib/SettingsContext";
import ReportModal from "../components/ReportModal";
import AnswerFeedback from "../components/AnswerFeedback";
import CountdownOverlay from "../components/CountdownOverlay";
import TeamBadge from "../components/TeamBadge";
import { KulupParlakligi } from "../components/EslesmeKarti";
import PlayerPhoto from "../components/PlayerPhoto";
import MacSonuKarti from "../components/MacSonuKarti";
import { useOyuncuAdlari, OyuncuAdlariBolumu, IsimliSkorTablosu } from "../components/OyuncuAdlari";
import { OyunUstCubugu, SkorSeridi, RakipTepkisi, rakipEtiketi } from "../components/MacCercevesi";
import { karakterSec, tepki, kisaAd } from "../lib/cpuKarakterleri";
import SoundPressable from "../components/SoundPressable";
import TimerBar from "../components/TimerBar";

const count3Source = require("../assets/sounds/count-3.mp3");
const count2Source = require("../assets/sounds/count-2.mp3");
const count1Source = require("../assets/sounds/count-1.mp3");

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
  const [started, setStarted] = useState(false);
  const [roundSeconds, setRoundSeconds] = useState(FIVE_CLUB_TIME_OPTIONS[1]);
  const [inputMode, setInputMode] = useState("voice"); // "keyboard" | "voice"
  // 27 Eylül 2026: zorluk artık 1-10 (bkz. lib/modAyarlari.js). Kulüp havuzu
  // 3 kademe: 1-3 normal, 4-7 zor, 8-10 çok zor; CPU'nun pas geçme ihtimali
  // ise 10 kademenin her birinde ayrı.
  const [zorluk10, setZorluk10] = useState(5);
  // 4 Ekim 2026 (benchmark .29237 + Kerem: "son turun altın tur olması isteğe
  // bağlı olsun") — tur sayısı 3 ya da 5; son tur altın tur (puanlar ×2) kurulumda
  // açılıp kapatılır, varsayılan KAPALI.
  const [turSayisi, setTurSayisi] = useState(FIVE_CLUB_TOTAL_ROUNDS);
  const [altinTur, setAltinTur] = useState(false);
  // 4 Ekim 2026 — CPU gerçek rakip (lib/cpuKarakterleri.js) + maç sonu kartı verisi
  const karakter = useMemo(() => karakterSec(zorluk10), [zorluk10]);
  // 4 Ekim 2026 (.28810) — 2 kişilikte Ayarlar'daki oyuncu adları.
  const { adlar } = useOyuncuAdlari(2);
  const oyuncuEtiketi = vsCpu ? { p1: "Sen", p2: kisaAd(karakter) } : { p1: adlar[0], p2: adlar[1] };
  const [turlar, setTurlar] = useState([]);
  const [dogrularim, setDogrularim] = useState([]);
  const difficulty = zorluk10 <= 3 ? "normal" : zorluk10 <= 7 ? "zor" : "cokZor";

  const [usedClubKeys, setUsedClubKeys] = useState(new Set());
  const [roundNumber, setRoundNumber] = useState(1);
  const dusunceSozu = useMemo(() => tepki(karakter, "dusunuyor"), [karakter, roundNumber]);   // Paket 31
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

  // 28 Eylül 2026 — Eşleşme Profili
  const eslesme = useEslesmeProfili();
  // 4 Ekim 2026 — son 2 turun kulüpleri (bir sonraki turda tekrar gelmesin)
  const sonKuluplerRef = useRef([]);
  const enIyiCevap = useMemo(
    () => (phase === "result" && round ? enIyiFiveClubCevabi(PLAYERS, round.clubs, taninirlik) : null),
    [phase, round]
  );
  const startNewRound = useCallback(() => {
    const clubPool = FIVE_CLUB_DIFFICULTIES[difficulty].pool;
    setUsedClubKeys((prev) => {
      const r = generateFiveClubRound(PLAYERS, clubPool, prev, undefined, eslesme.derlenmis, sonKuluplerRef.current.flat());
      setRound(r);
      if (!r) return prev;
      sonKuluplerRef.current = [...sonKuluplerRef.current, r.clubs].slice(-2);
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
  }, [roundSeconds, difficulty, eslesme.derlenmis]);

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
    const pasEsigi = 0.32 - (zorluk10 - 1) * 0.028; // 1 -> %32 ... 10 -> %7
    if (sansliMi < pasEsigi) return null;

    // İnsanın bu turda söylediği ismi CPU tekrar söylemesin — hem kuralın
    // kendisi bunu yasaklıyor hem de tuhaf görünürdü.
    const soylenmis = roundResults.p1?.player?.name || null;

    for (const n of tercih) {
      // 4 Ekim 2026 — CPU yalnızca tanıyabileceği oyuncuları söyler (lib/taninirlik.js).
      const aday = (kovalar[n] || []).filter((a) => a.player.name !== soylenmis && cpuBilirMi(a.player.name, zorluk10));
      if (aday.length) {
        return aday[Math.floor(Math.random() * aday.length)];
      }
    }
    return null;
  }, [round, difficulty, roundResults, zorluk10]);

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
  const altinTurMu = altinTur && roundNumber === turSayisi;
  function recordTurnResult(who, gained, player, matchedClubs) {
    if (altinTurMu) gained = gained * 2;
    setRoundResults((prev) => ({ ...prev, [who]: { gained, player: player || null, matchedClubs: matchedClubs || [] } }));
    if (who === "p1") setScoreP1((s) => s + gained);
    else setScoreP2((s) => s + gained);
    if (who === "p1" && gained > 0 && player) {
      setDogrularim((l) => [...l, { oyuncu: player, etiket: `${gained} kulüp: ${(matchedClubs || []).join(", ")}` }]);
    }
    if (gained > 0) {
      // 26 Eylül 2026 (Kerem: "cpu'nun söyledikleri hiçbir modda ansiklopediyi açmasın. kendi söylediklerimiz açsın.")
      // CPU'ya karşı oyunda CPU "p2" olarak oynuyor. Eskiden CPU'nun bulduğu
      // futbolcu koleksiyona ekleniyor VE CPU'nun başarısı kullanıcının
      // istatistiğine GALİBİYET olarak yazılıyordu. İkisi de düzeltildi.
      // (Aynı telefonda iki kişi oynarken ikisi de gerçek insan, ikisi de sayılır.)
      const cpuHamlesi = vsCpu && who === "p2";
      if (player && !cpuHamlesi) unlockPlayer(player.name);
      if (!cpuHamlesi) recordRound(vsCpu ? "fiveClubsCpu" : "fiveClubs", true);
      if (!cpuHamlesi && (matchedClubs || []).length >= 4) gorevOlayi("besKulup4").catch(() => {});
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
    const a = roundResults.p1?.gained || 0, b = roundResults.p2?.gained || 0;
    setTurlar((l) => [...l, a > b ? "sen" : b > a ? "rakip" : "yok"]);
    if (roundNumber >= turSayisi) {
      setPhase("gameOver");
    } else {
      setRoundNumber((n) => n + 1);
      startNewRound();
    }
  }

  function restartGame() {
    setTurlar([]);
    setDogrularim([]);
    setScoreP1(0);
    setScoreP2(0);
    setRoundNumber(1);
    setUsedClubKeys(new Set());
    startNewRound();
  }

  const modVarsayilanKaydet = useModVarsayilanlari("fiveClubs", { zorluk: setZorluk10, sure: setRoundSeconds, yontem: setInputMode });

  // 4 Ekim 2026 — kurulumsuz başlangıç (.27319): mod son ayarlarla hemen başlar;

  // kurulum sol alttaki ⚙ ya da mod rehberindeki "Ayarları değiştir" ile açılır.

  useKurulumKapisi("fiveClubs", {
    kurulumda: !started,
    baslat: () => setStarted(true),
    kurulumaDon: () => { setStarted(false); setScoreP1(0); setScoreP2(0); setRoundNumber(1); },
  });
  useEffect(() => {
    oyunBilgisiniYaz("fiveClubs", { satirlar: ayarSatirlari({ zorluk: zorluk10, sure: roundSeconds, yontem: inputMode, ekstra: [["Rakip", vsCpu ? `${karakter.avatar} ${kisaAd(karakter)}` : "2 kişi"], ["Tur sayısı", String(turSayisi)], ["Son tur altın", altinTur ? "Açık (×2)" : "Kapalı"]] }) });
  }, [zorluk10, roundSeconds, inputMode, vsCpu, turSayisi, altinTur, karakter]);
  // Tur sayısı ve altın tur da "son seçimler" arasında hatırlanır.
  const turAyariYuklendi = useRef(false);
  useEffect(() => {
    if (turAyariYuklendi.current || !settings) return;
    const k = settings.modVarsayilanlari && settings.modVarsayilanlari.fiveClubs;
    if (!k) return;
    turAyariYuklendi.current = true;
    if (k.turSayisi === 3 || k.turSayisi === 5) setTurSayisi(k.turSayisi);
    if (typeof k.altinTur === "boolean") setAltinTur(k.altinTur);
  }, [settings]);

  if (!started) {
    // 27 Eylül 2026 — ortak kurulum ekranı (bkz. components/ModKurulum.js).
    // Bu modun zorluğu kulüp HAVUZU (Normal / Zor / Çok Zor) olduğu için
    // kendi 3 kademesi kullanılıyor; görünüm diğer modlarla aynı.
    return (
      <ModKurulum
        modId="fiveClubs"
        baslik={vsCpu ? "5 Kulüp — CPU'ya Karşı" : "5 Kulüp — 2 Kişi"}
        aciklama={vsCpu
          ? "Ekranda 5 büyük kulüp çıkar. Sen ve CPU sırayla birer futbolcu söylersiniz; futbolcu bu kulüplerin kaçında oynadıysa o kadar puan (en az 2). 3 tur, en çok puan kazanır."
          : "Ekranda 5 büyük kulüp çıkar. Sırayla birer futbolcu söylersiniz; futbolcu bu kulüplerin kaçında oynadıysa o kadar puan (en az 2). 3 tur, en çok puan kazanır."}
        vurgu={MODE_COLORS.fiveClubs}
        onGeri={onExitSilent || onExit}
        onVarsayilanKaydet={() => modVarsayilanKaydet({ zorluk: zorluk10, sure: roundSeconds, yontem: inputMode, turSayisi, altinTur })}
        onBasla={() => setStarted(true)}
      >
        <KurulumBolum baslik="ZORLUK">
          <ZorlukSecici
            deger={zorluk10}
            onDegis={setZorluk10}
            aciklama={(z) =>
              (z <= 3 ? "Sadece en büyük kulüpler." : z <= 7 ? "Şampiyonlar Ligi klasikleri de girer." : "54 kulüplük tam havuz.") +
              (vsCpu ? (z <= 3 ? " CPU sık pas geçer." : z <= 7 ? " CPU dengeli." : " CPU en iyi cevabı arar.") : "")}
          />
        </KurulumBolum>
        <EslesmeProfiliBolumu eslesme={eslesme} not="Ekrana gelen 5 kulüp profilin bölge ve kulüp ayarlarına göre seçilir." />
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
        {!vsCpu ? <OyuncuAdlariBolumu adet={2} /> : null}
        <KurulumBolum baslik="TUR SAYISI">
          <SecimCipleri secenekler={[{ deger: 3, etiket: "3 tur" }, { deger: 5, etiket: "5 tur" }]} secili={turSayisi} onSec={setTurSayisi} />
        </KurulumBolum>
        <KurulumBolum baslik="SON TUR ALTIN TUR" not="Açıkken son turda bütün puanlar ×2 — geride kalan son turda maçı çevirebilir.">
          <SecimCipleri secenekler={[{ deger: false, etiket: "Kapalı" }, { deger: true, etiket: "Açık ★" }]} secili={altinTur} onSec={setAltinTur} />
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
        <Text style={styles.buzzBtnSub}>BİLİYORUM!</Text>
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
            <Ionicons name={answersRevealed ? "eye-off" : "eye"} size={14} color={COLORS.accentDark} />
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
      {/* 28 Eylül 2026 — klavye cevap kutusunu kapatıyordu (denetim bulgusu #1). */}
      <KlavyeAlani style={{ width: "100%" }}>
      {showReport && (
        <ReportModal
          visible={showReport}
          onClose={() => setShowReport(false)}
          playerContext={feedback?.player ? feedback.player.name : "Bilinmiyor"}
        />
      )}

      {/* Paket 31 — standart üst çubuk */}
      <OyunUstCubugu
        baslik="5 Kulüp"
        alt={phase === "gameOver" ? null : altinTurMu ? `★ Altın tur · ${roundNumber} / ${turSayisi}` : `Tur ${roundNumber} / ${turSayisi}`}
        onCikis={onExit}
        onBildir={() => setShowReport(true)}
      />

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
        <KlavyeScroll
          style={{ flex: 1, width: "100%" }}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          <SkorSeridi
            sol={{ etiket: vsCpu ? "SEN" : String(oyuncuEtiketi.p1).toLocaleUpperCase("tr"), puan: scoreP1, renk: COLORS.accent }}
            sag={{ etiket: vsCpu ? rakipEtiketi(karakter) : String(oyuncuEtiketi.p2).toLocaleUpperCase("tr"), puan: scoreP2, karakter: vsCpu ? karakter : null, renk: COLORS.cta }}
            orta={`${turSayisi} tur`}
          />
          {vsCpu && cpuDusunuyor ? <RakipTepkisi karakter={karakter} metin={dusunceSozu} style={{ marginTop: -4, marginBottom: 8 }} /> : null}

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
                  <KulupParlakligi ad={c} guc={isMatched ? 0.12 : 0.3} />
                  <View style={styles.clubBadgeWrap}>
                    <TeamBadge name={c} size={40} />
                  </View>
                  <Text allowFontScaling={false} style={styles.clubName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{c}</Text>
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
                {p1Answered || p2Answered ? "Sırada diğer oyuncu var — BİLİYORUM'a bassın!" : "En az 2 kulüpte oynamış bir futbolcu söyle!"}
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

              {/* 4 Ekim 2026 (Kerem: "tur sonunda en iyi cevap") */}
              {enIyiCevap ? (
                <View style={styles.enIyiKart}>
                  <Text style={styles.enIyiEtiket}>BU TURUN EN İYİ CEVABI</Text>
                  <View style={styles.enIyiSatir}>
                    <PlayerPhoto name={enIyiCevap.player.name} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.enIyiAd} numberOfLines={1}>{enIyiCevap.player.name}</Text>
                      <Text style={styles.enIyiAlt} numberOfLines={2}>
                        5 kulübün {enIyiCevap.count}'{enIyiCevap.count === 2 ? "si" : enIyiCevap.count === 3 ? "ü" : enIyiCevap.count === 4 ? "ü" : "i"}: {enIyiCevap.matchedClubs.join(", ")}
                      </Text>
                    </View>
                    <Text style={styles.enIyiPuan}>+{enIyiCevap.count}</Text>
                  </View>
                </View>
              ) : null}

              {!showAnswersPanel && (
                <Pressable style={styles.showAnswersBtn} hitSlop={10} onPress={() => setShowAnswersPanel(true)}>
                  <Text style={styles.showAnswersBtnText}>Doğru cevapları göster</Text>
                </Pressable>
              )}
              {showAnswersPanel && renderAnswersPanel()}

              <Pressable style={styles.primaryBtn} onPress={goToNextRound}>
                <Text style={styles.primaryBtnText}>
                  {roundNumber >= turSayisi ? "Sonuçları Gör" : roundNumber === turSayisi - 1 && altinTur ? "Altın Tura Geç ★" : "Sıradaki Tur"}
                </Text>
              </Pressable>
            </View>
          )}
        </KlavyeScroll>
      )}

      {phase === "gameOver" && vsCpu && (
        <MacSonuKarti
          modAdi="5 Kulüp"
          modeId="fiveClubsCpu"
          skorSen={scoreP1}
          skorRakip={scoreP2}
          rakip={{ ad: kisaAd(karakter), avatar: karakter.avatar, renk: karakter.renk }}
          turlar={turlar}
          enIyi={(() => {
            if (!dogrularim.length) return null;
            const en = [...dogrularim].sort((x, y) => taninirlik(x.oyuncu) - taninirlik(y.oyuncu))[0];
            return { ad: en.oyuncu.name, alt: en.etiket };
          })()}
          kazanilanXp={0}
          onRovans={restartGame}
          onMenu={onExitSilent || onExit}
        />
      )}
      {phase === "gameOver" && !vsCpu && (
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 4 }}>
          <IsimliSkorTablosu
            modAdi="5 Kulüp"
            oyuncular={[{ ad: adlar[0], puan: scoreP1 }, { ad: adlar[1], puan: scoreP2 }]}
            altYazi={`${turSayisi} tur${altinTur ? " · son tur altın" : ""}`}
            onRovans={restartGame}
            onMenu={onExitSilent || onExit}
          />
        </View>
      )}
      </KlavyeAlani>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20, paddingBottom: 40 },
  scrollContainer: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "900", textAlign: "center" },
  subtitle: { color: COLORS.textMuted, fontSize: 13, marginTop: 8, lineHeight: 19, textAlign: "center" },
  center: { color: COLORS.text, textAlign: "center", marginBottom: 16 },

  diffBtn: { borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  diffBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.card },
  diffBtnText: { color: COLORS.textMuted, fontWeight: "800", fontSize: 13 },
  diffBtnTextActive: { color: COLORS.accent },

  topInfoRow: { alignItems: "center", marginBottom: 12 },
  roundBadge: { color: COLORS.cta, fontWeight: "900", fontSize: 13, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  scoreRow: { flexDirection: "row", gap: 20 },
  scoreText: { color: COLORS.textMuted, fontWeight: "700", fontSize: 13 },

  // 4 Eylül 2026 (Kerem: "logo altındaki kısaltma takım adıyla üst üste
  // biniyor") — badge'e sabit yükseklikli bir sarmalayıcı (clubBadgeWrap) +
  // isme daha fazla üst boşluk verildi, TeamBadge.js'teki overflow fix'iyle
  // birlikte artık taşma/örtüşme olmuyor.
  clubsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 18, padding: 14 },
  clubCell: { width: "30%", alignItems: "center", paddingVertical: 10, borderRadius: 12, position: "relative", minHeight: 92, overflow: "hidden" },
  clubCellMatched: { backgroundColor: vurguZemini(0.16), borderWidth: 1, borderColor: saydam(COLORS.accent, 0.5) },
  clubBadgeWrap: { height: 40, width: 40, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  clubName: { color: COLORS.text, fontSize: 12, fontWeight: "800", textAlign: "center", lineHeight: 16 },
  clubCheck: { position: "absolute", top: 2, right: 4, flexDirection: "row", gap: 3 },
  finderBadge: { width: 17, height: 17, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  finderBadgeP1: { backgroundColor: COLORS.accent },   // Oyuncu 1 — yeşil
  finderBadgeP2: { backgroundColor: COLORS.cta },   // Oyuncu 2 — altın/amber
  finderBadgeText: { color: COLORS.accentDark, fontSize: 12, fontWeight: "900" },

  hintText: { color: COLORS.textMuted, fontSize: 12, textAlign: "center", marginTop: 10, fontStyle: "italic" },
  buzzRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  buzzBtn: { flex: 1, borderColor: COLORS.accent, borderWidth: 2, borderRadius: 18, paddingVertical: 24, alignItems: "center", justifyContent: "center", minHeight: 96 },
  buzzBtnText: { color: COLORS.accent, fontWeight: "900", fontSize: 14 },
  buzzBtnSub: { color: COLORS.textMuted, fontWeight: "700", fontSize: 12, marginTop: 4 },
  buzzBtnCpu: { opacity: 0.75, borderStyle: "dashed" },
  buzzBtnDone: { borderColor: COLORS.cardBorder, backgroundColor: COLORS.card, paddingHorizontal: 8 },
  buzzBtnDoneLabel: { color: COLORS.textMuted, fontWeight: "900", fontSize: 12 },
  buzzBtnDoneScore: { color: COLORS.accent, fontWeight: "800", fontSize: 12, marginTop: 6, textAlign: "center" },
  passLink: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },

  answeringText: { color: COLORS.accent, textAlign: "center", fontWeight: "800", marginBottom: 12 },
  input: { backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 14, padding: 16, color: COLORS.text, fontSize: 16, marginBottom: 12 },
  suggestBox: { marginTop: -6, marginBottom: 12, backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  suggestRow: { paddingVertical: 10, paddingHorizontal: 14, borderBottomColor: COLORS.card, borderBottomWidth: 1 },
  suggestText: { color: COLORS.accent, fontSize: 14, fontWeight: "600" },

  primaryBtn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: COLORS.accentDark, fontWeight: "900", textTransform: "uppercase", fontSize: 13 },
  backLink: { color: COLORS.textMuted, textAlign: "center", fontSize: 12 },

  micBtnBig: { backgroundColor: COLORS.accent, borderRadius: 20, paddingVertical: 28, alignItems: "center", justifyContent: "center", marginTop: 12 },
  micBtnActive: { backgroundColor: COLORS.danger },
  micBtnBigText: { color: COLORS.accentDark, fontWeight: "900", fontSize: 18 },
  heardBanner: { backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 4 },
  heardBannerText: { color: COLORS.text, fontSize: 14, fontStyle: "italic", textAlign: "center" },
  switchModeLink: { color: COLORS.accent, fontSize: 12, fontWeight: "700" },
  voiceError: { color: COLORS.danger, fontSize: 12, textAlign: "center", marginTop: 8 },
  voiceHint: { color: COLORS.textMuted, fontSize: 12, textAlign: "center", marginTop: 8 },

  resultRow: { flexDirection: "row", gap: 12, width: "100%" },
  resultCard: { flex: 1, backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 16, padding: 14, alignItems: "center" },
  resultCardLabel: { color: COLORS.textMuted, fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  resultCardName: { color: COLORS.text, fontWeight: "800", fontSize: 13, marginTop: 6, textAlign: "center" },
  resultCardGain: { color: COLORS.cta, fontWeight: "900", fontSize: 14, marginTop: 6 },

  enIyiKart: { width: "100%", marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: "#2A1F06", borderWidth: 1, borderColor: "#5A430E" },
  enIyiEtiket: { color: "#FFD98A", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  enIyiSatir: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  enIyiAd: { color: COLORS.text, fontSize: 15, fontWeight: "900" },
  enIyiAlt: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  enIyiPuan: { color: COLORS.cta, fontSize: 22, fontWeight: "900" },
  showAnswersBtn: { borderColor: COLORS.accent, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18, marginBottom: 12, marginTop: 16 },
  showAnswersBtnText: { color: COLORS.accent, fontSize: 13, fontWeight: "700" },
  answersPanelTitle: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  revealToggleBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.accent, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  revealToggleText: { color: COLORS.accentDark, fontWeight: "900", fontSize: 12 },
  bucketHeader: { color: COLORS.cta, fontWeight: "900", fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  // 4 Eylül 2026 (Kerem: "doğru cevap içindeki kutucuklar sabit boyutta
  // olmalı, liste içinde kaydırılabilmeli") — KÖK NEDEN: gizli/açık satırlar
  // farklı içerik yüksekliğine sahipti (maskeli satır sadece tek satır metin,
  // açık satır foto+iki satır metin) — "Görünür Yap"a basınca liste boyu
  // ZIPLIYORDU. ÇÖZÜM: her satıra sabit `height` verildi (hem maskeli hem
  // açık halde AYNI yükseklik), kutu (answersBox) SABİT bir yüksekliğe
  // (maxHeight yerine height) kilitlendi ve içi HER ZAMAN scrollView ile
  // kaydırılabilir.
  answersBox: { height: 220, width: "100%", backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 14, marginBottom: 12 },
  answersBoxItem: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  answersBoxSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  answersBoxRow: { flexDirection: "row", alignItems: "center", gap: 10, height: 44 },
  maskedAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.cardBorder },
  maskedLineWide: { width: "55%", height: 10, borderRadius: 5, backgroundColor: COLORS.cardBorder },
  maskedLineNarrow: { width: "35%", height: 8, borderRadius: 4, backgroundColor: COLORS.cardBorder, marginTop: 6 },
});
