import React, { useRef, useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import GameBackground from "../components/GameBackground";
import BackButton from "../components/BackButton";
// Paket 16 — kart, bölüm ve "Kiminle oynuyorsun?" penceresi Online lobiyle ortak.
import { ModKarti, ModBolumu, ModSecimPenceresi } from "../components/ModKarti";
import { COLORS, SPACING, TYPE } from "../lib/theme";

import DailyGoalsCard from "../components/DailyGoalsCard";
import DailyPuzzleCard from "../components/DailyPuzzleCard";
import GunlukOyunlarKarti from "../components/GunlukOyunlarKarti";
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
    // 4 Ekim 2026 — Ortak Kulüp birleşti: Kulüp × Kulüp, Kulüp × Ülke, Takımı sen
    // seç ve Çoktan seçmeli artık tek kartın içinde, kurulumda "Tür" olarak seçiliyor
    // (eski "Kulüp & Ülke" ve "Hızlı Antrenman" kartları kaldırıldı).
    key: "teamTeam",
    grup: "klasik",
    title: "Ortak Kulüp",
    desc: "İki kulüpte (ya da kulüp + ülke) oynamış futbolcuyu rakibinden önce bul",
    icon: "shield-checkmark",
    colorKey: "teamTeam",
    id: "cpu",
    // 4 Ekim 2026 (.28743) — "Tek telefon" artık mod değil RAKİP SEÇENEĞİ.
    options: [
      { id: "cpu", rakip: "cpu", label: "CPU'ya karşı" },
      { id: "local", rakip: "yanimdaki", label: "Yanımdaki — 2 kişi", alt: "Ekran ikiye bölünür, ilk basan cevaplar" },
      { id: "sunucu", rakip: "yanimdaki", label: "Yanımdakiler — Sunucu modu", alt: "2–6 kişi; sen okursun, onlar bağırır" },
      { id: "online", rakip: "online", label: "Online", alt: "Rastgele rakip ya da oda kodu", sekme: true, params: { mod: "classic" } },
    ],
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
    // 4 Ekim 2026 (benchmark .28548) — İlk Harf zincirinin tek kişilik hâli.
    key: "harfZinciri",
    grup: "bilgi",
    title: "Harf Zinciri",
    desc: "Son harften devam et, 3 canla en uzun zinciri kur",
    icon: "link",
    colorKey: "letters",
    id: "letterZincir",
  },
  {
    key: "whoAmI",
    grup: "bilgi",
    title: "Kim Bu Futbolcu?",
    desc: "Kartları çevir, gizli futbolcuyu bil",
    icon: "help-circle",
    colorKey: "whoAmI",
    id: "whoAmICpu",
    // Paket 13 — Kim Bu modları (benchmark): Seri, Kadro Avı, Online düello.
    // Günlük Kim Bu üstteki günlük kutularda.
    options: [
      { id: "whoAmICpu", rakip: "cpu", label: "Seri", alt: "3 can, seviye seviye zorlaşır" },
      { id: "kadroAvi", rakip: "cpu", label: "Kadro Avı", alt: "Bir kadronun gizli oyuncusu — bulunca kadroya eklenir" },
      { id: "online", rakip: "online", label: "Online", alt: "Aynı masada düello: ilk bilen alır", sekme: true, params: { mod: "whoami" } },
    ],
  },
  {
    // 4 Ekim 2026 (.28709) — eski "Tek Telefon 2 Kişi" kartının yerine. 2 kişilik
    // bölünmüş ekran artık Ortak Kulüp → "Yanımdaki" seçeneğinde.
    key: "sunucu",
    grup: "arkadas",
    title: "Sunucu Modu",
    desc: "2–6 kişi, tek telefon. Sen kulüpleri okursun, onlar bağırır",
    icon: "mic",
    colorKey: "hotSeat",
    id: "sunucu",
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
      { id: "fiveClubsCpu", rakip: "cpu", label: "CPU'ya karşı" },
      { id: "fiveClubs", rakip: "yanimdaki", label: "Yanımdaki — 2 kişi", alt: "Aynı telefon, sırayla" },
      // Paket 16 (5 Ekim 2026) — Online 5 Kulüp açıldı: iki oyuncu aynı anda, gizli cevap.
      { id: "online", rakip: "online", label: "Online", alt: "Aynı anda gizli cevap, 3 tur", sekme: true, params: { mod: "five" } },
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
    options: [
      { id: "xox", params: { rakip: "cpu" }, rakip: "cpu", label: "CPU'ya karşı" },
      { id: "xox", params: { rakip: "iki" }, rakip: "yanimdaki", label: "Yanımdaki — 2 kişi", alt: "Aynı telefon, sırayla" },
      // 5 Ekim 2026 (.29379) — Online XOX açıldı: Online sekmesine XOX seçili gider.
      { id: "online", rakip: "online", label: "Online", alt: "Rastgele rakip ya da arkadaşınla kodla", sekme: true, params: { mod: "xox" } },
    ],
  },
];

// 28 Eylül 2026 — denetim bulgusu #7: "8 eşit ağırlıklı mod kartı, gruplama/öneri
// yok". Kartlar üç başlık altında; en üstte tek dokunuşla oyuna sokan bir
// "Hemen Oyna" kartı (Ortak Kulüp, CPU'ya karşı — ayarlar eşleşme profilinden).
const RAKIP_BASLIK = { cpu: "CPU", yanimdaki: "YANIMDAKİLERLE", online: "ONLINE" };
const RAKIP_IKON = { cpu: "hardware-chip", yanimdaki: "people", online: "globe" };

const GRUPLAR = [
  { id: "klasik", baslik: "Ortak Futbolcu Oyunları", ikon: "shield-checkmark" },
  { id: "bilgi", baslik: "Bilgi & Hız", ikon: "bulb" },
  { id: "arkadas", baslik: "Arkadaşınla Aynı Telefonda", ikon: "people" },
];

// 3 Ekim 2026 — bu ekran artık ana sayfa DEĞİL, "Tüm Modlar" sayfası (yeni ana
// sayfa: screens/AnaSayfaScreen.js). Seviye şeridi, "Hemen Oyna" kartı ve
// "tuttuğun takım" sorusu ana sayfaya taşındı; burada geri düğmesi + modlar +
// günün bulmacası / görevler kaldı (Kerem: "mevcut anasayfamızı yeni bir sayfa
// olarak muhafaza edip...").
export default function OynaScreen({ onSelect, onDailyPuzzle, onGunlukOyun, onSekme, onBack }) {
  const [pickerMode, setPickerMode] = useState(null); // seçenek modalı açık olan mod (options'lı olanlar için)

  async function handleSelect(modeId, params) {
    setPickerMode(null);
    onSelect(modeId, params);
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
          {/* 4 Ekim 2026 — Günlük 5 Kulüp + Günlük Izgara (.29283, .29364) */}
          {onGunlukOyun ? (
            <GunlukOyunlarKarti onKadro={() => onGunlukOyun("gunlukKadro")} onKimBu={() => onGunlukOyun("gunlukKimBu")} onBesKulup={() => onGunlukOyun("gunluk5")} onIzgara={() => onGunlukOyun("gunlukIzgara")} />
          ) : null}
          <DailyGoalsCard />
        </View>

        {GRUPLAR.map((g) => (
          <ModBolumu key={g.id} baslik={g.baslik} ikon={g.ikon}>
            {MODES.filter((m) => m.grup === g.id).map((m) => (
              <ModKarti key={m.key} mod={m} onPress={() => handleCardPress(m)} />
            ))}
          </ModBolumu>
        ))}
      </Animated.ScrollView>

      {/* 4 Ekim 2026 (.28743) — ilk soru "kiminle?": CPU / Yanımdaki / Online */}
      <ModSecimPenceresi
        mod={pickerMode}
        onClose={() => setPickerMode(null)}
        secenekler={(pickerMode?.options || []).map((opt, i) => ({
          anahtar: `${opt.id}-${i}`,
          grup: RAKIP_BASLIK[opt.rakip],
          ikon: RAKIP_IKON[opt.rakip] || "play",
          label: opt.label,
          alt: opt.alt,
          kapali: opt.kapali,
          onPress: () => {
            if (opt.sekme) { setPickerMode(null); onSekme && onSekme(opt.id, { ...(opt.params || {}), t: Date.now() }); return; }
            handleSelect(opt.id, opt.params);
          },
        }))}
      />
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  ustBloklar: { gap: SPACING.md, marginBottom: SPACING.xxl },
  baslikSatiri: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg, gap: SPACING.sm },
  sayfaBaslik: { ...TYPE.h1 },
  // 12 Eylül 2026: paddingTop 50 SPACING ölçeğinde olmayan bir değerdi;
  // marka bloğu compact'e çekildiği için üst boşluk da ölçeğe döndü.
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: SPACING.xxl },

});
