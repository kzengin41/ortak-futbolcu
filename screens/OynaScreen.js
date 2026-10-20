import { _t } from "../lib/dil";
import React, { useRef, useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import GameBackground from "../components/GameBackground";
import BackButton from "../components/BackButton";
import PressScale from "../components/ui/PressScale";
// Paket 16 — kart, bölüm ve "Kiminle oynuyorsun?" penceresi Online lobiyle ortak.
import { ModKarti, ModBolumu } from "../components/ModKarti";
import OyunBaslatPenceresi from "../components/OyunBaslat";
import { Forma } from "../components/FormaDeseni";
import BugunKarti from "../components/BugunKarti";
import { ModKaro, ModIzgarasi, BolumBasligi } from "../components/ModKaro";
import { gununModu } from "../lib/gununModu";
import { COLORS, RADIUS, SPACING, TYPE, saydam } from "../lib/theme";
import TabHeader from "../components/TabHeader";
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
    ikon: "ortakKulup",   // Paket 18 — components/ModIkon.js
    grup: "klasik",
    title: _t("Ortak Kulüp"),
    // Paket 31 (Kerem: "tüm modlarda en üstte 3-2-1 Ortak Futbolcu'yu Bul yazsın")
    vitrinAdi: _t("3-2-1 Ortak Futbolcu'yu Bul"),
    desc: _t("İki kulüp söylenir. İkisinde de oynamış futbolcuyu rakibinden önce bul."),
    icon: "shield-checkmark",
    colorKey: "teamTeam",
    id: "cpu",
    // 4 Ekim 2026 (.28743) — "Tek telefon" artık mod değil RAKİP SEÇENEĞİ.
    // Paket 26 — Kulüp × Ülke ve Takımı sen seç doğrudan burada da (kaybolmasınlar).
    options: [
      { id: "cpu", rakip: "cpu", label: _t("Kulüp × Kulüp"), alt: _t("İki kulüpte oynamış futbolcu") },
      { id: "countryTeamCpu", rakip: "cpu", label: _t("Kulüp × Ülke"), alt: _t("O ülkeden, o kulüpte oynamış futbolcu") },
      { id: "draftCpu", rakip: "cpu", label: _t("Takımı sen seç"), alt: _t("Bir kulübü sen yazarsın, ikincisini CPU seçer") },
      { id: "local", rakip: "yanimdaki", label: _t("Yanımdaki — 2 kişi"), kisaLabel: _t("2 kişi"), alt: _t("Ekran ikiye bölünür, ilk basan cevaplar") },
      { id: "sunucu", rakip: "yanimdaki", label: _t("Yanımdakiler — Sunucu modu"), kisaLabel: _t("Sunucu · 2–6 kişi"), alt: _t("Sen kulüpleri okursun, onlar bağırır") },
      // Paket 32 (Kerem: "online'da ülke-takım ve kendin takımı söyle modu yok?") —
      // online'da da üç tür; Kulüp × Ülke online yeni (screens/OnlineUlkeScreen.js).
      { id: "online", rakip: "online", label: _t("Kulüp × Kulüp"), alt: _t("İki kulüp çıkar, ortak futbolcuyu ilk yazan alır"), sekme: true, params: { mod: "classic" } },
      { id: "online", rakip: "online", label: _t("Kulüp × Ülke"), alt: _t("O ülkeden, o kulüpte oynamış futbolcuyu ilk yazan alır"), sekme: true, params: { mod: "country" } },
      { id: "online", rakip: "online", label: _t("Takımı sen seç"), alt: _t("Sırayla takım seçersiniz; seçtiğin takım rakibin sorusu olur"), sekme: true, params: { mod: "draft" } },
    ],
  },
  {
    key: "letters",
    ikon: "ilkHarf",   // Paket 18 — components/ModIkon.js
    grup: "bilgi",
    title: _t("İlk Harf"),
    desc: _t("Verilen baş harflerle başlayan futbolcuyu bul"),
    kisa: _t("Baş harflerden futbolcuyu bul"),
    icon: "text",
    colorKey: "letters",
    id: "letterCpu",
    // Paket 30 — Harf Zinciri ayrı kart değil, İlk Harf'in tek kişilik seçeneği.
    options: [
      { id: "letterCpu", rakip: "cpu", label: _t("CPU'ya karşı"), alt: _t("Harfi gören ilk söyler") },
      { id: "letterZincir", rakip: "tek", label: _t("Harf Zinciri"), alt: _t("Son harften devam et, 3 canla en uzun zincir") },
      { id: "online", rakip: "online", label: _t("Online"), alt: _t("Rastgele rakip ya da oda kodu"), sekme: true, params: { mod: "letter" } },
    ],
  },
  {
    // 4 Ekim 2026 (benchmark .28548) — İlk Harf zincirinin tek kişilik hâli.
    key: "harfZinciri",
    ikon: "harfZinciri",   // Paket 18 — components/ModIkon.js
    grup: "bilgi",
    title: _t("Harf Zinciri"),
    desc: _t("Son harften devam et, 3 canla en uzun zinciri kur"),
    icon: "link",
    colorKey: "letters",
    id: "letterZincir",
  },
  {
    key: "whoAmI",
    ikon: "kimBu",   // Paket 18 — components/ModIkon.js
    grup: "bilgi",
    title: _t("Kim Bu Futbolcu?"),
    desc: _t("Kartları çevir, gizli futbolcuyu bil"),
    kisa: _t("Kartları çevir, gizli futbolcuyu bil"),
    icon: "help-circle",
    colorKey: "whoAmI",
    id: "whoAmICpu",
    // Paket 13 — Kim Bu modları (benchmark): Seri, Kadro Avı, Online düello.
    // Günlük Kim Bu üstteki günlük kutularda.
    options: [
      { id: "whoAmICpu", rakip: "tek", label: _t("Seri"), alt: _t("3 can, seviye seviye zorlaşır") },
      { id: "kadroAvi", rakip: "tek", label: _t("Kadro Avı"), alt: _t("Bir kadronun gizli oyuncusu — bulunca kadroya eklenir") },
      { id: "online", rakip: "online", label: _t("Online"), alt: _t("Aynı masada düello: ilk bilen alır"), sekme: true, params: { mod: "whoami" } },
    ],
  },
  {
    // 4 Ekim 2026 (.28709) — eski "Tek Telefon 2 Kişi" kartının yerine. 2 kişilik
    // bölünmüş ekran artık Ortak Kulüp → "Yanımdaki" seçeneğinde.
    key: "sunucu",
    ikon: "sunucu",   // Paket 18 — components/ModIkon.js
    grup: "arkadas",
    title: _t("Sunucu Modu"),
    desc: _t("2–6 kişi, tek telefon. Sen kulüpleri okursun, onlar bağırır"),
    icon: "mic",
    colorKey: "hotSeat",
    id: "sunucu",
  },
  {
    // 4 Eylül 2026 (Kerem'in yeni mod isteği) — bkz. screens/FiveClubsScreen.js
    key: "fiveClubs",
    ikon: "besKulup",   // Paket 18 — components/ModIkon.js
    grup: "klasik",
    title: _t("5 Kulüp"),
    desc: _t("5 büyük kulüpten kaçında oynadığını bil, en çok puanı topla"),
    kisa: _t("Futbolcu 5 kulübün kaçında oynadı?"),
    icon: "podium",
    colorKey: "fiveClubs",
    // 12 Eylül 2026 (Kerem: "5 kulüp modu aslında cpu'ya karşı da
    // oynanabilmeli") — Ortak Kulüp'le aynı desen: tek kart, dokununca
    // seçenek modalı.
    options: [
      { id: "fiveClubsCpu", rakip: "cpu", label: _t("CPU'ya karşı") },
      { id: "fiveClubs", rakip: "yanimdaki", label: _t("Yanımdaki — 2 kişi"), alt: _t("Aynı telefon, sırayla") },
      // Paket 16 (5 Ekim 2026) — Online 5 Kulüp açıldı: iki oyuncu aynı anda, gizli cevap.
      { id: "online", rakip: "online", label: _t("Online"), alt: _t("Aynı anda gizli cevap, 3 tur"), sekme: true, params: { mod: "five" } },
    ],
  },
  {
    // 12 Eylül 2026 (Kerem: "xox oyunu da eklemek istiyorum. hem vs cpu hem
    // aynı ekranda arkadaşla oynama şekli.") — bkz. screens/XoxScreen.js.
    // Rakip tipi ve zorluk ekranın KENDİ kurulum adımında seçiliyor, bu yüzden
    // burada seçenek modalı yok.
    key: "xox",
    ikon: "xox",   // Paket 18 — components/ModIkon.js
    grup: "klasik",
    title: _t("Futbolcu XOX"),
    desc: _t("3x3 ızgara, kareyi almak için ortak futbolcuyu söyle"),
    kisa: _t("Kareyi kapmak için ortak futbolcuyu söyle"),
    icon: "grid",
    // 26 Eylül 2026 — eskiden "hotSeat" idi; "Tek Telefon 2 Kişi" ile aynı
    // renkteydi ve iki kart ayırt edilemiyordu (bkz. lib/theme.js notu).
    colorKey: "xox",
    id: "xox",
    options: [
      { id: "xox", params: { rakip: "cpu" }, rakip: "cpu", label: _t("CPU'ya karşı") },
      { id: "xox", params: { rakip: "iki" }, rakip: "yanimdaki", label: _t("Yanımdaki — 2 kişi"), alt: _t("Aynı telefon, sırayla") },
      // 5 Ekim 2026 (.29379) — Online XOX açıldı: Online sekmesine XOX seçili gider.
      { id: "online", rakip: "online", label: _t("Online"), alt: _t("Rastgele rakip ya da arkadaşınla kodla"), sekme: true, params: { mod: "xox" } },
    ],
  },
];

// 28 Eylül 2026 — denetim bulgusu #7: "8 eşit ağırlıklı mod kartı, gruplama/öneri
// yok". Kartlar üç başlık altında; en üstte tek dokunuşla oyuna sokan bir
// "Hemen Oyna" kartı (Ortak Kulüp, CPU'ya karşı — ayarlar eşleşme profilinden).
const RAKIP_BASLIK = { cpu: "CPU", yanimdaki: _t("YANIMDAKİLERLE"), online: "ONLINE", tek: _t("TEK BAŞINA") };
const RAKIP_IKON = { cpu: "hardware-chip", yanimdaki: "people", online: "globe", tek: "person" };

// ============================================================================
// Paket 30 (14 Ekim 2026) — TÜM MODLAR BAŞTAN. Kerem: "oyunun tüm modlar sayfası
// halen çok karmaşık görünüyor, oyun basitliği yok … üstteki günlük şeyler
// falan aşırı kalabalık, onlar kesin kalksın"; düzen kararı: "oyun listesi ama
// 3-2-1 ortak kulüp ön planda olacak. diğer modlar ilk bakışta 3-2-1 kadar
// dikkat çekmeyecek"; günlükler "tüm modlar içinde tek satır".
// ESKİ: başlık + 1 büyük + 4 küçük günlük kutu + açık görev kartı + 3 bölüm
// başlığı + 6 eşit kart (+ Sunucu ve Harf Zinciri ayrı kartlar) ≈ 15 öğe.
// YENİ (benchmark: NYT Games tek liste, Chess.com tek dokunuşla oyna,
// Rogue Company "tek büyük oyna + mod değiştir"):
//   1. VİTRİN — 3-2-1 Ortak Kulüp: temanın kulüp rengi, forması, tek OYNA.
//   2. GÜNLÜK — tek satır (5 nokta = bugünkü günlük oyunlar), dokununca pencere.
//   3. DİĞER OYUNLAR — 4 satırlık sakin liste (Kim Bu, 5 Kulüp, XOX, İlk Harf).
// Sunucu modu Ortak Kulüp → "Yanımdakiler"de; Harf Zinciri İlk Harf'in içinde.
// ============================================================================
const VITRIN = MODES.find((m) => m.key === "teamTeam");
const DIGERLERI = ["whoAmI", "fiveClubs", "xox", "letters"].map((k) => MODES.find((m) => m.key === k));

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

  const gunun = gununModu();
  const gunlukAc = (id) => (id === "dailyPuzzle" ? onDailyPuzzle && onDailyPuzzle() : onGunlukOyun && onGunlukOyun(id));

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
        contentContainerStyle={{ paddingBottom: 40 }}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        <View style={styles.baslikSatiri}>
          {onBack ? <BackButton onPress={onBack} /> : null}
          <TabHeader baslik={_t("Tüm Modlar")} style={{ marginBottom: 0 }} />
        </View>

        <Vitrin mod={VITRIN} onPress={() => handleCardPress(VITRIN)} />

        {/* Paket 34 (Kerem: "oynamaya yönlendirsin … challenge'larla o modlara") —
            BUGÜN kartı: günün modu (2× XP) · görevler (her biri OYNA) · günlük meydan okumalar */}
        <BugunKarti
          onGununModu={(gm) => { const m = MODES.find((x) => x.key === gm.modKey); if (m) handleCardPress(m); }}
          onGorev={(g, gm) => {
            if (g.git.rota) { handleSelect(g.git.rota, g.git.params); return; }
            const m = MODES.find((x) => x.key === gm.modKey); if (m) handleCardPress(m);
          }}
          onGunlukOyun={gunlukAc}
        />

        {/* Paket 34 — modlar liste satırı değil OYUN KAROSU (components/ModKaro.js) */}
        <BolumBasligi>{_t("Modlar")}</BolumBasligi>
        <ModIzgarasi>
          {DIGERLERI.map((m) => (
            <ModKaro key={m.key} ikon={m.ikon} icon={m.icon} baslik={m.title} alt={m.kisa || m.desc} gunun={m.key === gunun.modKey} onPress={() => handleCardPress(m)} />
          ))}
        </ModIzgarasi>
      </Animated.ScrollView>

      {/* Paket 31 — "Kiminle? · Nasıl? · BAŞLA" alt sayfası (components/OyunBaslat.js) */}
      <OyunBaslatPenceresi
        mod={pickerMode}
        onClose={() => setPickerMode(null)}
        onBasla={(opt, eylem) => {
          // Online: pencereden doğrudan "Rastgele rakip" / "Oda kur" / "Kodla katıl" — lobi o adımı açar.
          if (opt.sekme) { setPickerMode(null); onSekme && onSekme(opt.id, { ...(opt.params || {}), eylem: eylem || null, t: Date.now() }); return; }
          handleSelect(opt.id, opt.params);
        }}
      />
    </GameBackground>
  );
}

// Paket 30 — 3-2-1 Ortak Kulüp vitrini: ekranın TEK renkli büyük alanı.
// Zemin temanın kulüp rengi (GS kırmızısı, FB laciverti…), sağda kulübün forması,
// tek eylem: OYNA (temanın eylem rengi; GS'de sarı üstüne kırmızı yazı).
function Vitrin({ mod, onPress }) {
  return (
    <PressScale style={styles.vitrin} onPress={onPress} accessibilityRole="button" accessibilityLabel={_t("3-2-1 Ortak Futbolcu'yu Bul, oyna")}>
      <LinearGradient
        colors={[saydam("#FFFFFF", 0.12), saydam("#FFFFFF", 0), saydam("#000000", 0.32)]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Paket 35 (Kerem: "forma fazla mı oldu? sanki direkt galatasaray çıkacakmış gibi.
          forma göz önünde olmasa, azcığı gözükse ve biraz da şeffaf olsa") — forma artık
          köşeden taşan, yarı saydam bir filigran: kimlik hissi kalıyor, "GS sorusu" demiyor. */}
      <Forma boyut={190} style={styles.vitrinForma} />
      <View style={styles.vitrinIc}>
        {/* Paket 31 (Kerem: "en üstte 3-2-1 Ortak Futbolcu'yu Bul yazsın") — başlık tam
            genişlikte iki satır; forma sağ altta, açıklama ve düğmenin yanında. */}
        <Text style={styles.vitrinBaslik}>
          <Text style={{ color: COLORS.marka2 }}>3-2-1 </Text>{_t("Ortak")}{"\n"}{_t("Futbolcu'yu Bul")}</Text>
        <Text style={styles.vitrinAciklama}>{mod.desc}</Text>
        <View style={styles.oyna}>
          <Ionicons name="play" size={18} color={COLORS.markaDugmeYazi} />
          <Text style={styles.oynaYazi}>{_t("OYNA")}</Text>
        </View>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  // 12 Eylül 2026: paddingTop 50 SPACING ölçeğinde olmayan bir değerdi;
  // marka bloğu compact'e çekildiği için üst boşluk da ölçeğe döndü.
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: SPACING.xxl },
  baslikSatiri: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg, gap: SPACING.sm },
  sayfaBaslik: { ...TYPE.h1 },

  vitrin: {
    marginHorizontal: SPACING.xl, borderRadius: RADIUS.xl, overflow: "hidden",
    backgroundColor: COLORS.marka, minHeight: 216,
    borderWidth: 1, borderColor: saydam(COLORS.markaUst, 0.14),
  },
  vitrinForma: { position: "absolute", right: -78, bottom: -64, opacity: 0.22, transform: [{ rotate: "16deg" }] },
  vitrinIc: { padding: SPACING.xl, gap: 6 },
  vitrinUst: { color: COLORS.marka2, fontWeight: "900", fontSize: 12, letterSpacing: 2 },
  vitrinBaslik: { color: COLORS.markaUst, fontWeight: "900", fontSize: 30, lineHeight: 34, letterSpacing: -0.5, marginBottom: 2 },
  vitrinAciklama: { color: COLORS.markaUst, opacity: 0.86, fontWeight: "600", fontSize: 14, lineHeight: 20, marginRight: 64 },
  oyna: {
    marginTop: SPACING.md, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.markaDugme, borderRadius: RADIUS.pill, paddingVertical: 12, paddingHorizontal: 26,
  },
  oynaYazi: { color: COLORS.markaDugmeYazi, fontWeight: "900", fontSize: 16, letterSpacing: 1 },

  gunluk: { marginHorizontal: SPACING.xl, marginTop: SPACING.lg, marginBottom: SPACING.xl },
});
