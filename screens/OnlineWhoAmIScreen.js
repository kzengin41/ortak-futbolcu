import { _t } from "../lib/dil";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { KlavyeAlani, useKlavyeAcik } from "../components/Klavye";
import SoundPressable from "../components/SoundPressable";
import OnlineMacSonu from "../components/OnlineMacSonu";
import RakipAyrildi from "../components/RakipAyrildi";
import { MasaKartlari, TahminTablosu, SimdiBilirsenAfis, AcilisAnimasyonu, sayi } from "../components/KimBuMasa";
import { prefetchPlayerPhoto } from "../components/PlayerPhoto";
import { COLORS, RADIUS, SPACING, TYPE, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { PLAYER_LAST_ACTIVE_YEAR } from "../lib/playerYears";
import { oyundaCikmasin } from "../lib/taninirlik";
import { buildSuggestIndex, suggestPlayers } from "../lib/gameEngine";
import { ASGARI_PUAN } from "../lib/kimBuMasa";
import { masaHazirla, karsilastirAd, gizliMi, oyuncuBul, taninmisHavuz } from "../lib/kimBuVeri";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import { useOnlineRoom, rovansli, macSirasi } from "../lib/onlineRoom";
import { baslangicDurumu, aksiyonuIsle, potu, carpani, alabilirMi, TUR_ARASI_MS, HEDEF_TUR, HAMLE_SURESI_SN, YANLIS_CEZA } from "../lib/onlineWhoAmI";
import TimerBar from "../components/TimerBar";
import MikrofonDugmesi from "../components/MikrofonDugmesi";

// ============================================================================
// ONLINE — KİM BU FUTBOLCU? SIRAYLA OYNANAN MASA (Paket 37, 16 Ekim 2026)
// Kurallar lib/onlineWhoAmI.js (herkesin kendi potu, hamleler sırayla); masa
// çizimi components/KimBuMasa.js (tek kişilik Kim Bu ile aynı). Gizli futbolcuyu
// ev sahibi seçer (aşağıdaki havuz).
// ============================================================================
const VURGU = MODE_COLORS.whoAmI;

// Paket 36 (Kerem: "hidetoshi nakata diye biri çıktı bu kim?") — ESKİ: en
// tanınmış ilk 600 (Nakata 463. sıradaydı). YENİ: herkesin bileceği isimler —
// en tanınmış ilk ONLINE_HAVUZ (Türk futbolsever gözüyle tanınırlık), 1998'den
// sonra oynamış (Puskás/Di Stéfano gibi efsaneler ipucuyla tahmin edilemiyor),
// popülerlik panelinde "oyunda çıkmasın" denenler hariç.
//
// Paket 37 (Kerem: "200 futbolcu az değil mi? nakata … 5000'e at") — havuz 500'e
// çıktı ama turlar kademeli: 1. tur en tanınmış 150'den, 2. tur 300'den, sonra
// 500'den. Nakata tanınırlıkta 5000. sıraya indirildi (scripts/populerlik_ayar.json).
export const ONLINE_HAVUZ = 500;
export const TUR_KADEMESI = [150, 300, 500];
let _onlineHavuz = null;
export function onlineKimBuHavuzu() {
  if (!_onlineHavuz) {
    _onlineHavuz = taninmisHavuz(2000)
      .filter((p) => !oyundaCikmasin(p) && (PLAYER_LAST_ACTIVE_YEAR[p.name] || 0) >= 1995)
      .slice(0, ONLINE_HAVUZ);
  }
  return _onlineHavuz;
}
function yeniMasa(kullanilanlar, turNo = 1) {
  const ust = TUR_KADEMESI[Math.min(TUR_KADEMESI.length, Math.max(1, turNo)) - 1];
  const havuz = onlineKimBuHavuzu().slice(0, ust).filter((p) => !kullanilanlar.includes(p.name));
  if (!havuz.length) return null;
  const p = havuz[Math.floor(Math.random() * havuz.length)];
  return { gizli: p.name, masa: masaHazirla(p) };
}
const BAGLAM = { yeniMasa, gizliMi, oyuncuBul, karsilastirAd };

export default function OnlineWhoAmIScreen({ room, onExit }) {
  const benKimim = room.playerNumber;
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const klavyeAcik = useKlavyeAcik();

  const aksiyonIsle = useMemo(() => rovansli((d, a, k) => aksiyonuIsle(d, a, k, BAGLAM)), []);
  const ilkDurum = useMemo(() => baslangicDurumu(), []);
  const { durum, hostMuyum, rakipVar, senkronBekliyor, gonder, guncelle } = useOnlineRoom({
    kanalAdi: `whoami-${room.id}`,
    benKimim,
    baslangicDurumu: ilkDurum,
    aksiyonIsle,
  });

  const [girdi, setGirdi] = useState("");
  const [uyari, setUyari] = useState(null);
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => (girdi.trim().length > 1 ? suggestPlayers(suggestIndex, girdi) : []), [suggestIndex, girdi]);

  const faz = durum?.faz;
  // Paket 23 — dereceli maçta rakip düşerse geri sayım; dönmezse galibiyet.
  const ayrildi = <RakipAyrildi oda={room} benKimim={benKimim} rakipVar={rakipVar} aktif={!!faz && !["hazirlik", "macSonu", "hata"].includes(faz)} macNo={macSirasi(durum)} onExit={onExit} />;
  const benPas = !!durum?.pes?.includes(benKimim);
  const rakipNo = benKimim === 1 ? 2 : 1;
  const siraBende = faz === "oynaniyor" && durum?.sira === benKimim && !benPas;

  // --- Host: rakip gelince ilk tur; tur sonu → sıradaki tur ----------------
  useEffect(() => {
    if (!hostMuyum || faz !== "hazirlik" || !rakipVar) return;
    const t = setTimeout(() => gonder({ tip: "baslat" }), 60);
    return () => clearTimeout(t);
  }, [hostMuyum, faz, rakipVar, gonder]);
  useEffect(() => {
    if (!hostMuyum || faz !== "turSonu") return;
    const t = setTimeout(() => guncelle((d) => aksiyonIsle(d, { tip: "sonrakiTur" }, 1)), TUR_ARASI_MS);
    return () => clearTimeout(t);
  }, [hostMuyum, faz, durum?.turNo, guncelle, aksiyonIsle]);

  // --- Host: hamle süresi (dolarsa sıradakinin yerine en ucuz kart çevrilir) ---
  useEffect(() => {
    if (!hostMuyum || faz !== "oynaniyor" || !durum) return;
    const no = durum.hamleNo;
    const t = setTimeout(() => guncelle((d) => aksiyonIsle(d, { tip: "sureDoldu", hamleNo: no }, 1)), HAMLE_SURESI_SN * 1000 + 1500);
    return () => clearTimeout(t);
  }, [hostMuyum, faz, durum?.hamleNo, durum?.turNo, guncelle, aksiyonIsle]);
  // --- Herkes: görünen sayaç (her hamlede baştan) ---------------------------
  const [kalan, setKalan] = useState(HAMLE_SURESI_SN);
  useEffect(() => { setKalan(HAMLE_SURESI_SN); }, [durum?.hamleNo, durum?.turNo]);
  useEffect(() => {
    if (faz !== "oynaniyor" || kalan <= 0) return;
    const t = setTimeout(() => setKalan((x) => Math.max(0, x - 1)), 1000);
    return () => clearTimeout(t);
  }, [kalan, faz]);

  useEffect(() => { if (durum?.gizli) prefetchPlayerPhoto(durum.gizli); }, [durum?.gizli]);
  useEffect(() => { setGirdi(""); setUyari(null); }, [durum?.turNo]);

  // --- Olay geri bildirimi (ses + uyarı), olay başına bir kez --------------
  const islenenRef = useRef(null);
  useEffect(() => {
    const o = durum?.sonOlay;
    if (!o) return;
    const k = `${durum.turNo}:${JSON.stringify(o)}:${durum.tahminler.length}:${Object.keys(durum.acik).length}`;
    if (islenenRef.current === k) return;
    islenenRef.current = k;
    const ben = o.kimden === benKimim;
    if (o.tip === "yanlis") {
      if (ben) playWrong();
      setUyari(ben
        ? _t("{0} değil — potundan {1} gitti{2}. Sıra rakipte.", [
        o.ad,
        sayi(YANLIS_CEZA),
        o.bedava ? _t(" (ortak kulüp: {0} — kart bedava açıldı)", [o.ortak.join(", ")]) : ""
      ])
        : _t(
        "Rakip \"{0}\" dedi, olmadı{1}. Sıra sende!",
        [o.ad, o.bedava ? _t(" (ortak kulüp kartı bedava açıldı)") : ""]
      ));
    } else if (o.tip === "bilinmeyen" && ben) setUyari(_t("\"{0}\" diye bir futbolcu bulamadım — hamle sayılmadı", [o.metin]));
    else if (o.tip === "tekrar" && ben) setUyari(_t("{0} zaten denendi — hamle sayılmadı", [o.ad]));
    else if (o.tip === "kart") setUyari(ben ? _t("Kartı aldın (−{0}). Sıra rakipte.", [sayi(o.bedel)]) : _t(
      "Rakip bir kart çevirdi (kendi potundan {0}). Sıra sende!",
      [sayi(o.bedel)]
    ));
    else if (o.tip === "sureKart") setUyari(ben ? _t(
      "Süren doldu — en ucuz kart senin potundan açıldı (−{0}).",
      [sayi(o.bedel)]
    ) : _t("Rakibin süresi doldu, onun potundan bir kart açıldı. Sıra sende!"));
    else if (o.tip === "sure") setUyari(ben ? _t("Süren doldu — sıra rakipte.") : _t("Rakibin süresi doldu. Sıra sende!"));
    else if (o.tip === "pes") setUyari(ben ? _t("Bu turdan çekildin — rakip tek başına devam ediyor") : _t("Rakip pes etti — sıra hep sende, potun eriyene kadar dene"));
  }, [durum?.sonOlay, durum?.turNo, benKimim, playWrong]);

  // --- Tur / maç sonu: ses, koleksiyon, istatistik --------------------------
  const islenenTurRef = useRef(-1);
  useEffect(() => {
    if ((faz !== "turSonu" && faz !== "macSonu") || islenenTurRef.current === durum.turNo) return;
    islenenTurRef.current = durum.turNo;
    if (!durum.turKazanani) return;
    const kazandim = durum.turKazanani === benKimim;
    if (kazandim) { playCorrect(); unlockPlayer(durum.gizli); } else playWrong();
    recordRound("onlineWhoAmI", kazandim);
  }, [faz, durum?.turNo, durum?.turKazanani, benKimim, playCorrect, playWrong]);
  const macIslendiRef = useRef(false);
  useEffect(() => {
    if (faz !== "macSonu") { if (faz === "oynaniyor") macIslendiRef.current = false; return; }
    if (macIslendiRef.current) return;
    macIslendiRef.current = true;
    const ben = benKimim === 1 ? durum.turlar.p1 : durum.turlar.p2;
    const rk = benKimim === 1 ? durum.turlar.p2 : durum.turlar.p1;
    addXP(ben > rk ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI);
  }, [faz, benKimim, durum?.turlar]);

  function tahminGonder(metin) {
    const yazi = String(metin ?? girdi).trim();
    if (!yazi || faz !== "oynaniyor") return;
    if (!siraBende) { setUyari(benPas ? _t("Bu turdan çekildin") : _t("Sıra rakipte — sıran gelince gönder")); return; }
    setGirdi("");
    gonder({ tip: "tahmin", metin: yazi });
  }
  function kartCevir(k) {
    if (faz !== "oynaniyor") return;
    if (!siraBende) { setUyari(benPas ? _t("Bu turdan çekildin") : _t("Sıra rakipte — sıran gelince kart çevirebilirsin")); return; }
    if (!alabilirMi(durum, benKimim, k)) {
      setUyari(_t(
        "Potun yetmiyor: bu kart {0}, potun {1}'in altına inemez.",
        [sayi(k.bedel), sayi(ASGARI_PUAN)]
      ));
      return;
    }
    gonder({ tip: "kartCevir", id: k.id });
  }

  // ---------------------------------------------------------------- bekleme
  if (!durum || faz === "hazirlik" || faz === "hata") {
    const yazi = !durum
      ? (senkronBekliyor ? _t("Odaya bağlanılıyor...") : _t("Ev sahibine ulaşılamadı. Bağlantını kontrol edip tekrar dene."))
      : faz === "hata" ? _t("Gizli futbolcu seçilemedi. Odadan çıkıp tekrar dene.")
      : rakipVar ? _t("Masa kuruluyor...") : _t("Rakip bekleniyor...");
    return (
      <GameBackground style={styles.merkez}>
        {(senkronBekliyor || faz === "hazirlik") && <ActivityIndicator color={VURGU.main} />}
        <Text style={styles.bekleme}>{yazi}</Text>
        {faz === "hazirlik" && room.code ? <Text style={styles.odaKodu}>{room.code}</Text> : null}
        <SoundPressable onPress={onExit} style={styles.ikincilBtn}>
          <Text style={styles.ikincilBtnText}>{_t("Lobiye dön")}</Text>
        </SoundPressable>
      </GameBackground>
    );
  }

  const benimTur = benKimim === 1 ? durum.turlar.p1 : durum.turlar.p2;
  const rakipTur = benKimim === 1 ? durum.turlar.p2 : durum.turlar.p1;
  const benimPuan = benKimim === 1 ? durum.skorlar.p1 : durum.skorlar.p2;
  const rakipPuan = benKimim === 1 ? durum.skorlar.p2 : durum.skorlar.p1;
  const kimEtiketi = (t) => (t.kimden === benKimim ? _t("SEN") : _t("RAKİP"));

  const skorSeridi = (
    <View style={styles.ustSerit}>
      <View style={styles.skorKutu}>
        <Text style={styles.skorEtiket}>{_t("SEN")}</Text>
        <Text style={[styles.skorTur, { color: COLORS.accent }]}>{benimTur}</Text>
        <Text style={styles.skorPuan}>{sayi(benimPuan)} p</Text>
      </View>
      <View style={styles.turKutu}>
        <Text style={styles.turEtiket}>{_t("TUR")}{" "}{durum.turNo}</Text>
        <Text style={styles.hedefEtiket}>{HEDEF_TUR}{" "}{_t("turu alan kazanır")}</Text>
        {!rakipVar && faz !== "macSonu" ? <Text style={styles.kopuk}>{_t("rakip bağlı değil")}</Text> : null}
      </View>
      <View style={styles.skorKutu}>
        <Text style={styles.skorEtiket}>{_t("RAKİP")}</Text>
        <Text style={[styles.skorTur, { color: COLORS.cta }]}>{rakipTur}</Text>
        <Text style={styles.skorPuan}>{sayi(rakipPuan)} p</Text>
      </View>
    </View>
  );

  // ---------------------------------------------------------------- tur / maç sonu
  if (faz === "turSonu" || faz === "macSonu") {
    const kazandim = durum.turKazanani === benKimim;
    return (
      <GameBackground style={styles.kap}>
        {ayrildi}
        {skorSeridi}
        <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl }} showsVerticalScrollIndicator={false}>
          <AcilisAnimasyonu
            key={`acilis-${durum.turNo}`}
            masa={durum.masa}
            acik={durum.acik}
            ad={durum.gizli}
            dogru={kazandim}
            baslik={durum.turKazanani === 0 ? _t("KİMSE BİLEMEDİ") : kazandim ? _t("TUR SENİN · +{0}", [sayi(durum.turPuani)]) : _t("RAKİP BİLDİ · +{0}", [sayi(durum.turPuani)])}
            baslikRengi={durum.turKazanani === 0 ? COLORS.text : kazandim ? COLORS.accent : COLORS.cta}
            altSatir={[durum.masa.kimlik.find((k) => k.id === "mevki")?.deger, durum.masa.kimlik.find((k) => k.id === "bayrak")?.deger].filter(Boolean).join(" · ")}
            kartlariGoster={faz !== "macSonu"}
          />
          {faz === "macSonu" ? (
            <OnlineMacSonu
              oda={room}
              modAdi={_t("Online — Kim Bu Futbolcu?")}
              durum={durum}
              benKimim={benKimim}
              rakipVar={rakipVar}
              gonder={gonder}
              onExit={onExit}
              skorSen={benimTur}
              skorRakip={rakipTur}
              skorEtiketi={_t("tur")}
              kazanan={benimTur > rakipTur ? "sen" : benimTur < rakipTur ? "rakip" : "berabere"}
              ekSatir={<Text style={styles.bekleme}>{_t("Puan: sen")}{" "}{sayi(benimPuan)}{" "}{_t("· rakip")}{" "}{sayi(rakipPuan)}</Text>}
            />
          ) : (
            <Text style={styles.bekleme}>{_t("Sıradaki futbolcu birazdan...")}</Text>
          )}
        </ScrollView>
      </GameBackground>
    );
  }

  // ---------------------------------------------------------------- oyun
  const benimPot = potu(durum, benKimim);
  const rakipPot = potu(durum, rakipNo);
  const carp = carpani(durum, benKimim);
  const rakipPes = durum.pes.includes(rakipNo);
  return (
    <GameBackground style={styles.kap}>
      {ayrildi}
      {skorSeridi}
      <KlavyeAlani style={{ flex: 1 }}>
        <View style={styles.potSatir}>
          <View style={[styles.potKutu, styles.benimPot]}>
            <Text style={styles.benimPotEt}>{_t("SENİN POTUN")}</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
              <Text style={styles.benimPotSayi}>{sayi(benimPot)}</Text>
              {carp > 1 ? <Text style={styles.benimPotCarpan}>×{String(carp).replace(".", ",")}</Text> : null}
            </View>
          </View>
          <View style={styles.potKutu}>
            <Text style={styles.rakipPotEt}>{_t("RAKİBİN POTU")}</Text>
            <Text style={styles.rakipPotSayi}>{rakipPes ? _t("pes etti") : sayi(rakipPot)}</Text>
          </View>
        </View>
        <View style={[styles.siraKutu, siraBende ? styles.siraBende : styles.siraRakipte]}>
          <Ionicons name={siraBende ? "flash" : "hourglass-outline"} size={16} color={siraBende ? COLORS.accent : COLORS.textMuted} />
          <Text style={[styles.siraYazi, siraBende && { color: COLORS.accent }]}>
            {benPas ? _t("Bu turdan çekildin — izliyorsun") : siraBende ? _t("SIRA SENDE: bir kart çevir ya da tahmin et") : _t("Sıra rakipte — hamlesini bekle")}
          </Text>
          <Text style={[styles.siraSure, kalan <= 5 && { color: COLORS.danger }]}>{kalan}{" "}{_t("sn")}</Text>
        </View>
        <View style={{ marginHorizontal: SPACING.lg }}><TimerBar current={kalan} total={HAMLE_SURESI_SN} /></View>
        <View style={styles.cevap}>
          {benPas ? null : (
            <View style={[styles.cevapSatir, !siraBende && styles.cevapPasif]}>
              <Ionicons name="search" size={18} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
              <TextInput
                style={styles.cevapGirdi}
                autoCorrect={false}
                autoCapitalize="words"
                placeholder={siraBende ? _t("Bu futbolcu kim?") : _t("Düşün… sıran gelince gönder")}
                placeholderTextColor={COLORS.textMuted}
                value={girdi}
                onChangeText={(t) => { setGirdi(t); if (uyari) setUyari(null); }}
                onSubmitEditing={() => tahminGonder()}
                returnKeyType="send"
              />
              <MikrofonDugmesi boyut={40} onMetin={(m) => setGirdi(m)} onGonder={(m) => tahminGonder(m)} />
              <SoundPressable onPress={() => tahminGonder()} style={[styles.gonder, !siraBende && { opacity: 0.45 }]} accessibilityLabel={_t("Tahmini gönder")}>
                <Ionicons name="arrow-forward" size={20} color={COLORS.accentDark} />
              </SoundPressable>
            </View>
          )}
          {oneriler.length > 0 && !benPas ? (
            <View style={styles.oneriler}>
              {oneriler.slice(0, klavyeAcik ? 3 : 4).map((ad) => (
                <SoundPressable key={ad} style={styles.oneri} onPress={() => (siraBende ? tahminGonder(ad) : setGirdi(ad))}>
                  <Ionicons name="person-circle-outline" size={18} color={COLORS.textMuted} />
                  <Text style={styles.oneriYazi} numberOfLines={1}>{ad}</Text>
                </SoundPressable>
              ))}
            </View>
          ) : null}
          {uyari ? <Text style={styles.uyari}>{uyari}</Text> : null}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TahminTablosu tahminler={durum.tahminler} baslik={_t("TAHMİNLER")} etiket={kimEtiketi} />
          <MasaKartlari
            masa={durum.masa}
            acik={durum.acik}
            onKartCevir={benPas ? undefined : kartCevir}
            kilitliGetir={(k) => !alabilirMi(durum, benKimim, k)}
            turAnahtari={`${durum.turNo}:`}
            fotoAd={durum.gizli}
          />
          <Text style={styles.not}>{_t(
              "Herkesin potu kendine: çevirdiğin kartın bedeli SENİN potundan düşer ama kart ikinize de açılır. Yanlış tahmin −"
            )}{sayi(YANLIS_CEZA)}{_t(". Her hamle")}{" "}{HAMLE_SURESI_SN}{" "}{_t("sn.")}</Text>
          {!benPas ? (
            <SoundPressable style={styles.pasBtn} onPress={() => gonder({ tip: "pes" })}>
              <Ionicons name="flag-outline" size={16} color={COLORS.danger} />
              <Text style={styles.pasYazi}>{_t("Bu turdan çekil")}</Text>
            </SoundPressable>
          ) : null}
          <SoundPressable onPress={onExit} style={styles.cikisBtn}>
            <Text style={styles.ikincilBtnText}>{_t("Odadan çık")}</Text>
          </SoundPressable>
        </ScrollView>
      </KlavyeAlani>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, paddingTop: SPACING.xxl },
  merkez: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  bekleme: { ...TYPE.caption, marginTop: SPACING.md, textAlign: "center" },
  odaKodu: { ...TYPE.h1, color: VURGU.main, marginTop: SPACING.sm, letterSpacing: 4 },
  ikincilBtn: { marginTop: SPACING.lg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  ikincilBtnText: { ...TYPE.caption, textDecorationLine: "underline" },
  cikisBtn: { alignItems: "center", paddingVertical: SPACING.md },

  ustSerit: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm, paddingHorizontal: SPACING.lg },
  skorKutu: { flex: 1, alignItems: "center", backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 6 },
  skorEtiket: { ...TYPE.caption, fontSize: 12, letterSpacing: 1, fontWeight: "900" },
  skorTur: { fontSize: 26, fontWeight: "900" },
  skorPuan: { ...TYPE.caption, fontSize: 12 },
  turKutu: { flex: 1.1, alignItems: "center" },
  turEtiket: { ...TYPE.h3, fontSize: 14 },
  hedefEtiket: { ...TYPE.caption, fontSize: 12, textAlign: "center" },
  kopuk: { ...TYPE.caption, fontSize: 12, color: COLORS.danger, marginTop: 2 },

  cevap: { marginHorizontal: SPACING.lg, marginTop: SPACING.sm },
  cevapSatir: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 2, borderColor: COLORS.accent, paddingHorizontal: 6, height: 52,
  },
  cevapGirdi: { flex: 1, minWidth: 0, color: COLORS.text, fontSize: 16, fontWeight: "600", paddingVertical: 0 },
  gonder: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },
  oneriler: { marginTop: 4, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  oneri: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, paddingHorizontal: SPACING.md },
  oneriYazi: { color: COLORS.text, fontSize: 15, fontWeight: "600", flex: 1 },
  uyari: { marginTop: 6, fontSize: 13, fontWeight: "700", color: COLORS.cta },
  kilitText: { ...TYPE.caption, color: COLORS.danger, textAlign: "center", paddingVertical: SPACING.md, fontWeight: "800" },
  cevapPasif: { borderColor: COLORS.cardBorder },
  potSatir: { flexDirection: "row", alignItems: "stretch", gap: SPACING.sm, marginHorizontal: SPACING.lg },
  potKutu: {
    flex: 1, borderRadius: 16, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, justifyContent: "center",
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  benimPot: { flex: 1.3, backgroundColor: COLORS.marka, borderColor: COLORS.marka },
  benimPotEt: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: COLORS.markaUst, opacity: 0.85 },
  benimPotSayi: { fontSize: 24, fontWeight: "900", color: COLORS.markaUst, marginTop: 2 },
  benimPotCarpan: { fontSize: 16, fontWeight: "900", color: COLORS.marka2 },
  rakipPotEt: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, color: COLORS.textMuted },
  rakipPotSayi: { fontSize: 20, fontWeight: "900", color: COLORS.cta, marginTop: 2 },
  siraKutu: {
    flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: SPACING.lg, marginTop: SPACING.sm,
    paddingVertical: 8, paddingHorizontal: SPACING.md, borderRadius: 12, borderWidth: 1.5,
  },
  siraBende: { borderColor: COLORS.accent, backgroundColor: "rgba(0,0,0,0.12)" },
  siraRakipte: { borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  siraYazi: { flex: 1, fontSize: 13, fontWeight: "900", color: COLORS.textMuted },
  siraSure: { fontSize: 13, fontWeight: "900", color: COLORS.text },

  icerik: { paddingHorizontal: SPACING.lg, paddingBottom: 48 },
  not: { ...TYPE.caption, fontSize: 12, textAlign: "center", marginTop: SPACING.md },
  pasBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, marginTop: SPACING.md,
    borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.danger, backgroundColor: "rgba(255,93,93,0.10)",
  },
  pasYazi: { fontSize: 15, fontWeight: "800", color: COLORS.danger },
});
