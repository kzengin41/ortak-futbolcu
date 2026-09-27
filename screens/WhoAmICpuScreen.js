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
import ModKurulum, { KurulumBolum, ZorlukSecici, SureSecici } from "../components/ModKurulum";
import { countryTr } from "../lib/countryNamesTr";
import { positionTr } from "../lib/positionNamesTr";
let PLAYER_HINTS = {};
try { PLAYER_HINTS = require("../lib/playerHints.json"); } catch (e) {}

// 27 Eylül 2026: kurulumdaki zorluk = başlangıç seviyesi.
const BASLANGIC_SEVIYESI = { 1: 1, 2: 4, 3: 9, 4: 16, 5: 21 };

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
  const [zorlukId, setZorlukId] = useState(1);
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

  const sortedPlayers = useMemo(() => {
    return PLAYERS
      .filter(p => p.clubs && p.clubs.length >= 2 && guvenilirFotoVar(p.name))
      .sort((a, b) => calculatePlayerPopularity(b) - calculatePlayerPopularity(a));
  }, [guvenilirFotoVar]);

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
    if (roundScore - 1500 < 0 || !player) return;
    const available = player.clubs.map((c, idx) => idx).filter(idx => !revealed.clubs.includes(idx));
    if (available.length === 0) return;
    
    const randomIdx = available[Math.floor(Math.random() * available.length)];
    setRoundScore(prev => prev - 1500);
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
      >
        <KurulumBolum baslik="ZORLUK" not="Oyuna hangi seviyeden başlayacağını belirler. Her doğru cevapta seviye yine artar.">
          <ZorlukSecici
            seviyeler={[
              { id: 1, etiket: "Çok Kolay", aciklama: "Seviye 1'den: dünya yıldızları" },
              { id: 2, etiket: "Kolay", aciklama: "Seviye 4'ten: çok bilinen isimler" },
              { id: 3, etiket: "Orta", aciklama: "Seviye 9'dan: bilinen oyuncular" },
              { id: 4, etiket: "Zor", aciklama: "Seviye 16'dan: az bilinenler" },
              { id: 5, etiket: "Çok Zor", aciklama: "Seviye 21'den: sadece meraklılar için" },
            ]}
            secili={zorlukId}
            onSec={setZorlukId}
          />
        </KurulumBolum>
        <KurulumBolum baslik="SORU SÜRESİ">
          <SureSecici
            secenekler={[30, 60, 90]}
            deger={soruSuresi}
            onDegis={setSoruSuresi}
            suresizVar
            asgari={15}
            azami={300}
            aciklama="Süre dolarsa bir can gider."
          />
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
  const lastYear = PLAYER_LAST_ACTIVE_YEAR[player.name];
  
  // Biyografi Metni
  let bioText = "";
  if (PLAYER_HINTS[player.name] && PLAYER_HINTS[player.name] !== "YOK") {
    bioText = PLAYER_HINTS[player.name];
  } else {
    bioText = generateDynamicBio(player, info, teams);
  }

  // Fotoğraf URL (Bulanık için) — bkz. lib/playerPhotos.js: karışık veri
  // biçimini (tam URL / sadece dosya adı) tek noktadan doğru çözüyor.
  const photoUrl = resolvePlayerPhotoUrl(player.name);

  return (
    <GameBackground style={styles.container}>
      <BackButton text="Menüye Dön" onPress={onExit} style={{ marginLeft: 20, marginBottom: 8 }} />
      <View style={styles.topBar}>
        <View style={styles.hearts}>
          {[...Array(3)].map((_, i) => (
            <Ionicons key={i} name={i < lives ? "heart" : "heart-outline"} size={20} color={i < lives ? COLORS.danger : COLORS.textFaint} />
          ))}
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>SEVİYE {level}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>SKOR</Text>
          <Text style={styles.scoreValue}>{totalScore}</Text>
        </View>
      </View>

      {phase === "playing" && kalanSure !== null && soruSuresi ? (
        <View style={{ marginTop: -8 }}>
          <TimerBar current={kalanSure} total={soruSuresi} />
        </View>
      ) : null}

      {combo >= 3 && (
        <View style={styles.comboBar}>
          <Ionicons name="flame" size={16} color={COLORS.ctaDark} />
          <Text style={styles.comboText}>{combo} KOMBO (x1.5 ÇARPAN)</Text>
          <Ionicons name="flame" size={16} color={COLORS.ctaDark} />
        </View>
      )}

      {/* 11 Eylül 2026 (Kerem: "bu mod ekrana sığmıyor, oyuncu adı yazma kısmı
          klavyenin altında kalıyor, öneriler gözükmüyor") — iki ayrı sorun
          vardı: (1) klavye açılınca içerik yukarı itilmiyordu, giriş alanı ve
          hemen altındaki öneri listesi klavyenin arkasında kalıyordu;
          (2) ScrollView'da `keyboardShouldPersistTaps` yoktu, bu yüzden bir
          öneriye dokunmak önce sadece klavyeyi kapatıyor, dokunuş öneriye
          hiç ulaşmıyordu. */}
      {phase === "playing" && !feedback && (
        <KeyboardAvoidingView
          style={{ flex: 1, width: "100%" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 12}
        >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollArea}
          contentContainerStyle={{ paddingBottom: 160 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          
          <View style={styles.dossierHeader}>
            
            <Text style={styles.potScore}>Kalan Ödül: <Text style={{ color: COLORS.success }}>{roundScore}</Text></Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              {/* 1. Uyruk & Mevki */}
              {revealed.nationality ? (
                <View style={styles.clueIconRevealed}>
                  <Ionicons name="earth" size={18} color={COLORS.accent} />
                  {/* 12 Eylül 2026 (Kerem: "bu modda mevki, ülke isimleri vs
                      hep İngilizce geliyor") — veri seti İngilizce kalıyor,
                      sadece gösterim Türkçeleşiyor. */}
                  <Text style={styles.clueRevealedText}>
                    {(teams || []).map(countryTr).join(", ") || "?"}
                  </Text>
                  <Text style={styles.clueRevealedSub}>{positionTr(info.position) || "?"}</Text>
                </View>
              ) : (
                <Pressable style={[styles.clueIconBox, roundScore < 500 && styles.buyBtnDisabled]} onPress={() => buyClue('nationality', 500)}>
                  <Ionicons name="earth" size={24} color={COLORS.accent} />
                  <Text style={styles.clueIconPrice}>-500</Text>
                </Pressable>
              )}

              {/* 2. Yaş & Dönem */}
              {revealed.eraAge ? (
                <View style={styles.clueIconRevealed}>
                  <Ionicons name="calendar" size={18} color={COLORS.accent} />
                  <Text style={styles.clueRevealedText}>D: {info.birthYear || "?"}</Text>
                </View>
              ) : (
                <Pressable style={[styles.clueIconBox, roundScore < 500 && styles.buyBtnDisabled]} onPress={() => buyClue('eraAge', 500)}>
                  <Ionicons name="calendar" size={24} color={COLORS.accent} />
                  <Text style={styles.clueIconPrice}>-500</Text>
                </Pressable>
              )}

              {/* 4. İlk Harf */}
              {revealed.firstLetter ? (
                <View style={styles.clueIconRevealed}>
                  <Ionicons name="text" size={18} color={COLORS.accent} />
                  {/* 12 Eylül 2026 (Kerem: "isim ipucu daha ucuz olmalı ve
                      hem isim hem soy isim baş harfini vermeli") — eskiden
                      2500 puana SADECE ilk harf veriyordu, yani en pahalı
                      ipuçlarından biri en az bilgiyi veriyordu. */}
                  <Text style={styles.clueRevealedBig}>{basHarfler(player.name)}</Text>
                </View>
              ) : (
                <Pressable
                  disabled={roundScore < 800}
                  style={[styles.clueIconBox, roundScore < 800 && styles.buyBtnDisabled]}
                  onPress={() => buyClue('firstLetter', 800)}>
                  <Ionicons name="text" size={24} color={COLORS.accent} />
                  <Text style={styles.clueIconPrice}>-800</Text>
                </Pressable>
              )}

              {/* 5. Silüet */}
              {photoUrl && (
                revealed.silhouette ? (
                  <View style={styles.clueIconRevealed}>
                    {photoBroken ? (
                      <Text style={styles.clueIconPrice}>Fotoğraf yüklenemedi</Text>
                    ) : (
                      <HizliResim
                        source={{ uri: photoUrl }}
                        style={styles.silhouetteThumb}
                        tintColor={COLORS.cardBorder}
                        cachePolicy="memory-disk"
                        priority="high"
                        transition={100}
                        onError={() => setPhotoBroken(true)}
                      />
                    )}
                  </View>
                ) : (
                  <Pressable style={[styles.clueIconBox, roundScore < 3000 && styles.buyBtnDisabled]} onPress={() => buyClue('silhouette', 3000)}>
                    <Ionicons name="body" size={24} color={COLORS.accent} />
                    <Text style={styles.clueIconPrice}>-3000</Text>
                  </Pressable>
                )
              )}

              {/* 3. Biyografi / Spiker Notu */}
              {revealed.bio ? (
                <View style={[styles.clueIconRevealed, styles.bioRevealedBox]}>
                  <View style={styles.bioHeaderRow}>
                    <Ionicons name="book" size={16} color={COLORS.accent} />
                    <Text style={styles.bioHeaderText}>Spikerin Notu</Text>
                  </View>
                  <Text style={styles.bioBodyText}>{bioText}</Text>
                </View>
              ) : (
                <Pressable style={[styles.clueIconBox, styles.bioBuyBtn, roundScore < 2000 && styles.buyBtnDisabled]} onPress={() => buyClue('bio', 2000)}>
                  <Ionicons name="book" size={22} color={COLORS.accent} />
                  <Text style={styles.bioBuyText}>Spikerin Notu (-2000)</Text>
                </Pressable>
              )}
            </View>
            
            <View style={styles.clubsSection}>
              <View style={styles.clubsHeaderRow}>
                <Text style={styles.clubsTitle}>Oynadığı Kulüpler ({player.clubs.length})</Text>
                {player.clubs.length > revealed.clubs.length && (
                  <Pressable
                    disabled={roundScore < 600}
                    style={[styles.buyBtnSmall, roundScore < 600 && styles.buyBtnDisabled]}
                    onPress={buyRandomClub}>
                    {/* 12 Eylül 2026: 1500 -> 600. Kulüp listesi bu modun en
                        doğal ipucu; pahalı olması oyuncuyu ipucu almaktan
                        kaçırıp turu sıkıcılaştırıyordu. */}
                    <Text style={styles.buyBtnSmallText}>+ Rastgele Kulüp (-600)</Text>
                  </Pressable>
                )}
              </View>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
              {player.clubs.map((c, i) => {
                const isRevealed = revealed.clubs.includes(i);
                const clubName = isRevealed ? (typeof c === 'string' ? c : (c.name || c)) : `Kulüp ${i + 1}`;
                return (
                  <View key={i} style={[styles.clubSlot, isRevealed && styles.clubSlotRevealed, { width: 100, height: 60, justifyContent: "center" }]}>
                    <Text style={[styles.clubSlotText, isRevealed && { color: COLORS.text }]} numberOfLines={2} adjustsFontSizeToFit>{clubName}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* JOKERLER */}
          <View style={styles.jokersRow}>
            <Pressable style={[styles.jokerBtn, !jokers.lastClub && styles.jokerDisabled]} onPress={useJokerLastClub}>
              <Ionicons name="sparkles" size={18} color="#E9D5FF" />
              <Text style={styles.jokerText}>Son Kulüp</Text>
            </Pressable>
            <Pressable style={[styles.jokerBtn, !jokers.skip && styles.jokerDisabled]} onPress={useJokerSkip}>
              <Ionicons name="play-skip-forward" size={18} color="#E9D5FF" />
              <Text style={styles.jokerText}>Pas Geç</Text>
            </Pressable>
          </View>

          {/* TAHMİN GİRİŞİ */}
          {/* 12 Eylül 2026 (Kerem: "pes edince sanki bilmişim gibi combo devam
              ediyor, pes edince can da gitmiyor") — pes etmek yanlış cevapla
              aynı sonucu doğurmalı: can gider, kombo sıfırlanır. Eskiden
              bedavaydı ve sonraki ekrandaki "SONRAKİ SEVİYE" ile seviye bile
              atlatıyordu, yani sınırsız ilerlemenin bedava yolu buydu. */}
          <Pressable style={styles.giveUpBtn} onPress={() => {
            const kalanCan = lives - 1;
            setLives(kalanCan);
            setCombo(0);
            recordRound("whoAmICpu", false);
            setPhase(kalanCan <= 0 ? "gameOver" : "roundEnd");
            setFeedback({ type: "wrong", text: "Pes ettin — bir can gitti" });
            setTimeout(() => setFeedback(null), 1500);
          }}>
            <Ionicons name="flag" size={14} color={COLORS.text} />
            <Text style={styles.giveUpBtnText}>Pes Et</Text>
          </Pressable>
          <View style={styles.inputArea}>
            {inputMode === "keyboard" ? (
              <>
                <TextInput
                  autoCorrect={false}
                  autoCapitalize="words"
                  spellCheck={false}
                  style={styles.input}
                  placeholder="Futbolcunun Adı..."
                  placeholderTextColor={COLORS.textMuted}
                  value={answerInput}
                  // Klavye açılınca giriş alanı + öneriler görünür kalsın diye
                  // listenin sonuna kaydırıyoruz.
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250)}
                  onChangeText={setAnswerInput}
                  onSubmitEditing={() => {
                    if (answerInput.trim()) checkAnswer(answerInput.trim());
                  }}
                />
                {suggestions.length > 0 && answerInput.length > 1 && (
                  <View style={styles.suggestBox}>
                    {suggestions.slice(0, 5).map((s, i) => (
                      <SoundPressable key={i} onPress={() => { setAnswerInput(s); checkAnswer(s); }} style={styles.suggestRow}>
                        <Text style={styles.suggestText}>{s}</Text>
                      </SoundPressable>
                    ))}
                  </View>
                )}
                <SoundPressable onPress={() => { setInputMode("voice"); startVoiceListening(); }} style={styles.switchModeLink}>
                  <Text style={styles.switchModeLinkText}>Bunun yerine sesle söylemek istiyorum</Text>
                </SoundPressable>
              </>
            ) : (
              <>
                <View style={{ alignItems: "center" }}>
                  <SoundPressable
                    onPress={isRecording ? sesiBitirVeCevapla : startVoiceListening}
                    style={[styles.micBtnBig, isRecording && styles.micBtnActive]}
                  >
                    <Text style={styles.micBtnBigText}>{isRecording ? "DİNLENİYOR..." : "MİKROFONU AÇ"}</Text>
                  </SoundPressable>
                </View>
                {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
                <VoiceConfirm
                  istek={sesOnayIstegi}
                  onOnayla={sesOnayla}
                  onTekrar={sesTekrar}
                  onYaz={sesYaz}
                  onIptal={() => setSesOnayIstegi(null)}
                />
                <SoundPressable onPress={() => { if (isRecording) stopRecording([]).catch(() => {}); setSesOnayIstegi(null); setInputMode("keyboard"); }} style={styles.switchModeLink}>
                  <Text style={styles.switchModeLinkText}>Bunun yerine klavye kullanmak istiyorum</Text>
                </SoundPressable>
              </>
            )}
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      )}

      {feedback && phase === "playing" && (
        <View style={styles.feedbackOverlay}>
          <AnswerFeedback type={feedback.type} message={feedback.text} />
        </View>
      )}

      {phase === "roundEnd" && (
        <View style={styles.resultPanel}>
          <PlayerPhoto name={player.name} size={120} />
          <Text style={styles.resultTitle}>{player.name}</Text>
          <Text style={styles.resultSubtitle}>{feedback.text}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => { setLevel(level + 1); startNewRound(level + 1); }}>
            <Text style={styles.primaryBtnText}>SONRAKİ SEVİYE</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.accentDark} />
          </Pressable>
        </View>
      )}

      {phase === "gameOver" && (
        <View style={styles.gameOverPanel}>
          <Text style={styles.gameOverTitle}>OYUN BİTTİ</Text>
          <Text style={styles.gameOverSubtitle}>Aranan Futbolcu: {player.name}</Text>
          <PlayerPhoto name={player.name} size={100} />
          
          <View style={styles.statsCard}>
            <Text style={styles.statRow}>Seviye: <Text style={{ color: COLORS.text }}>{level}</Text></Text>
            <Text style={styles.statRow}>Toplam Skor: <Text style={{ color: COLORS.success }}>{totalScore}</Text></Text>
          </View>

          <Text style={styles.shareText}>
            Ortak Futbolcu 'Kim Bu?' Modunda {level}. Seviyeye ulaştım! Skor: {totalScore}
          </Text>

          <Pressable style={styles.primaryBtn} onPress={oyunuBaslat}>
            <Ionicons name="refresh" size={18} color={COLORS.accentDark} />
            <Text style={styles.primaryBtnText}>TEKRAR OYNA</Text>
          </Pressable>
          <BackButton text="Menüye Dön" onPress={onExitSilent || onExit} style={{ marginTop: 24, alignSelf: "center" }} />
        </View>
      )}
      
      
    </GameBackground>
  );
}

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
