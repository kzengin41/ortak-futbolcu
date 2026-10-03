import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import ModKurulum, { KurulumBolum, SecimCipleri, ZorlukSecici, SureSecici } from "../components/ModKurulum";
import { EslesmeProfiliBolumu } from "../components/EslesmeProfiliPenceresi";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import { useModVarsayilanlari, useKurulumKapisi, oyunBilgisiniYaz, ayarSatirlari, MOD_TANIMLARI, YONTEM_SECENEKLERI } from "../lib/modAyarlari";
import { MODE_COLORS } from "../lib/theme";
import { View, Text, TextInput, Pressable, StyleSheet, Animated, Easing, Modal, ScrollView, Alert } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { cpuCevabiSec, taninmisMi, taninirlik } from "../lib/taninirlik";
import { PLAYERS } from "../lib/players";
import { suggestPlayers, buildSuggestIndex, findMatchedPlayer } from "../lib/gameEngine";
import { useCorrectSound, useWrongSound, useCpuCorrectSound } from "../lib/useGameSounds";
import { useVoiceInput } from "../lib/useVoiceInput";
import CountdownOverlay from "../components/CountdownOverlay";
import AnswerFeedback from "../components/AnswerFeedback";
import PlayerPhoto from "../components/PlayerPhoto";
import MacSonuKarti from "../components/MacSonuKarti";
import { karakterSec, tepki } from "../lib/cpuKarakterleri";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import { calculatePlayerPopularity } from "../lib/clubWeights";
import { addXP, XP_MAC_GALIBIYETI } from "../lib/profile";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";

// 27 Eylül 2026 — zorluk: CPU'nun ne kadar hızlı cevap verdiği (ms aralığı)
// ve harf çiftinde hiç bulamama olasılığı.
// 1-10: 1 = çok yavaş ve sık bulamayan CPU, 10 = çok hızlı ve hep bulan.
function cpuZorluk(z) {
  const t = (Math.min(10, Math.max(1, z)) - 1) / 9;
  const ara = (a, b) => a + (b - a) * t;
  return {
    cift: [ara(11000, 2200), ara(17000, 4200)],
    zincir: [ara(6000, 1100), ara(9000, 2300)],
    bulamama: ara(0.5, 0),
  };
}

// Filtre (Kapsam) Seçenekleri
const SCOPE_OPTIONS = [
  { id: "profil", label: "⚙️ Eşleşme profilim" },
  { id: "all", label: "🌍 Tüm Dünya" },
  { id: "turkish", label: "🇹🇷 Sadece Türkler" },
  { id: "big4", label: "🦅🦁🐂 4 Büyükler" }
];

const SUBMODES = [
  { id: "classic", label: "🔠 Klasik (Baştan)", desc: "Ad ve soyadı bu iki harfle BAŞLAYAN oyuncu" },
  { id: "contains", label: "🔎 İçinde Geçen", desc: "Ad veya soyadında bu iki harfi İÇEREN oyuncu (nerede olursa olsun)" },
  { id: "chain", label: "🔗 Son Harf (Zincir)", desc: "Son harften oyuncu türetme" },
  // 4 Ekim 2026 (.28548) — tek kişilik hayatta kalma ayrı ekranda (Harf Zinciri); seçilince oraya geçer.
  { id: "hayatta", label: "⏱️ Zincir — Tek Başına", desc: "CPU yok: 3 canla en uzun zinciri kur, rekorunu kır" },
];

const charMap = { 'À':'A', 'Á':'A', 'Â':'A', 'Ä':'A', 'Å':'A', 'É':'E', 'Í':'I', 'Ñ':'N', 'Ó':'O', 'Ø':'O', 'Þ':'T', 'Č':'C', 'Đ':'D', 'Ľ':'L', 'Ł':'L', 'Š':'S', 'Ž':'Z', 'Ș':'S', 'Α':'A', 'Ğ':'G' };

// 4 Ekim 2026 — HARF EŞDEĞERLİĞİ. Eskiden yalnızca birkaç yabancı harf
// çevriliyordu; Ç, Ş, Ö, Ü, İ hiç çevrilmediği için "Çağlar Söyüncü",
// "Şükrü Saracoğlu" gibi isimler HİÇBİR harf çiftine girmiyordu (A–Z dışı
// sayılıp atılıyordu) — yani C-S çiftinde Çağlar Söyüncü yazan oyuncu yanlış
// sayılıyordu. Artık her aksan atılıyor: Ç=C, Ş=S, Ğ=G, Ö=O, Ü=U, İ=I, É=E…
function harfiSadelestir(c) {
  if (!c) return '';
  const u = c.toLocaleUpperCase('tr');
  if (charMap[u]) return charMap[u];
  const sade = u.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return charMap[sade] || sade[0] || '';
}
function normalizeFirst(word) {
  if (!word) return '';
  return harfiSadelestir(word.trim()[0]);
}
function normalizeLast(word) {
  if (!word) return '';
  return harfiSadelestir(word.trim().slice(-1));
}

export default function LetterCpuScreen({ onExit, onExitSilent, onModaGit }) {
  const [phase, setPhase] = useState("setup"); // setup, selectLetter, countdown, racing, result, gameOver
  
  // Setup Options
  // 28 Eylül 2026 — varsayılan kapsam Eşleşme Profili (Ayarlar'daki genel profil).
  const [scope, setScope] = useState("profil");
  const eslesme = useEslesmeProfili();
  const [subMode, setSubMode] = useState("classic");
  // 27 Eylül 2026 (Kerem: "her mod için zorluk ayarı olmalı. süre ayarı olmalı")
  const [zorlukId, setZorlukId] = useState(5); // 1-10
  // 4 Ekim 2026 — CPU gerçek rakip: zorluğa göre karakter (lib/cpuKarakterleri.js)
  const karakter = useMemo(() => karakterSec(zorlukId), [zorlukId]);
  const [harfSuresi, setHarfSuresi] = useState(15);
  
  // Game State
  const [scores, setScores] = useState({ p1: 0, cpu: 0 });
  // 4 Ekim 2026 — maç sonu kartı için tur kareleri ve doğru cevapların
  const [turlar, setTurlar] = useState([]);
  const [dogrularim, setDogrularim] = useState([]);
  const [macSonuSozu, setMacSonuSozu] = useState("");
  const [userLetter, setUserLetter] = useState(null);
  const [cpuLetter, setCpuLetter] = useState(null);
  const [chainHistory, setChainHistory] = useState([]); // Zincir modundaki oyuncular
  
  const [inputMode, setInputMode] = useState("keyboard");
  const [showAnswers, setShowAnswers] = useState(false);
  // "Doğru Cevapları Gör" açıldığındaki harfleri DONDURUR — round otomatik
  // olarak ilerleyip userLetter/cpuLetter sıfırlanınca (bkz. nextRound/endRound)
  // liste görünüşte "kayboluyordu" çünkü canlı state'e bakıyordu. Artık modal
  // kendi dondurulmuş kopyasını okuyor.
  const [answersSnapshot, setAnswersSnapshot] = useState({ userLetter: null, cpuLetter: null });
  const [answerInput, setAnswerInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  // 12 Eylül 2026 (Kerem: "bu modda ilk tur öncesi rastgele atanan harfler çok
  // kısalığına görülüyor") — harf seçilir seçilmez faz "countdown"a geçiyordu
  // ve geri sayım katmanı harfleri anında örtüyordu. Artık önce 1,4 saniyelik
  // bir "atandı" ekranı gösteriliyor.
  const [atananHarfler, setAtananHarfler] = useState(null);
  const harfGosterimRef = useRef(null);
  const [resultText, setResultText] = useState("");
  const [winningPlayer, setWinningPlayer] = useState(null);
  
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceInput();
  const [voiceError, setVoiceError] = useState(null);
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const playCpuCorrect = useCpuCorrectSound();
  
  // Fitil (Timer)
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef(null);
  const fuseAnim = useRef(new Animated.Value(1)).current;
  const cpuTimerRef = useRef(null);
  // 28 Eylül 2026 — ekrandan çıkınca (artık tur sırasında da çıkılabiliyor)
  // sayaçlar arkada çalışıp kapanmış ekranın durumunu değiştirmesin.
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
  }, []);
  // NOT: startCpuTimer'ın setTimeout'u içindeki eski "phase !== 'racing'" kontrolü
  // her zaman eski (stale) bir `phase` değerini görüyordu — çünkü
  // handleCountdownComplete önce setPhase("racing") çağırıyor (asenkron), SONRA
  // startCpuTimer'ı çağırıyordu; startCpuTimer'ın closure'ı hâlâ "countdown"
  // değerini taşıyordu. Sonuç: CPU'nun kendi zamanlayıcısı HİÇBİR ZAMAN
  // çalışmıyordu, oyuncu "Bilemedim" demedikçe CPU asla puan alamıyordu.
  // phaseRef ile her zaman GÜNCEL fazı okuyoruz.
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Kapsama Göre Havuz
  const filteredPlayers = useMemo(() => {
    let pList = PLAYERS;
    if (scope === "profil") {
      const pr = eslesme.derlenmis;
      // Tek bir uygun kulüp yeter (bu modda kulüp çifti yok). oyuncuCarpani iki
      // uygun kulüp istediği için listeyi ikiledik; dönem/yıl sınırı yine uygulanır.
      pList = PLAYERS.filter((p) => (p.clubs || []).some((c) => pr.kulupCarpani(c) > 0) && pr.oyuncuCarpani({ ...p, clubs: [...p.clubs, ...p.clubs] }) > 0);
    } else if (scope === "turkish") {
      pList = PLAYERS.filter(p => {
        const teams = require("../lib/playerNationalTeams").PLAYER_NATIONAL_TEAMS[p.name];
        return teams && (teams.includes("Türkiye") || teams.includes("Turkey") || teams.includes("T\u00fcrkiye"));
      });
    } else if (scope === "big4") {
      pList = PLAYERS.filter(p => (p.clubs||[]).some(c => {
        const nameStr = typeof c === "string" ? c : (c.name || "");
          if (!nameStr) return false;
        const n = nameStr.toLowerCase();
        return n.includes("galatasaray") || n.includes("fenerbah") || n.includes("beşikt") || n.includes("besikt") || n.includes("trabzon");
      }));
    }
    // 12 Eylül 2026 — KRİTİK: kapsam "tümü" iken pList, lib/players.js'ten
    // gelen PAYLAŞILAN dizinin ta kendisiydi ve .sort() onu YERİNDE sıralıyordu.
    // Bu ekran bir kez açıldıktan sonra uygulamanın tamamında PLAYERS popülerlik
    // sırasında kalıyor, rastgeleliğe dayanan bütün modlar etkileniyordu.
    return [...pList].sort((a, b) => calculatePlayerPopularity(b) - calculatePlayerPopularity(a));
  }, [scope, eslesme.derlenmis]);

  const suggestIndex = useMemo(() => buildSuggestIndex(filteredPlayers), [filteredPlayers]);
  const suggestions = useMemo(() => {
    // 12 Eylül 2026 — ÖNCE 2'YE İNDİRDİM, KEREM GERİ ALDIRDI VE HAKLIYDI:
    // "bilerek harf sınırını 7 yapmıştık. yoksa mesela kişi sık kullanılan bir
    // isim, mesela ahmet yazıyor, soyadı istenen harf ile başlayan biri zaten
    // öneriliyordu." Yani düşük eşik bu modda ipucu veriyor — oyunun amacı
    // harfe uyan ismi BULMAK, listeden seçmek değil. Eşik bilinçli olarak
    // yüksek. (Asıl sorun olan birebir string karşılaştırması ayrıca
    // düzeltildi: findMatchedPlayer artık soyadı ve aksan farklarını kabul
    // ediyor, yani eşiğin yüksek olması artık oyuncuyu cezalandırmıyor.)
    if (answerInput.trim().length < 7) return [];
    return suggestPlayers(suggestIndex, answerInput);
  }, [suggestIndex, answerInput]);

  // Klasik Mod için Harf Çiftleri (Önbellek) — ad/soyadın BAŞ harfleri.
  const classicMap = useMemo(() => {
    const map = new Map();
    if (subMode !== "classic") return map;
    for (const p of filteredPlayers) {
      const parts = p.name.split(' ').filter(x => x.length > 0);
      if (parts.length >= 2) {
        const f = normalizeFirst(parts[0]);
        const l = normalizeFirst(parts[parts.length - 1]);
        if (f >= 'A' && f <= 'Z' && l >= 'A' && l <= 'Z') {
          const pair = [f, l].sort().join('-');
          if (!map.has(pair)) map.set(pair, []);
          map.get(pair).push(p);
        }
      }
    }
    return map;
  }, [filteredPlayers, subMode]);

  // "İçinde Geçen" Modu için Harf Çiftleri (Önbellek) — 31 Ağustos 2026
  // (Kerem: "ya şu anki gibi ad soyad bu harflerden olsun diye baksın, ya da
  // 2 harfi de içeren bir isim bulsun") — isimde HERHANGİ BİR YERDE geçen
  // iki harfin kombinasyonuna göre gruplanmış havuz. classicMap ile aynı
  // "A-B" (sıralı) anahtar biçimini kullanır ki alt kod (CPU seçimi,
  // doğrulama, cevap listesi) ortak kalabilsin.
  const containsMap = useMemo(() => {
    const map = new Map();
    if (subMode !== "contains") return map;
    for (const p of filteredPlayers) {
      const upper = p.name.toUpperCase();
      const letters = new Set();
      for (const ch of upper) {
        const c = harfiSadelestir(ch);
        if (c >= 'A' && c <= 'Z') letters.add(c);
      }
      const arr = [...letters];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const pair = [arr[i], arr[j]].sort().join('-');
          if (!map.has(pair)) map.set(pair, []);
          map.get(pair).push(p);
        }
      }
    }
    return map;
  }, [filteredPlayers, subMode]);

  // Klasik ve "İçinde Geçen" modları YAPISAL OLARAK AYNI akışı izler (tek
  // harf çifti seç, ilk doğru bilen turu kazanır) — sadece havuzları farklı.
  // Zincir modu tamamen ayrı bir mekanik.
  const isPairMode = subMode === "classic" || subMode === "contains";
  const activeMap = subMode === "contains" ? containsMap : classicMap;

  // Zincir Modu için (Sadece İlk Harfe göre gruplanmış havuz)
  const firstLetterMap = useMemo(() => {
    const map = new Map();
    if (subMode !== "chain") return map;
    for (const p of filteredPlayers) {
      const f = normalizeFirst(p.name);
      if (!map.has(f)) map.set(f, []);
      map.get(f).push(p);
    }
    return map;
  }, [filteredPlayers, subMode]);

  const modVarsayilanKaydet = useModVarsayilanlari("letterCpu", { zorluk: setZorlukId, sure: setHarfSuresi, yontem: setInputMode });

  // 4 Ekim 2026 — kurulumsuz başlangıç (.27319): mod son ayarlarla hemen başlar;

  // kurulum sol alttaki ⚙ ya da mod rehberindeki "Ayarları değiştir" ile açılır.

  useKurulumKapisi("letterCpu", {
    kurulumda: phase === "setup",
    baslat: () => startGame(),
    kurulumaDon: () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
      if (harfGosterimRef.current) clearTimeout(harfGosterimRef.current);
      setPhase("setup");
    },
  });
  useEffect(() => {
    oyunBilgisiniYaz("letterCpu", { satirlar: ayarSatirlari({ zorluk: zorlukId, sure: harfSuresi, yontem: inputMode, ekstra: [["Hedef", "3 puan"]] }) });
  }, [zorlukId, harfSuresi, inputMode]);

  // CPU'nun bu turdaki düşünme süresi — zorluğa göre, sürenin %85'ini aşmaz.
  const cpuGecikmesi = (tur) => {
    const [en, ek] = cpuZorluk(zorlukId)[tur];
    const ms = en + Math.random() * (ek - en);
    return Math.min(ms, harfSuresi * 1000 * 0.85);
  };

  // --- GAME LOGIC ---
  const startGame = () => {
    setScores({ p1: 0, cpu: 0 });
    setTurlar([]);
    setDogrularim([]);
    nextRound();
  };

  const nextRound = () => {
    setPhase("selectLetter");
    setUserLetter(null);
    setCpuLetter(null);
    setChainHistory([]);
    setAnswerInput("");
    setWinningPlayer(null);
    setFeedback(null);
    setTimeLeft(harfSuresi);
    fuseAnim.setValue(1);
    if (timerRef.current) clearInterval(timerRef.current);
    if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
    if (harfGosterimRef.current) clearTimeout(harfGosterimRef.current);
  };

  // 27 Eylül 2026 (Kerem: "harfleri 3-2-1 saymadan önce gösteriyor, daha
  // sayılmadan düşünme imkânım oluyor") — 12 Eylül'de eklenen 1,4 saniyelik
  // "harfler atandı" ön gösterimi KALDIRILDI: harf seçilince doğrudan geri
  // sayım başlıyor, harfler SADECE geri sayım bitip süre işlemeye başladığı an
  // (faz "racing") büyük ve belirgin şekilde açılıyor. Geri sayım sırasında
  // harf kutularında "?" duruyor. (Eski "çok kısa görünüyor" şikayeti de
  // böylece çözülüyor: harfler artık tur boyunca ekranda.)
  const harfleriGosterSonraBasla = () => {
    setAtananHarfler(null);
    if (harfGosterimRef.current) clearTimeout(harfGosterimRef.current);
    setPhase("countdown");
  };

  // 4 Ekim 2026 (Kerem: "harf çifti en az 3 tanınmış cevap") — bir harf çifti
  // ancak en az 3 TANINMIŞ cevabı varsa sorulur; yoksa çift "imkânsız" gibi
  // hissettiriyordu. Kapsam çok darsa (ör. "Sadece Türkler") ve hiçbir çift bu
  // şartı sağlamıyorsa eski kurala (en az 1 cevap) düşülür.
  const taninmisCiftVar = useMemo(() => {
    if (!isPairMode) return false;
    for (const list of activeMap.values()) if (list.filter(taninmisMi).length >= 3) return true;
    return false;
  }, [activeMap, isPairMode]);
  const ciftUygun = (pair) => {
    const list = activeMap.get(pair) || [];
    if (!taninmisCiftVar) return list.length > 0;
    let n = 0;
    for (const p of list) if (taninmisMi(p) && ++n >= 3) return true;
    return false;
  };

  const handleSelectLetter = (letter) => {
    setUserLetter(letter);

    if (isPairMode) {
      // CPU kendine harf seçer (Uygun bir kombinasyon bulur)
      const validCpuLetters = [];
      for (let c = 65; c <= 90; c++) {
        const cpuL = String.fromCharCode(c);
        const pair = [letter, cpuL].sort().join('-');
        if (ciftUygun(pair)) {
          validCpuLetters.push(cpuL);
        }
      }
      
      if (validCpuLetters.length > 0) {
        const cpuSecim = validCpuLetters[Math.floor(Math.random() * validCpuLetters.length)];
        setCpuLetter(cpuSecim);
        harfleriGosterSonraBasla(letter, cpuSecim);
      } else {
        // NOT: burada önceden global `alert(...)` çağrılıyordu — React Native'de
        // bu fonksiyon tanımlı değil, bu yüzden bu koşula her düşüldüğünde
        // (ör. rastgele atamada nadir bir harf çıktığında) uygulama anında
        // çöküyordu. Alert.alert ile düzeltildi.
        Alert.alert("Uygun kombinasyon yok", "Bu harfle (ve bu filtreyle) eşleşen kombinasyon kalmamış olabilir, başka bir harf dene.");
        setUserLetter(null);
      }
    } else {
      // Zincir modunda sadece tek harf lazımdır. İlk harf A ise oyuncu A ile söyleyecek.
      setCpuLetter(null); // CPU harfi yok, sadece userLetter (geçerli harf)
      harfleriGosterSonraBasla(letter, null);
    }
  };

  // "Rastgele" seçeneği: kullanıcı harf seçmek istemediğinde, geçerli
  // (eşleşmesi olan) harflerden birini otomatik seçip aynı akışı başlatır.
  const handleRandomLetter = () => {
    if (isPairMode) {
      const letters = new Set();
      for (const pair of activeMap.keys()) {
        if (!ciftUygun(pair)) continue;
        const [a, b] = pair.split("-");
        letters.add(a);
        letters.add(b);
      }
      const pool = [...letters];
      if (pool.length === 0) return;
      handleSelectLetter(pool[Math.floor(Math.random() * pool.length)]);
    } else {
      const pool = [...firstLetterMap.keys()].filter((l) => (firstLetterMap.get(l) || []).length > 0);
      if (pool.length === 0) return;
      handleSelectLetter(pool[Math.floor(Math.random() * pool.length)]);
    }
  };

  const startTimer = () => {
    let t = harfSuresi;
    setTimeLeft(t);
    fuseAnim.setValue(1);
    
    Animated.timing(fuseAnim, {
      toValue: 0,
      duration: harfSuresi * 1000,
      easing: Easing.linear,
      useNativeDriver: false
    }).start();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      t -= 1;
      setTimeLeft(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        // 28 Eylül 2026 — BAYAT KAPANIŞ düzeltmesi (denetim bulgusu #4): bu
        // aralık, zincirde yeni hamle yapıldığı handler'da (setChainHistory ile
        // AYNI anda) kuruluyordu; doğrudan handleTimeOut çağırmak o anki ESKİ
        // chainHistory'yi görüyor ve süre dolunca puanı yanlış tarafa
        // yazabiliyordu. Artık her render'da güncellenen ref üzerinden çağrılıyor.
        if (zamanAsimiRef.current) zamanAsimiRef.current();
      }
    }, 1000);
  };

  const zamanAsimiRef = useRef(null);
  const handleTimeOut = () => {
    // Süre bitti. Kimin sırasındaydı?
    // Klasik modda: İlk bilen kazanırdı. Süre bittiyse kimse puan alamaz. (Berabere)
    // Zincir modunda: En son kim söyledi? Eğer sıra oyuncudaysa oyuncu yanar, CPU kazanır.
    
    if (isPairMode) {
      playWrong();
      endRound(null, "Kimse bilemedi! Süre Doldu.");
    } else {
      // Zincir modu
      const isPlayerTurn = chainHistory.length % 2 === 0;
      if (isPlayerTurn) {
        // Oyuncu cevaplayamadı, CPU puan alır
        awardPoint("cpu", `Süren bitti! ${karakter.ad} kazandı.`);
      } else {
        // CPU cevaplayamadı (Gerçekte CPU'nun timeoutu ayrı çalışır ama fallback)
        awardPoint("p1", `${karakter.ad} cevap bulamadı! Sen kazandın.`);
      }
    }
  };
  zamanAsimiRef.current = handleTimeOut;

  const handleCountdownComplete = () => {
    setPhase("racing");
    startTimer();
    
    if (isPairMode) {
      startCpuTimer(cpuGecikmesi("cift")); // zorluğa göre (bkz. CPU_ZORLUK)
    } else {
      // Zincir modunda, history boşsa sıra Player'da.
      if (chainHistory.length % 2 !== 0) {
        startCpuTimer(cpuGecikmesi("zincir"));
      }
    }
  };

  const startCpuTimer = (delay) => {
    if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
    cpuTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== "racing") return;

      if (isPairMode) {
        const pair = [userLetter, cpuLetter].sort().join('-');
        const pool = activeMap.get(pair) || [];
        // Kolay seviyelerde CPU bazen bulamıyor (bekleyip pes ediyor).
        if (Math.random() < cpuZorluk(zorlukId).bulamama) return;
        // 4 Ekim 2026 — CPU yalnızca zorluğuna göre tanıyabileceği oyuncuları bilir (lib/taninirlik.js).
        const guess = cpuCevabiSec(pool, zorlukId);
        if (guess) processGuess(guess, "cpu");
      } else {
        // Zincir modu CPU tahmini
        const currentLetter = chainHistory.length === 0 ? userLetter : normalizeLast(chainHistory[chainHistory.length - 1].name);
        const pool = firstLetterMap.get(currentLetter) || [];
        // Filtre: Daha önce söylenenler hariç
        const valid = pool.filter(p => !chainHistory.some(ch => ch.name === p.name));
        
        const guess = cpuCevabiSec(valid, zorlukId);
        if (guess) {
          processGuess(guess, "cpu");
        } else {
          // CPU bulamadı! Player kazandı!
          if (timerRef.current) clearInterval(timerRef.current);
          awardPoint("p1", `${karakter.ad} isim bulamadı, sen kazandın!`);
        }
      }
    }, delay);
  };

  const processGuess = (playerObj, who) => {
    if (who === "p1" && playerObj && isPairMode) {
      setDogrularim((l) => [...l, { oyuncu: playerObj, etiket: `${userLetter} + ${cpuLetter}` }]);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
    if (who === "p1" && playerObj) unlockPlayer(playerObj.name); // Ansiklopedi: oyun içinde ismi geçen herkes açılmaya aday

    if (isPairMode) {
      // Klasik/İçinde Geçen'de doğru bildiyse tur biter
      setWinningPlayer(playerObj);
      awardPoint(who, `${who === "p1" ? "Doğru Bildin!" : "Rakip Bildi!"}`);
    } else {
      // Zincir modunda sıra diğerine geçer
      if (who === "cpu") playCpuCorrect(); else playCorrect();
      setChainHistory(prev => [...prev, playerObj]);
      
      const newLetter = normalizeLast(playerObj.name);
      setUserLetter(newLetter); // Ekranda yeni harfi göster
      
      // Süreyi sıfırla ve yeniden başlat
      startTimer();
      
      const isCpuNext = (chainHistory.length + 1) % 2 !== 0;
      if (isCpuNext) {
        startCpuTimer(cpuGecikmesi("zincir"));
      }
    }
  };

  const endRound = (winnerPlayerObj, reason) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
    setWinningPlayer(winnerPlayerObj);
    setResultText(reason);
    setPhase("result");
    
    setTimeout(() => {
      setPhase("selectLetter");
      setUserLetter(null);
      setCpuLetter(null);
      setChainHistory([]);
      setFeedback(null);
    }, 3000);
  };

  const awardPoint = (who, reasonText) => {
    setTurlar((l) => [...l, who === "p1" ? "sen" : "rakip"]);
    if (who === "p1" || who === "cpu") recordRound("letterCpu", who === "p1");

    if (timerRef.current) clearInterval(timerRef.current);
    if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);

    setResultText(reasonText);

    // BUG FIX (31 Ağustos 2026, Kerem: "skorlar hiç artmıyor"): eskiden
    // `{...scores, [who]: scores[who]+1}` şeklinde DIŞARIDAKİ `scores`
    // state'ine (closure'a) bakılıyordu. Bu fonksiyon processGuess/
    // startCpuTimer/handleTimeOut gibi setTimeout içinden çağrılabildiği
    // için, o closure kaydedildiği andaki (bazen ESKİ/BAYAT) `scores`
    // değerini kullanabiliyordu — art arda gelen puanlar birbirinin üzerine
    // yazılıp kayboluyordu. setScores'un FONKSİYONEL güncelleme biçimi
    // (prev => ...) her zaman GÜNCEL state'i kullanır, bu sorunu çözer.
    setScores(prev => {
      const next = { ...prev, [who]: prev[who] + 1 };
      if (next[who] >= 3) {
        setMacSonuSozu(tepki(karakter, who === "p1" ? "kaybetti" : "kazandi"));
        setPhase("gameOver");
        if (who === "p1") addXP(XP_MAC_GALIBIYETI);
      } else {
        setPhase("result");
        setTimeout(nextRound, 2500);
      }
      return next;
    });
  };

  const checkUserGuess = (overrideInput) => {
    if (!(typeof overrideInput === "string" ? overrideInput : answerInput).trim() || phase !== "racing") return;
    
    // Zincir modunda CPU sırasındaysa klavye kilitli olmalı, ama biz basit tuttuk, ignore if not turn
    if (subMode === "chain" && chainHistory.length % 2 !== 0) {
      setAnswerInput("");
      return; 
    }

    const inputName = (typeof overrideInput === "string" ? overrideInput : answerInput).trim().toLowerCase();

    if (isPairMode) {
      const pair = [userLetter, cpuLetter].sort().join('-');
      const pool = activeMap.get(pair) || [];
      // 12 Eylül 2026: birebir string karşılaştırması yerine findMatchedPlayer
      // (normalize + token + tanınırlık). "messi", "Ronaldo", Türkçe I/İ farkı
      // ve aksanlar artık kabul ediliyor.
      const match = findMatchedPlayer(inputName, pool);
      if (match) {
        processGuess(match, "p1");
      } else {
        playWrong();
        setFeedback({ type: "wrong", text: "Yanlış Eşleşme veya Kapsam Dışı!" });
        setTimeout(() => setFeedback(null), 1500);
      }
    } else {
      const currentLetter = chainHistory.length === 0 ? userLetter : normalizeLast(chainHistory[chainHistory.length - 1].name);
      const pool = firstLetterMap.get(currentLetter) || [];
      
      const match = findMatchedPlayer(inputName, pool);
      if (match) {
        if (chainHistory.some(ch => ch.name === match.name)) {
          playWrong();
          setFeedback({ type: "wrong", text: "Bu oyuncu daha önce söylendi!" });
          setTimeout(() => setFeedback(null), 1500);
        } else {
          processGuess(match, "p1");
          setAnswerInput(""); // Clear for next turn
        }
      } else {
        playWrong();
        setFeedback({ type: "wrong", text: `İsim '${currentLetter}' ile başlamalı veya filtrenize uygun değil!` });
        setTimeout(() => setFeedback(null), 1500);
      }
    }
    if (isPairMode) setAnswerInput("");
  };

  // Harf Klavyesi
  const alphabet = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];

  // 27 Eylül 2026 — ortak kurulum ekranı (bkz. components/ModKurulum.js).
  if (phase === "setup") {
    const secilenAlt = SUBMODES.find((m) => m.id === subMode);
    return (
      <ModKurulum
        baslik="İlk Harften Bul"
        aciklama="Harfler 3-2-1'den sonra açılır. Harflere uyan bir futbolcuyu CPU'dan önce söyle. 3 puana ulaşan kazanır."
        vurgu={MODE_COLORS.letters}
        onGeri={onExitSilent || onExit}
        onVarsayilanKaydet={() => modVarsayilanKaydet({ zorluk: zorlukId, sure: harfSuresi, yontem: inputMode })}
        onBasla={startGame}
        baslaDevreDisi={filteredPlayers.length === 0}
      >
        <KurulumBolum baslik="OYUN TÜRÜ" not={secilenAlt ? secilenAlt.desc : null}>
          <SecimCipleri
            secenekler={SUBMODES.map((m) => ({ deger: m.id, etiket: m.label }))}
            secili={subMode}
            onSec={(id) => (id === "hayatta" ? (onModaGit ? onModaGit("letterZincir") : null) : setSubMode(id))}
          />
        </KurulumBolum>
        <KurulumBolum baslik="ZORLUK">
          <ZorlukSecici
            deger={zorlukId}
            onDegis={setZorlukId}
            aciklama={(z) => (z <= 3 ? "CPU yavaş, sık sık bulamaz." : z <= 7 ? "CPU dengeli." : "CPU çok hızlı ve neredeyse hep bulur.")}
          />
        </KurulumBolum>
        <KurulumBolum baslik="TUR SÜRESİ">
          <SureSecici
            secenekler={MOD_TANIMLARI.letterCpu.sure.secenekler}
            deger={harfSuresi}
            onDegis={setHarfSuresi}
            asgari={MOD_TANIMLARI.letterCpu.sure.asgari}
            azami={MOD_TANIMLARI.letterCpu.sure.azami}
            aciklama={MOD_TANIMLARI.letterCpu.sure.aciklama}
          />
        </KurulumBolum>
        <KurulumBolum baslik="CEVAP YÖNTEMİ">
          <SecimCipleri secenekler={YONTEM_SECENEKLERI} secili={inputMode} onSec={setInputMode} />
        </KurulumBolum>
        {scope === "profil" ? <EslesmeProfiliBolumu eslesme={eslesme} /> : null}
        <KurulumBolum baslik="KAPSAM" not={`Bu ayarlarla havuzda ${filteredPlayers.length} oyuncu var.`}>
          <SecimCipleri
            secenekler={SCOPE_OPTIONS.map((o) => ({ deger: o.id, etiket: o.label }))}
            secili={scope}
            onSec={setScope}
          />
        </KurulumBolum>
      </ModKurulum>
    );
  }

  return (
    <GameBackground style={styles.container} klavye="kaydir">
      {/* 28 Eylül 2026 — klavye cevap kutusunu kapatıyordu (denetim bulgusu #1). */}
      <View style={{ flex: 1, width: "100%" }}>
        {/* 28 Eylül 2026 — tur sırasında da çıkış var (denetim bulgusu #2);
            BackButton onay soruyor, kazara çıkış olmuyor. */}
        {phase !== "countdown" && (
          <BackButton
            onPress={phase === "gameOver" ? (onExitSilent || onExit) : onExit}
            style={{ marginLeft: 20, marginTop: 10, marginBottom: 10 }}
          />
        )}
      {phase === "countdown" && <CountdownOverlay onComplete={handleCountdownComplete} />}
      
      <View style={styles.header}>
        <Text style={styles.title}>Harf Eşleşmesi</Text>
        {(phase !== "setup") && (
          <View style={styles.scoreRow}>
            <Text style={styles.scoreText}>Sen: {scores.p1}</Text>
            <Text style={styles.scoreText}>Hedef: 3</Text>
            <Text style={styles.scoreText}>{karakter.avatar} {karakter.ad}: {scores.cpu}</Text>
          </View>
        )}
      </View>

      {/* SETUP PHASE */}
      {phase === "setup" && (
        <View style={styles.setupCard}>
          <Text style={styles.setupTitle}>Oyun Modunu Seç</Text>
          <View style={styles.setupOptions}>
            {SUBMODES.map(m => (
              <Pressable key={m.id} style={[styles.setupBtn, subMode === m.id && styles.setupBtnActive]} onPress={() => (m.id === "hayatta" ? (onModaGit ? onModaGit("letterZincir") : null) : setSubMode(m.id))}>
                <Text style={[styles.setupBtnText, subMode === m.id && styles.setupBtnTextActive]}>{m.label}</Text>
                <Text style={styles.setupBtnDesc}>{m.desc}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.setupTitle, { marginTop: 20 }]}>Kapsam (Filtre)</Text>
          <View style={styles.setupOptionsRow}>
            {SCOPE_OPTIONS.map(s => (
              <Pressable key={s.id} style={[styles.setupPill, scope === s.id && styles.setupPillActive]} onPress={() => setScope(s.id)}>
                <Text style={[styles.setupPillText, scope === s.id && styles.setupPillTextActive]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          
          <Text style={styles.poolSizeText}>Bu ayarlarla havuzda {filteredPlayers.length} oyuncu var.</Text>

          <Pressable style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnText}>BAŞLA</Text>
          </Pressable>
        </View>
      )}

      {/* SELECT LETTER PHASE */}
      {phase === "selectLetter" && (
        <View style={styles.board}>
          <Text style={styles.instruction}>Bir Harf Seç</Text>
          <Text style={styles.instructionSub}>
            {subMode === "classic"
              ? "Ad ve Soyadı bu harflerle BAŞLAYAN futbolcuyu bulacaksın"
              : subMode === "contains"
              ? "Adında veya soyadında bu iki harfi İÇEREN (nerede olursa olsun) futbolcuyu bulacaksın"
              : "Kelime zincirini başlatacak ilk harfi seçiyorsun"}
            {"\n"}Türkçe harfler eşdeğer: Ç=C, Ş=S, Ğ=G, Ö=O, Ü=U, İ=I.
          </Text>

          {!atananHarfler && (
            <SoundPressable style={[styles.randomLetterBtn, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }]} onPress={handleRandomLetter}>
              <Ionicons name="shuffle" size={16} color="#7CFF5C" />
              <Text style={styles.randomLetterBtnText}>Rastgele Ata</Text>
            </SoundPressable>
          )}

          {atananHarfler ? (
            <View style={styles.atandiKutu}>
              <Text style={styles.atandiBaslik}>Harfler atandı</Text>
              <View style={styles.atandiSatir}>
                <Text style={styles.atandiHarf}>{atananHarfler.kullanici}</Text>
                {atananHarfler.cpu ? (
                  <>
                    <Text style={styles.atandiAyrac}>+</Text>
                    <Text style={styles.atandiHarf}>{atananHarfler.cpu}</Text>
                  </>
                ) : null}
              </View>
              <Text style={styles.atandiAlt}>Hazır ol…</Text>
            </View>
          ) : (
            <View style={styles.keyboard}>
              {alphabet.map(letter => (
                <SoundPressable key={letter} style={styles.keyBtn} onPress={() => handleSelectLetter(letter)}>
                  <Text style={styles.keyBtnText}>{letter}</Text>
                </SoundPressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* RACING & COUNTDOWN UI */}
      {(phase === "countdown" || phase === "racing" || phase === "result") && (
        <View style={{ flex: 1 }}>
          {isPairMode ? (
            <View style={styles.lettersCard}>
              <View style={styles.letterBox}>
                <Text style={styles.letterLabel}>Senin Harfin</Text>
                <Text style={styles.letterValue}>{phase === "countdown" ? "?" : userLetter}</Text>
              </View>
              <Text style={styles.letterPlus}>+</Text>
              <View style={styles.letterBox}>
                <Text style={styles.letterLabel}>Rakibin harfi</Text>
                <Text style={styles.letterValue}>{phase === "countdown" ? "?" : cpuLetter}</Text>
              </View>
              {/* 4 Ekim 2026 — Ç/C kuralı her turda görünür */}
              <Text style={styles.harfKurali}>Ç=C · Ş=S · Ğ=G · Ö=O · Ü=U · İ=I sayılır</Text>
            </View>
          ) : (
            <View style={styles.chainCard}>
              <Text style={styles.chainLabel}>Aranan İlk Harf</Text>
              <Text style={styles.chainValue}>{phase === "countdown" ? "?" : userLetter}</Text>
              {chainHistory.length > 0 && (
                <View style={styles.chainHistoryBox}>
                  {chainHistory.map((ch, i) => (
                    <Text key={i} style={styles.chainHistoryText}>
                      {i % 2 === 0 ? "Sen" : karakter.ad}: {ch.name}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* FUSE (Timer) */}
          {phase === "racing" && (
            <View style={styles.fuseContainer}>
              <Animated.View style={[styles.fuseBar, {
                width: fuseAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                backgroundColor: fuseAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: ["#FF5D5D", "#FFB020", "#7CFF5C"] })
              }]} />
              <Text style={styles.fuseText}>{timeLeft} saniye</Text>
            </View>
          )}

          {/* INPUT */}
          {/* 28 Eylül 2026 — yanlış cevap uyarısı gösterilirken de giriş alanı
              açık kalıyor; eskiden 1,5 sn boyunca kapanıyor ama süre akıyordu. */}
          {phase === "racing" && (!feedback || feedback.type === "wrong") && (
            <View style={styles.inputArea}>
              <TextInput
                autoCorrect={false}
                autoCapitalize="words"
                spellCheck={false}
                style={styles.input}
                placeholder="Örn: Abdülkerim Bardakcı"
                placeholderTextColor="#8CA0B3"
                value={answerInput}
                onChangeText={setAnswerInput}
                autoFocus
                onSubmitEditing={checkUserGuess}
              />
                {suggestions.length > 0 && answerInput.length >= 8 && (
                  <View style={styles.suggestBox}>
                    {suggestions.slice(0, 3).map((s, i) => (
                      <SoundPressable key={i} onPress={() => { setAnswerInput(s); checkUserGuess(s); }} style={styles.suggestRow}>
                        <Text style={styles.suggestText}>{s}</Text>
                      </SoundPressable>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
                  <Pressable style={[styles.primaryBtn, { flex: 1, marginRight: 8, paddingVertical: 12 }]} onPress={checkUserGuess}>
                    <Text style={[styles.primaryBtnText, { fontSize: 14 }]}>Gönder</Text>
                  </Pressable>
                  <Pressable style={[styles.primaryBtn, { flex: 1, marginLeft: 8, paddingVertical: 12, backgroundColor: "#FF5D5D" }]} onPress={() => {
                    if (timerRef.current) clearInterval(timerRef.current);
                    awardPoint("cpu", "Pes ettin!");
                  }}>
                    <Text style={[styles.primaryBtnText, { fontSize: 14, color: "#FFF" }]}>Bilemedim</Text>
                  </Pressable>
                </View>
              
              
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 }}>
                <Ionicons name={subMode === "chain" && chainHistory.length % 2 !== 0 ? "time" : "pencil"} size={16} color="#FFD93D" />
                <Text style={[styles.turnIndicator, { marginTop: 0 }]}>
                  {subMode === "chain" && chainHistory.length % 2 !== 0 ? `${karakter.ad.toLocaleUpperCase("tr")} DÜŞÜNÜYOR…` : "SENİN SIRAN!"}
                </Text>
              </View>
            </View>
          )}

          {feedback && (
            <View style={{ marginTop: 24, zIndex: 99 }}>
              <AnswerFeedback type={feedback.type} message={feedback.text} />
            </View>
          )}
        </View>
      )}

      {/* RESULT & GAME OVER */}
      {phase === "gameOver" && (
        <MacSonuKarti
          modAdi={subMode === "chain" ? "İlk Harf — Zincir" : "İlk Harften Bul"}
          modeId="letterCpu"
          skorSen={scores.p1}
          skorRakip={scores.cpu}
          rakip={{ ad: karakter.ad, avatar: karakter.avatar, renk: karakter.renk, tepki: macSonuSozu }}
          turlar={turlar}
          enIyi={(() => {
            if (!dogrularim.length) return null;
            const en = [...dogrularim].sort((a, b) => taninirlik(a.oyuncu) - taninirlik(b.oyuncu))[0];
            return { ad: en.oyuncu.name, alt: `Harfler: ${en.etiket}` };
          })()}
          kazanilanXp={scores.p1 > scores.cpu ? XP_MAC_GALIBIYETI : 0}
          onRovans={startGame}
          onMenu={onExitSilent || onExit}
        />
      )}
      {phase === "result" && (
        <View style={styles.resultPanel}>
          {winningPlayer && <PlayerPhoto name={winningPlayer.name} size={100} />}
          <Text style={styles.resultText}>{resultText}</Text>
          {winningPlayer && <Text style={styles.winnerName}>{winningPlayer.name}</Text>}
            
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: "#FFB020", marginTop: 16 }]}
              onPress={() => {
                setAnswersSnapshot({ userLetter, cpuLetter });
                setShowAnswers(true);
              }}
            >
              <Text style={[styles.primaryBtnText, { color: "#3D2600" }]}>Doğru Cevapları Gör</Text>
            </Pressable>
          
        </View>
      )}

      
    
      <Modal visible={showAnswers} transparent animationType="slide" onRequestClose={() => setShowAnswers(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', padding: 20, paddingTop: 60 }}>
          <View style={{ backgroundColor: '#16222E', flex: 1, borderRadius: 20, padding: 20, borderColor: '#28394B', borderWidth: 2 }}>
            <Text style={{ color: '#F3F7FA', fontSize: 20, fontWeight: '900', marginBottom: 16 }}>Olası Cevaplar</Text>
            <ScrollView>
              {filteredPlayers.filter(p => {
                // NOT: burada önceden tanımsız bir `chainLetter` değişkeni
                // okunuyordu (zincir modunda anında çökerdi) ve canlı
                // userLetter/cpuLetter'a bakıyordu (round ilerleyince
                // sıfırlanıp liste "kayboluyordu"). answersSnapshot dondurulmuş
                // değerleri kullanıyor.
                //
                // BUG FIX (31 Ağustos 2026, Kerem: "doğru cevapları kabul
                // ederken iki türlü de kabul ediliyor... ama listelerken
                // sadece k-p'ler listeleniyor"): classicMap/containsMap
                // harfleri SIRALANMIŞ ("A-B") anahtarla tutuyor, yani hem
                // "A...B..." hem "B...A..." sırasındaki isimler AYNI çift
                // için geçerli sayılıyor (checkUserGuess de böyle çalışıyor).
                // Ama bu liste SADECE userLetter'ı baş, cpuLetter'ı son harf
                // kabul ediyordu — ters sıradaki isimleri göstermiyordu.
                // Artık iki sırayı da (ve "contains" modunu) doğru kontrol
                // ediyor.
                const a = answersSnapshot.userLetter;
                const b = answersSnapshot.cpuLetter;
                if (subMode === "chain") {
                  return p.name.toUpperCase().startsWith(a || "");
                } else if (subMode === "contains") {
                  const upper = p.name.toUpperCase();
                  const hasA = [...upper].some(ch => harfiSadelestir(ch) === a);
                  const hasB = [...upper].some(ch => harfiSadelestir(ch) === b);
                  return hasA && hasB;
                } else {
                  const first = normalizeFirst(p.name.split(" ")[0]);
                  const last = normalizeFirst(p.name.split(" ").pop());
                  return (first === a && last === b) || (first === b && last === a);
                }
              }).slice(0, 50).map(p => (
                <Text key={p.name} style={{ color: '#7CFF5C', fontSize: 16, marginBottom: 8 }}>{p.name}</Text>
              ))}
              <Text style={{ color: '#8CA0B3', fontSize: 12, marginTop: 10 }}>* Sadece en popüler 50 kişi listelenmiştir.</Text>
            </ScrollView>
            <Pressable style={[styles.primaryBtn, { marginTop: 20 }]} onPress={() => setShowAnswers(false)}>
              <Text style={styles.primaryBtnText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      </View>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1620", padding: 20 },
  header: { marginTop: 40, marginBottom: 12 },
  title: { color: "#F3F7FA", fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 12 },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, backgroundColor: "#16222E", paddingVertical: 10, borderRadius: 12, borderColor: "#28394B", borderWidth: 1 },
  scoreText: { color: "#7CFF5C", fontWeight: "900", fontSize: 16 },

  setupCard: { backgroundColor: "#16222E", padding: 20, borderRadius: 20, borderColor: "#28394B", borderWidth: 2 },
  setupTitle: { color: "#F3F7FA", fontSize: 18, fontWeight: "900", marginBottom: 12 },
  setupOptions: { gap: 10 },
  setupBtn: { padding: 16, borderRadius: 12, borderWidth: 2, borderColor: "#28394B", backgroundColor: "#0B1620" },
  setupBtnActive: { borderColor: "#7CFF5C", backgroundColor: "#172431" },
  setupBtnText: { color: "#8CA0B3", fontSize: 16, fontWeight: "900" },
  setupBtnTextActive: { color: "#7CFF5C" },
  setupBtnDesc: { color: "#8CA0B3", fontSize: 12, marginTop: 4 },
  
  setupOptionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  setupPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#28394B", backgroundColor: "#0B1620" },
  setupPillActive: { borderColor: "#7CFF5C", backgroundColor: "#172431" },
  setupPillText: { color: "#8CA0B3", fontSize: 13, fontWeight: "700" },
  setupPillTextActive: { color: "#7CFF5C" },
  
  poolSizeText: { color: "#F3F7FA", fontSize: 12, fontStyle: "italic", marginTop: 16, textAlign: "center" },
  startBtn: { backgroundColor: "#7CFF5C", padding: 16, borderRadius: 16, alignItems: "center", marginTop: 24 },
  startBtnText: { color: "#0B1620", fontWeight: "900", fontSize: 18 },
  atandiKutu: { alignItems: "center", justifyContent: "center", paddingVertical: 36, gap: 8 },
  atandiBaslik: { color: "#8CA0B3", fontSize: 13, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  atandiSatir: { flexDirection: "row", alignItems: "center", gap: 16 },
  atandiHarf: { color: "#7CFF5C", fontSize: 64, fontWeight: "900" },
  atandiAyrac: { color: "#8CA0B3", fontSize: 28, fontWeight: "900" },
  atandiAlt: { color: "#8CA0B3", fontSize: 13, fontWeight: "600" },
  randomLetterBtn: { width: "100%", borderColor: "#7CFF5C", borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 16, marginBottom: 4 },
  randomLetterBtnText: { color: "#7CFF5C", fontWeight: "800", fontSize: 15 },

  board: { flex: 1, alignItems: "center", marginTop: 20 },
  instruction: { color: "#F3F7FA", fontSize: 22, fontWeight: "900", marginBottom: 8 },
  instructionSub: { color: "#8CA0B3", fontSize: 13, textAlign: "center", marginBottom: 24, paddingHorizontal: 20 },
  keyboard: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  keyBtn: { backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 2, borderRadius: 8, width: "13%", aspectRatio: 1, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  keyBtnText: { color: "#7CFF5C", fontSize: 20, fontWeight: "900" },

  lettersCard: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 2, borderRadius: 16, padding: 20, paddingBottom: 30, marginTop: 20, marginBottom: 20 },
  letterBox: { alignItems: "center" },
  letterLabel: { color: "#8CA0B3", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  letterValue: { color: "#F3F7FA", fontSize: 48, fontWeight: "900" },
  harfKurali: { position: "absolute", bottom: 6, left: 0, right: 0, textAlign: "center", color: "#8CA0B3", fontSize: 12, fontWeight: "700" },
  letterPlus: { color: "#7CFF5C", fontSize: 32, fontWeight: "900", marginHorizontal: 24 },
  
  chainCard: { backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 2, borderRadius: 16, padding: 20, marginTop: 20, marginBottom: 20, alignItems: "center" },
  chainLabel: { color: "#8CA0B3", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  chainValue: { color: "#7CFF5C", fontSize: 54, fontWeight: "900" },
  chainHistoryBox: { marginTop: 16, width: "100%", maxHeight: 100, overflow: "hidden", borderTopWidth: 1, borderTopColor: "#28394B", paddingTop: 10 },
  chainHistoryText: { color: "#F3F7FA", fontSize: 13, textAlign: "center", marginVertical: 2 },

  fuseContainer: { height: 24, backgroundColor: "#0B1620", borderRadius: 12, borderColor: "#28394B", borderWidth: 1, overflow: "hidden", marginBottom: 16, position: "relative" },
  fuseBar: { height: "100%" },
  fuseText: { position: "absolute", width: "100%", textAlign: "center", color: "#FFF", fontSize: 12, fontWeight: "900", lineHeight: 22, textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: -1, height: 1}, textShadowRadius: 2 },

  inputArea: { flex: 1, marginTop: 10 },
  input: { backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 14, padding: 16, color: "#F3F7FA", fontSize: 16, marginBottom: 12 },
  suggestBox: { marginTop: -8, marginBottom: 12, backgroundColor: "#0A141C", borderColor: "#28394B", borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  suggestRow: { paddingVertical: 12, paddingHorizontal: 16, borderBottomColor: "#1B2A38", borderBottomWidth: 1 },
  suggestText: { color: "#7CFF5C", fontSize: 14, fontWeight: "600" },
  turnIndicator: { color: "#FFD93D", textAlign: "center", fontSize: 16, fontWeight: "900", marginTop: 10 },

  resultPanel: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  resultText: { color: "#F3F7FA", fontWeight: "900", fontSize: 24, textAlign: "center", marginTop: 16 },
  winnerName: { color: "#7CFF5C", fontWeight: "900", fontSize: 20, marginTop: 8, textAlign: "center" },
  primaryBtn: { backgroundColor: "#7CFF5C", borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40, alignItems: "center", marginTop: 24 },
  primaryBtnText: { color: "#0B1620", fontWeight: "900", textTransform: "uppercase", fontSize: 16 },
  backLink: { color: "#8CA0B3", textAlign: "center", fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
});
