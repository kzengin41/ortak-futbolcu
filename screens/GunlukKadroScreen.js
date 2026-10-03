import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, Share, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import TeamBadge from "../components/TeamBadge";
import Saha, { Kulube } from "../components/Saha";
import { PLAYERS } from "../lib/players";
import { findMatchedPlayer, suggestPlayers, buildSuggestIndex } from "../lib/gameEngine";
import { gununKadrosu, sahaSatirlari, kadroPaylasim, sureYaz } from "../lib/kadrolar";
import { gunlukDurumOku, gunlukDurumYaz, gunlukOyunBitti } from "../lib/gunlukKayit";
import { bulunanEkle } from "../lib/kadroKoleksiyon";
import { gorevOlayi } from "../lib/dailyGoals";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { flagForCountry } from "../lib/countryFlags";
import { countryTr } from "../lib/countryNamesTr";
import { COLORS, MODE_COLORS, SPACING, RADIUS } from "../lib/theme";

// ============================================================================
// GÜNÜN KADROSU — 4 Ekim 2026 (benchmark .29452 + paylaşım .20045)
// "Günün Kadrosu günlük vitrin olsun: her gün efsane bir maç, rastgele, tekrarsız."
// Herkese aynı gün aynı maçın bir takımı. İlk 11'i bul: forma numaraları ve
// mevkiler sahada; yazdığın isim kadrodaysa yerine oturur. Süre ileri sayar,
// istediğin an "Pes et". Paylaşım: "#42 · 8/11 · 2:47" + saha düzeninde kareler.
// Yanlış isim ceza değil, sadece sayılır. Bitirmek günlük seriyi sürdürür.
// ============================================================================
const VURGU = MODE_COLORS.teamTeam || MODE_COLORS.fiveClubs;

function TakimEtiketi({ ad, tip, vurgulu }) {
  return (
    <View style={[s.takim, vurgulu && s.takimVurgu]}>
      {tip === "ulke" ? <Text style={{ fontSize: 26 }}>{flagForCountry(ad)}</Text> : <TeamBadge name={ad} size={34} />}
      <Text style={[s.takimAd, vurgulu && { color: COLORS.accent }]} numberOfLines={2}>{tip === "ulke" ? countryTr(ad) || ad : ad}</Text>
    </View>
  );
}

export default function GunlukKadroScreen({ onExit, onExitSilent }) {
  const kadro = useMemo(() => gununKadrosu(), []);
  const [bulunan, setBulunan] = useState([]);      // ilk11 indisleri
  const [yanlis, setYanlis] = useState(0);
  const [bitti, setBitti] = useState(false);
  const [gecen, setGecen] = useState(0);           // sn (yalnız ekran açıkken işler)
  const [yuklendi, setYuklendi] = useState(false);
  const [girdi, setGirdi] = useState("");
  const [uyari, setUyari] = useState(null);
  const gecenRef = useRef(0);
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => (girdi.trim().length > 2 ? suggestPlayers(suggestIndex, girdi).slice(0, 4) : []), [suggestIndex, girdi]);
  const satirlar = useMemo(() => (kadro ? sahaSatirlari(kadro.ilk11, kadro.tip === "mac") : []), [kadro]);

  useEffect(() => {
    gunlukDurumOku("kadro").then((d) => {
      if (d && d.id === kadro?.id) {
        setBulunan(d.bulunan || []);
        setYanlis(d.yanlis || 0);
        setBitti(!!d.bitti);
        gecenRef.current = d.gecen || 0;
        setGecen(d.gecen || 0);
      }
      setYuklendi(true);
    });
  }, [kadro]);

  // Saat: ekran açıkken ve oyun sürerken
  useEffect(() => {
    if (!yuklendi || bitti) return;
    const t = setInterval(() => { gecenRef.current += 1; setGecen(gecenRef.current); }, 1000);
    return () => clearInterval(t);
  }, [yuklendi, bitti]);

  function kaydet(degis = {}) {
    gunlukDurumYaz("kadro", { id: kadro.id, bulunan, yanlis, bitti, gecen: gecenRef.current, ...degis });
  }
  // Çıkarken geçen süreyi kaydet
  const kaydetRef = useRef(kaydet);
  kaydetRef.current = kaydet;
  useEffect(() => () => { if (kadro) kaydetRef.current(); }, [kadro]);

  function bitir(b, y) {
    setBitti(true);
    kaydet({ bulunan: b, yanlis: y, bitti: true });
    if (b.length >= 9) gorevOlayi("kadro9").catch(() => {});
    gunlukOyunBitti("kadro").catch(() => {});
  }

  function gonder(metin) {
    if (bitti || !kadro) return;
    const t = String(metin ?? girdi).trim();
    if (!t) return;
    setGirdi("");
    const acik = new Set(bulunan);
    const adaylar = kadro.ilk11.map((o, i) => ({ name: o.a, i })).filter((x) => !acik.has(x.i));
    const m = findMatchedPlayer(t, adaylar);
    if (m) {
      const o = kadro.ilk11[m.i];
      const yeni = [...bulunan, m.i];
      setBulunan(yeni);
      setUyari(null);
      playCorrect();
      recordRound("gunlukKadro", true);
      if (o.v) unlockPlayer(o.a);
      bulunanEkle(o.a);
      if (yeni.length === kadro.ilk11.length) bitir(yeni, yanlis);
      else kaydet({ bulunan: yeni });
      return;
    }
    if (findMatchedPlayer(t, kadro.ilk11.filter((o, i) => acik.has(i)).map((o) => ({ name: o.a })))) {
      setUyari("Onu zaten buldun");
      return;
    }
    const yedekte = findMatchedPlayer(t, kadro.yedek.map((o) => ({ name: o.a })));
    const y = yanlis + 1;
    setYanlis(y);
    playWrong();
    recordRound("gunlukKadro", false);
    setUyari(yedekte ? `${yedekte.name} o maçta yedekteydi — ilk 11'de değil` : "Bu isim ilk 11'de yok");
    kaydet({ yanlis: y });
  }

  async function paylas() {
    try { await Share.share({ message: kadroPaylasim(kadro.no, kadro, bulunan, sureYaz(gecen)) }); } catch (e) {}
  }

  if (!kadro) {
    return (
      <GameBackground style={s.kap}>
        <BackButton onPress={onExitSilent || onExit} />
        <Text style={s.baslik}>Bugünün kadrosu hazırlanamadı</Text>
      </GameBackground>
    );
  }

  const m = kadro.mac;
  const hedefIndeks = Number(kadro.id.split("#")[1] || 0);
  const acikSet = new Set(bulunan);
  const bulundu = (o) => (o.i != null ? acikSet.has(o.i) : false);

  return (
    <GameBackground style={s.kap} klavye="kaydir">
      <View style={s.ust}>
        <BackButton onPress={onExitSilent || onExit} />
        <Text style={s.saat}>{sureYaz(gecen)}</Text>
      </View>
      <Text style={s.ustBaslik}>GÜNÜN KADROSU #{kadro.no}</Text>
      {m ? (
        <View style={s.macKart}>
          <Text style={s.macTur}>{m.tur}{m.yil ? ` · ${m.yil}` : ""}</Text>
          <View style={s.macSatir}>
            <TakimEtiketi ad={m.takimlar[0].ad} tip={m.takimlar[0].tip} vurgulu={hedefIndeks === 0} />
            <View style={{ alignItems: "center" }}>
              <Text style={s.skor}>{m.skor || "–"}</Text>
              {m.penalti ? <Text style={s.penalti}>pen. {m.penalti}</Text> : m.uzatma ? <Text style={s.penalti}>uzatmada</Text> : null}
            </View>
            <TakimEtiketi ad={m.takimlar[1].ad} tip={m.takimlar[1].tip} vurgulu={hedefIndeks === 1} />
          </View>
          <Text style={s.hedef}>
            Bul: <Text style={{ color: COLORS.accent }}>{kadro.takimTip === "ulke" ? countryTr(kadro.takim) || kadro.takim : kadro.takim}</Text> ilk 11'i
          </Text>
        </View>
      ) : null}

      <View style={s.durumSatir}>
        <Text style={s.durum}><Text style={s.durumSayi}>{bulunan.length}</Text> / 11</Text>
        <Text style={s.durumAlt}>{yanlis} yanlış</Text>
      </View>

      <Saha satirlar={satirlar} bulundu={bulundu} acik={bitti} />

      {!bitti && yuklendi ? (
        <>
          <View style={s.girdiSatir}>
            <TextInput
              style={s.girdi}
              value={girdi}
              onChangeText={(t) => { setGirdi(t); setUyari(null); }}
              onSubmitEditing={() => gonder()}
              placeholder="İlk 11'den bir isim"
              placeholderTextColor={COLORS.textFaint}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <SoundPressable style={s.gonder} onPress={() => gonder()} accessibilityLabel="Gönder">
              <Ionicons name="arrow-forward" size={20} color={COLORS.accentDark} />
            </SoundPressable>
          </View>
          {oneriler.map((ad) => (
            <Pressable key={ad} style={s.oneri} onPress={() => gonder(ad)}>
              <Ionicons name="person-circle-outline" size={18} color={COLORS.textMuted} />
              <Text style={s.oneriYazi} numberOfLines={1}>{ad}</Text>
            </Pressable>
          ))}
          {uyari ? <Text style={s.uyari}>{uyari}</Text> : null}
          <SoundPressable style={s.pes} onPress={() => bitir(bulunan, yanlis)}>
            <Ionicons name="flag" size={16} color={COLORS.textMuted} />
            <Text style={s.pesYazi}>Pes et, kadroyu göster</Text>
          </SoundPressable>
        </>
      ) : null}

      {bitti ? (
        <View style={s.sonuc}>
          <Text style={s.sonucUst}>BUGÜNKÜ SONUCUN</Text>
          <Text style={s.sonucSayi}>{bulunan.length}<Text style={s.sonucBolu}> / 11 · {sureYaz(gecen)}</Text></Text>
          <Kulube yedek={kadro.yedek} bulundu={() => true} />
          <SoundPressable style={s.paylas} onPress={paylas}>
            <Ionicons name="share-social" size={18} color={COLORS.accentDark} />
            <Text style={s.paylasYazi}>PAYLAŞ</Text>
          </SoundPressable>
          <Text style={s.yarin}>Yarın başka bir efsane maç gelir.</Text>
        </View>
      ) : null}
    </GameBackground>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg, padding: 20, paddingBottom: 40 },
  ust: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  saat: { fontSize: 18, fontWeight: "900", color: COLORS.text, fontVariant: ["tabular-nums"] },
  ustBaslik: { fontSize: 13, fontWeight: "800", letterSpacing: 2, color: VURGU.main, marginTop: SPACING.sm },
  baslik: { fontSize: 20, fontWeight: "900", color: COLORS.text, marginTop: 4 },
  macKart: { marginTop: SPACING.sm, padding: 12, borderRadius: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  macTur: { fontSize: 12, fontWeight: "800", color: COLORS.textMuted, textAlign: "center", letterSpacing: 1 },
  macSatir: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  takim: { flex: 1, alignItems: "center", gap: 4, padding: 4, borderRadius: RADIUS.md },
  takimVurgu: { backgroundColor: "rgba(124,255,92,0.10)" },
  takimAd: { fontSize: 13, fontWeight: "900", color: COLORS.text, textAlign: "center" },
  skor: { fontSize: 24, fontWeight: "900", color: COLORS.text },
  penalti: { fontSize: 11, fontWeight: "700", color: COLORS.textMuted },
  hedef: { fontSize: 14, fontWeight: "800", color: COLORS.text, textAlign: "center", marginTop: 8 },
  durumSatir: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginVertical: 10 },
  durum: { fontSize: 14, fontWeight: "800", color: COLORS.textMuted },
  durumSayi: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  durumAlt: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },
  girdiSatir: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 2, borderColor: VURGU.main, paddingHorizontal: 6, height: 54 },
  girdi: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "600", paddingHorizontal: 6 },
  gonder: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },
  oneri: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  oneriYazi: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },
  uyari: { fontSize: 13, fontWeight: "700", color: COLORS.cta, textAlign: "center", marginTop: 8 },
  pes: { flexDirection: "row", gap: 6, alignItems: "center", alignSelf: "center", marginTop: 14, padding: 8 },
  pesYazi: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted, textDecorationLine: "underline" },
  sonuc: { marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: "stretch" },
  sonucUst: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textMuted, textAlign: "center" },
  sonucSayi: { fontSize: 44, fontWeight: "900", color: COLORS.text, textAlign: "center" },
  sonucBolu: { fontSize: 18, color: COLORS.textMuted },
  paylas: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", height: 52, borderRadius: 16, backgroundColor: COLORS.accent, marginTop: SPACING.lg },
  paylasYazi: { fontSize: 17, fontWeight: "900", letterSpacing: 1, color: COLORS.accentDark },
  yarin: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, marginTop: 10, textAlign: "center" },
});
