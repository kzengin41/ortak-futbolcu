import React, { useState, useEffect, useRef } from "react";
import { StatusBar, BackHandler, Platform, Alert, View, Text, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { NavigationContainer, CommonActions, useNavigation, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
// Çökme raporlama (Sentry) — ekranlardan ÖNCE yüklensin ki açılıştaki hatalar da yakalansın.
import { Sentry, hataRaporla } from "./lib/hataRaporu";

// --- Hafif ekranlar: doğrudan (statik) import edilir, açılışta hemen gerekir. ---
import OynaScreen from "./screens/OynaScreen";
import AnaSayfaScreen from "./screens/AnaSayfaScreen";
import ProfilimScreen from "./screens/ProfilimScreen";
import HelpScreen from "./screens/HelpScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import SettingsScreen from "./screens/SettingsScreen";
import StatsScreen from "./screens/StatsScreen";
import AccountScreen from "./screens/AccountScreen";
import OnlineLobbyScreen from "./screens/OnlineLobbyScreen";
import OnlineDuelScreen from "./screens/OnlineDuelScreen";
import OnlineWhoAmIScreen from "./screens/OnlineWhoAmIScreen";
import OnlineDraftScreen from "./screens/OnlineDraftScreen";

// --- Ağır ekranlar: BİLEREK statik import edilmiyor. ---
// Bu ekranlar (ve zincirleme olarak lib/gameEngine.js, lib/clubWeights.js) toplamda
// ~19MB'lık futbolcu/kulüp JSON verisini (players.json 9.6MB, playerBirthPosition.json
// 2.7MB, playerPhotos.json 2.9MB, clubs.js 1.8MB, playerPopularity.json ~1MB, vb.)
// modül yüklenirken belleğe okuyup parse ediyor. Bunlar App.js'in en üstünde normal
// `import` ile bağlanırsa, JS motoru bu ~19MB'ı kullanıcı daha ana menüyü GÖRMEDEN,
// her uygulama açılışında parse eder — açılış (splash) süresini gereksiz uzatır.
// Aşağıdaki Stack.Screen tanımlarında `getComponent={() => require(...)}` kullanılarak
// bu modüller sadece kullanıcı o oyun moduna GERÇEKTEN girdiğinde yüklenir
// (React Navigation'ın resmi "lazy screen" deseni). Ana menü, ayarlar, yardım ve
// online lobi bundan etkilenmez, hep hızlı açılır. Bu yüzden BURADA static import
// YOK — hepsi aşağıda getXRoute() fonksiyonları içinde require() ile çağrılıyor.
// İSTİSNA: Ansiklopedi (PlayerProfileScreen) — bu da aynı ~19MB'lık veriye bağlı ama
// artık kendi sekmesi olduğu için (30 Ağustos 2026 alt menü geçişi) getComponent
// deseniyle bir Tab.Screen içinde tanımlanıyor, aşağıda bkz. getAnsiklopediRoute.
import { useWhistleSound, useBackgroundAmbience, useTapKickSound } from "./lib/useGameSounds";
import { SettingsProvider } from "./lib/SettingsContext";
import ModeGuide, { ModeGuideButton, useModeGuide } from "./components/ModeGuide";
import UnlockToast from "./components/UnlockToast";
import { COLORS } from "./lib/theme";

const ONBOARDING_KEY = "ortak-futbolcu-onboarding-done";

// Bu ekranlarda hardware-back basınca onay istemeden direkt ana menüye dönülür.
// Not: 4 sekme (oyna/online/ansiklopedi/profilim) hepsi "ana menü seviyesi" —
// hiçbirinde kaybedilecek bir oyun ilerlemesi yok, o yüzden hepsi burada.
const NO_CONFIRM_ROUTES = new Set(["oyna", "tumModlar", "online", "ansiklopedi", "profilim", "onboarding", "settings", "help", "stats", "account", "sources"]);
// Bu isimlerde hardware-back'e basınca (uygulamanın en üst seviyesindeyken)
// varsayılan davranış uygulanır (Android'de genelde uygulamadan çıkış).
const APP_EXIT_ROUTES = new Set(["oyna", "tumModlar", "online", "ansiklopedi", "profilim", "onboarding"]);

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function goHome(navigation) {
  navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "mainTabs" }] }));
}

// Tek, merkezi çıkış onayı. Ekranın içindeki "✕ Bitir", "Menüye Dön" ya da
// BackButton'dan hangisi çağırırsa çağırsın — hepsi bu fonksiyona bağlanır,
// böylece "bazı butonlar soruyor bazıları sormuyor" tutarsızlığı ortadan kalkar.
function confirmedExit(navigation) {
  Alert.alert(
    "Çıkış",
    "Ana menüye dönmek istediğinize emin misiniz? İlerlemeniz kaybolacak.",
    [
      { text: "Hayır", style: "cancel" },
      { text: "Evet", style: "destructive", onPress: () => goHome(navigation) },
    ]
  );
}

// --- Route sarmalayıcıları: mevcut ekranlar onSelect/onBack/onExit prop'u bekliyor,
// bunları navigation eylemlerine bağlıyoruz. Ekran dosyalarının kendisine dokunmadık.

// 30 Ağustos 2026: Ana menü artık tek bir "home" ekranı değil, 4 sekmeli bir alt
// menü (bottom tab) — Kerem'in isteği: "her şeyi ana sayfaya doldurmak yerine"
// Online ve Ansiklopedi kendi sekmelerine, Profilim (XP/seviye/seri + Ayarlar +
// Nasıl Oynanır) yeni bir sekmeye taşındı. "Oyna" sekmesinde sadece 6 offline
// oyun modu kalıyor.
// 3 Ekim 2026 — "Oyna" sekmesi artık YENİ ANA SAYFA (screens/AnaSayfaScreen.js,
// tasarım kartı 1A). OYNA: Ortak Kulüp, kurulum ekranı atlanır, ilk tur
// vitrindeki gizli kulüp çifti. Eski mod ızgarası "Tüm Modlar" sayfası oldu.
function OynaRoute({ navigation }) {
  return (
    <AnaSayfaScreen
      onPlay={(cift) => navigation.navigate("cpu", { hemenBasla: true, ilkCift: cift || null })}
      onCustomize={() => navigation.navigate("cpu")}
      onAllModes={() => navigation.navigate("tumModlar")}
      onDailyPuzzle={() => navigation.navigate("dailyPuzzle")}
    />
  );
}

// 3 Ekim 2026 (Kerem: "tüm modlar altta ayrı bir sayfa olarak da erişilebilsin")
// — artık alt menüde kendi sekmesi; ana sayfadaki buton da bu sekmeye götürür.
function TumModlarRoute({ navigation }) {
  return (
    <OynaScreen
      onSelect={(mode) => navigation.navigate(mode)}
      onDailyPuzzle={() => navigation.navigate("dailyPuzzle")}
    />
  );
}

// Günün Bulmacası — 12 Eylül 2026. Ağır veri işini (uygun kulüp ikilisi
// listesi) ilk açılışta yapıyor, bu yüzden diğer oyun ekranları gibi
// getComponent ile TEMBEL yükleniyor: ana ekranın açılışına yük binmiyor.
function getDailyPuzzleRoute() {
  const Screen = require("./screens/DailyPuzzleScreen").default;
  return function DailyPuzzleRoute({ navigation }) {
    return <Screen onExit={() => navigation.goBack()} />;
  };
}

function ProfilimRoute({ navigation }) {
  return (
    <ProfilimScreen
      onSettings={() => navigation.navigate("settings")}
      onHelp={() => navigation.navigate("help")}
      onStats={() => navigation.navigate("stats")}
      onAccount={() => navigation.navigate("account")}
    />
  );
}

// Ansiklopedi de ağır bir ekran (bkz. yukarıdaki not) — sekme içinde bile olsa
// getComponent deseniyle tembel yükleniyor, tab bar'ın kendisi hemen açılır.
function getAnsiklopediRoute() {
  const Screen = require("./screens/PlayerProfileScreen").default;
  return Screen;
}

function OnboardingRoute({ navigation }) {
  return (
    <OnboardingScreen
      onDone={() => {
        AsyncStorage.setItem(ONBOARDING_KEY, "1").catch(() => {});
        goHome(navigation);
      }}
    />
  );
}

function SettingsRoute({ navigation }) {
  return <SettingsScreen onBack={() => navigation.goBack()} />;
}

function HelpRoute({ navigation }) {
  return (
    <HelpScreen
      onBack={() => navigation.goBack()}
      onSources={() => navigation.navigate("sources")}
    />
  );
}

// 12 Eylül 2026 — içerik kaynakları / kaldırma talebi ekranı. Yardım
// ekranının altından açılıyor; gizlilik politikası da buraya işaret ediyor.
function SourcesRoute({ navigation }) {
  const Screen = require("./screens/SourcesScreen").default;
  return <Screen onBack={() => navigation.goBack()} />;
}

function StatsRoute({ navigation }) {
  return <StatsScreen onBack={() => navigation.goBack()} />;
}

function AccountRoute({ navigation }) {
  return <AccountScreen onBack={() => navigation.goBack()} />;
}

// confirm=true (varsayılan): ekran bir oyun turu/ilerleme içerir, çıkışta sorar.
// confirm=false: sadece göz atma/kurulum ekranı, kaybedecek bir şey yok.
// NOT: Screen burada zaten ÇÖZÜLMÜŞ (require edilmiş) bir component olarak gelir —
// gecikmeli yükleme sorumluluğu withExit'te değil, bunu çağıran getComponent'te.
function withExit(Screen, { confirm = true, mod = null, ekstraProps = null } = {}) {
  return function Wrapped({ navigation, route }) {
    const handleExit = () => (confirm ? confirmedExit(navigation) : goHome(navigation));
    // 11 Eylül 2026 — mod rehberi (bkz. components/ModeGuide.js). Merkezî
    // olarak burada: 12 oyun ekranını tek tek değiştirmek yerine tek yer.
    const rehber = useModeGuide(mod);
    // 31 Ağustos 2026 (Kerem: "oyun bitti ekranında geri butonuna basınca
    // uyarı çıkıyor. çıkmasına gerek yok ki.") — oyun zaten bittiyse
    // (galibiyet sınırına ulaşıldı, "Tekrar Oyna"/"Menüye Dön" ekranı)
    // kaybedecek ilerleme yok, bu yüzden onaysız çıkış için ayrı bir prop.
    // Normal onExit (confirm'lü) hâlâ oyun İÇİNDEYKEN kullanılmaya devam
    // ediyor.
    return (
      <View style={{ flex: 1 }}>
        {/* 3 Ekim 2026: rota parametreleri de ekrana geçiyor (ana sayfadaki OYNA →
            Ortak Kulüp'e hemenBasla + ilkCift). */}
        <Screen onExit={handleExit} onExitSilent={() => goHome(navigation)} {...(ekstraProps || {})} {...(route?.params || {})} />
        {rehber.varMi && <ModeGuideButton onPress={rehber.ac} />}
        {rehber.varMi && (
          <ModeGuide mod={mod} gorunur={rehber.gorunur} onClose={rehber.kapat} />
        )}
      </View>
    );
  };
}

// Ağır ekranlar: getComponent içindeki require() ilk navigasyona kadar ÇALIŞMAZ.
// (React Navigation resmi lazy-screen deseni: component yerine getComponent.)
const getLocalRoute = () => withExit(require("./screens/LocalGameScreen").default, { mod: "local" });
const getCpuRoute = () => withExit(require("./screens/CpuGameScreen").default, { mod: "cpu" });
const getQuickCpuRoute = () => withExit(require("./screens/QuickGameCpuScreen").default, { mod: "quickCpu" });
const getDraftCpuRoute = () => withExit(require("./screens/DraftGameCpuScreen").default, { mod: "draftCpu" });
const getCountryTeamCpuRoute = () => withExit(require("./screens/CountryTeamCpuScreen").default, { mod: "countryTeamCpu" });
const getWhoAmICpuRoute = () => withExit(require("./screens/WhoAmICpuScreen").default, { mod: "whoAmICpu" });
const getLetterCpuRoute = () => withExit(require("./screens/LetterCpuScreen").default, { mod: "letterCpu" });
const getFiveClubsRoute = () => withExit(require("./screens/FiveClubsScreen").default, { mod: "fiveClubs" });
// 12 Eylül 2026 — 5 Kulüp'ün CPU'ya karşı hâli. Aynı ekran, tek fark vsCpu.
const getFiveClubsCpuRoute = () => withExit(require("./screens/FiveClubsScreen").default, { mod: "fiveClubsCpu", ekstraProps: { vsCpu: true } });
// 12 Eylül 2026 — Futbolcu XOX. Rakip tipi (CPU / 2 kişi) ve zorluk ekranın
// kendi kurulum adımında seçildiği için tek rota yetiyor.
const getXoxRoute = () => withExit(require("./screens/XoxScreen").default, { mod: "xox" });

// Online sekmesi: doğrudan lobi ekranını gösterir (artık ayrı bir "onlineLobby"
// stack rotası değil, sekmenin kendisi). Bir oda hazır olduğunda ROOT stack'teki
// ilgili maç ekranına navigate ediliyor — nested navigator'dan üst stack'e
// navigate etmek React Navigation'da otomatik olarak yukarı doğru aranır.
function OnlineRoute({ navigation }) {
  return (
    <OnlineLobbyScreen
      onRoomReady={(room) => {
        const target =
          room.gameMode === "whoami" ? "onlineWhoAmI" :
          room.gameMode === "draft" ? "onlineDraft" :
          // 12 Eylül 2026: "letter2" burada hiç yoktu — o modu seçen oyuncu
          // varsayılana düşüp TAMAMEN FARKLI bir oyuna (Düello) gidiyordu.
          (room.gameMode === "letter" || room.gameMode === "letter2") ? "onlineLetter" : "onlineDuel";
        navigation.navigate(target, { room });
      }}
    />
  );
}

// 11 Eylül 2026 — online maç ekranları withExit'ten geçmiyor (oda parametresi
// alıyorlar ve çıkış her zaman onaylı), bu yüzden mod rehberi onlara ayrı bir
// sarmalayıcıyla ekleniyor. Rehberin kendisi ve "görüldü" kaydı aynı yerden
// geliyor, davranış offline modlarla birebir aynı.
function RehberliOyun({ mod, children }) {
  const rehber = useModeGuide(mod);
  return (
    <View style={{ flex: 1 }}>
      {children}
      {rehber.varMi && <ModeGuideButton onPress={rehber.ac} />}
      {rehber.varMi && <ModeGuide mod={mod} gorunur={rehber.gorunur} onClose={rehber.kapat} />}
    </View>
  );
}

// Online maç ekranları: aktif maçtan çıkmak rakibi de yarıda bırakır, mutlaka sor.
function OnlineDuelRoute({ navigation, route }) {
  return (
    <RehberliOyun mod="onlineDuel">
      <OnlineDuelScreen room={route.params?.room} onExit={() => confirmedExit(navigation)} />
    </RehberliOyun>
  );
}
function OnlineWhoAmIRoute({ navigation, route }) {
  return (
    <RehberliOyun mod="onlineWhoAmI">
      <OnlineWhoAmIScreen room={route.params?.room} onExit={() => confirmedExit(navigation)} />
    </RehberliOyun>
  );
}
function OnlineDraftRoute({ navigation, route }) {
  return (
    <RehberliOyun mod="onlineDraft">
      <OnlineDraftScreen room={route.params?.room} onExit={() => confirmedExit(navigation)} />
    </RehberliOyun>
  );
}
function getOnlineLetterRoute() {
  const Screen = require("./screens/OnlineLetterScreen").default;
  return function OnlineLetterRoute({ navigation, route }) {
    return (
      <RehberliOyun mod="onlineLetter">
        <Screen room={route.params?.room} onExit={() => confirmedExit(navigation)} />
      </RehberliOyun>
    );
  };
}

const TAB_ICONS = {
  oyna: "home",
  tumModlar: "grid",
  online: "flame",
  ansiklopedi: "book",
  profilim: "person-circle",
};

// Ana alt menü (bottom tab) — 30 Ağustos 2026'da HomeScreen'in tek ekranda
// büyümesi üzerine eklendi. 4 sekme: Oyna (offline modlar), Online, Ansiklopedi
// (Kariyer İncele), Profilim (XP/seviye/seri + Ayarlar + Nasıl Oynanır).
function MainTabsRoute() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: { backgroundColor: COLORS.card, borderTopColor: COLORS.cardBorder, borderTopWidth: 1 },
        tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="oyna" component={OynaRoute} options={{ title: "Ana Sayfa" }} />
      <Tab.Screen name="tumModlar" component={TumModlarRoute} options={{ title: "Tüm Modlar" }} />
      <Tab.Screen name="online" component={OnlineRoute} options={{ title: "Online" }} />
      <Tab.Screen name="ansiklopedi" getComponent={getAnsiklopediRoute} options={{ title: "Ansiklopedi" }} />
      <Tab.Screen name="profilim" component={ProfilimRoute} options={{ title: "Profilim" }} />
    </Tab.Navigator>
  );
}

// Hardware back tuşu: oyun ekranlarında "Ana menüye dönmek istediğine emin misin?"
// diye sorar; sekme/ayarlar/yardım/onboarding'de direkt varsayılan davranış
// (uygulamadan çık) uygulanır (sürtünme yaratmaz).
function useHardwareBackConfirm(navRef) {
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const currentName = navRef.current?.getCurrentRoute()?.name;
      if (!currentName || APP_EXIT_ROUTES.has(currentName)) {
        return false; // varsayılan davranış (uygulamadan çık)
      }
      if (NO_CONFIRM_ROUTES.has(currentName)) {
        // 12 Eylül 2026 — DONANIM GERİ TUŞU İLE EKRANDAKİ BUTON AYRI YERLERE
        // GİDİYORDU. Burada koşulsuz goHome() çağrılıyordu; goHome mainTabs'ı
        // SIFIRLADIĞI için kullanıcı ilk sekmede (Oyna) buluyordu kendini.
        // Oysa aynı ekrandaki geri butonu navigation.goBack() ile Profilim'e
        // dönüyordu. Aynı ekran, aynı niyet, iki farklı sonuç.
        // Artık geri gidilebilecek bir ekran varsa normal geri davranışı
        // uygulanıyor; yoksa (yığının dibindeysek) ana sekmelere dönülüyor.
        if (navRef.current?.canGoBack?.()) {
          navRef.current.goBack();
        } else {
          goHome(navRef.current);
        }
        return true;
      }
      confirmedExit(navRef.current);
      return true;
    });
    return () => sub.remove();
  }, [navRef]);
}

function RootNavigator({ initialRouteName }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="onboarding" component={OnboardingRoute} options={{ animation: "fade" }} />
      <Stack.Screen name="mainTabs" component={MainTabsRoute} />
      <Stack.Screen name="settings" component={SettingsRoute} />
      <Stack.Screen name="help" component={HelpRoute} />
      <Stack.Screen name="sources" component={SourcesRoute} />
      <Stack.Screen name="stats" component={StatsRoute} />
      <Stack.Screen name="account" component={AccountRoute} />
      <Stack.Screen name="local" getComponent={getLocalRoute} />
      <Stack.Screen name="cpu" getComponent={getCpuRoute} />
      <Stack.Screen name="quickCpu" getComponent={getQuickCpuRoute} />
      <Stack.Screen name="draftCpu" getComponent={getDraftCpuRoute} />
      <Stack.Screen name="countryTeamCpu" getComponent={getCountryTeamCpuRoute} />
      <Stack.Screen name="whoAmICpu" getComponent={getWhoAmICpuRoute} />
      <Stack.Screen name="letterCpu" getComponent={getLetterCpuRoute} />
      <Stack.Screen name="fiveClubs" getComponent={getFiveClubsRoute} />
      <Stack.Screen name="fiveClubsCpu" getComponent={getFiveClubsCpuRoute} />
      <Stack.Screen name="onlineDuel" component={OnlineDuelRoute} />
      <Stack.Screen name="onlineWhoAmI" component={OnlineWhoAmIRoute} />
      <Stack.Screen name="onlineDraft" component={OnlineDraftRoute} />
      <Stack.Screen name="onlineLetter" getComponent={getOnlineLetterRoute} />
      <Stack.Screen name="dailyPuzzle" getComponent={getDailyPuzzleRoute} />
      <Stack.Screen name="xox" getComponent={getXoxRoute} />
    </Stack.Navigator>
  );
}

function AppContent() {
  const [initialRouteName, setInitialRouteName] = useState(null);
  const navRef = useNavigationContainerRef();
  const playWhistle = useWhistleSound();
  useBackgroundAmbience(); // arka planda durmadan çalan tribün sesi — ayar açıkken otomatik başlar

  useHardwareBackConfirm(navRef);

  useEffect(() => {
    // 12 Eylül 2026: .catch() yoktu. AsyncStorage hata verirse initialRouteName
    // sonsuza kadar null kalıyor ve uygulama aşağıdaki boş ekranda KALICI
    // OLARAK donuyordu. Artık hata durumunda onboarding ile açılıyor.
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((val) => setInitialRouteName(val ? "mainTabs" : "onboarding"))
      .catch(() => setInitialRouteName("onboarding"));
    playWhistle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!initialRouteName) {
    // Onboarding durumu AsyncStorage'dan okunana kadar boş bir yeşil ekran —
    // yanlış ekranla açılıp hemen zıplamaktan (flicker) iyidir.
    return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />;
  }

  return (
    <NavigationContainer ref={navRef}>
      <RootNavigator initialRouteName={initialRouteName} />
    </NavigationContainer>
  );
}

// 11 Eylül 2026 — EKRANIN HER YERİNDE TOPA VURUŞ SESİ.
//
// `onStartShouldSetResponderCapture` her dokunuşta, DAHA dokunuş herhangi bir
// çocuğa ulaşmadan çağrılıyor; `false` döndürdüğümüz için dokunuşu ELE
// GEÇİRMİYORUZ — butonlar, kaydırma, metin alanları hepsi normal çalışmaya
// devam ediyor, biz sadece "dokunuldu" bilgisini duyuyoruz. Bu sayede boş bir
// alana üst üste dokununca da ses çıkıyor (Kerem'in istediği: "canı isterse
// boş bir yere sürekli tıklayarak topa vurma sesi çıkartsın").
function DokunmaSesiKatmani({ children }) {
  const vur = useTapKickSound();
  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        vur();
        return false;
      }}
    >
      {children}
    </View>
  );
}

// 12 Eylül 2026 — GLOBAL HATA SINIRI.
// Projede hiçbir ErrorBoundary yoktu: herhangi bir ekrandaki tek bir render
// hatası kullanıcıya BEYAZ EKRAN olarak yansıyor, uygulamayı kapatıp açmaktan
// başka çare bırakmıyordu. React'te hata sınırı yalnızca sınıf bileşeniyle
// kurulabiliyor, o yüzden burası class.
class HataSiniri extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hata: null };
  }
  static getDerivedStateFromError(hata) {
    return { hata };
  }
  componentDidCatch(hata, bilgi) {
    console.log("Beklenmeyen hata:", hata, bilgi?.componentStack);
    hataRaporla(hata, bilgi);
  }
  render() {
    if (!this.state.hata) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 28 }}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
        <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 16, textAlign: "center" }}>
          Bir şeyler ters gitti
        </Text>
        <Text style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20 }}>
          Beklenmedik bir hata oluştu. Ana menüye dönüp tekrar deneyebilirsin.
        </Text>
        <Pressable
          onPress={() => this.setState({ hata: null })}
          style={{ backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, marginTop: 24 }}
        >
          <Text style={{ color: COLORS.accentDark, fontWeight: "900", fontSize: 15, letterSpacing: 0.5 }}>
            TEKRAR DENE
          </Text>
        </Pressable>
      </View>
    );
  }
}

function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        {/* 4 Eylül 2026 (Kerem: "neden arkaplan, kapat butonu vs en sağa kadar
            gitmiyor?") — KÖK NEDEN: bazı Android/MIUI cihazlarında
            react-native-safe-area-context, gerçekte 0 olması gereken SOL/SAĞ
            safe-area inset'i için YANLIŞLIKLA sıfırdan büyük bir değer
            bildiriyor (bilinen bir kütüphane/cihaz tuhaflığı) — bu da TÜM
            uygulamada (Ayarlar ekranındaki eski "sağ kenar şeridi" şikayeti
            dahil) sağ (ve bazen sol) kenarda ince bir boşluk/şerit olarak
            görünüyordu. Dikey (üst) safe-area GERÇEKTEN gerekli (çentik/saat
            dilimi çubuğu için) ama YATAY (sol/sağ) inset portre modda hiçbir
            telefonda anlamlı bir değer taşımıyor — bu yüzden edges'ten
            kaldırıldı, olası hatalı değer artık HİÇ uygulanmıyor. */}
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={["top"]}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
          <HataSiniri>
            <DokunmaSesiKatmani>
              <AppContent />
              {/* 12 Eylül 2026 — yeni futbolcu açılışı bildirimi. Tek yerde
                  monte; oyun ekranlarının haberi olmasına gerek yok. */}
              <UnlockToast />
            </DokunmaSesiKatmani>
          </HataSiniri>
        </SafeAreaView>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

// Sentry.wrap: kök bileşeni sarar (dokunma kırıntıları, yakalanmamış render hataları).
export default Sentry.wrap(App);
