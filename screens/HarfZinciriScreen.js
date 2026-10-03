import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import PlayerPhoto from "../components/PlayerPhoto";
import TimerBar from "../components/TimerBar";
import CountdownOverlay from "../components/CountdownOverlay";
import MacSonuKarti from "../components/MacSonuKarti";
import { PLAYERS } from "../lib/players";
import { suggestPlayers, buildSuggestIndex } from "../lib/gameEngine";
import { CAN, sureHesapla, rastgeleHarf, tahminDegerlendir, harfDizini } from "../lib/harfZinciri";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP } from "../lib/profile";
import { COLORS, MODE_COLORS, SPACING, RADIUS } from "../lib/theme";

// ============================================================================
// HARF ZİNCİRİ — tek kişilik hayatta kalma (4 Ekim 2026, benchmark .28548)
// Kurallar lib/harfZinciri.js başında. Kurulum yok: açılınca 3-2-1 ve başla.
// Rekor AsyncStorage'da; bitişte maç sonu kartı (Paylaş + Tekrar).
// ============================================================================
const VURGU = MODE_COLORS.letters;
const REKOR = "harf-zinciri-rekor";

export default function HarfZinciriScreen({ onExit, onExitSilent }) {
  const [phase, setPhase] = useState("geri"); // geri | oyun | bitti
  const [harf, setHarf] = useState(() => rastgeleHarf(PLAYERS));
  const [zincir, setZincir] = useState([]);  // [ad]
  const [can, setCan] = useState(CAN);
  const [kalan, setKalan] = useState(sureHesapla(0));
  const [girdi, setGirdi] = useState("");
  const [uyari, setUyari] = useState(null);  // { metin, ceza }
  const [rekor, setRekor] = useState(0);
  const [yeniRekor, setYeniRekor] = useState(false);
  const [kareler, setKareler] = useState([]); // "sen" | "rakip" — paylaşım kareleri
  const kullanilan = useMemo(() => new Set(zincir), [zincir]);
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => (girdi.trim().length > 2 ? suggestPlayers(suggestIndex, girdi).slice(0, 4) : []), [suggestIndex, girdi]);
  const inputRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(REKOR).then((v) => v && setRekor(Number(v) || 0)).catch(() => {});
  }, []);

  // Saat — her saniye; dolunca −1 can ve yeni harf.
  useEffect(() => {
    if (phase !== "oyun") return;
    if (kalan <= 0) {
      cezaVer("Süre doldu — yeni harf", true);
      return;
    }
    const t = setTimeout(() => setKalan((k) => k - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, kalan]);

  function basla() {
    setHarf(rastgeleHarf(PLAYERS));
    setZincir([]);
    setCan(CAN);
    setKalan(sureHesapla(0));
    setGirdi("");
    setUyari(null);
    setYeniRekor(false);
    setKareler([]);
    setPhase("geri");
  }

  function bitir(puan) {
    setPhase("bitti");
    const yeni = puan > rekor;
    setYeniRekor(yeni);
    if (yeni) { setRekor(puan); AsyncStorage.setItem(REKOR, String(puan)).catch(() => {}); }
    Promise.resolve(addXP(Math.min(150, 5 * puan))).catch(() => {});
  }

  function cezaVer(metin, yeniHarf) {
    playWrong();
    recordRound("letterZincir", false);
    setKareler((k) => [...k, "rakip"]);
    const kalanCan = can - 1;
    setCan(kalanCan);
    setUyari({ metin: `${metin} · −1 can`, ceza: true });
    if (kalanCan <= 0) { bitir(zincir.length); return; }
    // Süre dolduysa yeni harf + yeni süre; yanlış/tekrar isimde saat işlemeye devam eder.
    if (yeniHarf) { setHarf(rastgeleHarf(PLAYERS, Math.random, harf)); setKalan(sureHesapla(zincir.length)); }
  }

  function gonder(metin) {
    if (phase !== "oyun") return;
    const t = String(metin ?? girdi).trim();
    if (!t) return;
    setGirdi("");
    const s = tahminDegerlendir(t, harf, kullanilan, PLAYERS);
    if (s.tip === "bilinmiyor") { setUyari({ metin: `"${t}" diye bir futbolcu bulamadım — can gitmedi`, ceza: false }); return; }
    if (s.tip === "tekrar") { cezaVer(`${s.oyuncu.name} zaten söylendi`, false); return; }
    if (s.tip === "yanlisHarf") { cezaVer(`${s.oyuncu.name} "${harf}" ile başlamıyor`, false); return; }
    const yeniZincir = [...zincir, s.oyuncu.name];
    setZincir(yeniZincir);
    setKareler((k) => [...k, "sen"]);
    playCorrect();
    unlockPlayer(s.oyuncu.name);
    recordRound("letterZincir", true);
    // Sonraki harfte söylenmemiş 3 futbolcu bile kalmadıysa zincir tıkanmasın: yeni harf.
    const yeni = new Set(yeniZincir);
    const kalanAday = (harfDizini(PLAYERS).get(s.sonrakiHarf) || []).filter((p) => !yeni.has(p.name)).length;
    if (kalanAday < 3) {
      setHarf(rastgeleHarf(PLAYERS, Math.random, s.sonrakiHarf));
      setUyari({ metin: `"${s.sonrakiHarf}" ile başlayan futbolcu kalmadı — yeni harf`, ceza: false });
    } else {
      setHarf(s.sonrakiHarf);
      setUyari(null);
    }
    setKalan(sureHesapla(yeniZincir.length));
  }

  const toplamSure = sureHesapla(zincir.length);

  return (
    <GameBackground style={s.kap} klavye="kaydir">
      {phase === "geri" ? <CountdownOverlay onComplete={() => { setPhase("oyun"); setTimeout(() => inputRef.current?.focus?.(), 50); }} /> : null}
      <View style={s.ust}>
        <BackButton onPress={phase === "bitti" ? (onExitSilent || onExit) : onExit} />
        <View style={s.canlar}>
          {Array.from({ length: CAN }, (_, i) => (
            <Ionicons key={i} name={i < can ? "heart" : "heart-outline"} size={22} color={i < can ? COLORS.danger : COLORS.textFaint} />
          ))}
        </View>
      </View>

      {phase !== "bitti" ? (
        <>
          <Text style={s.baslik}>HARF ZİNCİRİ</Text>
          <Text style={s.rekor}>Zincir {zincir.length} · rekor {rekor}</Text>
          <View style={s.harfKutu}>
            <Text style={s.harfEtiket}>Bu harfle başlayan futbolcu</Text>
            <Text style={s.harf}>{harf}</Text>
          </View>
          <View style={{ marginTop: SPACING.sm }}>
            <TimerBar current={Math.max(0, kalan)} total={toplamSure} />
            <Text style={s.sure}>{Math.max(0, kalan)} sn</Text>
          </View>

          <View style={s.girdiSatir}>
            <TextInput
              ref={inputRef}
              style={s.girdi}
              value={girdi}
              onChangeText={(t) => { setGirdi(t); if (uyari && !uyari.ceza) setUyari(null); }}
              onSubmitEditing={() => gonder()}
              placeholder={`${harf} ile başlayan futbolcu`}
              placeholderTextColor={COLORS.textFaint}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="send"
              blurOnSubmit={false}
              editable={phase === "oyun"}
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
          {uyari ? <Text style={[s.uyari, !uyari.ceza && { color: COLORS.textMuted }]}>{uyari.metin}</Text> : null}

          {zincir.length ? (
            <View style={s.zincir}>
              {zincir.slice(-6).reverse().map((ad, i) => (
                <View key={ad} style={[s.halka, i > 0 && { opacity: 0.55 }]}>
                  <PlayerPhoto name={ad} size={28} showProfileOnPress={false} />
                  <Text style={s.halkaAd} numberOfLines={1}>{ad}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.kural}>Her futbolcunun tam adı bir öncekinin SON harfiyle başlar (Lionel Messi → L ile başlar, I ile biter). Yanlış harf, tekrar ya da süre dolması 1 can götürür. Süre zincir uzadıkça kısalır.</Text>
          )}
        </>
      ) : (
        <MacSonuKarti
          modAdi="Harf Zinciri"
          modeId="letterZincir"
          turlar={kareler}
          solo={{
            puan: zincir.length,
            rekor,
            yeniRekor,
            baslik: yeniRekor ? "YENİ REKOR!" : "ZİNCİR KOPTU",
            satirlar: [
              ["Zincir uzunluğu", String(zincir.length)],
              ["Son halka", zincir[zincir.length - 1] || "—"],
            ],
          }}
          kazanilanXp={Math.min(150, 5 * zincir.length)}
          rovansEtiketi="TEKRAR"
          onRovans={basla}
          onMenu={onExitSilent || onExit}
        />
      )}
    </GameBackground>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg, padding: 20, paddingBottom: 40 },
  ust: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  canlar: { flexDirection: "row", gap: 4 },
  baslik: { fontSize: 13, fontWeight: "800", letterSpacing: 2, color: VURGU.main, marginTop: SPACING.sm },
  rekor: { fontSize: 14, fontWeight: "700", color: COLORS.textMuted, marginTop: 2 },
  harfKutu: { alignItems: "center", marginTop: SPACING.md, paddingVertical: SPACING.md, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 2, borderColor: VURGU.main },
  harfEtiket: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: COLORS.textMuted },
  harf: { fontSize: 72, fontWeight: "900", color: COLORS.text, lineHeight: 80 },
  sure: { fontSize: 12, fontWeight: "800", color: COLORS.textMuted, textAlign: "right", marginTop: 4 },
  girdiSatir: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 2, borderColor: VURGU.main, paddingHorizontal: 6, height: 54 },
  girdi: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "600", paddingHorizontal: 6 },
  gonder: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },
  oneri: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  oneriYazi: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },
  uyari: { fontSize: 13, fontWeight: "700", color: COLORS.cta, textAlign: "center", marginTop: 8 },
  zincir: { marginTop: SPACING.md, gap: 6 },
  halka: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  halkaAd: { flex: 1, fontSize: 14, fontWeight: "800", color: COLORS.text },
  kural: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.md, lineHeight: 19 },
});
