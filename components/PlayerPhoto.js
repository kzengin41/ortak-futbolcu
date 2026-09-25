import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { resolvePlayerPhotoUrl } from "../lib/playerPhotos";
import PlayerMiniProfile from "./PlayerMiniProfile";

// Tur başlarken bu fonksiyon çağrılarak fotoğraf arkaplanda indirilebilir.
export function prefetchPlayerPhoto(name) {
  const uri = resolvePlayerPhotoUrl(name);
  if (uri) {
    // Disk önbelleğine de yazsın — tur başında indirilen fotoğraf, uygulama
    // kapanıp açılsa bile tekrar inmesin.
    Image.prefetch(uri, { cachePolicy: "memory-disk" });
  }
}

function initials(name) {
  if (!name || typeof name !== "string") return "?";
  const words = name.split(" ").filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function colorForName(name) {
  if (!name || typeof name !== "string") return "#16222E";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 38%)`;
}

// 7 Eylül 2026 (Kerem: "oyuncu resmine tıklandığında mini profil açılsa") —
// fotoğrafa (ya da fotoğraf yoksa baş harf rozetine) dokunmak futbolcunun
// mini profilini açıyor: pozisyon, doğum yılı/yaş, milli takım, oynadığı
// kulüpler, varsa başarılar. Bu davranış PlayerPhoto'nun İÇİNE konuldu ki
// fotoğrafın geçtiği HER ekranda (sonuç kartları, doğru cevaplar paneli,
// ansiklopedi...) tek seferde çalışsın.
// `showProfileOnPress={false}` ile kapatılabilir — mini profilin KENDİ
// içindeki fotoğrafta sonsuz döngü olmasın diye orada kapalı.
//
// PERFORMANS: PlayerMiniProfile ağır veri dosyalarını (players.json vb.)
// sadece kart AÇILDIĞINDA, inline require ile yüklüyor; bu import zinciri
// hafif ekranlara yük getirmiyor.
export default function PlayerPhoto({ name, size = 64, showProfileOnPress = true }) {
  const [failed, setFailed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const uri = resolvePlayerPhotoUrl(name);
  const showPhoto = uri && !failed;

  // 12 Eylül 2026 (Kerem: "resimlerin yüklenmesi zaman alıyor bazen") —
  // cachePolicy="memory-disk": expo-image indirdiği fotoğrafı DİSKE de yazıyor,
  // yani aynı oyuncu ikinci kez çıktığında (ki bu sık oluyor) ağa hiç
  // gidilmiyor. Varsayılan yalnızca bellekti; uygulama kapanınca her şey
  // baştan iniyordu.
  //
  // NOT — DENENİP GERİ ALINDI: baş harf rozetini fotoğrafın ALTINA koyup
  // üstüne absolute konumlu Image bindirmeyi denedim (boş kutu görünmesin
  // diye). Gerçek cihazda rozet ve fotoğraf KAYIK şekilde üst üste bindi
  // (bkz. Kerem'in ekran görüntüsü). Bu bileşen onlarca farklı yerleşimin
  // içinde kullanıldığı için tek elemanlı ve basit kalması daha güvenli.
  // Boş kutu sorunu daha basit çözüldü: styles.photo'nun arka planı kart
  // rengi, yani fotoğraf inene kadar o dairede nötr bir dolgu duruyor.
  const inner = showPhoto ? (
    <Image
      source={{ uri }}
      style={[styles.photo, { width: size, height: size, borderRadius: size / 2 }]}
      contentFit="cover"
      transition={220}
      cachePolicy="memory-disk"
      onError={() => setFailed(true)}
    />
  ) : (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: colorForName(name) }]}>
      <Text style={[styles.fallbackText, { fontSize: size * 0.32 }]}>{initials(name)}</Text>
    </View>
  );

  if (!showProfileOnPress || !name) return inner;

  return (
    <>
      <Pressable onPress={() => setProfileOpen(true)} hitSlop={6}>
        {inner}
      </Pressable>
      <PlayerMiniProfile name={name} visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  photo: { backgroundColor: "#16222E" },
  fallback: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#0B1620" },
  fallbackText: { color: "#fff", fontWeight: "900" },
});
