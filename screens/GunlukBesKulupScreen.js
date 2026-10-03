import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, Share, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import TeamBadge from "../components/TeamBadge";
import PlayerPhoto from "../components/PlayerPhoto";
import BackButton from "../components/BackButton";
import { PLAYERS } from "../lib/players";
import { findMatchedPlayer, suggestPlayers, buildSuggestIndex } from "../lib/gameEngine";
import { gununBesKulubu, besKulupPuani, besKulupPaylasim, gunlukDurumOku, gunlukDurumYaz, BES_KULUP_HAK } from "../lib/gunlukOyunlar";
import { gunlukOyunBitti } from "../lib/gunlukKayit";
import { gorevOlayi } from "../lib/dailyGoals";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { COLORS, MODE_COLORS, SPACING, RADIUS } from "../lib/theme";

// ============================================================================
// GÜNLÜK 5 KULÜP — 4 Ekim 2026 (benchmark .29283)
// Herkese aynı 5 kulüp. 3 hakkın var; her hakla bir futbolcu yazarsın, bu
// kulüplerin kaçında oynadıysa o kadar puan (en az 2 kulüp). En fazla 15.
// Paylaşım: her tahmin bir satır, oynadığı kulüpler 🟩.
// ============================================================================
const VURGU = MODE_COLORS.fiveClubs;

export default function GunlukBesKulupScreen({ onExit, onExitSilent }) {
  const bulmaca = useMemo(() => gununBesKulubu(PLAYERS), []);
  const [tahminler, setTahminler] = useState([]);
  const [yuklendi, setYuklendi] = useState(false);
  const [girdi, setGirdi] = useState("");
  const [uyari, setUyari] = useState(null);
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  // Puan getiren (bu kulüplerin en az ikisinde oynamış) futbolcular — eşleştirme önce bunlarda.
  const puanlilar = useMemo(() => (bulmaca ? PLAYERS.filter((p) => besKulupPuani(p, bulmaca.kulupler).puan > 0) : []), [bulmaca]);
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => (girdi.trim().length > 2 ? suggestPlayers(suggestIndex, girdi).slice(0, 4) : []), [suggestIndex, girdi]);

  useEffect(() => {
    gunlukDurumOku("5kulup").then((d) => {
      if (d && Array.isArray(d.tahminler)) setTahminler(d.tahminler);
      setYuklendi(true);
    });
  }, []);

  const bitti = tahminler.length >= BES_KULUP_HAK;
  const toplam = tahminler.reduce((t, x) => t + x.puan, 0);

  function gonder(metin) {
    if (bitti || !bulmaca) return;
    const t = String(metin ?? girdi).trim();
    if (!t) return;
    const p = findMatchedPlayer(t, puanlilar.filter((x) => !tahminler.some((y) => y.ad === x.name))) || findMatchedPlayer(t, PLAYERS);
    if (!p) { setUyari(`"${t}" diye bir futbolcu bulamadım — hak gitmedi`); return; }
    if (tahminler.some((x) => x.ad === p.name)) { setUyari(`${p.name} zaten yazıldı`); return; }
    const { puan, matchedClubs } = besKulupPuani(p, bulmaca.kulupler);
    const yeni = [...tahminler, { ad: p.name, puan, matchedClubs }];
    setTahminler(yeni);
    setGirdi("");
    setUyari(puan ? null : `${p.name} bu kulüplerin en az ikisinde oynamadı — 0 puan`);
    recordRound("gunluk5", puan > 0);
    if (puan) { unlockPlayer(p.name); playCorrect(); } else playWrong();
    gunlukDurumYaz("5kulup", { tahminler: yeni });
    if (puan >= 4) gorevOlayi("besKulup4").catch(() => {});
    // Tek seri kuralı (.29585): günlük oyunu bitirmek seriyi sürdürür.
    if (yeni.length >= BES_KULUP_HAK) gunlukOyunBitti("5kulup").catch(() => {});
  }

  async function paylas() {
    try { await Share.share({ message: besKulupPaylasim(bulmaca.no, tahminler, bulmaca.kulupler) }); } catch (e) {}
  }

  if (!bulmaca) {
    return (
      <GameBackground style={s.kap}>
        <BackButton onPress={onExitSilent || onExit} />
        <Text style={s.baslik}>Bugünün kulüpleri hazırlanamadı</Text>
      </GameBackground>
    );
  }

  return (
    <GameBackground style={s.kap} klavye="kaydir">
      <BackButton onPress={onExitSilent || onExit} />
      <Text style={s.ust}>GÜNLÜK 5 KULÜP #{bulmaca.no}</Text>
      <Text style={s.baslik}>Bu kulüplerin en çoğunda oynamış futbolcuyu bul</Text>
      <View style={s.kulupler}>
        {bulmaca.kulupler.map((k) => (
          <View key={k} style={s.kulup}>
            <TeamBadge name={k} size={40} />
            <Text style={s.kulupAd} numberOfLines={2}>{k}</Text>
          </View>
        ))}
      </View>
      <Text style={s.kural}>{BES_KULUP_HAK} hak · her futbolcu oynadığı kulüp sayısı kadar puan (en az 2) · en fazla 15</Text>

      {tahminler.map((x, i) => (
        <View key={x.ad} style={s.tahmin}>
          <Text style={s.tahminNo}>{i + 1}</Text>
          <PlayerPhoto name={x.ad} size={34} />
          <View style={{ flex: 1 }}>
            <Text style={s.tahminAd} numberOfLines={1}>{x.ad}</Text>
            <View style={{ flexDirection: "row", gap: 3, marginTop: 4 }}>
              {bulmaca.kulupler.map((k) => (
                <View key={k} style={[s.kare, x.puan && x.matchedClubs.includes(k) && { backgroundColor: COLORS.accent }]} />
              ))}
            </View>
          </View>
          <Text style={[s.tahminPuan, !x.puan && { color: COLORS.textMuted }]}>+{x.puan}</Text>
        </View>
      ))}

      {!bitti && yuklendi ? (
        <>
          <View style={s.girdiSatir}>
            <TextInput
              style={s.girdi}
              value={girdi}
              onChangeText={(t) => { setGirdi(t); setUyari(null); }}
              onSubmitEditing={() => gonder()}
              placeholder={`${tahminler.length + 1}. tahmin — futbolcu adı`}
              placeholderTextColor={COLORS.textFaint}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="send"
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
        </>
      ) : null}
      {uyari ? <Text style={s.uyari}>{uyari}</Text> : null}

      {bitti ? (
        <View style={s.sonuc}>
          <Text style={s.sonucUst}>BUGÜNKÜ PUANIN</Text>
          <Text style={s.sonucSayi}>{toplam} <Text style={s.sonucBolu}>/ 15</Text></Text>
          <Text style={s.enIyiBaslik}>Bugünün en iyi cevapları</Text>
          {bulmaca.enIyiler.slice(0, 5).map((x) => (
            <Text key={x.player.name} style={s.enIyi}>{x.player.name} · {x.count} kulüp</Text>
          ))}
          <SoundPressable style={s.paylas} onPress={paylas}>
            <Ionicons name="share-social" size={18} color={COLORS.accentDark} />
            <Text style={s.paylasYazi}>PAYLAŞ</Text>
          </SoundPressable>
          <Text style={s.yarin}>Yarın yeni 5 kulüp gelir.</Text>
        </View>
      ) : null}
    </GameBackground>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  ust: { fontSize: 13, fontWeight: "800", letterSpacing: 2, color: VURGU.main, marginTop: SPACING.sm },
  baslik: { fontSize: 20, fontWeight: "900", color: COLORS.text, marginTop: 4 },
  kulupler: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: SPACING.md, padding: 12, borderRadius: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, justifyContent: "center" },
  kulup: { width: "30%", alignItems: "center", gap: 6, paddingVertical: 6 },
  kulupAd: { fontSize: 12, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  kural: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, textAlign: "center", marginTop: 8 },
  tahmin: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  tahminNo: { width: 18, fontSize: 14, fontWeight: "900", color: COLORS.textMuted, textAlign: "center" },
  tahminAd: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  kare: { width: 18, height: 10, borderRadius: 3, backgroundColor: COLORS.cardBorder },
  tahminPuan: { fontSize: 20, fontWeight: "900", color: COLORS.cta },
  girdiSatir: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 2, borderColor: VURGU.main, paddingHorizontal: 6, height: 54 },
  girdi: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "600", paddingHorizontal: 6 },
  gonder: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },
  oneri: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  oneriYazi: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },
  uyari: { fontSize: 13, fontWeight: "700", color: COLORS.cta, textAlign: "center", marginTop: 8 },
  sonuc: { marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: "center" },
  sonucUst: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textMuted },
  sonucSayi: { fontSize: 48, fontWeight: "900", color: COLORS.text },
  sonucBolu: { fontSize: 20, color: COLORS.textMuted },
  enIyiBaslik: { fontSize: 13, fontWeight: "800", color: COLORS.textMuted, marginTop: 8, marginBottom: 4 },
  enIyi: { fontSize: 14, fontWeight: "700", color: COLORS.text, marginTop: 2 },
  paylas: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", alignSelf: "stretch", height: 52, borderRadius: 16, backgroundColor: COLORS.accent, marginTop: SPACING.lg },
  paylasYazi: { fontSize: 17, fontWeight: "900", letterSpacing: 1, color: COLORS.accentDark },
  yarin: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, marginTop: 10 },
});
