import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { KlavyeAlani, useKlavyeAcik } from "../components/Klavye";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import TeamBadge from "../components/TeamBadge";
import { MasaKartlari, TahminTablosu, SimdiBilirsenAfis, AcilisAnimasyonu, sayi } from "../components/KimBuMasa";
import { prefetchPlayerPhoto } from "../components/PlayerPhoto";
import { bulunanKumesi } from "../components/TakimlarListesi";
import { COLORS, SPACING, TYPE, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { buildSuggestIndex, suggestPlayers } from "../lib/gameEngine";
import { carpan, turPuani, simdiBilirsen, acilabilirMi, ortakKartlariAc, yeniCan, AZAMI_CAN, ASGARI_PUAN } from "../lib/kimBuMasa";
import { masaHazirla, karsilastirAd, gizliMi, oyuncuBul, oyuncuGetir } from "../lib/kimBuVeri";
import { kadroGetir, tamamlanma } from "../lib/kadrolar";
import { bulunanEkle, tamamlandiKaydet } from "../lib/kadroKoleksiyon";
import { hedefler as hedefListesi, rastgeleKadro, kadroKulubunuAc } from "../lib/kadroAvi";
import { flagForCountry } from "../lib/countryFlags";
import { countryTr } from "../lib/countryNamesTr";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";

// ============================================================================
// KADRO AVI — Paket 13. Kurallar lib/kadroAvi.js + lib/kimBuMasa.js.
// Bir kadronun bulunmamış oyuncuları sırayla kart masasına gizlenir; 3 can,
// doğru +1 / yanlış −1 (tek kişilik Kim Bu ile aynı). Bilinen her isim
// kadroya ve ansiklopediye eklenir.
// ============================================================================
const VURGU = MODE_COLORS.whoAmI;
const oyuncuVarMi = (ad) => !!oyuncuGetir(ad);

export default function KadroAviScreen({ id: idProp, onExit, onExitSilent, onModaGit }) {
  const [kadroId, setKadroId] = useState(idProp || null);
  const [bulunan, setBulunan] = useState(null);
  const [atlanan, setAtlanan] = useState([]);
  const [faz, setFaz] = useState("yukleniyor");   // yukleniyor | oyun | sonuc | bitti | bos
  const [gizli, setGizli] = useState(null);
  const [masa, setMasa] = useState(null);
  const [acik, setAcik] = useState({});
  const [tahminler, setTahminler] = useState([]);
  const [can, setCan] = useState(AZAMI_CAN);
  const [puan, setPuan] = useState(0);
  const [avlanan, setAvlanan] = useState(0);
  const [sonuc, setSonuc] = useState(null);
  const [girdi, setGirdi] = useState("");
  const [uyari, setUyari] = useState(null);
  const klavyeAcik = useKlavyeAcik();
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(() => (girdi.trim().length > 1 ? suggestPlayers(suggestIndex, girdi) : []), [suggestIndex, girdi]);
  const kadro = useMemo(() => (kadroId ? kadroGetir(kadroId) : null), [kadroId]);

  useEffect(() => {
    bulunanKumesi().then((b) => {
      setBulunan(b);
      const id = idProp || rastgeleKadro(b, oyuncuVarMi);
      if (!id) { setFaz("bos"); return; }
      setKadroId(id);
    }).catch(() => setFaz("bos"));
  }, [idProp]);

  function turBaslat(b = bulunan, atla = atlanan) {
    const liste = hedefListesi(kadro, b, oyuncuVarMi).filter((o) => !atla.includes(o.a));
    if (!liste.length) { setFaz("bitti"); return; }
    const o = liste[Math.floor(Math.random() * liste.length)];
    const p = oyuncuGetir(o.a);
    const m = masaHazirla(p);
    prefetchPlayerPhoto(o.a);
    setGizli(o.a);
    setMasa(m);
    setAcik(kadroKulubunuAc(kadro, m, m.acik));
    setTahminler([]);
    setSonuc(null);
    setUyari(null);
    setGirdi("");
    setFaz("oyun");
  }
  useEffect(() => { if (kadro && bulunan && faz === "yukleniyor") turBaslat(); }, [kadro, bulunan]);

  function kartCevir(k) {
    if (faz !== "oyun" || acik[k.id]) return;
    if (!acilabilirMi(masa, acik, k)) {
      setUyari(`Puanın yetmiyor: bu kart ${sayi(k.bedel)}, puanın ${sayi(ASGARI_PUAN)}'in altına inemez.`);
      return;
    }
    setUyari(null);
    setAcik((a) => ({ ...a, [k.id]: "satin" }));
  }

  function kaybet(mesaj) {
    const kalan = can - 1;
    setCan(kalan);
    playWrong();
    recordRound("kadroAvi", false);
    setAtlanan((a) => [...a, gizli]);
    setSonuc({ dogru: false, mesaj });
    setFaz(kalan <= 0 ? "bitti" : "sonuc");
  }

  function tahminEt(metin) {
    const yazi = String(metin ?? girdi).trim();
    if (!yazi || faz !== "oyun") return;
    setGirdi("");
    if (gizliMi(yazi, gizli)) {
      const p = turPuani(masa, acik);
      playCorrect();
      unlockPlayer(gizli);
      bulunanEkle(gizli);
      const yeniB = new Set(bulunan); yeniB.add(gizli);
      setBulunan(yeniB);
      if (tamamlanma(kadro, yeniB).tamam) tamamlandiKaydet(kadro.id).catch(() => {});
      recordRound("kadroAvi", true);
      setPuan((x) => x + p);
      setAvlanan((x) => x + 1);
      setCan((c) => yeniCan(c, true));
      setSonuc({ dogru: true, puan: p });
      setFaz("sonuc");
      return;
    }
    const o = oyuncuBul(yazi);
    if (!o) { setUyari(`"${yazi}" diye bir futbolcu bulamadım — can gitmedi`); return; }
    if (tahminler.some((t) => t.ad === o.name)) { setUyari(`${o.name} zaten denendi`); return; }
    const satir = karsilastirAd(o.name, gizli);
    if (!satir) { setUyari(`"${yazi}" diye bir futbolcu bulamadım — can gitmedi`); return; }
    const bedava = ortakKartlariAc(masa, acik, satir.ortakKulupler);
    setTahminler((l) => [satir, ...l]);
    if (bedava.length) setAcik((a) => { const n = { ...a }; for (const id of bedava) n[id] = "bedava"; return n; });
    const kalan = yeniCan(can, false);
    setCan(kalan);
    playWrong();
    recordRound("kadroAvi", false);
    if (kalan <= 0) {
      setAtlanan((a) => [...a, gizli]);
      setSonuc({ dogru: false, mesaj: `${o.name} değildi — canın bitti` });
      setFaz("bitti");
      return;
    }
    setUyari(bedava.length ? `Ortak kulüp: ${satir.ortakKulupler.join(", ")} — kartı bedava açıldı` : `${o.name} değil — bir can gitti`);
  }

  const cikis = onExitSilent || onExit;
  if (faz === "bos" || (faz !== "yukleniyor" && !kadro)) {
    return (
      <GameBackground style={s.merkez}>
        <BackButton onPress={cikis} confirm={false} />
        <Ionicons name="ribbon" size={36} color={COLORS.accent} style={{ alignSelf: "center", marginTop: SPACING.xl }} />
        <Text style={s.baslik}>Avlanacak oyuncu kalmadı</Text>
        <Text style={s.aciklama}>Kadrolardaki bütün oyuncuları bulmuşsun. Ansiklopedi → Takımlar'dan kadrolarına bakabilirsin.</Text>
      </GameBackground>
    );
  }
  if (!kadro || !bulunan || faz === "yukleniyor") {
    return <GameBackground style={s.merkez}><Text style={s.aciklama}>Kadro hazırlanıyor...</Text></GameBackground>;
  }

  const t = tamamlanma(kadro, bulunan);
  const kalanHedef = hedefListesi(kadro, bulunan, oyuncuVarMi).filter((o) => !atlanan.includes(o.a)).length;
  const altBaslik = kadro.tip === "sezon" ? `${kadro.sezon.sezon} sezonu` : `${kadro.mac.tur}${kadro.mac.yil ? ` ${kadro.mac.yil}` : ""}`;
  const ust = (
    <View style={s.ust}>
      <BackButton onPress={cikis} confirm={false} style={{ marginTop: 0, marginBottom: 0 }} />
      {kadro.takimTip === "ulke" ? <Text style={{ fontSize: 26 }}>{flagForCountry(kadro.takim)}</Text> : <TeamBadge name={kadro.takim} size={34} />}
      <View style={{ flex: 1 }}>
        <Text style={s.ustBaslik} numberOfLines={1}>KADRO AVI · {kadro.takimTip === "ulke" ? countryTr(kadro.takim) || kadro.takim : kadro.takim}</Text>
        <Text style={s.ustAlt} numberOfLines={1}>{`${altBaslik} · ${t.bulunan}/${t.toplam} bulundu`}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <View style={{ flexDirection: "row", gap: 2 }}>
          {[...Array(AZAMI_CAN)].map((_, i) => (
            <Ionicons key={i} name={i < can ? "heart" : "heart-outline"} size={17} color={i < can ? COLORS.danger : COLORS.textFaint} />
          ))}
        </View>
        <Text style={s.ustPuan}>{sayi(puan)}</Text>
      </View>
    </View>
  );

  // ---------------------------------------------------------------- tur sonu / bitiş
  if (faz === "sonuc" || faz === "bitti") {
    const bitti = faz === "bitti";
    return (
      <GameBackground style={s.kap}>
        {ust}
        <ScrollView contentContainerStyle={s.sonucIcerik} showsVerticalScrollIndicator={false}>
          {gizli && masa && sonuc ? (
            <AcilisAnimasyonu
              key={`acilis-${gizli}`}
              masa={masa}
              acik={acik}
              ad={gizli}
              dogru={sonuc.dogru}
              baslik={sonuc.dogru ? `BULDUN! · +${sayi(sonuc.puan)}` : "BU SEFER OLMADI"}
              eklendiYazisi={`KADROYA EKLENDİ · ${t.bulunan}/${t.toplam}`}
              altSatir={sonuc.dogru ? null : sonuc.mesaj}
            />
          ) : null}
          {t.tamam ? <Text style={s.tamam}>🏅 KADRO TAMAMLANDI</Text> : null}
          {bitti ? (
            <View style={s.ozet}>
              <Text style={s.ozetBaslik}>{can <= 0 ? "AV BİTTİ" : "BU KADRODA AVLANACAK KİMSE KALMADI"}</Text>
              <Text style={s.ozetYazi}>{avlanan} oyuncu buldun · {sayi(puan)} puan</Text>
            </View>
          ) : null}
          {!bitti && kalanHedef > 0 ? (
            <SoundPressable style={s.anaDugme} onPress={() => turBaslat()}>
              <Text style={s.anaDugmeYazi}>SIRADAKİ GİZLİ OYUNCU</Text>
            </SoundPressable>
          ) : null}
          {bitti || kalanHedef === 0 ? (
            <SoundPressable style={s.anaDugme} onPress={() => { setCan(AZAMI_CAN); setPuan(0); setAvlanan(0); setAtlanan([]); setKadroId(null); setFaz("yukleniyor"); bulunanKumesi().then((b) => { setBulunan(b); const id = rastgeleKadro(b, oyuncuVarMi); if (!id) setFaz("bos"); else setKadroId(id); }); }}>
              <Text style={s.anaDugmeYazi}>BAŞKA KADRO</Text>
            </SoundPressable>
          ) : null}
          {onModaGit ? (
            <SoundPressable style={s.ikinciDugme} onPress={() => onModaGit("kadro", { id: kadro.id })}>
              <Text style={s.ikinciDugmeYazi}>Kadroya bak</Text>
            </SoundPressable>
          ) : null}
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
              placeholder="Bu kadrodaki gizli oyuncu kim?"
              placeholderTextColor={COLORS.textMuted}
              value={girdi}
              onChangeText={(x) => { setGirdi(x); if (uyari) setUyari(null); }}
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
          <MasaKartlari masa={masa} acik={acik} onKartCevir={kartCevir} turAnahtari={gizli + ":"} fotoAd={gizli} />
          <SoundPressable style={s.pesEt} onPress={() => kaybet("Pes ettin — bir can gitti")}>
            <Ionicons name="flag-outline" size={16} color={COLORS.danger} />
            <Text style={s.pesEtYazi}>Pes et · 1 can</Text>
          </SoundPressable>
        </ScrollView>
      </KlavyeAlani>
    </GameBackground>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg },
  merkez: { flex: 1, padding: SPACING.xl, backgroundColor: COLORS.bg },
  baslik: { ...TYPE.h2, marginTop: SPACING.md, textAlign: "center" },
  aciklama: { ...TYPE.bodyMuted, textAlign: "center", marginTop: SPACING.md },
  ust: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.sm },
  ustBaslik: { fontSize: 14, fontWeight: "900", letterSpacing: 0.6, color: VURGU.main },
  ustAlt: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
  ustPuan: { fontSize: 15, fontWeight: "900", color: COLORS.text },

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
  pesEt: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, marginTop: SPACING.xl,
    borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.danger, backgroundColor: "rgba(255,93,93,0.10)",
  },
  pesEtYazi: { fontSize: 15, fontWeight: "800", color: COLORS.danger },

  sonucIcerik: { alignItems: "center", paddingHorizontal: SPACING.lg, paddingBottom: 48 },
  tamam: { marginTop: SPACING.md, fontSize: 14, fontWeight: "900", letterSpacing: 2, color: COLORS.accent },
  ozet: { alignSelf: "stretch", alignItems: "center", marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  ozetBaslik: { fontSize: 14, fontWeight: "900", letterSpacing: 1.2, color: COLORS.text, textAlign: "center" },
  ozetYazi: { ...TYPE.caption, marginTop: 4 },
  anaDugme: { alignSelf: "stretch", marginTop: SPACING.xl, height: 56, borderRadius: 18, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  anaDugmeYazi: { fontSize: 17, fontWeight: "900", letterSpacing: 1.2, color: COLORS.accentDark },
  ikinciDugme: { alignSelf: "stretch", marginTop: SPACING.sm, height: 48, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: "center", justifyContent: "center" },
  ikinciDugmeYazi: { fontSize: 15, fontWeight: "700", color: COLORS.text },
});
