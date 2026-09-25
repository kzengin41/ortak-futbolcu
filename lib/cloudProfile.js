import * as FileSystem from "expo-file-system";
import { supabase } from "./supabaseClient";
import { getProfile, overwriteXpLevel } from "./profile";
import { getUnlockedPlayers, overwriteUnlockedPlayers } from "./pokedex";
import { getStats, overwriteStats, totalRoundsPlayed } from "./stats";

// Faz 5 (31 Ağustos 2026) — cihaz-local ilerleme (lib/profile.js, lib/pokedex.js,
// lib/stats.js — hepsi AsyncStorage) ile Supabase'deki "profiles" tablosunu
// senkronize eder. Yerel dosyalar TAMAMEN dokunulmadan tek gerçek kaynak
// (source of truth) olarak kalıyor — bu dosya sadece giriş yapılmışsa
// onlarla bulutu eşliyor. Giriş yoksa hiçbir fonksiyonu çağrılmaz.

export async function fetchCloudProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data;
}

// Giriş anında çağrılır: cihazdaki TÜM ilerleme (xp/level + açılan
// futbolcular + mod istatistikleri) ile buluttakini karşılaştırıp HANGİSİ
// İLERİDEYSE (xp daha yüksekse) onu esas alır. Kazanan taraf diğerine
// AYNEN kopyalanır — böylece ne "hesapsızken oynanan ilerleme kaybolur" ne
// de "başka cihazdaki ilerleme silinir" sorunu yaşanır.
export async function reconcileOnLogin(userId) {
  const [local, localPokedex, localStats, cloud] = await Promise.all([
    getProfile(),
    getUnlockedPlayers(),
    getStats(),
    fetchCloudProfile(userId),
  ]);

  if (!cloud) return { winner: "local", local, cloud: null };

  const localAhead = (local.xp || 0) > (cloud.xp || 0);

  if (localAhead) {
    await pushFullProgressToCloud(userId, { profile: local, pokedex: localPokedex, stats: localStats });
    return { winner: "local", local, cloud };
  }

  // Bulut ileride (veya eşit) — cihazı buluttakiyle güncelle.
  await Promise.all([
    overwriteXpLevel(cloud.xp, cloud.level),
    overwriteUnlockedPlayers(cloud.pokedex_unlocked || []),
    overwriteStats(cloud.stats_json && Object.keys(cloud.stats_json).length ? cloud.stats_json : localStats),
  ]);
  return { winner: "cloud", local, cloud };
}

export async function pushCloudProfile(userId, profile) {
  const { error } = await supabase
    .from("profiles")
    .update({
      xp: profile.xp || 0,
      level: profile.level || 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  return { error };
}

// Giriş yapılmış her durumda (örn. Profilim sekmesine her dönüşte) mevcut
// cihaz ilerlemesinin TAMAMINI buluta yazar — sessiz, arka planda çalışan
// bir yedekleme. Hata olursa sessizce yutulur (bağlantı yoksa oyun akışını
// bozmasın diye).
export async function pushFullProgressToCloud(userId, preloaded) {
  try {
    const profile = preloaded?.profile || (await getProfile());
    const pokedex = preloaded?.pokedex || (await getUnlockedPlayers());
    const stats = preloaded?.stats || (await getStats());
    const { error } = await supabase
      .from("profiles")
      .update({
        xp: profile.xp || 0,
        level: profile.level || 1,
        pokedex_unlocked: pokedex,
        stats_json: stats,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    return { error };
  } catch (e) {
    return { error: e };
  }
}

export async function updateDisplayName(userId, displayName) {
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
    .eq("id", userId);
  return { error };
}

export async function updateAvatarColor(userId, colorHex) {
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_color: colorHex, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return { error };
}

// Faz 5 devamı (31 Ağustos 2026) — Kerem: "B'yi hemen yapalım" (gerçek
// fotoğraf avatarı). localUri: expo-image-picker'ın döndürdüğü cihaz-local
// dosya yolu (screens/AccountScreen.js'te ImagePicker.launchImageLibraryAsync
// ile seçiliyor). Supabase Storage'daki "avatars" bucket'ına (bkz.
// supabase/schema_cloud_sync.sql) `${userId}/avatar.jpg` olarak yükler,
// public URL'i profiles.avatar_url'e yazar.
// 12 Eylül 2026 — AVATAR YÜKLEME HİÇ ÇALIŞMIYORDU.
// Eski kod `fetch(localUri).blob()` kullanıyordu; bu, React Native'de
// çalışmayan yolun ta kendisi — mikrofon hatasını ararken lib/useVoiceInput.js
// içinde uzun uzun belgelediğimiz aynı sorun. RN'in Blob'u gerçek ikili veriyi
// taşımıyor, Supabase Storage'a boş/bozuk dosya gidiyordu. try/catch olduğu
// için çökmüyor, sessizce "Fotoğraf yüklenemedi" diyordu.
//
// Doğru yol: dosyayı expo-file-system ile base64 okuyup ArrayBuffer'a çevirmek.
// Supabase Storage ArrayBuffer'ı doğrudan kabul ediyor.
//
// KURULUM GEREKİYOR:  npx expo install expo-file-system

const B64_ALFABE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Hermes'te global atob() yok; küçük bir çözücü yazmak yeni bir paket
// eklemekten daha temiz.
function base64ToBytes(b64) {
  const temiz = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const uzunluk = Math.floor((temiz.length * 3) / 4);
  const bytes = new Uint8Array(uzunluk);
  let p = 0;
  for (let i = 0; i < temiz.length; i += 4) {
    const a = B64_ALFABE.indexOf(temiz[i]);
    const b = B64_ALFABE.indexOf(temiz[i + 1]);
    const c = B64_ALFABE.indexOf(temiz[i + 2]);
    const d = B64_ALFABE.indexOf(temiz[i + 3]);
    if (p < uzunluk) bytes[p++] = (a << 2) | (b >> 4);
    if (p < uzunluk && c >= 0) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < uzunluk && d >= 0) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

export async function uploadAvatarPhoto(userId, localUri) {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = base64ToBytes(base64);
    if (!bytes.byteLength) return { error: new Error("Fotoğraf okunamadı") };
    const path = `${userId}/avatar.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, bytes, { upsert: true, contentType: "image/jpeg" });
    if (uploadError) return { error: uploadError };

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
    // Aynı dosya adına her yüklemede tarayıcı/CDN önbelleği eski fotoğrafı
    // gösterebilir — sona bir zaman damgası ekleyip önbelleği kırıyoruz.
    const cacheBustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: cacheBustedUrl, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (updateError) return { error: updateError };

    return { url: cacheBustedUrl, error: null };
  } catch (e) {
    return { error: e };
  }
}


// 12 Eylül 2026 — HESAP SİLME (Google Play zorunluluğu).
// Kullanıcının Supabase Auth kaydını silmek service_role yetkisi ister, o da
// asla istemcide bulunamaz. Bu yüzden silme işi supabase/functions/
// delete-account edge function'ında yapılıyor; buradan sadece çağrılıyor.
// Fonksiyon çağıranın kendi oturum jetonunu doğruluyor, yani bir kullanıcı
// yalnızca KENDİ hesabını silebiliyor.
export async function deleteAccount() {
  try {
    const { data: oturum } = await supabase.auth.getSession();
    const token = oturum?.session?.access_token;
    if (!token) return { error: new Error("Oturum bulunamadı") };

    const { data, error } = await supabase.functions.invoke("delete-account", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) return { error };
    if (data?.error) return { error: new Error(data.error) };

    await supabase.auth.signOut();
    return { error: null };
  } catch (e) {
    return { error: e };
  }
}
