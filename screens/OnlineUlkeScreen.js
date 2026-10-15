import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { KlavyeAlani } from "../components/Klavye";
import SoundPressable from "../components/SoundPressable";
import MikrofonDugmesi from "../components/MikrofonDugmesi";
import AnswerFeedback from "../components/AnswerFeedback";
import EslesmeKarti from "../components/EslesmeKarti";
import PlayerPhoto from "../components/PlayerPhoto";
import TimerBar from "../components/TimerBar";
import { OyunUstCubugu, SkorSeridi } from "../components/MacCercevesi";
import OnlineMacSonu from "../components/OnlineMacSonu";
import RakipAyrildi from "../components/RakipAyrildi";
import { COLORS, RADIUS, SPACING, TYPE, saydam } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { buildSuggestIndex, suggestPlayers, computeCountryTeamPool } from "../lib/gameEngine";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import { useOnlineRoom, rovansli, macSirasi } from "../lib/onlineRoom";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import { standartProfil } from "../lib/eslesmeProfili";
import {
  baslangicDurumu, aksiyonuIsle, ornekCevaplar, hakkiBittiMi,
  TUR_SURESI_MS, TUR_ARASI_MS, HEDEF_PUAN, YANLIS_HAKKI, ZORLUK,
} from "../lib/onlineUlke";

// ============================================================================
// ONLINE — ORTAK KULÜP · KULÜP × ÜLKE — Paket 32 (15 Ekim 2026)
// Kerem: "3-2-1 içine girince online'da ülke-takım … modu yok?"
// Kurallar lib/onlineUlke.js'te (saf, test edilebilir), ağ lib/onlineRoom.js'te.
// Ekran Paket 31 maç çerçevesini kullanır (üst çubuk + skor şeridi) ve
// eşleşme kartı ülke yarısını milli takım renginde çizer.
// Akış: iki oyuncu bağlanınca host ilk turu üretir → ikisi aynı anda yazar →
// ilk doğru yazan puanı alır (turda 3 yanlış hakkı) → 5 puana ilk ulaşan kazanır.
// ============================================================================

export default function OnlineUlkeScreen({ room, onExit }) {
  const benKimim = room.playerNumber;
  const rakipNo = benKimim === 1 ? 2 : 1;
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();

  // Dereceli: herkes aynı (Dengeli) havuz; arkadaş odası: kuranın profili (host üretir).
  const eslesme = useEslesmeProfili();
  const profil = room && room.isRanked ? standartProfil() : eslesme.derlenmis;
  const havuz = useMemo(
    () => (benKimim === 1 ? computeCountryTeamPool(PLAYERS, profil, ZORLUK) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [benKimim, profil && profil.anahtar]
  );
  const baglamRef = useRef(null);
  baglamRef.current = { havuz, veriSeti: PLAYERS, izinliKulupler: profil };

  const aksiyonIsle = useCallback(
    rovansli((durum, aksiyon, kimden) => aksiyonuIsle(durum, aksiyon, kimden, baglamRef.current)),
    []
  );
  const ilkDurum = useMemo(() => baslangicDurumu(), []);
  const { durum, hostMuyum, rakipVar, senkronBekliyor, gonder, guncelle } = useOnlineRoom({
    kanalAdi: `ulke-${room.id}`,
    benKimim,
    baslangicDurumu: ilkDurum,
    aksiyonIsle,
  });

  const [girdi, setGirdi] = useState("");
  const [geriBildirim, setGeriBildirim] = useState(null);
  const [simdi, setSimdi] = useState(Date.now());
  const oyuncuIndeksi = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => suggestPlayers(oyuncuIndeksi, girdi), [oyuncuIndeksi, girdi]);

  const faz = durum?.faz;
  const ayrildi = <RakipAyrildi oda={room} benKimim={benKimim} rakipVar={rakipVar} aktif={!!faz && !["hazirlik", "macSonu", "hata"].includes(faz)} macNo={macSirasi(durum)} onExit={onExit} />;

  // --- Host: rakip gelince ilk turu başlat --------------------------------
  useEffect(() => {
    if (!hostMuyum || faz !== "hazirlik" || !rakipVar) return;
    const t = setTimeout(() => guncelle((d) => aksiyonuIsle(d, { tip: "basla" }, 1, baglamRef.current)), 1200);
    return () => clearTimeout(t);
  }, [hostMuyum, faz, rakipVar, guncelle]);

  // --- Host: süre dolunca turu kapat --------------------------------------
  useEffect(() => {
    if (!hostMuyum || faz !== "cevap" || !durum?.bitis) return;
    const t = setTimeout(
      () => guncelle((d) => aksiyonuIsle(d, { tip: "sureDoldu" }, 1, baglamRef.current)),
      Math.max(0, durum.bitis - Date.now())
    );
    return () => clearTimeout(t);
  }, [hostMuyum, faz, durum?.bitis, guncelle]);

  // --- Host: tur sonu → sıradaki tur --------------------------------------
  useEffect(() => {
    if (!hostMuyum || faz !== "turSonu") return;
    const t = setTimeout(() => guncelle((d) => aksiyonuIsle(d, { tip: "sonrakiTur" }, 1, baglamRef.current)), TUR_ARASI_MS);
    return () => clearTimeout(t);
  }, [hostMuyum, faz, durum?.turNo, guncelle]);

  // Saniye sayacı
  useEffect(() => {
    if (faz !== "cevap") return;
    const t = setInterval(() => setSimdi(Date.now()), 250);
    return () => clearInterval(t);
  }, [faz]);

  // Ses + istatistik + ansiklopedi (tur başına bir kez)
  const islenenRef = useRef(-1);
  useEffect(() => {
    if (faz !== "turSonu" && faz !== "macSonu") return;
    if (islenenRef.current === durum.turNo) return;
    islenenRef.current = durum.turNo;
    const kazandim = durum.turKazanani === benKimim;
    if (kazandim) playCorrect(); else playWrong();
    if (kazandim && durum.sonCevap?.ad) unlockPlayer(durum.sonCevap.ad);
    recordRound("onlineUlke", kazandim);
  }, [faz, durum?.turNo, durum?.turKazanani, benKimim, playCorrect, playWrong, durum?.sonCevap]);

  const macIslendiRef = useRef(false);
  useEffect(() => {
    if (faz !== "macSonu") { if (faz === "cevap" && durum?.turNo === 1) macIslendiRef.current = false; return; }
    if (macIslendiRef.current) return;
    macIslendiRef.current = true;
    const benim = durum.skorlar[`p${benKimim}`];
    const rkp = durum.skorlar[`p${rakipNo}`];
    addXP(benim > rkp ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI);
  }, [faz, benKimim, rakipNo, durum?.skorlar, durum?.turNo]);

  useEffect(() => { setGirdi(""); setGeriBildirim(null); }, [durum?.turNo]);

  // Kendi yanlışım → uyarı
  const sonYanlisN = durum?.sonYanlis?.n || 0;
  useEffect(() => {
    const y = durum?.sonYanlis;
    if (!y || y.kimden !== benKimim || faz !== "cevap") return;
    const kalan = YANLIS_HAKKI - (durum.yanlis?.[`p${benKimim}`] || 0);
    setGeriBildirim({ correct: false, message: kalan > 0 ? `"${y.metin}" olmadı · ${kalan} hak kaldı` : `"${y.metin}" olmadı · hakkın bitti` });
    playWrong();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sonYanlisN]);

  function cevapGonder(ad) {
    const temiz = String(ad ?? girdi).trim();
    if (!temiz || faz !== "cevap" || hakkiBittiMi(durum, benKimim)) return;
    setGirdi("");
    gonder({ tip: "cevap", metin: temiz });
  }

  // ---------------------------------------------------------------- bekleme
  if (!durum || faz === "hazirlik" || faz === "hata") {
    const yazi = !durum
      ? (senkronBekliyor ? "Odaya bağlanılıyor..." : "Ev sahibine ulaşılamadı. Bağlantını kontrol edip tekrar dene.")
      : faz === "hata" ? "Tur hazırlanamadı. Odadan çıkıp tekrar dene."
      : rakipVar ? "İlk tur hazırlanıyor..." : "Rakip bekleniyor...";
    return (
      <GameBackground style={styles.merkez}>
        {(senkronBekliyor || faz === "hazirlik") && <ActivityIndicator color={COLORS.accent} />}
        <Text style={styles.bekleme}>{yazi}</Text>
        {faz === "hazirlik" && room.code ? <Text style={styles.odaKodu}>{room.code}</Text> : null}
        <SoundPressable onPress={onExit} style={styles.ikincilBtn}>
          <Text style={styles.ikincilBtnText}>Lobiye dön</Text>
        </SoundPressable>
      </GameBackground>
    );
  }

  const skorSen = durum.skorlar[`p${benKimim}`];
  const skorRakip = durum.skorlar[`p${rakipNo}`];
  const kalanSn = faz === "cevap" ? Math.max(0, Math.ceil((durum.bitis - simdi) / 1000)) : 0;
  const benBittim = hakkiBittiMi(durum, benKimim);
  const rakipBitti = hakkiBittiMi(durum, rakipNo);
  const hakNoktalari = (kim) => YANLIS_HAKKI - (durum.yanlis?.[`p${kim}`] || 0);
  const acik = faz === "turSonu" || faz === "macSonu";

  return (
    <GameBackground style={styles.kap}>
      {ayrildi}
      <KlavyeAlani style={{ flex: 1 }}>
        <OyunUstCubugu
          baslik="Ortak Kulüp"
          alt={`Kulüp × Ülke · Online · Tur ${durum.turNo}`}
          onCikis={faz === "macSonu" ? null : onExit}
        />
        <SkorSeridi
          sol={{ etiket: "SEN", puan: skorSen, renk: COLORS.accent }}
          sag={{ etiket: "RAKİP", puan: skorRakip, renk: COLORS.cta }}
          orta={!rakipVar ? "rakip bağlı değil" : `${HEDEF_PUAN}'te biter`}
        />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: SPACING.lg }} keyboardShouldPersistTaps="handled">
          {faz !== "macSonu" ? (
            <EslesmeKarti sol={{ tip: "ulke", ad: durum.ulke }} sag={{ tip: "kulup", ad: durum.kulup }} />
          ) : null}

          {faz === "cevap" ? (
            <>
              <Text style={styles.kural}>Vatandaşlık ya da milli takım — ikisi de geçer</Text>
              <View style={{ marginTop: SPACING.md }}>
                <TimerBar current={kalanSn} total={Math.round(TUR_SURESI_MS / 1000)} />
              </View>
              <View style={styles.hakSatir}>
                <View style={styles.hakTaraf}>
                  {Array.from({ length: YANLIS_HAKKI }).map((_, i) => (
                    <View key={i} style={[styles.hakNokta, i < hakNoktalari(benKimim) && { backgroundColor: COLORS.accent }]} />
                  ))}
                  <Text style={styles.hakYazi}>senin hakların</Text>
                </View>
                <Text style={[styles.hakYazi, rakipBitti && { color: COLORS.textFaint }]}>
                  {rakipBitti ? "rakibin hakkı bitti" : `rakip ${hakNoktalari(rakipNo)} hak`}
                </Text>
              </View>
              {benBittim ? (
                <View style={styles.bitti}>
                  <Ionicons name="hourglass-outline" size={18} color={COLORS.textMuted} />
                  <Text style={styles.bittiYazi}>Bu turda hakkın bitti — rakip deniyor</Text>
                </View>
              ) : null}
            </>
          ) : null}

          {acik && faz !== "macSonu" ? (
            <View style={styles.sonucKart}>
              <Text style={styles.sonucBaslik}>
                {durum.turKazanani === benKimim ? "Puan senin!" : durum.turKazanani ? "Puan rakibin" : "Kimse bilemedi"}
              </Text>
              {durum.sonCevap?.ad ? (
                <>
                  <View style={{ marginVertical: SPACING.md }}>
                    <PlayerPhoto name={durum.sonCevap.ad} size={80} />
                  </View>
                  <Text style={styles.sonucAd}>{durum.sonCevap.ad}</Text>
                </>
              ) : null}
              <Text style={styles.ornekBaslik}>Geçerli cevaplardan bazıları</Text>
              <Text style={styles.ornekMetin}>{ornekCevaplar(durum).join(" · ")}</Text>
            </View>
          ) : null}

          {faz === "macSonu" ? (
            <OnlineMacSonu
              oda={room}
              modAdi="Online — Kulüp × Ülke"
              durum={durum}
              benKimim={benKimim}
              rakipVar={rakipVar}
              gonder={gonder}
              onExit={onExit}
              skorSen={skorSen}
              skorRakip={skorRakip}
              skorEtiketi="puan"
              kazanan={skorSen > skorRakip ? "sen" : skorSen < skorRakip ? "rakip" : "berabere"}
            />
          ) : null}
        </ScrollView>

        {faz === "cevap" && !benBittim ? (
          <View style={styles.altAlan}>
            {oneriler.length > 0 && girdi.length > 1 ? (
              <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={styles.oneriSerit}>
                {oneriler.map((ad) => (
                  <SoundPressable key={ad} style={styles.oneriCip} onPress={() => cevapGonder(ad)}>
                    <Text style={styles.oneriCipText}>{ad}</Text>
                  </SoundPressable>
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.girdiSatir}>
              <TextInput
                style={styles.girdi}
                placeholder="Futbolcu adı…"
                placeholderTextColor={COLORS.textFaint}
                value={girdi}
                onChangeText={setGirdi}
                onSubmitEditing={() => cevapGonder()}
                returnKeyType="send"
                autoCorrect={false}
              />
              <MikrofonDugmesi onMetin={(m) => setGirdi(m)} onGonder={(m) => cevapGonder(m)} />
              <SoundPressable style={styles.gonderBtn} onPress={() => cevapGonder()} accessibilityLabel="Gönder">
                <Ionicons name="arrow-forward" size={20} color={COLORS.accentDark} />
              </SoundPressable>
            </View>
            <SoundPressable style={styles.pasBtn} onPress={() => gonder({ tip: "pes" })}>
              <Text style={styles.pasBtnText}>Bilemedim</Text>
            </SoundPressable>
          </View>
        ) : null}

        {geriBildirim ? (
          <View style={styles.geriBildirimSarmal} pointerEvents="none">
            <AnswerFeedback correct={geriBildirim.correct} message={geriBildirim.message} onDone={() => setGeriBildirim(null)} />
          </View>
        ) : null}
      </KlavyeAlani>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, padding: SPACING.lg, paddingTop: SPACING.xxl },
  merkez: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  bekleme: { ...TYPE.caption, marginTop: SPACING.md, textAlign: "center" },
  odaKodu: { color: COLORS.text, fontSize: 30, fontWeight: "900", letterSpacing: 6, marginTop: SPACING.md },
  ikincilBtn: { marginTop: SPACING.lg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  ikincilBtnText: { ...TYPE.caption, textDecorationLine: "underline" },

  kural: { ...TYPE.caption, textAlign: "center", marginTop: SPACING.sm },
  hakSatir: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACING.sm },
  hakTaraf: { flexDirection: "row", alignItems: "center", gap: 5 },
  hakNokta: { width: 8, height: 8, borderRadius: 4, backgroundColor: saydam(COLORS.text, 0.15) },
  hakYazi: { ...TYPE.caption, fontSize: 12, marginLeft: 4 },
  bitti: {
    flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", marginTop: SPACING.lg,
    paddingVertical: 10, paddingHorizontal: SPACING.md, borderRadius: RADIUS.pill, backgroundColor: saydam(COLORS.text, 0.06),
  },
  bittiYazi: { color: COLORS.textMuted, fontSize: 13, fontWeight: "700" },

  sonucKart: {
    backgroundColor: COLORS.card, borderColor: saydam(COLORS.text, 0.08), borderWidth: 1,
    borderRadius: 20, padding: SPACING.lg, marginTop: SPACING.md, alignItems: "center",
  },
  sonucBaslik: { ...TYPE.h2, textAlign: "center" },
  sonucAd: { ...TYPE.h3, color: COLORS.accent, textAlign: "center" },
  ornekBaslik: { ...TYPE.caption, fontSize: 11, letterSpacing: 1, marginTop: SPACING.md, textTransform: "uppercase" },
  ornekMetin: { ...TYPE.caption, textAlign: "center", marginTop: 2 },

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
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, color: COLORS.text, fontSize: 15,
  },
  gonderBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  pasBtn: { alignItems: "center", paddingVertical: SPACING.sm },
  pasBtnText: { ...TYPE.caption, textDecorationLine: "underline" },
  geriBildirimSarmal: { position: "absolute", left: 0, right: 0, top: "38%", alignItems: "center" },
});
