import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import GameBackground from "../components/GameBackground";
import { KlavyeAlani, useKlavyeAcik } from "../components/Klavye";
import { COLORS, RADIUS, SPACING, TYPE, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { suggestPlayers, buildSuggestIndex, findMatchedPlayer } from "../lib/gameEngine";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { useVoiceInput } from "../lib/useVoiceInput";
import VoiceConfirm from "../components/VoiceConfirm";
import { useAppSettings } from "../lib/SettingsContext";
import PlayerPhoto, { prefetchPlayerPhoto } from "../components/PlayerPhoto";
import PlayerMiniProfile from "../components/PlayerMiniProfile";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import { PLAYER_BIRTH_POSITION } from "../lib/playerBirthPosition";
import { PLAYER_LAST_ACTIVE_YEAR } from "../lib/playerYears";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { gorevOlayi } from "../lib/dailyGoals";
import { addXP, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import PoolEmpty from "../components/PoolEmpty";
import TimerBar from "../components/TimerBar";
import ModKurulum, { KurulumBolum, ZorlukSecici, SureSecici, SecimCipleri, CokluSecim } from "../components/ModKurulum";
import { EslesmeProfiliBolumu } from "../components/EslesmeProfiliPenceresi";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import { useModVarsayilanlari, useKurulumKapisi, oyunBilgisiniYaz, ayarSatirlari, MOD_TANIMLARI, YONTEM_SECENEKLERI } from "../lib/modAyarlari";
import {
  simdiBilirsen, carpan, turPuani, ortakKartlariAc,
  yeniCan, acilabilirMi, mevkiKategorisi, AZAMI_CAN, BASLANGIC_PUANI, ASGARI_PUAN,
} from "../lib/kimBuMasa";
// Paket 13 — masa çizimi ve veri yardımcıları ortak dosyalara taşındı (Günlük
// Kim Bu, Kadro Avı ve Online düello aynı masayı kullanıyor).
import { MasaKartlari, TahminTablosu, SimdiBilirsenAfis, AcilisAnimasyonu, sayi } from "../components/KimBuMasa";
import { masaHazirla, karsilastirAd, guvenilirFotoVar, taninirlik } from "../lib/kimBuVeri";

// ============================================================================
// KİM BU FUTBOLCU? — KART MASASI (3 Ekim 2026, baştan yazıldı)
//
// Kerem (2 Ekim): "bu modu bu öneriler ile hala beğenmedim. en baştan mükemmel
// bir tasarım yap." Onaylanan kurgu ve tasarım kartı 3A–3C:
//   • Gizli futbolcunun bilgileri yüzü kapalı kartlarda (kimlik / kariyer /
//     vitrin). Hangi kartı çevireceğine oyuncu karar verir; her kartın bedeli
//     "şimdi bilirsen" puanından düşer. Tur bir kart açık başlar.
//   • Yanlış tahmin −1 can ve bir karşılaştırma satırı (bayrak, mevki, yaş, lig,
//     ortak kulüp) bırakır; ortak kulübün kariyer kartı bedava açılır.
//   • Doğru tahmin +1 can (en fazla 3). Kart çevirmeden ×2, 1–2 kartla ×1,5.
//   • Jokerler: Pas (can gitmeden geç), 4 Şık (puan yarıya iner).
// Kurallar saf modülde: lib/kimBuMasa.js (Node testleriyle doğrulandı).
// ============================================================================

const REKOR_ANAHTARI = "kimbu-kart-masasi-rekor";

const BASLANGIC_SEVIYESI = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 7, 6: 9, 7: 12, 8: 15, 9: 18, 10: 21 };
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
  if (secili.length === DONEMLER.length) return true;
  const yil = aktifYillar(ad);
  if (!yil) return false;
  return DONEMLER.some((d) => secili.includes(d.deger) && yil[0] <= d.son && yil[1] >= d.bas);
}
// Seviye -> popülerlik sıralamasındaki havuz aralığı
function havuzAraligi(seviye) {
  if (seviye <= 3) return [0, 150];
  if (seviye <= 8) return [50, 600];
  if (seviye <= 15) return [400, 2000];
  if (seviye <= 20) return [1500, 5000];
  return [3000, 15000];
}

export default function KimBuScreen({ onExit, onExitSilent }) {
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const { settings, loaded: ayarlarYuklendi } = useAppSettings();
  const eslesme = useEslesmeProfili();

  // -- kurulum
  const [phase, setPhase] = useState("setup"); // setup | playing | roundEnd | gameOver
  const [zorlukId, setZorlukId] = useState(3);
  const [donemler, setDonemler] = useState(VARSAYILAN_DONEMLER);
  const [soruSuresi, setSoruSuresi] = useState(null);
  const [inputMode, setInputMode] = useState("keyboard");
  const baslangicSeviyesi = BASLANGIC_SEVIYESI[zorlukId] || 1;

  // -- seri
  const [level, setLevel] = useState(1);
  const [dogruSayisi, setDogruSayisi] = useState(0);
  const [lives, setLives] = useState(AZAMI_CAN);
  const [seriPuani, setSeriPuani] = useState(0);
  const [jokers, setJokers] = useState({ pas: true, sik: true });
  const [usedNames, setUsedNames] = useState(new Set());
  const [rekor, setRekor] = useState(0);

  // -- tur
  const [player, setPlayer] = useState(null);
  const [masa, setMasa] = useState(null);
  const [acik, setAcik] = useState({});
  const [tahminler, setTahminler] = useState([]);
  const [siklar, setSiklar] = useState(null);
  const [sonuc, setSonuc] = useState(null); // { dogru, puan, dokum, mesaj }
  const [uyari, setUyari] = useState(null);
  const [kalanSure, setKalanSure] = useState(null);
  const [profilAcik, setProfilAcik] = useState(false);

  // -- cevap / ses
  const [answerInput, setAnswerInput] = useState("");
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceInput();
  const [voiceError, setVoiceError] = useState(null);
  const [sesOnayIstegi, setSesOnayIstegi] = useState(null);
  const sesOnayiAcik = settings?.voiceConfirm !== false;
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const suggestions = useMemo(() => suggestPlayers(suggestIndex, answerInput), [suggestIndex, answerInput]);

  useEffect(() => {
    AsyncStorage.getItem(REKOR_ANAHTARI).then((v) => v && setRekor(Number(v) || 0)).catch(() => {});
  }, []);


  // 4 Ekim 2026 (Kerem: "sırf gs'de oynadı diye endogan adili falan çıkıyor.
  // bunlar kolay değil ki, zor, gurme.") — ESKİ sıralama popülerlik puanına
  // eşleşme profilinden büyük bir ek (TR kulübü ×5 → +18,6, tuttuğun takım
  // +6) ekliyordu; bu ek oyuncular arasındaki tanınırlık farkını eziyordu ve
  // GS'de birkaç maç oynamış biri ilk 150'ye giriyordu. YENİ: sıralama
  // yalnızca tanınırlıkla (playerFame: [güncel, tüm zamanlar] yüzdelik).
  // Eşleşme profili sadece SÜZGEÇ: profildeki kulüplerde oynamamış oyuncu
  // sorulmaz, ama profil kimseyi öne çıkarmaz. (Endoğan Adili artık ~4.100.
  // sırada; Uğurcan ~200, Barış Alper ~150.)
  const sortedPlayers = useMemo(() => {
    const pr = eslesme.derlenmis;
    const profilde = (p) => p.clubs.some((c) => pr.kulupCarpani(c) > 0);
    const anahtar = new Map();
    const liste = PLAYERS.filter(
      (p) => p.clubs && p.clubs.length >= 2 && guvenilirFotoVar(p.name) && donemdeMi(p.name, donemler) && profilde(p)
    );
    for (const p of liste) anahtar.set(p, taninirlik(p.name));
    return liste.sort((a, b) => anahtar.get(b) - anahtar.get(a));
  }, [donemler, eslesme.derlenmis]);

  const turBaslat = useCallback((seviye, kullanilan) => {
    const [minIdx, maxIdx] = havuzAraligi(seviye);
    const enAz = Math.min(minIdx, Math.max(0, sortedPlayers.length - 1));
    const enCok = Math.min(maxIdx, sortedPlayers.length - 1);
    let secilen = null;
    for (let i = 0; i < 100; i++) {
      const p = sortedPlayers[Math.floor(Math.random() * (enCok - enAz + 1)) + enAz];
      if (p && !kullanilan.has(p.name)) { secilen = p; break; }
    }
    if (!secilen) secilen = sortedPlayers.find((p) => !kullanilan.has(p.name)) || null;
    if (!secilen) { setPlayer(null); setPhase("playing"); return; }
    const yeniMasa = masaHazirla(secilen);
    prefetchPlayerPhoto(secilen.name);
    setPlayer(secilen);
    setMasa(yeniMasa);
    setAcik(yeniMasa.acik);
    setTahminler([]);
    setSiklar(null);
    setSonuc(null);
    setUyari(null);
    setAnswerInput("");
    setUsedNames((u) => { const n = new Set(u); n.add(secilen.name); return n; });
    setKalanSure(soruSuresi);
    setPhase("playing");
  }, [sortedPlayers, soruSuresi]);

  function oyunuBaslat() {
    setLevel(baslangicSeviyesi);
    setDogruSayisi(0);
    setLives(AZAMI_CAN);
    setSeriPuani(0);
    setJokers({ pas: true, sik: true });
    const bos = new Set();
    setUsedNames(bos);
    turBaslat(baslangicSeviyesi, bos);
  }

  const modVarsayilanKaydet = useModVarsayilanlari("whoAmICpu", { zorluk: setZorlukId, sure: setSoruSuresi, yontem: setInputMode });

  // 4 Ekim 2026 — kurulumsuz başlangıç (.27319): mod son ayarlarla hemen başlar;

  // kurulum sol alttaki ⚙ ya da mod rehberindeki "Ayarları değiştir" ile açılır.

  useKurulumKapisi("whoAmICpu", {
    hazir: sortedPlayers.length > 0,
    kurulumda: phase === "setup",
    baslat: () => oyunuBaslat(),
    kurulumaDon: () => setPhase("setup"),
  });
  const donemYuklendi = useRef(false);
  useEffect(() => {
    if (!ayarlarYuklendi || donemYuklendi.current) return;
    donemYuklendi.current = true;
    const kayitli = settings?.modVarsayilanlari?.whoAmICpu?.donemler;
    if (Array.isArray(kayitli) && kayitli.length) setDonemler(kayitli.filter((d) => DONEMLER.some((x) => x.deger === d)));
  }, [ayarlarYuklendi]);
  useEffect(() => {
    oyunBilgisiniYaz("whoAmICpu", {
      satirlar: ayarSatirlari({
        zorluk: zorlukId, sure: soruSuresi, yontem: inputMode,
        ekstra: [["Dönem", DONEMLER.filter((d) => donemler.includes(d.deger)).map((d) => d.etiket).join(", ")], ["Can", "3 (doğru +1, yanlış −1)"]],
      }),
    });
  }, [zorlukId, soruSuresi, inputMode, donemler]);

  const klavyeAcik = useKlavyeAcik();

  // -- hesaplar
  const sikCarpani = siklar ? 0.5 : 1;
  const potansiyel = masa ? Math.round(simdiBilirsen(masa, acik) * sikCarpani) : BASLANGIC_PUANI;
  const carp = carpan(acik);

  // -- tur sonu
  function seriBitti(sonPuan) {
    addXP(XP_MAC_MAGLUBIYETI);
    if (sonPuan > rekor) {
      setRekor(sonPuan);
      AsyncStorage.setItem(REKOR_ANAHTARI, String(sonPuan)).catch(() => {});
    }
  }

  function turuKaybet(mesaj) {
    if (sesOnayIstegi) setSesOnayIstegi(null);
    const kalan = lives - 1;
    setLives(kalan);
    recordRound("whoAmICpu", false);
    playWrong();
    setSonuc({ dogru: false, mesaj });
    setKalanSure(null);
    if (kalan <= 0) { seriBitti(seriPuani); setPhase("gameOver"); } else setPhase("roundEnd");
  }

  // Süre (seçildiyse). Ses işlenirken / onay penceresi açıkken durur.
  useEffect(() => {
    if (phase !== "playing" || kalanSure === null) return;
    if (isProcessing || sesOnayIstegi) return;
    if (kalanSure <= 0) { turuKaybet("Süre doldu — bir can gitti"); return; }
    const t = setTimeout(() => setKalanSure((k) => (k === null ? null : k - 1)), 1000);
    return () => clearTimeout(t);
  }, [phase, kalanSure, isProcessing, sesOnayIstegi]);

  function kartCevir(kart) {
    if (phase !== "playing" || acik[kart.id]) return;
    if (!acilabilirMi(masa, acik, kart)) {
      setUyari(`Puanın yetmiyor: bu kart ${sayi(kart.bedel)}, puanın ${sayi(ASGARI_PUAN)}'in altına inemez. Tahmin et ya da joker kullan.`);
      return;
    }
    if (uyari) setUyari(null);
    setAcik((a) => ({ ...a, [kart.id]: "satin" }));
  }

  function tahminEt(girdi) {
    if (phase !== "playing" || !player) return;
    const metin = String(girdi || "").trim();
    if (!metin) return;
    setAnswerInput("");
    if (findMatchedPlayer(metin, [player])) {
      // DOĞRU
      const taban = simdiBilirsen(masa, acik);
      const puan = Math.round(turPuani(masa, acik) * sikCarpani);
      const satin = Object.values(acik).filter((v) => v === "satin").length;
      const bedava = Object.values(acik).filter((v) => v === "bedava").length;
      const dokum = [["Başlangıç", sayi(BASLANGIC_PUANI)]];
      if (satin) dokum.push([`${satin} kart çevirdin`, `−${sayi(BASLANGIC_PUANI - taban)}`]);
      if (bedava) dokum.push([`${bedava} ortak kulüp kartı`, "bedava"]);
      if (carp > 1) dokum.push([satin === 0 ? "Kart çevirmeden bildin" : "Az kartla bildin", `×${String(carp).replace(".", ",")}`]);
      if (siklar) dokum.push(["4 şık jokeri", "×0,5"]);
      recordRound("whoAmICpu", true);
      if (satin === 0 && !siklar) gorevOlayi("kimBuIpucusuz").catch(() => {});
      playCorrect();
      unlockPlayer(player.name);
      const yeniSeri = seriPuani + puan;
      setSeriPuani(yeniSeri);
      setLives((c) => yeniCan(c, true));
      setDogruSayisi((d) => d + 1);
      setSonuc({ dogru: true, puan, dokum, canGeldi: lives < AZAMI_CAN });
      setKalanSure(null);
      setPhase("roundEnd");
      return;
    }
    // YANLIŞ: önce tahmin edilen futbolcuyu bul (bilinmeyen isim can yakmaz)
    const tahmin = findMatchedPlayer(metin, PLAYERS);
    if (!tahmin) { setUyari(`"${metin}" diye bir futbolcu bulamadım — can gitmedi`); return; }
    if (tahminler.some((t) => t.ad === tahmin.name)) { setUyari(`${tahmin.name} zaten denendi`); return; }
    const kars = karsilastirAd(tahmin.name, player.name);
    const bedavaIdler = ortakKartlariAc(masa, acik, kars.ortakKulupler);
    setTahminler((l) => [kars, ...l]);
    if (bedavaIdler.length) {
      setAcik((a) => { const n = { ...a }; for (const id of bedavaIdler) n[id] = "bedava"; return n; });
      setUyari(`Ortak kulüp: ${kars.ortakKulupler.join(", ")} — kartı bedava açıldı`);
    } else {
      setUyari(`${tahmin.name} değil — bir can gitti`);
    }
    playWrong();
    recordRound("whoAmICpu", false);
    const kalan = yeniCan(lives, false);
    setLives(kalan);
    if (kalan <= 0) {
      setSonuc({ dogru: false, mesaj: `${tahmin.name} değildi — canın bitti` });
      seriBitti(seriPuani);
      setPhase("gameOver");
    }
  }

  function sonrakiTur() {
    const yeniSeviye = baslangicSeviyesi + Math.floor(dogruSayisi / 3);
    setLevel(yeniSeviye);
    turBaslat(yeniSeviye, usedNames);
  }

  function pasJokeri() {
    if (!jokers.pas || phase !== "playing") return;
    setJokers((j) => ({ ...j, pas: false }));
    turBaslat(level, usedNames);
  }

  function sikJokeri() {
    if (!jokers.sik || phase !== "playing" || !player || siklar) return;
    setJokers((j) => ({ ...j, sik: false }));
    const kat = mevkiKategorisi((PLAYER_BIRTH_POSITION[player.name] || {}).position);
    const [a, b] = havuzAraligi(level);
    const aday = sortedPlayers.slice(a, Math.max(a + 60, b)).filter((p) => p.name !== player.name && !tahminler.some((t) => t.ad === p.name));
    const ayniMevki = aday.filter((p) => mevkiKategorisi((PLAYER_BIRTH_POSITION[p.name] || {}).position) === kat);
    const kaynak = ayniMevki.length >= 3 ? ayniMevki : aday;
    const secilen = new Set();
    while (secilen.size < 3 && secilen.size < kaynak.length) secilen.add(kaynak[Math.floor(Math.random() * kaynak.length)].name);
    const liste = [...secilen, player.name].sort(() => Math.random() - 0.5);
    setSiklar(liste);
  }

  // -- ses
  async function sesBaslat() {
    try { setVoiceError(null); await startRecording(); } catch (e) { setVoiceError("Mikrofona erişilemedi."); }
  }
  async function sesBitir() {
    setVoiceError(null);
    try {
      const text = await stopRecording([]);
      if (!text) { setVoiceError("Sesi anlayamadım, tekrar dener misin?"); return; }
      const gonder = (a) => tahminEt(a);
      const yaz = (a) => { setAnswerInput(a); setInputMode("keyboard"); };
      if (sesOnayiAcik) setSesOnayIstegi({ duyulan: text, ad: text, gonder, yaz });
      else gonder(text);
    } catch (e) {
      setVoiceError(e.message || "Ses tanıma başarısız oldu");
    }
  }

  // ======================================================================= KURULUM
  if (phase === "setup") {
    return (
      <ModKurulum
        baslik="Kim Bu Futbolcu?"
        aciklama="Gizli futbolcunun bilgileri kapalı kartlarda. İstediğin kartı çevir, ama her kart puanından düşer. Yanlış tahmin bir can götürür ama ipucu bırakır; doğru tahmin bir can geri verir."
        vurgu={MODE_COLORS.whoAmI}
        onGeri={onExitSilent || onExit}
        onBasla={oyunuBaslat}
        baslaDevreDisi={sortedPlayers.length === 0}
        onVarsayilanKaydet={() => modVarsayilanKaydet({ zorluk: zorlukId, sure: soruSuresi, yontem: inputMode, donemler })}
      >
        <KurulumBolum baslik="DÖNEM" not={`Seçtiğin yıllarda oynamış, fotoğrafı olan ${sortedPlayers.length} futbolcu var.`}>
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

  if (!player || !masa) {
    return (
      <GameBackground style={s.kap}>
        <PoolEmpty
          baslik="Uygun futbolcu kalmadı"
          aciklama="Bu ayarlarla sorulacak fotoğraflı futbolcu kalmadı. Baştan başlayabilir ya da menüye dönebilirsin."
          onReset={() => { setUsedNames(new Set()); setPhase("setup"); }}
          onExit={onExitSilent || onExit}
        />
      </GameBackground>
    );
  }

  const bp = PLAYER_BIRTH_POSITION[player.name] || {};

  // ======================================================================= ÜST ŞERİT
  const ustSerit = (
    <View style={s.ust}>
      <BackButton text="Menü" onPress={onExit} style={{ marginTop: 0, marginBottom: 0 }} />
      <View style={s.canlar}>
        {[...Array(AZAMI_CAN)].map((_, i) => (
          <Ionicons key={i} name={i < lives ? "heart" : "heart-outline"} size={21} color={i < lives ? COLORS.danger : COLORS.textFaint} />
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ alignItems: "flex-end" }}>
        <Text style={s.ustEtiket}>SEVİYE {level} · SERİ</Text>
        <Text style={s.ustSayi}>{sayi(seriPuani)}</Text>
      </View>
    </View>
  );

  // ======================================================================= TUR SONU / OYUN SONU
  if (phase === "roundEnd" || phase === "gameOver") {
    const bitti = phase === "gameOver";
    return (
      <GameBackground style={s.kap}>
        {ustSerit}
        <ScrollView contentContainerStyle={s.sonucIcerik} showsVerticalScrollIndicator={false}>
          {/* Paket 13 — tur sonu açılışı: kapalı kartlar sırayla döner, foto netleşir, ad çıkar. */}
          <AcilisAnimasyonu
            masa={masa}
            acik={acik}
            ad={player.name}
            dogru={!!sonuc?.dogru}
            baslik={sonuc?.dogru ? "DOĞRU!" : bitti ? "SERİ BİTTİ" : "BU SEFER OLMADI"}
            altSatir={[masa.kimlik.find((k) => k.id === "mevki")?.deger, masa.kimlik.find((k) => k.id === "bayrak")?.deger, bp.birthYear].filter(Boolean).join(" · ")}
          />
          {sonuc?.dogru ? (
            <View style={s.dokum}>
              {sonuc.dokum.map(([a, b], i) => (
                <View key={i} style={s.dokumSatir}>
                  <Text style={s.dokumAd}>{a}</Text>
                  <Text style={[s.dokumDeger, b.startsWith("−") && { color: COLORS.danger }, b === "bedava" && { color: COLORS.accent }]}>{b}</Text>
                </View>
              ))}
              <View style={s.dokumCizgi} />
              <View style={s.dokumSatir}>
                <Text style={[s.dokumAd, { fontWeight: "900", color: COLORS.text }]}>Bu tur</Text>
                <Text style={s.dokumToplam}>+{sayi(sonuc.puan)}</Text>
              </View>
              {sonuc.canGeldi ? <Text style={s.canGeldi}>+1 can</Text> : null}
            </View>
          ) : (
            <Text style={s.sonucMesaj}>{sonuc?.mesaj}</Text>
          )}
          {bitti ? (
            <View style={s.istatlar}>
              <View style={s.istat}><Text style={s.istatSayi}>{sayi(seriPuani)}</Text><Text style={s.istatAd}>seri puanı</Text></View>
              <View style={s.istat}><Text style={s.istatSayi}>{dogruSayisi}</Text><Text style={s.istatAd}>futbolcu</Text></View>
              <View style={s.istat}><Text style={s.istatSayi}>{sayi(Math.max(rekor, seriPuani))}</Text><Text style={s.istatAd}>rekor</Text></View>
            </View>
          ) : null}
          {bitti ? (
            <>
              <SoundPressable style={s.anaDugme} onPress={oyunuBaslat}>
                <Text style={s.anaDugmeYazi}>TEKRAR OYNA</Text>
              </SoundPressable>
              <SoundPressable style={s.ikinciDugme} onPress={onExitSilent || onExit}>
                <Text style={s.ikinciDugmeYazi}>Menüye dön</Text>
              </SoundPressable>
            </>
          ) : (
            <>
              <SoundPressable style={s.anaDugme} onPress={sonrakiTur}>
                <Text style={s.anaDugmeYazi}>SONRAKİ FUTBOLCU</Text>
              </SoundPressable>
              <SoundPressable style={s.ikinciDugme} onPress={() => setProfilAcik(true)}>
                <Text style={s.ikinciDugmeYazi}>Profilini gör</Text>
              </SoundPressable>
            </>
          )}
        </ScrollView>
        <PlayerMiniProfile name={player.name} visible={profilAcik} onClose={() => setProfilAcik(false)} />
      </GameBackground>
    );
  }

  // ======================================================================= OYUN
  const turAnahtari = player.name + ":"; // yeni turda kartlar kapalı başlasın (animasyonsuz)
  return (
    <GameBackground style={s.kap}>
      {ustSerit}
      <KlavyeAlani>
        {/* 4 Ekim 2026 — klavye açıkken afiş tek satıra iniyor; cevap kutusu ve
            öneriler klavyenin üstünde kalsın diye. */}
        <SimdiBilirsenAfis puan={potansiyel} carp={carp} kucuk={klavyeAcik} />

        {kalanSure !== null && soruSuresi ? (
          <View style={s.sure}>
            <View style={{ flex: 1 }}><TimerBar current={kalanSure} total={soruSuresi} /></View>
            <Text style={[s.sureYazi, kalanSure <= 5 && { color: COLORS.danger }]}>{kalanSure} sn</Text>
          </View>
        ) : null}

        <View style={s.cevap}>
          <View style={s.cevapSatir}>
            <Ionicons name="search" size={18} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
            <TextInput
              style={s.cevapGirdi}
              autoCorrect={false}
              autoCapitalize="words"
              spellCheck={false}
              placeholder="Bu futbolcu kim?"
              placeholderTextColor={COLORS.textMuted}
              value={answerInput}
              onChangeText={(t) => { setAnswerInput(t); if (uyari) setUyari(null); }}
              onSubmitEditing={() => tahminEt(answerInput)}
              returnKeyType="send"
            />
            <SoundPressable
              onPress={() => (isRecording ? sesBitir() : sesBaslat())}
              disabled={isProcessing}
              style={[s.ikonDugme, isRecording && s.ikonDugmeKayit]}
              accessibilityLabel={isRecording ? "Kaydı durdur" : "Sesle cevap ver"}
            >
              <Ionicons name={isProcessing ? "hourglass" : isRecording ? "stop" : "mic"} size={20} color={isRecording ? COLORS.accentDark : COLORS.text} />
            </SoundPressable>
            <SoundPressable onPress={() => tahminEt(answerInput)} style={[s.ikonDugme, s.gonder]} accessibilityLabel="Tahmini gönder">
              <Ionicons name="arrow-forward" size={20} color={COLORS.accentDark} />
            </SoundPressable>
          </View>
          {suggestions.length > 0 && answerInput.trim().length > 1 ? (
            <View style={s.oneriler}>
              {suggestions.slice(0, klavyeAcik ? 3 : 4).map((ad) => (
                <SoundPressable key={ad} style={s.oneri} onPress={() => tahminEt(ad)}>
                  <Ionicons name="person-circle-outline" size={18} color={COLORS.textMuted} />
                  <Text style={s.oneriYazi} numberOfLines={1}>{ad}</Text>
                </SoundPressable>
              ))}
            </View>
          ) : null}
          {uyari ? <Text style={s.uyari}>{uyari}</Text> : null}
          {isRecording ? <Text style={s.sesDurum}>Dinliyorum — bitince kırmızı düğmeye dokun</Text> : null}
          {isProcessing ? <Text style={s.sesDurum}>Yazıya çevriliyor...</Text> : null}
          {voiceError ? <Text style={[s.sesDurum, { color: COLORS.danger }]}>{voiceError}</Text> : null}
          <VoiceConfirm
            istek={sesOnayIstegi}
            onOnayla={(ad) => { const i = sesOnayIstegi; setSesOnayIstegi(null); i?.gonder?.(ad); }}
            onTekrar={async () => { setSesOnayIstegi(null); await sesBaslat(); }}
            onYaz={(ad) => { const i = sesOnayIstegi; setSesOnayIstegi(null); i?.yaz?.(ad); }}
            onIptal={() => setSesOnayIstegi(null)}
          />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.icerik} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {siklar ? (
            <View style={s.siklar}>
              {siklar.map((ad) => (
                <SoundPressable key={ad} style={s.sik} onPress={() => tahminEt(ad)}>
                  <Text style={s.sikYazi} numberOfLines={1}>{ad}</Text>
                </SoundPressable>
              ))}
            </View>
          ) : null}

          <TahminTablosu tahminler={tahminler} />

          <MasaKartlari masa={masa} acik={acik} onKartCevir={kartCevir} turAnahtari={turAnahtari} fotoAd={player.name} />

          <View style={s.jokerler}>
            <SoundPressable style={[s.joker, !jokers.pas && s.jokerPasif]} disabled={!jokers.pas} onPress={pasJokeri}>
              <Ionicons name="play-skip-forward" size={16} color={jokers.pas ? COLORS.text : COLORS.textMuted} />
              <Text style={[s.jokerYazi, !jokers.pas && { color: COLORS.textMuted }]}>Pas · {jokers.pas ? "1 hak" : "kullanıldı"}</Text>
            </SoundPressable>
            <SoundPressable style={[s.joker, (!jokers.sik || siklar) && s.jokerPasif]} disabled={!jokers.sik || !!siklar} onPress={sikJokeri}>
              <Ionicons name="list" size={16} color={jokers.sik ? COLORS.text : COLORS.textMuted} />
              <Text style={[s.jokerYazi, !jokers.sik && { color: COLORS.textMuted }]}>4 Şık · {jokers.sik ? "puan ½" : "kullanıldı"}</Text>
            </SoundPressable>
          </View>
          <SoundPressable style={s.pesEt} onPress={() => turuKaybet("Pes ettin — bir can gitti")}>
            <Ionicons name="flag-outline" size={16} color={COLORS.danger} />
            <Text style={s.pesEtYazi}>Pes et · 1 can</Text>
          </SoundPressable>
        </ScrollView>
      </KlavyeAlani>
    </GameBackground>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg },
  ust: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.sm },
  canlar: { flexDirection: "row", gap: 3 },
  ustEtiket: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, color: COLORS.textMuted },
  ustSayi: { fontSize: 22, fontWeight: "900", color: COLORS.text },

  afis: {
    marginHorizontal: SPACING.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: 18,
    backgroundColor: "#2A1F06", borderWidth: 1, borderColor: "#5A430E",
  },
  afisUst: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5, color: "#FFD98A" },
  afisSayi: { fontSize: 40, fontWeight: "900", color: COLORS.cta, lineHeight: 44 },
  afisCarpan: { fontSize: 22, fontWeight: "900", color: "#FFE3A3" },
  afisAlt: { fontSize: 12, fontWeight: "700", color: "#FFD98A" },
  afisKucuk: { paddingVertical: 6 },
  afisSayiKucuk: { fontSize: 24, lineHeight: 28 },

  sure: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginHorizontal: SPACING.lg, marginTop: SPACING.sm },
  sureYazi: { fontSize: 13, fontWeight: "800", color: COLORS.textMuted, width: 44, textAlign: "right" },

  cevap: { marginHorizontal: SPACING.lg, marginTop: SPACING.sm },
  cevapSatir: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 2, borderColor: COLORS.accent, paddingHorizontal: 6, height: 52,
  },
  cevapGirdi: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "600", paddingVertical: 0 },
  ikonDugme: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  ikonDugmeKayit: { backgroundColor: COLORS.danger },
  gonder: { backgroundColor: COLORS.accent },
  oneriler: { marginTop: 4, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  oneri: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, paddingHorizontal: SPACING.md },
  oneriYazi: { color: COLORS.text, fontSize: 15, fontWeight: "600", flex: 1 },
  uyari: { marginTop: 6, fontSize: 13, fontWeight: "700", color: COLORS.cta },
  sesDurum: { marginTop: 6, fontSize: 12, fontWeight: "700", color: COLORS.textMuted },

  icerik: { paddingHorizontal: SPACING.lg, paddingBottom: 48 },
  siklar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: SPACING.md },
  sik: { width: "48.5%", paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.accent },
  sikYazi: { color: COLORS.text, fontSize: 14, fontWeight: "800", textAlign: "center" },

  tabloBaslik: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: SPACING.md, marginBottom: 4 },
  tabloBaslikYazi: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5, color: COLORS.textMuted, textAlign: "center" },
  hucreGenislik: { width: 40 },
  tahminSatir: {
    flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 5,
    borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  tahminAd: { flex: 1, fontSize: 13, fontWeight: "800", color: COLORS.text },
  hucre: { height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  hucreYazi: { fontSize: 14, fontWeight: "900" },

  bolum: { marginTop: SPACING.lg, marginBottom: SPACING.sm, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textMuted },
  bolumAlt: { fontSize: 12, fontWeight: "600", letterSpacing: 0, color: COLORS.textMuted },
  izgara: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  kart: { borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 4 },
  kartKapali: { backgroundColor: "#141E2B", borderColor: "#2E3E55" },
  kartAcik: { backgroundColor: "#10283A", borderColor: "#2B6A8E" },
  kartBaslangic: { backgroundColor: "#10283A", borderColor: "#5EC8FF" },
  kartBedava: { backgroundColor: "#0E2A18", borderColor: "#2F7A47" },
  kartKilitli: { backgroundColor: "#0F1620", borderColor: "#222D3B", opacity: 0.6 },
  kilitSatir: { flexDirection: "row", alignItems: "center", gap: 3 },
  kartBedelKilitli: { fontSize: 13, fontWeight: "900", color: COLORS.textMuted, textDecorationLine: "line-through" },
  kartEtiket: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, color: COLORS.textMuted },
  kartDeger: { fontSize: 14, fontWeight: "900", color: COLORS.text, textAlign: "center", alignSelf: "stretch" },
  arkadasAd: { fontSize: 14, fontWeight: "900", color: COLORS.text, textAlign: "center", alignSelf: "stretch" },
  kartBedel: { fontSize: 13, fontWeight: "900", color: COLORS.cta },
  kariyerYil: { fontSize: 12, fontWeight: "800", color: "#C9D4DF" },
  kariyerAd: { fontSize: 12, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  kalkan: {
    width: 28, height: 32, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    borderWidth: 2, borderStyle: "dashed", borderColor: COLORS.cardBorder, alignItems: "center", justifyContent: "center",
  },
  kalkanSoru: { fontSize: 15, fontWeight: "900", color: COLORS.textMuted },
  bedava: { fontSize: 12, fontWeight: "900", color: COLORS.accent },
  vitrinAd: { fontSize: 13, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  basari: { fontSize: 12, fontWeight: "700", color: "#FFE3A3", textAlign: "center", marginTop: 2 },
  arkadasAlt: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
  siluetKutu: { alignItems: "center", marginTop: SPACING.md },
  siluet: { width: 140, height: 140, borderRadius: 70 },

  jokerler: { flexDirection: "row", gap: 8, marginTop: SPACING.xl },
  joker: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46,
    borderRadius: 14, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  jokerPasif: { opacity: 0.55 },
  jokerYazi: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  // 4 Ekim 2026 (Kerem: "pes et butonu arkaplan ile aynı renkte kalmış
  // görünmüyor") — artık kırmızı çerçeveli, tam genişlikte düğme.
  pesEt: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, marginTop: SPACING.sm,
    borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.danger, backgroundColor: "rgba(255,93,93,0.10)",
  },
  pesEtYazi: { fontSize: 15, fontWeight: "800", color: COLORS.danger },

  sonucIcerik: { alignItems: "center", paddingHorizontal: SPACING.lg, paddingBottom: 48 },
  sonucUst: { marginTop: SPACING.md, marginBottom: SPACING.md, fontSize: 22, fontWeight: "900", letterSpacing: 3 },
  sonucAd: { ...TYPE.h1, marginTop: SPACING.md, textAlign: "center" },
  sonucMeta: { fontSize: 14, fontWeight: "600", color: COLORS.textMuted, marginTop: 2 },
  sonucKariyer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: SPACING.md },
  sonucKulup: { width: 70, minHeight: 60, borderRadius: 12, backgroundColor: "#10283A", borderWidth: 1, borderColor: "#2B6A8E", alignItems: "center", justifyContent: "center", padding: 4 },
  sonucKulupYil: { fontSize: 12, fontWeight: "800", color: "#9FCBE6" },
  sonucKulupAd: { fontSize: 12, fontWeight: "800", color: COLORS.text, textAlign: "center", marginTop: 2 },
  dokum: { alignSelf: "stretch", marginTop: SPACING.md, padding: SPACING.lg, borderRadius: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, gap: 7 },
  dokumSatir: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  dokumAd: { fontSize: 15, fontWeight: "600", color: COLORS.textMuted },
  dokumDeger: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  dokumCizgi: { height: 1, backgroundColor: COLORS.cardBorder },
  dokumToplam: { fontSize: 32, fontWeight: "900", color: COLORS.cta },
  canGeldi: { fontSize: 13, fontWeight: "800", color: COLORS.accent, textAlign: "right" },
  sonucMesaj: { fontSize: 15, fontWeight: "700", color: COLORS.textMuted, marginTop: SPACING.md, textAlign: "center" },
  istatlar: { flexDirection: "row", gap: 8, alignSelf: "stretch", marginTop: SPACING.lg },
  istat: { flex: 1, alignItems: "center", paddingVertical: SPACING.md, borderRadius: 14, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  istatSayi: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  istatAd: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
  anaDugme: { alignSelf: "stretch", marginTop: SPACING.xl, height: 58, borderRadius: 18, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  anaDugmeYazi: { fontSize: 20, fontWeight: "900", letterSpacing: 1.5, color: COLORS.accentDark },
  ikinciDugme: { alignSelf: "stretch", marginTop: SPACING.sm, height: 48, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: "center", justifyContent: "center" },
  ikinciDugmeYazi: { fontSize: 15, fontWeight: "700", color: COLORS.text },
});
