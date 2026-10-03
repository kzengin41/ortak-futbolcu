import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { KlavyeAlani } from "../components/Klavye";
import SoundPressable from "../components/SoundPressable";
import AnswerFeedback from "../components/AnswerFeedback";
import PlayerPhoto from "../components/PlayerPhoto";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { buildSuggestIndex, suggestPlayers } from "../lib/gameEngine";
import { calculatePlayerPopularity } from "../lib/clubWeights";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import { useOnlineRoom, rovansli } from "../lib/onlineRoom";
import OnlineMacSonu from "../components/OnlineMacSonu";
import {
  baslangicDurumu, aksiyonuIsle, kurHarfHaritasi, ALFABE,
  HEDEF_PUAN, TUR_ARASI_MS, HARF_GOSTERIM_MS,
} from "../lib/onlineLetter";

// ============================================================================
// ONLINE — İLK HARFTEN BUL (12 Eylül 2026'da yeniden yazıldı)
//
// Eski hali çalışıyordu ama üç ciddi kusuru vardı (ayrıntı lib/onlineLetter.js
// başlığında): tek harfle sömürülebilen cevap kontrolü, bayat closure yüzünden
// bazen hiç başlamayan oyun ve "aynı futbolcu iki kez kabul edilmez" sözünün
// hiç uygulanmaması. Ayrıca renkleri elle yazılmıştı, projenin tema
// katmanına (lib/theme) hiç bağlı değildi.
//
// İki çeşidi aynı ekran karşılıyor:
//   gameMode "letter"  -> harfleri host rastgele belirler
//   gameMode "letter2" -> oyuncular sırayla birer harf seçer
// ============================================================================

const VURGU = MODE_COLORS.letters;
// 7 harflik eşik BİLEREK yüksek — bkz. LetterCpuScreen'deki uzun not
// (Kerem: "bilerek harf sınırını 7 yapmıştık"). Düşük eşikte öneri listesi
// cevabı ele veriyor; bu modda amaç harfe uyan ismi BULMAK.
const ONERI_ESIGI = 7;

export default function OnlineLetterScreen({ room, onExit }) {
  const benKimim = room.playerNumber;
  const cesit = room.gameMode === "letter" ? "letter" : "letter2";
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();

  // Harf haritası popülerliğe göre sıralı bir alt kümeden kuruluyor: hem
  // "kim bu" dedirtmeyen isimler geliyor, hem de harita küçük kalıyor.
  const harita = useMemo(() => {
    const veri = [...PLAYERS]
      .sort((a, b) => calculatePlayerPopularity(b) - calculatePlayerPopularity(a))
      .slice(0, 8000);
    return kurHarfHaritasi(veri);
  }, []);
  const baglamRef = useRef({ harita });
  useEffect(() => { baglamRef.current = { harita }; }, [harita]);

  const aksiyonIsle = useCallback(
    // 5 Ekim 2026 — rövanş iki taraftan tek dokunuş (lib/onlineRoom.js rovansli)
    rovansli((durum, aksiyon, kimden) => aksiyonuIsle(durum, aksiyon, kimden, baglamRef.current)),
    []
  );

  const ilkDurum = useMemo(() => baslangicDurumu(cesit, 1), [cesit]);
  const { durum, hostMuyum, rakipVar, senkronBekliyor, gonder, guncelle } = useOnlineRoom({
    kanalAdi: `letter-${room.id}`,
    benKimim,
    baslangicDurumu: ilkDurum,
    aksiyonIsle,
  });

  const [girdi, setGirdi] = useState("");
  const [geriBildirim, setGeriBildirim] = useState(null);
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(
    () => (girdi.trim().length < ONERI_ESIGI ? [] : suggestPlayers(suggestIndex, girdi)),
    [suggestIndex, girdi]
  );

  const faz = durum?.faz;
  const benSecenim = durum?.secen === benKimim;

  // --- Host: "letter" çeşidinde rakip gelince harfleri at ------------------
  useEffect(() => {
    if (!hostMuyum || faz !== "hazirlik" || !rakipVar) return;
    gonder({ tip: "rastgeleHarfler" });
  }, [hostMuyum, faz, rakipVar, gonder]);

  // --- Host: harfleri kısa süre göster, sonra yarışı başlat ---------------
  useEffect(() => {
    if (!hostMuyum || faz !== "harfler") return;
    const t = setTimeout(
      () => guncelle((d) => aksiyonuIsle(d, { tip: "yarisBasla" }, 1, baglamRef.current)),
      HARF_GOSTERIM_MS
    );
    return () => clearTimeout(t);
  }, [hostMuyum, faz, durum?.turNo, guncelle]);

  // --- Host: tur sonu -> sıradaki tur --------------------------------------
  useEffect(() => {
    if (!hostMuyum || faz !== "turSonu") return;
    const t = setTimeout(
      () => guncelle((d) => aksiyonuIsle(d, { tip: "sonrakiTur" }, 1, baglamRef.current)),
      TUR_ARASI_MS
    );
    return () => clearTimeout(t);
  }, [hostMuyum, faz, durum?.turNo, guncelle]);

  // --- Ses + istatistik ----------------------------------------------------
  const islenenTurRef = useRef(-1);
  useEffect(() => {
    if (faz !== "turSonu" && faz !== "macSonu") return;
    if (islenenTurRef.current === durum.turNo) return;
    islenenTurRef.current = durum.turNo;
    if (!durum.turKazanani) return;
    const kazandimMi = durum.turKazanani === benKimim;
    if (kazandimMi) playCorrect(); else playWrong();
    // 26 Eylül 2026 (Kerem: "cpu'nun söyledikleri hiçbir modda ansiklopediyi açmasın. kendi söylediklerimiz açsın.")
    // sonCevap.kimden cevabı kimin verdiğini tutuyor — sadece benimse aç.
    if (durum.sonCevap?.ad && durum.sonCevap.kimden === benKimim) unlockPlayer(durum.sonCevap.ad);
    recordRound("onlineLetter", kazandimMi);
  }, [faz, durum?.turNo, durum?.turKazanani, benKimim, playCorrect, playWrong, durum?.sonCevap]);

  const macIslendiRef = useRef(false);
  useEffect(() => {
    if (faz !== "macSonu") { if (durum?.turNo === 1) macIslendiRef.current = false; return; }
    if (macIslendiRef.current) return;
    macIslendiRef.current = true;
    const benim = benKimim === 1 ? durum.skorlar.p1 : durum.skorlar.p2;
    const rkp = benKimim === 1 ? durum.skorlar.p2 : durum.skorlar.p1;
    addXP(benim > rkp ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI);
  }, [faz, benKimim, durum?.skorlar, durum?.turNo]);

  useEffect(() => { setGirdi(""); setGeriBildirim(null); }, [durum?.turNo]);

  // Yanlış / tekrar eden cevap uyarısı
  useEffect(() => {
    const c = durum?.sonCevap;
    if (!c || c.dogru) return;
    const benMi = c.kimden === benKimim;
    setGeriBildirim({
      correct: false,
      message: c.tekrar
        ? `${c.ad} bu maçta zaten söylendi`
        : benMi
        ? "Bu isim harflere uymuyor"
        : `Rakip bilemedi: ${c.metin}`,
    });
  }, [durum?.sonCevap, benKimim]);

  // Seçim reddedildi (aynı ikili ya da yeterli cevabı olmayan ikili)
  const reddedildi = durum?.secimReddedildi || 0;
  useEffect(() => {
    if (!reddedildi || !benSecenim) return;
    setGeriBildirim({ correct: false, message: "Bu harf ikilisi olmaz, başka bir harf seç" });
  }, [reddedildi, benSecenim]);

  function cevapGonder(ad) {
    const temiz = String(ad ?? girdi).trim();
    if (!temiz || faz !== "yaris") return;
    setGirdi("");
    gonder({ tip: "cevap", metin: temiz });
  }

  // ---------------------------------------------------------------- ekranlar
  if (!durum) {
    return (
      <GameBackground style={styles.merkez}>
        {senkronBekliyor && <ActivityIndicator color={VURGU.main} />}
        <Text style={styles.bekleme}>
          {senkronBekliyor
            ? "Odaya bağlanılıyor..."
            : "Ev sahibine ulaşılamadı. Bağlantını kontrol edip tekrar dene."}
        </Text>
        <SoundPressable onPress={onExit} style={styles.ikincilBtn}>
          <Text style={styles.ikincilBtnText}>Lobiye dön</Text>
        </SoundPressable>
      </GameBackground>
    );
  }

  if (faz === "hazirlik") {
    return (
      <GameBackground style={styles.merkez}>
        <ActivityIndicator color={VURGU.main} />
        <Text style={styles.bekleme}>{rakipVar ? "Harfler atanıyor..." : "Rakip bekleniyor..."}</Text>
        {room.code ? <Text style={styles.odaKodu}>{room.code}</Text> : null}
        <SoundPressable onPress={onExit} style={styles.ikincilBtn}>
          <Text style={styles.ikincilBtnText}>Lobiye dön</Text>
        </SoundPressable>
      </GameBackground>
    );
  }

  const benimSkor = benKimim === 1 ? durum.skorlar.p1 : durum.skorlar.p2;
  const rakipSkor = benKimim === 1 ? durum.skorlar.p2 : durum.skorlar.p1;
  const kacinciHarf = durum.harfP1 ? 2 : 1;

  return (
    <GameBackground style={styles.kap}>
      <KlavyeAlani style={{ flex: 1 }}>
        <View style={styles.ustSerit}>
          <View style={styles.skorKutu}>
            <Text style={styles.skorEtiket}>SEN</Text>
            <Text style={styles.skorDeger}>{benimSkor}</Text>
          </View>
          <View style={styles.turKutu}>
            <Text style={styles.turEtiket}>TUR {durum.turNo}</Text>
            <Text style={styles.hedefEtiket}>{HEDEF_PUAN} puana ilk ulaşan kazanır</Text>
            {!rakipVar && <Text style={styles.kopukEtiket}>rakip bağlı değil</Text>}
          </View>
          <View style={styles.skorKutu}>
            <Text style={styles.skorEtiket}>RAKİP</Text>
            <Text style={styles.skorDeger}>{rakipSkor}</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: SPACING.xl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* --- HARF SEÇİMİ (sadece letter2) --- */}
          {faz === "secim" && (
            <View style={{ alignItems: "center" }}>
              {benSecenim ? (
                <>
                  <Text style={styles.buyukBaslik}>
                    {kacinciHarf}. harfi sen seç
                  </Text>
                  <Text style={styles.aciklama}>
                    {durum.harfP1
                      ? `İlk harf ${durum.harfP1}. İkinciyi sen belirliyorsun.`
                      : "İki harf de belirlenince yarış başlayacak."}
                  </Text>
                  <View style={styles.klavye}>
                    {ALFABE.map((h) => (
                      <SoundPressable
                        key={h}
                        style={styles.harfTus}
                        onPress={() => gonder({ tip: "harfSec", harf: h })}
                      >
                        <Text style={styles.harfTusText}>{h}</Text>
                      </SoundPressable>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <ActivityIndicator color={VURGU.main} />
                  <Text style={styles.buyukBaslik}>Rakip harf seçiyor</Text>
                  {durum.harfP1 ? (
                    <Text style={styles.aciklama}>İlk harf: {durum.harfP1}</Text>
                  ) : null}
                </>
              )}
            </View>
          )}

          {/* --- HARFLER / YARIŞ --- */}
          {(faz === "harfler" || faz === "yaris" || faz === "turSonu" || faz === "macSonu") && (
            <View style={styles.harfKart}>
              <View style={styles.harfKutu}>
                <Text style={styles.harfEtiket}>AD</Text>
                <Text style={styles.harfDeger}>{durum.harfP1}</Text>
              </View>
              <Text style={styles.arti}>+</Text>
              <View style={styles.harfKutu}>
                <Text style={styles.harfEtiket}>SOYAD</Text>
                <Text style={styles.harfDeger}>{durum.harfP2}</Text>
              </View>
            </View>
          )}

          {faz === "harfler" && <Text style={styles.aciklama}>Hazır ol...</Text>}
          {faz === "yaris" && (
            <Text style={styles.aciklama}>
              Adı {durum.harfP1}, soyadı {durum.harfP2} ile başlayan bir futbolcu
              (ya da tersi) — ilk yazan puanı alır
            </Text>
          )}

          {/* --- TUR / MAÇ SONU --- */}
          {(faz === "turSonu" || faz === "macSonu") && (
            <View style={styles.sonucKart}>
              <Text style={styles.sonucBaslik}>
                {durum.turKazanani === benKimim ? "Puan senin!" : "Puan rakibin"}
              </Text>
              {durum.sonCevap?.ad ? (
                <>
                  <View style={{ marginVertical: SPACING.md }}>
                    <PlayerPhoto name={durum.sonCevap.ad} size={88} />
                  </View>
                  <Text style={styles.sonucAd}>{durum.sonCevap.ad}</Text>
                </>
              ) : null}
              {faz === "macSonu" ? null : (
                <Text style={styles.bekleme}>Sıradaki tur birazdan...</Text>
              )}
            </View>
          )}
          {faz === "macSonu" && (
            <OnlineMacSonu
              modAdi="Online — İlk Harften Bul"
              durum={durum}
              benKimim={benKimim}
              rakipVar={rakipVar}
              gonder={gonder}
              onExit={onExit}
              skorSen={benimSkor}
              skorRakip={rakipSkor}
              skorEtiketi="puan"
              kazanan={benimSkor > rakipSkor ? "sen" : benimSkor < rakipSkor ? "rakip" : "berabere"}
            />
          )}
        </ScrollView>

        {faz === "yaris" && (
          <View style={styles.altAlan}>
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
          </View>
        )}

        {geriBildirim && (
          <View style={styles.geriBildirimSarmal} pointerEvents="none">
            <AnswerFeedback
              correct={geriBildirim.correct}
              message={geriBildirim.message}
              onDone={() => setGeriBildirim(null)}
            />
          </View>
        )}

        {faz !== "macSonu" && (
          <SoundPressable onPress={onExit} style={styles.cikisBtn}>
            <Text style={styles.cikisText}>Odadan çık</Text>
          </SoundPressable>
        )}
      </KlavyeAlani>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, padding: SPACING.lg, paddingTop: SPACING.xxl },
  merkez: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },

  ustSerit: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.lg },
  skorKutu: {
    flex: 1, alignItems: "center", backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACING.sm,
  },
  skorEtiket: { ...TYPE.caption, fontSize: 12, letterSpacing: 1 },
  skorDeger: { ...TYPE.h1, color: VURGU.main },
  turKutu: { flex: 1.2, alignItems: "center" },
  turEtiket: { ...TYPE.h3, fontSize: 14 },
  hedefEtiket: { ...TYPE.caption, fontSize: 12, textAlign: "center" },
  kopukEtiket: { ...TYPE.caption, fontSize: 12, color: COLORS.danger, marginTop: 2 },

  buyukBaslik: { ...TYPE.h2, marginTop: SPACING.md, textAlign: "center" },
  aciklama: { ...TYPE.caption, textAlign: "center", marginTop: SPACING.xs, marginBottom: SPACING.md },

  klavye: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: SPACING.sm },
  harfTus: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.sm, width: "16%", aspectRatio: 1,
    alignItems: "center", justifyContent: "center",
  },
  harfTusText: { ...TYPE.h3, color: VURGU.main, fontSize: 18 },

  harfKart: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md,
  },
  harfKutu: { alignItems: "center" },
  harfEtiket: { ...TYPE.caption, fontSize: 12, letterSpacing: 1 },
  harfDeger: { fontSize: 48, fontWeight: "900", color: COLORS.text },
  arti: { ...TYPE.h2, color: VURGU.main, marginHorizontal: SPACING.xl },

  sonucKart: {
    backgroundColor: COLORS.card, borderColor: VURGU.main, borderWidth: 2,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.md, alignItems: "center",
  },
  sonucBaslik: { ...TYPE.h2, textAlign: "center" },
  sonucAd: { ...TYPE.h3, color: VURGU.main, textAlign: "center" },
  macSonuText: { ...TYPE.h1, color: COLORS.cta, marginTop: SPACING.md, textAlign: "center" },

  altAlan: { paddingTop: SPACING.sm },
  oneriSerit: { marginBottom: SPACING.sm },
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

  geriBildirimSarmal: { position: "absolute", left: 0, right: 0, top: "38%", alignItems: "center" },

  anaBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md, marginTop: SPACING.md, ...SHADOW.card,
  },
  anaBtnText: { ...TYPE.button, color: COLORS.accentDark },
  ikincilBtn: { marginTop: SPACING.lg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  ikincilBtnText: { ...TYPE.caption, textDecorationLine: "underline" },
  cikisBtn: { alignItems: "center", paddingVertical: SPACING.sm },
  cikisText: { ...TYPE.caption },
  bekleme: { ...TYPE.caption, marginTop: SPACING.md, textAlign: "center" },
  odaKodu: { ...TYPE.h1, color: VURGU.main, marginTop: SPACING.sm, letterSpacing: 4 },
});
