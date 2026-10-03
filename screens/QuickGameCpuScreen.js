import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioPlayer } from "expo-audio";
import ModKurulum, { KurulumBolum, ZorlukSecici, SureSecici, KapsamDugmesi } from "../components/ModKurulum";
import { useModVarsayilanlari, useKurulumKapisi, oyunBilgisiniYaz, ayarSatirlari, MOD_TANIMLARI } from "../lib/modAyarlari";
import { COLORS, MODE_COLORS, SPACING, RADIUS } from "../lib/theme";
import GameBackground from "../components/GameBackground";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import { useAppSettings } from "../lib/SettingsContext";
import { soruUret, havuzOnbellegi, seviyeGuncelle, carpan, BASLANGIC_SURESI, DOGRU_BONUSU } from "../lib/coktanSecmeli";
import { countryTr } from "../lib/countryNamesTr";
import { flagForCountry } from "../lib/countryFlags";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP } from "../lib/profile";
import ReportModal from "../components/ReportModal";
import CountdownOverlay from "../components/CountdownOverlay";
import TeamBadge from "../components/TeamBadge";
import PlayerPhoto, { prefetchPlayerPhoto } from "../components/PlayerPhoto";
import EslesmeProfiliPenceresi from "../components/EslesmeProfiliPenceresi";
import SoundPressable from "../components/SoundPressable";
import TimerBar from "../components/TimerBar";
import MacSonuKarti from "../components/MacSonuKarti";

const count3Source = require("../assets/sounds/count-3.mp3");
const count2Source = require("../assets/sounds/count-2.mp3");
const count1Source = require("../assets/sounds/count-1.mp3");

// ============================================================================
// ÇOKTAN SEÇMELİ (eski "Hızlı Antrenman") — 4 Ekim 2026, baştan yazıldı
//
// Benchmark kararı: "60 sn varsayılan (değiştirilebilir), doğru +2 sn, seri
// çarpanı ×2/×3, soru çeşitleri, tek çıkış butonu, tema renkleri, kurulumsuz
// başlangıç, kendiliğinden ayarlanan zorluk." Artık Ortak Kulüp'ün bir türü
// (kurulumda "Çoktan seçmeli"), Tüm Modlar'da ayrı kartı yok.
//  • Tek saat: 60 sn (30/60/90/120). Her doğru +2 sn. Yanlışın süre cezası yok
//    ama seri sıfırlanır.
//  • Puan: doğru başına 1 × seri çarpanı (3 doğru → ×2, 6 doğru → ×3).
//  • Dört soru türü (lib/coktanSecmeli.js). Zorluk kendiliğinden: art arda 3
//    doğru → seviye +1, art arda 2 yanlış → −1.
//  • Rekor AsyncStorage'da; bitişte maç sonu kartı (Paylaş + Tekrar).
// ============================================================================
const REKOR = "coktan-secmeli-rekor";

export default function QuickGameCpuScreen({ onExit, onExitSilent }) {
  const [difficulty, setDifficulty] = useState(5);
  const [oyunSuresi, setOyunSuresi] = useState(BASLANGIC_SURESI);
  const eslesme = useEslesmeProfili();
  const { loaded: ayarlarYuklendi } = useAppSettings();
  const [profilAcik, setProfilAcik] = useState(false);
  const [started, setStarted] = useState(false);

  const [phase, setPhase] = useState("countdown"); // countdown | oyun | bitti
  const [soru, setSoru] = useState(null);
  const [secilen, setSecilen] = useState(null);
  const [kalan, setKalan] = useState(BASLANGIC_SURESI);
  const [puan, setPuan] = useState(0);
  const [seri, setSeri] = useState(0);
  const [enUzunSeri, setEnUzunSeri] = useState(0);
  const [dogruSayisi, setDogruSayisi] = useState(0);
  const [soruSayisi, setSoruSayisi] = useState(0);
  const [yanlisSerisi, setYanlisSerisi] = useState(0);
  const [seviye, setSeviye] = useState(5);
  const [kareler, setKareler] = useState([]);
  const [rekor, setRekor] = useState(0);
  const [yeniRekor, setYeniRekor] = useState(false);
  const [bonus, setBonus] = useState(null); // "+2 sn ×2"
  const [showReport, setShowReport] = useState(false);
  const kullanilan = useRef(new Set());
  const bonusAnim = useRef(new Animated.Value(0)).current;

  const toplamSure = oyunSuresi >= 20 ? oyunSuresi : BASLANGIC_SURESI; // eski 4–10 sn kayıtları
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const countPlayer3 = useAudioPlayer(count3Source);
  const countPlayer2 = useAudioPlayer(count2Source);
  const countPlayer1 = useAudioPlayer(count1Source);
  const havuz = useMemo(() => havuzOnbellegi(eslesme.derlenmis), [eslesme.derlenmis]);
  const presetLabel = eslesme.derlenmis.etiket;

  useEffect(() => {
    AsyncStorage.getItem(REKOR).then((v) => v && setRekor(Number(v) || 0)).catch(() => {});
  }, []);

  const yeniSoru = useCallback((sev) => {
    const s = soruUret(havuz, sev, kullanilan.current);
    if (s) {
      kullanilan.current.add(s.key);
      if (s.siklar[0]?.tip === "oyuncu") s.siklar.forEach((x) => prefetchPlayerPhoto(x.ad));
      else if (s.ust.oyuncu) prefetchPlayerPhoto(s.ust.oyuncu);
    }
    setSoru(s);
    setSecilen(null);
  }, [havuz]);

  function oyunuBaslat() {
    kullanilan.current = new Set();
    setPuan(0); setSeri(0); setEnUzunSeri(0); setDogruSayisi(0); setSoruSayisi(0); setYanlisSerisi(0);
    setKareler([]); setYeniRekor(false); setBonus(null);
    setSeviye(difficulty);
    setKalan(toplamSure);
    setPhase("countdown");
    yeniSoru(difficulty);
    setStarted(true);
  }

  // Saat
  useEffect(() => {
    if (phase !== "oyun") return;
    if (kalan <= 0) { bitir(); return; }
    const t = setTimeout(() => setKalan((k) => k - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, kalan]);

  function bitir() {
    setPhase("bitti");
    const yeni = puan > rekor;
    setYeniRekor(yeni);
    if (yeni) { setRekor(puan); AsyncStorage.setItem(REKOR, String(puan)).catch(() => {}); }
    Promise.resolve(addXP(Math.min(150, 10 * dogruSayisi))).catch(() => {});
  }

  function sec(sik) {
    if (phase !== "oyun" || !soru || secilen) return;
    const dogru = sik.ad === soru.dogru;
    setSecilen(sik.ad);
    setSoruSayisi((n) => n + 1);
    recordRound("quickCpu", dogru);
    let yeniSeviye = seviye;
    if (dogru) {
      const s = seri + 1;
      const c = carpan(s);
      setSeri(s);
      setEnUzunSeri((e) => Math.max(e, s));
      setPuan((p) => p + c);
      setDogruSayisi((d) => d + 1);
      setYanlisSerisi(0);
      setKalan((k) => k + DOGRU_BONUSU);
      setKareler((l) => [...l, "sen"]);
      setBonus(`+${DOGRU_BONUSU} sn${c > 1 ? `  ×${c}` : ""}`);
      bonusAnim.setValue(0);
      Animated.timing(bonusAnim, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      if (soru.acilacak) unlockPlayer(soru.acilacak);
      playCorrect();
      yeniSeviye = seviyeGuncelle(seviye, s, 0);
    } else {
      const y = yanlisSerisi + 1;
      setSeri(0);
      setYanlisSerisi(y);
      setKareler((l) => [...l, "rakip"]);
      setBonus(null);
      playWrong();
      yeniSeviye = seviyeGuncelle(seviye, 0, y);
      if (yeniSeviye !== seviye) setYanlisSerisi(0);
    }
    setSeviye(yeniSeviye);
    setTimeout(() => yeniSoru(yeniSeviye), dogru ? 450 : 1100);
  }

  // ------------------------------------------------------------------ ayarlar
  const modVarsayilanKaydet = useModVarsayilanlari("quickCpu", { zorluk: setDifficulty, sure: setOyunSuresi });
  useKurulumKapisi("quickCpu", {
    hazir: ayarlarYuklendi,
    kurulumda: !started,
    baslat: () => oyunuBaslat(),
    kurulumaDon: () => { setStarted(false); setPhase("countdown"); },
  });
  useEffect(() => {
    oyunBilgisiniYaz("quickCpu", {
      satirlar: ayarSatirlari({ zorluk: difficulty, sure: toplamSure, lig: presetLabel, ekstra: [["Doğru cevap", `+${DOGRU_BONUSU} sn`], ["Seri çarpanı", "3 doğru ×2 · 6 doğru ×3"], ["Zorluk", "oynadıkça kendiliğinden ayarlanır"]] }),
    });
  }, [difficulty, toplamSure, presetLabel]);

  // ================================================================== KURULUM
  if (!started) {
    return (
      <ModKurulum
        baslik="Çoktan Seçmeli"
        aciklama={`Süre ${toplamSure} sn. Her doğru +${DOGRU_BONUSU} sn ve puan; art arda doğrular çarpanı ×2, ×3'e çıkarır. Sorular kolaydan başlar, sen bildikçe zorlaşır.`}
        vurgu={MODE_COLORS.training}
        onGeri={onExitSilent || onExit}
        onVarsayilanKaydet={() => modVarsayilanKaydet({ zorluk: difficulty, sure: toplamSure })}
        onBasla={oyunuBaslat}
      >
        <KurulumBolum baslik="BAŞLANGIÇ ZORLUĞU" not="Oyun sırasında kendiliğinden ayarlanır.">
          <ZorlukSecici deger={difficulty} onDegis={setDifficulty} aciklama={(z) => (z <= 3 ? "Ünlü isimlerle başlar." : z <= 7 ? "Bilinen oyuncularla başlar." : "Az bilinenlerle başlar.")} />
        </KurulumBolum>
        <KurulumBolum baslik={MOD_TANIMLARI.quickCpu.sure.etiket}>
          <SureSecici
            secenekler={MOD_TANIMLARI.quickCpu.sure.secenekler}
            deger={toplamSure}
            onDegis={setOyunSuresi}
            asgari={MOD_TANIMLARI.quickCpu.sure.asgari}
            azami={MOD_TANIMLARI.quickCpu.sure.azami}
            aciklama={MOD_TANIMLARI.quickCpu.sure.aciklama}
          />
        </KurulumBolum>
        <KurulumBolum baslik="EŞLEŞME PROFİLİ">
          <KapsamDugmesi etiket={presetLabel} onPress={() => setProfilAcik(true)} />
        </KurulumBolum>
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

  // ================================================================== OYUN
  const c = carpan(seri);
  return (
    <GameBackground style={s.kap}>
      {showReport && <ReportModal visible={showReport} onClose={() => setShowReport(false)} playerContext={soru?.dogru || "Bilinmiyor"} />}
      <View style={s.ust}>
        <SoundPressable onPress={() => setShowReport(true)} hitSlop={20}>
          <View style={s.bildir}>
            <Ionicons name="flag" size={13} color={COLORS.cta} />
            <Text style={s.bildirYazi}>BİLDİR</Text>
          </View>
        </SoundPressable>
        {/* Tek çıkış düğmesi */}
        <SoundPressable onPress={phase === "bitti" ? (onExitSilent || onExit) : onExit} hitSlop={20} accessibilityLabel="Çık">
          <View style={s.kapat}><Ionicons name="close" size={22} color={COLORS.danger} /></View>
        </SoundPressable>
      </View>

      {phase === "countdown" && (
        <CountdownOverlay onComplete={() => setPhase("oyun")} countPlayers={[countPlayer3, countPlayer2, countPlayer1]} />
      )}

      {phase !== "bitti" && (
        <>
          <View style={s.panel}>
            <View>
              <Text style={s.panelEtiket}>PUAN</Text>
              <Text style={s.panelSayi}>{puan}</Text>
            </View>
            <View style={[s.carpanHap, c > 1 && { backgroundColor: COLORS.cta, borderColor: COLORS.cta }]}>
              <Ionicons name="flame" size={14} color={c > 1 ? COLORS.ctaDark : COLORS.textMuted} />
              <Text style={[s.carpanYazi, c > 1 && { color: COLORS.ctaDark }]}>{c > 1 ? `×${c}` : `seri ${seri}`}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.panelEtiket}>SÜRE</Text>
              <Text style={[s.panelSayi, kalan <= 10 && { color: COLORS.danger }]}>{Math.max(0, kalan)}</Text>
            </View>
          </View>
          <View style={{ marginTop: SPACING.sm }}><TimerBar current={Math.max(0, kalan)} total={Math.max(toplamSure, kalan)} /></View>
          {bonus ? (
            <Animated.Text
              style={[s.bonus, { opacity: bonusAnim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }), transform: [{ translateY: bonusAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) }] }]}
            >
              {bonus}
            </Animated.Text>
          ) : <View style={{ height: 22 }} />}
        </>
      )}

      {phase !== "bitti" && soru ? (
        <View style={{ flex: 1 }}>
          {/* Soru üstü: tür kartı */}
          {soru.ust.a ? (
            <View style={s.ikiliKart}>
              {[soru.ust.a, soru.ust.b].map((x, i) => (
                <React.Fragment key={i}>
                  {i === 1 ? <Text style={s.carpi}>×</Text> : null}
                  <View style={{ flex: 1, alignItems: "center" }}>
                    {x.tip === "ulke" ? <Text style={s.bayrak}>{flagForCountry(x.ad)}</Text> : <TeamBadge name={x.ad} size={46} />}
                    <Text style={s.ikiliAd} numberOfLines={2}>{x.tip === "ulke" ? countryTr(x.ad) : x.ad}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          ) : soru.ust.oyuncu ? (
            <View style={s.tekKart}>
              <PlayerPhoto name={soru.ust.oyuncu} size={64} showProfileOnPress={false} />
            </View>
          ) : soru.ust.kulup ? (
            <View style={s.tekKart}>
              <TeamBadge name={soru.ust.kulup} size={56} />
              <Text style={s.ikiliAd}>{soru.ust.kulup}</Text>
            </View>
          ) : null}

          <Text style={s.soru}>{soru.soru}</Text>

          <View style={s.siklar}>
            {soru.siklar.map((sik) => {
              const cevaplandi = !!secilen;
              const buDogru = sik.ad === soru.dogru;
              const buSecilen = sik.ad === secilen;
              return (
                <SoundPressable
                  key={sik.ad}
                  disabled={cevaplandi}
                  onPress={() => sec(sik)}
                  style={[s.sik, cevaplandi && buDogru && s.sikDogru, cevaplandi && buSecilen && !buDogru && s.sikYanlis]}
                >
                  {sik.tip === "oyuncu" ? <PlayerPhoto name={sik.ad} size={34} showProfileOnPress={false} /> : <TeamBadge name={sik.ad} size={30} />}
                  <Text style={s.sikYazi} numberOfLines={2}>{sik.ad}</Text>
                  {cevaplandi && buDogru ? <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} /> : null}
                  {cevaplandi && buSecilen && !buDogru ? <Ionicons name="close-circle" size={20} color={COLORS.danger} /> : null}
                </SoundPressable>
              );
            })}
          </View>
          <Text style={s.seviye}>Seviye {seviye} · {soruSayisi} soru</Text>
        </View>
      ) : null}

      {phase !== "bitti" && !soru ? (
        <Text style={s.soru}>Bu ayarlarla yeni soru üretilemedi. Eşleşme profilini genişletmeyi dene.</Text>
      ) : null}

      {phase === "bitti" && (
        <MacSonuKarti
          modAdi="Çoktan Seçmeli"
          modeId="quickCpu"
          turlar={kareler}
          solo={{
            puan,
            rekor,
            yeniRekor,
            satirlar: [
              ["Doğru", `${dogruSayisi} / ${soruSayisi}`],
              ["En uzun seri", String(enUzunSeri)],
              ["Ulaştığın seviye", `${seviye} / 10`],
            ],
          }}
          kazanilanXp={Math.min(150, 10 * dogruSayisi)}
          rovansEtiketi="TEKRAR"
          onRovans={oyunuBaslat}
          onMenu={onExitSilent || onExit}
        />
      )}
    </GameBackground>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg, padding: 20, paddingBottom: 40 },
  ust: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 6, marginBottom: 10 },
  bildir: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,100,100,0.2)", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12 },
  bildirYazi: { color: COLORS.cta, fontSize: 12, fontWeight: "800" },
  kapat: { backgroundColor: "rgba(255,93,93,0.15)", borderRadius: 16, padding: 6 },

  panel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  panelEtiket: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, color: COLORS.textMuted },
  panelSayi: { fontSize: 34, fontWeight: "900", color: COLORS.text, lineHeight: 38 },
  carpanHap: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  carpanYazi: { fontSize: 15, fontWeight: "900", color: COLORS.textMuted },
  bonus: { height: 22, textAlign: "center", fontSize: 16, fontWeight: "900", color: COLORS.accent, marginTop: 2 },

  ikiliKart: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 18, padding: 14 },
  carpi: { color: MODE_COLORS.training.main, fontSize: 20, fontWeight: "900", marginHorizontal: 8 },
  bayrak: { fontSize: 42 },
  ikiliAd: { color: COLORS.text, fontSize: 13, fontWeight: "900", textAlign: "center", marginTop: 6 },
  tekKart: { alignItems: "center", backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 18, padding: 14, gap: 4 },
  soru: { color: COLORS.text, fontSize: 18, fontWeight: "900", textAlign: "center", marginTop: SPACING.md, lineHeight: 24 },
  siklar: { marginTop: SPACING.md, gap: 10 },
  sik: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1.5, borderRadius: 14,
  },
  sikDogru: { borderColor: COLORS.accent, backgroundColor: "rgba(124,255,92,0.12)" },
  sikYanlis: { borderColor: COLORS.danger, backgroundColor: "rgba(255,93,93,0.12)" },
  sikYazi: { flex: 1, color: COLORS.text, fontSize: 15, fontWeight: "800" },
  seviye: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: SPACING.md },
});
