// ============================================================================
// AKŞAM HATIRLATMASI — 12 Eylül 2026
//
// Günün Bulmacası ve günlük görevler ancak kullanıcı uygulamayı AÇARSA işe
// yarıyor. Tek bir yerel bildirim (sunucu yok, push altyapısı yok, hesap
// gerekmiyor) bu döngüyü kapatıyor.
//
// SAVUNMACI YÜKLEME: expo-notifications projede henüz kurulu olmayabilir
// (`npx expo install expo-notifications`). Kurulu değilken import etmek
// uygulamayı AÇILIŞTA çökertirdi, o yüzden modül tembel ve try/catch içinde
// yükleniyor; yoksa bütün fonksiyonlar sessizce "desteklenmiyor" diyor.
// Ayrıca Expo Go'da yerel bildirimler SDK 53'ten beri sınırlı — gerçek
// davranış için preview/production build gerekiyor.
// ============================================================================
import { Platform } from "react-native";

export const HATIRLATMA_SAATI = 20;    // 20:00
export const HATIRLATMA_DAKIKA = 0;
const TANIMLAYICI = "gunluk-hatirlatma";

let _modul;
let _denendi = false;

function bildirimModulu() {
  if (_denendi) return _modul;
  _denendi = true;
  try {
    // eslint-disable-next-line global-require
    _modul = require("expo-notifications");
    _modul.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    _modul = null;
  }
  return _modul;
}

export function bildirimDesteginVarMi() {
  return Boolean(bildirimModulu());
}

// İzin ister. Android 13+ için POST_NOTIFICATIONS ayrı bir çalışma zamanı
// izni; expo-notifications bunu requestPermissionsAsync içinde hallediyor.
export async function izinIste() {
  const N = bildirimModulu();
  if (!N) return false;
  try {
    const mevcut = await N.getPermissionsAsync();
    if (mevcut.granted) return true;
    if (!mevcut.canAskAgain) return false;
    const sonuc = await N.requestPermissionsAsync();
    return Boolean(sonuc.granted);
  } catch (e) {
    return false;
  }
}

const METINLER = [
  { title: "Günün bulmacası seni bekliyor", body: "Bugünün ikilisini bilebilecek misin?" },
  { title: "Bugün hiç oynamadın", body: "Bir tur at, serini kaybetme." },
  { title: "Günlük görevlerin duruyor", body: "Üçünü de bitirip ödülü al." },
];

export async function hatirlatmayiKur() {
  const N = bildirimModulu();
  if (!N) return false;
  const izin = await izinIste();
  if (!izin) return false;

  try {
    await hatirlatmayiKaldir();
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("gunluk", {
        name: "Günlük hatırlatma",
        importance: N.AndroidImportance.DEFAULT,
      });
    }
    // Her gün aynı saatte tekrarlayan tek bildirim. Metin kurulum anında
    // seçiliyor — tekrarlayan bir tetikleyicide her sefer farklı metin
    // üretmenin yolu yok, ama kullanıcı açıp kapattıkça değişiyor.
    const metin = METINLER[Math.floor(Math.random() * METINLER.length)];
    await N.scheduleNotificationAsync({
      identifier: TANIMLAYICI,
      content: { ...metin, data: { tip: "gunluk" } },
      trigger: {
        type: N.SchedulableTriggerInputTypes?.DAILY ?? "daily",
        hour: HATIRLATMA_SAATI,
        minute: HATIRLATMA_DAKIKA,
        channelId: "gunluk",
      },
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function hatirlatmayiKaldir() {
  const N = bildirimModulu();
  if (!N) return false;
  try {
    await N.cancelScheduledNotificationAsync(TANIMLAYICI);
  } catch (e) {
    // Kayıtlı değilse hata verebiliyor — sorun değil.
  }
  return true;
}

export async function hatirlatmaKuruluMu() {
  const N = bildirimModulu();
  if (!N) return false;
  try {
    const liste = await N.getAllScheduledNotificationsAsync();
    return liste.some((b) => b.identifier === TANIMLAYICI);
  } catch (e) {
    return false;
  }
}
