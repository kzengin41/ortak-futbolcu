import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { KlavyeAlani, KlavyeScroll } from "../components/Klavye";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import TeamBadge from "../components/TeamBadge";
import TimerBar from "../components/TimerBar";
import MacSonuKarti from "../components/MacSonuKarti";
import { PLAYERS } from "../lib/players";
import { playersForPair, findMatchedPlayer, buildSuggestIndex, suggestPlayers } from "../lib/gameEngine";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import {
  sorular as soruSeti, coz, kodla, yeniTohum, karsilastir, sureYaz, kodGoster, paylasimMetni,
  gecmis as gecmisGetir, gecmiseEkle, SORU_SAYISI, SORU_SURESI_SN,
} from "../lib/meydanOkuma";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, MODE_COLORS } from "../lib/theme";

// ============================================================================
// MEYDAN OKUMA — 5 Ekim 2026 (benchmark .29648). Kurallar lib/meydanOkuma.js.
// kod yoksa: yeni meydan okuma (oyna → kodu paylaş).
// kod varsa: arkadaşın meydan okuması (aynı 10 soru → karşılaştır).
// ============================================================================
const VURGU = MODE_COLORS.online;

export default function MeydanOkumaScreen({ kod, onExit, onExitSilent }) {
  const cikis = onExitSilent || onExit;
  const rakip = useMemo(() => (kod ? coz(kod) : null), [kod]);
  const [tohum, setTohum] = useState(() => (rakip ? rakip.tohum : yeniTohum()));
  const sorular = useMemo(() => soruSeti(tohum), [tohum]);
  const [faz, setFaz] = useState("giris");   // giris | oyun | sonuc
  const [no, setNo] = useState(0);
  const [kalan, setKalan] = useState(SORU_SURESI_SN);
  const [girdi, setGirdi] = useState("");
  const [uyari, setUyari] = useState(null);
  const [sonuclar, setSonuclar] = useState([]);   // [{ cift, ad|null, sure }]
  const [gecmis, setGecmis] = useState([]);
  const baslangicRef = useRef(0);
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => (girdi.trim().length < 3 ? [] : suggestPlayers(suggestIndex, girdi).slice(0, 4)), [suggestIndex, girdi]);

  useEffect(() => { gecmisGetir().then(setGecmis).catch(() => {}); }, []);

  const cift = sorular[no];
  const cevaplar = useMemo(() => (cift ? playersForPair(PLAYERS, cift[0], cift[1]) : []), [cift]);

  // Soru sayacı
  useEffect(() => {
    if (faz !== "oyun") return;
    if (kalan <= 0) { soruyuBitir(null); return; }
    const t = setTimeout(() => setKalan((k) => k - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faz, kalan]);

  function basla() {
    setSonuclar([]);
    setNo(0);
    setKalan(SORU_SURESI_SN);
    setGirdi("");
    setUyari(null);
    baslangicRef.current = Date.now();
    setFaz("oyun");
  }

  function soruyuBitir(ad) {
    const gecen = Math.min(SORU_SURESI_SN, (Date.now() - baslangicRef.current) / 1000);
    const yeni = [...sonuclar, { cift, ad, sure: ad ? gecen : SORU_SURESI_SN }];
    setSonuclar(yeni);
    setGirdi("");
    setUyari(null);
    if (yeni.length >= sorular.length) { bitir(yeni); return; }
    setNo((n) => n + 1);
    setKalan(SORU_SURESI_SN);
    baslangicRef.current = Date.now();
  }

  function gonder(metin) {
    const yazi = String(metin ?? girdi).trim();
    if (!yazi || faz !== "oyun") return;
    const m = findMatchedPlayer(yazi, cevaplar);
    if (!m) {
      playWrong();
      setGirdi("");
      setUyari(`"${yazi}" bu ikilide oynamadı`);
      return;
    }
    playCorrect();
    unlockPlayer(m.name);
    soruyuBitir(m.name);
  }

  async function bitir(liste) {
    const dogru = liste.filter((x) => x.ad).length;
    const sure = Math.round(liste.reduce((t, x) => t + x.sure, 0));
    const benimKod = kodla({ tohum, dogru, sure });
    setFaz("sonuc");
    if (rakip) {
      const s = karsilastir({ dogru, sure }, rakip);
      if (s !== "berabere") recordRound("meydanOkuma", s === "sen");
    }
    setGecmis(await gecmiseEkle({ kod: rakip ? String(kod).toUpperCase().replace(/[\s-]/g, "") : benimKod, tohum, ben: { dogru, sure }, rakip: rakip ? { dogru: rakip.dogru, sure: rakip.sure } : null }));
  }

  function yeniMeydanOkuma() {
    setTohum(yeniTohum());
    setFaz("giris");
  }

  // ---------------------------------------------------------------- hata
  if (kod && !rakip) {
    return (
      <GameBackground style={s.merkez}>
        <Ionicons name="alert-circle" size={36} color={COLORS.danger} />
        <Text style={s.baslik}>Kod geçersiz</Text>
        <Text style={s.aciklama}>"{kod}" bir meydan okuma kodu değil. Arkadaşının gönderdiği 6 harfli kodu kontrol et.</Text>
        <SoundPressable style={s.anaBtn} onPress={cikis}><Text style={s.anaBtnYazi}>GERİ DÖN</Text></SoundPressable>
      </GameBackground>
    );
  }

  // ---------------------------------------------------------------- giriş
  if (faz === "giris") {
    return (
      <GameBackground style={s.kap}>
        <BackButton onPress={cikis} confirm={false} />
        <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xxl }} showsVerticalScrollIndicator={false}>
          <View style={s.ikonDaire}><Ionicons name="paper-plane" size={30} color={VURGU.main} /></View>
          <Text style={s.baslik}>{rakip ? "SANA MEYDAN OKUNDU!" : "MEYDAN OKUMA"}</Text>
          {rakip ? (
            <View style={s.rakipKart}>
              <Text style={s.rakipEtiket}>ARKADAŞININ SKORU</Text>
              <Text style={s.rakipSkor}>{rakip.dogru} / {SORU_SAYISI}</Text>
              <Text style={s.rakipSure}>{sureYaz(rakip.sure)} sürede</Text>
            </View>
          ) : null}
          <Text style={s.aciklama}>
            {rakip
              ? `Aynı ${SORU_SAYISI} soruyu sen çöz. Daha çok bilen kazanır; eşitlikte hızlı olan.`
              : `${SORU_SAYISI} soru, her biri ${SORU_SURESI_SN} saniye: iki kulübün ikisinde de oynamış bir futbolcu yaz. Bitince kodunu arkadaşına gönder — o da aynı soruları çözsün, kim daha iyi görün.`}
          </Text>
          <SoundPressable style={s.anaBtn} onPress={basla} accessibilityLabel="Başla">
            <Ionicons name="play" size={20} color={COLORS.accentDark} />
            <Text style={s.anaBtnYazi}>{rakip ? "KABUL ET — BAŞLA" : "BAŞLA"}</Text>
          </SoundPressable>

          {gecmis.length ? (
            <View style={{ marginTop: SPACING.xl }}>
              <Text style={s.bolumBaslik}>SON MEYDAN OKUMALAR</Text>
              {gecmis.slice(0, 5).map((g) => {
                const sonuc = g.rakip ? karsilastir(g.ben, g.rakip) : null;
                return (
                  <View key={`${g.kod}-${g.tarih}`} style={s.gecmisSatir}>
                    <Ionicons name={g.rakip ? "mail-open" : "paper-plane"} size={16} color={COLORS.textMuted} />
                    <Text style={s.gecmisKod}>{kodGoster(g.kod)}</Text>
                    <Text style={s.gecmisYazi} numberOfLines={1}>
                      {g.rakip ? `${g.ben.dogru}-${g.rakip.dogru}` : `${g.ben.dogru}/${SORU_SAYISI} · ${sureYaz(g.ben.sure)}`}
                    </Text>
                    {sonuc ? (
                      <Text style={[s.gecmisSonuc, { color: sonuc === "sen" ? COLORS.accent : sonuc === "rakip" ? COLORS.danger : COLORS.textMuted }]}>
                        {sonuc === "sen" ? "KAZANDIN" : sonuc === "rakip" ? "KAYBETTİN" : "BERABERE"}
                      </Text>
                    ) : (
                      <Text style={[s.gecmisSonuc, { color: COLORS.cta }]}>GÖNDERİLDİ</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      </GameBackground>
    );
  }

  // ---------------------------------------------------------------- sonuç
  if (faz === "sonuc") {
    const dogru = sonuclar.filter((x) => x.ad).length;
    const sure = Math.round(sonuclar.reduce((t, x) => t + x.sure, 0));
    const benimKod = kodla({ tohum, dogru, sure });
    const paylas = () => Share.share({ message: paylasimMetni({ kod: benimKod, dogru, sure, rakip }) }).catch(() => {});
    const ozet = (
      <View style={s.ozetKutu}>
        {sonuclar.map((x, i) => (
          <View key={i} style={s.ozetSatir}>
            <Ionicons name={x.ad ? "checkmark-circle" : "close-circle"} size={16} color={x.ad ? COLORS.accent : COLORS.danger} />
            <Text style={s.ozetCift} numberOfLines={1}>{x.cift[0]} + {x.cift[1]}</Text>
            <Text style={s.ozetAd} numberOfLines={1}>{x.ad || playersForPair(PLAYERS, x.cift[0], x.cift[1])[0]?.name || "—"}</Text>
          </View>
        ))}
      </View>
    );
    return (
      <GameBackground style={s.kap}>
        <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xxl }} showsVerticalScrollIndicator={false}>
          {rakip ? (
            <MacSonuKarti
              modAdi="Meydan Okuma"
              skorSen={dogru}
              skorRakip={rakip.dogru}
              skorEtiketi="doğru"
              kazanan={karsilastir({ dogru, sure }, rakip)}
              rakip={{ ad: "Arkadaşın", avatar: "✉️", renk: COLORS.cta }}
              turlar={sonuclar.map((x) => (x.ad ? "sen" : "yok"))}
              ekSatir={<Text style={s.sureKarsilastir}>Süre: sen {sureYaz(sure)} · arkadaşın {sureYaz(rakip.sure)}</Text>}
              rovansEtiketi="SEN DE MEYDAN OKU"
              onRovans={yeniMeydanOkuma}
              onMenu={cikis}
            />
          ) : (
            <View style={s.sonucKart}>
              <Text style={s.sonucBaslik}>MEYDAN OKUMAN HAZIR</Text>
              <Text style={s.sonucSkor}>{dogru} / {SORU_SAYISI}</Text>
              <Text style={s.rakipSure}>{sureYaz(sure)} sürede</Text>
              <Text style={s.kodEtiket}>ARKADAŞINA BU KODU GÖNDER</Text>
              <Text style={s.kod} selectable>{kodGoster(benimKod)}</Text>
              <SoundPressable style={[s.anaBtn, { alignSelf: "stretch" }]} onPress={paylas} accessibilityLabel="Kodu paylaş">
                <Ionicons name="share-social" size={20} color={COLORS.accentDark} />
                <Text style={s.anaBtnYazi}>KODU PAYLAŞ</Text>
              </SoundPressable>
              <SoundPressable style={s.ikincilBtn} onPress={yeniMeydanOkuma}>
                <Text style={s.ikincilYazi}>Yeni meydan okuma</Text>
              </SoundPressable>
              <SoundPressable style={s.ikincilBtn} onPress={cikis}>
                <Text style={s.ikincilYazi}>Menüye dön</Text>
              </SoundPressable>
            </View>
          )}
          <Text style={[s.bolumBaslik, { marginTop: SPACING.lg }]}>SORULAR</Text>
          {ozet}
        </ScrollView>
      </GameBackground>
    );
  }

  // ---------------------------------------------------------------- oyun
  return (
    <GameBackground style={s.kap}>
      <KlavyeAlani style={{ flex: 1 }}>
        <BackButton onPress={onExit} />
        <KlavyeScroll contentContainerStyle={{ paddingBottom: SPACING.xl }} keyboardShouldPersistTaps="handled">
          <View style={s.ustSatir}>
            <Text style={s.soruNo}>SORU {no + 1} / {sorular.length}</Text>
            <Text style={s.dogruSayac}>{sonuclar.filter((x) => x.ad).length} doğru</Text>
          </View>
          {rakip ? <Text style={s.hedefYazi}>Geçmen gereken: {rakip.dogru} doğru · {sureYaz(rakip.sure)}</Text> : null}
          <View style={s.ciftKart}>
            <View style={s.takim}>
              <TeamBadge name={cift[0]} size={56} />
              <Text style={s.takimAd} numberOfLines={2}>{cift[0]}</Text>
            </View>
            <Text style={s.arti}>+</Text>
            <View style={s.takim}>
              <TeamBadge name={cift[1]} size={56} />
              <Text style={s.takimAd} numberOfLines={2}>{cift[1]}</Text>
            </View>
          </View>
          <View style={{ marginTop: SPACING.md }}>
            <TimerBar current={kalan} total={SORU_SURESI_SN} />
            <Text style={[s.sureYazi, kalan <= 5 && { color: COLORS.danger }]}>{kalan} sn</Text>
          </View>
          <View style={s.girdiSatir}>
            <TextInput
              style={s.girdi}
              value={girdi}
              onChangeText={(x) => { setGirdi(x); setUyari(null); }}
              onSubmitEditing={() => gonder()}
              placeholder="İkisinde de oynamış futbolcu..."
              placeholderTextColor={COLORS.textFaint}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="send"
              blurOnSubmit={false}
              autoFocus
            />
            <SoundPressable style={s.gonderBtn} onPress={() => gonder()} accessibilityLabel="Gönder">
              <Ionicons name="send" size={18} color={COLORS.accentDark} />
            </SoundPressable>
          </View>
          {oneriler.map((ad) => (
            <SoundPressable key={ad} style={s.oneri} onPress={() => gonder(ad)}>
              <Ionicons name="person-circle-outline" size={18} color={COLORS.textMuted} />
              <Text style={s.oneriYazi} numberOfLines={1}>{ad}</Text>
            </SoundPressable>
          ))}
          {uyari ? <Text style={s.uyari}>{uyari}</Text> : null}
          <SoundPressable style={s.pasBtn} onPress={() => soruyuBitir(null)}>
            <Text style={s.ikincilYazi}>Bilemedim, sıradaki soru</Text>
          </SoundPressable>
        </KlavyeScroll>
      </KlavyeAlani>
    </GameBackground>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, padding: SPACING.lg, paddingTop: SPACING.xxl },
  merkez: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.sm },
  ikonDaire: {
    alignSelf: "center", width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.ctaDark, borderWidth: 2, borderColor: VURGU.main, marginTop: SPACING.xl,
  },
  baslik: { ...TYPE.h1, textAlign: "center", marginTop: SPACING.md },
  aciklama: { ...TYPE.bodyMuted, textAlign: "center", marginTop: SPACING.md, marginBottom: SPACING.xl },
  rakipKart: {
    alignItems: "center", marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.card, borderWidth: 2, borderColor: VURGU.main,
  },
  rakipEtiket: { ...TYPE.caption, fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
  rakipSkor: { fontSize: 44, fontWeight: "900", color: COLORS.text },
  rakipSure: { ...TYPE.caption, fontWeight: "800" },
  anaBtn: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.accent, borderRadius: RADIUS.lg, paddingVertical: 16, paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg, ...SHADOW.card,
  },
  anaBtnYazi: { color: COLORS.accentDark, fontWeight: "900", fontSize: 15, letterSpacing: 1 },
  ikincilBtn: { paddingVertical: SPACING.sm, marginTop: SPACING.sm, alignItems: "center" },
  ikincilYazi: { ...TYPE.caption, textDecorationLine: "underline" },
  bolumBaslik: { ...TYPE.caption, fontSize: 12, fontWeight: "900", letterSpacing: 1.5, marginBottom: SPACING.sm },
  gecmisSatir: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: 10, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 6,
  },
  gecmisKod: { color: COLORS.text, fontWeight: "900", letterSpacing: 1 },
  gecmisYazi: { flex: 1, ...TYPE.caption, color: COLORS.text, fontWeight: "700" },
  gecmisSonuc: { fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },

  ustSatir: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: SPACING.md },
  soruNo: { ...TYPE.eyebrow, color: VURGU.main, fontSize: 12 },
  dogruSayac: { ...TYPE.caption, fontWeight: "900", color: COLORS.accent },
  hedefYazi: { ...TYPE.caption, marginTop: 4 },
  ciftKart: {
    flexDirection: "row", alignItems: "center", marginTop: SPACING.md, padding: SPACING.lg, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.card, borderWidth: 2, borderColor: VURGU.main, ...SHADOW.card,
  },
  takim: { flex: 1, alignItems: "center", gap: SPACING.sm },
  takimAd: { ...TYPE.h3, fontSize: 15, textAlign: "center" },
  arti: { color: VURGU.main, fontWeight: "900", fontSize: 24, marginHorizontal: SPACING.sm },
  sureYazi: { ...TYPE.caption, textAlign: "center", marginTop: -6, fontWeight: "800", color: COLORS.text },
  girdiSatir: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.md, backgroundColor: COLORS.card,
    borderRadius: 14, borderWidth: 2, borderColor: COLORS.accent, paddingHorizontal: 6, height: 54,
  },
  girdi: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "600", paddingHorizontal: 6 },
  gonderBtn: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },
  oneri: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  oneriYazi: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },
  uyari: { fontSize: 13, fontWeight: "700", color: COLORS.danger, textAlign: "center", marginTop: 8 },
  pasBtn: { alignItems: "center", paddingVertical: SPACING.md },

  sonucKart: {
    alignItems: "center", padding: SPACING.lg, borderRadius: RADIUS.xl, backgroundColor: COLORS.card,
    borderWidth: 2, borderColor: VURGU.main, marginTop: SPACING.lg,
  },
  sonucBaslik: { fontSize: 20, fontWeight: "900", letterSpacing: 1.5, color: VURGU.main, textAlign: "center" },
  sonucSkor: { fontSize: 56, fontWeight: "900", color: COLORS.text, marginTop: SPACING.sm },
  kodEtiket: { ...TYPE.caption, fontSize: 12, fontWeight: "900", letterSpacing: 1.5, marginTop: SPACING.lg },
  kod: { fontSize: 40, fontWeight: "900", letterSpacing: 6, color: COLORS.accent, marginTop: 4 },
  sureKarsilastir: { ...TYPE.caption, fontWeight: "800", marginTop: SPACING.md, textAlign: "center" },
  ozetKutu: { borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, padding: SPACING.sm },
  ozetSatir: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  ozetCift: { flex: 1.3, ...TYPE.caption, color: COLORS.text, fontWeight: "700" },
  ozetAd: { flex: 1, ...TYPE.caption, textAlign: "right" },
});
