import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import GameBackground from "../components/GameBackground";
import PressScale from "../components/ui/PressScale";
import SoundPressable from "../components/SoundPressable";
import TakimSorusuPenceresi from "../components/TakimSorusuPenceresi";
import BilgiTestiPenceresi from "../components/BilgiTestiPenceresi";
import { useAppSettings } from "../lib/SettingsContext";
import { ayarlardanProfil, profilEtiketi, etkinAyar } from "../lib/eslesmeProfili";
import { getProfile, xpProgress } from "../lib/profile";
import { getStreak, seriDurumu } from "../lib/streak";
import { getBulmacaDurumu } from "../lib/dailyPuzzleStore";
import { DENEME_HAKKI, gunNumarasi } from "../lib/dailyPuzzle";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW } from "../lib/theme";

// ============================================================================
// YENİ ANA SAYFA — 3 Ekim 2026
//
// Kerem (1 Ekim APK testi): "anasayfa çok kalabalık... oyunu açtığın gibi
// oyuncuyu oynamaya sevk etmeli." Tasarım kartında seçilen "A — Tek Buton":
//   • üstte tek satır: seviye + seri
//   • ortada TEK büyük kart: sıradaki maçın iki kulübü GİZLİ ("?" arma, ilk harf
//     + noktalar — Kerem: "G.... vs R.... gibi"), tek OYNA butonu. OYNA kurulum
//     ekranını ATLAR, ayarlar Ayarlar'daki varsayılanlardan gelir (Kerem: ilk
//     oyun ayarsız başlasın). Alttaki küçük satır ayarlı kuruluma götürür.
//   • altında tek günlük satırı ve "Tüm modlar" butonu. Eski ana sayfa
//     (OynaScreen) olduğu gibi "Tüm Modlar" sayfası oldu.
//
// AĞIR VERİ YOK: bu ekran players.json / gameEngine yüklemez (App.js'teki
// tembel yükleme kuralı). Vitrindeki kulüp çifti, önceden hesaplanmış küçük bir
// listeden (lib/vitrinCiftleri.json, ~400 çift, her birinde 5–60 ortak oyuncu)
// seçiliyor ve OYNA'da Ortak Kulüp ekranına İLK TUR olarak veriliyor; yani
// vitrinde gördüğün harfler gerçekten ilk turun kulüpleri.
// ============================================================================

const CIFTLER = require("../lib/vitrinCiftleri.json");

function bugunStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Profile uygun bir vitrin çifti seç. Kesin kapsamlı profillerde (Sadece Süper
// Lig, 5 Büyük Lig) sadece kapsama giren çiftler; diğerlerinde bölge
// ağırlığına göre Türk kulübü içeren çift olasılığı.
const TR_OLASILIGI = [0.8, 0.6, 0.45, 0.2, 0.1]; // bölge kademesi 0..4
export function vitrinCiftiSec(profil, rastgele = Math.random) {
  const temel = profil?.temel || "dengeli";
  let aday = CIFTLER;
  if (temel === "superLig") aday = CIFTLER.filter((c) => c.tt);
  else if (temel === "big5") aday = CIFTLER.filter((c) => c.b5);
  else {
    const bolge = etkinAyar(profil || { temel: "dengeli" }).bolge;
    const trMi = rastgele() < (TR_OLASILIGI[bolge] ?? 0.45);
    const filtreli = CIFTLER.filter((c) => (trMi ? c.tr : !c.tr));
    if (filtreli.length) aday = filtreli;
    // Tuttuğu takım varsa çiftlerin üçte birinde o takım.
    if (profil?.takim && profil.takimOrani !== "yok" && rastgele() < 0.33) {
      const takimli = CIFTLER.filter((c) => c.a === profil.takim || c.b === profil.takim);
      if (takimli.length) aday = takimli;
    }
  }
  if (!aday.length) return null;
  const c = aday[Math.floor(rastgele() * aday.length)];
  // Hangi kulübün solda duracağı da rastgele.
  return rastgele() < 0.5 ? [c.a, c.b] : [c.b, c.a];
}

// "Galatasaray" -> "G" + 10 nokta. Boşluklar korunur ki "R····· ······"
// iki kelime olduğu sezilsin; çok uzun adlar 12 noktada kesilir.
export function gizliAd(ad) {
  if (!ad) return "?";
  const ilk = ad.charAt(0);
  const kalan = ad.slice(1).replace(/\S/g, "·").slice(0, 12);
  return { ilk, kalan };
}

// 3 Ekim 2026 (Kerem: "logolar böyle çok renksiz ya, rastgele renkli palavra
// logolar koyalım") — gerçek armayı ima etmeyen, her vitrinde rastgele üretilen
// renkli kalkanlar. Renk çiftleri canlı ve birbirinden ayırt edilir; desen
// dört tipten biri (düz + kuşak, dikey çizgi, ikiye bölünmüş, çapraz bant).
const ARMA_RENKLERI = [
  ["#E63946", "#F1FAEE"], ["#1D4ED8", "#FACC15"], ["#16A34A", "#F8FAFC"], ["#7C3AED", "#F59E0B"],
  ["#0EA5E9", "#0F172A"], ["#DC2626", "#111827"], ["#F97316", "#1E3A8A"], ["#DB2777", "#FDE68A"],
  ["#14B8A6", "#7F1D1D"], ["#FACC15", "#14532D"], ["#2563EB", "#F8FAFC"], ["#991B1B", "#60A5FA"],
];
const DESENLER = ["kusak", "cizgi", "yarim", "capraz"];
export function rastgeleArma(rastgele = Math.random) {
  const [a, b] = ARMA_RENKLERI[Math.floor(rastgele() * ARMA_RENKLERI.length)];
  const ters = rastgele() < 0.5;
  return { ana: ters ? b : a, ikinci: ters ? a : b, desen: DESENLER[Math.floor(rastgele() * DESENLER.length)] };
}

export default function AnaSayfaScreen({ onPlay, onCustomize, onAllModes, onDailyPuzzle }) {
  const { settings } = useAppSettings();
  const profil = ayarlardanProfil(settings);
  const [cift, setCift] = useState(null);
  const [armalar, setArmalar] = useState([null, null]);
  const [seviye, setSeviye] = useState(null);
  const [seri, setSeri] = useState({ count: 0, lastPlayedDate: null });
  const [bulmaca, setBulmaca] = useState(null);

  // Ekrana her dönüşte: yeni vitrin çifti, güncel XP / seri / bulmaca durumu.
  useFocusEffect(
    useCallback(() => {
      let iptal = false;
      setCift(vitrinCiftiSec(profil));
      let a1 = rastgeleArma(), a2 = rastgeleArma();
      for (let i = 0; i < 5 && a2.ana === a1.ana; i++) a2 = rastgeleArma();
      setArmalar([a1, a2]);
      getProfile().then((p) => !iptal && setSeviye(xpProgress(p))).catch(() => {});
      getStreak().then((s) => !iptal && setSeri(s)).catch(() => {});
      getBulmacaDurumu().then((d) => !iptal && setBulmaca(d)).catch(() => {});
      return () => { iptal = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings?.eslesmeProfili])
  );

  // 4 Ekim 2026 (.29585) — tek seri kuralı + dondurma: gösterilen sayı seriDurumu'ndan.
  const sd = seriDurumu(seri);
  const bugunOynandi = sd.durum === "tamam";
  const sol = gizliAd(cift?.[0]);
  const sag = gizliAd(cift?.[1]);

  const bulmacaBitti = Boolean(bulmaca?.bitti);
  const bulmacaAlt = !bulmaca
    ? "Herkese aynı soru, günde bir kez"
    : bulmacaBitti
    ? bulmaca.bilindi
      ? `Bugünü ${bulmaca.denemeler.length} denemede bildin`
      : "Bugünü bilemedin, yarın yeni soru"
    : bulmaca.denemeler?.length
    ? `${DENEME_HAKKI - bulmaca.denemeler.length} deneme hakkın kaldı`
    : "Herkese aynı soru, 3 deneme hakkı";

  return (
    <GameBackground style={styles.kap}>
      <TakimSorusuPenceresi />
      {/* 4 Ekim 2026 — takım sorusundan hemen sonra bir kez: futbol bilgisi testi */}
      <BilgiTestiPenceresi otomatik />
      <ScrollView contentContainerStyle={styles.icerik} showsVerticalScrollIndicator={false}>
        {/* Üst satır: seviye + seri */}
        <View style={styles.ust}>
          <View style={styles.seviyeSol}>
            <View style={styles.seviyeHalka}>
              <Text style={styles.seviyeSayi}>{seviye ? seviye.level : "–"}</Text>
            </View>
            <View>
              <Text style={styles.seviyeBaslik}>Seviye {seviye ? seviye.level : "–"}</Text>
              <Text style={styles.seviyeAlt}>
                {seviye ? `${seviye.into} / ${seviye.needed} XP` : " "}
              </Text>
            </View>
          </View>
          <View style={[styles.seriHap, sd.gosterilen > 0 && !bugunOynandi && styles.seriRiskte]} accessibilityLabel={`${sd.gosterilen} günlük seri. ${sd.mesaj}`}>
            <Ionicons name="flame" size={16} color={bugunOynandi ? COLORS.cta : COLORS.textMuted} />
            <Text style={styles.seriYazi}>{sd.gosterilen} gün{sd.durum === "dondurma" ? " ❄️" : ""}</Text>
          </View>
        </View>

        {/* Kahraman kart */}
        <View style={styles.kahraman}>
          <Text style={styles.kahramanUst}>SIRADAKİ MAÇIN HAZIR</Text>
          <View style={styles.takimlar}>
            <GizliTakim ad={sol} arma={armalar[0]} />
            <Text style={styles.carpi}>✕</Text>
            <GizliTakim ad={sag} arma={armalar[1]} />
          </View>
          <Text style={styles.kahramanAciklama}>İki kulüp, bir ortak futbolcu. Önce sen bul.</Text>
          <PressScale
            style={styles.oyna}
            onPress={() => onPlay(cift)}
            accessibilityRole="button"
            accessibilityLabel="Oyna"
          >
            <Ionicons name="play" size={24} color={COLORS.accentDark} />
            <Text style={styles.oynaYazi}>OYNA</Text>
          </PressScale>
          <SoundPressable style={styles.ayarSatiri} onPress={onCustomize} hitSlop={8}>
            <Text style={styles.ayarYazi} numberOfLines={1}>
              {profilEtiketi(profil)} · CPU'ya karşı
            </Text>
            <Ionicons name="options-outline" size={15} color={COLORS.textMuted} />
          </SoundPressable>
        </View>

        {/* Tek günlük satırı (Günün Kadrosu gelene kadar Günün Bulmacası) */}
        <SoundPressable style={styles.gunluk} onPress={onDailyPuzzle}>
          <View style={styles.gunlukIkon}>
            <Ionicons
              name={bulmacaBitti ? (bulmaca.bilindi ? "checkmark" : "close") : "calendar"}
              size={22}
              color={COLORS.cta}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.gunlukBaslik}>Günün Bulmacası #{gunNumarasi()}</Text>
            <Text style={styles.gunlukAlt}>{bulmacaAlt}</Text>
          </View>
          {!bulmacaBitti && <Ionicons name="chevron-forward" size={18} color={COLORS.cta} />}
        </SoundPressable>

        {/* 4 Ekim 2026 (Kerem: "anasayfadaki tüm modlar butonu da belli
            olmuyor") — artık günlük satırıyla aynı ağırlıkta bir kart. */}
        <SoundPressable style={styles.tumModlar} onPress={onAllModes} accessibilityRole="button" accessibilityLabel="Tüm modlar">
          <View style={styles.tumModlarIkon}>
            <Ionicons name="grid" size={20} color={TUM_MODLAR_RENGI} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.gunlukBaslik}>Tüm modlar</Text>
            <Text style={styles.gunlukAlt} numberOfLines={1}>Kim Bu, 5 Kulüp, XOX, İlk Harf ve dahası</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={TUM_MODLAR_RENGI} />
        </SoundPressable>
      </ScrollView>
    </GameBackground>
  );
}

function Arma({ arma }) {
  if (!arma) {
    return (
      <View style={styles.arma}>
        <Text style={styles.armaSoru}>?</Text>
      </View>
    );
  }
  const { ana, ikinci, desen } = arma;
  return (
    <View style={[styles.armaRenkli, { backgroundColor: ana, borderColor: ikinci }]}>
      {desen === "cizgi" ? (
        <View style={styles.cizgiler}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? ikinci : ana }} />
          ))}
        </View>
      ) : null}
      {desen === "yarim" ? <View style={[styles.yarim, { backgroundColor: ikinci }]} /> : null}
      {desen === "kusak" ? <View style={[styles.kusak, { backgroundColor: ikinci }]} /> : null}
      {desen === "capraz" ? <View style={[styles.capraz, { backgroundColor: ikinci }]} /> : null}
      <View style={[styles.soruRozet, { borderColor: ikinci }]}>
        <Text style={styles.soruRozetYazi}>?</Text>
      </View>
    </View>
  );
}

function GizliTakim({ ad, arma }) {
  return (
    <View style={styles.takim}>
      <Arma arma={arma} />
      {typeof ad === "string" ? (
        <Text style={styles.takimAd}>?</Text>
      ) : (
        <Text style={styles.takimAd} numberOfLines={1}>
          {ad.ilk}
          <Text style={styles.takimNokta}>{ad.kalan}</Text>
        </Text>
      )}
    </View>
  );
}

const TUM_MODLAR_RENGI = "#5EC8FF";

const styles = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg },
  icerik: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: 48 },

  ust: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.lg },
  seviyeSol: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  seviyeHalka: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: COLORS.accent,
    alignItems: "center", justifyContent: "center", backgroundColor: COLORS.card,
  },
  seviyeSayi: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  seviyeBaslik: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  seviyeAlt: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600", marginTop: 1 },
  seriHap: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: RADIUS.pill, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  seriRiskte: { borderColor: COLORS.cta },
  seriYazi: { color: COLORS.text, fontSize: 14, fontWeight: "800" },

  kahraman: {
    backgroundColor: COLORS.card, borderRadius: 26, borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg, ...SHADOW.card,
  },
  kahramanUst: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 1.6 },
  takimlar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACING.xl },
  takim: { width: "40%", alignItems: "center", gap: SPACING.sm },
  arma: {
    width: 70, height: 80, borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderBottomLeftRadius: 35, borderBottomRightRadius: 35,
    borderWidth: 2, borderStyle: "dashed", borderColor: COLORS.cardBorder, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  armaSoru: { color: COLORS.textMuted, fontSize: 34, fontWeight: "900" },
  armaRenkli: {
    width: 70, height: 80, borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderBottomLeftRadius: 35, borderBottomRightRadius: 35, borderWidth: 3,
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  cizgiler: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, flexDirection: "row" },
  yarim: { position: "absolute", top: 0, bottom: 0, left: 0, width: "50%" },
  kusak: { position: "absolute", left: 0, right: 0, top: "36%", height: "26%" },
  capraz: { position: "absolute", width: 26, height: 140, top: -30, left: 22, transform: [{ rotate: "35deg" }] },
  soruRozet: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2, backgroundColor: "rgba(10,16,24,0.82)",
    alignItems: "center", justifyContent: "center",
  },
  soruRozetYazi: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
  takimAd: { color: COLORS.text, fontSize: 20, fontWeight: "900", letterSpacing: 1.5 },
  takimNokta: { color: COLORS.textMuted, fontWeight: "900" },
  carpi: { color: COLORS.textMuted, fontSize: 26, fontWeight: "900" },
  kahramanAciklama: { ...TYPE.body, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.lg },
  oyna: {
    marginTop: SPACING.lg, height: 66, borderRadius: 18, backgroundColor: COLORS.accent,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  oynaYazi: { color: COLORS.accentDark, fontSize: 30, fontWeight: "900", letterSpacing: 2 },
  ayarSatiri: {
    alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, marginTop: SPACING.sm,
  },
  ayarYazi: { color: COLORS.textMuted, fontSize: 13, fontWeight: "700", maxWidth: 260 },

  gunluk: {
    marginTop: SPACING.lg, flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.lg, borderRadius: 20, borderWidth: 1, borderColor: COLORS.cta, backgroundColor: COLORS.card,
  },
  gunlukIkon: {
    width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg,
  },
  gunlukBaslik: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  gunlukAlt: { color: COLORS.textMuted, fontSize: 13, fontWeight: "600", marginTop: 2 },

  tumModlar: {
    marginTop: SPACING.md, flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.lg, borderRadius: 20, borderWidth: 1, borderColor: TUM_MODLAR_RENGI, backgroundColor: COLORS.card,
  },
  tumModlarIkon: {
    width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg,
  },
});
