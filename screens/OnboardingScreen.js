import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Animated, Easing, Keyboard } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import GameBackground from "../components/GameBackground";
import PressScale from "../components/ui/PressScale";
import SoundPressable from "../components/SoundPressable";
import MikrofonDugmesi from "../components/MikrofonDugmesi";
import TeamBadge from "../components/TeamBadge";
import EslesmeKarti from "../components/EslesmeKarti";
import PlayerPhoto from "../components/PlayerPhoto";
import ModIkon from "../components/ModIkon";
import CountdownOverlay from "../components/CountdownOverlay";
import { KlavyeAlani } from "../components/Klavye";
import { PLAYERS } from "../lib/players";
import { playersForPair, findMatchedPlayer, buildSuggestIndex, suggestPlayers } from "../lib/gameEngine";
import { taninirlik } from "../lib/taninirlik";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { countryTr } from "../lib/countryNamesTr";
import { PLAYER_NATIONALITY } from "../lib/playerNationality";
import { COLORS, SPACING, RADIUS, TYPE, saydam, vurguZemini } from "../lib/theme";

// ============================================================================
// KARŞILAMA — Paket 36 (15 Ekim 2026)
// Kerem: "karşılama güncellenecek. metinler adam gibi olacak ve gif şeklinde
// oynanabilir bir başlangıç olacak." Karar: "Canlı deneme turu".
// ESKİ: üç düz slayt (ikon + iki cümle).
// YENİ: 4 adım
//   1) Hoş geldin — kendi kendine dönen 3-2-1 animasyonu (iki arma gelir,
//      3 · 2 · 1 · BİTİR İŞİ!): oyunun ne olduğu tek bakışta.
//   2) CANLI DENEME TURU — gerçek bir tur: 3-2-1 sayılır, Galatasaray ×
//      Fenerbahçe gelir, oyuncu iki takımda da oynamış birini yazar (öneriler,
//      iki kademeli ipucu, "cevabı göster"). Doğruda kutlama + futbolcu kartı.
//   3) Diğer oyunlar — 5 Kulüp, Futbolcu XOX, Kim Bu: her biri kendi küçük
//      animasyonuyla (döngüde, GIF gibi).
//   4) Online + her gün — arkadaşınla / rastgele rakiple kapış, günlük bulmaca.
// "Geç" her adımda var; deneme turunda zorunluluk yok.
// ============================================================================
const DENEME = { a: "Galatasaray", b: "Fenerbahçe" };
const ADIMLAR = ["merhaba", "deneme", "modlar", "online"];

export default function OnboardingScreen({ onDone }) {
  const [adim, setAdim] = useState(0);
  const [denemeBitti, setDenemeBitti] = useState(false);
  const gecis = useRef(new Animated.Value(1)).current;

  function git(i) {
    if (Keyboard.dismiss) Keyboard.dismiss();
    gecis.setValue(0);
    setAdim(i);
    Animated.timing(gecis, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }
  function ileri() {
    if (adim < ADIMLAR.length - 1) git(adim + 1);
    else onDone();
  }
  const ad = ADIMLAR[adim];
  const soluk = ad === "deneme" && !denemeBitti;
  const ileriYazi = ad === "merhaba" ? "Hemen dene" : ad === "deneme" ? (denemeBitti ? "Devam" : "Atla") : adim === ADIMLAR.length - 1 ? "Oynamaya başla" : "Devam";

  return (
    <GameBackground style={s.kap}>
      <KlavyeAlani style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: gecis, transform: [{ translateY: gecis.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
          {ad === "merhaba" ? <Merhaba /> : null}
          {ad === "deneme" ? <DenemeTuru onBitti={() => setDenemeBitti(true)} /> : null}
          {ad === "modlar" ? <Modlar /> : null}
          {ad === "online" ? <Online /> : null}
        </Animated.View>

        <View style={s.alt}>
          <View style={s.noktalar}>
            {ADIMLAR.map((_, i) => <View key={i} style={[s.nokta, i === adim && s.noktaAktif]} />)}
          </View>
          <View style={s.dugmeSatir}>
            <SoundPressable onPress={onDone} hitSlop={12} accessibilityLabel="Karşılamayı geç">
              <Text style={s.gec}>Geç</Text>
            </SoundPressable>
            <PressScale onPress={ileri} style={[s.ileri, soluk && s.ileriSoluk]} accessibilityLabel={ileriYazi}>
              <Text style={[s.ileriYazi, soluk && { color: COLORS.text }]}>{ileriYazi}</Text>
              <Ionicons name="arrow-forward" size={16} color={soluk ? COLORS.text : COLORS.accentDark} />
            </PressScale>
          </View>
        </View>
      </KlavyeAlani>
    </GameBackground>
  );
}

// --------------------------------------------------------------------------
// 1) Hoş geldin — döngüdeki 3-2-1 sahnesi
// --------------------------------------------------------------------------
const DONGU = ["3", "2", "1", "BİTİR İŞİ!"];
function Merhaba() {
  const [i, setI] = useState(0);
  const pop = useRef(new Animated.Value(1)).current;
  const gel = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let t;
    const adimla = (k) => {
      setI(k);
      pop.setValue(0.3);
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();
      if (k === 0) {
        gel.setValue(0);
        Animated.timing(gel, { toValue: 1, duration: 520, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
      }
      t = setTimeout(() => adimla((k + 1) % DONGU.length), k === DONGU.length - 1 ? 1700 : 700);
    };
    adimla(0);
    return () => clearTimeout(t);
  }, []);
  const son = i === DONGU.length - 1;
  return (
    <View style={s.sayfa}>
      <Text style={s.ust}>HOŞ GELDİN</Text>
      <Text style={s.baslik}>3-2-1: Bitir İşi</Text>
      <Text style={s.metin}>
        İki takım gelir. İkisinde de forma giymiş bir futbolcuyu rakibinden önce söyleyen turu alır. Kural bu kadar —
        gerisi futbol hafızan.
      </Text>
      <View style={s.sahne} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View style={{ opacity: gel, transform: [{ translateX: gel.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) }] }}>
          <TeamBadge name={DENEME.a} size={72} />
        </Animated.View>
        <Animated.View style={[s.sayacKutu, { transform: [{ scale: pop }] }]}>
          <Text style={[s.sayac, son && s.sayacSon]} numberOfLines={1} adjustsFontSizeToFit>{DONGU[i]}</Text>
        </Animated.View>
        <Animated.View style={{ opacity: gel, transform: [{ translateX: gel.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) }] }}>
          <TeamBadge name={DENEME.b} size={72} />
        </Animated.View>
      </View>
      <View style={s.maddeler}>
        <Madde ikon="flash" yazi="Bildiğin an “BİLİYORUM”a bas; yaz ya da sesle söyle." />
        <Madde ikon="people" yazi="CPU'ya karşı, yanındaki arkadaşınla ya da online rakiple oyna." />
        <Madde ikon="trophy" yazi="Her doğru cevap XP, rozet ve futbolcu koleksiyonu demek." />
      </View>
    </View>
  );
}

function Madde({ ikon, yazi }) {
  return (
    <View style={s.madde}>
      <View style={s.maddeIkon}><Ionicons name={ikon} size={16} color={COLORS.accent} /></View>
      <Text style={s.maddeYazi}>{yazi}</Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// 2) Canlı deneme turu
// --------------------------------------------------------------------------
function DenemeTuru({ onBitti }) {
  const [faz, setFaz] = useState("sayim");   // sayim | oyun | dogru
  const [girdi, setGirdi] = useState("");
  const [uyari, setUyari] = useState(null);
  const [ipucu, setIpucu] = useState(0);     // 0 yok, 1 ülke + baş harf, 2 adın yarısı
  const [bulunan, setBulunan] = useState(null);
  const [kendiBuldu, setKendiBuldu] = useState(false);
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const c3 = useAudioPlayer(require("../assets/sounds/count-3.mp3"));
  const c2 = useAudioPlayer(require("../assets/sounds/count-2.mp3"));
  const c1 = useAudioPlayer(require("../assets/sounds/count-1.mp3"));
  const cevaplar = useMemo(() => {
    const l = playersForPair(PLAYERS, DENEME.a, DENEME.b);
    const tekil = [...new Map(l.map((p) => [p.name, p])).values()];
    return tekil.sort((x, y) => taninirlik(y) - taninirlik(x));
  }, []);
  const indeks = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => (faz === "oyun" && girdi.trim().length >= 2 ? suggestPlayers(indeks, girdi, 4) : []), [indeks, girdi, faz]);
  const kutla = useRef(new Animated.Value(0)).current;
  const ornek = cevaplar[0];

  function bitir(ad, kendisi) {
    setBulunan(ad);
    setKendiBuldu(kendisi);
    setFaz("dogru");
    setUyari(null);
    if (Keyboard.dismiss) Keyboard.dismiss();
    kutla.setValue(0);
    Animated.spring(kutla, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();
    if (onBitti) onBitti();
  }
  function gonder(metin) {
    const m = String(metin ?? girdi).trim();
    if (!m) return;
    const p = findMatchedPlayer(m, cevaplar);
    if (p) { playCorrect(); bitir(p.name, true); }
    else { playWrong(); setUyari(`“${m}” bu iki takımda birlikte oynamadı — bir daha dene.`); }
    setGirdi("");
  }

  const uyruk = ornek && PLAYER_NATIONALITY[ornek.name] && PLAYER_NATIONALITY[ornek.name][0];
  const ulke = uyruk ? countryTr(uyruk) : null;
  return (
    <View style={s.sayfa}>
      {faz === "sayim" ? <CountdownOverlay onComplete={() => setFaz("oyun")} countPlayers={[c3, c2, c1]} /> : null}
      <Text style={s.ust}>DENEME TURU</Text>
      <Text style={s.baslikKucuk}>İkisinde de oynamış bir futbolcu yaz</Text>
      <EslesmeKarti sol={{ tip: "kulup", ad: DENEME.a }} sag={{ tip: "kulup", ad: DENEME.b }} style={{ marginTop: SPACING.md }} />

      {faz === "oyun" ? (
        <View style={{ marginTop: SPACING.lg }}>
          <View style={s.girdiSatir}>
            <TextInput
              value={girdi}
              onChangeText={(t) => { setGirdi(t); if (uyari) setUyari(null); }}
              onSubmitEditing={() => gonder()}
              placeholder="Futbolcu adı…"
              placeholderTextColor={COLORS.textFaint}
              autoCorrect={false}
              autoCapitalize="words"
              spellCheck={false}
              style={s.girdi}
              accessibilityLabel="Futbolcu adı"
            />
            <MikrofonDugmesi onMetin={(m) => setGirdi(m)} onGonder={(m) => gonder(m)} />
            <SoundPressable style={s.gonder} onPress={() => gonder()} accessibilityLabel="Gönder">
              <Ionicons name="send" size={18} color={COLORS.accentDark} />
            </SoundPressable>
          </View>
          {oneriler.length ? (
            <View style={s.oneriKutu}>
              {oneriler.map((o) => (
                <Pressable key={o} onPress={() => gonder(o)} style={s.oneriSatir} accessibilityRole="button" accessibilityLabel={o}>
                  <Text style={s.oneriYazi}>{o}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {uyari ? <Text style={s.uyari}>{uyari}</Text> : null}
          {ipucu > 0 && ornek ? (
            <View style={s.ipucuKutu}>
              <Ionicons name="bulb" size={16} color={COLORS.cta} />
              <Text style={s.ipucuYazi}>
                {ipucu === 1
                  ? `${ulke ? "Uyruğu " + ulke + "; " : ""}adı “${ornek.name[0]}” ile başlıyor.`
                  : `${ornek.name.slice(0, Math.ceil(ornek.name.length / 2))}…`}
              </Text>
            </View>
          ) : null}
          <View style={s.yardimSatir}>
            {ipucu < 2 ? (
              <SoundPressable onPress={() => setIpucu(ipucu + 1)} style={s.yardim} accessibilityLabel="İpucu">
                <Ionicons name="bulb-outline" size={16} color={COLORS.textMuted} />
                <Text style={s.yardimYazi}>{ipucu === 0 ? "İpucu" : "Bir ipucu daha"}</Text>
              </SoundPressable>
            ) : (
              <SoundPressable onPress={() => ornek && bitir(ornek.name, false)} style={s.yardim} accessibilityLabel="Cevabı göster">
                <Ionicons name="eye-outline" size={16} color={COLORS.textMuted} />
                <Text style={s.yardimYazi}>Cevabı göster</Text>
              </SoundPressable>
            )}
          </View>
          <Text style={s.not}>Gerçek maçta önce “BİLİYORUM”a basarsın; rakibin de aynı anda yarışır.</Text>
        </View>
      ) : null}

      {faz === "dogru" && bulunan ? (
        <Animated.View style={[s.kutlama, { opacity: kutla, transform: [{ scale: kutla.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
          <Text style={s.kutlamaUst}>{kendiBuldu ? "GOOOL!" : "CEVAP"}</Text>
          <PlayerPhoto name={bulunan} size={88} />
          <Text style={s.kutlamaAd}>{bulunan}</Text>
          <Text style={s.kutlamaAlt}>
            {kendiBuldu ? "Tam isabet. " : ""}{DENEME.a} ve {DENEME.b} formasını giydi. Bu ikilinin {cevaplar.length} doğru cevabı var — her turda başka bir ikili gelir.
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// --------------------------------------------------------------------------
// 3) Diğer oyunlar — küçük döngü animasyonları
// --------------------------------------------------------------------------
function useDongu(adet, ms) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % adet), ms);
    return () => clearInterval(t);
  }, [adet, ms]);
  return i;
}

function ModKarti({ ikon, baslik, metin, children }) {
  return (
    <View style={s.modKart}>
      <View style={s.modSol}>
        <View style={s.modIkon}><ModIkon ad={ikon} boyut={24} renk={COLORS.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.modBaslik}>{baslik}</Text>
          <Text style={s.modMetin}>{metin}</Text>
        </View>
      </View>
      <View style={s.modSahne} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{children}</View>
    </View>
  );
}

const BES = ["Real Madrid", "Juventus", "Inter Milan", "AC Milan", "Galatasaray"];
function BesKulupAnim() {
  const i = useDongu(BES.length + 3, 650);
  return (
    <View style={s.besSatir}>
      {BES.map((k, n) => (
        <View key={k} style={{ opacity: n < i ? 1 : 0.12 }}><TeamBadge name={k} size={30} /></View>
      ))}
      <Text style={[s.animSonuc, { opacity: i >= BES.length ? 1 : 0 }]}>→ ?</Text>
    </View>
  );
}

const XOX_SIRA = [4, 0, 6, 8, 2];
function XoxAnim() {
  const i = useDongu(XOX_SIRA.length + 3, 600);
  const tahta = Array(9).fill(null);
  XOX_SIRA.slice(0, i).forEach((h, n) => (tahta[h] = n % 2 === 0 ? "X" : "O"));
  const bitti = i >= XOX_SIRA.length;
  return (
    <View style={s.xox}>
      {tahta.map((v, n) => (
        <View key={n} style={[s.xoxKare, bitti && [2, 4, 6].includes(n) && s.xoxKazanan]}>
          <Text style={[s.xoxYazi, v === "O" && { color: COLORS.cta }]}>{v || ""}</Text>
        </View>
      ))}
    </View>
  );
}

const KIMBU_IPUCU = ["Brezilya", "Forvet", "Barcelona", "Real Madrid", "1976"];
function KimBuAnim() {
  const i = useDongu(KIMBU_IPUCU.length + 3, 650);
  return (
    <View style={s.kimbu}>
      {KIMBU_IPUCU.map((t, n) => (
        <View key={t} style={[s.cip, { opacity: n < i ? 1 : 0.1 }]}><Text style={s.cipYazi}>{t}</Text></View>
      ))}
      <Text style={[s.animSonuc, { opacity: i > KIMBU_IPUCU.length ? 1 : 0 }]}>Ronaldo!</Text>
    </View>
  );
}

function Modlar() {
  return (
    <View style={s.sayfa}>
      <Text style={s.ust}>DAHA FAZLASI</Text>
      <Text style={s.baslikKucuk}>3-2-1'in yanında dört oyun daha</Text>
      <ModKarti ikon="besKulup" baslik="5 Kulüp" metin="Beş kulübün hepsinde oynamış futbolcuyu bul.">
        <BesKulupAnim />
      </ModKarti>
      <ModKarti ikon="xox" baslik="Futbolcu XOX" metin="Satır ile sütunun ortak futbolcusunu söyle, kareyi kap.">
        <XoxAnim />
      </ModKarti>
      <ModKarti ikon="kimBu" baslik="Kim Bu Futbolcu?" metin="İpuçları teker teker açılır; erken bilen çok puan alır.">
        <KimBuAnim />
      </ModKarti>
      <Text style={s.not}>Bir de İlk Harf var. Her gün biri “Günün modu” olur ve 2× XP verir.</Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// 4) Online + her gün
// --------------------------------------------------------------------------
function Online() {
  const nabiz = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(nabiz, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(nabiz, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    a.start();
    return () => { if (a.stop) a.stop(); };
  }, []);
  return (
    <View style={s.sayfa}>
      <Text style={s.ust}>KAPIŞMA ZAMANI</Text>
      <Text style={s.baslikKucuk}>Arkadaşına ya da rastgele bir rakibe meydan oku</Text>
      <View style={s.vs} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={s.oyuncu}><Ionicons name="person" size={34} color={COLORS.text} /><Text style={s.oyuncuAd}>Sen</Text></View>
        <Animated.View style={{ transform: [{ scale: nabiz.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }}>
          <View style={s.vsRozet}><Ionicons name="flame" size={26} color={COLORS.accentDark} /></View>
        </Animated.View>
        <View style={s.oyuncu}><Ionicons name="person" size={34} color={COLORS.cta} /><Text style={s.oyuncuAd}>Rakip</Text></View>
      </View>
      <View style={s.maddeler}>
        <Madde ikon="shuffle" yazi="Hızlı Eşleş: saniyeler içinde bir rakip, puanlı maç." />
        <Madde ikon="key" yazi="Arkadaşınla: kodu gönder, aynı odada kapışın." />
        <Madde ikon="calendar" yazi="Her gün yeni bulmaca: serini bozma, rozetleri topla." />
      </View>
      <Text style={s.metin}>Hazırsan başlayalım. Önce tuttuğun takımı soracağız — turlarda biraz daha sık çıksın diye.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg },
  sayfa: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xxl + 8 },
  ust: { ...TYPE.eyebrow },
  baslik: { ...TYPE.display, fontSize: 38, marginTop: SPACING.sm },
  baslikKucuk: { ...TYPE.h1, fontSize: 23, marginTop: SPACING.sm },
  metin: { ...TYPE.body, color: COLORS.textMuted, marginTop: SPACING.md, lineHeight: 23 },

  sahne: {
    marginTop: SPACING.xl, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: SPACING.xl, paddingHorizontal: SPACING.lg, borderRadius: 24,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: saydam(COLORS.text, 0.08),
  },
  sayacKutu: { flex: 1, alignItems: "center", paddingHorizontal: SPACING.sm },
  sayac: { fontSize: 64, fontWeight: "900", color: COLORS.text },
  sayacSon: { fontSize: 24, color: COLORS.accent, letterSpacing: 1 },

  maddeler: { marginTop: SPACING.xl, gap: SPACING.md },
  madde: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  maddeIkon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: vurguZemini(0.14) },
  maddeYazi: { ...TYPE.body, flex: 1, fontSize: 14 },

  girdiSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  girdi: {
    flex: 1, minWidth: 0, backgroundColor: COLORS.card, borderColor: COLORS.accent, borderWidth: 2, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, color: COLORS.text, fontSize: 16,
  },
  gonder: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  oneriKutu: { marginTop: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: "hidden" },
  oneriSatir: { paddingVertical: 11, paddingHorizontal: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.cardBorder },
  oneriYazi: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  uyari: { ...TYPE.caption, color: COLORS.danger, marginTop: SPACING.sm, textAlign: "center" },
  ipucuKutu: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: saydam(COLORS.cta, 0.12) },
  ipucuYazi: { ...TYPE.body, flex: 1, fontWeight: "800" },
  yardimSatir: { flexDirection: "row", justifyContent: "center", marginTop: SPACING.md },
  yardim: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.cardBorder },
  yardimYazi: { ...TYPE.caption, fontSize: 13, color: COLORS.text },
  not: { ...TYPE.caption, textAlign: "center", marginTop: SPACING.lg, color: COLORS.textFaint },

  kutlama: { alignItems: "center", marginTop: SPACING.xl, padding: SPACING.lg, borderRadius: 24, backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.accent },
  kutlamaUst: { fontSize: 22, fontWeight: "900", color: COLORS.accent, letterSpacing: 1.5, marginBottom: SPACING.md },
  kutlamaAd: { ...TYPE.h2, marginTop: SPACING.md, textAlign: "center" },
  kutlamaAlt: { ...TYPE.bodyMuted, textAlign: "center", marginTop: 6 },

  modKart: { marginTop: SPACING.md, padding: SPACING.md, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: saydam(COLORS.text, 0.07) },
  modSol: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  modIkon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: vurguZemini(0.14) },
  modBaslik: { ...TYPE.h3 },
  modMetin: { ...TYPE.bodyMuted, marginTop: 1 },
  modSahne: { marginTop: SPACING.sm, minHeight: 44, justifyContent: "center" },
  besSatir: { flexDirection: "row", alignItems: "center", gap: 8 },
  animSonuc: { fontSize: 16, fontWeight: "900", color: COLORS.accent, marginLeft: 6 },
  xox: { width: 3 * 30 + 4, flexDirection: "row", flexWrap: "wrap", gap: 2, alignSelf: "flex-start" },
  xoxKare: { width: 30, height: 30, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: saydam(COLORS.text, 0.06) },
  xoxKazanan: { backgroundColor: vurguZemini(0.3) },
  xoxYazi: { fontSize: 16, fontWeight: "900", color: COLORS.accent },
  kimbu: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  cip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: saydam(COLORS.text, 0.08) },
  cipYazi: { color: COLORS.text, fontSize: 12, fontWeight: "800" },

  vs: { marginTop: SPACING.xl, flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: SPACING.xl, borderRadius: 24, backgroundColor: COLORS.card, borderWidth: 1, borderColor: saydam(COLORS.text, 0.08) },
  oyuncu: { alignItems: "center", gap: 6 },
  oyuncuAd: { ...TYPE.h3 },
  vsRozet: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },

  alt: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, paddingTop: SPACING.sm },
  noktalar: { flexDirection: "row", justifyContent: "center", gap: SPACING.sm, marginBottom: SPACING.lg },
  nokta: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.cardBorder },
  noktaAktif: { backgroundColor: COLORS.accent, width: 22 },
  dugmeSatir: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gec: { color: COLORS.textMuted, fontSize: 15, fontWeight: "700" },
  ileri: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 14, paddingHorizontal: 28 },
  ileriSoluk: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  ileriYazi: { color: COLORS.accentDark, fontWeight: "900", textTransform: "uppercase", fontSize: 13, letterSpacing: 0.6 },
});
