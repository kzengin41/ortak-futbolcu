import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import ModKurulum, { KurulumBolum, SecimCipleri, ZorlukSecici, SureSecici, KapsamDugmesi } from "../components/ModKurulum";
import { useModVarsayilanlari, useKurulumKapisi, oyunBilgisiniYaz, ayarSatirlari } from "../lib/modAyarlari";
import { COLORS, MODE_COLORS } from "../lib/theme";
import GameBackground from "../components/GameBackground";
import { PLAYERS } from "../lib/players";
import { CLUB_INFO } from "../lib/clubs";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import { useAppSettings } from "../lib/SettingsContext";
import {
  generateRound, generateCountryTeamRound, generateDraftRound, playersForPair, computeRoundPool,
  computeCountryTeamPool, findMatchedPlayer, findMatchedTeam, suggestPlayers, buildSuggestIndex,
  buildClubSuggestIndex, suggestClubs, sesIpuclari,
} from "../lib/gameEngine";
import { recognitionScore } from "../lib/clubWeights";
import { cpuCevabiSec, taninirlik } from "../lib/taninirlik";
import { karakterSec, tepki, dusunmeSuresi, bilmeOlasiligi } from "../lib/cpuKarakterleri";
import { countryTr } from "../lib/countryNamesTr";
import { flagForCountry } from "../lib/countryFlags";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { useVoiceInput } from "../lib/useVoiceInput";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import VoiceConfirm from "../components/VoiceConfirm";
import AnswerFeedback from "../components/AnswerFeedback";
import ReportModal from "../components/ReportModal";
import CountdownOverlay from "../components/CountdownOverlay";
import TeamBadge from "../components/TeamBadge";
import PlayerPhoto, { oncedenYukle } from "../components/PlayerPhoto";
import EslesmeProfiliPenceresi from "../components/EslesmeProfiliPenceresi";
import SoundPressable from "../components/SoundPressable";
import TimerBar from "../components/TimerBar";
import PoolEmpty from "../components/PoolEmpty";
import MacSonuKarti from "../components/MacSonuKarti";

const count3Source = require("../assets/sounds/count-3.mp3");
const count2Source = require("../assets/sounds/count-2.mp3");
const count1Source = require("../assets/sounds/count-1.mp3");

// ============================================================================
// ORTAK KULÜP — 4 Ekim 2026 (CpuGame / CountryTeamCpu / DraftGameCpu birleşti)
//
// Benchmark kararları (Kerem, 2–3 Ekim):
//  • "Kulüp & Ülke" ve "Hızlı Antrenman" ayrı modlar değil, Ortak Kulüp'ün
//    türleri: başlangıçta Kulüp × Kulüp / Kulüp × Ülke / Takımı sen seç /
//    Çoktan seçmeli. (Çoktan seçmeli kendi ekranında: QuickGameCpu.)
//  • CPU modunda BUZZ YOK: cevap kutusu baştan açık, CPU aynı anda "düşünüyor".
//    Önce doğru yazan turu alır. 3 yanlış hakkın var; bitince ya da "Bilemedim"
//    deyince CPU'nun cevabı beklenmeden açılır.
//  • CPU gerçek rakip: zorluğa göre karakter (lib/cpuKarakterleri.js), yalnızca
//    tanıyabileceği oyuncuları bilir (lib/taninirlik.js), laf atar.
//  • Zorluk = çiftin ortak futbolcu sayısı; tur başında "bu ikilide N ortak
//    futbolcu var" yazar (lib/gameEngine.js ciftZorlugaUygunMu).
//  • Ülke turunda vatandaşlık ya da milli takım ikisi de geçer (ekranda yazar).
//  • Maç sonu kartı: skor, tur kareleri, en nadir cevabın, Paylaş, Rövanş.
// ============================================================================

const TURLER = [
  { deger: "kulup", etiket: "Kulüp × Kulüp", ikon: "shield-checkmark", not: "İki kulüp çıkar; ikisinde de oynamış bir futbolcuyu rakibinden önce yaz." },
  { deger: "ulke", etiket: "Kulüp × Ülke", ikon: "earth", not: "Bir ülke ve bir kulüp çıkar; o ülkeden, o kulüpte oynamış bir futbolcu bul." },
  { deger: "secim", etiket: "Takımı sen seç", ikon: "hand-left", not: "Bir kulübü sen yazarsın, ikincisini rakibin seçer." },
  { deger: "coktan", etiket: "Çoktan seçmeli", ikon: "flash", not: "4 şıklı, süreye karşı seri cevaplama. Yazmak yok." },
];
const MOD_ID = { kulup: "cpu", ulke: "countryTeamCpu", secim: "draftCpu" };
const GALIBIYET = [3, 5, 7, 10];
const SURELER = [15, 20, 30, 45];
const YANLIS_HAKKI = 3;

export default function OrtakKulupScreen({
  onExit, onExitSilent, onModaGit, hemenBasla = false, ilkCift = null, tur: baslangicTuru = "kulup",
}) {
  const [tur, setTur] = useState(baslangicTuru);
  const [difficulty, setDifficulty] = useState(5);
  const [roundSeconds, setRoundSeconds] = useState(20);
  const [targetScore, setTargetScore] = useState(5);
  const [inputMode, setInputMode] = useState("keyboard");
  const eslesme = useEslesmeProfili();
  const { settings: appSettings, loaded: appSettingsLoaded } = useAppSettings();
  const [profilAcik, setProfilAcik] = useState(false);

  const [started, setStarted] = useState(false);
  const [usedPairs, setUsedPairs] = useState(new Set());
  const [round, setRound] = useState(null);
  const [phase, setPhase] = useState("countdown"); // takimSec | rakipSeciyor | countdown | racing | result | gameOver
  const [timeLeft, setTimeLeft] = useState(20);
  const [cpuKalan, setCpuKalan] = useState(10);
  const [answerInput, setAnswerInput] = useState("");
  const [hak, setHak] = useState(YANLIS_HAKKI);
  const [p1Kilitli, setP1Kilitli] = useState(false);
  const [cpuKilitli, setCpuKilitli] = useState(false);
  const [cpuSoz, setCpuSoz] = useState("");
  const [yanlisMesaj, setYanlisMesaj] = useState(null);
  const [takimGirdi, setTakimGirdi] = useState("");
  const [takimHata, setTakimHata] = useState(null);

  const [scoreP1, setScoreP1] = useState(0);
  const [scoreCpu, setScoreCpu] = useState(0);
  const [turlar, setTurlar] = useState([]);
  const [dogrularim, setDogrularim] = useState([]);
  const [resultText, setResultText] = useState("");
  const [lastWinner, setLastWinner] = useState(null);
  const [winningPlayer, setWinningPlayer] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showResultPanel, setShowResultPanel] = useState(true);
  const [showAnswers, setShowAnswers] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [xpVerildi, setXpVerildi] = useState(false);
  const [macSonuSozu, setMacSonuSozu] = useState("");

  const karakter = useMemo(() => karakterSec(difficulty), [difficulty]);
  const modId = MOD_ID[tur] || "cpu";
  // Eski zilli süreler (8–10 sn) yazarak cevaplamaya yetmez; 15'ten kısaysa 20.
  const turSuresi = roundSeconds >= 15 ? roundSeconds : 20;

  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const countPlayer3 = useAudioPlayer(count3Source);
  const countPlayer2 = useAudioPlayer(count2Source);
  const countPlayer1 = useAudioPlayer(count1Source);

  // ------------------------------------------------------------------ ses
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceInput(() =>
    round ? sesIpuclari(PLAYERS, [round.sol, round.sag].filter((x) => x.tip === "kulup").map((x) => x.ad)) : []
  );
  const [voiceError, setVoiceError] = useState(null);
  const [sesOnayIstegi, setSesOnayIstegi] = useState(null);
  const sesOnayiAcik = appSettings?.voiceConfirm !== false;
  const duraklat = isProcessing || !!sesOnayIstegi;

  async function handleMicPress() {
    setVoiceError(null);
    if (isRecording) {
      try {
        const text = await stopRecording();
        if (!text) { setVoiceError("Sesi anlayamadım, tekrar dener misin?"); return; }
        const gonder = (a) => { setAnswerInput(a); cevapGonder(a); };
        const yaz = (a) => { setAnswerInput(a); setInputMode("keyboard"); };
        if (sesOnayiAcik) setSesOnayIstegi({ duyulan: text, ad: text, gonder, yaz });
        else gonder(text);
      } catch (err) {
        setVoiceError(err.message || "Ses tanıma başarısız oldu");
      }
    } else {
      try { await startRecording(); } catch (err) { setVoiceError(err.message || "Mikrofona erişilemedi"); }
    }
  }

  // ------------------------------------------------------------------ havuzlar
  const allowedClubs = eslesme.derlenmis.kapsam;
  const presetLabel = eslesme.derlenmis.etiket;
  const kulupHavuzu = useMemo(
    () => (started && tur === "kulup" ? computeRoundPool(PLAYERS, eslesme.derlenmis, difficulty) : null),
    [started, tur, eslesme.derlenmis, difficulty]
  );
  const ulkeHavuzu = useMemo(
    () => (started && tur === "ulke" ? computeCountryTeamPool(PLAYERS, eslesme.derlenmis, difficulty) : null),
    [started, tur, eslesme.derlenmis, difficulty]
  );
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const suggestions = useMemo(() => suggestPlayers(suggestIndex, answerInput), [suggestIndex, answerInput]);
  const clubIndex = useMemo(() => (tur === "secim" ? buildClubSuggestIndex(Object.keys(CLUB_INFO), PLAYERS) : null), [tur]);
  const kulupOnerileri = useMemo(
    () => (clubIndex && takimGirdi.trim().length >= 2 ? suggestClubs(clubIndex, takimGirdi, 4) : []),
    [clubIndex, takimGirdi]
  );

  // ------------------------------------------------------------------ tur kurulumu
  const ilkCiftRef = useRef(ilkCift);
  function turuSifirla() {
    setAnswerInput("");
    setHak(YANLIS_HAKKI);
    setP1Kilitli(false);
    setCpuKilitli(false);
    setYanlisMesaj(null);
    setResultText("");
    setWinningPlayer(null);
    setLastWinner(null);
    setFeedback(null);
    setShowResultPanel(true);
    setShowAnswers(false);
    setTimeLeft(turSuresi);
    setCpuKalan(Math.round(dusunmeSuresi(difficulty) / 1000));
    setCpuSoz(tepki(karakter, "dusunuyor"));
  }

  const yeniTur = useCallback((sifirdan = false) => {
    const kullanilan = sifirdan === true ? new Set() : usedPairs;
    turuSifirla();
    if (tur === "secim") {
      setRound(null);
      setTakimGirdi("");
      setTakimHata(null);
      setPhase("takimSec");
      return;
    }
    let r = null;
    const ic = ilkCiftRef.current;
    if (tur === "kulup" && ic && ic.length === 2) {
      ilkCiftRef.current = null;
      const uygun = !allowedClubs || (allowedClubs.has(ic[0]) && allowedClubs.has(ic[1]));
      const gecerli = uygun ? playersForPair(PLAYERS, ic[0], ic[1]) : [];
      if (gecerli.length) r = { sol: { tip: "kulup", ad: ic[0] }, sag: { tip: "kulup", ad: ic[1] }, validAnswers: gecerli, key: [ic[0], ic[1]].sort().join("|") };
    }
    if (!r && tur === "kulup") {
      const g = generateRound(kulupHavuzu, PLAYERS, kullanilan, allowedClubs, difficulty);
      if (g) r = { sol: { tip: "kulup", ad: g.teamA }, sag: { tip: "kulup", ad: g.teamB }, validAnswers: g.validAnswers, key: g.key };
    }
    if (!r && tur === "ulke") {
      const g = generateCountryTeamRound(ulkeHavuzu, PLAYERS, kullanilan, allowedClubs, difficulty);
      if (g) r = { sol: { tip: "ulke", ad: g.country }, sag: { tip: "kulup", ad: g.club }, validAnswers: g.validAnswers, key: g.key };
    }
    turaBasla(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tur, kulupHavuzu, ulkeHavuzu, usedPairs, allowedClubs, difficulty, karakter, turSuresi]);

  function turaBasla(r) {
    setRound(r);
    if (!r) return;
    oncedenYukle(r.validAnswers);
    setUsedPairs((prev) => new Set(prev).add(r.key));
    setPhase("countdown");
  }

  function takimSecildi(metin) {
    const t = String(metin || takimGirdi).trim();
    if (!t) return;
    const kulup = findMatchedTeam(t, Object.keys(CLUB_INFO));
    if (!kulup) { setTakimHata(`"${t}" diye bir kulüp bulamadım`); return; }
    if (allowedClubs && !allowedClubs.has(kulup)) { setTakimHata(`${kulup} eşleşme profilinde yok`); return; }
    setTakimHata(null);
    setPhase("rakipSeciyor");
    setTimeout(() => {
      const g = generateDraftRound(kulup, PLAYERS, usedPairs, allowedClubs, difficulty);
      if (!g) { setTakimHata(`${kulup} ile eşleşecek uygun kulüp kalmadı, başka bir kulüp dene`); setPhase("takimSec"); return; }
      turuSifirla();
      turaBasla({ sol: { tip: "kulup", ad: kulup }, sag: { tip: "kulup", ad: g.teamB }, validAnswers: g.validAnswers, key: g.key });
    }, 900);
  }

  useEffect(() => {
    if (started) yeniTur();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // ------------------------------------------------------------------ zamanlayıcı (tur + CPU)
  useEffect(() => {
    if (phase !== "racing" || duraklat) return;
    if (timeLeft <= 0) { turuBitir(null); return; }
    const t = setTimeout(() => {
      setTimeLeft((s) => s - 1);
      if (!cpuKilitli) setCpuKalan((c) => c - 1);
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft, duraklat, cpuKilitli]);

  useEffect(() => {
    if (phase !== "racing" || cpuKilitli || cpuKalan > 0) return;
    cpuHamlesi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpuKalan, phase, cpuKilitli]);

  // CPU cevabını söyler ya da "bilemedim" der. `sonHamle`: oyuncu çekildi,
  // CPU bilemezse tur kimsesiz biter.
  function cpuHamlesi(sonHamle = false) {
    if (!round) return;
    const bil = Math.random() < bilmeOlasiligi(difficulty);
    const pick = bil ? cpuCevabiSec(round.validAnswers, difficulty) : null;
    if (pick) { turuBitir("cpu", pick); return; }
    setCpuKilitli(true);
    setCpuSoz(tepki(karakter, "yanlis"));
    if (sonHamle || p1Kilitli) turuBitir(null);
  }

  function oyuncuCekildi() {
    setP1Kilitli(true);
    if (cpuKilitli) turuBitir(null);
    else cpuHamlesi(true);
  }

  function cevapGonder(override) {
    if (phase !== "racing" || p1Kilitli || !round) return;
    const text = String(override !== undefined ? override : answerInput).trim();
    if (!text) return;
    const matched = findMatchedPlayer(text, round.validAnswers);
    if (matched) { turuBitir("p1", matched); return; }
    setAnswerInput("");
    playWrong();
    const kim = findMatchedPlayer(text, PLAYERS);
    const kalan = hak - 1;
    setHak(kalan);
    setYanlisMesaj(
      (kim ? `${kim.name} bu ikisinde oynamadı` : `"${text}" diye bir futbolcu bulamadım`) +
        (kalan > 0 ? ` · ${kalan} hakkın kaldı` : "")
    );
    if (kalan <= 0) oyuncuCekildi();
  }

  function turEtiketi(r) {
    if (!r) return "";
    const ad = (x) => (x.tip === "ulke" ? countryTr(x.ad) : x.ad);
    return `${ad(r.sol)} × ${ad(r.sag)}`;
  }

  function turuBitir(kazanan, oyuncu) {
    if (phase === "result" || phase === "gameOver") return;
    if (oyuncu && kazanan === "p1") unlockPlayer(oyuncu.name);
    setLastWinner(kazanan);
    setWinningPlayer(oyuncu || null);
    setShowAnswers(false);
    setPhase("result");
    setTurlar((l) => [...l, kazanan === "p1" ? "sen" : kazanan === "cpu" ? "rakip" : "yok"]);
    if (kazanan) recordRound(modId, kazanan === "p1");
    if (kazanan === "p1") {
      setScoreP1((s) => s + 1);
      setDogrularim((l) => [...l, { oyuncu, etiket: turEtiketi(round) }]);
      setResultText(`Doğru! ${oyuncu.name}`);
      setCpuSoz(tepki(karakter, "kaybetti"));
      playCorrect();
      setFeedback("correct");
      setShowResultPanel(false);
    } else if (kazanan === "cpu") {
      setScoreCpu((s) => s + 1);
      setResultText(`${karakter.ad} buldu: ${oyuncu.name}`);
      setCpuSoz(tepki(karakter, "dogru"));
      playWrong();
      setFeedback("wrong");
      setShowResultPanel(false);
    } else {
      setResultText(timeLeft <= 0 ? "Süre doldu, kimse bilemedi." : "İkiniz de bilemediniz.");
      setShowResultPanel(true);
    }
  }

  const macBitti = started && (scoreP1 >= targetScore || scoreCpu >= targetScore);
  function macSonunaGec() {
    setMacSonuSozu(tepki(karakter, scoreP1 > scoreCpu ? "kaybetti" : "kazandi"));
    setPhase("gameOver");
    if (!xpVerildi) { setXpVerildi(true); addXP(scoreP1 > scoreCpu ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI); }
  }
  useEffect(() => {
    if (!macBitti || phase !== "result" || showAnswers) return;
    const z = setTimeout(macSonunaGec, 4500);
    return () => clearTimeout(z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [macBitti, phase, showAnswers]);

  function rovans() {
    setScoreP1(0);
    setScoreCpu(0);
    setTurlar([]);
    setDogrularim([]);
    setXpVerildi(false);
    yeniTur();
  }

  // ------------------------------------------------------------------ ayarlar
  const modVarsayilanKaydet = useModVarsayilanlari("cpu", { zorluk: setDifficulty, sure: setRoundSeconds, galibiyet: setTargetScore, yontem: setInputMode });
  // 4 Ekim 2026 — kurulumsuz başlangıç (.27319): mod son ayarlarla hemen başlar;
  // kurulum sol alttaki ⚙ ya da mod rehberindeki "Ayarları değiştir" ile açılır.
  useKurulumKapisi("cpu", {
    kurulumda: !started,
    devreDisi: hemenBasla,
    baslat: () => setStarted(true),
    kurulumaDon: () => {
      setStarted(false); setPhase("countdown"); setRound(null); setUsedPairs(new Set());
      setScoreP1(0); setScoreCpu(0); setTurlar([]); setDogrularim([]); setXpVerildi(false);
    },
  });
  useEffect(() => {
    if (hemenBasla && appSettingsLoaded && !started) { setTur("kulup"); setTargetScore(3); setStarted(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hemenBasla, appSettingsLoaded]);
  useEffect(() => {
    oyunBilgisiniYaz(modId, {
      satirlar: ayarSatirlari({
        zorluk: difficulty, sure: turSuresi, galibiyet: targetScore, lig: presetLabel, yontem: inputMode,
        ekstra: [["Tür", (TURLER.find((t) => t.deger === tur) || TURLER[0]).etiket], ["Rakip", `${karakter.avatar} ${karakter.ad}`], ["Yanlış hakkı", String(YANLIS_HAKKI)]],
      }),
    });
  }, [modId, difficulty, turSuresi, targetScore, presetLabel, inputMode, tur, karakter]);

  // ================================================================== KURULUM
  if (!started && hemenBasla) return <GameBackground style={styles.container} />;
  if (!started) {
    const secili = TURLER.find((t) => t.deger === tur) || TURLER[0];
    return (
      <ModKurulum
        baslik="Ortak Kulüp"
        aciklama="İki kulüp (ya da bir kulüp ve bir ülke) çıkar. İkisinde de oynamış bir futbolcuyu rakibinden önce yaz."
        vurgu={MODE_COLORS.teamTeam}
        onGeri={onExitSilent || onExit}
        onVarsayilanKaydet={() => modVarsayilanKaydet({ zorluk: difficulty, sure: roundSeconds, galibiyet: targetScore, yontem: inputMode })}
        onBasla={() => (tur === "coktan" ? onModaGit?.("quickCpu") : setStarted(true))}
      >
        <KurulumBolum baslik="TÜR" not={secili.not}>
          <SecimCipleri secenekler={TURLER.map(({ deger, etiket, ikon }) => ({ deger, etiket, ikon }))} secili={tur} onSec={setTur} />
        </KurulumBolum>
        {tur !== "coktan" ? (
          <>
            <KurulumBolum baslik="ZORLUK" not={`Rakibin: ${karakter.avatar} ${karakter.ad} — ${karakter.unvan}`}>
              <ZorlukSecici
                deger={difficulty}
                onDegis={setDifficulty}
                aciklama={(z) => (z <= 3 ? "Bol ve tanınmış cevaplı çiftler." : z <= 6 ? "Dengeli çiftler; en az bir tanınmış cevap var." : z <= 8 ? "Az cevaplı çiftler." : "İğne deliği: çoğu çiftte birkaç cevap var.")}
              />
            </KurulumBolum>
            <KurulumBolum baslik="TUR SÜRESİ">
              <SureSecici
                secenekler={SURELER}
                deger={turSuresi}
                onDegis={setRoundSeconds}
                asgari={15}
                azami={90}
                aciklama="Takımlar göründükten sonra cevap için süre. Rakibin de bu sürede düşünüyor."
              />
            </KurulumBolum>
            <KurulumBolum baslik="GALİBİYET SINIRI">
              <SecimCipleri secenekler={GALIBIYET.map((g) => ({ deger: g, etiket: String(g) }))} secili={targetScore} onSec={setTargetScore} />
            </KurulumBolum>
            <KurulumBolum baslik="CEVAP YÖNTEMİ">
              <SecimCipleri
                secenekler={[{ deger: "keyboard", etiket: "Klavye", ikon: "keypad" }, { deger: "voice", etiket: "Mikrofon", ikon: "mic" }]}
                secili={inputMode}
                onSec={setInputMode}
              />
            </KurulumBolum>
            <KurulumBolum baslik="EŞLEŞME PROFİLİ">
              <KapsamDugmesi etiket={presetLabel} onPress={() => setProfilAcik(true)} />
            </KurulumBolum>
          </>
        ) : null}
        <EslesmeProfiliPenceresi
          visible={profilAcik}
          profil={eslesme.profil}
          onUygula={(p) => { eslesme.setMacProfili(p); setProfilAcik(false); }}
          onVarsayilanYap={(p) => { eslesme.genelKaydet(p); setProfilAcik(false); }}
          onClose={() => setProfilAcik(false)}
        />
      </ModKurulum>
    );
  }

  if (!round && phase !== "takimSec" && phase !== "rakipSeciyor" && phase !== "gameOver") {
    return (
      <GameBackground style={styles.container}>
        <PoolEmpty onReset={() => { setUsedPairs(new Set()); yeniTur(true); }} onExit={onExitSilent || onExit} />
      </GameBackground>
    );
  }

  // ================================================================== OYUN
  const Taraf = ({ x }) => (
    <View style={{ flex: 1, alignItems: "center" }}>
      {x.tip === "ulke" ? <Text style={styles.bayrak}>{flagForCountry(x.ad)}</Text> : <TeamBadge name={x.ad} />}
      <Text style={styles.teamName} numberOfLines={2}>{x.tip === "ulke" ? countryTr(x.ad) : x.ad}</Text>
    </View>
  );

  return (
    <GameBackground style={styles.container} klavye="kaydir">
      <View style={styles.ustSatir}>
        <Pressable onPress={() => setShowReport(true)} hitSlop={20}>
          <View style={styles.bildir}>
            <Ionicons name="flag" size={13} color="#FFB020" />
            <Text style={styles.bildirYazi}>BİLDİR</Text>
          </View>
        </Pressable>
        <Pressable onPress={phase === "gameOver" ? (onExitSilent || onExit) : onExit} hitSlop={20}>
          <View style={styles.kapat}><Ionicons name="close" size={22} color="#FF5D5D" /></View>
        </Pressable>
      </View>

      {phase === "countdown" && (
        <CountdownOverlay onComplete={() => setPhase("racing")} countPlayers={[countPlayer3, countPlayer2, countPlayer1]} />
      )}
      {feedback && (
        <AnswerFeedback correct={feedback === "correct"} player={winningPlayer} onDone={() => { setFeedback(null); setShowResultPanel(true); }} />
      )}
      {showReport && (
        <ReportModal visible={showReport} onClose={() => setShowReport(false)} playerContext={winningPlayer ? winningPlayer.name : turEtiketi(round)} />
      )}

      {phase !== "gameOver" && (
        <View style={styles.skorSerit}>
          <View style={styles.skorTaraf}>
            <Text style={styles.skorEtiket}>SEN</Text>
            <Text style={styles.skorSayi}>{scoreP1}</Text>
          </View>
          <Text style={styles.skorHedef}>{targetScore}'te biter</Text>
          <View style={[styles.skorTaraf, { flexDirection: "row-reverse" }]}>
            <View style={[styles.cpuAvatar, { borderColor: karakter.renk }]}><Text style={styles.cpuEmoji}>{karakter.avatar}</Text></View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.skorEtiket} numberOfLines={1}>{karakter.ad.toLocaleUpperCase("tr")}</Text>
              <Text style={styles.skorSayi}>{scoreCpu}</Text>
            </View>
          </View>
        </View>
      )}

      {/* ---------------- Takımı sen seç ---------------- */}
      {(phase === "takimSec" || phase === "rakipSeciyor") && (
        <View style={styles.secimKutu}>
          <Text style={styles.secimBaslik}>{phase === "rakipSeciyor" ? `${karakter.ad} rakip kulübü seçiyor…` : "Bir kulüp yaz"}</Text>
          {phase === "takimSec" ? (
            <>
              <Text style={styles.secimAlt}>İkinci kulübü {karakter.ad} seçecek. Zor bir kulüp onu da zorlar.</Text>
              <View style={styles.girdiSatir}>
                <TextInput
                  style={styles.girdi}
                  value={takimGirdi}
                  onChangeText={(t) => { setTakimGirdi(t); setTakimHata(null); }}
                  onSubmitEditing={() => takimSecildi()}
                  placeholder="Kulüp adı… (ör. Galatasaray)"
                  placeholderTextColor={COLORS.textFaint}
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="send"
                />
                <SoundPressable style={styles.gonder} onPress={() => takimSecildi()} accessibilityLabel="Kulübü seç">
                  <Ionicons name="arrow-forward" size={20} color={COLORS.accentDark} />
                </SoundPressable>
              </View>
              {kulupOnerileri.map((c) => (
                <SoundPressable key={c.display || c} style={styles.oneri} onPress={() => takimSecildi(c.display || c)}>
                  <TeamBadge name={c.display || c} size={24} />
                  <Text style={styles.oneriYazi}>{c.display || c}</Text>
                </SoundPressable>
              ))}
              {takimHata ? <Text style={styles.hata}>{takimHata}</Text> : null}
            </>
          ) : (
            <Text style={[styles.cpuEmoji, { fontSize: 40, marginTop: 16 }]}>{karakter.avatar}</Text>
          )}
        </View>
      )}

      {/* ---------------- Takım kartı ---------------- */}
      {round && (phase === "racing" || phase === "result") && (
        <>
          <View style={styles.teamsCard}>
            <Taraf x={round.sol} />
            <Text style={styles.plus}>×</Text>
            <Taraf x={round.sag} />
          </View>
          <View style={styles.bilgiSatir}>
            <View style={styles.ortakCip}>
              <Ionicons name="people" size={14} color={COLORS.accent} />
              <Text style={styles.ortakYazi}>Bu ikilide {round.validAnswers.length} ortak futbolcu var</Text>
            </View>
          </View>
          {round.sol.tip === "ulke" ? (
            <Text style={styles.kural}>Vatandaşlık ya da milli takım — ikisi de geçer</Text>
          ) : null}
        </>
      )}

      {/* ---------------- Yarış (zil yok) ---------------- */}
      {phase === "racing" && round && (
        <View style={{ marginTop: 10 }}>
          <View style={styles.sureSatir}>
            <View style={{ flex: 1 }}><TimerBar current={timeLeft} total={turSuresi} /></View>
            <Text style={[styles.sureYazi, timeLeft <= 5 && { color: COLORS.danger }]}>{timeLeft} sn</Text>
          </View>

          <View style={[styles.cpuBalon, cpuKilitli && { opacity: 0.7 }]}>
            <Text style={styles.cpuEmojiKucuk}>{karakter.avatar}</Text>
            <Text style={styles.cpuBalonYazi} numberOfLines={2}>
              <Text style={{ fontWeight: "900", color: karakter.renk }}>{karakter.ad}: </Text>
              {cpuKilitli ? `“${cpuSoz}”` : cpuSoz || "düşünüyor…"}
            </Text>
          </View>

          {p1Kilitli ? (
            <Text style={styles.kilitYazi}>Hakkın bitti — {karakter.ad}'ın cevabı bekleniyor…</Text>
          ) : inputMode === "voice" ? (
            <>
              <SoundPressable style={[styles.micBuyuk, isRecording && styles.micAktif]} onPress={handleMicPress} disabled={isProcessing}>
                <Ionicons name={isProcessing ? "hourglass" : isRecording ? "stop" : "mic"} size={26} color={COLORS.accentDark} />
                <Text style={styles.micBuyukYazi}>{isProcessing ? "İşleniyor…" : isRecording ? "Durdur" : "Konuş"}</Text>
              </SoundPressable>
              <SoundPressable onPress={() => setInputMode("keyboard")} style={styles.degistir}>
                <Text style={styles.degistirYazi}>Bunun yerine yazmak istiyorum</Text>
              </SoundPressable>
            </>
          ) : (
            <>
              <View style={styles.girdiSatir}>
                <TextInput
                  autoCorrect={false}
                  autoCapitalize="words"
                  spellCheck={false}
                  autoFocus
                  value={answerInput}
                  onChangeText={(t) => { setAnswerInput(t); if (yanlisMesaj) setYanlisMesaj(null); }}
                  onSubmitEditing={() => cevapGonder()}
                  placeholder="Futbolcu adı…"
                  placeholderTextColor={COLORS.textFaint}
                  style={styles.girdi}
                  returnKeyType="send"
                  blurOnSubmit={false}
                />
                <SoundPressable style={[styles.mic, isRecording && styles.micAktif]} onPress={handleMicPress} disabled={isProcessing} accessibilityLabel="Sesle cevap ver">
                  <Ionicons name={isProcessing ? "hourglass" : isRecording ? "stop" : "mic"} size={20} color={COLORS.text} />
                </SoundPressable>
                <SoundPressable style={styles.gonder} onPress={() => cevapGonder()} accessibilityLabel="Cevabı gönder">
                  <Ionicons name="arrow-forward" size={20} color={COLORS.accentDark} />
                </SoundPressable>
              </View>
              {suggestions.length > 0 && answerInput.trim().length > 1 ? (
                <View style={styles.oneriKutu}>
                  {suggestions.slice(0, 4).map((ad) => (
                    <Pressable key={ad} onPress={() => cevapGonder(ad)} style={styles.oneri}>
                      <Ionicons name="person-circle-outline" size={18} color={COLORS.textMuted} />
                      <Text style={styles.oneriYazi} numberOfLines={1}>{ad}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          )}

          {yanlisMesaj ? <Text style={styles.hata}>{yanlisMesaj}</Text> : null}
          {voiceError ? <Text style={styles.hata}>{voiceError}</Text> : null}
          <VoiceConfirm
            istek={sesOnayIstegi}
            onOnayla={(ad) => { const i = sesOnayIstegi; setSesOnayIstegi(null); i?.gonder?.(ad); }}
            onTekrar={async () => { setSesOnayIstegi(null); try { await startRecording(); } catch (e) {} }}
            onYaz={(ad) => { const i = sesOnayIstegi; setSesOnayIstegi(null); i?.yaz?.(ad); }}
            onIptal={() => setSesOnayIstegi(null)}
          />

          {!p1Kilitli ? (
            <View style={styles.altSatir}>
              <View style={styles.haklar}>
                {Array.from({ length: YANLIS_HAKKI }).map((_, i) => (
                  <View key={i} style={[styles.hakNokta, i < hak ? { backgroundColor: COLORS.accent } : { backgroundColor: COLORS.cardBorder }]} />
                ))}
                <Text style={styles.hakYazi}>yanlış hakkı</Text>
              </View>
              <SoundPressable onPress={oyuncuCekildi} style={styles.pas}>
                <Text style={styles.pasYazi}>Bilemedim</Text>
              </SoundPressable>
            </View>
          ) : null}
        </View>
      )}

      {/* ---------------- Tur sonucu ---------------- */}
      {phase === "result" && showResultPanel && round && (
        <View style={{ marginTop: 16, alignItems: "center", width: "100%" }}>
          {winningPlayer && <PlayerPhoto name={winningPlayer.name} size={84} />}
          <Text style={[styles.resultText, winningPlayer && { marginTop: 12 }]}>{resultText}</Text>
          {cpuSoz && lastWinner !== null ? (
            <Text style={styles.tepki}>{karakter.avatar} “{cpuSoz}”</Text>
          ) : null}
          {!showAnswers && (
            <Pressable style={styles.showAnswersBtn} hitSlop={10} onPress={() => setShowAnswers(true)}>
              <Text style={styles.showAnswersBtnText}>{lastWinner === "p1" ? "Diğer doğru cevapları göster" : "Doğru cevapları göster"}</Text>
            </Pressable>
          )}
          {showAnswers && (
            <ScrollView style={styles.answersBox} contentContainerStyle={{ padding: 12 }} nestedScrollEnabled>
              {[...round.validAnswers].sort((a, b) => recognitionScore(b) - recognitionScore(a)).map((p) => (
                <View key={p.name} style={styles.answersBoxRow}>
                  <PlayerPhoto name={p.name} size={32} />
                  <Text style={styles.answersBoxItem}>{p.name}</Text>
                </View>
              ))}
            </ScrollView>
          )}
          <Pressable style={styles.primaryBtn} onPress={macBitti ? macSonunaGec : () => yeniTur()}>
            <Text style={styles.primaryBtnText}>{macBitti ? "Maç sonucunu gör" : "Sıradaki tur"}</Text>
          </Pressable>
        </View>
      )}

      {/* ---------------- Maç sonu kartı ---------------- */}
      {phase === "gameOver" && (
        <MacSonuKarti
          modAdi={`Ortak Kulüp (${(TURLER.find((t) => t.deger === tur) || TURLER[0]).etiket})`}
          modeId={modId}
          skorSen={scoreP1}
          skorRakip={scoreCpu}
          rakip={{ ad: karakter.ad, avatar: karakter.avatar, renk: karakter.renk, tepki: macSonuSozu }}
          turlar={turlar}
          enIyi={(() => {
            if (!dogrularim.length) return null;
            const en = [...dogrularim].sort((a, b) => taninirlik(a.oyuncu) - taninirlik(b.oyuncu))[0];
            return { ad: en.oyuncu.name, alt: en.etiket };
          })()}
          kazanilanXp={scoreP1 > scoreCpu ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI}
          onRovans={rovans}
          onMenu={onExitSilent || onExit}
        />
      )}
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1620", padding: 20 },
  ustSatir: { width: "100%", paddingTop: 6, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bildir: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,100,100,0.2)", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12 },
  bildirYazi: { color: "#FFB020", fontSize: 12, fontWeight: "800" },
  kapat: { backgroundColor: "rgba(255,93,93,0.15)", borderRadius: 16, padding: 6 },

  skorSerit: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  skorTaraf: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 110 },
  skorEtiket: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  skorSayi: { color: COLORS.text, fontSize: 28, fontWeight: "900" },
  skorHedef: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  cpuAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: "#16222E" },
  cpuEmoji: { fontSize: 20, textAlign: "center" },
  cpuEmojiKucuk: { fontSize: 18 },

  teamsCard: { flexDirection: "row", backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 18, padding: 18, alignItems: "center", justifyContent: "center" },
  teamName: { color: "#F3F7FA", fontSize: 14, fontWeight: "900", textAlign: "center", marginTop: 8 },
  bayrak: { fontSize: 50 },
  plus: { color: "#7CFF5C", fontWeight: "900", fontSize: 20, marginHorizontal: 8 },
  bilgiSatir: { flexDirection: "row", justifyContent: "center", marginTop: 10 },
  ortakCip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(124,255,92,0.10)", borderWidth: 1, borderColor: "rgba(124,255,92,0.35)" },
  ortakYazi: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
  kural: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: 6 },

  sureSatir: { flexDirection: "row", alignItems: "center", gap: 8 },
  sureYazi: { color: COLORS.textMuted, fontSize: 13, fontWeight: "800", width: 44, textAlign: "right" },
  cpuBalon: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: "#121C27", borderWidth: 1, borderColor: "#28394B" },
  cpuBalonYazi: { flex: 1, color: COLORS.textMuted, fontSize: 13, fontWeight: "600" },

  girdiSatir: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: "#16222E", borderRadius: 14, borderWidth: 2, borderColor: "#7CFF5C", paddingHorizontal: 6, height: 54 },
  girdi: { flex: 1, color: "#F3F7FA", fontSize: 16, fontWeight: "600", paddingVertical: 0, paddingHorizontal: 6 },
  mic: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#0B1620" },
  micAktif: { backgroundColor: "#FF5D5D" },
  gonder: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#7CFF5C" },
  micBuyuk: { marginTop: 12, height: 76, borderRadius: 20, backgroundColor: "#7CFF5C", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  micBuyukYazi: { color: "#0B1620", fontWeight: "900", fontSize: 18 },
  degistir: { alignSelf: "center", padding: 10 },
  degistirYazi: { color: "#7CFF5C", fontSize: 13, fontWeight: "700" },
  oneriKutu: { marginTop: 4, backgroundColor: "#16222E", borderRadius: 12, borderWidth: 1, borderColor: "#28394B" },
  oneri: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, paddingHorizontal: 12 },
  oneriYazi: { color: "#F3F7FA", fontSize: 15, fontWeight: "600", flex: 1 },
  hata: { color: "#FF8A8A", fontSize: 13, fontWeight: "700", marginTop: 8, textAlign: "center" },
  kilitYazi: { color: COLORS.textMuted, fontSize: 14, fontWeight: "700", textAlign: "center", marginTop: 16 },
  altSatir: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  haklar: { flexDirection: "row", alignItems: "center", gap: 5 },
  hakNokta: { width: 10, height: 10, borderRadius: 5 },
  hakYazi: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", marginLeft: 4 },
  pas: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1.5, borderColor: "#28394B", backgroundColor: "#16222E" },
  pasYazi: { color: "#F3F7FA", fontWeight: "800", fontSize: 14 },

  secimKutu: { marginTop: 12, alignItems: "stretch" },
  secimBaslik: { color: "#F3F7FA", fontSize: 22, fontWeight: "900", textAlign: "center" },
  secimAlt: { color: COLORS.textMuted, fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 6 },

  resultText: { color: "#F3F7FA", fontWeight: "900", fontSize: 18, textAlign: "center" },
  tepki: { color: COLORS.textMuted, fontSize: 14, fontStyle: "italic", fontWeight: "600", marginTop: 6, textAlign: "center" },
  showAnswersBtn: { borderColor: "#7CFF5C", borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18, marginTop: 16 },
  showAnswersBtnText: { color: "#7CFF5C", fontSize: 13, fontWeight: "700" },
  answersBox: { height: 220, width: "100%", backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 14, marginTop: 12 },
  answersBoxRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  answersBoxItem: { color: "#F3F7FA", fontSize: 14, fontWeight: "700" },
  primaryBtn: { alignSelf: "stretch", backgroundColor: "#7CFF5C", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 18 },
  primaryBtnText: { color: "#0B1620", fontWeight: "900", textTransform: "uppercase", fontSize: 15 },
});
