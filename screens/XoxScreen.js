import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ModKurulum, { KurulumBolum, SecimCipleri, ZorlukSecici, SureSecici } from "../components/ModKurulum";
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  ActivityIndicator, useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import MacSonuKarti from "../components/MacSonuKarti";
import { useOyuncuAdlari, OyuncuAdlariBolumu, IsimliSkorTablosu } from "../components/OyuncuAdlari";
import { karakterSec, tepki } from "../lib/cpuKarakterleri";
import { taninirlik } from "../lib/taninirlik";
import { KlavyeAlani, KlavyeScroll } from "../components/Klavye";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import TeamBadge from "../components/TeamBadge";
import AnswerFeedback from "../components/AnswerFeedback";
import PoolEmpty from "../components/PoolEmpty";
import { EslesmeProfiliBolumu } from "../components/EslesmeProfiliPenceresi";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import TimerBar from "../components/TimerBar";
import { recognitionScore } from "../lib/clubWeights";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { buildSuggestIndex, suggestPlayers, sesIpuclari } from "../lib/gameEngine";
import { useVoiceInput } from "../lib/useVoiceInput";
import VoiceConfirm from "../components/VoiceConfirm";
import { useAppSettings } from "../lib/SettingsContext";
import { useModVarsayilanlari, useKurulumKapisi, oyunBilgisiniYaz, ayarSatirlari, MOD_TANIMLARI, YONTEM_SECENEKLERI } from "../lib/modAyarlari";
import { useCorrectSound, useWrongSound, useCpuCorrectSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import {
  izgaraUret, zorlukAyari10, baslangicDurumu, IZGARA_TURLERI, basariVerisiVarMi, calinabilirMi, CALMA_HAKKI,
  kosulTuru, kosulEtiketi, kosulBayragi, kosulIkonu, aksiyonuIsle, hucreCevaplari, kareTukendiMi,
  cpuHucreSec, cpuCevapSec, sonucMetni, ZORLUKLAR, VARSAYILAN_ZORLUK, X, O,
} from "../lib/gridGame";

// ============================================================================
// FUTBOLCU XOX — 12 Eylül 2026 (Kerem: "xox oyunu da eklemek istiyorum.
// hem vs cpu hem aynı ekranda arkadaşla oynama şekli.")
//
// Kurallar lib/gridGame.js'te, saf ve Node testleriyle doğrulanmış. Bu dosya
// yalnızca çizim, CPU'nun gecikmeleri ve girdi.
//
// İki mod TEK ekranda: "cpu" ve "iki" (aynı telefon). Aradaki fark sadece
// O sırasının kimin tarafından oynandığı — kural kodu ikisinde de aynı.
// ============================================================================

// 26 Eylül 2026 — ana menüdeki XOX kartı artık kendi rengini (xox) kullanıyor;
// ekranın içi de aynı renkte olsun ki kart ile ekran tutarlı görünsün.
const VURGU = MODE_COLORS.xox;

// 26 Eylül 2026 (Kerem: "cevap başına süre sınırı koyalım. oyun başında
// seçilsin: 20-30-45-60 sn ve özel giriş, minimum 15 sn") — süre HAMLE
// başına: sıra sana geçtiği an başlıyor (kare seçme + cevap yazma dahil),
// dolunca sıra rakibe geçiyor. CPU'nun kendi düşünme süresi var, sayaç
// sadece insan oyuncuları bağlar.
// ad -> oyuncu nesnesi (maç sonu listesini tanınırlığa göre sıralamak için), ilk ihtiyaçta bir kez.
let _adHaritasi = null;
function adIleOyuncu(ad) {
  if (!_adHaritasi) {
    _adHaritasi = new Map();
    for (const p of PLAYERS) if (!_adHaritasi.has(p.name)) _adHaritasi.set(p.name, p);
  }
  return _adHaritasi.get(ad) || null;
}

const SURE_SECENEKLERI = [20, 30, 45, 60];
const VARSAYILAN_SURE = 30;
const ASGARI_SURE = 15;
const AZAMI_SURE = 300;

// Izgara başlığı: kulüpse logo, ülkeyse bayrak, başarıysa ikon + Türkçe ad.
function BaslikRozeti({ baslik, boyut }) {
  const tur = kosulTuru(baslik);
  return (
    <>
      {tur === "kulup" ? (
        <TeamBadge name={baslik} size={boyut} />
      ) : (
        <View style={[styles.kosulDaire, { width: boyut, height: boyut, borderRadius: boyut / 2 }]}>
          {tur === "ulke" ? (
            <Text style={{ fontSize: boyut * 0.55 }} allowFontScaling={false}>{kosulBayragi(baslik)}</Text>
          ) : (
            <Ionicons name={kosulIkonu(baslik)} size={boyut * 0.5} color={COLORS.cta} />
          )}
        </View>
      )}
      <Text style={[styles.baslikText, tur !== "kulup" && { color: COLORS.text, fontWeight: "800" }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
        {kosulEtiketi(baslik)}
      </Text>
    </>
  );
}

export default function XoxScreen({ onExit, onExitSilent, rakip }) {
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const playCpuCorrect = useCpuCorrectSound();

  // 4 Ekim 2026 (.28743) — Tüm Modlar'daki rakip seçimi (CPU / Yanımdaki) rota parametresiyle gelir.
  const [rakipTipi, setRakipTipi] = useState(rakip === "iki" ? "iki" : "cpu");   // "cpu" | "iki"
  const { adlar } = useOyuncuAdlari(2);
  // 27 Eylül 2026: zorluk 1-10 (bkz. lib/modAyarlari.js, gridGame zorlukAyari10)
  const [zorluk, setZorluk] = useState(4);
  // 4 Ekim 2026 — CPU gerçek rakip (lib/cpuKarakterleri.js)
  const karakter = useMemo(() => karakterSec(zorluk), [zorluk]);
  // 27 Eylül 2026 — ızgara türü: sadece kulüp / kulüp+ülke / kulüp+başarı / karma
  const [izgaraTuru, setIzgaraTuru] = useState("kulup");
  // 4 Ekim 2026 — çalma kuralı (benchmark .29313: oyuncu başı 3 hak, varsayılan açık)
  const [calma, setCalma] = useState(true);
  const xoxAyar = useMemo(() => zorlukAyari10(zorluk), [zorluk]);
  const [inputMode, setInputMode] = useState("keyboard");
  const [basladi, setBasladi] = useState(false);
  const [hazirlaniyor, setHazirlaniyor] = useState(false);
  const [durum, setDurum] = useState(null);
  const [girdi, setGirdi] = useState("");
  const [geriBildirim, setGeriBildirim] = useState(null);
  const [cpuDusunuyor, setCpuDusunuyor] = useState(false);
  const [uretilemedi, setUretilemedi] = useState(false);
  const [cevapSuresi, setCevapSuresi] = useState(VARSAYILAN_SURE);
  const [kalanSure, setKalanSure] = useState(null);
  const [cevaplarAcik, setCevaplarAcik] = useState(true);
  const { width: ekranGenislik } = useWindowDimensions();

  // Sesli cevap durumu — süre sayacı bunlara baktığı için yukarıda tanımlı.
  const seciliRef = useRef(null);
  seciliRef.current = durum?.secili ? durum : null;
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceInput(() => {
    const d = seciliRef.current;
    if (!d || !d.secili) return [];
    return sesIpuclari(PLAYERS, [d.izgara.satirlar[d.secili.satir], d.izgara.sutunlar[d.secili.sutun]].filter((h) => kosulTuru(h) === "kulup"));
  });
  const [sesHatasi, setSesHatasi] = useState(null);
  const [sesOnayIstegi, setSesOnayIstegi] = useState(null);
  const { settings: appSettings } = useAppSettings();
  // Çalma kuralı tercihi de "son seçimler" arasında hatırlanır.
  const calmaYuklendi = useRef(false);
  useEffect(() => {
    if (calmaYuklendi.current || !appSettings) return;
    const k = appSettings.modVarsayilanlari && appSettings.modVarsayilanlari.xox;
    if (!k) return;
    calmaYuklendi.current = true;
    if (typeof k.calma === "boolean") setCalma(k.calma);
  }, [appSettings]);
  const sesOnayiAcik = appSettings?.voiceConfirm !== false;


  // 26 Eylül 2026 (Kerem: "logolar ideal boyutta değil") — logo eskiden sabit
  // 26 px'ti; 4 sütunluk ızgarada kare ~80 px olduğu için çok küçük kalıyordu.
  // Artık başlık karesinin genişliğinden hesaplanıyor (~%55), altına ad sığıyor.
  const baslikKare = (ekranGenislik - SPACING.lg * 2 - 4 * 3) / 4;
  const logoBoyut = Math.round(Math.max(28, Math.min(58, baslikKare * 0.55)));

  const baglam = useMemo(() => ({ veriSeti: PLAYERS }), []);
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(
    () => (girdi.trim().length < 3 ? [] : suggestPlayers(suggestIndex, girdi)),
    [suggestIndex, girdi]
  );

  const cpuyaKarsi = rakipTipi === "cpu";
  // CPU her zaman O; insan (ya da 1. oyuncu) X. Böylece "sıra bende mi"
  // sorusunun cevabı tek bir yerde duruyor.
  const benimSiram = !cpuyaKarsi || durum?.sira === X;

  const zamanlayiciRef = useRef(null);
  useEffect(() => () => { if (zamanlayiciRef.current) clearTimeout(zamanlayiciRef.current); }, []);

  // 28 Eylül 2026 — Eşleşme Profili (Ayarlar'daki genel profil; kurulumda bu maç için değişir)
  const eslesme = useEslesmeProfili();
  const yeniOyun = useCallback(() => {
    setHazirlaniyor(true);
    setUretilemedi(false);
    // Izgara üretimi ilk çağrıda ikili tablosunu kuruyor (~0,1 sn). Bir kare
    // bekletip göstergeyi çizdiriyoruz ki ekran donuk açılmasın.
    setTimeout(() => {
      // 13 Eylül 2026 (Kerem: "gelen takımlar zorluk derecesine göre daha kolay
      // olmalı") — ızgara ARTIK zorluğa göre kuruluyor; eskiden zorluk sadece
      // CPU'yu etkiliyordu, soru her seviyede aynı zorluktaydı.
      const izgara = izgaraUret(PLAYERS, xoxAyar, Math.random, izgaraTuru, eslesme.derlenmis);
      if (!izgara) { setUretilemedi(true); setHazirlaniyor(false); return; }
      // veriSeti veriliyor: dokuz karenin cevapları bir kez hesaplanıp durumda
      // saklanıyor (bkz. lib/gridGame.js baslangicDurumu).
      setDurum(baslangicDurumu(izgara, X, PLAYERS, { calma }));
      setGirdi("");
      setGeriBildirim(null);
      setHazirlaniyor(false);
      setBasladi(true);
    }, 40);
  }, [xoxAyar, izgaraTuru, eslesme.derlenmis, calma]);

  // --- CPU sırası ----------------------------------------------------------
  useEffect(() => {
    if (!durum || durum.bitti || !cpuyaKarsi) return;
    if (durum.sira !== O || durum.secili) return;

    setCpuDusunuyor(true);
    zamanlayiciRef.current = setTimeout(() => {
      setCpuDusunuyor(false);
      setDurum((d) => {
        if (!d || d.bitti || d.sira !== O) return d;
        const indis = cpuHucreSec(d, xoxAyar, Math.random, PLAYERS);
        if (indis === null) return d;
        const satir = Math.floor(indis / 3);
        const sutun = indis % 3;
        const secili = aksiyonuIsle(d, { tip: "hucreSec", satir, sutun }, baglam) || d;
        const ad = cpuCevapSec(secili, satir, sutun, baglam, xoxAyar);
        const sonraki = ad
          ? aksiyonuIsle(secili, { tip: "cevap", metin: ad }, baglam)
          : aksiyonuIsle(secili, { tip: "pas" }, baglam);
        return sonraki || secili;
      });
    }, 900 + Math.random() * 900);

    return () => { if (zamanlayiciRef.current) clearTimeout(zamanlayiciRef.current); };
  }, [durum, cpuyaKarsi, xoxAyar, baglam]);

  // --- Hamle süresi ----------------------------------------------------------
  const insanSirasi = !!durum && !durum.bitti && (!cpuyaKarsi || durum.sira === X);
  // Her yeni hamlede (hamleNo değişince) ya da yeni oyunda sayaç baştan başlar.
  useEffect(() => {
    if (!basladi || !insanSirasi) { setKalanSure(null); return; }
    setKalanSure(cevapSuresi);
  }, [basladi, insanSirasi, durum?.hamleNo, durum?.izgara, cevapSuresi]);

  useEffect(() => {
    if (kalanSure === null) return;
    if (isProcessing || sesOnayIstegi) return; // ses işlenirken / onay açıkken durur
    if (kalanSure <= 0) {
      setKalanSure(null);
      setGirdi("");
      setDurum((d) => (d && !d.bitti ? aksiyonuIsle(d, { tip: "sureDoldu" }, baglam) || d : d));
      return;
    }
    const t = setTimeout(() => setKalanSure((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [kalanSure, baglam, isProcessing, sesOnayIstegi]);

  // --- Maç sonu: her karenin doğru cevapları ----------------------------------
  // 26 Eylül 2026 (Kerem: "maç sonunda doğru cevapları görebileceğimiz bir alan")
  const macSonuCevaplari = useMemo(() => {
    if (!durum?.bitti) return null;
    const liste = [];
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(i / 3), c = i % 3;
      // Karelerin cevap adları oyun başında zaten hesaplandı (durum.hucreAdlari);
      // 46 bin oyuncuyu yeniden taramamak için onları kullanıyoruz.
      const adlar = durum.hucreAdlari ? durum.hucreAdlari[i] : hucreCevaplari(PLAYERS, durum.izgara, r, c).map((p) => p.name);
      const oyuncular = adlar
        .map((ad) => adIleOyuncu(ad))
        .filter(Boolean)
        .sort((a, b) => recognitionScore(b) - recognitionScore(a));
      liste.push({
        anahtar: `${r}-${c}`,
        satir: kosulEtiketi(durum.izgara.satirlar[r]),
        sutun: kosulEtiketi(durum.izgara.sutunlar[c]),
        sahip: durum.tahta[i],
        verilen: durum.hucreSahipleri[`${r}-${c}`]?.ad || null,
        adlar: oyuncular.map((p) => p.name),
      });
    }
    return liste;
  }, [durum?.bitti, durum?.izgara, durum?.tahta, durum?.hucreSahipleri]);

  // --- Hamle sonrası ses + geri bildirim -----------------------------------
  const islenenHamleRef = useRef(null);
  useEffect(() => {
    const h = durum?.sonHamle;
    if (!h || h === islenenHamleRef.current) return;
    islenenHamleRef.current = h;

    const cpuHamlesi = cpuyaKarsi && h.kimden === O;
    if (h.tip === "dogru") {
      if (cpuHamlesi) playCpuCorrect(); else playCorrect();
      // 26 Eylül 2026 (Kerem: "cpu'nun söyledikleri hiçbir modda ansiklopediyi açmasın. kendi söylediklerimiz açsın.")
      // CPU'nun (O) doğru cevabı koleksiyona eklenmiyor. İki kişilik modda
      // iki oyuncu da bu telefondaki gerçek insanlar, ikisi de sayılır.
      if (!cpuHamlesi) unlockPlayer(h.ad);
      setGeriBildirim({ anahtar: Date.now() + Math.random(), correct: true, message: (h.calma ? "ÇALDI! " : "") + (cpuHamlesi ? `${karakter.ad}: ${h.ad}` : h.ad) });
    } else if (h.tip === "yanlis") {
      playWrong();
      setGeriBildirim({ anahtar: Date.now() + Math.random(),
        correct: false,
        message: h.ayniIsim
          ? "Çalmak için FARKLI bir futbolcu gerekir"
          : cpuHamlesi ? `${karakter.ad} bilemedi: ${h.metin}` : "Bu futbolcu bu ikilide oynamadı",
      });
    } else if (h.tip === "pas") {
      setGeriBildirim({ anahtar: Date.now() + Math.random(), correct: false, message: cpuHamlesi ? `${karakter.ad} pas geçti` : "Pas geçtin" });
    } else if (h.tip === "sure") {
      playWrong();
      setGeriBildirim({ anahtar: Date.now() + Math.random(),
        correct: false,
        message: cpuyaKarsi ? `Süre doldu, sıra ${karakter.ad}'da` : `Süre doldu, sıra ${h.kimden === X ? adlar[1] : adlar[0]} oyuncusunda`,
      });
    }
  }, [durum?.sonHamle, cpuyaKarsi, playCorrect, playWrong, playCpuCorrect, karakter]);

  // --- Maç sonu: istatistik + XP (bir kez) ---------------------------------
  const macIslendiRef = useRef(false);
  useEffect(() => {
    if (!durum?.bitti) { macIslendiRef.current = false; return; }
    if (macIslendiRef.current) return;
    macIslendiRef.current = true;

    const modId = cpuyaKarsi ? "xoxCpu" : "xox";
    if (cpuyaKarsi) {
      const kazandim = durum.kazanan === X;
      recordRound(modId, kazandim);
      addXP(kazandim ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI);
    } else {
      // İki kişilik modda "kazanan" bu cihazın sahibi olmayabilir; istatistiğe
      // galibiyet/mağlubiyet yazmak yanıltıcı olurdu. Sadece oynandı bilgisi
      // için 1. oyuncunun sonucunu yazıyoruz (yerel modda da böyle).
      recordRound(modId, durum.kazanan === X);
    }
  }, [durum?.bitti, durum?.kazanan, cpuyaKarsi]);

  function hucreyeDokun(satir, sutun) {
    if (!durum || durum.bitti || !benimSiram || cpuDusunuyor) return;
    // Bu karede kullanılmamış geçerli cevap kalmadıysa dokunmak boşuna —
    // oyuncu bilmediği için değil, cevap KALMADIĞI için kaybediyor olurdu.
    if (kareTukendiMi(durum, satir, sutun, PLAYERS)) {
      setGeriBildirim({ anahtar: Date.now() + Math.random(), correct: false, message: "Bu karenin cevapları tükendi" });
      return;
    }
    const yeni = aksiyonuIsle(durum, { tip: "hucreSec", satir, sutun }, baglam);
    if (yeni) { setDurum(yeni); setGirdi(""); }
  }

  // --- Sesli cevap (27 Eylül 2026, Kerem: "xox'te sesli cevap yok") ----------
  // Whisper ipucu: seçili karenin iki kulübünün tanınmış oyuncuları (doğru
  // cevaplar da içinde ama bir o kadar yanlış aday var — kopya vermiyor).

  async function mikrofonaBas() {
    setSesHatasi(null);
    if (isRecording) {
      try {
        const metin = await stopRecording();
        if (!metin) { setSesHatasi("Sesi anlayamadım, tekrar dener misin?"); return; }
        const gonder = (a) => cevapGonder(a);
        const yaz = (a) => { setGirdi(a); setInputMode("keyboard"); };
        if (sesOnayiAcik) setSesOnayIstegi({ duyulan: metin, ad: metin, gonder, yaz });
        else gonder(metin);
      } catch (err) {
        setSesHatasi(err.message || "Ses tanıma başarısız oldu");
      }
    } else {
      try { await startRecording(); } catch (err) { setSesHatasi(err.message || "Mikrofona erişilemedi"); }
    }
  }
  function sesOnayla(a) { const i = sesOnayIstegi; setSesOnayIstegi(null); if (i && i.gonder) i.gonder(a); }
  function sesYaz(a) { const i = sesOnayIstegi; setSesOnayIstegi(null); if (i && i.yaz) i.yaz(a); }
  async function sesTekrar() {
    setSesOnayIstegi(null);
    try { await startRecording(); } catch (err) { setSesHatasi(err.message || "Mikrofona erişilemedi"); }
  }
  // Sıra değişince açık kalan kayıt/onay temizlensin.
  useEffect(() => {
    if (!durum?.secili) {
      setSesOnayIstegi(null);
      if (isRecording) stopRecording([]).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum?.secili]);

  const modVarsayilanKaydet = useModVarsayilanlari("xox", { zorluk: setZorluk, sure: setCevapSuresi, yontem: setInputMode });

  // 4 Ekim 2026 — kurulumsuz başlangıç (.27319): mod son ayarlarla hemen başlar;

  // kurulum sol alttaki ⚙ ya da mod rehberindeki "Ayarları değiştir" ile açılır.

  useKurulumKapisi("xox", {
    kurulumda: !basladi,
    baslat: () => yeniOyun(),
    kurulumaDon: () => setBasladi(false),
  });
  useEffect(() => {
    oyunBilgisiniYaz("xox", { satirlar: ayarSatirlari({ zorluk, sure: cevapSuresi, yontem: inputMode, ekstra: [["Rakip", cpuyaKarsi ? "CPU" : "2 kişi"], ["Izgara", (IZGARA_TURLERI.find((t) => t.deger === izgaraTuru) || {}).etiket || "Kulüpler"]] }) });
  }, [zorluk, cevapSuresi, inputMode, cpuyaKarsi, izgaraTuru]);

  function cevapGonder(ad) {
    const metin = String(ad ?? girdi).trim();
    if (!metin || !durum?.secili) return;
    setGirdi("");
    const yeni = aksiyonuIsle(durum, { tip: "cevap", metin }, baglam);
    if (yeni) setDurum(yeni);
  }

  // ---------------------------------------------------------------- kurulum
  if (uretilemedi) {
    return <PoolEmpty onReset={yeniOyun} onExit={onExit} />;
  }

  if (!basladi) {
    // 27 Eylül 2026 — ortak kurulum ekranı (bkz. components/ModKurulum.js).
    return (
      <ModKurulum
        baslik="Futbolcu XOX"
        aciklama="Izgaranın satır ve sütunlarında kulüpler var. Bir kareyi almak için o karenin iki kulübünde de oynamış bir futbolcu söyle. Üçlü sırayı yapan kazanır."
        vurgu={VURGU}
        onGeri={onExitSilent || onExit}
        onVarsayilanKaydet={() => modVarsayilanKaydet({ zorluk, sure: cevapSuresi, yontem: inputMode, calma })}
        onBasla={yeniOyun}
        baslaYukleniyor={hazirlaniyor}
      >
        <KurulumBolum baslik="RAKİP">
          <SecimCipleri
            secenekler={[
              { deger: "cpu", etiket: "CPU'ya karşı", ikon: "hardware-chip" },
              { deger: "iki", etiket: "2 Kişi (aynı telefon)", ikon: "people" },
            ]}
            secili={rakipTipi}
            onSec={setRakipTipi}
          />
        </KurulumBolum>
        {!cpuyaKarsi ? <OyuncuAdlariBolumu adet={2} /> : null}
        <KurulumBolum
          baslik="ZORLUK"
          not={cpuyaKarsi
            ? "Zorluk hem ızgaradaki kulüpleri hem CPU'nun ne kadar iyi oynadığını belirler."
            : "Zorluk ızgaradaki kulüpleri ve karelerin ne kadar kolay doldurulacağını belirler."}
        >
          <ZorlukSecici
            deger={zorluk}
            onDegis={setZorluk}
            aciklama={(z) => (z <= 2 ? "Bol ortak isimli dev kulüpler." : z <= 4 ? "Tanıdık kulüpler, rahat kareler." : z <= 6 ? "Dengeli." : z <= 8 ? "Az ortak isimli kareler." : "İğne deliği kareler.")}
          />
        </KurulumBolum>
        <KurulumBolum
          baslik="IZGARA TÜRÜ"
          not={izgaraTuru === "kulup"
            ? "Satır ve sütunlarda sadece kulüpler."
            : izgaraTuru === "ulke"
            ? "Bazı sütunlarda ülke olur: \"Brezilyalı + Real Madrid'de oynamış\"."
            : izgaraTuru === "basari"
            ? "Bazı sütunlarda başarı olur: \"Ballon d'Or sahibi + Real Madrid'de oynamış\"."
            : "Ülke ve başarı sütunları karışık gelir."}
        >
          <SecimCipleri
            secenekler={IZGARA_TURLERI.filter((t) => (t.deger !== "basari" && t.deger !== "karma") || basariVerisiVarMi() || t.deger === "karma")}
            secili={izgaraTuru}
            onSec={setIzgaraTuru}
          />
        </KurulumBolum>
        <KurulumBolum baslik="ÇALMA KURALI" not={`Açıkken rakibin aldığı kareye dokunup o kare için FARKLI bir futbolcu söylersen kare senin olur. Herkesin ${CALMA_HAKKI} çalma hakkı var.`}>
          <SecimCipleri secenekler={[{ deger: true, etiket: "Açık" }, { deger: false, etiket: "Kapalı" }]} secili={calma} onSec={setCalma} />
        </KurulumBolum>
        <EslesmeProfiliBolumu eslesme={eslesme} not="Izgaradaki kulüpler profilin bölge ve kulüp ayarlarına göre seçilir." />
        <KurulumBolum baslik={MOD_TANIMLARI.xox.sure.etiket}>
          <SureSecici
            secenekler={MOD_TANIMLARI.xox.sure.secenekler}
            deger={cevapSuresi}
            onDegis={setCevapSuresi}
            asgari={MOD_TANIMLARI.xox.sure.asgari}
            azami={MOD_TANIMLARI.xox.sure.azami}
            aciklama={MOD_TANIMLARI.xox.sure.aciklama}
          />
        </KurulumBolum>
        <KurulumBolum baslik="CEVAP YÖNTEMİ" not="İki yöntem de oyun sırasında her zaman kullanılabilir; bu seçim hangisinin öne çıkacağını belirler.">
          <SecimCipleri secenekler={YONTEM_SECENEKLERI} secili={inputMode} onSec={setInputMode} />
        </KurulumBolum>
      </ModKurulum>
    );
  }

  // ---------------------------------------------------------------- oyun
  const secili = durum.secili;
  const seciliCevapSayisi = secili
    ? hucreCevaplari(PLAYERS, durum.izgara, secili.satir, secili.sutun).length
    : 0;

  const siraEtiketi = durum.bitti
    ? sonucMetni(durum, cpuyaKarsi)
    : cpuyaKarsi
    ? (durum.sira === X ? "Sıra sende" : cpuDusunuyor ? `${karakter.avatar} ${karakter.ad} düşünüyor…` : `${karakter.avatar} ${karakter.ad} oynuyor`)
    : (durum.sira === X ? `${adlar[0]} (X)` : `${adlar[1]} (O)`);

  return (
    <GameBackground style={styles.kap}>
      <KlavyeAlani style={{ flex: 1 }}>
        <BackButton onPress={onExitSilent || onExit} />

        <KlavyeScroll
          contentContainerStyle={{ paddingBottom: SPACING.xl }}
          keyboardShouldPersistTaps="handled"
        >
          {!secili && !durum.bitti && benimSiram && (
            <Text style={styles.ipucu}>
              {durum.calmaHakki && durum.calmaHakki[durum.sira] > 0
                ? "Boş bir kareye dokun — ya da rakibin karesini çal"
                : "Almak istediğin kareye dokun"}
            </Text>
          )}
          {durum.calmaHakki ? (
            <Text style={styles.calmaSatir}>
              Çalma hakkı · X: {durum.calmaHakki[X]} · O: {durum.calmaHakki[O]}
            </Text>
          ) : null}

          <View style={styles.siraSerit}>
            <View style={[styles.isaretRozet, { backgroundColor: durum.sira === X ? VURGU.main : COLORS.card }]}>
              <Text style={[styles.isaretRozetText, durum.sira === X && { color: COLORS.accentDark }]}>X</Text>
            </View>
            <Text style={styles.siraText}>{siraEtiketi}</Text>
            <View style={[styles.isaretRozet, { backgroundColor: durum.sira === O ? VURGU.main : COLORS.card }]}>
              <Text style={[styles.isaretRozetText, durum.sira === O && { color: COLORS.accentDark }]}>O</Text>
            </View>
          </View>

          {kalanSure !== null && (
            <View style={styles.sureKutu}>
              <TimerBar current={kalanSure} total={cevapSuresi} />
              <Text style={[styles.sureYazi, kalanSure <= 5 && { color: COLORS.danger }]}>
                {kalanSure} sn
              </Text>
            </View>
          )}

          {/* --- CEVAP ALANI ---
              13 Eylül 2026 (Kerem: "cevap verme kısmı aşırı aşağıda kalıyor.
              klavye kapatıyor.") — panel eskiden ekranın EN ALTINDA sabitti;
              klavye açılınca tam onun üstüne biniyordu. Artık ızgaranın
              ÜSTÜNDE, sıra şeridinin hemen altında duruyor: klavye ekranın alt
              yarısını kaplasa bile girdi kutusu görünür kalıyor. Hangi kareyi
              doldurduğun zaten başlıkta ("Arsenal + Chelsea") yazdığı için
              ızgaranın görünmesi şart değil. */}
          {secili && !durum.bitti && benimSiram && (
            <View style={styles.cevapPaneli}>
              <Text style={styles.hedefText}>
                {kosulEtiketi(durum.izgara.satirlar[secili.satir])} + {kosulEtiketi(durum.izgara.sutunlar[secili.sutun])}
              </Text>
              <Text style={styles.hedefAlt}>
                {secili.calma
                  ? `ÇALMA · "${durum.hucreSahipleri[`${secili.satir}-${secili.sutun}`]?.ad || ""}" dışında bir futbolcu söyle (1 çalma hakkı gider)`
                  : `${seciliCevapSayisi} olası cevap`}
              </Text>

              <View style={styles.girdiSatir}>
                <TextInput
                  style={styles.girdi}
                  placeholder={inputMode === "voice" ? "Konuş ya da yaz..." : "Futbolcu adı yaz..."}
                  placeholderTextColor={COLORS.textFaint}
                  value={girdi}
                  onChangeText={setGirdi}
                  onSubmitEditing={() => cevapGonder()}
                  returnKeyType="send"
                  autoCorrect={false}
                  autoCapitalize="words"
                  spellCheck={false}
                  autoFocus={inputMode !== "voice"}
                />
                <SoundPressable
                  style={[styles.mikrofonBtn, isRecording && styles.mikrofonBtnAktif]}
                  onPress={mikrofonaBas}
                  disabled={isProcessing}
                  accessibilityLabel={isRecording ? "Kaydı durdur" : "Sesle cevap ver"}
                >
                  {isProcessing ? (
                    <ActivityIndicator color={COLORS.text} />
                  ) : (
                    <Ionicons name={isRecording ? "stop" : "mic"} size={20} color={isRecording ? "#fff" : COLORS.text} />
                  )}
                </SoundPressable>
                <SoundPressable style={styles.gonderBtn} onPress={() => cevapGonder()} accessibilityLabel="Gönder">
                  <Ionicons name="send" size={18} color={COLORS.accentDark} />
                </SoundPressable>
              </View>
              {isRecording ? <Text style={styles.sesIpucu}>Dinliyorum — bitince kırmızı düğmeye dokun</Text> : null}
              {isProcessing ? <Text style={styles.sesIpucu}>Yazıya çevriliyor...</Text> : null}
              {sesHatasi ? <Text style={[styles.sesIpucu, { color: COLORS.danger }]}>{sesHatasi}</Text> : null}
              <VoiceConfirm
                istek={sesOnayIstegi}
                onOnayla={sesOnayla}
                onTekrar={sesTekrar}
                onYaz={sesYaz}
                onIptal={() => setSesOnayIstegi(null)}
              />

              {oneriler.length > 0 && (
                <ScrollView
                  horizontal
                  keyboardShouldPersistTaps="handled"
                  showsHorizontalScrollIndicator={false}
                  style={styles.oneriSerit}
                >
                  {oneriler.map((ad) => (
                    <SoundPressable key={ad} style={styles.oneriCip} onPress={() => cevapGonder(ad)}>
                      <Text style={styles.oneriCipText}>{ad}</Text>
                    </SoundPressable>
                  ))}
                </ScrollView>
              )}

              <View style={styles.altBtnSatir}>
                <SoundPressable
                  onPress={() => setDurum(aksiyonuIsle(durum, { tip: "secimiIptal" }, baglam) || durum)}
                >
                  <Text style={styles.kucukLink}>Başka kare seç</Text>
                </SoundPressable>
                <SoundPressable
                  onPress={() => setDurum(aksiyonuIsle(durum, { tip: "pas" }, baglam) || durum)}
                >
                  <Text style={styles.kucukLink}>Pas geç</Text>
                </SoundPressable>
              </View>
            </View>
          )}

          {/* --- IZGARA --- */}
          <View style={styles.izgara}>
            {/* Üst başlık satırı: köşe boş + sütun kulüpleri */}
            <View style={styles.izgaraSatir}>
              <View style={styles.kose} />
              {durum.izgara.sutunlar.map((k) => (
                <View key={k} style={styles.baslikHucre}>
                  <BaslikRozeti baslik={k} boyut={logoBoyut} />
                </View>
              ))}
            </View>

            {durum.izgara.satirlar.map((satirKulup, r) => (
              <View key={satirKulup} style={styles.izgaraSatir}>
                <View style={styles.baslikHucre}>
                  <BaslikRozeti baslik={satirKulup} boyut={logoBoyut} />
                </View>
                {durum.izgara.sutunlar.map((_, c) => {
                  const indis = r * 3 + c;
                  const sahip = durum.tahta[indis];
                  const sahipBilgi = durum.hucreSahipleri[`${r}-${c}`];
                  const seciliMi = secili?.satir === r && secili?.sutun === c;
                  const kazananDa = durum.kazananCizgi?.includes(indis);
                  const tukendi = !sahip && kareTukendiMi(durum, r, c, PLAYERS);
                  const calinabilir = !durum.bitti && benimSiram && calinabilirMi(durum, indis);
                  return (
                    <SoundPressable
                      key={c}
                      style={[
                        styles.hucre,
                        seciliMi && styles.hucreSecili,
                        sahip === X && styles.hucreX,
                        sahip === O && styles.hucreO,
                        kazananDa && styles.hucreKazanan,
                        tukendi && styles.hucreTukendi,
                        calinabilir && styles.hucreCalinabilir,
                      ]}
                      onPress={() => hucreyeDokun(r, c)}
                    >
                      {sahip ? (
                        <>
                          <Text style={[styles.hucreIsaret, sahip === O && { color: COLORS.cta }]}>
                            {sahip === X ? "X" : "O"}
                          </Text>
                          <Text style={styles.hucreAd} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{sahipBilgi?.ad}</Text>
                        </>
                      ) : (
                        <Ionicons
                          name={tukendi ? "close" : seciliMi ? "create" : "add"}
                          size={18}
                          color={seciliMi ? VURGU.main : COLORS.textFaint}
                        />
                      )}
                    </SoundPressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* --- MAÇ SONU --- */}
          {durum.bitti && cpuyaKarsi && (
            <MacSonuKarti
              modAdi="Futbolcu XOX"
              modeId="xoxCpu"
              kazanan={durum.kazanan === "berabere" ? "berabere" : durum.kazanan === X ? "sen" : "rakip"}
              skorSen={durum.tahta.filter((t) => t === X).length}
              skorRakip={durum.tahta.filter((t) => t === O).length}
              skorEtiketi="kare"
              rakip={{ ad: karakter.ad, avatar: karakter.avatar, renk: karakter.renk, tepki: tepki(karakter, durum.kazanan === X ? "kaybetti" : "kazandi", () => (durum.hamleNo % 7) / 7) }}
              turlar={durum.tahta.map((t) => (t === X ? "sen" : t === O ? "rakip" : "yok"))}
              kareSatir={3}
              enIyi={(() => {
                const benim = Object.values(durum.hucreSahipleri || {}).filter((h) => h.oyuncu === X && h.ad).map((h) => h.ad);
                if (!benim.length) return null;
                const en = [...benim].sort((a, b) => taninirlik(a) - taninirlik(b))[0];
                return { ad: en, alt: "Izgarada verdiğin en nadir isim" };
              })()}
              kazanilanXp={0}
              rovansEtiketi="YENİ IZGARA"
              onRovans={yeniOyun}
              onMenu={onExitSilent || onExit}
            />
          )}
          {durum.bitti && !cpuyaKarsi && (
            <View>
              <IsimliSkorTablosu
                modAdi="Futbolcu XOX"
                oyuncular={[
                  { ad: adlar[0], puan: durum.tahta.filter((t) => t === X).length },
                  { ad: adlar[1], puan: durum.tahta.filter((t) => t === O).length },
                ]}
                // Üçlü sıra yapan, kare sayısı az olsa da kazanır.
                kazanan={durum.kazanan === "berabere" ? "berabere" : durum.kazanan === X ? 0 : 1}
                skorEtiketi="kare"
                altYazi={`${durum.kullanilanlar.length} doğru cevap`}
                rovansEtiketi="RÖVANŞ — YENİ IZGARA"
                onRovans={yeniOyun}
                onMenu={onExitSilent || onExit}
              />
              <SoundPressable style={{ alignSelf: "center", marginTop: 4 }} onPress={() => setBasladi(false)}>
                <Text style={styles.ikincilBtnText}>Ayarlar</Text>
              </SoundPressable>
            </View>
          )}

          {macSonuCevaplari && (
            <View style={styles.cevaplarKutu}>
              <SoundPressable style={styles.cevaplarBaslikSatir} onPress={() => setCevaplarAcik((a) => !a)}>
                <Text style={styles.cevaplarBaslik}>DOĞRU CEVAPLAR</Text>
                <Ionicons name={cevaplarAcik ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textMuted} />
              </SoundPressable>
              {cevaplarAcik && macSonuCevaplari.map((k) => (
                <View key={k.anahtar} style={styles.cevapKart}>
                  <View style={styles.cevapKartUst}>
                    <Text style={styles.cevapKartBaslik} numberOfLines={2}>{k.satir} × {k.sutun}</Text>
                    {k.sahip ? (
                      <Text style={[styles.cevapKartSahip, k.sahip === O && { color: COLORS.cta }]}>
                        {k.sahip === X ? "X" : "O"}
                      </Text>
                    ) : null}
                  </View>
                  {k.verilen ? <Text style={styles.cevapVerilen}>Verilen: {k.verilen}</Text> : null}
                  <Text style={styles.cevapListe}>
                    {k.adlar.slice(0, 8).join(" · ")}
                    {k.adlar.length > 8 ? `  (+${k.adlar.length - 8} daha)` : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Kullanılan futbolcular — aynı isim iki kez kullanılamadığı için
              oyuncunun bunu görmesi gerekiyor. */}
          {durum.kullanilanlar.length > 0 && !durum.bitti && (
            <View style={styles.kullanilanKutu}>
              <Text style={styles.kullanilanBaslik}>KULLANILANLAR</Text>
              <Text style={styles.kullanilanText}>{durum.kullanilanlar.join(" · ")}</Text>
            </View>
          )}
        </KlavyeScroll>

        {geriBildirim && (
          <View style={styles.geriBildirimSarmal} pointerEvents="none">
            <AnswerFeedback
              key={geriBildirim.anahtar}
              correct={geriBildirim.correct}
              message={geriBildirim.message}
              onDone={() => setGeriBildirim(null)}
            />
          </View>
        )}
      </KlavyeAlani>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, padding: SPACING.lg, paddingTop: SPACING.xxl },

  ustBaslik: { ...TYPE.h1, textAlign: "center", marginTop: SPACING.md },
  aciklama: { ...TYPE.bodyMuted, textAlign: "center", marginTop: SPACING.sm, marginBottom: SPACING.xl },
  blokBaslik: { ...TYPE.eyebrow, color: VURGU.main, fontSize: 12, marginBottom: SPACING.sm },

  secimSatir: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  secimKart: {
    flex: 1, alignItems: "center", gap: SPACING.xs,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  zorlukListe: { gap: SPACING.sm, marginBottom: SPACING.md },
  zorlukSatir: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
  },
  zorlukSatirAktif: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  zorlukNokta: { flexDirection: "row", gap: 3 },
  nokta: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.cardBorder },
  zorlukEtiket: { ...TYPE.h3, fontSize: 14 },
  zorlukAciklama: { ...TYPE.caption, fontSize: 12, marginTop: 1 },
  secimKartAktif: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  secimText: { ...TYPE.caption, color: COLORS.text, fontWeight: "800", textAlign: "center" },
  secimTextAktif: { color: COLORS.accentDark },
  zorlukNot: { ...TYPE.caption, marginBottom: SPACING.lg },

  siraSerit: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.md, marginBottom: SPACING.md,
  },
  isaretRozet: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    borderColor: COLORS.cardBorder, borderWidth: 1,
  },
  isaretRozetText: { ...TYPE.h3, color: COLORS.textMuted },
  siraText: { ...TYPE.h3, fontSize: 15, flex: 1, textAlign: "center" },

  izgara: { gap: 4 },
  izgaraSatir: { flexDirection: "row", gap: 4 },
  kose: { flex: 1 },
  baslikHucre: {
    flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center",
    gap: 2, paddingHorizontal: 2,
  },
  kosulDaire: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.card, borderColor: COLORS.cta, borderWidth: 2,
  },
  baslikText: { ...TYPE.caption, fontSize: 12, lineHeight: 16, textAlign: "center", color: COLORS.textMuted },
  hucre: {
    flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.sm, padding: 2,
  },
  hucreSecili: { borderColor: VURGU.main },
  hucreCalinabilir: { borderStyle: "dashed", borderColor: COLORS.cta },
  calmaSatir: { textAlign: "center", fontSize: 12, fontWeight: "700", color: COLORS.textMuted, marginTop: 4 },
  hucreX: { backgroundColor: "#173A22", borderColor: COLORS.accent },
  hucreO: { backgroundColor: "#3D2600", borderColor: COLORS.cta },
  hucreKazanan: { borderWidth: 3, borderColor: VURGU.main },
  hucreTukendi: { opacity: 0.4 },
  hucreIsaret: { ...TYPE.h2, color: COLORS.accent },
  hucreAd: { ...TYPE.caption, fontSize: 12, textAlign: "center", color: COLORS.textMuted },

  sonucKart: {
    backgroundColor: COLORS.card, borderColor: VURGU.main, borderWidth: 2,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.lg, alignItems: "center",
  },
  sonucBaslik: { ...TYPE.h2, textAlign: "center" },
  sonucAlt: { ...TYPE.caption, marginTop: SPACING.xs },
  sonucBtnSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.lg, marginTop: SPACING.md },

  sureSatir: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.sm },
  sureCip: {
    flexGrow: 1, minWidth: 56, alignItems: "center",
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm,
  },
  sureCipText: { ...TYPE.caption, color: COLORS.text, fontWeight: "800" },
  ozelSureSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  ozelSureGirdi: {
    width: 90, backgroundColor: COLORS.card, borderColor: COLORS.accent, borderWidth: 2,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    color: COLORS.text, fontSize: 16, fontWeight: "800", textAlign: "center",
  },
  ozelSureBirim: { ...TYPE.bodyMuted },
  sureKutu: { marginTop: -SPACING.sm, marginBottom: SPACING.sm },
  sureYazi: { ...TYPE.caption, textAlign: "center", marginTop: -6, fontWeight: "800", color: COLORS.text },

  cevaplarKutu: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.lg,
  },
  cevaplarBaslikSatir: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: SPACING.xs },
  cevaplarBaslik: { ...TYPE.eyebrow, color: VURGU.main, fontSize: 12 },
  cevapKart: {
    borderTopColor: COLORS.cardBorder, borderTopWidth: 1, paddingVertical: SPACING.sm,
  },
  cevapKartUst: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  cevapKartBaslik: { ...TYPE.h3, fontSize: 13, flex: 1 },
  cevapKartSahip: { ...TYPE.h3, fontSize: 14, color: COLORS.accent },
  cevapVerilen: { ...TYPE.caption, color: COLORS.accent, marginTop: 2, fontWeight: "800" },
  cevapListe: { ...TYPE.caption, color: COLORS.text, marginTop: 2, lineHeight: 17 },

  kullanilanKutu: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.lg,
  },
  kullanilanBaslik: { ...TYPE.caption, fontSize: 12, letterSpacing: 1 },
  kullanilanText: { ...TYPE.caption, color: COLORS.text, marginTop: 2 },

  cevapPaneli: {
    backgroundColor: COLORS.card, borderColor: VURGU.main, borderWidth: 2,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md,
  },
  hedefText: { ...TYPE.h3, fontSize: 14, textAlign: "center" },
  hedefAlt: { ...TYPE.caption, textAlign: "center", marginBottom: SPACING.sm },
  oneriSerit: { marginTop: SPACING.sm },
  oneriCip: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 6, marginRight: SPACING.sm,
  },
  oneriCipText: { ...TYPE.caption, color: COLORS.text, fontWeight: "700" },
  girdiSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  girdi: {
    flex: 1, backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    color: COLORS.text, fontSize: 15,
  },
  mikrofonBtn: {
    width: 48, height: 48, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
  },
  mikrofonBtnAktif: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  sesIpucu: { ...TYPE.caption, textAlign: "center", marginTop: SPACING.sm },
  gonderBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, ...SHADOW.card,
  },
  altBtnSatir: { flexDirection: "row", justifyContent: "space-between", paddingTop: SPACING.sm },
  kucukLink: { ...TYPE.caption, textDecorationLine: "underline" },
  ipucu: { ...TYPE.caption, textAlign: "center", paddingBottom: SPACING.sm },

  // Tam ekran: karartma sadece ortadaki bir kutuyu değil bütün ekranı kaplasın.
  geriBildirimSarmal: { ...StyleSheet.absoluteFillObject },

  anaBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: SPACING.md,
    alignItems: "center", marginTop: SPACING.lg, ...SHADOW.card,
  },
  anaBtnKucuk: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, ...SHADOW.card,
  },
  anaBtnText: { ...TYPE.button, color: COLORS.accentDark },
  ikincilBtn: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  ikincilBtnText: { ...TYPE.caption, textDecorationLine: "underline" },
});
