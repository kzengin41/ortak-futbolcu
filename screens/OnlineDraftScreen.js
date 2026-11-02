import { _t } from "../lib/dil";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { KlavyeAlani } from "../components/Klavye";
import SoundPressable from "../components/SoundPressable";
import BilemedimDugmesi from "../components/BilemedimDugmesi";
import { yazmaOldu } from "../lib/yazmaKilidi";
import MikrofonDugmesi from "../components/MikrofonDugmesi";
import AnswerFeedback from "../components/AnswerFeedback";
import TeamBadge from "../components/TeamBadge";
import EslesmeKarti from "../components/EslesmeKarti";
import PlayerPhoto from "../components/PlayerPhoto";
import TimerBar from "../components/TimerBar";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, MODE_COLORS } from "../lib/theme";
import { rakipMetniYaz } from "../lib/guvenlik";
import { PLAYERS } from "../lib/players";
import { CLUB_INFO } from "../lib/clubs";
import { buildSuggestIndex, suggestPlayers, suggestClubs, findMatchedTeam } from "../lib/gameEngine";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import { useOnlineRoom, rovansli, macSirasi } from "../lib/onlineRoom";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import { standartProfil } from "../lib/eslesmeProfili";
import OnlineMacSonu from "../components/OnlineMacSonu";
import RakipAyrildi from "../components/RakipAyrildi";
import {
  baslangicDurumu, aksiyonuIsle, secilebilirKulupIndeksi, ornekCevaplar, rakip,
  CEVAP_SURESI_MS, TUR_ARASI_MS, HEDEF_PUAN, GERI_SAYIM_MS, GECERSIZ_MS, YANLIS_HAKKI,
} from "../lib/onlineDraft";
import CountdownOverlay from "../components/CountdownOverlay";

// ============================================================================
// ONLINE — ORTAK KULÜP · TAKIMI SEN SEÇ
// Paket 42 (26 Ekim 2026) — yeni kurgu (Kerem): iki taraf AYNI ANDA gizlice
// birer takım seçer → 3-2-1 → iki takım açılır → önce doğru yazan puanı alır.
// Kurallar lib/onlineDraft.js'te (saf, test edilebilir), ağ lib/onlineRoom.js'te;
// burada çizim ve host'un zamanlayıcıları var. Sayaçlar host saatine değil,
// her cihazın fazın geldiği ana göre çalışır (saat farkı ekranı bozmasın).
// ============================================================================

const VURGU = MODE_COLORS.teamTeam;

export default function OnlineDraftScreen({ room, onExit }) {
  const benKimim = room.playerNumber;
  const rakipNo = rakip(benKimim);
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();

  // Dereceli maçta herkes aynı (Dengeli) havuz, arkadaş odasında kuranın profili.
  const eslesme = useEslesmeProfili();
  const profil = room && room.isRanked ? standartProfil() : eslesme.derlenmis;
  const izinliKulupler = (profil && profil.kapsam) || null;

  const kulupIndeksi = useMemo(
    () => secilebilirKulupIndeksi(Object.keys(CLUB_INFO), PLAYERS),
    []
  );
  const baglamRef = useRef({ veriSeti: PLAYERS, izinliKulupler });
  useEffect(() => { baglamRef.current = { veriSeti: PLAYERS, izinliKulupler }; }, [izinliKulupler]);

  const aksiyonIsle = useCallback(
    rovansli((durum, aksiyon, kimden) => aksiyonuIsle(durum, aksiyon, kimden, baglamRef.current)),
    []
  );

  const ilkDurum = useMemo(() => baslangicDurumu(), []);
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
  const oyuncuOnerileri = useMemo(() => (cevapGirdi.trim().length >= 3 ? suggestPlayers(oyuncuIndeksi, cevapGirdi) : []), [oyuncuIndeksi, cevapGirdi]);
  const kulupOnerileri = useMemo(() => suggestClubs(kulupIndeksi, kulupGirdi), [kulupIndeksi, kulupGirdi]);

  const faz = durum?.faz;
  const ayrildi = <RakipAyrildi oda={room} benKimim={benKimim} rakipVar={rakipVar} aktif={!!faz && !["hazirlik", "macSonu", "hata"].includes(faz)} macNo={macSirasi(durum)} onExit={onExit} />;
  const benimSecim = durum?.secimler?.[`p${benKimim}`] || null;
  const rakipSecti = !!durum?.secimler?.[`p${rakipNo}`];
  const elendim = !!durum?.elenen?.includes(benKimim);
  const rakipElendi = !!durum?.elenen?.includes(rakipNo);
  const benimYanlis = durum?.yanlislar?.[`p${benKimim}`] || 0;

  // Fazın BU cihazda başladığı an (sayaçlar buna göre).
  const fazAnRef = useRef({ anahtar: null, t: 0 });
  const fazAnahtari = durum ? `${durum.turNo}-${faz}-${durum.macNo || 0}` : null;
  if (fazAnahtari && fazAnRef.current.anahtar !== fazAnahtari) fazAnRef.current = { anahtar: fazAnahtari, t: Date.now() };

  useEffect(() => {
    if (faz !== "yaris") return;
    const t = setInterval(() => setSimdi(Date.now()), 250);
    return () => clearInterval(t);
  }, [faz]);

  // --- Host zamanlayıcıları ---------------------------------------------------
  useEffect(() => {
    if (!hostMuyum || !faz) return;
    let ms = null, aksiyon = null;
    if (faz === "geriSayim") { ms = GERI_SAYIM_MS; aksiyon = { tip: "ac" }; }
    else if (faz === "gecersiz") { ms = GECERSIZ_MS; aksiyon = { tip: "yenidenSec" }; }
    else if (faz === "yaris") { ms = Math.max(0, (durum.cevapBitis || 0) - Date.now()) + 50; aksiyon = { tip: "sureDoldu" }; }
    else if (faz === "turSonu") { ms = TUR_ARASI_MS; aksiyon = { tip: "sonrakiTur" }; }
    if (ms == null) return;
    const t = setTimeout(() => guncelle((d) => aksiyonuIsle(d, aksiyon, 1, baglamRef.current)), ms);
    return () => clearTimeout(t);
  }, [hostMuyum, faz, durum?.turNo, durum?.cevapBitis, guncelle]);

  // --- Ses + istatistik (tur başına bir kez) -------------------------------
  const islenenTurRef = useRef(-1);
  useEffect(() => {
    if (faz !== "turSonu" && faz !== "macSonu") return;
    if (islenenTurRef.current === durum.turNo) return;
    islenenTurRef.current = durum.turNo;
    const kazandimMi = durum.turKazanani === benKimim;
    if (kazandimMi) playCorrect(); else playWrong();
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

  // Yanlış cevabım: uyarı (tur bitmiyor, hakkım varsa tekrar denerim)
  const sonYanlisRef = useRef(null);
  useEffect(() => {
    const c = durum?.sonCevap;
    if (!c || c.dogru || c.pes || faz !== "yaris" || c.kimden !== benKimim) return;
    const k = `${durum.turNo}-${benimYanlis}`;
    if (sonYanlisRef.current === k) return;
    sonYanlisRef.current = k;
    playWrong();
    const kalan = Math.max(0, YANLIS_HAKKI - benimYanlis);
    setGeriBildirim({ correct: false, message: kalan ? _t("\"{0}\" bu ikilide oynamadı · {1} hakkın kaldı", [c.metin, kalan]) : _t("\"{0}\" bu ikilide oynamadı · bu turda elendin", [c.metin]) });
  }, [durum?.sonCevap, faz, benimYanlis]);

  // Profil dışı takım seçimi reddedildi
  const ret = durum?.secimReddi;
  const retRef = useRef(0);
  useEffect(() => {
    if (!ret || ret.kimden !== benKimim || ret.sayac === retRef.current) return;
    retRef.current = ret.sayac;
    setGeriBildirim({ correct: false, message: _t("{0} bu odanın eşleşme profilinde yok, başka bir takım seç", [ret.kulup]) });
  }, [ret, benKimim]);

  function kulupGonder(ad) {
    const ham = String(ad ?? kulupGirdi).trim();
    if (!ham || faz !== "secim" || benimSecim) return;
    const eslesen = findMatchedTeam(ham, kulupIndeksi.map((k) => k.original));
    if (!eslesen) {
      setGeriBildirim({ correct: false, message: _t("Bu takımı bulamadım, listeden seçebilirsin") });
      return;
    }
    setKulupGirdi("");
    gonder({ tip: "kulupSec", kulup: eslesen });
  }

  function cevapGonder(ad) {
    const temiz = String(ad ?? cevapGirdi).trim();
    if (!temiz || faz !== "yaris" || elendim) return;
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
            ? _t("Odaya bağlanılıyor...")
            : _t("Ev sahibine ulaşılamadı. Bağlantını kontrol edip tekrar dene.")}
        </Text>
        <SoundPressable onPress={onExit} style={styles.ikincilBtn}>
          <Text style={styles.ikincilBtnText}>{_t("Lobiye dön")}</Text>
        </SoundPressable>
      </GameBackground>
    );
  }

  const benimSkor = benKimim === 1 ? durum.skorlar.p1 : durum.skorlar.p2;
  const rakipSkor = benKimim === 1 ? durum.skorlar.p2 : durum.skorlar.p1;
  const yarisToplam = Math.round(CEVAP_SURESI_MS / 1000);
  const kalanSn = faz === "yaris" ? Math.max(0, yarisToplam - Math.floor((simdi - fazAnRef.current.t) / 1000)) : 0;
  const benimTakim = benKimim === 1 ? durum.teamA : durum.teamB;
  const rakipTakim = benKimim === 1 ? durum.teamB : durum.teamA;
  const takimlarAcik = faz === "yaris" || faz === "gecersiz" || faz === "turSonu" || faz === "macSonu";

  return (
    <GameBackground style={styles.kap}>
      {ayrildi}
      <KlavyeAlani style={{ flex: 1 }}>
        <View style={styles.ustSerit}>
          <View style={styles.skorKutu}>
            <Text style={styles.skorEtiket}>{_t("SEN")}</Text>
            <Text style={styles.skorDeger}>{benimSkor}</Text>
          </View>
          <View style={styles.turKutu}>
            <Text style={styles.turEtiket}>{_t("TUR")}{" "}{durum.turNo}</Text>
            <Text style={styles.hedefEtiket}>{HEDEF_PUAN}{" "}{_t("puana ilk ulaşan kazanır")}</Text>
            {!rakipVar && <Text style={styles.kopukEtiket}>{_t("rakip bağlı değil")}</Text>}
          </View>
          <View style={styles.skorKutu}>
            <Text style={styles.skorEtiket}>{_t("RAKİP")}</Text>
            <Text style={styles.skorDeger}>{rakipSkor}</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: SPACING.xl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* --- SEÇİM --- */}
          {faz === "secim" && (
            <View style={styles.orta}>
              {!benimSecim ? (
                <>
                  <Text style={styles.buyukBaslik}>{_t("Takımını seç")}</Text>
                  <Text style={styles.aciklama}>{_t(
                    "Rakibin de şu an gizlice bir takım seçiyor. İkiniz de seçince 3-2-1 sayılır, iki takım açılır: ikisinde de oynamış futbolcuyu önce yazan puanı alır."
                  )}</Text>
                  <View style={styles.girdiSatir}>
                    <TextInput
                      style={styles.girdi}
                      placeholder={_t("Takım adı yaz...")}
                      placeholderTextColor={COLORS.textFaint}
                      value={kulupGirdi}
                      onChangeText={setKulupGirdi}
                      onSubmitEditing={() => kulupGonder()}
                      returnKeyType="send"
                      autoCorrect={false}
                    />
                    <MikrofonDugmesi onMetin={(m) => setKulupGirdi(m)} onGonder={(m) => kulupGonder(m)} />
                    <SoundPressable style={styles.gonderBtn} onPress={() => kulupGonder()} accessibilityLabel={_t("Takımı seç")}>
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
                  <TeamBadge name={benimSecim} size={64} />
                  <Text style={styles.buyukBaslik}>{_t("Seçtin: {0}", [benimSecim])}</Text>
                  <Text style={styles.aciklama}>{_t("Rakibin bunu 3-2-1'den sonra görecek.")}</Text>
                  <SoundPressable onPress={() => gonder({ tip: "secimiGeriAl" })} style={styles.pasBtn}>
                    <Text style={styles.pasBtnText}>{_t("Takımı değiştir")}</Text>
                  </SoundPressable>
                </>
              )}
              <View style={styles.rakipDurum}>
                {rakipSecti
                  ? <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                  : <ActivityIndicator size="small" color={VURGU.main} />}
                <Text style={styles.rakipDurumYazi}>{rakipSecti ? _t("Rakip takımını seçti") : _t("Rakip takım seçiyor…")}</Text>
              </View>
            </View>
          )}

          {/* --- GERİ SAYIM: takımlar henüz gizli --- */}
          {faz === "geriSayim" && (
            <View style={styles.orta}>
              <Text style={styles.buyukBaslik}>{_t("Takımlar geliyor…")}</Text>
              <EslesmeKarti sol={{ tip: "kulup", ad: "?" }} sag={{ tip: "kulup", ad: "?" }} style={{ marginTop: SPACING.md }} />
            </View>
          )}

          {/* --- AÇILIŞ / YARIŞ / SONUÇ: iki takım --- */}
          {takimlarAcik && durum.teamA && durum.teamB ? (
            <>
              <EslesmeKarti sol={{ tip: "kulup", ad: benimTakim }} sag={{ tip: "kulup", ad: rakipTakim }} style={{ marginBottom: SPACING.xs }} />
              <View style={styles.sahipSatir}>
                <Text style={styles.sahipYazi}>{_t("senin seçimin")}</Text>
                <Text style={styles.sahipYazi}>{_t("rakibin seçimi")}</Text>
              </View>
            </>
          ) : null}

          {faz === "gecersiz" && (
            <View style={styles.sonucKart}>
              <Text style={styles.sonucBaslik}>{durum.gecersizSebep === "ayni" ? _t("Aynı takımı seçtiniz!") : _t("Bu ikilinin yeterli ortak futbolcusu yok")}</Text>
              <Text style={styles.sonucAltBaslik}>{_t("Puan yok — yeniden seçiyorsunuz…")}</Text>
            </View>
          )}

          {faz === "yaris" && (
            <>
              <TimerBar current={kalanSn} total={yarisToplam} />
              <Text style={styles.sayacText}>{kalanSn}{" "}{_t("sn")}</Text>
              {elendim ? (
                <Text style={styles.aciklama}>{rakipElendi ? _t("İkiniz de elendiniz") : _t("Bu turda elendin — rakip deniyor")}</Text>
              ) : (
                <Text style={styles.aciklama}>{_t("İki takımda da oynamış futbolcuyu önce yaz · yanlış hakkın: {0}", [Math.max(0, YANLIS_HAKKI - benimYanlis)])}{rakipElendi ? " · " + _t("rakip elendi") : ""}</Text>
              )}
            </>
          )}

          {/* --- TUR / MAÇ SONU --- */}
          {(faz === "turSonu" || faz === "macSonu") && (
            <View style={styles.sonucKart}>
              <Text style={styles.sonucBaslik}>
                {durum.turKazanani === benKimim ? _t("Puan senin!") : durum.turKazanani ? _t("Puan rakibin") : _t("Kimse bilemedi")}
              </Text>
              {durum.sonCevap?.dogru && durum.sonCevap?.ad ? (
                <>
                  <View style={{ marginVertical: SPACING.md }}>
                    <PlayerPhoto name={durum.sonCevap.ad} size={88} />
                  </View>
                  <Text style={styles.sonucAd}>{durum.sonCevap.ad}</Text>
                </>
              ) : null}
              <Text style={styles.ornekBaslik}>{_t("Geçerli cevaplardan bazıları")}</Text>
              <Text style={styles.ornekMetin}>{ornekCevaplar(durum).join(" · ")}</Text>
              {faz === "macSonu" ? null : <Text style={styles.bekleme}>{_t("Sıradaki tur: yine ikiniz de takım seçeceksiniz")}</Text>}
            </View>
          )}
          {faz === "macSonu" && (
            <OnlineMacSonu
              oda={room}
              modAdi={_t("Online — Takımı Sen Seç")}
              durum={durum}
              benKimim={benKimim}
              rakipVar={rakipVar}
              gonder={gonder}
              onExit={onExit}
              skorSen={benimSkor}
              skorRakip={rakipSkor}
              skorEtiketi={_t("puan")}
              kazanan={benimSkor > rakipSkor ? "sen" : benimSkor < rakipSkor ? "rakip" : "berabere"}
            />
          )}
        </ScrollView>

        {/* Cevap girişi — yarışta, elenmediysem */}
        {faz === "yaris" && !elendim && (
          <View style={styles.altAlan}>
            {/* Paket 43 — Bilemedim cevap kutusunun ÜSTÜNDE (klavyeden uzak). */}
            <View style={styles.bilemedimSatir}>
              <BilemedimDugmesi onPress={() => gonder({ tip: "pes" })} />
            </View>
            {oyuncuOnerileri.length > 0 && (
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
                placeholder={_t("Futbolcu adı yaz...")}
                placeholderTextColor={COLORS.textFaint}
                value={cevapGirdi}
                onChangeText={(m) => { yazmaOldu(); setCevapGirdi(m); }}
                onSubmitEditing={() => cevapGonder()}
                returnKeyType="send"
                blurOnSubmit={false}
                autoCorrect={false}
                autoFocus
              />
              <MikrofonDugmesi onMetin={(m) => setCevapGirdi(m)} onGonder={(m) => cevapGonder(m)} />
              <SoundPressable style={styles.gonderBtn} onPress={() => cevapGonder()} accessibilityLabel={_t("Gönder")}>
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
            <Text style={styles.cikisText}>{_t("Odadan çık")}</Text>
          </SoundPressable>
        )}
      </KlavyeAlani>
      {faz === "geriSayim" ? <CountdownOverlay key={fazAnahtari} onComplete={() => {}} /> : null}
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
  skorEtiket: { ...TYPE.caption, fontSize: 12, letterSpacing: 1 },
  skorDeger: { ...TYPE.h1, color: VURGU.main },
  turKutu: { flex: 1.2, alignItems: "center" },
  turEtiket: { ...TYPE.h3, fontSize: 14 },
  hedefEtiket: { ...TYPE.caption, fontSize: 12, textAlign: "center" },
  kopukEtiket: { ...TYPE.caption, fontSize: 12, color: COLORS.danger, marginTop: 2 },

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
  ornekBaslik: { ...TYPE.caption, fontSize: 12, letterSpacing: 1, marginTop: SPACING.md, textTransform: "uppercase" },
  ornekMetin: { ...TYPE.caption, textAlign: "center", marginTop: 2 },
  macSonuText: { ...TYPE.h1, color: COLORS.cta, marginTop: SPACING.md, textAlign: "center" },

  bilemedimSatir: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
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
  rakipDurum: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.lg },
  rakipDurumYazi: { ...TYPE.caption, fontWeight: "800" },
  sahipSatir: { flexDirection: "row", justifyContent: "space-around", marginBottom: SPACING.md },
  sahipYazi: { ...TYPE.caption, fontSize: 11, letterSpacing: 0.5 },
});
