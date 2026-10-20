import { _t } from "../lib/dil";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ModKurulum, { KurulumBolum, SecimCipleri, ZorlukSecici, KapsamDugmesi } from "../components/ModKurulum";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import TeamBadge from "../components/TeamBadge";
import EslesmeKarti from "../components/EslesmeKarti";
import PlayerPhoto from "../components/PlayerPhoto";
import EslesmeProfiliPenceresi from "../components/EslesmeProfiliPenceresi";
import { useOyuncuAdlari, IsimliSkorTablosu, EN_FAZLA_OYUNCU, varsayilanAd } from "../components/OyuncuAdlari";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import { useAppSettings } from "../lib/SettingsContext";
import { useKurulumKapisi } from "../lib/modAyarlari";
import { PLAYERS } from "../lib/players";
import { generateRound, computeRoundPool } from "../lib/gameEngine";
import { recognitionScore } from "../lib/clubWeights";
import { recordRound } from "../lib/stats";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { COLORS, MODE_COLORS, RADIUS, SPACING } from "../lib/theme";

// ============================================================================
// SUNUCU MODU — 2–6 kişi, tek telefon (4 Ekim 2026, benchmark .28709/.28810)
// "Oyuncuların adları bir kez girilir; telefonu tutan kişi çifti okur, bağıran
// oyuncunun adına dokunur, uygulama doğru cevapları sunucuya gösterir. Yazma
// yok, format TV'deki gibi."
//  • Sunucu iki kulübü okur. İlk bağıran oyuncunun adına dokunur.
//  • Ekranda o çiftin doğru cevapları çıkar; sunucu ✓ ya da ✗ der.
//  • ✓ → +1 puan, sıradaki tur. ✗ → o oyuncu bu turda bir daha cevaplayamaz.
//  • Hedef puana ilk ulaşan kazanır. Maç sonunda isimli tablo + RÖVANŞ.
// ============================================================================
const VURGU = MODE_COLORS.hotSeat;
const HEDEFLER = [3, 5, 7, 10];
const GOSTERILEN_CEVAP = 12;

export default function SunucuScreen({ onExit, onExitSilent }) {
  const { settings, setSetting, loaded } = useAppSettings();
  const kayitliSayi = Math.min(EN_FAZLA_OYUNCU, Math.max(2, Number(settings.sunucuOyuncuSayisi) || 3));
  const [oyuncuSayisi, setOyuncuSayisiState] = useState(kayitliSayi);
  const elleSecildi = useRef(false);
  const setOyuncuSayisi = (n) => { elleSecildi.current = true; setOyuncuSayisiState(n); setSetting("sunucuOyuncuSayisi", n); };
  // Ayarlar diskten geç yüklenirse kayıtlı oyuncu sayısını al (kullanıcı henüz seçmediyse).
  useEffect(() => { if (loaded && !elleSecildi.current) setOyuncuSayisiState(kayitliSayi); }, [loaded, kayitliSayi]);
  const { adlar, ham, adDegistir } = useOyuncuAdlari(oyuncuSayisi);
  const [hedef, setHedef] = useState(5);
  const [zorluk, setZorluk] = useState(5);
  const eslesme = useEslesmeProfili();
  const [profilAcik, setProfilAcik] = useState(false);

  const [phase, setPhase] = useState("kurulum"); // kurulum | tur | kontrol | sonuc | bitti
  const [skorlar, setSkorlar] = useState([]);
  const [tur, setTur] = useState(null);
  const [kullanilan, setKullanilan] = useState(new Set());
  const [kilitli, setKilitli] = useState(new Set());
  const [cevaplayan, setCevaplayan] = useState(null); // oyuncu indeksi
  const [sonKazanan, setSonKazanan] = useState(null);
  const [cevaplarAcik, setCevaplarAcik] = useState(false);
  const [turNo, setTurNo] = useState(0);
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();

  const havuz = useMemo(
    () => (phase === "kurulum" ? null : computeRoundPool(PLAYERS, eslesme.derlenmis, zorluk)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase === "kurulum", eslesme.derlenmis, zorluk]
  );

  useKurulumKapisi("sunucu", {
    devreDisi: true, // adlar önemli: kurulum her zaman görünür
    kurulumda: phase === "kurulum",
    baslat: () => {},
    kurulumaDon: () => setPhase("kurulum"),
  });

  function yeniTur(h = havuz, kul = kullanilan) {
    const pool = h || computeRoundPool(PLAYERS, eslesme.derlenmis, zorluk);
    let r = generateRound(pool, PLAYERS, kul, eslesme.derlenmis, zorluk);
    let k = kul;
    if (!r) { k = new Set(); r = generateRound(pool, PLAYERS, k, eslesme.derlenmis, zorluk); }
    if (r) { k = new Set(k); k.add(r.key); }
    setKullanilan(k);
    setTur(r);
    setKilitli(new Set());
    setCevaplayan(null);
    setSonKazanan(null);
    setCevaplarAcik(false);
    setTurNo((n) => n + 1);
    setPhase("tur");
  }

  function basla() {
    setSkorlar(Array(oyuncuSayisi).fill(0));
    setTurNo(0);
    yeniTur(computeRoundPool(PLAYERS, eslesme.derlenmis, zorluk), new Set());
  }

  function rovans() {
    setSkorlar(Array(oyuncuSayisi).fill(0));
    setTurNo(0);
    yeniTur();
  }

  function dogru() {
    const yeni = skorlar.map((p, i) => (i === cevaplayan ? p + 1 : p));
    setSkorlar(yeni);
    setSonKazanan(cevaplayan);
    playCorrect();
    recordRound("sunucu", true);
    setPhase(yeni[cevaplayan] >= hedef ? "bitti" : "sonuc");
  }

  function yanlis() {
    const k = new Set(kilitli);
    k.add(cevaplayan);
    setKilitli(k);
    setCevaplayan(null);
    playWrong();
    if (k.size >= oyuncuSayisi) { setSonKazanan(null); setPhase("sonuc"); }
    else setPhase("tur");
  }

  const cevaplar = useMemo(
    () => (tur ? [...tur.validAnswers].sort((a, b) => recognitionScore(b) - recognitionScore(a)) : []),
    [tur]
  );

  // ------------------------------------------------------------------ kurulum
  if (phase === "kurulum") {
    return (
      <ModKurulum
        modId="sunucu" girisYok
        baslik={_t("Sunucu Modu")}
        aciklama={_t(
          "2–6 kişi, tek telefon. Telefonu tutan sunucu iki kulübü okur; ilk bağıranın adına dokunur, ekrandaki doğru cevaplara bakıp ✓ ya da ✗ der. Kimse yazmaz."
        )}
        vurgu={VURGU}
        onGeri={onExitSilent || onExit}
        onBasla={basla}
      >
        <KurulumBolum baslik={_t("OYUNCU SAYISI")} vurgu={VURGU}>
          <SecimCipleri
            secenekler={[2, 3, 4, 5, 6].map((n) => ({ deger: n, etiket: String(n) }))}
            secili={oyuncuSayisi}
            onSec={setOyuncuSayisi}
          />
        </KurulumBolum>
        <KurulumBolum baslik={_t("OYUNCU ADLARI")} vurgu={VURGU} not={_t("Adlar kaydedilir; bir dahaki sefere hazır gelir.")}>
          <View style={{ gap: 8 }}>
            {Array.from({ length: oyuncuSayisi }, (_, i) => (
              <View key={i} style={s.adSatir}>
                <Text style={s.adNo}>{i + 1}</Text>
                <TextInput
                  style={s.adGirdi}
                  value={ham[i] || ""}
                  onChangeText={(t) => adDegistir(i, t)}
                  placeholder={varsayilanAd(i)}
                  placeholderTextColor={COLORS.textFaint}
                  maxLength={16}
                  autoCorrect={false}
                  autoCapitalize="words"
                  accessibilityLabel={_t("{0}. oyuncunun adı", [i + 1])}
                />
              </View>
            ))}
          </View>
        </KurulumBolum>
        <KurulumBolum baslik={_t("HEDEF PUAN")} vurgu={VURGU}>
          <SecimCipleri secenekler={HEDEFLER.map((n) => ({ deger: n, etiket: String(n) }))} secili={hedef} onSec={setHedef} />
        </KurulumBolum>
        <KurulumBolum baslik={_t("ZORLUK")} vurgu={VURGU}>
          <ZorlukSecici deger={zorluk} onDegis={setZorluk} aciklama={(z) => (z <= 3 ? _t("Sadece efsaneler ve süper yıldızlar.") : z <= 7 ? _t("Büyük liglerin bilinen oyuncuları.") : _t("Az bilinen oyuncular da çıkar."))} />
        </KurulumBolum>
        <KurulumBolum baslik={_t("EŞLEŞME PROFİLİ")} vurgu={VURGU}>
          <KapsamDugmesi etiket={eslesme.derlenmis.etiket} onPress={() => setProfilAcik(true)} />
        </KurulumBolum>
        <EslesmeProfiliPenceresi
          visible={profilAcik}
          profil={eslesme.profil}
          onUygula={(p) => { eslesme.setMacProfili(p); setProfilAcik(false); }}
          onVarsayilanYap={(p) => { eslesme.genelKaydet(p); setProfilAcik(false); }}
          onClose={() => setProfilAcik(false)}
        />
      </ModKurulum>
    );
  }

  // ------------------------------------------------------------------ maç sonu
  if (phase === "bitti") {
    return (
      <GameBackground style={s.kap}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <IsimliSkorTablosu
            modAdi={_t("Sunucu Modu")}
            oyuncular={adlar.map((ad, i) => ({ ad, puan: skorlar[i] || 0 }))}
            altYazi={_t("{0} tur · {1} puana ilk ulaşan kazandı", [turNo, hedef])}
            onRovans={rovans}
            onMenu={onExitSilent || onExit}
          />
        </ScrollView>
      </GameBackground>
    );
  }

  if (!tur) {
    return (
      <GameBackground style={s.kap}>
        <BackButton onPress={onExitSilent || onExit} />
        <Text style={s.soru}>{_t(
          "Bu ayarlarla kulüp çifti bulunamadı. Eşleşme profilini genişletmeyi dene."
        )}</Text>
      </GameBackground>
    );
  }

  const SkorSeridi = (
    <View style={s.skorSerit}>
      {adlar.map((ad, i) => (
        <View key={i} style={[s.skorKutu, sonKazanan === i && { borderColor: COLORS.accent }]}>
          <Text style={s.skorAd} numberOfLines={1}>{ad}</Text>
          <Text style={s.skorSayi}>{skorlar[i] || 0}</Text>
        </View>
      ))}
    </View>
  );

  const CiftKart = (
    <EslesmeKarti sol={{ tip: "kulup", ad: tur.teamA }} sag={{ tip: "kulup", ad: tur.teamB }} arma={72} style={{ marginBottom: SPACING.md }} />
  );

  const CevapListesi = ({ adet = GOSTERILEN_CEVAP }) => (
    <View style={s.cevaplar}>
      {cevaplar.slice(0, adet).map((p) => (
        <View key={p.name} style={s.cevap}>
          <PlayerPhoto name={p.name} size={26} showProfileOnPress={false} />
          <Text style={s.cevapAd} numberOfLines={1}>{p.name}</Text>
        </View>
      ))}
      {cevaplar.length > adet ? <Text style={s.dahaFazla}>+{cevaplar.length - adet}{" "}{_t("doğru cevap daha")}</Text> : null}
    </View>
  );

  return (
    <GameBackground style={s.kap}>
      <View style={s.ust}>
        <BackButton onPress={onExit} />
        <Text style={s.turNo}>{_t("TUR")}{" "}{turNo}{" "}{_t("· hedef")}{" "}{hedef}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {SkorSeridi}
        {CiftKart}

        {phase === "tur" ? (
          <>
            <Text style={s.soru}>{_t("Oku: \"İkisinde de oynamış futbolcu?\" İlk bağıranın adına dokun.")}</Text>
            <View style={s.oyuncular}>
              {adlar.map((ad, i) => {
                const k = kilitli.has(i);
                return (
                  <SoundPressable
                    key={i}
                    disabled={k}
                    onPress={() => { setCevaplayan(i); setPhase("kontrol"); }}
                    style={[s.oyuncuBtn, k && s.oyuncuKilitli]}
                    accessibilityLabel={k ? _t("{0}, bu turda kilitli", [ad]) : _t("{0} cevap veriyor", [ad])}
                  >
                    <Ionicons name={k ? "lock-closed" : "hand-right"} size={20} color={k ? COLORS.textFaint : COLORS.accentDark} />
                    <Text style={[s.oyuncuAd, k && { color: COLORS.textFaint }]} numberOfLines={1}>{ad}</Text>
                  </SoundPressable>
                );
              })}
            </View>
            <View style={s.altSatir}>
              <SoundPressable style={s.ikincil} onPress={() => setCevaplarAcik((a) => !a)}>
                <Ionicons name={cevaplarAcik ? "eye-off" : "eye"} size={18} color={COLORS.text} />
                <Text style={s.ikincilYazi}>{cevaplarAcik ? _t("Cevapları gizle") : _t("Cevapları gör")}</Text>
              </SoundPressable>
              <SoundPressable style={s.ikincil} onPress={() => { setSonKazanan(null); setPhase("sonuc"); }}>
                <Ionicons name="play-skip-forward" size={18} color={COLORS.text} />
                <Text style={s.ikincilYazi}>{_t("Kimse bilemedi")}</Text>
              </SoundPressable>
            </View>
            {cevaplarAcik ? <CevapListesi /> : null}
          </>
        ) : null}

        {phase === "kontrol" ? (
          <>
            <Text style={s.kontrolBaslik}>{adlar[cevaplayan]}{" "}{_t("ne dedi?")}</Text>
            <Text style={s.kontrolAlt}>{_t("Söylediği isim listede varsa ✓, yoksa ✗ (")}{cevaplar.length}{" "}{_t("doğru cevap)")}</Text>
            <View style={s.kararSatir}>
              <SoundPressable style={[s.karar, { backgroundColor: COLORS.danger }]} onPress={yanlis} accessibilityLabel={_t("Yanlış")}>
                <Ionicons name="close" size={30} color="#fff" />
                <Text style={s.kararYazi}>{_t("YANLIŞ")}</Text>
              </SoundPressable>
              <SoundPressable style={[s.karar, { backgroundColor: COLORS.accent }]} onPress={dogru} accessibilityLabel={_t("Doğru")}>
                <Ionicons name="checkmark" size={30} color={COLORS.accentDark} />
                <Text style={[s.kararYazi, { color: COLORS.accentDark }]}>{_t("DOĞRU")}</Text>
              </SoundPressable>
            </View>
            <CevapListesi adet={20} />
            <SoundPressable onPress={() => { setCevaplayan(null); setPhase("tur"); }} style={{ alignSelf: "center", marginTop: 12 }}>
              <Text style={s.link}>{_t("Yanlış kişiye dokundum, geri dön")}</Text>
            </SoundPressable>
          </>
        ) : null}

        {phase === "sonuc" ? (
          <>
            <Text style={s.kontrolBaslik}>{sonKazanan !== null ? `${adlar[sonKazanan]} +1` : _t("Bu turu kimse alamadı")}</Text>
            <Text style={s.kontrolAlt}>{_t("Bazı doğru cevaplar:")}</Text>
            <CevapListesi adet={6} />
            <SoundPressable style={s.sonraki} onPress={() => yeniTur()}>
              <Text style={s.sonrakiYazi}>{_t("SIRADAKİ TUR")}</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.accentDark} />
            </SoundPressable>
          </>
        ) : null}
      </ScrollView>
    </GameBackground>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  ust: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  turNo: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: VURGU.main },
  adSatir: { flexDirection: "row", alignItems: "center", gap: 10 },
  adNo: { width: 22, fontSize: 15, fontWeight: "900", color: COLORS.textMuted, textAlign: "center" },
  adGirdi: { flex: 1, height: 46, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card, color: COLORS.text, fontSize: 16, fontWeight: "700", paddingHorizontal: 12 },

  skorSerit: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: SPACING.sm },
  skorKutu: { flexGrow: 1, minWidth: "30%", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.cardBorder },
  skorAd: { fontSize: 12, fontWeight: "800", color: COLORS.textMuted },
  skorSayi: { fontSize: 20, fontWeight: "900", color: COLORS.text },

  cift: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: SPACING.md, padding: SPACING.md, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 2, borderColor: VURGU.main },
  kulup: { flex: 1, alignItems: "center", gap: 8 },
  kulupAd: { fontSize: 16, fontWeight: "900", color: COLORS.text, textAlign: "center" },
  carpi: { fontSize: 28, fontWeight: "900", color: COLORS.textMuted },
  soru: { fontSize: 14, fontWeight: "700", color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.md },

  oyuncular: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: SPACING.md },
  oyuncuBtn: { width: "48.5%", flexDirection: "row", alignItems: "center", gap: 8, height: 64, paddingHorizontal: 14, borderRadius: 16, backgroundColor: COLORS.accent },
  oyuncuKilitli: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  oyuncuAd: { flex: 1, fontSize: 18, fontWeight: "900", color: COLORS.accentDark },

  altSatir: { flexDirection: "row", gap: 8, marginTop: SPACING.md },
  ikincil: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", height: 46, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  ikincilYazi: { fontSize: 14, fontWeight: "800", color: COLORS.text },

  kontrolBaslik: { fontSize: 22, fontWeight: "900", color: COLORS.text, textAlign: "center", marginTop: SPACING.lg },
  kontrolAlt: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted, textAlign: "center", marginTop: 4 },
  kararSatir: { flexDirection: "row", gap: 10, marginTop: SPACING.md },
  karar: { flex: 1, height: 72, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  kararYazi: { fontSize: 18, fontWeight: "900", color: "#fff", letterSpacing: 1 },

  cevaplar: { marginTop: SPACING.md, gap: 6 },
  cevap: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.card },
  cevapAd: { flex: 1, fontSize: 15, fontWeight: "700", color: COLORS.text },
  dahaFazla: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted, textAlign: "center", marginTop: 4 },
  link: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted, textDecorationLine: "underline" },

  sonraki: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", height: 56, borderRadius: 16, backgroundColor: COLORS.accent, marginTop: SPACING.lg },
  sonrakiYazi: { fontSize: 18, fontWeight: "900", letterSpacing: 1, color: COLORS.accentDark },
});
