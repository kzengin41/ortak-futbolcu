import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { KlavyeAlani, useKlavyeAcik } from "../components/Klavye";
import SoundPressable from "../components/SoundPressable";
import OnlineMacSonu from "../components/OnlineMacSonu";
import { MasaKartlari, TahminTablosu, SimdiBilirsenAfis, AcilisAnimasyonu, sayi } from "../components/KimBuMasa";
import { prefetchPlayerPhoto } from "../components/PlayerPhoto";
import { COLORS, RADIUS, SPACING, TYPE, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { buildSuggestIndex, suggestPlayers } from "../lib/gameEngine";
import { carpan, acilabilirMi, ASGARI_PUAN } from "../lib/kimBuMasa";
import { masaHazirla, karsilastirAd, gizliMi, oyuncuBul, taninmisHavuz } from "../lib/kimBuVeri";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import { useOnlineRoom, rovansli } from "../lib/onlineRoom";
import { baslangicDurumu, aksiyonuIsle, pot, TUR_ARASI_MS, HEDEF_TUR } from "../lib/onlineWhoAmI";

// ============================================================================
// ONLINE — KİM BU FUTBOLCU? AYNI MASADA DÜELLO (Paket 13, 5 Ekim 2026)
// Kurallar lib/onlineWhoAmI.js; masa çizimi components/KimBuMasa.js (tek
// kişilik Kim Bu ile aynı). Gizli futbolcuyu ev sahibi seçer: fotoğraflı ve
// en tanınmış ilk 600 futbolcudan.
// ============================================================================
const VURGU = MODE_COLORS.whoAmI;

function yeniMasa(kullanilanlar) {
  const havuz = taninmisHavuz(600).filter((p) => !kullanilanlar.includes(p.name));
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
  const benKilitli = !!durum?.kilitli?.includes(benKimim);
  const benPas = !!durum?.pas?.includes(benKimim);
  const rakipNo = benKimim === 1 ? 2 : 1;

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
        ? (o.bedava ? `Ortak kulüp: ${o.ortak.join(", ")} — kart bedava açıldı. Bir kart çevrilene kadar bekle.` : `${o.ad} değil — bir kart çevrilene kadar tahmin yok`)
        : `Rakip "${o.ad}" dedi, olmadı${o.bedava ? ` (ortak kulüp kartı açıldı)` : ""}`);
    } else if (o.tip === "bilinmeyen" && ben) setUyari(`"${o.metin}" diye bir futbolcu bulamadım`);
    else if (o.tip === "tekrar" && ben) setUyari(`${o.ad} zaten denendi`);
    else if (o.tip === "kart") setUyari(ben ? null : "Rakip bir kart çevirdi — tahmin hakkın açıldı");
    else if (o.tip === "pas") setUyari(ben ? "Bu turu pas geçtin" : "Rakip pas geçti");
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
    if (!yazi || benKilitli || benPas || faz !== "oynaniyor") return;
    setGirdi("");
    gonder({ tip: "tahmin", metin: yazi });
  }
  function kartCevir(k) {
    if (faz !== "oynaniyor" || benPas) return;
    if (!acilabilirMi(durum.masa, durum.acik, k)) {
      setUyari(`Pot yetmiyor: bu kart ${sayi(k.bedel)}, pot ${sayi(ASGARI_PUAN)}'in altına inemez.`);
      return;
    }
    gonder({ tip: "kartCevir", id: k.id });
  }

  // ---------------------------------------------------------------- bekleme
  if (!durum || faz === "hazirlik" || faz === "hata") {
    const yazi = !durum
      ? (senkronBekliyor ? "Odaya bağlanılıyor..." : "Ev sahibine ulaşılamadı. Bağlantını kontrol edip tekrar dene.")
      : faz === "hata" ? "Gizli futbolcu seçilemedi. Odadan çıkıp tekrar dene."
      : rakipVar ? "Masa kuruluyor..." : "Rakip bekleniyor...";
    return (
      <GameBackground style={styles.merkez}>
        {(senkronBekliyor || faz === "hazirlik") && <ActivityIndicator color={VURGU.main} />}
        <Text style={styles.bekleme}>{yazi}</Text>
        {faz === "hazirlik" && room.code ? <Text style={styles.odaKodu}>{room.code}</Text> : null}
        <SoundPressable onPress={onExit} style={styles.ikincilBtn}>
          <Text style={styles.ikincilBtnText}>Lobiye dön</Text>
        </SoundPressable>
      </GameBackground>
    );
  }

  const benimTur = benKimim === 1 ? durum.turlar.p1 : durum.turlar.p2;
  const rakipTur = benKimim === 1 ? durum.turlar.p2 : durum.turlar.p1;
  const benimPuan = benKimim === 1 ? durum.skorlar.p1 : durum.skorlar.p2;
  const rakipPuan = benKimim === 1 ? durum.skorlar.p2 : durum.skorlar.p1;
  const kimEtiketi = (t) => (t.kimden === benKimim ? "SEN" : "RAKİP");

  const skorSeridi = (
    <View style={styles.ustSerit}>
      <View style={styles.skorKutu}>
        <Text style={styles.skorEtiket}>SEN</Text>
        <Text style={[styles.skorTur, { color: COLORS.accent }]}>{benimTur}</Text>
        <Text style={styles.skorPuan}>{sayi(benimPuan)} p</Text>
      </View>
      <View style={styles.turKutu}>
        <Text style={styles.turEtiket}>TUR {durum.turNo}</Text>
        <Text style={styles.hedefEtiket}>{HEDEF_TUR} turu alan kazanır</Text>
        {!rakipVar && faz !== "macSonu" ? <Text style={styles.kopuk}>rakip bağlı değil</Text> : null}
      </View>
      <View style={styles.skorKutu}>
        <Text style={styles.skorEtiket}>RAKİP</Text>
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
        {skorSeridi}
        <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl }} showsVerticalScrollIndicator={false}>
          <AcilisAnimasyonu
            key={`acilis-${durum.turNo}`}
            masa={durum.masa}
            acik={durum.acik}
            ad={durum.gizli}
            dogru={kazandim}
            baslik={durum.turKazanani === 0 ? "KİMSE BİLEMEDİ" : kazandim ? `TUR SENİN · +${sayi(durum.turPuani)}` : `RAKİP BİLDİ · +${sayi(durum.turPuani)}`}
            baslikRengi={durum.turKazanani === 0 ? COLORS.text : kazandim ? COLORS.accent : COLORS.cta}
            altSatir={[durum.masa.kimlik.find((k) => k.id === "mevki")?.deger, durum.masa.kimlik.find((k) => k.id === "bayrak")?.deger].filter(Boolean).join(" · ")}
            kartlariGoster={faz !== "macSonu"}
          />
          {faz === "macSonu" ? (
            <OnlineMacSonu
              modAdi="Online — Kim Bu Futbolcu?"
              durum={durum}
              benKimim={benKimim}
              rakipVar={rakipVar}
              gonder={gonder}
              onExit={onExit}
              skorSen={benimTur}
              skorRakip={rakipTur}
              skorEtiketi="tur"
              kazanan={benimTur > rakipTur ? "sen" : benimTur < rakipTur ? "rakip" : "berabere"}
              ekSatir={<Text style={styles.bekleme}>Puan: sen {sayi(benimPuan)} · rakip {sayi(rakipPuan)}</Text>}
            />
          ) : (
            <Text style={styles.bekleme}>Sıradaki futbolcu birazdan...</Text>
          )}
        </ScrollView>
      </GameBackground>
    );
  }

  // ---------------------------------------------------------------- oyun
  const carp = carpan(durum.acik);
  return (
    <GameBackground style={styles.kap}>
      {skorSeridi}
      <KlavyeAlani style={{ flex: 1 }}>
        <SimdiBilirsenAfis puan={pot(durum)} carp={carp} kucuk={klavyeAcik} alt="ilk bilen alır" />
        <View style={styles.cevap}>
          {benPas ? (
            <Text style={styles.kilitText}>Bu turu pas geçtin — rakibi izliyorsun</Text>
          ) : benKilitli ? (
            <Text style={styles.kilitText}>Yanlış tahmin — biri kart çevirince yeniden tahmin edebilirsin</Text>
          ) : (
            <View style={styles.cevapSatir}>
              <Ionicons name="search" size={18} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
              <TextInput
                style={styles.cevapGirdi}
                autoCorrect={false}
                autoCapitalize="words"
                placeholder="Bu futbolcu kim?"
                placeholderTextColor={COLORS.textMuted}
                value={girdi}
                onChangeText={(t) => { setGirdi(t); if (uyari) setUyari(null); }}
                onSubmitEditing={() => tahminGonder()}
                returnKeyType="send"
              />
              <SoundPressable onPress={() => tahminGonder()} style={styles.gonder} accessibilityLabel="Tahmini gönder">
                <Ionicons name="arrow-forward" size={20} color={COLORS.accentDark} />
              </SoundPressable>
            </View>
          )}
          {oneriler.length > 0 && !benKilitli && !benPas ? (
            <View style={styles.oneriler}>
              {oneriler.slice(0, klavyeAcik ? 3 : 4).map((ad) => (
                <SoundPressable key={ad} style={styles.oneri} onPress={() => tahminGonder(ad)}>
                  <Ionicons name="person-circle-outline" size={18} color={COLORS.textMuted} />
                  <Text style={styles.oneriYazi} numberOfLines={1}>{ad}</Text>
                </SoundPressable>
              ))}
            </View>
          ) : null}
          {uyari ? <Text style={styles.uyari}>{uyari}</Text> : null}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TahminTablosu tahminler={durum.tahminler} baslik="TAHMİNLER" etiket={kimEtiketi} />
          <MasaKartlari
            masa={durum.masa}
            acik={durum.acik}
            onKartCevir={benPas ? undefined : kartCevir}
            turAnahtari={`${durum.turNo}:`}
            fotoAd={durum.gizli}
          />
          <Text style={styles.not}>Çevirdiğin kart rakibe de açılır ve potu ikiniz için düşürür.</Text>
          {!benPas ? (
            <SoundPressable style={styles.pasBtn} onPress={() => gonder({ tip: "pas" })}>
              <Ionicons name="flag-outline" size={16} color={COLORS.danger} />
              <Text style={styles.pasYazi}>Bu turu pas geç</Text>
            </SoundPressable>
          ) : null}
          <SoundPressable onPress={onExit} style={styles.cikisBtn}>
            <Text style={styles.ikincilBtnText}>Odadan çık</Text>
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
  cevapGirdi: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "600", paddingVertical: 0 },
  gonder: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },
  oneriler: { marginTop: 4, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  oneri: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, paddingHorizontal: SPACING.md },
  oneriYazi: { color: COLORS.text, fontSize: 15, fontWeight: "600", flex: 1 },
  uyari: { marginTop: 6, fontSize: 13, fontWeight: "700", color: COLORS.cta },
  kilitText: { ...TYPE.caption, color: COLORS.danger, textAlign: "center", paddingVertical: SPACING.md, fontWeight: "800" },

  icerik: { paddingHorizontal: SPACING.lg, paddingBottom: 48 },
  not: { ...TYPE.caption, fontSize: 12, textAlign: "center", marginTop: SPACING.md },
  pasBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, marginTop: SPACING.md,
    borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.danger, backgroundColor: "rgba(255,93,93,0.10)",
  },
  pasYazi: { fontSize: 15, fontWeight: "800", color: COLORS.danger },
});
