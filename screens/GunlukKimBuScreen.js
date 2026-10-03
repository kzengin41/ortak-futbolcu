import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { KlavyeAlani, useKlavyeAcik } from "../components/Klavye";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import { MasaKartlari, TahminTablosu, SimdiBilirsenAfis, AcilisAnimasyonu, sayi } from "../components/KimBuMasa";
import { prefetchPlayerPhoto } from "../components/PlayerPhoto";
import { COLORS, SPACING, TYPE, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { buildSuggestIndex, suggestPlayers } from "../lib/gameEngine";
import { carpan, turPuani, simdiBilirsen, acilabilirMi, ortakKartlariAc, ASGARI_PUAN } from "../lib/kimBuMasa";
import { masaHazirla, karsilastirAd, gizliMi, oyuncuBul, oyuncuGetir } from "../lib/kimBuVeri";
import { gununKimBu, gununRastgelesi, paylasimMetni, TAHMIN_HAKKI } from "../lib/gunlukKimBu";
import { gunlukDurumOku, gunlukDurumYaz, gunlukOyunBitti } from "../lib/gunlukKayit";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { gorevOlayi } from "../lib/dailyGoals";

// ============================================================================
// GÜNLÜK KİM BU — Paket 13 (benchmark: "herkese aynı futbolcu, 5 tahmin hakkı,
// paylaşım: çevrilen kartların kareleri + puan"). Kart masası tek kişilik Kim
// Bu ile aynı (puan 10.000'den, kart bedelleri düşer, ×2 / ×1,5), farkı: can
// yerine 5 tahmin hakkı ve gün içinde ilerleme kaydediliyor.
// ============================================================================
const VURGU = MODE_COLORS.whoAmI;

export default function GunlukKimBuScreen({ onExit, onExitSilent }) {
  const gun = useMemo(() => gununKimBu(), []);
  const oyuncu = gun ? oyuncuGetir(gun.ad) : null;
  const masa = useMemo(() => (oyuncu ? masaHazirla(oyuncu, gununRastgelesi(gun.tarih)) : null), [oyuncu]);
  const [acik, setAcik] = useState(masa ? masa.acik : {});
  const [tahminler, setTahminler] = useState([]);    // karşılaştırma satırları (yeni en üstte)
  const [bitti, setBitti] = useState(false);
  const [dogru, setDogru] = useState(false);
  const [puan, setPuan] = useState(0);
  const [yuklendi, setYuklendi] = useState(false);
  const [girdi, setGirdi] = useState("");
  const [uyari, setUyari] = useState(null);
  const klavyeAcik = useKlavyeAcik();
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => (girdi.trim().length > 1 ? suggestPlayers(suggestIndex, girdi) : []), [suggestIndex, girdi]);

  // Bugünün kaydı (yarıda bırakılan oyun kaldığı yerden sürer)
  useEffect(() => {
    if (!gun) { setYuklendi(true); return; }
    prefetchPlayerPhoto(gun.ad);
    gunlukDurumOku("kimBu").then((d) => {
      if (d && d.ad === gun.ad && masa) {
        setAcik(d.acik || masa.acik);
        setTahminler((d.tahminler || []).map((ad) => karsilastirAd(ad, gun.ad)).filter(Boolean));
        setBitti(!!d.bitti);
        setDogru(!!d.dogru);
        setPuan(d.puan || 0);
      }
      setYuklendi(true);
    });
  }, [gun, masa]);

  const kalanHak = TAHMIN_HAKKI - tahminler.length - (bitti && dogru ? 1 : 0);

  function kaydet(degis) {
    gunlukDurumYaz("kimBu", { ad: gun.ad, acik, tahminler: tahminler.map((t) => t.ad), bitti, dogru, puan, ...degis });
  }

  function bitir({ d, p, a, t }) {
    setBitti(true);
    setDogru(d);
    setPuan(p);
    kaydet({ bitti: true, dogru: d, puan: p, acik: a, tahminler: t.map((x) => x.ad) });
    recordRound("gunlukKimBu", d);
    gunlukOyunBitti("kimBu").catch(() => {});
  }

  function kartCevir(k) {
    if (bitti || acik[k.id]) return;
    if (!acilabilirMi(masa, acik, k)) {
      setUyari(`Puanın yetmiyor: bu kart ${sayi(k.bedel)}, puanın ${sayi(ASGARI_PUAN)}'in altına inemez.`);
      return;
    }
    const yeni = { ...acik, [k.id]: "satin" };
    setAcik(yeni);
    setUyari(null);
    kaydet({ acik: yeni });
  }

  function tahminEt(metin) {
    const yazi = String(metin ?? girdi).trim();
    if (!yazi || bitti || !yuklendi) return;
    setGirdi("");
    if (gizliMi(yazi, gun.ad)) {
      const p = turPuani(masa, acik);
      playCorrect();
      unlockPlayer(gun.ad);
      if (!Object.values(acik).includes("satin")) gorevOlayi("kimBuIpucusuz").catch(() => {});
      bitir({ d: true, p, a: acik, t: tahminler });
      return;
    }
    const o = oyuncuBul(yazi);
    if (!o) { setUyari(`"${yazi}" diye bir futbolcu bulamadım — hak gitmedi`); return; }
    if (tahminler.some((t) => t.ad === o.name)) { setUyari(`${o.name} zaten denendi`); return; }
    const satir = karsilastirAd(o.name, gun.ad);
    if (!satir) { setUyari(`"${yazi}" diye bir futbolcu bulamadım — hak gitmedi`); return; }
    const bedava = ortakKartlariAc(masa, acik, satir.ortakKulupler);
    const yeniAcik = { ...acik };
    for (const id of bedava) yeniAcik[id] = "bedava";
    const yeniT = [satir, ...tahminler];
    setAcik(yeniAcik);
    setTahminler(yeniT);
    playWrong();
    if (yeniT.length >= TAHMIN_HAKKI) { bitir({ d: false, p: 0, a: yeniAcik, t: yeniT }); return; }
    setUyari(bedava.length ? `Ortak kulüp: ${satir.ortakKulupler.join(", ")} — kartı bedava açıldı` : `${o.name} değil — ${TAHMIN_HAKKI - yeniT.length} hakkın kaldı`);
    kaydet({ acik: yeniAcik, tahminler: yeniT.map((t) => t.ad) });
  }

  function paylas() {
    Share.share({ message: paylasimMetni({ no: gun.no, masa, acik, yanlis: tahminler.length, dogru, puan }) }).catch(() => {});
  }

  const cikis = onExitSilent || onExit;
  if (!gun || !oyuncu || !masa) {
    return (
      <GameBackground style={s.merkez}>
        <BackButton onPress={cikis} confirm={false} />
        <Text style={s.baslik}>Bugünün futbolcusu hazırlanamadı</Text>
      </GameBackground>
    );
  }

  const ust = (
    <View style={s.ust}>
      <BackButton onPress={cikis} confirm={false} style={{ marginTop: 0, marginBottom: 0 }} />
      <View style={{ flex: 1 }}>
        <Text style={s.ustBaslik}>{`GÜNLÜK KİM BU #${gun.no}`}</Text>
        <Text style={s.ustAlt}>{bitti ? "Herkese aynı futbolcu" : `Herkese aynı futbolcu · ${Math.max(0, kalanHak)} tahmin hakkı`}</Text>
      </View>
      <View style={s.haklar} accessibilityLabel={`${Math.max(0, kalanHak)} tahmin hakkı`}>
        {[...Array(TAHMIN_HAKKI)].map((_, i) => (
          <View key={i} style={[s.hak, i < tahminler.length && s.hakYanlis, bitti && dogru && i === tahminler.length && s.hakDogru]} />
        ))}
      </View>
    </View>
  );

  // ---------------------------------------------------------------- sonuç
  if (bitti) {
    return (
      <GameBackground style={s.kap}>
        {ust}
        <ScrollView contentContainerStyle={s.sonucIcerik} showsVerticalScrollIndicator={false}>
          <AcilisAnimasyonu
            masa={masa}
            acik={acik}
            ad={gun.ad}
            dogru={dogru}
            baslik={dogru ? `BİLDİN! · ${sayi(puan)} PUAN` : "BU SEFER OLMADI"}
            altSatir={dogru ? `${tahminler.length + 1}. tahminde` : "5 tahmin hakkı bitti"}
          />
          <TahminTablosu tahminler={tahminler} />
          <SoundPressable style={s.anaDugme} onPress={paylas} accessibilityLabel="Sonucu paylaş">
            <Ionicons name="share-social" size={20} color={COLORS.accentDark} />
            <Text style={s.anaDugmeYazi}>PAYLAŞ</Text>
          </SoundPressable>
          <Text style={s.yarin}>Yarın yeni bir futbolcu seni bekliyor.</Text>
          <SoundPressable style={s.ikinciDugme} onPress={cikis}>
            <Text style={s.ikinciDugmeYazi}>Menüye dön</Text>
          </SoundPressable>
        </ScrollView>
      </GameBackground>
    );
  }

  // ---------------------------------------------------------------- oyun
  return (
    <GameBackground style={s.kap}>
      {ust}
      <KlavyeAlani style={{ flex: 1 }}>
        <SimdiBilirsenAfis puan={simdiBilirsen(masa, acik)} carp={carpan(acik)} kucuk={klavyeAcik} />
        <View style={s.cevap}>
          <View style={s.cevapSatir}>
            <Ionicons name="search" size={18} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
            <TextInput
              style={s.cevapGirdi}
              autoCorrect={false}
              autoCapitalize="words"
              placeholder={`Bu futbolcu kim? (${Math.max(0, kalanHak)} hak)`}
              placeholderTextColor={COLORS.textMuted}
              value={girdi}
              onChangeText={(t) => { setGirdi(t); if (uyari) setUyari(null); }}
              onSubmitEditing={() => tahminEt()}
              returnKeyType="send"
            />
            <SoundPressable onPress={() => tahminEt()} style={s.gonder} accessibilityLabel="Tahmini gönder">
              <Ionicons name="arrow-forward" size={20} color={COLORS.accentDark} />
            </SoundPressable>
          </View>
          {oneriler.length > 0 ? (
            <View style={s.oneriler}>
              {oneriler.slice(0, klavyeAcik ? 3 : 4).map((ad) => (
                <SoundPressable key={ad} style={s.oneri} onPress={() => tahminEt(ad)}>
                  <Ionicons name="person-circle-outline" size={18} color={COLORS.textMuted} />
                  <Text style={s.oneriYazi} numberOfLines={1}>{ad}</Text>
                </SoundPressable>
              ))}
            </View>
          ) : null}
          {uyari ? <Text style={s.uyari}>{uyari}</Text> : null}
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.icerik} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TahminTablosu tahminler={tahminler} />
          <MasaKartlari masa={masa} acik={acik} onKartCevir={kartCevir} fotoAd={gun.ad} />
          <Text style={s.not}>Yanlış tahmin bir hak götürür ama masaya karşılaştırma bırakır. Bilinmeyen isim hak götürmez.</Text>
        </ScrollView>
      </KlavyeAlani>
    </GameBackground>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg },
  merkez: { flex: 1, padding: SPACING.xl, backgroundColor: COLORS.bg },
  baslik: { ...TYPE.h2, marginTop: SPACING.xl, textAlign: "center" },
  ust: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.sm },
  ustBaslik: { fontSize: 16, fontWeight: "900", letterSpacing: 1, color: VURGU.main },
  ustAlt: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
  haklar: { flexDirection: "row", gap: 4 },
  hak: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.cardBorder },
  hakYanlis: { backgroundColor: COLORS.danger },
  hakDogru: { backgroundColor: COLORS.accent },

  cevap: { marginHorizontal: SPACING.lg, marginTop: SPACING.sm },
  cevapSatir: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 2, borderColor: COLORS.accent, paddingHorizontal: 6, height: 52,
  },
  cevapGirdi: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "600", paddingVertical: 0 },
  gonder: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },
  oneriler: { marginTop: 4, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  oneri: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, paddingHorizontal: SPACING.md },
  oneriYazi: { color: COLORS.text, fontSize: 15, fontWeight: "600", flex: 1 },
  uyari: { marginTop: 6, fontSize: 13, fontWeight: "700", color: COLORS.cta },
  icerik: { paddingHorizontal: SPACING.lg, paddingBottom: 48 },
  not: { ...TYPE.caption, fontSize: 12, textAlign: "center", marginTop: SPACING.lg },

  sonucIcerik: { alignItems: "center", paddingHorizontal: SPACING.lg, paddingBottom: 48 },
  anaDugme: { flexDirection: "row", gap: 8, alignSelf: "stretch", marginTop: SPACING.xl, height: 56, borderRadius: 18, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  anaDugmeYazi: { fontSize: 18, fontWeight: "900", letterSpacing: 1.5, color: COLORS.accentDark },
  yarin: { ...TYPE.caption, marginTop: SPACING.md, textAlign: "center" },
  ikinciDugme: { alignSelf: "stretch", marginTop: SPACING.sm, height: 48, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: "center", justifyContent: "center" },
  ikinciDugmeYazi: { fontSize: 15, fontWeight: "700", color: COLORS.text },
});
