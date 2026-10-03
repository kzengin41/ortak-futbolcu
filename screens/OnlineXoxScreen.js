import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { KlavyeAlani, KlavyeScroll } from "../components/Klavye";
import SoundPressable from "../components/SoundPressable";
import AnswerFeedback from "../components/AnswerFeedback";
import TimerBar from "../components/TimerBar";
import OnlineMacSonu from "../components/OnlineMacSonu";
import { BaslikRozeti } from "./XoxScreen";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { buildSuggestIndex, suggestPlayers } from "../lib/gameEngine";
import { izgaraUret, zorlukAyari10, kosulEtiketi, calinabilirMi, hucreCevaplari, X, O } from "../lib/gridGame";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import { taninirlik } from "../lib/taninirlik";
import { useOnlineRoom, rovansli } from "../lib/onlineRoom";
import { baslangicDurumu, aksiyonuIsle, HAMLE_SURESI_SN, ISARET, sonucBenim, kareSayilari } from "../lib/onlineXox";

// ============================================================================
// ONLINE FUTBOLCU XOX — 5 Ekim 2026 (benchmark .29379)
// Kurallar lib/onlineXox.js (+ lib/gridGame.js), ağ lib/onlineRoom.js.
// Odayı kuran (1) X, katılan (2) O. Izgarayı ev sahibi kendi eşleşme
// profiliyle, orta zorlukta (4/10) ve yalnız kulüplerle kurar; çalma kuralı açık.
// ============================================================================
const VURGU = MODE_COLORS.xox;
const ZORLUK = 4;
const SURE_PAYI_MS = 1500;   // ağ gecikmesi için ev sahibinin süreye eklediği pay

export default function OnlineXoxScreen({ room, onExit }) {
  const benKimim = room.playerNumber;
  const benim = ISARET[benKimim];
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const eslesme = useEslesmeProfili();
  const profilRef = useRef(eslesme.derlenmis);
  profilRef.current = eslesme.derlenmis;

  const baglam = useMemo(() => ({
    veriSeti: PLAYERS,
    izgaraYap: () => izgaraUret(PLAYERS, zorlukAyari10(ZORLUK), Math.random, "kulup", profilRef.current),
  }), []);
  const aksiyonIsle = useMemo(() => rovansli((d, a, k) => aksiyonuIsle(d, a, k, baglam)), [baglam]);
  const ilkDurum = useMemo(() => baslangicDurumu(), []);
  const { durum, hostMuyum, rakipVar, senkronBekliyor, gonder, guncelle } = useOnlineRoom({
    kanalAdi: `xox-${room.id}`,
    benKimim,
    baslangicDurumu: ilkDurum,
    aksiyonIsle,
  });

  const [girdi, setGirdi] = useState("");
  const [geriBildirim, setGeriBildirim] = useState(null);
  const [kalan, setKalan] = useState(null);
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => (girdi.trim().length < 3 ? [] : suggestPlayers(suggestIndex, girdi)), [suggestIndex, girdi]);
  const { width } = useWindowDimensions();
  const logoBoyut = Math.round(Math.max(28, Math.min(58, ((width - SPACING.lg * 2 - 12) / 4) * 0.55)));

  const faz = durum?.faz;
  const oyun = durum?.oyun;
  const siraBende = faz === "oynaniyor" && oyun?.sira === benim;

  // --- Host: rakip gelince maçı başlat (ilk maç ve rövanş) ------------------
  useEffect(() => {
    if (!hostMuyum || faz !== "hazirlik" || !rakipVar) return;
    const t = setTimeout(() => gonder({ tip: "baslat" }), 60);  // göstergeyi bir kare çizdir
    return () => clearTimeout(t);
  }, [hostMuyum, faz, rakipVar, gonder]);

  // --- Host: hamle süresi --------------------------------------------------
  useEffect(() => {
    if (!hostMuyum || faz !== "oynaniyor" || !oyun) return;
    const no = oyun.hamleNo;
    const t = setTimeout(() => guncelle((d) => aksiyonIsle(d, { tip: "sureDoldu", hamleNo: no }, 1)), HAMLE_SURESI_SN * 1000 + SURE_PAYI_MS);
    return () => clearTimeout(t);
  }, [hostMuyum, faz, oyun?.hamleNo, durum?.macNo, guncelle, aksiyonIsle]);

  // --- Herkes: görünen sayaç (her hamlede baştan) ---------------------------
  useEffect(() => {
    if (faz !== "oynaniyor") { setKalan(null); return; }
    setKalan(HAMLE_SURESI_SN);
  }, [faz, oyun?.hamleNo, durum?.macNo]);
  useEffect(() => {
    if (kalan === null || kalan <= 0) return;
    const t = setTimeout(() => setKalan((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => clearTimeout(t);
  }, [kalan]);

  // --- Hamle geri bildirimi + koleksiyon ------------------------------------
  const islenenRef = useRef(null);
  useEffect(() => {
    const h = oyun?.sonHamle;
    if (!h) return;
    // İstemcide her yayın yeni bir nesne: aynı hamleyi iki kez işlememek için anahtar.
    const k = `${durum.macNo}-${oyun.hamleNo}`;
    if (islenenRef.current === k) return;
    islenenRef.current = k;
    const benimki = h.kimden === benim;
    const anahtar = Date.now() + Math.random();
    if (h.tip === "dogru") {
      if (benimki) { playCorrect(); unlockPlayer(h.ad); } else playWrong();
      setGeriBildirim({ anahtar, correct: benimki, message: (h.calma ? "ÇALDI! " : "") + (benimki ? h.ad : `Rakip: ${h.ad}`) });
    } else if (h.tip === "yanlis") {
      if (benimki) playWrong();
      setGeriBildirim({ anahtar, correct: false, message: benimki ? (h.ayniIsim ? "Çalmak için FARKLI bir futbolcu gerekir" : "Bu futbolcu bu ikilide oynamadı") : `Rakip bilemedi: ${h.metin}` });
    } else if (h.tip === "pas") {
      setGeriBildirim({ anahtar, correct: false, message: benimki ? "Pas geçtin" : "Rakip pas geçti" });
    } else if (h.tip === "sure") {
      setGeriBildirim({ anahtar, correct: false, message: benimki ? "Süre doldu, sıra rakipte" : "Rakibin süresi doldu" });
    }
  }, [oyun?.sonHamle, oyun?.hamleNo, durum?.macNo, benim, playCorrect, playWrong]);

  // --- Maç sonu: istatistik + XP (maç başına bir kez) ------------------------
  const islenenMacRef = useRef(0);
  useEffect(() => {
    if (faz !== "macSonu" || !durum?.macNo || islenenMacRef.current === durum.macNo) return;
    islenenMacRef.current = durum.macNo;
    const sonuc = sonucBenim(durum, benKimim);
    if (sonuc === "berabere") return;
    recordRound("onlineXox", sonuc === "sen");
    addXP(sonuc === "sen" ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI);
  }, [faz, durum?.macNo, benKimim, durum]);

  useEffect(() => { setGirdi(""); }, [oyun?.secili, oyun?.hamleNo]);

  const hamle = useCallback((a) => gonder({ tip: "hamle", a }), [gonder]);
  function kareyeDokun(satir, sutun) {
    if (!siraBende) return;
    hamle({ tip: "hucreSec", satir, sutun });
  }
  function cevapGonder(ad) {
    const metin = String(ad ?? girdi).trim();
    if (!metin || !siraBende || !oyun?.secili) return;
    setGirdi("");
    hamle({ tip: "cevap", metin });
  }

  // ---------------------------------------------------------------- bekleme
  if (!durum || faz === "hazirlik" || faz === "hata") {
    const yazi = !durum
      ? (senkronBekliyor ? "Odaya bağlanılıyor..." : "Ev sahibine ulaşılamadı. Bağlantını kontrol edip tekrar dene.")
      : faz === "hata" ? "Izgara kurulamadı. Odadan çıkıp tekrar dene."
      : rakipVar ? "Izgara hazırlanıyor..." : "Rakip bekleniyor...";
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

  const secili = oyun.secili;
  const sayi = kareSayilari(durum, benKimim);
  const bitti = faz === "macSonu";
  const seciliCevap = secili ? hucreCevaplari(PLAYERS, oyun.izgara, secili.satir, secili.sutun).length : 0;

  return (
    <GameBackground style={styles.kap}>
      <KlavyeAlani style={{ flex: 1 }}>
        <KlavyeScroll contentContainerStyle={{ paddingBottom: SPACING.xl }} keyboardShouldPersistTaps="handled">
          {/* Skor şeridi */}
          <View style={styles.ustSerit}>
            <View style={[styles.oyuncuKutu, oyun.sira === benim && !bitti && styles.oyuncuKutuAktif]}>
              <Text style={[styles.isaret, { color: COLORS.accent }]}>{benim === X ? "X" : "O"}</Text>
              <Text style={styles.oyuncuAd}>SEN</Text>
              <Text style={styles.oyuncuKare}>{sayi.sen} kare</Text>
            </View>
            <View style={styles.ortaKutu}>
              <Text style={styles.siraYazi} numberOfLines={2}>
                {bitti ? "Maç bitti" : siraBende ? "Sıra sende" : "Rakip düşünüyor…"}
              </Text>
              {!rakipVar && !bitti ? <Text style={styles.kopuk}>rakip bağlı değil</Text> : null}
            </View>
            <View style={[styles.oyuncuKutu, oyun.sira !== benim && !bitti && styles.oyuncuKutuAktifRakip]}>
              <Text style={[styles.isaret, { color: COLORS.cta }]}>{benim === X ? "O" : "X"}</Text>
              <Text style={styles.oyuncuAd}>RAKİP</Text>
              <Text style={styles.oyuncuKare}>{sayi.rakip} kare</Text>
            </View>
          </View>
          {oyun.calmaHakki ? (
            <Text style={styles.calmaSatir}>Çalma hakkı · sen {oyun.calmaHakki[benim]} · rakip {oyun.calmaHakki[benim === X ? O : X]}</Text>
          ) : null}

          {kalan !== null && !bitti ? (
            <View style={styles.sureKutu}>
              <TimerBar current={kalan} total={HAMLE_SURESI_SN} />
              <Text style={[styles.sureYazi, kalan <= 5 && { color: COLORS.danger }]}>{kalan} sn</Text>
            </View>
          ) : null}

          {siraBende && !secili ? (
            <Text style={styles.ipucu}>
              {oyun.calmaHakki && oyun.calmaHakki[benim] > 0 ? "Boş bir kareye dokun — ya da rakibin karesini çal" : "Almak istediğin kareye dokun"}
            </Text>
          ) : null}

          {/* Cevap paneli — ızgaranın ÜSTÜNDE (klavye kapatmasın, XOX ile aynı) */}
          {siraBende && secili ? (
            <View style={styles.cevapPaneli}>
              <Text style={styles.hedefText}>
                {kosulEtiketi(oyun.izgara.satirlar[secili.satir])} + {kosulEtiketi(oyun.izgara.sutunlar[secili.sutun])}
              </Text>
              <Text style={styles.hedefAlt}>
                {secili.calma ? `ÇALMA · "${oyun.hucreSahipleri[`${secili.satir}-${secili.sutun}`]?.ad || ""}" dışında bir futbolcu söyle` : `${seciliCevap} olası cevap`}
              </Text>
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
                  autoCapitalize="words"
                  autoFocus
                />
                <SoundPressable style={styles.gonderBtn} onPress={() => cevapGonder()} accessibilityLabel="Gönder">
                  <Ionicons name="send" size={18} color={COLORS.accentDark} />
                </SoundPressable>
              </View>
              {oneriler.length > 0 ? (
                <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={{ marginTop: SPACING.sm }}>
                  {oneriler.map((ad) => (
                    <SoundPressable key={ad} style={styles.oneriCip} onPress={() => cevapGonder(ad)}>
                      <Text style={styles.oneriCipText}>{ad}</Text>
                    </SoundPressable>
                  ))}
                </ScrollView>
              ) : null}
              <View style={styles.altBtnSatir}>
                <SoundPressable onPress={() => hamle({ tip: "secimiIptal" })}><Text style={styles.kucukLink}>Başka kare seç</Text></SoundPressable>
                <SoundPressable onPress={() => hamle({ tip: "pas" })}><Text style={styles.kucukLink}>Pas geç</Text></SoundPressable>
              </View>
            </View>
          ) : null}

          {!siraBende && secili && !bitti ? (
            <Text style={styles.ipucu}>
              Rakip şu kareyi deniyor: {kosulEtiketi(oyun.izgara.satirlar[secili.satir])} + {kosulEtiketi(oyun.izgara.sutunlar[secili.sutun])}
            </Text>
          ) : null}

          {/* Izgara */}
          <View style={styles.izgara}>
            <View style={styles.izgaraSatir}>
              <View style={styles.kose} />
              {oyun.izgara.sutunlar.map((k) => (
                <View key={k} style={styles.baslikHucre}><BaslikRozeti baslik={k} boyut={logoBoyut} /></View>
              ))}
            </View>
            {oyun.izgara.satirlar.map((satirK, r) => (
              <View key={satirK} style={styles.izgaraSatir}>
                <View style={styles.baslikHucre}><BaslikRozeti baslik={satirK} boyut={logoBoyut} /></View>
                {oyun.izgara.sutunlar.map((_, c) => {
                  const i = r * 3 + c;
                  const sahip = oyun.tahta[i];
                  const bilgi = oyun.hucreSahipleri[`${r}-${c}`];
                  const seciliMi = secili?.satir === r && secili?.sutun === c;
                  const benimKare = sahip === benim;
                  const calinabilir = siraBende && calinabilirMi(oyun, i);
                  return (
                    <SoundPressable
                      key={c}
                      accessibilityLabel={`Kare ${r + 1}-${c + 1}`}
                      style={[
                        styles.hucre,
                        seciliMi && styles.hucreSecili,
                        sahip && (benimKare ? styles.hucreBen : styles.hucreRakip),
                        oyun.kazananCizgi?.includes(i) && styles.hucreKazanan,
                        calinabilir && styles.hucreCalinabilir,
                      ]}
                      onPress={() => kareyeDokun(r, c)}
                    >
                      {sahip ? (
                        <>
                          <Text style={[styles.hucreIsaret, !benimKare && { color: COLORS.cta }]}>{sahip === X ? "X" : "O"}</Text>
                          <Text style={styles.hucreAd} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{bilgi?.ad}</Text>
                        </>
                      ) : (
                        <Ionicons name={seciliMi ? "create" : "add"} size={18} color={seciliMi ? VURGU.main : COLORS.textFaint} />
                      )}
                    </SoundPressable>
                  );
                })}
              </View>
            ))}
          </View>

          {bitti ? (
            <OnlineMacSonu
              modAdi="Online Futbolcu XOX"
              durum={durum}
              benKimim={benKimim}
              rakipVar={rakipVar}
              gonder={gonder}
              onExit={onExit}
              kazanan={sonucBenim(durum, benKimim)}
              skorSen={sayi.sen}
              skorRakip={sayi.rakip}
              skorEtiketi="kare"
              turlar={oyun.tahta.map((t) => (t === benim ? "sen" : t ? "rakip" : "yok"))}
              kareSatir={3}
              enIyi={(() => {
                const adlar = Object.values(oyun.hucreSahipleri || {}).filter((h) => h.oyuncu === benim && h.ad).map((h) => h.ad);
                if (!adlar.length) return null;
                return { ad: [...adlar].sort((a, b) => taninirlik(a) - taninirlik(b))[0], alt: "Izgarada verdiğin en nadir isim" };
              })()}
            />
          ) : (
            <SoundPressable onPress={onExit} style={styles.cikisBtn}>
              <Text style={styles.ikincilBtnText}>Odadan çık</Text>
            </SoundPressable>
          )}
        </KlavyeScroll>

        {geriBildirim ? (
          <View style={styles.geriBildirimSarmal} pointerEvents="none">
            <AnswerFeedback key={geriBildirim.anahtar} correct={geriBildirim.correct} message={geriBildirim.message} onDone={() => setGeriBildirim(null)} />
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
  odaKodu: { ...TYPE.h1, color: VURGU.main, marginTop: SPACING.sm, letterSpacing: 4 },
  ikincilBtn: { marginTop: SPACING.lg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  ikincilBtnText: { ...TYPE.caption, textDecorationLine: "underline" },
  cikisBtn: { alignItems: "center", paddingVertical: SPACING.md, marginTop: SPACING.md },

  ustSerit: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  oyuncuKutu: {
    flex: 1, alignItems: "center", paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
    backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.cardBorder,
  },
  oyuncuKutuAktif: { borderColor: COLORS.accent },
  oyuncuKutuAktifRakip: { borderColor: COLORS.cta },
  isaret: { fontSize: 24, fontWeight: "900" },
  oyuncuAd: { ...TYPE.caption, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  oyuncuKare: { ...TYPE.caption, fontSize: 12 },
  ortaKutu: { flex: 1.1, alignItems: "center" },
  siraYazi: { ...TYPE.h3, fontSize: 15, textAlign: "center" },
  kopuk: { ...TYPE.caption, fontSize: 12, color: COLORS.danger, marginTop: 2 },
  calmaSatir: { textAlign: "center", fontSize: 12, fontWeight: "700", color: COLORS.textMuted, marginBottom: SPACING.sm },
  sureKutu: { marginBottom: SPACING.sm },
  sureYazi: { ...TYPE.caption, textAlign: "center", marginTop: -6, fontWeight: "800", color: COLORS.text },
  ipucu: { ...TYPE.caption, textAlign: "center", paddingBottom: SPACING.sm },

  cevapPaneli: {
    backgroundColor: COLORS.card, borderColor: VURGU.main, borderWidth: 2,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md,
  },
  hedefText: { ...TYPE.h3, fontSize: 14, textAlign: "center" },
  hedefAlt: { ...TYPE.caption, textAlign: "center", marginBottom: SPACING.sm },
  girdiSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  girdi: {
    flex: 1, backgroundColor: COLORS.bg, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, color: COLORS.text, fontSize: 15,
  },
  gonderBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, ...SHADOW.card },
  oneriCip: {
    backgroundColor: COLORS.bg, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 6, marginRight: SPACING.sm,
  },
  oneriCipText: { ...TYPE.caption, color: COLORS.text, fontWeight: "700" },
  altBtnSatir: { flexDirection: "row", justifyContent: "space-between", paddingTop: SPACING.sm },
  kucukLink: { ...TYPE.caption, textDecorationLine: "underline" },

  izgara: { gap: 4 },
  izgaraSatir: { flexDirection: "row", gap: 4 },
  kose: { flex: 1 },
  baslikHucre: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 2 },
  hucre: {
    flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2, borderRadius: RADIUS.sm, padding: 2,
  },
  hucreSecili: { borderColor: VURGU.main },
  hucreBen: { backgroundColor: "#173A22", borderColor: COLORS.accent },
  hucreRakip: { backgroundColor: COLORS.ctaDark, borderColor: COLORS.cta },
  hucreKazanan: { borderWidth: 3, borderColor: VURGU.main },
  hucreCalinabilir: { borderStyle: "dashed", borderColor: COLORS.cta },
  hucreIsaret: { ...TYPE.h2, color: COLORS.accent },
  hucreAd: { ...TYPE.caption, fontSize: 12, textAlign: "center", color: COLORS.textMuted },

  geriBildirimSarmal: { ...StyleSheet.absoluteFillObject },
});
