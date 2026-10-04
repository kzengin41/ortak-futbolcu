import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { KlavyeAlani, KlavyeScroll } from "../components/Klavye";
import SoundPressable from "../components/SoundPressable";
import AnswerFeedback from "../components/AnswerFeedback";
import TimerBar from "../components/TimerBar";
import TeamBadge from "../components/TeamBadge";
import OnlineMacSonu from "../components/OnlineMacSonu";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import {
  buildSuggestIndex, suggestPlayers, findMatchedPlayer, generateFiveClubRound, scoreFiveClubAnswer,
  enIyiFiveClubCevabi, FIVE_CLUB_DIFFICULTIES,
} from "../lib/gameEngine";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import { taninirlik } from "../lib/taninirlik";
import { useOnlineRoom, rovansli } from "../lib/onlineRoom";
import { baslangicDurumu, aksiyonuIsle, sonuc, TUR_SURESI_SN, SONUC_SURESI_MS } from "../lib/onlineFive";

// ============================================================================
// ONLINE 5 KULÜP — Paket 16, 5 Ekim 2026 (Kerem: "5 kulüp online versiyonu
// yapalım"). Kurallar lib/onlineFive.js, ağ lib/onlineRoom.js.
// İki oyuncu AYNI ANDA ve GİZLİ cevaplar; ikisi de cevaplayınca ya da süre
// bitince cevaplar açılır. 5'li kulüpleri ev sahibi kendi eşleşme profiliyle,
// "Normal" havuzdan üretir (offline 5 Kulüp ile aynı üretici).
// ============================================================================
const VURGU = MODE_COLORS.fiveClubs;
const SURE_PAYI_MS = 1500;   // ağ gecikmesi için ev sahibinin süreye eklediği pay
const pk = (n) => `p${n}`;

export default function OnlineFiveScreen({ room, onExit }) {
  const benKimim = room.playerNumber;
  const rakipNo = benKimim === 1 ? 2 : 1;
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const eslesme = useEslesmeProfili();
  const profilRef = useRef(eslesme.derlenmis);
  profilRef.current = eslesme.derlenmis;

  const baglam = useMemo(() => ({
    turUret: (kullanilan, sonKulupler) =>
      generateFiveClubRound(PLAYERS, FIVE_CLUB_DIFFICULTIES.normal.pool, new Set(kullanilan), undefined, profilRef.current, sonKulupler),
    oyuncuBul: (metin) => findMatchedPlayer(metin, PLAYERS),
    puanla: (oyuncu, kulupler) => scoreFiveClubAnswer(oyuncu, kulupler),
  }), []);
  const aksiyonIsle = useMemo(() => rovansli((d, a, k) => aksiyonuIsle(d, a, k, baglam)), [baglam]);
  const ilkDurum = useMemo(() => baslangicDurumu(), []);
  const { durum, hostMuyum, rakipVar, senkronBekliyor, gonder, guncelle } = useOnlineRoom({
    kanalAdi: `five-${room.id}`,
    benKimim,
    baslangicDurumu: ilkDurum,
    aksiyonIsle,
  });

  const [girdi, setGirdi] = useState("");
  const [geriBildirim, setGeriBildirim] = useState(null);
  const [kalan, setKalan] = useState(null);
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => (girdi.trim().length < 3 ? [] : suggestPlayers(suggestIndex, girdi)), [suggestIndex, girdi]);

  const faz = durum?.faz;
  const turNo = durum?.turNo;
  const macNo = durum?.macNo;
  const benimCevap = durum?.cevaplar?.[pk(benKimim)] || null;
  const rakipCevap = durum?.cevaplar?.[pk(rakipNo)] || null;

  // --- Host: rakip gelince maçı başlat (ilk maç ve rövanş) ------------------
  useEffect(() => {
    if (!hostMuyum || faz !== "hazirlik" || !rakipVar) return;
    const t = setTimeout(() => gonder({ tip: "baslat" }), 60);
    return () => clearTimeout(t);
  }, [hostMuyum, faz, rakipVar, gonder]);

  // --- Host: tur süresi (turNo ile: eski zamanlayıcı yeni turu kapatamaz) ----
  useEffect(() => {
    if (!hostMuyum || faz !== "tur") return;
    const no = turNo;
    const t = setTimeout(() => guncelle((d) => aksiyonIsle(d, { tip: "sureDoldu", turNo: no }, 1)), TUR_SURESI_SN * 1000 + SURE_PAYI_MS);
    return () => clearTimeout(t);
  }, [hostMuyum, faz, turNo, macNo, guncelle, aksiyonIsle]);

  // --- Host: sonuç ekranından sonra sıradaki tura geç ------------------------
  useEffect(() => {
    if (!hostMuyum || faz !== "turSonu") return;
    const t = setTimeout(() => gonder({ tip: "sonrakiTur" }), SONUC_SURESI_MS);
    return () => clearTimeout(t);
  }, [hostMuyum, faz, turNo, gonder]);

  // --- Herkes: görünen sayaç -------------------------------------------------
  useEffect(() => {
    if (faz !== "tur") { setKalan(null); return; }
    setKalan(TUR_SURESI_SN);
    const t = setInterval(() => setKalan((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => clearInterval(t);
  }, [faz, turNo, macNo]);

  useEffect(() => { setGirdi(""); }, [turNo, macNo]);

  // --- Olay: veri setinde olmayan isim (cevap kilitlenmez, tekrar yazılır) -----------------------------
  const olayRef = useRef(null);
  useEffect(() => {
    const o = durum?.sonOlay;
    if (!o) return;
    const k = `${macNo}-${turNo}-${o.n}`;
    if (olayRef.current === k) return;
    olayRef.current = k;
    const anahtar = Date.now() + Math.random();
    if (o.kimden === benKimim && o.tip === "bilinmeyen") {
      playWrong();
      setGeriBildirim({ anahtar, correct: false, message: `"${o.metin}" bulunamadı, tekrar yaz` });
    }
    // Rakibin cevap verdiği skor şeridinde "kilitledi ✓" olarak görünüyor
    // (kırmızı geri bildirim balonu yanlış cevap sanılıyordu).
  }, [durum?.sonOlay, macNo, turNo, benKimim, playWrong]);

  // --- Tur açılışı: ses + koleksiyon (tur başına bir kez) ---------------------
  const acilanRef = useRef(null);
  useEffect(() => {
    if (faz !== "turSonu" && faz !== "macSonu") return;
    const k = `${macNo}-${turNo}`;
    if (acilanRef.current === k) return;
    acilanRef.current = k;
    const ben = durum.cevaplar[pk(benKimim)];
    if (ben && ben.puan > 0) { playCorrect(); unlockPlayer(ben.ad); } else playWrong();
  }, [faz, macNo, turNo, benKimim, durum, playCorrect, playWrong]);

  // --- Maç sonu: istatistik + XP (maç başına bir kez) ------------------------
  const islenenMacRef = useRef(0);
  useEffect(() => {
    if (faz !== "macSonu" || !macNo || islenenMacRef.current === macNo) return;
    islenenMacRef.current = macNo;
    const s = sonuc(durum, benKimim);
    if (s === "berabere") return;
    recordRound("onlineFive", s === "sen");
    addXP(s === "sen" ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI);
  }, [faz, macNo, benKimim, durum]);

  const enIyi = useMemo(
    () => ((faz === "turSonu" || faz === "macSonu") && durum?.kulupler?.length ? enIyiFiveClubCevabi(PLAYERS, durum.kulupler, taninirlik) : null),
    [faz, durum?.kulupler],
  );

  function cevapGonder(ad) {
    const metin = String(ad ?? girdi).trim();
    if (!metin || faz !== "tur" || benimCevap) return;
    setGirdi("");
    gonder({ tip: "cevap", metin });
  }

  // ---------------------------------------------------------------- bekleme
  if (!durum || faz === "hazirlik" || faz === "hata") {
    const yazi = !durum
      ? (senkronBekliyor ? "Odaya bağlanılıyor..." : "Ev sahibine ulaşılamadı. Bağlantını kontrol edip tekrar dene.")
      : faz === "hata" ? "Kulüpler hazırlanamadı. Odadan çıkıp tekrar dene."
      : rakipVar ? "Kulüpler hazırlanıyor..." : "Rakip bekleniyor...";
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

  const bitti = faz === "macSonu";
  const acik = faz === "turSonu" || bitti;      // cevaplar açıldı mı?
  const skorSen = durum.skorlar[pk(benKimim)];
  const skorRakip = durum.skorlar[pk(rakipNo)];
  const benKulup = new Set(benimCevap ? benimCevap.kulupler : []);   // kendi cevabın hemen işaretlenir
  const rakipKulup = new Set(acik && rakipCevap ? rakipCevap.kulupler : []);

  return (
    <GameBackground style={styles.kap}>
      <KlavyeAlani style={{ flex: 1 }}>
        <KlavyeScroll contentContainerStyle={{ paddingBottom: SPACING.xl }} keyboardShouldPersistTaps="handled">
          {/* Skor şeridi */}
          <View style={styles.ustSerit}>
            <View style={[styles.oyuncuKutu, benimCevap && !acik && styles.oyuncuKutuKilit]}>
              <Text style={styles.oyuncuAd}>SEN</Text>
              <Text style={[styles.skor, { color: COLORS.accent }]}>{skorSen}</Text>
              <Text style={styles.oyuncuDurum}>{acik ? "puan" : benimCevap ? "kilitlendi ✓" : "düşünüyor"}</Text>
            </View>
            <View style={styles.ortaKutu}>
              <Text style={styles.turYazi}>{bitti ? "Maç bitti" : `Tur ${turNo}/${durum.toplamTur}`}</Text>
              {!rakipVar && !bitti ? <Text style={styles.kopuk}>rakip bağlı değil</Text> : null}
            </View>
            <View style={[styles.oyuncuKutu, rakipCevap && !acik && styles.oyuncuKutuKilitRakip]}>
              <Text style={styles.oyuncuAd}>RAKİP</Text>
              <Text style={[styles.skor, { color: COLORS.cta }]}>{skorRakip}</Text>
              <Text style={styles.oyuncuDurum}>{acik ? "puan" : rakipCevap ? "kilitledi ✓" : "düşünüyor"}</Text>
            </View>
          </View>

          {faz === "tur" && kalan !== null ? (
            <View style={styles.sureKutu}>
              <TimerBar current={kalan} total={TUR_SURESI_SN} />
              <Text style={[styles.sureYazi, kalan <= 5 && { color: COLORS.danger }]}>{kalan} sn</Text>
            </View>
          ) : null}

          {/* 5 kulüp */}
          <View style={styles.kulupIzgara}>
            {durum.kulupler.map((c) => {
              const ben = benKulup.has(c);
              const rk = rakipKulup.has(c);
              return (
                <View key={c} style={[styles.kulupHucre, (ben || rk) && styles.kulupHucreEslesti]}>
                  <View style={styles.rozetSarmal}><TeamBadge name={c} size={40} /></View>
                  <Text allowFontScaling={false} style={styles.kulupAd} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{c}</Text>
                  {ben || rk ? (
                    <View style={styles.bulanSatir}>
                      {ben ? <View style={[styles.bulan, { backgroundColor: COLORS.accent }]}><Text style={styles.bulanYazi}>S</Text></View> : null}
                      {rk ? <View style={[styles.bulan, { backgroundColor: COLORS.cta }]}><Text style={styles.bulanYazi}>R</Text></View> : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* Cevap paneli */}
          {faz === "tur" && !benimCevap ? (
            <View style={styles.cevapPaneli}>
              <Text style={styles.hedefText}>En az 2 kulüpte oynamış TEK bir futbolcu</Text>
              <Text style={styles.hedefAlt}>Rakip cevabını göremez — ikiniz de bitirince açılır</Text>
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
            </View>
          ) : null}

          {faz === "tur" && benimCevap ? (
            <View style={styles.kilitKart}>
              <Ionicons name="lock-closed" size={18} color={VURGU.main} />
              <View style={{ flex: 1 }}>
                <Text style={styles.kilitBaslik}>Cevabın kilitlendi: {benimCevap.ad}</Text>
                <Text style={styles.kilitAlt}>
                  {benimCevap.puan > 0 ? `${benimCevap.puan} kulüp tuttu` : "2'den az kulüp tuttu — 0 puan"}
                  {rakipCevap ? " · rakip de cevapladı" : " · rakip bekleniyor…"}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Tur sonu: iki cevap yan yana */}
          {acik ? (
            <View style={styles.acilisKart}>
              <Text style={styles.acilisBaslik}>{bitti ? `Son tur (${turNo}/${durum.toplamTur})` : `Tur ${turNo} sonucu`}</Text>
              <CevapSatiri etiket="SEN" renk={COLORS.accent} cevap={benimCevap} />
              <CevapSatiri etiket="RAKİP" renk={COLORS.cta} cevap={rakipCevap} />
              {enIyi ? (
                <Text style={styles.enIyi}>En iyi cevap: <Text style={{ color: COLORS.text }}>{enIyi.player.name}</Text> ({enIyi.count} kulüp)</Text>
              ) : null}
              {!bitti ? <Text style={styles.sonraki}>Sıradaki tur birazdan…</Text> : null}
            </View>
          ) : null}

          {bitti ? (
            <OnlineMacSonu
              modAdi="Online 5 Kulüp"
              durum={durum}
              benKimim={benKimim}
              rakipVar={rakipVar}
              gonder={gonder}
              onExit={onExit}
              kazanan={sonuc(durum, benKimim)}
              skorSen={skorSen}
              skorRakip={skorRakip}
              skorEtiketi="puan"
              turlar={durum.gecmis.map((g) => {
                const a = g[pk(benKimim)]?.puan || 0, b = g[pk(rakipNo)]?.puan || 0;
                return a > b ? "sen" : a < b ? "rakip" : "yok";
              })}
              enIyi={(() => {
                const adlar = durum.gecmis.map((g) => g[pk(benKimim)]).filter((c) => c && c.puan > 0).map((c) => c.ad);
                if (!adlar.length) return null;
                return { ad: [...adlar].sort((a, b) => taninirlik(a) - taninirlik(b))[0], alt: "Verdiğin en nadir isim" };
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

function CevapSatiri({ etiket, renk, cevap }) {
  return (
    <View style={styles.cevapSatir}>
      <Text style={[styles.cevapEtiket, { color: renk }]}>{etiket}</Text>
      <Text style={styles.cevapAd} numberOfLines={1}>{cevap ? cevap.ad : "Cevap vermedi"}</Text>
      <Text style={[styles.cevapPuan, { color: cevap && cevap.puan > 0 ? renk : COLORS.textMuted }]}>+{cevap ? cevap.puan : 0}</Text>
    </View>
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
  oyuncuKutuKilit: { borderColor: COLORS.accent },
  oyuncuKutuKilitRakip: { borderColor: COLORS.cta },
  oyuncuAd: { ...TYPE.caption, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  skor: { fontSize: 26, fontWeight: "900" },
  oyuncuDurum: { ...TYPE.caption, fontSize: 11 },
  ortaKutu: { flex: 1, alignItems: "center" },
  turYazi: { ...TYPE.h3, fontSize: 15, textAlign: "center" },
  kopuk: { ...TYPE.caption, fontSize: 12, color: COLORS.danger, marginTop: 2 },
  sureKutu: { marginBottom: SPACING.sm },
  sureYazi: { ...TYPE.caption, textAlign: "center", marginTop: -6, fontWeight: "800", color: COLORS.text },

  kulupIzgara: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginBottom: SPACING.md,
    backgroundColor: COLORS.card, borderColor: VURGU.main, borderWidth: 1.5, borderRadius: RADIUS.lg, padding: 14,
  },
  kulupHucre: { width: "29%", alignItems: "center", paddingVertical: 10, borderRadius: 12, minHeight: 92 },
  kulupHucreEslesti: { backgroundColor: "rgba(124,255,92,0.12)" },
  rozetSarmal: { height: 40, width: 40, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  kulupAd: { color: COLORS.text, fontSize: 12, fontWeight: "800", textAlign: "center", lineHeight: 16 },
  bulanSatir: { flexDirection: "row", gap: 4, position: "absolute", top: 4, right: 4 },
  bulan: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  bulanYazi: { fontSize: 11, fontWeight: "900", color: COLORS.accentDark },

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

  kilitKart: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.card,
    borderColor: VURGU.main, borderWidth: 1.5, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md,
  },
  kilitBaslik: { ...TYPE.h3, fontSize: 14 },
  kilitAlt: { ...TYPE.caption, fontSize: 12, marginTop: 2 },

  acilisKart: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md, gap: 6,
  },
  acilisBaslik: { ...TYPE.h3, textAlign: "center", marginBottom: 4 },
  cevapSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: 4 },
  cevapEtiket: { width: 52, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  cevapAd: { ...TYPE.body, fontWeight: "800", flex: 1 },
  cevapPuan: { fontSize: 18, fontWeight: "900" },
  enIyi: { ...TYPE.caption, fontSize: 12, textAlign: "center", marginTop: 4 },
  sonraki: { ...TYPE.caption, fontSize: 12, textAlign: "center", fontStyle: "italic" },

  geriBildirimSarmal: { ...StyleSheet.absoluteFillObject },
});
