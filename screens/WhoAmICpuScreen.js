import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Animated, Image, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { suggestPlayers, buildSuggestIndex, findMatchedPlayer } from "../lib/gameEngine";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { useVoiceInput } from "../lib/useVoiceInput";
import VoiceConfirm from "../components/VoiceConfirm";
import { useAppSettings } from "../lib/SettingsContext";
import AnswerFeedback from "../components/AnswerFeedback";
import PlayerPhoto, { prefetchPlayerPhoto } from "../components/PlayerPhoto";
import { Image as HizliResim } from "expo-image";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import { calculatePlayerPopularity } from "../lib/clubWeights";
import { PLAYER_BIRTH_POSITION } from "../lib/playerBirthPosition";
import { PLAYER_NATIONAL_TEAMS } from "../lib/playerNationalTeams";
import { PLAYER_LAST_ACTIVE_YEAR } from "../lib/playerYears";
import { resolvePlayerPhotoUrl, PLAYER_PHOTO_FILENAME } from "../lib/playerPhotos";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_MAGLUBIYETI } from "../lib/profile";

import PoolEmpty from "../components/PoolEmpty";
import TimerBar from "../components/TimerBar";
import ModKurulum, { KurulumBolum, ZorlukSecici, SureSecici, SecimCipleri, CokluSecim } from "../components/ModKurulum";
import { EslesmeProfiliBolumu } from "../components/EslesmeProfiliPenceresi";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import TeamBadge from "../components/TeamBadge";
import { useModVarsayilanlari, oyunBilgisiniYaz, ayarSatirlari, MOD_TANIMLARI, YONTEM_SECENEKLERI } from "../lib/modAyarlari";
import { countryTr } from "../lib/countryNamesTr";
import { positionTr } from "../lib/positionNamesTr";
let PLAYER_HINTS = {};
try { PLAYER_HINTS = require("../lib/playerHints.json"); } catch (e) {}

// 27 Eylül 2026: kurulumdaki zorluk (1-10) = başlangıç seviyesi.
const BASLANGIC_SEVIYESI = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 7, 6: 9, 7: 12, 8: 15, 9: 18, 10: 21 };

// 27 Eylül 2026 (Kerem: "kim bu modunda sene kısıtı konmalı. Lefter falan
// soruyor, aşırı eski. ... 2010-günümüz default seçili gelmeli") — oyuncunun
// aktif olduğu yıllar seçilen dönemlerden en az biriyle kesişmeli.
// Aktif yıllar: son yıl = playerYears.json; ilk yıl = doğum yılı + 18
// (doğum yılı yoksa son yıldan 12 yıl geri — ortalama bir kariyer).
const BU_YIL = new Date().getFullYear();
const DONEMLER = [
  { deger: "eski", etiket: "1980 ve öncesi", bas: 0, son: 1980 },
  { deger: "80-2000", etiket: "1980 – 2000", bas: 1980, son: 2000 },
  { deger: "2000-2010", etiket: "2000 – 2010", bas: 2000, son: 2010 },
  { deger: "2010-2020", etiket: "2010 – 2020", bas: 2010, son: 2020 },
  { deger: "2020+", etiket: "2020 – günümüz", bas: 2020, son: 9999 },
];
const VARSAYILAN_DONEMLER = ["2010-2020", "2020+"];

function aktifYillar(ad) {
  let son = PLAYER_LAST_ACTIVE_YEAR[ad];
  if (!Number.isFinite(son) || son < 1850 || son > BU_YIL + 1) son = null;
  const dogum = (PLAYER_BIRTH_POSITION[ad] || {}).birthYear;
  let bas = Number.isFinite(dogum) && dogum > 1850 ? dogum + 18 : null;
  if (bas == null && son != null) bas = son - 12;
  if (son == null && bas != null) son = Math.min(BU_YIL, bas + 15);
  if (bas == null || son == null) return null;
  return [bas, son];
}

function donemdeMi(ad, secili) {
  if (secili.length === DONEMLER.length) return true; // hepsi seçiliyse filtre yok
  const yil = aktifYillar(ad);
  if (!yil) return false;
  return DONEMLER.some((d) => secili.includes(d.deger) && yil[0] <= d.son && yil[1] >= d.bas);
}

// Zorluk Eğrisi (Difficulty curve mapping)
// Seviyeye göre oyuncu popülerlik sıralamasındaki havuzu belirler
function getPoolRangeForLevel(level) {
  if (level <= 3) return [0, 150]; // Level 1-3: Top 150 (Messi, Ronaldo vb.)
  if (level <= 8) return [50, 600]; // Level 4-8: Top 50-600
  if (level <= 15) return [400, 2000]; // Level 9-15: Top 400-2000
  if (level <= 20) return [1500, 5000]; // Level 16-20: Top 1500-5000
  return [3000, 15000]; // Level 21+: Hardcore
}

function generateDynamicBio(player, info, teams) {
  const clubs = player.clubs.map(c => typeof c === "string" ? c : (c.name || c));
  if (clubs.length < 2) return "Biyografi bilgisi yok.";
  
  const startClub = clubs[0];
  const endClub = clubs[clubs.length - 1];
  const allOther = clubs.slice(1, -1);
  const famous = allOther.filter(c => ["Galatasaray", "Real Madrid", "Barcelona", "Fenerbahçe", "Beşiktaş", "Chelsea", "Manchester United", "Bayern Munich", "Juventus", "Inter", "AC Milan", "Liverpool", "Arsenal", "Atletico Madrid", "Paris Saint-Germain"].includes(c));
  
  let text = `Profesyonel kariyerine ${startClub} formasıyla adım atan bu isim, `;
  if (famous.length > 0) {
    const uniqueFamous = [...new Set(famous)];
    text += `özellikle ${uniqueFamous.slice(0, 2).join(' ve ')} gibi dev kulüplerde gösterdiği performansla hafızalara kazındı. `;
  } else if (allOther.length > 0) {
    text += `kariyeri boyunca ${[...new Set(allOther)].slice(0, 2).join(', ')} gibi ekiplerde de ter döktü. `;
  }
  
  if (endClub !== startClub) {
    text += `Kariyerinin son/güncel dönemlerinde ise ${endClub} forması giydi.`;
  }
  
  if (info && info.position && teams && teams.length > 0) {
    text += ` Kendisi ${countryTr(teams[0])} asıllı ünlü bir ${(positionTr(info.position) || info.position).toLowerCase()} oyuncusudur.`;
  }
  return text;
}

// "Zinedine Zidane" -> "Z. Z."  |  "Ronaldo" -> "R."
// Hem ad hem soyadın baş harfini veriyor; tek kelimelik adlarda tek harf.
function basHarfler(ad) {
  const parcalar = String(ad || "").trim().split(/\s+/).filter(Boolean);
  if (!parcalar.length) return "?";
  return parcalar.map((p) => p.charAt(0).toLocaleUpperCase("tr-TR") + ".").join(" ");
}

export default function WhoAmI2Screen({ onExit, onExitSilent }) {
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  
  // -- GAME STATE --
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [totalScore, setTotalScore] = useState(0);
  const [combo, setCombo] = useState(0);
  
  // -- ROUND STATE --
  const [player, setPlayer] = useState(null);
  const [roundScore, setRoundScore] = useState(10000);
  const [usedNames, setUsedNames] = useState(new Set());
  
  const [revealed, setRevealed] = useState({
    nationality: false,
    eraAge: false,
    clubs: [],
    bio: false,
    firstLetter: false,
    silhouette: false
  });
  
  const [jokers, setJokers] = useState({
    skip: true,
    lastClub: true
  });
  
  // -- UI STATE --
  const [inputMode, setInputMode] = useState("keyboard");
  const [answerInput, setAnswerInput] = useState("");
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceInput();
  const [voiceError, setVoiceError] = useState(null);
  const { settings } = useAppSettings();
  // 25 Eylul 2026 — sesli cevap onayi (bkz. components/VoiceConfirm.js)
  const [sesOnayIstegi, setSesOnayIstegi] = useState(null);
  const sesOnayiAcik = settings?.voiceConfirm !== false;
  function sesOnayla(ad) {
    const istek = sesOnayIstegi;
    setSesOnayIstegi(null);
    if (istek && istek.gonder) istek.gonder(ad);
  }
  function sesYaz(ad) {
    const istek = sesOnayIstegi;
    setSesOnayIstegi(null);
    if (istek && istek.yaz) istek.yaz(ad);
  }
  const [feedback, setFeedback] = useState(null);
  // 27 Eylül 2026: "setup" eklendi — eskiden mod açılır açılmaz oyun başlıyordu,
  // zorluk ve süre seçilemiyordu (Kerem: "her mod için zorluk ayarı olmalı.
  // süre ayarı olmalı").
  const [phase, setPhase] = useState("setup"); // setup, playing, roundEnd, gameOver
  const [zorlukId, setZorlukId] = useState(3); // 1-10
  const [donemler, setDonemler] = useState(VARSAYILAN_DONEMLER);
  const [soruSuresi, setSoruSuresi] = useState(null); // saniye | null (süresiz)
  const [kalanSure, setKalanSure] = useState(null);
  const baslangicSeviyesi = BASLANGIC_SEVIYESI[zorlukId] || 1;

  const scrollRef = useRef(null);
  // Silüet ipucu satın alındıysa ama resim yine de yüklenemezse kullanıcıya
  // sessiz bir boşluk yerine açıklama gösteriyoruz (ve puanı boşa gitmesin
  // diye durumu görünür kılıyoruz).
  const [photoBroken, setPhotoBroken] = useState(false);
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const suggestions = useMemo(() => suggestPlayers(suggestIndex, answerInput), [suggestIndex, answerInput]);
  
  // Sorted players by popularity (calculate once) — 31 Ağustos 2026 BUG FIX
  // (Kerem: "burada sadece popüler, resmi olan futbolcular sorulmalı"):
  // havuz artık BAŞTAN resmi (fotoğrafı) olan oyuncularla sınırlı. Eskiden
  // tüm oyuncular popülerliğe göre sıralanıp her turda rastgele seçiliyordu
  // — çoğunun fotoğrafı olmadığı için silüet/sonuç ekranında sık sık resim
  // görünmüyordu. resolvePlayerPhotoUrl(name) burada da tek doğru kaynak.
  // 11 Eylül 2026 (Kerem: "resimsiz insanlar gelmeye devam ediyor") —
  // "fotoğrafı var mı" kontrolü YETERSİZDİ: `resolvePlayerPhotoUrl` bir ADRES
  // döndürüyor ama o adres ÖLÜ olabiliyor. Kayıtların ~9.500'ü eski toplu
  // indirmeden kalma "çıplak dosya adı" (CloudFront) ve büyük kısmı 404
  // veriyor — oyuncu havuza giriyor, sonra silüet/sonuç ekranında resim
  // gelmiyordu. Artık SADECE güvenilir kaynaklar sayılıyor:
  //   • uygulamaya gömülü yerel fotoğraflar,
  //   • kendi Supabase depomuz,
  //   • TheSportsDB (yapılandırılmış, doğrulanmış eşleşme).
  const guvenilirFotoVar = useCallback((name) => {
    const ham = PLAYER_PHOTO_FILENAME[name];
    const cozulmus = resolvePlayerPhotoUrl(name);
    if (!cozulmus) return false;
    // Yerel (bundle) fotoğraf: ham kayıt olmayabilir ama çözülmüş adres var.
    if (!ham) return true;
    if (!/^https?:\/\//i.test(ham)) return false;   // çıplak dosya adı = eski CloudFront
    return !/cloudfront/i.test(ham);
  }, []);

  // 28 Eylül 2026 — Eşleşme Profili: profilin dışarıda bıraktığı kulüplerden
  // hiçbirinde oynamamış oyuncular havuza girmez; tercih edilen bölgedeki
  // oyuncular sıralamada öne çekilir (seviye düzeni yine tanınırlığa göre).
  const eslesme = useEslesmeProfili();
  const sortedPlayers = useMemo(() => {
    const pr = eslesme.derlenmis;
    const enIyi = (p) => p.clubs.reduce((m, c) => Math.max(m, pr.kulupCarpani(c)), 0);
    const takimda = (p) => pr.takim && p.clubs.some((c) => c === pr.takim);
    const anahtar = new Map();
    const liste = PLAYERS
      .filter(p => p.clubs && p.clubs.length >= 2 && guvenilirFotoVar(p.name) && donemdeMi(p.name, donemler) && enIyi(p) > 0);
    for (const p of liste) {
      anahtar.set(p, calculatePlayerPopularity(p) + 8 * Math.log2(Math.max(0.1, enIyi(p))) + (takimda(p) ? 6 : 0));
    }
    return liste.sort((a, b) => anahtar.get(b) - anahtar.get(a));
  }, [guvenilirFotoVar, donemler, eslesme.derlenmis]);

  // seviye parametresi: setLevel ile aynı anda çağrıldığında eski (bayat)
  // seviyeyi kullanmasın diye yeni seviye doğrudan veriliyor.
  const startNewRound = useCallback((seviye) => {
    setPhotoBroken(false);   // yeni tur, yeni fotoğraf
    let nextPlayer = null;
    const [minIdx, maxIdx] = getPoolRangeForLevel(typeof seviye === "number" ? seviye : level);
    
    // Attempt to pick a valid player — sortedPlayers zaten sadece fotoğrafı
    // olan (bkz. yukarıdaki useMemo) ve 2+ kulüpte oynamış oyuncuları içeriyor.
    // Havuz filtrelendiği için ARTIK DAHA KÜÇÜK — aralık havuz boyutunu aşarsa
    // (özellikle yüksek seviyelerde) sınırların içine çekiyoruz.
    const clampedMin = Math.min(minIdx, Math.max(0, sortedPlayers.length - 1));
    const clampedMax = Math.min(maxIdx, sortedPlayers.length - 1);
    for(let i=0; i<100; i++) {
      const pIdx = Math.floor(Math.random() * (clampedMax - clampedMin + 1)) + clampedMin;
      const p = sortedPlayers[pIdx];
      if (p && !usedNames.has(p.name)) {
        nextPlayer = p;
        break;
      }
    }

    if (!nextPlayer) {
      // Fallback
      nextPlayer = sortedPlayers.find(p => !usedNames.has(p.name)) || sortedPlayers[0];
    }
    // 12 Eylül 2026: havuz boşalırsa nextPlayer undefined kalıyor ve bir
    // sonraki satırdaki .name erişimi uygulamayı ÇÖKERTİYORDU.
    if (!nextPlayer) {
      setPhase("gameOver");
      return;
    }
    
    setPlayer(nextPlayer);
    // 27 Eylül 2026: fotoğraf ipucu satın alınınca beklememek için tur
    // başında arkada indiriliyor.
    prefetchPlayerPhoto(nextPlayer.name);
    setUsedNames(prev => { const n = new Set(prev); n.add(nextPlayer.name); return n; });
    
    setRoundScore(10000);
    setRevealed({ nationality: false, eraAge: false, clubs: [], bio: false, firstLetter: false, silhouette: false });
    setAnswerInput("");
    setPhase("playing");
    setFeedback(null);
    setKalanSure(soruSuresi);
  }, [level, usedNames, sortedPlayers, soruSuresi]);

  function oyunuBaslat() {
    setLevel(baslangicSeviyesi);
    setTotalScore(0);
    setLives(3);
    setCombo(0);
    setJokers({ skip: true, lastClub: true });
    setUsedNames(new Set());
    startNewRound(baslangicSeviyesi);
  }

  const modVarsayilanKaydet = useModVarsayilanlari("whoAmICpu", { zorluk: setZorlukId, sure: setSoruSuresi, yontem: setInputMode });
  const { settings: ayarlar, loaded: ayarlarYuklendi } = useAppSettings();
  const donemYuklendi = useRef(false);
  useEffect(() => {
    if (!ayarlarYuklendi || donemYuklendi.current) return;
    donemYuklendi.current = true;
    const kayitli = ayarlar?.modVarsayilanlari?.whoAmICpu?.donemler;
    if (Array.isArray(kayitli) && kayitli.length) setDonemler(kayitli.filter((d) => DONEMLER.some((x) => x.deger === d)));
  }, [ayarlarYuklendi]);
  useEffect(() => {
    oyunBilgisiniYaz("whoAmICpu", {
      satirlar: ayarSatirlari({
        zorluk: zorlukId, sure: soruSuresi, yontem: inputMode,
        ekstra: [["Dönem", DONEMLER.filter((d) => donemler.includes(d.deger)).map((d) => d.etiket).join(", ")], ["Can", "3"]],
      }),
    });
  }, [zorlukId, soruSuresi, inputMode, donemler]);

  // Soru süresi (seçildiyse). Ses işlenirken / onay penceresi açıkken durur.
  useEffect(() => {
    if (phase !== "playing" || kalanSure === null) return;
    if (isProcessing || sesOnayIstegi) return;
    if (kalanSure <= 0) {
      setKalanSure(null);
      const kalanCan = lives - 1;
      setLives(kalanCan);
      setCombo(0);
      recordRound("whoAmICpu", false);
      playWrong();
      setPhase(kalanCan <= 0 ? "gameOver" : "roundEnd");
      if (kalanCan <= 0) addXP(XP_MAC_MAGLUBIYETI);
      setFeedback({ type: "wrong", text: "Süre doldu — bir can gitti" });
      return;
    }
    const t = setTimeout(() => setKalanSure((k) => (k === null ? null : k - 1)), 1000);
    return () => clearTimeout(t);
  }, [phase, kalanSure, isProcessing, sesOnayIstegi]);

  // -- MARKET ACTIONS --
  const buyClue = (type, cost) => {
    if (roundScore - cost < 0) return;
    setRoundScore(prev => prev - cost);
    setRevealed(prev => ({ ...prev, [type]: true }));
  };
  
  const buyRandomClub = () => {
    // 27 Eylül 2026: kod 1500 düşüyordu, düğmede ise "-600" yazıyordu
    // (12 Eylül'de fiyat 600'e indirilmiş ama sadece yazı değişmişti).
    if (roundScore - 600 < 0 || !player) return;
    const available = player.clubs.map((c, idx) => idx).filter(idx => !revealed.clubs.includes(idx));
    if (available.length === 0) return;
    
    const randomIdx = available[Math.floor(Math.random() * available.length)];
    setRoundScore(prev => prev - 600);
    setRevealed(prev => ({ ...prev, clubs: [...prev.clubs, randomIdx] }));
  };

  const useJokerSkip = () => {
    if (!jokers.skip) return;
    setJokers(prev => ({ ...prev, skip: false }));
    setLevel(prev => prev + 1);
    setCombo(0);
    startNewRound(level + 1);
  };

  const useJokerLastClub = () => {
    if (!jokers.lastClub || !player) return;
    const lastIdx = player.clubs.length - 1;
    if (revealed.clubs.includes(lastIdx)) {
      // NOT: global `alert()` React Native'de tanımlı değil, çağrılırsa anında
      // çöker — Alert.alert ile düzeltildi (bkz. LetterCpuScreen'deki aynı hata).
      Alert.alert("Zaten açık", "Son kulüp zaten açık!");
      return;
    }
    setJokers(prev => ({ ...prev, lastClub: false }));
    setRevealed(prev => ({ ...prev, clubs: [...prev.clubs, lastIdx] }));
  };

  // -- CHECKING ANSWER --
  const checkAnswer = (guessedName) => {
    if (phase !== "playing") return;
    
    // 12 Eylül 2026: eskiden birebir string karşılaştırmasıydı — "messi",
    // "Ronaldo", Türkçe I/İ farkı ve aksanların hepsi reddediliyordu. Oysa
    // findMatchedPlayer (normalize + token + soyad + tanınırlık) zaten yazılı
    // ve diğer modlarda kullanılıyordu.
    if (findMatchedPlayer(guessedName, [player])) {
      // DOĞRU
      recordRound("whoAmICpu", true);
      playCorrect();
      unlockPlayer(player.name);
      
      let earnedScore = roundScore;
      let newCombo = combo + 1;
      let oracleBonus = 0;
      
      // Oracle Bonus (if no clubs revealed)
      if (revealed.clubs.length === 0 && !revealed.silhouette) {
        oracleBonus = 2000;
        earnedScore += oracleBonus;
      }
      
      if (newCombo >= 3) {
        earnedScore = Math.floor(earnedScore * 1.5);
      }
      
      setTotalScore(prev => prev + earnedScore);
      setCombo(newCombo);
      setPhase("roundEnd");
      setFeedback({ type: "correct", text: `TEBRİKLER! +${earnedScore} Puan` + (oracleBonus ? ' (KAHİN BONUSU!)' : '') });
      
    } else {
      // YANLIŞ
      recordRound("whoAmICpu", false);
      playWrong();
      const newLives = lives - 1;
      setLives(newLives);
      setCombo(0);
      setFeedback({ type: "wrong", text: "Yanlış Tahmin!" });
      
      if (newLives <= 0) {
        setPhase("gameOver");
        addXP(XP_MAC_MAGLUBIYETI);
      } else {
        setTimeout(() => setFeedback(null), 1500);
      }
    }
  };

  // 25 Eylul 2026 — BUG: burada `startRecording(async (text) => ...)` cagriliyordu
  // ama lib/useVoiceInput.js'in startRecording'i CALLBACK ALMIYOR — verilen
  // fonksiyon sessizce yok sayiliyordu. Ustune mikrofon butonu dogrudan
  // `stopRecording`e bagliydi, donen Promise'in sonucu da atiliyordu. Yani bu
  // modda sesli cevap HIC CALISMIYORDU: ses kaydedilip sunucuya gidiyor,
  // yaziya cevrilen metin hicbir yerde okunmuyordu. Dogru akis: stopRecording
  // await edilip metin alinir.
  const startVoiceListening = async () => {
    try {
      setVoiceError(null);
      await startRecording();
    } catch (e) {
      setVoiceError("Mikrofona erisilemedi.");
    }
  };

  const sesiBitirVeCevapla = async () => {
    setVoiceError(null);
    try {
      const text = await stopRecording([]);
      if (!text) { setVoiceError("Sesi anlayamadim, tekrar dener misin?"); return; }
      const gonder = (a) => checkAnswer(a);
      const yaz = (a) => { setAnswerInput(a); setInputMode("keyboard"); };
      if (sesOnayiAcik) setSesOnayIstegi({ duyulan: text, ad: text, gonder, yaz });
      else gonder(text);
    } catch (e) {
      setVoiceError(e.message || "Ses tanima basarisiz oldu");
    }
  };

  const sesTekrar = async () => {
    setSesOnayIstegi(null);
    await startVoiceListening();
  };

  // 12 Eylül 2026: burası tamamen boş bir ekran döndürüyordu — ne yazı, ne
  // buton, ne geri dönüş. Kullanıcı için ayırt edilemez bir donma.
  if (phase === "setup") {
    return (
      <ModKurulum
        baslik="Kim Bu Futbolcu?"
        aciklama="Gizli bir futbolcu var. Puanınla ipucu satın al, adını bul. 3 canın var; her doğru cevapta seviye atlarsın ve futbolcular zorlaşır."
        vurgu={MODE_COLORS.whoAmI}
        onGeri={onExitSilent || onExit}
        onBasla={oyunuBaslat}
        baslaDevreDisi={sortedPlayers.length === 0}
        onVarsayilanKaydet={() => modVarsayilanKaydet({ zorluk: zorlukId, sure: soruSuresi, yontem: inputMode, donemler })}
      >
        <KurulumBolum
          baslik="DÖNEM"
          not={`Seçtiğin yıllarda oynamış, fotoğrafı olan ${sortedPlayers.length} futbolcu var.`}
        >
          <CokluSecim secenekler={DONEMLER} secililer={donemler} onDegis={setDonemler} />
        </KurulumBolum>
        <KurulumBolum baslik="ZORLUK">
          <ZorlukSecici
            deger={zorlukId}
            onDegis={setZorlukId}
            aciklama={(z) => `Seviye ${BASLANGIC_SEVIYESI[z]}'den başlar. ` + (z <= 3 ? "En bilinen yıldızlar." : z <= 6 ? "Bilinen oyuncular." : "Az bilinenler de gelir.")}
          />
        </KurulumBolum>
        <EslesmeProfiliBolumu eslesme={eslesme} not="Hangi kulüplerin oyuncularının sorulacağını belirler. Dönem seçimi yukarıda ayrıca geçerli." />
        <KurulumBolum baslik={MOD_TANIMLARI.whoAmICpu.sure.etiket}>
          <SureSecici
            secenekler={MOD_TANIMLARI.whoAmICpu.sure.secenekler}
            deger={soruSuresi}
            onDegis={setSoruSuresi}
            suresizVar
            asgari={MOD_TANIMLARI.whoAmICpu.sure.asgari}
            azami={MOD_TANIMLARI.whoAmICpu.sure.azami}
            aciklama={MOD_TANIMLARI.whoAmICpu.sure.aciklama}
          />
        </KurulumBolum>
        <KurulumBolum baslik="CEVAP YÖNTEMİ" not="İki yöntem de oyun sırasında her zaman kullanılabilir.">
          <SecimCipleri secenekler={YONTEM_SECENEKLERI} secili={inputMode} onSec={setInputMode} />
        </KurulumBolum>
      </ModKurulum>
    );
  }

  if (!player) {
    return (
      <GameBackground style={styles.container}>
        <PoolEmpty
          baslik="Uygun futbolcu kalmadı"
          aciklama="Bu seviyede gösterilecek fotoğraflı futbolcu kalmadı. Baştan başlayabilir ya da menüye dönebilirsin."
          onReset={() => { setUsedNames(new Set()); setPhase("setup"); }}
          onExit={onExit}
        />
      </GameBackground>
    );
  }

  const info = PLAYER_BIRTH_POSITION[player.name] || {};
  const teams = PLAYER_NATIONAL_TEAMS[player.name];

  // Biyografi Metni
  let bioText = "";
  if (PLAYER_HINTS[player.name] && PLAYER_HINTS[player.name] !== "YOK") {
    bioText = PLAYER_HINTS[player.name];
  } else {
    bioText = generateDynamicBio(player, info, teams);
  }
  const photoUrl = resolvePlayerPhotoUrl(player.name);
  const kulupAdi = (c) => (typeof c === "string" ? c : (c && c.name) || String(c));
  const kapaliKulup = player.clubs.length - revealed.clubs.length;

  function pesEt() {
    if (sesOnayIstegi) setSesOnayIstegi(null);
    const kalanCan = lives - 1;
    setLives(kalanCan);
    setCombo(0);
    recordRound("whoAmICpu", false);
    playWrong();
    if (kalanCan <= 0) addXP(XP_MAC_MAGLUBIYETI);
    setPhase(kalanCan <= 0 ? "gameOver" : "roundEnd");
    setFeedback({ type: "wrong", text: "Pes ettin — bir can gitti" });
  }

  function mikrofon() {
    if (isRecording) sesiBitirVeCevapla();
    else startVoiceListening();
  }

  // ==========================================================================
  // 27 Eylül 2026 — EKRAN BAŞTAN TASARLANDI (Kerem: "10.000 puan çok küçük
  // görünüyor, oynadığı takımlar kısmı çok yer kaplıyor, oyuncu adını yazarken
  // klavye aşırı aşağıda kalıyor, öneriler görünmüyor. sesli cevap seçeneği
  // yok. ... MÜKEMMEL ÖTESİ BİR TASARIM").
  //
  //  ┌ Üst şerit: canlar · seviye · toplam skor
  //  ├ CEVAP ÇUBUĞU (EN ÜSTTE, SABİT): yazı kutusu + mikrofon + gönder;
  //  │   öneriler kutunun HEMEN ALTINDA açılır. Klavye ekranın altını
  //  │   kapatsa bile hiçbiri klavyenin arkasında kalamaz (XOX'te aynı çözüm
  //  │   işe yaradı). Sesli cevap artık gizli bir bağlantı değil, her zaman
  //  │   görünen mikrofon düğmesi.
  //  ├ Kaydırılan alan:
  //  │   • VİTRİN: gizemli oyuncu kartı + KOCAMAN "kalan ödül"
  //  │   • AÇILAN BİLGİLER: satın alınan ipuçları kart olarak
  //  │   • İPUCU MARKETİ: 2 sütunlu karolar (ikon, ad, fiyat)
  //  │   • KARİYER: tek satırda küçük numaralı çipler (eskiden 100x60'lık
  //  │     kutular yatay kaydırılıyordu, ekranın üçte birini kaplıyordu)
  //  │   • Jokerler + Pes et
  // ==========================================================================
  const IPUCLARI = [
    { tip: "nationality", ikon: "earth", ad: "Uyruk & Mevki", fiyat: 500 },
    { tip: "eraAge", ikon: "calendar", ad: "Doğum Yılı", fiyat: 500 },
    { tip: "firstLetter", ikon: "text", ad: "Baş Harfler", fiyat: 800 },
    { tip: "bio", ikon: "mic-circle", ad: "Spikerin Notu", fiyat: 2000 },
    ...(photoUrl ? [{ tip: "silhouette", ikon: "body", ad: "Silüet", fiyat: 3000 }] : []),
  ];

  const ustSerit = (
    <View style={y.ustSerit}>
      <BackButton text="Menü" onPress={onExit} />
      <View style={y.canlar}>
        {[...Array(3)].map((_, i) => (
          <Ionicons key={i} name={i < lives ? "heart" : "heart-outline"} size={22} color={i < lives ? COLORS.danger : COLORS.textFaint} />
        ))}
      </View>
      <View style={y.seviyeRozet}>
        <Text style={y.seviyeUst}>SEVİYE</Text>
        <Text style={y.seviyeSayi}>{level}</Text>
      </View>
      <View style={y.skorKutu}>
        <Text style={y.skorUst}>SKOR</Text>
        <Text style={y.skorSayi}>{totalScore.toLocaleString("tr-TR")}</Text>
      </View>
    </View>
  );

  return (
    <GameBackground style={y.kap}>
      {ustSerit}

      {phase === "playing" && kalanSure !== null && soruSuresi ? (
        <View style={y.sureSatir}>
          <View style={{ flex: 1 }}><TimerBar current={kalanSure} total={soruSuresi} /></View>
          <Text style={[y.sureYazi, kalanSure <= 5 && { color: COLORS.danger }]}>{kalanSure} sn</Text>
        </View>
      ) : null}

      {phase === "playing" && (
        <>
          {/* --- CEVAP ÇUBUĞU (sabit, üstte) --- */}
          <View style={y.cevapKutu}>
            <View style={y.cevapSatir}>
              <Ionicons name="search" size={18} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
              <TextInput
                style={y.cevapGirdi}
                autoCorrect={false}
                autoCapitalize="words"
                spellCheck={false}
                placeholder={inputMode === "voice" ? "Mikrofona bas ya da yaz..." : "Bu futbolcu kim?"}
                placeholderTextColor={COLORS.textFaint}
                value={answerInput}
                onChangeText={setAnswerInput}
                onSubmitEditing={() => { if (answerInput.trim()) { checkAnswer(answerInput.trim()); setAnswerInput(""); } }}
                returnKeyType="send"
              />
              <SoundPressable
                onPress={mikrofon}
                disabled={isProcessing}
                style={[y.ikonDugme, (isRecording || inputMode === "voice") && y.ikonDugmeVurgu, isRecording && y.ikonDugmeKayit]}
                accessibilityLabel={isRecording ? "Kaydı durdur" : "Sesle cevap ver"}
              >
                <Ionicons
                  name={isProcessing ? "hourglass" : isRecording ? "stop" : "mic"}
                  size={20}
                  color={isRecording || inputMode === "voice" ? COLORS.accentDark : COLORS.text}
                />
              </SoundPressable>
              <SoundPressable
                onPress={() => { if (answerInput.trim()) { checkAnswer(answerInput.trim()); setAnswerInput(""); } }}
                style={[y.ikonDugme, y.gonderDugme]}
                accessibilityLabel="Tahmini gönder"
              >
                <Ionicons name="arrow-forward" size={20} color={COLORS.accentDark} />
              </SoundPressable>
            </View>
            {suggestions.length > 0 && answerInput.trim().length > 1 ? (
              <View style={y.oneriListe}>
                {suggestions.slice(0, 4).map((ad) => (
                  <SoundPressable key={ad} style={y.oneriSatir} onPress={() => { setAnswerInput(""); checkAnswer(ad); }}>
                    <Ionicons name="person-circle-outline" size={18} color={COLORS.textMuted} />
                    <Text style={y.oneriYazi} numberOfLines={1}>{ad}</Text>
                  </SoundPressable>
                ))}
              </View>
            ) : null}
            {isRecording ? <Text style={y.sesDurum}>Dinliyorum — bitince kırmızı düğmeye dokun</Text> : null}
            {isProcessing ? <Text style={y.sesDurum}>Yazıya çevriliyor...</Text> : null}
            {voiceError ? <Text style={[y.sesDurum, { color: COLORS.danger }]}>{voiceError}</Text> : null}
            <VoiceConfirm
              istek={sesOnayIstegi}
              onOnayla={sesOnayla}
              onTekrar={sesTekrar}
              onYaz={sesYaz}
              onIptal={() => setSesOnayIstegi(null)}
            />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={y.icerik}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* --- VİTRİN --- */}
            <View style={y.vitrin}>
              <View style={y.gizemHalka}>
                {revealed.silhouette && photoUrl && !photoBroken ? (
                  <HizliResim
                    source={{ uri: photoUrl }}
                    style={y.siluet}
                    tintColor={COLORS.text}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    priority="high"
                    transition={120}
                    onError={() => setPhotoBroken(true)}
                  />
                ) : (
                  <Text style={y.soru}>?</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={y.odulUst}>KALAN ÖDÜL</Text>
                <Text style={y.odulSayi} adjustsFontSizeToFit numberOfLines={1}>{roundScore.toLocaleString("tr-TR")}</Text>
                <Text style={y.odulAlt}>
                  {revealed.clubs.length === 0 && !revealed.silhouette
                    ? "Kulüp ya da silüet açmadan bilirsen +2.000 kâhin bonusu"
                    : "İpucu aldıkça ödül azalır"}
                </Text>
                {combo >= 3 ? (
                  <View style={y.kombo}>
                    <Ionicons name="flame" size={14} color={COLORS.ctaDark} />
                    <Text style={y.komboYazi}>{combo} KOMBO · x1,5</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* --- AÇILAN BİLGİLER --- */}
            {(revealed.nationality || revealed.eraAge || revealed.firstLetter || revealed.bio) ? (
              <View style={y.bilgiler}>
                {revealed.nationality ? (
                  <View style={y.bilgiKart}>
                    <Ionicons name="earth" size={16} color={COLORS.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={y.bilgiEtiket}>Uyruk · Mevki</Text>
                      <Text style={y.bilgiDeger}>
                        {(teams || []).map(countryTr).join(", ") || "Bilinmiyor"} · {positionTr(info.position) || "?"}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {revealed.eraAge ? (
                  <View style={y.bilgiKart}>
                    <Ionicons name="calendar" size={16} color={COLORS.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={y.bilgiEtiket}>Doğum yılı</Text>
                      <Text style={y.bilgiDeger}>{info.birthYear || "Bilinmiyor"}</Text>
                    </View>
                  </View>
                ) : null}
                {revealed.firstLetter ? (
                  <View style={y.bilgiKart}>
                    <Ionicons name="text" size={16} color={COLORS.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={y.bilgiEtiket}>Baş harfler</Text>
                      <Text style={[y.bilgiDeger, { fontSize: 22, letterSpacing: 2 }]}>{basHarfler(player.name)}</Text>
                    </View>
                  </View>
                ) : null}
                {revealed.bio ? (
                  <View style={[y.bilgiKart, { alignItems: "flex-start" }]}>
                    <Ionicons name="mic-circle" size={16} color={COLORS.accent} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={y.bilgiEtiket}>Spikerin notu</Text>
                      <Text style={y.bioYazi}>{bioText}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* --- İPUCU MARKETİ --- */}
            <Text style={y.bolumBaslik}>İPUÇLARI</Text>
            <View style={y.market}>
              {IPUCLARI.filter((i) => !revealed[i.tip]).map((i) => {
                const yetmez = roundScore < i.fiyat;
                return (
                  <SoundPressable
                    key={i.tip}
                    style={[y.karo, yetmez && y.karoPasif]}
                    disabled={yetmez}
                    onPress={() => buyClue(i.tip, i.fiyat)}
                  >
                    <Ionicons name={i.ikon} size={22} color={yetmez ? COLORS.textFaint : COLORS.accent} />
                    <Text style={y.karoAd} numberOfLines={1}>{i.ad}</Text>
                    <Text style={[y.karoFiyat, yetmez && { color: COLORS.textFaint }]}>−{i.fiyat.toLocaleString("tr-TR")}</Text>
                  </SoundPressable>
                );
              })}
              {kapaliKulup > 0 ? (
                <SoundPressable
                  style={[y.karo, roundScore < 600 && y.karoPasif]}
                  disabled={roundScore < 600}
                  onPress={buyRandomClub}
                >
                  <Ionicons name="shirt" size={22} color={roundScore < 600 ? COLORS.textFaint : COLORS.accent} />
                  <Text style={y.karoAd} numberOfLines={1}>Rastgele Kulüp</Text>
                  <Text style={[y.karoFiyat, roundScore < 600 && { color: COLORS.textFaint }]}>−600</Text>
                </SoundPressable>
              ) : null}
            </View>

            {/* --- KARİYER --- */}
            <Text style={y.bolumBaslik}>KARİYER · {player.clubs.length} KULÜP</Text>
            <View style={y.kariyer}>
              {player.clubs.map((c, i) => {
                const acik = revealed.clubs.includes(i);
                return acik ? (
                  <View key={i} style={[y.kulupCip, y.kulupCipAcik]}>
                    <TeamBadge name={kulupAdi(c)} size={18} />
                    <Text style={y.kulupAd} numberOfLines={1}>{kulupAdi(c)}</Text>
                  </View>
                ) : (
                  <View key={i} style={y.kulupCip}>
                    <Text style={y.kulupNo}>{i + 1}</Text>
                    <Text style={y.kulupGizli}>???</Text>
                  </View>
                );
              })}
            </View>

            {/* --- JOKERLER + PES ET --- */}
            <View style={y.jokerler}>
              <SoundPressable
                style={[y.joker, !jokers.lastClub && y.jokerPasif]}
                disabled={!jokers.lastClub}
                onPress={useJokerLastClub}
              >
                <Ionicons name="sparkles" size={16} color={jokers.lastClub ? COLORS.cta : COLORS.textFaint} />
                <Text style={y.jokerYazi}>Son Kulüp</Text>
                <Text style={y.jokerAlt}>{jokers.lastClub ? "1 hak" : "kullanıldı"}</Text>
              </SoundPressable>
              <SoundPressable
                style={[y.joker, !jokers.skip && y.jokerPasif]}
                disabled={!jokers.skip}
                onPress={useJokerSkip}
              >
                <Ionicons name="play-skip-forward" size={16} color={jokers.skip ? COLORS.cta : COLORS.textFaint} />
                <Text style={y.jokerYazi}>Pas Geç</Text>
                <Text style={y.jokerAlt}>{jokers.skip ? "1 hak · can gitmez" : "kullanıldı"}</Text>
              </SoundPressable>
            </View>
            <SoundPressable style={y.pesEt} onPress={pesEt}>
              <Ionicons name="flag-outline" size={14} color={COLORS.textMuted} />
              <Text style={y.pesEtYazi}>Pes et (bir can gider)</Text>
            </SoundPressable>
          </ScrollView>
        </>
      )}

      {phase === "playing" && feedback && feedback.type === "wrong" ? (
        <View style={y.geriBildirim} pointerEvents="none">
          <AnswerFeedback type="wrong" message={feedback.text} onDone={() => setFeedback(null)} />
        </View>
      ) : null}

      {phase === "roundEnd" && (
        <ScrollView contentContainerStyle={y.sonucIcerik}>
          <View style={y.sonucKart}>
            <Text style={[y.sonucUst, feedback?.type === "correct" ? { color: COLORS.accent } : { color: COLORS.danger }]}>
              {feedback?.type === "correct" ? "DOĞRU!" : "BU SEFER OLMADI"}
            </Text>
            <PlayerPhoto name={player.name} size={130} />
            <Text style={y.sonucAd}>{player.name}</Text>
            <Text style={y.sonucMetin}>{feedback?.text}</Text>
            <View style={y.kariyerSonuc}>
              {player.clubs.map((c, i) => (
                <View key={i} style={[y.kulupCip, y.kulupCipAcik]}>
                  <TeamBadge name={kulupAdi(c)} size={16} />
                  <Text style={y.kulupAd} numberOfLines={1}>{kulupAdi(c)}</Text>
                </View>
              ))}
            </View>
            <SoundPressable style={y.anaDugme} onPress={() => { setLevel(level + 1); startNewRound(level + 1); }}>
              <Text style={y.anaDugmeYazi}>SONRAKİ SEVİYE</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.accentDark} />
            </SoundPressable>
          </View>
        </ScrollView>
      )}

      {phase === "gameOver" && (
        <ScrollView contentContainerStyle={y.sonucIcerik}>
          <View style={y.sonucKart}>
            <Text style={[y.sonucUst, { color: COLORS.danger }]}>OYUN BİTTİ</Text>
            <View style={y.istatistik}>
              <View style={y.istatKutu}>
                <Text style={y.istatSayi}>{level}</Text>
                <Text style={y.istatAd}>seviye</Text>
              </View>
              <View style={y.istatKutu}>
                <Text style={[y.istatSayi, { color: COLORS.success }]}>{totalScore.toLocaleString("tr-TR")}</Text>
                <Text style={y.istatAd}>toplam skor</Text>
              </View>
            </View>
            <Text style={y.sonucMetin}>Son futbolcu: {player.name}</Text>
            <PlayerPhoto name={player.name} size={90} />
            <SoundPressable style={y.anaDugme} onPress={oyunuBaslat}>
              <Ionicons name="refresh" size={18} color={COLORS.accentDark} />
              <Text style={y.anaDugmeYazi}>TEKRAR OYNA</Text>
            </SoundPressable>
            <SoundPressable style={y.ikincilDugme} onPress={() => setPhase("setup")}>
              <Text style={y.ikincilYazi}>Ayarları değiştir</Text>
            </SoundPressable>
            <SoundPressable style={y.ikincilDugme} onPress={onExitSilent || onExit}>
              <Text style={y.ikincilYazi}>Menüye dön</Text>
            </SoundPressable>
          </View>
        </ScrollView>
      )}
    </GameBackground>
  );
}

// 27 Eylül 2026 — yeni tasarımın stilleri (temaya bağlı).
const y = StyleSheet.create({
  kap: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.xxl },
  ustSerit: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  canlar: { flexDirection: "row", gap: 2, flex: 1, justifyContent: "center" },
  seviyeRozet: {
    alignItems: "center", backgroundColor: MODE_COLORS.whoAmI.dark, borderColor: MODE_COLORS.whoAmI.main,
    borderWidth: 1.5, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 2,
  },
  seviyeUst: { color: MODE_COLORS.whoAmI.main, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  seviyeSayi: { color: COLORS.text, fontSize: 18, fontWeight: "900", lineHeight: 20 },
  skorKutu: { alignItems: "flex-end", minWidth: 72 },
  skorUst: { ...TYPE.caption, fontSize: 9, letterSpacing: 1 },
  skorSayi: { color: COLORS.success, fontSize: 18, fontWeight: "900" },
  sureSatir: { flexDirection: "row", alignItems: "center", marginTop: -8 },
  sureYazi: { ...TYPE.caption, fontWeight: "900", color: COLORS.text, width: 44, textAlign: "right" },

  cevapKutu: { marginBottom: SPACING.sm, zIndex: 10 },
  cevapSatir: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.card, borderColor: MODE_COLORS.whoAmI.main, borderWidth: 2,
    borderRadius: RADIUS.lg, padding: 4,
  },
  cevapGirdi: { flex: 1, color: COLORS.text, fontSize: 17, fontWeight: "700", paddingVertical: 10, paddingHorizontal: 6 },
  ikonDugme: {
    width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg,
  },
  ikonDugmeVurgu: { backgroundColor: COLORS.accent },
  ikonDugmeKayit: { backgroundColor: COLORS.danger },
  gonderDugme: { backgroundColor: COLORS.accent },
  oneriListe: {
    marginTop: 4, backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, overflow: "hidden",
  },
  oneriSatir: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: 46,
    paddingHorizontal: SPACING.md, borderBottomColor: COLORS.cardBorder, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  oneriYazi: { ...TYPE.body, fontWeight: "700", flex: 1 },
  sesDurum: { ...TYPE.caption, textAlign: "center", marginTop: 6 },

  icerik: { paddingBottom: SPACING.xxxl },
  vitrin: {
    flexDirection: "row", alignItems: "center", gap: SPACING.lg,
    backgroundColor: MODE_COLORS.whoAmI.dark, borderColor: MODE_COLORS.whoAmI.main, borderWidth: 1,
    borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md,
  },
  gizemHalka: {
    width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg, borderColor: MODE_COLORS.whoAmI.main, borderWidth: 3, overflow: "hidden",
  },
  siluet: { width: 92, height: 92 },
  soru: { color: MODE_COLORS.whoAmI.main, fontSize: 52, fontWeight: "900" },
  odulUst: { color: MODE_COLORS.whoAmI.main, fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  odulSayi: { color: COLORS.text, fontSize: 42, fontWeight: "900", letterSpacing: -1 },
  odulAlt: { ...TYPE.caption, fontSize: 11 },
  kombo: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 6,
    backgroundColor: COLORS.cta, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 3,
  },
  komboYazi: { color: COLORS.ctaDark, fontSize: 11, fontWeight: "900" },

  bilgiler: { gap: SPACING.sm, marginBottom: SPACING.md },
  bilgiKart: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  bilgiEtiket: { ...TYPE.caption, fontSize: 11 },
  bilgiDeger: { ...TYPE.body, fontWeight: "800" },
  bioYazi: { ...TYPE.body, fontSize: 14, lineHeight: 20, fontStyle: "italic" },

  bolumBaslik: { ...TYPE.eyebrow, fontSize: 11, color: MODE_COLORS.whoAmI.main, marginTop: SPACING.sm, marginBottom: SPACING.sm },
  market: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.sm },
  karo: {
    flexBasis: "31%", flexGrow: 1, minHeight: 84, alignItems: "center", justifyContent: "center", gap: 2,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1.5,
    borderRadius: RADIUS.md, padding: SPACING.sm,
  },
  karoPasif: { opacity: 0.45 },
  karoAd: { ...TYPE.caption, color: COLORS.text, fontWeight: "800", fontSize: 12 },
  karoFiyat: { color: COLORS.cta, fontSize: 13, fontWeight: "900" },

  kariyer: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: SPACING.md },
  kariyerSonuc: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginVertical: SPACING.md },
  kulupCip: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 32, maxWidth: "100%",
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.pill, paddingHorizontal: 10,
  },
  kulupCipAcik: { borderColor: COLORS.accent },
  kulupNo: { ...TYPE.caption, fontWeight: "900", color: COLORS.textFaint },
  kulupGizli: { ...TYPE.caption, fontWeight: "900", letterSpacing: 1 },
  kulupAd: { ...TYPE.caption, color: COLORS.text, fontWeight: "800", flexShrink: 1 },

  jokerler: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  joker: {
    flex: 1, alignItems: "center", gap: 2, minHeight: 64, justifyContent: "center",
    backgroundColor: COLORS.card, borderColor: COLORS.cta, borderWidth: 1.5, borderRadius: RADIUS.md, padding: SPACING.sm,
  },
  jokerPasif: { borderColor: COLORS.cardBorder, opacity: 0.5 },
  jokerYazi: { ...TYPE.caption, color: COLORS.text, fontWeight: "900" },
  jokerAlt: { ...TYPE.caption, fontSize: 10 },
  pesEt: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: SPACING.md, marginTop: SPACING.sm },
  pesEtYazi: { ...TYPE.caption, textDecorationLine: "underline" },

  geriBildirim: { ...StyleSheet.absoluteFillObject },

  sonucIcerik: { paddingBottom: SPACING.xxxl, paddingTop: SPACING.md },
  sonucKart: {
    alignItems: "center", backgroundColor: COLORS.card, borderColor: MODE_COLORS.whoAmI.main, borderWidth: 1.5,
    borderRadius: RADIUS.xl, padding: SPACING.xl, gap: SPACING.sm,
  },
  sonucUst: { fontSize: 13, fontWeight: "900", letterSpacing: 2, marginBottom: SPACING.sm },
  sonucAd: { ...TYPE.h1, textAlign: "center", marginTop: SPACING.sm },
  sonucMetin: { ...TYPE.body, textAlign: "center", color: COLORS.textMuted },
  istatistik: { flexDirection: "row", gap: SPACING.md, marginVertical: SPACING.sm },
  istatKutu: {
    alignItems: "center", minWidth: 110, backgroundColor: COLORS.bg, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
  },
  istatSayi: { color: COLORS.text, fontSize: 30, fontWeight: "900" },
  istatAd: { ...TYPE.caption },
  anaDugme: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, alignSelf: "stretch",
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: SPACING.lg, marginTop: SPACING.md,
  },
  anaDugmeYazi: { ...TYPE.button, fontSize: 16, color: COLORS.accentDark },
  ikincilDugme: { paddingVertical: SPACING.sm },
  ikincilYazi: { ...TYPE.caption, textDecorationLine: "underline" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 40 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 16 },
  hearts: { flexDirection: "row", gap: 4 },
  levelBadge: { backgroundColor: COLORS.danger, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  levelText: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  scoreBox: { alignItems: "flex-end" },
  scoreLabel: { color: COLORS.textFaint, fontSize: 10, fontWeight: "900" },
  scoreValue: { color: COLORS.cta, fontSize: 22, fontWeight: "900" },

  comboBar: { flexDirection: "row", gap: 8, backgroundColor: COLORS.cta, paddingVertical: 6, alignItems: "center", justifyContent: "center" },
  comboText: { color: COLORS.ctaDark, fontWeight: "900", fontSize: 12 },

  scrollArea: { flex: 1, paddingHorizontal: 20 },
  dossierHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder, paddingBottom: 10, marginBottom: 16, marginTop: 10 },
  dossierTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  potScore: { color: COLORS.text, fontSize: 14, fontWeight: "700" },

  clueIconBox: { width: 70, height: 75, backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2, borderRadius: RADIUS.md, justifyContent: "center", alignItems: "center" },
  clueIconRevealed: { width: 70, minHeight: 75, backgroundColor: COLORS.bg, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.md, justifyContent: "center", alignItems: "center", padding: 4 },
  clueIconPrice: { color: COLORS.accent, fontSize: 10, fontWeight: "900", marginTop: 4 },
  clueRevealedText: { color: COLORS.text, fontSize: 11, fontWeight: "800", textAlign: "center", marginTop: 4 },
  clueRevealedSub: { color: COLORS.textFaint, fontSize: 10, fontWeight: "600", textAlign: "center" },
  clueRevealedBig: { color: COLORS.text, fontSize: 18, fontWeight: "900", marginTop: 4, textAlign: "center" },
  silhouetteThumb: { width: 45, height: 45, borderRadius: RADIUS.sm, tintColor: COLORS.cardBorder },
  bioRevealedBox: { width: "100%", minHeight: 0, alignItems: "stretch", padding: SPACING.md },
  bioHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  bioHeaderText: { color: COLORS.accent, fontWeight: "900", fontSize: 12 },
  bioBodyText: { color: COLORS.textMuted, fontSize: 13, fontStyle: "italic", lineHeight: 19 },
  bioBuyBtn: { width: "100%", height: "auto", paddingVertical: 14, flexDirection: "row", gap: 8 },
  bioBuyText: { color: COLORS.accent, fontWeight: "800", fontSize: 13 },

  clueRow: { minHeight: 48, justifyContent: "center" },
  buyBtn: { backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  buyBtnDisabled: { opacity: 0.5 },
  buyBtnText: { color: COLORS.accent, fontWeight: "800", fontSize: 14 },
  clueText: { color: COLORS.text, fontSize: 15, fontWeight: "700", backgroundColor: COLORS.bg, padding: 12, borderRadius: RADIUS.md, borderColor: COLORS.cardBorder, borderWidth: 1 },
  bioText: { color: COLORS.textMuted, fontSize: 14, fontStyle: "italic", backgroundColor: COLORS.bg, padding: 12, borderRadius: RADIUS.md, borderColor: COLORS.cardBorder, borderWidth: 1, lineHeight: 20 },

  silhoutteBox: { alignItems: "center", backgroundColor: "#000", borderRadius: RADIUS.md, padding: 20, borderColor: COLORS.cardBorder, borderWidth: 1 },
  silhoutteImg: { width: 100, height: 100, opacity: 0.8 },
  silhoutteText: { color: COLORS.textFaint, marginTop: 8, fontWeight: "800", fontSize: 12 },

  clubsSection: { marginTop: 10 },
  clubsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  clubsTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  buyBtnSmall: { backgroundColor: COLORS.card, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6 },
  buyBtnSmallText: { color: COLORS.accent, fontSize: 11, fontWeight: "800" },

  clubsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  clubSlot: { width: "48%", backgroundColor: COLORS.bg, borderColor: COLORS.card, borderWidth: 1, borderRadius: RADIUS.sm, paddingVertical: 14, alignItems: "center" },
  clubSlotRevealed: { backgroundColor: COLORS.card, borderColor: COLORS.cardBorder },
  clubSlotText: { color: COLORS.textFaint, fontSize: 12, fontWeight: "700" },

  jokersRow: { flexDirection: "row", gap: 12, marginTop: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  jokerBtn: { flex: 1, backgroundColor: "#3B0764", borderColor: "#C084FC", borderWidth: 1, borderRadius: RADIUS.md, padding: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  jokerDisabled: { opacity: 0.3 },
  jokerText: { color: "#E9D5FF", fontWeight: "800", fontSize: 13 },

  giveUpBtn: { flexDirection: "row", alignSelf: "center", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 16, marginTop: 8 },
  giveUpBtnText: { color: COLORS.text, fontWeight: "700", fontSize: 13, textDecorationLine: "underline" },

  inputArea: { marginTop: 12, marginBottom: 40 },
  input: { backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, color: COLORS.text, fontSize: 16, marginBottom: 8 },
  suggestBox: { backgroundColor: COLORS.bg, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 12 },
  suggestRow: { paddingVertical: 12, paddingHorizontal: 16, borderBottomColor: COLORS.card, borderBottomWidth: 1 },
  suggestText: { color: COLORS.accent, fontSize: 14, fontWeight: "600" },
  switchModeLink: { alignSelf: "center", paddingVertical: 12 },
  switchModeLinkText: { color: COLORS.textFaint, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },

  micBtnBig: { backgroundColor: COLORS.card, borderColor: COLORS.accent, borderWidth: 2, borderRadius: RADIUS.xl, paddingVertical: 20, paddingHorizontal: 40, alignItems: "center", width: "100%" },
  micBtnActive: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  micBtnBigText: { color: COLORS.accent, fontWeight: "900", fontSize: 18 },
  voiceError: { color: COLORS.danger, fontSize: 12, textAlign: "center", marginTop: 8 },

  feedbackOverlay: { position: "absolute", top: "40%", left: 20, right: 20, zIndex: 100 },

  resultPanel: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  resultTitle: { color: COLORS.text, fontSize: 32, fontWeight: "900", marginTop: 20, textAlign: "center" },
  resultSubtitle: { color: COLORS.accent, fontSize: 18, fontWeight: "900", marginTop: 8, marginBottom: 32, textAlign: "center" },
  primaryBtn: { flexDirection: "row", gap: 8, backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 18, paddingHorizontal: 32, alignItems: "center", justifyContent: "center", width: "100%" },
  primaryBtnText: { color: COLORS.accentDark, fontWeight: "900", fontSize: 16 },

  gameOverPanel: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  gameOverTitle: { color: COLORS.danger, fontSize: 42, fontWeight: "900", marginBottom: 8 },
  gameOverSubtitle: { color: COLORS.text, fontSize: 16, marginBottom: 24, fontStyle: "italic" },
  statsCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 20, width: "100%", marginVertical: 24, borderColor: COLORS.cardBorder, borderWidth: 2 },
  statRow: { color: COLORS.textFaint, fontSize: 18, fontWeight: "900", textAlign: "center", marginVertical: 4 },
  shareText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center", marginBottom: 32, paddingHorizontal: 20 },

  exitBottom: { position: "absolute", bottom: 20, alignSelf: "center" },
  backLink: { color: COLORS.textFaint, fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
});
