import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import AnswerFeedback from "../components/AnswerFeedback";
import TeamBadge from "../components/TeamBadge";
import PlayerPhoto from "../components/PlayerPhoto";
import TimerBar from "../components/TimerBar";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { CLUB_INFO } from "../lib/clubs";
import { buildSuggestIndex, suggestPlayers, suggestClubs, findMatchedTeam } from "../lib/gameEngine";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import { useOnlineRoom } from "../lib/onlineRoom";
import {
  baslangicDurumu, aksiyonuIsle, secilebilirKulupIndeksi, ornekCevaplar, rakip,
  CEVAP_SURESI_MS, TUR_ARASI_MS, HEDEF_PUAN,
} from "../lib/onlineDraft";

// ============================================================================
// ONLINE — ORTAK KULÜP (SEN SEÇ) — 12 Eylül 2026
//
// Bu da "Çok Yakında" taslağıydı. Kurallar lib/onlineDraft.js'te (saf, test
// edilebilir), ağ katmanı lib/onlineRoom.js'te; burada sadece çizim ve
// host'un zamanlayıcıları var.
//
// Akış: sıradaki oyuncu bir kulüp seçer -> motor ikinci kulübü belirler ->
// SORU KARŞI TARAFA gider -> bilirse puan onun, bilemezse puan seçene ->
// sıra döner.
// ============================================================================

const VURGU = MODE_COLORS.teamTeam;

export default function OnlineDraftScreen({ room, onExit }) {
  const benKimim = room.playerNumber;
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();

  // Odaya lig filtresi uygulanmışsa ona saygı gösteriyoruz (lobide seçiliyor).
  const izinliKulupler = useMemo(
    () => (room.allowedClubs?.length ? new Set(room.allowedClubs) : null),
    [room.allowedClubs]
  );

  const kulupIndeksi = useMemo(
    () => secilebilirKulupIndeksi(Object.keys(CLUB_INFO), PLAYERS),
    []
  );
  // Zorluk bilerek verilmiyor: lib/onlineDraft.js'teki VARSAYILAN_ZORLUK
  // (tanıdık, dolu eşleşmeler) online için doğru olan.
  const baglamRef = useRef({ veriSeti: PLAYERS, izinliKulupler });
  useEffect(() => { baglamRef.current = { veriSeti: PLAYERS, izinliKulupler }; }, [izinliKulupler]);

  const aksiyonIsle = useCallback(
    (durum, aksiyon, kimden) => aksiyonuIsle(durum, aksiyon, kimden, baglamRef.current),
    []
  );

  const ilkDurum = useMemo(() => baslangicDurumu(1), []);
  const { durum, hostMuyum, rakipVar, senkronBekliyor, gonder, guncelle } = useOnlineRoom({
    kanalAdi: `draft-${room.id}`,
    benKimim,
    baslangicDurumu: ilkDurum,
    aksiyonIsle,
  });

  const [kulupGirdi, setKulupGirdi] = useState("");
  const [cevapGirdi, setCevapGirdi] = useState("");
  const [geriBildirim, setGeriBildirim] = useState(null);
  const [simdi, setSimdi] = useState(Date.now());

  const oyuncuIndeksi = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oyuncuOnerileri = useMemo(() => suggestPlayers(oyuncuIndeksi, cevapGirdi), [oyuncuIndeksi, cevapGirdi]);
  const kulupOnerileri = useMemo(() => suggestClubs(kulupIndeksi, kulupGirdi), [kulupIndeksi, kulupGirdi]);

  const faz = durum?.faz;
  const benSecenim = durum?.secen === benKimim;
  const benCevaplayanim = durum ? rakip(durum.secen) === benKimim : false;

  // Saniye sayacı sadece cevap fazında dönsün.
  useEffect(() => {
    if (faz !== "cevap") return;
    const t = setInterval(() => setSimdi(Date.now()), 250);
    return () => clearInterval(t);
  }, [faz]);

  // --- Host: cevap süresi dolunca turu kapat ------------------------------
  useEffect(() => {
    if (!hostMuyum || faz !== "cevap" || !durum?.cevapBitis) return;
    const kalan = durum.cevapBitis - Date.now();
    const t = setTimeout(
      () => guncelle((d) => aksiyonuIsle(d, { tip: "sureDoldu" }, 1, baglamRef.current)),
      Math.max(0, kalan)
    );
    return () => clearTimeout(t);
  }, [hostMuyum, faz, durum?.cevapBitis, guncelle]);

  // --- Host: tur sonu -> sıradaki tur --------------------------------------
  useEffect(() => {
    if (!hostMuyum || faz !== "turSonu") return;
    const t = setTimeout(
      () => guncelle((d) => aksiyonuIsle(d, { tip: "sonrakiTur" }, 1, baglamRef.current)),
      TUR_ARASI_MS
    );
    return () => clearTimeout(t);
  }, [hostMuyum, faz, durum?.turNo, guncelle]);

  // --- Ses + istatistik (tur başına bir kez) -------------------------------
  const islenenTurRef = useRef(-1);
  useEffect(() => {
    if (faz !== "turSonu" && faz !== "macSonu") return;
    if (islenenTurRef.current === durum.turNo) return;
    islenenTurRef.current = durum.turNo;
    const kazandimMi = durum.turKazanani === benKimim;
    if (kazandimMi) playCorrect(); else playWrong();
    // 26 Eylül 2026 (Kerem: "cpu'nun söyledikleri hiçbir modda ansiklopediyi açmasın. kendi söylediklerimiz açsın.")
    // Sadece bu cihazdaki oyuncu turu kazandıysa. (NOT: lib/onlineDraft.js
    // doğru cevapta sonCevap'a `ad` yazmıyor — yani bu satır şu an hiç
    // tetiklenmiyor. Bkz. denetim raporu.)
    if (kazandimMi && durum.sonCevap?.ad) unlockPlayer(durum.sonCevap.ad);
    recordRound("onlineDraft", kazandimMi);
  }, [faz, durum?.turNo, durum?.turKazanani, benKimim, playCorrect, playWrong, durum?.sonCevap]);

  const macIslendiRef = useRef(false);
  useEffect(() => {
    if (faz !== "macSonu") { if (faz === "secim" && durum?.turNo === 1) macIslendiRef.current = false; return; }
    if (macIslendiRef.current) return;
    macIslendiRef.current = true;
    const benim = benKimim === 1 ? durum.skorlar.p1 : durum.skorlar.p2;
    const rkp = benKimim === 1 ? durum.skorlar.p2 : durum.skorlar.p1;
    addXP(benim > rkp ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI);
  }, [faz, benKimim, durum?.skorlar, durum?.turNo]);

  useEffect(() => {
    setKulupGirdi("");
    setCevapGirdi("");
    setGeriBildirim(null);
  }, [durum?.turNo, faz]);

  // Yanlış cevap uyarısı (tur bitmiyor, tekrar denenebiliyor)
  useEffect(() => {
    const c = durum?.sonCevap;
    if (!c || c.dogru || faz !== "cevap") return;
    setGeriBildirim({ correct: false, message: `"${c.metin}" bu ikilide oynamadı` });
  }, [durum?.sonCevap, faz]);

  // Seçim motorda tura dönüşemediyse kullanıcıyı bilgilendir
  const reddedildi = durum?.secimReddedildi || 0;
  useEffect(() => {
    if (!reddedildi || !benSecenim) return;
    setGeriBildirim({ correct: false, message: "Bu takımdan tur çıkmadı, başka bir takım dene" });
  }, [reddedildi, benSecenim]);

  function kulupGonder(ad) {
    const ham = String(ad ?? kulupGirdi).trim();
    if (!ham || !benSecenim || faz !== "secim") return;
    // Yazım toleransı: "galatasary" -> "Galatasaray". Eşleşme sadece
    // SEÇİLEBİLİR kulüpler arasında aranıyor.
    const eslesen = findMatchedTeam(ham, kulupIndeksi.map((k) => k.original));
    if (!eslesen) {
      setGeriBildirim({ correct: false, message: "Bu takımı bulamadım, listeden seçebilirsin" });
      return;
    }
    setKulupGirdi("");
    gonder({ tip: "kulupSec", kulup: eslesen });
  }

  function cevapGonder(ad) {
    const temiz = String(ad ?? cevapGirdi).trim();
    if (!temiz || !benCevaplayanim || faz !== "cevap") return;
    setCevapGirdi("");
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

  const benimSkor = benKimim === 1 ? durum.skorlar.p1 : durum.skorlar.p2;
  const rakipSkor = benKimim === 1 ? durum.skorlar.p2 : durum.skorlar.p1;
  const kalanSn = faz === "cevap" ? Math.max(0, Math.ceil((durum.cevapBitis - simdi) / 1000)) : 0;

  return (
    <GameBackground style={styles.kap}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
          {/* --- SEÇİM FAZI --- */}
          {faz === "secim" && (
            <View style={styles.orta}>
              {benSecenim ? (
                <>
                  <Text style={styles.buyukBaslik}>Bir takım seç</Text>
                  <Text style={styles.aciklama}>
                    Seçtiğin takım rakibinin sorusu olacak. Bilemezse puan senin.
                  </Text>
                  <View style={styles.girdiSatir}>
                    <TextInput
                      style={styles.girdi}
                      placeholder="Takım adı yaz..."
                      placeholderTextColor={COLORS.textFaint}
                      value={kulupGirdi}
                      onChangeText={setKulupGirdi}
                      onSubmitEditing={() => kulupGonder()}
                      returnKeyType="send"
                      autoCorrect={false}
                    />
                    <SoundPressable style={styles.gonderBtn} onPress={() => kulupGonder()}>
                      <Ionicons name="send" size={18} color={COLORS.accentDark} />
                    </SoundPressable>
                  </View>
                  {kulupOnerileri.map((k) => (
                    <SoundPressable key={k} style={styles.oneriSatir} onPress={() => kulupGonder(k)}>
                      <TeamBadge name={k} size={26} />
                      <Text style={styles.oneriSatirText}>{k}</Text>
                    </SoundPressable>
                  ))}
                </>
              ) : (
                <>
                  <ActivityIndicator color={VURGU.main} />
                  <Text style={styles.buyukBaslik}>Rakip takım seçiyor</Text>
                  <Text style={styles.aciklama}>Sıradaki soru sana gelecek.</Text>
                </>
              )}
            </View>
          )}

          {/* --- CEVAP FAZI --- */}
          {faz === "cevap" && (
            <>
              <View style={styles.takimKart}>
                <View style={styles.takimKutu}>
                  <TeamBadge name={durum.teamA} size={52} />
                  <Text style={styles.takimAd}>{durum.teamA}</Text>
                </View>
                <Text style={styles.arti}>+</Text>
                <View style={styles.takimKutu}>
                  <TeamBadge name={durum.teamB} size={52} />
                  <Text style={styles.takimAd}>{durum.teamB}</Text>
                </View>
              </View>

              <TimerBar current={kalanSn} total={Math.round(CEVAP_SURESI_MS / 1000)} />
              <Text style={styles.sayacText}>{kalanSn} sn</Text>

              {benCevaplayanim ? (
                <Text style={styles.aciklama}>İki takımda da oynamış bir futbolcu söyle</Text>
              ) : (
                <Text style={styles.aciklama}>Rakip cevaplıyor — senin seçtiğin takım</Text>
              )}
            </>
          )}

          {/* --- TUR / MAÇ SONU --- */}
          {(faz === "turSonu" || faz === "macSonu") && (
            <View style={styles.sonucKart}>
              <Text style={styles.sonucBaslik}>
                {durum.turKazanani === benKimim ? "Puan senin!" : "Puan rakibin"}
              </Text>
              <Text style={styles.sonucAltBaslik}>
                {durum.teamA} + {durum.teamB}
              </Text>
              {durum.sonCevap?.ad ? (
                <>
                  <View style={{ marginVertical: SPACING.md }}>
                    <PlayerPhoto name={durum.sonCevap.ad} size={88} />
                  </View>
                  <Text style={styles.sonucAd}>{durum.sonCevap.ad}</Text>
                </>
              ) : (
                <Text style={styles.sonucAd}>Süre doldu</Text>
              )}
              <Text style={styles.ornekBaslik}>Geçerli cevaplardan bazıları</Text>
              <Text style={styles.ornekMetin}>{ornekCevaplar(durum).join(" · ")}</Text>

              {faz === "macSonu" ? (
                <>
                  <Text style={styles.macSonuText}>
                    {benimSkor > rakipSkor ? "MAÇI KAZANDIN" : "MAÇI KAYBETTİN"}
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
                <Text style={styles.bekleme}>
                  Sıradaki turda {rakip(durum.secen) === benKimim ? "sıra sende" : "seçim rakipte"}
                </Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* Cevap girişi — sadece cevap sırası bendeyken */}
        {faz === "cevap" && benCevaplayanim && (
          <View style={styles.altAlan}>
            {oyuncuOnerileri.length > 0 && cevapGirdi.length > 1 && (
              <ScrollView
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                style={styles.oneriSerit}
              >
                {oyuncuOnerileri.map((ad) => (
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
                value={cevapGirdi}
                onChangeText={setCevapGirdi}
                onSubmitEditing={() => cevapGonder()}
                returnKeyType="send"
                autoCorrect={false}
              />
              <SoundPressable style={styles.gonderBtn} onPress={() => cevapGonder()}>
                <Ionicons name="send" size={18} color={COLORS.accentDark} />
              </SoundPressable>
            </View>
            <SoundPressable style={styles.pasBtn} onPress={() => gonder({ tip: "pes" })}>
              <Text style={styles.pasBtnText}>Bilemedim</Text>
            </SoundPressable>
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
  orta: { alignItems: "center", paddingTop: SPACING.lg },

  ustSerit: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.lg },
  skorKutu: {
    flex: 1, alignItems: "center", backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACING.sm,
  },
  skorEtiket: { ...TYPE.caption, fontSize: 10, letterSpacing: 1 },
  skorDeger: { ...TYPE.h1, color: VURGU.main },
  turKutu: { flex: 1.2, alignItems: "center" },
  turEtiket: { ...TYPE.h3, fontSize: 14 },
  hedefEtiket: { ...TYPE.caption, fontSize: 10, textAlign: "center" },
  kopukEtiket: { ...TYPE.caption, fontSize: 10, color: COLORS.danger, marginTop: 2 },

  buyukBaslik: { ...TYPE.h2, marginTop: SPACING.md, textAlign: "center" },
  aciklama: { ...TYPE.caption, textAlign: "center", marginTop: SPACING.xs, marginBottom: SPACING.md },

  takimKart: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md,
  },
  takimKutu: { flex: 1, alignItems: "center", gap: SPACING.xs },
  takimAd: { ...TYPE.h3, fontSize: 14, textAlign: "center" },
  arti: { ...TYPE.h2, color: VURGU.main, marginHorizontal: SPACING.sm },
  sayacText: { ...TYPE.caption, textAlign: "center", marginTop: SPACING.xs },

  oneriSatir: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm, alignSelf: "stretch",
  },
  oneriSatirText: { ...TYPE.body, fontWeight: "800", flex: 1 },

  sonucKart: {
    backgroundColor: COLORS.card, borderColor: VURGU.main, borderWidth: 2,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.md, alignItems: "center",
  },
  sonucBaslik: { ...TYPE.h2, textAlign: "center" },
  sonucAltBaslik: { ...TYPE.caption, marginTop: 2, textAlign: "center" },
  sonucAd: { ...TYPE.h3, color: VURGU.main, textAlign: "center" },
  ornekBaslik: { ...TYPE.caption, fontSize: 10, letterSpacing: 1, marginTop: SPACING.md, textTransform: "uppercase" },
  ornekMetin: { ...TYPE.caption, textAlign: "center", marginTop: 2 },
  macSonuText: { ...TYPE.h1, color: COLORS.cta, marginTop: SPACING.md, textAlign: "center" },

  altAlan: { paddingTop: SPACING.sm },
  oneriSerit: { marginBottom: SPACING.sm },
  oneriCip: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 6, marginRight: SPACING.sm,
  },
  oneriCipText: { ...TYPE.caption, color: COLORS.text, fontWeight: "700" },
  girdiSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, alignSelf: "stretch" },
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
});
