import React, { useRef, useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated, Dimensions, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import PressScale from "../components/ui/PressScale";
import BackButton from "../components/BackButton";
import { COLORS, MODE_COLORS, RADIUS, SPACING, TYPE, SHADOW } from "../lib/theme";

import DailyGoalsCard from "../components/DailyGoalsCard";
import DailyPuzzleCard from "../components/DailyPuzzleCard";
// "Oyna" sekmesi — 30 Ağustos 2026'da alt menüye (bottom tab) geçişle birlikte
// eski HomeScreen'den ayrıştırıldı: Online ve Ansiklopedi artık kendi
// sekmeleri, oyuncu kartı + Ayarlar/Yardım artık Profilim sekmesinde — bu
// ekranda SADECE offline oyun modları kalıyor (Kerem'in isteği: "her şeyi ana
// sayfaya doldurmak yerine" ayrı sekmelere bölmek).
//
// 31 Ağustos 2026: Mod isimleri profesyonelce yeniden adlandırıldı (Kerem:
// "Takım-Takım ismi güzel durmuyor, diğerleri de"). "Ortak Kulüp" alt-seçenek
// (Sen Seç / CPU Rastgele) artık ana ızgarada GÖRÜNMÜYOR — karta dokununca
// bir modal açılıp seçim orada yapılıyor (Kerem: "ana ekranda var olmasına
// gerek yok, içine girince çıkar o seçenekleri").
const MODES = [
  {
    key: "teamTeam",
    grup: "klasik",
    title: "Ortak Kulüp",
    desc: "İki takımda da oynamış ortak futbolcuyu bul",
    icon: "shield-checkmark",
    colorKey: "teamTeam",
    // id yok — dokununca açılan modal içinde draftCpu/cpu seçilecek.
    options: [
      { id: "draftCpu", label: "Takımı Sen Seç" },
      { id: "cpu", label: "CPU Rastgele Atar" },
    ],
  },
  {
    key: "teamCountry",
    grup: "klasik",
    title: "Kulüp & Ülke",
    desc: "Bir ülke + bir kulüpte oynamış futbolcuyu bul",
    icon: "earth",
    colorKey: "teamCountry",
    id: "countryTeamCpu",
  },
  {
    key: "letters",
    grup: "bilgi",
    title: "İlk Harften Bul",
    desc: "Verilen baş harflerle başlayan futbolcuyu bul",
    icon: "text",
    colorKey: "letters",
    id: "letterCpu",
  },
  {
    key: "whoAmI",
    grup: "bilgi",
    title: "Kim Bu Futbolcu?",
    desc: "İpuçlarıyla gizli futbolcuyu tahmin et",
    icon: "help-circle",
    colorKey: "whoAmI",
    id: "whoAmICpu",
  },
  {
    key: "training",
    grup: "bilgi",
    title: "Hızlı Antrenman",
    desc: "4 şıklı, seri cevaplamaca (sadece offline)",
    icon: "flash",
    colorKey: "training",
    id: "quickCpu",
  },
  {
    key: "hotSeat",
    grup: "arkadas",
    title: "Tek Telefon 2 Kişi",
    desc: "Ekran ikiye bölünür, tek telefonda 2 oyuncu",
    icon: "phone-portrait",
    colorKey: "hotSeat",
    id: "local",
  },
  {
    // 4 Eylül 2026 (Kerem'in yeni mod isteği) — bkz. screens/FiveClubsScreen.js
    key: "fiveClubs",
    grup: "klasik",
    title: "5 Kulüp",
    desc: "5 büyük kulüpten kaçında oynadığını bil, en çok puanı topla",
    icon: "podium",
    colorKey: "fiveClubs",
    // 12 Eylül 2026 (Kerem: "5 kulüp modu aslında cpu'ya karşı da
    // oynanabilmeli") — Ortak Kulüp'le aynı desen: tek kart, dokununca
    // seçenek modalı.
    options: [
      { id: "fiveClubsCpu", label: "CPU'ya Karşı" },
      { id: "fiveClubs", label: "Tek Telefon 2 Kişi" },
    ],
  },
  {
    // 12 Eylül 2026 (Kerem: "xox oyunu da eklemek istiyorum. hem vs cpu hem
    // aynı ekranda arkadaşla oynama şekli.") — bkz. screens/XoxScreen.js.
    // Rakip tipi ve zorluk ekranın KENDİ kurulum adımında seçiliyor, bu yüzden
    // burada seçenek modalı yok.
    key: "xox",
    grup: "klasik",
    title: "Futbolcu XOX",
    desc: "3x3 ızgara, kareyi almak için ortak futbolcuyu söyle",
    icon: "grid",
    // 26 Eylül 2026 — eskiden "hotSeat" idi; "Tek Telefon 2 Kişi" ile aynı
    // renkteydi ve iki kart ayırt edilemiyordu (bkz. lib/theme.js notu).
    colorKey: "xox",
    id: "xox",
  },
];

// 28 Eylül 2026 — denetim bulgusu #7: "8 eşit ağırlıklı mod kartı, gruplama/öneri
// yok". Kartlar üç başlık altında; en üstte tek dokunuşla oyuna sokan bir
// "Hemen Oyna" kartı (Ortak Kulüp, CPU'ya karşı — ayarlar eşleşme profilinden).
const GRUPLAR = [
  { id: "klasik", baslik: "Ortak Futbolcu Oyunları", ikon: "shield-checkmark" },
  { id: "bilgi", baslik: "Bilgi & Hız", ikon: "bulb" },
  { id: "arkadas", baslik: "Arkadaşınla Aynı Telefonda", ikon: "people" },
];

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - SPACING.xl * 2 - SPACING.md) / 2;

// 3 Ekim 2026 — bu ekran artık ana sayfa DEĞİL, "Tüm Modlar" sayfası (yeni ana
// sayfa: screens/AnaSayfaScreen.js). Seviye şeridi, "Hemen Oyna" kartı ve
// "tuttuğun takım" sorusu ana sayfaya taşındı; burada geri düğmesi + modlar +
// günün bulmacası / görevler kaldı (Kerem: "mevcut anasayfamızı yeni bir sayfa
// olarak muhafaza edip...").
export default function OynaScreen({ onSelect, onDailyPuzzle, onBack }) {
  const [pickerMode, setPickerMode] = useState(null); // seçenek modalı açık olan mod (options'lı olanlar için)

  async function handleSelect(modeId) {
    setPickerMode(null);
    onSelect(modeId);
    // 12 Eylül 2026: burada bumpStreak() çağrılıyordu — yani mod kartına
    // DOKUNMAK "bugün oynadım" saymaya yetiyordu. Seri artık gerçekten bir tur
    // tamamlanınca artıyor (lib/stats.js recordRound içinde), böylece online
    // oynayanlar da kapsanıyor.
    try {
      const { supabase, getDeviceId } = require("../lib/supabaseClient");
      const deviceId = await getDeviceId();
      await supabase.from("game_stats").insert([{ mode_id: modeId, device_id: deviceId }]);
    } catch (err) {
      console.log("Analytics error:", err);
    }
  }

  function handleCardPress(mode) {
    if (mode.options) {
      setPickerMode(mode);
    } else {
      handleSelect(mode.id);
    }
  }

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <GameBackground style={styles.container}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        {/* 12 Eylül 2026 — VİTRİN DÜZENLEMESİ.
            Denetimden: "Uygulamayı açan kullanıcının ilk gördüğü ekran
            ilerlemeye dair tek bir piksel göstermiyor" ve "40px '3-2-1'
            hiçbir iş yapmıyor". Marka bloğu compact'e çekildi, yerine
            seviye/XP/seri şeridi ve günlük görev kartı geldi. */}
        <View style={styles.baslikSatiri}>
          {onBack ? <BackButton onPress={onBack} /> : null}
          <Text style={styles.sayfaBaslik}>Tüm Modlar</Text>
        </View>

        <View style={styles.ustBloklar}>
          {/* 12 Eylül 2026 — Günün Bulmacası: geri gelme sebebi. Görev
              kartının ÜSTÜNDE duruyor çünkü günde bir kez ve süreli. */}
          <DailyPuzzleCard onPress={onDailyPuzzle} />
          <DailyGoalsCard />
        </View>

        {GRUPLAR.map((g) => (
          <View key={g.id} style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name={g.ikon} size={16} color={COLORS.accent} />
              <Text style={styles.sectionTitle}>{g.baslik}</Text>
            </View>
            <View style={styles.grid}>
              {MODES.filter((m) => m.grup === g.id).map((m) => (
                <GridCard key={m.key} mode={m} onPress={() => handleCardPress(m)} />
              ))}
            </View>
          </View>
        ))}
      </Animated.ScrollView>

      <Modal visible={!!pickerMode} transparent animationType="fade" onRequestClose={() => setPickerMode(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerMode(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {pickerMode && (
              <>
                <View style={[styles.modalIconWrap, { backgroundColor: MODE_COLORS[pickerMode.colorKey].main }]}>
                  <Ionicons name={pickerMode.icon} size={26} color={COLORS.accentDark} />
                </View>
                <Text style={styles.modalTitle}>{pickerMode.title}</Text>
                <Text style={styles.modalDesc}>{pickerMode.desc}</Text>
                <View style={styles.modalOptions}>
                  {pickerMode.options.map((opt) => (
                    <PressScale key={opt.id} style={styles.modalOptionBtn} onPress={() => handleSelect(opt.id)}>
                      <Text style={styles.modalOptionText}>{opt.label}</Text>
                      <Ionicons name="chevron-forward" size={18} color={COLORS.accentDark} />
                    </PressScale>
                  ))}
                </View>
                <Pressable style={styles.modalCancel} onPress={() => setPickerMode(null)}>
                  <Text style={styles.modalCancelText}>Vazgeç</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </GameBackground>
  );
}

function GridCard({ mode, onPress }) {
  const c = MODE_COLORS[mode.colorKey];
  return (
    <PressScale style={[styles.gridCard, { borderColor: c.main, backgroundColor: c.dark }]} onPress={onPress}>
      <View style={[styles.gridIconWrap, { backgroundColor: c.main }]}>
        <Ionicons name={mode.icon} size={22} color={COLORS.accentDark} />
      </View>
      <Text style={styles.cardTitle}>{mode.title}</Text>
      <Text style={styles.cardDesc} numberOfLines={2}>{mode.desc}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  ustBloklar: { gap: SPACING.md, marginBottom: SPACING.xxl },
  baslikSatiri: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg, gap: SPACING.sm },
  sayfaBaslik: { ...TYPE.h1 },
  // 12 Eylül 2026: paddingTop 50 SPACING ölçeğinde olmayan bir değerdi;
  // marka bloğu compact'e çekildiği için üst boşluk da ölçeğe döndü.
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: SPACING.xxl },

  section: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl },
  hemen: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.accent, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOW.card,
  },
  hemenIkon: {
    width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  hemenBaslik: { ...TYPE.h2, color: COLORS.accentDark },
  hemenAlt: { fontSize: 12, fontWeight: "700", color: COLORS.accentDark, opacity: 0.8, marginTop: 2 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.md, marginLeft: 4 },
  sectionTitle: { ...TYPE.h2 },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: SPACING.md },
  gridCard: {
    width: CARD_WIDTH,
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  gridIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },

  cardTitle: { ...TYPE.h3, marginBottom: SPACING.xs },
  cardDesc: { fontSize: 12, fontWeight: "500", color: COLORS.text, opacity: 0.85, lineHeight: 16 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: SPACING.xl },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: "center",
  },
  modalIconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },
  modalTitle: { ...TYPE.h2, marginBottom: 4, textAlign: "center" },
  modalDesc: { ...TYPE.bodyMuted, textAlign: "center", marginBottom: SPACING.lg },
  modalOptions: { width: "100%", gap: SPACING.sm },
  modalOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
  },
  modalOptionText: { color: COLORS.accentDark, fontWeight: "900", fontSize: 14 },
  modalCancel: { marginTop: SPACING.lg },
  modalCancelText: { color: COLORS.textMuted, fontWeight: "700", fontSize: 13 },
});
