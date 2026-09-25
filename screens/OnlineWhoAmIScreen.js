import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import AnswerFeedback from "../components/AnswerFeedback";
import PlayerPhoto, { prefetchPlayerPhoto } from "../components/PlayerPhoto";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { buildSuggestIndex, suggestPlayers } from "../lib/gameEngine";
import { calculatePlayerPopularity } from "../lib/clubWeights";
import { resolvePlayerPhotoUrl, PLAYER_PHOTO_FILENAME } from "../lib/playerPhotos";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import { useOnlineRoom, benimSkorum, rakipSkoru } from "../lib/onlineRoom";
import {
  baslangicDurumu, aksiyonuIsle,
  IPUCU_ARALIGI_MS, TUR_ARASI_MS, HEDEF_TUR, turPuani,
} from "../lib/onlineWhoAmI";

// ============================================================================
// ONLINE — KİM BU FUTBOLCU? (12 Eylül 2026)
//
// Bu ekran 31 Ağustos'tan beri "Çok Yakında" yazan 20 satırlık bir taslaktı;
// lobide seçilebiliyordu, yani oyuncu oda kurup rakip bekliyor, eşleşiyor ve
// boş bir ekrana düşüyordu (mağaza incelemesinde Guideline 2.1 reddi sebebi).
//
// Mimari: kurallar lib/onlineWhoAmI.js'te SAF fonksiyonlar olarak duruyor
// (Node'da test edilebiliyor), ağ katmanı lib/onlineRoom.js'te. Bu dosya
// SADECE çizim + host'un zamanlayıcıları.
// ============================================================================

// Havuz WhoAmICpuScreen'deki ölçütle aynı: 2+ kulüp ve GÜVENİLİR fotoğraf.
// Fotoğraf son (kesinleştirici) ipucu olduğu için burada şart — ölü bir
// CloudFront adresi turun en net ipucunu boş kutuya çevirirdi.
function guvenilirFotoVar(name) {
  const ham = PLAYER_PHOTO_FILENAME[name];
  const cozulmus = resolvePlayerPhotoUrl(name);
  if (!cozulmus) return false;
  if (!ham) return true;
  if (!/^https?:\/\//i.test(ham)) return false;
  return !/cloudfront/i.test(ham);
}

const VURGU = MODE_COLORS.whoAmI;

export default function OnlineWhoAmIScreen({ room, onExit }) {
  const benKimim = room.playerNumber;
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();

  const havuz = useMemo(
    () =>
      PLAYERS.filter((p) => p.clubs && p.clubs.length >= 2 && guvenilirFotoVar(p.name))
        .sort((a, b) => calculatePlayerPopularity(b) - calculatePlayerPopularity(a)),
    []
  );
  const havuzRef = useRef(havuz);
  useEffect(() => { havuzRef.current = havuz; }, [havuz]);

  const aksiyonIsle = useCallback(
    (durum, aksiyon, kimden) => aksiyonuIsle(durum, aksiyon, kimden, havuzRef.current),
    []
  );

  const ilkDurum = useMemo(() => baslangicDurumu(), []);
  const { durum, hostMuyum, rakipVar, senkronBekliyor, gonder, guncelle } = useOnlineRoom({
    kanalAdi: `whoami-${room.id}`,
    benKimim,
    baslangicDurumu: ilkDurum,
    aksiyonIsle,
  });

  const [girdi, setGirdi] = useState("");
  const [geriBildirim, setGeriBildirim] = useState(null);
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => suggestPlayers(suggestIndex, girdi), [suggestIndex, girdi]);

  const faz = durum?.faz;
  const benKilitli = Boolean(durum?.kilitli?.includes(benKimim));
  const benPas = Boolean(durum?.pasGecenler?.includes(benKimim));

  // --- Host: rakip odaya girince ilk turu başlat ---------------------------
  useEffect(() => {
    if (!hostMuyum || faz !== "hazirlik" || !rakipVar) return;
    gonder({ tip: "baslat" });
  }, [hostMuyum, faz, rakipVar, gonder]);

  // --- Host: ipucu zamanlayıcısı ------------------------------------------
  // `acikIpucu` bağımlılıkta: her ipucu açıldığında sayaç sıfırdan başlar.
  useEffect(() => {
    if (!hostMuyum || faz !== "oynaniyor") return;
    const t = setTimeout(
      () => guncelle((d) => aksiyonuIsle(d, { tip: "ipucuAc" }, 1, havuzRef.current)),
      IPUCU_ARALIGI_MS
    );
    return () => clearTimeout(t);
  }, [hostMuyum, faz, durum?.acikIpucu, durum?.turNo, guncelle]);

  // --- Host: tur sonu -> sıradaki tur --------------------------------------
  useEffect(() => {
    if (!hostMuyum || faz !== "turSonu") return;
    const t = setTimeout(
      () => guncelle((d) => aksiyonuIsle(d, { tip: "sonrakiTur" }, 1, havuzRef.current)),
      TUR_ARASI_MS
    );
    return () => clearTimeout(t);
  }, [hostMuyum, faz, durum?.turNo, guncelle]);

  // --- Fotoğrafı önden indir (son ipucu gelince beklememek için) ----------
  useEffect(() => {
    if (durum?.gizliOyuncu?.name) prefetchPlayerPhoto(durum.gizliOyuncu.name);
  }, [durum?.gizliOyuncu?.name]);

  // --- Ses + istatistik (tur başına BİR KEZ) ------------------------------
  const islenenTurRef = useRef(-1);
  useEffect(() => {
    if (faz !== "turSonu" && faz !== "macSonu") return;
    if (islenenTurRef.current === durum.turNo) return;
    islenenTurRef.current = durum.turNo;

    // turKazanani === 0 nötr bir sonuç: stats.js'in yorumuna göre bu durumda
    // recordRound hiç çağrılmamalı (galibiyet/mağlubiyet olarak sayılmamalı).
    if (durum.turKazanani === 0) return;
    const kazandimMi = durum.turKazanani === benKimim;
    if (kazandimMi) playCorrect(); else playWrong();
    if (durum.gizliOyuncu?.name) unlockPlayer(durum.gizliOyuncu.name);
    recordRound("onlineWhoAmI", kazandimMi);
  }, [faz, durum?.turNo, durum?.turKazanani, benKimim, playCorrect, playWrong, durum?.gizliOyuncu?.name]);

  const macIslendiRef = useRef(false);
  useEffect(() => {
    if (faz !== "macSonu") { if (faz === "oynaniyor" && durum?.turNo === 1) macIslendiRef.current = false; return; }
    if (macIslendiRef.current) return;
    macIslendiRef.current = true;
    const benimTur = benKimim === 1 ? durum.turlar.p1 : durum.turlar.p2;
    const rakipTur = benKimim === 1 ? durum.turlar.p2 : durum.turlar.p1;
    addXP(benimTur > rakipTur ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI);
  }, [faz, benKimim, durum?.turlar, durum?.turNo]);

  // Yeni tur açılınca girdi/geri bildirim temizlensin
  useEffect(() => {
    setGirdi("");
    setGeriBildirim(null);
  }, [durum?.turNo]);

  // Son tahmini (kimin, doğru muydu) geri bildirim olarak göster
  useEffect(() => {
    const t = durum?.sonTahmin;
    if (!t) return;
    setGeriBildirim({
      correct: t.dogru,
      message: t.kimden === benKimim
        ? (t.dogru ? "Doğru!" : "Olmadı — sıradaki ipucunu bekle")
        : (t.dogru ? "Rakip bildi" : `Rakip yanlış bildi: ${t.metin}`),
    });
  }, [durum?.sonTahmin, benKimim]);

  function tahminGonder(metin) {
    const temiz = String(metin ?? girdi).trim();
    if (!temiz || benKilitli || benPas || faz !== "oynaniyor") return;
    setGirdi("");
    gonder({ tip: "tahmin", metin: temiz });
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
        <Text style={styles.bekleme}>{rakipVar ? "Oyun başlıyor..." : "Rakip bekleniyor..."}</Text>
        {room.code ? <Text style={styles.odaKodu}>{room.code}</Text> : null}
        <SoundPressable onPress={onExit} style={styles.ikincilBtn}>
          <Text style={styles.ikincilBtnText}>Lobiye dön</Text>
        </SoundPressable>
      </GameBackground>
    );
  }

  const acikIpuclari = durum.ipuclari.slice(0, durum.acikIpucu);
  const kalanIpucu = durum.ipuclari.length - durum.acikIpucu;
  const anlikPuan = turPuani(durum.acikIpucu);
  const benimTur = benKimim === 1 ? durum.turlar.p1 : durum.turlar.p2;
  const rakipTur = benKimim === 1 ? durum.turlar.p2 : durum.turlar.p1;

  return (
    <GameBackground style={styles.kap}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.ustSerit}>
          <View style={styles.skorKutu}>
            <Text style={styles.skorEtiket}>SEN</Text>
            <Text style={styles.skorTur}>{benimTur}</Text>
            <Text style={styles.skorPuan}>{benimSkorum(durum.skorlar, benKimim)} p</Text>
          </View>
          <View style={styles.turKutu}>
            <Text style={styles.turEtiket}>TUR {durum.turNo}</Text>
            <Text style={styles.hedefEtiket}>{HEDEF_TUR} turu alan kazanır</Text>
            {!rakipVar && <Text style={styles.kopukEtiket}>rakip bağlı değil</Text>}
          </View>
          <View style={styles.skorKutu}>
            <Text style={styles.skorEtiket}>RAKİP</Text>
            <Text style={styles.skorTur}>{rakipTur}</Text>
            <Text style={styles.skorPuan}>{rakipSkoru(durum.skorlar, benKimim)} p</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: SPACING.xxl }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.ipucuBaslikSatir}>
            <Text style={styles.ipucuBaslik}>İPUÇLARI</Text>
            {faz === "oynaniyor" && <Text style={styles.puanRozet}>şu an {anlikPuan} puan</Text>}
          </View>

          {acikIpuclari.map((ipucu, i) => (
            <View key={`${ipucu.type}-${i}`} style={styles.ipucuKart}>
              <Text style={styles.ipucuEtiket}>{ipucu.label}</Text>
              {ipucu.type === "photo" ? (
                <View style={{ alignItems: "center", marginTop: SPACING.sm }}>
                  {/* showProfileOnPress KAPALI: mini profil futbolcunun ADINI
                      gösteriyor, açık bırakmak cevabı tek dokunuşla ele verirdi. */}
                  <PlayerPhoto name={durum.gizliOyuncu?.name} size={110} showProfileOnPress={false} />
                </View>
              ) : (
                <Text style={styles.ipucuMetin}>{ipucu.text}</Text>
              )}
            </View>
          ))}

          {faz === "oynaniyor" && (
            <Text style={styles.kalanIpucuText}>
              {kalanIpucu > 0 ? `${kalanIpucu} ipucu daha açılacak` : "Son ipucu — bu kadar"}
            </Text>
          )}

          {(faz === "turSonu" || faz === "macSonu") && (
            <View style={styles.sonucKart}>
              <Text style={styles.sonucBaslik}>
                {durum.turKazanani === 0
                  ? "Kimse bilemedi"
                  : durum.turKazanani === benKimim
                  ? "Turu sen aldın!"
                  : "Turu rakip aldı"}
              </Text>
              <View style={{ marginVertical: SPACING.md }}>
                <PlayerPhoto name={durum.gizliOyuncu?.name} size={96} />
              </View>
              <Text style={styles.sonucAd}>{durum.gizliOyuncu?.name}</Text>
              {faz === "macSonu" ? (
                <>
                  <Text style={styles.macSonuText}>
                    {benimTur > rakipTur ? "MAÇI KAZANDIN" : "MAÇI KAYBETTİN"}
                  </Text>
                  {hostMuyum ? (
                    <SoundPressable style={styles.anaBtn} onPress={() => gonder({ tip: "rovans" })}>
                      <Text style={styles.anaBtnText}>RÖVANŞ</Text>
                    </SoundPressable>
                  ) : (
                    <Text style={styles.bekleme}>Rövanşı ev sahibi başlatabilir</Text>
                  )}
                </>
              ) : (
                <Text style={styles.bekleme}>Sıradaki tur birazdan...</Text>
              )}
            </View>
          )}
        </ScrollView>

        {faz === "oynaniyor" && (
          <View style={styles.altAlan}>
            {oneriler.length > 0 && girdi.length > 1 && !benKilitli && !benPas && (
              <ScrollView
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                style={styles.oneriSerit}
              >
                {oneriler.map((ad) => (
                  <SoundPressable key={ad} style={styles.oneriCip} onPress={() => tahminGonder(ad)}>
                    <Text style={styles.oneriCipText}>{ad}</Text>
                  </SoundPressable>
                ))}
              </ScrollView>
            )}

            {benPas ? (
              <Text style={styles.kilitText}>Bu turu pas geçtin — rakibi izliyorsun</Text>
            ) : benKilitli ? (
              <Text style={styles.kilitText}>Yanlış cevap — sıradaki ipucunu bekliyorsun</Text>
            ) : (
              <View style={styles.girdiSatir}>
                <TextInput
                  style={styles.girdi}
                  placeholder="Futbolcu adı yaz..."
                  placeholderTextColor={COLORS.textFaint}
                  value={girdi}
                  onChangeText={setGirdi}
                  onSubmitEditing={() => tahminGonder()}
                  returnKeyType="send"
                  autoCorrect={false}
                />
                <SoundPressable style={styles.gonderBtn} onPress={() => tahminGonder()}>
                  <Ionicons name="send" size={18} color={COLORS.accentDark} />
                </SoundPressable>
              </View>
            )}

            {!benPas && (
              <SoundPressable style={styles.pasBtn} onPress={() => gonder({ tip: "pas" })}>
                <Text style={styles.pasBtnText}>Pas geç</Text>
              </SoundPressable>
            )}
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

        <SoundPressable onPress={onExit} style={styles.cikisBtn}>
          <Text style={styles.cikisText}>Odadan çık</Text>
        </SoundPressable>
      </KeyboardAvoidingView>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, padding: SPACING.lg, paddingTop: SPACING.xxl },
  merkez: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },

  ustSerit: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.lg },
  skorKutu: {
    flex: 1, alignItems: "center", backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  skorEtiket: { ...TYPE.caption, fontSize: 10, letterSpacing: 1 },
  skorTur: { ...TYPE.h1, color: VURGU.main },
  skorPuan: { ...TYPE.caption, fontSize: 11 },
  turKutu: { flex: 1.1, alignItems: "center" },
  turEtiket: { ...TYPE.h3, fontSize: 14 },
  hedefEtiket: { ...TYPE.caption, fontSize: 10, textAlign: "center" },
  kopukEtiket: { ...TYPE.caption, fontSize: 10, color: COLORS.danger, marginTop: 2 },

  ipucuBaslikSatir: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: SPACING.sm,
  },
  ipucuBaslik: { ...TYPE.eyebrow, color: VURGU.main, fontSize: 11 },
  puanRozet: { ...TYPE.caption, color: COLORS.cta, fontWeight: "900" },

  ipucuKart: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  ipucuEtiket: { ...TYPE.caption, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
  ipucuMetin: { ...TYPE.body, fontWeight: "800", marginTop: 2 },
  kalanIpucuText: { ...TYPE.caption, textAlign: "center", marginTop: SPACING.sm },

  sonucKart: {
    backgroundColor: COLORS.card, borderColor: VURGU.main, borderWidth: 2,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.lg, alignItems: "center",
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
  pasBtn: { alignItems: "center", paddingVertical: SPACING.sm },
  pasBtnText: { ...TYPE.caption, textDecorationLine: "underline" },
  kilitText: { ...TYPE.caption, color: COLORS.danger, textAlign: "center", paddingVertical: SPACING.md },

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
