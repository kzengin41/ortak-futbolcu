import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ModKurulum, { KurulumBolum, SecimCipleri, ZorlukSecici, SureSecici } from "../components/ModKurulum";
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import TeamBadge from "../components/TeamBadge";
import AnswerFeedback from "../components/AnswerFeedback";
import PoolEmpty from "../components/PoolEmpty";
import TimerBar from "../components/TimerBar";
import { recognitionScore } from "../lib/clubWeights";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { buildSuggestIndex, suggestPlayers } from "../lib/gameEngine";
import { useCorrectSound, useWrongSound, useCpuCorrectSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import {
  izgaraUret, baslangicDurumu, aksiyonuIsle, hucreCevaplari, kareTukendiMi,
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

export default function XoxScreen({ onExit, onExitSilent }) {
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const playCpuCorrect = useCpuCorrectSound();

  const [rakipTipi, setRakipTipi] = useState("cpu");   // "cpu" | "iki"
  const [zorluk, setZorluk] = useState(VARSAYILAN_ZORLUK);
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

  const yeniOyun = useCallback(() => {
    setHazirlaniyor(true);
    setUretilemedi(false);
    // Izgara üretimi ilk çağrıda ikili tablosunu kuruyor (~0,1 sn). Bir kare
    // bekletip göstergeyi çizdiriyoruz ki ekran donuk açılmasın.
    setTimeout(() => {
      // 13 Eylül 2026 (Kerem: "gelen takımlar zorluk derecesine göre daha kolay
      // olmalı") — ızgara ARTIK zorluğa göre kuruluyor; eskiden zorluk sadece
      // CPU'yu etkiliyordu, soru her seviyede aynı zorluktaydı.
      const izgara = izgaraUret(PLAYERS, zorluk);
      if (!izgara) { setUretilemedi(true); setHazirlaniyor(false); return; }
      // veriSeti veriliyor: dokuz karenin cevapları bir kez hesaplanıp durumda
      // saklanıyor (bkz. lib/gridGame.js baslangicDurumu).
      setDurum(baslangicDurumu(izgara, X, PLAYERS));
      setGirdi("");
      setGeriBildirim(null);
      setHazirlaniyor(false);
      setBasladi(true);
    }, 40);
  }, [zorluk]);

  // --- CPU sırası ----------------------------------------------------------
  useEffect(() => {
    if (!durum || durum.bitti || !cpuyaKarsi) return;
    if (durum.sira !== O || durum.secili) return;

    setCpuDusunuyor(true);
    zamanlayiciRef.current = setTimeout(() => {
      setCpuDusunuyor(false);
      setDurum((d) => {
        if (!d || d.bitti || d.sira !== O) return d;
        const indis = cpuHucreSec(d, zorluk, Math.random, PLAYERS);
        if (indis === null) return d;
        const satir = Math.floor(indis / 3);
        const sutun = indis % 3;
        const secili = aksiyonuIsle(d, { tip: "hucreSec", satir, sutun }, baglam) || d;
        const ad = cpuCevapSec(secili, satir, sutun, baglam, zorluk);
        const sonraki = ad
          ? aksiyonuIsle(secili, { tip: "cevap", metin: ad }, baglam)
          : aksiyonuIsle(secili, { tip: "pas" }, baglam);
        return sonraki || secili;
      });
    }, 900 + Math.random() * 900);

    return () => { if (zamanlayiciRef.current) clearTimeout(zamanlayiciRef.current); };
  }, [durum, cpuyaKarsi, zorluk, baglam]);

  // --- Hamle süresi ----------------------------------------------------------
  const insanSirasi = !!durum && !durum.bitti && (!cpuyaKarsi || durum.sira === X);
  // Her yeni hamlede (hamleNo değişince) ya da yeni oyunda sayaç baştan başlar.
  useEffect(() => {
    if (!basladi || !insanSirasi) { setKalanSure(null); return; }
    setKalanSure(cevapSuresi);
  }, [basladi, insanSirasi, durum?.hamleNo, durum?.izgara, cevapSuresi]);

  useEffect(() => {
    if (kalanSure === null) return;
    if (kalanSure <= 0) {
      setKalanSure(null);
      setGirdi("");
      setDurum((d) => (d && !d.bitti ? aksiyonuIsle(d, { tip: "sureDoldu" }, baglam) || d : d));
      return;
    }
    const t = setTimeout(() => setKalanSure((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [kalanSure, baglam]);

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
        satir: durum.izgara.satirlar[r],
        sutun: durum.izgara.sutunlar[c],
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
      setGeriBildirim({ anahtar: Date.now() + Math.random(), correct: true, message: cpuHamlesi ? `CPU: ${h.ad}` : h.ad });
    } else if (h.tip === "yanlis") {
      playWrong();
      setGeriBildirim({ anahtar: Date.now() + Math.random(),
        correct: false,
        message: cpuHamlesi ? `CPU bilemedi: ${h.metin}` : "Bu futbolcu bu ikilide oynamadı",
      });
    } else if (h.tip === "pas") {
      setGeriBildirim({ anahtar: Date.now() + Math.random(), correct: false, message: cpuHamlesi ? "CPU pas geçti" : "Pas geçtin" });
    } else if (h.tip === "sure") {
      playWrong();
      setGeriBildirim({ anahtar: Date.now() + Math.random(),
        correct: false,
        message: cpuyaKarsi ? "Süre doldu, sıra CPU'da" : `Süre doldu, sıra ${h.kimden === X ? "2." : "1."} oyuncuda`,
      });
    }
  }, [durum?.sonHamle, cpuyaKarsi, playCorrect, playWrong, playCpuCorrect]);

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
        <KurulumBolum
          baslik="ZORLUK"
          not={cpuyaKarsi
            ? "Zorluk hem ızgaradaki kulüpleri hem CPU'nun ne kadar iyi oynadığını belirler."
            : "Zorluk ızgaradaki kulüpleri ve karelerin ne kadar kolay doldurulacağını belirler."}
        >
          <ZorlukSecici
            seviyeler={ZORLUKLAR.map((z) => ({ id: z.id, etiket: z.etiket, aciklama: z.aciklama }))}
            secili={zorluk}
            onSec={setZorluk}
          />
        </KurulumBolum>
        <KurulumBolum baslik="CEVAP SÜRESİ (HAMLE BAŞINA)">
          <SureSecici
            secenekler={SURE_SECENEKLERI}
            deger={cevapSuresi}
            onDegis={setCevapSuresi}
            asgari={ASGARI_SURE}
            azami={AZAMI_SURE}
            aciklama="Sıra sana geçtiğinde süre başlar. Dolarsa sıra rakibe geçer."
          />
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
    ? (durum.sira === X ? "Sıra sende" : cpuDusunuyor ? "CPU düşünüyor..." : "CPU oynuyor")
    : (durum.sira === X ? "1. Oyuncu (X)" : "2. Oyuncu (O)");

  return (
    <GameBackground style={styles.kap}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BackButton onPress={onExitSilent || onExit} />

        <ScrollView
          contentContainerStyle={{ paddingBottom: SPACING.xl }}
          keyboardShouldPersistTaps="handled"
          // iOS'ta klavye açılınca içeriği kendiliğinden yukarı iter; panel
          // zaten üstte ama uzun ızgaralarda bu da işe yarıyor.
          automaticallyAdjustKeyboardInsets
        >
          {!secili && !durum.bitti && benimSiram && (
            <Text style={styles.ipucu}>Almak istediğin kareye dokun</Text>
          )}

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
                {durum.izgara.satirlar[secili.satir]} + {durum.izgara.sutunlar[secili.sutun]}
              </Text>
              <Text style={styles.hedefAlt}>{seciliCevapSayisi} olası cevap</Text>

              <View style={styles.girdiSatir}>
                <TextInput
                  style={styles.girdi}
                  placeholder="Futbolcu adı yaz..."
                  placeholderTextColor={COLORS.textFaint}
                  value={girdi}
                  onChangeText={setGirdi}
                  onSubmitEditing={() => cevapGonder()}
                  returnKeyType="send"
                  autoCorrect={false}
                  autoFocus
                />
                <SoundPressable style={styles.gonderBtn} onPress={() => cevapGonder()}>
                  <Ionicons name="send" size={18} color={COLORS.accentDark} />
                </SoundPressable>
              </View>

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
                  <TeamBadge name={k} size={logoBoyut} />
                  <Text style={styles.baslikText} numberOfLines={2}>{k}</Text>
                </View>
              ))}
            </View>

            {durum.izgara.satirlar.map((satirKulup, r) => (
              <View key={satirKulup} style={styles.izgaraSatir}>
                <View style={styles.baslikHucre}>
                  <TeamBadge name={satirKulup} size={logoBoyut} />
                  <Text style={styles.baslikText} numberOfLines={2}>{satirKulup}</Text>
                </View>
                {durum.izgara.sutunlar.map((_, c) => {
                  const indis = r * 3 + c;
                  const sahip = durum.tahta[indis];
                  const sahipBilgi = durum.hucreSahipleri[`${r}-${c}`];
                  const seciliMi = secili?.satir === r && secili?.sutun === c;
                  const kazananDa = durum.kazananCizgi?.includes(indis);
                  const tukendi = !sahip && kareTukendiMi(durum, r, c, PLAYERS);
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
                      ]}
                      onPress={() => hucreyeDokun(r, c)}
                    >
                      {sahip ? (
                        <>
                          <Text style={[styles.hucreIsaret, sahip === O && { color: COLORS.cta }]}>
                            {sahip === X ? "X" : "O"}
                          </Text>
                          <Text style={styles.hucreAd} numberOfLines={2}>{sahipBilgi?.ad}</Text>
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
          {durum.bitti && (
            <View style={styles.sonucKart}>
              <Text style={styles.sonucBaslik}>{sonucMetni(durum, cpuyaKarsi)}</Text>
              <Text style={styles.sonucAlt}>
                {durum.kullanilanlar.length} doğru cevap
              </Text>
              <View style={styles.sonucBtnSatir}>
                <SoundPressable style={styles.anaBtnKucuk} onPress={yeniOyun}>
                  <Text style={styles.anaBtnText}>YENİ IZGARA</Text>
                </SoundPressable>
                <SoundPressable style={styles.ikincilBtn} onPress={() => setBasladi(false)}>
                  <Text style={styles.ikincilBtnText}>Ayarlar</Text>
                </SoundPressable>
              </View>
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
        </ScrollView>

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
      </KeyboardAvoidingView>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, padding: SPACING.lg, paddingTop: SPACING.xxl },

  ustBaslik: { ...TYPE.h1, textAlign: "center", marginTop: SPACING.md },
  aciklama: { ...TYPE.bodyMuted, textAlign: "center", marginTop: SPACING.sm, marginBottom: SPACING.xl },
  blokBaslik: { ...TYPE.eyebrow, color: VURGU.main, fontSize: 11, marginBottom: SPACING.sm },

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
  zorlukAciklama: { ...TYPE.caption, fontSize: 11, marginTop: 1 },
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
  baslikText: { ...TYPE.caption, fontSize: 10, lineHeight: 12, textAlign: "center", color: COLORS.textMuted },
  hucre: {
    flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.sm, padding: 2,
  },
  hucreSecili: { borderColor: VURGU.main },
  hucreX: { backgroundColor: "#173A22", borderColor: COLORS.accent },
  hucreO: { backgroundColor: "#3D2600", borderColor: COLORS.cta },
  hucreKazanan: { borderWidth: 3, borderColor: VURGU.main },
  hucreTukendi: { opacity: 0.4 },
  hucreIsaret: { ...TYPE.h2, color: COLORS.accent },
  hucreAd: { ...TYPE.caption, fontSize: 8, textAlign: "center", color: COLORS.textMuted },

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
  cevaplarBaslik: { ...TYPE.eyebrow, color: VURGU.main, fontSize: 11 },
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
  kullanilanBaslik: { ...TYPE.caption, fontSize: 9, letterSpacing: 1 },
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
