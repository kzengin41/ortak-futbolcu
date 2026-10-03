import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, Share, Pressable, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import TeamBadge from "../components/TeamBadge";
import BackButton from "../components/BackButton";
import { PLAYERS } from "../lib/players";
import { findMatchedPlayer, suggestPlayers, buildSuggestIndex } from "../lib/gameEngine";
import { kosulTuru, kosulBayragi, kosulIkonu } from "../lib/gridGame";
import {
  gununIzgarasi, kareCevaplari, nadirlik, izgaraPaylasim, gunlukDurumOku, gunlukDurumYaz, IZGARA_HAK, kosulEtiketi,
} from "../lib/gunlukOyunlar";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { COLORS, MODE_COLORS, SPACING, RADIUS } from "../lib/theme";

// ============================================================================
// GÜNLÜK IZGARA — 4 Ekim 2026 (benchmark .29364 + .29515)
// Herkese aynı 3×3 ızgara, tek kişilik. 9 tahmin hakkın var: bir kareye dokun,
// iki koşulu da sağlayan futbolcuyu yaz. Doğruysa kare dolar ve kilitlenir,
// yanlışsa hak gider. Aynı futbolcu iki karede kullanılamaz.
// Nadirlik: az bilinen doğru cevap daha çok puan (100 − tanınırlık).
// ============================================================================
const VURGU = MODE_COLORS.xox;

function BaslikRozeti({ baslik, boyut }) {
  const tur = kosulTuru(baslik);
  return (
    <>
      {tur === "kulup" ? (
        <TeamBadge name={baslik} size={boyut} />
      ) : (
        <View style={[s.kosulDaire, { width: boyut, height: boyut, borderRadius: boyut / 2 }]}>
          {tur === "ulke" ? (
            <Text style={{ fontSize: boyut * 0.55 }} allowFontScaling={false}>{kosulBayragi(baslik)}</Text>
          ) : (
            <Ionicons name={kosulIkonu(baslik)} size={boyut * 0.5} color={COLORS.cta} />
          )}
        </View>
      )}
      <Text style={s.baslikYazi} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{kosulEtiketi(baslik)}</Text>
    </>
  );
}

export default function GunlukIzgaraScreen({ onExit, onExitSilent }) {
  const bulmaca = useMemo(() => gununIzgarasi(PLAYERS), []);
  const cevaplar = useMemo(
    () => (bulmaca ? Array.from({ length: 9 }, (_, i) => kareCevaplari(PLAYERS, bulmaca.izgara, i)) : []),
    [bulmaca]
  );
  const [kareler, setKareler] = useState(Array(9).fill(null)); // null | { ad, nadirlik }
  const [kullanilan, setKullanilan] = useState(0);            // harcanan tahmin
  const [yuklendi, setYuklendi] = useState(false);
  const [secili, setSecili] = useState(null);
  const [girdi, setGirdi] = useState("");
  const [uyari, setUyari] = useState(null);
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => (girdi.trim().length > 2 ? suggestPlayers(suggestIndex, girdi).slice(0, 4) : []), [suggestIndex, girdi]);
  const { width } = useWindowDimensions();
  const hucre = Math.min(104, Math.floor((width - 40 - 8 * 3) / 4));

  useEffect(() => {
    gunlukDurumOku("izgara").then((d) => {
      if (d && Array.isArray(d.kareler)) { setKareler(d.kareler); setKullanilan(d.kullanilan || 0); }
      setYuklendi(true);
    });
  }, []);

  const dolu = kareler.filter(Boolean).length;
  const bitti = yuklendi && (kullanilan >= IZGARA_HAK || dolu === 9);
  const toplamNadirlik = kareler.reduce((t, k) => t + (k ? k.nadirlik : 0), 0);

  function gonder(metin) {
    if (bitti || secili === null || !bulmaca) return;
    const t = String(metin ?? girdi).trim();
    if (!t) return;
    // Önce bu karenin (henüz kullanılmamış) doğru cevapları arasında ara —
    // "Silva" yazınca o karede oynamış Silva'yı anlasın, en ünlü Silva'yı değil.
    const kullanilmis = new Set(kareler.filter(Boolean).map((k) => k.ad));
    const dogruP = findMatchedPlayer(t, cevaplar[secili].filter((x) => !kullanilmis.has(x.name)));
    const p = dogruP || findMatchedPlayer(t, PLAYERS);
    if (!p) { setUyari(`"${t}" diye bir futbolcu bulamadım — hak gitmedi`); return; }
    if (kullanilmis.has(p.name)) { setUyari(`${p.name} başka bir karede zaten var — hak gitmedi`); return; }
    const yeniKullanilan = kullanilan + 1;
    let yeniKareler = kareler;
    if (dogruP) {
      yeniKareler = kareler.map((k, i) => (i === secili ? { ad: p.name, nadirlik: nadirlik(p) } : k));
      setUyari(null);
      unlockPlayer(p.name);
      playCorrect();
      recordRound("gunlukIzgara", true);
    } else {
      setUyari(`${p.name} bu iki koşulu birlikte sağlamıyor — 1 hak gitti`);
      playWrong();
      recordRound("gunlukIzgara", false);
    }
    setKareler(yeniKareler);
    setKullanilan(yeniKullanilan);
    setGirdi("");
    setSecili(null);
    gunlukDurumYaz("izgara", { kareler: yeniKareler, kullanilan: yeniKullanilan });
  }

  async function paylas() {
    try { await Share.share({ message: izgaraPaylasim(bulmaca.no, kareler, toplamNadirlik) }); } catch (e) {}
  }

  if (!bulmaca) {
    return (
      <GameBackground style={s.kap}>
        <BackButton onPress={onExitSilent || onExit} />
        <Text style={s.baslik}>Bugünün ızgarası hazırlanamadı</Text>
      </GameBackground>
    );
  }

  const { satirlar, sutunlar } = bulmaca.izgara;
  return (
    <GameBackground style={s.kap} klavye="kaydir">
      <BackButton onPress={onExitSilent || onExit} />
      <Text style={s.ust}>GÜNLÜK IZGARA #{bulmaca.no}</Text>
      <Text style={s.baslik}>Dokuz kareyi doldur</Text>
      <View style={s.bilgiSatir}>
        <Text style={s.bilgi}>Kalan hak <Text style={s.bilgiSayi}>{Math.max(0, IZGARA_HAK - kullanilan)}</Text></Text>
        <Text style={s.bilgi}>Nadirlik <Text style={s.bilgiSayi}>{toplamNadirlik}</Text></Text>
      </View>

      <View style={s.izgara}>
        <View style={s.satir}>
          <View style={{ width: hucre }} />
          {sutunlar.map((k) => (
            <View key={k} style={[s.baslikHucre, { width: hucre }]}><BaslikRozeti baslik={k} boyut={hucre * 0.42} /></View>
          ))}
        </View>
        {satirlar.map((sk, r) => (
          <View key={sk} style={s.satir}>
            <View style={[s.baslikHucre, { width: hucre }]}><BaslikRozeti baslik={sk} boyut={hucre * 0.42} /></View>
            {sutunlar.map((_, c) => {
              const i = r * 3 + c;
              const k = kareler[i];
              const sec = secili === i;
              return (
                <SoundPressable
                  key={c}
                  disabled={!!k || bitti || !yuklendi}
                  onPress={() => { setSecili(sec ? null : i); setUyari(null); }}
                  style={[s.hucre, { width: hucre, height: hucre }, k && s.hucreDolu, sec && s.hucreSecili]}
                  accessibilityLabel={k ? k.ad : `${kosulEtiketi(sk)} ve ${kosulEtiketi(sutunlar[c])}`}
                >
                  {k ? (
                    <>
                      <Text style={s.hucreAd} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{k.ad}</Text>
                      <Text style={s.hucreNadir}>{k.nadirlik}</Text>
                    </>
                  ) : bitti ? (
                    <Text style={s.hucreSayi}>{cevaplar[i].length}</Text>
                  ) : (
                    <Ionicons name={sec ? "create" : "add"} size={22} color={sec ? VURGU.main : COLORS.textFaint} />
                  )}
                </SoundPressable>
              );
            })}
          </View>
        ))}
      </View>

      {!bitti && yuklendi && secili !== null ? (
        <>
          <Text style={s.secimYazi}>{kosulEtiketi(satirlar[Math.floor(secili / 3)])} × {kosulEtiketi(sutunlar[secili % 3])}</Text>
          <View style={s.girdiSatir}>
            <TextInput
              style={s.girdi}
              value={girdi}
              onChangeText={(t) => { setGirdi(t); setUyari(null); }}
              onSubmitEditing={() => gonder()}
              placeholder="Futbolcu adı"
              placeholderTextColor={COLORS.textFaint}
              autoCorrect={false}
              autoCapitalize="words"
              autoFocus
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
      ) : !bitti && yuklendi ? (
        <Text style={s.ipucu}>Bir kareye dokun, iki koşulu da sağlayan futbolcuyu yaz. Yanlış tahmin bir hak götürür.</Text>
      ) : null}
      {uyari ? <Text style={s.uyari}>{uyari}</Text> : null}

      {bitti ? (
        <View style={s.sonuc}>
          <Text style={s.sonucUst}>BUGÜNKÜ SONUCUN</Text>
          <Text style={s.sonucSayi}>{dolu} <Text style={s.sonucBolu}>/ 9</Text></Text>
          <Text style={s.sonucAlt}>Nadirlik puanı {toplamNadirlik} · boş karelerdeki sayı o karenin kaç doğru cevabı olduğunu gösterir</Text>
          <SoundPressable style={s.paylas} onPress={paylas}>
            <Ionicons name="share-social" size={18} color={COLORS.accentDark} />
            <Text style={s.paylasYazi}>PAYLAŞ</Text>
          </SoundPressable>
          <Text style={s.yarin}>Yarın yeni ızgara gelir.</Text>
        </View>
      ) : null}
    </GameBackground>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  ust: { fontSize: 13, fontWeight: "800", letterSpacing: 2, color: VURGU.main, marginTop: SPACING.sm },
  baslik: { fontSize: 20, fontWeight: "900", color: COLORS.text, marginTop: 4 },
  bilgiSatir: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  bilgi: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },
  bilgiSayi: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  izgara: { marginTop: SPACING.md, gap: 8, alignSelf: "center" },
  satir: { flexDirection: "row", gap: 8 },
  baslikHucre: { alignItems: "center", justifyContent: "center", gap: 4 },
  baslikYazi: { fontSize: 11, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  kosulDaire: { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  hucre: { borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: "center", justifyContent: "center", padding: 4 },
  hucreDolu: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  hucreSecili: { borderWidth: 2, borderColor: VURGU.main },
  hucreAd: { fontSize: 12, fontWeight: "900", color: COLORS.accentDark, textAlign: "center" },
  hucreNadir: { fontSize: 11, fontWeight: "800", color: COLORS.accentDark, opacity: 0.7, marginTop: 2 },
  hucreSayi: { fontSize: 18, fontWeight: "900", color: COLORS.textMuted },
  secimYazi: { fontSize: 14, fontWeight: "800", color: COLORS.text, textAlign: "center", marginTop: 14 },
  ipucu: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted, textAlign: "center", marginTop: 14 },
  girdiSatir: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 2, borderColor: VURGU.main, paddingHorizontal: 6, height: 54 },
  girdi: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "600", paddingHorizontal: 6 },
  gonder: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },
  oneri: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  oneriYazi: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },
  uyari: { fontSize: 13, fontWeight: "700", color: COLORS.cta, textAlign: "center", marginTop: 8 },
  sonuc: { marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: "center" },
  sonucUst: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textMuted },
  sonucSayi: { fontSize: 48, fontWeight: "900", color: COLORS.text },
  sonucBolu: { fontSize: 20, color: COLORS.textMuted },
  sonucAlt: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, textAlign: "center" },
  paylas: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", alignSelf: "stretch", height: 52, borderRadius: 16, backgroundColor: COLORS.accent, marginTop: SPACING.lg },
  paylasYazi: { fontSize: 17, fontWeight: "900", letterSpacing: 1, color: COLORS.accentDark },
  yarin: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, marginTop: 10 },
});
