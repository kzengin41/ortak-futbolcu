import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// .env dosyasına EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY koy
// (bkz. README.md — Supabase projesi kurulunca bu ikisi panelden alınır)
// NOT: .env yoksa/boşsa placeholder değerlerle devam ediyoruz ki Yerel ve
// CPU modları Supabase kurulmadan da çökmeden çalışsın. Gerçek online mod
// denenmeden bu satırların hiçbir zararı olmaz.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// MVP için tam auth akışı yok — her cihaza kalıcı bir anonim id atıyoruz,
// oda içindeki "ben kimim" ayrımı bununla yapılıyor. İleride Supabase Auth
// (anonymous sign-in) ile değiştirilebilir.
// 4 Eylül 2026 (Kerem ekran görüntüsü: "Uncaught (in promise): Error:
// crypto.getRandomValues() not supported" — uuid paketinin GitHub linkiyle
// birlikte) — KÖK NEDEN: `uuid` v9, standart Web Crypto API'sindeki
// `crypto.getRandomValues()`'a ihtiyaç duyuyor; React Native'de bu API
// YOK (normalde `react-native-get-random-values` polyfill'i uuid'den ÖNCE
// import edilmeli, ama o paket projede kurulu değil). Sonuç: cihaz kimliği
// üretilirken yakalanmamış bir promise hatası fırlıyordu.
// ÇÖZÜM: Yeni bir paket kurmak yerine uuid bağımlılığı tamamen kaldırıldı.
// Bu kimlik SADECE "oda içinde ben kimim" ayrımı için kullanılıyor —
// kriptografik güvenlik gerektirmiyor, sadece çakışmaması yeterli. Zaman
// damgası + iki rastgele parça bunun için fazlasıyla yeterli ve cihazda
// AsyncStorage'a bir kez yazılıp kalıcı olarak saklanıyor.
function makeDeviceId() {
  const rand = () => Math.random().toString(36).slice(2, 12);
  return `dev-${Date.now().toString(36)}-${rand()}-${rand()}`;
}

export async function getDeviceId() {
  const key = "ortak-futbolcu-device-id";
  let id = await AsyncStorage.getItem(key);
  if (!id) {
    id = makeDeviceId();
    await AsyncStorage.setItem(key, id);
  }
  return id;
}
