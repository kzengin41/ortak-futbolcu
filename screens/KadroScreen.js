import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import TeamBadge from "../components/TeamBadge";
import PlayerMiniProfile from "../components/PlayerMiniProfile";
import Saha, { Kulube } from "../components/Saha";
import { bulunanKumesi } from "../components/TakimlarListesi";
import { PLAYERS } from "../lib/players";
import { findMatchedPlayer, suggestPlayers, buildSuggestIndex } from "../lib/gameEngine";
import { kadroGetir, sahaSatirlari, tamamlanma, HAT_ETIKET } from "../lib/kadrolar";
import { bulunanEkle, tamamlandiKaydet } from "../lib/kadroKoleksiyon";
import { hedefler as avHedefleri } from "../lib/kadroAvi";
import { oyuncuGetir } from "../lib/kimBuVeri";
import { unlockPlayer } from "../lib/pokedex";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { useVoiceInput } from "../lib/useVoiceInput";
import { flagForCountry } from "../lib/countryFlags";
import { countryTr } from "../lib/countryNamesTr";
import { COLORS, SPACING, RADIUS, MODE_COLORS } from "../lib/theme";

// ============================================================================
// KADRO (Ansiklopedi → Takımlar → bir sezon ya da final) — 4 Ekim 2026
// Saha görünümünde ilk 11 + 7 yedek. Bulunan futbolcular açık, diğerleri
// forma numarası ve mevkiyle kapalı. Alttaki kutuya bu kadrodan bir isim yaz:
// doğruysa açılır. Hepsi açılınca rozet ("KADRO TAMAMLANDI").
//
// Paket 18 (Kerem: "kadrodaki numaraya tıklayınca o oyuncuyu tahmin edebilsin.
// bu modda sesli giriş de yapabilsin") — kapalı bir forma numarasına dokununca
// o oyuncu HEDEF olur (turuncu halka); kutuya yazılan/söylenen isim o formayla
// karşılaştırılır. Hedef yokken eskisi gibi kadrodaki herhangi biri açılır.
// Mikrofon: konuşurken yazı ekranın üstünde canlı görünür (lib/useVoiceInput.js).
// ============================================================================
export default function KadroScreen({ route, navigation, id: idProp }) {
  const id = idProp || route?.params?.id;
  const kadro = useMemo(() => kadroGetir(id), [id]);
  const [bulunan, setBulunan] = useState(new Set());
  const [girdi, setGirdi] = useState("");
  const [uyari, setUyari] = useState(null);
  const [profil, setProfil] = useState(null);
  const [hedef, setHedef] = useState(null);     // tahmin için seçilen kapalı oyuncu
  const [sesHata, setSesHata] = useState(null);
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceInput(() =>
    kadro ? [...kadro.ilk11, ...kadro.yedek].filter((o) => !bulunan.has(o.a)).map((o) => o.a) : []
  );
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => (girdi.trim().length > 2 ? suggestPlayers(suggestIndex, girdi).slice(0, 4) : []), [suggestIndex, girdi]);

  // Paket 13: Kadro Avı'ndan dönünce bulunanlar tazelensin.
  useFocusEffect(useCallback(() => { bulunanKumesi().then(setBulunan).catch(() => {}); }, []));

  const geri = () => (navigation ? navigation.goBack() : null);
  if (!kadro) {
    return (
      <GameBackground style={s.kap}>
        <BackButton onPress={geri} confirm={false} />
        <Text style={s.baslik}>Kadro bulunamadı</Text>
      </GameBackground>
    );
  }

  const satirlar = sahaSatirlari(kadro.ilk11, kadro.tip === "mac");
  const t = tamamlanma(kadro, bulunan);
  const bulundu = (o) => bulunan.has(o.a);

  function gonder(metin) {
    const yazi = String(metin ?? girdi).trim();
    if (!yazi) return;
    setGirdi("");
    const kapali = [...kadro.ilk11, ...kadro.yedek].filter((o) => !bulunan.has(o.a)).map((o) => ({ name: o.a, o }));
    const m = findMatchedPlayer(yazi, kapali);
    if (!m) {
      playWrong();
      setUyari(findMatchedPlayer(yazi, [...kadro.ilk11, ...kadro.yedek].map((o) => ({ name: o.a }))) ? "Onu zaten açtın" : "Bu kadroda yok");
      return;
    }
    // Hedefli tahmin: doğru forma mı? Değilse yine açılır (kadroda var) ama söylenir.
    if (hedef && m.o.a !== hedef.a) {
      setUyari(`${hedef.n != null ? `#${hedef.n}` : "O forma"} değil — ama ${m.o.a} de bu kadroda, açıldı`);
    } else {
      setUyari(null);
      setHedef(null);
    }
    const yeni = new Set(bulunan);
    yeni.add(m.o.a);
    setBulunan(yeni);
    playCorrect();
    if (m.o.v) unlockPlayer(m.o.a);
    bulunanEkle(m.o.a);
    if (tamamlanma(kadro, yeni).tamam) tamamlandiKaydet(kadro.id).catch(() => {});
  }

  function oyuncuyaDokun(o) {
    if (bulundu(o)) { if (o.v) setProfil(o.a); return; }
    setHedef((h) => (h && h.a === o.a ? null : o));   // aynı formaya tekrar dokun: seçim kalkar
    setUyari(null);
  }

  async function mikrofon() {
    setSesHata(null);
    if (isRecording) {
      try {
        const metin = await stopRecording();
        if (!metin) { setSesHata("Sesi anlayamadım, tekrar dener misin?"); return; }
        gonder(metin);
      } catch (e) { setSesHata(e.message || "Ses tanıma başarısız oldu"); }
    } else {
      try { await startRecording(); } catch (e) { setSesHata(e.message || "Mikrofona erişilemedi"); }
    }
  }

  const m = kadro.mac;
  const baslikAd = kadro.takimTip === "ulke" ? countryTr(kadro.takim) || kadro.takim : kadro.takim;

  return (
    <GameBackground style={s.kap} klavye="kaydir">
      <BackButton onPress={geri} confirm={false} />
      <View style={s.ust}>
        {kadro.takimTip === "ulke" ? <Text style={{ fontSize: 34 }}>{flagForCountry(kadro.takim)}</Text> : <TeamBadge name={kadro.takim} size={44} />}
        <View style={{ flex: 1 }}>
          <Text style={s.baslik} numberOfLines={1}>{baslikAd}</Text>
          <Text style={s.alt} numberOfLines={2}>
            {kadro.tip === "sezon" ? `${kadro.sezon.sezon} sezonu` : `${m.tur}${m.yil ? ` ${m.yil}` : ""} · ${m.skor}${m.penalti ? ` (pen. ${m.penalti})` : ""} · rakip ${kadro.rakipTip === "ulke" ? countryTr(kadro.rakip) || kadro.rakip : kadro.rakip}`}
          </Text>
        </View>
        <View style={[s.rozet, t.tamam && s.rozetTamam]}>
          <Text style={[s.rozetYazi, t.tamam && { color: COLORS.accentDark }]}>{t.tamam ? "🏅" : `${t.bulunan}/${t.toplam}`}</Text>
        </View>
      </View>

      {t.tamam ? <Text style={s.tamam}>KADRO TAMAMLANDI</Text> : null}

      {/* Paket 13 — Kadro Avı: bu kadronun bulunmamış bir oyuncusu kart masasında. */}
      {!t.tamam && navigation && avHedefleri(kadro, bulunan, (ad) => !!oyuncuGetir(ad)).length ? (
        <SoundPressable style={s.av} onPress={() => navigation.navigate("kadroAvi", { id: kadro.id })} accessibilityLabel="Kadro Avı">
          <Ionicons name="search-circle" size={22} color={COLORS.accentDark} />
          <View style={{ flex: 1 }}>
            <Text style={s.avBaslik}>KADRO AVI</Text>
            <Text style={s.avAlt}>Gizli bir oyuncuyu kartlarla bul, kadroya ekle</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.accentDark} />
        </SoundPressable>
      ) : null}

      <Saha satirlar={satirlar} bulundu={bulundu} onPress={oyuncuyaDokun} secili={(o) => !!hedef && o.a === hedef.a} />
      <Kulube yedek={kadro.yedek} bulundu={bulundu} onPress={oyuncuyaDokun} secili={(o) => !!hedef && o.a === hedef.a} />
      {kadro.tip === "sezon" ? (
        <Text style={s.not}>
          {kadro.sezon.kaynak === "diyagram"
            ? "İlk 11: sezon sayfasındaki en çok kullanılan ilk 11 (Wikipedia)."
            : kadro.sezon.kaynak === "mac"
            ? "İlk 11: mevkilerine göre sezonda en çok forma giyenler."
            : "İlk 11: mevkilerine göre kadronun en bilinen oyuncuları."}
        </Text>
      ) : null}

      {!t.tamam ? (
        <>
          {hedef ? (
            <View style={s.hedefSatir}>
              <View style={s.hedefNo}><Text style={s.hedefNoYazi}>{hedef.n != null ? hedef.n : "?"}</Text></View>
              <Text style={s.hedefYazi} numberOfLines={1}>{HAT_ETIKET[hedef.p] || hedef.p} — bu oyuncu kim?</Text>
              <SoundPressable onPress={() => setHedef(null)} hitSlop={10} accessibilityLabel="Seçimi kaldır">
                <Ionicons name="close-circle" size={22} color={COLORS.textMuted} />
              </SoundPressable>
            </View>
          ) : (
            <Text style={s.ipucu}>Bir forma numarasına dokun ve o oyuncuyu tahmin et — ya da kadrodan herhangi bir isim yaz.</Text>
          )}
          <View style={s.girdiSatir}>
            <TextInput
              style={s.girdi}
              value={girdi}
              onChangeText={(x) => { setGirdi(x); setUyari(null); }}
              onSubmitEditing={() => gonder()}
              placeholder={hedef ? `#${hedef.n ?? "?"} kim?` : "Bu kadrodan bir isim yaz"}
              placeholderTextColor={COLORS.textFaint}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <SoundPressable
              style={[s.mic, isRecording && s.micAktif]}
              onPress={mikrofon}
              disabled={isProcessing}
              accessibilityLabel={isRecording ? "Kaydı durdur" : "Sesle söyle"}
            >
              <Ionicons name={isProcessing ? "hourglass" : isRecording ? "stop" : "mic"} size={20} color={isRecording ? "#FFFFFF" : COLORS.text} />
            </SoundPressable>
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
          {sesHata ? <Text style={s.uyari}>{sesHata}</Text> : null}
        </>
      ) : null}

      <PlayerMiniProfile name={profil} visible={!!profil} onClose={() => setProfil(null)} />
    </GameBackground>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg, padding: 20, paddingBottom: 40 },
  ust: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: SPACING.sm },
  baslik: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  alt: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted, marginTop: 2 },
  rozet: { minWidth: 56, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12, alignItems: "center", backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  rozetTamam: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  rozetYazi: { fontSize: 15, fontWeight: "900", color: COLORS.text },
  av: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: MODE_COLORS.whoAmI.main, marginBottom: SPACING.sm },
  avBaslik: { fontSize: 14, fontWeight: "900", letterSpacing: 1, color: COLORS.accentDark },
  avAlt: { fontSize: 12, fontWeight: "700", color: COLORS.accentDark, opacity: 0.8 },
  tamam: { textAlign: "center", fontSize: 13, fontWeight: "900", letterSpacing: 2, color: COLORS.accent, marginBottom: 8 },
  not: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted, textAlign: "center", marginTop: 8 },
  girdiSatir: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 2, borderColor: COLORS.accent, paddingHorizontal: 6, height: 54 },
  girdi: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "600", paddingHorizontal: 6 },
  gonder: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },
  mic: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.cardBorder },
  micAktif: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  ipucu: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, textAlign: "center", marginTop: 12 },
  hedefSatir: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cta },
  hedefNo: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.cta },
  hedefNoYazi: { fontSize: 13, fontWeight: "900", color: COLORS.ctaDark },
  hedefYazi: { flex: 1, fontSize: 14, fontWeight: "800", color: COLORS.text },
  oneri: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  oneriYazi: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },
  uyari: { fontSize: 13, fontWeight: "700", color: COLORS.cta, textAlign: "center", marginTop: 8 },
});
