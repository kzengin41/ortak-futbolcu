import { _t } from "../lib/dil";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, Share, Animated, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import MikrofonDugmesi from "../components/MikrofonDugmesi";
import PlayerPhoto, { oncedenYukle } from "../components/PlayerPhoto";
import TimerBar from "../components/TimerBar";
import CountdownOverlay from "../components/CountdownOverlay";
import MacSonuKarti from "../components/MacSonuKarti";
import AnswerFeedback from "../components/AnswerFeedback";
import EslesmeKarti from "../components/EslesmeKarti";
import BilemedimDugmesi from "../components/BilemedimDugmesi";
import Konfeti from "../components/Konfeti";
import { OyunUstCubugu } from "../components/MacCercevesi";
import { PLAYERS } from "../lib/players";
import { findMatchedPlayer, suggestPlayers, buildSuggestIndex, hizliEslesmeHazirla } from "../lib/gameEngine";
import { taninirlik } from "../lib/taninirlik";
import {
  CAN, YANLIS_CEZA_SN, turUret, turPuani, havuzIsit, yeniTohum, kodla, coz, paylasimMetni, rekorOku, rekorYaz,
} from "../lib/hayattaKal";
import { seriYanlis } from "../lib/seri";
import { yazmaOldu } from "../lib/yazmaKilidi";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP } from "../lib/profile";
import { COLORS, MODE_COLORS, SPACING, RADIUS, saydam } from "../lib/theme";

// ============================================================================
// HAYATTA KAL — Paket 46 (Kerem: "oyun zevkini artıracak değişiklikler yapalım
// … artık kitlelere yayılabiliriz … aşırı zevkli yapmak lazım"; seçtiği paket:
// "Rekabet: seri modu + meydan okuma").
// Kurallar ve kod biçimi lib/hayattaKal.js başında. Akış:
//   giriş (kurallar · rekor · arkadaş kodu) → 3-2-1 → turlar → can bitince sonuç
//   (MacSonuKarti + meydan okuma kodu: "HK-XXXXXXX", Paylaş ile gider).
// Arkadaşın kodu girince AYNI turları oynar, hedefi ekranda görür.
// ============================================================================
const VURGU = MODE_COLORS.teamTeam;
const XP_TUR = 5;
const XP_TAVAN = 200;

export default function HayattaKalScreen({ kod: gelenKod, onExit, onExitSilent }) {
  const cikis = onExitSilent || onExit;
  const ilkMeydan = useMemo(() => (gelenKod ? coz(gelenKod) : null), [gelenKod]);
  const [faz, setFaz] = useState("giris"); // giris | geri | oyun | kacti | bitti
  const [tohum, setTohum] = useState(() => (ilkMeydan ? ilkMeydan.tohum : yeniTohum()));
  const [hedef, setHedef] = useState(ilkMeydan ? ilkMeydan.skor : null);
  const [kodGirdi, setKodGirdi] = useState("");
  const [kodHata, setKodHata] = useState(null);

  const [turNo, setTurNo] = useState(0);
  const [tur, setTur] = useState(null);
  const kullanilanRef = useRef(new Set());
  const [can, setCan] = useState(CAN);
  const [kalan, setKalan] = useState(25);
  const [skor, setSkor] = useState(0);
  const [puan, setPuan] = useState(0);
  const [kareler, setKareler] = useState([]);
  const [girdi, setGirdi] = useState("");
  const [uyari, setUyari] = useState(null);
  const [feedback, setFeedback] = useState(null); // { oyuncu }
  const [kacan, setKacan] = useState(null);       // { neden, cevaplar }
  const [rekor, setRekor] = useState({ skor: 0, puan: 0 });
  const [yeniRekor, setYeniRekor] = useState(false);
  const [kutlama, setKutlama] = useState(null);   // "rekor" | "hedef" (oyun içi an)
  const kutlamaOlcek = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);

  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => (girdi.trim().length > 1 ? suggestPlayers(suggestIndex, girdi).slice(0, 4) : []), [suggestIndex, girdi]);

  useEffect(() => {
    rekorOku().then(setRekor).catch(() => {});
    // Girişte ilk havuz ve hızlı eşleşme dizini hazırlansın (ilk tur takılmasın).
    const t = setTimeout(() => { havuzIsit(PLAYERS, 0); hizliEslesmeHazirla(PLAYERS); }, 400);
    return () => clearTimeout(t);
  }, []);

  // ------------------------------------------------------------------ saat
  useEffect(() => {
    if (faz !== "oyun" || feedback) return;
    if (kalan <= 0) { canGitti("sure"); return; }
    const t = setTimeout(() => setKalan((k) => k - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faz, kalan, feedback]);

  // ------------------------------------------------------------------ akış
  function turKur(n) {
    let r = turUret(PLAYERS, tohum, n, kullanilanRef.current);
    if (!r) { kullanilanRef.current = new Set(); r = turUret(PLAYERS, tohum, n, kullanilanRef.current); }
    if (!r) { bitir(); return; }
    kullanilanRef.current.add(r.key);
    oncedenYukle(r.validAnswers);
    setTurNo(n);
    setTur({ sol: { tip: "kulup", ad: r.teamA }, sag: { tip: "kulup", ad: r.teamB }, validAnswers: r.validAnswers, zorluk: r.zorluk, sure: r.sure });
    setKalan(r.sure);
    setGirdi("");
    setUyari(null);
    setKacan(null);
    setFaz("oyun");
    // Sonraki turun havuzu şimdiden (zorluk değişiyorsa) — oyuncu düşünürken hazırlanır.
    setTimeout(() => havuzIsit(PLAYERS, n + 1), 900);
    setTimeout(() => inputRef.current?.focus?.(), 60);
  }

  function basla(yeniOyun = false) {
    if (yeniOyun) { setTohum(yeniTohum()); setHedef(null); }
    kullanilanRef.current = new Set();
    setCan(CAN);
    setSkor(0);
    setPuan(0);
    setKareler([]);
    setYeniRekor(false);
    setKutlama(null);
    setFeedback(null);
    setTur(null);
    setFaz("geri");
  }

  // Geri sayım bitince ilk tur (tohum state'i güncellenmiş olur).
  function geriSayimBitti() { turKur(0); }

  function kutla(tip) {
    setKutlama(tip);
    kutlamaOlcek.setValue(0);
    Animated.spring(kutlamaOlcek, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => setKutlama((k) => (k === tip ? null : k)), 2600);
  }

  function cevapGonder(override) {
    if (faz !== "oyun" || !tur || feedback) return;
    const text = String(override !== undefined ? override : girdi).trim();
    if (!text) return;
    const dogru = findMatchedPlayer(text, tur.validAnswers);
    setGirdi("");
    if (dogru) {
      const yeniSkor = skor + 1;
      setSkor(yeniSkor);
      setPuan((p) => p + turPuani(kalan));
      setKareler((k) => [...k, "sen"]);
      unlockPlayer(dogru.name);
      recordRound("hayattaKal", true);
      playCorrect();
      setFeedback({ oyuncu: dogru });
      if (hedef != null && yeniSkor === hedef + 1) kutla("hedef");
      else if (rekor.skor > 0 && yeniSkor === rekor.skor + 1) kutla("rekor");
      return;
    }
    playWrong();
    const kim = findMatchedPlayer(text, PLAYERS);
    if (kim) {
      setKalan((k) => Math.max(0, k - YANLIS_CEZA_SN));
      setUyari(_t("{0} bu ikisinde oynamadı · −{1} sn", [kim.name, YANLIS_CEZA_SN]));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else {
      setUyari(_t("\"{0}\" diye bir futbolcu bulamadım", [text]));
    }
  }

  function canGitti(neden) {
    if (faz !== "oyun" || !tur) return;
    playWrong();
    seriYanlis();
    recordRound("hayattaKal", false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setKareler((k) => [...k, "rakip"]);
    setCan((c) => c - 1);
    const cevaplar = [...tur.validAnswers].sort((a, b) => taninirlik(b) - taninirlik(a)).slice(0, 3);
    setKacan({ neden, cevaplar, toplam: tur.validAnswers.length });
    setFaz("kacti");
  }

  function devam() {
    if (can <= 0) { bitir(); return; }
    turKur(turNo + 1);
  }

  async function bitir() {
    setFaz("bitti");
    const r = await rekorYaz(skor, puan).catch(() => ({ onceki: rekor, yeni: false }));
    setYeniRekor(!!r.yeni);
    if (r.yeni) setRekor({ skor, puan });
    Promise.resolve(addXP(Math.min(XP_TAVAN, XP_TUR * skor))).catch(() => {});
  }

  function kodKabul() {
    const c = coz(kodGirdi);
    if (!c) { setKodHata(_t("Bu kod çözülmedi — harfleri kontrol et (ör. HK-3WB235H)")); return; }
    setKodHata(null);
    setTohum(c.tohum);
    setHedef(c.skor);
    setKodGirdi("");
  }

  const benimKod = kodla({ tohum, skor });
  const paylasim = paylasimMetni({ skor, puan, kod: benimKod, hedef });
  async function meydanOku() { try { await Share.share({ message: paylasim }); } catch (e) {} }

  const canlar = (
    <View style={s.canlar}>
      {Array.from({ length: CAN }, (_, i) => (
        <Ionicons key={i} name={i < can ? "heart" : "heart-outline"} size={18} color={i < can ? COLORS.danger : COLORS.textFaint} />
      ))}
    </View>
  );

  // ================================================================== GİRİŞ
  if (faz === "giris") {
    return (
      <GameBackground style={s.kap} klavye="kaydir">
        <OyunUstCubugu baslik={_t("Hayatta Kal")} alt={_t("Tek başına · sonsuz")} onCikis={cikis} sag={null} />
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={s.vitrin}>
            <View style={s.vitrinKalpler}>
              {Array.from({ length: CAN }, (_, i) => <Ionicons key={i} name="heart" size={30} color={COLORS.danger} />)}
            </View>
            <Text style={s.vitrinBaslik}>{_t("HAYATTA KAL")}</Text>
            <Text style={s.vitrinAlt}>{_t("Canların bitene kadar kaç tur gidebilirsin?")}</Text>
            <View style={s.rekorCip}>
              <Ionicons name="trophy" size={14} color={COLORS.cta} />
              <Text style={s.rekorYazi}>{rekor.skor ? _t("Rekorun: {0} tur", [rekor.skor]) : _t("Henüz rekorun yok")}</Text>
            </View>
          </View>

          {hedef != null ? (
            <View style={s.meydan}>
              <Ionicons name="flash" size={22} color={COLORS.cta} />
              <View style={{ flex: 1 }}>
                <Text style={s.meydanBaslik}>{_t("MEYDAN OKUMA · HEDEF {0} TUR", [hedef])}</Text>
                <Text style={s.meydanAlt}>{_t("Arkadaşın {0} tur gitti. Aynı soruları oynayacaksın — geç bakalım!", [hedef])}</Text>
              </View>
              <Pressable hitSlop={10} onPress={() => { setHedef(null); setTohum(yeniTohum()); }} accessibilityLabel={_t("Meydan okumayı bırak")}>
                <Ionicons name="close-circle" size={22} color={COLORS.textMuted} />
              </Pressable>
            </View>
          ) : null}

          <View style={s.kurallar}>
            <Kural ikon="shield-checkmark" metin={_t("İki kulüp gelir; ikisinde de oynamış bir futbolcu yaz.")} />
            <Kural ikon="heart-dislike" metin={_t("Süre biterse ya da Bilemedim dersen 1 can gider. 3 can var.")} />
            <Kural ikon="timer" metin={_t("Yanlış isim can götürmez ama {0} saniye yer.", [YANLIS_CEZA_SN])} />
            <Kural ikon="trending-up" metin={_t("Her 4 turda çiftler zorlaşır, süre kısalır. Hızlı cevap daha çok puan.")} />
          </View>

          <SoundPressable style={s.basla} onPress={() => basla(false)} accessibilityLabel={_t("Başla")}>
            <Ionicons name="play" size={20} color={COLORS.accentDark} />
            <Text style={s.baslaYazi}>{hedef != null ? _t("MEYDAN OKUMAYI KABUL ET") : _t("BAŞLA")}</Text>
          </SoundPressable>

          {hedef == null ? (
            <View style={s.kodKutu}>
              <Text style={s.kodBaslik}>{_t("Arkadaşından kod mu geldi?")}</Text>
              <View style={s.kodSatir}>
                <TextInput
                  style={s.kodGirdi}
                  value={kodGirdi}
                  onChangeText={(t) => { setKodGirdi(t); setKodHata(null); }}
                  onSubmitEditing={kodKabul}
                  placeholder="HK-XXXXXXX"
                  placeholderTextColor={COLORS.textFaint}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="go"
                  maxLength={12}
                />
                <SoundPressable style={[s.kodDugme, !kodGirdi.trim() && { opacity: 0.4 }]} onPress={kodKabul} disabled={!kodGirdi.trim()} accessibilityLabel={_t("Kodu gir")}>
                  <Text style={s.kodDugmeYazi}>{_t("GİR")}</Text>
                </SoundPressable>
              </View>
              {kodHata ? <Text style={s.hata}>{kodHata}</Text> : null}
            </View>
          ) : null}
        </ScrollView>
      </GameBackground>
    );
  }

  // ================================================================== SONUÇ
  if (faz === "bitti") {
    // Meydan okumada başlık hedefin sonucu; kutlama (konfeti) hedef geçilince.
    const gecti = hedef != null ? skor > hedef : yeniRekor;
    const baslik = hedef != null ? (gecti ? _t("HEDEFİ GEÇTİN!") : _t("HEDEF KAÇTI")) : yeniRekor ? _t("YENİ REKOR!") : _t("CANLAR BİTTİ");
    return (
      <GameBackground style={s.kap}>
        <OyunUstCubugu baslik={_t("Hayatta Kal")} onCikis={cikis} sag={null} />
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <MacSonuKarti
            modAdi={_t("Hayatta Kal")}
            modeId="hayattaKal"
            turlar={kareler}
            kareSatir={10}
            solo={{
              puan: skor,
              rekor: rekor.skor || 0,
              yeniRekor: gecti,
              baslik,
              etiket: _t("TUR · rekor"),
              satirlar: [
                [_t("Puan (hız dahil)"), String(puan)],
                ...(hedef != null ? [[_t("Hedef"), _t("{0} tur", [hedef])]] : []),
                ...(hedef != null && yeniRekor ? [[_t("Kişisel rekor"), _t("yeni! {0} tur", [skor])]] : []),
                [_t("Ulaştığın zorluk"), `${tur ? tur.zorluk : 2}/10`],
              ],
            }}
            kazanilanXp={Math.min(XP_TAVAN, XP_TUR * skor)}
            paylasimMetni={paylasim}
            rovansEtiketi={_t("YENİ OYUN")}
            onRovans={() => basla(true)}
            onMenu={cikis}
            ekSatir={
              <View style={s.kodKart}>
                <Text style={s.kodKartBaslik}>{_t("MEYDAN OKU")}</Text>
                <Text style={s.kodKartKod} selectable>{benimKod}</Text>
                <Text style={s.kodKartAlt}>{_t("Bu kodla arkadaşın aynı soruları oynar ve {0} turunu geçmeye çalışır.", [skor])}</Text>
                <SoundPressable style={s.kodKartDugme} onPress={meydanOku} accessibilityLabel={_t("Arkadaşına gönder")}>
                  <Ionicons name="paper-plane" size={18} color={COLORS.ctaDark} />
                  <Text style={s.kodKartDugmeYazi}>{_t("ARKADAŞINA GÖNDER")}</Text>
                </SoundPressable>
              </View>
            }
          />
        </ScrollView>
      </GameBackground>
    );
  }

  // ================================================================== OYUN
  return (
    <GameBackground style={s.kap} klavye="kaydir">
      {faz === "geri" ? <CountdownOverlay onComplete={geriSayimBitti} /> : null}
      {feedback ? (
        <AnswerFeedback seri correct player={feedback.oyuncu} onDone={() => { setFeedback(null); turKur(turNo + 1); }} />
      ) : null}
      {kutlama ? <Konfeti adet={50} kaynak="ust" sure={2200} /> : null}

      <OyunUstCubugu
        baslik={_t("Hayatta Kal")}
        alt={hedef != null ? _t("Tur {0} · hedef {1}", [turNo + 1, hedef]) : _t("Tur {0} · rekor {1}", [turNo + 1, Math.max(rekor.skor || 0, skor)])}
        onCikis={onExit}
        sag={canlar}
      />

      <View style={s.skorSerit}>
        <View style={s.skorKutu}>
          <Text style={s.skorSayi}>{skor}</Text>
          <Text style={s.skorEtiket}>{_t("TUR")}</Text>
        </View>
        <View style={s.zorlukKutu}>
          {Array.from({ length: 7 }, (_, i) => (
            <View key={i} style={[s.zorlukCubuk, { height: 6 + i * 3 }, tur && i <= tur.zorluk - 2 && { backgroundColor: i >= 5 ? COLORS.danger : i >= 3 ? COLORS.cta : VURGU.main }]} />
          ))}
          <Text style={s.skorEtiket}>{_t("ZORLUK")}</Text>
        </View>
        <View style={s.skorKutu}>
          <Text style={s.skorSayi}>{puan}</Text>
          <Text style={s.skorEtiket}>{_t("PUAN")}</Text>
        </View>
      </View>

      {kutlama ? (
        <Animated.View style={[s.kutlama, { transform: [{ scale: kutlamaOlcek }] }]}>
          <Text style={s.kutlamaYazi}>{kutlama === "hedef" ? _t("🏁 HEDEFİ GEÇTİN!") : _t("🏆 REKORUNU GEÇTİN!")}</Text>
        </Animated.View>
      ) : null}

      {tur && (faz === "oyun" || faz === "kacti") ? (
        <>
          <EslesmeKarti sol={tur.sol} sag={tur.sag} />
          <View style={s.bilgiSatir}>
            <View style={s.ortakCip}>
              <Ionicons name="people" size={14} color={COLORS.accent} />
              <Text style={s.ortakYazi}>{_t("Bu ikilide")}{" "}{tur.validAnswers.length}{" "}{_t("ortak futbolcu var")}</Text>
            </View>
          </View>
        </>
      ) : null}

      {faz === "oyun" && tur ? (
        <View style={{ marginTop: 10 }}>
          <View style={s.sureSatir}>
            <View style={{ flex: 1 }}><TimerBar current={Math.max(0, kalan)} total={tur.sure} /></View>
            <Text style={[s.sureYazi, kalan <= 5 && { color: COLORS.danger }]}>{Math.max(0, kalan)}{" "}{_t("sn")}</Text>
            <BilemedimDugmesi onPress={() => canGitti("pas")} />
          </View>
          <View style={s.girdiSatir}>
            <TextInput
              ref={inputRef}
              style={s.girdi}
              value={girdi}
              onChangeText={(t) => { yazmaOldu(); setGirdi(t); if (uyari) setUyari(null); }}
              onSubmitEditing={() => cevapGonder()}
              placeholder={_t("Futbolcu adı…")}
              placeholderTextColor={COLORS.textFaint}
              autoCorrect={false}
              autoCapitalize="words"
              spellCheck={false}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <MikrofonDugmesi onMetin={(m) => setGirdi(m)} onGonder={(m) => cevapGonder(m)} />
            <SoundPressable style={s.gonder} onPress={() => cevapGonder()} accessibilityLabel={_t("Cevabı gönder")}>
              <Ionicons name="arrow-forward" size={20} color={COLORS.accentDark} />
            </SoundPressable>
          </View>
          {oneriler.length ? (
            <View style={s.oneriKutu}>
              {oneriler.map((ad) => (
                <Pressable key={ad} style={s.oneri} onPress={() => cevapGonder(ad)}>
                  <Ionicons name="person-circle-outline" size={18} color={COLORS.textMuted} />
                  <Text style={s.oneriYazi} numberOfLines={1}>{ad}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {uyari ? <Text style={s.hata}>{uyari}</Text> : null}
        </View>
      ) : null}

      {faz === "kacti" && kacan ? (
        <View style={s.kacti}>
          <Text style={s.kactiBaslik}>{kacan.neden === "sure" ? _t("Süre doldu · −1 can") : _t("Pas geçtin · −1 can")}</Text>
          <Text style={s.kactiAlt}>{kacan.toplam > 3 ? _t("Bunlardan biri olurdu ({0} doğru cevap vardı):", [kacan.toplam]) : _t("Doğru cevaplar:")}</Text>
          <View style={s.kactiListe}>
            {kacan.cevaplar.map((p) => (
              <View key={p.name} style={s.kactiOyuncu}>
                <PlayerPhoto name={p.name} size={52} />
                <Text style={s.kactiAd} numberOfLines={2}>{p.name}</Text>
              </View>
            ))}
          </View>
          <SoundPressable style={[s.basla, can <= 0 && { backgroundColor: COLORS.cta }]} onPress={devam}>
            <Text style={[s.baslaYazi, can <= 0 && { color: COLORS.ctaDark }]}>{can <= 0 ? _t("SONUCU GÖR") : _t("DEVAM · {0} can kaldı", [can])}</Text>
          </SoundPressable>
        </View>
      ) : null}
    </GameBackground>
  );
}

function Kural({ ikon, metin }) {
  return (
    <View style={s.kural}>
      <Ionicons name={ikon} size={18} color={VURGU.main} />
      <Text style={s.kuralYazi}>{metin}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg, padding: 20, paddingBottom: 24 },
  canlar: { flexDirection: "row", gap: 3 },

  vitrin: { alignItems: "center", marginTop: SPACING.md, paddingVertical: SPACING.xl, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.xl, backgroundColor: VURGU.dark, borderWidth: 1.5, borderColor: saydam(VURGU.main, 0.4) },
  vitrinKalpler: { flexDirection: "row", gap: 6 },
  vitrinBaslik: { fontSize: 34, fontWeight: "900", letterSpacing: 2, color: COLORS.text, marginTop: 8 },
  vitrinAlt: { fontSize: 14, fontWeight: "600", color: COLORS.textMuted, textAlign: "center", marginTop: 4 },
  rekorCip: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: saydam("#000000", 0.25) },
  rekorYazi: { fontSize: 13, fontWeight: "800", color: COLORS.text },

  meydan: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: SPACING.md, padding: 12, borderRadius: RADIUS.lg, backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.cta },
  meydanBaslik: { fontSize: 13, fontWeight: "900", letterSpacing: 0.8, color: COLORS.cta },
  meydanAlt: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginTop: 2 },

  kurallar: { marginTop: SPACING.md, gap: 10, padding: 14, borderRadius: RADIUS.lg, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  kural: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  kuralYazi: { flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.text, lineHeight: 20 },

  basla: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 56, borderRadius: 16, backgroundColor: COLORS.accent, marginTop: SPACING.lg, alignSelf: "stretch" },
  baslaYazi: { fontSize: 17, fontWeight: "900", letterSpacing: 1, color: COLORS.accentDark },

  kodKutu: { marginTop: SPACING.lg, gap: 8 },
  kodBaslik: { fontSize: 13, fontWeight: "800", color: COLORS.textMuted, textAlign: "center" },
  kodSatir: { flexDirection: "row", gap: 8 },
  kodGirdi: { flex: 1, minWidth: 0, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card, color: COLORS.text, fontSize: 17, fontWeight: "800", letterSpacing: 2, paddingHorizontal: 12 },
  kodDugme: { width: 64, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.cta },
  kodDugmeYazi: { fontSize: 15, fontWeight: "900", color: COLORS.ctaDark },

  skorSerit: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  skorKutu: { alignItems: "center", minWidth: 70 },
  skorSayi: { fontSize: 30, fontWeight: "900", color: COLORS.text, lineHeight: 34 },
  skorEtiket: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: COLORS.textMuted },
  zorlukKutu: { flexDirection: "row", alignItems: "flex-end", gap: 3, flexWrap: "wrap", justifyContent: "center", width: 110 },
  zorlukCubuk: { width: 8, borderRadius: 2, backgroundColor: COLORS.cardBorder },

  kutlama: { alignSelf: "center", marginBottom: 8, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: COLORS.cta },
  kutlamaYazi: { fontSize: 15, fontWeight: "900", letterSpacing: 1, color: COLORS.ctaDark },

  bilgiSatir: { flexDirection: "row", justifyContent: "center", marginTop: 10 },
  ortakCip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: saydam(COLORS.accent, 0.1), borderWidth: 1, borderColor: saydam(COLORS.accent, 0.35) },
  ortakYazi: { color: COLORS.text, fontSize: 13, fontWeight: "800" },

  sureSatir: { flexDirection: "row", alignItems: "center", gap: 8 },
  sureYazi: { color: COLORS.textMuted, fontSize: 13, fontWeight: "800", width: 44, textAlign: "right" },
  girdiSatir: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 2, borderColor: COLORS.accent, paddingHorizontal: 6, height: 54 },
  girdi: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "600", paddingVertical: 0, paddingHorizontal: 6 },
  gonder: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },
  oneriKutu: { marginTop: 4, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  oneri: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, paddingHorizontal: 12 },
  oneriYazi: { color: COLORS.text, fontSize: 15, fontWeight: "600", flex: 1 },
  hata: { color: "#FF8A8A", fontSize: 13, fontWeight: "700", marginTop: 8, textAlign: "center" },

  kacti: { marginTop: 16, alignItems: "center" },
  kactiBaslik: { fontSize: 20, fontWeight: "900", color: COLORS.danger },
  kactiAlt: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted, marginTop: 6, textAlign: "center" },
  kactiListe: { flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 12 },
  kactiOyuncu: { width: 86, alignItems: "center", gap: 6 },
  kactiAd: { fontSize: 12, fontWeight: "800", color: COLORS.text, textAlign: "center" },

  kodKart: { alignSelf: "stretch", alignItems: "center", marginTop: SPACING.lg, padding: 14, borderRadius: RADIUS.lg, backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.cta, gap: 6 },
  kodKartBaslik: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: COLORS.cta },
  kodKartKod: { fontSize: 28, fontWeight: "900", letterSpacing: 3, color: COLORS.text },
  kodKartAlt: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, textAlign: "center" },
  kodKartDugme: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, height: 46, paddingHorizontal: 20, borderRadius: 14, backgroundColor: COLORS.cta },
  kodKartDugmeYazi: { fontSize: 15, fontWeight: "900", letterSpacing: 1, color: COLORS.ctaDark },
});
