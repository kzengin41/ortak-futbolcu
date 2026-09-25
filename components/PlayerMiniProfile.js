import React, { useMemo } from "react";
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import TeamBadge from "./TeamBadge";
import { resolvePlayerPhotoUrl } from "../lib/playerPhotos";

import { countryTr } from "../lib/countryNamesTr";
import { positionTr } from "../lib/positionNamesTr";
import { COLORS } from "../lib/theme";
// DİKKAT — burada bilerek `PlayerPhoto` KULLANILMIYOR: PlayerPhoto bu dosyayı
// import ediyor, buradan da onu import etseydik DAİRESEL (circular) bir
// bağımlılık oluşur ve modüllerden biri yüklenirken `undefined` olabilirdi
// (bu projede daha önce "undefined is not a function" render hatalarıyla
// uğraşıldı). Onun yerine avatarı burada, birkaç satırla kendimiz çiziyoruz.
function ProfileAvatar({ name, size }) {
  const [failed, setFailed] = React.useState(false);
  const uri = resolvePlayerPhotoUrl(name);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS.bg }}
        contentFit="cover"
        transition={200}
        onError={() => setFailed(true)}
      />
    );
  }
  const words = (name || "?").split(" ").filter(Boolean);
  const ini = words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[words.length - 1][0]).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS.cardBorder, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: size * 0.32 }}>{ini}</Text>
    </View>
  );
}

// 7 Eylül 2026 (Kerem: "oyuncu resmine tıklandığında açılacak bir mini profil
// sayfası olsa nasıl olur? oyuncu, doğum tarihi, oynadığı kulüpler, başarılar
// vs. yazsa") — futbolcu fotoğrafına dokununca açılan küçük kart.
//
// PERFORMANS NOTU (önemli): Bu ekranın gösterdiği veriler (players.json ~6MB,
// playerBirthPosition.json ~2.7MB vb.) uygulamanın EN AĞIR dosyaları. Bu
// yüzden dosyanın TEPESİNDE import EDİLMİYORLAR — `require(...)` çağrıları
// bilerek fonksiyon İÇİNDE. Metro bu "inline require" desenini destekliyor
// ve modül ancak kart İLK KEZ açıldığında değerlendiriliyor. Böylece
// PlayerPhoto'yu kullanan hafif ekranlar (ana menü, profil vb.) bu veriyi
// boşuna belleğe almıyor.
function buildInfo(name) {
  if (!name) return null;
  try {
    const { PLAYERS } = require("../lib/players");
    const birthPosition = require("../lib/playerBirthPosition.json");
    const years = require("../lib/playerYears.json");
    const nationalTeams = require("../lib/playerNationalTeams.json");
    let achievements = {};
    try { achievements = require("../lib/playerAchievements.json"); } catch (e) {}

    const player = PLAYERS.find((p) => p.name === name);
    const bp = birthPosition[name] || {};
    return {
      clubs: player ? player.clubs : [],
      birthYear: bp.birthYear || null,
      position: bp.position || null,
      lastYear: years[name] || null,
      national: nationalTeams[name] || null,
      achievements: achievements[name] || null,
    };
  } catch (e) {
    return null;
  }
}

const CURRENT_YEAR = new Date().getFullYear();

export default function PlayerMiniProfile({ name, visible, onClose }) {
  // Kart kapalıyken hiç hesaplama yapmıyoruz (ağır require'lar tetiklenmesin).
  const info = useMemo(() => (visible ? buildInfo(name) : null), [visible, name]);
  if (!visible) return null;

  const age = info?.birthYear ? CURRENT_YEAR - info.birthYear : null;
  // playerYears.json = oyuncunun SON AKTİF yılı. Bu yıl ya da geçen yılsa
  // "aktif", daha eskiyse kariyerini bitirmiş sayıyoruz.
  const active = info?.lastYear ? info.lastYear >= CURRENT_YEAR - 1 : null;

  const chips = [];
  // 12 Eylül 2026 (Kerem: "burada da ülke adı ve mevki adı İngilizce yazıyor")
  // — veri seti İngilizce kalıyor, sadece gösterim Türkçeleşiyor.
  const mevki = positionTr(info?.position);
  if (mevki) chips.push({ icon: "football", text: mevki });
  if (info?.birthYear) chips.push({ icon: "calendar", text: `${info.birthYear}${age ? ` (${age})` : ""}` });
  if (info?.national && info.national.length) chips.push({ icon: "flag", text: info.national.map(countryTr).join(", ") });
  if (info?.lastYear) chips.push({ icon: active ? "flash" : "time", text: active ? "Aktif" : `Son sezon ${info.lastYear}` });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* İçeriğe dokunmak kartı kapatmasın diye iç Pressable dokunuşu yutuyor. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Pressable onPress={onClose} hitSlop={16} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={COLORS.textMuted} />
          </Pressable>

          <View style={styles.header}>
            <ProfileAvatar name={name} size={84} />
            <Text style={styles.name} numberOfLines={2}>{name}</Text>
          </View>

          {chips.length > 0 && (
            <View style={styles.chipRow}>
              {chips.map((c, i) => (
                <View key={i} style={styles.chip}>
                  <Ionicons name={c.icon} size={12} color={COLORS.accent} />
                  <Text style={styles.chipText} numberOfLines={1}>{c.text}</Text>
                </View>
              ))}
            </View>
          )}

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 8 }} nestedScrollEnabled>
            {info?.clubs?.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Kulüpler ({info.clubs.length})</Text>
                {info.clubs.map((c, i) => (
                  <View key={`${c}-${i}`} style={styles.clubRow}>
                    <TeamBadge name={c} size={26} />
                    <Text style={styles.clubName} numberOfLines={1}>{c}</Text>
                  </View>
                ))}
              </>
            )}

            {info?.achievements?.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Başarılar</Text>
                {info.achievements.map((a, i) => (
                  <View key={i} style={styles.achRow}>
                    <Ionicons name="trophy" size={13} color={COLORS.cta} />
                    <Text style={styles.achText}>{a}</Text>
                  </View>
                ))}
              </>
            )}

            {!info?.clubs?.length && (
              <Text style={styles.empty}>Bu futbolcu için ayrıntılı bilgi bulunamadı.</Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(6,12,20,0.82)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, maxHeight: "82%", backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 20, padding: 18 },
  closeBtn: { position: "absolute", top: 10, right: 10, zIndex: 2, padding: 4 },
  header: { alignItems: "center", gap: 10, marginBottom: 12 },
  name: { color: COLORS.text, fontSize: 18, fontWeight: "900", textAlign: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 14 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.bg, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 9 },
  chipText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700" },
  body: { flexGrow: 0 },
  sectionTitle: { color: COLORS.cta, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  clubRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  clubName: { color: COLORS.text, fontSize: 13, fontWeight: "600", flex: 1 },
  achRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingVertical: 3 },
  achText: { color: COLORS.text, fontSize: 12, flex: 1, lineHeight: 17 },
  empty: { color: COLORS.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 12 },
});
