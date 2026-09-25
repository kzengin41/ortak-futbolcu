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
import { v4 as uuidv4 } from "uuid";

export async function getDeviceId() {
  const key = "ortak-futbolcu-device-id";
  let id = await AsyncStorage.getItem(key);
  if (!id) {
    id = uuidv4();
    await AsyncStorage.setItem(key, id);
  }
  return id;
}
